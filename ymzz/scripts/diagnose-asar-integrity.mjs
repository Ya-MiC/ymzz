// MIT. Failure-only metadata diagnostics; never substitutes for or clears integrity checks.
import fs from 'node:fs';import path from 'node:path';import {createHash}from'node:crypto';import{createRequire}from'node:module';
const repo=path.resolve(import.meta.dirname,'../..'),desktopRequire=createRequire(path.join(repo,'apps/desktop/package.json')),builderRequire=createRequire(desktopRequire.resolve('electron-builder'));
const{readAsar}=builderRequire('app-builder-lib/out/asar/asar.js'),sha=b=>createHash('sha256').update(b).digest('hex');
const target=path.join(repo,'apps/desktop/.desktop-build/targets/win-x64'),archivePath=path.join(target,'unsigned-artifacts/win-unpacked/resources/app.asar'),prepared=path.join(target,'dsh/desktop-runtime.json');
const output=path.join(repo,'ymzz/docs/evidence/windows/asar-integrity-details.json'),report={diagnosticOnly:true,releaseCleared:false,archiveExists:fs.existsSync(archivePath),preparedDescriptorExists:fs.existsSync(prepared)};
if(report.archiveExists&&report.preparedDescriptorExists){
 const expectedBytes=fs.readFileSync(prepared),expected=JSON.parse(expectedBytes),archive=await readAsar(archivePath),archivedDescriptor=await archive.readFile('dsh/desktop-runtime.json');
 report.preparedDescriptorSHA256=sha(expectedBytes);report.archivedDescriptorSHA256=sha(archivedDescriptor);report.descriptorBytesMatch=expectedBytes.equals(archivedDescriptor);
 const actual=new Map(),wanted=new Map(expected.files.map(row=>[row.path,row]));
 async function visit(node,name){
  if(node.link!==undefined){actual.set(name,{path:name,unexpectedLink:node.link});return}
  if(node.files!==undefined){for(const[part,child]of Object.entries(node.files))await visit(child,name?name+'/'+part:part);return}
  if(name==='desktop-runtime.json')return;
  const bytes=await archive.readFile(path.join('dsh',...name.split('/')));actual.set(name,{path:name,bytes:bytes.length,sha256:sha(bytes)});
 }
 await visit(archive.getFile('dsh',false),'');
 report.expectedCount=wanted.size;report.actualCount=actual.size;
 report.missing=[...wanted.keys()].filter(name=>!actual.has(name));report.extra=[...actual.keys()].filter(name=>!wanted.has(name));
 report.changed=[...actual].filter(([name,row])=>wanted.has(name)&&(row.bytes!==wanted.get(name).bytes||row.sha256!==wanted.get(name).sha256)).map(([name,row])=>({expected:wanted.get(name),actual:row}));
}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
