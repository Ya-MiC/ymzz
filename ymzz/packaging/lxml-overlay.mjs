/** MIT. Approved feature-preserving MIT XSL replacements in derived Windows payload only. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const candidates=path.resolve(import.meta.dirname,'../compliance/candidates/schematron');
const provenance=JSON.parse(fs.readFileSync(path.join(candidates,'PROVENANCE.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function applyMitTransforms(sitePackages){
 const root=path.resolve(sitePackages);
 if(fs.lstatSync(root).isSymbolicLink())throw new Error('MIT_XSL_SYMLINK_ROOT');
 const plans=provenance.files.map(entry=>{
  const file=path.join(root,...entry.originalWheelPath.split('/'));
  for(let current=file;current!==root;current=path.dirname(current)){
   if(!current.startsWith(root+path.sep))throw new Error('MIT_XSL_OUT_OF_ROOT');
   if(fs.lstatSync(current).isSymbolicLink())throw new Error('MIT_XSL_SYMLINK');
  }
  if(!fs.statSync(file).isFile())throw new Error('MIT_XSL_NOT_FILE');
  const replacement=fs.readFileSync(path.join(candidates,entry.candidate));
  if(sha(replacement)!==entry.candidateSHA256)throw new Error('MIT_XSL_CANDIDATE_HASH');
  const original=sha(fs.readFileSync(file));
  if(![entry.originalSHA256,entry.candidateSHA256].includes(original))throw new Error('MIT_XSL_UNKNOWN_UPSTREAM_HASH');
  return {entry,file,replacement,original};
 });
 // Preflight BOTH files before touching either. Original wheel and prepared source stay immutable.
 for(const {file,replacement,entry,original}of plans){
  if(original!==entry.candidateSHA256){const temporary=file+'.ymzz-'+randomUUID();try{fs.writeFileSync(temporary,replacement,{flag:'wx',mode:fs.statSync(file).mode});fs.renameSync(temporary,file)}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}}
  if(sha(fs.readFileSync(file))!==entry.candidateSHA256)throw new Error('MIT_XSL_PAYLOAD_HASH');
 }
 return {schema:1,scope:'Actual derived packaged runtime XSL overlay; not complete distribution clearance',immutableWheelSHA256:provenance.originalWheelSHA256,files:plans.map(({entry,original})=>({path:entry.originalWheelPath,beforeSHA256:original,afterSHA256:entry.candidateSHA256,license:'MIT',source:entry.source,alreadyApplied:original===entry.candidateSHA256})),releaseCleared:false};
}
export async function applyPackagedMitTransforms(resourcesDir){
 const sitePackages=path.join(resourcesDir,'runtime/primary-runtime/dependencies/python/Lib/site-packages');
 const report=applyMitTransforms(sitePackages);
 const output=path.join(resourcesDir,'licenses/ymzz/lxml-mit-overlay.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 return report;
}
