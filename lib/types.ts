import { z } from 'zod';
export const statuses = ['APPROVED','PENDING_VENDOR','PENDING_REVIEWER','REJECTED'] as const;
export type Status = typeof statuses[number];
export type Slot = 'gst'|'pan'|'bank';
export type Owner = 'vendor'|'reviewer';
export type Form = Record<string,string>;
export const extractionSchema = z.object({
 type: z.enum(['gst','pan','bank','other']), confidence:z.number().min(0).max(1),
 fields:z.object({name:z.string().nullable(),pan:z.string().nullable(),gstin:z.string().nullable(),state:z.string().nullable(),account:z.string().nullable(),ifsc:z.string().nullable(),expiry:z.string().nullable()}).strict(),
 evidence:z.array(z.object({field:z.string(),value:z.string(),page:z.number().int().positive(),confidence:z.number().min(0).max(1)}).strict())
}).strict();
export type Extraction = z.infer<typeof extractionSchema>;
export type DocEvidence = {slot:Slot; extraction?:Extraction; error?:'file'|'extraction'; source?:'pdf'|'ocr'|'cache'|'gemini'|'parser_fallback'; provenance?:string; filename?:string};
export type Check = {ruleId:string; stage:number; checkType:'code'|'ai'; result:'pass'|'warn'|'fail'|'blocked'|'error'; reason:string; evidence:Record<string,unknown>; owner?:Owner; outcome?:Status; requiredAction?:string};
export type Records = {identityMatches?:string[];bankMatches?:string[];bankRecords?:Record<string,unknown>[];blocklisted?:boolean;blockMatches?:Record<string,unknown>[]};
export type Decision = {review?:{actor:string;action:string};requestedFields?:string[];requestedSlots?:Slot[];status:Status;pendingOwner:Owner|null;reasonCodes:string[];vendorActions:string[];reviewerActions:string[];vendorMessage:string};
export const disclaimer = 'Checks cover format, consistency, and internal records only. They do not prove a company or bank account is legitimate.';
