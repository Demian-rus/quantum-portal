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
  return {...settings,contentPack:latestGeneralPackSelection(),packPreferences:{},modifierChance:QUIP_MODIFIER_SELECTION_POLICIES[QUIP_MODIFIER_SELECTION_VERSION].defaultChance};
};
let options = freshOptions();
let soundOn = true;
let game = null;
let taskMemory=null;
let storageBlocked=false;
let storageProblem=null;
let loadedSaveRaw=null;
const RECOVERY_KEY='iskra-party:recovery:v1';
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
function displayTeamName(value){
  const chars=Array.from(String(value));
  if(chars.length>16&&!/\s/u.test(value)){
    const mid=Math.ceil(chars.length/2);
    return escapeHTML(chars.slice(0,mid).join(''))+'<wbr>'+escapeHTML(chars.slice(mid).join(''));
  }
  return escapeHTML(value);
}
function storageNotice(){
  if(storageProblem==='corrupt')return 'Сохранение повреждено и защищено. Для безопасного сброса начните новую партию.';
  if(storageProblem==='unavailable')return 'Не удалось прочитать сохранение. Запись заблокирована.';
  return 'Сохранение несовместимо с этой версией игры. Данные сохранены.';
}
function blockSavedData(reason){storageBlocked=true;storageProblem=reason;return null;}
function readSaved() {
  try { loadedSaveRaw=localStorage.getItem(STORAGE_KEY); }
  catch { return blockSavedData('unavailable'); }
  if(loadedSaveRaw===null)return null;
  let obj;
  try { obj=JSON.parse(loadedSaveRaw); }
  catch { return blockSavedData('corrupt'); }
  if(!obj||typeof obj!=='object'||Array.isArray(obj))return blockSavedData('corrupt');
  if(obj.version!==1)return blockSavedData('incompatible');
  return obj;
}
// Explicit recovery only for corrupt data, never for an unknown future version.
// A verified bounded backup is written before the original key can be replaced.
function recoverCorruptSave(){
  if(storageProblem!=='corrupt'||typeof loadedSaveRaw!=='string')return false;
  if(!window.confirm('Сохранение повреждено. Сохранить резервную копию на этом устройстве и начать заново? Предыдущая резервная копия, если есть, будет заменена.'))return false;
  try{
    if(localStorage.getItem(STORAGE_KEY)!==loadedSaveRaw)throw Error('Save changed');
    const backup=JSON.stringify({version:1,createdAt:Date.now(),raw:loadedSaveRaw});
    localStorage.setItem(RECOVERY_KEY,backup);
    if(localStorage.getItem(RECOVERY_KEY)!==backup||localStorage.getItem(STORAGE_KEY)!==loadedSaveRaw)throw Error('Backup unavailable or save changed');
    const reset=JSON.stringify({version:1,options,soundOn,game:null,...(taskMemory?{taskMemory}:{})});
    localStorage.setItem(STORAGE_KEY,reset);
    if(localStorage.getItem(STORAGE_KEY)!==reset)throw Error('Recovery not persisted');
    storageBlocked=false;storageProblem=null;loadedSaveRaw=reset;return true;
  }catch{toast('Сброс не выполнен. Исходные данные защищены; попробуйте перезагрузить страницу.');return false;}
}
function persist() {
  if(storageBlocked)return;
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,options,soundOn,game,...(taskMemory?{taskMemory}:{})})); }
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
// Setup selection policies are implemented in setup-controls.js.
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
// Sound control and optional Web Audio feedback are defined in audio.js.
function toast(message) {
  const element=$('toast');
  element.textContent=message;
  element.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>element.classList.remove('show'),2450);
}
// The rules guide is implemented in rules-guide.js (loaded before app.js).
// Menu navigation and theme/setup routing live in menu-navigation.js.
function continueGame() {
  if(!hasUnfinishedGame())return;
  if(game.phase==='rolling')game.phase=game.current?'task':'ready';
  if(game.phase==='countdown'&&Date.now()>=game.current.autoStartAt)beginAutomaticRound();
  if(game.phase==='play'&&!game.current.paused&&game.current.deadline<=Date.now())
    finishTimer('timeout');
  render();
}
// Setup UI projections are implemented by setup-view.js.
// The card catalog owns all active content and metadata; legacy saves still use text.
const PARTY_VOCABULARY=Object.freeze(Object.fromEntries(
  ['word','phrase','idiom'].map(type=>[type,Object.freeze(Object.fromEntries(
    PARTY_CARD_LEVELS.map(level=>[level,Object.freeze(PARTY_CARD_POOLS[type][level].map(card=>card.text))])
  ))])
));
// Lucide-like vector UI controls; illustrated mode assets continue to use WebP.
// The wheel is a window into a repeating ring, not a strip that ends on the prize.
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
  if(storageBlocked&&storageProblem!=='corrupt'){toast(storageNotice());return;}
  // START is the explicit action; don't repeat it with a native confirmation.
  if(!options.modes.length){toast('Выберите хотя бы один игровой режим');return;}
  if(!options.promptTypes.length && options.modes.some(id=>['talk','mime','draw','blitz','secret'].includes(id))){toast('Выберите тип заданий');return;}
  let contentPack=options.contentPack||{id:'general',version:2};
  // Only a newly started party adopts the latest enabled revision. Validate
  // the requested revision first: a disabled/unknown old theme cannot upgrade
  // itself into a playable selection. Saved games never enter this path.
  try{
    if(getContentPack(contentPack).enabled)contentPack=latestContentPackSelection(contentPack.id);
    const settings={...options,modeCompatibilityVersion:QUIP_MODE_COMPATIBILITY_VERSION};
    const availability=checkContentPack(contentPack,settings);
    if(!availability.available){
      toast(availability.problems[0]);return;
    }
    if(QUIP_MODIFIER_SELECTION_VERSION===2&&options.modes.includes('secret')){
      for(const level of options.difficulty==='mixed'?PARTY_CARD_LEVELS:[options.difficulty])v2SecretMethods(contentPack,settings,level);
    }
  }catch{toast('Набор заданий недоступен для выбранных настроек.');return;}
  if(storageBlocked&&!recoverCorruptSave()){toast(storageNotice());return;}
  archiveCurrentTaskHistory();
  const startedHistory=startTaskHistory(taskMemory||freshTaskMemory());taskMemory=startedHistory.memory;
  const teamA=sanitizeTeam($('team-a').value,'Молнии');
  const teamB=sanitizeTeam($('team-b').value,'Кометы');
  game={
    teams:[teamA,teamB],scores:[0,0],roundIndex:0,startingTeamIndex:chooseStartingTeam(),
    taskHistoryVersion:QUIP_TASK_HISTORY_VERSION,taskHistory:startedHistory.history,
    rounds:options.rounds,targetScore:options.targetScore,finishType:options.finishType,
    riskRounds:options.riskRounds,scoringVersion:2,rulesVersion:QUIP_RULE_VERSION,modeConfigVersion:QUIP_MODE_CONFIG_VERSION,
    awardPolicyVersion:QUIP_AWARD_POLICY_VERSION,awardTo:['setter','guesser'].includes(options.awardTo)?options.awardTo:'setter',
    modeCompatibilityVersion:QUIP_MODE_COMPATIBILITY_VERSION,
    modifierCatalogVersion:QUIP_MODIFIER_CATALOG_V2,modifierSelectionVersion:QUIP_MODIFIER_SELECTION_VERSION,modifierChance:sanitizeModifierChance(options.modifierChance),modifierRecent:[],
    plannerVersion:QUIP_PLANNER_VERSION,plannerState:freshRoundPlan(),
    modePlannerVersion:QUIP_MODE_PLANNER_VERSION,modePlannerState:freshModePlan(),
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
function backToMenu() {
  stopTicking();
  if(game?.phase==='rolling')game.phase=game.current?'task':'ready';
  if(game?.phase==='results'){archiveCurrentTaskHistory();game=null;}
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
    case 'again':if(game?.phase==='results'){archiveCurrentTaskHistory();game=null;newGame();}return;
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
  const awardTo=['setter','guesser'].includes(raw.awardTo)?raw.awardTo:base.awardTo;
  return {difficulty,duration,rounds,targetScore,finishType,riskRounds,blitzCount,modes:compatibleAwardModes({modes,awardTo,modeCompatibilityVersion:QUIP_MODE_COMPATIBILITY_VERSION}),promptTypes,
    modeCompatibilityVersion:QUIP_MODE_COMPATIBILITY_VERSION,
    awardTo,
    modifierChance:sanitizeModifierChance(raw.modifierChance),
    packPreferences:Object.fromEntries(Object.entries(raw.packPreferences||{}).filter(([key,value])=>/^[a-z][a-z0-9-]*@[1-9][0-9]*$/.test(key)&&value&&Array.isArray(value.modes)&&Array.isArray(value.promptTypes)).map(([key,value])=>[key,{modes:DEFAULT_MODES.filter(id=>value.modes.includes(id)),promptTypes:PROMPT_TYPES.filter(id=>value.promptTypes.includes(id))}])) ,
    dice:true,complications:raw.complications!==false,scoring:'duel',
    contentPack:raw.contentPack?{id:raw.contentPack.id,version:raw.contentPack.version}:base.contentPack,
    preset:raw.preset?{id:raw.preset.id,version:raw.preset.version}:base.preset};
}
function restoreSession() {
  const saved=readSaved();
  if(!saved)return;
  try{taskMemory=saved.taskMemory==null?null:validateTaskMemory(saved.taskMemory);}catch{blockSavedData('incompatible');return;}
  soundOn=saved.soundOn!==false;
  try{modeCompatibilityPolicy(saved.options);options=sanitizeOptions(saved.options);}catch{blockSavedData('incompatible');return;}
  const candidate=saved.game;
  if(candidate==null)return;
  if(!Array.isArray(candidate.teams)||candidate.teams.length!==2||
      !Array.isArray(candidate.scores)||!Number.isInteger(candidate.roundIndex)){blockSavedData('corrupt');return;}
  try{
    if(candidate.startingTeamIndex!=null&&![0,1].includes(candidate.startingTeamIndex))
      throw Error('Invalid starting player');
    if(candidate.scoringVersion!=null&&![1,2].includes(candidate.scoringVersion))
      throw Error('Unsupported QUIP scoringVersion');
    if(candidate.rulesVersion!=null&&!Object.hasOwn(QUIP_RULESETS,candidate.rulesVersion))
      throw Error('Unsupported QUIP rulesVersion');
    if(candidate.modeConfigVersion!=null&&!QUIP_MODE_CONFIGS[candidate.modeConfigVersion])
      throw Error('Unknown mode config version');
    validateGameTaskHistory(candidate,taskMemory);
    validateAwardPolicy(candidate);
    modeCompatibilityPolicy(candidate);
    modifierSelectionPolicy(candidate);
    if(candidate.plannerVersion!=null)validatePlannedGame(candidate);
    if(candidate.modePlannerVersion!=null||candidate.modePlannerState!=null)
      validateModePlan(candidate.modePlannerVersion,candidate.modePlannerState);
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
  registerSetupControls();
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
  installBrowserBackNavigation();
  if(storageBlocked)toast(storageNotice());
  if('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
boot();
