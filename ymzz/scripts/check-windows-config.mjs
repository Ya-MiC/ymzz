// MIT. Owner-approved unsigned Windows policy exception; real official validator.
import assert from 'node:assert/strict';import {validateDesktopPackageEnvironment} from '../../apps/desktop/scripts/desktop-package-environment.mjs';
const env={DSH_DESKTOP_APP_ID:'me.yanming.ymzz',DSH_DESKTOP_AUTO_UPDATE_ENV:'production'};
assert.doesNotThrow(()=>validateDesktopPackageEnvironment(env,{platform:'win32',arch:'x64'},{unsigned:true}));
assert.throws(()=>validateDesktopPackageEnvironment(env,{platform:'win32',arch:'x64'},{prepareOnly:true}),/MANDATORY_UPDATE_PROD_ORIGIN/);
console.log(JSON.stringify({unsignedWindowsConfigurationAccepted:true,signedBuildStillRequiresHTTPSPolicy:true,originInvented:false,nativeWindowsHost:process.platform==='win32'},null,2));
