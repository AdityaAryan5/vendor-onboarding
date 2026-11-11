import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
export type Session={id:string;role:'vendor'|'reviewer';name:string;expires:number};
function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32||(process.env.VERCEL&&s.startsWith('local-demo')))throw Error('SESSION_SECRET must contain at least 32 characters');return s;}
function sign(value:string){return createHmac('sha256',secret()).update(value).digest('base64url');}
export async function session(){const token=(await cookies()).get('vendor-session')?.value;if(!token)return null;const [body,signature]=token.split('.');const expected=sign(body);if(!signature||Buffer.byteLength(signature)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;try{const data=JSON.parse(Buffer.from(body,'base64url').toString()) as Session;return data.expires>Date.now()&&['vendor','reviewer'].includes(data.role)&&typeof data.id==='string'?data:null;}catch{return null;}}
export async function createSession(previous?:Session,role:Session['role']='vendor'){const s:Session={id:previous?.id||randomUUID(),role,name:role==='reviewer'?'Priya Shah (demo reviewer)':'Demo vendor',expires:Date.now()+86400000};const body=Buffer.from(JSON.stringify(s)).toString('base64url');(await cookies()).set('vendor-session',`${body}.${sign(body)}`,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:86400});return s;}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==(req.headers.get('host')||new URL(req.url).host))throw Error('Cross-origin request rejected');}

export async function requireReviewer(){const s=await session();return s?.role==='reviewer'&&process.env.DEMO_WORKSPACE==='true'?s:Response.json({error:'Reviewer role required.'},{status:403});}
