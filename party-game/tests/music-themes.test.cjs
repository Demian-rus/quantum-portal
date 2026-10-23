'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readDataset,validate,normalize}=require('../scripts/content.cjs'),{createSimulation}=require('../scripts/game-simulation.cjs'),H=require('../task-history.js');
const plain=x=>JSON.parse(JSON.stringify(x));
test('TASK012 B new sing rounds select only reviewed Russian songs at every difficulty',()=>{
 const languages=new Map(require('../content/editorial/music-theme-review.json').map(row=>[row.id,row.language]));
 for(const level of ['easy','medium','hard','mixed']){
  const h=createSimulation(20261023);let now=1792756800000;
  h.context.Date=class extends Date{static now(){return now}};
  h.context.level=level;
  h.eval('Object.assign(options,{modes:["sing"],difficulty:level,dice:false,complications:false,riskRounds:false,finishType:"rounds",rounds:100});newGame()');
  for(let i=0;i<180;i++){
   if(h.eval('game.phase')==='results')h.eval('newGame()');
   h.eval('roll()');
   const card=plain(h.eval('getPackCardPool(game.contentPack,"songs",game.current.difficulty).find(row=>row.text===game.current.word)'));
   assert.equal(languages.get(card.id),'ru',level+' round '+i+' chose '+card.id+' '+card.text);
   h.eval('toggleWord();if(game.phase==="task")startTimer()');
   if(h.eval('game.phase')==='countdown'){now=h.eval('game.current.autoStartAt');h.eval('tick()')}
   h.eval('finishTimer("early");judge(false)');
  }
 }
});
test('TASK012 B generated languages preserve all 118 reviewed Russian and 106 foreign cards',()=>{
 const ledger=require('../content/editorial/music-theme-review.json'),h=createSimulation(1);
 assert.deepEqual(plain(h.eval('QUIP_SONG_LANGUAGES')),Object.fromEntries(ledger.map(row=>[row.id,row.language])));
 h.eval('options.modes=["sing"];options.dice=false;newGame()');
 const full=plain(h.eval('PARTY_CARD_LEVELS.flatMap(level=>getPackCardPool(game.contentPack,"songs",level))'));
 const russian=plain(h.eval('PARTY_CARD_LEVELS.flatMap(level=>filterSongLanguagePool(getPackCardPool(game.contentPack,"songs",level),game))'));
 assert.equal(full.length,224);assert.equal(russian.length,118);
 assert.equal(russian.filter(card=>card.meta.language==null).length,27);
 assert.deepEqual(new Set(russian.map(card=>card.id)),new Set(ledger.filter(row=>row.language==='ru').map(row=>row.id)));
 assert.equal(full.filter(card=>!russian.some(row=>row.id===card.id)).length,106);
});
test('TASK012 B both song selectors exhaust eligible pools without foreign fallback or lost legacy IDs',()=>{
 const ledger=new Map(require('../content/editorial/music-theme-review.json').map(row=>[row.id,row.language]));
 for(const history of [false,true])for(const languages of [['ru'],['en'],['ru','en']])for(const level of ['easy','medium','hard']){
  const h=createSimulation(12);h.context.request={languages,level};
  h.eval('Object.assign(options,{modes:["sing"],dice:false,difficulty:request.level});newGame();game.songLanguages=request.languages');
  if(!history)h.eval('delete game.taskHistoryVersion;delete game.taskHistory');
  const pool=plain(h.eval('getPackCardPool(game.contentPack,"songs",game.difficulty)'));
  const eligible=pool.filter(card=>languages.includes(ledger.get(card.id))),seen=new Set();
  if(!eligible.length){
   h.eval('Math.random=()=>{throw Error("Empty pool consumed RNG")}');
   assert.throws(()=>h.eval('pullWord("songs",game.difficulty)'),/Нет слов|No distinct eligible/);
   assert.equal(h.eval('checkContentPack(game.contentPack,{...game,modes:["sing"]}).available'),false);
   continue;
  }
  for(let i=0;i<eligible.length+3;i++){
   const word=h.eval('pullWord("songs",game.difficulty)'),card=pool.find(row=>row.text===word);
   assert.ok(languages.includes(ledger.get(card.id)),history+' '+languages+' '+level+' '+card.id);seen.add(card.id);
  }
  assert.deepEqual(seen,new Set(eligible.map(card=>card.id)));
 }
});
test('TASK012 B a song-only pack without reviewed Russian cards cannot replace a party',()=>{
 const h=createSimulation(13);h.eval('options.modes=["talk"];newGame()');
 const game=h.eval('JSON.stringify(game)'),raw=h.storage.get('iskra-party:v1');
 h.eval('const enCard=PARTY_CARDS.find(row=>row.type==="song"&&QUIP_SONG_LANGUAGES[row.id]==="en");'+
  'getContentPack=(selection)=>({id:selection.id,version:selection.version,name:"English fixture",enabled:true,types:["song"],categories:[],criteria:{cardIds:[enCard.id],sourcePacks:[]},minCardsPerPool:1});'+
  'options.modes=["sing"];options.contentPack={id:"general",version:6};options.difficulty=enCard.difficulty;Math.random=()=>{throw Error("Unavailable party consumed RNG")};newGame()');
 assert.equal(h.eval('JSON.stringify(game)'),game);assert.equal(h.storage.get('iskra-party:v1'),raw);
 assert.match(h.elements.get('toast').textContent,/sing\/(?:medium|hard): 0 из 1 заданий/);
});
test('TASK012 B pre-policy V1-V5 songs and all pinned general packs restore without RAW migration',()=>{
 for(const version of [1,2,3,4,5])for(const pack of [1,2,3,4,5,6]){
  const stored=new Map(),h=createSimulation(14,stored);h.context.fixture={version,pack};
  h.eval('Object.assign(options,{modes:["sing"],difficulty:"hard",dice:false,complications:false});newGame();'+
   'delete game.songLanguagePolicyVersion;delete game.songLanguages;game.rulesVersion=fixture.version;game.contentPack={id:"general",version:fixture.pack};Math.random=()=>.999999;roll();game.dice=true;options.dice=true;persist()');
  const before=h.eval('JSON.stringify(game)'),memory=h.eval('JSON.stringify(taskMemory)'),raw=stored.get('iskra-party:v1');
  const pool=h.eval('JSON.stringify(getPromptPool("songs","hard"))');let writes=0;
  const original=stored.set;stored.set=function(...args){writes++;return Reflect.apply(original,this,args)};
  const again=createSimulation(99,stored);
  assert.equal(again.eval('JSON.stringify(game)'),before);assert.equal(again.eval('JSON.stringify(taskMemory)'),memory);
  assert.equal(again.eval('JSON.stringify(getPromptPool("songs","hard"))'),pool);
  again.eval('Math.random=()=>{throw Error("Legacy restore selected a song")};continueGame();render()');
  assert.equal(stored.get('iskra-party:v1'),raw);assert.equal(writes,0);
  if(pack>=4)assert.equal(again.eval('QUIP_SONG_LANGUAGES[getPackCardPool(game.contentPack,"songs","hard").find(row=>row.text===game.current.word).id]'),'en');
  for(const current of [h,again])current.eval('Math.random=()=>.999999;game.phase="judge";judge(false);game.dice=false;roll()');
  assert.equal(again.eval('JSON.stringify(game)'),h.eval('JSON.stringify(game)'));
 }
});
test('TASK012 B unknown and malformed language policies preserve the protected original bytes',()=>{
 const cases=[{songLanguagePolicyVersion:99,songLanguages:['ru']},{songLanguages:['ru']},
  {songLanguagePolicyVersion:1},{songLanguagePolicyVersion:1,songLanguages:[]},
  {songLanguagePolicyVersion:1,songLanguages:['fr']},{songLanguagePolicyVersion:1,songLanguages:['ru','ru']}];
 for(const policy of cases){
  const h=createSimulation(15);h.eval('options.modes=["sing"];newGame()');
  const saved=JSON.parse(h.storage.get('iskra-party:v1'));delete saved.game.songLanguagePolicyVersion;delete saved.game.songLanguages;Object.assign(saved.game,policy);
  const raw=' '+JSON.stringify(saved)+'\n',stored=new Map([['iskra-party:v1',raw]]),again=createSimulation(16,stored);
  assert.equal(again.eval('storageBlocked'),true);again.eval('persist();newGame()');assert.equal(stored.get('iskra-party:v1'),raw);
 }
});
test('TASK012 B Secret singing keeps its full source and RNG independently of sing language policy',()=>{
 const pair=[createSimulation(17),createSimulation(17)],calls=[0,0];
 for(const [index,h]of pair.entries()){
  h.eval('Object.assign(options,{modes:["sing","secret"],difficulty:"hard",dice:false,awardTo:"guesser"});newGame();pickMode=()=>getMode("secret")');
  if(index)h.eval('delete game.songLanguagePolicyVersion;delete game.songLanguages');
  h.context.Math.random=()=>{calls[index]++;return .999999};h.eval('roll()');
  assert.equal(h.eval('game.current.methodId'),'sing');
  assert.equal(h.eval('QUIP_SONG_LANGUAGES[getPackCardPool(game.contentPack,"songs","hard").find(row=>row.text===game.current.word).id]'),'en');
 }
 assert.equal(calls[0],calls[1]);assert.equal(pair[0].eval('JSON.stringify(game.current)'),pair[1].eval('JSON.stringify(game.current)'));
 assert.equal(pair[0].eval('JSON.stringify(game.taskHistory)'),pair[1].eval('JSON.stringify(game.taskHistory)'));
});
test('TASK009 D2 universal music themes have independent evidence, unique text and balanced languages',()=>{
 const d=readDataset(),rows=d.sources.find(s=>s.path==='cards/music-themes-v2.json').rows;
 assert.equal(rows.length,197);assert.equal(new Set(rows.map(r=>normalize(r.text))).size,197);
 assert.ok(rows.every(r=>r.meta.examples.length===2&&r.text.split(/\s+/).length<=2));
 for(const row of rows){assert.equal(new Set(row.meta.examples.map(e=>normalize(e.artist+' '+e.title))).size,2);for(const e of row.meta.examples)assert.ok(e.source.startsWith('https://')&&e.wordForm&&e.checkedAt)}
 const h=createSimulation(1),pool=plain(h.eval('PARTY_CARD_LEVELS.flatMap(level=>getPackCardPool({id:"general",version:4},"songs",level))'));
 assert.equal(pool.length,224);assert.equal(pool.filter(r=>r.meta.themeVersion!==2).length,27);assert.equal(new Set(pool.map(r=>normalize(r.text))).size,224);
 const ledger=require('../content/editorial/music-theme-review.json');assert.equal(ledger.filter(r=>r.language==='ru').length,118);assert.equal(ledger.filter(r=>r.language==='en').length,106);
 assert.ok(validate(d).ok);
});
test('TASK009 D2 earlier general and thematic pools remain object-equivalent, nonmusic is unchanged',()=>{
 const d=readDataset(),old=d.cards.filter(r=>r.pack!=='music-themes-v2'),h=createSimulation(2);h.context.beforeD2=old;
 for(const selection of [{id:'general',version:1},{id:'general',version:2},{id:'general',version:3},{id:'geography',version:2},{id:'science',version:2}])for(const kind of ['words','blitz','songs','people'])for(const level of ['easy','medium','hard']){
  h.context.args={...selection,kind,level};assert.deepEqual(plain(h.eval('getPackCardPool(args,args.kind,args.level,["word","phrase","idiom"])')),plain(h.eval('getPackCardPool(args,args.kind,args.level,["word","phrase","idiom"],beforeD2)')));
 }
 for(const kind of ['words','blitz','people'])for(const level of ['easy','medium','hard']){h.context.args={kind,level};assert.deepEqual(plain(h.eval('getPackCardPool({id:"general",version:4},args.kind,args.level,["word","phrase","idiom"])')),plain(h.eval('getPackCardPool({id:"general",version:3},args.kind,args.level,["word","phrase","idiom"])')))}
});
test('TASK009 D2 reviewed cross-mode words share history, arbitrary within-type duplicates are rejected',()=>{
 const d=readDataset();for(const group of d.manifest.reviewedCrossTypeCollisions){const [a,b]=group.ids.map(id=>d.cards.find(r=>r.id===id));assert.ok(H.taskRecordKeys(a).some(k=>H.taskRecordKeys(b).includes(k)))}
 const row=d.cards.find(r=>r.pack==='music-themes-v2');row.text=d.cards.find(r=>r.pack==='music-themes-v2'&&r.id!==row.id).text;assert.ok(validate(d).errors.some(e=>e.code==='normalized-duplicate'));
});
test('TASK009 D2 rule copy and saved song stay pinned, new parties alone adopt music policy',()=>{
 const store=new Map(),h=createSimulation(3,store);h.eval('options.dice=false;options.modes=["sing"];options.complications=false;newGame();roll()');assert.equal(h.eval('game.contentPack.version'),h.eval('latestGeneralPackSelection().version'));assert.match(h.eval('modeInformation().rule'),/любую песню/);
 h.eval('game.contentPack={id:"general",version:3};game.dice=true;persist()');const snapshot=h.eval('JSON.stringify(game)'),again=createSimulation(4,store);assert.equal(again.eval('JSON.stringify(game)'),snapshot);assert.doesNotMatch(again.eval('modeInformation().rule'),/любую песню/);
 again.eval('newGame();roll()');assert.match(again.eval('modeInformation().rule'),/любую песню/);
});
