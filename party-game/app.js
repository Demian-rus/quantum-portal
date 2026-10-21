'use strict';
const STORAGE_KEY = 'iskra-party:v1';
const MODE_LIST=Object.freeze(Object.values(QUIP_MODES_V4).filter(mode=>mode.enabled));
function severityForRound() {
  return game.current?.difficulty || game.difficulty;
}
function allowPause() { return severityForRound()==='easy'; }
const DEFAULT_MODES = Object.freeze(MODE_LIST.map(mode=>mode.id));
const PROMPT_TYPES = Object.freeze(['word','phrase','idiom']);
function modeArt(id) {
  const safe=DEFAULT_MODES.includes(id)?id:'secret';
  return '<img class="mode-art" src="'+MODE_ASSETS[safe]+'" alt="" decoding="async" draggable="false">';
}
function symbol(id,extra='') {
  return '<div class="mode-symbol '+extra+'" aria-hidden="true">'+modeArt(id)+'</div>';
}
const $ = id => document.getElementById(id);
function timerMarkup(ms) { return formatTimer(ms); }
function pointNoun(n) { return n%10===1&&n%100!==11?'ОЧКО':([2,3,4].includes(n%10)&&!(n%100>=12&&n%100<=14)?'ОЧКА':'ОЧКОВ'); }
const freshOptions = () => optionsForPartyPreset('classic-duel',2);
let options = freshOptions();
let soundOn = true;
let game = null;
let storageBlocked=false;
let rafId = 0;
let intervalId = null;
let rollFrameHandle = null;
let audioContext = null;
let lastChimeAt = null;
let toastTimeout = null;
let activeScene='home';
let advancedReturn='setup';
let rollSequence=[];

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
}
// Discretionary Russian word breaks supplement browser hyphenation dictionaries.
// Only display markup is changed; stored prompts and scoring keep the exact text.
function displayPrompt(value) {
  return escapeHTML(value).replace(/ПАРАЛЛЕЛЬНАЯ/gi, match =>
    match.slice(0,-3)+'\u00ad'+match.slice(-3));
}
function readSaved() {
  try {
    const obj=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(obj&&obj.version!==1){storageBlocked=true;return null;}
    return obj?.version===1 ? obj : null;
  } catch { return null; }
}
function persist() {
  if(storageBlocked)return;
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,options,soundOn,game})); }
  catch { /* Private browsing might block storage; a session still works. */ }
}
function sanitizeTeam(name,fallback) {
  const str=String(name||'').replace(/\s+/g,' ').trim().slice(0,24);
  return str || fallback;
}
function randomOne(list) { return list[Math.floor(Math.random()*list.length)]; }
function chooseStartingTeam(random=Math.random) { return random()<.5?0:1; }
function currentTeamIndex() { return (game.roundIndex+(game.startingTeamIndex??0))%2; }
function currentTeam() { return game.teams[currentTeamIndex()]; }
function guessingTeamIndex() { return game.scoringVersion===2?(currentTeamIndex()+1)%2:currentTeamIndex(); }
function guessingTeam() { return game.teams[guessingTeamIndex()]; }
function durationForMode(id,methodId,base) {
 const config=modeConfigForGame(game,id==='secret'?methodId:id);
 return config.usesTimer?Math.max(30,Math.min(90,base))+config.durationBonus:0;
}
function roundUsesTimer(){
 if(!game?.current)return false;
 return game?.current?.usesTimer??modeConfigForGame(game,game.current.modeId).usesTimer;
}
function matchComplete() {
  if(game.finishType!=='score')return game.roundIndex>=game.rounds;
  // The second player always has a reply turn; ties continue in pairs.
  return game.roundIndex%2===0 && Math.max(...game.scores)>=game.targetScore && game.scores[0]!==game.scores[1];
}
function currentMode() { return MODE_LIST.find(mode=>mode.id===game.current?.modeId); }
function getMode(id) { return MODE_LIST.find(m=>m.id===id); }
function formatTimer(ms) {
  const seconds=Math.max(0,Math.ceil(ms/1000));
  return String(Math.floor(seconds/60)).padStart(1,'0')+':'+String(seconds%60).padStart(2,'0');
}
function setSoundIcon() {
  $('sound-toggle').checked=soundOn;
  $('sound-toggle').setAttribute('aria-checked',String(soundOn));
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
function hasUnfinishedGame() {
  return Boolean(game && !['results','home'].includes(game.phase));
}
function updateContinue() {
  const button=$('continue-game');
  if(!button)return;
  const possible=hasUnfinishedGame();
  button.disabled=!possible;
  button.setAttribute('aria-disabled',String(!possible));
}
function setScene(which) {
  activeScene=which;
  for(const scene of ['home','other-games','preferences','setup','advanced','game','results'])
    $('scene-'+scene).hidden=scene!==which;
  document.body.dataset.screen=which;
  updateContinue();
}
function openPreferences() {
  setSoundIcon();
  setScene('preferences');
}
function openSetup() {
  // Opening setup keeps any unfinished session untouched until the user starts a new one.
  renderOptions();
  setScene('setup');
  $('setup-scroll').scrollTop=0;
}
function openAdvanced(from='setup') {
  advancedReturn=from;
  renderOptions();
  setScene('advanced');
  $('advanced-scroll').scrollTop=0;
}
function closeAdvanced() {
  renderOptions();
  setScene(advancedReturn);
}
function continueGame() {
  if(!hasUnfinishedGame())return;
  if(game.phase==='rolling')game.phase=game.current?'task':'ready';
  if(game.phase==='countdown'&&Date.now()>=game.current.autoStartAt)beginAutomaticRound();
  if(game.phase==='play'&&!game.current.paused&&game.current.deadline<=Date.now())
    finishTimer('timeout');
  render();
}
function renderOptions() {
  for(const setting of ['difficulty','duration','rounds']) {
    document.querySelectorAll('.choices[data-setting="'+setting+'"] button').forEach(button=>{
      const selected=String(options[setting])===button.dataset.value;
      button.classList.toggle('is-chosen',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  const numbers={'base-duration':options.duration,'quick-duration':options.duration,'target-score':options.targetScore,
    'quick-target-score':options.targetScore,'custom-rounds':options.rounds};
  $('base-duration-value').textContent=options.duration+' с';
  $('target-score-value').textContent=options.targetScore+' очков';
  $('rounds-value').textContent=options.rounds+' ходов';
  $('base-duration-value-advanced').textContent=options.duration+' с';
  $('finish-score').checked=options.finishType==='score';
  $('finish-rounds').checked=options.finishType==='rounds';
  $('toggle-risk').checked=options.riskRounds;
  $('score-goal-preview').textContent=options.finishType==='score'?options.targetScore+' очков':'После '+options.rounds+' ходов';
  $('score-goal-caption').textContent=options.finishType==='score'?'У каждого игрока будет ответный ход':'Одинаковое число ходов у обоих игроков';
  $('setup-finish-label').textContent=options.finishType==='score'?'МАКСИМУМ ОЧКОВ':'КОЛИЧЕСТВО ХОДОВ';
  $('quick-target-score').hidden=options.finishType!=='score';
  $('finish-score-settings').hidden=options.finishType!=='score';
  $('finish-rounds-settings').hidden=options.finishType!=='rounds';
  for(const [id,value] of Object.entries(numbers)) {
    const input=$(id);
    if(input && document.activeElement!==input)input.value=String(value);
  }
  document.querySelectorAll('#mode-toggles input').forEach(input=>{
    input.checked=options.modes.includes(input.value);
    const config=getModeConfig(input.value),label=input.closest('label').querySelector('b');
    label.textContent='+'+(config.basePoints+(config.id==='secret'?config.modifierBonus:0))+
      (config.blitzWordsCount?' за '+config.blitzWordsCount+'/'+config.blitzWordsCount:'');
  });
  document.querySelectorAll('#content-toggles input').forEach(input=>{input.checked=options.promptTypes.includes(input.value);});
  $('toggle-complications').checked=options.complications;
}
function renderMatch() {
  $('label-team-a').textContent=game.teams[0];
  $('label-team-b').textContent=game.teams[1];
  $('score-a').textContent=game.scores[0];
  $('score-b').textContent=game.scores[1];
  $('round-now').textContent=game.roundIndex+1;
  $('round-total').textContent=game.finishType==='score'?'':game.rounds;
  $('round-total').hidden=game.finishType==='score';
  $('round-slash').hidden=game.finishType==='score';
  $('match-progress').style.width=game.finishType==='score'?(Math.min(100,Math.max(...game.scores)/game.targetScore*100))+'%':(game.roundIndex/game.rounds*100)+'%';
  $('match-team-a').classList.toggle('is-turn',guessingTeamIndex()===0);
  $('match-team-b').classList.toggle('is-turn',guessingTeamIndex()===1);
  const legacy=game.scoringVersion!==2;
  $('role-a').textContent=legacy?(currentTeamIndex()===0?'ХОД':'ЖДЁТ'):(guessingTeamIndex()===0?'ОТГАДЫВАЕТ':'ЗАГАДЫВАЕТ');
  $('role-b').textContent=legacy?(currentTeamIndex()===1?'ХОД':'ЖДЁТ'):(guessingTeamIndex()===1?'ОТГАДЫВАЕТ':'ЗАГАДЫВАЕТ');
  $('match-center-label').textContent=game.finishType==='score'?'ЦЕЛЬ '+game.targetScore:'ПО ЧИСЛУ ХОДОВ';
}
function pickMode() {
  const allowed=MODE_LIST.filter(m=>game.modes.includes(m.id));
  if(!allowed.length)throw Error('Не выбрано ни одного режима');
  const recent=game.modeHistory.slice(-Math.min(2,allowed.length-1));
  const candidates=allowed.filter(mode=>!recent.includes(mode.id));
  return randomOne(candidates.length?candidates:allowed);
}
function chooseDifficulty() {
  if(game.plannerVersion==null)
    return game.difficulty==='mixed'?randomOne(['easy','medium','hard']):game.difficulty;
  validateRoundPlan(game.plannerVersion,game.plannerState);
  const planned=planRoundDifficulty(game.plannerState,game.roundIndex,game.difficulty);
  game.plannerState=planned.state;
  return planned.difficulty;
}
// The card catalog owns all active content and metadata; legacy saves still use text.
const PARTY_VOCABULARY=Object.freeze(Object.fromEntries(
  ['word','phrase','idiom'].map(type=>[type,Object.freeze(Object.fromEntries(
    PARTY_CARD_LEVELS.map(level=>[level,Object.freeze(PARTY_CARD_POOLS[type][level].map(card=>card.text))])
  ))])
));
function getPromptPool(kind,level){
  const cards=game?.contentPack?getPackCardPool(game.contentPack,kind,level,game.promptTypes):
    getCardPool(kind,level,game?.promptTypes);
  return [...new Set(cards.map(card=>card.text))];
}
function pullWord(kind, level=chooseDifficulty(),excluded=[]) {
  const pool=getPromptPool(kind,level).filter(word=>!excluded.includes(word));
  if(!pool?.length)throw Error('Нет слов для выбранных настроек');
  // Blitz uses the same easy-word pool at every difficulty: avoid repeats across levels.
  const key=(kind==='blitz'?'easy':level)+':'+kind+':'+(game.promptTypes||[]).join(',');
  let used=game.used[key]||[];
  let free=pool.filter(word=>!used.includes(word));
  if(!free.length){used=[];free=pool.slice();}
  const word=randomOne(free);
  used.push(word);game.used[key]=used;
  return word;
}
function rollOutcome() {
  const mode=pickMode(),config=modeConfigForGame(game,mode.id);
  game.modeHistory.push(mode.id);
  let actualMode=mode;
  const level=chooseDifficulty();
  if(mode.id==='secret'){
    const submodes=MODE_LIST.filter(m=>m.secretMethod);
    const enabled=submodes.filter(m=>game.modes.includes(m.id));
    actualMode=randomOne(enabled.length?enabled:submodes);
  }
  const modifier=config.usesModifiers?chooseModifier({modeId:mode.id,methodId:actualMode.id,
    difficulty:level,complications:game.complications}):null;
  const word=pullWord(mode.id==='blitz'?'blitz':actualMode.kind,level);
  const blitzWords=mode.id==='blitz'?[word]:null;
  if(blitzWords)while(blitzWords.length<config.blitzWordsCount)blitzWords.push(pullWord('blitz',level,blitzWords));
  return {
    modeId:mode.id,methodId:actualMode.id,word,complication:modifier?.text||'',
    complicationId:modifier?.id||null,modifierVersion:QUIP_MODIFIER_VERSION,difficulty:level,
    basePoints:rewardForRound(game,mode.id,level),
    modifierPoints:ruleSetForGame(game).version>=4&&modifier?config.modifierBonus:0,
    points:rewardForRound(game,mode.id,level,!!modifier),usesTimer:config.usesTimer,
    blitzRequired:config.blitzWordsCount,seconds:durationForMode(mode.id,actualMode.id,game.duration),
    risk:config.allowsRisk&&game.riskRounds&&game.roundIndex>=ruleSetForGame(game).risk.firstRoundIndex&&
      shouldSelectRisk(game,Math.random(),mode.id),
    blitzWords,
    blitzIndex:0,blitzCorrect:0,
    blitzQueue:mode.id==='blitz'?Array.from({length:config.blitzWordsCount},(_,i)=>i):null,
    visible:false,paused:false,remainingMs:null,deadline:null,autoStartAt:null,
    finishedReason:null,replaced:false
  };
}
function makeButton(label,action,style='button-secondary') {
  return '<button type="button" class="button '+style+'" data-action="'+action+'">'+label+'</button>';
}
// Lucide-like vector UI controls; illustrated mode assets continue to use WebP.
const CONTROL_ICONS=Object.freeze({
  'eye-off':'<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.3A11.6 11.6 0 0 1 12 5c5.1 0 8.8 4 10 7a12 12 0 0 1-3.4 4.5M6.1 6.1A12.1 12.1 0 0 0 2 12c1.2 3 4.9 7 10 7 1.8 0 3.5-.5 4.9-1.3"/>',
  eye:'<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7.5 7.5 0 0 1 19 7l1 5M4 12l1 5a7.5 7.5 0 0 0 13.5-2"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  play:'<path d="m8 5 11 7-11 7V5Z"/>',
  check:'<path d="m4 12 5 5L20 6"/>'
});
function iconButton(icon,action,label,variant='muted') {
  if(!CONTROL_ICONS[icon])throw Error('Unknown control icon');
  const classes=variant.split(' ').map(item=>'round-action--'+item).join(' ');
  return '<button type="button" class="round-action '+classes+'" data-action="'+action+
  '" title="'+label+'" aria-label="'+label+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+CONTROL_ICONS[icon]+'</svg></button>';
}
function taskControls(c) {
  if(!c.visible)return '<div class="task-open">'+makeButton('ОТКРЫТЬ ЗАДАНИЕ','toggle-word','button-coral button-big')+'</div>';
  if(!allowPause())return '<div class="task-open-hint">ТАЙМЕР ЗАПУСТИТСЯ АВТОМАТИЧЕСКИ</div>';
  return '<div class="round-controls task-controls">'+
    iconButton('eye-off','toggle-word','Скрыть слово')+
    iconButton('clock','start-timer','Запустить таймер','success')+
    (c.modeId!=='blitz'?iconButton('refresh','replace-word','Другое слово'):'<span class="round-action-placeholder" aria-hidden="true"></span>')+
    '</div>';
}
function showReady() {
  $('play-content').className='play-inner is-ready';
  $('play-step').textContent='ПЕРЕДАЙТЕ ТЕЛЕФОН ЗАГАДЫВАЮЩЕМУ';
  const index=currentTeamIndex();
  const team=escapeHTML(currentTeam()),opponent=escapeHTML(guessingTeam());
  $('play-content').innerHTML=
    '<div class="ready-content">'+
      '<span class="game-eyebrow">ХОД '+(game.roundIndex+1)+(game.finishType==='score'?' · ДО '+game.targetScore+' ОЧКОВ':' ИЗ '+game.rounds)+'</span>'+
      '<div class="ready-avatar '+(index===1?'is-blue':'')+'">'+modeArt('secret')+'</div>'+
      '<h2 class="play-title">'+(game.scoringVersion===2?'ЗАГАДЫВАЕТ':'НА ОЧЕРЕДИ')+'<br><em>'+team+'</em></h2>'+
      '<p class="play-subtitle">'+(game.scoringVersion===2?'<strong>'+opponent+'</strong> отгадывает и получает очки. Покажите задание только загадывающему.':'Продолжение сохранённой партии по прежним правилам: очки получает команда текущего хода.')+'</p>'+
    '</div>'+
    '<div class="ready-action-slot">'+
      makeButton(game.dice?'ВЫБРАТЬ РЕЖИМ':'ПОЛУЧИТЬ ЗАДАНИЕ','roll','button-primary button-big')+
    '</div>';
}
// The wheel is a window into a repeating ring, not a strip that ends on the prize.
const ROLL_SPIN_MS=2850;
const ROLL_HOLD_MS=450;
function showRolling() {
  $('play-content').className='play-inner is-rolling-screen';
  $('play-step').textContent='ВЫБОР РЕЖИМА';
  const pool=game.modes.length?game.modes:['talk'];
  const target=game.current.modeId;
  const winnerAt=pool.indexOf(target);
  // The selected mode is not the last card: keep visible neighbours on BOTH sides.
  const landingIndex=Math.max(7,pool.length+3);
  const travel=Math.max(28,pool.length*4);
  const startIndex=landingIndex+travel;
  const itemCount=startIndex+Math.max(7,pool.length+3);
  const wrap=index=>(index%pool.length+pool.length)%pool.length;
  rollSequence=Array.from({length:itemCount},(_,i)=>
    pool[wrap(i-landingIndex+winnerAt)]);
  $('play-content').innerHTML=
    '<span class="game-eyebrow">КАКОЙ РЕЖИМ ВЫПАДЕТ?</span>'+
    '<div class="reel-window" id="reel-window" aria-label="Карусель игровых режимов" data-winner="'+target+'">'+
      '<div class="reel-track" id="reel-track">'+
      rollSequence.map((id,i)=>'<div class="reel-item'+(i===landingIndex?' reel-item--winner':'')+
        '" data-mode="'+id+'" data-reel-index="'+i+'">'+
      modeArt(id)+'<span>'+escapeHTML(getMode(id).title)+'</span></div>').join('')+
      '</div></div>'+
    '<p class="play-subtitle">Карусель выбирает случайный режим...</p>';
  const track=$('reel-track'),windowEl=$('reel-window');
  const cards=track?.children;
  if(!track||!windowEl||!cards?.[startIndex]||!cards?.[landingIndex])return;
  const activeRound=game.current;
  const at=index=>windowEl.clientWidth/2-cards[index].offsetLeft-cards[index].offsetWidth/2;
  const start=at(startIndex),finish=at(landingIndex);
  track.style.transition='none';
  track.style.transform='translate3d('+start+'px,0,0)';
  // Two frames guarantee that even a fast Android browser paints the starting
  // position before animating. The strip moves left-to-right, then eases out.
  const markWinner=()=>{
    if(game?.phase==='rolling'&&game.current===activeRound&&activeScene==='game')
      track.querySelector('.reel-item--winner')?.classList.add('reel-item--landed');
  };
  track.addEventListener('transitionend',event=>{
    if(event.propertyName==='transform')markWinner();
  },{once:true});
  const animate=()=>{
    if(game?.phase!=='rolling'||game.current!==activeRound||activeScene!=='game')return;
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.style.transition='transform '+(reduce?1:ROLL_SPIN_MS)+'ms cubic-bezier(.08,.72,.12,1)';
    track.style.transform='translate3d('+finish+'px,0,0)';
    if(reduce)markWinner();
  };
  if(typeof requestAnimationFrame==='function')
    requestAnimationFrame(()=>requestAnimationFrame(animate));
  else animate();
}
function modeInformation() {
  const mode=getMode(game.current.modeId);
  const method=getMode(game.current.methodId);
  const secret=mode.id==='secret';
  return {
    mode,method,secret,
    name:secret?'СЕКРЕТКА: '+method.title:mode.title,
    rule:mode.id==='blitz'&&ruleSetForGame(game).version>=4?
      'Отгадайте все '+game.current.blitzWords.length+' слова за один таймер. Очки только за полный результат.':method.rule
  };
}
function taskMarkup(hidden) {
  const {method}=modeInformation();
  const word=displayPrompt(game.current.word);
  const what=method.id==='sing'?'ТЕМА ДЛЯ ПЕСНИ':'ВАШЕ ЗАДАНИЕ';
  const wordLength=game.current.word.length;
  const lengthStyle=wordLength>45?' challenge-word--very-long':wordLength>23?' challenge-word--long':'';
  return '<div class="challenge-card '+(hidden?'is-hidden':'')+'">'+
    '<span class="challenge-overline">'+what+'</span>'+
    '<div class="challenge-word '+(hidden?'challenge-word--hidden':lengthStyle)+'">'+
    (hidden?'НАЖМИ, ЧТОБЫ ОТКРЫТЬ':word)+'</div>'+
    (hidden?'':'<span class="challenge-details">ЗАПОМНИ И НАЧИНАЙ!</span>')+'</div>';
}
function showTask() {
  $('play-content').className='play-inner is-task stable-round';
  const {mode,secret,name,rule}=modeInformation();
  $('play-step').textContent=game.scoringVersion===2?'ЗАГАДЫВАЕТ: '+currentTeam():'ЗАДАНИЕ ДЛЯ '+currentTeam();
  const c=game.current;
  $('play-content').innerHTML=
    '<div class="round-top round-top--task">'+
      symbol(mode.id)+
      '<h2 class="play-title mode-name">'+escapeHTML(name)+'</h2>'+
      '<div class="mode-rule">'+escapeHTML(rule)+
      (c.complication?'<br><strong>УСЛОЖНЕНИЕ: '+escapeHTML(c.complication)+'</strong>':'')+'</div>'+
      (secret?'<span class="secret-flag">СЕКРЕТКА · +'+c.points+' '+pointNoun(c.points)+'</span>':
        '<span class="score-note">ЗА ВЕРНЫЙ ОТВЕТ: +'+(c.modeId==='blitz'?(game.scoringVersion===2?c.points+' ЗА ВСЕ '+c.blitzWords.length+' СЛОВ':'1 ЗА СЛОВО'):c.points)+'</span>')+
    (c.risk?'<p class="risk-notice">⚡ РИСК-РАУНД: ПРОВАЛ — ДО −'+ruleSetForGame(game).risk.loss+' ОЧКОВ</p>':'')+
    '</div>'+
    '<div class="round-fixed-card">'+taskMarkup(!c.visible)+'</div>'+
    '<div class="round-bottom round-bottom--task">'+taskControls(c)+'</div>';
}
function blitzStatus() {
  const c=game.current;
  const left=c.blitzQueue?.length ?? Math.max(0,c.blitzWords.length-c.blitzIndex);
  return '<div class="blitz-status"><b>ОСТАЛОСЬ: '+left+'</b>'+
    '<b>ОТГАДАНО: '+c.blitzCorrect+'</b></div>';
}
function showTimer() {
  $('play-content').className='play-inner is-play stable-round';
  $('play-step').textContent=game.scoringVersion===2?'ОТГАДЫВАЕТ '+guessingTeam():'ВРЕМЯ ПОШЛО';
  const c=game.current,remaining=c.paused?c.remainingMs:c.deadline-Date.now();
  const shown=Math.max(0,remaining),blitz=c.modeId==='blitz';
  $('play-content').innerHTML=
    '<div class="round-top round-top--timer">'+
      '<span class="game-eyebrow">'+escapeHTML(modeInformation().name)+' · '+c.seconds+' СЕКУНД</span>'+
      '<div class="timer-ring'+(shown<=10000?' warning':'')+'" aria-label="Таймер">'+
        '<svg viewBox="0 0 200 200" class="ring-svg" aria-hidden="true">'+
          '<circle class="ring-bg" cx="100" cy="100" r="88" />'+
          '<circle id="timer-progress" class="ring-progress" cx="100" cy="100" r="88" />'+
        '</svg>'+
        '<div id="active-timer" class="play-timer'+(shown<=10000?' warning':'')+'" role="timer" aria-label="Оставшееся время">'+timerMarkup(shown)+'</div>'+
      '</div>'+
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
        '<div class="three-answer-actions">'+
          iconButton('x','wrong-now','Не угадали — завершить ход','danger prominent')+
          iconButton(c.visible?'eye-off':'eye','toggle-word',c.visible?'Скрыть слово':'Показать слово')+
          iconButton('check','correct-now','Угадали — засчитать очки','success prominent')+
        '</div>')+
    '</div>';
  updateTimerVisual(shown);
}
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
  persist();sfx(correct?'win':'button');
  showTimer();
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
function stopTicking() {
  if(intervalId!==null){clearInterval(intervalId);intervalId=null;}
}
function beginAutomaticRound() {
  if(!game||game.phase!=='countdown')return;
  const c=game.current;
  const startAt=c.autoStartAt || Date.now();
  c.deadline=startAt+c.seconds*1000;
  c.autoStartAt=null;
  c.remainingMs=null;c.paused=false;
  game.phase='play';
  lastChimeAt=null;
  persist();sfx('go');render();
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
function startTicking() {
  stopTicking();
  intervalId=setInterval(tick,100);
  tick();
}
function tick() {
  if(!game)return;
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
  $('play-content').className='play-inner is-judge';
  $('play-step').textContent='ИТОГ РАУНДА';
  const c=game.current,blitz=c.modeId==='blitz';
  const incompleteBlitz=blitz&&game.scoringVersion===2&&c.blitzCorrect<blitzRequiredForRound(game,c);
  $('play-content').innerHTML=
    '<span class="game-eyebrow">'+(c.finishedReason==='timeout'?'ВРЕМЯ ВЫШЛО':'РАУНД ЗАКОНЧЕН')+'</span>'+
    symbol(blitz?'blitz':c.methodId)+
    '<h2 class="play-title">'+(blitz?'РЕЗУЛЬТАТ <em>БЛИЦА</em>':'ОТГАДЫВАЮЩИЙ <em>УГАДАЛ?</em>')+'</h2>'+
    '<p class="play-subtitle">'+(blitz?'Отгадано '+c.blitzCorrect+' из '+c.blitzWords.length+'. '+(game.scoringVersion===2?'Все '+c.blitzWords.length+' слов дают '+c.points+' очка.':'За каждое отгаданное слово — одно очко (старая партия).'):'Нажмите галочку, если ответ верный, или крестик, если нет.')+'</p>'+
    '<p class="score-note">'+(blitz?'Награда: <b>'+(game.scoringVersion===2?(c.blitzCorrect===blitzRequiredForRound(game,c)?'+'+c.points:'0'):('+'+c.blitzCorrect))+' очков</b>':
    'Было загадано: <b>'+escapeHTML(c.word)+'</b> · За ответ: +'+c.points)+'</p>'+ 
    (c.risk?'<p class="risk-notice">⚡ Провал: потеря до '+ruleSetForGame(game).risk.loss+' очков у отгадывающего</p>':'')+
    (incompleteBlitz?'<div class="inline-actions">'+makeButton('ЗАВЕРШИТЬ РАУНД','no','button-primary button-big')+'</div>':
    '<div class="judgement-grid">'+
      '<div class="judgement-option">'+
        '<button class="judgement judgement--no" data-action="no" type="button" aria-label="Не засчитывать"><svg viewBox="0 0 64 64"><path d="m17 17 30 30M47 17 17 47"/></svg></button>'+
        '<span>'+(blitz?'ОТМЕНИТЬ':'НЕ УГАДАЛИ')+'</span>'+
      '</div>'+
      '<div class="judgement-option">'+
        '<button class="judgement judgement--yes" data-action="yes" type="button" aria-label="Засчитать ответ"><svg viewBox="0 0 64 64"><path d="m13 33 13 13 25-28"/></svg></button>'+
        '<span>'+(blitz?'ЗАСЧИТАТЬ':'УГАДАЛИ')+'</span>'+
      '</div>'+
    '</div>');
}
function recordAnswer(yes) {
  if(!game||!['judge','play'].includes(game.phase))return;
  const teamIndex=guessingTeamIndex(),c=game.current;
  const outcome=settleQuipRound(game,c,yes,game.scores[teamIndex]);
  game.scores[teamIndex]+=outcome.delta;
  game.history.push({
    team:game.teams[teamIndex],setter:currentTeam(),mode:c.modeId,
    word:c.modeId==='blitz'?c.blitzWords.join(' / '):c.word,
    awarded:outcome.delta,correct:outcome.success,risk:!!c.risk,
    rulesVersion:outcome.rulesVersion,difficulty:c.difficulty,
    basePoints:c.basePoints,modifierPoints:outcome.success?(c.modifierPoints||0):0
  });
  game.roundIndex++;
  // Confirmation is the final action for a round; no extra Next button.
  game.phase=matchComplete()?'results':'ready';
  game.current=null;
  stopTicking();persist();sfx(yes?'win':'fail');render();
}
function correctNow() {
  if(!game||game.phase!=='play'||game.current?.modeId==='blitz')return;
  const c=game.current;
  if(!c.paused&&Date.now()>=c.deadline){finishTimer('timeout');return;}
  if(c.paused&&(c.remainingMs??0)<=0){finishTimer('timeout');return;}
  recordAnswer(true);
}
function wrongNow() {
  if(!game||game.phase!=='play'||game.current?.modeId==='blitz')return;
  const c=game.current;
  if(!c.paused && Date.now()>=c.deadline){finishTimer('timeout');return;}
  recordAnswer(false);
}
function judge(yes) {
  if(!game||game.phase!=='judge')return;
  recordAnswer(yes);
}
function showBetween() {
  $('play-content').className='play-inner is-between';
  $('play-step').textContent='РАУНД ЗАВЕРШЁН';
  const last=game.history[game.history.length-1];
  $('play-content').innerHTML=
    '<span class="game-eyebrow">СЧЁТ ОБНОВЛЁН</span>'+
    symbol(last.correct?'talk':'secret')+
    '<h2 class="play-title">'+(last.correct?'ЕСТЬ! <em>+'+last.awarded+' ОЧК'+(last.awarded===1?'О':'А')+'</em>':'В СЛЕДУЮЩИЙ <em>РАЗ!</em>')+'</h2>'+
    '<p class="play-subtitle">Следующий ход: <b>'+escapeHTML(currentTeam())+'</b>. Передайте телефон этой команде.</p>'+
    makeButton('СЛЕДУЮЩИЙ ХОД','next','button-primary button-big');
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
    '<div class="inline-actions">'+makeButton('СЫГРАТЬ ЕЩЁ','again','button-primary button-big')+
    makeButton('В ГЛАВНОЕ МЕНЮ','menu')+'</div>'+
    '<div class="history-block"><h3>ИСТОРИЯ ХОДОВ · ОЧКИ ОТГАДЫВАЮЩЕГО</h3>'+
    game.history.map((row,index)=>
      '<div class="history-row"><span>'+(index+1)+'. '+escapeHTML(row.team)+' · '+
      escapeHTML(getMode(row.mode)?.title||'')+' · '+escapeHTML(row.word)+'</span>'+
      '<b>'+(row.awarded>0?'+'+row.awarded:row.awarded)+'</b></div>').join('')+
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
  else if(game.phase==='countdown')showCountdown();
  else if(game.phase==='play')showTimer();
  else if(game.phase==='judge')showJudge();
  else if(game.phase==='between')showBetween();
  if(game.phase==='countdown'||(game.phase==='play'&&!game.current.paused))startTicking();
  else stopTicking();
}
function newGame() {
  if(storageBlocked){toast('Сохранение несовместимо с этой версией игры. Данные сохранены.');return;}
  // START is the explicit action; don't repeat it with a native confirmation.
  if(!options.modes.length){toast('Выберите хотя бы один игровой режим');return;}
  if(!options.promptTypes.length && options.modes.some(id=>['talk','mime','draw','blitz','secret'].includes(id))){toast('Выберите тип заданий');return;}
  const contentPack=options.contentPack||{id:'general',version:1};
  try{
    if(!checkContentPack(contentPack,options).available){
      toast('Набор заданий недоступен для выбранных настроек.');return;
    }
  }catch{toast('Набор заданий недоступен для выбранных настроек.');return;}
  const teamA=sanitizeTeam($('team-a').value,'Молнии');
  const teamB=sanitizeTeam($('team-b').value,'Кометы');
  game={
    teams:[teamA,teamB],scores:[0,0],roundIndex:0,startingTeamIndex:chooseStartingTeam(),
    rounds:options.rounds,targetScore:options.targetScore,finishType:options.finishType,
    riskRounds:options.riskRounds,scoringVersion:2,rulesVersion:QUIP_RULE_VERSION,modeConfigVersion:QUIP_MODE_CONFIG_VERSION,
    plannerVersion:QUIP_PLANNER_VERSION,plannerState:freshRoundPlan(),
    duration:options.duration,difficulty:options.difficulty,
    contentPack:{...contentPack},preset:options.preset?{...options.preset}:null,
    modes:options.modes.slice(),promptTypes:options.promptTypes.slice(),
    dice:options.dice,complications:options.complications,blitzCount:getModeConfig('blitz').blitzWordsCount,
    current:null,modeHistory:[],used:{},history:[],phase:'ready'
  };
  persist();sfx('go');render();
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
  if(!game||!roundUsesTimer()||!['task','play'].includes(game.phase))return;
  if(game.current.modeId==='blitz'&&game.phase==='play')return;
  // Revealing or hiding an answer never pauses or restarts the clock.
  game.current.visible=!game.current.visible;
  if(game.phase==='task'&&game.current.visible&&!allowPause()){
    game.phase='countdown';
    game.current.autoStartAt=Date.now()+1000;
  }
  persist();
  render();
}
function replaceWord() {
  if(!game||game.phase!=='task'||!allowPause()||game.current.modeId==='blitz')return;
  game.current.word=pullWord(getMode(game.current.methodId).kind,game.current.difficulty);
  game.current.visible=false;
  persist();sfx('button');render();
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
  if(!game||game.phase!=='play'||game.current.paused||!allowPause())return;
  game.current.remainingMs=Math.max(0,game.current.deadline-Date.now());
  game.current.paused=true;
  game.current.deadline=null;
  persist();render();
}
function resumeTimer() {
  if(!game||game.phase!=='play'||!game.current.paused||!allowPause())return;
  game.current.deadline=Date.now()+game.current.remainingMs;
  game.current.paused=false;
  persist();sfx('go');render();
}
function backToMenu() {
  stopTicking();
  if(game?.phase==='rolling')game.phase=game.current?'task':'ready';
  if(game?.phase==='results')game=null;
  persist();
  setScene('home');
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
    case 'correct-now':return correctNow();
    case 'wrong-now':return wrongNow();
    case 'blitz-correct':return advanceBlitz(true);
    case 'blitz-skip':return advanceBlitz(false);
    case 'yes':return judge(true);
    case 'no':return judge(false);
    case 'next':if(game?.phase==='between'){game.phase='ready';game.current=null;persist();render();}return;
    case 'again':if(game?.phase==='results'){game=null;newGame();}return;
    case 'menu':return backToMenu();
  }
}
function sanitizeOptions(raw) {
  const base=freshOptions();
  if(!raw||typeof raw!=='object')return base;
  const difficulty=['easy','medium','hard','mixed'].includes(raw.difficulty)?raw.difficulty:base.difficulty;
  const duration=Math.max(30,Math.min(90,Math.round(Number(raw.duration)||base.duration)));
  const rounds=Math.max(2,Math.min(100,2*Math.round((Number(raw.rounds)||base.rounds)/2)));
  const targetScore=Math.max(15,Math.min(100,5*Math.round((Number(raw.targetScore)||base.targetScore)/5)));
  const finishType=raw.finishType==='rounds'?'rounds':'score';
  const riskRounds=raw.riskRounds!==false;
  const blitzCount=getModeConfig('blitz').blitzWordsCount;
  const modes=Array.isArray(raw.modes)?DEFAULT_MODES.filter(id=>raw.modes.includes(id)):base.modes;
  const promptTypes=Array.isArray(raw.promptTypes)?PROMPT_TYPES.filter(id=>raw.promptTypes.includes(id)):base.promptTypes;
  return {difficulty,duration,rounds,targetScore,finishType,riskRounds,blitzCount,modes,promptTypes,
    dice:true,complications:raw.complications!==false,scoring:'duel',
    contentPack:raw.contentPack?{id:raw.contentPack.id,version:raw.contentPack.version}:base.contentPack,
    preset:raw.preset?{id:raw.preset.id,version:raw.preset.version}:base.preset};
}
function restoreSession() {
  const saved=readSaved();
  if(!saved)return;
  soundOn=saved.soundOn!==false;
  options=sanitizeOptions(saved.options);
  const candidate=saved.game;
  if(!candidate||!Array.isArray(candidate.teams)||candidate.teams.length!==2||
      !Array.isArray(candidate.scores)||!Number.isInteger(candidate.roundIndex))return;
  try{
    if(candidate.startingTeamIndex!=null&&![0,1].includes(candidate.startingTeamIndex))
      throw Error('Invalid starting player');
    if(candidate.scoringVersion!=null&&![1,2].includes(candidate.scoringVersion))
      throw Error('Unsupported QUIP scoringVersion');
    if(candidate.rulesVersion!=null&&!Object.hasOwn(QUIP_RULESETS,candidate.rulesVersion))
      throw Error('Unsupported QUIP rulesVersion');
    if(candidate.modeConfigVersion!=null&&!QUIP_MODE_CONFIGS[candidate.modeConfigVersion])
      throw Error('Unknown mode config version');
    if(candidate.plannerVersion!=null)validatePlannedGame(candidate);
    if(candidate.contentPack)getContentPack(candidate.contentPack);
  }catch{storageBlocked=true;return;}
  if(candidate.phase==='rolling')candidate.phase=candidate.current?'task':'ready';
  if(candidate.phase==='countdown' && (candidate.current?.autoStartAt||0)<=Date.now()){
    candidate.phase='play';
    candidate.current.deadline=candidate.current.autoStartAt+candidate.current.seconds*1000;
    candidate.current.autoStartAt=null;
  }
  if(candidate.phase==='play'&&candidate.current?.deadline!=null&&
       candidate.current.deadline<=Date.now()) {
    candidate.phase='judge';
    candidate.current.deadline=null;
    candidate.current.finishedReason='timeout';
  }
  game=candidate;
  game.modes=game.modes||DEFAULT_MODES.slice();
  game.promptTypes=game.promptTypes||PROMPT_TYPES.slice();
  game.blitzCount=game.blitzCount||4;
  game.finishType=game.finishType||'rounds';
  game.targetScore=game.targetScore||25;
  game.riskRounds=game.riskRounds===true;
  if(game.current?.modeId==='blitz'&&!Array.isArray(game.current.blitzWords)){
    game.current.blitzWords=[game.current.word];
    game.current.blitzIndex=0;game.current.blitzCorrect=0;
  }
  if(game.current?.modeId==='blitz'&&!Array.isArray(game.current.blitzQueue)){
    game.current.blitzQueue=Array.from({length:game.current.blitzWords.length},(_,i)=>i)
      .slice(Math.min(game.current.blitzIndex||0,game.current.blitzWords.length));
  }
  game.complications=game.complications!==false;
  game.dice=true;
  if(game.current&&!game.current.difficulty)game.current.difficulty=game.difficulty==='mixed'?'medium':game.difficulty;
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
  for(const [id,key,min,max,step] of [
    ['base-duration','duration',30,90,5],
    ['quick-duration','duration',30,90,5],
    ['target-score','targetScore',15,100,5],
    ['quick-target-score','targetScore',15,100,5],
    ['custom-rounds','rounds',2,100,2]
  ]) {
    $(id).addEventListener('input',event=>{
      const requested=Number(event.target.value);
      if(!Number.isFinite(requested)){renderOptions();return;}
      options[key]=Math.max(min,Math.min(max,step*Math.round(requested/step)));
      renderOptions();persist();
    });
  }
  for(const [id,key] of [['mode-toggles','modes'],['content-toggles','promptTypes']]) {
    $(id).addEventListener('change',event=>{
      if(!event.target.matches('input[type="checkbox"]'))return;
      const inputs=[...$(id).querySelectorAll('input:checked')];
      if(!inputs.length){
        event.target.checked=true;
        toast(key==='modes'?'Нужен хотя бы один режим':'Выберите хотя бы один тип заданий');
        return;
      }
      options[key]=inputs.map(input=>input.value);
      persist();renderOptions();
    });
  }
  document.querySelectorAll('input[name="finish-type"]').forEach(input=>input.addEventListener('change',event=>{
    options.finishType=event.target.value;persist();renderOptions();sfx('button');
  }));
  $('toggle-risk').addEventListener('change',event=>{
    options.riskRounds=event.target.checked;persist();
  });
  $('toggle-complications').addEventListener('change',event=>{
    options.complications=event.target.checked;persist();
  });
  $('new-game-menu').addEventListener('click',openSetup);
  $('continue-game').addEventListener('click',continueGame);
  $('settings-menu').addEventListener('click',openPreferences);
  $('other-games-menu').addEventListener('click',()=>setScene('other-games'));
  $('other-games-back').addEventListener('click',()=>setScene('home'));
  $('preferences-back').addEventListener('click',()=>setScene('home'));
  $('preferences-rules').addEventListener('click',openRules);
  $('setup-back').addEventListener('click',()=>setScene('home'));
  $('go-advanced').addEventListener('click',()=>openAdvanced('setup'));
  $('advanced-back').addEventListener('click',closeAdvanced);
  $('advanced-done').addEventListener('click',closeAdvanced);
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
  $('sound-toggle').addEventListener('change',event=>{
    soundOn=event.target.checked;setSoundIcon();persist();
    if(soundOn)sfx('go');
  });
  $('close-rules').addEventListener('click',closeRules);
  $('rules-understood').addEventListener('click',closeRules);
  $('rules-backdrop').addEventListener('click',event=>{if(event.target.id==='rules-backdrop')closeRules();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeRules();
  });
  // Disallow native Android selection handles and context menus on every scene,
  // including settings buttons. Keyboard editing of team names still works.
  document.addEventListener('selectstart',event=>event.preventDefault());
  document.addEventListener('contextmenu',event=>event.preventDefault());
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&game?.phase==='play')tick();
  });
}
function boot() {
  setupEvents();
  restoreSession();
  setSoundIcon();
  renderOptions();
  // Even when a match is saved, start at the main menu to offer Continue.
  setScene('home');
  if(storageBlocked)toast('Сохранение несовместимо с этой версией игры. Данные сохранены.');
  if('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
boot();
