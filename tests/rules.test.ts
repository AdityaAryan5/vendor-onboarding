import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {india} from '../config/countries/india';
import {evaluateStage,decide,checksum,normalizeName,mask} from '../lib/rules';
import type {Form,DocEvidence,Records} from '../lib/types';
const fixtures=JSON.parse(readFileSync('test_data/manifest.json','utf8'));
const base=()=>{const s=fixtures[0];return {form:structuredClone(s.form) as Form,docs:['gst','pan','bank'].map(slot=>({slot,extraction:structuredClone(s.evidence[slot])})) as DocEvidence[]};};
const run=(form:Form,docs:DocEvidence[],records:Records={})=>[1,2,3,4,5].flatMap(n=>evaluateStage(n,form,docs,records,new Date('2026-11-10')));
// Independently implemented right-to-left reference, not imported from fixture generation.
function referenceCheck(s:string){let weight=2;let total=0;for(const ch of s.slice(0,-1).split('').reverse()){const product=parseInt(ch,36)*weight;total+=product>=36?product-35:product;weight=3-weight;}return (36-total%36)%36===parseInt(s.at(-1)!,36);}
describe('fixture checksum verification',()=>{for(const s of fixtures)it(`${s.id}: independent checksum`,()=>expect(referenceCheck(s.form.gstin)).toBe(s.id!=='S7'));it('published GSTIN checksum vector',()=>{expect(checksum('27AAPFU0939F1Z')).toBe('V');expect(referenceCheck('27AAPFU0939F1ZV')).toBe(true);});});
describe('scenario outcomes',()=>{for(const s of fixtures)it(`${s.id} -> ${s.expected}`,()=>{const docs=['gst','pan','bank'].map(slot=>({slot,extraction:s.evidence[slot]})) as DocEvidence[];const records=s.id==='S5'?{bankMatches:['Beacon Supply']}:s.id==='S6'?{blocklisted:true}:{};expect(decide(run(s.form,docs,records)).status).toBe(s.expected);});});
describe('policy coverage',()=>{
 const cases:[string,(x:ReturnType<typeof base>)=>void,Records?][]=[
 ['country',x=>x.form.country='US'],['required',x=>delete x.form.address],['email',x=>x.form.email='bad'],
 ['file',x=>x.docs[0].error='file'],['extraction',x=>x.docs[0].extraction!.confidence=.69],['document_type',x=>x.docs[2].extraction!.type='gst'],['document_fields',x=>x.docs[2].extraction!.fields.account=null],
 ['pan_format',x=>x.form.pan='bad'],['pan_entity',x=>x.form.pan='AABPA1234A'],['gst_format',x=>x.form.gstin='XX'],['gst_checksum',x=>x.form.gstin=x.form.gstin.slice(0,14)+(x.form.gstin.endsWith('0')?'1':'0')],['ifsc',x=>x.form.ifsc='DEMO1123456'],['expiry',x=>x.docs[2].extraction!.fields.expiry='2020-01-01'],['embedded_pan',x=>x.docs[1].extraction!.fields.pan='AABCB1234C'],['gst_identity',x=>x.docs[0].extraction!.fields.gstin='27AABCB1234C1Z0'],['state',x=>x.docs[0].extraction!.fields.state='29'],['bank',x=>x.docs[2].extraction!.fields.account='123'],['name',x=>x.docs[2].extraction!.fields.name='Other Corporation'],['identity_duplicate',()=>{},{identityMatches:['existing']}],['bank_duplicate',()=>{},{bankMatches:['existing']}],['blocklist',()=>{},{blocklisted:true}]
 ];for(const [id,change,records]of cases)it(`${id}: failure mapped to policy`,()=>{const x=base();change(x);const check=run(x.form,x.docs,records).find(c=>c.ruleId===id&&c.outcome);expect(check?.outcome).toBe(india.rules.find(r=>r.id===id)!.failure);});
 it('every configured rule has a failure test',()=>expect(cases.map(c=>c[0]).sort()).toEqual(india.rules.map(r=>r.id).sort()));
 it('malformed extraction never approves',()=>{const x=base();x.docs[0].extraction={} as any;expect(decide(run(x.form,x.docs)).status).toBe('PENDING_REVIEWER');});
 it('field confidence gates whole evidence',()=>{const x=base();x.docs[0].extraction!.evidence[0].confidence=.1;expect(decide(run(x.form,x.docs)).status).toBe('PENDING_REVIEWER');});
 it('inclusive confidence threshold',()=>{const x=base();x.docs.forEach(d=>d.extraction!.confidence=.7);expect(decide(run(x.form,x.docs)).status).toBe('APPROVED');});
 it('wrong bank document blocks bank checks',()=>{const x=base();x.docs[2].extraction!.type='gst';expect(run(x.form,x.docs).find(c=>c.ruleId==='bank')?.result).toBe('blocked');});
 it('preserves both pending action lists',()=>{const x=base();x.form.email='bad';x.docs[2].extraction!.confidence=.1;const d=decide(run(x.form,x.docs));expect(d.status).toBe('PENDING_REVIEWER');expect(d.vendorActions.length).toBeGreaterThan(0);expect(d.reviewerActions.length).toBeGreaterThan(0);});
 it('rejection outranks review',()=>{const x=base();x.docs[0].extraction!.confidence=.1;expect(decide(run(x.form,x.docs,{blocklisted:true})).status).toBe('REJECTED');});
 it('uncertain document GSTIN never rejects',()=>{const x=base();x.docs[0].extraction!.fields.gstin='27AABCA1200A1Z0';x.docs[0].extraction!.confidence=.2;expect(decide(run(x.form,x.docs)).status).toBe('PENDING_REVIEWER');});
 it('missing file requests vendor action',()=>{const x=base();x.docs.pop();expect(decide(run(x.form,x.docs)).status).toBe('PENDING_VENDOR');});
 it('invalid date is review, not expiry rejection',()=>{const x=base();x.docs[2].extraction!.fields.expiry='2026-02-31';expect(decide(run(x.form,x.docs)).status).toBe('PENDING_REVIEWER');});
 it('normalizes abbreviations without stripping words',()=>{expect(normalizeName('Acme Pvt Ltd')).toBe(normalizeName('ACME Private Limited'));expect(normalizeName('Acme Industrial Supplies')).not.toBe(normalizeName('Acme Private Limited'));});
 it('account numbers retain leading zeros',()=>{expect(mask('0000123456')).toBe('•••• 3456');const x=base();x.docs[2].extraction!.fields.account=String(Number(x.form.account));expect(decide(run(x.form,x.docs)).status).toBe('PENDING_REVIEWER');});
});
