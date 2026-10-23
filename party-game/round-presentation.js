'use strict';
// Round presentation and reel animation; shared state remains in app.js.

function roundInteraction(){return modeConfigForGame(game,game.current.modeId).interaction;}
const ROUND_INTERACTIONS=Object.freeze({
 explain:Object.freeze({task:showTask,judge:showJudge}),
 estimate:Object.freeze({task:showApprox,judge:showApprox})
});
function makeButton(label,action,style='button-secondary') {
  return '<button type="button" class="button '+style+'" data-action="'+action+'">'+label+'</button>';
}
// Lucide-like vector UI controls; illustrated mode assets continue to use WebP.
const CONTROL_ICONS=Object.freeze({
  'eye-off':'<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.3A11.6 11.6 0 0 1 12 5c5.1 0 8.8 4 10 7a12 12 0 0 1-3.4 4.5M6.1 6.1A12.1 12.1 0 0 0 2 12c1.2 3 4.9 7 10 7 1.8 0 3.5-.5 4.9-1.3"/>',
  eye:'<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7.5 7.5 0 0 1 19 7l1 5M4 12l1 5a7.5 7.5 0 0 0 13.5-2"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  play:'<path d="m8 5 11 7-11 7V5Z"/>',
  'check-minus':'<path d="m3 12 4 4 7-9M15 16h6"/>',
  check:'<path d="m4 12 5 5L20 6"/>'
});
function iconButton(icon,action,label,variant='muted') {
  if(!CONTROL_ICONS[icon])throw Error('Unknown control icon');
  const classes=variant.split(' ').map(item=>'round-action--'+item).join(' ');
  return '<button type="button" class="round-action '+classes+'" data-action="'+action+
  '" title="'+label+'" aria-label="'+label+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+CONTROL_ICONS[icon]+'</svg></button>';
}
function taskControls(c) {
  if(!c.visible)return '<div class="task-open">'+makeButton('ОТКРЫТЬ ЗАДАНИЕ','toggle-word','button-coral button-big')+'</div>';
  if(!allowPause())return '<div class="task-open-hint">ТАЙМЕР ЗАПУСТИТСЯ АВТОМАТИЧЕСКИ</div>';
  return '<div class="round-controls task-controls">'+
    iconButton('eye-off','toggle-word','Скрыть слово')+
    iconButton('clock','start-timer','Запустить таймер','success')+
    (c.modeId!=='blitz'?iconButton('refresh','replace-word','Другое слово'):'<span class="round-action-placeholder" aria-hidden="true"></span>')+
    '</div>';
}
// The wheel is a window into a repeating ring, not a strip that ends on the prize.
const ROLL_SPIN_MS=2850;
const ROLL_HOLD_MS=450;
function showRolling() {
  $('play-content').className='play-inner is-rolling-screen';
  $('play-step').textContent='ВЫБОР РЕЖИМА';
  const pool=game.modes.length?game.modes:['talk'];
  const target=game.current.modeId;
  const winnerAt=pool.indexOf(target);
  // The selected mode is not the last card: keep visible neighbours on BOTH sides.
  const landingIndex=Math.max(7,pool.length+3);
  const travel=Math.max(28,pool.length*4);
  const startIndex=landingIndex+travel;
  const itemCount=startIndex+Math.max(7,pool.length+3);
  const wrap=index=>(index%pool.length+pool.length)%pool.length;
  rollSequence=Array.from({length:itemCount},(_,i)=>
    pool[wrap(i-landingIndex+winnerAt)]);
  $('play-content').innerHTML=
    '<span class="game-eyebrow">КАКОЙ РЕЖИМ ВЫПАДЕТ?</span>'+
    '<div class="reel-window" id="reel-window" aria-label="Карусель игровых режимов" data-winner="'+target+'">'+
      '<div class="reel-track" id="reel-track">'+
      rollSequence.map((id,i)=>'<div class="reel-item'+(i===landingIndex?' reel-item--winner':'')+
        '" data-mode="'+id+'" data-reel-index="'+i+'">'+
      modeArt(id)+'<span>'+escapeHTML(getMode(id).title)+'</span></div>').join('')+
      '</div></div>'+
    '<p class="play-subtitle">Карусель выбирает случайный режим...</p>';
  const track=$('reel-track'),windowEl=$('reel-window');
  const cards=track?.children;
  if(!track||!windowEl||!cards?.[startIndex]||!cards?.[landingIndex])return;
  const activeRound=game.current;
  const at=index=>windowEl.clientWidth/2-cards[index].offsetLeft-cards[index].offsetWidth/2;
  const start=at(startIndex),finish=at(landingIndex);
  track.style.transition='none';
  track.style.transform='translate3d('+start+'px,0,0)';
  // Two frames guarantee that even a fast Android browser paints the starting
  // position before animating. The strip moves left-to-right, then eases out.
  const markWinner=()=>{
    if(game?.phase==='rolling'&&game.current===activeRound&&activeScene==='game')
      track.querySelector('.reel-item--winner')?.classList.add('reel-item--landed');
  };
  track.addEventListener('transitionend',event=>{
    if(event.propertyName==='transform')markWinner();
  },{once:true});
  const animate=()=>{
    if(game?.phase!=='rolling'||game.current!==activeRound||activeScene!=='game')return;
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    track.style.transition='transform '+(reduce?1:ROLL_SPIN_MS)+'ms cubic-bezier(.08,.72,.12,1)';
    track.style.transform='translate3d('+finish+'px,0,0)';
    if(reduce)markWinner();
  };
  if(typeof requestAnimationFrame==='function')
    requestAnimationFrame(()=>requestAnimationFrame(animate));
  else animate();
}
function modeInformation() {
  const mode=getMode(game.current.modeId);
  const method=getMode(game.current.methodId);
  const secret=mode.id==='secret';
  return {
    mode,method,secret,
    name:secret?'СЕКРЕТКА: '+method.title:mode.title,
    rule:mode.id==='blitz'&&ruleSetForGame(game).version>=4?
      'Отгадайте все '+game.current.blitzWords.length+' слова за один таймер. Очки только за полный результат.':
      method.id==='sing'&&getContentPack(game.contentPack||{id:'general',version:1}).songPromptPolicyVersion===2?
      'Напойте любую песню, в названии или тексте которой есть указанное слово. Формы слова допустимы. Отгадывающий называет тему.':method.rule
  };
}
function taskMarkup(hidden) {
  const {method}=modeInformation();
  const word=displayPrompt(game.current.word);
  const what=method.id==='sing'?'ТЕМА ДЛЯ ПЕСНИ':'ВАШЕ ЗАДАНИЕ';
  const wordLength=game.current.word.length;
  const lengthStyle=wordLength>45?' challenge-word--very-long':wordLength>23?' challenge-word--long':'';
  return '<div class="challenge-card '+(hidden?'is-hidden':'')+'">'+
    '<span class="challenge-overline">'+what+'</span>'+
    '<div class="challenge-word '+(hidden?'challenge-word--hidden':lengthStyle)+'">'+
    (hidden?'НАЖМИ, ЧТОБЫ ОТКРЫТЬ':word)+'</div>'+
    (hidden?'':'<span class="challenge-details">ЗАПОМНИ И НАЧИНАЙ!</span>')+'</div>';
}
function showApprox(){
 const c=game.current,q=c.question,revealed=game.phase==='judge';
 $('play-content').className='play-inner is-approx';
 $('play-step').textContent='ОБЕ КОМАНДЫ НАЗЫВАЮТ ЧИСЛО';
 $('play-content').innerHTML=
  '<div class="approx-heading">'+symbol('approx')+'<h2 class="play-title">ПРИМЕРНО</h2>'+
  '<p class="play-subtitle">'+(revealed?'Решите вместе, кому начислить очки.':'Назовите ответы вслух, затем откройте правильный.')+'</p></div>'+
  '<div class="approx-card'+(revealed?' is-revealed':'')+'">'+
  (revealed?'<div class="approx-answer"><span>ПРАВИЛЬНЫЙ ОТВЕТ</span><strong>'+escapeHTML(q.answer)+' '+escapeHTML(q.unit||'')+'</strong></div>':'')+
  '<div class="approx-copy" tabindex="0" aria-label="Вопрос и пояснение"><p class="approx-question">'+escapeHTML(q.question)+'</p>'+
   (revealed&&q.note?'<p class="approx-note">'+escapeHTML(q.note)+'</p>':'')+'</div></div>'+
  '<div class="approx-actions">'+(revealed?
   makeButton(escapeHTML(game.teams[0])+' +1','award-a','button-primary')+
   makeButton(escapeHTML(game.teams[1])+' +1','award-b','button-coral')+
   makeButton('Обе команды +1','award-both')+makeButton('Никому','award-none'):
   makeButton('Показать ответ','reveal-approx','button-primary button-big'))+'</div>';
}
function blitzStatus() {
  const c=game.current;
  const left=c.blitzQueue?.length ?? Math.max(0,c.blitzWords.length-c.blitzIndex);
  return '<div class="blitz-status"><b>ОСТАЛОСЬ: '+left+'</b>'+
    '<b>ОТГАДАНО: '+c.blitzCorrect+'</b></div>';
}
function allowsModifierResult(){
 return ruleSetForGame(game).splitModifierOutcome===true&&Boolean(game.current?.complication);
}
function resultControls(duringPlay=false){
 const modified=allowsModifierResult();
 const option=(icon,action,label,variant)=>'<div class="judgement-option">'+iconButton(icon,action,label,variant+' prominent')+'<span>'+label+'</span></div>';
 return '<div class="three-answer-actions verdict-actions'+(duringPlay?'':' judgement-grid')+'">'+
  option('x',duringPlay?'wrong-now':'no','НЕ УГАДАЛИ','danger')+
  (modified?option('check-minus',duringPlay?'base-now':'base','БЕЗ УСЛОЖНЕНИЯ','partial'):
   duringPlay?'<div class="verdict-visibility">'+iconButton(game.current.visible?'eye-off':'eye','toggle-word',game.current.visible?'Скрыть слово':'Показать слово')+'</div>':'<span aria-hidden="true"></span>')+
  option('check',duringPlay?'correct-now':'yes',modified?'ВЫПОЛНИЛИ':'УГАДАЛИ','success')+'</div>';
}
