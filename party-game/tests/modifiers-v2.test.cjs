'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {read,validate,build}=require('../scripts/modifiers-v2.cjs'),{createSimulation}=require('../scripts/game-simulation.cjs');
const plain=value=>JSON.parse(JSON.stringify(value));
function match(mode='talk',level='easy',awardTo='setter'){
 const h=createSimulation(9);h.context.testMode=mode;h.context.testLevel=level;h.context.testAward=awardTo;
 h.eval('options.modes=[testMode];options.difficulty=testLevel;options.awardTo=testAward;options.modifierChance=100;options.dice=false;newGame()');return h;
}
test('TASK009 C all 112 historical decisions and the complete 51-record V2 are reproducible',()=>{
 const data=read();assert.deepEqual(validate(data),{modifiers:51,audited:112});
 for(const [file,content]of Object.entries(build(data)))assert.equal(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),content);
 const h=match();assert.equal(h.eval('QUIP_MODIFIERS.length'),112);assert.equal(new Set(data.rows.map(r=>r.id)).size,51);
 assert.ok(data.audit.every(row=>row.reason&&row.text));assert.equal(h.eval('game.rulesVersion'),5);assert.equal(h.eval('game.modifierCatalogVersion'),2);
});
test('TASK009 C pools are exact-tier, role-aware and manually gated by concrete-object metadata',()=>{
 const h=match();for(const level of ['easy','medium','hard'])for(const mode of ['talk','mime','draw','sing','blitz','yesno'])for(const awardTo of ['setter','guesser']){
  h.context.req={mode,level,awardTo};const pool=plain(h.eval('getV2ModifierPool(req.mode,req.level,{awardTo:req.awardTo})'));
  assert.ok(pool.every(row=>row.severity===level&&row.modes.includes(mode)&&!row.requires.concreteObject));
  if(mode==='yesno'&&awardTo==='setter')assert.equal(pool.length,0);else assert.ok(pool.length>0,JSON.stringify(h.context.req));
 }
 const base=h.eval('getV2ModifierPool("draw","hard",game).some(m=>m.id==="v2-surroundings")');assert.equal(base,false);
 assert.equal(h.eval('getV2ModifierPool("draw","hard",game,{card:{meta:{concreteObject:true}}}).some(m=>m.id==="v2-surroundings")'),true);
 const beep=read().rows.find(r=>r.id==='v2-beep');assert.equal(beep.requires.vocalStyle,'lyrics-required');assert.match(beep.text,/Исполняй со словами/);
});
test('TASK009 C chance boundaries stay unchanged before exhaustion and Approx uses no modifier RNG',()=>{
 const h=match();h.context.request={modeId:'talk',methodId:'talk',difficulty:'easy',complications:true};
 for(const chance of [10,20,50,100]){h.eval('game.modifierChance='+chance);let count=0;
  for(let i=0;i<100;i++){let calls=0;h.context.rng=()=>calls++===0?i/100:0;if(h.eval('choosePartyModifier(game,{...request,memory:taskMemory},rng).modifier'))count++}
  assert.equal(count,chance);
 }
 h.context.rng=()=>{throw Error('Unexpected RNG')};assert.equal(h.eval('choosePartyModifier(game,{...request,modeId:"approx",memory:taskMemory},rng).modifier'),null);
});
test('TASK009 C family and safe-alternative history skip optional repeats, while Secret has finite fallback',()=>{
 const h=match();h.eval('const fixtureV2=[QUIP_MODIFIERS_V2.find(r=>r.id==="v2-one-arm"),QUIP_MODIFIERS_V2.find(r=>r.id==="v2-elbows-close")];const requestV2={modeId:"secret",methodId:"mime",difficulty:"medium",complications:true,memory:taskMemory};let chosenV2=chooseV2PartyModifier(game,requestV2,()=>0,fixtureV2);game.taskHistory=chosenV2.taskHistory');
 assert.ok(h.eval('game.taskHistory.seen.includes("modifier:v2:family:mime-action-once")'));
 assert.equal(h.eval('chooseV2PartyModifier(game,{...requestV2,modeId:"mime"},()=>0,fixtureV2).modifier'),null);
 for(let i=0;i<15;i++){h.eval('chosenV2=chooseV2PartyModifier(game,requestV2,()=>0,fixtureV2);game.taskHistory=chosenV2.taskHistory');assert.ok(h.eval('chosenV2.modifier.id'))}
 h.eval('archiveCurrentTaskHistory();newGame()');assert.ok(h.eval('taskMemory.seen.some(([key])=>key.startsWith("modifier:v2:"))'));
});
test('TASK009 C Secret always receives an applicable modifier across packs, levels and recipients',()=>{
 for(const id of ['general','geography','science'])for(const level of ['easy','medium','hard'])for(const awardTo of ['setter','guesser']){
  const h=match('secret',level,awardTo);h.context.pack=id;h.eval('options.contentPack={id:pack,version:2};options.complications=false;options.modes=["secret"];newGame()');
  for(let i=0;i<12;i++){
   h.eval('game.current=rollOutcome()');const c=plain(h.eval('game.current'));
   assert.ok(c.complication&&c.complicationId);assert.equal(c.modifierVersion,2);assert.equal(c.points,3);
   assert.equal(h.eval('QUIP_MODIFIERS_V2.find(m=>m.id===game.current.complicationId).severity'),level);
   if(awardTo==='setter')assert.notEqual(c.methodId,'yesno');
   h.eval('game.roundIndex++;game.current=null');
  }
 }
});
test('TASK009 C setter Danetki stays truthful without opponent bonus; Secret-only-compatible fallback is explicit',()=>{
 const h=match('yesno','hard','setter');h.eval('roll()');assert.equal(h.eval('game.current.complication'),'');assert.equal(h.eval('game.current.points'),2);
 h.eval('options.modes=["secret","yesno"];newGame()');assert.ok(h.eval('v2SecretMethods(game.contentPack,game,"hard").every(id=>id!=="yesno")'));
 const guesser=match('yesno','hard','guesser');guesser.eval('roll()');assert.equal(guesser.eval('game.current.complicationId'),'v2-no-biography');
 assert.equal(guesser.eval('modeConfigForGame(game,"yesno").rule.includes("не знаю")'),true);
});
test('TASK009 C physical alternatives and strict eligibility are editorial data, without new settings',()=>{
 const rows=read().rows;for(const id of ['v2-fists','v2-below-shoulders','v2-one-arm','v2-elbows-close','v2-no-hands','v2-wrists-still','v2-fixed-feet','v2-front-facing','v2-no-touch','v2-other-hand']){
  const row=rows.find(row=>row.id===id);assert.ok(row.alternative?.text&&row.alternative.criterion);assert.doesNotMatch(row.text,/за спиной|закрытыми глазами|прыгай/);
 }
});
test('TASK009 C legacy V1 snapshots and selected conditions survive update; unknown catalogs protect source bytes',()=>{
 const stored=new Map(),a=createSimulation(1,stored);a.eval('options.dice=false;options.modes=["talk"];newGame();game.modifierSelectionVersion=1;delete game.modifierCatalogVersion;roll();game.dice=true;persist()');const snapshot=a.eval('JSON.stringify(game)'),b=createSimulation(2,stored);assert.equal(b.eval('JSON.stringify(game)'),snapshot);assert.equal(b.eval('game.modifierSelectionVersion'),1);
 const latest=new Map(),c=createSimulation(3,latest);c.eval('options.dice=false;options.modes=["secret"];newGame();roll();game.dice=true;persist()');const before=c.eval('JSON.stringify(game)'),d=createSimulation(4,latest);assert.equal(d.eval('JSON.stringify(game)'),before);
 c.eval('game.modifierCatalogVersion=99;persist()');const raw=latest.get('iskra-party:v1'),blocked=createSimulation(5,latest);assert.equal(blocked.eval('storageBlocked'),true);blocked.eval('persist();newGame()');assert.equal(latest.get('iskra-party:v1'),raw);
});
