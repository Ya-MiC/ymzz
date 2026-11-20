// MIT. Select a genuine source-built Office variant in a DERIVED desktop runtime.
// This is not a license waiver. Ordinary upstream archives/source remain immutable.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const sha=b=>createHash('sha256').update(b).digest('hex');
const proof=JSON.parse(fs.readFileSync(new URL('../docs/evidence/office-source013-native-qualified.json',import.meta.url),'utf8'));
export function noLinks(root){
 const st=fs.lstatSync(root);assert(!st.isSymbolicLink(),'OFFICE_SOURCE_LINK_REJECTED');
 if(st.isDirectory())for(const child of fs.readdirSync(root))noLinks(path.join(root,child));
}
export async function replacePreservingOriginals(rows,backupParent,reseal){
 fs.mkdirSync(backupParent,{recursive:true});const backup=fs.mkdtempSync(path.join(backupParent,'office-original-')),moved=[],installed=[];
 try{
  for(const [index,row]of rows.entries()){
   noLinks(row.target);assert(!fs.existsSync(path.join(row.source,'node_modules')),'OFFICE_STAGE_MUST_NOT_HAVE_NODE_MODULES');noLinks(row.source);
   const saved=path.join(backup,String(index));fs.renameSync(row.target,saved);moved.push({target:row.target,saved});
   fs.cpSync(row.source,row.target,{recursive:true,errorOnExist:true,force:false});installed.push(row.target);
  }
  await reseal();return backup;
 }catch(error){
  // Only newly-derived directories are removed; every original directory is restored.
  for(const target of installed)fs.rmSync(target,{recursive:true,force:true});
  for(const row of moved.reverse()){if(fs.existsSync(row.target))fs.rmSync(row.target,{recursive:true,force:true});fs.renameSync(row.saved,row.target)}
  throw error;
 }
}
// Reuse the exact installed electron-builder transformer, as upstream preparation
// does, BEFORE sealing. The newly selected native package still has prepack
// scripts; builder would otherwise rewrite package.json after its hash was sealed.
export async function prepareSelectedOfficeManifests(root){
 const desktopRequire=createRequire(new URL('../../apps/desktop/package.json',import.meta.url));
 const builderRequire=createRequire(desktopRequire.resolve('electron-builder'));
 const {createTransformer}=builderRequire('app-builder-lib/out/fileTransformer.js');
 const transform=createTransformer(root,{},undefined),changes=[];
 for(const name of ['libreoffice-kit','libreoffice-kit-win32-x64']){
  const file=path.join(root,'node_modules/@deepseek-ai',name,'package.json');
  const before=fs.readFileSync(file),after=await transform(file);
  if(after!=null){fs.writeFileSync(file,after);changes.push({path:path.relative(root,file).split(path.sep).join('/'),beforeSHA256:sha(before),afterSHA256:sha(Buffer.from(after))})}
  assert.equal(await transform(file),null,'OFFICE_MANIFEST_TRANSFORM_NOT_IDEMPOTENT');
 }
 return changes;
}
export async function selectPreparedOfficeSource(staging){
 const selected=process.env.YMZZ_QUALIFIED_OFFICE_SOURCE;if(!selected)return {selected:false,releaseCleared:false};
 assert(path.isAbsolute(selected),'OFFICE_SOURCE_ABSOLUTE_PATH_REQUIRED');
 const root=fs.realpathSync(staging),source=fs.realpathSync(selected),entry=path.join(source,'lib/index.js');
 const manifest=JSON.parse(fs.readFileSync(path.join(source,'package.json')));
 assert.equal(manifest.name,'@deepseek-ai/libreoffice-kit');assert.equal(manifest.version,'0.1.3');
 assert.equal(sha(fs.readFileSync(entry)),proof.sourceBuild.adapterEntrySHA256,'OFFICE_SOURCE_ENTRY_NOT_QUALIFIED');
 assert.equal(manifest.ymzzCandidate?.sourceArchiveSHA256,proof.sourceBuild.sourceArchiveSHA256);
 assert.equal(proof.status,'passed');assert(proof.checks.length===4&&proof.checks.every(row=>row.passed));assert(proof.nativePreferredSourcesAllMatched);
 const require=createRequire(path.join(source,'package.json')),engine=fs.realpathSync(path.dirname(require.resolve('@deepseek-ai/libreoffice-kit-win32-x64/package.json')));
 const native=JSON.parse(fs.readFileSync(path.join(engine,'prebuilds.json'))),nativeManifest=JSON.parse(fs.readFileSync(path.join(engine,'package.json')));
 assert.equal(nativeManifest.name,'@deepseek-ai/libreoffice-kit-win32-x64');assert.equal(nativeManifest.version,'0.1.3');assert.equal(nativeManifest.license,'MPL-2.0');assert.equal(manifest.license,'MPL-2.0');
 assert.equal(native.version,'0.1.3');assert.equal(sha(fs.readFileSync(path.join(engine,'prebuilds.json'))),proof.sourceBuild.nativePrebuildsSHA256);
 noLinks(engine);
 for(const [name,hash]of Object.entries(native.files)){
  assert(!name.includes('..')&&!name.includes('\\')&&!path.isAbsolute(name),'OFFICE_SOURCE_PATH');
  assert.equal(sha(fs.readFileSync(path.join(engine,name))),hash,'OFFICE_NATIVE_FILE_HASH:'+name);
 }
 const marker=path.join(root,'ymzz-office-source.json');
 const runtimeApi=await import('../../apps/desktop/lib/types/runtime-tree.js');
 const descriptor=runtimeApi.readDesktopRuntime(root);await runtimeApi.verifyDesktopRuntime(root,descriptor.release.version,{platform:'win32',arch:'x64'});
 if(fs.existsSync(marker)){
  const markerBefore=fs.readFileSync(marker),descriptorBefore=fs.readFileSync(path.join(root,'desktop-runtime.json'));
  const current=JSON.parse(markerBefore);assert.equal(current.adapterEntrySHA256,proof.sourceBuild.adapterEntrySHA256);assert.equal(sha(fs.readFileSync(path.join(root,'node_modules/@deepseek-ai/libreoffice-kit/lib/index.js'))),current.adapterEntrySHA256);
  // A retry may reuse a valid tree selected by the older selector. Repair its
  // manifests before resealing rather than returning that known-broken cache.
  const originals=['libreoffice-kit','libreoffice-kit-win32-x64'].map(name=>{const file=path.join(root,'node_modules/@deepseek-ai',name,'package.json');return{file,bytes:fs.readFileSync(file)}});
  try{
   const changes=await prepareSelectedOfficeManifests(root);
   if(changes.length){
    current.manifestPreparation={method:'Exact installed electron-builder createTransformer; repaired previously selected tree before descriptor sealing',changes};
    fs.writeFileSync(marker,JSON.stringify(current,null,2)+'\n');
    await runtimeApi.writeDesktopRuntimeAsync(root,descriptor.release,descriptor.sharedPackages.map(row=>row.name),{platform:'win32',arch:'x64'});
    await runtimeApi.verifyDesktopRuntime(root,descriptor.release.version,{platform:'win32',arch:'x64'});
   }
   return current;
  }catch(error){for(const row of originals)fs.writeFileSync(row.file,row.bytes);fs.writeFileSync(marker,markerBefore);fs.writeFileSync(path.join(root,'desktop-runtime.json'),descriptorBefore);throw error}

 }
 const names=['libreoffice-kit','libreoffice-kit-win32-x64'];
 assert(!fs.existsSync(path.join(root,'node_modules/@deepseek-ai/libreoffice-kit-wasm')),'UNEXPECTED_SHIPPED_WASM_REQUIRES_MATCHING_SOURCE_SELECTION');
 const targets=names.map(name=>path.join(root,'node_modules/@deepseek-ai',name));
 for(const target of targets){const m=JSON.parse(fs.readFileSync(path.join(target,'package.json')));assert.equal(m.version,'0.2.3','UNKNOWN_ORIGINAL_OFFICE_VERSION');assert.equal(fs.realpathSync(target),target)}
 const originalDescriptor=fs.readFileSync(path.join(root,'desktop-runtime.json'));
 const declarationFiles=[path.join(root,'package.json'),path.join(root,'node_modules/@deepseek-ai/dsh-office-kit/package.json')];
 const originalDeclarations=declarationFiles.map(file=>({file,bytes:fs.readFileSync(file)}));
 const backupParent=path.resolve(root,'../../ymzz-preserved-original-office');assert(!backupParent.startsWith(root+path.sep));
 // Stage a link-free adapter. Its published dependencies already exist in the
 // official flattened runtime; NEVER copy a research node_modules junction.
 const stage=fs.mkdtempSync(path.join(backupParent+'-stage-'));
 try{
  const adapter=path.join(stage,'libreoffice-kit');fs.cpSync(source,adapter,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).includes('node_modules')});
  const derived=JSON.parse(fs.readFileSync(path.join(adapter,'package.json')));delete derived.ymzzCandidate;
  derived.ymzzSourceBuild={sourceRevision:proof.sourceBuild.sourceRevision,sourceArchiveSHA256:proof.sourceBuild.sourceArchiveSHA256,patchSHA256:proof.sourceBuild.patchSHA256,adapterEntrySHA256:proof.sourceBuild.adapterEntrySHA256,modification:'MPL-2.0 native manifest-resolver backport; derived source-built variant, not official unchanged0.1.3',preferredSourceMaterials:'Companion corresponding-source bundle; not MIT relicensing'};
  fs.writeFileSync(path.join(adapter,'package.json'),JSON.stringify(derived,null,2)+'\n');
  const result={schema:1,selected:true,version:'0.1.3',productionRuntimeChanged:true,adapterEntrySHA256:proof.sourceBuild.adapterEntrySHA256,nativePrebuildsSHA256:proof.sourceBuild.nativePrebuildsSHA256,originalsPreservedOutsideDistribution:true,sourceBuild:derived.ymzzSourceBuild,releaseCleared:false};
  try{
   await replacePreservingOriginals([{source:adapter,target:targets[0]},{source:engine,target:targets[1]}],backupParent,async()=>{
    for(const {file,bytes}of originalDeclarations){const value=JSON.parse(bytes);for(const field of ['dependencies','optionalDependencies'])if(value[field]?.['@deepseek-ai/libreoffice-kit']){assert.equal(value[field]['@deepseek-ai/libreoffice-kit'],'0.2.3');value[field]['@deepseek-ai/libreoffice-kit']='0.1.3'}fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')}
    fs.writeFileSync(path.join(backupParent,'original-consumer-declarations.json'),JSON.stringify(originalDeclarations.map(row=>({path:path.relative(root,row.file),base64:row.bytes.toString('base64')})),null,2)+'\n');
    result.manifestPreparation={method:'Exact installed electron-builder createTransformer, same policy as upstream prepareRuntimeManifests; before descriptor sealing',changes:await prepareSelectedOfficeManifests(root)};
    fs.writeFileSync(marker,JSON.stringify(result,null,2)+'\n');
    await runtimeApi.writeDesktopRuntimeAsync(root,descriptor.release,descriptor.sharedPackages.map(row=>row.name),{platform:'win32',arch:'x64'});
    await runtimeApi.verifyDesktopRuntime(root,descriptor.release.version,{platform:'win32',arch:'x64'});
   });
  }catch(error){for(const row of originalDeclarations)fs.writeFileSync(row.file,row.bytes);if(fs.existsSync(marker))fs.rmSync(marker);fs.writeFileSync(path.join(root,'desktop-runtime.json'),originalDescriptor);throw error}
  return result;
 }finally{fs.rmSync(stage,{recursive:true,force:true})}
}
