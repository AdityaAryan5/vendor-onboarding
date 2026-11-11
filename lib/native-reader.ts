import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {parseTsv,type TextLine,type ReadResult} from './local-reader';
const exec=promisify(execFile);
// The commands are fixed binaries with argument arrays: no shell interpolation of uploads.
export async function readNativePdf(bytes:Buffer,pageCount:number):Promise<ReadResult>{
 const dir=await mkdtemp(join(tmpdir(),'accord-pdf-'));const deadline=Date.now()+45000;
 const command=async(name:string,args:string[])=>{const remaining=deadline-Date.now();if(remaining<=0)throw Error('Local extraction time limit reached');return exec(name,args,{timeout:Math.min(15000,remaining),maxBuffer:8*1024*1024,encoding:'utf8'});};
 try{const path=join(dir,'input.pdf');await writeFile(path,bytes,{mode:0o600});const {stdout}=await command('pdftotext',['-layout','-enc','UTF-8',path,'-']);const pages=stdout.split('\f');const lines:TextLine[]=[];const ocrPages:number[]=[];
 for(let i=0;i<pageCount;i++){const page=pages[i]||'';const meaningful=page.replace(/\s/g,'').length;
 // Missing critical content in a mixed text/image PDF must trigger OCR too.
 const hasField=/(gstin|\bpan\b|ifsc|account\s*(number|no)|\bname\s*:)/i.test(page);
 if(meaningful>=40&&hasField){lines.push(...page.split('\n').filter(l=>l.trim()).map(text=>({text:text.trim(),page:i+1,confidence:.96})));continue;}
 ocrPages.push(i+1);const prefix=join(dir,`page-${i+1}`);await command('pdftoppm',['-f',String(i+1),'-l',String(i+1),'-singlefile','-scale-to','2200','-png',path,prefix]);const result=await command('tesseract',[`${prefix}.png`,'stdout','-l','eng','--psm','3','tsv']);lines.push(...parseTsv(result.stdout,i+1));
 }
 return {lines,source:ocrPages.length?'ocr':'pdf',ocrPages};
 }finally{await rm(dir,{recursive:true,force:true});}
}

export async function nativeAvailable(){try{await Promise.all(['pdftotext','pdftoppm','tesseract'].map(name=>exec(name,['-v'],{timeout:2000})));return true;}catch{return false;}}
