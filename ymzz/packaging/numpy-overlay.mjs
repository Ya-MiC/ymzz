// MIT. Exact prequalified wheel; never downloads arbitrary code or edits upstream archives.
import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
export function applyPackagedNumpySource(resourcesDir){
 const wheel=process.env.YMZZ_QUALIFIED_NUMPY_WHEEL;
 if(!wheel)return {selected:false,releaseCleared:false};
 if(!path.isAbsolute(wheel)||!fs.statSync(wheel).isFile())throw new Error('QUALIFIED_NUMPY_WHEEL_MISSING');
 const script=path.join(import.meta.dirname,'numpy_source_overlay.py');
 const site=path.join(resourcesDir,'runtime/primary-runtime/dependencies/python/Lib/site-packages');
 const output=path.join(resourcesDir,'licenses/ymzz/numpy-source-overlay.json');
 const backup=path.resolve(resourcesDir,'../../../ymzz-preserved-original-numpy');
 if(!path.relative(path.dirname(resourcesDir),backup).startsWith('..'+path.sep))throw new Error('NUMPY_BACKUP_INSIDE_DISTRIBUTION');
 fs.mkdirSync(backup,{recursive:true});
 const r=spawnSync(process.platform==='win32'?'python':'python3',[script,'--wheel',wheel,'--site',site,'--output',output,'--backup-parent',backup],{stdio:'inherit',timeout:180000});
 if(r.error)throw r.error;if(r.status!==0)throw new Error('QUALIFIED_NUMPY_NAMESPACE_OVERLAY_FAILED');
 return JSON.parse(fs.readFileSync(output,'utf8'));
}
