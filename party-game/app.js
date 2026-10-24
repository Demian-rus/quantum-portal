'use strict';
const STORAGE_KEY = 'iskra-party:v1';
const MODE_LIST=Object.freeze(Object.values(QUIP_MODES_V4).filter(mode=>mode.enabled));
function severityForRound() {
  return game.current?.difficulty || game.difficulty;
}
// Missing version preserves card-based controls in historical parties, including paused Mixed.
const QUIP_TIMER_POLICY_VERSION=1;
function timerPolicy(match){
  const version=match?.timerPolicyVersion;
  if(version!=null&&version!==QUIP_TIMER_POLICY_VERSION)throw Error('Unsupported QUIP timer policy');
  return version??null;
}
function allowPause() { return (timerPolicy(game)===1?game.difficulty:severityForRound())==='easy'; }
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
  return {...settings,modeSettings:sanitizeModeSettings(),contentPack:latestGeneralPackSelection(),packPreferences:{},modifierChance:QUIP_MODIFIER_SELECTION_POLICIES[QUIP_MODIFIER_SELECTION_VERSION].defaultChance};
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
function matchComplete(){return scoreMatchComplete(game);}
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
  else if(game.phase==='tiebreak')showTiebreak();
  if(game.phase==='countdown'||(game.phase==='play'&&!game.current.paused))startTicking();
  else stopTicking();
}
function newGame() {
  if(storageBlocked&&storageProblem!=='corrupt'){toast(storageNotice());return;}
  // START is the explicit action; don't repeat it with a native confirmation.
  if(!options.modes.length){toast('Выберите хотя бы один игровой режим');return;}
  if(!options.promptTypes.length && options.modes.some(id=>['talk','mime','draw','blitz','secret'].includes(id))){toast('Выберите тип заданий');return;}
  const songPolicy=setupSongPolicy(options);
  let contentPack=options.contentPack||{id:'general',version:2};
  // Only a newly started party adopts the latest enabled revision. Validate
  // the requested revision first: a disabled/unknown old theme cannot upgrade
  // itself into a playable selection. Saved games never enter this path.
  try{
    if(getContentPack(contentPack).enabled)contentPack=latestContentPackSelection(contentPack.id);
    const settings={...options,...songPolicy,modeCompatibilityVersion:QUIP_MODE_COMPATIBILITY_VERSION};
    const availability=checkContentPack(contentPack,settings);
    if(!availability.available){
      toast(availability.problems[0]);return;
    }
    if(QUIP_MODIFIER_SELECTION_VERSION===2&&options.modes.includes('secret')){
      for(const level of options.difficulty==='mixed'?PARTY_CARD_LEVELS:[options.difficulty])v2SecretMethods(contentPack,settings,level);
    }
  }catch{toast('Набор заданий недоступен для выбранных настроек.');return;}
  if(!selectedPlayerProfiles()){toast('Выберите два разных профиля.');return;}
  if(storageBlocked&&!recoverCorruptSave()){toast(storageNotice());return;}
  if(!saveCompletedProfileResult()){toast(profileResultProblem);return;}
  // Capture the previous session before reserving the new profile match.
  const previousGame=game,previousTaskMemory=taskMemory;
  let previousSavedRaw;
  try{previousSavedRaw=localStorage.getItem(STORAGE_KEY);}
  catch{toast('Не удалось прочитать сохранение. Новая партия не начата.');return;}
  let identity;
  try{identity=reserveProfileMatch();}catch(error){toast(profileStoreProblem||error.message);return;}
  archiveCurrentTaskHistory();
  const startedHistory=startTaskHistory(taskMemory||freshTaskMemory());taskMemory=startedHistory.memory;
  const [teamA,teamB]=identity.participants.map(profile=>profile.name);
  game={
    matchId:identity.storeId+':'+identity.sequence,profileMatch:identity,
    teams:[teamA,teamB],scores:[0,0],roundIndex:0,startingTeamIndex:chooseStartingTeam(),
    ...songPolicy,timerPolicyVersion:QUIP_TIMER_POLICY_VERSION,finishPolicyVersion:QUIP_FINISH_POLICY_VERSION,
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
  if(!persist()){
    // A normal quota failure leaves the old localStorage value untouched.
    // On a confirmation failure, attempt to restore the exact prior RAW.
    game=previousGame;taskMemory=previousTaskMemory;
    try{
      if(localStorage.getItem(STORAGE_KEY)!==previousSavedRaw){
        if(previousSavedRaw===null)localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY,previousSavedRaw);
        if(localStorage.getItem(STORAGE_KEY)!==previousSavedRaw)throw Error('Start rollback failed');
      }
    }catch{
      storageBlocked=true;storageProblem='unavailable';
      toast('Не удалось проверить сохранение. Новая партия не запущена.');return;
    }
    toast('Новая партия не запущена: не удалось сохранить её на устройстве.');return;
  }
  sfx('go');render();
}

function backToMenu() {
  stopTicking();
  if(game?.phase==='rolling')game.phase=game.current?'task':'ready';
  if(game?.phase==='results'){
    if(!saveCompletedProfileResult()){toast(profileResultProblem);return;}
    archiveCurrentTaskHistory();game=null;
  }
  persist();
  setScene('home');
  renderOptions();
}
function handleAction(action) {
  switch(action) {
    case 'roll':return roll();
    case 'reveal-approx':return revealApprox();
    case 'tiebreak-reveal':return revealTiebreak();
    case 'tiebreak-a':case 'tiebreak-b':case 'tiebreak-same':return settleTiebreak(action.slice(9));
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
    case 'again':if(game?.phase==='results'){
      if(!saveCompletedProfileResult()){toast(profileResultProblem);return;}
      // Let newGame replace the previous result only after START is durable.
      if(selectedPlayerProfiles())newGame();
      else{archiveCurrentTaskHistory();game=null;openSetup();}
    }return;
    case 'retry-statistics':saveCompletedProfileResult();showResults();return;
    case 'menu':return backToMenu();
  }
}
function setupEvents() {
  registerSetupControls();
  registerProfileControls();
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
  restoreProfiles();
  restoreSession();
  if(game?.phase==='results')saveCompletedProfileResult();
  setSoundIcon();
  renderOptions();
  // Even when a match is saved, start at the main menu to offer Continue.
  setScene('home');
  installBrowserBackNavigation();
  if(profileResultProblem)showResults();
  if(storageBlocked)toast(storageNotice());
  if('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
boot();
