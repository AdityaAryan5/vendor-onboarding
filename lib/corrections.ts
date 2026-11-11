import {india} from '../config/countries/india';
import type {Check,Slot,Decision} from './types';
export function correctionRequest(checks:Check[],decision?:Decision){
 const fields=new Set<string>(),slots=new Set<Slot>();
 for(const c of checks){if(!c.outcome)continue;
 if(c.ruleId==='country'){fields.add('country');continue;}
 if(c.ruleId==='gst_checksum'){fields.add('gstin');slots.add('gst');continue;}
 if(c.owner!=='vendor')continue;
 if(c.ruleId==='required')for(const name of (c.evidence.missing||[]) as string[]){if(name.endsWith(' document'))slots.add(name.split(' ')[0] as Slot);else if(india.requiredFields.includes(name))fields.add(name);}
 const field=({email:'email',pan_format:'pan',gst_format:'gstin',ifsc:'ifsc'} as Record<string,string>)[c.ruleId];if(field)fields.add(field);
 if(['file','document_type','expiry'].includes(c.ruleId)&&india.slots.includes(c.evidence.slot as Slot))slots.add(c.evidence.slot as Slot);
 }
 for(const f of decision?.requestedFields||[])fields.add(f);for(const slot of decision?.requestedSlots||[])slots.add(slot);
 return {fields:[...fields],slots:[...slots]};
}
