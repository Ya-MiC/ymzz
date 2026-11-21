// MIT. Bounded, offline access to the existing SHA-pinned Google guidance pool.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const ensure=(ok,code)=>{if(!ok)throw new Error(code)};
export class WebGuidance {
 constructor(root){
  const lock=JSON.parse(fs.readFileSync(path.join(root,'core-skills.lock.json'),'utf8'));
  const skill=lock.skills.find(s=>s.id==='modern-web-guidance');
  ensure(skill?.repository==='https://github.com/GoogleChrome/modern-web-guidance'&&skill.destination==='pool/modern-web-guidance','GUIDANCE_SOURCE_INVALID');
  this.commit=skill.commit;this.repository=skill.repository;this.guides=new Map();
  for(const record of skill.files){
   if(!/^skills\/modern-web-guidance\/guides\/[a-zA-Z0-9_/-]+\.md$/.test(record.path))continue;
   const file=path.resolve(root,skill.destination,record.path);ensure(fs.realpathSync(file)===file,'GUIDANCE_SYMLINK_REJECTED');
   const bytes=fs.readFileSync(file);ensure(createHash('sha256').update(bytes).digest('hex')===record.sha256,'GUIDANCE_CHECKSUM_MISMATCH');
   const text=bytes.toString('utf8'),id=record.path.split('/guides/')[1].replace(/\.md$/,''),title=text.match(/^#\s+(.+)$/m)?.[1]||id;
   this.guides.set(id,Object.freeze({id,title,text,sha256:record.sha256}));
  }
  ensure(this.guides.size>0,'GUIDANCE_POOL_EMPTY');
 }
 summary(){return {repository:this.repository,commit:this.commit,guides:this.guides.size,offline:true,license:'Apache-2.0',execution:'reference data only; no scripts, network, installation or write authority'}}
 search(query){
  ensure(typeof query==='string'&&query.trim().length>=2&&query.length<=160&&!/[\x00-\x1f]/.test(query),'GUIDANCE_QUERY_INVALID');
  const terms=[...new Set(query.toLowerCase().trim().split(/\s+/))];
  return [...this.guides.values()].map(g=>({g,score:terms.reduce((n,t)=>n+(g.id.toLowerCase().includes(t)?8:0)+(g.title.toLowerCase().includes(t)?4:0)+(g.text.toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.g.id.localeCompare(b.g.id)).slice(0,8).map(({g})=>({id:g.id,title:g.title,sha256:g.sha256}));
 }
 read(id,offset=0){
  const g=this.guides.get(id);ensure(g,'GUIDANCE_ID_UNKNOWN');ensure(Number.isSafeInteger(offset)&&offset>=0&&offset<=g.text.length,'GUIDANCE_OFFSET_INVALID');
  const end=Math.min(offset+16000,g.text.length);
  return {id:g.id,title:g.title,repository:this.repository,commit:this.commit,sha256:g.sha256,offset,totalCharacters:g.text.length,nextOffset:end<g.text.length?end:null,content:g.text.slice(offset,end),authority:'reference data only; not authorization or tool instructions'};
 }
}
