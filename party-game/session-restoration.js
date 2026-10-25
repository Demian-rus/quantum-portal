'use strict';
// Session restoration; shared state is initialized in app.js before boot.

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
    modeSettings:sanitizeModeSettings(raw.modeSettings),
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
    validateProfileMatch(candidate);
    validateGameTaskHistory(candidate,taskMemory);
    validateAwardPolicy(candidate);
    modeCompatibilityPolicy(candidate);
    modifierSelectionPolicy(candidate);
    if(candidate.plannerVersion!=null)validatePlannedGame(candidate);
    if(candidate.modePlannerVersion!=null||candidate.modePlannerState!=null)
      validateModePlan(candidate.modePlannerVersion,candidate.modePlannerState);
    if(candidate.contentPack)getContentPack(candidate.contentPack);
    songLanguagePolicy(candidate);
    timerPolicy(candidate);
    validateFeedbackHold(candidate);
    finishPolicyVersion(candidate);
    validateTiebreakState(candidate);
    validateResultReview(candidate);
  }catch{storageBlocked=true;return;}
  if(candidate.phase==='between'){
    const last=Array.isArray(candidate.history)?candidate.history[candidate.history.length-1]:null;
    if(!last||typeof last.correct!=='boolean'||!Number.isFinite(last.awarded)){
      blockSavedData('corrupt');return;
    }
  }
  if(candidate.phase==='rolling')candidate.phase=candidate.current?'task':'ready';
  if(candidate.phase==='countdown' && !candidate.current?.feedbackHold && (candidate.current?.autoStartAt||0)<=Date.now()){
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
  renderOptions();
}
