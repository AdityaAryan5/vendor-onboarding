import {requireReviewer} from '@/lib/session';import {limitRequest} from '@/lib/request-limits';
import {db} from '@/lib/db';import {cases,revisions} from '@/lib/db/schema';import {eq,and,asc,sql} from 'drizzle-orm';import {redact} from '@/lib/workflow';
export const dynamic='force-dynamic';
export async function GET(req:Request){const actor=await requireReviewer();if(actor instanceof Response)return actor;const limited=await limitRequest(req,'read');if(limited)return limited;
 const rows=await db.select({case:cases,form:revisions.submittedValues,findings:sql`(SELECT coalesce(jsonb_agg(cr.data),'[]'::jsonb) FROM check_results cr JOIN runs r ON r.id=cr.run_id WHERE r.revision_id=${revisions.id} AND cr.data->>'outcome' IS NOT NULL)`}).from(cases).innerJoin(revisions,and(eq(revisions.caseId,cases.id),eq(revisions.number,cases.currentRevision))).where(eq(cases.status,'PENDING_REVIEWER')).orderBy(asc(cases.updatedAt));
 return Response.json(redact(rows.map(r=>({...r,ageSeconds:Math.max(0,Math.floor((Date.now()-r.case.updatedAt.getTime())/1000))})),true),{headers:{'Cache-Control':'no-store'}});
}
