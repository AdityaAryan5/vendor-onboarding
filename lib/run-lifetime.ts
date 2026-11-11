import {randomUUID} from 'node:crypto';import {and,eq,inArray,lt} from 'drizzle-orm';
import {db} from './db';import * as t from './db/schema';
export const FUNCTION_SECONDS=60,WORK_BUDGET_MS=45_000,STALE_AFTER_MS=75_000;
// A crashed/terminated invocation cannot leave a permanent running badge.
// This is a technical failure, never an onboarding rejection.
export async function expireRun(caseId:string,runId:string){
 return db.transaction(async tx=>{const expired=await tx.update(t.runs).set({state:'failed',error:'Run exceeded its execution window. No rejection was inferred. Contact the demo operator to retry.',completedAt:new Date()}).where(and(eq(t.runs.id,runId),inArray(t.runs.state,['queued','running']),lt(t.runs.createdAt,new Date(Date.now()-STALE_AFTER_MS)))).returning();
 if(expired.length)await tx.insert(t.auditEvents).values({id:randomUUID(),caseId,actor:'Run monitor',actorType:'system',action:'run_expired',note:'Serverless execution window expired; saved decisions, if any, are retained. No rejection inferred.'});return !!expired.length;});
}
