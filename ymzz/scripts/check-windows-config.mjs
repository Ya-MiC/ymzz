// MIT. Invoke official validator directly; not a Windows build/GUI substitute.
import {validateDesktopPackageEnvironment} from '../../apps/desktop/scripts/desktop-package-environment.mjs';
const environment={DSH_DESKTOP_APP_ID:'me.yanming.ymzz',DSH_DESKTOP_AUTO_UPDATE_ENV:'production'};
let error;try{validateDesktopPackageEnvironment(environment,{platform:'win32',arch:'x64'},{unsigned:true})}catch(e){error=e.message}
if(!error?.includes('DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN'))throw new Error('UNEXPECTED_OFFICIAL_PACKAGING_RESULT: '+error);
console.log(JSON.stringify({officialConfigurationAccepted:false,error,nativeWindowsHost:process.platform==='win32',configurationAPIOnly:true,upstreamPolicyUnchanged:true,originInvented:false},null,2));
