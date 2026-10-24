'use strict';
function renderModeSettings(){
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
  let available=false;
  try{available=checkContentPack(options.contentPack,{...settings,...setupSongPolicy(settings)}).available;}catch{}
  $('mode-source-availability').hidden=available;
  $('mode-source-availability').textContent=available?'':'Для этих источников на выбранной сложности нет доступных заданий. Измените источники, сложность или набор перед началом партии.';
}
// DOM-only rendering of new-game and advanced settings; original behavior preserved.
function renderOptions() {
  let setupPack=null;
  try{setupPack=getContentPack(options.contentPack);$('setup-pack-caption').textContent=setupPack.name;}
  catch{$('setup-pack-caption').textContent='Набор недоступен';}
  for(const setting of ['difficulty','duration','rounds','targetScore','awardTo']) {
    document.querySelectorAll('.choices[data-setting="'+setting+'"] button').forEach(button=>{
      const selected=String(options[setting])===button.dataset.value;
      button.classList.toggle('is-chosen',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  const numbers={'base-duration':options.duration,'target-score':options.targetScore,'custom-rounds':options.rounds,'modifier-chance':options.modifierChance};
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
    const status=setupPack?packModeAvailability(options.contentPack,{...options,...setupSongPolicy(options)},input.value):{available:false,reason:'Набор недоступен'};
    input.disabled=!status.available;tile.title=status.reason;
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
  $('start-game').disabled=problems.length>0;
  $('setup-mode-notice').hidden=!problems.length;
  $('setup-mode-notice').textContent=problems[0]?.startsWith('sing/')?'Для «Напой» нет заданий с выбранными источниками на этой сложности. Измените источники или сложность в тонкой настройке.':problems[0]||'';
}
