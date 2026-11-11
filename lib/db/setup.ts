import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pool} from './index';
import {Pool} from 'pg';
import {bankHash} from '../security';
let ready:Promise<void>|undefined;
export function ensureDatabase(){return ready??=(async()=>{
 if(process.env.VERCEL&&(!process.env.BANK_HASH_KEY||process.env.BANK_HASH_KEY.startsWith('local-demo')))throw Error('Set a private BANK_HASH_KEY before hosting.');
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required. Copy .env.example and start Postgres.');
 const migrationPool=process.env.DIRECT_DATABASE_URL?new Pool({connectionString:process.env.DIRECT_DATABASE_URL,max:1,connectionTimeoutMillis:15000}):pool;
 const c=await migrationPool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(73018261)');await c.query('CREATE TABLE IF NOT EXISTS app_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())');
 for(const name of (await readdir(join(process.cwd(),'migrations'))).filter(x=>x.endsWith('.sql')).sort()){if(!(await c.query('SELECT 1 FROM app_migrations WHERE name=$1',[name])).rowCount){await c.query(await readFile(join(process.cwd(),'migrations',name),'utf8'));await c.query('INSERT INTO app_migrations(name) VALUES ($1)',[name]);}}
 for(const r of (await c.query('SELECT id,submitted_values FROM revisions WHERE bank_hash IS NULL')).rows)await c.query('UPDATE revisions SET bank_hash=$1 WHERE id=$2',[bankHash(r.submitted_values.account||''),r.id]);
 const seeds=[['seed-approved','Atlas Components Private Limited','AABCA0001A','27AABCA0001A1Z0','000011110001','APPROVED'],['seed-duplicate','Beacon Supply Private Limited','AABCB0002B','27AABCB0002B1Z0','001122334455','APPROVED'],['seed-blocked','Restricted Demo Private Limited','AABCR0003C','27AABCR0003C1Z0','009999888877','REJECTED'],['seed-rejected','Correctable Demo Private Limited','AABCC0004D','27AABCC0004D1Z0','007777666655','REJECTED']];
 const {checksum}=await import('../rules');
 for(const [id,name,pan,gstin,account,status]of seeds){const g=gstin.slice(0,14)+checksum(gstin.slice(0,14));await c.query('INSERT INTO vendors(id,name,pan,gstin,bank_hash,status) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',[id,name,pan,g,bankHash(account),status]);}
 await c.query("INSERT INTO blocklist(id,identifier,type,reason,created_by) VALUES('seed-bank-block', $1,'bank','Internal demonstration restriction; not an external fraud finding.','Seed administrator') ON CONFLICT(id) DO NOTHING",[bankHash('009999888877')]);
 if(process.env.DEMO_WORKSPACE==='true'){const {seedDemoWorkspace}=await import('./demo-seed');await seedDemoWorkspace(c);}
 // New local evidence cache starts empty. Old-version cache entries are never used.
 await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();if(migrationPool!==pool)await migrationPool.end();}
})().catch(e=>{ready=undefined;throw e;});}
