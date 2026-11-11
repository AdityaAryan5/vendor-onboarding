import type {Status} from '../../lib/types';
export const states: Record<string,string> = {'01':'Jammu and Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','26':'Dadra and Nagar Haveli and Daman and Diu','27':'Maharashtra','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman and Nicobar Islands','36':'Telangana','37':'Andhra Pradesh','38':'Ladakh'};
export type Rule = {id:string;name:string;type:'code'|'ai';stage:number;failure:Status;message:string};
const rule=(id:string,name:string,stage:number,failure:Status,message:string,type:'code'|'ai'='code'):Rule=>({id,name,stage,failure,message,type});
export const india = {
 version:'IN-1.2.0-local',country:'IN',scope:'India only · Companies · Ordinary PAN-based GST registrations',
 minConfidence:0.7,pan:/^[A-Z]{5}[0-9]{4}[A-Z]$/,gstin:/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,ifsc:/^[A-Z]{4}0[A-Z0-9]{6}$/,states,
 requiredFields:['legalName','country','email','address','state','pan','gstin','account','ifsc','holderName'],
 slots:['gst','pan','bank'] as const,
 rules:[
 rule('country','Supported country',1,'REJECTED','This onboarding process currently supports Indian vendors only.'),
 rule('required','Required fields and documents',1,'PENDING_VENDOR','Please provide the missing fields or documents listed below.'),
 rule('email','Contact email',1,'PENDING_VENDOR','Please provide a valid contact email address.'),
 rule('file','Readable PDF',2,'PENDING_VENDOR','Please upload an unlocked, readable PDF.'),
 rule('extraction','Extraction schema and confidence',2,'PENDING_REVIEWER','Some document details could not be read reliably and need review.'),
 rule('document_type','Document classification',2,'PENDING_VENDOR','Please upload the correct document for this slot.'),
 rule('document_fields','Required document evidence',2,'PENDING_REVIEWER','Required details could not be established from this document.'),
 rule('pan_format','PAN format',3,'PENDING_VENDOR','Please correct your PAN.'),
 rule('pan_entity','Company PAN category',3,'PENDING_REVIEWER','Your PAN category differs from the supported company entity type.'),
 rule('gst_format','Ordinary GSTIN format and state',3,'PENDING_VENDOR','Please correct the GSTIN or registration state.'),
 rule('gst_checksum','GSTIN checksum',3,'REJECTED','The supplied GSTIN fails its checksum. This is a policy rule, not a fraud finding. Correct it and resubmit this case.'),
 rule('ifsc','IFSC format',3,'PENDING_VENDOR','Please provide an 11-character IFSC with zero in position five.'),
 rule('expiry','Applicable document expiry',3,'PENDING_VENDOR','Please replace the expired document.'),
 rule('embedded_pan','Embedded PAN consistency',4,'PENDING_REVIEWER','The PAN within your GSTIN differs from your PAN evidence. Please provide matching registration documents.'),
 rule('gst_identity','GST certificate identity',4,'PENDING_REVIEWER','Your submitted GSTIN differs from the GST certificate. Please clarify.'),
 rule('state','GST registration state',4,'PENDING_REVIEWER','Your GSTIN state differs from the registration address evidence. Please clarify the registration being onboarded.'),
 rule('bank','Bank details consistency',4,'PENDING_REVIEWER','Your submitted bank details differ from the bank proof. Please clarify or provide corrected evidence.'),
 rule('name','Legal and bank name consistency',4,'PENDING_REVIEWER','The names differ beyond standard abbreviations. Please provide evidence linking them.'),
 rule('identity_duplicate','Existing identity',5,'PENDING_REVIEWER','An onboarding record already exists for this identity: possible update, not new vendor.'),
 rule('bank_duplicate','Bank account reuse',5,'PENDING_REVIEWER','These bank details require additional ownership verification.'),
 rule('blocklist','Active internal blocklist',5,'REJECTED','This submission matches a restricted record under our onboarding policy. Contact procurement for review.')
 ]
};
