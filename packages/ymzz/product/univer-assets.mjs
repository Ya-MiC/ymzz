// MIT. Fixed authenticated assets only; the editor has an opaque sandbox origin.
import fs from 'node:fs';import path from 'node:path';import {createHash,randomBytes} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function univerStatus(root){try{const p=JSON.parse(fs.readFileSync(path.join(root,'lib/univer/provenance.json'),'utf8'));return {ready:p.version==='1.5.2'&&p.repository==='https://github.com/dream-num/univer',version:'1.5.2',scope:'local open-source Sheets Core, JSON only',network:false}}catch{return {ready:false,version:'1.5.2',scope:'local open-source Sheets Core, JSON only',network:false}}}
export function serveUniverAsset(url,res,root){
 const file={'/ymzz/univer/':'index.html','/ymzz/univer/THIRD_PARTY_NOTICES.txt':'THIRD_PARTY_NOTICES.txt','/ymzz/univer/provenance.json':'provenance.json'}[url.pathname];
 if(!file){res.writeHead(404,{'content-type':'text/plain','cache-control':'no-store'});res.end('NOT_FOUND');return}
 const directory=path.join(root,'lib/univer');if(!univerStatus(root).ready)throw new Error('UNIVER_BUILD_REQUIRED');
 const provenance=JSON.parse(fs.readFileSync(path.join(directory,'provenance.json'),'utf8')),bytes=fs.readFileSync(path.join(directory,file));
 if(file!=='provenance.json'&&sha(bytes)!==provenance.files[file])throw new Error('UNIVER_ASSET_CHECKSUM_MISMATCH');
 const nonce=randomBytes(24).toString('base64'),headers={'content-type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'SAMEORIGIN'};
 if(file==='index.html')headers['content-security-policy']=`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-downloads`;
 res.writeHead(200,headers);res.end(file==='index.html'?bytes.toString('utf8').replaceAll('__YMZZ_NONCE__',nonce):bytes);
}
