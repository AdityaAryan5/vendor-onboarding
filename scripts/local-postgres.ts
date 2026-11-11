if(process.env.NODE_ENV==='production')throw Error('Embedded Postgres is development-only.');
import EmbeddedPostgres from 'embedded-postgres';
import {existsSync,appendFileSync} from 'node:fs';
async function main(){const pg=new EmbeddedPostgres({databaseDir:'.local-pg',user:'demo',password:'demo',port:55432,persistent:true});if(!existsSync('.local-pg/PG_VERSION'))await pg.initialise();appendFileSync('.local-pg/postgresql.conf', "\nunix_socket_directories = ''\n");await pg.start();const client=pg.getPgClient();await client.connect();if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='vendor_onboarding'")).rowCount)await pg.createDatabase('vendor_onboarding');await client.end();console.log('PostgreSQL ready: 127.0.0.1:55432/vendor_onboarding');for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await pg.stop();process.exit(0);});setInterval(()=>{},60000);}
main().catch(e=>{console.error(e);process.exit(1);});
