import {limitRequest} from '@/lib/request-limits';
import {expireRun} from '@/lib/run-lifetime';
import {eq,and} from 'drizzle-orm';
import {session} from '@/lib/session';import {db} from '@/lib/db';import * as t from '@/lib/db/schema';import {redact} from '@/lib/workflow';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const limited=await limitRequest(_req,'read');if(limited)return limited;const s=await session();if(!s)return Response.json({error:'Sign in first.'},{status:401});const {id}=await params;
 const [record]=await db.select({run:t.runs,case:t.cases}).from(t.runs).innerJoin(t.revisions,eq(t.runs.revisionId,t.revisions.id)).innerJoin(t.cases,eq(t.revisions.caseId,t.cases.id)).where(and(eq(t.runs.id,id),eq(t.cases.ownerId,s.id)));
 if(!record)return Response.json({error:'Run not found.'},{status:404});
 if(await expireRun(record.case.id,id)){const [updated]=await db.select().from(t.runs).where(eq(t.runs.id,id));record.run=updated;}
 const checks=await db.select().from(t.checkResults).where(eq(t.checkResults.runId,id));const docs=await db.select().from(t.documents).where(eq(t.documents.revisionId,record.run.revisionId));const decisions=await db.select().from(t.decisions).where(eq(t.decisions.runId,id));
 return Response.json(redact({run:record.run,trackingId:record.case.trackingId,checks:checks.map(c=>c.data),documents:docs.map(d=>({slot:d.slot,source:d.source,provenance:d.provenance,error:d.error})),decision:(decisions.find(d=>d.id===record.case.currentDecisionId)||decisions.at(-1))?.data??null}),{headers:{'Cache-Control':'no-store'}});
}
