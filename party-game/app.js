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
  return '<svg class="mode-art" viewBox="0 0 100 100" aria-hidden="true"><use href="./assets/modes.svg#'+
    (DEFAULT_MODES.includes(id)?id:'secret')+'"></use></svg>';
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
let audioContext = null;
let lastChimeAt = null;
let toastTimeout = null;

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
function setScene(which) {
  for(const scene of ['home','game','results']) $('scene-'+scene).hidden=scene!==which;
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
    actualMode=randomOne(submodes.filter(m=>game.modes.includes(m.id))||submodes);
    if(!actualMode)actualMode=randomOne(submodes);
  }
  if(mode.id==='secret'||(game.complications&&Math.random()<.35))
    complication=selectComplication(actualMode.id,level);
  const word=pullWord(actualMode.kind,level);
  return {
    modeId:mode.id,methodId:actualMode.id,word,complication,difficulty:level,
    points:SCORE[mode.id]||1,seconds:mode.seconds||game.duration,
    blitzWords:mode.id==='blitz'?[word,...Array.from({length:game.blitzCount-1},()=>pullWord('words',level))]:null,
    blitzIndex:0,blitzCorrect:0,blitzSkipped:0,
    visible:false,paused:false,remainingMs:null,deadline:null,autoStartAt:null,
    finishedReason:null,replaced:false
  };
}
function makeButton(label,action,style='button-secondary') {
  return '<button type="button" class="button '+style+'" data-action="'+action+'">'+label+'</button>';
}
function showReady() {
  $('play-step').textContent='ПЕРЕДАЙТЕ ТЕЛЕФОН';
  const index=currentTeamIndex();
  const team=escapeHTML(currentTeam());
  $('play-content').innerHTML=
    '<span class="game-eyebrow">ХОД '+(game.roundIndex+1)+' ИЗ '+game.rounds+'</span>'+
    '<div class="ready-avatar '+(index===1?'is-blue':'')+'">'+modeArt('secret')+'</div>'+
    '<h2 class="play-title">НА ОЧЕРЕДИ<br><em>'+team+'</em></h2>'+
    '<p class="play-subtitle">'+(game.dice?'Передайте устройство игроку своей команды. Бросайте кубик и готовьтесь объяснять!':'Передайте устройство игроку своей команды, чтобы получить задание.')+'</p>'+
    makeButton(game.dice?'БРОСИТЬ КУБИК':'ПОЛУЧИТЬ ЗАДАНИЕ','roll','button-primary button-big');
}
function showRolling() {
  $('play-step').textContent='КУБИК В ПОЛЁТЕ';
  $('play-content').innerHTML=
    '<span class="game-eyebrow">СУДЬБА ВЫБИРАЕТ</span>'+
    symbol('secret','is-rolling')+
    '<h2 class="play-title">ЧТО ЖЕ <em>ВЫПАДЕТ?</em></h2>'+
    '<p class="play-subtitle">Готовьте голос, руки и фантазию!</p>';
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
  const {mode,method,secret,name,rule}=modeInformation();
  $('play-step').textContent='ВАМ ВЫПАЛО';
  const c=game.current;
  $('play-content').innerHTML=
    symbol(mode.id)+
    '<span class="mode-chip">'+(game.dice?'КУБИК ПОКАЗАЛ':'ВАШ РЕЖИМ')+'</span>'+
    '<h2 class="play-title mode-name">'+escapeHTML(name)+'</h2>'+
    '<div class="mode-rule">'+escapeHTML(rule)+
    (c.complication?'<br><strong>УСЛОЖНЕНИЕ: '+escapeHTML(c.complication)+'</strong>':'')+'</div>'+
    (secret?'<span class="secret-flag">СЕКРЕТКА · +'+c.points+' ОЧКА</span>':
      '<span class="score-note">ЗА ВЕРНЫЙ ОТВЕТ: +'+(c.modeId==='blitz'?'1 ЗА СЛОВО':c.points)+'</span>')+
    taskMarkup(!c.visible)+
    '<div class="inline-actions">'+
    (c.visible?makeButton('СКРЫТЬ СЛОВО','toggle-word'):makeButton('ОТКРЫТЬ ЗАДАНИЕ','toggle-word','button-coral'))+
    (allowPause()&&c.modeId!=='blitz'?makeButton('ДРУГОЕ СЛОВО','replace-word','button-quiet'):'')+'</div>'+
    (c.visible?(allowPause()?makeButton('СТАРТ ТАЙМЕРА','start-timer','button-primary button-big'):
       '<span class="score-note">Таймер начнётся автоматически через 1 секунду</span>'):
      '<span class="score-note">Сначала открой карточку — соперники не должны видеть ответ</span>');
}
function blitzStatus() {
  const c=game.current;
  return '<div class="blitz-status"><b>БЛИЦ · '+Math.min(c.blitzIndex+1,c.blitzWords.length)+' / '+c.blitzWords.length+
    '</b><span>Отгадано: '+c.blitzCorrect+' · Пропущено: '+c.blitzSkipped+'</span></div>';
}
function showTimer() {
  $('play-step').textContent='ВРЕМЯ ПОШЛО';
  const c=game.current,remaining=c.paused?c.remainingMs:c.deadline-Date.now();
  const shown=Math.max(0,remaining),blitz=c.modeId==='blitz';
  $('play-content').innerHTML=
    '<span class="game-eyebrow">'+escapeHTML(modeInformation().name)+' · '+c.seconds+' СЕКУНД</span>'+
    '<div id="active-timer" class="play-timer'+(shown<=10000?' warning':'')+'" role="timer" aria-label="Оставшееся время">'+timerMarkup(shown)+'</div>'+
    '<div class="timer-track'+(shown<=10000?' warning':'')+'"><span id="timer-progress" style="width:'+(shown/c.seconds/10)+'%"></span></div>'+
    (blitz?blitzStatus():'')+taskMarkup(blitz?false:!c.visible)+
    (blitz?'<div class="inline-actions">'+
      makeButton('✓ УГАДАЛИ +1','blitz-correct','button-primary')+
      makeButton('ПРОПУСТИТЬ','blitz-skip','button-secondary')+'</div>':
      '<div class="inline-actions">'+
      makeButton(c.visible?'СКРЫТЬ СЛОВО':'ПОКАЗАТЬ СЛОВО','toggle-word')+'</div>')+
    '<div class="inline-actions">'+
    (allowPause()?makeButton(c.paused?'ПРОДОЛЖИТЬ':'ПАУЗА',c.paused?'resume':'pause'):'')+
    makeButton('ЗАВЕРШИТЬ','finish-early','button-quiet')+'</div>';
  updateTimerVisual(shown);
}
function advanceBlitz(correct) {
  if(!game||game.phase!=='play'||game.current.paused||game.current.modeId!=='blitz')return;
  const c=game.current;
  if(Date.now()>=c.deadline){finishTimer('timeout');return;}
  if(c.blitzIndex>=c.blitzWords.length)return;
  if(correct)c.blitzCorrect++;else c.blitzSkipped++;
  c.blitzIndex++;
  if(c.blitzIndex>=c.blitzWords.length){finishTimer('completed');return;}
  c.word=c.blitzWords[c.blitzIndex];
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
  progress.style.width=(Math.max(0,Math.min(1,remaining/(c.seconds*1000)))*100)+'%';
  progress.parentElement.classList.toggle('warning',warning);
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
    '<button class="judgement judgement--yes" data-action="yes" type="button" aria-label="Засчитать ответ"><svg viewBox="0 0 64 64"><path d="m13 33 13 13 25-28"/></svg></button>'+
    '<button class="judgement judgement--no" data-action="no" type="button" aria-label="Не засчитывать"><svg viewBox="0 0 64 64"><path d="m17 17 30 30M47 17 17 47"/></svg></button>'+
    '</div><div class="judgement-labels"><span>'+(blitz?'ЗАСЧИТАТЬ':'УГАДАЛИ')+'</span><span>'+(blitz?'ОТМЕНИТЬ':'НЕ УГАДАЛИ')+'</span></div>';
}
function judge(yes) {
  if(!game||game.phase!=='judge')return;
  const teamIndex=currentTeamIndex();
  const points=yes?(game.current.modeId==='blitz'?game.current.blitzCorrect:game.current.points):0;
  game.scores[teamIndex]+=points;
  game.history.push({
    team:game.teams[teamIndex],mode:game.current.modeId,
    word:game.current.modeId==='blitz'?game.current.blitzWords.join(' / '):game.current.word,awarded:points,correct:yes
  });
  game.roundIndex++;
  game.phase=game.roundIndex>=game.rounds?'results':'between';
  persist();
  sfx(yes?'win':'fail');
  render();
}
function showBetween() {
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
  if(game&&game.phase!=='results'&&!window.confirm('Заменить текущую партию новой?'))return;
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
  game.phase='rolling';persist();sfx('roll');render();
  setTimeout(()=>{
    if(!game||game.phase!=='rolling')return;
    game.current=rollOutcome();game.phase='task';
    persist();sfx('go');render();
  },game.dice?970:180);
}
function toggleWord() {
  if(!game||!['task','play'].includes(game.phase))return;
  if(game.current.modeId==='blitz'&&game.phase==='play')return;
  if(game.phase==='play'&&!allowPause())return;
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
  if(game&&!['results','home'].includes(game.phase)&&!window.confirm('Завершить партию? Текущий счёт будет потерян.'))return;
  stopTicking();game=null;persist();setScene('home');
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
  render();
}
boot();
