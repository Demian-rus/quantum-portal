'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createSimulation}=require('../scripts/game-simulation.cjs');
test('card visibility: task/countdown/play toggles preserve the original clock and ticker in every difficulty',()=>{
 for(const mode of ['talk','secret','blitz'])for(const difficulty of ['easy','medium','hard','mixed']){
  const h=createSimulation();let now=Date.now(),intervals=0;
  h.context.Date=class extends Date{static now(){return now}};
  h.context.setInterval=()=>++intervals;h.context.mode=mode;h.context.level=difficulty;
  h.eval("Object.assign(options,{modes:[mode],difficulty:level,dice:false,complications:false});newGame();roll()");
  const word=h.eval('game.current.word');assert.equal(h.eval('game.current.visible'),false);
  const hidden=h.eval('taskMarkup(true)');assert.ok(hidden.startsWith('<button '));assert.ok(!hidden.includes(word));
  assert.match(hidden,/aria-pressed="false"/);assert.match(hidden,/НАЖМИ, ЧТОБЫ ОТКРЫТЬ/);
  h.eval('toggleWord()');assert.equal(h.eval('game.current.visible'),true);
  if(difficulty==='easy')h.eval('startTimer()');
  else{
   assert.equal(h.eval('game.phase'),'countdown');const scheduled=h.eval('game.current.autoStartAt'),before=intervals;
   h.eval('toggleWord();toggleWord()');assert.equal(h.eval('game.current.autoStartAt'),scheduled);assert.equal(intervals,before);
   now=scheduled+1000;h.eval('tick()');assert.equal(h.eval('game.current.deadline'),scheduled+h.eval('game.current.seconds')*1000);
  }
  assert.equal(h.eval('game.phase'),'play');const before=intervals;
  const clock=h.eval('JSON.stringify([game.current.deadline,game.current.autoStartAt,game.current.remainingMs,game.current.paused])');
  h.eval('Math.random=()=>{throw Error("Visibility consumed RNG")};toggleWord()');
  assert.equal(h.eval('game.current.visible'),false);assert.ok(!h.elements.get('play-content').innerHTML.includes(word));
  h.eval('toggleWord()');assert.equal(h.eval('game.current.visible'),true);
  assert.equal(h.eval('JSON.stringify([game.current.deadline,game.current.autoStartAt,game.current.remainingMs,game.current.paused])'),clock);
  assert.equal(intervals,before);assert.equal(h.eval('game.current.word'),word);
  assert.ok(!h.eval('taskControls(game.current)').includes('toggle-word'));
  if(difficulty==='easy'){
   h.eval('pauseTimer()');const paused=h.eval('JSON.stringify([game.current.remainingMs,game.current.deadline,game.current.paused])');
   h.eval('toggleWord();toggleWord()');assert.equal(h.eval('JSON.stringify([game.current.remainingMs,game.current.deadline,game.current.paused])'),paused);
  }
 }
});
test('card visibility: Blitz skip/correct reveal the next prompt without resetting its deadline',()=>{
 const h=createSimulation();h.eval("Object.assign(options,{modes:['blitz'],difficulty:'easy',dice:false});newGame();roll();toggleWord();startTimer();toggleWord()");
 const deadline=h.eval('game.current.deadline');assert.equal(h.eval('game.current.visible'),false);
 h.eval('advanceBlitz(false)');assert.equal(h.eval('game.current.visible'),true);assert.equal(h.eval('game.current.blitzCorrect'),0);
 assert.equal(h.eval('game.current.word'),h.eval('game.current.blitzWords[game.current.blitzQueue[0]]'));
 h.eval('toggleWord();advanceBlitz(true)');assert.equal(h.eval('game.current.visible'),true);assert.equal(h.eval('game.current.blitzCorrect'),1);
 assert.equal(h.eval('game.current.deadline'),deadline);assert.equal(h.eval('game.history.length'),0);
});
test('card visibility: saved hidden play restores exactly; numerical questions retain their own reveal action',()=>{
 const storage=new Map(),h=createSimulation(1,storage);
 h.eval("Object.assign(options,{modes:['talk'],difficulty:'easy',dice:false});newGame();roll();toggleWord();startTimer();toggleWord();game.dice=true;persist()");
 const before=h.eval('JSON.stringify(game)'),raw=storage.get('iskra-party:v1'),restored=createSimulation(2,storage);
 assert.equal(restored.eval('JSON.stringify(game)'),before);assert.equal(storage.get('iskra-party:v1'),raw);
 restored.eval('continueGame()');assert.equal(restored.eval('game.current.visible'),false);
 h.eval("Object.assign(options,{modes:['approx'],difficulty:'easy',dice:false});newGame();roll()");
 const question=h.eval('JSON.stringify(game)');h.eval('toggleWord()');assert.equal(h.eval('JSON.stringify(game)'),question);
 assert.match(h.elements.get('play-content').innerHTML,/data-action="reveal-approx"/);
 assert.ok(!h.elements.get('play-content').innerHTML.includes('data-action="toggle-word"'));
});
