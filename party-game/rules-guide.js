'use strict';
// Standalone rules-guide UI; relies on shared DOM helpers and immutable rules registries.
// Presentation only: always describe new-party rules, never the active save.
const RULES_GUIDE_ORDER=Object.freeze(['general','talk','mime','draw','sing','yesno','secret','blitz','approx']);
let rulesPageIndex=0;
let rulesReturnFocus=null;
let rulesGesture=null;
function rulesGuidePage(id) {
  const rules=QUIP_RULESETS[QUIP_RULE_VERSION];
  const config=modeId=>getModeConfig(modeId,rules.modeConfigVersion);
  const bonus=config('talk').modifierBonus;
  if(id==='general')return {id,title:'ОБЩИЕ ПРАВИЛА',reward:'Два соперника · один телефон',blocks:[
    ['Ход за ходом','Соревнуются две команды или два игрока. Первый загадывающий выбирается случайно, затем роли меняются. Режим случайный — из включённых.'],
    ['Кому очки','В настройках выберите получателя: загадывающий (по умолчанию) или отгадывающий. В «Примерно» отвечают обе команды, очки присуждаются вручную.'],
    ['Как победить','При игре до цели у соперника есть ответный ход. После полной пары при равенстве игра продолжается. При игре по числу ходов возможна ничья.'],
    ['Бонус и риск','Успешное усложнение добавляет +'+bonus+'. В риск-раунде неудача отнимает до '+rules.risk.loss+' очков, но счёт не падает ниже '+rules.risk.minScore+'. Эти опции можно отключить; в «Секретке» усложнение обязательно.'],
    ['Сложность и таймер','Лёгкая: ручной старт, пауза и замена слова там, где она разрешена. Средняя и сложная: автоматический старт через секунду, без паузы и замены. В «Примерно» таймера нет.'],
    ['Микс','Одна и та же сложность у обоих игроков в каждой паре ходов.']
  ]};
  const mode=config(id),base=rules.rewards[id].easy;
  const required=mode.blitzWordsCount;
  const task=id==='blitz'?'Объясняйте слова по очереди, не называя ответ и однокоренные слова. Нужно отгадать все '+required+' за один таймер.':mode.rule;
  const blocks=[['Задача',task]];
  if(id==='secret')blocks.push(['Случайный способ','Один из включённых основных способов: слова, жесты, рисунок, песня или вопросы. Если включена только «Секретка», доступен любой из пяти способов. Следуйте правилу выбранного способа и обязательному усложнению.']);
  if(required)blocks.push(['Только полный результат',required+'/'+required+' → +'+base+'. Неполный результат → 0. Пропуск возвращает слово в конец очереди; каждое угаданное слово учитывается один раз. Всегда короткие лёгкие слова.']);
  if(mode.supportsSharedAward)blocks.push(['Кому присудить очки','После устных ответов нажмите «Показать ответ». Выберите вручную: первая команда +'+base+', вторая +'+base+', обе +'+base+' или никому. Игра не сравнивает числа автоматически.']);
  if(mode.usesTimer){
    // The existing settings input owns the available base-time range.
    const range=$('base-duration'),min=Number(range.min),max=Number(range.max);
    const extra=id==='secret'?[...new Set(Object.values(QUIP_MODES_V4).filter(m=>m.secretMethod).map(m=>m.durationBonus))].sort((a,b)=>a-b):[mode.durationBonus];
    blocks.push(['Время','Базовое время: '+min+'–'+max+' с.'+(id==='secret'?' По выбранному способу: +'+extra.join(' или +')+' с.':extra[0]?' Ещё +'+extra[0]+' с на ход.':' Без добавочного времени.')]);
  }else blocks.push(['Без отсчёта','Время не ограничено. Таймера нет.']);
  if(mode.usesModifiers)blocks.push(['Усложнение',id==='secret'? '+'+base+' базовых и обязательный +'+mode.modifierBonus+' за успех. Итого +'+(base+mode.modifierBonus)+'. Если основное задание угадано, а усложнение нарушено — только +'+base+'.':'Если выпало усложнение, успех добавит +'+mode.modifierBonus+' к базовой награде. Если условие нарушено, но ответ угадан — только базовые очки. Оно не обязательно.']);
  if(mode.allowsRisk)blocks.push(['Риск','Если выпал риск-раунд, за неудачу можно потерять до '+rules.risk.loss+' очков, без ухода ниже '+rules.risk.minScore+'.']);
  else blocks.push(['Без дополнительных условий','Риска и усложнений нет.']);
  return {id,title:mode.title,reward:id==='secret'?'+'+base+' + '+mode.modifierBonus+' = +'+(base+mode.modifierBonus)+' за успех':'+'+base+' за успех',blocks};
}
function renderRulesPage(direction=0) {
  const page=rulesGuidePage(RULES_GUIDE_ORDER[rulesPageIndex]);
  const card=$('rules-card');
  card.dataset.page=page.id;
  card.innerHTML='<div class="rules-card-heading">'+(page.id==='general'?'<span class="rules-general-mark" aria-hidden="true">КВИП</span>':'<img class="rules-art" src="'+MODE_ASSETS[page.id]+'" alt="" draggable="false" decoding="sync">')+
    '<div class="rules-card-title"><h3 id="rules-card-title">'+escapeHTML(page.title)+'</h3><p class="rules-reward">'+escapeHTML(page.reward)+'</p></div></div>'+
    '<div class="rules-copy" tabindex="0" role="region" aria-label="Описание правил">'+page.blocks.map(([title,body])=>'<section><h4>'+escapeHTML(title)+'</h4><p>'+escapeHTML(body)+'</p></section>').join('')+'</div>';
  $('rules-page-status').textContent=(rulesPageIndex+1)+' / '+RULES_GUIDE_ORDER.length;
  $('rules-page-status').setAttribute('aria-label','Карточка '+(rulesPageIndex+1)+' из '+RULES_GUIDE_ORDER.length+': '+page.title);
  $('rules-prev').disabled=rulesPageIndex===0;
  $('rules-next').disabled=rulesPageIndex===RULES_GUIDE_ORDER.length-1;
  if(direction&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    card.animate([{opacity:.5,transform:'translateX('+(direction*10)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:160,easing:'ease-out'});
}
function moveRulesPage(direction){
  const next=Math.max(0,Math.min(RULES_GUIDE_ORDER.length-1,rulesPageIndex+direction));
  if(next===rulesPageIndex)return;
  const focused=document.activeElement;
  const focusWasInCard=$('rules-card').contains(focused);
  rulesPageIndex=next;renderRulesPage(direction);
  // Replacing content must not leave keyboard focus on the inert background.
  if(focusWasInCard)$('rules-card').querySelector('.rules-copy').focus({preventScroll:true});
  else if(focused?.disabled&&['rules-prev','rules-next'].includes(focused.id))$(focused.id==='rules-next'?'rules-prev':'rules-next').focus({preventScroll:true});
}
function closeRules() {
  if($('rules-backdrop').hidden)return;
  $('rules-backdrop').hidden=true;rulesGesture=null;
  document.querySelector('.site-shell').inert=false;
  document.body.classList.remove('rules-open');
  rulesReturnFocus?.focus({preventScroll:true});rulesReturnFocus=null;
}
function openRules() {
  if(!$('rules-backdrop').hidden)return;
  rulesReturnFocus=document.activeElement;rulesPageIndex=0;rulesGesture=null;
  renderRulesPage();$('rules-backdrop').hidden=false;
  document.querySelector('.site-shell').inert=true;
  document.body.classList.add('rules-open');$('close-rules').focus({preventScroll:true});
}
function rulesKeydown(event){
  if($('rules-backdrop').hidden)return;
  if(event.key==='Escape'){event.preventDefault();closeRules();return;}
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();moveRulesPage(event.key==='ArrowRight'?1:-1);return;
  }
  if(event.key==='Tab'){
    const items=[...$('rules-backdrop').querySelectorAll('button:not(:disabled), [tabindex="0"]')];
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
}
function setupRulesGuide(){
  $('rules-prev').addEventListener('click',()=>moveRulesPage(-1));
  $('rules-next').addEventListener('click',()=>moveRulesPage(1));
  const card=$('rules-card');
  card.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||!['touch','pen'].includes(event.pointerType))return;
    rulesGesture={id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp};
  });
  card.addEventListener('pointermove',event=>{
    if(rulesGesture?.id!==event.pointerId)return;
    const dx=Math.abs(event.clientX-rulesGesture.x),dy=Math.abs(event.clientY-rulesGesture.y);
    if(dy>16&&dy>dx)rulesGesture=null;
  });
  card.addEventListener('pointerup',event=>{
    const start=rulesGesture;rulesGesture=null;
    if(!start||start.id!==event.pointerId)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.5&&event.timeStamp-start.time<1000)moveRulesPage(dx<0?1:-1);
  });
  card.addEventListener('pointercancel',()=>{rulesGesture=null;});
}
