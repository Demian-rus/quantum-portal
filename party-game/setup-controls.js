'use strict';
// Menu preferences are copied into the existing versioned song policy at START.
function sanitizeModeSettings(raw){
  const requested=raw?.sing?.songLanguages;
  const languages=Array.isArray(requested)?['ru','en'].filter(language=>requested.includes(language)):[];
  return {sing:{songLanguages:languages.length?languages:['ru']}};
}
function setupSongPolicy(settings){
  return settings.modes.includes('sing')?{songLanguagePolicyVersion:QUIP_SONG_LANGUAGE_POLICY_VERSION,
    songLanguages:sanitizeModeSettings(settings.modeSettings).sing.songLanguages}:{};
}
function selectSongLanguage(language){
  if(!['ru','en'].includes(language))return false;
  const settings=sanitizeModeSettings(options.modeSettings),languages=settings.sing.songLanguages;
  if(languages.includes(language)&&languages.length===1){
    $('mode-source-status').textContent='Оставьте хотя бы один источник слов.';return false;
  }
  settings.sing.songLanguages=['ru','en'].filter(value=>value===language?!languages.includes(value):languages.includes(value));
  options.modeSettings=settings;$('mode-source-status').textContent='';return true;
}
let modeSettingsReturnFocus=null;
function openModeSettings(id){
  if(!DEFAULT_MODES.includes(id)||activeScene!=='advanced')return;
  modeSettingsReturnFocus=document.activeElement;
  $('mode-options-backdrop').dataset.mode=id;
  $('mode-source-status').textContent='';renderModeSettings();
  $('mode-options-backdrop').hidden=false;
  $('mode-options-dialog').scrollTop=0;
  document.querySelector('.site-shell').inert=true;
  $('close-mode-options').focus({preventScroll:true});
}
function closeModeSettings(){
  if($('mode-options-backdrop').hidden)return;
  $('mode-options-backdrop').hidden=true;
  document.querySelector('.site-shell').inert=false;
  modeSettingsReturnFocus?.focus({preventScroll:true});modeSettingsReturnFocus=null;
}
function modeSettingsKeydown(event){
  if($('mode-options-backdrop').hidden)return;
  if(event.key==='Escape'){event.preventDefault();closeModeSettings();return;}
  if(event.key==='Tab'){
    const items=[...$('mode-options-backdrop').querySelectorAll('button:not([hidden])')].filter(button=>!button.closest('[hidden]'));
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
}
// Setup selection guards and existing UI event handlers, extracted without changing their bodies.
function selectAwardTo(value){
  if(!['setter','guesser'].includes(value)||value===options.awardTo)return;
  options.awardTo=value;
  const before=options.modes.length;
  options.modes=compatibleAwardModes({...options,modeCompatibilityVersion:QUIP_MODE_COMPATIBILITY_VERSION});
  if(options.modes.length!==before)toast(options.modes.length?'Несовместимые режимы отключены.':'Выберите подходящий режим в тонкой настройке.');
}
function selectSetupMode(id,enabled){
  if(!DEFAULT_MODES.includes(id))return false;
  if(enabled){const status=packModeAvailability(options.contentPack,{...options,modeCompatibilityVersion:QUIP_MODE_COMPATIBILITY_VERSION},id);if(!status.available){toast(status.reason);return false;}}
  const modes=enabled?[...new Set([...options.modes,id])]:options.modes.filter(mode=>mode!==id);
  if(!modes.length){toast('Нужен хотя бы один режим');return false;}
  options.modes=DEFAULT_MODES.filter(mode=>modes.includes(mode));return true;
}
function registerSetupControls() {
  $('mode-options-backdrop').hidden=true;
  $('mode-toggles').addEventListener('click',event=>{
    const button=event.target.closest('[data-mode-settings]');
    if(button)openModeSettings(button.dataset.modeSettings);
  });
  $('mode-song-sources').addEventListener('click',event=>{
    const button=event.target.closest('[data-song-language]');
    if(!button)return;
    if(selectSongLanguage(button.dataset.songLanguage)){persist();sfx('button');renderOptions();}
    renderModeSettings();
  });
  $('close-mode-options').addEventListener('click',closeModeSettings);
  $('mode-options-done').addEventListener('click',closeModeSettings);
  $('mode-options-backdrop').addEventListener('click',event=>{if(event.target.id==='mode-options-backdrop')closeModeSettings();});
  document.addEventListener('keydown',modeSettingsKeydown);
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
  const modifierPolicy=QUIP_MODIFIER_SELECTION_POLICIES[QUIP_MODIFIER_SELECTION_VERSION];
  for(const [id,key,min,max,step] of [
    ['modifier-chance','modifierChance',modifierPolicy.minChance,modifierPolicy.maxChance,modifierPolicy.step],
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
      if(key==='modes'){
        const changed=selectSetupMode(event.target.value,event.target.checked);
        renderOptions();if(changed)persist();return;
      }
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
    options.complications=event.target.checked;persist();renderOptions();
  });
}
