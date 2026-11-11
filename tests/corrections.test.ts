import {describe,it,expect} from 'vitest';import {correctionRequest} from '../lib/corrections';import type {Check} from '../lib/types';
const issue=(ruleId:string,evidence={},owner:Check['owner']='vendor',outcome:Check['outcome']='PENDING_VENDOR'):Check=>({ruleId,stage:2,checkType:'code',result:'warn',reason:'test',evidence,owner,outcome});
describe('server-derived correction scope',()=>{
 it('wrong bank document requests only bank replacement',()=>expect(correctionRequest([issue('document_type',{slot:'bank'})])).toEqual({fields:[],slots:['bank']}));
 it('missing evidence lists exact field and document',()=>expect(correctionRequest([issue('required',{missing:['email','pan document']})])).toEqual({fields:['email'],slots:['pan']}));
 it('checksum rejection permits correcting GSTIN and certificate',()=>expect(correctionRequest([issue('gst_checksum',{},'reviewer','REJECTED')])).toEqual({fields:['gstin'],slots:['gst']}));
 it('unsupported country can be corrected',()=>expect(correctionRequest([issue('country',{},'reviewer','REJECTED')]).fields).toEqual(['country']));
 it('reviewer conflict does not silently become vendor approval',()=>expect(correctionRequest([issue('name',{},'reviewer','PENDING_REVIEWER')])).toEqual({fields:[],slots:[]}));
 it('blocklist rejection does not request switching bank accounts',()=>expect(correctionRequest([issue('blocklist',{},'reviewer','REJECTED')])).toEqual({fields:[],slots:[]}));
 it('passing checks request no edits',()=>expect(correctionRequest([{...issue('email'),outcome:undefined}])).toEqual({fields:[],slots:[]}));
 it('duplicate requests are collapsed',()=>expect(correctionRequest([issue('file',{slot:'bank'}),issue('expiry',{slot:'bank'})]).slots).toEqual(['bank']));
});
