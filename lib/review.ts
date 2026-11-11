import {randomUUID} from 'node:crypto';import {eq,and,desc,sql} from 'drizzle-orm';
import {db} from './db';import * as t from './db/schema';import {lookupRecords} from './records';import {evaluateStage} from './rules';import {bankHash} from './security';import {caseDetail,redact} from './workflow';import type {Session} from './session';import type {Check,DocEvidence,Slot} from './types';
import {actionSchema,reviewFindings,approvalBlockers,reviewPolicyError,reviewedDecision,fingerprint,type ReviewActionInput} from './review-policy';
export class ReviewError extends Error{constructor(message:string,public status=409){super(message);}}
async function freshChecks(store:Pick<typeof db,'select'>,c:typeof t.cases.$inferSelect){
 const [rev]=await store.select().from(t.revisions).where(and(eq(t.revisions.caseId,c.id),eq(t.revisions.number,c.currentRevision)));
 const [run]=await store.select().from(t.runs).where(eq(t.runs.revisionId,rev.id)).orderBy(desc(t.runs.createdAt));
 const docs=await store.select().from(t.documents).where(eq(t.documents.revisionId,rev.id));
 const evidence:DocEvidence[]=docs.map(d=>({slot:d.slot as Slot,extraction:d.extractedJson||undefined,error:d.error as DocEvidence['error'],source:d.source as DocEvidence['source'],provenance:d.provenance||undefined}));
 const records=await lookupRecords(rev.submittedValues,c.id,store);const checks:Check[]=[1,2,3,4,5].flatMap(n=>evaluateStage(n,rev.submittedValues,evidence,records));
 return {rev,run,checks};
}
export async function reviewDetail(trackingId:string,actor:Session){
 if(actor.role!=='reviewer')throw new ReviewError('Reviewer role required.',403);
 const [c]=await db.select().from(t.cases).where(eq(t.cases.trackingId,trackingId));if(!c)throw new ReviewError('Case not found.',404);
 const detail=await caseDetail(trackingId,actor.id,true);const snapshot=await freshChecks(db,c);const actions=await db.select().from(t.reviewerActions).where(eq(t.reviewerActions.caseId,c.id)).orderBy(desc(t.reviewerActions.createdAt));
 return redact({...detail,canEdit:false,reviewState:{expectedRevision:c.currentRevision,expectedDecisionId:c.currentDecisionId,runState:snapshot.run?.state,findings:reviewFindings(snapshot.checks),blockers:approvalBlockers(snapshot.checks)},reviewHistory:actions},true);
}
export async function actOnCase(trackingId:string,actor:Session,raw:unknown){
 if(actor.role!=='reviewer')throw new ReviewError('Reviewer role required.',403);
 const parsed=actionSchema.safeParse(raw);if(!parsed.success)throw new ReviewError(parsed.error.issues.map(x=>x.message).join(' '),400);const input=parsed.data;
 return db.transaction(async tx=>{
 const [c]=await tx.select().from(t.cases).where(eq(t.cases.trackingId,trackingId)).for('update');if(!c)throw new ReviewError('Case not found.',404);
 const key=`${actor.id}:${c.id}:${input.idempotencyKey}`,payloadHash=fingerprint(input);
 const [prior]=await tx.select().from(t.reviewerActions).where(eq(t.reviewerActions.requestKey,key));if(prior){if(prior.payloadHash!==payloadHash)throw new ReviewError('This action key was already used with different content.');return {decisionId:prior.decisionId,existing:true};}
 if(c.currentRevision!==input.expectedRevision||c.currentDecisionId!==input.expectedDecisionId)throw new ReviewError('The revision or decision changed. Reload this case before taking action.');
 // Serialize reviewer approvals sharing a bank account, then check current records.
 const [revision]=await tx.select().from(t.revisions).where(and(eq(t.revisions.caseId,c.id),eq(t.revisions.number,c.currentRevision)));
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${bankHash(revision.submittedValues.account||'')}))`);
 const {rev,run,checks}=await freshChecks(tx,c);
 if(run?.state!=='completed')throw new ReviewError('Wait for a successfully completed run before reviewing.');
 const policyError=reviewPolicyError(input,checks);if(policyError)throw new ReviewError(policyError);
 if(!['PENDING_REVIEWER','PENDING_VENDOR'].includes(c.status))throw new ReviewError('This case already has a terminal decision. A corrected revision is required before another review.');
 const decision=reviewedDecision(input,actor.name),decisionId=randomUUID();
 await tx.insert(t.decisions).values({id:decisionId,revisionId:rev.id,runId:run.id,data:decision,source:'reviewer'});
 await tx.insert(t.reviewerActions).values({id:randomUUID(),caseId:c.id,revisionId:rev.id,decisionId,requestKey:key,payloadHash,actorId:actor.id,actor:actor.name,action:input.action,note:input.note,resolutions:input.resolutions,checksSnapshot:checks});
 await tx.update(t.cases).set({status:decision.status,pendingOwner:decision.pendingOwner,currentDecisionId:decisionId,updatedAt:new Date()}).where(eq(t.cases.id,c.id));
 await tx.insert(t.auditEvents).values({id:randomUUID(),caseId:c.id,actor:actor.name,actorType:'reviewer',action:`reviewer_${input.action}`,previousState:c.status,newState:decision.status,note:input.note});
 return {decisionId,existing:false,status:decision.status};
 });
}
