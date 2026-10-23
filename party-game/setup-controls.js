'use strict';
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
