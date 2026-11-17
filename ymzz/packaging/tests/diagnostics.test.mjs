import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collect, redact } from '../../scripts/collect-packaging-diagnostics.mjs';
test('public diagnostics redact environment credentials, auth headers and signed URL queries',()=>{
  const output=redact('Error: fetch https://name:pass@example.test/file?token=url-secret#fragment Authorization: Bearer bearer-secret token=inline-secret x-env-secret',{GITHUB_TOKEN:'x-env-secret'});
  for(const secret of ['name:pass','url-secret','fragment','bearer-secret','inline-secret','x-env-secret']) assert.ok(!output.includes(secret),secret);
  assert.ok(output.includes('https://example.test/file'));
});
test('missing packaging journal is explicit and skipped GUI never qualifies',()=>{
  const report=collect('/nonexistent-ymzz-diagnostics',{YMZZ_GUI_CONCLUSION:'skipped'});
  assert.equal(report.packagingJournalPresent,false);assert.equal(report.installedGuiQualified,false);assert.equal(report.releaseCleared,false);
});
test('collector reads only phase events, not raw logs, output chunks or arbitrary metadata',()=>{
  const root=mkdtempSync(join(tmpdir(),'ymzz-diagnostics-'));
  try {
    const directory=join(root,'apps/desktop/.desktop-build/packaging-runs/2026-11-17-run');mkdirSync(directory,{recursive:true});
    writeFileSync(join(directory,'run.json'),'{}');writeFileSync(join(directory,'stdout.log'),'PRIVATE_OUTPUT_MUST_NOT_APPEAR');
    writeFileSync(join(directory,'events.jsonl'),[
      {type:'output',stage:'prepare:runtime',text:'PRIVATE_OUTPUT_MUST_NOT_APPEAR'},
      {type:'stage-end',stage:'prepare:primary-runtime',success:false,error:'TypeError: fetch failed\n cause: ECONNRESET token=never-publish',env:{secret:'never-publish'}},
    ].map(value=>JSON.stringify(value)).join('\n'));
    const report=collect(root,{GITHUB_SHA:'test-head',YMZZ_PACKAGE_CONCLUSION:'failure',YMZZ_GUI_CONCLUSION:'skipped'});
    assert.equal(report.sourceCommit,'test-head');assert.equal(report.phases.length,1);assert.equal(report.phases[0].success,false);
    const serialized=JSON.stringify(report);assert.ok(!serialized.includes('PRIVATE_OUTPUT'));assert.ok(!serialized.includes('never-publish'));assert.ok(serialized.includes('ECONNRESET'));
    assert.equal(report.installedGuiQualified,false);assert.equal(report.readsPrivateLaunchOrOutputLogs,false);
  } finally {rmSync(root,{recursive:true,force:true});}
});
