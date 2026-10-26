'use strict';
// TASK027: reversible presentation adapter. All controls, validation, writes,
// profiles and START remain owned by the existing production controllers.
(function installSetupWizard(){
 if(typeof document.createElement!=='function')return;
 const titles=['Игра','Кто играет?','Правила','Старт'];
 let enabled=new URLSearchParams(location.search).get('setup')==='wizard';
 let step=1,themes=false,ruleCenter=false,installed=false;
 const slots=[],positions=new Map();
 let originalModeChildren;
 const legacy={setScene,backWithinKvip,renderOptions};
 const scene=document.createElement('section');
 scene.id='scene-wizard';scene.className='scene setup-wizard';scene.hidden=true;
 scene.setAttribute('aria-labelledby','wizard-title');
 scene.innerHTML='<header class="wizard-header"><button type="button" id="wizard-back">‹ НАЗАД</button><span>КВИП</span><button type="button" id="wizard-legacy">ПРЕЖНИЙ ВИД</button></header>'+
  '<nav class="wizard-steps" aria-label="Этапы создания партии">'+titles.map((t,i)=>'<button type="button" data-wizard-step="'+(i+1)+'"><b>'+(i+1)+'</b><span>'+t+'</span></button>').join('')+'</nav>'+
  '<div id="wizard-scroll" class="wizard-scroll"><div class="wizard-page"><p id="wizard-kicker" class="section-kicker"></p><h1 id="wizard-title" tabindex="-1"></h1>'+
  '<section data-wizard-page="1"><div id="wizard-catalog"></div><div id="wizard-themes" hidden><div id="wizard-theme-copy"></div><div id="wizard-theme-list"></div></div><p id="wizard-pack-current"></p></section>'+
  '<section data-wizard-page="2"><div class="wizard-formats" role="group" aria-label="Формат партии"><button type="button" aria-pressed="true">1 НА 1</button><button type="button" disabled>КОМАНДАМИ · СКОРО</button></div><div id="wizard-players"></div><div id="wizard-award"></div></section>'+
  '<section data-wizard-page="3"><div id="wizard-difficulty"></div><div id="wizard-finish"></div><div id="wizard-time"></div><div class="wizard-mode-heading"><button type="button" id="wizard-mode-settings">НАСТРОЙКИ РЕЖИМОВ ↗</button></div><h2>АКТИВНЫЕ РЕЖИМЫ</h2><div id="wizard-modes"></div><details id="wizard-extra"><summary>ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА</summary><div id="wizard-extra-rules"></div><h3>ЧТО ЗАГАДЫВАТЬ</h3><div id="wizard-content"></div></details></section>'+
  '<section data-wizard-page="4"><p>Проверьте настройки. Кнопка ниже начнёт настоящую партию.</p><dl id="wizard-summary"></dl><div id="wizard-start-notice"></div></section>'+
  '<section id="wizard-rules" hidden><p>Действующие правила. Очки и время — справочные сведения. Источники «Напой» можно изменить.</p><div id="wizard-rule-list"></div><button type="button" id="wizard-rules-done" class="button button-primary">ГОТОВО · ВЕРНУТЬСЯ</button></section>'+
  '</div></div><footer class="wizard-footer"><span id="wizard-footer-caption"></span><button type="button" id="wizard-next" class="button button-primary">ДАЛЕЕ →</button><div id="wizard-start"></div></footer>';
 $('app').append(scene);
 const preference=document.createElement('button');
 preference.id='setup-interface-toggle';preference.type='button';preference.className='preferences-rules';
 $('preferences-rules').before(preference);
 function remember(){if(activeScene==='wizard')positions.set(ruleCenter?'rules':step+':'+themes,{scroll:$('wizard-scroll').scrollTop,focus:document.activeElement?.id});}
 function move(node,target){
  const marker=document.createComment('TASK027 control return slot');node.before(marker);slots.push({node,marker});$(target).append(node);
 }
 function attach(){
  if(installed)return;installed=true;
  move(document.querySelector('.game-type-choices'),'wizard-catalog');
  move($('themes-caption'),'wizard-theme-copy');move($('theme-list'),'wizard-theme-list');
  move(document.querySelector('#setup-panel .setup-grid'),'wizard-players');move($('setup-profile-notice'),'wizard-players');
  move(document.querySelector('#setup-panel .award-policy'),'wizard-award');
  move(document.querySelector('.choices[data-setting="difficulty"]').closest('fieldset'),'wizard-difficulty');
  move($('finish-score').closest('fieldset'),'wizard-finish');move($('base-duration').closest('.slider-option'),'wizard-time');
  move($('mode-toggles'),'wizard-modes');move($('content-toggles'),'wizard-content');
  move(document.querySelector('.extra-rules'),'wizard-extra-rules');
  move($('setup-mode-notice'),'wizard-start-notice');move($('start-game'),'wizard-start');
  originalModeChildren=document.createDocumentFragment();
  while($('mode-toggles').firstChild)originalModeChildren.append($('mode-toggles').firstChild);
  // The same delegated checkbox handler works for every entry in the registry.
  $('mode-toggles').innerHTML=MODE_LIST.map(mode=>'<div class="mode-choice"><label><input type="checkbox" value="'+mode.id+'" aria-label="'+escapeHTML(mode.title)+'"><span class="mode-tile"><img class="mode-tile-art" alt="" draggable="false"><span class="mode-tile-copy"><strong>'+escapeHTML(mode.title)+'</strong><b></b></span></span></label></div>').join('');
  $('wizard-rule-list').innerHTML=MODE_LIST.map(mode=>'<section class="wizard-rule" data-wizard-rule="'+mode.id+'"><header><img src="'+MODE_ASSETS[mode.id]+'" alt=""><div><h2>'+escapeHTML(mode.title)+'</h2><p class="wizard-mode-state"></p></div><strong class="wizard-reward"></strong></header><p class="wizard-mode-time"></p><div class="wizard-rule-copy"></div>'+(mode.id==='sing'?'<div id="wizard-song"></div>':'')+'</section>').join('');
  move($('mode-song-sources'),'wizard-song');
 }
 function detach(){
  if(!installed)return;
  $('mode-toggles').replaceChildren(originalModeChildren);
  for(const {node,marker} of slots.reverse()){marker.replaceWith(node);}slots.length=0;
  $('wizard-rule-list').replaceChildren();installed=false;
 }
 function modeRules(){
  if(!installed)return;
  for(const mode of MODE_LIST){
   const row=scene.querySelector('[data-wizard-rule="'+mode.id+'"]'),config=getModeConfig(mode.id),guide=rulesGuidePage(mode.id);
   const availability=packModeAvailability(options.contentPack,{...options,...setupSongPolicy(options)},mode.id);
   const active=options.modes.includes(mode.id)&&availability.available;
   row.classList.toggle('wizard-rule--off',!active);
   row.querySelector('.wizard-mode-state').textContent=active?'Активен':availability.available?'Выключен':availability.reason;
   row.querySelector('.wizard-reward').textContent=guide.reward;
   const timedConfigs=mode.id==='secret'?MODE_LIST.map(m=>getModeConfig(m.id)).filter(m=>m.secretMethod):[config];
   const durations=[...new Set(timedConfigs.map(m=>options.duration+m.durationBonus))].sort((a,b)=>a-b);
   row.querySelector('.wizard-mode-time').textContent=config.usesTimer?'Время: '+durations.join(' или ')+' с'+(mode.id==='secret'?', по выбранному способу':''):'Без таймера';
   row.querySelector('.wizard-rule-copy').innerHTML=guide.blocks.filter(([title])=>title!=='Время').map(([title,copy])=>'<h3>'+escapeHTML(title)+'</h3><p>'+escapeHTML(copy)+'</p>').join('');
  }
  $('mode-options-backdrop').dataset.mode='sing';renderModeSettings();
 }
 function renderMeta(){
  preference.textContent=enabled?'Новая игра: Мастер · вернуть прежний вид':'Новая игра: попробовать Мастер';
  preference.setAttribute('aria-pressed',String(enabled));
  if(!installed)return;
  let pack;try{pack=getContentPack(options.contentPack);}catch{}
  $('wizard-pack-current').textContent='Выбрано: '+(pack?.name||'Набор недоступен');
  const profiles=selectedPlayerProfiles();
  const rows=[['Игра',pack?.name||'Набор недоступен'],['Игроки',profiles?profiles.map(p=>p.name).join(' · '):'Выберите два разных профиля'],['Очки получает',options.awardTo==='setter'?'Загадывающий':'Отгадывающий'],['Сложность',{easy:'Легко',medium:'Средний',hard:'Сложный',mixed:'Микс'}[options.difficulty]],['Цель',options.finishType==='score'?options.targetScore+' очков':options.rounds+' ходов'],['Базовое время',options.duration+' с'],['Режимы',options.modes.map(id=>getMode(id).title).join(', ')||'Выберите режим'],['Дополнительные правила','Риск '+(options.riskRounds?'вкл.':'выкл.')+' · усложнения '+(options.complications?options.modifierChance+'%':'выкл.')],['Источники «Напой»',sanitizeModeSettings(options.modeSettings).sing.songLanguages.map(id=>id==='ru'?'Русские':'Иностранные').join(' + ')]];
  $('wizard-summary').innerHTML=rows.map(([title,value])=>'<div><dt>'+escapeHTML(title)+'</dt><dd>'+escapeHTML(value)+'</dd></div>').join('');
  $('wizard-footer-caption').textContent=(options.finishType==='score'?options.targetScore+' очков':options.rounds+' ходов')+' · '+options.modes.length+' режимов';
  if(ruleCenter)modeRules();
 }
 function show(next=step,showThemes=false,showRules=false,restore=false){
  remember();attach();step=next;themes=showThemes;ruleCenter=showRules;
  legacy.setScene('home');$('scene-home').hidden=true;
  activeScene='wizard';document.body.dataset.screen='setup';document.body.classList.add('wizard-screen');scene.hidden=false;
  legacy.renderOptions();renderMeta();
  $('wizard-kicker').textContent=showRules?'ОБЩИЙ ЦЕНТР':('ШАГ '+step+' ИЗ 4');
  $('wizard-title').textContent=showRules?'Правила режимов':themes?'Выберите тему':['Во что сыграем?','Кто играет?','Поймайте свой ритм','Всё готово?'][step-1];
  scene.querySelectorAll('[data-wizard-page]').forEach(node=>{node.hidden=showRules||Number(node.dataset.wizardPage)!==step;});
  scene.querySelectorAll('[data-wizard-step]').forEach(node=>{if(Number(node.dataset.wizardStep)===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
  $('wizard-catalog').hidden=themes;$('wizard-themes').hidden=!themes;$('wizard-rules').hidden=!showRules;
  $('wizard-next').hidden=step===4||showRules;$('wizard-start').hidden=step!==4||showRules;
  $('wizard-footer-caption').hidden=showRules;
  const previous=restore&&positions.get(showRules?'rules':step+':'+themes);
  $('wizard-scroll').scrollTop=previous?.scroll||0;
  if(showRules)modeRules();
  (previous?.focus&&$(previous.focus)&&!$(previous.focus).closest('[hidden]')?$(previous.focus):$('wizard-title')).focus({preventScroll:true});
 }
 function navigateBack(){
  if(ruleCenter){show(3,false,false,true);return;}
  if(step===1&&themes){show(1,false,false,true);return;}
  if(step>1){show(step-1,false,false,true);return;}
  setScene('home');$('new-game-menu').focus({preventScroll:true});
 }
 function syncURL(){
  const url=new URL(location.href);url.searchParams.set('setup',enabled?'wizard':'legacy');
  history.replaceState(history.state,'',url);
 }
 function setEnabled(value){
  const wasWizard=activeScene==='wizard',previousStep=step,previousThemes=themes;
  enabled=value;
  syncURL();
  if(!value){detach();scene.hidden=true;document.body.classList.remove('wizard-screen');}
  renderOptions();
  if(wasWizard){
   if(value)show(previousStep,previousThemes);
   else if(previousStep===1){if(previousThemes)openThemes();else openGameType();}
   else if(previousStep===3)openAdvanced();else openSetup(setupReturn);
  }
 }
 setScene=function(which){
  if(enabled&&['game-type','themes','setup','advanced'].includes(which)){
   show(which==='setup'?2:which==='advanced'?3:1,which==='themes');return;
  }
  remember();scene.hidden=true;document.body.classList.remove('wizard-screen');legacy.setScene(which);
 };
 renderOptions=function(){legacy.renderOptions();renderMeta();};
 backWithinKvip=function(){
  const modal=['result-history-backdrop','backup-backdrop','report-backdrop','profile-backdrop','mode-options-backdrop','rules-backdrop'].some(id=>!$(id).hidden);
  if(activeScene==='wizard'&&!modal){navigateBack();return;}
  legacy.backWithinKvip();
 };
 $('wizard-back').addEventListener('click',navigateBack);
 $('wizard-legacy').addEventListener('click',()=>setEnabled(false));
 preference.addEventListener('click',()=>setEnabled(!enabled));
 scene.querySelector('.wizard-steps').addEventListener('click',event=>{const button=event.target.closest('[data-wizard-step]');if(button)show(Number(button.dataset.wizardStep));});
 $('wizard-next').addEventListener('click',()=>show(Math.min(4,step+1)));
 $('wizard-mode-settings').addEventListener('click',()=>show(3,false,true));
 $('wizard-rules-done').addEventListener('click',()=>show(3,false,false,true));
 // The existing handlers own modal Escape; this listener only handles the page.
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&activeScene==='wizard'&&!event.defaultPrevented){event.preventDefault();navigateBack();}
 });
 // The old Back guard can revisit an earlier URL. Preserve the selected UI
 // parameter after it handles the page transition, without adding history entries.
 window.addEventListener('popstate',syncURL);
 renderMeta();
})();
