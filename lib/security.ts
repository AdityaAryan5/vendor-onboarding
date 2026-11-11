import {createHmac,createHash} from 'node:crypto';
export const sha256=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
export function bankHash(account:string){const key=process.env.BANK_HASH_KEY;if(!key||key.length<32)throw Error('BANK_HASH_KEY must be at least 32 characters.');return createHmac('sha256',key).update(account.trim()).digest('hex');}
