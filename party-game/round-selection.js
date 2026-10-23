'use strict';
// Existing selection functions; state, registries and helpers stay in their current scripts.

function pickMode(level) {
  const allowed=MODE_LIST.filter(m=>game.modes.includes(m.id)&&modeAwardAvailability(m.id,game).available);
  if(!allowed.length)throw Error('Не выбрано ни одного режима');
  if(game.modePlannerVersion!=null){
    validateModePlan(game.modePlannerVersion,game.modePlannerState);
    // Pools were validated at newGame; the saved selection is immutable.
    const pack=getContentPack(game.contentPack);
    const modes=allowed.filter(m=>!pack.allowedModes||pack.allowedModes.includes(m.id)).map(m=>m.id);
    const planned=planMode(game.modePlannerState,{modes,rewards:modeOpportunityRewards(game,modes,level),
      recipientIndex:awardTeamIndex(),pairStart:game.roundIndex%2===0});
    game.modePlannerState=planned.state;
    return getMode(planned.modeId);
  }
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

function getPromptPool(kind,level,modeId=game?.current?.modeId??'sing'){
  let cards=game?.contentPack?getPackCardPool(game.contentPack,kind,level,game.promptTypes):
    getPackCardPool({id:'general',version:1},kind,level,game?.promptTypes);
  if(kind==='songs'&&modeId==='sing')cards=filterSongLanguagePool(cards,game);
  return [...new Set(cards.map(card=>card.text))];
}

function archiveCurrentTaskHistory(){
 if(game?.taskHistoryVersion===QUIP_TASK_HISTORY_VERSION&&taskMemory)taskMemory=archiveTaskHistory(taskMemory,game.taskHistory);
}

function chooseRememberedTask(pool,excluded=[]){
 const excludedText=new Set(excluded.map(normalizeTaskText));
 const excludedKeys=[...excludedText].map(key=>'prompt:text:'+key);
 for(const row of pool)if(excludedText.has(normalizeTaskText(row.question??row.text)))excludedKeys.push(...taskRecordKeys(row));
 const selected=selectHistoryRecord(pool,game.taskHistory,taskMemory,{excludedKeys});
 game.taskHistory=selected.history;return selected.record;
}

function rememberLegacyWordUse(kind,level,word,modeId=game?.current?.modeId??'sing'){
 const key=(kind==='blitz'?'easy':level)+':'+kind+':'+(game.promptTypes||[]).join(',');
 const pool=getPromptPool(kind,level,modeId),used=game.used[key]||[];
 const next=pool.every(text=>used.includes(text))?[]:used.slice();
 if(!next.includes(word))next.push(word);game.used[key]=next;
}

function pullWord(kind, level=chooseDifficulty(),excluded=[],modeId=game?.current?.modeId??'sing') {
  if(game.taskHistoryVersion!=null){
    let pool=game.contentPack?getPackCardPool(game.contentPack,kind,level,game.promptTypes):getCardPool(kind,level,game.promptTypes);
    if(kind==='songs'&&modeId==='sing')pool=filterSongLanguagePool(pool,game);
    const selected=chooseRememberedTask(pool,excluded);rememberLegacyWordUse(kind,level,selected.text,modeId);return selected.text;
  }
  const pool=getPromptPool(kind,level,modeId).filter(word=>!excluded.includes(word));
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
 if(game.taskHistoryVersion!=null){const question=chooseRememberedTask(pool);const key='approx:'+level,used=game.used[key]||[];game.used[key]=(pool.every(row=>used.includes(row.id))?[]:used).concat(question.id);return {...question,categories:question.categories.slice()};}
 if(!pool.length)throw Error('Нет числовых вопросов для выбранных настроек');
 const key='approx:'+level;
 let used=game.used[key]||[],free=pool.filter(question=>!used.includes(question.id));
 if(!free.length){used=[];free=pool;}
 const question=randomOne(free);used.push(question.id);game.used[key]=used;
 return {...question,categories:question.categories.slice()};
}

function rollOutcome() {
  // Historical saves keep mode-before-difficulty RNG order exactly as before.
  const plannedLevel=game.modePlannerVersion==null?null:chooseDifficulty();
  const mode=pickMode(plannedLevel),config=modeConfigForGame(game,mode.id);
  game.modeHistory.push(mode.id);
  let actualMode=mode;
  const level=plannedLevel??chooseDifficulty();
  if(mode.id==='secret'){
    actualMode=getMode(randomOne(game.modifierSelectionVersion===2?v2SecretMethods(game.contentPack,game,level):secretMethodsForPack(game.contentPack,game)));
  }
  let selection=game.modifierSelectionVersion!==2&&config.usesModifiers?choosePartyModifier(game,{modeId:mode.id,methodId:actualMode.id,
    difficulty:level,complications:game.complications}):null;
  const question=config.cardType==='number'?pullApproxQuestion(level):null;
  // Secret keeps its historical song source; the language policy belongs to sing.
  const word=question?question.question:pullWord(mode.id==='blitz'?'blitz':actualMode.kind,level,[],mode.id);
  const blitzWords=mode.id==='blitz'?[word]:null;
  if(blitzWords)while(blitzWords.length<config.blitzWordsCount)blitzWords.push(pullWord('blitz',level,blitzWords));
  if(game.modifierSelectionVersion===2&&config.usesModifiers){
    const card=getPackCardPool(game.contentPack,actualMode.kind,level,game.promptTypes).find(row=>row.text===word);
    selection=choosePartyModifier(game,{modeId:mode.id,methodId:actualMode.id,difficulty:level,complications:game.complications,card,memory:taskMemory});
  }
  const modifier=selection?.modifier||null;
  if(selection&&game.modifierSelectionVersion!=null)game.modifierRecent=selection.recent;
  if(selection?.taskHistory)game.taskHistory=selection.taskHistory;
  return {
    modeId:mode.id,methodId:actualMode.id,word,...(question?{question}:{}),complication:modifier?.text||'',
    complicationId:modifier?.id||null,modifierVersion:game.modifierCatalogVersion??QUIP_MODIFIER_VERSION,difficulty:level,
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
