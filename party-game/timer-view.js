'use strict';
// Timer display only; clock control, state and helpers remain in the existing scripts.

function showTimer() {
  $('play-content').className='play-inner is-play stable-round';
  $('play-step').textContent=game.scoringVersion===2?'ОТГАДЫВАЕТ '+guessingTeam():'ВРЕМЯ ПОШЛО';
  const c=game.current,remaining=c.paused?c.remainingMs:c.deadline-Date.now();
  const shown=Math.max(0,remaining),blitz=c.modeId==='blitz',modified=allowsModifierResult();
  $('play-content').innerHTML=
    '<div class="round-top round-top--timer">'+
      '<span class="game-eyebrow">'+escapeHTML(modeInformation().name)+' · '+c.seconds+' СЕКУНД</span>'+
      (modified?'<div class="timer-cluster">':'')+
      '<div class="timer-ring'+(shown<=10000?' warning':'')+'" aria-label="Таймер">'+
        '<svg viewBox="0 0 200 200" class="ring-svg" aria-hidden="true">'+
          '<circle class="ring-bg" cx="100" cy="100" r="88" />'+
          '<circle id="timer-progress" class="ring-progress" cx="100" cy="100" r="88" />'+
        '</svg>'+
        '<div id="active-timer" class="play-timer'+(shown<=10000?' warning':'')+'" role="timer" aria-label="Оставшееся время">'+timerMarkup(shown)+'</div>'+
      '</div>'+
      (modified?iconButton(c.visible?'eye-off':'eye','toggle-word',c.visible?'Скрыть слово':'Показать слово')+'</div>':'')+
      (allowPause()?'<div class="timer-pause">'+iconButton(c.paused?'play':'pause',c.paused?'resume':'pause',c.paused?'Продолжить':'Пауза')+'</div>':'')+
      (blitz?blitzStatus():'')+
      (c.risk?'<p class="risk-notice">⚡ РИСК: ПРОВАЛ −'+ruleSetForGame(game).risk.loss+' ОЧКА</p>':'')+
    '</div>'+
    '<div class="round-fixed-card">'+taskMarkup(blitz?false:!c.visible)+'</div>'+
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
    '<div class="round-top round-top--timer">'+
      '<span class="game-eyebrow">'+escapeHTML(modeInformation().name)+'</span>'+
      '<h2 class="play-title">СТАРТ ЧЕРЕЗ <em>1 СЕКУНДУ</em></h2>'+
    '</div>'+
    '<div class="round-fixed-card">'+taskMarkup(false)+'</div>'+
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
