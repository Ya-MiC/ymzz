// MIT. Documented branding/compliance resources and the two owner-approved unsigned-policy conditions; no model/runtime rewrite.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
export const TEXT_BRAND_TARGETS=['scripts/client-build-environment.ts','apps/desktop/scripts/electron-builder-config.mjs','apps/desktop/scripts/smoke-packaged-runtime.ts','apps/desktop/src/locale.ts','apps/desktop/src/main.ts'];
const originalSHA256={"scripts/client-build-environment.ts":"87b9aa669d55f384f04788474ed1189865ae00b4d3e253b2f68a46cbebffd094","apps/desktop/scripts/electron-builder-config.mjs":"f9392aabaa402d6f85c2ea1de56a4753492c29b1edf07e6173bc154f258a7567","apps/desktop/scripts/smoke-packaged-runtime.ts":"c9945f11b3340b33d264c65b5c11a95be55d7c6a1a82ce7de2cf083650d99a26","apps/desktop/src/locale.ts":"80c869fb1015cf202954e183d229b25d468c8c16a15e02a02b93974f2f86f992","apps/desktop/src/main.ts":"33b1cb6af103cdf21d46423e0318a579f32fd0246e192745c2667747506be7dc"};
const digest=b=>createHash('sha256').update(b).digest('hex');
export function applyApplicationBranding({dryRun=false}={}){
 const brand=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'brand.json'),'utf8'));const changes=[];
 for(const file of TEXT_BRAND_TARGETS){
  const target=path.join(root,file),original=fs.readFileSync(target,'utf8'),archive=path.join(import.meta.dirname,'archive/upstream-text-branding',file+'.source');const pristine=fs.existsSync(archive)?fs.readFileSync(archive,'utf8'):original;if(digest(pristine)!==originalSHA256[file])throw new Error('PINNED_BRANDING_SOURCE_CHANGED: '+file);let text=pristine;
  if(file==='scripts/client-build-environment.ts'){
   if(!text.includes("DSH_CLIENT_TITLE: '湛箴_ymzz',\n    ...inherited"))text=text.replace('  return {\n    ...inherited,',"  return {\n    DSH_CLIENT_TITLE: '湛箴_ymzz',\n    ...inherited,");
   if(!text.includes("DSH_CLIENT_BUILD_PROFILE: 'local',\n        DSH_CLIENT_TITLE: '湛箴_ymzz'"))text=text.replace("DSH_CLIENT_BUILD_PROFILE: 'local',","DSH_CLIENT_BUILD_PROFILE: 'local',\n        DSH_CLIENT_TITLE: '湛箴_ymzz',");
  }else if(file.endsWith('electron-builder-config.mjs')){
   text=text.replace('const policy = packagesMacOS && unsigned ? undefined : resolveDesktopPolicyEnvironment(env)','const policy = unsigned ? undefined : resolveDesktopPolicyEnvironment(env)');
   text=text.replace("icon: fileURLToPath(new URL('../resources/icon-windows.png', import.meta.url))", "icon: fileURLToPath(new URL('../../../ymzz/branding/generated/icon.ico', import.meta.url))");
   text=text.replace('extraResources: [\n', "extraResources: [\n      { from: fileURLToPath(new URL('../../../ymzz/.build/licenses', import.meta.url)), to: 'licenses/ymzz' },\n");
   text=text.replace("productName: 'DeepSeek Harness'","productName: '湛箴_ymzz'").replace('artifactName: `deepseek-harness-','artifactName: `湛箴_ymzz-');
  }else if(file.endsWith('smoke-packaged-runtime.ts'))text=text.replace("join(application, 'DeepSeek Harness.exe')","join(application, '湛箴_ymzz.exe')");
  else if(file.endsWith('locale.ts'))text=text.replaceAll('DeepSeek Harness','湛箴_ymzz');
  else if(file.endsWith('main.ts')){
   text=text.replace("applicationName: 'DeepSeek Harness'","applicationName: '湛箴_ymzz'");
   const before='detail: formatDesktopMessage(locale.messages.aboutVersion, { version: app.getVersion() }),';
   const detail=brand.meaning+'\nBased on DeepSeek Harness (MIT); not an official DeepSeek product.\n';
   const literal="'"+detail.replaceAll('\\','\\\\').replaceAll("'","\\'").replaceAll('\n','\\n')+"'";
   const after='detail: '+literal+' + formatDesktopMessage(locale.messages.aboutVersion, { version: app.getVersion() }),';
   text=text.replace(before,after);
  }
  if(original!==pristine&&original!==text)throw new Error('UNEXPECTED_BRANDING_TARGET_CHANGE: '+file);
  if(!dryRun&&!fs.existsSync(archive)){fs.mkdirSync(path.dirname(archive),{recursive:true});fs.writeFileSync(archive,original)}
  if(!dryRun&&text!==original)fs.writeFileSync(target,text);
  changes.push({file,changed:text!==original,sha256:digest(text),archive:path.relative(root,archive)});
 }
 if(!dryRun){brand.applicationBrandingApplied=true;fs.writeFileSync(path.join(import.meta.dirname,'brand.json'),JSON.stringify(brand,null,2)+'\n')}
 return {displayName:brand.displayName,changes,dryRun,windowsVerified:false};
}
