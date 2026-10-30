'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {normalizeTask036,hunks}=require('../../diagnostics/task036/source-contract.cjs');
const {catalogFiles,verifyApprovedCatalogEvolution}=require('./content-integration-guard.cjs');
const BASE='76edbc0c1083060952fce004a1400fcbf6db15e3',old=f=>execFileSync('git',['show',BASE+':party-game/'+f],{encoding:'utf8',maxBuffer:20e6}),read=f=>require('../../diagnostics/task037/source-contract.cjs').normalizeTask037(fs.readFileSync('party-game/'+f,'utf8'));
test('TASK036 permits only exact reviewed presentation changes; all other runtime/data bytes remain exact',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',BASE,'party-game'],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.includes('/tests/')&&!f.includes('/scripts/')&&/\.(js|css|json|webmanifest|html)$/.test(f));
 for(const path of files){const f=path.slice('party-game/'.length);if(catalogFiles.has(f))continue;assert.equal(normalizeTask036(read(f)),old(f),f);}verifyApprovedCatalogEvolution(require('node:path').resolve(__dirname,'../..'));
 assert.deepEqual([...new Set(hunks.map(h=>h.file))].sort(),['index.html','setup-wizard.css','setup-wizard.js','sw.js']);
 for(const h of hunks){assert(h.after);assert.equal(read(h.file).split(h.after).length,2,'unique exact approved addition '+h.file);}
});
test('TASK036 normalizer cannot hide a changed navigation handler, engine, selector or unrelated CSS',()=>{
 for(const f of new Set(hunks.map(h=>h.file))){assert.notEqual(normalizeTask036(read(f)+'\n/* unrelated mutation */'),old(f));}
 const js=read('setup-wizard.js');assert.notEqual(normalizeTask036(js.replace('show(Number(button.dataset.wizardStep))','show(4)')),old('setup-wizard.js'));
 assert.notEqual(normalizeTask036(js.replace('flushSetupRangeWrite();','/* lost flush */')),old('setup-wizard.js'));
 assert.notEqual(normalizeTask036(read('setup-wizard.css').replace('letter-spacing:-.04em','transform:scale(.5)')),old('setup-wizard.css'));
});
test('TASK036 cache entries match real HTML versions; SW install/activate/fetch code is unchanged',()=>{
 const html=read('index.html'),sw=read('sw.js');for(const ref of ['setup-wizard.js?v=11','setup-wizard.css?v=7']){assert(html.includes('./'+ref));assert(sw.includes("'./"+ref+"'"));}
 assert.equal(sw.slice(sw.indexOf('self.addEventListener')),old('sw.js').slice(old('sw.js').indexOf('self.addEventListener')));
 assert.equal(read('style.css'),old('style.css'));assert.equal(read('responsive-layout.css'),old('responsive-layout.css'));
});
