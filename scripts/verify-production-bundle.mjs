import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())out.push(...await walk(path));else if(e.name.endsWith('.nft.json'))out.push(path);}return out;}
const traces=await walk('.next/server');let workers=0;
for(const path of traces){const files=JSON.parse(await readFile(path,'utf8')).files;assert.equal(files.some(f=>f.includes('embedded-postgres')||f.includes('@napi-rs/canvas')),false,`Native dependency in ${path}`);if(files.some(f=>f.includes('pdf.worker.mjs')))workers++;}
assert.ok(workers>0,'PDF.js worker must be included in the deployable function bundle');
console.log(`PASS production bundle: ${traces.length} server traces; PDF.js worker included; embedded Postgres and native canvas excluded.`);
