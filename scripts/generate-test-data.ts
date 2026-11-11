import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {checksum} from '../lib/rules';
import {sha256} from '../lib/security';
import type {Form,Extraction,Slot} from '../lib/types';
export async function generate(){
 await mkdir('test_data',{recursive:true});const manifest:any[]=[];
 const ids=['S1','S2','S2-corrected','S3','S3-state','S4','S5','S6','S7','S8','S9','S7-corrected'];
 for(let i=0;i<ids.length;i++){
 const id=ids[i];const pan=`AABCA${String(1200+i).padStart(4,'0')}A`;const gstPan=id==='S3'?'AABCB9876C':pan;const prefix=`27${gstPan}1Z`;const gst=prefix+checksum(prefix);
 const form:Form={legalName:id==='S1'?'Acme Pvt Ltd':`Acme ${id.replace(/-/g,' ')} Private Limited`,tradingName:'',country:id==='S8'?'US':'IN',email:'vendor@example.test',address:'12 Demo Industrial Road, Mumbai',state:id==='S3-state'?'29':'27',pan,gstin:id==='S7'?gst.slice(0,14)+(gst[14]==='0'?'1':'0'):gst,account:id==='S5'?'001122334455':id==='S6'?'009999888877':`00007654${String(3200+i)}`,ifsc:'DEMO0123456',holderName:id==='S1'?'ACME Private Limited':`Acme ${id.replace(/-/g,' ')} Private Limited`};
 if(id==='S2-corrected'){const original=manifest.find(s=>s.id==='S2');Object.assign(form,original.form);}
 if(id==='S7-corrected'){Object.assign(form,manifest.find(s=>s.id==='S7').form);form.gstin=form.gstin.slice(0,14)+checksum(form.gstin.slice(0,14));}
 if(id==='S4'){form.holderName='Acme Industrial Supplies';form.tradingName=form.holderName;}
 const files:Record<string,string>={};const evidence:Record<string,Extraction>={};const hashes:Record<string,string>={};
 for(const slot of ['gst','pan','bank'] as Slot[]){const type=id==='S2'&&slot==='bank'?'gst':slot;const fields:Extraction['fields']={name:slot==='bank'?form.holderName:form.legalName,pan:type==='pan'?form.pan:null,gstin:type==='gst'?form.gstin:null,state:type==='gst'?'27':null,account:type==='bank'?form.account:null,ifsc:type==='bank'?form.ifsc:null,expiry:null};
 const confidence=id==='S9'&&slot==='bank'?0.42:0.99;const extract:Extraction={type,confidence,fields,evidence:Object.entries(fields).filter(([,v])=>v!==null).map(([field,value])=>({field,value:value!,page:1,confidence}))};
 const pdf=await PDFDocument.create();pdf.setCreationDate(new Date('2026-01-01'));pdf.setModificationDate(new Date('2026-01-01'));const font=await pdf.embedFont(StandardFonts.Helvetica);const page=pdf.addPage([595,842]);page.drawRectangle({x:0,y:730,width:595,height:112,color:rgb(.08,.16,.2)});page.drawText('FICTIONAL DEMO DOCUMENT',{x:40,y:790,size:20,font,color:rgb(1,1,1)});page.drawText(`${type.toUpperCase()} EVIDENCE / ${id}`,{x:40,y:760,size:12,font,color:rgb(.7,.9,.85)});
 let y=680;for(const [k,v]of Object.entries(fields)){if(v!==null){page.drawText(`${k}: ${v}`,{x:40,y,size:12,font});y-=32;}}page.drawText('Synthetic test fixture. Not a valid registration or banking document.',{x:40,y:80,size:10,font});
 if(id==='S9'&&slot==='bank'){const image=await sharp(Buffer.from(`<svg width="800" height="400"><rect width="100%" height="100%" fill="white"/><text x="30" y="80" font-size="32">FICTIONAL BANK PROOF</text><text x="30" y="160" font-size="26">Account ${form.account}</text><text x="30" y="230" font-size="26">${form.holderName}</text></svg>`)).blur(5).png().toBuffer();const blurred=await PDFDocument.create();blurred.setCreationDate(new Date('2026-01-01'));blurred.setModificationDate(new Date('2026-01-01'));const p=blurred.addPage();const img=await blurred.embedPng(image);p.drawImage(img,{x:20,y:300,width:550,height:275});const bytes=Buffer.from(await blurred.save());const name=`${id}-${slot}.pdf`;await writeFile(`test_data/${name}`,bytes);files[slot]=name;hashes[slot]=sha256(bytes);
 }else{const bytes=Buffer.from(await pdf.save());const name=`${id}-${slot}.pdf`;await writeFile(`test_data/${name}`,bytes);files[slot]=name;hashes[slot]=sha256(bytes);}evidence[slot]=extract;
 }
 const expected=id==='S2'?'PENDING_VENDOR':['S3','S3-state','S4','S5','S9'].includes(id)?'PENDING_REVIEWER':['S6','S7','S8'].includes(id)?'REJECTED':'APPROVED';
 const scenario={id,title:({S1:'Clean application',S2:'Wrong bank document','S2-corrected':'Corrected bank proof',S3:'Embedded PAN conflict','S3-state':'Registration state conflict',S4:'Trading name review',S5:'Existing bank account',S6:'Blocklisted account',S7:'Invalid checksum','S7-corrected':'Corrected GSTIN and certificate',S8:'Unsupported country',S9:'Low-confidence scan'}as Record<string,string>)[id],form,files,hashes,evidence,expected,cacheProvenance:'fixture-curated: expected evidence from synthetic PDF source, not a fresh AI extraction'};
 manifest.push(scenario);await writeFile(`test_data/${id}.json`,JSON.stringify(scenario,null,2));
 }
 const linking=await PDFDocument.create();const p=linking.addPage();p.drawText('FICTIONAL LINKING EVIDENCE - S4',{x:40,y:750,size:16});p.drawText('Acme Industrial Supplies is a trading name of',{x:40,y:700,size:12});p.drawText('Acme S4 Private Limited. For human review only.',{x:40,y:675,size:12});await writeFile('test_data/S4-linking-evidence.pdf',await linking.save());
 await writeFile('test_data/manifest.json',JSON.stringify(manifest,null,2));console.log(`Generated ${manifest.length} scenarios and fictional PDFs.`);
}
if(process.argv[1]?.endsWith('generate-test-data.ts'))generate().catch(e=>{console.error(e);process.exit(1);});
