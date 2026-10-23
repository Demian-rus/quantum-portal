'use strict';
// Timer lifecycle; shared state, rendering and settlement remain in existing scripts.

function stopTicking() {
  if(intervalId!==null){clearInterval(intervalId);intervalId=null;}
}

function beginAutomaticRound() {
  if(!game||!roundUsesTimer()||game.phase!=='countdown')return;
  const c=game.current;
  const startAt=c.autoStartAt || Date.now();
  c.deadline=startAt+c.seconds*1000;
  c.autoStartAt=null;
  c.remainingMs=null;c.paused=false;
  game.phase='play';
  lastChimeAt=null;
  persist();sfx('go');render();
}

function startTicking() {
  stopTicking();
  intervalId=setInterval(tick,100);
  tick();
}

function tick() {
  if(!game||!roundUsesTimer())return;
  if(game.phase==='countdown'){
    if(Date.now()>=game.current.autoStartAt)beginAutomaticRound();
    return;
  }
  if(game.phase!=='play'||game.current.paused)return;
  const remain=Math.max(0,game.current.deadline-Date.now());
  const second=Math.ceil(remain/1000);
  updateTimerVisual(remain);
  if(second<=10&&second>0&&second!==lastChimeAt) {
    lastChimeAt=second;
    if(soundOn)sfx(second<=3?'last':'tick');
  }
  if(remain<=0)finishTimer('timeout');
}

function finishTimer(reason) {
  if(!game||!roundUsesTimer()||game.phase!=='play')return;
  stopTicking();
  game.phase='judge';
  game.current.finishedReason=reason;
  game.current.deadline=null;
  game.current.paused=false;
  persist();
  if(reason==='timeout') {
    sfx('time');
    if(navigator.vibrate)navigator.vibrate([120,60,180]);
  }
  render();
}

function startTimer() {
  if(!game||!roundUsesTimer()||game.phase!=='task'||!game.current.visible||!allowPause())return;
  game.phase='play';
  game.current.deadline=Date.now()+game.current.seconds*1000;
  game.current.remainingMs=null;
  game.current.paused=false;
  lastChimeAt=null;
  persist();sfx('go');render();
}

function pauseTimer() {
  if(!game||!roundUsesTimer()||game.phase!=='play'||game.current.paused||!allowPause())return;
  game.current.remainingMs=Math.max(0,game.current.deadline-Date.now());
  game.current.paused=true;
  game.current.deadline=null;
  persist();render();
}

function resumeTimer() {
  if(!game||!roundUsesTimer()||game.phase!=='play'||!game.current.paused||!allowPause())return;
  game.current.deadline=Date.now()+game.current.remainingMs;
  game.current.paused=false;
  persist();sfx('go');render();
}
