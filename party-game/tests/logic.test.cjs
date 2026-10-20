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
  h.eval('soundOn=false; options.rounds=8; options.duration=45; newGame();');
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
    const points=h.eval("game.current.modeId==='blitz'?game.current.blitzCorrect:game.current.points");
    const yes=i%3!==0;
    h.eval('judge('+yes+')');
    if(yes)earned[i%2]+=points;
    assert.equal(h.eval('game.roundIndex'),i+1);
    assert.equal(h.eval('game.scores['+(i%2)+']'),earned[i%2]);
    h.eval('judge(true)');
    assert.equal(h.eval('game.scores['+(i%2)+']'),earned[i%2],'double scoring!');
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
  const expected=a.eval('game.scores[0]');
  const b=harness(storage);
  assert.equal(b.eval('game.roundIndex'),1);
  assert.equal(b.eval('game.scores[0]'),expected);
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
   options.dice=false;options.complications=false;options.duration=135;options.rounds=6;newGame()`);
 assert.equal(h.eval('game.modes.join(",")'),'talk');
 assert.equal(h.eval('game.duration'),135);
 h.eval('roll()');
 assert.equal(h.pending.length,0,'No-dice mode should open immediately');
 assert.equal(h.eval('game.phase'),'task');
 assert.equal(h.eval('game.current.modeId'),'talk');
 assert.equal(h.eval('game.current.complication'),'');
 const word=h.eval('game.current.word');
 assert.ok(h.eval('PARTY_IDIOMS.easy.includes(game.current.word)'),word+' was not an idiom');
});
test('yes/no mode uses person and character cards worth two points',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["yesno"];newGame();roll()');
 h.pending.shift()();
 assert.equal(h.eval('game.current.modeId'),'yesno');
 assert.equal(h.eval('game.current.points'),2);
 assert.ok(h.eval('PARTY_PEOPLE.easy.includes(game.current.word)'));
 h.eval('toggleWord();startTimer();finishTimer("early");judge(true)');
 assert.equal(h.eval('game.scores[0]'),2);
});
test('blitz is a sequence with correct, skip, no timer reset and per-word points',()=>{
 const h=harness();
 h.eval('soundOn=false;options.modes=["blitz"];options.blitzCount=5;newGame();roll()');
 h.pending.shift()();
 assert.equal(h.eval('game.current.blitzWords.length'),5);
 assert.equal(new Set(h.eval('game.current.blitzWords')).size,5);
 assert.equal(h.eval('game.current.seconds'),30);
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
 assert.equal(h.eval('game.scores[0]'),5,'blitz double-awarded');
});
test('manual game settings are clamped and invalid modes are filtered on restore',()=>{
 const h=harness();
 const settings=h.eval('sanitizeOptions({duration:999,rounds:1,blitzCount:100,modes:["mime","bogus"],promptTypes:["phrase","invalid"],difficulty:"mixed"})');
 assert.equal(settings.duration,300);
 assert.equal(settings.rounds,2);
 assert.equal(settings.blitzCount,8);
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
 assert.equal(h.eval('game.scores[0]'),3);
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
 h.eval('soundOn=false;options.modes=["blitz"];options.blitzCount=3;newGame();roll()');
 h.pending.shift()();
 h.eval('toggleWord();startTimer()');
 const first=h.eval('game.current.word');
 const deadline=h.eval('game.current.deadline');
 h.eval('advanceBlitz(false)');
 assert.equal(h.eval('game.current.blitzQueue.length'),3);
 h.eval('advanceBlitz(true);advanceBlitz(true)');
 assert.equal(h.eval('game.phase'),'play','The skipped word must remain pending');
 assert.equal(h.eval('game.current.word'),first,'Skipped word never cycled back');
 assert.equal(h.eval('game.current.deadline'),deadline,'Clock reset when recycling words');
 h.eval('advanceBlitz(true)');
 assert.equal(h.eval('game.phase'),'judge');
 assert.equal(h.eval('game.current.blitzCorrect'),3);
 h.eval('judge(true)');
 assert.equal(h.eval('game.scores[0]'),3,'Repeated prompt was counted twice');
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
 assert.equal(h.eval('game.scores[0]'),1);
 assert.equal(h.eval('game.history[0].word'),word);
 h.eval('handleAction("correct-now");judge(true)');
 assert.equal(h.eval('game.scores[0]'),1);
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
 assert.equal(h.eval('game.current.blitzQueue.length'),4);
 assert.equal(h.eval('game.current.blitzSkipped'),undefined);
 const status=h.eval('blitzStatus()');
 assert.ok(status.includes('ОСТАЛОСЬ: 4'));
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
  h.eval('toggleWord();startTimer();finishTimer("timeout")');
  const markup=h.elements.get('play-content').innerHTML;
  assert.ok(markup.indexOf('data-action="no"')<markup.indexOf('data-action="yes"'),mode);
  assert.ok(markup.indexOf('judgement--no')<markup.indexOf('judgement--yes'),mode);
 }
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
   assert.equal(assetMap[mode],'./assets/modes/'+name+'.webp');
   const file=fs.readFileSync(path.join(__dirname,'../assets/modes',name+'.webp'));
   assert.ok(file.length<30000,'Icon is too large for a mobile PWA: '+name);
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
 assert.match(worker,/kvip-pwa-v10-20261020/);
 assert.match(worker,/iskra-pwa-/); // Clear the previous cache without losing offline updates.
});
