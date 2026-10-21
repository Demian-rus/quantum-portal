'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function harness(existing=new Map()) {
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
    Math,Date,console
  });
  vm.runInContext(read('words.js'),context);
  vm.runInContext(read('extra-words.js'),context);
  vm.runInContext(read('curated-words.js'),context);
  vm.runInContext(read('curated-songs.js'),context);
  vm.runInContext(read('curated-people.js'),context);
  vm.runInContext(read('mode-images.js'),context);
  vm.runInContext(read('app.js'),context);
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
  h.eval("soundOn=false; options.finishType='rounds'; options.riskRounds=false;options.rounds=8; options.duration=45; newGame();");
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
  const h=harness();h.eval('soundOn=false;newGame();roll()');h.pending.shift()();
  h.eval('toggleWord();startTimer(); game.current.deadline=Date.now()-100;tick()');
  assert.equal(h.eval('game.phase'),'judge');
  assert.equal(h.eval('game.current.finishedReason'),'timeout');
  h.eval('tick();judge(false);judge(true)');
  assert.equal(h.eval('game.roundIndex'),1);
  assert.deepEqual(Array.from(h.eval('game.scores')),[0,0]);
});
test('session and scores restore correctly after browser reload',()=>{
  const storage=new Map();
  const a=harness(storage);a.eval('soundOn=false;newGame();roll()');
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
  const a=harness(storage);a.eval('soundOn=false;newGame();roll()');a.pending.shift()();
  a.eval('toggleWord();startTimer();game.current.deadline=Date.now()-600;persist()');
  const b=harness(storage);
  assert.equal(b.eval('game.phase'),'judge');
  assert.equal(b.eval('game.current.finishedReason'),'timeout');
});
test('team names are escaped to prevent injection into game views',()=>{
  const h=harness();
  h.context.document.getElementById('team-a').value='<img src=x onerror=alert(1)>';
  h.eval('newGame()');
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
   options.dice=false;options.complications=false;options.duration=60;options.rounds=6;newGame()`);
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
 h.eval('soundOn=false;options.modes=["yesno"];newGame();roll()');
 h.pending.shift()();
 assert.equal(h.eval('game.current.modeId'),'yesno');
 assert.equal(h.eval('game.current.points'),2);
 assert.ok(h.eval('getPromptPool("people","easy").includes(game.current.word)'));
 h.eval('toggleWord();startTimer();finishTimer("early");judge(true)');
 assert.equal(h.eval('game.scores[1]'),2);
});
test('blitz is a sequence with correct, skip, no timer reset and per-word points',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];options.blitzCount=5;newGame();roll()');
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
 assert.equal(settings.blitzCount,5);
 assert.equal(Array.from(settings.modes).join(','),'mime');
 assert.equal(Array.from(settings.promptTypes).join(','),'phrase');
 assert.equal(settings.difficulty,'mixed');
});

test('secret mode always carries a modifier and pays three points',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["secret"];options.complications=false;newGame();roll()');
 h.pending.shift()();
 assert.equal(h.eval('game.current.modeId'),'secret');
 assert.ok(h.eval('game.current.complication').length>4);
 assert.equal(h.eval('game.current.points'),3);
 h.eval('toggleWord();startTimer();finishTimer("early");judge(true)');
 assert.equal(h.eval('game.scores[1]'),3);
});
test('blitz cannot add a correct answer once the timer has expired',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];newGame();roll()');
 h.pending.shift()();
 h.eval('toggleWord();startTimer();game.current.deadline=Date.now()-1;advanceBlitz(true)');
 assert.equal(h.eval('game.phase'),'judge');
 assert.equal(h.eval('game.current.blitzCorrect'),0);
});

test('easy words remain visible without a timer and allow pause and repeated replacement',()=>{
 const h=harness();
 h.eval('soundOn=false;options.difficulty="easy";options.modes=["talk"];newGame();roll()');
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
  h.eval('soundOn=false;options.difficulty="'+level+'";options.modes=["talk"];newGame();roll()');
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
  ev('soundOn=false;options.difficulty="'+level+'";options.modes=["secret"];options.complications=true;newGame()');
  for(let i=0;i<8;i++){
   ev('game.phase="ready";roll()');h.pending.shift()();
   assert.ok(ev('game.current.complication.length')>2,'secret modifier missing');
   if(level==='easy'){
    const id=ev('game.current.methodId');
    assert.ok(ev('EASY_COMPLICATIONS[game.current.methodId].includes(game.current.complication)'),'hard modifier in easy');
   }
  }
 }
});
test('countdown survives reload and respects its original start timestamp',()=>{
 const storage=new Map(),first=harness(storage);
 first.eval('soundOn=false;options.difficulty="hard";options.modes=["talk"];newGame();roll()');
 first.pending.shift()();
 first.eval('toggleWord()');
 const second=harness(storage);
 assert.equal(second.eval('game.phase'),'countdown');
 second.eval('game.current.autoStartAt=Date.now()-2;tick()');
 assert.equal(second.eval('game.phase'),'play');
});

test('blitz queues skipped prompts again without increasing maximum score',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];newGame();roll()');
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
 h.eval('soundOn=false;newGame();backToMenu()');
 assert.equal(h.eval('game.phase'),'ready');
 assert.equal(h.eval('activeScene'),'home');
 h.eval('continueGame()');
 assert.equal(h.eval('activeScene'),'game');
});

test('creating a game never requests another native confirmation',()=>{
 const h=harness();
 h.context.window.confirm=()=>{throw Error('Unexpected native confirm');};
 h.eval('soundOn=false;newGame();openSetup();newGame()');
 assert.equal(h.eval('game.phase'),'ready');
 assert.equal(h.eval('game.roundIndex'),0);
});
test('a correct answer on the timer awards once and immediately advances teams',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["talk"];options.difficulty="easy";options.dice=false;newGame();roll();toggleWord();startTimer()');
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
 h.eval('soundOn=false;options.modes=["talk"];options.dice=false;newGame();roll();toggleWord();startTimer()');
 h.eval('game.current.deadline=Date.now()-1;correctNow()');
 assert.equal(h.eval('game.phase'),'judge');
 assert.equal(h.eval('game.scores[0]'),0);
 h.eval('judge(false)');
 assert.equal(h.eval('game.phase'),'ready');
 assert.equal(h.eval('game.roundIndex'),1);
});
test('hiding the challenge on hard difficulty never alters its running deadline',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["talk"];options.dice=false;options.difficulty="hard";newGame();roll();toggleWord()');
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
 h.eval('soundOn=false;options.modes=["talk"];options.dice=false;newGame();roll();toggleWord()');
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
 h.eval('soundOn=false;options.dice=false;options.modes=["talk"];options.difficulty="easy";newGame();roll();toggleWord();startTimer()');
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
 h.eval('soundOn=false;options.dice=false;options.modes=["talk"];newGame();roll();toggleWord();startTimer()');
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
 h.eval('soundOn=false;options.modes=["blitz"];options.blitzCount=4;newGame();roll()');
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
  h.eval('soundOn=false;options.modes=["'+mode+'"];newGame();roll()');
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
 h.eval('soundOn=false;options.modes=["blitz"];options.dice=false;options.riskRounds=false;newGame();roll();toggleWord();startTimer();finishTimer("timeout")');
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

test('all seven modes use the correct, small and transparent WebP illustrations',()=>{
 const h=harness();
 const expected={talk:'talk',mime:'mime',draw:'draw',sing:'sing',yesno:'yesno',secret:'secret',blitz:'blitz'};
 const assetMap=JSON.parse(h.eval('JSON.stringify(MODE_ASSETS)'));
 assert.deepEqual(Object.keys(assetMap).sort(),Object.keys(expected).sort());
 for(const [mode,name] of Object.entries(expected)){
   assert.equal(assetMap[mode],'./assets/modes/'+name+'.webp?v=2');
   const file=fs.readFileSync(path.join(__dirname,'../assets/modes',name+'.webp'));
   assert.ok(file.length<90000,'Icon is too large for a mobile PWA: '+name);
   assert.equal(file.toString('ascii',0,4),'RIFF','Missing WebP RIFF header '+name);
   assert.equal(file.toString('ascii',8,12),'WEBP','Missing WebP signature '+name);
 }
});
test('reel sequence repeats around the chosen mode without modifying game mode or score',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["talk","draw","yesno"];newGame();roll()');
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
 assert.match(worker,/kvip-pwa-v16-20261021-vocabulary/);
 assert.match(worker,/iskra-pwa-/); // Clear the previous cache without losing offline updates.
});


test('duel score goal gives the opponent a reply, then extends a tie',()=>{
 const h=harness();
 h.eval("soundOn=false;options.finishType='score';options.targetScore=15;options.modes=['talk'];options.dice=false;options.riskRounds=false;newGame();game.scores=[14,14];");
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
 h.eval("soundOn=false;options.modes=['talk'];options.dice=false;options.riskRounds=true;newGame();game.scores=[10,1];roll();game.current.risk=true;toggleWord();startTimer();wrongNow()");
 assert.deepEqual(Array.from(h.eval('game.scores')),[10,0]);
 assert.equal(h.eval('game.history[0].awarded'),-1);
 h.eval('roll();game.current.risk=true;toggleWord();startTimer();wrongNow()');
 assert.equal(h.eval('game.scores[0]'),8);
 assert.equal(h.eval('game.history[1].awarded'),-2);
});
test('blitz is always five words and requires all five for three points',()=>{
 const h=harness();
 h.eval("soundOn=false;options.modes=['blitz'];options.dice=false;options.riskRounds=false;options.blitzCount=8;newGame();roll()");
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
 h.eval('soundOn=false;newGame()');
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
 initial.eval("soundOn=false;newGame();game.scoringVersion=undefined;game.finishType='rounds';game.rounds=12;game.riskRounds=false;game.current={modeId:'blitz',methodId:'blitz',word:'КОТ',blitzWords:['КОТ','ДОМ','ЛЕС','МЯЧ'],blitzCorrect:2,points:1,finishedReason:'timeout',risk:false};game.phase='judge';persist()");
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
 h.eval('soundOn=false;newGame()');
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
 h.eval('soundOn=false;newGame()');
 h.eval("game.used={};pullWord('blitz','easy')");
 const first=h.eval("game.used['easy:blitz:word,phrase,idiom'][0]");
 assert.equal(typeof first,'string');
 h.eval("pullWord('blitz','hard')");
 assert.equal(h.eval("game.used['easy:blitz:word,phrase,idiom'].length"),2);
 assert.equal(h.eval("game.used['hard:blitz:word,phrase,idiom']"),undefined);
});


test('new difficulty taxonomy chooses concrete easy, culinary medium, technical hard',()=>{
 const h=harness();
 h.eval('soundOn=false;newGame()');
 assert.ok(h.eval("getPromptPool('words','easy').includes('КОРАБЛЬ')"));
 assert.ok(h.eval("getPromptPool('words','medium').includes('МАТЧА')"));
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
 h.eval("soundOn=false;options.duration=60;options.modes=['blitz'];newGame();roll()");
 assert.equal(h.eval('game.current.seconds'),90);
 assert.equal(h.eval('game.current.blitzWords.length'),5);
});
