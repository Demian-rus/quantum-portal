'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const root=path.resolve(__dirname,'..');
test('TASK039 exact reviewed source additions restore accepted main and expose unrelated edits',()=>{
 const {execFileSync}=require('node:child_process'),{normalizeTask039,hunks}=require('../../diagnostics/task039/source-contract.cjs');
 const base='d305bad897d1f912553cf600d82969c031dd76d7';
 for(const file of new Set(hunks.map(h=>h.file))){
  const source=require('../../diagnostics/task041/source-contract.cjs').normalizeTask041(fs.readFileSync(path.join(root,file),'utf8')),before=execFileSync('git',['show',base+':party-game/'+file],{encoding:'utf8',maxBuffer:20e6});
  assert.equal(normalizeTask039(source),before,file);
  assert.notEqual(normalizeTask039(source+'\n/* unreviewed edit */'),before,file);
  for(const h of hunks.filter(h=>h.file===file))assert.equal(source.split(h.after).length,2,file+' exact unique hunk');
 }
 for(const [file,from,to]of [['mode-config.js','basePoints:2','basePoints:9'],['round-selection.js',"game&&ruleSetForGame(game).version>=6","game&&ruleSetForGame(game).version>=5"],['storage-controller.js','sameMatch?persistedMatchOptions:options','options']]){
  const source=fs.readFileSync(path.join(root,file),'utf8'),changed=source.replace(from,to);assert.notEqual(source,changed);
  assert.notEqual(normalizeTask039(changed),execFileSync('git',['show',base+':party-game/'+file],{encoding:'utf8'}),file+' mutation remains visible');
 }
});

test('TASK039 compiled general@68 contains all 1042 editorial corrections and every current override',()=>{
 const {execFileSync}=require('node:child_process'),data=require('../scripts/content.cjs').readDataset(),source=data.packs.find(p=>p.id==='general'&&p.version===68);
 const initial=execFileSync('git',['show','213d7b7becb3d6813ba25a44afcf7c6a3cee6540:party-game/content-packs.js'],{encoding:'utf8',maxBuffer:20e6});
 const previous=JSON.parse(initial.split('\n').find(row=>row.includes('"id":"general","version":68,')).trim().replace(/,$/,''));
 assert.equal(Object.keys(source.categoryOverrides).filter(id=>JSON.stringify(previous.categoryOverrides[id])!==JSON.stringify(source.categoryOverrides[id])).length,1042);
 const h=createSimulation();assert.deepEqual(JSON.parse(h.eval("JSON.stringify(QUIP_CONTENT_PACKS['general@68'])")),source);
 const old=data.packs.find(p=>p.id==='general'&&p.version===67);assert.deepEqual(source.criteria.cardIds,old.criteria.cardIds);
});

test('TASK039 v5 and v6 paused Blitz retain exact RAW, selected IDs and their versioned pool after reload',()=>{
 for(const version of [5,6]){
  const source=createSimulation(7039);source.eval('Object.assign(options,{modes:["blitz"],difficulty:"easy",finishType:"rounds",rounds:4,riskRounds:false,complications:false});newGame()');
  const fixture=JSON.parse(source.storage.get('iskra-party:v1'));
  // Explicit historical schema fixture; never change the rules of a live save.
  fixture.game.contentPack={id:"general",version:68};delete fixture.game.taskDifficultyPolicy;fixture.game.rulesVersion=version;fixture.game.modeConfigVersion=version===5?1:2;fixture.game.contentPack={id:'general',version:version===5?67:68};fixture.options.contentPack={...fixture.game.contentPack};
  source.storage.set('iskra-party:v1',JSON.stringify(fixture));
  const h=createSimulation(7039,new Map(source.storage));assert.equal(h.eval('storageBlocked'),false);h.eval('game.dice=false;roll();game.dice=true;toggleWord();startTimer();pauseTimer();persist()');
  assert.equal(h.eval('game.current.paused'),true);const raw=h.storage.get('iskra-party:v1'),ids=JSON.parse(h.eval('JSON.stringify(game.current.blitzCardIds)'));assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
  const restored=createSimulation(7040,new Map(h.storage));assert.equal(restored.eval('storageBlocked'),false);assert.equal(restored.storage.get('iskra-party:v1'),raw);assert.equal(restored.eval('game.rulesVersion'),version);assert.deepEqual(JSON.parse(restored.eval('JSON.stringify(game.current.blitzCardIds)')),ids);
  if(version===5)assert(restored.eval("getPromptPool('blitz','hard').every(text=>{const card=PARTY_CARDS.find(c=>c.text===text&&c.type==='word');return card?.difficulty==='easy'&&text.length<=12})"));
  else assert(restored.eval("new Set(blitzFullWordPool(game.contentPack).map(c=>c.difficulty)).size===3&&blitzFullWordPool(game.contentPack).some(c=>c.text.length>12)"));
  restored.eval('options.contentPack={id:"general",version:68};renderOptions();persist()');assert.equal(restored.storage.get('iskra-party:v1'),raw,'future setup cannot change either version of paused Blitz');
  restored.eval('resumeTimer();advanceBlitz(true);advanceBlitz(true);advanceBlitz(true);judge(true)');assert.equal(restored.eval('game.history.length'),1);assert.equal(restored.eval('game.history[0].basePoints'),2);assert.equal(restored.eval('game.rulesVersion'),version);
 }
});
test('TASK039 new reward v6 raises only mime, draw and sing and keeps saved v5 scores',()=>{
 const h=createSimulation();
 const data=JSON.parse(h.eval(`JSON.stringify((()=>{
   const old={scoringVersion:2,rulesVersion:5,modeConfigVersion:1},fresh={scoringVersion:2,rulesVersion:6,modeConfigVersion:2};
   return Object.keys(QUIP_MODES_V4).map(id=>({id,old:rewardForRound(old,id,'easy'),fresh:rewardForRound(fresh,id,'easy'),
     configV1:getModeConfig(id,1).basePoints,configV2:getModeConfig(id,2).basePoints}));
 })())`));
 for(const row of data){const change=['mime','draw','sing'].includes(row.id)?1:0;assert.equal(row.fresh,row.old+change,row.id);assert.equal(row.configV2,row.configV1+change,row.id);}
});
test('TASK039 Blitz draws from full single-word pool including medium, hard and long words',()=>{
 const h=createSimulation(),s=JSON.parse(h.eval(`JSON.stringify((()=>{
   const selection={id:'general',version:68},all=blitzFullWordPool(selection),old=getPackCardPool({id:'general',version:67},'blitz','hard',['word']);
   return {size:all.length,oldSize:old.length,tiers:[...new Set(all.map(x=>x.difficulty))],long:all.some(x=>x.text.length>12),single:all.every(x=>x.type==='word'),
     unique:new Set(all.map(x=>x.id)).size===all.length};
 })())`));
 assert.deepEqual(s.tiers.slice().sort(),['easy','hard','medium']);assert(s.long);assert(s.single);assert(s.unique);assert(s.size>s.oldSize);
});
test('TASK039 category overlay is versioned, complete and does not mutate historical card objects',()=>{
 const packs=JSON.parse(fs.readFileSync(path.join(root,'content/packs/general-category-review-v1.json'),'utf8'));
 assert.equal(packs.length,1);const p=packs[0];assert.equal(p.id,'general');assert.equal(p.version,68);
 const original=JSON.parse(fs.readFileSync(path.join(root,'content/packs/approx-games-v6.json'),'utf8'))[0];
 assert.deepEqual(p.criteria,original.criteria);assert.equal(Object.keys(p.categoryOverrides).length,2840);
 for(const [id,tags] of Object.entries(p.categoryOverrides)){assert(p.criteria.cardIds.includes(id));assert(tags.length);assert.equal(new Set(tags).size,tags.length);}
 const h=createSimulation();
 assert.equal(h.eval("PARTY_CARDS.find(x=>x.id==='word-000014').categories.length"),0);
 const result=JSON.parse(h.eval(`JSON.stringify((()=>{
   const old={selectionPolicyVersion:1,pack:{id:'general',version:67},excluded:['transport']},
     fresh={selectionPolicyVersion:1,pack:{id:'general',version:68},excluded:['transport']};
   return {oldHas:getPackCardPool(old,'words','easy',['word']).some(c=>c.id==='word-000014'),
     newHas:getPackCardPool(fresh,'words','easy',['word']).some(c=>c.id==='word-000014'),
     counts:generalCategoryCounts({id:'general',version:68})};
 })())`));
 assert.equal(result.oldHas,true);assert.equal(result.newHas,false);assert.equal(result.counts.total,7460);
});
test('TASK039 future Wizard catalog does not rewrite paused match options in RAW',()=>{
 const h=createSimulation(),state=JSON.parse(h.eval(`JSON.stringify((()=>{
   game={matchId:'paused-duel',contentPack:{id:'general',version:67},roundIndex:0};
   options.contentPack={id:'general',version:67};
   if(!persist())throw Error('Initial save failed');
   const before=localStorage.getItem(STORAGE_KEY);
   // Existing controls may mutate a nested preference in place.
   options.contentPack.version=68;
   if(!persist())throw Error('Future setup save failed');
   const unchanged=localStorage.getItem(STORAGE_KEY);
   game.roundIndex=1;
   if(!persist())throw Error('Round save failed');
   const progressed=JSON.parse(localStorage.getItem(STORAGE_KEY));
   game={matchId:'new-duel',contentPack:{id:'general',version:68},roundIndex:0};
   if(!persist())throw Error('New match save failed');
   const fresh=JSON.parse(localStorage.getItem(STORAGE_KEY));
   return {untouched:before===unchanged,pausedPack:progressed.options.contentPack.version,
      roundIndex:progressed.game.roundIndex,newPack:fresh.options.contentPack.version};
 })())`));
 assert.equal(state.untouched,true,'preview must not modify paused RAW');
 assert.equal(state.pausedPack,67);
 assert.equal(state.roundIndex,1,'round persistence must continue normally');
 assert.equal(state.newPack,68,'a new match adopts the latest selected catalog');
});

test('TASK039 editorial: all 2840 category overrides retain IDs and corrected semantics',()=>{
 const registry=JSON.parse(fs.readFileSync(path.join(root,'content/packs/general-category-review-v1.json'),'utf8'))[0];
 const tags=registry.categoryOverrides;
 assert.equal(Object.keys(tags).length,2840);
 const allowed=new Set(JSON.parse(fs.readFileSync(path.join(root,'content/manifest.json'),'utf8')).categories.map(c=>c.id));
 for(const [id,cats] of Object.entries(tags)){
  assert(registry.criteria.cardIds.includes(id),'Unknown active ID: '+id);
  assert(cats.length>0&&new Set(cats).size===cats.length,'Invalid tag set for '+id);
  for(const category of cats)assert(allowed.has(category),'Unsupported category '+category);
 }
 const corrected={
  'word-000005':['culture'],        // Confetti is not food
  'word-000112':['general'],        // Concept is not food
  'word-000229':['animals'],       // Cat is not technology
  'word-000249':['technology'],    // Telephone is not an animal
  'word-000361':['animals'],       // Seagull is not food
  'word-000505':['everyday'],      // T-shirt is not inherently sport
  'word-000646':['technology','everyday'],
  'word-000730':['food'],          // Quinoa is not cinema
  'word-000966':['technology'],    // Robot vacuum is not a natural phenomenon
  'word-001097':['memes','culture'],
  'word-001159':['everyday'],      // First-grader is not history
  'word-001526':['science'],       // Antigravity is not zoology
  'word-001580':['science'],       // Skepticism is not zoology
  'word-001642':['science'],       // Chromatography is not culture
  'word-001729':['science'],       // Spectroscopy is not painting
  'word-001793':['language'],
  'word-001730':['science','space','technology'],
  'word-000385':['animals'],      // Presupposition is not food
  'phrase-000064':['space'],       // Spaceship is not a ship at sea
  'phrase-000073':['technology','everyday'],
  'phrase-000345':['science'],
  'phrase-000059':['nature','general'],     // A random factor is not food
  'person-000065':['literature'],  // Pushkin
  'person-000071':['music'],       // Michael Jackson
  'person-000094':['sport'],       // Cristiano Ronaldo
  'person-000277':['videogames'], // Lara Croft
  'person-000291':['science'],     // Alan Turing
  'person-000317':['arts']         // Paul Gauguin
 };
 for(const [id,expected] of Object.entries(corrected))assert.deepEqual(tags[id],expected,id);
});

test('TASK039 future menu preferences survive reload without changing active match RAW',()=>{
 const h=createSimulation(7041);
 h.eval('Object.assign(options,{modes:["talk","mime"],difficulty:"easy",modifierChance:100});newGame()');
 assert(h.eval('game!==null'),'baseline party must start');
 const before=h.storage.get('iskra-party:v1'),snapshot=h.eval('JSON.stringify(game)');
 const original=JSON.parse(before),matchId=h.eval('game.matchId');
 h.eval('options.modifierChance=10;options.modes=[];options.difficulty="hard";persist()');
 const futureRaw=h.storage.get('iskra-party:future-options:v1');
 assert.equal(typeof futureRaw,'string');
 assert.equal(h.storage.get('iskra-party:v1'),before,'future menu settings must not rewrite paused RAW');
 assert.deepEqual(JSON.parse(futureRaw).options.modes,[]);
 assert.equal(JSON.parse(futureRaw).matchId,matchId);
 const restarted=createSimulation(7042,new Map(h.storage));
 assert.equal(restarted.eval('storageBlocked'),false);
 assert.equal(restarted.storage.get('iskra-party:v1'),before,'reload must not rewrite paused RAW');
 assert.equal(restarted.eval('JSON.stringify(game)'),snapshot,'live party snapshot remains unchanged');
 assert.equal(restarted.eval('options.modifierChance'),10);
 assert.equal(restarted.eval('options.difficulty'),'hard');
 assert.deepEqual(JSON.parse(restarted.eval('JSON.stringify(options.modes)')),[]);
 restarted.eval('options.modes=["talk"];options.modifierChance=30;persist()');
 const twice=createSimulation(7043,new Map(restarted.storage));
 assert.equal(twice.eval('options.modifierChance'),30,'later preference edits supersede the sidecar');
 assert.deepEqual(JSON.parse(twice.eval('JSON.stringify(options.modes)')),['talk']);
 assert.equal(twice.storage.get('iskra-party:v1'),before,'repeated edits still protect RAW');
 twice.eval('newGame()');
 assert.notEqual(twice.eval('game.matchId'),matchId);
 assert.equal(JSON.parse(twice.storage.get('iskra-party:v1')).options.modifierChance,30);
 const next=createSimulation(7044,new Map(twice.storage));
 assert.equal(next.eval('options.modifierChance'),30,'a new party adopts the chosen menu options');
 assert.equal(next.eval('storageBlocked'),false);
});

test('TASK039 historical preset options without optional modifierChance remain readable in the sidecar',()=>{
 const h=createSimulation(7047);h.eval('options=optionsForPartyPreset("classic-duel",3,{awardTo:"guesser",modes:["yesno"],dice:false});newGame();game.dice=true;game.phase="ready";selectAwardTo("setter");persist()');
 const raw=h.storage.get('iskra-party:v1'),future=JSON.parse(h.storage.get('iskra-party:future-options:v1'));
 assert.equal(Object.hasOwn(future.options,'modifierChance'),false);assert.deepEqual(future.options.modes,[]);
 const next=createSimulation(7048,new Map(h.storage));assert.equal(next.eval('storageBlocked'),false);assert.equal(next.eval('options.modifierChance'),20);
 assert.equal(next.eval('options.modes.length'),0);assert.equal(next.eval('game.awardTo'),'guesser');assert.equal(next.storage.get('iskra-party:v1'),raw);
});

test('TASK039 incompatible future setup policy blocks writes without damaging paused RAW',()=>{
 const h=createSimulation(7045);h.eval('newGame()');
 const before=h.storage.get('iskra-party:v1');
 h.eval('options.modeCompatibilityVersion=99;persist()');
 const restarted=createSimulation(7046,new Map(h.storage));
 assert.equal(restarted.eval('storageBlocked'),true);
 assert.equal(restarted.storage.get('iskra-party:v1'),before);
 restarted.eval('persist()');
 assert.equal(restarted.storage.get('iskra-party:v1'),before);
});

test('TASK039 legacy identities and v1–v6 rules retain RAW while repeated future choices survive reload',()=>{
 for(const version of [1,2,3,4,5,6]){
  const seed=createSimulation(7050);seed.eval('newGame()');
  const fixture=JSON.parse(seed.storage.get('iskra-party:v1'));
  fixture.game.contentPack={id:"general",version:68};delete fixture.game.taskDifficultyPolicy;fixture.game.rulesVersion=version;fixture.game.modeConfigVersion=version<6?1:2;
  delete fixture.game.matchId;delete fixture.game.profileMatch;
  const raw=JSON.stringify(fixture);seed.storage.set('iskra-party:v1',raw);
  const h=createSimulation(7051,new Map(seed.storage));assert.equal(h.eval('storageBlocked'),false);
  const game=h.eval('JSON.stringify(game)');
  h.eval('options.modifierChance=10;options.modes=[];persist()');
  assert.equal(h.storage.get('iskra-party:v1'),raw);
  const next=createSimulation(7052,new Map(h.storage));assert.equal(next.eval('storageBlocked'),false);
  assert.equal(next.eval('options.modifierChance'),10);assert.equal(next.eval('options.modes.length'),0);
  assert.equal(next.eval('JSON.stringify(game)'),game);assert.equal(next.eval('game.rulesVersion'),version);
  next.eval('options.modes=["talk"];options.modifierChance=30;persist()');
  const again=createSimulation(7053,new Map(next.storage));assert.equal(again.eval('options.modifierChance'),30);
  assert.equal(again.storage.get('iskra-party:v1'),raw);again.eval('newGame()');
  assert.equal(again.eval('game.rulesVersion'),6);assert.equal(again.eval('game.modifierChance'),30);
 }
});

test('TASK039 stale future versions are ignored; matching unknown or corrupt sidecars never authorize primary recovery',()=>{
 const seed=createSimulation(7060);seed.eval('newGame()');
 const key='iskra-party:future-options:v1',raw=seed.storage.get('iskra-party:v1'),matchId=seed.eval('game.matchId');
 for(const data of [JSON.stringify({version:99,matchId:'another-match',options:{}}),JSON.stringify({version:99,matchId,options:{}}),'{',JSON.stringify({version:1,matchId,options:null}),JSON.stringify({version:1,matchId,options:{}}),...[{modes:'talk'},{modifierChance:null},{contentPack:{id:'general',version:999}}].map(change=>JSON.stringify({version:1,matchId,options:{...JSON.parse(raw).options,...change}}))]){
  const storage=new Map(seed.storage);storage.set(key,data);const before=new Map(storage),h=createSimulation(7061,storage);
  const stale=JSON.parse(data==='{'?'{}':data).matchId==='another-match';
  assert.equal(h.eval('storageBlocked'),!stale);
  if(!stale){h.eval('persist();newGame();recoverCorruptSave()');assert.deepEqual(storage,before,'neither source key nor backups may be overwritten');}
  assert.equal(storage.get('iskra-party:v1'),raw);
 }
});

test('TASK039 a sidecar for another legacy party without matchId cannot supply its preferences',()=>{
 const seed=createSimulation(7065);seed.eval('newGame()');
 const fixture=JSON.parse(seed.storage.get('iskra-party:v1'));delete fixture.game.matchId;delete fixture.game.profileMatch;
 seed.storage.set('iskra-party:v1',JSON.stringify(fixture));
 const h=createSimulation(7066,new Map(seed.storage));h.eval('options.modifierChance=10;persist()');
 const key='iskra-party:future-options:v1',future=h.storage.get(key);
 fixture.game.teams=['Другая первая','Другая вторая'];fixture.options.modifierChance=80;
 const raw=JSON.stringify(fixture);h.storage.set('iskra-party:v1',raw);
 const next=createSimulation(7067,new Map(h.storage));assert.equal(next.eval('storageBlocked'),false);
 assert.equal(next.eval('options.modifierChance'),80);assert.equal(next.storage.get(key),future);assert.equal(next.storage.get('iskra-party:v1'),raw);
});

test('TASK039 future preference write failures report false and preserve the original party for retry',()=>{
 for(const fault of ['throw','drop','readback','primary']){
  const h=createSimulation(7070);h.eval('newGame()');const raw=h.storage.get('iskra-party:v1'),game=h.eval('JSON.stringify(game)');
  const key='iskra-party:future-options:v1',write=h.context.localStorage.setItem,read=h.context.localStorage.getItem;let wrote=false;
  h.context.localStorage.setItem=(k,v)=>{if(k===key){if(fault==='throw')throw Error('quota');if(fault==='drop')return;wrote=true;}if(k==='iskra-party:v1'&&fault==='primary')throw Error('quota');return write(k,v);};
  h.context.localStorage.getItem=k=>k===key&&wrote&&fault==='readback'?null:read(k);
  assert.equal(h.eval('options.modifierChance=10;options.modes=[];persist()'),false,fault);
  assert.equal(h.storage.get('iskra-party:v1'),raw);assert.equal(h.eval('JSON.stringify(game)'),game);
  h.context.localStorage.setItem=write;h.context.localStorage.getItem=read;assert.equal(h.eval('persist()'),true);
  const next=createSimulation(7071,new Map(h.storage));assert.equal(next.eval('storageBlocked'),false);
  assert.equal(next.eval('options.modifierChance'),10);assert.equal(next.eval('options.modes.length'),0);assert.equal(next.storage.get('iskra-party:v1'),raw);
 }
 const seed=createSimulation(7072);seed.eval('newGame();persist()');const before=new Map(seed.storage),stored=new Map(before);
 stored.get=key=>{if(key==='iskra-party:future-options:v1')throw Error('read unavailable');return Map.prototype.get.call(stored,key);};
 const blocked=createSimulation(7073,stored);assert.equal(blocked.eval('storageBlocked'),true);assert.equal(blocked.eval('storageProblem'),'unavailable');
 blocked.eval('persist();newGame()');assert.deepEqual(new Map(stored),before);
});
