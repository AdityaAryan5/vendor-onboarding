import {createHmac} from 'node:crypto';import {isIP} from 'node:net';
import {pool} from './db';
export const MAX_FILE_BYTES=1_000_000,MAX_TOTAL_BYTES=3_000_000,MAX_BODY_BYTES=3_100_000;
export class RequestLimitError extends Error{constructor(message:string,public status=413){super(message);}}
export function clientAddress(req:Request){
 // Only trust forwarding headers installed by Vercel or an explicitly trusted proxy.
 const trusted=process.env.VERCEL==='1'||process.env.TRUST_PROXY_IP==='true';
 const candidate=trusted?(req.headers.get(process.env.VERCEL==='1'?'x-vercel-forwarded-for':'x-forwarded-for')||req.headers.get('x-forwarded-for')||'').split(',')[0].trim():'';
 return isIP(candidate)?candidate.toLowerCase():'shared-untrusted-origin';
}
export async function limitRequest(req:Request,kind:'write'|'read'|'session'|'runner',reviewerAuthorized=false){
 if(kind==='runner'&&!reviewerAuthorized)return Response.json({error:'Reviewer authorization required for runner quota.'},{status:403});
 if(kind==='runner'&&process.env.RATE_LIMIT_RUNNER==='0')return null;
 try{const minute=Math.floor(Date.now()/60000);const defaultLimit={write:20,read:1200,session:30,runner:60}[kind];const configured=Number(process.env[`RATE_LIMIT_${kind.toUpperCase()}`]||defaultLimit);const limit=Number.isInteger(configured)&&configured>0?Math.min(configured,2000):defaultLimit;
 const key=createHmac('sha256',process.env.SESSION_SECRET!).update(`${kind}:${clientAddress(req)}`).digest('hex');
 const result=await pool.query('INSERT INTO request_limits(key,window_start,count) VALUES($1,$2,1) ON CONFLICT(key,window_start) DO UPDATE SET count=LEAST(request_limits.count+1,1000000) RETURNING count',[key,minute]);
 await pool.query('DELETE FROM request_limits WHERE window_start < $1',[minute-2]);
 if(result.rows[0].count>limit)return Response.json({error:'Demo request limit reached. Please retry shortly.'},{status:429,headers:{'Retry-After':String(60-Math.floor(Date.now()/1000)%60),'Cache-Control':'no-store'}});
 return null;
 }catch{return Response.json({error:'Request protection is temporarily unavailable. Please retry.'},{status:503});}
}
export async function readLimited(req:Request,max=MAX_BODY_BYTES){
 if(Number(req.headers.get('content-length')||0)>max)throw new RequestLimitError('Upload exceeds the demo request size limit.');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new RequestLimitError('Upload exceeds the demo request size limit.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}
export async function limitedFormData(req:Request){return new Response(await readLimited(req),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();}
export function checkFileSize(file:File){if(file.size>MAX_FILE_BYTES)throw new RequestLimitError('Each PDF must be at most 1 MB. Combined PDFs must be at most 3 MB.');}
