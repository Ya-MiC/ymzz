// MIT. Harness boundary tests, not native Office functionality proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../../scripts/qualify-office.mjs',import.meta.url));
function rejected(args,pattern){const work=fs.mkdtempSync(path.join(os.tmpdir(),'ymzz-office-flags-'));try{const out=path.join(work,'proof.json');const result=spawnSync(process.execPath,[script,...args,'--output',out],{encoding:'utf8',timeout:15000});assert.notEqual(result.status,0);assert.match(result.stderr,pattern);assert(!fs.existsSync(out),'Invalid flags must never generate success evidence');}finally{fs.rmSync(work,{recursive:true,force:true});}}
test('research candidate cannot masquerade as actual installed production qualification',()=>rejected(['--installed','missing-product','--candidate-entry','missing-candidate'],/Candidate overrides are forbidden/));
test('installed-provider research mode requires an explicit alternate dependency',()=>rejected(['--candidate-provider-installed','missing-product'],/requires explicit candidate entry/));
test('production required runtime stays fixed while source candidate is separately labeled',()=>{const source=fs.readFileSync(script,'utf8');assert.match(source,/let expectedRuntime='0\.2\.3'/);assert.match(source,/assert.equal\(manifest.version,'0\.1\.3'\)/);assert.match(source,/productionRuntimeChanged=false/);});
