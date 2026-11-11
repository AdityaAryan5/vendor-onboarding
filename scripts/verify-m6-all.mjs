import {spawnSync} from 'node:child_process';
for(const scenario of ['S6','S5','S7','S8']){
 const run=spawnSync(process.execPath,['--import','tsx','scripts/verify-m6.ts'],{stdio:'inherit',env:{...process.env,SCENARIO:scenario}});
 if(run.status!==0)process.exit(run.status||1);
}
