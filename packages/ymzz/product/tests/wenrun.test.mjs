// MIT. Palette math/static consumption regressions, NOT installed GUI qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url),authority=fs.readFileSync(new URL('wenrun-tokens.css',root),'utf8'),css=fs.readFileSync(new URL('wenrun.css',root),'utf8');
const token=name=>{const m=authority.match(new RegExp('--'+name+':\\s*(#[0-9a-f]{6})','i'));assert.ok(m,name);return m[1]};
const luminance=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const dark=authority.match(/\[data-theme="dark"\]\s*\{([\s\S]*?)\}/)[1];
const darkBackground=dark.match(/--bg-0:\s*(#[0-9a-f]{6})/i)[1];
for(const [id,bg,fg,accent,onAccent] of [
 ['cloud-light',token('c-cloud-paper'),token('ink-1'),token('c-cloud-sky'),token('ink-1')],
 ['cloud-dark',darkBackground,token('c-dusk-paper'),token('c-dusk-blue'),darkBackground],
 ['earth-light',token('c-earth-oat'),token('ink-1'),token('c-earth-sage'),token('ink-1')],
 ['earth-dark',darkBackground,token('c-dusk-paper'),token('c-wood-sage'),darkBackground],
])test(id+' original colors have readable prose and filled-button ink',()=>{
 assert.ok(contrast(fg,bg)>=4.5,'normal prose AA');assert.ok(contrast(onAccent,accent)>=4.5,'normal button label AA');
});
test('owned consumption uses readable dark prose and warm-dark ink on pastel buttons without changing layout',()=>{
 assert.match(css,/body\[data-ymzz-wenrun\]\[data-ymzz-scheme="dark"\]\s*\{\s*--ink-1: var\(--c-dusk-paper\);\s*--ymzz-readable-ink: var\(--c-dusk-paper\);\s*--ymzz-on-accent: var\(--bg-0\)/);
 assert.match(css,/#ymzz-dsh-panel button\s*\{ color: var\(--ymzz-on-accent\)/);
 assert.match(css,/--dsw-alias-label-primary-foreground: var\(--ymzz-on-accent\)/);
 assert.match(css,/#ymzz-dsh-panel :where\(h2,h3,h4,p,label,summary,pre,article\)\s*\{ color: inherit/);
 const native=fs.readFileSync(new URL('src/client/index.ts',root),'utf8');assert.match(native,/'--dsw-alias-label-primary':'var\(--ymzz-readable-ink\)'/);
});
test('Windows input regression checks real select or its focused popup option and all four rendered palette accents',()=>{
 const ps=fs.readFileSync(new URL('../../../ymzz/scripts/windows-gui-smoke.ps1',root),'utf8');
 assert.match(ps,/AutomationElement\]::FromPoint/);assert.match(ps,/\[YmzzTestMouse\]::mouse_event\(2/);
 assert.match(ps,/focused.Current.ProcessId -ne \$theme.Current.ProcessId/);
 assert.match(ps,/actualAccent -ne \$expectedAccent/);assert.match(ps,/inkPixels -lt 20/);assert.match(ps,/Physical-Click \(Find-Control 'Account menu'\)/);assert.match(ps,/theme-checkpoint.json/);
 assert.doesNotMatch(ps,/Automation\]::Compare\(\$theme,\$focused\)/);
 for(const name of ['雲箋 · 淺','雲箋 · 暗（暮靄）','陶土 · 淺','陶土 · 暗（暮林）'])assert.ok(ps.includes("Select-Theme '"+name+"'"));
});
