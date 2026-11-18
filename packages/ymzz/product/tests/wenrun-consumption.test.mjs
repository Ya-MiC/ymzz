// MIT. Unit consumption proof only; real installed painted-pixel gate remains mandatory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {consumeWenrunTheme} from '../wenrun-consumption.mjs';
const css=fs.readFileSync(new URL('../wenrun-tokens.css',import.meta.url),'utf8');
const authority=name=>css.match(new RegExp('--'+name+':\\s*(#[0-9a-f]{6})','i'))[1].toUpperCase();
function fixture(values){
 const bodyValues={},panelValues={},priorities={};
 const panel={style:{setProperty:(n,v,p)=>{panelValues[n]=v;priorities[n]=p},getPropertyValue:n=>panelValues[n],getPropertyPriority:n=>priorities[n]}};
 const document={body:{style:{setProperty:(n,v)=>bodyValues[n]=v}},documentElement:{},defaultView:{getComputedStyle:()=>({getPropertyValue:n=>values[n]||''})},getElementById:()=>panel};
 return {document,panel,bodyValues,panelValues,priorities};
}
test('dark consumption resolves real authority paper/black instead of inheriting a stale light alias',()=>{
 const f=fixture({'--c-dusk-paper':authority('c-dusk-paper'),'--bg-0':'#1F1B16','--ink-1':authority('ink-1')});
 const result=consumeWenrunTheme(f.document,'dark');
 assert.equal(result.authorityInk,authority('c-dusk-paper'));
 assert.equal(f.bodyValues['--ink-1'],authority('c-dusk-paper'));
 assert.equal(f.panelValues.color,authority('c-dusk-paper'));
 assert.equal(f.panelValues['--ymzz-on-accent'],'#1F1B16');
 assert.equal(f.priorities.color,'important');assert.equal(f.priorities['--ink-1'],'important');assert.equal(result.inlineColorPriority,'important');
});
test('switch back to light restores original warm ink for prose and pastel fills',()=>{
 const f=fixture({'--ink-1':authority('ink-1')});
 consumeWenrunTheme(f.document,'light');
 assert.equal(f.bodyValues['--ymzz-readable-ink'],authority('ink-1'));
 assert.equal(f.panelValues['--ymzz-on-accent'],authority('ink-1'));
});
test('missing authority token fails closed without inventing colors',()=>{
 const f=fixture({});assert.throws(()=>consumeWenrunTheme(f.document,'dark'),/WENRUN_AUTHORITY_COLOR_MISSING/);assert.deepEqual(f.bodyValues,{});
});
test('unknown scheme fails before touching owned style',()=>{
 const f=fixture({});assert.throws(()=>consumeWenrunTheme(f.document,'arbitrary'),/WENRUN_SCHEME_INVALID/);assert.deepEqual(f.bodyValues,{});
});

test('actual owned dialog reference is used even when global lookup cannot locate it',()=>{const f=fixture({'--c-dusk-paper':authority('c-dusk-paper'),'--bg-0':'#1F1B16'});f.document.getElementById=()=>null;const result=consumeWenrunTheme(f.document,'dark',f.panel);assert.equal(result.panelFound,true);assert.equal(f.panelValues.color,authority('c-dusk-paper'));});
