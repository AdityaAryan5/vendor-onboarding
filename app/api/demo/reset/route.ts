import {pool} from '@/lib/db';
import {seedDemoWorkspace} from '@/lib/db/demo-seed';
import {requireReviewer,sameOrigin} from '@/lib/session';
import {limitRequest} from '@/lib/request-limits';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(req:Request){
 if(process.env.DEMO_WORKSPACE!=='true')return Response.json({error:'Demo reset is disabled.'},{status:403});
 const actor=await requireReviewer();if(actor instanceof Response)return actor;
 try{sameOrigin(req);}catch{return Response.json({error:'Cross-origin reset rejected.'},{status:403});}
 const limited=await limitRequest(req,'write');if(limited)return limited;
 const c=await pool.connect();try{await c.query('BEGIN');
 await c.query('LOCK TABLE cases,revisions,documents,runs,check_results,decisions,audit_events,reviewer_actions IN ACCESS EXCLUSIVE MODE');
 if((await c.query("SELECT 1 FROM runs WHERE state IN ('queued','running') LIMIT 1")).rowCount){await c.query('ROLLBACK');return Response.json({error:'Wait for active runs to finish before resetting.'},{status:409});}
 // Append-only triggers remain enabled. A transactional truncate/reinsert preserves
 // seed audit/review rows exactly while removing only non-seed history logically.
 await c.query('CREATE TEMP TABLE saved_seed_audit ON COMMIT DROP AS SELECT a.* FROM audit_events a JOIN cases c ON c.id=a.case_id WHERE c.is_demo_seed');
 await c.query('CREATE TEMP TABLE saved_seed_reviews ON COMMIT DROP AS SELECT a.* FROM reviewer_actions a JOIN cases c ON c.id=a.case_id WHERE c.is_demo_seed');
 await c.query('TRUNCATE audit_events,reviewer_actions');
 await c.query('INSERT INTO audit_events SELECT * FROM saved_seed_audit');
 await c.query('INSERT INTO reviewer_actions SELECT * FROM saved_seed_reviews');
 await c.query('UPDATE cases SET current_decision_id=NULL WHERE NOT is_demo_seed');
 await c.query('DELETE FROM decisions WHERE revision_id IN (SELECT r.id FROM revisions r JOIN cases c ON c.id=r.case_id WHERE NOT c.is_demo_seed)');
 await c.query('DELETE FROM check_results WHERE run_id IN (SELECT u.id FROM runs u JOIN revisions r ON r.id=u.revision_id JOIN cases c ON c.id=r.case_id WHERE NOT c.is_demo_seed)');
 for(const table of ['documents','runs'])await c.query(`DELETE FROM ${table} WHERE revision_id IN (SELECT r.id FROM revisions r JOIN cases c ON c.id=r.case_id WHERE NOT c.is_demo_seed)`);
 await c.query('DELETE FROM revisions WHERE case_id IN (SELECT id FROM cases WHERE NOT is_demo_seed)');
 await c.query('DELETE FROM cases WHERE NOT is_demo_seed');
 await seedDemoWorkspace(c);await c.query('COMMIT');return Response.json({ok:true,message:'Demo reset complete. Nine seeded cases retained.'});
 }catch(e){await c.query('ROLLBACK');console.error('Demo reset failed',e);return Response.json({error:'Reset failed; no changes were committed. Please retry.'},{status:503});}finally{c.release();}
}
