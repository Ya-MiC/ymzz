import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('strict release gate consumes the post-selector actual installed graph, not repository Office0.2.3',()=>{
 const workflow=fs.readFileSync(new URL('../../../.github/workflows/ymzz-windows.yml',import.meta.url),'utf8');
 assert.doesNotMatch(workflow,/run: node ymzz\/scripts\/audit-production\.mjs --enforce/);
 assert.match(workflow,/inspect-installed-payload\.mjs --installed \$installed --output [^\n]+ --enforce/);
 const source=fs.readFileSync(new URL('../../scripts/inspect-installed-payload.mjs',import.meta.url),'utf8');
 assert.match(source,/if\(args\.includes\('--enforce'\)\)/);assert.match(source,/'--packaged-root='\+path\.join\(copy,'dsh'\)/);assert.match(source,/Actual installed release gate remains on HOLD/);
 assert(source.indexOf('report.localSheets=')<source.indexOf("if(args.includes('--enforce'))"));
 assert(source.indexOf("'--inventory',sourceInventory")<source.indexOf("if(args.includes('--enforce'))"));
});
