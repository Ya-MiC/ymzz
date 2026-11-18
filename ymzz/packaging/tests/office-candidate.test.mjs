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
test('ordinary upstream default remains0.2.3; explicit source production profile requires independent pinned provenance',()=>{const source=fs.readFileSync(script,'utf8');assert(source.includes("argument('--expected-runtime')||'0.2.3'"));assert(source.includes("assert(['0.2.3','0.1.3'].includes(expectedRuntime))"));assert(source.includes('SOURCE_VARIANT_PROVENANCE_MISSING'));assert(source.includes('pinned.adapterEntrySHA256'));assert(source.includes('ACTUAL_INSTALLED_SOURCE_VARIANT_HASH'));assert(source.includes("proof.productionRuntimeChanged=expectedRuntime==='0.1.3'&&!candidate"));});
test('unknown runtime profile fails closed without success evidence',()=>rejected(['--expected-runtime','0.9.9'],/AssertionError/));
