'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const api=require('../scripts/content.cjs'),{createSimulation}=require('../scripts/game-simulation.cjs');
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

test('V84 content integration adds exactly 500 reviewed cards without altering old pool revisions',()=>{
 const added=['geography-expansion-v1','geography-expansion-v2','science-expansion-v1','science-expansion-v2','science-expansion-v3','idiom-expansion-v1','idiom-expansion-v2','science-expansion-v4','general-expansion-v2'];
 const all=base.cards,existing=all.filter(c=>!added.includes(c.pack)&&c.pack!=='general-release-v89-revisions'&&!['general-diversity-v1','general-diversity-v2','general-diversity-v3','general-diversity-v4','general-diversity-v5','general-diversity-v6','general-diversity-v7','general-diversity-v8','general-diversity-v9','general-diversity-v10','general-diversity-v11','general-diversity-v12','general-diversity-v13','general-diversity-v14','general-diversity-v15','general-diversity-v16','general-diversity-v17','general-diversity-v18','general-diversity-v19','general-diversity-v20','general-diversity-v21','general-diversity-v22'].includes(c.pack)),fresh=all.filter(c=>added.includes(c.pack));
 assert.equal(existing.length,4917);assert.equal(fresh.length,500);assert.equal(all.length,6526);
 assert.deepEqual(Object.fromEntries(added.map(name=>[name,fresh.filter(c=>c.pack===name).length])),{
  'geography-expansion-v1':50,'geography-expansion-v2':100,'science-expansion-v1':50,'science-expansion-v2':50,
  'science-expansion-v3':50,'idiom-expansion-v1':50,'idiom-expansion-v2':50,
  'science-expansion-v4':50,'general-expansion-v2':50
 });
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(level=>[level,base.cards.filter(c=>c.pack==='science-expansion-v4'&&c.difficulty===level).length])),{easy:20,medium:20,hard:10});
 assert.equal(base.cards.filter(c=>c.pack==='science-expansion-v4'&&c.type==='person').length,13);
 assert.equal(base.cards.filter(c=>c.pack==='general-expansion-v2'&&c.type==='person').length,11);
 assert.equal(new Set(fresh.map(c=>c.id)).size,500);
 const norm=text=>String(text).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/gu,'');
 const identities=new Set(existing.map(c=>norm(c.text)));
 for(const row of fresh){assert.equal(identities.has(norm(row.text)),false,'Duplicate/new identity: '+row.text);identities.add(norm(row.text))}
 assert.equal(api.validate(base).ok,true);
});
test('V84 latest content declarations are pinned and older theme categories never receive new cards',()=>{
 const sim=createSimulation();
 const count=(id,version)=>sim.eval('getContentPack({id:'+JSON.stringify(id)+',version:'+version+'}).criteria.cardIds.length');
 assert.equal(count('general',15),5450);assert.equal(count('geography',6),406);assert.equal(count('science',8),582);
 for(const [id,version] of [['general',6],['geography',4],['science',4]]){
  const source=base.packs.find(p=>p.id===id&&p.version===version),actual=sim.eval('getContentPack({id:'+JSON.stringify(id)+',version:'+version+'})');
  assert.deepEqual(JSON.parse(JSON.stringify(actual.criteria.cardIds)),source.criteria.cardIds);
 }
 for(const [id,version] of [['culture',1],['geography',1],['science',1]]){
  const found=sim.eval('getPackCardPool({id:'+JSON.stringify(id)+',version:'+version+'},"words","easy",["word","phrase","idiom"]).map(r=>r.pack)');
  assert.equal(found.some(source=>source.endsWith('expansion-v2')||/^science-expansion-|^geography-expansion-/.test(source)),false,id+'@'+version+' must remain fixed');
 }
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'content/editorial/content400-independent-audit-v1.json'),'utf8'));
 assert.equal(ledger.records.length,400);assert.equal(ledger.changes.length,9);
});

// G15 adds a distinct general revision; archived versions stay byte-stable.
test('G15 40 individual words and 10 phrases; general@16 contains 5500 immutable IDs',()=>{
 const data=api.readDataset(),newCards=data.cards.filter(c=>c.pack==='general-diversity-v1');
 assert.equal(newCards.length,50);
 assert.equal(newCards.filter(c=>c.type==='word').length,40);
 assert.equal(newCards.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(d=>[d,newCards.filter(c=>c.difficulty===d).length])),{easy:20,medium:20,hard:10});
 const old=data.packs.find(p=>p.id==='general'&&p.version===15),next=data.packs.find(p=>p.id==='general'&&p.version===16);
 assert.equal(old.criteria.cardIds.length,5450);
 assert.equal(next.criteria.cardIds.length,5500);
 assert.deepEqual(next.criteria.cardIds.slice(0,5450),old.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(5450),newCards.map(c=>c.id));
 assert.equal(api.validate(data).ok,true);
});

// G16 adds 50 diverse tasks while pinning all old general pack snapshots.
test('G16 40 words / 10 phrases, general@17 count 5550, historical selections preserved',()=>{
 const d=api.readDataset(),added=d.cards.filter(c=>c.pack==='general-diversity-v2');
 assert.equal(added.length,50);
 assert.equal(added.filter(c=>c.type==='word').length,40);
 assert.equal(added.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(k=>[k,added.filter(c=>c.difficulty===k).length])),{easy:20,medium:20,hard:10});
 assert.ok(new Set(added.flatMap(c=>c.categories)).size>=10);
 const last=d.packs.find(p=>p.id==='general'&&p.version===16),next=d.packs.find(p=>p.id==='general'&&p.version===17);
 assert.ok(last&&next);
 assert.equal(last.criteria.cardIds.length,5500);
 assert.equal(next.criteria.cardIds.length,5550);
 assert.deepEqual(next.criteria.cardIds.slice(0,5500),last.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(5500),added.map(c=>c.id));
 assert.equal(api.validate(d).ok,true);
});

// G17 must not modify any earlier pinned selection or existing task.
test('G17 adds 40 words and 10 phrases to general@18 without changing general@17',()=>{
 const d=api.readDataset(),fresh=d.cards.filter(c=>c.pack==='general-diversity-v3');
 assert.equal(fresh.length,50);
 assert.equal(fresh.filter(c=>c.type==='word').length,40);
 assert.equal(fresh.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(level=>[level,fresh.filter(c=>c.difficulty===level).length])),{easy:20,medium:20,hard:10});
 assert.ok(new Set(fresh.flatMap(c=>c.categories)).size>=10);
 const old=d.packs.find(p=>p.id==='general'&&p.version===17),next=d.packs.find(p=>p.id==='general'&&p.version===18);
 assert.ok(old&&next);
 assert.equal(old.criteria.cardIds.length,5550);
 assert.equal(next.criteria.cardIds.length,5600);
 assert.deepEqual(next.criteria.cardIds.slice(0,5550),old.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(5550),fresh.map(c=>c.id));
 assert.equal(api.validate(d).ok,true);
});

// G18 adds a new pinned snapshot; all previous revisions and card IDs remain unchanged.
test('G18 adds 40 words and 10 phrases to general@19, preserves general@18',()=>{
 const d=api.readDataset(),fresh=d.cards.filter(c=>c.pack==='general-diversity-v4');
 assert.equal(fresh.length,50);
 assert.equal(fresh.filter(c=>c.type==='word').length,40);
 assert.equal(fresh.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(level=>[level,fresh.filter(c=>c.difficulty===level).length])),{easy:20,medium:20,hard:10});
 assert.ok(new Set(fresh.flatMap(c=>c.categories)).size>=10);
 const old=d.packs.find(p=>p.id==='general'&&p.version===18),next=d.packs.find(p=>p.id==='general'&&p.version===19);
 assert.ok(old&&next);
 assert.equal(old.criteria.cardIds.length,5600);
 assert.equal(next.criteria.cardIds.length,5650);
 assert.deepEqual(next.criteria.cardIds.slice(0,5600),old.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(5600),fresh.map(c=>c.id));
 const normalize=api.normalize,prior=new Set(d.cards.filter(c=>c.pack!=='general-diversity-v4').map(c=>normalize(c.text)));
 for(const card of fresh)assert.equal(prior.has(normalize(card.text)),false,'duplicate: '+card.text);
 assert.equal(new Set(fresh.map(c=>normalize(c.text))).size,50);
 assert.equal(api.validate(d).ok,true);
});

// G19: immutable historical snapshots with G19 being append-only.
test('G19 adds 40 single words and 10 phrases to pinned general@20 (5700)',()=>{
 const d=api.readDataset(),added=d.cards.filter(c=>c.pack==='general-diversity-v5');
 assert.equal(added.length,50);
 assert.equal(added.filter(c=>c.type==='word').length,40);
 assert.equal(added.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(k=>[k,added.filter(c=>c.difficulty===k).length])),{easy:20,medium:20,hard:10});
 assert.ok(new Set(added.flatMap(c=>c.categories)).size>=10);
 const prior=d.packs.find(p=>p.id==='general'&&p.version===19),next=d.packs.find(p=>p.id==='general'&&p.version===20);
 assert.ok(prior&&next);
 assert.equal(prior.criteria.cardIds.length,5650);
 assert.equal(next.criteria.cardIds.length,5700);
 assert.deepEqual(next.criteria.cardIds.slice(0,5650),prior.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(5650),added.map(c=>c.id));
 const normalized=api.normalize,previous=new Set(d.cards.filter(c=>c.pack!=='general-diversity-v5').map(c=>normalized(c.text)));
 for(const card of added)assert.equal(previous.has(normalized(card.text)),false,'duplicate '+card.text);
 assert.equal(new Set(added.map(c=>normalized(c.text))).size,50);
 assert.equal(api.validate(d).ok,true);
});

// G20 only adds a new frozen snapshot; all previous revisions stay unchanged.
test('G20 adds 40 words and 10 phrases to general@21 (5750) without changing general@20',()=>{
 const d=api.readDataset(),fresh=d.cards.filter(c=>c.pack==='general-diversity-v6');
 assert.equal(fresh.length,50);
 assert.equal(fresh.filter(c=>c.type==='word').length,40);
 assert.equal(fresh.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(k=>[k,fresh.filter(c=>c.difficulty===k).length])),{easy:20,medium:20,hard:10});
 assert.ok(new Set(fresh.flatMap(c=>c.categories)).size>=10);
 const old=d.packs.find(p=>p.id==='general'&&p.version===20),next=d.packs.find(p=>p.id==='general'&&p.version===21);
 assert.ok(old&&next);
 assert.equal(old.criteria.cardIds.length,5700);
 assert.equal(next.criteria.cardIds.length,5750);
 assert.deepEqual(next.criteria.cardIds.slice(0,5700),old.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(5700),fresh.map(c=>c.id));
 const normalize=api.normalize,prior=new Set(d.cards.filter(c=>c.pack!=='general-diversity-v6').map(c=>normalize(c.text)));
 for(const c of fresh)assert.equal(prior.has(normalize(c.text)),false,'duplicate '+c.text);
 assert.equal(new Set(fresh.map(c=>normalize(c.text))).size,50);
 assert.equal(api.validate(d).ok,true);
});


// G21 is append-only: no renumbering of historical cards or general pack selections.
test('G21 adds 40 words and 10 phrases to general@22 while preserving general@21',()=>{
 const d=api.readDataset(),added=d.cards.filter(c=>c.pack==='general-diversity-v7');
 assert.equal(added.length,50);
 assert.equal(added.filter(c=>c.type==='word').length,40);
 assert.equal(added.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(level=>[level,added.filter(c=>c.difficulty===level).length])),{easy:20,medium:20,hard:10});
 assert.ok(new Set(added.flatMap(c=>c.categories)).size>=10);
 const old=d.packs.find(p=>p.id==='general'&&p.version===21),next=d.packs.find(p=>p.id==='general'&&p.version===22);
 assert.ok(old&&next);
 assert.equal(old.criteria.cardIds.length,5750);
 assert.equal(next.criteria.cardIds.length,5800);
 assert.deepEqual(next.criteria.cardIds.slice(0,5750),old.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(5750),added.map(c=>c.id));
 const normalize=api.normalize, prior=new Set(d.cards.filter(c=>c.pack!=='general-diversity-v7').map(c=>normalize(c.text)));
 for(const card of added)assert.equal(prior.has(normalize(card.text)),false,'duplicate '+card.text);
 assert.equal(new Set(added.map(c=>normalize(c.text))).size,50);
 assert.equal(api.validate(d).ok,true);
});

// G22 preserves every earlier general revision and only appends new reviewed IDs.
test('G22 appends 40 words and 10 phrases to general@23, keeps general@22 pinned',()=>{
 const d=api.readDataset(),added=d.cards.filter(c=>c.pack==='general-diversity-v8');
 assert.equal(added.length,50);
 assert.equal(added.filter(c=>c.type==='word').length,40);
 assert.equal(added.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(level=>[level,added.filter(c=>c.difficulty===level).length])),{easy:20,medium:20,hard:10});
 assert.ok(new Set(added.flatMap(c=>c.categories)).size>=10);
 const before=d.packs.find(p=>p.id==='general'&&p.version===22),now=d.packs.find(p=>p.id==='general'&&p.version===23);
 assert.ok(before&&now);
 assert.equal(before.criteria.cardIds.length,5800);
 assert.equal(now.criteria.cardIds.length,5850);
 assert.deepEqual(now.criteria.cardIds.slice(0,5800),before.criteria.cardIds);
 assert.deepEqual(now.criteria.cardIds.slice(5800),added.map(c=>c.id));
 const n=api.normalize,previous=new Set(d.cards.filter(c=>c.pack!=='general-diversity-v8').map(c=>n(c.text)));
 for(const c of added)assert.equal(previous.has(n(c.text)),false,'duplicate '+c.text);
 assert.equal(new Set(added.map(c=>n(c.text))).size,50);
 assert.equal(api.validate(d).ok,true);
});


// G23 is append-only, with a separate selection of 5900 pinned IDs.
test('G23 has 40 words, 10 phrases and general@24 preserves general@23',()=>{
 const data=api.readDataset(),added=data.cards.filter(c=>c.pack==='general-diversity-v9');
 assert.equal(added.length,50);
 assert.equal(added.filter(c=>c.type==='word').length,40);
 assert.equal(added.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(l=>[l,added.filter(c=>c.difficulty===l).length])),{easy:20,medium:20,hard:10});
 assert.ok(new Set(added.flatMap(c=>c.categories)).size>=10);
 const prior=data.packs.find(p=>p.id==='general'&&p.version===23),next=data.packs.find(p=>p.id==='general'&&p.version===24);
 assert.ok(prior&&next);
 assert.equal(prior.criteria.cardIds.length,5850);
 assert.equal(next.criteria.cardIds.length,5900);
 assert.deepEqual(next.criteria.cardIds.slice(0,5850),prior.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(5850),added.map(c=>c.id));
 const norm=api.normalize,older=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v9').map(c=>norm(c.text)));
 for(const c of added)assert.equal(older.has(norm(c.text)),false,'duplicate: '+c.text);
 assert.equal(new Set(added.map(c=>norm(c.text))).size,50);
 assert.equal(api.validate(data).ok,true);
});
