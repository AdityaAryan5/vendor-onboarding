import {actionSchema,reviewFindings,reviewPolicyError,reviewedDecision,fingerprint} from '../review-policy';
import type {PoolClient} from 'pg';
import {PDFDocument} from 'pdf-lib';
import {checksum,evaluateStage,decide} from '../rules';
import {readLocalPdf,parseEvidence} from '../local-reader';
import {bankHash,sha256} from '../security';
import {india} from '../../config/countries/india';
import type {DocEvidence,Form,Slot,Check} from '../types';
const names=['Completeness','Read documents','Validate fields','Cross-check evidence','Check existing records','Decide','Communicate'];
// Distinct identifiers avoid making S1-S4 look like duplicates of historical examples.
// All seed PDFs are generated, read and evaluated, never assigned a canned decision.
export async function seedDemoWorkspace(c:PoolClient){
 for(const [index,kind]of ['approved','pending','rejected','S6','S5','S7','S8','reviewer-approved','reviewer-rejected'].entries()){
 const id=`demo-history-${kind}`;if((await c.query('SELECT 1 FROM cases WHERE id=$1',[id])).rowCount)continue;
 const started=Date.now(),rev=`${id}-rev`,run=`${id}-run`,pan=`AABCD900${index}A`,prefix=`27${pan}1Z`;
 const form:Form={legalName:`Example ${kind} Private Limited`,tradingName:'',country:kind==='S8'?'US':'IN',email:'fictional@example.test',address:'1 Synthetic Road, Mumbai',state:'27',pan,gstin:prefix+checksum(prefix),account:(kind==='rejected'||kind==='S6')?'009999888877':kind==='S5'?'001122334455':`00009000000${index}`,ifsc:'DEMO0123456',holderName:`Example ${kind} Private Limited`};
 if(kind.startsWith('reviewer-'))form.state='29';
 if(kind==='S7')form.gstin=form.gstin.slice(0,14)+(form.gstin[14]==='0'?'1':'0');
 const pdf=async(lines:string[])=>{const p=await PDFDocument.create();const page=p.addPage();['FICTIONAL DEMO DOCUMENT',...lines].forEach((line,i)=>page.drawText(line,{x:35,y:750-i*35,size:12}));return Buffer.from(await p.save());};
 const gst=await pdf(['GST CERTIFICATE',`Name: ${form.legalName}`,`GSTIN: ${form.gstin}`,'State: 27']);
 const uploads:{slot:Slot;bytes:Buffer}[]=[{slot:'gst',bytes:gst},{slot:'pan',bytes:await pdf(['PAN CARD',`Name: ${form.legalName}`,`PAN: ${pan}`])},{slot:'bank',bytes:kind==='pending'?gst:await pdf(['BANK PROOF',`Name: ${form.holderName}`,`Account number: ${form.account}`,`IFSC: ${form.ifsc}`])}];
 const docs:DocEvidence[]=[];for(const u of uploads){const read=await readLocalPdf(u.bytes,1);docs.push({slot:u.slot,source:'pdf',extraction:parseEvidence(read.lines),provenance:'PDF text extraction · synthetic historical seed, evaluated at startup.'});}
 const blocks=await c.query("SELECT * FROM blocklist WHERE active AND type='bank' AND identifier=$1",[bankHash(form.account)]);
 const bank=await c.query("SELECT id,name,status FROM vendors WHERE status='APPROVED' AND bank_hash=$1 AND pan<>$2",[bankHash(form.account),form.pan]);
 const checks:Check[]=[];const stages=[];for(let n=1;n<=7;n++){const start=Date.now();const stage=n<=5?evaluateStage(n,form,docs,{bankMatches:bank.rows.map(b=>b.id),bankRecords:bank.rows.map(b=>({recordId:b.id,kind:'vendor',name:b.name,status:b.status,matchedBy:'bank account (keyed hash)',matchedAccount:'•••• '+form.account.slice(-4)})),blocklisted:!!blocks.rowCount,blockMatches:blocks.rows.map(b=>({recordId:b.id,kind:'blocklist',matchedBy:b.type,active:b.active,reason:b.reason,createdBy:b.created_by,createdAt:b.created_at,matchedAccount:'•••• '+form.account.slice(-4)}))}):[];checks.push(...stage);stages.push({number:n,name:names[n-1],status:stage.some(x=>x.result==='fail')?'fail':stage.some(x=>x.result==='warn')?'warn':stage.some(x=>x.result==='blocked')?'blocked':'pass',durationMs:Date.now()-start});}
 const decision=decide(checks);
 await c.query('INSERT INTO cases(id,tracking_id,owner_id,idempotency_key,status,pending_owner,current_revision,is_demo_seed) VALUES($1,$2,$3,$1,$4,$5,1,true)',[id,`VND-DEMO-${String(index+1).padStart(4,'0')}`,'synthetic-history',decision.status,decision.pendingOwner]);
 await c.query('INSERT INTO revisions(id,case_id,number,submitted_values,policy_version,bank_hash) VALUES($1,$2,1,$3,$4,$5)',[rev,id,JSON.stringify(form),india.version,bankHash(form.account)]);
 for(let i=0;i<uploads.length;i++){const u=uploads[i],d=docs[i];await c.query('INSERT INTO documents(id,revision_id,slot,filename,sha256,bytes_base64,detected_type,extracted_json,confidence,source,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[`${id}-${u.slot}`,rev,u.slot,`${id}-${u.slot}.pdf`,sha256(u.bytes),u.bytes.toString('base64'),d.extraction!.type,JSON.stringify(d.extraction),String(d.extraction!.confidence),'pdf',d.provenance]);}
 await c.query("INSERT INTO runs(id,revision_id,state,stages,created_at,completed_at) VALUES($1,$2,'completed',$3,$4,clock_timestamp())",[run,rev,JSON.stringify(stages),new Date(started)]);
 for(const [i,check]of checks.entries())await c.query('INSERT INTO check_results(id,run_id,data) VALUES($1,$2,$3)',[`${run}-${i}`,run,JSON.stringify(check)]);
 await c.query("INSERT INTO decisions(id,revision_id,run_id,data,source) VALUES($1,$2,$3,$4,'automated')",[`${id}-decision`,rev,run,JSON.stringify(decision)]);
 await c.query("UPDATE cases SET current_decision_id=$1 WHERE id=$2",[`${id}-decision`,id]);
 await c.query("INSERT INTO audit_events(id,case_id,actor,actor_type,action,new_state,note) VALUES($1,$2,'Seed administrator','system','demo_seeded',$3,'Synthetic historical example; PDFs extracted and policy evaluated at startup. Message is DRAFT, never sent.')",[`${id}-audit`,id,decision.status]);

 if(kind.startsWith('reviewer-')){
 const actor='Priya Shah (demo reviewer)',action=kind==='reviewer-approved'?'approve':'reject';
 const input=actionSchema.parse({action,expectedRevision:1,expectedDecisionId:`${id}-decision`,idempotencyKey:'00000000-0000-4000-8000-000000000001',note:action==='approve'?'Synthetic historical review: address-state discrepancy examined and exception accepted.':'Synthetic historical review: address-state discrepancy remains unresolved.',resolutions:reviewFindings(checks).map(f=>({findingId:f.findingId,note:'Synthetic registration-address evidence examined; documented exception accepted.'}))});
 const error=reviewPolicyError(input,checks);if(error)throw Error(error);
 if(decision.status!=='PENDING_REVIEWER')throw Error('Reviewed seed must first require review.');
 const reviewed=reviewedDecision(input,actor),decisionId=`${id}-reviewed`;
 await c.query("INSERT INTO decisions(id,revision_id,run_id,data,source,created_at) VALUES($1,$2,$3,$4,'reviewer',clock_timestamp())",[decisionId,rev,run,JSON.stringify(reviewed)]);
 await c.query("INSERT INTO reviewer_actions(id,case_id,revision_id,decision_id,request_key,payload_hash,actor_id,actor,action,note,resolutions,checks_snapshot) VALUES($1,$2,$3,$4,$1,$5,'demo-seed-reviewer',$6,$7,$8,$9,$10)",[`${id}-action`,id,rev,decisionId,fingerprint(input),actor,action,input.note,JSON.stringify(input.resolutions),JSON.stringify(checks)]);
 await c.query('UPDATE cases SET current_decision_id=$1,status=$2,pending_owner=$3 WHERE id=$4',[decisionId,reviewed.status,reviewed.pendingOwner,id]);
 await c.query("INSERT INTO audit_events(id,case_id,actor,actor_type,action,previous_state,new_state,note,created_at) VALUES($1,$2,$3,'reviewer',$4,$5,$6,$7,clock_timestamp())",[`${id}-review-audit`,id,actor,`reviewer_${action}`,decision.status,reviewed.status,input.note]);
 }

 }
}
