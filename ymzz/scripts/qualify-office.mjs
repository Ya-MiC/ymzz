// MIT. Offline REAL DSH Office provider/engine checks with synthetic documents.
// Not a licensing waiver, model inference, or a claim that every Office format was tested.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const here=fileURLToPath(import.meta.url),repo=path.resolve(path.dirname(here),'../..');
const args=process.argv.slice(2),argument=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]};
const output=path.resolve(argument('--output')||path.join(repo,'ymzz/docs/evidence/office-actual.json'));
function save(value){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(value,null,2)+'\n')}
const installed=argument('--installed');
if(installed){
 // Use the official existing ASAR tool on an owned temporary COPY. Never modify the
 // installed app or original resources. Child operations use the ACTUAL bundled Node.
 const desktopRequire=createRequire(path.join(repo,'apps/desktop/package.json'));
 const builderRequire=createRequire(desktopRequire.resolve('electron-builder'));
 const {extractAll}=builderRequire('@electron/asar');
 const copy=fs.mkdtempSync(path.join(os.tmpdir(),'湛箴 Office 真實產物 空格 '));
 try{
  extractAll(path.join(installed,'resources/app.asar'),copy);
  const node=path.join(installed,'resources/runtime/primary-runtime/dependencies/node/bin/node.exe');
  const child=spawnSync(node,[here,'--module-root',path.join(copy,'dsh'),'--output',output],{stdio:'inherit',timeout:360000,env:{...process.env,ELECTRON_RUN_AS_NODE:'',NODE_OPTIONS:''}});
  if(child.error)throw child.error;if(child.status!==0)throw new Error('Actual installed Office provider qualification failed: '+child.status);
  const proof=JSON.parse(fs.readFileSync(output,'utf8'));proof.installedArchiveSHA256=createHash('sha256').update(fs.readFileSync(path.join(installed,'resources/app.asar'))).digest('hex');proof.bundledNodeSHA256=createHash('sha256').update(fs.readFileSync(node)).digest('hex');save(proof);
 }finally{fs.rmSync(copy,{recursive:true,force:true})}
}else{
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'湛箴 Office 中文 空格 ')),checks=[];
 process.env.DSH_HOME=path.join(work,'user-data');process.env.XDG_CACHE_HOME=path.join(work,'cache');
 let ctx;
 try{
  const root=argument('--module-root')||path.join(repo,'packages/document/office-kit');
  const fromRoot=createRequire(path.join(root,'package.json'));
  const officeEntry=argument('--module-root')?fromRoot.resolve('@deepseek-ai/dsh-office-kit'):path.join(root,'lib/index.js');
  const fromOffice=createRequire(officeEntry),kitEntry=fromOffice.resolve('@deepseek-ai/libreoffice-kit');
  const {Context}=await import(pathToFileURL(fromOffice.resolve('@deepseek-ai/cordis')));
  const {default:OfficeKit}=await import(pathToFileURL(officeEntry));
  const kit=await import(pathToFileURL(kitEntry));
  const {zipSync,unzipSync,strToU8}=createRequire(kitEntry)('fflate');
  const zip=files=>Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)]))));
  const types=body=>'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+body+'</Types>';
  const relationships=target=>'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="'+target+'"/></Relationships>';
  const docx=zip({'[Content_Types].xml':types('<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'),'_rels/.rels':relationships('word/document.xml'),'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>YMZZ OFFICE ACTUAL 2 + 3 = 5</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>'});
  const xlsx=zip({'[Content_Types].xml':types('<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'),'_rels/.rels':relationships('xl/workbook.xml'),'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1"><v>2</v></c><c r="B1"><v>3</v></c></row><row r="2"><c r="A2"><f>SUM(A1:B1)</f><v>0</v></c></row></sheetData></worksheet>'});
  const request=(bytes,extension)=>({extension,priority:'foreground',source:{key:'ymzz-real-office-'+extension,version:'synthetic-v1',bytes:bytes.length,read:async()=>({bytes:new Uint8Array(bytes),version:'synthetic-v1'})}});
  ctx=new Context();await ctx.plugin(OfficeKit,{outputDirectory:path.join(work,'outputs'),timeoutMs:60000});
  const doc=request(docx,'docx'),sheet=request(xlsx,'xlsx'),signal=()=>AbortSignal.timeout(65000);
  const pdf=await ctx.officeKit.convert(doc,signal());assert.equal(Buffer.from(pdf.pdf).subarray(0,5).toString(),'%PDF-');
  checks.push({operation:'actual DSH officeKit.convert DOCX → PDF',bytes:pdf.pdf.length,sha256:createHash('sha256').update(pdf.pdf).digest('hex'),passed:true});save({status:'in-progress',checks});
  const images=await ctx.officeKit.renderImages({...doc,pages:[1],dpi:72,maxImages:1,maxPixels:2000000,maxDimension:2048,maxBytes:8*1024*1024},signal());assert.equal(images.images.length,1);
  const image=images.images[0];const png=image.png;
  assert.equal(Buffer.from(png).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  checks.push({operation:'actual DSH officeKit.renderImages DOCX → PNG',imageCount:images.images.length,width:image.width,height:image.height,passed:true});save({status:'in-progress',checks});
  const converted=await ctx.officeKit.convertTo({...doc,format:'odt',output:{owner:'ymzz-offline-qualification',name:'實際 轉換.odt'}},signal());
  const odt=unzipSync(fs.readFileSync(converted.path));assert.match(Buffer.from(odt['content.xml']).toString(),/YMZZ OFFICE ACTUAL/);
  checks.push({operation:'actual DSH officeKit.convertTo DOCX → ODT, document text verified',bytes:converted.bytes,passed:true});save({status:'in-progress',checks});
  const recalculated=await ctx.officeKit.recalculate({...sheet,format:'xlsx',output:{owner:'ymzz-offline-qualification',name:'實際 重算.xlsx'}},signal());
  const workbook=unzipSync(fs.readFileSync(recalculated.path)),xml=Buffer.from(workbook['xl/worksheets/sheet1.xml']).toString();
  assert.match(xml,/<c\b[^>]*\br="A2"[^>]*>[\s\S]*?<f[^>]*>[\s\S]*?<\/f>[\s\S]*?<v>5<\/v>[\s\S]*?<\/c>/);
  checks.push({operation:'actual DSH officeKit.recalculate XLSX cached 0 → actual formula result 5',bytes:recalculated.bytes,passed:true});
  const foundRuntime=await kit.discoverRuntime();
  const runtime={version:foundRuntime.version,backend:foundRuntime.backend,nativePreview:foundRuntime.nativePreview};
  assert.equal(runtime.version,'0.2.3');assert.equal(runtime.backend,process.platform==='linux'?'wasm':'native');
  save({schema:1,status:'passed',moduleOrigin:argument('--module-root')?'actual installed app.asar extracted without mutation':'actual current workspace built provider',mockedEngine:false,liveInference:false,nodeVersion:process.version,runtime,checks,scope:'DOCX PDF/PNG/ODT and XLSX formula recalculation through real upstream DSH provider; not every input format',licensingCleared:false});
  console.log('Actual DSH Office provider: all four operations passed; licensing remains a separate HOLD.');
 }catch(error){save({schema:1,status:'failed',mockedEngine:false,liveInference:false,checks,error:{name:error.name,message:error.message,cause:error.cause?.message},licensingCleared:false});throw error}
 finally{if(ctx)await ctx.fiber.dispose();fs.rmSync(work,{recursive:true,force:true})}
}
