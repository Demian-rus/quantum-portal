'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {hunks}=require('../../diagnostics/touch-highlight/source-contract.cjs');
const {catalogFiles,verifyApprovedCatalogEvolution}=require('./content-integration-guard.cjs');
const {normalizeTask039Resources}=require('./task039-resource-contract.cjs');
// The touch hotfix is already in the accepted TASK038 main baseline. Protect
// every unrelated production file against later feature-branch changes.
const BASE='d305bad897d1f912553cf600d82969c031dd76d7';
const read=f=>fs.readFileSync('party-game/'+f,'utf8');
const old=f=>execFileSync('git',['show',BASE+':party-game/'+f],{encoding:'utf8',maxBuffer:20e6});
const reviewedChanges=new Set(['index.html','sw.js','mode-config.js','rules.js','round-selection.js','team-engine.js','storage-controller.js',
 'content/templates/content-packs.before.js','content/templates/content-packs.after.js']);

test('native touch hotfix remains exact; unrelated runtime files remain byte-identical to accepted main',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASE,'party-game'],{encoding:'utf8'}).trim().split('\n')
   .filter(f=>!f.includes('/tests/')&&!f.includes('/scripts/')&&/\.(js|css|json|html|webmanifest)$/.test(f));
 for(const entry of files){
  const file=entry.slice(11);
  if(catalogFiles.has(file)||reviewedChanges.has(file))continue;
  assert.equal(read(file),old(file),file+' must not change outside TASK039');
 }
 verifyApprovedCatalogEvolution(require('node:path').resolve(__dirname,'../..'));
 assert.deepEqual([...new Set(hunks.map(h=>h.file))].sort(),['index.html','style.css','sw.js']);
 for(const h of hunks.filter(h=>h.file!=='sw.js'))assert.equal(read(h.file).split(h.after).length,2,h.file+' exact unique touch hunk');
 // The reviewed worker hunk carried a historical v105 cache token. Its
 // current lifecycle is protected by the exact main comparison below.
 assert(read('style.css').includes('*,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent}'));
});

test('native focus, active, controller, and geometry protection remains intact',()=>{
 const css=read('style.css');assert.equal(css,old('style.css'),'TASK039 must not change touch CSS');
 for(const mutation of [css+'\nbutton{outline:none}',css.replace('outline:3px solid var(--lime)','outline:none'),css.replace('transform:scale(.98)','transform:none')])
  assert.notEqual(mutation,old('style.css'));
 for(const file of ['profile-views.js','player-profiles.js','app.js','responsive-layout.css','setup-wizard.css','team-controller.js'])
  assert.equal(read(file),old(file),file);
});

test('only reviewed TASK039 cache resource versions change in HTML and service worker',()=>{
 const html=read('index.html'),sw=read('sw.js');
 assert(html.includes('./style.css?v=46'));assert(sw.includes("'./style.css?v=46'"));
 assert(sw.includes('kvip-pwa-v109-20261101-task039-future-settings-protection'));
 assert.equal(normalizeTask039Resources(html),old('index.html'),'Unexpected HTML change');
 assert.equal(normalizeTask039Resources(sw),old('sw.js'),'Unexpected PWA precache change');
 assert.equal(sw.slice(sw.indexOf('self.addEventListener')),old('sw.js').slice(old('sw.js').indexOf('self.addEventListener')));
});
