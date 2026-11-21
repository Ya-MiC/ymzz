// MIT. Actual installed production graph audit. LGPL/MPL are not called GPL/AGPL.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {deriveReleaseDecision} from '../compliance/native-release-policy.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const option=n=>process.argv.find(v=>v.startsWith(n+'='))?.slice(n.length+1),packaged=option('--packaged-root'),desktop=option('--packaged-desktop-root');
const boundary=packaged?fs.realpathSync(desktop||packaged):null;
import {classifyLicense} from '../compliance/license-policy.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),seen=new Set(),packages=[],unresolved=[];
function resolve(dir,name){for(let p=dir;;p=path.dirname(p)){const f=path.join(p,'node_modules',name,'package.json');if(fs.existsSync(f))return fs.realpathSync(path.dirname(f));if(p===boundary||path.dirname(p)===p)return null}}
function walk(dir,via){dir=fs.realpathSync(dir);if(seen.has(dir))return;seen.add(dir);const m=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));const notices=fs.readdirSync(dir).filter(f=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(f)&&fs.statSync(path.join(dir,f)).isFile()).map(file=>({file,sha256:sha(fs.readFileSync(path.join(dir,file)))}));let license=typeof m.license==='string'?m.license:null;
 if(!license&&notices.some(n=>{const s=fs.readFileSync(path.join(dir,n.file),'utf8');return s.includes('Permission is hereby granted, free of charge')&&s.includes('THE SOFTWARE IS PROVIDED "AS IS"')}))license='MIT';
 const decision=classifyLicense({name:m.name,version:m.version,license}),passed=decision.strictPermissivePassed;
 const classification=/\bAGPL-/i.test(license||'')?'AGPL':/(^|[^L])\bGPL-/i.test(license||'')?'GPL':/LGPL/i.test(license||'')?'LGPL weak copyleft':/MPL/i.test(license||'')?'MPL file-level copyleft':passed?'permissive selection':'unreviewed/missing/custom';
 packages.push({name:m.name,version:m.version,license,classification,...decision,via,notices});
 for(const name of Object.keys({...m.dependencies,...m.optionalDependencies,...m.peerDependencies})){const child=resolve(dir,name);if(child)walk(child,m.name);else if(!m.optionalDependencies?.[name]&&!m.peerDependenciesMeta?.[name]?.optional)unresolved.push({from:m.name,name})}
}
if(packaged){
 const installed=fs.realpathSync(packaged),index=JSON.parse(fs.readFileSync(path.join(installed,'package.json')));
 if(index.name!=='@deepseek-ai/dsh-desktop-runtime')throw new Error('UNKNOWN_PACKAGED_RUNTIME_INDEX');
 // The generated JSON-only index is a container, not a third-party executable
 // relicensed MIT. Enumerate and audit EVERY actual dependency separately.
 for(const name of Object.keys(index.dependencies||{})){const child=resolve(installed,name);if(child)walk(child,'actual-packaged-runtime-index');else unresolved.push({from:index.name,name})}
 if(desktop)walk(fs.realpathSync(desktop),'actual-packaged-Electron-shell');
}else for(const p of ['apps/cli','apps/desktop-host','apps/desktop'])walk(path.join(root,p),'full-DSH-production-root');
packages.sort((a,b)=>a.name.localeCompare(b.name));
const inventory=option('--native-inventory'),installed=option('--installed-root');let native=null;
if(inventory){
 if(!packaged||!desktop||!installed)throw Error('ACTUAL_INSTALLED_NATIVE_ROOTS_REQUIRED');
 const snapshot=JSON.parse(fs.readFileSync(inventory,'utf8'));
 if(JSON.stringify({packages:snapshot.actualPackagedNodeGraph?.packages,unresolved:snapshot.actualPackagedNodeGraph?.unresolved})!==JSON.stringify({packages,unresolved}))throw Error('ACTUAL_NODE_GRAPH_NATIVE_SNAPSHOT_MISMATCH');
 const nativeArgs=[path.join(root,'ymzz/scripts/verify_native_rights.py'),'--inventory',path.resolve(inventory),'--installed',path.resolve(installed),'--asar-copy',fs.realpathSync(desktop),'--output',path.resolve(inventory)+'.native-rights.json'];
 if(option('--source-materials'))nativeArgs.push('--source-materials',path.resolve(option('--source-materials')));
 const checked=spawnSync(process.platform==='win32'?'python':'python3',nativeArgs,{encoding:'utf8',timeout:600000,maxBuffer:32*1024*1024});
 if(checked.error)throw checked.error;if(checked.status!==0)throw Error('CURRENT_NATIVE_SOURCE_VERIFIER_FAILED: '+checked.stderr);
 native=JSON.parse(checked.stdout);
 if(native.matrixSHA256!==sha(fs.readFileSync(path.join(root,'ymzz/compliance/native-obligations.lock.json')))||native.inventorySHA256!==sha(fs.readFileSync(inventory))||native.appAsarSHA256!==sha(fs.readFileSync(path.join(installed,'resources/app.asar'))))throw Error('NATIVE_SOURCE_BINDING_MISMATCH');
}
const blocked=packages.filter(p=>!p.strictPermissivePassed),nodePassed=packages.every(p=>p.licensePolicyPassed)&&!unresolved.length,decision=deriveReleaseDecision(nodePassed,native);
const report={schema:3,platform:process.platform,scope:packaged?'Actual post-selector installed ASAR graph. Native/source flags derive ONLY from a fresh complete on-disk verifier against this exact ASAR/Node graph and matching material archives.':'Repository Node declaration preflight only; not an installed release approval.',newExternalDependenciesAdded:0,requiredSourceGroups:[...new Set([...packages.map(p=>p.requiredSourceGroup),...(native?.requiredSourceGroups||[])].filter(Boolean))].sort(),unverifiedReleaseEvidence:decision.missingEvidence,packages,blocked,ownerPolicyBlocked:packages.filter(p=>!p.licensePolicyPassed),ownerApprovedNodeGraphPassed:nodePassed,unresolved,strictPermissiveNodeGraphPassed:!blocked.length&&!unresolved.length,nativeRights:native,...decision};
const output=option('--output')||path.join(root,'ymzz/docs/evidence/production-license-'+process.platform+'.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({platform:process.platform,count:packages.length,ownerPolicyBlocked:report.ownerPolicyBlocked.map(({name,license})=>({name,license})),...decision,nativeHolds:native?.holds,unresolved},null,2));if(process.argv.includes('--enforce')&&!report.releaseCleared)process.exitCode=1;
