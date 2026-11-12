import {geminiEnabled,geminiCacheKey,geminiVersion,readGeminiPdf} from './gemini';
import {PDFDocument} from 'pdf-lib';
import {eq} from 'drizzle-orm';
import {db} from './db';import {extractionCache} from './db/schema';
import {cacheKey,EXTRACTOR_VERSION,SCHEMA_VERSION} from './cache-key';
import {extractionSchema,type DocEvidence,type Slot} from './types';import {sha256} from './security';
import {readLocalPdf,parseEvidence} from './local-reader';
export async function extract(bytes:Buffer,slot:Slot,filename:string,preferCache=false,parserOnly=false):Promise<DocEvidence>{
 let pageCount=0;try{const pdf=await PDFDocument.load(bytes);pageCount=pdf.getPageCount();if(pdf.isEncrypted||pageCount>15||!pageCount)throw Error('Unsupported PDF');}catch{return {slot,filename,error:'file'};}
 const hash=sha256(bytes);let fallback=false;
 if(!parserOnly&&geminiEnabled()){
  let extraction;try{extraction=await readGeminiPdf(bytes);}catch{fallback=true;}
  if(extraction){const provenance='AI (Gemini) · '+geminiVersion();
   try{await db.insert(extractionCache).values({key:geminiCacheKey(hash),sha256:hash,extractorVersion:geminiVersion(),schemaVersion:SCHEMA_VERSION,evidence:extraction,provenance}).onConflictDoUpdate({target:extractionCache.key,set:{evidence:extraction,provenance}});}catch{/* Evidence remains usable if cache storage fails. */}
   return {slot,filename,extraction,source:'gemini',provenance};
  }
  for(const key of [geminiCacheKey(hash),cacheKey(hash)]){try{const [cached]=await db.select().from(extractionCache).where(eq(extractionCache.key,key)).limit(1);const valid=extractionSchema.safeParse(cached?.evidence);if(cached&&valid.success&&!cached.provenance.startsWith('fixture-curated'))return {slot,filename,extraction:valid.data,source:'cache',provenance:`Cached extraction used after Gemini unavailable. Previous extraction: ${cached.provenance}`};}catch{/* Continue to parser. */}}
 }

 if(preferCache){const [cached]=await db.select().from(extractionCache).where(eq(extractionCache.key,cacheKey(hash))).limit(1);const valid=extractionSchema.safeParse(cached?.evidence);if(cached&&valid.success&&!cached.provenance.startsWith('fixture-curated'))return {slot,filename,extraction:valid.data,source:'cache',provenance:`Cached extraction used for an unchanged document. Previous actual extraction: ${cached.provenance}`};}

 try{
 const read=await readLocalPdf(bytes,pageCount);const parsed=extractionSchema.safeParse(parseEvidence(read.lines));
 if(!parsed.success)return {slot,filename,error:'extraction',provenance:'Local extraction returned invalid evidence; human review required.'};
 const extraction=parsed.data;const provenance=read.source==='ocr'?`Local OCR · Tesseract · pages ${read.ocrPages.join(', ')}. No external API. Scores are extraction heuristics, not verified probabilities.`:'PDF text extraction · PDF.js (JavaScript). No external API. Scores are extraction heuristics, not verified probabilities.';
 // Only genuinely extracted, schema-valid evidence is cached. No curated fixture seeding.
 await db.insert(extractionCache).values({key:cacheKey(hash),sha256:hash,extractorVersion:EXTRACTOR_VERSION,schemaVersion:SCHEMA_VERSION,evidence:extraction,provenance}).onConflictDoUpdate({target:extractionCache.key,set:{evidence:extraction,provenance}});
 return {slot,filename,extraction,source:fallback?'parser_fallback':read.source,provenance:fallback?`Parser (fallback) · ${provenance}`:provenance};
 }catch(error){
 const [cached]=await db.select().from(extractionCache).where(eq(extractionCache.key,cacheKey(hash))).limit(1);
 if(cached){const parsed=extractionSchema.safeParse(cached.evidence);if(parsed.success&&!cached.provenance.startsWith('fixture-curated'))return {slot,filename,extraction:parsed.data,source:'cache',provenance:`Cached extraction used after a local tool failure. Previous actual extraction: ${cached.provenance}`};}
 return {slot,filename,error:'extraction',source:fallback?'parser_fallback':undefined,provenance:error instanceof Error&&error.message==='Scanned file; OCR unavailable in this environment.'?error.message:'PDF extraction failed or timed out. No usable cache. Human review required.'};
 }
}
