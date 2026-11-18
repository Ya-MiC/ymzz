// MIT. Inspect actual installed bytes, including every native ASAR entry.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createRequire}from'node:module';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';
const repo=path.resolve(import.meta.dirname,'../..'),args=process.argv.slice(2),arg=n=>args[args.indexOf(n)+1];
assert(args.includes('--installed')&&args.includes('--output'));const installed=path.resolve(arg('--installed')),output=path.resolve(arg('--output'));
const desktopRequire=createRequire(path.join(repo,'apps/desktop/package.json')),builderRequire=createRequire(desktopRequire.resolve('electron-builder')),{extractAll}=builderRequire('@electron/asar');
const copy=fs.mkdtempSync(path.join(os.tmpdir(),'湛箴 原生 實包 稽核 '));
try{
 extractAll(path.join(installed,'resources/app.asar'),copy);
 const run=spawnSync(process.platform==='win32'?'python':'python3',[path.join(repo,'ymzz/scripts/inventory-native-payload.py'),'--installed',installed,'--asar-copy',copy,'--output',output],{stdio:'inherit',timeout:300000});if(run.error)throw run.error;assert.equal(run.status,0,'Actual native inspection failed');
 const graphOutput=output+'.node-graph.json',nodeForAudit=path.join(installed,'resources/runtime/primary-runtime/dependencies/node/bin/node.exe');
 const graph=spawnSync(nodeForAudit,[path.join(repo,'ymzz/scripts/audit-production.mjs'),'--packaged-root='+path.join(copy,'dsh'),'--packaged-desktop-root='+copy,'--output='+graphOutput],{stdio:'inherit',timeout:120000,env:{...process.env,ELECTRON_RUN_AS_NODE:'',NODE_OPTIONS:''}});if(graph.error)throw graph.error;assert.equal(graph.status,0);
 const report=JSON.parse(fs.readFileSync(output));report.actualPackagedNodeGraph=JSON.parse(fs.readFileSync(graphOutput));report.appAsarSHA256=createHash('sha256').update(fs.readFileSync(path.join(installed,'resources/app.asar'))).digest('hex');
 const office=path.join(copy,'dsh/node_modules/@deepseek-ai/libreoffice-kit');const adapter=JSON.parse(fs.readFileSync(path.join(office,'package.json')));
 assert.equal(adapter.version,'0.1.3');assert(adapter.ymzzSourceBuild);report.officeSourceVariant=adapter.ymzzSourceBuild;
 const descriptor=JSON.parse(fs.readFileSync(path.join(copy,'dsh/desktop-runtime.json')));report.desktopRuntimeFileCount=descriptor.files.length;report.desktopRuntimeDescriptorSHA256=createHash('sha256').update(fs.readFileSync(path.join(copy,'dsh/desktop-runtime.json'))).digest('hex');
 const pinned=JSON.parse(fs.readFileSync(path.join(repo,'ymzz/compliance/sharp-win32-native.lock.json'))),fromRoot=createRequire(path.join(copy,'dsh/package.json')),fromSharp=createRequire(fromRoot.resolve('sharp'));
 const sharpNative=path.dirname(fromSharp.resolve('@img/sharp-win32-x64/package'));
 const checks=pinned.files.map(row=>{const file=path.join(sharpNative,row.path),actual=createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(actual,row.sha256,'Actual Sharp native/notice/version bytes differ: '+row.path);return {...row,matched:true}});
 const node=path.join(installed,'resources/runtime/primary-runtime/dependencies/node/bin/node.exe');
 function imageProof(){const run=spawnSync(node,[path.join(repo,'ymzz/scripts/qualify-installed-sharp.cjs'),path.join(copy,'dsh')],{encoding:'utf8',timeout:90000,env:{...process.env,ELECTRON_RUN_AS_NODE:'',NODE_OPTIONS:''}});if(run.error)throw run.error;assert.equal(run.status,0,'Actual installed Sharp SVG operation failed: '+run.stderr);return JSON.parse(run.stdout)}
 const before=imageProof(),dll=path.join(sharpNative,'lib/libvips-42.dll'),saved=path.join(copy,'preserved-original-libvips-42.dll');
 fs.renameSync(dll,saved);try{fs.copyFileSync(saved,dll);const after=imageProof();report.sharp={status:'passed',originalUpstreamBytesMatched:checks,before,afterLibraryFileReplacement:after,replaceableSharedLibraryMechanism:true,recompiledModifiedLibraryTest:false,scope:'Actual exact native DLLs and fresh process reload after replacing a COPY with the original library. Proves replacement mechanism, NOT a modified-source rebuild or full LGPL material clearance.',releaseCleared:false}}finally{if(!fs.existsSync(dll))fs.copyFileSync(saved,dll)}
 report.shippedWasmOffice=fs.existsSync(path.join(copy,'dsh/node_modules/@deepseek-ai/libreoffice-kit-wasm'));assert(!report.shippedWasmOffice,'Unexpected extra Office backend needs matching production/source qualification');
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}finally{fs.rmSync(copy,{recursive:true,force:true})}
