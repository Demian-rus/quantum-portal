'use strict';
// Presentation-only Russian count forms. Genitive contexts use their own forms.
function ruCountText(value,forms){
  const n=Math.abs(Number(value)),last=n%10,teen=n%100;
  const form=!Number.isInteger(n)||teen>=11&&teen<=14?2:last===1?0:last>=2&&last<=4?1:2;
  return String(value)+' '+forms[form];
}
function ruTurns(value){return ruCountText(value,['ход','хода','ходов']);}
function ruPoints(value){return ruCountText(value,['очко','очка','очков']);}
function ruAfterTurns(value){return 'После '+ruCountText(value,['хода','ходов','ходов']);}

let modeSettingsSnapshot=null;
function renderModeSettings(useSnapshot=false){
  const id=$('mode-options-backdrop').dataset.mode;
  if(!DEFAULT_MODES.includes(id))return;
  $('mode-options-title').textContent=getMode(id).title;
  $('mode-options-art').src=MODE_ASSETS[id];
  $('mode-song-sources').hidden=id!=='sing';
  $('mode-options-placeholder').hidden=id==='sing';
  if(id!=='sing')return;
  const languages=sanitizeModeSettings(options.modeSettings).sing.songLanguages;
  document.querySelectorAll('[data-song-language]').forEach(button=>{
    const selected=languages.includes(button.dataset.songLanguage);
    button.setAttribute('aria-pressed',String(selected));button.classList.toggle('is-selected',selected);
  });
  const settings={...options,modes:['sing']};
  // Presentation cache only: always derive eligibility from the real checker.
  const {packPreferences,duration,targetScore,rounds,modifierChance,...stableSettings}=settings;
  const stamp={key:JSON.stringify({...stableSettings,...setupSongPolicy(settings)}),cards:PARTY_CARDS,
    questions:QUIP_APPROX_QUESTIONS,packs:QUIP_CONTENT_PACKS,config:getModeConfig,validate:checkContentPack};
  let available;
  if(useSnapshot&&modeSettingsSnapshot&&Object.keys(stamp).every(key=>stamp[key]===modeSettingsSnapshot[key]))available=modeSettingsSnapshot.available;
  else{
    available=false;
    try{available=checkContentPack(options.contentPack,{...settings,...setupSongPolicy(settings)}).available;}catch{}
    modeSettingsSnapshot={...stamp,available};
  }
  $('mode-source-availability').hidden=available;
  $('mode-source-availability').textContent=available?'':'Для «Напой» нет заданий с этими источниками на выбранной сложности. В «Секретке» песенный способ будет исключён, если доступны другие способы. Для прямого «Напой» измените источники, сложность или набор.';
  return available;
}
// Numeric values never determine catalog eligibility. This small projection also
// updates the actual controls, quick choices and all labels synchronously.
function renderSetupValues(){
  for(const setting of ['difficulty','duration','rounds','targetScore','awardTo']) {
    document.querySelectorAll('.choices[data-setting="'+setting+'"] button').forEach(button=>{
      const selected=String(options[setting])===button.dataset.value;
      button.classList.toggle('is-chosen',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  const numbers={'base-duration':options.duration,'target-score':options.targetScore,'custom-rounds':options.rounds,'modifier-chance':options.modifierChance};
  $('base-duration-value').textContent=options.duration+' с';
  $('target-score-value').textContent=ruPoints(options.targetScore);
  $('rounds-value').textContent=ruTurns(options.rounds);
  $('modifier-chance-value').textContent=options.modifierChance+'%';
  $('base-duration-value-advanced').textContent=options.duration+' с';
  $('finish-score').checked=options.finishType==='score';
  $('finish-rounds').checked=options.finishType==='rounds';
  $('toggle-risk').checked=options.riskRounds;
  $('score-goal-preview').textContent=options.finishType==='score'?ruPoints(options.targetScore):ruAfterTurns(options.rounds);
  $('score-goal-caption').textContent=options.finishType==='score'?'У каждого игрока будет ответный ход':'Одинаковое число ходов у обоих игроков';
  $('setup-finish-label').textContent=options.finishType==='score'?'МАКСИМУМ ОЧКОВ':'КОЛИЧЕСТВО ХОДОВ';
  $('quick-score-choices').hidden=options.finishType!=='score';
  $('finish-score-settings').hidden=options.finishType!=='score';
  $('finish-rounds-settings').hidden=options.finishType!=='rounds';
  for(const [id,value] of Object.entries(numbers)) {
    const input=$(id);
    if(input && document.activeElement!==input)input.value=String(value);
  }
}
// DOM-only rendering of new-game and advanced settings; original behavior preserved.
function renderOptions() {
  let setupPack=null;
  try{setupPack=getContentPack(options.contentPack);$('setup-pack-caption').textContent=setupPack.name;}
  catch{$('setup-pack-caption').textContent='Набор недоступен';}
  renderSetupValues();
  $('mode-selection-count').textContent=options.modes.length+' ИЗ '+DEFAULT_MODES.length;
  $('content-selection-count').textContent=options.promptTypes.length+' ИЗ '+PROMPT_TYPES.length;
  document.querySelectorAll('#mode-toggles input').forEach(input=>{
    input.checked=options.modes.includes(input.value);
    const tile=input.closest('label'),art=tile.querySelector('img');
    if(art.getAttribute('src')!==MODE_ASSETS[input.value])art.src=MODE_ASSETS[input.value];
    const status=setupPack?packModeAvailability(options.contentPack,{...options,...setupSongPolicy(options)},input.value):{available:false,reason:'Набор недоступен'};
    const filtered=!!validateGeneralCategorySelection(options.contentPack)?.excluded.length;
    input.disabled=!status.available&&!(filtered&&input.checked);tile.title=status.reason;
    input.dataset.categoryUnavailable=String(filtered&&!status.available);
    const config=getModeConfig(input.value),label=tile.querySelector('b');
    label.textContent='+'+(config.basePoints+(config.id==='secret'?config.modifierBonus:0))+
      (config.blitzWordsCount?' · '+config.blitzWordsCount+'/'+config.blitzWordsCount:'');
  });
  document.querySelectorAll('#content-toggles input').forEach(input=>{
    input.checked=options.promptTypes.includes(input.value);
    const unavailable=!setupPack||!!setupPack.allowedModes&&!setupPack.types.includes(input.value);
    input.disabled=unavailable;input.closest('label').querySelector('.content-availability').textContent=unavailable?'В этой теме нет таких заданий':'';
  });
  $('toggle-complications').checked=options.complications;
  $('modifier-chance-settings').hidden=!options.complications;
  $('modifier-chance-value').textContent=options.modifierChance+'%';
  $('setup-award-caption').textContent='Один телефон — два соперника. Очки получает '+(options.awardTo==='setter'?'загадывающий':'отгадывающий')+'. В «Примерно» — ручной выбор.';
  let problems=['Набор недоступен'];
  if(setupPack)try{problems=checkContentPack(options.contentPack,{...options,...setupSongPolicy(options),modeCompatibilityVersion:QUIP_MODE_COMPATIBILITY_VERSION}).problems;}catch{}
  renderProfileSelectors();
  $('start-game').disabled=problems.length>0||!selectedPlayerProfiles()||!!profileStoreProblem;
  $('setup-mode-notice').hidden=!problems.length;
  $('setup-mode-notice').textContent=problems[0]?.startsWith('sing/')?'Для «Напой» нет заданий с выбранными источниками на этой сложности. Измените источники или сложность в тонкой настройке.':problems[0]||'';
}

if(typeof module==='object'&&module.exports)module.exports={ruCountText,ruTurns,ruPoints,ruAfterTurns};
