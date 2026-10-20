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
test('timer, all six modes, scoring, alternation and results survive repeated button actions',()=>{
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
    assert.ok(['talk','mime','draw','sing','secret','blitz'].includes(mode));
    assert.equal(h.eval('game.current.visible'),false);
    h.eval('toggleWord();startTimer()');
    assert.equal(h.eval('game.phase'),'play');
    h.eval('pauseTimer()');
    assert.equal(h.eval('game.current.paused'),true);
    h.eval('resumeTimer()');
    assert.equal(h.eval('game.current.paused'),false);
    h.eval("finishTimer('early')");
    assert.equal(h.eval('game.phase'),'judge');
    const points=h.eval('game.current.points');
    const yes=i%3!==0;
    h.eval('judge('+yes+')');
    if(yes)earned[i%2]+=points;
    assert.equal(h.eval('game.roundIndex'),i+1);
    assert.equal(h.eval('game.scores['+(i%2)+']'),earned[i%2]);
    h.eval('judge(true)');
    assert.equal(h.eval('game.scores['+(i%2)+']'),earned[i%2],'double scoring!');
    if(i<7) {
      assert.equal(h.eval('game.phase'),'between');
      h.eval("handleAction('next')");
      assert.equal(h.eval('game.phase'),'ready');
    }
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
  assert.equal(b.eval('game.phase'),'between');
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
  assert.ok(!h.elements.get('play-content').innerHTML.includes('<img'));
});
