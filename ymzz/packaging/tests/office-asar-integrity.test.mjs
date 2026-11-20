// MIT. Real packager transformer + real ASAR + unchanged upstream integrity verifier.
// Only inert fixture JS/metadata, no converter/model success claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {prepareSelectedOfficeManifests} from '../office-source-selection.mjs';
import {inventoryDesktopRuntime} from '../../../apps/desktop/src/runtime-tree.ts';
import {verifyRuntimeArchive} from '../../../apps/desktop/scripts/verify-runtime-archive.ts';
const desktopRequire=createRequire(new URL('../../../apps/desktop/package.json',import.meta.url));
const builderRequire=createRequire(desktopRequire.resolve('electron-builder'));
const {createTransformer}=builderRequire('app-builder-lib/out/fileTransformer.js');
const {createPackageWithOptions}=builderRequire('@electron/asar');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'Office ASAR 中文 空格 ')),app=path.join(root,'app'),dsh=path.join(app,'dsh');
 const files={
  'node_modules/@deepseek-ai/libreoffice-kit/package.json':JSON.stringify({name:'@deepseek-ai/libreoffice-kit',version:'0.1.3',license:'MPL-2.0',ymzzSourceBuild:{adapterEntrySHA256:'inert-regression-fixture'}},null,2)+'\n',
  // Exact offending property in the actual published0.1.3 native package.
  'node_modules/@deepseek-ai/libreoffice-kit-win32-x64/package.json':JSON.stringify({name:'@deepseek-ai/libreoffice-kit-win32-x64',version:'0.1.3',license:'MPL-2.0',scripts:{prepack:'node ../../scripts/verify-artifacts.mjs .'}},null,2)+'\n',
  'node_modules/@deepseek-ai/libreoffice-kit/index.js':'// Inert regression source, never executed.\n',
  'node_modules/@deepseek-ai/libreoffice-kit-win32-x64/licenses/NOTICE':'Inert original notice preservation fixture\n',
 };
 for(const[name,bytes]of Object.entries(files)){const f=path.join(dsh,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,bytes)}
 return{root,app,dsh,files};
}
function seal(f){const descriptor={schemaVersion:1,files:inventoryDesktopRuntime(f.dsh)};fs.writeFileSync(path.join(f.dsh,'desktop-runtime.json'),JSON.stringify(descriptor,null,2)+'\n');return descriptor}
async function builderTransform(f){const transform=createTransformer(f.app,{},undefined);for(const name of Object.keys(f.files)){const file=path.join(f.dsh,name),value=await transform(file);if(value!=null)fs.writeFileSync(file,value)}}
async function archive(f){const output=path.join(f.root,'app.asar');await createPackageWithOptions(f.app,output,{unpack:'**/libreoffice-kit-win32-x64/**'});return output}
test('reproduces actual post-seal native prepack-script removal as strict ASAR rejection',async()=>{
 const f=fixture();try{const expected=seal(f);await builderTransform(f);await assert.rejects(verifyRuntimeArchive(await archive(f),expected),/ASAR integrity verification failed/)}finally{fs.rmSync(f.root,{recursive:true,force:true})}
});
test('pre-seal normalization makes real builder transformation and ASAR verification idempotent without changing runtime or notices',async()=>{
 const f=fixture();try{
  const changes=await prepareSelectedOfficeManifests(f.dsh);assert.equal(changes.length,1);assert(changes[0].path.includes('libreoffice-kit-win32-x64'));assert.notEqual(changes[0].beforeSHA256,changes[0].afterSHA256);
  const native=JSON.parse(fs.readFileSync(path.join(f.dsh,changes[0].path)));assert.equal(native.license,'MPL-2.0');assert.equal(native.scripts,undefined);
  for(const[name,bytes]of Object.entries(f.files))if(!name.endsWith('package.json'))assert.equal(fs.readFileSync(path.join(f.dsh,name),'utf8'),bytes);
  assert.deepEqual(await prepareSelectedOfficeManifests(f.dsh),[]);
  const expected=seal(f);await builderTransform(f);await verifyRuntimeArchive(await archive(f),expected);
 }finally{fs.rmSync(f.root,{recursive:true,force:true})}
});
test('a changed unpacked notice still fails full unchanged ASAR integrity verification',async()=>{
 const f=fixture();try{await prepareSelectedOfficeManifests(f.dsh);const expected=seal(f),output=await archive(f);fs.appendFileSync(path.join(output+'.unpacked/dsh/node_modules/@deepseek-ai/libreoffice-kit-win32-x64/licenses/NOTICE'),'tampered');await assert.rejects(verifyRuntimeArchive(output,expected),/ASAR integrity verification failed/)}finally{fs.rmSync(f.root,{recursive:true,force:true})}
});
