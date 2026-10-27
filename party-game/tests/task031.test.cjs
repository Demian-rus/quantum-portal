'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {normalizeTask031}=require('./task031-contract.cjs'),hunks=require('./task031-presentation.json');
const root=path.resolve(__dirname,'../..'),BASE='47a7266b48818b3ebc94e1e37e1f5c3f769ee812';
const read=f=>fs.readFileSync(path.join(root,'party-game',f),'utf8'),old=f=>execFileSync('git',['show',BASE+':party-game/'+f],{cwd:root,encoding:'utf8',maxBuffer:15e6});
test('TASK031 changes only exact declared presentation hunks; all 53 scripts and original game CSS guarded',()=>{
 const names=[...old('index.html').matchAll(/<script src="\.\/([^?]+\.js)\?/g)].map(m=>m[1]);assert.equal(names.length,53);
 for(const f of [...names,'style.css','setup-wizard.css','team-game.css','index.html','sw.js'])assert.equal(normalizeTask031(read(f)),old(f),f);
 assert.deepEqual([...new Set(hunks.map(h=>h.file))].sort(),['index.html','setup-view.js','setup-wizard.css','setup-wizard.js','sw.js']);
 for(const h of hunks){assert(h.after,'normalization must use a nonempty exact anchor');assert(read(h.file).includes(h.after),'declared addition must exist '+h.file);}
});
test('TASK031 retains exact TASK029 validation/memo and real mode settings controller',()=>{
 const stamp=s=>s.slice(s.indexOf(' function viewStamp(){'),s.indexOf(' const scene=document.createElement'));
 assert.equal(stamp(read('setup-wizard.js')),stamp(old('setup-wizard.js')));
 assert.equal(read('setup-controls.js'),old('setup-controls.js'));
 assert.equal(read('setup-view.js').split('// DOM-only rendering')[1],old('setup-view.js').split('// DOM-only rendering')[1]);
 assert.equal(read('rules-guide.js'),old('rules-guide.js'));
 assert.doesNotMatch(read('setup-wizard.js'),/localStorage|indexedDB|Math\.random|newGame\(|persist\(/);
});
test('TASK031 scopes touch/flat/disclosure styles to wizard and retains native controls',()=>{
 const s=read('setup-wizard.css'),added=hunks.filter(h=>h.file==='setup-wizard.css').map(h=>h.after).join('');
 assert.match(s,/\.setup-wizard \.finish-choices label\{-webkit-tap-highlight-color:transparent\}/);
 assert.match(s,/label.is-pressed>span\{background:#284866\}/);
 assert.match(s,/\.setup-wizard #wizard-extra \.modifier-toggle,/);
 assert.match(s,/\.wizard-rule-details>summary:focus-visible/);
 assert.doesNotMatch(added,/outline\s*:\s*(?:none|0)|pointer-events\s*:\s*none/);
 const w=read('setup-wizard.js');assert.match(w,/<details class="wizard-rule-details"><summary>Правила<\/summary>/);assert.match(w,/guide\.blocks\.map/);assert.doesNotMatch(w,/guide\.blocks\.filter/);assert.match(w,/if\(enteringRules\).*node.open=false/);
});
test('TASK031 retains every catalog and editorial source byte-exact',()=>{
 assert.equal(execFileSync('git',['diff',BASE,'--','party-game/content','party-game/cards.js','party-game/content-packs.js','party-game/approx-questions.js'],{cwd:root,encoding:'utf8',maxBuffer:15e6}),'');
});
test('TASK031 shell and worker use the same new resources without changing PWA lifecycle',()=>{
 const html=read('index.html'),sw=read('sw.js');for(const file of ['setup-wizard.js?v=8','setup-wizard.css?v=4','setup-view.js?v=5']){assert(html.includes('./'+file));assert(sw.includes('./'+file));}
 assert.match(sw,/const CACHE='kvip-pwa-v96-20261027-wizard-polish-candidate'/);
 assert.equal(sw.slice(sw.indexOf("self.addEventListener('install'")),old('sw.js').slice(old('sw.js').indexOf("self.addEventListener('install'")));
});
