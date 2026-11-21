import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
export function packageNotice(p,licenseRoot,manifest){
 const extra=manifest[p.name];if(extra&&extra.version!==p.version)throw new Error('UNIVER_LICENSE_VERSION_DRIFT');
 const files=fs.readdirSync(p.directory).filter(f=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(f)&&fs.statSync(path.join(p.directory,f)).isFile());
 let text='',sources=[];for(const f of files){text+=fs.readFileSync(path.join(p.directory,f),'utf8')+'\n';sources.push({kind:'published-package',path:f})}
 if(!text){const r=fs.readdirSync(p.directory).find(f=>/^readme(\.|$)/i.test(f));if(r){const body=fs.readFileSync(path.join(p.directory,r),'utf8'),section=body.match(/^#{1,6}\s+licen[sc]e[^\n]*\n([\s\S]*)/im)?.[1];if(section&&/copyright/i.test(section)&&/Permission (to use|is hereby granted)/.test(section)){text=section;sources.push({kind:'published-readme-license-section',path:r})}}}
 if(!text&&extra?.file){if(path.basename(extra.file)!==extra.file)throw new Error('UNIVER_LICENSE_PATH_INVALID');const bytes=fs.readFileSync(path.join(licenseRoot,extra.file));if(createHash('sha256').update(bytes).digest('hex')!==extra.sha256)throw new Error('UNIVER_LICENSE_TEXT_DRIFT');text=bytes.toString('utf8');sources.push({kind:'supplemental-upstream',url:extra.source,sha256:extra.sha256})}
 if(!text)throw new Error('UNIVER_LICENSE_TEXT_MISSING: '+p.name);
 return {text,sources,note:extra?.note||null};
}
