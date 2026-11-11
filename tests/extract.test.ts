import {beforeEach,describe,it,expect,vi} from 'vitest';import {readFileSync} from 'node:fs';
const mocks=vi.hoisted(()=>({read:vi.fn(),cached:[] as any[],write:vi.fn()}));
vi.mock('../lib/local-reader',async original=>({...await original<any>(),readLocalPdf:mocks.read}));
vi.mock('../lib/db',()=>({db:{select:()=>({from:()=>({where:()=>({limit:async()=>mocks.cached})})}),insert:()=>({values:()=>({onConflictDoUpdate:mocks.write})})}}));
import {extract} from '../lib/extract';
const fixture=JSON.parse(readFileSync('test_data/S1.json','utf8'));const bytes=readFileSync('test_data/S1-bank.pdf');
const lines=['BANK PROOF','Name: ACME Private Limited','Account: 000076543200','IFSC: DEMO0123456'].map(text=>({text,page:1,confidence:.96}));
beforeEach(()=>{vi.clearAllMocks();mocks.cached=[];mocks.write.mockResolvedValue(undefined);mocks.read.mockResolvedValue({lines,source:'pdf',ocrPages:[]});});
describe('local extraction trust boundary',()=>{
 it('reads a real PDF without any API or seeded cache',async()=>{const e=await extract(bytes,'bank','bank.pdf');expect(e.source).toBe('pdf');expect(e.extraction?.fields.account).toBe('000076543200');expect(e.provenance).toContain('No external API');});
 it('OCR is labelled explicitly',async()=>{mocks.read.mockResolvedValue({lines,source:'ocr',ocrPages:[1]});expect((await extract(bytes,'bank','bank.pdf')).source).toBe('ocr');});
 it('tool failure with no cache requires review',async()=>{mocks.read.mockRejectedValue(Error('missing binary'));expect((await extract(bytes,'bank','bank.pdf')).error).toBe('extraction');});
 it('tool failure can reuse actual prior local evidence',async()=>{mocks.read.mockRejectedValue(Error('timeout'));mocks.cached=[{evidence:fixture.evidence.bank,provenance:'Local PDF text extraction'}];expect((await extract(bytes,'bank','bank.pdf')).source).toBe('cache');});
 it('curated fixture evidence is never a fallback',async()=>{mocks.read.mockRejectedValue(Error('timeout'));mocks.cached=[{evidence:fixture.evidence.bank,provenance:'fixture-curated: synthetic'}];expect((await extract(bytes,'bank','bank.pdf')).error).toBe('extraction');});
 it('low confidence cannot be replaced with a high-confidence cache',async()=>{mocks.cached=[{evidence:fixture.evidence.bank,provenance:'Local PDF text extraction'}];mocks.read.mockResolvedValue({lines:lines.map(l=>({...l,confidence:.3})),source:'ocr',ocrPages:[1]});const e=await extract(bytes,'bank','bank.pdf');expect(e.source).toBe('ocr');expect(e.extraction?.confidence).toBe(.3);});
 it('slot does not dictate classification',async()=>{mocks.read.mockResolvedValue({lines:['GST CERTIFICATE','Name: Acme Private Limited','GSTIN: 27AABCA1200A1ZT','State: 27'].map(text=>({text,page:1,confidence:.96})),source:'pdf',ocrPages:[]});expect((await extract(bytes,'bank','bank.pdf')).extraction?.type).toBe('gst');});
 it('corrupt PDF asks vendor for replacement without invoking tools',async()=>{expect((await extract(Buffer.from('broken'),'bank','bad.pdf')).error).toBe('file');expect(mocks.read).not.toHaveBeenCalled();});
});
