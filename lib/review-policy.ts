import {createHash} from 'node:crypto';import {z} from 'zod';import {india} from '../config/countries/india';import type {Check,Decision} from './types';
export const actionSchema=z.object({action:z.enum(['approve','reject','request_info']),expectedRevision:z.number().int().positive(),expectedDecisionId:z.string().min(1),idempotencyKey:z.string().uuid(),note:z.string().trim().min(1,'A reviewer note is required.').max(2000),resolutions:z.array(z.object({findingId:z.string().min(1),note:z.string().trim().min(1).max(2000)}).strict()).max(100).default([]),vendorMessage:z.string().trim().max(2000).default(''),requestedFields:z.array(z.string()).max(20).default([]),requestedSlots:z.array(z.enum(['gst','pan','bank'])).max(3).default([])}).strict();
export type ReviewActionInput=z.infer<typeof actionSchema>;
export function canonical(x:any):string{if(x instanceof Date)return JSON.stringify(x.toISOString());if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).filter(k=>x[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
export const fingerprint=(x:unknown)=>createHash('sha256').update(canonical(x)).digest('hex');
export function reviewFindings(checks:Check[]){return checks.filter(c=>c.outcome==='PENDING_REVIEWER').map(c=>({...c,findingId:`${c.ruleId}:${fingerprint(c).slice(0,20)}`}));}
export function approvalBlockers(checks:Check[]){return checks.filter(c=>c.outcome==='REJECTED'||c.outcome==='PENDING_VENDOR'||c.result==='blocked'||c.result==='error'||(['extraction','document_fields'].includes(c.ruleId)&&!!c.outcome));}
export function reviewPolicyError(input:ReviewActionInput,checks:Check[]){
 if(input.action==='approve'){
 if(approvalBlockers(checks).length)return 'Approval cannot override a hard rejection, missing mandatory evidence, unreliable extraction, or an outstanding vendor correction.';
 const required=reviewFindings(checks).map(c=>c.findingId);const supplied=input.resolutions.map(r=>r.findingId);
 if(new Set(supplied).size!==supplied.length||supplied.length!==required.length||required.some(id=>!supplied.includes(id)))return 'Resolve every current review finding with its own note. Reload if the evidence has changed.';
 }
 if(input.action==='request_info'){
 if(checks.some(c=>c.outcome==='REJECTED'))return 'A hard rejection remains active. Correct it through resubmission; requesting information cannot remove it.';
 if(!input.vendorMessage||(!input.requestedFields.length&&!input.requestedSlots.length))return 'Provide a vendor-visible message and select at least one requested field or document.';
 if(input.requestedFields.some(k=>![...india.requiredFields,'tradingName'].includes(k)))return 'Unknown requested field.';
 }
 return null;
}
export function reviewedDecision(input:ReviewActionInput,actor:string):Decision{
 const status=input.action==='approve'?'APPROVED':input.action==='reject'?'REJECTED':'PENDING_VENDOR';
 const message=input.action==='approve'?'Your submission was approved after human review under our onboarding policy.':input.action==='reject'?'Your submission was rejected after human review. Contact procurement for clarification.':input.vendorMessage;
 return {status,pendingOwner:status==='PENDING_VENDOR'?'vendor':null,reasonCodes:[`reviewer_${input.action}`],vendorActions:input.action==='request_info'?[message]:[],reviewerActions:[],vendorMessage:message,review:{actor,action:input.action},requestedFields:input.action==='request_info'?input.requestedFields:[],requestedSlots:input.action==='request_info'?input.requestedSlots:[]};
}
