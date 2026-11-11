import 'dotenv/config';
import {ensureDatabase} from '../lib/db/setup';
import {pool} from '../lib/db';
ensureDatabase().then(async()=>{const result=await pool.query('SELECT (SELECT count(*) FROM vendors) vendors,(SELECT count(*) FROM extraction_cache) cache_entries,(SELECT count(*) FROM blocklist WHERE active) active_blocks');console.log('M1 database ready:',result.rows[0]);await pool.end();}).catch(e=>{console.error(e);process.exit(1);});
