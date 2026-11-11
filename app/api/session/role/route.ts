import {session,createSession,sameOrigin} from '@/lib/session';
import {limitRequest,readLimited,RequestLimitError} from '@/lib/request-limits';
export async function POST(req:Request){
 const s=await session();if(!s)return Response.json({error:'Start a demo session first.'},{status:401});
 if(process.env.DEMO_WORKSPACE!=='true')return Response.json({error:'Role switching is available only in the synthetic demo workspace.'},{status:403});
 const limited=await limitRequest(req,'session');if(limited)return limited;
 try{sameOrigin(req);const body=JSON.parse(new TextDecoder().decode(await readLimited(req,2048)));if(!['vendor','reviewer'].includes(body.role))return Response.json({error:'Choose Vendor or Reviewer.'},{status:400});return Response.json({session:await createSession(s,body.role)});}
 catch(e){return Response.json({error:'Role switch could not be accepted.'},{status:e instanceof RequestLimitError?e.status:400});}
}
