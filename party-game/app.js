'use strict';
const STORAGE_KEY = 'iskra-party:v1';
const MODE_LIST = Object.freeze([
  {id:'talk',title:'ГОВОРИ',symbol:'◉',rule:'Объясняй словами. Нельзя произносить загаданное слово, его части и однокоренные слова.',kind:'words'},
  {id:'mime',title:'ПОКАЖИ',symbol:'✋',rule:'Только движения и мимика. Никаких слов, звуков и букв в воздухе.',kind:'words'},
  {id:'draw',title:'РИСУЙ',symbol:'✎',rule:'Рисуй на бумаге или в заметках. Нельзя писать буквы, цифры или показывать жестами.',kind:'words'},
  {id:'sing',title:'НАПОЙ',symbol:'♫',rule:'Напой любую знакомую песню, связанную с темой карточки. Команда должна назвать тему.',kind:'songs'},
  {id:'secret',title:'СЕКРЕТКА',symbol:'✳',rule:'Особые правила и двойные очки. Что выпадет — узнаешь после броска!',kind:'words',points:2},
  {id:'blitz',title:'БЛИЦ',symbol:'ϟ',rule:'Объясняй словами, но у тебя лишь 30 секунд. Без однокоренных слов!',kind:'words',seconds:30}
]);
const COMPLICATIONS = Object.freeze({
  talk: ['Объясняй шёпотом.', 'Каждую фразу начинай со слова «Представь».', 'Нельзя произносить «да» и «нет».', 'Объясняй как диктор срочных новостей.'],
  mime: ['Одну руку держи за спиной.', 'Показывай только сидя.', 'Двигайся как в замедленной съёмке.', 'Изображай как робот.'],
  draw: ['Рисуй неведущей рукой.', 'Рисуй, не отрывая ручку от бумаги.', 'На рисунке максимум пять линий.', 'Рисуй с закрытым одним глазом.'],
  sing: ['Пой как оперный артист.', 'Пой очень тихо.', 'Пой максимально торжественно.', 'Пой будто это колыбельная.'],
  blitz: ['Начинай каждую подсказку со слова «Это».', 'Объясняй как спортивный комментатор.', 'Нельзя использовать слово «очень».', 'Представь, что объясняешь ребёнку.']
});
const $ = id => document.getElementById(id);
const freshOptions = () => ({difficulty:'easy',duration:60,rounds:12});
let options = freshOptions();
let soundOn = true;
let game = null;
let rafId = 0;
let intervalId = null;
let audioContext = null;
let lastChimeAt = null;
let toastTimeout = null;

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
}
function readSaved() {
  try {
    const obj=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return obj?.version===1 ? obj : null;
  } catch { return null; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,options,soundOn,game})); }
  catch { /* Private browsing might block storage; a session still works. */ }
}
function sanitizeTeam(name,fallback) {
  const str=String(name||'').replace(/\s+/g,' ').trim().slice(0,24);
  return str || fallback;
}
function randomOne(list) { return list[Math.floor(Math.random()*list.length)]; }
function currentTeamIndex() { return game.roundIndex%2; }
function currentTeam() { return game.teams[currentTeamIndex()]; }
function currentMode() { return MODE_LIST.find(mode=>mode.id===game.current?.modeId); }
function getMode(id) { return MODE_LIST.find(m=>m.id===id); }
function formatTimer(ms) {
  const seconds=Math.max(0,Math.ceil(ms/1000));
  return String(Math.floor(seconds/60)).padStart(1,'0')+':'+String(seconds%60).padStart(2,'0');
}
function setSoundIcon() {
  $('sound-toggle').setAttribute('aria-pressed',String(soundOn));
  $('sound-toggle').setAttribute('aria-label',soundOn?'Выключить звук':'Включить звук');
  $('sound-toggle').title=soundOn?'Выключить звук':'Включить звук';
}
function initAudio() {
  if(!soundOn)return;
  try {
    const Ctor=window.AudioContext||window.webkitAudioContext;
    if(!Ctor)return;
    if(!audioContext)audioContext=new Ctor();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  } catch { /* Audio is optional, never block play. */ }
}
function tone(freq=660,duration=.11,type='sine',volume=.07,delay=0) {
  if(!soundOn)return;
  initAudio();
  if(!audioContext)return;
  try {
    const now=audioContext.currentTime+delay;
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(freq,now);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(volume,now+.016);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    oscillator.connect(gain);gain.connect(audioContext.destination);
    oscillator.start(now);oscillator.stop(now+duration+.02);
  } catch { /* Playback may be restricted by the device. */ }
}
function sfx(kind) {
  if(kind==='button')tone(520,.08,'triangle',.055);
  if(kind==='roll'){tone(340,.1,'triangle',.055);tone(540,.13,'triangle',.05,.12);}
  if(kind==='go'){tone(560,.1,'sine',.06);tone(740,.14,'sine',.07,.14);}
  if(kind==='tick')tone(600,.09,'sine',.075);
  if(kind==='last')tone(910,.17,'triangle',.11);
  if(kind==='time'){tone(520,.24,'sawtooth',.09);tone(390,.4,'triangle',.10,.23);tone(260,.5,'triangle',.09,.55);}
  if(kind==='win'){tone(500,.12,'triangle',.07);tone(660,.16,'triangle',.07,.15);tone(880,.3,'triangle',.09,.34);}
  if(kind==='fail')tone(285,.21,'triangle',.075);
}
function toast(message) {
  const element=$('toast');
  element.textContent=message;
  element.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>element.classList.remove('show'),2450);
}
function closeRules() { $('rules-backdrop').hidden=true; }
function openRules() { $('rules-backdrop').hidden=false; }
function setScene(which) {
  for(const scene of ['home','game','results']) $('scene-'+scene).hidden=scene!==which;
}
function renderOptions() {
  for(const [setting,value] of Object.entries(options)) {
    document.querySelectorAll('.choices[data-setting="'+setting+'"] button').forEach(button=>{
      const selected=String(value)===button.dataset.value;
      button.classList.toggle('is-chosen',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
}
function renderMatch() {
  $('label-team-a').textContent=game.teams[0];
  $('label-team-b').textContent=game.teams[1];
  $('score-a').textContent=game.scores[0];
  $('score-b').textContent=game.scores[1];
  $('round-now').textContent=Math.min(game.roundIndex+1,game.rounds);
  $('round-total').textContent=game.rounds;
  $('match-progress').style.width=(game.roundIndex/game.rounds*100)+'%';
  $('match-team-a').classList.toggle('is-turn',currentTeamIndex()===0);
  $('match-team-b').classList.toggle('is-turn',currentTeamIndex()===1);
}
function pickMode() {
  const recent=game.modeHistory.slice(-2);
  const candidates=MODE_LIST.filter(mode=>!recent.includes(mode.id));
  return randomOne(candidates.length?candidates:MODE_LIST);
}
function pullWord(kind) {
  const pack=kind==='songs'?PARTY_SONGS:PARTY_WORDS;
  const pool=pack[game.difficulty] || pack.easy;
  if(!pool?.length)throw Error('Словарь пуст');
  const key=game.difficulty+':'+kind;
  let used=game.used[key] || [];
  let free=pool.filter(word=>!used.includes(word));
  if(!free.length) { used=[];free=pool.slice(); }
  const word=randomOne(free);
  used.push(word);
  game.used[key]=used;
  return word;
}
function rollOutcome() {
  const mode=pickMode();
  game.modeHistory.push(mode.id);
  let actualMode=mode;
  let complication='';
  if(mode.id==='secret'){
    actualMode=randomOne(MODE_LIST.filter(m=>['talk','mime','draw','sing'].includes(m.id)));
    complication=randomOne(COMPLICATIONS[actualMode.id]);
  } else if(Math.random()<.22) {
    complication=randomOne(COMPLICATIONS[mode.id]||[]);
  }
  const word=pullWord(actualMode.kind);
  return {
    modeId:mode.id,methodId:actualMode.id,word,complication,
    points:mode.points||1,seconds:mode.seconds||game.duration,
    visible:false,paused:false,remainingMs:null,deadline:null,
    finishedReason:null,replaced:false
  };
}
function makeButton(label,action,style='button-secondary') {
  return '<button type="button" class="button '+style+'" data-action="'+action+'">'+label+'</button>';
}
function showReady() {
  $('play-step').textContent='ПЕРЕДАЙТЕ ТЕЛЕФОН';
  const index=currentTeamIndex();
  const team=escapeHTML(currentTeam());
  $('play-content').innerHTML=
    '<span class="game-eyebrow">ХОД '+(game.roundIndex+1)+' ИЗ '+game.rounds+'</span>'+
    '<div class="ready-avatar '+(index===1?'is-blue':'')+'">'+(index===1?'✦':'✳')+'</div>'+
    '<h2 class="play-title">НА ОЧЕРЕДИ<br><em>'+team+'</em></h2>'+
    '<p class="play-subtitle">Передайте устройство игроку своей команды. Бросайте кубик и готовьтесь объяснять!</p>'+
    makeButton('БРОСИТЬ КУБИК <span aria-hidden="true">↗</span>','roll','button-primary button-big');
}
function showRolling() {
  $('play-step').textContent='КУБИК В ПОЛЁТЕ';
  $('play-content').innerHTML=
    '<span class="game-eyebrow">СУДЬБА ВЫБИРАЕТ</span>'+
    '<div class="mode-symbol is-rolling" aria-hidden="true">✳</div>'+
    '<h2 class="play-title">ЧТО ЖЕ <em>ВЫПАДЕТ?</em></h2>'+
    '<p class="play-subtitle">Готовьте голос, руки и фантазию!</p>';
}
function modeInformation() {
  const mode=getMode(game.current.modeId);
  const method=getMode(game.current.methodId);
  const secret=mode.id==='secret';
  return {
    mode,method,secret,
    name:secret?'СЕКРЕТКА: '+method.title:mode.title,
    rule:method.rule
  };
}
function taskMarkup(hidden) {
  const {method}=modeInformation();
  const word=escapeHTML(game.current.word);
  const what=method.id==='sing'?'ТЕМА ДЛЯ ПЕСНИ':'ВАШЕ ЗАДАНИЕ';
  return '<div class="challenge-card '+(hidden?'is-hidden':'')+'">'+
    '<span class="challenge-overline">'+what+'</span>'+
    '<div class="challenge-word '+(hidden?'challenge-word--hidden':'')+'">'+
    (hidden?'НАЖМИ, ЧТОБЫ ОТКРЫТЬ':word)+'</div>'+
    (hidden?'':'<span class="challenge-details">ЗАПОМНИ И НАЧИНАЙ!</span>')+'</div>';
}
function showTask() {
  const {mode,method,secret,name,rule}=modeInformation();
  $('play-step').textContent='ВАМ ВЫПАЛО';
  const c=game.current;
  $('play-content').innerHTML=
    '<div class="mode-symbol">'+mode.symbol+'</div>'+
    '<span class="mode-chip">КУБИК ПОКАЗАЛ</span>'+
    '<h2 class="play-title mode-name">'+escapeHTML(name)+'</h2>'+
    '<div class="mode-rule">'+escapeHTML(rule)+
    (c.complication?'<br><strong>УСЛОЖНЕНИЕ: '+escapeHTML(c.complication)+'</strong>':'')+'</div>'+
    (secret?'<span class="secret-flag">✳ ДВОЙНЫЕ ОЧКИ · +2</span>':'')+
    taskMarkup(!c.visible)+
    '<div class="inline-actions">'+
    (c.visible?makeButton('СКРЫТЬ СЛОВО','toggle-word'):makeButton('ОТКРЫТЬ ЗАДАНИЕ','toggle-word','button-coral'))+
    (!c.replaced?makeButton('ДРУГОЕ СЛОВО (1×)','replace-word','button-quiet'):'')+'</div>'+
    (c.visible?makeButton('СТАРТ ТАЙМЕРА ↗','start-timer','button-primary button-big'):
      '<span class="score-note">Сначала открой карточку — соперники не должны видеть ответ</span>');
}
function showTimer() {
  $('play-step').textContent='ВРЕМЯ ПОШЛО';
  const c=game.current,remaining=c.paused?c.remainingMs:c.deadline-Date.now();
  const shown=Math.max(0,remaining);
  $('play-content').innerHTML=
    '<span class="game-eyebrow">'+escapeHTML(modeInformation().name)+' · '+c.seconds+' СЕКУНД</span>'+
    '<div id="active-timer" class="play-timer'+(shown<=10000?' warning':'')+'" role="timer" aria-label="Оставшееся время">'+formatTimer(shown)+'</div>'+
    '<div class="timer-track'+(shown<=10000?' warning':'')+'"><span id="timer-progress" style="width:'+(shown/c.seconds/10)+'%"></span></div>'+
    taskMarkup(!c.visible)+
    '<div class="inline-actions">'+
    makeButton(c.visible?'СКРЫТЬ СЛОВО':'ПОКАЗАТЬ СЛОВО','toggle-word')+
    makeButton(c.paused?'ПРОДОЛЖИТЬ':'ПАУЗА',c.paused?'resume':'pause')+'</div>'+
    makeButton('ЗАВЕРШИТЬ ДОСРОЧНО','finish-early','button-quiet');
  updateTimerVisual(shown);
}
function updateTimerVisual(remaining) {
  const c=game?.current;
  if(!c)return;
  const timer=$('active-timer'),progress=$('timer-progress');
  if(!timer||!progress)return;
  timer.textContent=formatTimer(remaining);
  const warning=remaining<=10000;
  timer.classList.toggle('warning',warning);
  progress.style.width=(Math.max(0,Math.min(1,remaining/(c.seconds*1000)))*100)+'%';
  progress.parentElement.classList.toggle('warning',warning);
}
function stopTicking() {
  if(intervalId!==null){clearInterval(intervalId);intervalId=null;}
}
function startTicking() {
  stopTicking();
  intervalId=setInterval(tick,100);
  tick();
}
function tick() {
  if(!game||game.phase!=='play'||game.current.paused)return;
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
  if(!game||game.phase!=='play')return;
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
function showJudge() {
  $('play-step').textContent='ИТОГ РАУНДА';
  const c=game.current;
  $('play-content').innerHTML=
    '<span class="game-eyebrow">'+(c.finishedReason==='timeout'?'ВРЕМЯ ВЫШЛО':'РАУНД ЗАКОНЧЕН')+'</span>'+
    '<div class="mode-symbol">◷</div>'+
    '<h2 class="play-title">КОМАНДА <em>УГАДАЛА?</em></h2>'+
    '<p class="play-subtitle">Никакого автоматического судейства — вы сами решаете, засчитать ли ответ.</p>'+
    '<p class="score-note">Было загадано: <b>'+escapeHTML(c.word)+'</b> · За ответ: +'+c.points+'</p>'+
    '<div class="judgement-grid">'+
    '<button class="judgement judgement--yes" data-action="yes" type="button" aria-label="Да, команда угадала"><svg viewBox="0 0 64 64"><path d="m13 33 13 13 25-28"/></svg></button>'+
    '<button class="judgement judgement--no" data-action="no" type="button" aria-label="Нет, команда не угадала"><svg viewBox="0 0 64 64"><path d="m17 17 30 30M47 17 17 47"/></svg></button>'+
    '</div><div class="judgement-labels"><span>УГАДАЛИ</span><span>НЕ УГАДАЛИ</span></div>';
}
function judge(yes) {
  if(!game||game.phase!=='judge')return;
  const teamIndex=currentTeamIndex();
  const points=yes?game.current.points:0;
  game.scores[teamIndex]+=points;
  game.history.push({
    team:game.teams[teamIndex],mode:game.current.modeId,
    word:game.current.word,awarded:points,correct:yes
  });
  game.roundIndex++;
  game.phase=game.roundIndex>=game.rounds?'results':'between';
  persist();
  sfx(yes?'win':'fail');
  render();
}
function showBetween() {
  $('play-step').textContent='РАУНД ЗАВЕРШЁН';
  const last=game.history[game.history.length-1];
  $('play-content').innerHTML=
    '<span class="game-eyebrow">СЧЁТ ОБНОВЛЁН</span>'+
    '<div class="mode-symbol">'+(last.correct?'✓':'×')+'</div>'+
    '<h2 class="play-title">'+(last.correct?'ЕСТЬ! <em>+'+last.awarded+' ОЧК'+(last.awarded===1?'О':'А')+'</em>':'В СЛЕДУЮЩИЙ <em>РАЗ!</em>')+'</h2>'+
    '<p class="play-subtitle">Следующий ход: <b>'+escapeHTML(currentTeam())+'</b>. Передайте телефон этой команде.</p>'+
    makeButton('СЛЕДУЮЩИЙ ХОД ↗','next','button-primary button-big');
}
function showResults() {
  setScene('results');
  const [a,b]=game.scores;
  const winner=a===b?'НИЧЬЯ!':(a>b?game.teams[0]:game.teams[1]);
  const item=(index)=>'<div class="final-score-item '+(game.scores[index]===Math.max(a,b)&&a!==b?'is-winner':'')+'">'+
    '<span>'+escapeHTML(game.teams[index])+'</span><b>'+game.scores[index]+'</b><span>ОЧКОВ</span></div>';
  $('results-content').innerHTML=
    '<span class="section-kicker">ПАРТИЯ ЗАВЕРШЕНА</span>'+
    '<div class="result-trophy" aria-hidden="true">'+(a===b?'✳':'🏆')+'</div>'+
    '<h1 class="match-finished">'+(a===b?'ПОБЕДИЛА <em>ДРУЖБА</em>':'ПОБЕДИТЕЛЬ:<br><span style="color:var(--lime)">'+escapeHTML(winner)+'</span>')+'</h1>'+
    '<p class="play-subtitle" style="margin:15px auto">Отличная партия. Но разве это повод останавливаться?</p>'+
    '<div class="final-score">'+item(0)+'<span class="final-score-divider">:</span>'+item(1)+'</div>'+
    '<div class="inline-actions">'+makeButton('СЫГРАТЬ ЕЩЁ ↗','again','button-primary button-big')+
    makeButton('В ГЛАВНОЕ МЕНЮ','menu')+'</div>'+
    '<div class="history-block"><h3>ИСТОРИЯ ХОДОВ</h3>'+
    game.history.map((row,index)=>
      '<div class="history-row"><span>'+(index+1)+'. '+escapeHTML(row.team)+' · '+
      escapeHTML(getMode(row.mode)?.title||'')+' · '+escapeHTML(row.word)+'</span>'+
      '<b>'+(row.correct?'+'+row.awarded:'0')+'</b></div>').join('')+
    '</div>';
}
function render() {
  if(!game||game.phase==='home'){setScene('home');return;}
  if(game.phase==='results'){stopTicking();showResults();return;}
  setScene('game');
  renderMatch();
  if(game.phase==='ready')showReady();
  else if(game.phase==='rolling')showRolling();
  else if(game.phase==='task')showTask();
  else if(game.phase==='play')showTimer();
  else if(game.phase==='judge')showJudge();
  else if(game.phase==='between')showBetween();
  if(game.phase==='play'&&!game.current.paused)startTicking();
  else stopTicking();
}
function newGame() {
  if(game&&game.phase!=='results'&&!window.confirm('Заменить текущую партию новой?'))return;
  const teamA=sanitizeTeam($('team-a').value,'Молнии');
  const teamB=sanitizeTeam($('team-b').value,'Кометы');
  game={
    teams:[teamA,teamB],scores:[0,0],roundIndex:0,
    rounds:options.rounds,duration:options.duration,difficulty:options.difficulty,
    current:null,modeHistory:[],used:{},history:[],phase:'ready'
  };
  persist();sfx('go');render();
}
function roll() {
  if(!game||game.phase!=='ready')return;
  game.phase='rolling';persist();sfx('roll');render();
  setTimeout(()=>{
    if(!game||game.phase!=='rolling')return;
    game.current=rollOutcome();game.phase='task';
    persist();sfx('go');render();
  },970);
}
function toggleWord() {
  if(!game||!['task','play'].includes(game.phase))return;
  game.current.visible=!game.current.visible;persist();
  if(game.phase==='play') {
    // Showing a word during a running clock must not reset its deadline.
    render();
  } else showTask();
}
function replaceWord() {
  if(!game||game.phase!=='task'||game.current.replaced)return;
  game.current.word=pullWord(getMode(game.current.methodId).kind);
  game.current.visible=false;
  game.current.replaced=true;
  persist();sfx('button');render();
}
function startTimer() {
  if(!game||game.phase!=='task'||!game.current.visible)return;
  game.phase='play';
  game.current.deadline=Date.now()+game.current.seconds*1000;
  game.current.remainingMs=null;
  game.current.paused=false;
  lastChimeAt=null;
  persist();sfx('go');render();
}
function pauseTimer() {
  if(!game||game.phase!=='play'||game.current.paused)return;
  game.current.remainingMs=Math.max(0,game.current.deadline-Date.now());
  game.current.paused=true;
  game.current.deadline=null;
  persist();render();
}
function resumeTimer() {
  if(!game||game.phase!=='play'||!game.current.paused)return;
  game.current.deadline=Date.now()+game.current.remainingMs;
  game.current.paused=false;
  persist();sfx('go');render();
}
function backToMenu() {
  if(game&&!['results','home'].includes(game.phase)&&!window.confirm('Завершить партию? Текущий счёт будет потерян.'))return;
  stopTicking();game=null;persist();setScene('home');
  renderOptions();
}
function handleAction(action) {
  switch(action) {
    case 'roll':return roll();
    case 'toggle-word':return toggleWord();
    case 'replace-word':return replaceWord();
    case 'start-timer':return startTimer();
    case 'pause':return pauseTimer();
    case 'resume':return resumeTimer();
    case 'finish-early':return finishTimer('early');
    case 'yes':return judge(true);
    case 'no':return judge(false);
    case 'next':if(game?.phase==='between'){game.phase='ready';game.current=null;persist();render();}return;
    case 'again':if(game?.phase==='results'){game=null;newGame();}return;
    case 'menu':return backToMenu();
  }
}
function restoreSession() {
  const saved=readSaved();
  if(!saved)return;
  soundOn=saved.soundOn!==false;
  options={...freshOptions(),...saved.options};
  const candidate=saved.game;
  if(!candidate||!Array.isArray(candidate.teams)||candidate.teams.length!==2||
      !Array.isArray(candidate.scores)||!Number.isInteger(candidate.roundIndex))return;
  if(candidate.phase==='rolling')candidate.phase='ready';
  if(candidate.phase==='play'&&candidate.current?.deadline!=null&&
       candidate.current.deadline<=Date.now()) {
    candidate.phase='judge';
    candidate.current.deadline=null;
    candidate.current.finishedReason='timeout';
  }
  game=candidate;
  $('team-a').value=game.teams[0];
  $('team-b').value=game.teams[1];
  renderOptions();
}
function setupEvents() {
  document.querySelectorAll('.choices').forEach(group=>{
    group.addEventListener('click',event=>{
      const button=event.target.closest('button[data-value]');
      if(!button)return;
      const setting=group.dataset.setting;
      const value=button.dataset.value;
      options[setting]=setting==='difficulty'?value:Number(value);
      renderOptions();persist();sfx('button');
    });
  });
  $('start-game').addEventListener('click',newGame);
  $('play-content').addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');
    if(button)handleAction(button.dataset.action);
  });
  $('results-content').addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');
    if(button)handleAction(button.dataset.action);
  });
  $('exit-game').addEventListener('click',backToMenu);
  $('brand-link').addEventListener('click',event=>{event.preventDefault();backToMenu();});
  $('sound-toggle').addEventListener('click',()=>{
    soundOn=!soundOn;setSoundIcon();persist();
    if(soundOn)sfx('go');
  });
  $('help-toggle').addEventListener('click',openRules);
  $('close-rules').addEventListener('click',closeRules);
  $('rules-understood').addEventListener('click',closeRules);
  $('rules-backdrop').addEventListener('click',event=>{if(event.target.id==='rules-backdrop')closeRules();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeRules();
  });
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&game?.phase==='play')tick();
  });
}
function boot() {
  setupEvents();
  restoreSession();
  setSoundIcon();
  renderOptions();
  render();
}
boot();
