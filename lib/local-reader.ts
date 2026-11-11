import {india} from '../config/countries/india';
import type {Extraction} from './types';
import DOMMatrix from '@thednp/dommatrix';
export type TextLine={text:string;page:number;confidence:number};
export type ReadResult={lines:TextLine[];source:'pdf'|'ocr';ocrPages:number[]};
export const scanUnavailable='Scanned file; OCR unavailable in this environment.';
// PDF.js extracts text only. No canvas rendering or native OCR in production.
export async function readLocalPdf(bytes:Buffer,pageCount:number):Promise<ReadResult>{
 if(!globalThis.DOMMatrix)Object.assign(globalThis,{DOMMatrix});
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=getDocument({data:new Uint8Array(bytes),useSystemFonts:false,useWorkerFetch:false,verbosity:0});
 const pdf=await task.promise;const lines:TextLine[]=[];let needsOcr=false;
 try{for(let i=1;i<=pageCount;i++){
 const page=await pdf.getPage(i);const content=await page.getTextContent();const rows=new Map<number,{x:number;text:string}[]>();
 for(const item of content.items){if(!('str' in item)||!item.str.trim())continue;const y=Math.round(item.transform[5]);const row=rows.get(y)||[];row.push({x:item.transform[4],text:item.str});rows.set(y,row);}
 const pageLines=[...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,row])=>row.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ').trim());
 const text=pageLines.join('\n');if(!text.trim())needsOcr=true;
 lines.push(...pageLines.map(text=>({text,page:i,confidence:.96})));
 }}finally{await task.destroy();}
 if(needsOcr){
 // Dynamic dev-only fallback. Hosted builds always stay in the JS-only branch.
 if(process.env.NODE_ENV!=='production'&&process.env.OCR_ENABLED!=='false'){
 const native=await import('./native-reader');if(await native.nativeAvailable())return native.readNativePdf(bytes,pageCount);
 }
 throw Error(scanUnavailable);
 }
 return {lines,source:'pdf',ocrPages:[]};
}
export function parseTsv(tsv:string,page:number):TextLine[]{const grouped=new Map<string,{words:string[];confidence:number[]}>();for(const line of tsv.split('\n').slice(1)){const cells=line.split('\t');if(cells.length<12||cells[0]!=='5'||!cells[11]?.trim())continue;const key=cells.slice(1,5).join(':');const group=grouped.get(key)||{words:[],confidence:[]};group.words.push(cells.slice(11).join('\t').trim());const conf=Number(cells[10])/100;group.confidence.push(Number.isFinite(conf)?Math.max(0,Math.min(1,conf)):0);grouped.set(key,group);}return [...grouped.values()].map(g=>({text:g.words.join(' '),page,confidence:Math.min(...g.confidence)}));}
const labels:Record<keyof Extraction['fields'],RegExp>={
 name:/^(?:legal\s+name(?:\s+of\s+(?:the\s+)?business)?|registered\s+(?:legal\s+)?name|company\s+name|account\s+holder(?:\s*'?s)?\s+name|account\s+name|name)\s*[:\-]\s*(.+)$/i,
 pan:/^(?:permanent\s+account\s+number(?:\s*\(PAN\))?|PAN(?:\s*(?:number|no\.?))?)\s*[:\-]\s*(.+)$/i,
 gstin:/^(?:GSTIN(?:\s*\/\s*UIN)?|GST(?:\s+registration)?\s*(?:number|no\.?))\s*[:\-]\s*(.+)$/i,
 state:/^(?:GST\s+registration\s+state|state(?:\s+name)?(?:\s+and\s+code)?|state\s+code)\s*[:\-]\s*(.+)$/i,
 account:/^(?:bank\s+)?(?:account|a\/c)(?:\s*(?:number|no\.?))?\s*[:\-]\s*(.+)$/i,
 ifsc:/^IFSC(?:\s+code)?\s*[:\-]\s*(.+)$/i,
 expiry:/^(?:expiry(?:\s+date)?|valid\s+(?:until|till|to))\s*[:\-]\s*(.+)$/i
};
export function parseEvidence(lines:TextLine[]):Extraction{
 const text=lines.map(l=>l.text).join('\n');
 const bank=/\bIFSC\b/i.test(text)&&/\b(?:account|a\/c)\b/i.test(text);
 const gst=/\bGSTIN\b|\bGST\s+(?:registration|certificate|evidence)\b/i.test(text);
 const pan=/\bPAN\s+(?:card|evidence)\b|Permanent\s+Account\s+Number|^pan\s*:/im.test(text);
 const type:Extraction['type']=bank&&!gst?'bank':gst&&!bank?'gst':pan&&!bank&&!gst?'pan':'other';
 const fields:Extraction['fields']={name:null,pan:null,gstin:null,state:null,account:null,ifsc:null,expiry:null};const evidence:Extraction['evidence']=[];let ambiguous=type==='other';
 for(const key of Object.keys(fields) as (keyof typeof fields)[]){const candidates:{value:string;line:TextLine}[]=[];
 for(const line of lines){const match=line.text.match(labels[key]);if(!match)continue;let value=match[1].trim();
 if(['pan','gstin','ifsc'].includes(key))value=value.toUpperCase().replace(/\s/g,'');
 if(key==='account'){// Do not silently remove meaningful punctuation or turn ambiguous OCR into digits.
 if(!/^[0-9 ]+$/.test(value)){ambiguous=true;continue;}value=value.replace(/ /g,'');}
 if(key==='state'){const upper=value.toLowerCase();const code=value.match(/\b(\d{2})\b/)?.[1];const name=Object.entries(india.states).find(([,name])=>upper.includes(name.toLowerCase()))?.[0];if(code&&name&&code!==name){ambiguous=true;continue;}value=code||name||'';if(!india.states[value]){ambiguous=true;continue;}}
 if(value)candidates.push({value,line});}
 const unique=[...new Set(candidates.map(c=>c.value))];if(unique.length>1){ambiguous=true;continue;}if(unique.length===1){const c=candidates.reduce((a,b)=>a.line.confidence<b.line.confidence?a:b);fields[key]=c.value;evidence.push({field:key,value:c.value,page:c.line.page,confidence:c.line.confidence});}
 }
 const required=type==='gst'?['name','gstin','state']:type==='pan'?['name','pan']:type==='bank'?['name','account','ifsc']:[];
 const complete=required.length>0&&required.every(k=>fields[k as keyof typeof fields]);
 // Scores are conservative extraction heuristics, not calibrated probabilities.
 const confidence=(ambiguous||!complete) ? .4 :Math.min(.96,...evidence.map(e=>e.confidence));
 return {type,confidence,fields,evidence};
}
