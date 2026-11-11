import {describe,it,expect} from 'vitest';import {actionSchema,reviewFindings,reviewPolicyError,reviewedDecision,fingerprint} from '../lib/review-policy';import type {Check} from '../lib/types';
const issue=(ruleId='embedded_pan',outcome:Check['outcome']='PENDING_REVIEWER'):Check=>({ruleId,stage:4,checkType:'code',result:'warn',reason:'Conflict',evidence:{formPAN:'AABCA1200A',embeddedPAN:'AABCB9876C'},outcome,owner:outcome==='PENDING_VENDOR'?'vendor':'reviewer'});
const input=()=>actionSchema.parse({action:'approve',expectedRevision:1,expectedDecisionId:'decision',idempotencyKey:'00000000-0000-4000-8000-000000000001',note:'Reviewed originals.'});
describe('review decision gates',()=>{
 it('requires a non-blank note',()=>expect(actionSchema.safeParse({...input(),note:'  '}).success).toBe(false));
 it('requires a separate resolution for every finding',()=>expect(reviewPolicyError(input(),[issue()])).toContain('every'));
 it('accepts deliberate resolution of an evidence conflict',()=>{const c=issue();expect(reviewPolicyError({...input(),resolutions:[{findingId:reviewFindings([c])[0].findingId,note:'Confirmed scope of registration with vendor.'}]},[c])).toBeNull();});
 it.each(['blocklist','gst_checksum','country'])('cannot override hard rule %s',id=>expect(reviewPolicyError(input(),[issue(id,'REJECTED')])).toContain('cannot override'));
 it('cannot override missing mandatory evidence',()=>expect(reviewPolicyError(input(),[issue('required','PENDING_VENDOR')])).toContain('mandatory'));
 it.each(['extraction','document_fields'])('cannot approve unavailable %s',id=>expect(reviewPolicyError(input(),[issue(id)])).toContain('mandatory'));
 it('changed evidence invalidates old finding acknowledgements',()=>expect(reviewFindings([issue()])[0].findingId).not.toEqual(reviewFindings([{...issue(),evidence:{different:'value'}}])[0].findingId));
 it('canonical evidence ignores object key order',()=>expect(fingerprint({a:1,b:2})).toBe(fingerprint({b:2,a:1})));
 it('information request needs a vendor message and exact requested items',()=>expect(reviewPolicyError({...input(),action:'request_info'},[issue()])).toContain('vendor-visible'));
 it('never copies the internal rejection note into vendor communication',()=>expect(reviewedDecision({...input(),action:'reject',note:'PRIVATE NOTE'},'Priya').vendorMessage).not.toContain('PRIVATE'));
 it('request for info sets vendor ownership',()=>expect(reviewedDecision({...input(),action:'request_info',vendorMessage:'Upload matching PAN evidence.',requestedSlots:['pan']},'Priya').pendingOwner).toBe('vendor'));
});
