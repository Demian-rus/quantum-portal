'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function harness(existing=new Map(),randomizeStarter=false) {
  const pending=[];
  const elements=new Map();
  const element = id => {
    if(!elements.has(id)) {
      const node={id,value:id==='team-a'?'Молнии':id==='team-b'?'Кометы':'',
        hidden:false,style:{},textContent:'',innerHTML:'',dataset:{},
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
    document,window:{confirm:()=>true},navigator:{vibrate(){}},
    localStorage:{getItem:key=>existing.get(key)||null,setItem:(key,val)=>existing.set(key,val)},
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
  vm.runInContext(read('rules.js'),context);
  vm.runInContext(read('penalties.js'),context);
  vm.runInContext(read('modifiers.js'),context);
  vm.runInContext(read('round-planner.js'),context);
  vm.runInContext(read('content-packs.js'),context);
  vm.runInContext(read('presets.js'),context);
  vm.runInContext(read('app.js'),context);
  // Existing regression fixtures explicitly retain V3 rules and five-word Blitz.
  // New V4 scenarios below call the production newGame() directly.
  vm.runInContext(`function legacyGame(version=3){
    newGame();if(game&&game.phase==='ready'&&game.roundIndex===0){
      game.rulesVersion=version;delete game.modeConfigVersion;game.blitzCount=5;persist();
    }
  }`,context);
  // Scoring fixtures choose a fixed starting player; dedicated tests exercise both draws.
  if(!randomizeStarter)vm.runInContext('chooseStartingTeam=()=>0',context);
  return {context,elements,pending,storage:existing,eval:expr=>vm.runInContext(expr,context)};
}
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
  h.context.document.getElementById('team-a').value='<img src=x onerror=alert(1)>';
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
  assert.ok(markup.indexOf('judgement--no')<markup.indexOf('judgement--yes'),mode);
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
 assert.match(worker,/kvip-pwa-v24-20261021-rules4/);
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
  assert.deepEqual(Array.from(h.eval('getPromptPool("songs","'+level+'")')),catalog.map(x=>x.topic));
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

test('card catalog v1 has all 3016 active tasks and immutable unique IDs',()=>{
 const h=harness(),cards=JSON.parse(h.eval('JSON.stringify(PARTY_CARDS)'));
 assert.equal(h.eval('PARTY_CARD_SCHEMA_VERSION'),1);
 assert.equal(cards.length,3016);
 assert.equal(new Set(cards.map(c=>c.id)).size,3016);
 assert.deepEqual(Object.fromEntries(['word','phrase','idiom','song','person'].map(t=>[t,cards.filter(c=>c.type===t).length])),
   {word:1846,phrase:496,idiom:142,song:215,person:317});
 for(const c of cards){
  assert.match(c.id,/^(word|phrase|idiom|song|person)-[0-9]{6}$/);
  assert.ok(c.text.trim().length>1);
  assert.ok(['easy','medium','hard'].includes(c.difficulty));
  assert.ok(['word','phrase','idiom','song','person'].includes(c.type));
  assert.ok(Array.isArray(c.categories)&&c.categories.every(x=>/^[a-z][a-z0-9-]*$/.test(x)));
  assert.equal(c.categories.length,new Set(c.categories).size);
  assert.ok(['core','music','people'].includes(c.pack));
  if(c.type==='song')assert.ok(c.meta.title&&c.meta.artist&&c.meta.genre);
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
   const cards=Array.from(h.eval("getCardPool('"+kind+"','"+level+"').map(c=>c.text)"));
   const prompts=Array.from(h.eval("getPromptPool('"+kind+"','"+level+"')"));
   assert.deepEqual(cards,prompts);
  }
 }
 assert.equal(h.eval("getCardPool('blitz','hard').every(c=>c.difficulty==='easy'&&c.text.length<=12)"),true);
 assert.ok(read('index.html').includes('./cards.js?v=1'));
 assert.ok(read('sw.js').includes('./cards.js?v=1'));
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
 assert.equal(h.eval('QUIP_RULE_VERSION'),4);
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
 for(const file of ['mode-config.js?v=1','rules.js?v=2','penalties.js?v=2','modifiers.js?v=1','round-planner.js?v=1','content-packs.js?v=2','presets.js?v=2','app.js?v=18']){
  assert.ok(html.includes(file));assert.ok(sw.includes(file));
 }
 assert.match(sw,/kvip-pwa-v24-20261021-rules4/);
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
 const h=harness();h.eval('soundOn=false;legacyGame()');
 assert.equal(h.eval('PARTY_CARDS.length'),3016);
 for(const kind of ['words','songs','people','blitz'])for(const level of ['easy','medium','hard']){
  const expected=Array.from(h.eval('getCardPool("'+kind+'","'+level+'",game.promptTypes).map(c=>c.id)')).sort();
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
test('empty themes stay unavailable without fallback and cannot replace an active match',()=>{
 const h=harness();h.eval('soundOn=false;legacyGame();game.scores=[7,8];persist()');
 const before=h.eval('JSON.stringify(game)');
 assert.equal(h.eval('checkContentPack({id:"geography",version:1},options).available'),false);
 h.eval('options.contentPack={id:"geography",version:1};legacyGame()');
 assert.equal(h.eval('JSON.stringify(game)'),before);
 assert.equal(h.eval('getPackCardPool({id:"geography",version:1},"words","easy").length'),0);
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
test('all eight mode icons exist, load from versioned URLs, and approx is dormant',()=>{
  const h=harness(),assets=JSON.parse(h.eval('JSON.stringify(MODE_ASSETS)'));
  const modes=['talk','mime','draw','sing','yesno','secret','blitz','approx'];
  assert.deepEqual(Object.keys(assets),modes);
  assert.equal(h.eval('DEFAULT_MODES.includes("approx")'),false,'Approx mode belongs to future gameplay changes');
  const sw=read('sw.js'),html=read('index.html');
  assert.ok(html.includes("mode-images.js?v=6"));
  assert.match(sw,/kvip-pwa-v24-20261021-rules4/);
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
 const h=harness();h.eval('soundOn=false;newGame()');
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
  const h=harness();h.eval('soundOn=false;options.modes=["'+mode+'"];options.dice=false;options.riskRounds=false;Math.random=()=>0;newGame();roll()');
  const base=h.eval('game.current.basePoints');
  assert.ok(h.eval('game.current.complication'));
  assert.equal(h.eval('game.current.modifierPoints'),1);assert.equal(h.eval('game.current.points'),base+1);
  h.eval('game.phase="judge";judge('+success+');judge(true)');
  assert.equal(h.eval('game.scores[1]'),success?base+1:0);
  assert.equal(h.eval('game.history[0].awarded'),success?base+1:0);
  assert.equal(h.eval('game.history[0].modifierPoints'),success?1:0);
  assert.equal(h.eval('game.history[0].rulesVersion'),4);
 }
 const h=harness();h.eval('soundOn=false;options.modes=["secret"];options.complications=false;options.dice=false;newGame();roll()');
 assert.equal(h.eval('game.current.points'),3,'Secret always includes the bonus');
});
test('V4 Blitz draws three unique easy words and requires all three for two base points',()=>{
 for(const correct of [0,1,2,3])for(const complication of [false,true]){
  const h=harness();h.eval('soundOn=false;options.modes=["blitz"];options.dice=false;options.riskRounds=false;options.complications='+complication+';Math.random=()=>0;newGame();roll()');
  assert.equal(h.eval('game.current.blitzWords.length'),3);assert.equal(h.eval('game.current.blitzQueue.length'),3);
  assert.equal(new Set(h.eval('game.current.blitzWords')).size,3);
  h.eval('game.current.blitzCorrect='+correct+';game.phase="judge";judge(true)');
  assert.equal(h.eval('game.scores[1]'),correct===3?(complication?3:2):0);
 }
});
test('V4 reload preserves the chosen total, bonus, count and current timer state',()=>{
 const stored=new Map(),a=harness(stored);
 a.eval('soundOn=false;options.modes=["blitz"];options.dice=false;Math.random=()=>0;newGame();roll();toggleWord();startTimer();persist()');
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
