'use strict';
// Timer display only; clock control, state and helpers remain in the existing scripts.

// Actions reuse the existing policy and controllers, including historical Mixed saves.
function timerControlAttributes(countdown){
 const c=game.current;
 if(countdown||!roundUsesTimer()||!allowPause()||c.feedbackHold||
   !(game.phase==='play'||game.phase==='task'&&c.visible))return ' aria-label="Таймер"';
 const action=game.phase==='task'?'start-timer':c.paused?'resume':'pause';
 const label=action==='start-timer'?'Запустить таймер':action==='pause'?'Поставить таймер на паузу':'Продолжить таймер';
 return ' role="button" tabindex="0" data-action="'+action+'" aria-label="'+label+'"';
}
function focusTimerControl(){
 $('play-content').querySelector('.timer-ring[role="button"]')?.focus({preventScroll:true});
}
// Native touch scrolling cancels its click; the distance guard also rejects short drags.
function registerTimerControls(){
 const surface=$('play-content');let gesture=null;
 surface.addEventListener('pointerdown',event=>{
  if(event.target.closest('.timer-ring[role="button"]'))gesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  else gesture=null;
 },{passive:true});
 surface.addEventListener('pointermove',event=>{
  if(gesture?.id===event.pointerId&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>8)gesture.moved=true;
 },{passive:true});
 surface.addEventListener('pointercancel',()=>{if(gesture)gesture.moved=true;},{passive:true});
 surface.addEventListener('click',event=>{
  if(event.target.closest('.timer-ring[role="button"]')&&event.detail!==0&&gesture?.moved){event.stopImmediatePropagation();event.preventDefault();}
  gesture=null;
 },true);
 surface.addEventListener('keydown',event=>{
  const timer=event.target.closest('.timer-ring[role="button"]');
  if(!timer||!['Enter',' '].includes(event.key))return;
  event.preventDefault();if(!event.repeat)timer.click();
 });
}
// The same slot is used after Easy reveal, during auto-start, and while running.
function roundTimerSlotMarkup(shown,countdown=false,active=false){
 const c=game.current;
 return '<span class="game-eyebrow"'+(countdown?' aria-label="'+escapeHTML(modeInformation().name)+': старт через одну секунду"':'')+'>'+
  (countdown?'СТАРТ ЧЕРЕЗ 1 СЕКУНДУ':escapeHTML(modeInformation().name)+' · '+c.seconds+' СЕКУНД')+'</span>'+
  (c.modeId==='blitz'?'<div class="round-timer-stack">':'')+'<div class="timer-dial">'+feedbackButtonMarkup(false)+
  '<div class="timer-ring'+(shown<=10000?' warning':'')+'"'+timerControlAttributes(countdown)+'>'+
   '<svg viewBox="0 0 200 200" class="ring-svg" aria-hidden="true"><circle class="ring-bg" cx="100" cy="100" r="88" />'+
   '<circle id="'+(active?'timer-progress':'preview-timer-progress')+'" class="ring-progress" cx="100" cy="100" r="88" /></svg>'+
   '<div id="'+(active?'active-timer':'preview-timer')+'" class="play-timer'+(shown<=10000?' warning':'')+'" role="timer" aria-label="Оставшееся время">'+timerMarkup(shown)+'</div></div>'+
  feedbackButtonMarkup(true)+'</div>'+(c.modeId==='blitz'?blitzStatus()+'</div>':'');
}

function showTimer() {
  $('play-content').className='play-inner is-play stable-round';
  $('play-step').textContent=game.scoringVersion===2?'ОТГАДЫВАЕТ '+guessingTeam():'ВРЕМЯ ПОШЛО';
  const c=game.current,remaining=c.paused?c.remainingMs:c.deadline-Date.now();
  const shown=Math.max(0,remaining),blitz=c.modeId==='blitz';
  $('play-content').innerHTML=
    '<div class="round-top round-top--timer" tabindex="0" role="region" aria-label="Таймер и условия раунда">'+
      roundTimerSlotMarkup(shown,false,true)+
    '</div>'+
    '<div class="round-fixed-card">'+taskMarkup(!c.visible)+'</div>'+
    roundConditionSlotMarkup()+
    '<div class="round-bottom round-bottom--play">'+
      (blitz?'<div class="three-answer-actions blitz-actions">'+
        '<div class="blitz-control">'+iconButton('x','blitz-skip','Пропустить слово','danger prominent')+
          '<span>ПРОПУСТИТЬ</span></div>'+
        '<span aria-hidden="true"></span>'+
        '<div class="blitz-control">'+iconButton('check','blitz-correct',game.scoringVersion===2?'Слово отгадано':'Угадали — +1 очко','success prominent')+
          '<span>'+(game.scoringVersion===2?'ОТГАДАНО':'УГАДАЛИ +1')+'</span></div>'+
        '</div><div class="minor-action">'+makeButton('ЗАВЕРШИТЬ БЛИЦ','finish-early','button-quiet')+'</div>':
        resultControls(true))+
    '</div>';
  updateTimerVisual(shown);
}

function showCountdown() {
  $('play-content').className='play-inner is-countdown stable-round';
  $('play-step').textContent='ПРИГОТОВЬТЕСЬ';
  $('play-content').innerHTML=
    '<div class="round-top round-top--timer" tabindex="0" role="region" aria-label="Таймер и условия раунда">'+
      roundTimerSlotMarkup(game.current.seconds*1000,true)+
    '</div>'+
    '<div class="round-fixed-card">'+taskMarkup(!game.current.visible)+'</div>'+
    roundConditionSlotMarkup()+
    '<div class="round-bottom"><p class="play-subtitle">Таймер запускается автоматически</p></div>';
}

function updateTimerVisual(remaining) {
  const c=game?.current;
  if(!c)return;
  const timer=$('active-timer'),progress=$('timer-progress');
  if(!timer||!progress)return;
  timer.innerHTML=timerMarkup(remaining);
  const warning=remaining<=10000;
  timer.classList.toggle('warning',warning);
  const fraction=Math.max(0,Math.min(1,remaining/(c.seconds*1000)));
  progress.style.strokeDashoffset=String(2*Math.PI*88*(1-fraction));
  progress.closest?.('.timer-ring')?.classList.toggle('warning',warning);
}
