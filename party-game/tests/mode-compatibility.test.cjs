'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createSimulation}=require('../scripts/game-simulation.cjs'),plain=x=>JSON.parse(JSON.stringify(x));
function setup(modes=['talk'],awardTo='setter',difficulty='easy',storage=new Map()){
 const h=createSimulation(19,storage);h.context.args={modes,awardTo,difficulty};h.eval('Object.assign(options,args,{dice:false,complications:true,modifierChance:100});newGame()');return h;
}
test('TASK009 G every current mode has frozen declarative recipient compatibility, including independent Approx',()=>{
 const h=setup();assert.deepEqual(Array.from(h.eval('Object.keys(QUIP_MODE_COMPATIBILITY_POLICIES[1].modes)')).sort(),Array.from(h.eval('Object.keys(QUIP_MODES_V4)')).sort());
 for(const awardTo of ['setter','guesser'])for(const id of ['talk','mime','draw','sing','yesno','secret','blitz','approx']){h.context.request={id,awardTo};assert.equal(h.eval('modeAwardAvailability(request.id,{modeCompatibilityVersion:1,awardTo:request.awardTo}).available'),id!=='yesno'||awardTo==='guesser');assert.equal(h.eval('packModeAvailability(options.contentPack,{...options,awardTo:request.awardTo},request.id).available'),id!=='yesno'||awardTo==='guesser')}
 assert.ok(h.eval('Object.isFrozen(QUIP_MODE_COMPATIBILITY_POLICIES[1].modes.yesno)'));assert.equal(h.eval('getModeConfig("approx").supportsSharedAward'),true);
});
test('Secret active mode shows no verbose helper text in selection tile; blocked modes still explain why',()=>{
 const h=setup(['secret'],'setter');const secret=plain(h.eval('packModeAvailability(options.contentPack,options,"secret")'));assert.equal(secret.available,true);assert.equal(secret.reason,'');assert.equal(secret.hint,undefined);
 const blocked=plain(h.eval('packModeAvailability(options.contentPack,options,"yesno")'));assert.equal(blocked.available,false);assert.match(blocked.reason,/отгадывающий/);
 const template=fs.readFileSync(require.resolve('../content/templates/content-packs.after.js'),'utf8');assert.doesNotMatch(template,/Если другие базовые способы не включены/);
});
test('Android Back navigation uses an in-app guard without changing saved-game data',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.match(app,/function installBrowserBackNavigation\(\)/);
 assert.match(app,/addEventListener\('popstate',onBrowserBack\)/);
 assert.match(app,/case 'game':case 'results':backToMenu\(\)/);
 const h=setup(['talk'],'setter');const before=h.eval('JSON.stringify(game)');
 h.eval('installBrowserBackNavigation()');assert.equal(h.eval('JSON.stringify(game)'),before);
});
test('Mode selection cards contain no explanatory paragraphs, including disabled Danetki and Secret',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.doesNotMatch(html,/mode-availability/);
 assert.doesNotMatch(app,/mode-availability/);
 const h=setup(['secret'],'setter');
 const blocked=plain(h.eval('packModeAvailability(options.contentPack,options,"yesno")'));
 assert.equal(blocked.available,false);
 assert.match(blocked.reason,/отгадывающий/);
});
test('TASK009 G recipient changes and settings selection cannot reactivate an incompatible mode or hide an empty choice',()=>{
 const h=setup(['yesno'],'guesser');const game=h.eval('JSON.stringify(game)');h.eval('selectAwardTo("setter");renderOptions();persist()');assert.deepEqual(plain(h.eval('options.modes')),[]);assert.equal(h.eval('JSON.stringify(game)'),game);assert.equal(h.elements.get('start-game').disabled,true);assert.match(h.elements.get('setup-mode-notice').textContent,/Выберите/);
 assert.equal(h.eval('selectSetupMode("yesno",true)'),false);h.eval('newGame()');assert.equal(h.eval('JSON.stringify(game)'),game);
 const again=createSimulation(20,h.storage);assert.deepEqual(plain(again.eval('options.modes')),[]);again.eval('selectAwardTo("guesser");renderOptions()');assert.equal(again.eval('packModeAvailability(options.contentPack,options,"yesno").available'),true);assert.deepEqual(plain(again.eval('options.modes')),[]);assert.equal(again.eval('selectSetupMode("yesno",true)'),true);again.eval('newGame()');assert.equal(again.eval('game.modeCompatibilityVersion'),1);
 assert.equal(again.eval('selectSetupMode("yesno",false)'),false);assert.deepEqual(plain(again.eval('options.modes')),['yesno']);
});
test('TASK009 G changing recipient keeps all other modes and settings, with no automatic restoration',()=>{
 const h=setup(['draw','yesno','approx'],'guesser','hard');const before=plain(h.eval('options'));h.eval('selectAwardTo("setter")');const after=plain(h.eval('options'));assert.deepEqual(after,{...before,awardTo:'setter',modes:['draw','approx']});h.eval('selectAwardTo("guesser")');assert.deepEqual(plain(h.eval('options.modes')),['draw','approx']);
});
test('TASK009 G presets exclude incompatible modes without changing historical declarations or filling empty selections',()=>{
 const h=setup(),old=h.eval('JSON.stringify(QUIP_PARTY_PRESETS)');for(const id of ['classic-duel','hardcore'])for(const version of [1,2,3])for(const awardTo of ['setter','guesser']){h.context.p={id,version,awardTo};h.eval('options=optionsForPartyPreset(p.id,p.version,{awardTo:p.awardTo,dice:false});newGame()');assert.equal(h.eval('game.modes.includes("yesno")'),awardTo==='guesser');assert.equal(h.eval('game.modeCompatibilityVersion'),1)}assert.equal(h.eval('JSON.stringify(QUIP_PARTY_PRESETS)'),old);
 h.eval('options=optionsForPartyPreset("classic-duel",3,{awardTo:"setter",modes:["yesno"]})');assert.deepEqual(plain(h.eval('options.modes')),[]);const match=h.eval('JSON.stringify(game)');h.eval('newGame()');assert.equal(h.eval('JSON.stringify(game)'),match);
});
test('TASK009 G direct newGame bypass is rejected before touching game, memory or saved bytes',()=>{
 const h=setup();h.eval('game.dice=true;persist()');const before=h.storage.get('iskra-party:v1'),snapshot=h.eval('JSON.stringify(game)'),memory=h.eval('JSON.stringify(taskMemory)');h.eval('options.modes=["yesno"];delete options.modeCompatibilityVersion;newGame()');assert.equal(h.eval('JSON.stringify(game)'),snapshot);assert.equal(h.eval('JSON.stringify(taskMemory)'),memory);assert.equal(h.storage.get('iskra-party:v1'),before);
});
test('TASK009 G guesser Danetki use the three unchanged exact-tier V2 conditions in production rounds',()=>{
 const ids=['v2-question-budget','v2-no-names-search','v2-no-biography'];for(const [i,level]of ['easy','medium','hard'].entries()){
  const h=setup(['yesno'],'guesser',level);h.eval('roll()');assert.equal(h.eval('game.current.complicationId'),ids[i]);assert.match(h.eval('getModeConfig("yesno").rule'),/да.*нет.*не знаю/);assert.equal(h.eval('game.current.basePoints'),2);
 }
});
test('TASK009 G Secret uses only explicitly enabled base methods, and guesser may explicitly choose Danetki',()=>{
 for(const awardTo of ['setter','guesser'])for(const level of ['easy','medium','hard']){
  const h=setup(['talk','mime','secret'],awardTo,level);assert.deepEqual(plain(h.eval('v2SecretMethods(game.contentPack,game,game.difficulty)')),['talk','mime']);
  for(const roll of [0,.99999]){h.context.rollValue=roll;h.eval('pickMode=()=>getMode("secret");Math.random=()=>rollValue;game.current=rollOutcome()');assert.ok(['talk','mime'].includes(h.eval('game.current.methodId')));assert.ok(h.eval('game.current.complicationId'))}
 }
 for(const level of ['easy','medium','hard']){const h=setup(['yesno','secret'],'guesser',level);h.eval('pickMode=()=>getMode("secret");roll()');assert.equal(h.eval('game.current.methodId'),'yesno');assert.ok(h.eval('game.current.complicationId'));assert.equal(h.eval('game.current.points'),3)}
});
test('TASK009 G solo Secret has a declared source filtered by recipient, topic, tier and mandatory conditions',()=>{
 for(const awardTo of ['setter','guesser'])for(const id of ['general','geography','science']){
  const h=setup(['secret'],awardTo,'mixed');h.context.id=id;h.eval('options.contentPack=latestContentPackSelection(id);newGame()');for(const level of ['easy','medium','hard']){h.context.level=level;const methods=plain(h.eval('v2SecretMethods(game.contentPack,game,level)'));assert.ok(methods.length);assert.ok(methods.every(m=>['talk','mime','draw','sing','yesno'].includes(m)));if(awardTo==='setter')assert.ok(!methods.includes('yesno'));if(id!=='general')assert.ok(!methods.includes('sing'))}h.eval('roll()');assert.ok(h.eval('game.current.complicationId'));
 }
});
test('TASK009 G missing Secret modifiers or cards block before start without expanding the chosen source',()=>{
 for(const missing of ['modifiers','cards']){const h=setup(['talk']);const before=h.eval('JSON.stringify(game)');h.eval('options.modes=["talk","secret"];options.difficulty="hard"');if(missing==='modifiers')h.eval('getV2ModifierPool=()=>[]');else h.eval('getPackCardPool=()=>[]');assert.equal(h.eval('checkContentPack(options.contentPack,options).available'),false);assert.equal(h.eval('packModeAvailability(options.contentPack,options,"secret").available'),false);assert.throws(()=>h.eval('v2SecretMethods(options.contentPack,options,"hard")'),/Секретки/);h.eval('newGame()');assert.equal(h.eval('JSON.stringify(game)'),before)}
});
test('TASK009 G empty settings survive theme transitions without silently enabling modes',()=>{
 const h=setup(['yesno'],'guesser');h.eval('selectAwardTo("setter");options=packSetupSettings(latestContentPackSelection("science"),options)');assert.deepEqual(plain(h.eval('options.modes')),[]);assert.equal(h.eval('listThematicPacks(options).find(x=>x.pack.id==="science").available'),true);h.eval('options=packSetupSettings(latestContentPackSelection("general"),options);persist()');assert.deepEqual(plain(createSimulation(20,h.storage).eval('options.modes')),[]);
});
test('TASK009 G historical setter Danetki and saved Secret methods restore unchanged and keep historical selection',()=>{
 for(const secret of [false,true]){const store=new Map(),h=setup(['yesno',...(secret?['secret']:[])],'guesser','hard',store);if(secret)h.eval('pickMode=()=>getMode("secret")');h.eval('roll();delete game.modeCompatibilityVersion;game.awardTo="setter";game.dice=true;game.phase="judge";persist()');const before=h.eval('JSON.stringify(game)'),again=createSimulation(21,store);assert.equal(again.eval('JSON.stringify(game)'),before);again.eval('Math.random=()=>{throw Error("restore/render must not select")};render()');assert.equal(again.eval('JSON.stringify(game)'),before);assert.equal(again.eval('game.current.methodId'),'yesno');assert.equal(again.eval('storageBlocked'),false);again.eval('Math.random=()=>0;game.current=null;game.phase="ready";game.modes=["yesno"];roll()');assert.equal(again.eval('game.current.modeId'),'yesno')}
});
test('TASK009 G unknown compatibility versions preserve original storage, both in options and in matches',()=>{
 for(const field of ['game','options'])for(const version of [99,'1',0]){const h=setup();h.context.field=field;h.context.version=version;h.eval('game.dice=true;({game,options})[field].modeCompatibilityVersion=version;persist()');const raw=h.storage.get('iskra-party:v1'),again=createSimulation(23,h.storage);assert.equal(again.eval('storageBlocked'),true);again.eval('persist();newGame()');assert.equal(h.storage.get('iskra-party:v1'),raw)}
});
test('TASK009 G ordinary rewards/timers and all four manual Approx outcomes stay independent of compatibility',()=>{
 for(const awardTo of ['setter','guesser']){
  for(const id of ['talk','mime','draw','sing','blitz']){const h=setup([id],awardTo);h.eval('options.complications=false;newGame();roll()');assert.equal(h.eval('game.current.basePoints'),id==='blitz'?2:1);assert.equal(h.eval('game.current.seconds'),h.eval('options.duration+getModeConfig(game.current.modeId).durationBonus'))}
  for(const action of ['a','b','both','none']){const h=setup(['approx'],awardTo);h.context.action=action;h.eval('roll();revealApprox();awardApprox(action)');assert.deepEqual(plain(h.eval('game.scores')),action==='a'?[1,0]:action==='b'?[0,1]:action==='both'?[1,1]:[0,0])}
 }
});
test('TASK009 G new compatibility script and changed scripts are versioned consistently for offline boot',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),worker=fs.readFileSync(require.resolve('../sw.js'),'utf8');for(const file of ['mode-compatibility.js','modifiers-v2.js','presets.js','content-packs.js','app.js']){const url=html.match(new RegExp(file.replace('.','\\.')+'\\?v=\\d+'))[0];assert.ok(worker.includes(url))}assert.match(worker,/kvip-pwa-v49-/);
});
