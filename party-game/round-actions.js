'use strict';
// Round actions; shared state and lifecycle remain in the existing scripts.

function advanceBlitz(correct) {
  if(!game||game.phase!=='play'||game.current.paused||game.current.modeId!=='blitz')return;
  const c=game.current;
  if(Date.now()>=c.deadline){finishTimer('timeout');return;}
  if(!Array.isArray(c.blitzQueue))
    c.blitzQueue=Array.from({length:c.blitzWords.length},(_,i)=>i).slice(c.blitzIndex);
  if(!c.blitzQueue.length)return;
  const index=c.blitzQueue.shift();
  if(correct)c.blitzCorrect++;
  else c.blitzQueue.push(index);
  c.blitzIndex++;
  if(!c.blitzQueue.length){finishTimer('completed');return;}
  c.word=c.blitzWords[c.blitzQueue[0]];
  c.cardId=c.blitzCardIds?.[c.blitzQueue[0]]??null;
  // Each next Blitz prompt starts visible, as it did before card toggling.
  c.visible=true;
  persist();sfx(correct?'win':'button');
  showTimer();
}

function roll() {
  if(!game||game.phase!=='ready')return;
  if(!game.dice){
    game.current=rollOutcome();game.phase='task';persist();sfx('go');render();
    return;
  }
  game.current=rollOutcome();
  game.phase='rolling';persist();sfx('roll');render();
  // The mode was chosen BEFORE the animation; visual movement never rerolls it.
  const current=game.current;
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const spin=reduce?1:ROLL_SPIN_MS;
  setTimeout(()=>{
    if(!game||game.phase!=='rolling'||game.current!==current||activeScene!=='game')return;
    game.phase='task';persist();sfx('go');render();
  },spin+ROLL_HOLD_MS);
}

function toggleWord() {
  if(!game||!roundUsesTimer()||!['task','countdown','play'].includes(game.phase))return;
  const phase=game.phase;
  // Revealing or hiding an answer never pauses or restarts the clock.
  game.current.visible=!game.current.visible;
  if(game.phase==='task'&&game.current.visible&&!allowPause()){
    game.phase='countdown';
    game.current.autoStartAt=Date.now()+1000;
  }
  persist();
  // Visibility updates keep the existing ticker. Only the first automatic
  // reveal changes phase and starts the original countdown lifecycle.
  if(game.phase!==phase)render(false);
  else if(phase==='task')showTask();
  else if(phase==='countdown')showCountdown();
  else showTimer();
}

function replaceWord() {
  if(!game||!roundUsesTimer()||game.phase!=='task'||!allowPause()||game.current.modeId==='blitz')return;
  const identity={cardId:null};
  game.current.word=pullWord(getMode(game.current.methodId).kind,game.current.difficulty,[],undefined,identity);
  game.current.cardId=identity.cardId;
  game.current.visible=false;
  persist();sfx('button');render();
}
