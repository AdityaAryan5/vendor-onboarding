import {randomUUID} from 'node:crypto';
import {eq,and,desc,sql} from 'drizzle-orm';
import {db} from './db';import * as t from './db/schema';
import {india} from '../config/countries/india';
import {correctionRequest} from './corrections';
import {stageNames,type Upload} from './workflow';
import {bankHash,sha256} from './security';
export class CorrectionError extends Error{constructor(message:string,public status=400){super(message);}}
export async function resubmitCase(trackingId:string,ownerId:string,expectedRevision:number,requestKey:string,changes:Record<string,string>,uploads:Upload[]){
 return db.transaction(async tx=>{
 const [c]=await tx.select().from(t.cases).where(and(eq(t.cases.trackingId,trackingId),eq(t.cases.ownerId,ownerId))).for('update');if(!c)throw new CorrectionError('Case not found.',404);
 const key=`${ownerId}:${c.id}:${requestKey}`;
 const [prior]=await tx.select().from(t.revisions).where(eq(t.revisions.requestKey,key));
 if(prior){const [r]=await tx.select().from(t.runs).where(eq(t.runs.revisionId,prior.id));return {caseId:c.id,trackingId,runId:r.id,revisionId:prior.id,existing:true};}
 if(c.currentRevision!==expectedRevision)throw new CorrectionError('This case has a newer revision. Reload it before submitting corrections.',409);
 const [old]=await tx.select().from(t.revisions).where(and(eq(t.revisions.caseId,c.id),eq(t.revisions.number,c.currentRevision)));
 const [run]=await tx.select().from(t.runs).where(eq(t.runs.revisionId,old.id)).orderBy(desc(t.runs.createdAt));
 if(!run||run.state!=='completed')throw new CorrectionError('Wait for the current run to complete before correcting this case.',409);
 const checks=await tx.select().from(t.checkResults).where(eq(t.checkResults.runId,run.id));const [latestDecision]=c.currentDecisionId?await tx.select().from(t.decisions).where(eq(t.decisions.id,c.currentDecisionId)):[];const requested=correctionRequest(checks.map(x=>x.data),latestDecision?.data);
 if(Object.keys(changes).some(k=>!requested.fields.includes(k))||uploads.some(u=>!requested.slots.includes(u.slot)))throw new CorrectionError('Only the requested fields and documents may be replaced.');
 if(new Set(uploads.map(u=>u.slot)).size!==uploads.length)throw new CorrectionError('Only one file per document slot is allowed.');
 const oldDocs=await tx.select().from(t.documents).where(eq(t.documents.revisionId,old.id));
 const changed=Object.keys(changes).some(k=>changes[k]!==old.submittedValues[k])||uploads.some(u=>sha256(u.bytes)!==oldDocs.find(d=>d.slot===u.slot)?.sha256);
 if(!changed)throw new CorrectionError('Attach a corrected document or change a requested field first.');
 const form={...old.submittedValues,...changes};const size=oldDocs.filter(d=>!uploads.some(u=>u.slot===d.slot)).reduce((n,d)=>n+Buffer.byteLength(d.bytesBase64,'base64'),0)+uploads.reduce((n,u)=>n+u.bytes.length,0);if(size>3_000_000)throw new CorrectionError('Combined PDFs must be below 3 MB.',413);
 const revisionId=randomUUID(),runId=randomUUID(),number=c.currentRevision+1;
 await tx.insert(t.revisions).values({id:revisionId,caseId:c.id,number,submittedValues:form,bankHash:bankHash(form.account||''),policyVersion:india.version,requestKey:key});
 for(const d of oldDocs)if(!uploads.some(u=>u.slot===d.slot))await tx.insert(t.documents).values({id:randomUUID(),revisionId,slot:d.slot,filename:d.filename,sha256:d.sha256,bytesBase64:d.bytesBase64,reusedFrom:d.id});
 for(const u of uploads)await tx.insert(t.documents).values({id:randomUUID(),revisionId,slot:u.slot,filename:u.filename,sha256:sha256(u.bytes),bytesBase64:u.bytes.toString('base64')});
 await tx.insert(t.runs).values({id:runId,revisionId,state:'queued',stages:stageNames.map((name,i)=>({number:i+1,name,status:'queued'}))});
 await tx.update(t.cases).set({currentRevision:number,status:'UNDECIDED',pendingOwner:null,currentDecisionId:null,updatedAt:new Date()}).where(eq(t.cases.id,c.id));
 await tx.insert(t.auditEvents).values({id:randomUUID(),caseId:c.id,actor:ownerId,actorType:'vendor',action:'resubmitted',previousState:c.status,newState:'UNDECIDED',note:`Revision ${number}. Replaced documents: ${uploads.map(u=>u.slot).join(', ')||'none'}. Changed fields: ${Object.keys(changes).join(', ')||'none'}. Previous revision and decision preserved.`});
 return {caseId:c.id,trackingId,runId,revisionId,existing:false};
 });
}
