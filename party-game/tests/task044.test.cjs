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
test('TASK044 device digests remain native SHA-256 at block boundaries, after reuse and eviction',()=>{
 const D=require('../device-dictionary.js'),crypto=require('node:crypto'),values=[...Array.from({length:70},(_,n)=>'ё🙂a'.repeat(n)),...Array.from({length:12},(_,n)=>'x'.repeat(55+n)), 'a'.repeat(5000)];
 for(const source of [...values,...values.slice().reverse()])assert.equal(D.hash(source),crypto.createHash('sha256').update(source).digest('hex'));
 const value={version:1,cards:[],revision:9};assert.equal(D.hash(value),crypto.createHash('sha256').update(D.canonical(value)).digest('hex'));assert.throws(()=>D.hash({version:Infinity}));
});
test('TASK044 cached checksums never authorize altered bytes or skip match validation',async()=>{
 const S=require('../team-storage.js'),F=require('../team-format.js'),crypto=require('node:crypto'),map=new Map();let checks=0;
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},store=S.create({storage,receipt:null,exclusive:fn=>fn(),validateMatch:m=>{checks++;return Object.keys(m).sort().join(',')==='teamFormat,turn'&&Number.isSafeInteger(m.turn)&&m.turn>=0;}}),match={teamFormat:F.create([['А','Б'],['В','Г']],{id:'task044-native-hash-fixture',random:()=>.1}),turn:0};
 const saved=await store.commit({expectedRaw:null,match}),record=JSON.parse(saved.raw),{checksum,...payload}=record;assert.equal(checksum,crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'));const before=checks;assert.equal((await store.load()).status,'ok');assert.equal((await store.load()).status,'ok');assert(checks>=before+2,'full validator still runs on repeated unchanged RAW');
 record.match.turn=1;map.set(S.KEY,JSON.stringify(record));assert.equal((await store.load()).reason,'CORRUPT');assert.equal(map.get(S.KEY),JSON.stringify(record));
 record.match.turn=-1;const {checksum:ignored,...invalid}=record;record.checksum=crypto.createHash('sha256').update(JSON.stringify(invalid)).digest('hex');map.set(S.KEY,JSON.stringify(record));assert.equal((await store.load()).reason,'CORRUPT','a correctly hashed invalid game still fails');assert.equal(map.get(S.KEY),JSON.stringify(record));
});
test('TASK044 minimum predicate agrees with exact counts for both editions, all checked modes and empty pools',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation(44);
 const result=h.eval(`(()=>{const settings={...options,taskDifficultyPolicy:readTaskDifficultyPreferences().policy},cases=[];Math.random=()=>{throw Error('availability consumed RNG')};for(const version of [68,69])for(const excluded of [[],QUIP_EDITORIAL_EDITION.categories.slice()]){const selection=pinEditorialSelection({id:'general',version});selection.excluded=excluded;for(const mode of ['talk','mime','draw','sing','yesno','blitz','approx'])for(const level of ['easy','medium','hard']){const pool=editorialPoolFor(selection,settings,mode,level);editorialPoolCounts.delete(pool);const fast=editorialAvailabilityForCheck(selection,settings,mode,level),exact=editorialAvailability(selection,settings,mode,level);cases.push({version,fast,exact});}}return cases;})()`);
 assert.equal(result.length,84);for(const version of [68,69])assert(result.some(r=>r.version===version&&r.fast.available&&!Object.hasOwn(r.fast,'count')),'minimum predicate exercises the immutable pipeline for general@'+version);for(const {fast,exact}of result){assert.equal(fast.available,exact.available);assert.equal(fast.reason,exact.reason);assert(Number.isSafeInteger(exact.count));}
 h.eval(`var originalPool044=editorialPoolFor;editorialPoolFor=()=>Object.freeze([undefined]);`);assert.throws(()=>h.eval(`editorialAvailabilityForCheck(pinEditorialSelection({id:'general',version:69}),{...options,taskDifficultyPolicy:readTaskDifficultyPreferences().policy},'talk','easy')`));
});
