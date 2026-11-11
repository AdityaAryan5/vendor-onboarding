/** A real PostgreSQL test server supplies DATABASE_URL; the app never imports its launcher. */
import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import {spawn} from 'node:child_process';
import {appendFileSync,rmSync,readFileSync} from 'node:fs';
import {strict as assert} from 'node:assert';
import {createHmac,randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {Client} from 'pg';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const dir=`/tmp/vendor-hosted-${Date.now()}`;const pg=new EmbeddedPostgres({databaseDir:dir,user:'demo',password:'demo',port:55436,persistent:false,onLog:()=>{},onError:()=>{}});await pg.initialise();appendFileSync(`${dir}/postgresql.conf`,"\nunix_socket_directories = ''\n");await pg.start();await pg.createDatabase('hosted');
 const url='postgresql://demo:demo@127.0.0.1:55436/hosted';const sql=new Client({connectionString:url});await sql.connect();
 const child=spawn(process.execPath,['--require','./scripts/no-native-preload.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3127'],{env:{...process.env,NODE_ENV:'production',PATH:'/no-native-binaries',OCR_ENABLED:'true',DATABASE_URL:url,DIRECT_DATABASE_URL:url,DEMO_WORKSPACE:'true',STAGE_MIN_DISPLAY_MS:'100',RATE_LIMIT_WRITE:'1',DEMO_ACCESS_PASSWORD:'',BANK_HASH_KEY:'test-only-random-bank-hash-key-123456789012345',SESSION_SECRET:'test-only-random-session-secret-123456789012345'},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',c=>logs+=c);child.stderr.on('data',c=>logs+=c);const base='http://127.0.0.1:3127';
 try{let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/session')).ok){ready=true;break;}}catch{}await sleep(250);}assert.ok(ready,logs);
 const login=await fetch(base+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(login.status,200,await login.clone().text());const cookie=login.headers.get('set-cookie')!.split(';')[0];
 async function api(path:string,init:RequestInit={}){return fetch(base+path,{...init,headers:{cookie,...init.headers}});}
 const submit=async(id:string,bankOverride?:Buffer,patch:Record<string,string>={},omitSlot?:string)=>{const s=JSON.parse(readFileSync(`test_data/${id}.json`,'utf8'));s.form={...s.form,...patch};const body=new FormData();body.set('values',JSON.stringify(s.form));body.set('idempotencyKey',randomUUID());for(const slot of ['gst','pan','bank'])if(slot!==omitSlot)body.set(slot,new Blob([new Uint8Array(slot==='bank'&&bankOverride?bankOverride:readFileSync(`test_data/${s.files[slot]}`))],{type:'application/pdf'}),s.files[slot]);const r=await api('/api/cases',{method:'POST',body});assert.equal(r.status,202,await r.clone().text());return {s,created:await r.json()};};
 const wait=async(created:any)=>{const seen=new Set<number>();for(let i=0;i<180;i++){const r=await api(`/api/runs/${created.runId}`);assert.equal(r.status,200);const d=await r.json();for(const stage of d.run.stages)if(stage.status==='running')seen.add(stage.number);assert.notEqual(d.run.state,'failed',JSON.stringify(d));if(d.run.state==='completed'){return {d,seen};}await sleep(400);}throw Error('Run never completed: '+logs);};

 assert.equal((await api('/api/scenario-runner',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'S1',key:randomUUID()})})).status,403);
 const role=await api('/api/session/role',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"role":"reviewer"}'});const reviewerCookie=role.headers.get('set-cookie')!.split(';')[0];
 const runner=async(id:string)=>{const response=await fetch(base+'/api/scenario-runner',{method:'POST',headers:{cookie:reviewerCookie,'Content-Type':'application/json'},body:JSON.stringify({id,key:randomUUID()})});assert.equal(response.status,202,await response.clone().text());return response.json();};
 const initial=await (await api('/api/cases')).json();assert.equal(initial.length,9);for(const status of ['APPROVED','PENDING_VENDOR','PENDING_REVIEWER','REJECTED'])assert.ok(initial.some((x:any)=>x.case.status===status));assert.equal(initial.filter((x:any)=>x.decisionSource==='reviewer').length,2);
 const minute=Math.floor(Date.now()/60000);for(const kind of ['write','read']){const hash=createHmac('sha256','test-only-random-session-secret-123456789012345').update(`${kind}:shared-untrusted-origin`).digest('hex');await sql.query('INSERT INTO request_limits(key,window_start,count) VALUES($1,$2,2000) ON CONFLICT(key,window_start) DO UPDATE SET count=2000',[hash,minute]);}
 assert.equal((await api('/api/cases')).status,429);
 for(const id of ['S1','S2','S3','S4','S5','S6','S7','S8']){const created=await runner(id);const {d}=await wait(created);assert.equal(d.decision.status,created.expected);console.log(`PASS ${id}: ${d.decision.status}; real run; quota exempt`);}
 const repeat=await runner('S1');assert.equal((await wait(repeat)).d.decision.status,'PENDING_REVIEWER');console.log('PASS repeat S1: real duplicate finding, not forced success');
 await sql.query('DELETE FROM request_limits');const dashboard=await (await api('/api/cases')).json();assert.equal(dashboard.filter((x:any)=>x.scenarioRun).length,9);assert.ok(dashboard.some((x:any)=>Number(x.processingMs)>0));assert.equal(dashboard[0].case.trackingId,repeat.trackingId);assert.ok(!JSON.stringify(dashboard).includes('idempotencyKey'));console.log('PASS dashboard: nine seeds, reviewed decisions, labels, duration, newest first; vendor runner API 403');
 }catch(e){console.error(logs.slice(-7000));throw e;}finally{child.kill('SIGTERM');await new Promise<void>(r=>{child.once('exit',()=>r());setTimeout(r,4000);});await sql.end();await pg.stop();rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
