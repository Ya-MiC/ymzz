// MIT. Exact owner-approved weak-copyleft exceptions, NOT a blanket allowlist.
import {createRequire} from 'node:module';
const parse=createRequire(import.meta.url)('spdx-expression-parse');
export const permissive=new Set(['MIT','ISC','Apache-2.0','BSD-2-Clause','BSD-3-Clause','0BSD','Unlicense','CC0-1.0','Zlib','Python-2.0','PSF-2.0','BlueOak-1.0.0','OFL-1.1','WTFPL']);
export const approved=Object.freeze([
 {name:'@img/sharp-libvips-linux-x64',version:'1.3.4',license:'LGPL-3.0-or-later',sources:'linux-libvips-8.18.7-not-desktop-qualified'},
 {name:'@img/sharp-win32-x64',version:'0.35.5',license:'Apache-2.0 AND LGPL-3.0-or-later',sources:'windows-libvips-8.18.7'},
 ...['@deepseek-ai/libreoffice-kit','@deepseek-ai/libreoffice-kit-wasm','@deepseek-ai/libreoffice-kit-win32-x64'].map(name=>({name,version:'0.2.3',license:'MPL-2.0',sources:'libreoffice-kit-0.2.3'}))
]);
function permits(n){if(n.conjunction==='or')return permits(n.left)||permits(n.right);if(n.conjunction==='and')return permits(n.left)&&permits(n.right);return !n.exception&&permissive.has(n.license)}
export function classifyLicense({name,version,license}){
 let strictPermissivePassed=false;try{strictPermissivePassed=permits(parse(license))}catch{}
 const exception=approved.find(p=>p.name===name&&p.version===version&&p.license===license);
 return {strictPermissivePassed,ownerApprovedWeakCopyleft:Boolean(exception),licensePolicyPassed:strictPermissivePassed||Boolean(exception),requiredSourceGroup:exception?.sources??null,distributionMaterialsRequired:Boolean(exception)};
}
