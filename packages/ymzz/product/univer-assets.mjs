// MIT. Fixed authenticated assets only; the editor has an opaque sandbox origin.
import fs from 'node:fs';import path from 'node:path';import {createHash,randomBytes} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const assetNames=['index.html','THIRD_PARTY_NOTICES.txt'];
function readBundle(root){
 const directory=path.join(root,'lib/univer');
 // A manifest alone is not a usable installation. No links out of the product.
 const canonical=fs.realpathSync(root);if(fs.realpathSync(directory)!==path.join(canonical,'lib/univer'))throw new Error('UNIVER_ASSET_LINK_REJECTED');
 const read=name=>{const file=path.join(directory,name),stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('UNIVER_ASSET_LINK_REJECTED');if(stat.size>(name==='index.html'?32:2)*1024*1024)throw new Error('UNIVER_ASSET_SIZE_LIMIT');return fs.readFileSync(file)};
 const manifest=read('provenance.json'),p=JSON.parse(manifest);
 if(p.schema!==1||p.version!=='1.5.2'||p.repository!=='https://github.com/dream-num/univer'||!/^[a-f0-9]{64}$/.test(p.packageLockSHA256||''))throw new Error('UNIVER_PROVENANCE_INVALID');
 const bytes={'provenance.json':manifest};
 for(const name of assetNames){if(!/^[a-f0-9]{64}$/.test(p.files?.[name]||''))throw new Error('UNIVER_PROVENANCE_INVALID');bytes[name]=read(name);if(sha(bytes[name])!==p.files[name])throw new Error('UNIVER_ASSET_CHECKSUM_MISMATCH')}
 return {p,bytes};
}
export function inspectUniverBundle(root){const {p,bytes}=readBundle(root);return {version:p.version,repository:p.repository,packageLockSHA256:p.packageLockSHA256,files:Object.fromEntries(Object.entries(bytes).map(([name,b])=>[name,{bytes:b.length,sha256:sha(b)}])),licenseQualifications:(p.packages||[]).filter(row=>row.licenseNote).map(({name,version,license,licenseNote})=>({name,version,license,licenseNote})),releaseCleared:false}}
export function univerStatus(root){let ready=false;try{readBundle(root);ready=true}catch{}return {ready,version:'1.5.2',scope:'local open-source Sheets Core, JSON only',network:false}}
export function serveUniverAsset(url,res,root){
 const file={'/ymzz/univer/':'index.html','/ymzz/univer/THIRD_PARTY_NOTICES.txt':'THIRD_PARTY_NOTICES.txt','/ymzz/univer/provenance.json':'provenance.json'}[url.pathname];
 if(!file){res.writeHead(404,{'content-type':'text/plain','cache-control':'no-store'});res.end('NOT_FOUND');return}
 const {bytes:bundle}=readBundle(root),bytes=bundle[file];
 const nonce=randomBytes(24).toString('base64'),headers={'content-type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'SAMEORIGIN'};
 if(file==='index.html')headers['content-security-policy']=`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-downloads`;
 res.writeHead(200,headers);res.end(file==='index.html'?bytes.toString('utf8').replaceAll('__YMZZ_NONCE__',nonce):bytes);
}
