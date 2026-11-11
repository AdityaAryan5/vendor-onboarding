import {describe,it,expect} from 'vitest';import {parseEvidence,parseTsv} from '../lib/local-reader';
const parse=(text:string)=>parseEvidence(text.split('\n').map(text=>({text,page:1,confidence:.96})));
describe('conservative local parser',()=>{
 it('supports common bank labels and leading zeros',()=>{const e=parse('BANK PROOF\nAccount holder name: Orbit Private Limited\nAccount number: 0011223300\nIFSC Code: DEMO0123456');expect(e.type).toBe('bank');expect(e.fields.account).toBe('0011223300');expect(e.fields.name).toBe('Orbit Private Limited');expect(e.confidence).toBeGreaterThan(.7);});
 it('maps state name to its configured code',()=>{const e=parse('GST Certificate\nLegal name of business: Orbit Private Limited\nGSTIN: 27AABCO1234A1Z0\nState name and code: Maharashtra, 27');expect(e.fields.state).toBe('27');});
 it('does not infer a PAN card PAN from a GSTIN',()=>expect(parse('GST Certificate\nGSTIN: 27AABCO1234A1Z0').fields.pan).toBeNull());
 it('conflicting fields require review',()=>{const e=parse('BANK PROOF\nName: Orbit Private Limited\nAccount: 001122\nAccount: 009988\nIFSC: DEMO0123456');expect(e.fields.account).toBeNull();expect(e.confidence).toBeLessThan(.7);});
 it('conflicting state name/code requires review',()=>expect(parse('GST Certificate\nName: Orbit\nGSTIN: 27AABCO1234A1Z0\nState: Karnataka 27').confidence).toBeLessThan(.7));
 it('ambiguous OCR letters in account number are not silently corrected',()=>{const e=parse('BANK PROOF\nName: Orbit\nAccount: OO1122\nIFSC: DEMO0123456');expect(e.fields.account).toBeNull();expect(e.confidence).toBeLessThan(.7);});
 it('unlabelled names are not guessed',()=>{const e=parse('PAN CARD\nOrbit Private Limited\nPAN: AABCO1234A');expect(e.fields.name).toBeNull();expect(e.confidence).toBeLessThan(.7);});
 it('contradictory document types are uncertain',()=>expect(parse('GST certificate and bank proof\nGSTIN: 27AABCO1234A1Z0\nAccount: 001122\nIFSC: DEMO0123456').type).toBe('other'));
 it('tracks page and minimum OCR word confidence',()=>{const lines=parseTsv('level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t98\tName:\n5\t1\t1\t1\t1\t2\t20\t0\t10\t10\t42\tOrbit',2);expect(lines[0]).toEqual({text:'Name: Orbit',page:2,confidence:.42});});
 it('empty extraction requires review',()=>expect(parse('').confidence).toBeLessThan(.7));
});
