// MIT. Research-only source-built candidate. Never mutates the product graph.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2),arg=n=>{const i=args.indexOf(n);return i<0?undefined:args[i+1]};
const work=path.resolve(arg('--work')||'office-source-candidate');
// Only build-tool shell commands require this simple owned scratch path. Actual
// native conversion inputs and installed provider deliberately contain Chinese/spaces.
assert(!/[\s&|<>^"%]/.test(work),'Build-only scratch path must be simple; installed/input paths remain unrestricted');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(command,argv,cwd=work){const tool=command==='corepack';const r=spawnSync(command,argv,{cwd,stdio:'inherit',timeout:600000,shell:tool&&process.platform==='win32',env:{...process.env,CI:'true'}});if(r.error)throw r.error;assert.equal(r.status,0,command+' failed');}
fs.mkdirSync(work,{recursive:true});
const revision='b19bb73c74ed893b8a5d1716d32df32a113ed31b',archive=path.join(work,'preferred-source.tar.gz');
const archiveSHA256='33839347e44b8df44c59115b566e9664e7db04a612a8f37ee2b220d7e501c036';
if(!fs.existsSync(archive)){const r=await fetch('https://codeload.github.com/deepseek-ai/dsh-libreoffice-kit/tar.gz/'+revision,{signal:AbortSignal.timeout(120000)});assert(r.ok);fs.writeFileSync(archive,Buffer.from(await r.arrayBuffer()));}
assert.equal(sha(fs.readFileSync(archive)),archiveSHA256);
const unpack=path.join(work,'preferred-source'),source=path.join(unpack,'dsh-libreoffice-kit-'+revision);
if(!fs.existsSync(source)){fs.mkdirSync(unpack,{recursive:true});run(process.platform==='win32'?'python':'python3',['-c',"import tarfile,sys; t=tarfile.open(sys.argv[1]); t.extractall(sys.argv[2],filter='data'); t.close()",archive,unpack]);}
const derived=path.join(work,'derived-source');
if(!fs.existsSync(derived)){fs.cpSync(source,derived,{recursive:true});run('git',['apply','--unidiff-zero','--check',path.join(repo,'ymzz/packaging/office-source-candidate/native-resolver.MPL-2.0.patch')],derived);run('git',['apply','--unidiff-zero',path.join(repo,'ymzz/packaging/office-source-candidate/native-resolver.MPL-2.0.patch')],derived);}
run('corepack',['pnpm@11.7.0','install','--frozen-lockfile','--ignore-scripts'],derived);
run('corepack',['pnpm@11.7.0','run','build:adapter'],derived);
const runtime=path.join(work,'runtime');fs.mkdirSync(runtime,{recursive:true});
const platform=process.platform==='win32'?'win32-x64':'wasm';
fs.writeFileSync(path.join(runtime,'package.json'),JSON.stringify({name:'ymzz-office-candidate-only',private:true,type:'module',packageManager:'pnpm@11.28.5'}));
run('corepack',['pnpm@11.28.5','add','--ignore-scripts','--no-optional','--save-exact','@deepseek-ai/libreoffice-kit@0.1.3','@deepseek-ai/libreoffice-kit-'+platform+'@0.1.3','fflate@0.8.2','fontkit@2.0.4','saxes@6.0.0'],runtime);
const require=createRequire(path.join(runtime,'package.json'));
const published=path.dirname(require.resolve('@deepseek-ai/libreoffice-kit/package.json'));
const target=path.join(work,'derived-runtime/libreoffice-kit');
if(!fs.existsSync(target)){fs.cpSync(published,target,{recursive:true,dereference:true});fs.cpSync(path.join(derived,'packages/entry/lib'),path.join(target,'lib'),{recursive:true});fs.symlinkSync(path.join(runtime,'node_modules'),path.join(target,'node_modules'),process.platform==='win32'?'junction':'dir');}
const manifest=JSON.parse(fs.readFileSync(path.join(target,'package.json'),'utf8'));
manifest.ymzzCandidate={upstreamSource:revision,sourceArchiveSHA256:archiveSHA256,modified:'MPL-2.0 native manifest-resolver backport; NOT an official0.1.3 binary',productionRuntimeChanged:false};fs.writeFileSync(path.join(target,'package.json'),JSON.stringify(manifest,null,2)+'\n');
const evidence={schema:1,productionRuntimeChanged:false,releaseCleared:false,sourceRevision:revision,sourceArchiveSHA256:archiveSHA256,adapterEntrySHA256:sha(fs.readFileSync(path.join(target,'lib/index.js'))),patchSHA256:sha(fs.readFileSync(path.join(repo,'ymzz/packaging/office-source-candidate/native-resolver.MPL-2.0.patch'))),platform,preferredNativeSourceChecks:[]};
if(process.platform==='win32'){
 const engine=path.dirname(require.resolve('@deepseek-ai/libreoffice-kit-win32-x64/package.json'));
 const sources=path.join(engine,'sources'),prebuildsBytes=fs.readFileSync(path.join(engine,'prebuilds.json')),prebuilds=JSON.parse(prebuildsBytes);
 evidence.nativePrebuildsSHA256=sha(prebuildsBytes);
 evidence.nativeCore=JSON.parse(fs.readFileSync(path.join(sources,'core-source.json')));
 assert.equal(evidence.nativeCore.repository,'https://github.com/LibreOffice/core.git');
 assert.equal(evidence.nativeCore.revision,'bce0998afefdbc355585ca324285661a2170ba77');
 evidence.nativeBaseSourceClosure='Pinned full LibreOffice base archive already retained separately; full static third-party source/notice closure still requires review';
 evidence.nativeSourceMaterialInventory=[];
 for(const rel of prebuilds.source.files){
  assert(rel.startsWith('sources/')&&!rel.includes('..')&&!rel.includes('\\'),'Unsafe native source inventory');
  const file=path.join(engine,rel),bytes=fs.readFileSync(file),actual=sha(bytes);assert.equal(actual,prebuilds.files[rel],'Native source catalog mismatch: '+rel);
  evidence.nativeSourceMaterialInventory.push({path:rel,sha256:actual,bytes:bytes.length});
  const local=rel.slice('sources/'.length);
  // Check ALL preferred worker/build/config/patch code, not merely C++ wrappers.
  // Generated core receipts/full change patch are preserved separately, not
  // mistaken for source missing from a Git archive.
  if(local.startsWith('engine/')||local.startsWith('scripts/')){
   const preferred=path.join(source,local),matched=fs.existsSync(preferred)&&sha(fs.readFileSync(preferred))===actual;
   evidence.preferredNativeSourceChecks.push({path:local,matched,sha256:actual});
  }
 }
 evidence.nativeOriginalNotices=prebuilds.licenses.map(row=>{const bytes=fs.readFileSync(path.join(engine,row.path)),hash=sha(bytes);assert.equal(hash,prebuilds.files[row.path]);return {...row,sha256:hash,bytes:bytes.length}});
 assert(evidence.preferredNativeSourceChecks.length>0,'Native preferred source inventory missing');
}
fs.writeFileSync(path.join(work,'source-build.json'),JSON.stringify(evidence,null,2)+'\n');
if(args.includes('--prepare-only')){console.log('Preferred-source variant prepared only; no qualification or distribution clearance asserted.');process.exit(0)}
// The JSON records mismatches instead of pretending a native-source boundary is cleared.
const output=path.resolve(arg('--output')||path.join(work,'office-actual-candidate.json'));
const probe=[path.join(repo,'ymzz/scripts/qualify-office.mjs'),'--candidate-entry',path.join(target,'lib/index.js'),'--output',output];
if(arg('--installed-provider'))probe.push('--candidate-provider-installed',arg('--installed-provider'));
run(arg('--node')||process.execPath,probe);
const result=JSON.parse(fs.readFileSync(output,'utf8'));result.sourceBuild=evidence;result.nativePreferredSourcesAllMatched=evidence.preferredNativeSourceChecks.length>0&&evidence.preferredNativeSourceChecks.every(row=>row.matched);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log('Source-built candidate actual operations passed; production graph and release gate unchanged.');
