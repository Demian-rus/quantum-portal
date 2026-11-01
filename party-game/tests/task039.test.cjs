'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const root=path.resolve(__dirname,'..');
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
