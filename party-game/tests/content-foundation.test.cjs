'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const api=require('../scripts/content.cjs'),{createSimulation}=require('../scripts/game-simulation.cjs');
const root=path.resolve(__dirname,'..'),base=api.readDataset(),copy=()=>structuredClone(base);
function hasError(data,code){return api.validate(data,{locks:false}).errors.some(e=>e.code===code)}
test('TASK009 A deterministic generated modules preserve every existing record and pack declaration',()=>{
 const output=api.render(base),context=vm.createContext({});assert.deepEqual(output,api.render(base));
 for(const name of ['cards.js','approx-questions.js','mode-config.js','rules.js','content-packs.js'])vm.runInContext(output[name]||fs.readFileSync(path.join(root,name),'utf8'),context);
 for(const[name,text]of Object.entries(output))assert.equal(fs.readFileSync(path.join(root,name),'utf8'),text);
 assert.equal(api.digest(JSON.parse(vm.runInContext('JSON.stringify(PARTY_CARDS.slice(0,3536))',context))),'61aa2d5377c00980a9aa46e01542cd8c8b20aaa3bdbada0afe4ae01cf6935a1b');
 assert.equal(api.digest(JSON.parse(vm.runInContext('JSON.stringify(QUIP_APPROX_QUESTIONS.slice(0,150))',context))),'1350da29f51eddcc39cd4bcad4d0c46794751afeea5936769ff81094029356fa');
 assert.equal(api.digest(JSON.parse(vm.runInContext('JSON.stringify(Object.values(QUIP_CONTENT_PACKS).slice(0,10))',context))),'94e4a270642f4bd8a027f4fcd17db9270632b4a4dcddb4d19ceff9ef9f6b3093');
 assert.equal(api.validate(base).ok,true);
});
test('TASK009 A validator rejects duplicate IDs/text, bad types/tags and invalid answers or sources',()=>{
 for(const[code,mutate]of [
  ['id',d=>d.cards[1].id=d.cards[0].id],['normalized-duplicate',d=>d.cards[1].text='  карандаш! '],
  ['type',d=>d.cards[0].type='unknown'],['difficulty',d=>d.cards[0].difficulty='expert'],['text',d=>delete d.cards[0].text],
  ['categories',d=>d.cards[0].categories=['made-up-category']],['answer',d=>d.questions[0].answer='many'],
  ['source',d=>d.questions[0].source='https://invalid'],['source',d=>{d.questions[0].source='formula:3*3';d.questions[0].answer='8'}]
 ]){const d=copy();mutate(d);assert.equal(hasError(d,code),true,code)}
 const omitted=copy();omitted.sources.shift();assert.ok(api.validate(omitted).errors.some(e=>e.code==='historical-source'));
 const changed=copy();changed.sources[0].rows[0].text='Изменён исторический текст';assert.ok(api.validate(changed).errors.some(e=>e.code==='historical-source'));
});
test('TASK009 A new category and filled theme work through declarations without editing the engine',()=>{
 const d=copy();d.manifest.categories.push({id:'future-fixture',name:'Редакционная фикстура'});
 for(let i=0;i<15;i++)d.cards.push({id:'word-'+(990001+i),text:'ФИКСТУРА'+i,type:'word',difficulty:['easy','medium','hard'][Math.floor(i/5)],categories:['future-fixture'],pack:'fixture-origin'});
 d.packs.push({id:'future-fixture',version:1,name:'Фикстура',enabled:true,categories:['future-fixture'],types:['word'],criteria:{cardIds:[],sourcePacks:['fixture-origin']},minCardsPerPool:5,allowedModes:['talk','mime','draw']});
 assert.equal(api.validate(d).ok,true);d.cards=d.cards.filter(c=>c.id!=='word-990001');assert.equal(hasError(d,'pool'),true);
});
test('TASK009 A close formulations are review candidates and normalization never uses substrings as identity',()=>{
 assert.equal(api.normalize('  Ёлка — ＴЕСТ! '),'елка tест');assert.notEqual(api.normalize('МАГНИТ'),api.normalize('ОПЫТ С МАГНИТОМ'));
 const matches=api.nearCandidates([{id:'a',text:'ДЕРЖАТЬ ЯЗЫК ЗА ЗУБАМИ'},{id:'b',text:'ЯЗЫК ЗА ЗУБАМИ'}],'text');assert.equal(matches.length,1);assert.equal(matches[0].decision,'manual-review');
 assert.equal(api.numericAnswer('6,02214076 × 10²³'),6.02214076e23);assert.ok(Number.isNaN(api.numericAnswer('Infinity')));assert.throws(()=>api.checkedFormula('formula:process.exit()'));
});
test('TASK009 A corrupt JSON and invalid root stay byte-exact until explicit recovery consent',()=>{
 for(const raw of ['{broken','','null','false','[]','{"version":1,"game":{"scores":[]}}']){
  const stored=new Map([['iskra-party:v1',raw]]),h=createSimulation(9,stored);h.context.window.confirm=()=>false;
  assert.equal(h.eval('storageBlocked'),true,raw);h.eval('persist();newGame();persist()');assert.equal(stored.get('iskra-party:v1'),raw);assert.equal(stored.has('iskra-party:recovery:v1'),false);
 }
 const absent=createSimulation();assert.equal(absent.eval('storageBlocked'),false);absent.eval('newGame()');assert.ok(absent.eval('game'));
});
test('TASK009 A confirmed recovery verifies a raw backup and unknown versions never offer destructive recovery',()=>{
 const raw='{broken',stored=new Map([['iskra-party:v1',raw]]),h=createSimulation(1,stored);let confirmations=0;h.context.window.confirm=()=>{confirmations++;return true};h.eval('newGame()');
 assert.equal(confirmations,1);assert.equal(JSON.parse(stored.get('iskra-party:recovery:v1')).raw,raw);assert.equal(JSON.parse(stored.get('iskra-party:v1')).version,1);assert.ok(h.eval('game'));assert.equal(h.eval('storageBlocked'),false);
 const next=createSimulation(1,stored);assert.equal(next.eval('storageBlocked'),false);assert.ok(next.eval('game'));
 const futureRaw='{"version":99,"game":{"important":true}}',futureStore=new Map([['iskra-party:v1',futureRaw]]),future=createSimulation(1,futureStore);future.context.window.confirm=()=>{throw Error('Must not offer reset for future versions')};future.eval('newGame();persist()');assert.equal(futureStore.get('iskra-party:v1'),futureRaw);
});
test('TASK009 A recovery aborts on backup failure or a save changed while the confirmation was open',()=>{
 const raw='{broken',store=new Map([['iskra-party:v1',raw]]),h=createSimulation(1,store);h.context.localStorage.setItem=()=>{throw Error('Quota exceeded')};h.eval('newGame()');assert.equal(h.eval('storageBlocked'),true);assert.equal(store.get('iskra-party:v1'),raw);
 const changed=new Map([['iskra-party:v1',raw]]),other=createSimulation(1,changed);other.context.window.confirm=()=>{changed.set('iskra-party:v1','{"version":99}');return true};other.eval('newGame()');assert.equal(changed.get('iskra-party:v1'),'{"version":99}');assert.equal(other.eval('storageBlocked'),true);
});
test('TASK009 A screenshots require an explicit diagnostic flag',async()=>{
 const {capture}=require('./screenshots.cjs'),previous=process.env.QUIP_SCREENSHOTS;let calls=0;const page={screenshot:async()=>{calls++}};
 try{delete process.env.QUIP_SCREENSHOTS;await capture(page,{path:'unused.png'});assert.equal(calls,0);process.env.QUIP_SCREENSHOTS='1';await capture(page,{path:'unused.png'});assert.equal(calls,1)}finally{if(previous===undefined)delete process.env.QUIP_SCREENSHOTS;else process.env.QUIP_SCREENSHOTS=previous}
});
