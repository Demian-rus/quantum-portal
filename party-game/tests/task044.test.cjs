'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const BASE='9812c655cbb8333be91306836d8170827ecc4ddb',old=file=>cp.execFileSync('git',['show',BASE+':'+file],{maxBuffer:40e6});
test('TASK044 exact reviewed presentation hunks retain negative controls',()=>{
 const {hunks,normalizeTask044}=require('../../diagnostics/task044/source-contract.cjs');for(const h of hunks){const source=fs.readFileSync('party-game/'+h.file,'utf8'),before=old('party-game/'+h.file).toString();assert.equal(normalizeTask044(source),before,h.file);assert.notEqual(normalizeTask044(source+'/* forbidden */'),before);assert.notEqual(normalizeTask044(source.replace(h.after,h.after+'/* mutation */')),before);}
});
test('TASK044 retains all catalogs, immutable locks, edition classifications and 248 source cards byte-exact',()=>{
 const files=cp.execFileSync('git',['ls-tree','-r','--name-only',BASE,'--','party-game/content','editorial/quip/editions','editorial/quip/reviews','editorial/quip/task043','party-game/cards.js','party-game/content-packs.js','party-game/approx-questions.js','party-game/editorial-edition.js','party-game/editorial-edition-v2.js'],{encoding:'utf8'}).trim().split('\n');for(const file of files)assert.deepEqual(fs.readFileSync(file),old(file),file);
});
test('TASK044 timer adaptation cannot call game writers, clocks or RNG',()=>{
 const source=fs.readFileSync('party-game/timer-view.js','utf8').split('// Presentation only: OS text sizing')[1];assert(source);assert.doesNotMatch(source,/\b(?:persist|Math\.random|Date\.now|startTimer|pauseTimer|rollOutcome|localStorage|setInterval)\s*[.(]/);assert.match(source,/classList\.toggle\('large-blitz-text'/);
});
