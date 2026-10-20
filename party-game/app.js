'use strict';
const STORAGE_KEY = 'iskra-party:v1';
const MODE_LIST = Object.freeze([
  {id:'talk',title:'СЛОВА',rule:'Объясняй словами, не называя ответ и однокоренные слова.',kind:'words',points:1},
  {id:'mime',title:'ЖЕСТЫ',rule:'Только жесты и мимика. Нельзя говорить или издавать звуки.',kind:'words',points:2},
  {id:'draw',title:'НАРИСУЙ',rule:'Рисуй на бумаге, не используя буквы, цифры и жесты.',kind:'words',points:2},
  {id:'sing',title:'НАПОЙ',rule:'Напой песню, связанную с темой. Команда угадывает саму тему.',kind:'songs',points:2},
  {id:'yesno',title:'ДАНЕТКИ',rule:'Соперники задают вопросы. Отвечай только «да», «нет» или «не знаю». Нужно угадать личность или персонажа.',kind:'people',points:2},
  {id:'secret',title:'СЕКРЕТКА',rule:'Случайное задание с обязательным усложнением. Принесёт 3 очка.',kind:'words',points:3},
  {id:'blitz',title:'БЛИЦ',rule:'За 30 секунд отгадай несколько слов подряд. Каждое угаданное слово — 1 очко.',kind:'words',seconds:30}
]);
const COMPLICATIONS = Object.freeze({
  talk: [
    'Объясняй шёпотом.','Говори как ведущий новостей.','Нельзя использовать прилагательные.',
    'Нельзя произносить «это» и «вот».','Каждую подсказку начни со слова «Представь».',
    'Объясняй как злодей из фильма.','Произноси только короткие предложения.',
    'Говори как спортивный комментатор.','Нельзя использовать слово «очень».',
    'Говори как экскурсовод.','Объясняй исключительно вопросами.','Говори медленно и торжественно.'
  ],
  mime: [
    'Одна рука за спиной.','Показывай только сидя.','Двигайся как в замедленной съёмке.',
    'Показывай как робот.','Нельзя использовать мимику.','Можно двигать только верхней частью тела.',
    'Играй крайне преувеличенно.','Каждые пять секунд замирай.','Показывай только одной рукой.',
    'Нельзя вставать с места.'
  ],
  draw: [
    'Рисуй неведущей рукой.','Не отрывай ручку от бумаги.','Максимум пять линий.',
    'Используй только круги и прямые линии.','Нельзя пользоваться ластиком.',
    'Начни рисовать с закрытыми глазами.','Разрешены только геометрические фигуры.',
    'Рисуй одной непрерывной линией.','Делай рисунок максимально маленьким.',
    'Нельзя рисовать лица.'
  ],
  sing: [
    'Пой как оперный певец.','Пой как колыбельную.','Напевай без слов.',
    'Пой максимально тихо.','Пой как рок-звезда.','Пой будто выступаешь на стадионе.',
    'Пой как робот.','Напевай только на слог «ла».','Пой как грустную балладу.',
    'Пой очень быстро.'
  ],
  yesno: [
    'Не больше десяти вопросов.','Не больше восьми вопросов.',
    'Нельзя спрашивать о профессии.','Нельзя спрашивать о стране происхождения.',
    'Нельзя спрашивать о поле персонажа.','Отвечающий может дать лишь одно уточнение.',
    'Нельзя спрашивать о возрасте.','Не называй категорию персонажа перед стартом.'
  ],
  blitz: [
    'Нельзя использовать слово «это».','Объясняй максимально короткими фразами.',
    'Разрешены только существительные.','Объясняй как диктор новостей.',
    'Без прилагательных.','Нельзя повторять подсказки.'
  ]
});
// A modifier's severity follows the difficulty of the current round.
const EASY_COMPLICATIONS = Object.freeze({
 talk:['Говори шёпотом.','Говори как ведущий новостей.','Улыбайся во время объяснения.','Объясняй как экскурсовод.','Говори как сказочник.','Объясняй очень торжественно.'],
 mime:['Показывай как робот.','Показывай очень медленно.','Показывай словно на большой сцене.','Добавь забавную эмоцию.','Показывай как сонный человек.'],
 draw:['Рисуй огромными линиями.','Используй только один цвет.','Начни рисунок с круга.','Нельзя использовать ластик.','Нарисуй забавную рамку.'],
 sing:['Пой как оперный певец.','Пой как колыбельную.','Пой словно на стадионе.','Пой очень радостно.','Напевай на слог «ла».'],
 yesno:['Не больше пятнадцати вопросов.','Начни с вопроса о персонаже.','Первый вопрос должен быть о времени.','Первый вопрос должен быть о месте.'],
 blitz:['Каждую подсказку начинай с «Представь».','Говори как ведущий телеигры.','Объясняй с улыбкой.']
});
const HARD_COMPLICATIONS = Object.freeze({
 talk:['Нельзя использовать прилагательные и указательные местоимения.','Объясняй исключительно вопросами.','Не используй глаголы.','Произнеси максимум три слова в каждой подсказке.','Каждую фразу начинай на следующую букву алфавита.','Не называй категории объектов.'],
 mime:['Держи обе ноги неподвижно.','Показывай только одной рукой и без мимики.','Каждые три секунды замирай.','Показывай только сидя с закрытым одним глазом.','Запрещено изображать форму предмета руками.'],
 draw:['Рисуй, не отрывая карандаш от бумаги и неведущей рукой.','Не больше трёх линий.','Нельзя изображать людей и лица.','Рисуй только прямыми отрезками.','Первые десять секунд рисуй с закрытыми глазами.'],
 sing:['Напевай только с закрытым ртом.','Напевай только на одном звуке.','Пой без слов и без смены темпа.','Чередуй две ноты, не больше.'],
 yesno:['Только семь вопросов на весь раунд.','Нельзя спрашивать ни о профессии, ни об эпохе.','Нельзя задавать вопросы про происхождение персонажа.','На вопросы отвечай только «да» и «нет», без объяснений.'],
 blitz:['Не используй прилагательные и жесты.','Запрещено повторять слова в подсказках.','Каждая подсказка максимум два слова.','Запрещено использовать местоимения.']
});
function severityForRound() {
  return game.current?.difficulty || game.difficulty;
}
function allowPause() { return severityForRound()==='easy'; }
function selectComplication(id,level) {
  const easy=EASY_COMPLICATIONS[id]||[];
  const medium=COMPLICATIONS[id]||[];
  const hard=HARD_COMPLICATIONS[id]||[];
  const pool=level==='easy'?easy:level==='medium'?easy.concat(medium):easy.concat(medium,hard);
  return randomOne(pool.length?pool:medium);
}
const DEFAULT_MODES = Object.freeze(MODE_LIST.map(mode=>mode.id));
const PROMPT_TYPES = Object.freeze(['word','phrase','idiom']);
const SCORE = Object.freeze({talk:1,mime:2,draw:2,sing:2,yesno:2,secret:3,blitz:1});
function modeArt(id) {
  const safe=DEFAULT_MODES.includes(id)?id:'secret';
  return '<img class="mode-art" src="'+MODE_ASSETS[safe]+'" alt="" decoding="async" draggable="false">';
}
function symbol(id,extra='') {
  return '<div class="mode-symbol '+extra+'" aria-hidden="true">'+modeArt(id)+'</div>';
}
const $ = id => document.getElementById(id);
function timerMarkup(ms) { return formatTimer(ms); }
const freshOptions = () => ({
  difficulty:'easy',duration:60,rounds:12, dice:true, complications:true,
  modes:DEFAULT_MODES.slice(), promptTypes:PROMPT_TYPES.slice(),blitzCount:4,
  scoring:'standard'
});
let options = freshOptions();
let soundOn = true;
let game = null;
let rafId = 0;
let intervalId = null;
let rollFrameHandle = null;
let audioContext = null;
let lastChimeAt = null;
let toastTimeout = null;
let activeScene='home';
let advancedReturn='setup';
let rollSequence=[];

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));
}
function readSaved() {
  try {
    const obj=JSON.parse(localStorage.getItem(STORAGE_KEY));
    return obj?.version===1 ? obj : null;
  } catch { return null; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,options,soundOn,game})); }
  catch { /* Private browsing might block storage; a session still works. */ }
}
function sanitizeTeam(name,fallback) {
  const str=String(name||'').replace(/\s+/g,' ').trim().slice(0,24);
  return str || fallback;
}
function randomOne(list) { return list[Math.floor(Math.random()*list.length)]; }
function currentTeamIndex() { return game.roundIndex%2; }
function currentTeam() { return game.teams[currentTeamIndex()]; }
function currentMode() { return MODE_LIST.find(mode=>mode.id===game.current?.modeId); }
function getMode(id) { return MODE_LIST.find(m=>m.id===id); }
function formatTimer(ms) {
  const seconds=Math.max(0,Math.ceil(ms/1000));
  return String(Math.floor(seconds/60)).padStart(1,'0')+':'+String(seconds%60).padStart(2,'0');
}
function setSoundIcon() {
  $('sound-toggle').setAttribute('aria-pressed',String(soundOn));
  $('sound-toggle').setAttribute('aria-label',soundOn?'Выключить звук':'Включить звук');
  $('sound-toggle').title=soundOn?'Выключить звук':'Включить звук';
}
function initAudio() {
  if(!soundOn)return;
  try {
    const Ctor=window.AudioContext||window.webkitAudioContext;
    if(!Ctor)return;
    if(!audioContext)audioContext=new Ctor();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  } catch { /* Audio is optional, never block play. */ }
}
function tone(freq=660,duration=.11,type='sine',volume=.07,delay=0) {
  if(!soundOn)return;
  initAudio();
  if(!audioContext)return;
  try {
    const now=audioContext.currentTime+delay;
    const oscillator=audioContext.createOscillator();
    const gain=audioContext.createGain();
    oscillator.type=type;oscillator.frequency.setValueAtTime(freq,now);
    gain.gain.setValueAtTime(.0001,now);
    gain.gain.exponentialRampToValueAtTime(volume,now+.016);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    oscillator.connect(gain);gain.connect(audioContext.destination);
    oscillator.start(now);oscillator.stop(now+duration+.02);
  } catch { /* Playback may be restricted by the device. */ }
}
function sfx(kind) {
  if(kind==='button')tone(520,.08,'triangle',.055);
  if(kind==='roll'){tone(340,.1,'triangle',.055);tone(540,.13,'triangle',.05,.12);}
  if(kind==='go'){tone(560,.1,'sine',.06);tone(740,.14,'sine',.07,.14);}
  if(kind==='tick')tone(600,.09,'sine',.075);
  if(kind==='last')tone(910,.17,'triangle',.11);
  if(kind==='time'){tone(520,.24,'sawtooth',.09);tone(390,.4,'triangle',.10,.23);tone(260,.5,'triangle',.09,.55);}
  if(kind==='win'){tone(500,.12,'triangle',.07);tone(660,.16,'triangle',.07,.15);tone(880,.3,'triangle',.09,.34);}
  if(kind==='fail')tone(285,.21,'triangle',.075);
}
function toast(message) {
  const element=$('toast');
  element.textContent=message;
  element.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout=setTimeout(()=>element.classList.remove('show'),2450);
}
function closeRules() { $('rules-backdrop').hidden=true; }
function openRules() { $('rules-backdrop').hidden=false; }
function hasUnfinishedGame() {
  return Boolean(game && !['results','home'].includes(game.phase));
}
function updateContinue() {
  const button=$('continue-game');
  if(!button)return;
  const possible=hasUnfinishedGame();
  button.disabled=!possible;
  button.setAttribute('aria-disabled',String(!possible));
}
function setScene(which) {
  activeScene=which;
  for(const scene of ['home','setup','advanced','game','results'])
    $('scene-'+scene).hidden=scene!==which;
  document.body.dataset.screen=which;
  updateContinue();
}
function openSetup() {
  // Opening setup keeps any unfinished session untouched until the user starts a new one.
  renderOptions();
  setScene('setup');
  $('setup-scroll').scrollTop=0;
}
function openAdvanced(from='setup') {
  advancedReturn=from;
  renderOptions();
  setScene('advanced');
  $('advanced-scroll').scrollTop=0;
}
function closeAdvanced() {
  renderOptions();
  setScene(advancedReturn);
}
function continueGame() {
  if(!hasUnfinishedGame())return;
  if(game.phase==='rolling')game.phase='ready';
  if(game.phase==='countdown'&&Date.now()>=game.current.autoStartAt)beginAutomaticRound();
  if(game.phase==='play'&&!game.current.paused&&game.current.deadline<=Date.now())
    finishTimer('timeout');
  render();
}
function renderOptions() {
  for(const setting of ['difficulty','duration','rounds','dice']) {
    document.querySelectorAll('.choices[data-setting="'+setting+'"] button').forEach(button=>{
      const selected=String(options[setting])===button.dataset.value;
      button.classList.toggle('is-chosen',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  const numbers={'custom-duration':options.duration,'custom-rounds':options.rounds,'custom-blitz':options.blitzCount};
  for(const [id,value] of Object.entries(numbers)) {
    const input=$(id);
    if(input && document.activeElement!==input)input.value=String(value);
  }
  document.querySelectorAll('#mode-toggles input').forEach(input=>{input.checked=options.modes.includes(input.value);});
  document.querySelectorAll('#content-toggles input').forEach(input=>{input.checked=options.promptTypes.includes(input.value);});
  $('toggle-complications').checked=options.complications;
}
function renderMatch() {
  $('label-team-a').textContent=game.teams[0];
  $('label-team-b').textContent=game.teams[1];
  $('score-a').textContent=game.scores[0];
  $('score-b').textContent=game.scores[1];
  $('round-now').textContent=Math.min(game.roundIndex+1,game.rounds);
  $('round-total').textContent=game.rounds;
  $('match-progress').style.width=(game.roundIndex/game.rounds*100)+'%';
  $('match-team-a').classList.toggle('is-turn',currentTeamIndex()===0);
  $('match-team-b').classList.toggle('is-turn',currentTeamIndex()===1);
}
function pickMode() {
  const allowed=MODE_LIST.filter(m=>game.modes.includes(m.id));
  if(!allowed.length)throw Error('Не выбрано ни одного режима');
  const recent=game.modeHistory.slice(-Math.min(2,allowed.length-1));
  const candidates=allowed.filter(mode=>!recent.includes(mode.id));
  return randomOne(candidates.length?candidates:allowed);
}
function chooseDifficulty() {
  return game.difficulty==='mixed'?randomOne(['easy','medium','hard']):game.difficulty;
}
function getPromptPool(kind,level) {
  if(kind==='songs')return PARTY_SONGS[level]||PARTY_SONGS.easy;
  if(kind==='people')return PARTY_PEOPLE[level]||PARTY_PEOPLE.easy;
  const groups={
    word:(PARTY_WORDS[level]||PARTY_WORDS.easy).filter(word=>!word.includes(' ')),
    phrase:PARTY_PHRASES[level]||PARTY_PHRASES.easy,
    idiom:PARTY_IDIOMS[level]||PARTY_IDIOMS.easy
  };
  return (game.promptTypes?.length?game.promptTypes:PROMPT_TYPES)
    .flatMap(type=>groups[type]||[]);
}
function pullWord(kind, level=chooseDifficulty()) {
  const pool=getPromptPool(kind,level);
  if(!pool?.length)throw Error('Нет слов для выбранных настроек');
  const key=level+':'+kind+':'+(game.promptTypes||[]).join(',');
  let used=game.used[key]||[];
  let free=pool.filter(word=>!used.includes(word));
  if(!free.length){used=[];free=pool.slice();}
  const word=randomOne(free);
  used.push(word);game.used[key]=used;
  return word;
}
function rollOutcome() {
  const mode=pickMode();
  game.modeHistory.push(mode.id);
  let actualMode=mode;
  const level=chooseDifficulty();
  let complication='';
  if(mode.id==='secret'){
    const submodes=MODE_LIST.filter(m=>['talk','mime','draw','sing','yesno'].includes(m.id));
    const enabled=submodes.filter(m=>game.modes.includes(m.id));
    actualMode=randomOne(enabled.length?enabled:submodes);
  }
  if(mode.id==='secret'||(game.complications&&Math.random()<.35))
    complication=selectComplication(actualMode.id,level);
  const word=pullWord(actualMode.kind,level);
  return {
    modeId:mode.id,methodId:actualMode.id,word,complication,difficulty:level,
    points:SCORE[mode.id]||1,seconds:mode.seconds||game.duration,
    blitzWords:mode.id==='blitz'?[word,...Array.from({length:game.blitzCount-1},()=>pullWord('words',level))]:null,
    blitzIndex:0,blitzCorrect:0,blitzSkipped:0,
    blitzQueue:mode.id==='blitz'?Array.from({length:game.blitzCount},(_,i)=>i):null,
    visible:false,paused:false,remainingMs:null,deadline:null,autoStartAt:null,
    finishedReason:null,replaced:false
  };
}
function makeButton(label,action,style='button-secondary') {
  return '<button type="button" class="button '+style+'" data-action="'+action+'">'+label+'</button>';
}
// Lucide-like vector UI controls; illustrated mode assets continue to use WebP.
const CONTROL_ICONS=Object.freeze({
  'eye-off':'<path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.3A11.6 11.6 0 0 1 12 5c5.1 0 8.8 4 10 7a12 12 0 0 1-3.4 4.5M6.1 6.1A12.1 12.1 0 0 0 2 12c1.2 3 4.9 7 10 7 1.8 0 3.5-.5 4.9-1.3"/>',
  eye:'<path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7.5 7.5 0 0 1 19 7l1 5M4 12l1 5a7.5 7.5 0 0 0 13.5-2"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  play:'<path d="m8 5 11 7-11 7V5Z"/>',
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
  if(!allowPause())return '';
  return '<div class="round-controls task-controls">'+
    iconButton('eye-off','toggle-word','Скрыть слово')+
    iconButton('clock','start-timer','Запустить таймер','success')+
    (c.modeId!=='blitz'?iconButton('refresh','replace-word','Другое слово'):'<span class="round-action-placeholder" aria-hidden="true"></span>')+
    '</div>';
}
function showReady() {
  $('play-content').className='play-inner is-ready';
  $('play-step').textContent='ПЕРЕДАЙТЕ ТЕЛЕФОН';
  const index=currentTeamIndex();
  const team=escapeHTML(currentTeam());
  $('play-content').innerHTML=
    '<span class="game-eyebrow">ХОД '+(game.roundIndex+1)+' ИЗ '+game.rounds+'</span>'+
    '<div class="ready-avatar '+(index===1?'is-blue':'')+'">'+modeArt('secret')+'</div>'+
    '<h2 class="play-title">НА ОЧЕРЕДИ<br><em>'+team+'</em></h2>'+
    '<p class="play-subtitle">Передайте телефон своей команде. '+(game.dice?'Запустите карусель и узнайте режим.':'Получите случайное задание.')+'</p>'+
    makeButton(game.dice?'ВЫБРАТЬ РЕЖИМ':'ПОЛУЧИТЬ ЗАДАНИЕ','roll','button-primary button-big');
}
function showRolling() {
  $('play-content').className='play-inner is-rolling-screen';
  $('play-step').textContent='ВЫБОР РЕЖИМА';
  const pool=game.modes.length?game.modes:['talk'];
  rollSequence=Array.from({length:17},(_,i)=>
    i===16?game.current.modeId:pool[i%pool.length]);
  $('play-content').innerHTML=
    '<span class="game-eyebrow">КАКОЙ РЕЖИМ ВЫПАДЕТ?</span>'+
    '<div class="reel-window" id="reel-window" aria-label="Карусель игровых режимов">'+
      '<div class="reel-track" id="reel-track">'+
      rollSequence.map((id,i)=>'<div class="reel-item '+(i===16?'reel-item--winner':'')+'">'+
      modeArt(id)+'<span>'+escapeHTML(getMode(id).title)+'</span></div>').join('')+
      '</div></div>'+
    '<p class="play-subtitle">Карусель выбирает случайный режим...</p>';
  const track=$('reel-track'),last=track?.lastElementChild,windowEl=$('reel-window');
  if(track&&last&&windowEl) {
    const position=()=>{
      if(game?.phase!=='rolling')return;
      const offset=windowEl.clientWidth/2-last.offsetLeft-last.offsetWidth/2;
      track.style.transform='translate3d('+offset+'px,0,0)';
    };
    if(typeof requestAnimationFrame==='function')
      requestAnimationFrame(()=>requestAnimationFrame(position));
    else position();
  }
}

function modeInformation() {
  const mode=getMode(game.current.modeId);
  const method=getMode(game.current.methodId);
  const secret=mode.id==='secret';
  return {
    mode,method,secret,
    name:secret?'СЕКРЕТКА: '+method.title:mode.title,
    rule:method.rule
  };
}
function taskMarkup(hidden) {
  const {method}=modeInformation();
  const word=escapeHTML(game.current.word);
  const what=method.id==='sing'?'ТЕМА ДЛЯ ПЕСНИ':'ВАШЕ ЗАДАНИЕ';
  return '<div class="challenge-card '+(hidden?'is-hidden':'')+'">'+
    '<span class="challenge-overline">'+what+'</span>'+
    '<div class="challenge-word '+(hidden?'challenge-word--hidden':'')+'">'+
    (hidden?'НАЖМИ, ЧТОБЫ ОТКРЫТЬ':word)+'</div>'+
    (hidden?'':'<span class="challenge-details">ЗАПОМНИ И НАЧИНАЙ!</span>')+'</div>';
}
function showTask() {
  $('play-content').className='play-inner is-task';
  const {mode,method,secret,name,rule}=modeInformation();
  $('play-step').textContent='ВАМ ВЫПАЛО';
  const c=game.current;
  $('play-content').innerHTML=
    symbol(mode.id)+
    '<h2 class="play-title mode-name">'+escapeHTML(name)+'</h2>'+
    '<div class="mode-rule">'+escapeHTML(rule)+
    (c.complication?'<br><strong>УСЛОЖНЕНИЕ: '+escapeHTML(c.complication)+'</strong>':'')+'</div>'+
    (secret?'<span class="secret-flag">СЕКРЕТКА · +'+c.points+' ОЧКА</span>':
      '<span class="score-note">ЗА ВЕРНЫЙ ОТВЕТ: +'+(c.modeId==='blitz'?'1 ЗА СЛОВО':c.points)+'</span>')+
    taskMarkup(!c.visible)+taskControls(c);
}
function blitzStatus() {
  const c=game.current;
  const left=c.blitzQueue?.length ?? Math.max(0,c.blitzWords.length-c.blitzIndex);
  return '<div class="blitz-status"><b>ОСТАЛОСЬ: '+left+'</b>'+
    '<span>Отгадано: '+c.blitzCorrect+' · Пропущено: '+c.blitzSkipped+'</span></div>';
}
function showTimer() {
  $('play-content').className='play-inner is-play';
  $('play-step').textContent='ВРЕМЯ ПОШЛО';
  const c=game.current,remaining=c.paused?c.remainingMs:c.deadline-Date.now();
  const shown=Math.max(0,remaining),blitz=c.modeId==='blitz';
  $('play-content').innerHTML=
    '<span class="game-eyebrow">'+escapeHTML(modeInformation().name)+' · '+c.seconds+' СЕКУНД</span>'+
    '<div class="timer-ring'+(shown<=10000?' warning':'')+'" aria-label="Таймер">'+
      '<svg viewBox="0 0 200 200" class="ring-svg" aria-hidden="true">'+
        '<circle class="ring-bg" cx="100" cy="100" r="88" />'+
        '<circle id="timer-progress" class="ring-progress" cx="100" cy="100" r="88" />'+
      '</svg>'+
      '<div id="active-timer" class="play-timer'+(shown<=10000?' warning':'')+'" role="timer" aria-label="Оставшееся время">'+timerMarkup(shown)+'</div>'+
    '</div>'+
    (blitz?blitzStatus():'')+taskMarkup(blitz?false:!c.visible)+
    (blitz?'<div class="blitz-actions">'+
      makeButton('✓ УГАДАЛИ +1','blitz-correct','button-primary')+
      makeButton('ПРОПУСТИТЬ','blitz-skip','button-secondary')+'</div>'+
      '<div class="minor-action">'+makeButton('ЗАВЕРШИТЬ БЛИЦ','finish-early','button-quiet')+'</div>':
      '<div class="round-controls play-controls">'+
        '<div class="play-secondary-controls">'+
        iconButton(c.visible?'eye-off':'eye','toggle-word',c.visible?'Скрыть задание':'Показать задание')+
        (allowPause()?iconButton(c.paused?'play':'pause',c.paused?'resume':'pause',c.paused?'Продолжить':'Пауза'):'<span class="round-action-placeholder" aria-hidden="true"></span>')+
        '</div>'+
        '<div class="play-success-control">'+
          iconButton('check','correct-now','Угадали — засчитать очки','success prominent')+
        '</div>'+
      '</div>');
  updateTimerVisual(shown);
}
function advanceBlitz(correct) {
  if(!game||game.phase!=='play'||game.current.paused||game.current.modeId!=='blitz')return;
  const c=game.current;
  if(Date.now()>=c.deadline){finishTimer('timeout');return;}
  if(!Array.isArray(c.blitzQueue))
    c.blitzQueue=Array.from({length:c.blitzWords.length},(_,i)=>i).slice(c.blitzIndex);
  if(!c.blitzQueue.length)return;
  const index=c.blitzQueue.shift();
  if(correct)c.blitzCorrect++;
  else {c.blitzSkipped++;c.blitzQueue.push(index);}
  c.blitzIndex++;
  if(!c.blitzQueue.length){finishTimer('completed');return;}
  c.word=c.blitzWords[c.blitzQueue[0]];
  persist();sfx(correct?'win':'button');
  showTimer();
}

function updateTimerVisual(remaining) {
  const c=game?.current;
  if(!c)return;
  const timer=$('active-timer'),progress=$('timer-progress');
  if(!timer||!progress)return;
  timer.innerHTML=timerMarkup(remaining);
  const warning=remaining<=10000;
  timer.classList.toggle('warning',warning);
  const fraction=Math.max(0,Math.min(1,remaining/(c.seconds*1000)));
  progress.style.strokeDashoffset=String(2*Math.PI*88*(1-fraction));
  progress.closest?.('.timer-ring')?.classList.toggle('warning',warning);
}
function stopTicking() {
  if(intervalId!==null){clearInterval(intervalId);intervalId=null;}
}
function beginAutomaticRound() {
  if(!game||game.phase!=='countdown')return;
  const c=game.current;
  const startAt=c.autoStartAt || Date.now();
  c.deadline=startAt+c.seconds*1000;
  c.autoStartAt=null;
  c.remainingMs=null;c.paused=false;
  game.phase='play';
  lastChimeAt=null;
  persist();sfx('go');render();
}
function showCountdown() {
  $('play-content').className='play-inner is-countdown';
  const c=game.current;
  $('play-step').textContent='ПРИГОТОВЬТЕСЬ';
  $('play-content').innerHTML=
    '<span class="game-eyebrow">'+escapeHTML(modeInformation().name)+'</span>'+
    '<h2 class="play-title">СТАРТ ЧЕРЕЗ <em>1 СЕКУНДУ</em></h2>'+
    taskMarkup(false)+
    '<p class="play-subtitle">Время начнётся автоматически. Пауза на этом уровне недоступна.</p>';
}
function startTicking() {
  stopTicking();
  intervalId=setInterval(tick,100);
  tick();
}
function tick() {
  if(!game)return;
  if(game.phase==='countdown'){
    if(Date.now()>=game.current.autoStartAt)beginAutomaticRound();
    return;
  }
  if(game.phase!=='play'||game.current.paused)return;
  const remain=Math.max(0,game.current.deadline-Date.now());
  const second=Math.ceil(remain/1000);
  updateTimerVisual(remain);
  if(second<=10&&second>0&&second!==lastChimeAt) {
    lastChimeAt=second;
    if(soundOn)sfx(second<=3?'last':'tick');
  }
  if(remain<=0)finishTimer('timeout');
}
function finishTimer(reason) {
  if(!game||game.phase!=='play')return;
  stopTicking();
  game.phase='judge';
  game.current.finishedReason=reason;
  game.current.deadline=null;
  game.current.paused=false;
  persist();
  if(reason==='timeout') {
    sfx('time');
    if(navigator.vibrate)navigator.vibrate([120,60,180]);
  }
  render();
}
function showJudge() {
  $('play-content').className='play-inner is-judge';
  $('play-step').textContent='ИТОГ РАУНДА';
  const c=game.current,blitz=c.modeId==='blitz';
  $('play-content').innerHTML=
    '<span class="game-eyebrow">'+(c.finishedReason==='timeout'?'ВРЕМЯ ВЫШЛО':'РАУНД ЗАКОНЧЕН')+'</span>'+
    symbol(blitz?'blitz':c.methodId)+
    '<h2 class="play-title">'+(blitz?'РЕЗУЛЬТАТ <em>БЛИЦА</em>':'КОМАНДА <em>УГАДАЛА?</em>')+'</h2>'+
    '<p class="play-subtitle">'+(blitz?'Отгадано '+c.blitzCorrect+' из '+c.blitzWords.length+
    '. Засчитайте очки или отмените результат.':'Нажмите галочку, если ответ верный, или крестик, если нет.')+'</p>'+
    '<p class="score-note">'+(blitz?'Награда: <b>+'+c.blitzCorrect+' очков</b> · Пропущено: '+c.blitzSkipped:
    'Было загадано: <b>'+escapeHTML(c.word)+'</b> · За ответ: +'+c.points)+'</p>'+
    '<div class="judgement-grid">'+
      '<div class="judgement-option">'+
        '<button class="judgement judgement--yes" data-action="yes" type="button" aria-label="Засчитать ответ"><svg viewBox="0 0 64 64"><path d="m13 33 13 13 25-28"/></svg></button>'+
        '<span>'+(blitz?'ЗАСЧИТАТЬ':'УГАДАЛИ')+'</span>'+
      '</div>'+
      '<div class="judgement-option">'+
        '<button class="judgement judgement--no" data-action="no" type="button" aria-label="Не засчитывать"><svg viewBox="0 0 64 64"><path d="m17 17 30 30M47 17 17 47"/></svg></button>'+
        '<span>'+(blitz?'ОТМЕНИТЬ':'НЕ УГАДАЛИ')+'</span>'+
      '</div>'+
    '</div>';
}
function recordAnswer(yes) {
  if(!game||!['judge','play'].includes(game.phase))return;
  const teamIndex=currentTeamIndex(),c=game.current;
  const points=yes?(c.modeId==='blitz'?c.blitzCorrect:c.points):0;
  game.scores[teamIndex]+=points;
  game.history.push({
    team:game.teams[teamIndex],mode:c.modeId,
    word:c.modeId==='blitz'?c.blitzWords.join(' / '):c.word,awarded:points,correct:yes
  });
  game.roundIndex++;
  // Confirmation is the final action for a round; no extra Next button.
  game.phase=game.roundIndex>=game.rounds?'results':'ready';
  game.current=null;
  stopTicking();persist();sfx(yes?'win':'fail');render();
}
function correctNow() {
  if(!game||game.phase!=='play'||game.current?.modeId==='blitz')return;
  const c=game.current;
  if(!c.paused&&Date.now()>=c.deadline){finishTimer('timeout');return;}
  if(c.paused&&(c.remainingMs??0)<=0){finishTimer('timeout');return;}
  recordAnswer(true);
}
function judge(yes) {
  if(!game||game.phase!=='judge')return;
  recordAnswer(yes);
}
function showBetween() {
  $('play-content').className='play-inner is-between';
  $('play-step').textContent='РАУНД ЗАВЕРШЁН';
  const last=game.history[game.history.length-1];
  $('play-content').innerHTML=
    '<span class="game-eyebrow">СЧЁТ ОБНОВЛЁН</span>'+
    symbol(last.correct?'talk':'secret')+
    '<h2 class="play-title">'+(last.correct?'ЕСТЬ! <em>+'+last.awarded+' ОЧК'+(last.awarded===1?'О':'А')+'</em>':'В СЛЕДУЮЩИЙ <em>РАЗ!</em>')+'</h2>'+
    '<p class="play-subtitle">Следующий ход: <b>'+escapeHTML(currentTeam())+'</b>. Передайте телефон этой команде.</p>'+
    makeButton('СЛЕДУЮЩИЙ ХОД','next','button-primary button-big');
}
function showResults() {
  setScene('results');
  const [a,b]=game.scores;
  const winner=a===b?'НИЧЬЯ!':(a>b?game.teams[0]:game.teams[1]);
  const item=(index)=>'<div class="final-score-item '+(game.scores[index]===Math.max(a,b)&&a!==b?'is-winner':'')+'">'+
    '<span>'+escapeHTML(game.teams[index])+'</span><b>'+game.scores[index]+'</b><span>ОЧКОВ</span></div>';
  $('results-content').innerHTML=
    '<span class="section-kicker">ПАРТИЯ ЗАВЕРШЕНА</span>'+
    '<div class="result-trophy" aria-hidden="true">'+(a===b?'✳':'🏆')+'</div>'+
    '<h1 class="match-finished">'+(a===b?'ПОБЕДИЛА <em>ДРУЖБА</em>':'ПОБЕДИТЕЛЬ:<br><span style="color:var(--lime)">'+escapeHTML(winner)+'</span>')+'</h1>'+
    '<p class="play-subtitle" style="margin:15px auto">Отличная партия. Но разве это повод останавливаться?</p>'+
    '<div class="final-score">'+item(0)+'<span class="final-score-divider">:</span>'+item(1)+'</div>'+
    '<div class="inline-actions">'+makeButton('СЫГРАТЬ ЕЩЁ','again','button-primary button-big')+
    makeButton('В ГЛАВНОЕ МЕНЮ','menu')+'</div>'+
    '<div class="history-block"><h3>ИСТОРИЯ ХОДОВ</h3>'+
    game.history.map((row,index)=>
      '<div class="history-row"><span>'+(index+1)+'. '+escapeHTML(row.team)+' · '+
      escapeHTML(getMode(row.mode)?.title||'')+' · '+escapeHTML(row.word)+'</span>'+
      '<b>'+(row.correct?'+'+row.awarded:'0')+'</b></div>').join('')+
    '</div>';
}
function render() {
  if(!game||game.phase==='home'){setScene('home');return;}
  if(game.phase==='results'){stopTicking();showResults();return;}
  setScene('game');
  renderMatch();
  if(game.phase==='ready')showReady();
  else if(game.phase==='rolling')showRolling();
  else if(game.phase==='task')showTask();
  else if(game.phase==='countdown')showCountdown();
  else if(game.phase==='play')showTimer();
  else if(game.phase==='judge')showJudge();
  else if(game.phase==='between')showBetween();
  if(game.phase==='countdown'||(game.phase==='play'&&!game.current.paused))startTicking();
  else stopTicking();
}
function newGame() {
  // START is the explicit action; don't repeat it with a native confirmation.
  if(!options.modes.length){toast('Выберите хотя бы один игровой режим');return;}
  if(!options.promptTypes.length && options.modes.some(id=>['talk','mime','draw','blitz','secret'].includes(id))){toast('Выберите тип заданий');return;}
  const teamA=sanitizeTeam($('team-a').value,'Молнии');
  const teamB=sanitizeTeam($('team-b').value,'Кометы');
  game={
    teams:[teamA,teamB],scores:[0,0],roundIndex:0,
    rounds:options.rounds,duration:options.duration,difficulty:options.difficulty,
    modes:options.modes.slice(),promptTypes:options.promptTypes.slice(),
    dice:options.dice,complications:options.complications,blitzCount:options.blitzCount,
    current:null,modeHistory:[],used:{},history:[],phase:'ready'
  };
  persist();sfx('go');render();
}
function roll() {
  if(!game||game.phase!=='ready')return;
  if(!game.dice){
    game.current=rollOutcome();game.phase='task';persist();sfx('go');render();
    return;
  }
  game.current=rollOutcome();
  game.phase='rolling';persist();sfx('roll');render();
  // The mode is decided once; the moving reel is presentation only.
  setTimeout(()=>{
    if(!game||game.phase!=='rolling'||activeScene!=='game')return;
    const winner=$('reel-track')?.lastElementChild;
    if(winner)winner.classList.add('reel-item--landed');
    game.phase='task';persist();sfx('go');render();
  },2050);
}

function toggleWord() {
  if(!game||!['task','play'].includes(game.phase))return;
  if(game.current.modeId==='blitz'&&game.phase==='play')return;
  // Revealing or hiding an answer never pauses or restarts the clock.
  game.current.visible=!game.current.visible;
  if(game.phase==='task'&&game.current.visible&&!allowPause()){
    game.phase='countdown';
    game.current.autoStartAt=Date.now()+1000;
  }
  persist();
  render();
}
function replaceWord() {
  if(!game||game.phase!=='task'||!allowPause()||game.current.modeId==='blitz')return;
  game.current.word=pullWord(getMode(game.current.methodId).kind,game.current.difficulty);
  game.current.visible=false;
  persist();sfx('button');render();
}
function startTimer() {
  if(!game||game.phase!=='task'||!game.current.visible||!allowPause())return;
  game.phase='play';
  game.current.deadline=Date.now()+game.current.seconds*1000;
  game.current.remainingMs=null;
  game.current.paused=false;
  lastChimeAt=null;
  persist();sfx('go');render();
}
function pauseTimer() {
  if(!game||game.phase!=='play'||game.current.paused||!allowPause())return;
  game.current.remainingMs=Math.max(0,game.current.deadline-Date.now());
  game.current.paused=true;
  game.current.deadline=null;
  persist();render();
}
function resumeTimer() {
  if(!game||game.phase!=='play'||!game.current.paused||!allowPause())return;
  game.current.deadline=Date.now()+game.current.remainingMs;
  game.current.paused=false;
  persist();sfx('go');render();
}
function backToMenu() {
  stopTicking();
  if(game?.phase==='rolling')game.phase='ready';
  if(game?.phase==='results')game=null;
  persist();
  setScene('home');
  renderOptions();
}
function handleAction(action) {
  switch(action) {
    case 'roll':return roll();
    case 'toggle-word':return toggleWord();
    case 'replace-word':return replaceWord();
    case 'start-timer':return startTimer();
    case 'pause':return pauseTimer();
    case 'resume':return resumeTimer();
    case 'finish-early':return finishTimer('early');
    case 'correct-now':return correctNow();
    case 'blitz-correct':return advanceBlitz(true);
    case 'blitz-skip':return advanceBlitz(false);
    case 'yes':return judge(true);
    case 'no':return judge(false);
    case 'next':if(game?.phase==='between'){game.phase='ready';game.current=null;persist();render();}return;
    case 'again':if(game?.phase==='results'){game=null;newGame();}return;
    case 'menu':return backToMenu();
  }
}
function sanitizeOptions(raw) {
  const base=freshOptions();
  if(!raw||typeof raw!=='object')return base;
  const difficulty=['easy','medium','hard','mixed'].includes(raw.difficulty)?raw.difficulty:base.difficulty;
  const duration=Math.max(15,Math.min(300,Number(raw.duration)||base.duration));
  const rounds=Math.max(2,Math.min(100,Math.round(Number(raw.rounds)||base.rounds)));
  const blitzCount=Math.max(3,Math.min(8,Math.round(Number(raw.blitzCount)||base.blitzCount)));
  const modes=Array.isArray(raw.modes)?DEFAULT_MODES.filter(id=>raw.modes.includes(id)):base.modes;
  const promptTypes=Array.isArray(raw.promptTypes)?PROMPT_TYPES.filter(id=>raw.promptTypes.includes(id)):base.promptTypes;
  return {difficulty,duration,rounds,blitzCount,modes,promptTypes,
    dice:raw.dice!==false,complications:raw.complications!==false,scoring:'standard'};
}
function restoreSession() {
  const saved=readSaved();
  if(!saved)return;
  soundOn=saved.soundOn!==false;
  options=sanitizeOptions(saved.options);
  const candidate=saved.game;
  if(!candidate||!Array.isArray(candidate.teams)||candidate.teams.length!==2||
      !Array.isArray(candidate.scores)||!Number.isInteger(candidate.roundIndex))return;
  if(candidate.phase==='rolling')candidate.phase='ready';
  if(candidate.phase==='countdown' && (candidate.current?.autoStartAt||0)<=Date.now()){
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
  game.modes=game.modes||DEFAULT_MODES.slice();
  game.promptTypes=game.promptTypes||PROMPT_TYPES.slice();
  game.blitzCount=game.blitzCount||4;
  if(game.current?.modeId==='blitz'&&!Array.isArray(game.current.blitzWords)){
    game.current.blitzWords=[game.current.word];
    game.current.blitzIndex=0;game.current.blitzCorrect=0;game.current.blitzSkipped=0;
  }
  if(game.current?.modeId==='blitz'&&!Array.isArray(game.current.blitzQueue)){
    game.current.blitzQueue=Array.from({length:game.current.blitzWords.length},(_,i)=>i)
      .slice(Math.min(game.current.blitzIndex||0,game.current.blitzWords.length));
  }
  game.complications=game.complications!==false;
  game.dice=game.dice!==false;
  if(game.current&&!game.current.difficulty)game.current.difficulty=game.difficulty==='mixed'?'medium':game.difficulty;
  $('team-a').value=game.teams[0];
  $('team-b').value=game.teams[1];
  renderOptions();
}
function setupEvents() {
  document.querySelectorAll('.choices').forEach(group=>{
    group.addEventListener('click',event=>{
      const button=event.target.closest('button[data-value]');
      if(!button)return;
      const setting=group.dataset.setting;
      const value=button.dataset.value;
      options[setting]=setting==='difficulty'?value:setting==='dice'?value==='true':Number(value);
      renderOptions();persist();sfx('button');
    });
  });
  for(const [id,key,min,max] of [
    ['custom-duration','duration',15,300],
    ['custom-rounds','rounds',2,100],
    ['custom-blitz','blitzCount',3,8]
  ]) {
    $(id).addEventListener('change',event=>{
      const requested=Number(event.target.value);
      if(!Number.isFinite(requested)){renderOptions();return;}
      options[key]=Math.max(min,Math.min(max,Math.round(requested)));
      renderOptions();persist();
    });
  }
  for(const [id,key] of [['mode-toggles','modes'],['content-toggles','promptTypes']]) {
    $(id).addEventListener('change',event=>{
      if(!event.target.matches('input[type="checkbox"]'))return;
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
  $('toggle-complications').addEventListener('change',event=>{
    options.complications=event.target.checked;persist();
  });
  $('new-game-menu').addEventListener('click',openSetup);
  $('continue-game').addEventListener('click',continueGame);
  $('settings-menu').addEventListener('click',()=>openAdvanced('home'));
  $('setup-back').addEventListener('click',()=>setScene('home'));
  $('go-advanced').addEventListener('click',()=>openAdvanced('setup'));
  $('advanced-back').addEventListener('click',closeAdvanced);
  $('advanced-done').addEventListener('click',closeAdvanced);
  $('start-game').addEventListener('click',newGame);
  $('play-content').addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');
    if(button)handleAction(button.dataset.action);
  });
  $('results-content').addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');
    if(button)handleAction(button.dataset.action);
  });
  $('exit-game').addEventListener('click',backToMenu);
  $('brand-link').addEventListener('click',event=>{event.preventDefault();backToMenu();});
  $('sound-toggle').addEventListener('click',()=>{
    soundOn=!soundOn;setSoundIcon();persist();
    if(soundOn)sfx('go');
  });
  $('help-toggle').addEventListener('click',openRules);
  $('close-rules').addEventListener('click',closeRules);
  $('rules-understood').addEventListener('click',closeRules);
  $('rules-backdrop').addEventListener('click',event=>{if(event.target.id==='rules-backdrop')closeRules();});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeRules();
  });
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&game?.phase==='play')tick();
  });
}
function boot() {
  setupEvents();
  restoreSession();
  setSoundIcon();
  renderOptions();
  // Even when a match is saved, start at the main menu to offer Continue.
  setScene('home');
  if('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
boot();
