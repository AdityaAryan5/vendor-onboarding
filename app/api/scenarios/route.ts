import {readFile} from 'node:fs/promises';
import {session} from '@/lib/session';
export async function GET(){if(!await session())return Response.json({error:'Sign in first.'},{status:401});const data=JSON.parse(await readFile('test_data/manifest.json','utf8'));return Response.json(data.map((s:any)=>({id:s.id,title:s.title,form:s.form,files:s.files,expected:s.expected})));}
