import {after} from 'next/server';
import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {requireReviewer,sameOrigin} from '@/lib/session';
import {readLimited} from '@/lib/request-limits';
import {createCase,executeRun,type Upload} from '@/lib/workflow';
import {india} from '@/config/countries/india';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:Request){const actor=await requireReviewer();if(actor instanceof Response)return actor;
try{sameOrigin(req);const {id,key}=z.object({id:z.enum(['S1','S2','S3','S4','S5','S6','S7','S8']),key:z.string().uuid()}).strict().parse(JSON.parse(Buffer.from(await readLimited(req,2048)).toString()));const manifest=JSON.parse(await readFile('test_data/manifest.json','utf8'));const s=manifest.find((x:any)=>x.id===id);const uploads:Upload[]=await Promise.all(india.slots.map(async slot=>({slot,filename:s.files[slot],bytes:await readFile(`test_data/${s.files[slot]}`)})));
// Only fixed server fixtures qualify for exemption; client uploads cannot bypass quotas.
const created=await createCase(s.form,uploads,actor.id,`scenario:${id}:${key}`);after(()=>executeRun(created.caseId,created.runId,()=>{}));return Response.json({...created,expected:s.expected},{status:created.existing?200:202});}catch{return Response.json({error:'Scenario could not be started. Please retry.'},{status:400});}}
