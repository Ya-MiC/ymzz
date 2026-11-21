// MIT. Verify the private plugin's real pack/installed assets, not workspace availability.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {list} from 'tar';
import {inspectUniverBundle} from '../../packages/ymzz/product/univer-assets.mjs';
const repo=path.resolve(import.meta.dirname,'../..'),source=path.join(repo,'packages/ymzz/product');
const sha=b=>createHash('sha256').update(b).digest('hex');
const required=['package.json','univer-assets.mjs','lib/univer/index.html','lib/univer/THIRD_PARTY_NOTICES.txt','lib/univer/provenance.json'];
export async function qualifyProductDirectory(root){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 assert.equal(manifest.name,'@ymzz/dsh-product','Wrong product plugin');
 // Never execute a tarball-supplied module unless it is exactly this reviewed source.
 const modulePath=path.join(root,'univer-assets.mjs');
 assert(!fs.lstatSync(modulePath).isSymbolicLink(),'Linked runtime module');
 assert.equal(sha(fs.readFileSync(modulePath)),sha(fs.readFileSync(path.join(source,'univer-assets.mjs'))),'Packaged asset server differs from current source');
 const result=inspectUniverBundle(root),expected=inspectUniverBundle(source);
 assert.deepEqual(result.files,expected.files,'Product bundle differs from this exact local build');
 const lock=fs.readFileSync(path.join(repo,'ymzz/integrations/univer/package-lock.json'));
 assert.equal(result.packageLockSHA256,sha(lock),'Wrong Univer dependency lock');
 const {serveUniverAsset}=await import(pathToFileURL(modulePath).href);
 const server=http.createServer((req,res)=>{try{serveUniverAsset(new URL(req.url,'http://localhost'),res,root)}catch{res.writeHead(500);res.end('ASSET_CHECK_FAILED')}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 try{
  const origin=`http://127.0.0.1:${server.address().port}`,routes=[['','index.html'],['THIRD_PARTY_NOTICES.txt','THIRD_PARTY_NOTICES.txt'],['provenance.json','provenance.json']];
  for(const [suffix,name]of routes){
   const response=await fetch(origin+'/ymzz/univer/'+suffix);assert.equal(response.status,200,name);
   const bytes=Buffer.from(await response.arrayBuffer()),original=fs.readFileSync(path.join(root,'lib/univer',name));
   if(name==='index.html'){
    const csp=response.headers.get('content-security-policy');assert.match(csp,/connect-src 'none'/);assert.match(csp,/sandbox allow-scripts allow-downloads/);assert.doesNotMatch(csp,/allow-same-origin|unsafe-eval/);
    const nonce=csp.match(/script-src 'nonce-([^']+)'/)?.[1];assert(nonce);assert.equal(bytes.toString(),original.toString().replaceAll('__YMZZ_NONCE__',nonce));
   }else assert.equal(sha(bytes),sha(original),name);
  }
  assert.equal((await fetch(origin+'/ymzz/univer/package-lock.json')).status,404);
  return {schema:1,status:'passed',scope:'Exact private product asset membership, hashes and actual isolated HTTP serving; NOT Windows GUI/formula/live model or global release clearance',univer:result,httpRoutes:3,arbitraryAssetDenied:true,releaseCleared:false};
 }finally{await new Promise(resolve=>server.close(resolve))}
}
export async function qualifyProductTarball(file){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'湛箴 Sheets 實包 ')),seen=new Set(),errors=[];
 try{
  await list({file,strict:true,onReadEntry(entry){
   const name=entry.path.startsWith('package/')?entry.path.slice(8):null;if(!required.includes(name))return;
   if(seen.has(name)){errors.push('Duplicate packaged asset: '+name);return}seen.add(name);
   if(entry.type!=='File'||entry.size>32*1024*1024){errors.push('Nonregular/oversized packaged asset: '+name);return}
   const chunks=[];let size=0;entry.on('data',b=>{size+=b.length;if(size<=32*1024*1024)chunks.push(b)});
   entry.on('end',()=>{if(size!==entry.size){errors.push('Asset byte count: '+name);return}const target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.concat(chunks),{flag:'wx'})});
  }});
  assert.deepEqual(errors,[]);for(const name of required)assert(seen.has(name),'Missing packaged asset: '+name);
  return {...await qualifyProductDirectory(root),tarballSHA256:sha(fs.readFileSync(file)),requiredMembers:required};
 }finally{fs.rmSync(root,{recursive:true,force:true})}
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
 const args=process.argv.slice(2),value=n=>args[args.indexOf(n)+1];
 assert(args.includes('--tarball')!==args.includes('--product-root'),'Choose exactly one of --tarball / --product-root');
 const result=args.includes('--tarball')?await qualifyProductTarball(path.resolve(value('--tarball'))):await qualifyProductDirectory(path.resolve(value('--product-root')));
 if(args.includes('--output')){const out=path.resolve(value('--output'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n')}
 console.log(JSON.stringify(result,null,2));
}
