'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function harness(existing=new Map(),randomizeStarter=false,fixturePack=null) {
  const pending=[];
  const elements=new Map();
  const element = id => {
    if(!elements.has(id)) {
      const node={id,value:id==='team-a'?'Молнии':id==='team-b'?'Кометы':'',
        hidden:false,style:{setProperty(){}},textContent:'',innerHTML:'',dataset:{},
        classList:{add(){},remove(){},toggle(){}},parentElement:{classList:{add(){},remove(){},toggle(){}}},children:[],
        addEventListener(){},setAttribute(){},getAttribute(){return null}};
      elements.set(id,node);
    }
    return elements.get(id);
  };
  const document={
    getElementById:element,querySelectorAll(){return []},
    body:{dataset:{}},
    addEventListener(){},hidden:false
  };
  const context=vm.createContext({
    crypto:require('node:crypto').webcrypto,document,window:{confirm:()=>true},navigator:{vibrate(){}},
    localStorage:{getItem:key=>existing.has(key)?existing.get(key):null,setItem:(key,val)=>existing.set(key,val)},
    setInterval:()=>7,clearInterval(){},
    setTimeout:fn=>{pending.push(fn);return pending.length},
    clearTimeout(){},
    Math:Object.create(Math),Date,console
  });
  vm.runInContext(read('words.js'),context);
  vm.runInContext(read('extra-words.js'),context);
  vm.runInContext(read('curated-words.js'),context);
  vm.runInContext(read('curated-songs.js'),context);
  vm.runInContext(read('curated-people.js'),context);
  vm.runInContext(read('mode-images.js'),context);
  vm.runInContext(read('cards.js'),context);
  vm.runInContext(read('mode-config.js'),context);
  vm.runInContext(read('mode-compatibility.js'),context);
  vm.runInContext(read('approx-questions.js'),context);
  vm.runInContext(read('rules.js'),context);
  vm.runInContext(read('penalties.js'),context);
  vm.runInContext(read('modifiers.js'),context);
  vm.runInContext(read('round-planner.js'),context);
  vm.runInContext(read('task-history.js'),context);
  vm.runInContext(read('modifiers-v2.js'),context);
  const packSource=fixturePack?read('content-packs.js').replace('const QUIP_CONTENT_PACKS=defineContentPacks([','const QUIP_CONTENT_PACKS=defineContentPacks(['+JSON.stringify(fixturePack)+','):read('content-packs.js');
  vm.runInContext(packSource,context);
  vm.runInContext(read('presets.js'),context);
  vm.runInContext(read('rules-guide.js'),context);
   vm.runInContext(read('menu-navigation.js'),context);
   vm.runInContext(read('setup-view.js'),context);
   vm.runInContext(read('setup-controls.js'),context);
   vm.runInContext(read('audio.js'),context);
   vm.runInContext(read('round-views.js'),context);
   vm.runInContext(read('match-views.js'),context);
   vm.runInContext(read('timer-view.js'),context);
   vm.runInContext(read('round-selection.js'),context);
   vm.runInContext(read('tiebreak.js'),context);
   vm.runInContext(read('round-settlement.js'),context);
   vm.runInContext(read('timer-controller.js'),context);
   vm.runInContext(read('round-presentation.js'),context);
   vm.runInContext(read('round-actions.js'),context);
   vm.runInContext(read('storage-controller.js'),context);
   vm.runInContext(read('session-restoration.js'),context);
   vm.runInContext(read('player-profiles.js'),context);
   vm.runInContext(read('profile-views.js'),context);
   vm.runInContext(read('profile-backup.js'),context);
   vm.runInContext(read('profile-backup-view.js'),context);
   vm.runInContext(read('card-reports.js'),context);
   vm.runInContext(read('card-reports-view.js'),context);
   vm.runInContext(read('card-feedback.js'),context);
   vm.runInContext(read('feedback-clock.js'),context);
   vm.runInContext(read('card-feedback-view.js'),context);
   vm.runInContext(read('app.js'),context);
   vm.runInContext(`if(!profileStore&&!profileStoreProblem&&loadedSaveRaw===null){createPlayerProfile('Молнии','coral');createPlayerProfile('Кометы','cyan');}
    if(profileStore&&!selectedPlayerProfiles())selectedProfileIds=profileStore.profiles.slice(0,2).map(p=>p.id);`,context);
  // Existing regression fixtures explicitly retain V3 rules and five-word Blitz.
  // New V4 scenarios below call the production newGame() directly.
  vm.runInContext(`function startHistoricalFixture(){const awardTo=options.awardTo;options.awardTo='guesser';newGame();options.awardTo=awardTo;if(game){delete game.profileMatch;delete game.matchId;game.awardTo=awardTo;delete game.modeCompatibilityVersion;delete game.modePlannerVersion;delete game.modePlannerState;delete game.songLanguagePolicyVersion;delete game.songLanguages;delete game.timerPolicyVersion;}}
  function legacyGame(version=3){
    options.modes=options.modes.filter(id=>id!=='approx');
    if(options.contentPack?.id==='general')options.contentPack={id:'general',version:1};
    startHistoricalFixture();if(game&&game.phase==='ready'&&game.roundIndex===0){
      game.rulesVersion=version;game.contentPack={id:'general',version:1};delete game.taskHistoryVersion;delete game.taskHistory;delete game.modeConfigVersion;delete game.awardTo;delete game.awardPolicyVersion;delete game.modifierCatalogVersion;delete game.modifierSelectionVersion;delete game.modifierChance;delete game.modifierRecent;game.blitzCount=5;game.modes=game.modes.filter(id=>id!=='approx');persist();
    }
  }`,context);
  vm.runInContext("function v4Game(){startHistoricalFixture();game.rulesVersion=4;delete game.taskHistoryVersion;delete game.taskHistory;delete game.modifierCatalogVersion;delete game.modifierSelectionVersion;delete game.modifierChance;delete game.modifierRecent;persist()}",context);
  // Scoring fixtures choose a fixed starting player; dedicated tests exercise both draws.
  if(!randomizeStarter)vm.runInContext('chooseStartingTeam=()=>0',context);
  return {context,elements,pending,storage:existing,eval:expr=>vm.runInContext(expr,context)};
}
test('round views keep V1-V5 snapshots without RNG, writes or reward recalculation',()=>{
 for(const version of [1,2,3,4,5]){
  const h=harness();
  h.eval('soundOn=false;options.modes=["talk"];options.dice=false;Math.random=()=>0;'+
   (version<4?'legacyGame('+version+')':'newGame();game.rulesVersion='+version)+';'+
   (version===1?'delete game.scoringVersion;':''));
  const check=view=>{
   const before=h.eval('JSON.stringify([game,options,taskMemory])'),raw=h.storage.get('iskra-party:v1');
   h.eval('var viewOriginals=[Math.random,persist,rewardForRound,localStorage.setItem];'+
    'Math.random=persist=rewardForRound=localStorage.setItem=()=>{throw Error("Side effect while rendering")};'+
    view+'();[Math.random,persist,rewardForRound,localStorage.setItem]=viewOriginals');
   assert.equal(h.eval('JSON.stringify([game,options,taskMemory])'),before,view+' V'+version);
   assert.equal(h.storage.get('iskra-party:v1'),raw,view+' persisted V'+version);
  };
  check('showReady');
  // A saved reward may differ from the current table; views must trust its snapshot.
  h.eval('game.current=rollOutcome();game.phase="task";game.current.points=37;'+
   'game.current.basePoints=31;game.current.modifierPoints=6;game.current.complication="Сохранённое условие";persist()');
  check('showTask');assert.match(h.elements.get('play-content').innerHTML,/ЗА ВЕРНЫЙ ОТВЕТ: \+37/);
  h.eval('game.phase="judge";persist()');check('showJudge');
  assert.match(h.elements.get('play-content').innerHTML,version===5?/Основа \+31 · усложнение \+6/:/Награда: \+37/);
 }
});
test('match views preserve V1-V5 and shared-award state without RNG or storage writes',()=>{
 for(const version of [1,2,3,4,5,'approx']){
  const h=harness(),approx=version==='approx';
  h.eval('soundOn=false;options.modes=["'+(approx?'approx':'talk')+'"];options.dice=false;'+
   'options.complications=false;options.riskRounds=false;Math.random=()=>0;'+
   (approx||version===5?'newGame()':version===4?'v4Game()':'legacyGame('+version+')')+';'+
   (version===1?'delete game.scoringVersion;':'')+'roll();persist()');
  const check=source=>{
   const before=h.eval('JSON.stringify([game,options,taskMemory])'),raw=h.storage.get('iskra-party:v1');
   h.eval('var matchViewOriginals=[Math.random,persist,rewardForRound,localStorage.setItem];'+
    'Math.random=persist=rewardForRound=localStorage.setItem=()=>{throw Error("Side effect in match view")};'+
    'try{'+source+'}finally{[Math.random,persist,rewardForRound,localStorage.setItem]=matchViewOriginals}');
   assert.equal(h.eval('JSON.stringify([game,options,taskMemory])'),before,source+' '+version);
   assert.equal(h.storage.get('iskra-party:v1'),raw,source+' persisted '+version);
  };
  check('renderMatch();');
  if(approx)for(const id of ['a','b'])assert.equal(h.elements.get('role-'+id).textContent,'НАЗЫВАЕТ ЧИСЛО');
  h.eval(approx?'revealApprox();awardApprox("both")':'game.phase="judge";judge(true)');
  check('renderMatch();showBetween();game.history.map(historyMarkup);showResults();');
  assert.equal(h.eval('document.body.dataset.screen'),'results');
  if(approx)assert.match(h.elements.get('results-content').innerHTML,/Обе команды.*\+1 \/ \+1/);
 }
});
test('timer views preserve restored V1-V5 clocks without RNG, writes or new intervals',()=>{
 for(const version of [1,2,3,4,5])for(const mode of ['talk','blitz']){
  const stored=new Map(),a=harness(stored);
  a.eval('soundOn=false;options.modes=["'+mode+'"];options.dice=false;options.difficulty="easy";Math.random=()=>0;'+
   (version===5?'newGame()':version===4?'v4Game()':'legacyGame('+version+')')+';'+
   (version===1?'delete game.scoringVersion;':'')+'roll();toggleWord();startTimer();pauseTimer();'+
   'game.current.remainingMs=65000;game.dice=true;persist()');
  const saved=a.eval('JSON.stringify(game)'),raw=stored.get('iskra-party:v1'),h=harness(stored);
  assert.equal(h.eval('JSON.stringify(game)'),saved,'Restored V'+version+' '+mode);
  assert.equal(stored.get('iskra-party:v1'),raw,'Restore must preserve saved bytes');
  const check=source=>{
   const before=h.eval('JSON.stringify([game,options,taskMemory,intervalId,lastChimeAt])'),bytes=stored.get('iskra-party:v1');
   h.eval('var timerViewOriginals=[Math.random,persist,rewardForRound,settleQuipRound,setInterval,localStorage.setItem];'+
    'Math.random=persist=rewardForRound=settleQuipRound=setInterval=localStorage.setItem=()=>{throw Error("Side effect in timer view")};'+
    'try{'+source+'}finally{[Math.random,persist,rewardForRound,settleQuipRound,setInterval,localStorage.setItem]=timerViewOriginals}');
   assert.equal(h.eval('JSON.stringify([game,options,taskMemory,intervalId,lastChimeAt])'),before,source+' V'+version+' '+mode);
   assert.equal(stored.get('iskra-party:v1'),bytes,source+' saved bytes');
  };
  check('showTimer();updateTimerVisual(5000);');assert.equal(h.elements.get('active-timer').innerHTML,'0:05');
  check('updateTimerVisual(65000);');assert.equal(h.elements.get('active-timer').innerHTML,'1:05');
  h.eval('resumeTimer()');check('showTimer();');
  h.eval('game.current.deadline=Date.now()-1;persist()');check('showTimer();');
  assert.equal(h.elements.get('active-timer').innerHTML,'0:00');
  for(const offset of [60000,-1]){
   h.eval('game.phase="countdown";game.current.deadline=null;game.current.autoStartAt=Date.now()+'+offset+';persist()');
   check('showCountdown();');
  }
 }
});
test('round settlement archives before saving and preserves timer, sound and render order without RNG',()=>{
 for(const mode of ['talk','approx'])for(const success of [false,true]){
  const h=harness();
  h.eval(`soundOn=false;options.modes=['${mode}'];options.dice=false;options.finishType='rounds';options.rounds=2;newGame();roll();
   if(roundInteraction()==='estimate'){revealApprox();awardApprox('none')}else{game.phase='judge';judge(false)}
   roll();if(roundInteraction()==='estimate')revealApprox();else game.phase='judge';`);
  h.eval(`globalThis.effects=[];
   for(const name of ['archiveCurrentTaskHistory','stopTicking','persist','sfx','render']){
    const original=globalThis[name];globalThis[name]=function(...args){
     effects.push(name==='sfx'?'sfx:'+args[0]:name);return Reflect.apply(original,this,args);
    };
   }
   const write=localStorage.setItem;localStorage.setItem=function(...args){
    if(args[0]==='iskra-party:v1'){
     if(game.phase!=='results'||game.current!==null||game.roundIndex!==2)throw Error('Incomplete settlement at save');
     effects.push('write');
    }
    return Reflect.apply(write,this,args);
   };
   Math.random=()=>{throw Error('Settlement consumed RNG')};`);
  const action=mode==='approx'?`awardApprox('${success?'both':'none'}')`:`judge(${success})`;
  h.eval(action);
  assert.deepEqual(Array.from(h.eval('effects')),['archiveCurrentTaskHistory','stopTicking','persist','write','sfx:'+(success?'win':'fail'),'render','stopTicking']);
  const raw=h.storage.get('iskra-party:v1');
  assert.equal(raw,h.eval('JSON.stringify({version:1,options,soundOn,game,...(taskMemory?{taskMemory}:{})})'));
  h.eval('effects.length=0;'+action);
  assert.deepEqual(Array.from(h.eval('effects')),[]);
  assert.equal(h.storage.get('iskra-party:v1'),raw);
 }
});
test('late countdown callbacks preserve the planned deadline, one interval and one timeout',()=>{
 for(const level of ['medium','hard']){
  const h=harness(),active=new Map(),sounds=[];let clock=1792756800000,nextId=0,timeoutWrites=0;
  h.context.Date=class extends Date{static now(){return clock}};
  h.context.setInterval=(fn,delay)=>{assert.equal(delay,100);active.set(++nextId,fn);return nextId};
  h.context.clearInterval=id=>active.delete(id);
  h.eval(`soundOn=false;options.modes=['talk'];options.dice=false;options.difficulty='${level}';newGame();roll();toggleWord()`);
  const planned=h.eval('game.current.autoStartAt'),seconds=h.eval('game.current.seconds');
  const sound=h.context.sfx,write=h.context.localStorage.setItem;
  h.context.sfx=function(kind){sounds.push(kind);return Reflect.apply(sound,this,arguments)};
  h.context.localStorage.setItem=function(key,value){
   if(key==='iskra-party:v1'&&JSON.parse(value).game?.phase==='judge')timeoutWrites++;
   return Reflect.apply(write,this,arguments);
  };
  h.eval("soundOn=true;Math.random=()=>{throw Error('Timer consumed RNG')}");
  const fire=()=>{assert.equal(active.size,1);Array.from(active.values())[0]()};
  clock=planned+3000;fire();
  const deadline=planned+seconds*1000;
  assert.equal(h.eval('game.current.deadline'),deadline);
  assert.equal(h.eval('game.current.autoStartAt'),null);assert.equal(h.eval('game.phase'),'play');
  clock=deadline-10000;fire();fire();h.eval('render();continueGame()');
  clock=deadline-3000;fire();fire();
  assert.deepEqual(sounds,['go','tick','last']);
  const stale=Array.from(active.values())[0];clock=deadline;fire();
  const stored=h.storage.get('iskra-party:v1'),state=h.eval('JSON.stringify(game)');
  stale();h.eval('tick();render();continueGame();finishTimer("timeout")');
  assert.equal(h.eval('JSON.stringify(game)'),state);assert.equal(h.storage.get('iskra-party:v1'),stored);
  assert.equal(h.eval('game.current.finishedReason'),'timeout');assert.equal(h.eval('game.roundIndex'),0);
  assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);assert.equal(active.size,0);
  assert.equal(timeoutWrites,1);assert.deepEqual(sounds,['go','tick','last','time']);
 }
});
test('repeated reel rendering preserves saved state and ignores stale animation callbacks',()=>{
 for(const reduced of [false,true]){
  const h=harness(),frames=[],ends=[];let landed=0;
  h.context.requestAnimationFrame=fn=>frames.push(fn);
  h.context.window.matchMedia=()=>({matches:reduced});
  const track=h.context.document.getElementById('reel-track');
  track.children=Array.from({length:100},(_,i)=>({offsetLeft:i*160,offsetWidth:160}));
  track.addEventListener=(type,fn)=>{assert.equal(type,'transitionend');ends.push(fn)};
  track.querySelector=()=>({classList:{add:name=>{assert.equal(name,'reel-item--landed');landed++}}});
  h.context.document.getElementById('reel-window').clientWidth=390;
  h.eval('soundOn=false;options.modes=["talk","draw","secret"];options.dice=true;newGame();roll()');
  const before=h.eval('JSON.stringify([game,options,taskMemory])'),raw=h.storage.get('iskra-party:v1');
  const originals=[h.context.Math.random,h.context.localStorage.setItem];
  const forbidden=()=>{throw Error('Reel rendering consumed RNG or wrote storage')};
  h.context.Math.random=h.context.localStorage.setItem=forbidden;
  h.eval('render();render()');
  assert.equal(h.eval('JSON.stringify([game,options,taskMemory])'),before);
  assert.equal(h.storage.get('iskra-party:v1'),raw);
  assert.equal(frames.length,3,'Each render schedules the first of two frames');
  frames.shift()();
  assert.equal(track.style.transition,'none','First frame must not start animation');
  frames.pop()();
  assert.equal(track.style.transition,'transform '+(reduced?1:2850)+'ms cubic-bezier(.08,.72,.12,1)');
  ends[0]({propertyName:'opacity'});
  assert.equal(landed,reduced?1:0,'Unrelated transition must not mark a winner');
  ends[0]({propertyName:'transform'});
  assert.equal(landed,reduced?2:1);
  [h.context.Math.random,h.context.localStorage.setItem]=originals;
  const staleFrames=frames.splice(0),staleEnds=ends.splice(0),staleTimeout=h.pending.shift();
  h.eval('backToMenu();newGame();roll()');
  const next=h.eval('JSON.stringify([game,options,taskMemory])'),nextRaw=h.storage.get('iskra-party:v1');
  const transition=track.style.transition,transform=track.style.transform,marks=landed;
  h.context.Math.random=h.context.localStorage.setItem=forbidden;
  // Complete the second frame from the previous round while a new reel is live.
  for(const fn of staleFrames){fn();frames.pop()()}
  for(const fn of staleEnds)fn({propertyName:'transform'});
  staleTimeout();
  assert.equal(track.style.transition,transition);assert.equal(track.style.transform,transform);
  assert.equal(landed,marks,'Old round must not highlight the new winner');
  assert.equal(h.eval('JSON.stringify([game,options,taskMemory])'),next);
  assert.equal(h.storage.get('iskra-party:v1'),nextRaw);
 }
});
test('last Blitz answer checks the exact deadline before changing its queue or completing twice',()=>{
 for(const version of [1,2,3,4,5])for(const offset of [-1,0,1])for(const correct of [false,true]){
  const h=harness();let clock=1792756800000;
  h.context.Date=class extends Date{static now(){return clock}};
  h.eval('soundOn=false;options.modes=["blitz"];options.difficulty="easy";options.dice=false;'+
   (version===5?'newGame()':version===4?'v4Game()':'legacyGame('+version+')')+';'+
   (version===1?'delete game.scoringVersion;':'')+'roll();toggleWord();startTimer();'+
   'while(game.current.blitzQueue.length>1)advanceBlitz(true)');
  const before=JSON.parse(h.eval('JSON.stringify(game.current)'));
  h.eval(`globalThis.boundaryEffects=[];
   for(const name of ['finishTimer','stopTicking','persist','sfx','render','showTimer']){
    const original=globalThis[name];globalThis[name]=function(...args){
     boundaryEffects.push(name+(['finishTimer','sfx'].includes(name)?':'+args[0]:''));
     return Reflect.apply(original,this,args);
    };
   }
   const write=localStorage.setItem;localStorage.setItem=function(...args){
    boundaryEffects.push('write');return Reflect.apply(write,this,args);
   };
   Math.random=()=>{throw Error('Blitz action consumed RNG')};`);
  clock=before.deadline+offset;h.eval('advanceBlitz('+correct+')');
  const after=JSON.parse(h.eval('JSON.stringify(game.current)'));
  const reason=offset>=0?'timeout':correct?'completed':null;
  assert.equal(h.eval('game.phase'),reason?'judge':'play');
  assert.equal(after.blitzIndex,before.blitzIndex+(offset<0?1:0));
  assert.equal(after.blitzCorrect,before.blitzCorrect+(offset<0&&correct?1:0));
  assert.deepEqual(after.blitzQueue,reason==='completed'?[]:before.blitzQueue);
  assert.equal(after.word,before.word);assert.equal(after.deadline,reason?null:before.deadline);
  assert.equal(after.finishedReason,reason||before.finishedReason);
  assert.equal(h.eval('game.roundIndex'),0);assert.equal(h.eval('game.history.length'),0);
  assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);
  const expected=reason?['finishTimer:'+reason,'stopTicking','persist','write',
   ...(reason==='timeout'?['sfx:time']:[]),'render','stopTicking']:['persist','write','sfx:button','showTimer'];
  assert.deepEqual(Array.from(h.eval('boundaryEffects')),expected);
  if(reason){
   const state=h.eval('JSON.stringify([game,options,taskMemory])'),raw=h.storage.get('iskra-party:v1');
   h.eval('boundaryEffects.length=0;advanceBlitz(true);advanceBlitz(false);tick()');
   assert.deepEqual(Array.from(h.eval('boundaryEffects')),[]);
   assert.equal(h.eval('JSON.stringify([game,options,taskMemory])'),state);
   assert.equal(h.storage.get('iskra-party:v1'),raw);
  }
 }
});
test('storage failures preserve the write barrier and verify backup before any reset',()=>{
 const key='iskra-party:v1',recovery='iskra-party:recovery:v1',raw=' {"version":1,"options":',changed='another-tab-save';
 const sequence=['get:save','set:backup','get:backup','get:save','set:save','get:save'];
 for(const [fault,until]of [['first-read',1],['changed-before',1],['backup-throw',2],['backup-drop',3],
  ['backup-mismatch',3],['backup-read',3],['changed-after-backup',4],['second-read',4],
  ['reset-throw',5],['reset-drop',6],['reset-read',6]]){
  const h=harness(),events=[];let reads=0,confirmed=0;
  h.storage.set(key,raw);h.eval('readSaved()');
  h.context.Date=class extends Date{static now(){return 1792756800000}};
  h.context.window.confirm=()=>{confirmed++;return true};
  h.context.toast=()=>events.push('toast');
  h.context.Math.random=()=>{throw Error('Storage operation consumed RNG')};
  const state=h.eval('JSON.stringify([game,options,soundOn,taskMemory])');
  const reset=h.eval('JSON.stringify({version:1,options,soundOn,game:null,...(taskMemory?{taskMemory}:{})})');
  if(fault==='changed-before')h.storage.set(key,changed);
  h.context.localStorage.getItem=name=>{
   events.push('get:'+(name===key?'save':'backup'));
   if(name===key){reads++;if((fault==='first-read'&&reads===1)||(fault==='second-read'&&reads===2)||(fault==='reset-read'&&reads===3))throw Error(fault)}
   if(name===recovery&&fault==='backup-read')throw Error(fault);
   if(name===recovery&&fault==='backup-mismatch')return 'unverified';
   return h.storage.has(name)?h.storage.get(name):null;
  };
  h.context.localStorage.setItem=(name,value)=>{
   events.push('set:'+(name===key?'save':'backup'));
   if((name===recovery&&fault==='backup-throw')||(name===key&&fault==='reset-throw'))throw Error(fault);
   if((name===recovery&&fault==='backup-drop')||(name===key&&fault==='reset-drop'))return;
   h.storage.set(name,value);
   if(name===recovery&&fault==='changed-after-backup')h.storage.set(key,changed);
  };
  assert.equal(h.eval('recoverCorruptSave()'),false,fault);assert.equal(confirmed,1);
  assert.deepEqual(events,[...sequence.slice(0,until),'toast'],fault+' I/O order');
  assert.equal(h.eval('storageBlocked'),true);assert.equal(h.eval('storageProblem'),'corrupt');
  assert.equal(h.eval('loadedSaveRaw'),raw);assert.equal(h.eval('JSON.stringify([game,options,soundOn,taskMemory])'),state);
  assert.equal(h.storage.get(key),fault==='reset-read'?reset:fault.startsWith('changed-')?changed:raw,fault);
  if(h.storage.has(recovery))assert.equal(h.storage.get(recovery),JSON.stringify({version:1,createdAt:1792756800000,raw}));
  const snapshot=Array.from(h.storage);events.length=0;h.eval('persist()');
  assert.deepEqual(events,[]);assert.deepEqual(Array.from(h.storage),snapshot);
 }
 const inaccessible=harness();let writes=0;
 inaccessible.context.localStorage.getItem=()=>{throw Error('read denied')};
 inaccessible.context.localStorage.setItem=()=>{writes++;throw Error('write denied')};
 assert.equal(inaccessible.eval('readSaved()'),null);assert.equal(inaccessible.eval('storageProblem'),'unavailable');
 assert.equal(inaccessible.eval('storageBlocked'),true);inaccessible.eval('persist()');assert.equal(writes,0);
 const unwritable=harness(),before=unwritable.eval('JSON.stringify([game,options,taskMemory,storageBlocked,storageProblem,loadedSaveRaw])');
 unwritable.context.localStorage.setItem=()=>{throw Error('quota exceeded')};
 assert.doesNotThrow(()=>unwritable.eval('persist()'));
 assert.equal(unwritable.eval('JSON.stringify([game,options,taskMemory,storageBlocked,storageProblem,loadedSaveRaw])'),before);
});
test('restoring expired countdowns uses the saved start and preserves RAW at both clock boundaries',()=>{
 const NativeDate=Date,random=Math.random;let now=1792756800000;
 global.Date=class extends NativeDate{static now(){return now}};
 try{
  for(const version of [1,2,3,4,5])for(const mode of ['talk','blitz'])for(const level of ['medium','hard']){
   now=1792756800000;
   const stored=new Map(),first=harness(stored);
   first.eval(`soundOn=false;options.modes=['${mode}'];options.difficulty='${level}';options.dice=false;`+
    (version===5?'newGame()':version===4?'v4Game()':'legacyGame('+version+')')+';'+
    (version===1?'delete game.scoringVersion;':'')+'roll();toggleWord();game.dice=true;options.dice=true;persist()');
   const raw=stored.get('iskra-party:v1'),saved=JSON.parse(raw),start=saved.game.current.autoStartAt;
   const deadline=start+saved.game.current.seconds*1000;
   assert.equal(saved.game.phase,'countdown');
   for(const time of [start-1,start,start+1,deadline-1,deadline,deadline+1]){
    now=time;let writes=0;
    const copy=new Map(stored);copy.set=()=>{writes++;throw Error('Restore must not write')};
    Math.random=()=>{throw Error('Restore must not consume RNG')};
    let restored;try{restored=harness(copy)}finally{Math.random=random}
    const expected=JSON.parse(JSON.stringify(saved.game));
    if(time>=start){expected.phase='play';expected.current.autoStartAt=null;expected.current.deadline=deadline}
    if(time>=deadline){expected.phase='judge';expected.current.deadline=null;expected.current.finishedReason='timeout'}
    const label=`V${version} ${mode} ${level} at ${time-start}`;
    assert.equal(restored.eval('JSON.stringify(game)'),JSON.stringify(expected),label);
    assert.equal(copy.get('iskra-party:v1'),raw,label+' RAW');assert.equal(writes,0,label+' writes');
    assert.equal(restored.eval('storageBlocked'),false,label+' protection');
    assert.equal(restored.eval('intervalId'),null,label+' interval');assert.equal(restored.pending.length,0,label+' timeout');
   }
  }
 }finally{global.Date=NativeDate;Math.random=random}
});
test('Continue protects malformed between saves and preserves completed V1-V5 rounds',()=>{
 const key='iskra-party:v1',backupKey='iskra-party:recovery:v1';
 const load=saved=>{
  const raw=' '+JSON.stringify(saved)+'\n',storage=new Map([[key,raw],[backupKey,'previous backup']]),writes=[];
  storage.set=(...args)=>{writes.push(args);return Map.prototype.set.apply(storage,args)};
  let draws=0;const original=Math.random,random=()=>{draws++;return 0};let h;
  Math.random=random;try{h=harness(storage)}finally{Math.random=original}
  h.context.Math.random=random;
  return {h,raw,storage,writes,draws:()=>draws};
 };
 const malformed=[[],null,undefined,{},'history',7,true,[null],[false],['entry'],[[]],[{}],
  [{awarded:1}],[{correct:true}],[{correct:false}],[{correct:'false',awarded:1}],
  [{correct:true,awarded:'1'}],[{correct:true,awarded:null}]];
 for(const version of [1,2,3,4,5])for(const success of [false,true]){
  const seed=harness();
  seed.eval('soundOn=false;options.modes=["talk"];options.dice=false;options.complications=false;'+
   (version===5?'newGame()':version===4?'v4Game()':'legacyGame('+version+')')+';'+
   (version===1?'delete game.scoringVersion;':'')+'roll();game.phase="judge";judge('+success+');'+
   'game.phase="between";game.dice=true;options.dice=true;persist()');
  const saved=JSON.parse(seed.storage.get(key));
  if(version===1){
   const {team,mode,word,awarded,correct}=saved.game.history[0];
   saved.game.history=[{team,mode,word,awarded,correct}];
   delete saved.game.rulesVersion;delete saved.game.startingTeamIndex;
  }
  if(!success)for(const [i,history]of malformed.entries()){
   const broken=JSON.parse(JSON.stringify(saved));broken.game.history=history;
   const {h,raw,storage,writes,draws}=load(broken),label='V'+version+' malformed '+i;
   assert.doesNotThrow(()=>h.eval('continueGame();render();persist();backToMenu()'),label);
   assert.equal(h.eval('game'),null,label);assert.equal(h.eval('storageBlocked'),true,label);
   assert.equal(h.eval('storageProblem'),'corrupt',label);assert.equal(h.eval('loadedSaveRaw'),raw,label);
   assert.equal(h.elements.get('continue-game').disabled,true,label);
   assert.match(h.elements.get('toast').textContent,/повреждено и защищено/,label);
   assert.equal(storage.get(key),raw,label);assert.equal(storage.get(backupKey),'previous backup',label);
   assert.deepEqual(writes,[],label);assert.equal(draws(),0,label);
   if(i===0){
    h.context.window.confirm=()=>false;
    assert.equal(h.eval('recoverCorruptSave()'),false);assert.deepEqual(writes,[]);
    assert.equal(storage.get(key),raw);assert.equal(h.eval('storageBlocked'),true);
    h.context.window.confirm=()=>true;
    assert.equal(h.eval('recoverCorruptSave()'),true);
    assert.deepEqual(writes.map(([k])=>k),[backupKey,key]);
    assert.equal(JSON.parse(storage.get(backupKey)).raw,raw);
    assert.equal(JSON.parse(storage.get(backupKey)).version,1);
    assert.ok(Number.isFinite(JSON.parse(storage.get(backupKey)).createdAt));
    assert.equal(JSON.parse(storage.get(key)).game,null);
    assert.equal(h.eval('storageBlocked'),false);assert.equal(draws(),0);
   }
  }
  const {h,raw,storage,writes,draws}=load(saved),before=h.eval('JSON.stringify(game)');
  assert.equal(h.eval('storageBlocked'),false,'Valid V'+version);
  assert.doesNotThrow(()=>h.eval('continueGame();render()'));
  assert.equal(h.eval('JSON.stringify(game)'),before);assert.equal(storage.get(key),raw);
  assert.deepEqual(writes,[]);assert.equal(draws(),0);
  assert.match(h.elements.get('play-content').innerHTML,/data-action="next"/);
  assert.ok(h.elements.get('play-content').innerHTML.includes(h.eval('currentTeam()')));
  assert.match(h.elements.get('play-content').innerHTML,success?/ЕСТЬ!/:/В СЛЕДУЮЩИЙ/);
  h.eval('handleAction("next")');
  assert.equal(h.eval('game.phase'),'ready');assert.equal(h.eval('game.roundIndex'),saved.game.roundIndex);
  assert.equal(h.eval('JSON.stringify(game.scores)'),JSON.stringify(saved.game.scores));
  assert.equal(h.eval('JSON.stringify(game.history)'),JSON.stringify(saved.game.history));
  assert.deepEqual(writes.map(([k])=>k),[key]);assert.equal(draws(),0);
 }
});
test('vocabulary is varied, unique within packs and contains at least 400 prompts',()=>{
  const h=harness();
  let total=0;
  for(const pack of ['PARTY_WORDS','PARTY_SONGS'])for(const level of ['easy','medium','hard']){
    const data=h.eval(pack+'.'+level);
    assert.equal(data.length,new Set(data).size,'duplicate in '+pack+' '+level);
    assert.ok(data.every(x=>x.trim()===x&&x.length>1));
    total+=data.length;
  }
  assert.equal(total,450);
});
test('seven modes, scoring, alternation and results survive repeated button actions',()=>{
  const h=harness();
  h.eval("soundOn=false; options.finishType='rounds'; options.riskRounds=false;options.rounds=8; options.duration=45; legacyGame();");
  assert.equal(h.eval('game.phase'),'ready');
  assert.equal(h.eval('game.roundIndex'),0);
  let earned=[0,0],visited=new Set();
  for(let i=0;i<8;i++){
    h.eval('roll()');
    assert.equal(h.eval('game.phase'),'rolling');
    h.pending.shift()();
    assert.equal(h.eval('game.phase'),'task');
    const mode=h.eval('game.current.modeId');
    visited.add(mode);
    assert.ok(['talk','mime','draw','sing','yesno','secret','blitz'].includes(mode));
    assert.equal(h.eval('game.current.visible'),false);
    h.eval('toggleWord();startTimer()');
    assert.equal(h.eval('game.phase'),'play');
    h.eval('pauseTimer()');
    assert.equal(h.eval('game.current.paused'),true);
    h.eval('resumeTimer()');
    assert.equal(h.eval('game.current.paused'),false);
    h.eval("finishTimer('early')");
    assert.equal(h.eval('game.phase'),'judge');
    const points=h.eval("game.current.modeId==='blitz'?0:game.current.points");
    const yes=i%3!==0;
    h.eval('judge('+yes+')');
    if(yes)earned[(i+1)%2]+=points;
    assert.equal(h.eval('game.roundIndex'),i+1);
    assert.equal(h.eval('game.scores['+((i+1)%2)+']'),earned[(i+1)%2]);
    h.eval('judge(true)');
    assert.equal(h.eval('game.scores['+((i+1)%2)+']'),earned[(i+1)%2],'double scoring!');
    if(i<7)assert.equal(h.eval('game.phase'),'ready');
  }
  assert.equal(h.eval('game.phase'),'results');
  assert.equal(h.eval('game.history.length'),8);
  assert.ok(visited.size>=3,'mode randomizer stuck');
  assert.deepEqual(Array.from(h.eval('game.scores')),earned);
});
test('timer expiration moves to one judgement exactly once',()=>{
  const h=harness();h.eval('soundOn=false;legacyGame();roll()');h.pending.shift()();
  h.eval('toggleWord();startTimer(); game.current.deadline=Date.now()-100;tick()');
  assert.equal(h.eval('game.phase'),'judge');
  assert.equal(h.eval('game.current.finishedReason'),'timeout');
  h.eval('tick();judge(false);judge(true)');
  assert.equal(h.eval('game.roundIndex'),1);
  assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);
});
test('session and scores restore correctly after browser reload',()=>{
  const storage=new Map();
  const a=harness(storage);a.eval('soundOn=false;legacyGame();roll()');
  a.pending.shift()();
  a.eval('toggleWord();startTimer();finishTimer("early");judge(true)');
  const expected=a.eval('game.scores[1]');
  const b=harness(storage);
  assert.equal(b.eval('game.roundIndex'),1);
  assert.equal(b.eval('game.scores[1]'),expected);
  assert.equal(b.eval('game.phase'),'ready');
});
test('reloading after deadline shows judgement rather than restarting a round',()=>{
  const storage=new Map();
  const a=harness(storage);a.eval('soundOn=false;legacyGame();roll()');a.pending.shift()();
  a.eval('toggleWord();startTimer();game.current.deadline=Date.now()-600;persist()');
  const b=harness(storage);
  assert.equal(b.eval('game.phase'),'judge');
  assert.equal(b.eval('game.current.finishedReason'),'timeout');
});
test('team names are escaped to prevent injection into game views',()=>{
  const h=harness();
  h.eval("selectedProfileIds[0]=createPlayerProfile('<img src=x>','violet').id");
  h.eval('legacyGame()');
  assert.ok(h.elements.get('play-content').innerHTML.includes('&lt;img'));
  assert.ok(!h.elements.get('play-content').innerHTML.includes('<img src=x onerror='));
});

test('extended vocabulary is clean and new prompt types are available',()=>{
 const h=harness();
 let count=0;
 for(const pack of ['PARTY_PHRASES','PARTY_IDIOMS','PARTY_PEOPLE'])
 for(const level of ['easy','medium','hard']){
   const values=h.eval(pack+'.'+level);
   assert.ok(values.length>=20,pack+'/'+level+' too small');
   assert.equal(values.length,new Set(values).size,pack+'/'+level+' duplicates');
   count+=values.length;
 }
 assert.ok(count>=270,'Extended prompts missing');
});
test('only selected mode and selected prompt types are drawn, with no dice animation',()=>{
 const h=harness();
 h.eval(`soundOn=false;options.modes=['talk'];options.promptTypes=['idiom'];
   options.dice=false;options.complications=false;options.duration=60;options.rounds=6;legacyGame()`);
 assert.equal(h.eval('game.modes.join(",")'),'talk');
 assert.equal(h.eval('game.duration'),60);
 h.eval('roll()');
 assert.equal(h.pending.length,0,'No-dice mode should open immediately');
 assert.equal(h.eval('game.phase'),'task');
 assert.equal(h.eval('game.current.modeId'),'talk');
 assert.equal(h.eval('game.current.complication'),'');
 const word=h.eval('game.current.word');
 assert.ok(h.eval('getPromptPool("words","easy").includes(game.current.word)'),word+' was missing');
});
test('yes/no mode uses person and character cards worth two points',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["yesno"];legacyGame();roll()');
 h.pending.shift()();
 assert.equal(h.eval('game.current.modeId'),'yesno');
 assert.equal(h.eval('game.current.points'),2);
 assert.ok(h.eval('getPromptPool("people","easy").includes(game.current.word)'));
 h.eval('toggleWord();startTimer();finishTimer("early");judge(true)');
 assert.equal(h.eval('game.scores[1]'),2);
});
test('blitz is a sequence with correct, skip, no timer reset and per-word points',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];options.blitzCount=5;legacyGame();roll()');
 h.pending.shift()();
 assert.equal(h.eval('game.current.blitzWords.length'),5);
 assert.equal(new Set(h.eval('game.current.blitzWords')).size,5);
 assert.equal(h.eval('game.current.seconds'),90);
 h.eval('toggleWord();startTimer()');
 const deadline=h.eval('game.current.deadline');
 h.eval('advanceBlitz(true)');
 assert.equal(h.eval('game.current.blitzIndex'),1);
 assert.equal(h.eval('game.current.blitzCorrect'),1);
 assert.equal(h.eval('game.current.deadline'),deadline);
 h.eval('advanceBlitz(false)');
 assert.equal(h.eval('game.current.blitzQueue.length'),4);
 h.eval('advanceBlitz(true);advanceBlitz(true);advanceBlitz(false)');
 assert.equal(h.eval('game.phase'),'play','Skipped words should return, not end the round');
 assert.equal(h.eval('game.current.blitzQueue.length'),2);
 h.eval('advanceBlitz(true);advanceBlitz(true)');
 assert.equal(h.eval('game.phase'),'judge');
 assert.equal(h.eval('game.current.blitzCorrect'),5);
 assert.equal(h.eval('game.scores[0]'),0);
 h.eval('judge(true);judge(true)');
 assert.equal(h.eval('game.scores[1]'),3,'blitz awards three points exactly once');
});
test('manual game settings are clamped and invalid modes are filtered on restore',()=>{
 const h=harness();
 const settings=h.eval('sanitizeOptions({duration:999,rounds:1,blitzCount:100,modes:["mime","bogus"],promptTypes:["phrase","invalid"],difficulty:"mixed"})');
 assert.equal(settings.duration,90);
 assert.equal(settings.rounds,2);
 assert.equal(settings.blitzCount,3);
 assert.equal(Array.from(settings.modes).join(','),'mime');
 assert.equal(Array.from(settings.promptTypes).join(','),'phrase');
 assert.equal(settings.difficulty,'mixed');
});

test('secret mode always carries a modifier and pays three points',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["secret"];options.complications=false;legacyGame();roll()');
 h.pending.shift()();
 assert.equal(h.eval('game.current.modeId'),'secret');
 assert.ok(h.eval('game.current.complication').length>4);
 assert.equal(h.eval('game.current.points'),3);
 h.eval('toggleWord();startTimer();finishTimer("early");judge(true)');
 assert.equal(h.eval('game.scores[1]'),3);
});
test('blitz cannot add a correct answer once the timer has expired',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];legacyGame();roll()');
 h.pending.shift()();
 h.eval('toggleWord();startTimer();game.current.deadline=Date.now()-1;advanceBlitz(true)');
 assert.equal(h.eval('game.phase'),'judge');
 assert.equal(h.eval('game.current.blitzCorrect'),0);
});

test('easy words remain visible without a timer and allow pause and repeated replacement',()=>{
 const h=harness();
 h.eval('soundOn=false;options.difficulty="easy";options.modes=["talk"];legacyGame();roll()');
 h.pending.shift()();
 h.eval('toggleWord()');
 assert.equal(h.eval('game.phase'),'task');
 assert.equal(h.eval('game.current.deadline'),null);
 h.eval('replaceWord();replaceWord()');
 assert.equal(h.eval('game.phase'),'task');
 h.eval('startTimer()');
 assert.equal(h.eval('game.phase'),'task','hidden card must not start');
 h.eval('toggleWord();startTimer()');
 assert.equal(h.eval('game.phase'),'play');
 h.eval('pauseTimer()');
 assert.equal(h.eval('game.current.paused'),true);
 h.eval('resumeTimer()');
 assert.equal(h.eval('game.current.paused'),false);
});
test('medium and hard start one second after reveal and cannot pause or swap prompt',()=>{
 for(const level of ['medium','hard']){
  const h=harness();
  h.eval('soundOn=false;options.difficulty="'+level+'";options.modes=["talk"];legacyGame();roll()');
  h.pending.shift()();
  const before=h.eval('game.current.word');
  h.eval('replaceWord()');
  assert.equal(h.eval('game.current.word'),before,'Swapped in '+level);
  h.eval('toggleWord()');
  assert.equal(h.eval('game.phase'),'countdown');
  assert.ok(h.eval('game.current.autoStartAt-Date.now()')>500);
  h.eval('startTimer()');
  assert.equal(h.eval('game.phase'),'countdown','Manual timer must not start');
  h.eval('game.current.autoStartAt=Date.now()-1;tick()');
  assert.equal(h.eval('game.phase'),'play');
  h.eval('pauseTimer()');
  assert.equal(h.eval('game.current.paused'),false,'Pause accepted in '+level);
  h.eval('toggleWord()');
  assert.equal(h.eval('game.current.visible'),false,'Visibility toggle should not pause in '+level);
 }
});
test('difficulty controls modifier severity and secret cards always get one',()=>{
 const h=harness();
 const ev=x=>h.eval(x);
 for(const level of ['easy','medium','hard']){
  ev('soundOn=false;options.difficulty="'+level+'";options.modes=["secret"];options.complications=true;legacyGame()');
  for(let i=0;i<8;i++){
   ev('game.phase="ready";roll()');h.pending.shift()();
   assert.ok(ev('game.current.complication.length')>2,'secret modifier missing');
   if(level==='easy'){
    const id=ev('game.current.methodId');
    assert.ok(ev("getModifierPool(game.current.methodId,'easy').some(m=>m.text===game.current.complication)"),'hard modifier in easy');
   }
  }
 }
});
test('countdown survives reload and respects its original start timestamp',()=>{
 const storage=new Map(),first=harness(storage);
 first.eval('soundOn=false;options.difficulty="hard";options.modes=["talk"];legacyGame();roll()');
 first.pending.shift()();
 first.eval('toggleWord()');
 const second=harness(storage);
 assert.equal(second.eval('game.phase'),'countdown');
 second.eval('game.current.autoStartAt=Date.now()-2;tick()');
 assert.equal(second.eval('game.phase'),'play');
});

test('blitz queues skipped prompts again without increasing maximum score',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];legacyGame();roll()');
 h.pending.shift()();
 h.eval('toggleWord();startTimer()');
 const first=h.eval('game.current.word');
 const deadline=h.eval('game.current.deadline');
 h.eval('advanceBlitz(false)');
 assert.equal(h.eval('game.current.blitzQueue.length'),5);
 h.eval('advanceBlitz(true);advanceBlitz(true);advanceBlitz(true);advanceBlitz(true)');
 assert.equal(h.eval('game.phase'),'play','The skipped word must remain pending');
 assert.equal(h.eval('game.current.word'),first,'Skipped word never cycled back');
 assert.equal(h.eval('game.current.deadline'),deadline,'Clock reset when recycling words');
 h.eval('advanceBlitz(true)');
 assert.equal(h.eval('game.phase'),'judge');
 assert.equal(h.eval('game.current.blitzCorrect'),5);
 h.eval('judge(true)');
 assert.equal(h.eval('game.scores[1]'),3,'Repeated prompt was counted twice');
});
test('returning to home preserves a game and enables Continue',()=>{
 const h=harness();
 h.eval('soundOn=false;legacyGame();backToMenu()');
 assert.equal(h.eval('game.phase'),'ready');
 assert.equal(h.eval('activeScene'),'home');
 h.eval('continueGame()');
 assert.equal(h.eval('activeScene'),'game');
});

test('creating a game never requests another native confirmation',()=>{
 const h=harness();
 h.context.window.confirm=()=>{throw Error('Unexpected native confirm');};
 h.eval('soundOn=false;legacyGame();openSetup();legacyGame()');
 assert.equal(h.eval('game.phase'),'ready');
 assert.equal(h.eval('game.roundIndex'),0);
});
test('a correct answer on the timer awards once and immediately advances teams',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["talk"];options.difficulty="easy";options.dice=false;legacyGame();roll();toggleWord();startTimer()');
 assert.equal(h.eval('game.phase'),'play');
 const word=h.eval('game.current.word');
 h.eval('handleAction("correct-now")');
 assert.equal(h.eval('game.phase'),'ready');
 assert.equal(h.eval('game.roundIndex'),1);
 assert.equal(h.eval('game.scores[1]'),1);
 assert.equal(h.eval('game.history[0].word'),word);
 h.eval('handleAction("correct-now");judge(true)');
 assert.equal(h.eval('game.scores[1]'),1);
});
test('expired timer cannot be credited by quick success',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["talk"];options.dice=false;legacyGame();roll();toggleWord();startTimer()');
 h.eval('game.current.deadline=Date.now()-1;correctNow()');
 assert.equal(h.eval('game.phase'),'judge');
 assert.equal(h.eval('game.scores[0]'),0);
 h.eval('judge(false)');
 assert.equal(h.eval('game.phase'),'ready');
 assert.equal(h.eval('game.roundIndex'),1);
});
test('hiding the challenge on hard difficulty never alters its running deadline',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["talk"];options.dice=false;options.difficulty="hard";legacyGame();roll();toggleWord()');
 h.eval('game.current.autoStartAt=Date.now()-1;tick()');
 const deadline=h.eval('game.current.deadline');
 h.eval('toggleWord()');
 assert.equal(h.eval('game.current.visible'),false);
 h.eval('toggleWord()');
 assert.equal(h.eval('game.current.visible'),true);
 assert.equal(h.eval('game.current.deadline'),deadline);
});
test('circular buttons have accessible labels and judge captions stay paired with controls',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["talk"];options.dice=false;legacyGame();roll();toggleWord()');
 assert.ok(h.elements.get('play-content').innerHTML.includes('aria-label="Запустить таймер"'));
 h.eval('startTimer()');
 let html=h.elements.get('play-content').innerHTML;
 assert.ok(html.includes('data-action="correct-now"'));
 assert.ok(html.includes('round-action--success round-action--prominent'));
 h.eval('finishTimer("timeout")');
 html=h.elements.get('play-content').innerHTML;
 assert.ok(html.includes('judgement-option'));
 assert.ok(html.includes('<span>УГАДАЛИ</span>'));
 assert.ok(!html.includes('judgement-labels'));
});

test('quick red rejection immediately ends the turn without giving points',()=>{
 const h=harness();
 h.eval('soundOn=false;options.dice=false;options.modes=["talk"];options.difficulty="easy";legacyGame();roll();toggleWord();startTimer()');
 h.eval('handleAction("wrong-now")');
 assert.equal(h.eval('game.phase'),'ready');
 assert.equal(h.eval('game.roundIndex'),1);
 assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);
 assert.equal(h.eval('game.history[0].correct'),false);
 h.eval('handleAction("wrong-now");judge(true)');
 assert.deepEqual(Array.from(h.eval('game.scores')),[0,0],'Forfeit was scored twice');
});
test('red reject after expired deadline still opens normal judgement, not instant forfeit',()=>{
 const h=harness();
 h.eval('soundOn=false;options.dice=false;options.modes=["talk"];legacyGame();roll();toggleWord();startTimer()');
 h.eval('game.current.deadline=Date.now()-1;wrongNow()');
 assert.equal(h.eval('game.phase'),'judge');
 assert.equal(h.eval('game.roundIndex'),0);
 h.eval('judge(false)');
 assert.equal(h.eval('game.phase'),'ready');
});
test('app preferences are separate from game setup and use a persistent sound checkbox',()=>{
 const h=harness();
 h.eval('openPreferences()');
 assert.equal(h.eval('activeScene'),'preferences');
 assert.equal(h.eval('soundOn'),true);
 assert.equal(h.elements.get('sound-toggle').checked,true);
 h.eval('soundOn=false;setSoundIcon();persist()');
 const reload=harness(h.storage);
 assert.equal(reload.eval('soundOn'),false);
 assert.equal(reload.elements.get('sound-toggle').checked,false);
});
test('old saved no-carousel option is migrated to regular carousel selection',()=>{
 const h=harness();
 const result=h.eval('sanitizeOptions({dice:false,difficulty:"easy"}).dice');
 assert.equal(result,true);
});

test('blitz skips can cycle endlessly without counting or displaying skips',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];options.blitzCount=4;legacyGame();roll()');
 h.pending.shift()();
 h.eval('toggleWord();startTimer()');
 for(let i=0;i<44;i++)h.eval('advanceBlitz(false)');
 assert.equal(h.eval('game.current.blitzCorrect'),0);
 assert.equal(h.eval('game.current.blitzQueue.length'),5);
 assert.equal(h.eval('game.current.blitzSkipped'),undefined);
 const status=h.eval('blitzStatus()');
 assert.ok(status.includes('ОСТАЛОСЬ: 5'));
 assert.ok(status.includes('ОТГАДАНО: 0'));
 assert.ok(!status.includes('Пропущено'));
 h.eval('finishTimer("timeout")');
 assert.ok(!h.elements.get('play-content').innerHTML.includes('Пропущено'));
});
test('judge puts the negative decision left and positive decision right in every mode',()=>{
 for(const mode of ['talk','blitz']){
  const h=harness();
  h.eval('soundOn=false;options.modes=["'+mode+'"];legacyGame();roll()');
  h.pending.shift()();
  h.eval('toggleWord();startTimer()');
  if(mode==='blitz')h.eval('game.current.blitzCorrect=5');
  h.eval('finishTimer("timeout")');
  const markup=h.elements.get('play-content').innerHTML;
  assert.ok(markup.indexOf('data-action="no"')<markup.indexOf('data-action="yes"'),mode);
  assert.ok(markup.indexOf('round-action--danger')<markup.indexOf('round-action--success'),mode);
 }
});
test('incomplete V5 Blitz offers only a finalization button and awards nothing',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];options.dice=false;options.riskRounds=false;legacyGame();roll();toggleWord();startTimer();finishTimer("timeout")');
 const markup=h.elements.get('play-content').innerHTML;
 assert.ok(markup.includes('data-action="no"'));
 assert.ok(!markup.includes('data-action="yes"'));
 assert.ok(markup.includes('ЗАВЕРШИТЬ РАУНД'));
 h.eval('judge(false)');
 assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);
});
test('Russian long prompt has a syllabic optional break without changing stored words',()=>{
 const h=harness();
 const raw='ПАРАЛЛЕЛЬНАЯ РЕАЛЬНОСТЬ';
 const marked=h.eval('displayPrompt("'+raw+'")');
 assert.ok(marked.includes('ПАРАЛЛЕЛЬ\u00adНАЯ'));
 assert.equal(marked.replace(/\u00ad/g,''),raw);
});

test('seven active and one staged mode use transparent WebP illustrations',()=>{
 const h=harness();
 const expected={talk:'talk',mime:'mime',draw:'draw',sing:'sing',yesno:'yesno',secret:'secret',blitz:'blitz',approx:'approx'};
 const assetMap=JSON.parse(h.eval('JSON.stringify(MODE_ASSETS)'));
 assert.deepEqual(Object.keys(assetMap).sort(),Object.keys(expected).sort());
 for(const [mode,name] of Object.entries(expected)){
   assert.equal(assetMap[mode],'./assets/modes/'+name+'.webp?v=3');
   const file=fs.readFileSync(path.join(__dirname,'../assets/modes',name+'.webp'));
   assert.ok(file.length<90000,'Icon is too large for a mobile PWA: '+name);
   assert.equal(file.toString('ascii',0,4),'RIFF','Missing WebP RIFF header '+name);
   assert.equal(file.toString('ascii',8,12),'WEBP','Missing WebP signature '+name);
 }
});
test('reel sequence repeats around the chosen mode without modifying game mode or score',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["talk","draw","yesno"];legacyGame();roll()');
 assert.equal(h.eval('game.phase'),'rolling');
 const chosen=h.eval('game.current.modeId');
 const before=h.eval('game.scores.slice()');
 const seq=Array.from(h.eval('rollSequence'));
 assert.ok(seq.length>=35,'Wheel still ends after too few icons');
 const landing=Math.max(7,3+3);
 assert.equal(seq[landing],chosen,'Center-landing icon does not match chosen mode');
 assert.ok(seq.length-landing>7,'Wheel ends at winner instead of extending right');
 for(let i=1;i<seq.length;i++){
   const allowed=Array.from(h.eval('game.modes'));
   const first=allowed.indexOf(seq[i-1]);
   assert.equal(seq[i],allowed[(first+1)%allowed.length],'Broken loop at '+i);
 }
 assert.deepEqual(Array.from(h.eval('game.scores')),Array.from(before));
 h.pending.shift()(); // transition into the existing task screen
 assert.equal(h.eval('game.phase'),'task');
 assert.equal(h.eval('game.current.modeId'),chosen,'Wheel changed the outcome');
});

test('installed fullscreen viewport stays fixed during transient Android system bars',()=>{
 const src=read('immersive-viewport.js');
 const vmContext=(fullscreen)=>{
  const values=new Map(),events=new Map();
  const root={style:{setProperty:(key,value)=>values.set(key,value)}};
  const w={innerWidth:390,innerHeight:844,screen:{orientation:{type:'portrait-primary'}},matchMedia:()=>({matches:fullscreen}),addEventListener:(name,fn)=>events.set(name,fn),visualViewport:{addEventListener(){}}};
  vm.runInNewContext(src,{window:w,document:{documentElement:root},Math});
  return {w,values,events};
 };
 const installed=vmContext(true);
 assert.equal(installed.values.get('--kvip-locked-height'),'844px');
 assert.equal(installed.values.get('--kvip-locked-vh'),'8.44px');
 installed.w.innerHeight=764;installed.events.get('resize')();
 assert.equal(installed.values.get('--kvip-locked-height'),'844px','Temporary system bars must not shrink canvas');
 installed.w.innerHeight=855;installed.events.get('resize')();
 assert.equal(installed.values.get('--kvip-locked-height'),'855px','Larger fullscreen area must be supported');
 installed.w.innerWidth=844;installed.w.innerHeight=390;installed.w.screen.orientation.type='landscape-primary';installed.events.get('orientationchange')();
 assert.equal(installed.values.get('--kvip-locked-height'),'390px','Rotation must rebase the layout');
 const tab=vmContext(false);assert.equal(tab.values.size,0,'Non-fullscreen browser view keeps dynamic sizing');
 const css=read('style.css');assert.match(css,/var\(--kvip-locked-vh, 1dvh\)/);
 assert.match(css,/height:var\(--kvip-locked-height,100dvh\)/);
});
test('КВИП branding is consistent across the browser and installed PWA',()=>{
 const html=read('index.html');
 const css=read('style.css');
 const manifest=JSON.parse(read('manifest.webmanifest'));
 const worker=read('sw.js');
 assert.match(html,/<title>КВИП — игра для компании<\/title>/);
 assert.match(html,/class="play-footer"><span>КВИП<\/span>/);
 assert.doesNotMatch(html,/ИСКРА/);
 assert.equal(manifest.short_name,'КВИП');
 assert.equal(manifest.name,'КВИП — игра для компании');
 assert.match(css,/content:"КВИП";/);
 assert.match(worker,/const CACHE='kvip-pwa-v\d+-\d{8}-[a-z-]+'/);
 assert.match(worker,/iskra-pwa-/); // Clear the previous cache without losing offline updates.
});


test('duel score goal gives the opponent a reply, then extends a tie',()=>{
 const h=harness();
 h.eval("soundOn=false;options.finishType='score';options.targetScore=15;options.modes=['talk'];options.dice=false;options.riskRounds=false;legacyGame();game.scores=[14,14];");
 h.eval('roll();toggleWord();startTimer();correctNow()');
 assert.deepEqual(Array.from(h.eval('game.scores')),[14,15]);
 assert.equal(h.eval('game.phase'),'ready','First player to threshold cannot finish before reply');
 h.eval('roll();toggleWord();startTimer();correctNow()');
 assert.deepEqual(Array.from(h.eval('game.scores')),[15,15]);
 assert.equal(h.eval('game.phase'),'ready','Tied players must continue in pairs');
 h.eval('roll();toggleWord();startTimer();correctNow()');
 assert.deepEqual(Array.from(h.eval('game.scores')),[15,16]);
 assert.equal(h.eval('game.phase'),'ready','Opponent still gets reply');
 h.eval('roll();toggleWord();startTimer();wrongNow()');
 assert.equal(h.eval('game.phase'),'results');
 assert.deepEqual(Array.from(h.eval('game.scores')),[15,16]);
});
test('smart finish: hopeless reply stops early but a reachable reply remains',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation();
 h.eval("chooseStartingTeam=()=>0;Object.assign(options,{finishType:'score',targetScore:30,awardTo:'setter',modes:['talk'],complications:false,riskRounds:false});newGame()");
 assert.equal(h.eval('game.finishPolicyVersion'),1);
 h.eval('game.startingTeamIndex=0;game.roundIndex=1;game.scores=[30,15]');assert.equal(h.eval('matchComplete()'),true);
 h.eval('game.scores=[30,28]');assert.equal(h.eval('matchComplete()'),true,'Only +1 Words cannot catch +2');
 h.eval("game.modes=['blitz']");assert.equal(h.eval('matchComplete()'),false,'+2 Blitz can draw at 30:28');
 h.eval('game.scores=[30,27]');assert.equal(h.eval('matchComplete()'),true,'+2 Blitz cannot catch +3');
 h.eval("game.modes=['approx'];game.scores=[30,29]");assert.equal(h.eval('matchComplete()'),false,'Approx can give the laggard +1');
 h.eval('game.scores=[30,28]');assert.equal(h.eval('matchComplete()'),true);
 h.eval('game.scores=[30,30];game.roundIndex=2');assert.equal(h.eval('matchComplete()'),false,'Tie continues for separate tie-break policy');
 h.eval('game.scores=[31,30]');assert.equal(h.eval('matchComplete()'),true);
});
test('smart finish: recipient and risk determine whether a comeback is possible',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation();
 h.eval("chooseStartingTeam=()=>0;Object.assign(options,{finishType:'score',targetScore:30,awardTo:'guesser',modes:['mime'],riskRounds:false,complications:false});newGame()");
 h.eval('game.startingTeamIndex=0;game.scores=[30,28];game.roundIndex=1');
 assert.equal(h.eval('matchComplete()'),true,'Next guesser would be the leader, no chance to catch');
 h.eval('game.roundIndex=3;game.riskRounds=true');
 assert.equal(h.eval('matchComplete()'),false,'Risk loss by the leader can draw the score');
 h.eval('game.modes=["approx"];game.riskRounds=false');
 assert.equal(h.eval('matchComplete()'),true,'Approx +1 cannot overcome +2 gap');
 h.eval('game.scores=[30,29]');assert.equal(h.eval('matchComplete()'),false);
});
test('smart finish: pure pre-reply evaluation preserves RNG and saved plan',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation();
 h.eval("chooseStartingTeam=()=>0;Object.assign(options,{finishType:'score',targetScore:30,awardTo:'setter',modes:['talk','mime'],difficulty:'mixed',riskRounds:false});newGame()");
 h.eval("game.startingTeamIndex=0;game.roundIndex=1;game.scores=[30,27];game.plannerState={cycleIndex:0,levels:['easy','medium','hard']};");
 const before=h.eval('JSON.stringify(game)');
 h.eval('Math.random=()=>{throw Error("finish evaluation consumed RNG")};matchComplete()');
 assert.equal(h.eval('JSON.stringify(game)'),before);
});
test('smart finish: shared tiebreak chooses a distinct question, resumes offline and awards no ordinary task',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),store=new Map(),h=createSimulation(1,store);
 h.eval("Object.assign(options,{finishType:'score',targetScore:15,modes:['talk'],difficulty:'easy'});newGame()");
 h.eval(`game.roundIndex=30;game.scores=[15,15];
  game.history=Array.from({length:30},(_,i)=>({mode:'approx',setterIndex:i%2,assignedIndices:[0,1],
   deltas:i<15?[1,1]:[0,0],recipients:i<15?[0,1]:[],sharedAward:i<15,
   recipientNames:i<15?game.teams.slice():[],word:'Пример',answer:'42',unit:''}));
  game.phase='ready';persist();beginTiebreak()`);
 assert.equal(h.eval('game.phase'),'tiebreak');
 assert.equal(h.eval('game.roundIndex'),30);
 assert.equal(h.eval('game.history.length'),30);
 const firstQuestion=h.eval('game.tiebreak.question.id');
 h.eval("revealTiebreak();settleTiebreak('same')");
 assert.equal(h.eval('game.phase'),'tiebreak');
 assert.equal(h.eval('game.tiebreak.stage'),'question');
 assert.notEqual(h.eval('game.tiebreak.question.id'),firstQuestion);
 const savedRaw=store.get('iskra-party:v1');
 const reload=createSimulation(2,store);
 reload.eval('restoreProfiles();restoreSession()');
 assert.equal(reload.eval('game.phase'),'tiebreak');
 assert.equal(store.get('iskra-party:v1'),savedRaw);
 reload.eval("revealTiebreak();settleTiebreak('a')");
 assert.equal(reload.eval('game.phase'),'results');
 assert.deepEqual(Array.from(reload.eval('game.scores')),[16,15]);
 assert.equal(reload.eval('game.roundIndex'),30);
 assert.equal(reload.eval('game.history.length'),30);
 assert.equal(reload.eval('profileStore.totals[profileStore.profiles[0].id].matches'),1);
 assert.equal(reload.eval('profileStore.totals[profileStore.profiles[0].id].tiebreakWins'),1);
 assert.equal(reload.eval('profileStore.totals[profileStore.profiles[1].id].tiebreakWins'),0);
 assert.deepEqual(Array.from(reload.eval('profileStore.profiles.slice(0,2).map(p=>profileStore.totals[p.id].turns)')),[30,30]);
 reload.eval('commitProfileResult(game)');
 assert.equal(reload.eval('profileStore.totals[profileStore.profiles[0].id].matches'),1);
});
test('smart finish: no numerical questions in a saved theme keeps tied paired turns',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation();
 h.eval("Object.assign(options,{finishType:'score',targetScore:15,modes:['talk']});newGame()");
 h.eval("game.contentPack={id:'general',version:1};game.roundIndex=2;game.scores=[15,15]");
 assert.equal(h.eval('beginTiebreak()'),false);
 assert.equal(h.eval('game.tiebreak'),undefined);
 assert.equal(h.eval('game.phase'),'ready');
});
test('smart finish: invalid persisted tiebreak cannot be restored',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),store=new Map(),h=createSimulation(1,store);
 h.eval("Object.assign(options,{finishType:'score',targetScore:15,modes:['talk']});newGame()");
 h.eval("game.roundIndex=2;game.scores=[15,15];beginTiebreak();game.tiebreak.winnerIndex=0;persist()");
 const reloaded=createSimulation(1,store);
 reloaded.eval('restoreProfiles();restoreSession()');
 assert.equal(reloaded.eval('storageBlocked'),true);
});
test('smart finish: a legacy saved party retains its original even-turn rules',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation();
 h.eval("chooseStartingTeam=()=>0;Object.assign(options,{finishType:'score',targetScore:30,modes:['talk']});newGame();delete game.finishPolicyVersion;game.roundIndex=1;game.scores=[30,15]");
 assert.equal(h.eval('matchComplete()'),false);
 h.eval('game.roundIndex=2');assert.equal(h.eval('matchComplete()'),true);
});
test('fixed turn matches always use an equal even number of turns',()=>{
 const h=harness();
 assert.equal(h.eval("sanitizeOptions({finishType:'rounds',rounds:5}).rounds"),6);
 assert.equal(h.eval("sanitizeOptions({finishType:'rounds',rounds:99}).rounds"),100);
 assert.equal(h.eval("sanitizeOptions({finishType:'rounds',rounds:1}).rounds"),2);
 assert.equal(h.eval("sanitizeOptions({finishType:'score',targetScore:300}).targetScore"),100);
 assert.equal(h.eval("sanitizeOptions({finishType:'score',targetScore:5}).targetScore"),15);
});
test('mode-specific seconds follow base slider and capped bonus',()=>{
 const h=harness();
 for(const [mode,method,base,expected] of [
  ['talk','talk',60,60],['mime','mime',60,60],['draw','draw',60,90],
  ['yesno','yesno',60,90],['sing','sing',60,90],
  ['secret','draw',60,90],['secret','mime',60,60],['blitz','blitz',60,90],
  ['draw','draw',90,120],['sing','sing',30,60],['talk','talk',90,90]
 ]) assert.equal(h.eval("durationForMode('"+mode+"','"+method+"',"+base+")"),expected,mode);
});
test('risk losses are bounded at zero and charged to the guesser only',()=>{
 const h=harness();
 h.eval("soundOn=false;options.modes=['talk'];options.dice=false;options.riskRounds=true;legacyGame();game.scores=[10,1];roll();game.current.risk=true;toggleWord();startTimer();wrongNow()");
 assert.deepEqual(Array.from(h.eval('game.scores')),[10,0]);
 assert.equal(h.eval('game.history[0].awarded'),-1);
 h.eval('roll();game.current.risk=true;toggleWord();startTimer();wrongNow()');
 assert.equal(h.eval('game.scores[0]'),8);
 assert.equal(h.eval('game.history[1].awarded'),-2);
});
test('blitz is always five words and requires all five for three points',()=>{
 const h=harness();
 h.eval("soundOn=false;options.modes=['blitz'];options.dice=false;options.riskRounds=false;options.blitzCount=8;legacyGame();roll()");
 assert.equal(h.eval('game.current.blitzWords.length'),5);
 h.eval('toggleWord();startTimer();advanceBlitz(true);advanceBlitz(true);advanceBlitz(true);advanceBlitz(true);finishTimer("early");judge(true)');
 assert.deepEqual(Array.from(h.eval('game.scores')),[0,0],'Four of five cannot award points');
 h.eval('roll();toggleWord();startTimer();advanceBlitz(true);advanceBlitz(true);advanceBlitz(true);advanceBlitz(true);advanceBlitz(true)');
 assert.equal(h.eval('game.phase'),'judge');
 h.eval('judge(true)');
 assert.deepEqual(Array.from(h.eval('game.scores')),[3,0],'Five of five should award three points to the new guesser');
});
test('expanded word pools recover previously lost phrases and de-duplicate',()=>{
 const h=harness();
 h.eval('soundOn=false;legacyGame()');
 const oldWord='СТИРАЛЬНАЯ МАШИНА';
 assert.equal(h.eval("getPromptPool('words','easy').includes('СТИРАЛЬНАЯ МАШИНА')"),true);
 assert.equal(h.eval("getPromptPool('words','easy').includes('ХОМЯК')"),true);
 let count=0;
 for(const kind of ['words','songs','people'])for(const level of ['easy','medium','hard']){
  const data=Array.from(h.eval("getPromptPool('"+kind+"','"+level+"')"));
  assert.equal(data.length,new Set(data).size,'Duplicate in '+kind+'/'+level);
  count+=data.length;
 }
 assert.ok(count>=1400,'Extended pools too small: '+count);
});


test('upgrading a saved pre-V5 Blitz preserves the old per-word scoring',()=>{
 const stored=new Map();
 const initial=harness(stored);
 initial.eval("soundOn=false;legacyGame();game.scoringVersion=undefined;game.finishType='rounds';game.rounds=12;game.riskRounds=false;game.current={modeId:'blitz',methodId:'blitz',word:'КОТ',blitzWords:['КОТ','ДОМ','ЛЕС','МЯЧ'],blitzCorrect:2,points:1,finishedReason:'timeout',risk:false};game.phase='judge';persist()");
 const resumed=harness(stored);
 assert.equal(resumed.eval('game.scoringVersion'),undefined);
 resumed.eval('continueGame()');
 assert.match(resumed.elements.get('play-content').innerHTML,/За каждое отгаданное слово/);
 resumed.eval('judge(true)');
 assert.deepEqual(Array.from(resumed.eval('game.scores')),[2,0]);
 assert.equal(resumed.eval('game.history[0].awarded'),2);
 assert.equal(resumed.eval('game.phase'),'ready');
});
test('all legacy and expanded multiword cards remain available as phrases',()=>{
 const h=harness();
 h.eval('soundOn=false;legacyGame()');
 assert.equal(h.eval("getPromptPool('words','easy').includes('СТИРАЛЬНАЯ МАШИНА')"),true);
 assert.equal(h.eval("getPromptPool('words','medium').includes('РУЧНАЯ КЛАДЬ')"),true);
 assert.equal(h.eval("getPromptPool('words','medium').includes('РУЧНАЯ КЛАДЬ') && !getPromptPool('words','medium').includes('РУЧНАЯ КЛАДЬ РУЧНАЯ КЛАДЬ')"),true);
 h.eval("game.promptTypes=['word']");
 assert.equal(h.eval("getPromptPool('words','medium').includes('РУЧНАЯ КЛАДЬ')"),false);
 h.eval("game.promptTypes=['phrase']");
 assert.equal(h.eval("getPromptPool('words','medium').includes('РУЧНАЯ КЛАДЬ')"),true);
});
test('blitz repetition history spans all difficulty levels',()=>{
 const h=harness();
 h.eval('soundOn=false;legacyGame()');
 h.eval("game.used={};pullWord('blitz','easy')");
 const first=h.eval("game.used['easy:blitz:word,phrase,idiom'][0]");
 assert.equal(typeof first,'string');
 h.eval("pullWord('blitz','hard')");
 assert.equal(h.eval("game.used['easy:blitz:word,phrase,idiom'].length"),2);
 assert.equal(h.eval("game.used['hard:blitz:word,phrase,idiom']"),undefined);
});


test('new difficulty taxonomy chooses concrete easy, culinary medium, technical hard',()=>{
 const h=harness();
 h.eval('soundOn=false;legacyGame()');
 assert.ok(h.eval("getPromptPool('words','easy').includes('КОРАБЛЬ')"));
 assert.ok(h.eval("getPromptPool('words','medium').includes('МАЧТА')"));
 assert.ok(h.eval("getPromptPool('words','hard').includes('ВАТЕРЛИНИЯ')"));
 for(const type of ['word','phrase','idiom']){
  const levels=['easy','medium','hard'].map(level=>Array.from(h.eval('PARTY_VOCABULARY.'+type+'.'+level)));
  for(let i=0;i<levels.length;i++){
   assert.equal(levels[i].length,new Set(levels[i]).size,'Duplicated '+type+' pool');
   for(let j=i+1;j<levels.length;j++){
    assert.equal(levels[i].filter(x=>levels[j].includes(x)).length,0,'Cross-tier duplicate '+type);
   }
  }
 }
});
test('song themes all have named examples and span different genres',()=>{
 const h=harness();
 let all=[],genres=new Set();
 for(const level of ['easy','medium','hard']){
  const catalog=Array.from(h.eval('PARTY_TRACK_CATALOG.'+level));
  assert.ok(catalog.length>=40,level+' needs at least forty song topics');
  for(const entry of catalog){
   assert.ok(entry.topic&&entry.title&&entry.artist&&entry.genre);
   genres.add(entry.genre);
   all.push(entry.topic);
  }
  assert.deepEqual(Array.from(h.eval('getPromptPool("songs","'+level+'")')).slice(0,catalog.length),catalog.map(x=>x.topic));
 }
 assert.equal(all.length,new Set(all).size,'A song theme cannot repeat at multiple levels');
 assert.ok(genres.has('поп')&&genres.has('рок')&&genres.has('рэп')&&genres.has('зарубежное'));
});
test('Danetki uses a graded, broadly recognisable cast instead of obscure legacy cards',()=>{
 const h=harness();
 let all=[];
 for(const level of ['easy','medium','hard']){
  const people=Array.from(h.eval('getPromptPool("people","'+level+'")'));
  assert.ok(people.length>=90,'Too few famous names in '+level);
  assert.equal(people.length,new Set(people).size);
  all.push(...people);
 }
 assert.equal(all.length,new Set(all).size);
 assert.ok(h.eval("getPromptPool('people','easy').includes('ГАРРИ ПОТТЕР')"));
 assert.ok(h.eval("getPromptPool('people','medium').includes('НИКОЛА ТЕСЛА')"));
 assert.ok(h.eval("getPromptPool('people','hard').includes('САРУМАН')"));
 assert.ok(!h.eval("getPromptPool('people','hard').includes('МИШЕЛЬ ДЕ МОНТЕНЬ')"));
});
test('new games use a one-minute base and +30s in long modes including Blitz',()=>{
 const h=harness();
 assert.equal(h.eval("sanitizeOptions({}).duration"),60);
 h.eval("soundOn=false;options.duration=60;options.modes=['blitz'];legacyGame();roll()");
 assert.equal(h.eval('game.current.seconds'),90);
 assert.equal(h.eval('game.current.blitzWords.length'),5);
});

test('card catalog v1 retains all 3016 historical tasks and unique IDs',()=>{
 const h=harness(),cards=JSON.parse(h.eval('JSON.stringify(PARTY_CARDS)'));
 const declaredOrigins=new Set(require('../scripts/content.cjs').readDataset().cards.map(c=>c.pack));
 assert.equal(h.eval('PARTY_CARD_SCHEMA_VERSION'),1);
 const historical=cards.filter(c=>Number(c.id.split('-')[1])<8000);
 assert.equal(historical.length,3016);
 assert.equal(new Set(cards.map(c=>c.id)).size,cards.length);
 assert.deepEqual(Object.fromEntries(['word','phrase','idiom','song','person'].map(t=>[t,historical.filter(c=>c.type===t).length])),
   {word:1846,phrase:496,idiom:142,song:215,person:317});
 for(const c of cards){
  assert.match(c.id,/^(word|phrase|idiom|song|person)-[0-9]{6}$/);
  assert.ok(c.text.trim().length>1);
  assert.ok(['easy','medium','hard'].includes(c.difficulty));
  assert.ok(['word','phrase','idiom','song','person'].includes(c.type));
  assert.ok(Array.isArray(c.categories)&&c.categories.every(x=>/^[a-z][a-z0-9-]*$/.test(x)));
  assert.equal(c.categories.length,new Set(c.categories).size);
  assert.ok(declaredOrigins.has(c.pack),'Undeclared source origin: '+c.pack);
  if(c.type==='song')assert.ok(c.meta.themeVersion===2?c.meta.examples.length>=2:c.meta.title&&c.meta.artist&&c.meta.genre);
 }
 assert.equal(h.eval("getCardById('word-000001').text"),'КАРАНДАШ');
 assert.equal(h.eval("getCardById('unknown')"),null);
 assert.equal(h.eval('Object.isFrozen(PARTY_CARDS[0])&&Object.isFrozen(PARTY_CARDS[0].categories)'),true);
 const mast=cards.filter(c=>c.text==='МАЧТА');
 assert.deepEqual(mast.map(c=>[c.id,c.type,c.difficulty,c.categories]),[['word-000710','word','medium',['transport','marine']]]);
 assert.equal(cards.some(c=>c.text==='МАТЧА'),false);
});
test('typed source retains old playable words, songs, people and blitz constraints',()=>{
 const h=harness();h.eval('soundOn=false;legacyGame()');
 for(const level of ['easy','medium','hard']){
  for(const type of ['word','phrase','idiom']){
   const cards=Array.from(h.eval("getCardPool('words','"+level+"',['"+type+"']).map(c=>c.text)"));
   const legacyView=Array.from(h.eval("PARTY_VOCABULARY."+type+"."+level));
   assert.deepEqual(cards,legacyView);
  }
  for(const [kind,type] of [['songs','song'],['people','person']]){
   const cards=Array.from(h.eval("getPackCardPool(game.contentPack,'"+kind+"','"+level+"').map(c=>c.text)"));
   const prompts=Array.from(h.eval("getPromptPool('"+kind+"','"+level+"')"));
   assert.deepEqual(cards,prompts);
  }
 }
 assert.equal(h.eval("getCardPool('blitz','hard').every(c=>c.difficulty==='easy'&&c.text.length<=12)"),true);
 const cardsUrl=read('index.html').match(/src="(\.\/cards\.js\?v=\d+)"/)[1];assert.ok(read('sw.js').includes(cardsUrl));
});
test('text-only saved rounds still restore unchanged after catalog migration',()=>{
 const saved=new Map(),a=harness(saved);
 a.eval("soundOn=false;options.modes=['talk'];options.dice=false;legacyGame();roll();game.current.word='СТИРАЛЬНАЯ МАШИНА';game.phase='task';persist()");
 const b=harness(saved);
 assert.equal(b.eval('game.current.word'),'СТИРАЛЬНАЯ МАШИНА');
 assert.equal(b.eval('game.phase'),'task');
 assert.equal(b.eval('game.scoringVersion'),2);
});

test('all version 3 rewards follow the selected difficulty; Blitz stays three',()=>{
 const h=harness(),table={talk:[1,2,3],mime:[2,3,4],draw:[2,3,4],
  sing:[2,3,4],yesno:[2,3,4],secret:[3,4,5],blitz:[3,3,3]};
 h.eval('soundOn=false;legacyGame()');
 assert.equal(h.eval('game.rulesVersion'),3);
 assert.equal(h.eval('QUIP_RULE_VERSION'),5);
 for(const [mode,tiers] of Object.entries(table))
  for(const [i,level] of ['easy','medium','hard'].entries())
   assert.equal(h.eval("rewardForRound(game,'"+mode+"','"+level+"')"),tiers[i],mode+'/'+level);
 assert.equal(h.eval('Object.isFrozen(QUIP_RULESETS[3].rewards.talk)'),true);
 assert.equal(h.eval('Object.isFrozen(QUIP_RULESETS[3].risk)'),true);
 assert.throws(()=>h.eval("rewardForRound(game,'unknown','medium')"),/Unknown mode/);
});
test('medium and hard grades pay the guesser with visible Secret reward',()=>{
 for(const [level,mode,reward] of [['medium','talk',2],['hard','talk',3],['medium','mime',3],
  ['hard','draw',4],['hard','sing',4],['medium','yesno',3],['hard','secret',5],['hard','blitz',3]]){
  const h=harness();
  h.eval("soundOn=false;options.difficulty='"+level+"';options.modes=['"+mode+"'];options.riskRounds=false;legacyGame();roll()");
  assert.equal(h.eval('game.current.points'),reward);
  h.pending.shift()(); // show task screen after carousel
  if(mode==='secret')assert.ok(h.elements.get('play-content').innerHTML.includes('+5 ОЧКОВ'));
  h.eval("game.current.blitzCorrect=5;game.phase='judge';judge(true)");
  assert.deepEqual(Array.from(h.eval('game.scores')),[0,reward]);
  assert.equal(h.eval('game.history[0].rulesVersion'),3);
  assert.equal(h.eval('game.history[0].difficulty'),level);
 }
});
test('risk is eligible after two turns, a deterministic 20% draw, and switchable',()=>{
 const h=harness();h.eval('soundOn=false;legacyGame()');
 assert.equal(h.eval('shouldSelectRisk(game,0)'),false);
 h.eval('game.roundIndex=2');
 assert.equal(h.eval('shouldSelectRisk(game,0.199999)'),true);
 assert.equal(h.eval('shouldSelectRisk(game,0.2)'),false);
 assert.equal(h.eval('shouldSelectRisk(game,1)'),false);
 assert.equal(h.eval('shouldSelectRisk(game,NaN)'),false);
 h.eval('game.riskRounds=false');
 assert.equal(h.eval('shouldSelectRisk(game,0)'),false);
});
test('risk settlement is pure, caps losses at current score, rewards success',()=>{
 const h=harness();h.eval('soundOn=false;legacyGame()');
 for(const [score,success,risk,expected] of [[0,false,true,0],[1,false,true,-1],
   [10,false,true,-2],[10,false,false,0],[1,true,true,5]]){
  const result=JSON.parse(h.eval("JSON.stringify(settleQuipRound(game,{modeId:'secret',points:5,risk:"+risk+"}, "+success+","+score+"))"));
  assert.equal(result.delta,expected);
  assert.equal(result.success,success);
  assert.equal(result.rulesVersion,3);
 }
 assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);
});
test('a saved V2 duel without rulesVersion retains flat points and risk',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval("soundOn=false;options.difficulty='hard';legacyGame();delete game.rulesVersion;game.scores=[10,10];persist()");
 const b=harness(stored);
 assert.equal(b.eval('game.rulesVersion'),undefined);
 assert.equal(b.eval('ruleSetForGame(game).version'),2);
 b.eval("game.modes=['talk'];roll()");
 assert.equal(b.eval('game.current.points'),1,'hard words in old V2 are still one point');
 b.eval("game.current.risk=true;game.phase='judge';judge(false)");
 assert.deepEqual(Array.from(b.eval('game.scores')),[10,8]);
 assert.equal(b.eval('game.history[0].rulesVersion'),2);
});
test('saved pre-V5 party retains setter points and per-word Blitz score',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval("soundOn=false;legacyGame();game.scoringVersion=undefined;delete game.rulesVersion;game.difficulty='hard';game.finishType='rounds';game.rounds=12;game.riskRounds=false;persist()");
 const b=harness(stored);
 assert.equal(b.eval('ruleSetForGame(game).version'),1);
 b.eval("game.modes=['blitz'];roll()");
 b.eval("game.current.blitzCorrect=2;game.current.risk=true;game.phase='judge';judge(true)");
 assert.deepEqual(Array.from(b.eval('game.scores')),[2,0]);
 assert.equal(b.eval('game.history[0].rulesVersion'),1);
});
test('new hard reward and rulesVersion persist across a reload',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval("soundOn=false;options.difficulty='hard';options.modes=['secret'];legacyGame();roll()");
 assert.equal(a.eval('game.current.points'),5);
 const b=harness(stored);
 assert.equal(b.eval('game.rulesVersion'),3);
 assert.equal(b.eval('game.current.points'),5);
 b.eval("game.phase='judge';judge(true)");
 assert.deepEqual(Array.from(b.eval('game.scores')),[0,5]);
});
test('offline engine scripts and old storage envelope are preserved',()=>{
 const h=harness();h.eval('soundOn=false;legacyGame()');
 assert.equal(h.eval('STORAGE_KEY'),'iskra-party:v1');
 assert.equal(JSON.parse(h.storage.get('iskra-party:v1')).version,1);
 const html=read('index.html'),sw=read('sw.js');
 const scripts=[...html.matchAll(/src="\.\/([^"]+\.js\?v=\d+)"/g)].map(match=>match[1]);
 for(const file of ['approx-questions.js','mode-config.js','rules.js','penalties.js','modifiers.js','round-planner.js','content-packs.js','presets.js','app.js']){
  const url=scripts.find(src=>src.startsWith(file+'?v='));assert.ok(url,file);assert.ok(sw.includes(url),url);
 }
 assert.match(sw,/const CACHE='kvip-pwa-v\d+-\d{8}-[a-z-]+'/);
});


test('modifier registry preserves every historical pool including duplicate weights',()=>{
 const h=harness(),crypto=require('node:crypto');
 const expected={
  "talk-easy": {
    "count": 6,
    "sha256": "8e417d77066ee4b00c40d695e8c8ac870531769b812c1c9a5644bdda6e3d37dd"
  },
  "mime-easy": {
    "count": 5,
    "sha256": "0b0e2ad9383046f0247204d071fc7d3d5061202fa62b60c40472b02b1f708bd6"
  },
  "draw-easy": {
    "count": 5,
    "sha256": "d4f3e18cbdf900c21625b94ef9cf317896e1d118fcad4cff2f423442a1feea1e"
  },
  "sing-easy": {
    "count": 5,
    "sha256": "79680aa09dd55682a4d6a6e8cc809565a6b504e3cd08e6f0fcfc8456ecd6d85f"
  },
  "yesno-easy": {
    "count": 4,
    "sha256": "6506dfd603e75690fec965a7b82bd01aae7ae7649f43592a076b3483e5e88361"
  },
  "blitz-easy": {
    "count": 3,
    "sha256": "4ae0872e68f1e5b6cc49aae17b0bcb5bfc98ed46feb01ca7ea5afab995f25191"
  },
  "talk-medium": {
    "count": 12,
    "sha256": "3b87cb2d38cdc0dd3eaba1f372d62099d4599710b7e5f04d9a7a10bae4fd53f9"
  },
  "mime-medium": {
    "count": 10,
    "sha256": "dc98e163a3c330d101383d49a18b656a62d67740a6091cec559853a5572a6ae4"
  },
  "draw-medium": {
    "count": 10,
    "sha256": "47b7707386218dfb857ebc7bd7e93c786707e3814086ebb37b21aaa9f0ab6004"
  },
  "sing-medium": {
    "count": 10,
    "sha256": "53994fc5f06d5f6ac0301c535c9bec56764f3b696dc82aaeb3cc9789972fc2d3"
  },
  "yesno-medium": {
    "count": 8,
    "sha256": "e134d433c395c4b1386899564ae44019c465f9eb63599990f58a8caf0b82b830"
  },
  "blitz-medium": {
    "count": 6,
    "sha256": "4744fe97a46a4d783b1c983ced68ae9aafa0cda82d0abbbc31f0bae4c1359474"
  },
  "talk-hard": {
    "count": 6,
    "sha256": "b6acfe6dcebf7ecb4887adc6a0c438aa932b61ff4c0c0e93063e85ad7dfd5a31"
  },
  "mime-hard": {
    "count": 5,
    "sha256": "90dd62bb859b2e4aeeeb42767f06b4142504f4b64154de65418d9dd3f2583822"
  },
  "draw-hard": {
    "count": 5,
    "sha256": "b1daa8a4e999571f7320e0e257bc88cae656a3844f35dded976ea4ba7feeb99d"
  },
  "sing-hard": {
    "count": 4,
    "sha256": "4d99fdb9322de61f81fece60a5998e7c58d2b235bb595fb9fead8d2bd7705b90"
  },
  "yesno-hard": {
    "count": 4,
    "sha256": "876a0af62c796fed38094c0ff6c29d4eb6d7ae357d9324c35be97bce6ebf6fae"
  },
  "blitz-hard": {
    "count": 4,
    "sha256": "9388a16d491168e16e0048b579b0d12cac466bf690e15aa3e014f5e9c6a83967"
  }
};
 const rows=JSON.parse(h.eval('JSON.stringify(QUIP_MODIFIERS)'));
 assert.equal(new Set(rows.map(m=>m.id)).size,rows.length);
 assert.equal(rows.length,112);
 for(const [key,ref] of Object.entries(expected)){
  const [mode,severity]=key.split('-');
  const texts=rows.filter(m=>m.modes.includes(mode)&&m.severity===severity).map(m=>m.text);
  assert.equal(texts.length,ref.count,key);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(texts)).digest('hex'),ref.sha256,key);
 }
 for(const mode of ['talk','mime','draw','sing','yesno','blitz'])
 for(const level of ['easy','medium','hard']){
  const pool=JSON.parse(h.eval('JSON.stringify(getModifierPool('+JSON.stringify(mode)+','+JSON.stringify(level)+'))'));
  assert.ok(pool.length>0);
  assert.ok(pool.every(m=>m.enabled&&m.modes.includes(mode)));
  assert.ok(pool.every(m=>['easy','medium','hard'].indexOf(m.severity)<=['easy','medium','hard'].indexOf(level)));
 }
 assert.equal(h.eval("getModifierPool('talk','hard',[{enabled:false,modes:['talk'],severity:'easy'}]).length"),0);
});
test('modifier selection obeys the 35% boundary and mandatory Secret restriction',()=>{
 const h=harness();
 assert.equal(h.eval("chooseModifier({modeId:'talk',methodId:'talk',difficulty:'hard',complications:false},()=>0)"),null);
 assert.equal(h.eval("chooseModifier({modeId:'talk',methodId:'talk',difficulty:'hard',complications:true},()=>.35)"),null);
 assert.ok(h.eval("chooseModifier({modeId:'talk',methodId:'talk',difficulty:'hard',complications:true},()=>.349999).id"));
 for(const allowed of [['secret'],['secret','mime'],['secret','draw','yesno']]){
  h.eval('soundOn=false;options.modes='+JSON.stringify(allowed)+';options.complications=false;legacyGame();pickMode=()=>getMode("secret")');
  for(let i=0;i<30;i++){
   h.eval("Math.random=()=>"+(i/30));
   const outcome=JSON.parse(h.eval("JSON.stringify(rollOutcome())"));
   assert.equal(outcome.modeId,'secret');
   const methods=allowed.length===1?['talk','mime','draw','sing','yesno']:allowed;
   assert.ok(methods.includes(outcome.methodId));
   assert.ok(outcome.complicationId&&outcome.complication);
  }
 }
});
test('saved modifier text and ID restore without selecting a replacement',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval("soundOn=false;options.modes=['secret'];options.dice=false;legacyGame();roll();persist()");
 const snapshot=a.eval('JSON.stringify(game.current)');
 const b=harness(stored);
 assert.equal(b.eval('JSON.stringify(game.current)'),snapshot);
 b.eval("delete game.current.complicationId;delete game.current.modifierVersion;game.current.complication='Старое неизменное ограничение';persist()");
 const old=harness(stored);
 assert.equal(old.eval('game.current.complication'),'Старое неизменное ограничение');
 assert.equal(old.eval('game.current.complicationId'),undefined);
});

test('paired Mix plans 2, 12 and 100 turns deterministically and balances every cycle',()=>{
 const h=harness();
 for(const count of [2,12,100]){
  h.eval('var plan=freshRoundPlan(),levels=[],rngCalls=0;');
  for(let i=0;i<count;i++){
   h.eval('var result=planRoundDifficulty(plan,'+i+',"mixed",()=>{rngCalls++;return .7});plan=result.state;levels.push(result.difficulty);');
   if(i%2)assert.equal(h.eval('levels['+i+']'),h.eval('levels['+(i-1)+']'));
  }
  const levels=Array.from(h.eval('levels'));
  for(let i=0;i+6<=count;i+=6)
   assert.deepEqual(levels.slice(i,i+6).sort(),['easy','easy','hard','hard','medium','medium']);
  const counts=['easy','medium','hard'].map(level=>levels.filter(x=>x===level).length);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=2);
  assert.equal(h.eval('rngCalls'),Math.ceil(count/6)*2);
 }
 // Fisher–Yates can produce every ordering using a controlled random source.
 const permutations=new Set();
 for(const a of [0,.34,.99])for(const b of [0,.99])
  permutations.add(h.eval('JSON.stringify(planRoundDifficulty(freshRoundPlan(),0,"mixed",(()=>{let values=['+a+','+b+'];return ()=>values.shift()})()).state.levels)'));
 assert.equal(permutations.size,6);
});
test('pair plans, active cards, used history and modifier survive reload without RNG',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval("soundOn=false;options.difficulty='mixed';options.modes=['talk'];options.dice=false;options.riskRounds=false;legacyGame();roll()");
 const level=a.eval('game.current.difficulty');
 const active=a.eval('JSON.stringify([game.current,game.used,game.plannerState])');
 const b=harness(stored);
 assert.equal(b.eval('JSON.stringify([game.current,game.used,game.plannerState])'),active);
 b.eval('game.phase="judge";judge(false)');
 const next=harness(stored);
 const plan=next.eval('JSON.stringify(game.plannerState)');
 next.eval("game.dice=false;Math.random=()=>.99;roll()");
 assert.equal(next.eval('game.current.difficulty'),level);
 assert.equal(next.eval('JSON.stringify(game.plannerState)'),plan);
 // Restoring the actual running timer also retains the complete selected outcome.
 next.eval('toggleWord();game.current.autoStartAt=Date.now()-1;tick();startTimer();persist()');
 const playing=next.eval('JSON.stringify(game.current)');
 const again=harness(stored);
 assert.equal(again.eval('JSON.stringify(game.current)'),playing);
});
test('reloading during the carousel opens its saved card and never draws twice',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval("soundOn=false;options.difficulty='mixed';options.modes=['secret'];legacyGame();roll()");
 assert.equal(a.eval('game.phase'),'rolling');
 const card=a.eval('JSON.stringify(game.current)'),used=a.eval('JSON.stringify(game.used)');
 const b=harness(stored);
 assert.equal(b.eval('game.phase'),'task');
 b.eval('continueGame();roll()');
 assert.equal(b.eval('JSON.stringify(game.current)'),card);
 assert.equal(b.eval('JSON.stringify(game.used)'),used);
});
test('paired Mix survives a threshold tie and additional complete pairs',()=>{
 const h=harness();
 h.eval("soundOn=false;options.difficulty='mixed';options.modes=['talk'];options.dice=false;options.riskRounds=false;legacyGame();game.scores=[100,100]");
 for(let i=0;i<8;i++){
  h.eval('roll()');
  const level=h.eval('game.current.difficulty');
  if(i%2===0)h.eval('var pairLevel=game.current.difficulty');
  else assert.equal(level,h.eval('pairLevel'));
  h.eval('game.phase="judge";judge(false)');
  assert.equal(h.eval('game.phase'),'ready','Tie must continue even after planned cycles');
 }
 h.eval('roll();game.phase="judge";judge(true)');
 assert.equal(h.eval('game.phase'),'ready','Reply still required');
 h.eval('roll();game.phase="judge";judge(false)');
 assert.equal(h.eval('game.phase'),'results');
});
test('fixed tiers do not consume planner RNG; Blitz remains easy words and three points',()=>{
 const h=harness();
 for(const level of ['easy','medium','hard']){
  assert.equal(h.eval('planRoundDifficulty(freshRoundPlan(),99,"'+level+'",()=>{throw Error("RNG consumed")}).difficulty'),level);
  h.eval('soundOn=false;options.modes=["blitz"];options.difficulty="'+level+'";options.dice=false;legacyGame();roll()');
  assert.equal(h.eval('game.current.points'),3);
  assert.equal(h.eval('game.current.blitzWords.every(w=>getPromptPool("blitz","easy").includes(w))'),true);
 }
 assert.equal(h.eval('game.rulesVersion'),3);
});
test('historical Mix without plannerVersion keeps independent difficulty draws',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval("soundOn=false;options.difficulty='mixed';legacyGame();delete game.plannerVersion;delete game.plannerState;persist()");
 const b=harness(stored);
 assert.equal(b.eval('game.plannerVersion'),undefined);
 b.eval('Math.random=()=>0');assert.equal(b.eval('chooseDifficulty()'),'easy');
 b.eval('Math.random=()=>.99');assert.equal(b.eval('chooseDifficulty()'),'hard');
 assert.equal(b.eval('game.plannerState'),undefined);
});
test('unsupported save/rule/planner versions never overwrite the original session',()=>{
 for(const update of ['saved.version=99','saved.game.rulesVersion=99',
  'saved.game.startingTeamIndex=99','saved.game.plannerVersion=99','saved.game.plannerState={cycleIndex:0,levels:["easy","easy","hard"]}']){
  const stored=new Map(),a=harness(stored);a.eval('soundOn=false;legacyGame()');
  const saved=JSON.parse(stored.get('iskra-party:v1'));
  eval(update);
  const original=JSON.stringify(saved);stored.set('iskra-party:v1',original);
  const b=harness(stored);
  assert.equal(b.eval('game'),null);assert.equal(b.eval('storageBlocked'),true);
  b.eval('openSetup();legacyGame();persist()');
  assert.equal(stored.get('iskra-party:v1'),original);
 }
 const h=harness();
 assert.throws(()=>h.eval('planRoundDifficulty(freshRoundPlan(),1,"mixed",()=>0)'),/Missing QUIP plan/);
});


test('completed 12-turn Mix restores results at a cycle boundary without blocking saves',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval("soundOn=false;options.difficulty='mixed';options.finishType='rounds';options.rounds=12;options.modes=['talk'];options.dice=false;legacyGame()");
 for(let i=0;i<12;i++)a.eval('roll();game.phase="judge";judge(false)');
 assert.equal(a.eval('game.phase'),'results');
 const b=harness(stored);
 assert.equal(b.eval('storageBlocked'),false);
 assert.equal(b.eval('game.phase'),'results');
 b.eval('legacyGame()');assert.equal(b.eval('game.phase'),'ready');
});


test('leaving the carousel for the menu preserves its selected card on Continue',()=>{
 const h=harness();
 h.eval("soundOn=false;options.difficulty='mixed';legacyGame();roll()");
 const selected=h.eval('JSON.stringify([game.current,game.used,game.plannerState])');
 h.eval('backToMenu();continueGame();roll()');
 assert.equal(h.eval('game.phase'),'task');
 assert.equal(h.eval('JSON.stringify([game.current,game.used,game.plannerState])'),selected);
});

test('general pack preserves all existing pools, IDs, types and difficulties',()=>{
 const originalIds=new Set(require('../scripts/content.cjs').readDataset().sources.filter(s=>s.kind==='cards'&&s.immutable).flatMap(s=>s.rows.map(c=>c.id)));
 const h=harness();h.eval('soundOn=false;legacyGame()');
 assert.equal(h.eval('PARTY_CARDS.filter(c=>Number(c.id.split("-")[1])<8000).length'),3016);
 for(const kind of ['words','songs','people','blitz'])for(const level of ['easy','medium','hard']){
  const expected=Array.from(h.eval('getCardPool("'+kind+'","'+level+'",game.promptTypes).map(c=>c.id)')).filter(id=>originalIds.has(id)).sort();
  const actual=Array.from(h.eval('getPackCardPool(game.contentPack,"'+kind+'","'+level+'",game.promptTypes).map(c=>c.id)')).sort();
  assert.deepEqual(actual,expected,kind+'/'+level);
 }
 assert.equal(h.eval('checkContentPack(game.contentPack,{...options,difficulty:"mixed"}).available'),true);
});
test('custom registries filter categories, sources, IDs and reject duplicates or types',()=>{
 const h=harness();
 h.eval(`var fixtureCards=[
  {id:'a',text:'КОТ',type:'word',difficulty:'easy',categories:['animals'],pack:'custom'},
  {id:'b',text:'ДОМ',type:'word',difficulty:'easy',categories:['geography'],pack:'custom'},
  {id:'c',text:'ПЁС',type:'word',difficulty:'hard',categories:['animals'],pack:'custom'},
  {id:'d',text:'ЛЕВ',type:'word',difficulty:'easy',categories:['animals'],pack:'other'},
  {id:'a',text:'КОТ',type:'word',difficulty:'easy',categories:['animals'],pack:'custom'}];
  var descriptor={id:'custom-animals',version:1,name:'Тест',enabled:true,categories:['animals'],
   types:['word'],criteria:{cardIds:['a','c','d'],sourcePacks:['custom']},minCardsPerPool:1};
  var registry=defineContentPacks([descriptor]);var selection={id:'custom-animals',version:1};`);
 assert.deepEqual(Array.from(h.eval('getPackCardPool(selection,"words","easy",["word"],fixtureCards,registry).map(c=>c.id)')),['a']);
 assert.deepEqual(Array.from(h.eval('getPackCardPool(selection,"words","hard",["word"],fixtureCards,registry).map(c=>c.id)')),['c']);
 assert.equal(h.eval('getPackCardPool(selection,"songs","easy",null,fixtureCards,registry).length'),0);
 assert.throws(()=>h.eval('defineContentPacks([descriptor,descriptor])'),/duplicate/);
 assert.throws(()=>h.eval('defineContentPacks([{...descriptor,types:["bogus"]}])'),/types/);
 assert.throws(()=>h.eval('getPackCardPool(selection,"words","easy",["person"],fixtureCards,registry)'),/Incompatible/);
 assert.equal(h.eval('checkContentPack(selection,{difficulty:"easy",modes:["sing"],promptTypes:["word"]},fixtureCards,registry).available'),false);
 assert.equal(h.eval('checkContentPack(selection,{difficulty:"easy",modes:["blitz"],promptTypes:["word"]},fixtureCards,registry).available'),false,'Blitz needs five unique texts');
 assert.equal(h.eval('checkContentPack(selection,{difficulty:"easy",modes:["secret"],promptTypes:["word"]},fixtureCards,registry).available'),false,'Secret-only must support all five methods');
 assert.equal(h.eval('checkContentPack(selection,{difficulty:"mixed",modes:["talk"],promptTypes:["word"]},fixtureCards,registry).available'),false,'Missing medium cannot silently use another tier');
});
test('disabled historical theme stays unavailable without fallback and cannot replace an active match',()=>{
 const h=harness();h.eval('soundOn=false;legacyGame();game.scores=[7,8];persist()');
 const before=h.eval('JSON.stringify(game)');
 assert.equal(h.eval('checkContentPack({id:"geography",version:1},options).available'),false);
 h.eval('options.contentPack={id:"geography",version:1};legacyGame()');
 assert.equal(h.eval('JSON.stringify(game)'),before);
 assert.equal(h.eval('getPackCardPool({id:"geography",version:1},"words","easy").every(card=>card.categories.includes("geography"))'),true);
 assert.throws(()=>h.eval('getContentPack({id:"missing",version:1})'),/Unknown/);
});
test('declarative presets are versioned snapshots independent of existing matches',()=>{
 const h=harness();
 const keys=Array.from(h.eval('Object.keys(QUIP_PARTY_PRESETS)'));
 assert.equal(keys.length,new Set(keys).size);
 assert.equal(h.eval('Object.isFrozen(QUIP_PARTY_PRESETS["classic-duel@1"].settings.modes)'),true);
 assert.throws(()=>h.eval('definePartyPresets([QUIP_PARTY_PRESETS["classic-duel@1"],QUIP_PARTY_PRESETS["classic-duel@1"]])'),/duplicate/);
 assert.throws(()=>h.eval('optionsForPartyPreset("thematic",1)'),/Unavailable/);
 h.eval('soundOn=false;options=optionsForPartyPreset("classic-duel",1,{duration:45});legacyGame()');
 const before=h.eval('JSON.stringify(game)');
 h.eval('options=optionsForPartyPreset("hardcore",1);options.modes.pop();options.contentPack.id="future"');
 assert.equal(h.eval('JSON.stringify(game)'),before);
 assert.equal(h.eval('game.duration'),45);
 assert.equal(h.eval('game.preset.id'),'classic-duel');
 assert.equal(h.eval('QUIP_PARTY_PRESETS["hardcore@1"].settings.modes.length'),7);
});
test('old general matches and new content selections restore without migration',()=>{
 for(const legacy of [false,true]){
  const stored=new Map(),a=harness(stored);a.eval('soundOn=false;legacyGame();roll()');
  if(legacy)a.eval('delete game.contentPack;delete game.preset');
  a.eval('persist()');const card=a.eval('JSON.stringify(game.current)');
  const b=harness(stored);
  assert.equal(b.eval('JSON.stringify(game.current)'),card);
  assert.equal(b.eval('storageBlocked'),false);
  if(legacy)assert.equal(b.eval('game.contentPack'),undefined);
  else assert.equal(b.eval('game.contentPack.version'),1);
 }
 const stored=new Map(),a=harness(stored);a.eval('soundOn=false;legacyGame();game.contentPack.version=999;persist()');
 const original=stored.get('iskra-party:v1'),b=harness(stored);b.eval('persist();legacyGame()');
 assert.equal(b.eval('storageBlocked'),true);assert.equal(stored.get('iskra-party:v1'),original);
});

test('small Blitz pools do not repeat a word across a used-history reset',()=>{
 const h=harness();h.eval("soundOn=false;options.modes=['blitz'];options.dice=false;legacyGame();Math.random=()=>0;getPromptPool=()=>['КОТ','ДОМ','ЛЕС','ЛЕВ','ПЁС','НОС'];");
 for(let i=0;i<4;i++){
  h.eval('game.phase="ready";roll()');
  const words=Array.from(h.eval('game.current.blitzWords'));
  assert.equal(words.length,5);assert.equal(new Set(words).size,5);
 }
});
test('preset overrides reject invalid settings and preserve declared versions',()=>{
 const h=harness();
 for(const update of ['{duration:999}','{difficulty:"impossible"}','{rounds:3}','{modes:["bogus"]}','{targetScore:0}'])
  assert.throws(()=>h.eval('optionsForPartyPreset("classic-duel",1,'+update+')'),/Invalid/);
 h.eval('var firstPreset=QUIP_PARTY_PRESETS["classic-duel@1"];var versions=definePartyPresets([firstPreset,{...firstPreset,version:2,settings:{...firstPreset.settings,duration:30}}]);');
 assert.equal(h.eval('optionsForPartyPreset("classic-duel",1,{},versions).duration'),60);
 assert.equal(h.eval('optionsForPartyPreset("classic-duel",2,{},versions).duration'),30);
});


test('new matches draw each starter once, alternate roles, preserve scores and reply fairness',()=>{
 for(const roll of [0,.499999,.5,.999999]){
  const h=harness(new Map(),true),starter=roll<.5?0:1,guesser=(starter+1)%2;
  h.eval('soundOn=false;options.modes=["talk"];options.dice=false;options.riskRounds=false;options.finishType="rounds";options.rounds=2;var draws=0;Math.random=()=>{draws++;return '+roll+'};legacyGame()');
  assert.equal(h.eval('draws'),1);
  assert.equal(h.eval('game.startingTeamIndex'),starter);
  assert.equal(h.eval('currentTeamIndex()'),starter);assert.equal(h.eval('guessingTeamIndex()'),guesser);
  h.eval('roll();game.phase="judge";judge(true)');
  assert.equal(h.eval('game.scores['+guesser+']'),1);
  assert.equal(h.eval('currentTeamIndex()'),guesser);
  h.eval('roll();game.phase="judge";judge(true)');
  assert.deepEqual(Array.from(h.eval('game.scores')),[1,1]);assert.equal(h.eval('game.phase'),'results');
 }
});
test('random starter persists; old saves without it retain the original first player',()=>{
 const stored=new Map(),a=harness(stored,true);
 a.eval('soundOn=false;Math.random=()=>.99;legacyGame();persist()');
 const b=harness(stored,true);
 assert.equal(b.eval('game.startingTeamIndex'),1);assert.equal(b.eval('currentTeamIndex()'),1);
 b.eval('Math.random=()=>{throw Error("Restoration consumed RNG")};continueGame()');
 b.eval('delete game.startingTeamIndex;persist()');
 const old=harness(stored,true);
 assert.equal(old.eval('game.startingTeamIndex'),undefined);assert.equal(old.eval('currentTeamIndex()'),0);
});
test('a score-threshold match grants a reply for either selected starter',()=>{
 for(const starter of [0,1]){
  const h=harness();
  h.eval('soundOn=false;chooseStartingTeam=()=>'+starter+';options.modes=["talk"];options.dice=false;options.riskRounds=false;options.targetScore=15;legacyGame();game.scores=[14,14];roll();game.phase="judge";judge(true)');
  assert.equal(h.eval('game.phase'),'ready');
  h.eval('roll();game.phase="judge";judge(false)');assert.equal(h.eval('game.phase'),'results');
  assert.equal(h.eval('game.scores['+((starter+1)%2)+']'),15);
 }
});


test('other-games navigation preserves the unfinished match and has six inert placeholders',()=>{
 const h=harness();h.eval('soundOn=false;legacyGame();backToMenu()');
 const before=h.eval('JSON.stringify(game)');
 h.eval('setScene("other-games")');assert.equal(h.eval('activeScene'),'other-games');
 h.eval('setScene("home");continueGame()');
 assert.equal(h.eval('JSON.stringify(game)'),before);
 const html=read('index.html');
 assert.equal((html.match(/class="other-game-tile"/g)||[]).length,6);
 assert.doesNotMatch(html.match(/<ul class="other-games-grid"[\s\S]*?<\/ul>/)[0],/<a|<button/);
 assert.ok(html.includes('МИНИМАЛЬНОЕ ВРЕМЯ'));assert.ok(html.includes('МАКСИМУМ ОЧКОВ'));
});

// Every approved icon must be a valid WebP file, including the reserved approx art.
test('all eight active mode icons exist and load from versioned URLs',()=>{
  const h=harness(),assets=JSON.parse(h.eval('JSON.stringify(MODE_ASSETS)'));
  const modes=['talk','mime','draw','sing','yesno','secret','blitz','approx'];
  assert.deepEqual(Object.keys(assets),modes);
  assert.equal(h.eval('DEFAULT_MODES.includes("approx")'),true);
  const sw=read('sw.js'),html=read('index.html');
  assert.ok(html.includes("mode-images.js?v=6"));
  assert.match(sw,/const CACHE='kvip-pwa-v\d+-\d{8}-[a-z-]+'/);
  for(const mode of modes){
    assert.equal(assets[mode],'./assets/modes/'+mode+'.webp?v=3');
    assert.ok(sw.includes("'approx'")||mode!=='approx');
    const file=fs.readFileSync(path.join(__dirname,'..','assets','modes',mode+'.webp'));
    assert.ok(file.length>1000,mode+' is empty');
    assert.equal(file.toString('ascii',0,4),'RIFF',mode+' RIFF header');
    assert.equal(file.toString('ascii',8,12),'WEBP',mode+' WebP header');
  }
});

test('V4 fixed rewards cover all eight configured modes and all difficulties',()=>{
 const h=harness();h.eval('soundOn=false;v4Game()');
 assert.equal(h.eval('game.rulesVersion'),4);assert.equal(h.eval('game.modeConfigVersion'),1);
 const base={talk:1,mime:1,draw:1,sing:1,yesno:2,secret:2,blitz:2,approx:1};
 for(const [mode,points] of Object.entries(base))for(const level of ['easy','medium','hard']){
  assert.equal(h.eval('rewardForRound(game,"'+mode+'","'+level+'")'),points);
  assert.equal(h.eval('rewardForRound(game,"'+mode+'","'+level+'",true)'),points+(mode==='approx'?0:1));
 }
 assert.equal(h.eval('getModeConfig("approx").usesTimer'),false);
 assert.equal(h.eval('getModeConfig("approx").allowsRisk'),false);
 assert.equal(h.eval('getModeConfig("approx").supportsSharedAward'),true);
 assert.equal(h.eval('Object.isFrozen(QUIP_MODE_CONFIGS[1].talk)'),true);
});
test('V4 modifier bonus is snapshotted, paid once on success and absent on failure',()=>{
 for(const success of [true,false])for(const mode of ['talk','mime','draw','sing','yesno','secret']){
  const h=harness();h.eval('soundOn=false;options.awardTo="guesser";options.modes=["'+mode+'"];options.dice=false;options.riskRounds=false;Math.random=()=>0;v4Game();roll()');
  const base=h.eval('game.current.basePoints');
  assert.ok(h.eval('game.current.complication'));
  assert.equal(h.eval('game.current.modifierPoints'),1);assert.equal(h.eval('game.current.points'),base+1);
  h.eval('game.phase="judge";judge('+success+');judge(true)');
  assert.equal(h.eval('game.scores[1]'),success?base+1:0);
  assert.equal(h.eval('game.history[0].awarded'),success?base+1:0);
  assert.equal(h.eval('game.history[0].modifierPoints'),success?1:0);
  assert.equal(h.eval('game.history[0].rulesVersion'),4);
 }
 const h=harness();h.eval('soundOn=false;options.awardTo="guesser";options.modes=["secret"];options.complications=false;options.dice=false;v4Game();roll()');
 assert.equal(h.eval('game.current.points'),3,'Secret always includes the bonus');
});
test('V4 Blitz draws three unique easy words and requires all three for two base points',()=>{
 for(const correct of [0,1,2,3])for(const complication of [false,true]){
  const h=harness();h.eval('soundOn=false;options.awardTo="guesser";options.modes=["blitz"];options.dice=false;options.riskRounds=false;options.complications='+complication+';Math.random=()=>0;v4Game();roll()');
  assert.equal(h.eval('game.current.blitzWords.length'),3);assert.equal(h.eval('game.current.blitzQueue.length'),3);
  assert.equal(new Set(h.eval('game.current.blitzWords')).size,3);
  h.eval('game.current.blitzCorrect='+correct+';game.phase="judge";judge(true)');
  assert.equal(h.eval('game.scores[1]'),correct===3?(complication?3:2):0);
 }
});
test('V4 reload preserves the chosen total, bonus, count and current timer state',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval('soundOn=false;options.modes=["blitz"];options.dice=false;Math.random=()=>0;v4Game();roll();toggleWord();startTimer();persist()');
 const snapshot=a.eval('JSON.stringify(game.current)');
 const b=harness(stored);assert.equal(b.eval('JSON.stringify(game.current)'),snapshot);
 b.eval('game.current.blitzCorrect=3;game.phase="judge";judge(true)');
 assert.equal(b.eval('game.history[0].awarded'),3);
 assert.equal(b.eval('game.history[0].basePoints'),2);
});
test('V1 V2 V3 historical definitions and five-word outcomes stay intact alongside V4',()=>{
 const h=harness();
 for(const version of [1,2,3]){
  h.eval('soundOn=false;options.modes=["blitz"];options.dice=false;legacyGame('+version+');roll()');
  assert.equal(h.eval('game.current.blitzWords.length'),5);
  assert.equal(h.eval('QUIP_RULESETS['+version+'].blitzRequired'),5);
  assert.equal(h.eval('game.current.points'),3);
 }
 h.eval('game.rulesVersion=4;game.roundIndex=2');
 assert.equal(h.eval('shouldSelectRisk(game,0,"approx")'),false);
});
test('Approx catalog has 60 stable unique questions, sources and 20 per tier',()=>{
 const h=harness(),rows=JSON.parse(h.eval('JSON.stringify(QUIP_APPROX_QUESTIONS.filter(q=>Number(q.id.slice(7))<8000))'));
 assert.equal(rows.length,60);assert.equal(new Set(rows.map(q=>q.id)).size,60);
 assert.equal(new Set(rows.map(q=>q.question)).size,60);
 for(const level of ['easy','medium','hard'])assert.equal(rows.filter(q=>q.difficulty===level).length,20);
 for(const q of rows){
  assert.match(q.id,/^approx-\d{4}$/);assert.ok(q.answer&&q.question&&q.categories.length&&q.source);
  if(q.source.startsWith('formula:'))assert.equal(Number(q.answer),vm.runInNewContext(q.source.slice(8)));
 }
 assert.equal(h.eval('checkContentPack({id:"general",version:2},freshOptions()).available'),true);
 assert.equal(h.eval('getPackQuestionPool({id:"general",version:1},"easy").length'),0);
});
test('Approx question snapshots have no timer, modifier or risk at every difficulty',()=>{
 for(const level of ['easy','medium','hard']){
  const h=harness();h.eval('soundOn=false;options.modes=["approx"];options.dice=false;options.difficulty="'+level+'";Math.random=()=>0;newGame();game.roundIndex=4;roll()');
  assert.equal(h.eval('game.current.question.difficulty'),level);
  assert.equal(h.eval('game.current.word'),h.eval('game.current.question.question'));
  assert.equal(h.eval('game.current.risk'),false);assert.equal(h.eval('game.current.complication'),'');
  assert.equal(h.eval('game.current.points'),1);assert.equal(h.eval('game.current.seconds'),0);
  const before=h.eval('JSON.stringify(game.current)');
  h.eval('toggleWord();startTimer();replaceWord();pauseTimer();resumeTimer();beginAutomaticRound();tick();finishTimer("early");judge(true);awardApprox("both")');
  assert.equal(h.eval('game.phase'),'task');assert.equal(h.eval('JSON.stringify(game.current)'),before);
  assert.equal(h.eval('game.roundIndex'),4);assert.ok(!h.elements.get('play-content').innerHTML.includes('timer-ring'));
 }
});
test('Approx awards all four manual choices once and records recipients, answer and deltas',()=>{
 for(const [choice,deltas] of Object.entries({a:[1,0],b:[0,1],both:[1,1],none:[0,0]})){
  const h=harness();h.eval('soundOn=false;options.modes=["approx"];options.dice=false;newGame();roll();revealApprox()');
  const answer=h.eval('game.current.question.answer');
  assert.equal((h.elements.get('play-content').innerHTML.match(/data-action="award-/g)||[]).length,4);
  h.eval('awardApprox("'+choice+'");awardApprox("both");judge(true)');
  assert.deepEqual(Array.from(h.eval('game.scores')),deltas);assert.equal(h.eval('game.roundIndex'),1);
  assert.equal(h.eval('game.history.length'),1);assert.equal(h.eval('game.history[0].answer'),answer);
  assert.equal(h.eval('game.history[0].sharedAward'),choice==='both');
  assert.deepEqual(Array.from(h.eval('game.history[0].deltas')),deltas);
  const html=h.eval('historyMarkup(game.history[0],0)');
  assert.ok(html.includes('ПРИМЕРНО')&&html.includes('Ответ:'));
  assert.ok(html.includes(choice==='both'?'Обе команды':choice==='none'?'Никому':choice==='a'?'Молнии':'Кометы'));
 }
});
test('Approx reload preserves question, answer and reveal state before and after disclosure',()=>{
 for(const revealed of [false,true]){
  const stored=new Map(),a=harness(stored);
  a.eval('soundOn=false;options.modes=["approx"];options.dice=false;options.difficulty="mixed";newGame();roll()');
  if(revealed)a.eval('revealApprox()');
  a.eval('game.dice=true;persist()');
  const before=a.eval('JSON.stringify(game)');
  const b=harness(stored);b.eval('continueGame()');
  assert.equal(b.eval('JSON.stringify(game)'),before);
  assert.equal(b.eval('game.phase'),revealed?'judge':'task');
  if(!revealed)b.eval('revealApprox()');
  b.eval('awardApprox("both")');assert.deepEqual(Array.from(b.eval('game.scores')),[1,1]);
 }
});
test('Approx exhausts each tier before repeats and preserves full-pair match completion',()=>{
 const h=harness();h.eval('soundOn=false;options.modes=["approx"];options.dice=false;newGame();Math.random=()=>0');
 const ids=[];
 for(let i=0;i<20;i++){h.eval('roll()');ids.push(h.eval('game.current.question.id'));h.eval('revealApprox();awardApprox("none")');}
 assert.equal(new Set(ids).size,20);
 h.eval('game.targetScore=15;game.scores=[14,14];roll();revealApprox();awardApprox("a")');assert.equal(h.eval('game.phase'),'ready');
 h.eval('roll();revealApprox();awardApprox("both")');assert.equal(h.eval('game.phase'),'results');
 assert.deepEqual(Array.from(h.eval('game.scores')),[16,15]);
});


test('live catalog counters use active pack IDs and not the historical archive',()=>{
 const h=harness();
 h.eval('openGameType()');
 const general=h.elements.get('standard-content-count').textContent.replace(/\s/g,' ');
 const thematic=h.elements.get('thematic-content-count').textContent.replace(/\s/g,' ');
 assert.equal(general,'(5 350 заданий)');
 const expectedIds=h.eval('new Set(listThematicPacks(options).filter(entry=>entry.pack.enabled&&entry.pack.criteria.cardIds.length).flatMap(entry=>entry.pack.criteria.cardIds)).size');
 assert.equal(thematic.replace(/[^\d]/g,''),String(expectedIds));
 h.eval('openThemes()');
 const markup=h.elements.get('theme-list').innerHTML;
 assert.ok(markup.includes('>406</span>'), 'Geography shows the catalog count');
 assert.ok(markup.includes('>582</span>'), 'Science shows the catalog count');
 assert.ok(!markup.includes('Выбрать тему'), 'No verbose labels for enabled themes');
 assert.ok(markup.includes('Скоро'), 'Future themes remain marked soon');
 assert.equal(h.eval('options.contentPack.id'),'general','Navigation must not switch packs or modify saved settings');
});
test('game-type navigation uses shared settings and preserves an unfinished match',()=>{
 const h=harness();h.eval('soundOn=false;newGame();game.scores=[7,8];backToMenu()');
 const saved=h.eval('JSON.stringify(game)');
 h.eval('openGameType()');assert.equal(h.eval('activeScene'),'game-type');
 h.eval('openThemes()');assert.equal(h.eval('activeScene'),'themes');
 assert.equal((h.elements.get('theme-list').innerHTML.match(/ disabled aria-disabled="true"/g)||[]).length,3);
 assert.ok(h.elements.get('themes-caption').textContent.includes('Выберите тему'));
 h.eval('selectStandardGame()');assert.equal(h.eval('activeScene'),'setup');
 assert.equal(h.eval('options.contentPack.id'),'general');assert.equal(h.eval('options.contentPack.version'),h.eval('latestGeneralPackSelection().version'));
 assert.equal(h.eval('setupReturn'),'game-type');
 assert.equal(h.eval('JSON.stringify(game)'),saved);
 h.eval('setScene("home");continueGame()');assert.equal(h.eval('JSON.stringify(game)'),saved);
});
test('all six historical topic versions remain disabled and cannot start or silently use general',()=>{
 const h=harness();h.eval('soundOn=false;newGame();game.scores=[4,9];backToMenu()');
 const gameBefore=h.eval('JSON.stringify(game)'),optionsBefore=h.eval('JSON.stringify(options)');
 const themes=JSON.parse(h.eval('JSON.stringify(Object.values(QUIP_CONTENT_PACKS).filter(pack=>pack.id!=="general"&&pack.version===1).map(pack=>({pack,...checkContentPack({id:pack.id,version:pack.version},options)})))'));
 assert.deepEqual(themes.map(entry=>entry.pack.id),['geography','biology','animals','history','science','culture']);
 for(const {pack,available} of themes){
  assert.equal(available,false);assert.equal(h.eval('selectTheme("'+pack.id+'",'+pack.version+')'),false);
  assert.equal(h.eval('JSON.stringify(options)'),optionsBefore);
  h.eval('options.contentPack={id:"'+pack.id+'",version:'+pack.version+'};newGame()');
  assert.equal(h.eval('JSON.stringify(game)'),gameBefore);
  h.eval('options.contentPack=freshOptions().contentPack');
 }
 assert.equal(h.eval('selectTheme("missing",1)'),false);
 assert.equal(h.eval('selectTheme("general",2)'),false);
});
const fixtureTopic={id:'fixture-topic',version:1,name:'Тестовая тема',enabled:true,categories:[],types:['word'],
 criteria:{cardIds:['word-000001','word-000002','word-000003'],sourcePacks:['core']},minCardsPerPool:1};
test('populated fixture topic selects the same setup, filters cards and restores the selection',()=>{
 const storage=new Map(),a=harness(storage,false,fixtureTopic);
 a.eval('soundOn=false;options.modes=["talk"];options.promptTypes=["word"];options.dice=false;options.duration=45;openGameType();openThemes()');
 assert.equal(a.eval('selectTheme("fixture-topic",1)'),true);
 assert.equal(a.eval('activeScene'),'setup');assert.equal(a.eval('setupReturn'),'themes');
 assert.equal(a.elements.get('setup-pack-caption').textContent,'Тестовая тема');
 a.eval('newGame();roll()');assert.equal(a.eval('game.contentPack.id'),'fixture-topic');
 assert.equal(a.eval('game.duration'),45);
 assert.ok(['КАРАНДАШ','СУНДУК','ПУЗЫРЬ'].includes(a.eval('game.current.word')));
 const selected=a.eval('JSON.stringify([game.contentPack,game.current,game.used])');
 const b=harness(storage,false,fixtureTopic);b.eval('continueGame()');
 assert.equal(b.eval('JSON.stringify([game.contentPack,game.current,game.used])'),selected);
 assert.equal(b.eval('options.contentPack.id'),'fixture-topic');
 const before=b.eval('JSON.stringify(game)');
 b.eval('openGameType();selectStandardGame()');
 assert.equal(b.eval('options.contentPack.id'),'general');assert.equal(b.eval('options.duration'),45);
 assert.equal(b.eval('JSON.stringify(game)'),before);
 b.eval('options.modes=["talk"];newGame()');assert.equal(b.eval('game.contentPack.id'),'general');
});
test('enabled but incomplete topic is disabled for the selected modes and levels',()=>{
 const h=harness(new Map(),false,fixtureTopic);
 assert.equal(h.eval('listThematicPacks(options).find(entry=>entry.pack.id==="fixture-topic").available'),false);
 h.eval('options.modes=["talk"];options.promptTypes=["word"];options.difficulty="mixed"');
 assert.equal(h.eval('selectTheme("fixture-topic",1)'),false);
 h.eval('options.difficulty="easy"');assert.equal(h.eval('selectTheme("fixture-topic",1)'),true);
 h.eval('options.difficulty="hard";newGame()');assert.equal(h.eval('game'),null);
});
test('advanced folds reset on entry while selected settings and custom values stay intact',()=>{
 const h=harness();h.eval('options.modes=["talk","approx"];options.promptTypes=["idiom"];options.duration=75;options.targetScore=35;persist()');
 const stored=h.storage.get('iskra-party:v1'),before=h.eval('JSON.stringify(options)');
 h.eval('$("mode-settings").open=true;$("content-settings").open=true;openAdvanced()');
 assert.equal(h.elements.get('mode-settings').open,false);assert.equal(h.elements.get('content-settings').open,false);
 assert.equal(h.elements.get('mode-selection-count').textContent,'2 ИЗ 8');
 assert.equal(h.elements.get('content-selection-count').textContent,'1 ИЗ 3');
 h.eval('$("mode-settings").open=true;closeAdvanced();openAdvanced()');
 assert.equal(h.elements.get('mode-settings').open,false);assert.equal(h.eval('JSON.stringify(options)'),before);
 assert.equal(h.storage.get('iskra-party:v1'),stored,'Fold state must not introduce save fields or writes');
 const reloaded=harness(h.storage);assert.deepEqual(JSON.parse(reloaded.eval('JSON.stringify(options)')),JSON.parse(before));
 assert.equal(reloaded.elements.get('score-goal-preview').textContent,'35 очков');
 assert.equal(reloaded.elements.get('base-duration-value').textContent,'75 с');
});


test('rules guide describes V4 while historical matches and saves remain untouched',()=>{
 const h=harness();h.eval("$('base-duration').min='30';$('base-duration').max='90'");
 assert.deepEqual(Array.from(h.eval('RULES_GUIDE_ORDER')),['general','talk','mime','draw','sing','yesno','secret','blitz','approx']);
 for(const version of [1,2,3,4]){
  h.eval('soundOn=false;legacyGame('+version+');game.current=rollOutcome();game.phase="task";persist()');
  const stored=h.storage.get('iskra-party:v1'),match=h.eval('JSON.stringify(game)');
  const pages=h.eval('RULES_GUIDE_ORDER.map(rulesGuidePage)');
  assert.equal(pages[7].reward,'+2 за успех');
  assert.match(JSON.stringify(pages[7]),/3\/3 → \+2/);
  assert.doesNotMatch(JSON.stringify(pages[7]),/5 слов|5\/5/);
  assert.equal(pages[6].reward,'+2 + 1 = +3 за успех');
  assert.match(JSON.stringify(pages[8]),/Таймера нет/);
  assert.match(JSON.stringify(pages[8]),/Риска и усложнений нет/);
  assert.equal(h.eval('JSON.stringify(game)'),match);
  assert.equal(h.storage.get('iskra-party:v1'),stored);
 }
});
test('guide timing follows the settings range and each configured mode bonus',()=>{
 const h=harness();h.eval("$('base-duration').min='35';$('base-duration').max='85'");
 assert.match(h.eval("JSON.stringify(rulesGuidePage('draw'))"),/35–85 с.*\+30 с/);
 assert.match(h.eval("JSON.stringify(rulesGuidePage('talk'))"),/35–85 с.*Без добавочного времени/);
 assert.match(h.eval("JSON.stringify(rulesGuidePage('secret'))"),/\+0 или \+30 с/);
 assert.doesNotMatch(h.eval("JSON.stringify(rulesGuidePage('approx'))"),/35–85/);
});

test('new award defaults select the setter and leave immutable presets intact',()=>{
 const h=harness();assert.equal(h.eval('options.awardTo'),'setter');
 assert.equal(h.eval('options.modes.includes("yesno")'),false);
 assert.equal(h.eval('QUIP_PARTY_PRESETS["classic-duel@3"].settings.modes.includes("yesno")'),true);
 h.eval('soundOn=false;newGame()');assert.equal(h.eval('game.awardPolicyVersion'),1);assert.equal(h.eval('game.awardTo'),'setter');
 assert.equal(h.eval('game.scoringVersion'),2);assert.equal(h.eval('game.rulesVersion'),5);
});
test('award selection removes incompatible modes without a fallback and blocks manual reactivation',()=>{
 const h=harness();h.eval('options.awardTo="guesser";options.modes=DEFAULT_MODES.slice();selectAwardTo("setter")');
 assert.equal(h.eval('options.modes.includes("yesno")'),false);assert.equal(h.eval('options.modes.length'),7);
 assert.equal(h.eval('selectSetupMode("yesno",true)'),false);
 const modes=h.eval('JSON.stringify(options.modes)');h.eval('selectAwardTo("guesser")');assert.equal(h.eval('JSON.stringify(options.modes)'),modes);
 h.eval('options.modes=["yesno"];selectAwardTo("setter")');assert.deepEqual(Array.from(h.eval('options.modes')),[]);assert.match(h.elements.get('toast').textContent,/Выберите/);
});
test('award policy routes success, risk and full Blitz to either role without changing roles',()=>{
 for(const policy of ['setter','guesser'])for(const starter of [0,1])for(const mode of ['talk','blitz'])for(const success of [true,false]){
  const h=harness();h.eval('soundOn=false;options.awardTo="'+policy+'";options.modes=["'+mode+'"];options.dice=false;options.complications=false;chooseStartingTeam=()=>'+starter+';newGame();roll();game.scores=[5,5];game.current.risk=true;game.current.blitzCorrect=3;game.phase="judge"');
  const setter=h.eval('currentTeamIndex()'),guesser=h.eval('guessingTeamIndex()'),recipient=policy==='setter'?setter:guesser;
  assert.equal(setter,starter);assert.equal(guesser,1-starter);assert.equal(h.eval('awardTeamIndex()'),recipient);
  const base=mode==='blitz'?2:1;h.eval('judge('+success+');judge(true)');
  const expected=[5,5];expected[recipient]+=success?base:-2;
  assert.deepEqual(Array.from(h.eval('game.scores')),expected);
  assert.equal(h.eval('game.history[0].recipientIndex'),recipient);assert.equal(h.eval('game.history[0].setter'),h.eval('game.teams['+setter+']'));
 }
});
test('manual Approx awards ignore both recipient policies for all four outcomes',()=>{
 for(const policy of ['setter','guesser'])for(const result of ['a','b','both','none']){
  const h=harness();h.eval('soundOn=false;options.awardTo="'+policy+'";options.modes=["approx"];options.dice=false;newGame();roll();revealApprox();awardApprox("'+result+'")');
  assert.deepEqual(Array.from(h.eval('game.scores')),result==='a'?[1,0]:result==='b'?[0,1]:result==='both'?[1,1]:[0,0]);
 }
});
test('a started award policy survives future-setting edits, reload and offline snapshots',()=>{
 for(const policy of ['setter','guesser']){
  const stored=new Map(),a=harness(stored);a.eval('soundOn=false;options.awardTo="'+policy+'";options.modes=["talk"];options.complications=false;options.dice=false;newGame();roll();persist()');
  const round=a.eval('JSON.stringify(game.current)');a.eval('selectAwardTo("'+(policy==='setter'?'guesser':'setter')+'");persist()');
  const b=harness(stored);assert.equal(b.eval('game.awardTo'),policy);assert.equal(b.eval('JSON.stringify(game.current)'),round);
  b.eval('game.phase="judge";judge(true)');assert.equal(b.eval('game.scores['+(policy==='setter'?0:1)+']'),1);
 }
});
test('pre-policy V1 V2 V3 V4 games keep historical recipient and stable current cost',()=>{
 for(const version of [1,2,3,4]){
  const stored=new Map(),a=harness(stored);a.eval('soundOn=false;options.modes=["talk"];options.dice=false;options.complications=false;legacyGame('+version+');'+(version===1?'game.scoringVersion=undefined;':'')+'roll();persist()');
  const round=a.eval('JSON.stringify(game.current)'),points=a.eval('game.current.points');
  const b=harness(stored);assert.equal(b.eval('game.awardPolicyVersion'),undefined);assert.equal(b.eval('JSON.stringify(game.current)'),round);
  b.eval('options.awardTo="setter";game.phase="judge";judge(true)');
  assert.equal(b.eval('game.scores['+(version===1?0:1)+']'),points);
 }
});
test('unknown award policies protect the original save from replacement',()=>{
 const stored=new Map(),a=harness(stored);a.eval('soundOn=false;newGame();game.awardPolicyVersion=99;persist()');
 const original=stored.get('iskra-party:v1'),b=harness(stored);assert.equal(b.eval('storageBlocked'),true);b.eval('newGame();persist()');assert.equal(stored.get('iskra-party:v1'),original);
});
test('both recipient policies preserve reply turns, ties and round-count boundaries',()=>{
 for(const policy of ['setter','guesser']){
  const h=harness();h.eval('soundOn=false;options.awardTo="'+policy+'";options.modes=["talk"];options.complications=false;options.dice=false;options.targetScore=1;newGame();delete game.finishPolicyVersion');
  for(const yes of [true,true,true,false])h.eval('roll();game.phase="judge";judge('+yes+')');
  assert.equal(h.eval('game.phase'),'results');assert.equal(h.eval('game.roundIndex'),4);assert.notEqual(h.eval('game.scores[0]'),h.eval('game.scores[1]'));
  h.eval('options.finishType="rounds";options.rounds=2;newGame()');
  for(let i=0;i<2;i++)h.eval('roll();game.phase="judge";judge(false)');
  assert.equal(h.eval('game.phase'),'results');assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);
 }
});

test('V5 splits base and modifier rewards without mutating the round or score',()=>{
 const h=harness();
 for(const taskSuccess of [false,true])for(const modifierSuccess of [false,true])for(const risk of [false,true]){
  const round={modeId:'talk',points:2,basePoints:1,modifierPoints:1,complication:'Шёпотом',risk};
  const before=JSON.stringify(round),match={scoringVersion:2,rulesVersion:5,modeConfigVersion:1};
  h.context.testRound=round;h.context.testMatch=match;
  const out=h.eval('settleQuipRound(testMatch,testRound,'+JSON.stringify({taskSuccess,modifierSuccess})+',5)');
  assert.equal(out.delta,taskSuccess?(modifierSuccess?2:1):risk?-2:0);
  assert.equal(out.baseAwarded,taskSuccess?1:0);assert.equal(out.modifierAwarded,taskSuccess&&modifierSuccess?1:0);
  assert.equal(out.penalty,!taskSuccess&&risk?2:0);assert.equal(JSON.stringify(round),before);
  assert.equal(out.outcome,!taskSuccess?'failed':modifierSuccess?'complete':'base-only');
 }
});
test('V5 settles all configured explanations and recipient policies for three outcomes',()=>{
 for(const policy of ['setter','guesser'])for(const mode of ['talk','mime','draw','sing','yesno','secret','blitz'])for(const outcome of ['failed','base-only','complete']){
  const h=harness();h.eval('soundOn=false;options.awardTo="'+policy+'";options.modes=["'+mode+'"];options.complications=true;options.dice=false;Math.random=()=>0;startHistoricalFixture();game.modifierSelectionVersion=1;delete game.modifierCatalogVersion;roll();game.current.blitzCorrect=3;game.phase="judge"');
  const base=h.eval('game.current.basePoints');h.eval('judge('+(outcome!=='failed')+','+(outcome==='complete')+')');
  const recipient=policy==='setter'?0:1,earned=outcome==='failed'?0:base+(outcome==='complete'?1:0);
  assert.equal(h.eval('game.scores['+recipient+']'),earned);
  assert.equal(h.eval('game.history[0].outcome'),outcome);assert.equal(h.eval('game.history[0].modifierPoints'),outcome==='complete'?1:0);
  assert.equal(h.eval('game.history[0].baseAwarded'),outcome==='failed'?0:base);assert.equal(h.eval('game.history[0].reward'),earned);
  assert.equal(h.eval('game.history[0].recipientIndex'),recipient);assert.ok(h.eval('game.history[0].modeName'));
 }
});
test('V5 incomplete Blitz can never earn base points through either success path',()=>{
 for(const correct of [0,1,2])for(const modifierSuccess of [false,true]){
  const h=harness();h.eval('soundOn=false;options.modes=["blitz"];options.dice=false;Math.random=()=>0;newGame();roll();game.current.blitzCorrect='+correct+';game.current.risk=false;game.phase="judge";judge(true,'+modifierSuccess+')');
  assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);assert.equal(h.eval('game.history[0].taskSuccess'),false);assert.equal(h.eval('game.history[0].modifierPoints'),0);
 }
});
test('V5 orange and green outcomes avoid risk while failure penalizes the selected recipient',()=>{
 for(const policy of ['setter','guesser'])for(const result of ['failed','base-only','complete']){
  const h=harness();h.eval('soundOn=false;options.awardTo="'+policy+'";options.modes=["secret"];options.dice=false;options.complications=false;newGame();roll();game.scores=[5,5];game.current.risk=true;game.phase="judge";judge('+(result!=='failed')+','+(result==='complete')+')');
  const recipient=policy==='setter'?0:1;
  assert.equal(h.eval('game.scores['+recipient+']'),result==='failed'?3:result==='base-only'?7:8);
  assert.equal(h.eval('game.history[0].penalty'),result==='failed'?2:0);
 }
});
test('V5 fast timer actions and expired or early-finished judgement share the same outcome',()=>{
 for(const route of ['fast','timeout','early'])for(const modifierSuccess of [false,true]){
  const h=harness();h.eval('soundOn=false;options.modes=["talk"];options.dice=false;Math.random=()=>0;newGame();roll();toggleWord();startTimer()');
  if(route==='fast')h.eval('correctNow('+modifierSuccess+')');
  else h.eval('finishTimer("'+route+'");judge(true,'+modifierSuccess+')');
  assert.equal(h.eval('game.history[0].awarded'),modifierSuccess?2:1);assert.equal(h.eval('game.roundIndex'),1);
  h.eval('correctNow(false);judge(true,false)');assert.equal(h.eval('game.history.length'),1);
 }
});
test('V5 omits orange without a modifier and ignores a forged base-only UI action',()=>{
 const h=harness();h.eval('soundOn=false;options.modes=["talk"];options.dice=false;options.complications=false;newGame();roll();game.phase="judge";render()');
 assert.doesNotMatch(h.elements.get('play-content').innerHTML,/data-action="base"/);
 h.eval('judge(true,false)');assert.equal(h.eval('game.roundIndex'),0);h.eval('judge(true)');assert.equal(h.eval('game.scores[0]'),1);
});
test('pre-B V1-V4 and stage-A recipient policies keep the original modifier semantics',()=>{
 for(const version of [1,2,3,4])for(const stageA of [false,true]){
  const h=harness();h.eval('soundOn=false;options.modes=["secret"];options.dice=false;Math.random=()=>0;legacyGame('+version+');'+(stageA?'game.awardPolicyVersion=1;game.awardTo="setter";':'')+'roll();game.phase="judge";render()');
  const cost=h.eval('game.current.points');assert.doesNotMatch(h.elements.get('play-content').innerHTML,/data-action="base"/);
  h.eval('judge(true,false)');assert.equal(h.eval('game.roundIndex'),0);
  h.eval('judge(true)');assert.equal(h.eval('game.history[0].awarded'),cost);assert.equal(h.eval('game.history[0].outcome'),undefined);
  assert.equal(h.eval('game.scores['+(stageA?0:1)+']'),cost);
 }
});
test('V5 reload pays the saved base and bonus without recomputing the selected cost',()=>{
 for(const full of [false,true]){
  const stored=new Map(),a=harness(stored);a.eval('soundOn=false;options.modes=["secret"];options.dice=false;newGame();roll();game.phase="judge";persist()');
  const snapshot=a.eval('JSON.stringify(game.current)'),b=harness(stored);assert.equal(b.eval('JSON.stringify(game.current)'),snapshot);
  b.eval('rewardForRound=()=>999;judge(true,'+full+')');assert.equal(b.eval('game.history[0].awarded'),full?3:2);
  assert.equal(b.eval('game.history[0].modifierPoints'),full?1:0);
  assert.match(b.eval('historyMarkup(game.history[0],0)'),full?/С усложнением/:/Без усложнения/);
 }
});

function modifierSelectionHarness(chance=20,recent=[],pool){
 const h=harness();h.context.testMatch={scoringVersion:2,rulesVersion:5,modeConfigVersion:1,modifierSelectionVersion:1,modifierChance:chance,modifierRecent:recent};
 h.context.testRequest={modeId:'talk',methodId:'talk',difficulty:'easy',complications:true};h.context.testPool=pool;
 h.context.testRandom=()=>0;return h;
}
test('new modifier selection defaults and ranges come from the independent policy',()=>{
 const h=harness();assert.equal(h.eval('options.modifierChance'),20);
 assert.deepEqual(JSON.parse(h.eval('JSON.stringify(QUIP_MODIFIER_SELECTION_POLICIES[1])')),{defaultChance:20,minChance:10,maxChance:100,step:5,recentLimit:5});
 for(const [raw,expected] of [[undefined,20],[0,10],[102,100],[36,35],[100,100]]){
  h.context.rawChance=raw;assert.equal(h.eval('sanitizeModifierChance(rawChance)'),expected);
 }
 h.eval('soundOn=false;newGame()');assert.equal(h.eval('game.modifierSelectionVersion'),2);assert.equal(h.eval('game.modifierChance'),20);assert.equal(h.eval('game.rulesVersion'),5);
});
test('optional modifier probability has deterministic boundaries and no guaranteed batch quota',()=>{
 for(const chance of [10,20,50,100]){
  const h=modifierSelectionHarness(chance);let picked=0;
  for(let i=0;i<100;i++){
   let calls=0;h.context.testRandom=()=>calls++===0?i/100:0;
   if(h.eval('choosePartyModifier(testMatch,testRequest,testRandom).modifier!==null'))picked++;
  }
  assert.equal(picked,chance);
 }
 const h=modifierSelectionHarness(20);h.context.testRandom=()=>.2;assert.equal(h.eval('choosePartyModifier(testMatch,testRequest,testRandom).modifier'),null);
 h.context.testRequest.complications=false;h.context.testRandom=()=>{throw Error('RNG should not be used')};assert.equal(h.eval('choosePartyModifier(testMatch,testRequest,testRandom).modifier'),null);
});
test('Secret always selects a modifier and Approx never selects one at any chance or level',()=>{
 for(const chance of [10,20,100])for(const difficulty of ['easy','medium','hard']){
  const h=modifierSelectionHarness(chance);h.context.testRequest={modeId:'secret',methodId:'talk',difficulty,complications:false};h.context.testRandom=()=>.9999;
  assert.ok(h.eval('choosePartyModifier(testMatch,testRequest,testRandom).modifier'));
  h.context.testRequest={modeId:'approx',methodId:'approx',difficulty,complications:true};h.context.testRandom=()=>{throw Error('Approx must not draw a modifier')};
  assert.equal(h.eval('choosePartyModifier(testMatch,testRequest,testRandom).modifier'),null);
 }
});
test('recent modifier exclusion compares both IDs and normalized text across tiers',()=>{
 const pool=[{id:'one',text:'Показывай как робот.',severity:'easy',modes:['talk'],enabled:true},
 {id:'duplicate',text:'  ПОКАЗЫВАЙ  КАК РОБОТ! ',severity:'medium',modes:['talk'],enabled:true},
 {id:'alternative',text:'Говори шёпотом.',severity:'hard',modes:['talk'],enabled:true}];
 const h=modifierSelectionHarness(100,[{id:'one',key:'показывай как робот'}],pool);h.context.testRequest.difficulty='hard';
 const before=JSON.stringify(h.context.testMatch),selection=h.eval('choosePartyModifier(testMatch,testRequest,testRandom,testPool)');
 assert.equal(selection.modifier.id,'alternative');assert.equal(selection.recent.at(-1).key,'говори шепотом');assert.equal(JSON.stringify(h.context.testMatch),before);
 assert.equal(h.eval('normalizeModifierText("ГОВОРИ ШЁПОТОМ!!!")'),h.eval('normalizeModifierText("говори  шепотом.")'));
});
test('small modifier pools relax oldest restrictions safely and keep the latest avoidance',()=>{
 const pool=[{id:'one',text:'Первое условие.',severity:'easy',modes:['talk'],enabled:true}];
 const recent=Array.from({length:5},()=>({id:'one',key:'первое условие'}));
 const h=modifierSelectionHarness(100,recent,pool);const selected=h.eval('choosePartyModifier(testMatch,testRequest,testRandom,testPool)');
 assert.equal(selected.modifier.id,'one');assert.equal(selected.recent.length,5);
 h.context.testPool=[...pool,{id:'two',text:'Второе условие.',severity:'easy',modes:['talk'],enabled:true}];
 h.context.testMatch.modifierRecent=[{id:'two',key:'второе условие'},{id:'one',key:'первое условие'}];
 assert.equal(h.eval('choosePartyModifier(testMatch,testRequest,testRandom,testPool).modifier.id'),'two');
});
test('historical V1 real rounds maintain five selected modifiers without recent text repeats or catalog mutations',()=>{
 const h=harness();h.eval('soundOn=false;options.modes=["talk"];options.modifierChance=100;options.difficulty="hard";options.dice=false;options.riskRounds=false;Math.random=()=>0;newGame();delete game.modeCompatibilityVersion;game.modifierSelectionVersion=1;delete game.modifierCatalogVersion');
 const catalog=h.eval('JSON.stringify(QUIP_MODIFIERS)'),keys=[];
 for(let i=0;i<9;i++){
  h.eval('roll()');const key=h.eval('normalizeModifierText(game.current.complication)');
  assert.equal(keys.slice(-5).includes(key),false,'Recent text repeated');keys.push(key);
  assert.ok(h.eval('game.modifierRecent.length')<=5);h.eval('game.phase="judge";judge(false)');
 }
 assert.equal(h.eval('game.modifierRecent.length'),5);assert.equal(h.eval('JSON.stringify(QUIP_MODIFIERS)'),catalog);
});
test('chance and recent state are snapshotted per party and restored with the selected modifier',()=>{
 const stored=new Map(),a=harness(stored);a.eval('soundOn=false;options.modes=["secret"];options.modifierChance=100;options.dice=false;newGame();roll();persist()');
 const round=a.eval('JSON.stringify(game.current)'),recent=a.eval('JSON.stringify(game.modifierRecent)');
 a.eval('options.modifierChance=10;options.complications=false;persist()');const b=harness(stored);
 assert.equal(b.eval('game.modifierChance'),100);assert.equal(b.eval('options.modifierChance'),10);assert.equal(b.eval('game.complications'),true);
 assert.equal(b.eval('JSON.stringify(game.current)'),round);assert.equal(b.eval('JSON.stringify(game.modifierRecent)'),recent);
 b.eval('Math.random=()=>{throw Error("No reroll on restore/render")};render()');assert.equal(b.eval('JSON.stringify(game.current)'),round);
});
test('pre-C parties retain the historical 35 percent path independently of score versions and options',()=>{
 for(const version of [1,2,3,4,5]){
  const h=modifierSelectionHarness(20);h.context.testMatch={scoringVersion:2,rulesVersion:version};let calls=0;h.context.testRandom=()=>calls++===0?.3:0;
  assert.ok(h.eval('choosePartyModifier(testMatch,testRequest,testRandom).modifier'));
  h.context.testMatch={scoringVersion:2,rulesVersion:version};calls=0;h.context.testRandom=()=>calls++===0?.35:0;
  assert.equal(h.eval('choosePartyModifier(testMatch,testRequest,testRandom).modifier'),null);
  assert.equal(h.eval('modifierSelectionPolicy(testMatch)'),null);
 }
 const stored=new Map(),a=harness(stored);a.eval('soundOn=false;newGame();delete game.modifierCatalogVersion;delete game.modifierSelectionVersion;delete game.modifierChance;delete game.modifierRecent;persist()');
 const b=harness(stored);assert.equal(b.eval('game.modifierSelectionVersion'),undefined);assert.equal(b.eval('game.modifierChance'),undefined);assert.equal(b.eval('game.modifierRecent'),undefined);
});
test('unsupported modifier policies and invalid recent state protect the original saved party',()=>{
 for(const change of ['game.modifierSelectionVersion=99','game.modifierChance=22','game.modifierRecent=null']){
  const stored=new Map(),a=harness(stored);a.eval('soundOn=false;newGame();'+change+';persist()');const original=stored.get('iskra-party:v1');
  const b=harness(stored);assert.equal(b.eval('storageBlocked'),true);b.eval('newGame();persist()');assert.equal(stored.get('iskra-party:v1'),original);
 }
});

// TASK 008: authoritative data is extended, never re-created from legacy dictionaries.
test('TASK008 keeps every pre-expansion card and numeric question byte-equivalent',()=>{
 const {loadCatalog}=require('../scripts/catalog-audit.cjs'),crypto=require('node:crypto');const {cards,questions}=loadCatalog();
 const digest=rows=>crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 assert.equal(digest(cards.filter(c=>Number(c.id.split('-')[1])<8000)),'cc04a3d94b191c8857a32103f973d60f60f2004801df748f3de0a8c06bfeb9c9');
 assert.equal(digest(questions.filter(q=>Number(q.id.slice(7))<8000)),'e8a835f803b54f1694ba08f43faca16b3ec4e82a3cd5727e0408f067275fdb5e');
});
test('TASK008 A adds the authored minimum for every type with meaningful tier coverage',()=>{
 const {loadCatalog}=require('../scripts/catalog-audit.cjs'),{cards,questions}=loadCatalog(),rows=cards.filter(c=>Number(c.id.split('-')[1])>=8000&&Number(c.id.split('-')[1])<9000);
 assert.equal(rows.length,220);
 for(const [type,min] of Object.entries({word:100,phrase:45,idiom:25,song:25,person:25})){
  assert.equal(rows.filter(c=>c.type===type).length,min);
  for(const difficulty of ['easy','medium','hard'])assert.ok(rows.filter(c=>c.type===type&&c.difficulty===difficulty).length>=8,type+'/'+difficulty);
 }
 const numbers=questions.filter(q=>Number(q.id.slice(7))>=8000&&Number(q.id.slice(7))<8100);
 assert.equal(numbers.length,30);for(const level of ['easy','medium','hard'])assert.equal(numbers.filter(q=>q.difficulty===level).length,10);
});
test('TASK008 new prompts have no normalized collisions with any active prompt or song title',()=>{
 const {loadCatalog,normalize}=require('../scripts/catalog-audit.cjs'),{cards,questions}=loadCatalog();
 const seen=new Map(),songTitles=new Map();
 for(const card of cards.filter(c=>Number(c.id.split('-')[1])<20000)){const key=normalize(card.text),newCard=Number(card.id.split('-')[1])>=8000;
  if(newCard)assert.equal(seen.has(key),false,card.id+' collides with '+seen.get(key));
  seen.set(key,card.id);
  if(card.type==='song'){const title=normalize(card.meta.title);if(newCard)assert.equal(songTitles.has(title),false,card.id+' repeats song '+songTitles.get(title));songTitles.set(title,card.id);}
 }
 assert.equal(new Set(questions.map(q=>normalize(q.question))).size,questions.length);
 assert.equal(new Set([...cards,...questions].map(c=>c.id)).size,cards.length+questions.length);
});
test('TASK008 numeric additions carry units, categories, sources and checked derivations',()=>{
 const {loadCatalog}=require('../scripts/catalog-audit.cjs'),{questions}=loadCatalog();
 for(const q of questions.filter(q=>Number(q.id.slice(7))>=8000)){
  assert.ok(q.unit&&q.note!==undefined&&q.categories.length&&q.answer&&q.pack);
  assert.match(q.source,/^(https:\/\/|formula:|definition:)/);
  assert.ok(q.question.length<=220,q.id);
  if(q.source.startsWith('formula:'))assert.equal(Number(q.answer),vm.runInNewContext(q.source.slice(8)),q.id);
 }
});
test('TASK008 additions enter standard pools without empty tiers or duplicate Blitz words',()=>{
 const h=harness();h.eval('soundOn=false;options.complications=false;options.dice=false;newGame();game.contentPack={id:"general",version:2};delete game.songLanguagePolicyVersion;delete game.songLanguages');
 for(const kind of ['words','songs','people','blitz'])for(const level of ['easy','medium','hard'])assert.ok(h.eval('getPromptPool("'+kind+'","'+level+'").length')>=50,kind+'/'+level);
 h.eval('options.modes=["blitz"];newGame();Math.random=()=>0');const used=[];
 for(let i=0;i<20;i++){h.eval('roll()');const words=Array.from(h.eval('game.current.blitzWords'));assert.equal(new Set(words).size,3);for(const word of words){assert.equal(used.includes(word),false);used.push(word)}h.eval('game.phase="judge";judge(false)');}
 assert.equal(new Set(used).size,60);
 assert.equal(h.eval('getPackQuestionPool({id:"general",version:2},"hard").some(q=>q.id==="approx-8030")'),true);
});
test('TASK008 audit reports cross-type duplicates separately and is deterministic',()=>{
 const {audit}=require('../scripts/catalog-audit.cjs'),a=audit();assert.deepEqual(a,audit());const historical=group=>group.ids.every(id=>Number(id.split('-')[1])<20000);assert.equal(a.exactDuplicates.filter(historical).length,26);assert.equal(a.normalizedDuplicates.filter(historical).length,26);const reviewed=require('../content/manifest.json').reviewedCrossTypeCollisions;assert.equal(a.normalizedDuplicates.filter(g=>!historical(g)).length,reviewed.length);assert.equal(a.questionDuplicates.length,0);assert.ok(a.blitz>=750);
});

test('TASK008 geography v2 is authored, isolated and leaves every v1 declaration disabled',()=>{
 const {loadCatalog}=require('../scripts/catalog-audit.cjs'),{cards,questions}=loadCatalog(),rows=cards.filter(c=>c.pack==='geography-v2'),numbers=questions.filter(q=>q.pack==='geography-v2');
 assert.equal(rows.length,150);assert.equal(numbers.length,30);
 for(const [type,count] of Object.entries({word:90,phrase:35,person:25}))assert.equal(rows.filter(c=>c.type===type).length,count);
 for(const level of ['easy','medium','hard']){assert.ok(rows.filter(c=>c.type==='word'&&c.difficulty===level).length>=30);assert.ok(rows.filter(c=>c.type==='person'&&c.difficulty===level).length>=8);assert.equal(numbers.filter(q=>q.difficulty===level).length,10)}
 assert.ok([...rows,...numbers].every(c=>c.categories.includes('geography')));
 const h=harness();assert.equal(h.eval('QUIP_CONTENT_PACKS["geography@1"].enabled'),false);assert.equal(h.eval('QUIP_CONTENT_PACKS["geography@2"].enabled'),true);
 assert.equal(h.eval('Object.isFrozen(QUIP_CONTENT_PACKS["geography@2"].allowedModes)'),true);
 assert.equal(h.eval('getPackCardPool({id:"geography",version:2},"songs","easy").length'),0);
 for(const level of ['easy','medium','hard']){assert.equal(h.eval('getPackQuestionPool({id:"geography",version:2},"'+level+'").every(q=>q.pack==="geography-v2")'),true);assert.equal(h.eval('getPackCardPool({id:"geography",version:2},"words","'+level+'",["word","phrase"]).every(c=>c.pack==="geography-v2")'),true);}
});
test('TASK008 geography is selectable from standard singing and idiom-only preferences without mutating them',()=>{
 const h=harness();h.eval('options.awardTo="guesser";options.modes=["sing","yesno"];options.promptTypes=["idiom"];options.difficulty="mixed"');
 const before=h.eval('JSON.stringify(options)');assert.equal(h.eval('listThematicPacks(options).find(e=>e.pack.id==="geography").available'),true);assert.equal(h.eval('JSON.stringify(options)'),before);
 assert.equal(h.eval('selectTheme("geography",2)'),true);assert.equal(h.eval('activeScene'),'setup');assert.equal(h.eval('options.modes.includes("sing")'),false);assert.deepEqual(Array.from(h.eval('options.promptTypes')),['word','phrase']);
 h.eval('options.modes=["draw","approx"];options.promptTypes=["phrase"];persist();selectStandardGame()');
 assert.deepEqual(Array.from(h.eval('options.modes')),['sing','yesno']);assert.deepEqual(Array.from(h.eval('options.promptTypes')),['idiom']);
 h.eval('selectTheme("geography",2)');assert.deepEqual(Array.from(h.eval('options.modes')),['draw','approx']);assert.deepEqual(Array.from(h.eval('options.promptTypes')),['phrase']);
 const reloaded=harness(h.storage);reloaded.eval('selectStandardGame();selectTheme("geography",2)');assert.deepEqual(Array.from(reloaded.eval('options.modes')),['draw','approx']);
});
test('TASK008 geography has no dead ends for any nonempty permitted mode combination or prompt subset',()=>{
 const h=harness();h.eval('const geo={id:"geography",version:2},geoModes=QUIP_CONTENT_PACKS["geography@2"].allowedModes');
 assert.equal(h.eval(`(()=>{for(let mask=1;mask<2**geoModes.length;mask++)for(const promptTypes of [['word'],['phrase'],['word','phrase']]){
 const settings={...options,modeCompatibilityVersion:null,difficulty:'mixed',promptTypes,modes:geoModes.filter((_,i)=>mask&(1<<i))};if(!checkContentPack(geo,settings).available)return JSON.stringify(settings);
 }return true})()`),true);
 assert.equal(h.eval('checkContentPack(geo,{...options,modes:["sing"]}).available'),false);
 assert.equal(h.eval('checkContentPack(geo,{...options,modes:["talk"],promptTypes:["idiom"]}).available'),false);
 h.eval('soundOn=false;newGame();const preservedGame=JSON.stringify(game);options.contentPack=geo;options.modes=["sing"];newGame()');assert.equal(h.eval('JSON.stringify(game)'),h.eval('preservedGame'));
});
test('TASK008 geography Secret-only never chooses singing or common-catalog content',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation(808);
 h.eval('options.difficulty="mixed";selectTheme("geography",2);options.modes=["secret"];options.dice=false;newGame();delete game.modeCompatibilityVersion;game.modifierSelectionVersion=1;delete game.modifierCatalogVersion');
 const result=h.eval(`(()=>{const methods=new Set(),levels=[];for(let i=0;i<60;i++){game.current=rollOutcome();methods.add(game.current.methodId);levels.push(game.current.difficulty);
 const pool=getPackCardPool(game.contentPack,getMode(game.current.methodId).kind,game.current.difficulty,game.promptTypes);if(!pool.some(c=>c.text===game.current.word)||game.current.methodId==='sing'||!game.current.complication)return false;game.roundIndex++;game.current=null}
 return {methods:[...methods].sort(),levels:levels.reduce((counts,l)=>(counts[l]=(counts[l]||0)+1,counts),{})}})()`);
 assert.deepEqual(Array.from(result.methods),['draw','mime','talk','yesno']);assert.deepEqual(JSON.parse(JSON.stringify(result.levels)),{easy:20,medium:20,hard:20});
});
test('TASK008 geography pools exhaust only after unused alternatives and Blitz stays unique',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),h=createSimulation(82);h.eval('selectTheme("geography",2);options.dice=false;options.modes=["talk"];newGame()');
 for(const kind of ['words','people','blitz'])for(const level of ['easy','medium','hard']){
  h.context.kind=kind;h.context.tier=level;const result=h.eval('(()=>{const pool=getPromptPool(kind,tier),seen=[];for(let i=0;i<pool.length;i++)seen.push(pullWord(kind,tier));return {count:pool.length,unique:new Set(seen).size}})()');assert.equal(result.unique,result.count,kind+'/'+level);
 }
 h.eval('game.used={};options.modes=["blitz"];newGame()');const seen=[];for(let i=0;i<10;i++){const words=Array.from(h.eval('rollOutcome().blitzWords'));assert.equal(new Set(words).size,3);for(const w of words){assert.equal(seen.includes(w),false);seen.push(w)}}assert.equal(seen.length,30);
});
test('TASK008 geography awards, shared answers and save snapshots remain independent of future theme choices',()=>{
 for(const awardTo of ['setter','guesser']){
  const stored=new Map(),h=harness(stored);h.eval('soundOn=false;options.awardTo="'+awardTo+'";selectTheme("geography",2);options.modes=["talk"];options.dice=false;options.modifierChance=100;newGame();roll();persist()');
  const selected=h.eval('JSON.stringify(game.current)');h.eval('selectStandardGame();options.modes=["sing"];persist()');const reload=harness(stored);assert.equal(reload.eval('game.contentPack.id'),'geography');assert.equal(reload.eval('JSON.stringify(game.current)'),selected);
  reload.eval('game.phase="judge";judge(true,false)');assert.equal(reload.eval('game.scores['+(awardTo==='setter'?0:1)+']'),1);
  reload.eval('selectTheme("geography",2);options.modes=["approx"];options.dice=false;newGame();game.contentPack={id:"geography",version:2};roll()');assert.equal(reload.eval('game.current.question.pack'),'geography-v2');reload.eval('revealApprox();awardApprox("both")');assert.deepEqual(Array.from(reload.eval('game.scores')),[1,1]);
 }
});

test('TASK008 science v2 adds 150 distinct prompts and 30 sourced questions with playable tiers',()=>{
 const {loadCatalog}=require('../scripts/catalog-audit.cjs'),{cards,questions}=loadCatalog(),rows=cards.filter(c=>c.pack==='science-v2'),numbers=questions.filter(q=>q.pack==='science-v2');
 assert.equal(rows.length,150);assert.equal(numbers.length,30);
 for(const [type,count] of Object.entries({word:90,phrase:35,person:25}))assert.equal(rows.filter(c=>c.type===type).length,count);
 for(const level of ['easy','medium','hard']){assert.equal(rows.filter(c=>c.type==='word'&&c.difficulty===level).length,30);assert.ok(rows.filter(c=>c.type==='person'&&c.difficulty===level).length>=8);assert.equal(numbers.filter(q=>q.difficulty===level).length,10)}
 assert.ok([...rows,...numbers].every(c=>c.categories.includes('science')));
 const h=harness();assert.equal(h.eval('QUIP_CONTENT_PACKS["science@1"].enabled'),false);assert.equal(h.eval('QUIP_CONTENT_PACKS["science@2"].enabled'),true);
 assert.equal(h.eval('getPackCardPool({id:"science",version:2},"songs","easy").length'),0);
 for(const kind of ['words','people','blitz'])for(const level of ['easy','medium','hard'])assert.equal(h.eval('getPackCardPool({id:"science",version:2},"'+kind+'","'+level+'",["word","phrase"]).every(c=>c.pack==="science-v2")'),true);
});
test('TASK008 standard, geography and science keep independent preferences across reload and protect a running round',()=>{
 const h=harness();h.eval('options.awardTo="guesser";options.modes=["sing"];options.promptTypes=["idiom"];selectTheme("geography",2);options.modes=["draw","approx"];options.promptTypes=["phrase"];selectTheme("science",2);options.modes=["secret","yesno"];options.promptTypes=["word"];options.dice=false;newGame();roll();game.dice=true;persist();const scienceSnapshot=JSON.stringify(game);selectTheme("geography",2)');
 assert.deepEqual(Array.from(h.eval('options.modes')),['draw','approx']);assert.deepEqual(Array.from(h.eval('options.promptTypes')),['phrase']);assert.equal(h.eval('JSON.stringify(game)'),h.eval('scienceSnapshot'));
 const reload=harness(h.storage);assert.equal(reload.eval('JSON.stringify(game)'),h.eval('scienceSnapshot'));reload.eval('selectStandardGame()');assert.deepEqual(Array.from(reload.eval('options.modes')),['sing']);assert.deepEqual(Array.from(reload.eval('options.promptTypes')),['idiom']);
 reload.eval('selectTheme("science",2)');assert.deepEqual(Array.from(reload.eval('options.modes')),['yesno','secret']);assert.deepEqual(Array.from(reload.eval('options.promptTypes')),['word']);
});
test('TASK008 both thematic registries have no dead-end mode, type or difficulty settings',()=>{
 const {checkSettings}=require('../scripts/balance-audit.cjs');assert.deepEqual(checkSettings(),{checked:3048,deadEnds:0});
 const h=harness();h.eval('selectTheme("science",2);options.modes=["secret"];options.difficulty="mixed";options.dice=false;newGame();delete game.modeCompatibilityVersion;game.modifierSelectionVersion=1;delete game.modifierCatalogVersion');
 const results=h.eval(`(()=>{const methods=new Set(),seen=[];for(let i=0;i<120;i++){const c=rollOutcome();methods.add(c.methodId);if(!c.complication||c.methodId==='sing')return false;
 const pool=getPackCardPool(game.contentPack,getMode(c.methodId).kind,c.difficulty,game.promptTypes);if(!pool.some(row=>row.text===c.word)||!pool.every(row=>row.categories.includes('science')&&getContentPack(game.contentPack).criteria.cardIds.includes(row.id)))return false;seen.push(c.difficulty);game.roundIndex++}return {methods:[...methods].sort(),counts:['easy','medium','hard'].map(l=>seen.filter(x=>x===l).length)}})()`);
 assert.deepEqual(Array.from(results.methods),['draw','mime','talk','yesno']);assert.deepEqual(Array.from(results.counts),[40,40,40]);
});
test('TASK008 balance diagnostic is reproducible and distinguishes optional, forced and absent modifiers',()=>{
 const {simulate}=require('../scripts/balance-audit.cjs');const first=simulate('science',20,120,8008);assert.deepEqual(first,simulate('science',20,120,8008));assert.equal(first.unnecessaryRepeats,0);assert.equal(first.forcedModified,first.forced);assert.equal(first.approxModified,0);assert.deepEqual(first.levels,{easy:40,medium:40,hard:40});
 const always=simulate('geography',100,120,8009);assert.equal(always.optional,always.modified);
});

test('TASK013 B new Mixed Easy auto-starts once and rejects manual start pause replacement and deadline extension',()=>{
 const h=harness();let now=1792818000000;h.context.Date=class extends Date{static now(){return now}};
 h.eval('soundOn=false;Object.assign(options,{modes:["talk"],difficulty:"mixed",dice:false,complications:false,riskRounds:false});Math.random=()=>.999999;newGame();roll()');
 assert.equal(h.eval('game.current.difficulty'),'easy');assert.equal(h.eval('game.current.points'),1);assert.equal(h.eval('game.timerPolicyVersion'),1);
 const word=h.eval('game.current.word');h.eval('toggleWord()');
 assert.equal(h.eval('game.phase'),'countdown');const autoStartAt=h.eval('game.current.autoStartAt');assert.equal(autoStartAt,now+1000);
 assert.equal(h.eval('allowPause()'),false);assert.ok(!h.elements.get('play-content').innerHTML.includes('data-action="start-timer"'));
 h.eval('startTimer();replaceWord();pauseTimer()');assert.equal(h.eval('game.current.word'),word);assert.equal(h.eval('game.current.autoStartAt'),autoStartAt);
 now=autoStartAt+4300;h.eval('tick()');const deadline=h.eval('game.current.deadline');assert.equal(deadline,autoStartAt+h.eval('game.current.seconds')*1000);
 h.eval('pauseTimer();beginAutomaticRound();tick();toggleWord();toggleWord()');assert.equal(h.eval('game.current.deadline'),deadline);assert.equal(h.eval('game.current.paused'),false);
 assert.ok(!h.elements.get('play-content').innerHTML.includes('data-action="pause"'));
 now=deadline+1;h.eval('tick();tick();correctNow()');assert.equal(h.eval('game.phase'),'judge');assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);
});
test('TASK013 B party timer policy keeps Easy manual and Medium Hard automatic, estimate stays untimed',()=>{
 for(const difficulty of ['easy','medium','hard']){
  const h=harness();h.context.level=difficulty;
  h.eval('soundOn=false;Object.assign(options,{modes:["talk"],difficulty:level,dice:false,complications:false});newGame();roll();toggleWord()');
  assert.equal(h.eval('game.phase'),difficulty==='easy'?'task':'countdown');
  if(difficulty==='easy'){
   h.eval('startTimer();pauseTimer()');assert.equal(h.eval('game.current.paused'),true);h.eval('resumeTimer()');assert.equal(h.eval('game.current.paused'),false);
  }else{h.eval('game.current.autoStartAt=Date.now()-1;tick();pauseTimer()');assert.equal(h.eval('game.current.paused'),false)}
 }
 const h=harness();h.eval('soundOn=false;Object.assign(options,{modes:["approx"],difficulty:"mixed",dice:false});newGame();roll()');
 const before=h.eval('JSON.stringify(game)');h.eval('toggleWord();startTimer();pauseTimer();resumeTimer();beginAutomaticRound();tick()');assert.equal(h.eval('JSON.stringify(game)'),before);
});
test('TASK013 B historical paused Mixed and active v69-v71 snapshots keep controls and original bytes',()=>{
 for(const phase of ['task','countdown','play','paused']){
  const h=harness();h.eval('soundOn=false;Object.assign(options,{modes:["talk"],difficulty:"mixed",dice:false,complications:false});Math.random=()=>.999999;newGame();delete game.timerPolicyVersion;roll()');
  if(phase!=='task')h.eval('toggleWord();startTimer()');
  if(phase==='paused')h.eval('pauseTimer()');
  if(phase==='countdown')h.eval('game.phase="countdown";game.current.difficulty="medium";game.plannerState.levels=["medium","easy","hard"];game.current.autoStartAt=Date.now()+30000;game.current.deadline=null');
  h.eval('game.dice=true;options.dice=true;persist()');const raw=h.storage.get('iskra-party:v1'),before=h.eval('JSON.stringify(game)');
  const store=new Map([['iskra-party:v1',raw]]);let writes=0;const set=store.set;store.set=function(...args){writes++;return Reflect.apply(set,this,args)};
  const again=harness(store);again.eval('continueGame();render()');assert.equal(again.eval('JSON.stringify(game)'),before);assert.equal(store.get('iskra-party:v1'),raw);assert.equal(writes,0);
  assert.equal(again.eval('game.timerPolicyVersion'),undefined);
  if(phase==='paused'){
   assert.equal(again.elements.get('timer-pause-control').dataset.action,'resume');assert.equal(again.elements.get('timer-pause-control').hidden,false);const remaining=again.eval('game.current.remainingMs');again.eval('resumeTimer()');
   assert.equal(again.eval('game.current.paused'),false);assert.ok(Math.abs(again.eval('game.current.deadline')-Date.now()-remaining)<1000);
  }
 }
});
test('TASK013 B new Mixed countdown restores its original start and rejects unknown future timer policies',()=>{
 const h=harness();let now=Date.now()+120000;h.context.Date=class extends Date{static now(){return now}};
 h.eval('soundOn=false;Object.assign(options,{modes:["talk"],difficulty:"mixed",dice:false});Math.random=()=>.999999;newGame();roll();toggleWord();game.dice=true;options.dice=true;persist()');
 const raw=h.storage.get('iskra-party:v1'),start=h.eval('game.current.autoStartAt');
 const next=harness(new Map([['iskra-party:v1',raw]]));next.context.Date=class extends Date{static now(){return now}};
 // Boot used real time (before this controlled future fixture); Continue must use the saved start.
 now=start+1500;next.eval('continueGame()');assert.equal(next.eval('game.current.deadline'),start+next.eval('game.current.seconds')*1000);
 const deadline=next.eval('game.current.deadline');next.eval('continueGame();beginAutomaticRound();pauseTimer()');assert.equal(next.eval('game.current.deadline'),deadline);assert.equal(next.eval('game.current.paused'),false);
 for(const version of [0,2,'1']){
  const saved=JSON.parse(raw);saved.game.timerPolicyVersion=version;const protectedRaw=' '+JSON.stringify(saved)+'\n',store=new Map([['iskra-party:v1',protectedRaw]]),blocked=harness(store);
  assert.equal(blocked.eval('storageBlocked'),true);assert.equal(blocked.eval('game'),null);blocked.eval('persist();newGame()');assert.equal(store.get('iskra-party:v1'),protectedRaw);
 }
});
test('TASK013 B round views remove duplicate setup copy but retain actual conditions in task countdown and play',()=>{
 const h=harness();h.eval('soundOn=false;Object.assign(options,{modes:["mime"],difficulty:"easy",dice:false,complications:false});newGame()');
 assert.ok(!h.elements.get('play-content').innerHTML.includes('game-eyebrow'));assert.equal(h.elements.get('round-now').textContent,1);
 h.eval('roll()');assert.ok(!h.elements.get('play-content').innerHTML.includes('Только жесты'));assert.ok(!h.elements.get('play-content').innerHTML.includes('round-condition'));
 h.eval('game.current.complication="Не рисуй <линии> & точки";render();toggleWord()');
 for(const phase of ['task','countdown','play']){
  h.context.phase=phase;h.eval('game.phase=phase;if(phase==="play")game.current.deadline=Date.now()+60000;render()');
  assert.match(h.elements.get('play-content').innerHTML,/УСЛОЖНЕНИЕ: Не рисуй &lt;линии&gt; &amp; точки/);
 }
});


test('smart finish: Mixed tiebreak restores at a six-turn planner boundary without advancing the plan',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),storage=new Map(),h=createSimulation(1,storage);
 h.eval(`chooseStartingTeam=()=>0;Object.assign(options,{modes:['talk'],awardTo:'setter',difficulty:'mixed',finishType:'score',targetScore:15,dice:false,complications:false,riskRounds:false});newGame();
  for(let i=0;i<30;i++){roll();game.phase='judge';judge(true)}`);
 assert.equal(h.eval('game.phase'),'tiebreak');assert.equal(h.eval('game.roundIndex'),30);
 const raw=storage.get('iskra-party:v1'),plan=h.eval('JSON.stringify(game.plannerState)'),question=h.eval('JSON.stringify(game.tiebreak.question)');
 const restored=createSimulation(2,storage);
 assert.equal(restored.eval('storageBlocked'),false);assert.equal(restored.eval('game.phase'),'tiebreak');
 assert.equal(restored.eval('JSON.stringify(game.plannerState)'),plan);assert.equal(restored.eval('JSON.stringify(game.tiebreak.question)'),question);
 assert.equal(storage.get('iskra-party:v1'),raw);
 restored.eval('Math.random=()=>{throw Error("Restore must not consume RNG")};restoreSession();revealTiebreak();settleTiebreak("a");settleTiebreak("a")');
 assert.equal(restored.eval('game.phase'),'results');assert.deepEqual(Array.from(restored.eval('game.scores')),[16,15]);
 assert.equal(restored.eval('profileStore.totals[game.profileMatch.participants[0].id].wins'),1);
 assert.equal(restored.eval('game.history.length'),30);
});

test('smart finish: missing or misplaced pending tiebreak protects saved RAW',()=>{
 const {createSimulation}=require('../scripts/game-simulation.cjs'),storage=new Map(),h=createSimulation(1,storage);
 h.eval("Object.assign(options,{finishType:'score',targetScore:15,modes:['talk']});newGame();game.roundIndex=2;game.scores=[15,15];beginTiebreak();persist()");
 const good=JSON.parse(storage.get('iskra-party:v1'));
 for(const missing of [true,false]){
  const saved=structuredClone(good);if(missing)delete saved.game.tiebreak;else saved.game.phase='ready';
  const raw=JSON.stringify(saved),store=new Map(storage);store.set('iskra-party:v1',raw);
  const restored=createSimulation(2,store);assert.equal(restored.eval('storageBlocked'),true);assert.equal(store.get('iskra-party:v1'),raw);
 }
});
