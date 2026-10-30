'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {normalizeTouchHighlight,hunks}=require('../../diagnostics/touch-highlight/source-contract.cjs');
const BASE='db20eabc7c2c71be18120fab230fd8103cb72517',read=f=>fs.readFileSync('party-game/'+f,'utf8'),old=f=>execFileSync('git',['show',BASE+':party-game/'+f],{encoding:'utf8',maxBuffer:20e6});
test('touch hotfix allows only one universal tap-color declaration and exact resource versions; all other runtime/data bytes remain exact',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASE,'party-game'],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.includes('/tests/')&&!f.includes('/scripts/')&&/\.(js|css|json|html|webmanifest)$/.test(f));
 for(const p of files){const f=p.slice(11);assert.equal(normalizeTouchHighlight(read(f)),old(f),f);}
 assert.deepEqual([...new Set(hunks.map(h=>h.file))].sort(),['index.html','style.css','sw.js']);for(const h of hunks)assert.equal(read(h.file).split(h.after).length,2,h.file+' exact unique hunk');
 assert(read('style.css').includes('*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}'));
});
test('hotfix preserves every authored focus/active rule and cannot hide unrelated outline, controller, geometry or RNG changes',()=>{
 const css=read('style.css');assert.equal(normalizeTouchHighlight(css),old('style.css'));
 for(const mutation of [css+'\nbutton{outline:none}',css.replace('outline:3px solid var(--lime)','outline:none'),css.replace('transform:scale(.98)','transform:none')])assert.notEqual(normalizeTouchHighlight(mutation),old('style.css'));
 for(const f of ['profile-views.js','player-profiles.js','app.js','responsive-layout.css','setup-wizard.css','team-controller.js'])assert.equal(read(f),old(f));
});
test('hotfix HTML and native worker precache use style46 and v104; worker lifecycle remains exact',()=>{
 const html=read('index.html'),sw=read('sw.js');assert(html.includes('./style.css?v=46'));assert(sw.includes("'./style.css?v=46'"));assert(sw.includes('kvip-pwa-v104-20261029-touch-highlight-candidate'));assert.equal(sw.slice(sw.indexOf('self.addEventListener')),old('sw.js').slice(old('sw.js').indexOf('self.addEventListener')));
});
