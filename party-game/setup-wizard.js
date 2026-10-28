'use strict';
// TASK030: sole setup presentation. All controls, validation, writes,
// profiles and START remain owned by the existing production controllers.
(function installSetupWizard(){
 if(typeof document.createElement!=='function')return;
 const titles=['Игра','Кто играет?','Правила','Старт'];
 let step=1,themes=false,ruleCenter=false,installed=false;
 const positions=new Map();
 const legacy={setScene,backWithinKvip,renderOptions};
 function viewStamp(){
  // Pack preference history is not read by the settings renderer or validator.
  const {packPreferences,...settings}=options;
  return {key:JSON.stringify([settings,selectedProfileIds,profileStoreProblem]),profiles:profileStore,
   cards:PARTY_CARDS,questions:QUIP_APPROX_QUESTIONS,packs:QUIP_CONTENT_PACKS,config:getModeConfig,validate:checkContentPack,pool:getPackCardPool};
 }
 // app.boot has already rendered/validated the original controls before this
 // adapter loads. Moving them must not discard that work or their live state.
 let renderedStamp=viewStamp();
 const projectionCache=new Map();
 function refreshOptions(){
  const next=viewStamp();
  if(!renderedStamp||Object.keys(next).some(key=>next[key]!==renderedStamp[key])){
   // Cache only read-only results of the real renderer APIs, per exact
   // settings/profile/catalog/function stamp. All native controls still render.
   // The wrappers exist only during this synchronous projection; START and
   // gameplay always receive the original full validators and selectors.
   let cached=projectionCache.get(next.key);
   if(!cached||Object.keys(next).some(key=>next[key]!==cached.stamp[key])){
    cached={stamp:next,pools:new Map(),checks:new Map()};
    if(projectionCache.size>=8)projectionCache.delete(projectionCache.keys().next().value);
    projectionCache.set(next.key,cached);
   }
   const selectPool=getPackCardPool,check=checkContentPack;
   getPackCardPool=function(selection,kind,level,types,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS){
    if(cards!==PARTY_CARDS||registry!==QUIP_CONTENT_PACKS)return selectPool.apply(this,arguments);
    const key=JSON.stringify([selection,kind,level,types]);
    if(!cached.pools.has(key))cached.pools.set(key,selectPool.apply(this,arguments));
    return cached.pools.get(key);
   };
   checkContentPack=function(...args){
    // Nonstandard explicit catalogs are not eligible for this UI snapshot.
    if(args.length>2)return check.apply(this,args);
    const key=JSON.stringify(args);
    if(!cached.checks.has(key))cached.checks.set(key,check.apply(this,args));
    return cached.checks.get(key);
   };
   try{legacy.renderOptions();}finally{getPackCardPool=selectPool;checkContentPack=check;}
   renderedStamp=viewStamp();
  }
  renderMeta();
 }
 const scene=document.createElement('section');
 scene.id='scene-wizard';scene.className='scene setup-wizard';scene.hidden=true;
 scene.setAttribute('aria-labelledby','wizard-title');
 scene.innerHTML='<header class="wizard-header"><button type="button" id="wizard-back">‹ НАЗАД</button><span>КВИП</span></header>'+
  '<nav class="wizard-steps" aria-label="Этапы создания партии">'+titles.map((t,i)=>'<button type="button" data-wizard-step="'+(i+1)+'"><b>'+(i+1)+'</b><span>'+t+'</span></button>').join('')+'</nav>'+
  '<div id="wizard-scroll" class="wizard-scroll"><div class="wizard-page"><p id="wizard-kicker" class="section-kicker"></p><h1 id="wizard-title" tabindex="-1"></h1>'+
  '<section data-wizard-page="1"><div id="wizard-catalog"></div><div id="wizard-themes" hidden><div id="wizard-theme-copy"></div><div id="wizard-theme-list"></div></div><p id="wizard-pack-current"></p></section>'+
  '<section data-wizard-page="2"><div class="wizard-formats" role="group" aria-label="Формат партии"><button id="wizard-format-duel" type="button" aria-pressed="true">1 НА 1</button><button id="wizard-format-teams" type="button" aria-pressed="false" disabled>2 НА 2</button></div><div id="wizard-players"></div><div id="wizard-award"></div></section>'+
  '<section data-wizard-page="3"><div id="wizard-difficulty"></div><div id="wizard-finish"></div><div id="wizard-time"></div><div class="wizard-mode-heading"><button type="button" id="wizard-mode-settings">НАСТРОЙКИ РЕЖИМОВ ↗</button></div><h2>АКТИВНЫЕ РЕЖИМЫ</h2><div id="wizard-modes"></div><details id="wizard-extra"><summary>ДОПОЛНИТЕЛЬНЫЕ ПРАВИЛА</summary><div id="wizard-extra-rules"></div><h3>ЧТО ЗАГАДЫВАТЬ</h3><div id="wizard-content"></div></details></section>'+
  '<section data-wizard-page="4"><p>Проверьте настройки. Кнопка ниже начнёт настоящую партию.</p><dl id="wizard-summary"></dl><div id="wizard-start-notice"></div></section>'+
  '<section id="wizard-rules" hidden><p>Откройте правила нужного режима. Настройки под ними действуют для этой партии.</p><div id="wizard-rule-list"></div><button type="button" id="wizard-rules-done" class="button button-primary">ГОТОВО · ВЕРНУТЬСЯ</button></section>'+
  '</div></div><footer class="wizard-footer"><span id="wizard-footer-caption"></span><button type="button" id="wizard-next" class="button button-primary">ДАЛЕЕ →</button><div id="wizard-start"></div></footer>';
 $('app').append(scene);
 function remember(){if(activeScene==='wizard')positions.set(ruleCenter?'rules':step+':'+themes,{scroll:$('wizard-scroll').scrollTop,focus:document.activeElement?.id});}
 function move(node,target){
  $(target).append(node);
 }
 function attach(){
  if(installed)return;installed=true;
  move(document.querySelector('.game-type-choices'),'wizard-catalog');
  for(const id of ['standard','thematic'])$(id+'-game').insertBefore($(id+'-content-count'),$(id+'-game').querySelector('strong').nextSibling);
  move($('themes-caption'),'wizard-theme-copy');move($('theme-list'),'wizard-theme-list');
  move(document.querySelector('#setup-panel .setup-grid'),'wizard-players');move($('setup-profile-notice'),'wizard-players');
  move(document.querySelector('#setup-panel .award-policy'),'wizard-award');
  move(document.querySelector('.choices[data-setting="difficulty"]').closest('fieldset'),'wizard-difficulty');
  move($('finish-score').closest('fieldset'),'wizard-finish');move($('base-duration').closest('.slider-option'),'wizard-time');
  move($('mode-toggles'),'wizard-modes');move($('content-toggles'),'wizard-content');
  move(document.querySelector('.extra-rules'),'wizard-extra-rules');
  move($('setup-mode-notice'),'wizard-start-notice');move($('start-game'),'wizard-start');
  const tileStates=new Map([...$('mode-toggles').querySelectorAll('input')].map(input=>{
   const label=input.closest('label');return [input.value,{checked:input.checked,disabled:input.disabled,title:label.title,
    art:label.querySelector('img').getAttribute('src'),copy:label.querySelector('b').textContent}];
  }));
  // The same delegated checkbox handler works for every entry in the registry.
  $('mode-toggles').innerHTML=MODE_LIST.map(mode=>'<div class="mode-choice"><section class="wizard-rule" data-wizard-rule="'+mode.id+'"><header><img src="'+MODE_ASSETS[mode.id]+'" alt=""><div><h2>'+escapeHTML(mode.title)+'</h2><p class="wizard-mode-state"></p></div><strong class="wizard-reward"></strong></header><details class="wizard-rule-details"><summary>Правила</summary><p class="wizard-mode-time"></p><div class="wizard-rule-copy"></div></details><div class="wizard-mode-settings"><h3>Настройки режима</h3><label><input type="checkbox" value="'+mode.id+'" aria-label="'+escapeHTML(mode.title)+'"><span class="mode-tile"><img class="mode-tile-art" alt="" draggable="false"><span class="mode-tile-copy"><strong>'+escapeHTML(mode.title)+'</strong><b></b></span></span><span class="wizard-mode-enabled">Включить режим</span></label>'+(mode.id==='sing'?'<div id="wizard-song"></div>':'')+'</div></section></div>').join('');
  for(const input of $('mode-toggles').querySelectorAll('input')){
   const saved=tileStates.get(input.value);if(!saved){renderedStamp=null;continue;}
   input.checked=saved.checked;input.disabled=saved.disabled;const label=input.closest('label');label.title=saved.title;
   if(saved.art)label.querySelector('img').setAttribute('src',saved.art);label.querySelector('b').textContent=saved.copy;
  }
  move($('mode-song-sources'),'wizard-song');
 }
 function modeRules(){
  if(!installed)return;
  $('mode-options-backdrop').dataset.mode='sing';
  const songAvailable=renderModeSettings(true);
  for(const mode of MODE_LIST){
   const row=scene.querySelector('[data-wizard-rule="'+mode.id+'"]'),config=getModeConfig(mode.id),guide=rulesGuidePage(mode.id);
   const input=[...$('mode-toggles').querySelectorAll('input')].find(node=>node.value===mode.id);
   const availability=input?{available:!input.disabled,reason:input.closest('label').title}:
    packModeAvailability(options.contentPack,{...options,...setupSongPolicy(options)},mode.id);
   const missingSource=mode.id==='sing'&&!songAvailable;
   const active=options.modes.includes(mode.id)&&availability.available&&!missingSource;
   row.classList.toggle('wizard-rule--off',!active);
   row.querySelector('.wizard-mode-state').textContent=!availability.available?availability.reason:missingSource?'Нет заданий с выбранными источниками':active?'Активен':'Выключен';
   row.querySelector('.wizard-reward').textContent=guide.reward;
   const timedConfigs=mode.id==='secret'?MODE_LIST.map(m=>getModeConfig(m.id)).filter(m=>m.secretMethod):[config];
   const durations=[...new Set(timedConfigs.map(m=>options.duration+m.durationBonus))].sort((a,b)=>a-b);
   row.querySelector('.wizard-mode-time').textContent=config.usesTimer?'Время: '+durations.join(' или ')+' с'+(mode.id==='secret'?', по выбранному способу':''):'Без таймера';
   row.querySelector('.wizard-rule-copy').innerHTML=guide.blocks.map(([title,copy])=>'<h3>'+escapeHTML(title)+'</h3><p>'+escapeHTML(copy)+'</p>').join('');
  }
  // Source controls and their real eligibility were rendered above.
 }
 function renderMeta(){
  if(!installed)return;
  renderGameTypeCounts();
  let pack;try{pack=getContentPack(options.contentPack);}catch{}
  $('wizard-pack-current').textContent='Выбрано: '+(pack?.name||'Набор недоступен');
  const profiles=selectedPlayerProfiles();
  const rows=[['Игра',pack?.name||'Набор недоступен'],['Игроки',profiles?profiles.map(p=>p.name).join(' · '):'Выберите два разных профиля'],['Очки получает',options.awardTo==='setter'?'Загадывающий':'Отгадывающий'],['Сложность',{easy:'Легко',medium:'Средний',hard:'Сложный',mixed:'Микс'}[options.difficulty]],['Цель',options.finishType==='score'?ruPoints(options.targetScore):ruTurns(options.rounds)],['Базовое время',options.duration+' с'],['Режимы',options.modes.map(id=>getMode(id).title).join(', ')||'Выберите режим'],['Дополнительные правила','Риск '+(options.riskRounds?'вкл.':'выкл.')+' · усложнения '+(options.complications?options.modifierChance+'%':'выкл.')],['Источники «Напой»',sanitizeModeSettings(options.modeSettings).sing.songLanguages.map(id=>id==='ru'?'Русские':'Иностранные').join(' + ')]];
  $('wizard-summary').innerHTML=rows.map(([title,value])=>'<div><dt>'+escapeHTML(title)+'</dt><dd>'+escapeHTML(value)+'</dd></div>').join('');
  $('wizard-footer-caption').textContent=(options.finishType==='score'?ruPoints(options.targetScore):ruTurns(options.rounds))+' · '+ruCountText(options.modes.length,['режим','режима','режимов']);
  if(ruleCenter)modeRules();
  scene.dispatchEvent(new CustomEvent('quip:setup-rendered'));
 }
 function show(next=step,showThemes=false,showRules=false,restore=false){
  const enteringRules=showRules&&!ruleCenter;
  remember();attach();step=next;themes=showThemes;ruleCenter=showRules;
  scene.classList.toggle('wizard-mode-center',showRules);
  move($('mode-toggles'),showRules?'wizard-rule-list':'wizard-modes');
  if(enteringRules)scene.querySelectorAll('.wizard-rule-details').forEach(node=>{node.open=false;});
  legacy.setScene('home');$('scene-home').hidden=true;
  activeScene='wizard';document.body.dataset.screen='setup';document.body.classList.add('wizard-screen');scene.hidden=false;
  refreshOptions();
  $('wizard-kicker').textContent=showRules?'ОБЩИЙ ЦЕНТР':('ШАГ '+step+' ИЗ 4');
  $('wizard-title').textContent=showRules?'Настройки режимов':themes?'Выберите тему':['Во что сыграем?','Кто играет?','Поймайте свой ритм','Всё готово?'][step-1];
  scene.querySelectorAll('[data-wizard-page]').forEach(node=>{node.hidden=showRules||Number(node.dataset.wizardPage)!==step;});
  scene.querySelectorAll('[data-wizard-step]').forEach(node=>{if(Number(node.dataset.wizardStep)===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
  $('wizard-catalog').hidden=themes;$('wizard-themes').hidden=!themes;$('wizard-rules').hidden=!showRules;
  $('wizard-next').hidden=step===4||showRules;$('wizard-start').hidden=step!==4||showRules;
  $('wizard-footer-caption').hidden=showRules;
  const previous=restore&&positions.get(showRules?'rules':step+':'+themes);
  $('wizard-scroll').scrollTop=previous?.scroll||0;
  (previous?.focus&&$(previous.focus)&&!$(previous.focus).closest('[hidden]')?$(previous.focus):$('wizard-title')).focus({preventScroll:true});
 }
 function navigateBack(){
  if(ruleCenter){show(3,false,false,true);return;}
  if(step===1&&themes){show(1,false,false,true);return;}
  if(step>1){show(step-1,false,false,true);return;}
  setScene('home');$('new-game-menu').focus({preventScroll:true});
 }
 function syncURL(){
  const url=new URL(location.href);
  if(!url.searchParams.has('setup'))return;
  url.searchParams.delete('setup');
  history.replaceState(history.state,'',url);
 }
 setScene=function(which){
  if(['game-type','themes','setup','advanced'].includes(which)){
   show(which==='setup'?2:which==='advanced'?3:1,which==='themes');return;
  }
  remember();scene.hidden=true;document.body.classList.remove('wizard-screen');legacy.setScene(which);
 };
 renderOptions=function(){
  refreshOptions();
  // A rejected checkbox action leaves options unchanged, so the render stamp
  // correctly stays cached. Restore its live UI projection without revalidating
  // catalogs (last-mode and unavailable-mode guards belong to the controller).
  for(const input of $('mode-toggles').querySelectorAll('input'))
   input.checked=options.modes.includes(input.value);
 };
 backWithinKvip=function(){
  const modal=['result-history-backdrop','backup-backdrop','report-backdrop','profile-backdrop','mode-options-backdrop','rules-backdrop'].some(id=>!$(id).hidden);
  if(activeScene==='wizard'&&!modal){navigateBack();return;}
  legacy.backWithinKvip();
 };
 // Press feedback is presentation-only; native radio click/change owns selection.
 let pressedFinish=null;
 function releaseFinish(){pressedFinish?.classList.remove('is-pressed');pressedFinish=null;}
 $('wizard-finish').addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0)return;
  const label=event.target.closest('.finish-choices label');
  if(label){releaseFinish();pressedFinish=label;label.classList.add('is-pressed');}
 });
 document.addEventListener('pointerup',releaseFinish,true);
 document.addEventListener('pointercancel',releaseFinish,true);
 window.addEventListener('blur',releaseFinish);
 $('wizard-back').addEventListener('click',navigateBack);
 scene.querySelector('.wizard-steps').addEventListener('click',event=>{const button=event.target.closest('[data-wizard-step]');if(button)show(Number(button.dataset.wizardStep));});
 $('wizard-next').addEventListener('click',()=>show(Math.min(4,step+1)));
 $('wizard-mode-settings').addEventListener('click',()=>show(3,false,true));
 $('wizard-rules-done').addEventListener('click',()=>show(3,false,false,true));
 // The existing handlers own modal Escape; this listener only handles the page.
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&activeScene==='wizard'&&!event.defaultPrevented){event.preventDefault();navigateBack();}
 });
 // The Back guard can revisit a bookmarked URL. Remove obsolete UI parameters
 // without changing its history state or introducing another setup route.
 window.addEventListener('popstate',syncURL);
 syncURL();
 // Prepare installed catalog counts during boot, before the first trusted tap.
 renderGameTypeCounts();
 renderMeta();
})();
