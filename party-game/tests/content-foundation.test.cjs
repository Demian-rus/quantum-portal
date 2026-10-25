'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const api=require('../scripts/content.cjs'),{createSimulation}=require('../scripts/game-simulation.cjs');
require('./science-expansion-v4.test.cjs'); // New science content checks share the existing CI test entrypoint.
function selectRecoveryProfiles(h){h.eval("createPlayerProfile('Первый','coral');createPlayerProfile('Второй','cyan');selectedProfileIds=profileStore.profiles.map(p=>p.id)");}
const root=path.resolve(__dirname,'..'),base=api.readDataset(),copy=()=>structuredClone(base);
function hasError(data,code){return api.validate(data,{locks:false}).errors.some(e=>e.code===code)}
test('TASK009 A deterministic generated modules preserve every existing record and pack declaration',()=>{
 const output=api.render(base),context=vm.createContext({});assert.deepEqual(output,api.render(base));
 for(const name of ['cards.js','approx-questions.js','mode-config.js','rules.js','mode-compatibility.js','modifiers-v2.js','content-packs.js'])vm.runInContext(output[name]||fs.readFileSync(path.join(root,name),'utf8'),context);
 for(const[name,text]of Object.entries(output))assert.equal(fs.readFileSync(path.join(root,name),'utf8'),text);
 assert.equal(api.digest(JSON.parse(vm.runInContext('JSON.stringify(PARTY_CARDS.slice(0,3536))',context))),'61aa2d5377c00980a9aa46e01542cd8c8b20aaa3bdbada0afe4ae01cf6935a1b');
 assert.equal(api.digest(JSON.parse(vm.runInContext('JSON.stringify(QUIP_APPROX_QUESTIONS.slice(0,150))',context))),'1350da29f51eddcc39cd4bcad4d0c46794751afeea5936769ff81094029356fa');
 assert.equal(api.digest(JSON.parse(vm.runInContext('JSON.stringify(Object.values(QUIP_CONTENT_PACKS).slice(0,10))',context))),'94e4a270642f4bd8a027f4fcd17db9270632b4a4dcddb4d19ceff9ef9f6b3093');
 assert.equal(api.validate(base).ok,true);
});
test('Geography G1 adds 50 unique prompts only in geography@5 and general@7',()=>{
 const authored=base.cards.filter(c=>c.pack==='geography-expansion-v1');
 assert.equal(authored.length,50);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(level=>[level,authored.filter(c=>c.difficulty===level).length])),
  {easy:20,medium:20,hard:10});
 assert.deepEqual(Object.fromEntries(['word','phrase','person'].map(type=>[type,authored.filter(c=>c.type===type).length])),
  {word:25,phrase:20,person:5});
 assert.ok(authored.every(c=>c.categories.length===1&&c.categories[0]==='geography'));
 const existing=base.cards.filter(c=>c.pack!=='geography-expansion-v1');
 const normalized=new Set(existing.map(c=>api.normalize(c.text)));
 assert.ok(authored.every(c=>!normalized.has(api.normalize(c.text))));
 assert.equal(new Set(authored.map(c=>api.normalize(c.text))).size,50);
 for(const [id,oldVersion,newVersion,oldCount,newCount] of [
  ['geography',4,5,256,306],['general',6,7,4950,5000]
 ]){
  const old=base.packs.find(p=>p.id===id&&p.version===oldVersion);
  const next=base.packs.find(p=>p.id===id&&p.version===newVersion);
  assert.ok(old&&next);assert.equal(old.criteria.cardIds.length,oldCount);
  assert.equal(next.criteria.cardIds.length,newCount);
  assert.deepEqual(next.criteria.cardIds.slice(0,oldCount),old.criteria.cardIds);
  assert.deepEqual(next.criteria.cardIds.slice(oldCount),authored.map(c=>c.id));
 }
});
test('Geography G2 adds 100 unique prompts while preserving geography@5/general@7',()=>{
 const fresh=base.cards.filter(c=>c.pack==='geography-expansion-v2');
 assert.equal(fresh.length,100);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(d=>[d,fresh.filter(c=>c.difficulty===d).length])),{easy:40,medium:40,hard:20});
 const older=base.cards.filter(c=>c.pack!=='geography-expansion-v2');
 const known=new Set(older.map(c=>api.normalize(c.text)));
 assert.ok(fresh.every(c=>c.categories.length===1&&c.categories[0]==='geography'&&!known.has(api.normalize(c.text))));
 assert.equal(new Set(fresh.map(c=>api.normalize(c.text))).size,100);
 for(const[id,oldV,newV,oldN,newN]of [['geography',5,6,306,406],['general',7,8,5000,5100]]){
  const before=base.packs.find(p=>p.id===id&&p.version===oldV),after=base.packs.find(p=>p.id===id&&p.version===newV);
  assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,oldN);assert.equal(after.criteria.cardIds.length,newN);
  assert.deepEqual(after.criteria.cardIds.slice(0,oldN),before.criteria.cardIds);
  assert.deepEqual(after.criteria.cardIds.slice(oldN),fresh.map(c=>c.id));
 }
});
test('Science S1 adds 50 unique prompts and retains science@4 and general@8',()=>{
 const fresh=base.cards.filter(c=>c.pack==='science-expansion-v1');
 assert.equal(fresh.length,50);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(d=>[d,fresh.filter(c=>c.difficulty===d).length])),{easy:20,medium:20,hard:10});
 assert.deepEqual(Object.fromEntries(['word','phrase'].map(type=>[type,fresh.filter(c=>c.type===type).length])),{word:21,phrase:29});
 const older=base.cards.filter(c=>c.pack!=='science-expansion-v1');
 const known=new Set(older.map(c=>api.normalize(c.text)));
 assert.ok(fresh.every(c=>c.categories.length===1&&c.categories[0]==='science'&&!known.has(api.normalize(c.text))));
 assert.equal(new Set(fresh.map(c=>api.normalize(c.text))).size,50);
 for(const[id,oldV,newV,oldN,newN]of [['science',4,5,382,432],['general',8,9,5100,5150]]){
  const before=base.packs.find(p=>p.id===id&&p.version===oldV),after=base.packs.find(p=>p.id===id&&p.version===newV);
  assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,oldN);assert.equal(after.criteria.cardIds.length,newN);
  assert.deepEqual(after.criteria.cardIds.slice(0,oldN),before.criteria.cardIds);
  assert.deepEqual(after.criteria.cardIds.slice(oldN),fresh.map(c=>c.id));
 }
});
test('Science S2 adds 50 unique prompts preserving science@5 and general@9',()=>{
 const fresh=base.cards.filter(c=>c.pack==='science-expansion-v2');
 assert.equal(fresh.length,50);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(d=>[d,fresh.filter(c=>c.difficulty===d).length])),{easy:20,medium:20,hard:10});
 assert.deepEqual(Object.fromEntries(['word','phrase'].map(type=>[type,fresh.filter(c=>c.type===type).length])),{word:6,phrase:44});
 const prior=base.cards.filter(c=>c.pack!=='science-expansion-v2');const oldText=new Set(prior.map(c=>api.normalize(c.text)));
 assert.ok(fresh.every(c=>c.categories.length===1&&c.categories[0]==='science'&&!oldText.has(api.normalize(c.text))));
 assert.equal(new Set(fresh.map(c=>api.normalize(c.text))).size,50);
 for(const[id,oldV,newV,oldN,newN]of [['science',5,6,432,482],['general',9,10,5150,5200]]){
  const before=base.packs.find(p=>p.id===id&&p.version===oldV),after=base.packs.find(p=>p.id===id&&p.version===newV);
  assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,oldN);assert.equal(after.criteria.cardIds.length,newN);
  assert.deepEqual(after.criteria.cardIds.slice(0,oldN),before.criteria.cardIds);
  assert.deepEqual(after.criteria.cardIds.slice(oldN),fresh.map(c=>c.id));
 }
});
test('Science S3 adds 50 unique playable concepts while preserving science@6/general@10',()=>{
 const fresh=base.cards.filter(c=>c.pack==='science-expansion-v3');
 assert.equal(fresh.length,50);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(d=>[d,fresh.filter(c=>c.difficulty===d).length])),{easy:20,medium:20,hard:10});
 assert.deepEqual(Object.fromEntries(['word','phrase'].map(type=>[type,fresh.filter(c=>c.type===type).length])),{word:27,phrase:23});
 const older=base.cards.filter(c=>c.pack!=='science-expansion-v3');const known=new Set(older.map(c=>api.normalize(c.text)));
 assert.ok(fresh.every(c=>c.categories.length===1&&c.categories[0]==='science'&&!known.has(api.normalize(c.text))));
 assert.equal(new Set(fresh.map(c=>api.normalize(c.text))).size,50);
 for(const [id,oldV,newV,oldN,newN] of [['science',6,7,482,532],['general',10,11,5200,5250]]){
  const before=base.packs.find(p=>p.id===id&&p.version===oldV),after=base.packs.find(p=>p.id===id&&p.version===newV);
  assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,oldN);assert.equal(after.criteria.cardIds.length,newN);
  assert.deepEqual(after.criteria.cardIds.slice(0,oldN),before.criteria.cardIds);
  assert.deepEqual(after.criteria.cardIds.slice(oldN),fresh.map(c=>c.id));
 }
});
test('Idioms I1 adds 50 normalized unique prompts to general@12 without mutating general@11',()=>{
 const fresh=base.cards.filter(c=>c.pack==='idiom-expansion-v1');assert.equal(fresh.length,50);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(d=>[d,fresh.filter(c=>c.difficulty===d).length])),{easy:20,medium:20,hard:10});
 assert.ok(fresh.every(c=>c.type==='idiom'&&c.categories.length===0));
 const known=new Set(base.cards.filter(c=>c.pack!=='idiom-expansion-v1').map(c=>api.normalize(c.text)));
 assert.ok(fresh.every(c=>!known.has(api.normalize(c.text))));assert.equal(new Set(fresh.map(c=>api.normalize(c.text))).size,50);
 const before=base.packs.find(p=>p.id==='general'&&p.version===11),after=base.packs.find(p=>p.id==='general'&&p.version===12);
 assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,5250);assert.equal(after.criteria.cardIds.length,5300);
 assert.deepEqual(after.criteria.cardIds.slice(0,5250),before.criteria.cardIds);
 assert.deepEqual(after.criteria.cardIds.slice(5250),fresh.map(c=>c.id));
});
test('Idioms I2 adds 50 distinct expressions while preserving general@12',()=>{
 const fresh=base.cards.filter(c=>c.pack==='idiom-expansion-v2');assert.equal(fresh.length,50);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(d=>[d,fresh.filter(c=>c.difficulty===d).length])),{easy:20,medium:20,hard:10});
 assert.ok(fresh.every(c=>c.type==='idiom'&&c.categories.length===0));
 const prior=new Set(base.cards.filter(c=>c.pack!=='idiom-expansion-v2').map(c=>api.normalize(c.text)));
 assert.ok(fresh.every(c=>!prior.has(api.normalize(c.text))));assert.equal(new Set(fresh.map(c=>api.normalize(c.text))).size,50);
 const before=base.packs.find(p=>p.id==='general'&&p.version===12),after=base.packs.find(p=>p.id==='general'&&p.version===13);
 assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,5300);assert.equal(after.criteria.cardIds.length,5350);
 assert.deepEqual(after.criteria.cardIds.slice(0,5300),before.criteria.cardIds);assert.deepEqual(after.criteria.cardIds.slice(5300),fresh.map(c=>c.id));
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
 const raw='{broken',stored=new Map([['iskra-party:v1',raw]]),h=createSimulation(1,stored);selectRecoveryProfiles(h);let confirmations=0;h.context.window.confirm=()=>{confirmations++;return true};h.eval('newGame()');
 assert.equal(confirmations,1);assert.equal(JSON.parse(stored.get('iskra-party:recovery:v1')).raw,raw);assert.equal(JSON.parse(stored.get('iskra-party:v1')).version,1);assert.ok(h.eval('game'));assert.equal(h.eval('storageBlocked'),false);
 const next=createSimulation(1,stored);assert.equal(next.eval('storageBlocked'),false);assert.ok(next.eval('game'));
 const futureRaw='{"version":99,"game":{"important":true}}',futureStore=new Map([['iskra-party:v1',futureRaw]]),future=createSimulation(1,futureStore);future.context.window.confirm=()=>{throw Error('Must not offer reset for future versions')};future.eval('newGame();persist()');assert.equal(futureStore.get('iskra-party:v1'),futureRaw);
});
test('TASK009 A recovery aborts on backup failure or a save changed while the confirmation was open',()=>{
 const raw='{broken',store=new Map([['iskra-party:v1',raw]]),h=createSimulation(1,store);selectRecoveryProfiles(h);h.context.localStorage.setItem=()=>{throw Error('Quota exceeded')};h.eval('newGame()');assert.equal(h.eval('storageBlocked'),true);assert.equal(store.get('iskra-party:v1'),raw);
 const changed=new Map([['iskra-party:v1',raw]]),other=createSimulation(1,changed);selectRecoveryProfiles(other);other.context.window.confirm=()=>{changed.set('iskra-party:v1','{"version":99}');return true};other.eval('newGame()');assert.equal(changed.get('iskra-party:v1'),'{"version":99}');assert.equal(other.eval('storageBlocked'),true);
});
test('TASK009 A screenshots require an explicit diagnostic flag',async()=>{
 const {capture}=require('./screenshots.cjs'),previous=process.env.QUIP_SCREENSHOTS;let calls=0;const page={screenshot:async()=>{calls++}};
 try{delete process.env.QUIP_SCREENSHOTS;await capture(page,{path:'unused.png'});assert.equal(calls,0);process.env.QUIP_SCREENSHOTS='1';await capture(page,{path:'unused.png'});assert.equal(calls,1)}finally{if(previous===undefined)delete process.env.QUIP_SCREENSHOTS;else process.env.QUIP_SCREENSHOTS=previous}
});

test('General G14: 50 unique playable prompts and general@15 pinned to exactly 5450 IDs',()=>{
 const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/cards/general-expansion-v2.json'),'utf8'));
 const p=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/packs/general-expansion-v2.json'),'utf8'))[0];
 const before=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/packs/science-expansion-v4.json'),'utf8')).find(v=>v.id==='general'&&v.version===14);
 assert.equal(rows.length,50);assert.equal(new Set(rows.map(r=>r.id)).size,50);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(level=>[level,rows.filter(r=>r.difficulty===level).length])),{easy:20,medium:20,hard:10});
 assert.deepEqual(Object.fromEntries(['word','phrase','person'].map(type=>[type,rows.filter(r=>r.type===type).length])),{word:21,phrase:18,person:11});
 for(const row of rows){assert.match(row.id,new RegExp('^'+row.type+'-039\\d{3}$'));assert.equal(row.pack,'general-expansion-v2');assert.equal(row.categories.length,1)}
 assert.equal(p.id,'general');assert.equal(p.version,15);assert.equal(p.criteria.cardIds.length,5450);
 assert.deepEqual(p.criteria.cardIds.slice(0,before.criteria.cardIds.length),before.criteria.cardIds);
 assert.deepEqual(p.criteria.cardIds.slice(before.criteria.cardIds.length),rows.map(x=>x.id));
});
