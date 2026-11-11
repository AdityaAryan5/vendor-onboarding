import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import * as schema from './schema';
const globalDb=globalThis as unknown as {pgPool?:Pool};
export const pool=globalDb.pgPool??new Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:10000,statement_timeout:10000});
if(process.env.NODE_ENV!=='production')globalDb.pgPool=pool;
// Idle connection errors must not crash the server; in-flight queries still reject normally.
if(!pool.listenerCount('error'))pool.on('error',(error)=>console.error('Postgres idle connection error:',error.message));
export const db=drizzle(pool,{schema});
