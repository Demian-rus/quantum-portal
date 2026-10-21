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
const freshOptions = () => {
  const settings=optionsForPartyPreset('classic-duel',3);
  return {...settings,awardTo:'setter',modes:settings.modes.filter(id=>id!=='yesno')};
};
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
let setupReturn='game-type';
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
function awardTeamIndex() { return awardRecipientIndex(game,currentTeamIndex()); }
function awardTeam() { return game.teams[awardTeamIndex()]; }
function selectAwardTo(value){
  if(!['setter','guesser'].includes(value)||value===options.awardTo)return;
  options.awardTo=value;
  if(value==='setter'&&options.modes.includes('yesno')){
    options.modes=options.modes.filter(id=>id!=='yesno');
    if(!options.modes.length){options.modes=['talk'];toast('Данетки отключены. Включены «Слова», чтобы остался хотя бы один режим.');}
    else toast('Данетки отключены. Их можно снова включить в тонкой настройке.');
  }
}
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
// Presentation only: always describe new-party rules, never the active save.
const RULES_GUIDE_ORDER=Object.freeze(['general','talk','mime','draw','sing','yesno','secret','blitz','approx']);
let rulesPageIndex=0;
let rulesReturnFocus=null;
let rulesGesture=null;
function rulesGuidePage(id) {
  const rules=QUIP_RULESETS[QUIP_RULE_VERSION];
  const config=modeId=>getModeConfig(modeId,rules.modeConfigVersion);
  const bonus=config('talk').modifierBonus;
  if(id==='general')return {id,title:'ОБЩИЕ ПРАВИЛА',reward:'Два соперника · один телефон',blocks:[
    ['Ход за ходом','Соревнуются две команды или два игрока. Первый загадывающий выбирается случайно, затем роли меняются. Режим случайный — из включённых.'],
    ['Кому очки','В настройках выберите получателя: загадывающий (по умолчанию) или отгадывающий. В «Примерно» отвечают обе команды, очки присуждаются вручную.'],
    ['Как победить','При игре до цели у соперника есть ответный ход. После полной пары при равенстве игра продолжается. При игре по числу ходов возможна ничья.'],
    ['Бонус и риск','Успешное усложнение добавляет +'+bonus+'. В риск-раунде неудача отнимает до '+rules.risk.loss+' очков, но счёт не падает ниже '+rules.risk.minScore+'. Эти опции можно отключить; в «Секретке» усложнение обязательно.'],
    ['Сложность и таймер','Лёгкая: ручной старт, пауза и замена слова там, где она разрешена. Средняя и сложная: автоматический старт через секунду, без паузы и замены. В «Примерно» таймера нет.'],
    ['Микс','Одна и та же сложность у обоих игроков в каждой паре ходов.']
  ]};
  const mode=config(id),base=rules.rewards[id].easy;
  const required=mode.blitzWordsCount;
  const task=id==='blitz'?'Объясняйте слова по очереди, не называя ответ и однокоренные слова. Нужно отгадать все '+required+' за один таймер.':mode.rule;
  const blocks=[['Задача',task]];
  if(id==='secret')blocks.push(['Случайный способ','Один из включённых основных способов: слова, жесты, рисунок, песня или вопросы. Если включена только «Секретка», доступен любой из пяти способов. Следуйте правилу выбранного способа и обязательному усложнению.']);
  if(required)blocks.push(['Только полный результат',required+'/'+required+' → +'+base+'. Неполный результат → 0. Пропуск возвращает слово в конец очереди; каждое угаданное слово учитывается один раз. Всегда короткие лёгкие слова.']);
  if(mode.supportsSharedAward)blocks.push(['Кому присудить очки','После устных ответов нажмите «Показать ответ». Выберите вручную: первая команда +'+base+', вторая +'+base+', обе +'+base+' или никому. Игра не сравнивает числа автоматически.']);
  if(mode.usesTimer){
    // The existing settings input owns the available base-time range.
    const range=$('base-duration'),min=Number(range.min),max=Number(range.max);
    const extra=id==='secret'?[...new Set(Object.values(QUIP_MODES_V4).filter(m=>m.secretMethod).map(m=>m.durationBonus))].sort((a,b)=>a-b):[mode.durationBonus];
    blocks.push(['Время','Базовое время: '+min+'–'+max+' с.'+(id==='secret'?' По выбранному способу: +'+extra.join(' или +')+' с.':extra[0]?' Ещё +'+extra[0]+' с на ход.':' Без добавочного времени.')]);
  }else blocks.push(['Без отсчёта','Время не ограничено. Таймера нет.']);
  if(mode.usesModifiers)blocks.push(['Усложнение',id==='secret'? '+'+base+' базовых и обязательный +'+mode.modifierBonus+' за успех. Итого +'+(base+mode.modifierBonus)+'. Если основное задание угадано, а усложнение нарушено — только +'+base+'.':'Если выпало усложнение, успех добавит +'+mode.modifierBonus+' к базовой награде. Если условие нарушено, но ответ угадан — только базовые очки. Оно не обязательно.']);
  if(mode.allowsRisk)blocks.push(['Риск','Если выпал риск-раунд, за неудачу можно потерять до '+rules.risk.loss+' очков, без ухода ниже '+rules.risk.minScore+'.']);
  else blocks.push(['Без дополнительных условий','Риска и усложнений нет.']);
  return {id,title:mode.title,reward:id==='secret'?'+'+base+' + '+mode.modifierBonus+' = +'+(base+mode.modifierBonus)+' за успех':'+'+base+' за успех',blocks};
}
function renderRulesPage(direction=0) {
  const page=rulesGuidePage(RULES_GUIDE_ORDER[rulesPageIndex]);
  const card=$('rules-card');
  card.dataset.page=page.id;
  card.innerHTML='<div class="rules-card-heading">'+(page.id==='general'?'<span class="rules-general-mark" aria-hidden="true">КВИП</span>':'<img class="rules-art" src="'+MODE_ASSETS[page.id]+'" alt="" draggable="false" decoding="sync">')+
    '<div class="rules-card-title"><h3 id="rules-card-title">'+escapeHTML(page.title)+'</h3><p class="rules-reward">'+escapeHTML(page.reward)+'</p></div></div>'+
    '<div class="rules-copy" tabindex="0" role="region" aria-label="Описание правил">'+page.blocks.map(([title,body])=>'<section><h4>'+escapeHTML(title)+'</h4><p>'+escapeHTML(body)+'</p></section>').join('')+'</div>';
  $('rules-page-status').textContent=(rulesPageIndex+1)+' / '+RULES_GUIDE_ORDER.length;
  $('rules-page-status').setAttribute('aria-label','Карточка '+(rulesPageIndex+1)+' из '+RULES_GUIDE_ORDER.length+': '+page.title);
  $('rules-prev').disabled=rulesPageIndex===0;
  $('rules-next').disabled=rulesPageIndex===RULES_GUIDE_ORDER.length-1;
  if(direction&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    card.animate([{opacity:.5,transform:'translateX('+(direction*10)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:160,easing:'ease-out'});
}
function moveRulesPage(direction){
  const next=Math.max(0,Math.min(RULES_GUIDE_ORDER.length-1,rulesPageIndex+direction));
  if(next===rulesPageIndex)return;
  const focused=document.activeElement;
  const focusWasInCard=$('rules-card').contains(focused);
  rulesPageIndex=next;renderRulesPage(direction);
  // Replacing content must not leave keyboard focus on the inert background.
  if(focusWasInCard)$('rules-card').querySelector('.rules-copy').focus({preventScroll:true});
  else if(focused?.disabled&&['rules-prev','rules-next'].includes(focused.id))$(focused.id==='rules-next'?'rules-prev':'rules-next').focus({preventScroll:true});
}
function closeRules() {
  if($('rules-backdrop').hidden)return;
  $('rules-backdrop').hidden=true;rulesGesture=null;
  document.querySelector('.site-shell').inert=false;
  document.body.classList.remove('rules-open');
  rulesReturnFocus?.focus({preventScroll:true});rulesReturnFocus=null;
}
function openRules() {
  if(!$('rules-backdrop').hidden)return;
  rulesReturnFocus=document.activeElement;rulesPageIndex=0;rulesGesture=null;
  renderRulesPage();$('rules-backdrop').hidden=false;
  document.querySelector('.site-shell').inert=true;
  document.body.classList.add('rules-open');$('close-rules').focus({preventScroll:true});
}
function rulesKeydown(event){
  if($('rules-backdrop').hidden)return;
  if(event.key==='Escape'){event.preventDefault();closeRules();return;}
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();moveRulesPage(event.key==='ArrowRight'?1:-1);return;
  }
  if(event.key==='Tab'){
    const items=[...$('rules-backdrop').querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
}
function setupRulesGuide(){
  $('rules-prev').addEventListener('click',()=>moveRulesPage(-1));
  $('rules-next').addEventListener('click',()=>moveRulesPage(1));
  const card=$('rules-card');
  card.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||!['touch','pen'].includes(event.pointerType))return;
    rulesGesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp};
  });
  card.addEventListener('pointermove',event=>{
    if(rulesGesture?.id!==event.pointerId)return;
    const dx=Math.abs(event.clientX-rulesGesture.x),dy=Math.abs(event.clientY-rulesGesture.y);
    if(dy>16&&dy>dx)rulesGesture=null;
  });
  card.addEventListener('pointerup',event=>{
    const start=rulesGesture;rulesGesture=null;
    if(!start||start.id!==event.pointerId)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.5&&event.timeStamp-start.time<1000)moveRulesPage(dx<0?1:-1);
  });
  card.addEventListener('pointercancel',()=>{rulesGesture=null;});
}
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
  for(const scene of ['home','other-games','preferences','game-type','themes','setup','advanced','game','results'])
    $('scene-'+scene).hidden=scene!==which;
  document.body.dataset.screen=which;
  updateContinue();
}
function openPreferences() {
  setSoundIcon();
  setScene('preferences');
}
function openGameType(){setScene('game-type');}
function selectStandardGame(){
 options.contentPack={id:'general',version:2};persist();openSetup('game-type');
}
function renderThemes(){
 const entries=listThematicPacks(options);
 $('theme-list').innerHTML=entries.map(({pack,available})=>
  '<button type="button" class="theme-choice" data-theme="'+pack.id+'" data-version="'+pack.version+'"'+
  (available?'':' disabled aria-disabled="true"')+'><strong>'+escapeHTML(pack.name)+'</strong><span>'+
  (available?'Выбрать тему':'Скоро')+'</span></button>').join('');
 $('themes-caption').textContent=entries.some(entry=>entry.available)?
  'Выберите тему, затем настройте партию.':'Тематические наборы ещё готовятся. Пока можно сыграть в стандартную игру.';
}
function openThemes(){renderThemes();setScene('themes');$('themes-scroll').scrollTop=0;}
function selectTheme(id,version){
 const selection={id,version};
 try{
  const pack=getContentPack(selection);
  if(pack.id==='general'||!checkContentPack(selection,options).available){toast('Эта тема пока недоступна.');return false;}
 }catch{toast('Эта тема пока недоступна.');return false;}
 options.contentPack=selection;persist();openSetup('themes');return true;
}
function openSetup(from='game-type') {
  setupReturn=from;
  // Opening setup keeps any unfinished session untouched until the user starts a new one.
  renderOptions();
  setScene('setup');
  $('setup-scroll').scrollTop=0;
}
function openAdvanced(from='setup') {
  advancedReturn=from;
  $('mode-settings').open=false;
  $('content-settings').open=false;
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
  try{$('setup-pack-caption').textContent=getContentPack(options.contentPack).name;}
  catch{$('setup-pack-caption').textContent='Набор недоступен';}
  for(const setting of ['difficulty','duration','rounds','targetScore','awardTo']) {
    document.querySelectorAll('.choices[data-setting="'+setting+'"] button').forEach(button=>{
      const selected=String(options[setting])===button.dataset.value;
      button.classList.toggle('is-chosen',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  const numbers={'base-duration':options.duration,'target-score':options.targetScore,'custom-rounds':options.rounds};
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
  $('quick-score-choices').hidden=options.finishType!=='score';
  $('finish-score-settings').hidden=options.finishType!=='score';
  $('finish-rounds-settings').hidden=options.finishType!=='rounds';
  for(const [id,value] of Object.entries(numbers)) {
    const input=$(id);
    if(input && document.activeElement!==input)input.value=String(value);
  }
  $('mode-selection-count').textContent=options.modes.length+' ИЗ '+DEFAULT_MODES.length;
  $('content-selection-count').textContent=options.promptTypes.length+' ИЗ '+PROMPT_TYPES.length;
  document.querySelectorAll('#mode-toggles input').forEach(input=>{
    input.checked=options.modes.includes(input.value);
    const tile=input.closest('label'),art=tile.querySelector('img');
    if(art.getAttribute('src')!==MODE_ASSETS[input.value])art.src=MODE_ASSETS[input.value];
    const config=getModeConfig(input.value),label=tile.querySelector('b');
    label.textContent='+'+(config.basePoints+(config.id==='secret'?config.modifierBonus:0))+
      (config.blitzWordsCount?' · '+config.blitzWordsCount+'/'+config.blitzWordsCount:'');
  });
  document.querySelectorAll('#content-toggles input').forEach(input=>{input.checked=options.promptTypes.includes(input.value);});
  $('toggle-complications').checked=options.complications;
  $('setup-award-caption').textContent='Один телефон — два соперника. Очки получает '+(options.awardTo==='setter'?'загадывающий':'отгадывающий')+'. В «Примерно» — ручной выбор.';
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
  if(game.current&&modeConfigForGame(game,game.current.modeId).supportsSharedAward){
    for(const id of ['a','b']){
      $('role-'+id).textContent='НАЗЫВАЕТ ЧИСЛО';
      $('match-team-'+id).classList.add('is-turn');
    }
  }
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
function pullApproxQuestion(level){
 const pool=getPackQuestionPool(game.contentPack,level);
 if(!pool.length)throw Error('Нет числовых вопросов для выбранных настроек');
 const key='approx:'+level;
 let used=game.used[key]||[],free=pool.filter(question=>!used.includes(question.id));
 if(!free.length){used=[];free=pool;}
 const question=randomOne(free);used.push(question.id);game.used[key]=used;
 return {...question,categories:question.categories.slice()};
}
function roundInteraction(){return modeConfigForGame(game,game.current.modeId).interaction;}
const ROUND_INTERACTIONS=Object.freeze({
 explain:Object.freeze({task:showTask,judge:showJudge}),
 estimate:Object.freeze({task:showApprox,judge:showApprox})
});
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
  const question=config.cardType==='number'?pullApproxQuestion(level):null;
  const word=question?question.question:pullWord(mode.id==='blitz'?'blitz':actualMode.kind,level);
  const blitzWords=mode.id==='blitz'?[word]:null;
  if(blitzWords)while(blitzWords.length<config.blitzWordsCount)blitzWords.push(pullWord('blitz',level,blitzWords));
  return {
    modeId:mode.id,methodId:actualMode.id,word,...(question?{question}:{}),complication:modifier?.text||'',
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
  'check-minus':'<path d="m3 12 4 4 7-9M15 16h6"/>',
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
      '<p class="play-subtitle">'+(game.scoringVersion===2?'<strong>'+opponent+'</strong> отгадывает. Очки получает <strong>'+escapeHTML(awardTeam())+'</strong>. Задание видит только загадывающий.':'Продолжение сохранённой партии по прежним правилам: очки получает команда текущего хода.')+'</p>'+
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
function showApprox(){
 const c=game.current,q=c.question,revealed=game.phase==='judge';
 $('play-content').className='play-inner is-approx';
 $('play-step').textContent='ОБЕ КОМАНДЫ НАЗЫВАЮТ ЧИСЛО';
 $('play-content').innerHTML=
  '<div class="approx-heading">'+symbol('approx')+'<h2 class="play-title">ПРИМЕРНО</h2>'+
  '<p class="play-subtitle">'+(revealed?'Решите вместе, кому начислить очки.':'Назовите ответы вслух, затем откройте правильный.')+'</p></div>'+
  '<div class="approx-card'+(revealed?' is-revealed':'')+'">'+
  (revealed?'<div class="approx-answer"><span>ПРАВИЛЬНЫЙ ОТВЕТ</span><strong>'+escapeHTML(q.answer)+' '+escapeHTML(q.unit||'')+'</strong></div>':'')+
  '<div class="approx-copy" tabindex="0" aria-label="Вопрос и пояснение"><p class="approx-question">'+escapeHTML(q.question)+'</p>'+
   (revealed&&q.note?'<p class="approx-note">'+escapeHTML(q.note)+'</p>':'')+'</div></div>'+
  '<div class="approx-actions">'+(revealed?
   makeButton(escapeHTML(game.teams[0])+' +1','award-a','button-primary')+
   makeButton(escapeHTML(game.teams[1])+' +1','award-b','button-coral')+
   makeButton('Обе команды +1','award-both')+makeButton('Никому','award-none'):
   makeButton('Показать ответ','reveal-approx','button-primary button-big'))+'</div>';
}
function revealApprox(){
 if(!game||game.phase!=='task'||roundInteraction()!=='estimate')return;
 game.phase='judge';game.current.answerRevealed=true;persist();render();
}
function awardApprox(choice){
 if(!game||game.phase!=='judge'||roundInteraction()!=='estimate'||!game.current.answerRevealed)return;
 const c=game.current,outcome=settleSharedAward(c,choice);
 outcome.deltas.forEach((delta,index)=>{game.scores[index]+=delta;});
 game.history.push({mode:c.modeId,word:c.question.question,questionId:c.question.id,
  answer:c.question.answer,unit:c.question.unit,note:c.question.note,difficulty:c.difficulty,
  recipients:outcome.recipients,recipientNames:outcome.recipients.map(index=>game.teams[index]),
  sharedAward:choice==='both',deltas:outcome.deltas,awarded:outcome.deltas.reduce((a,b)=>a+b,0),
  correct:outcome.recipients.length>0,risk:false,basePoints:c.basePoints,modifierPoints:0,
  rulesVersion:game.rulesVersion,setter:currentTeam()});
 completeRound(outcome.recipients.length>0);
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
function allowsModifierResult(){
 return ruleSetForGame(game).splitModifierOutcome===true&&Boolean(game.current?.complication);
}
function resultControls(duringPlay=false){
 const modified=allowsModifierResult();
 const option=(icon,action,label,variant)=>'<div class="judgement-option">'+iconButton(icon,action,label,variant+' prominent')+'<span>'+label+'</span></div>';
 return '<div class="three-answer-actions verdict-actions'+(duringPlay?'':' judgement-grid')+'">'+
  option('x',duringPlay?'wrong-now':'no','НЕ УГАДАЛИ','danger')+
  (modified?option('check-minus',duringPlay?'base-now':'base','БЕЗ УСЛОЖНЕНИЯ','partial'):
   duringPlay?'<div class="verdict-visibility">'+iconButton(game.current.visible?'eye-off':'eye','toggle-word',game.current.visible?'Скрыть слово':'Показать слово')+'</div>':'<span aria-hidden="true"></span>')+
  option('check',duringPlay?'correct-now':'yes',modified?'ВЫПОЛНИЛИ':'УГАДАЛИ','success')+'</div>';
}
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
function showJudge() {
  $('play-content').className='play-inner is-judge verdict-round';
  $('play-step').textContent='ИТОГ РАУНДА';
  const c=game.current,blitz=c.modeId==='blitz';
  const incompleteBlitz=blitz&&game.scoringVersion===2&&c.blitzCorrect<blitzRequiredForRound(game,c);
  const points=allowsModifierResult()?'Основа +'+c.basePoints+' · усложнение +'+c.modifierPoints:
    'Награда: +'+(blitz&&ruleSetForGame(game).legacyBlitz?c.blitzCorrect:incompleteBlitz?0:c.points);
  $('play-content').innerHTML='<div class="judge-copy" tabindex="0" role="region" aria-label="Итог раунда">'+
    '<span class="game-eyebrow">'+(c.finishedReason==='timeout'?'ВРЕМЯ ВЫШЛО':'РАУНД ЗАКОНЧЕН')+'</span>'+
    symbol(blitz?'blitz':c.methodId)+
    '<h2 class="play-title"><span class="judge-team-name'+(guessingTeam().length>16?' judge-team-name--long':'')+'">'+escapeHTML(guessingTeam())+'</span><em>УГАДАЛИ?</em></h2>'+
    '<p class="score-note">'+(blitz?'Отгадано '+c.blitzCorrect+' из '+c.blitzWords.length+(ruleSetForGame(game).legacyBlitz?'. За каждое отгаданное слово — одно очко (старая партия).':''):'Было загадано: <b>'+escapeHTML(c.word)+'</b>')+'</p>'+
    '<p class="score-note">'+points+'</p>'+
    '<p class="score-recipient">Очки получит <b>'+escapeHTML(awardTeam())+'</b></p>'+
    (c.risk?'<p class="risk-notice">⚡ Провал: до −'+ruleSetForGame(game).risk.loss+' очков у '+escapeHTML(awardTeam())+'</p>':'')+
    '</div><div class="round-bottom round-bottom--judge">'+
    (incompleteBlitz?'<div class="incomplete-blitz">'+makeButton('ЗАВЕРШИТЬ РАУНД','no','button-primary')+'</div>':resultControls())+'</div>';
}
function recordAnswer(yes,modifierSuccess=true) {
  if(!game||!['judge','play'].includes(game.phase)||roundInteraction()!=='explain')return;
  if(yes&&!modifierSuccess&&!allowsModifierResult())return;
  const teamIndex=awardTeamIndex(),c=game.current;
  const outcome=settleQuipRound(game,c,{taskSuccess:yes,modifierSuccess},game.scores[teamIndex]);
  game.scores[teamIndex]+=outcome.delta;
  game.history.push({
    team:game.teams[teamIndex],setter:currentTeam(),mode:c.modeId,
    ...(game.awardPolicyVersion?{recipientIndex:teamIndex,awardTo:game.awardTo,awardPolicyVersion:game.awardPolicyVersion}:{}),
    word:c.modeId==='blitz'?c.blitzWords.join(' / '):c.word,
    awarded:outcome.delta,correct:outcome.success,risk:!!c.risk,
    rulesVersion:outcome.rulesVersion,difficulty:c.difficulty,
    basePoints:c.basePoints,modifierPoints:outcome.success?(outcome.modifierAwarded??c.modifierPoints??0):0,
    ...(ruleSetForGame(game).splitModifierOutcome?{outcome:outcome.outcome,taskSuccess:outcome.taskSuccess,
      modifierSuccess:outcome.modifierSuccess,baseAwarded:outcome.baseAwarded,reward:outcome.reward,penalty:outcome.penalty,modeName:getMode(c.modeId).title}:{})
  });
  completeRound(outcome.success);
}
function completeRound(success){
  game.roundIndex++;
  // Confirmation is the final action for a round; no extra Next button.
  game.phase=matchComplete()?'results':'ready';
  game.current=null;
  stopTicking();persist();sfx(success?'win':'fail');render();
}
function correctNow(modifierSuccess=true) {
  if(!game||game.phase!=='play'||game.current?.modeId==='blitz')return;
  const c=game.current;
  if(!c.paused&&Date.now()>=c.deadline){finishTimer('timeout');return;}
  if(c.paused&&(c.remainingMs??0)<=0){finishTimer('timeout');return;}
  recordAnswer(true,modifierSuccess);
}
function wrongNow() {
  if(!game||game.phase!=='play'||game.current?.modeId==='blitz')return;
  const c=game.current;
  if(!c.paused && Date.now()>=c.deadline){finishTimer('timeout');return;}
  recordAnswer(false);
}
function judge(yes,modifierSuccess=true) {
  if(!game||game.phase!=='judge')return;
  recordAnswer(yes,modifierSuccess);
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
function historyMarkup(row,index){
 if(row.mode==='approx')return '<div class="history-row"><span>'+(index+1)+'. ПРИМЕРНО · '+escapeHTML(row.word)+
  ' · Ответ: '+escapeHTML(row.answer)+' '+escapeHTML(row.unit||'')+' · '+
  (row.sharedAward?'Обе команды':row.recipientNames.length?escapeHTML(row.recipientNames.join(', ')):'Никому')+
  '</span><b>'+row.deltas.map(delta=>'+'+delta).join(' / ')+'</b></div>';
 return '<div class="history-row"><span>'+(index+1)+'. '+escapeHTML(row.team)+' · '+
  escapeHTML(getMode(row.mode)?.title||'')+' · '+escapeHTML(row.word)+
  (row.outcome?' · '+(row.outcome==='failed'?'Не угадали':row.outcome==='base-only'?'Без усложнения':row.modifierSuccess===true?'С усложнением':'Угадали'):'')+'</span>'+
  '<b>'+(row.awarded>0?'+'+row.awarded:row.awarded)+'</b></div>';
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
    '<div class="history-block"><h3>ИСТОРИЯ ХОДОВ</h3>'+
    game.history.map(historyMarkup).join('')+
    '</div>';
}
function render() {
  if(!game||game.phase==='home'){setScene('home');return;}
  if(game.phase==='results'){stopTicking();showResults();return;}
  setScene('game');
  renderMatch();
  if(game.phase==='ready')showReady();
  else if(game.phase==='rolling')showRolling();
  else if(game.phase==='task')ROUND_INTERACTIONS[roundInteraction()].task();
  else if(game.phase==='countdown')showCountdown();
  else if(game.phase==='play')showTimer();
  else if(game.phase==='judge')ROUND_INTERACTIONS[roundInteraction()].judge();
  else if(game.phase==='between')showBetween();
  if(game.phase==='countdown'||(game.phase==='play'&&!game.current.paused))startTicking();
  else stopTicking();
}
function newGame() {
  if(storageBlocked){toast('Сохранение несовместимо с этой версией игры. Данные сохранены.');return;}
  // START is the explicit action; don't repeat it with a native confirmation.
  if(!options.modes.length){toast('Выберите хотя бы один игровой режим');return;}
  if(!options.promptTypes.length && options.modes.some(id=>['talk','mime','draw','blitz','secret'].includes(id))){toast('Выберите тип заданий');return;}
  let contentPack=options.contentPack||{id:'general',version:2};
  // Upgrade only new general parties needing numeric content, never an active saved match.
  if(contentPack.id==='general'&&contentPack.version===1&&options.modes.includes('approx'))contentPack={id:'general',version:2};
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
    awardPolicyVersion:QUIP_AWARD_POLICY_VERSION,awardTo:['setter','guesser'].includes(options.awardTo)?options.awardTo:'setter',
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
  if(!game||!roundUsesTimer()||game.phase!=='task'||!allowPause()||game.current.modeId==='blitz')return;
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
    case 'reveal-approx':return revealApprox();
    case 'award-a':case 'award-b':case 'award-both':case 'award-none':return awardApprox(action.slice(6));
    case 'toggle-word':return toggleWord();
    case 'replace-word':return replaceWord();
    case 'start-timer':return startTimer();
    case 'pause':return pauseTimer();
    case 'resume':return resumeTimer();
    case 'finish-early':return finishTimer('early');
    case 'correct-now':return correctNow();
    case 'base-now':return correctNow(false);
    case 'wrong-now':return wrongNow();
    case 'blitz-correct':return advanceBlitz(true);
    case 'blitz-skip':return advanceBlitz(false);
    case 'yes':return judge(true);
    case 'base':return judge(true,false);
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
    awardTo:['setter','guesser'].includes(raw.awardTo)?raw.awardTo:base.awardTo,
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
    validateAwardPolicy(candidate);
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
  game.modes=game.modes||(ruleSetForGame(game).version<4?Object.keys(QUIP_LEGACY_MODES):DEFAULT_MODES).slice();
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
      if(setting==='awardTo')selectAwardTo(value);
      else options[setting]=setting==='difficulty'?value:Number(value);
      renderOptions();persist();sfx('button');
    });
  });
  for(const [id,key,min,max,step] of [
    ['base-duration','duration',30,90,5],
    ['target-score','targetScore',15,100,5],
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
  $('new-game-menu').addEventListener('click',openGameType);
  $('game-type-back').addEventListener('click',()=>setScene('home'));
  $('standard-game').addEventListener('click',selectStandardGame);
  $('thematic-game').addEventListener('click',openThemes);
  $('themes-back').addEventListener('click',openGameType);
  $('themes-standard').addEventListener('click',selectStandardGame);
  $('theme-list').addEventListener('click',event=>{
    const button=event.target.closest('[data-theme]');
    if(button&&!button.disabled)selectTheme(button.dataset.theme,Number(button.dataset.version));
  });
  $('continue-game').addEventListener('click',continueGame);
  $('settings-menu').addEventListener('click',openPreferences);
  $('other-games-menu').addEventListener('click',()=>setScene('other-games'));
  $('other-games-back').addEventListener('click',()=>setScene('home'));
  $('preferences-back').addEventListener('click',()=>setScene('home'));
  $('preferences-rules').addEventListener('click',openRules);
  $('setup-back').addEventListener('click',()=>setupReturn==='themes'?openThemes():openGameType());
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
  setupRulesGuide();
  document.addEventListener('keydown',rulesKeydown);
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
