'use strict';
// Diagnostics only: execute the production engine in a deterministic DOM shell.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createSimulation}=require('./game-simulation.cjs');
function simulate(id,chance,rounds=1200,seed=8008){
 const h=createSimulation(seed);h.context.auditConfig={id,chance,rounds};
 return JSON.parse(JSON.stringify(h.eval(`(()=>{
  const {id,chance,rounds}=auditConfig,selection={id,version:2},pack=getContentPack(selection);
  options.contentPack=selection;options.modes=pack.allowedModes?pack.allowedModes.slice():MODE_LIST.map(m=>m.id);
  options.promptTypes=id==='general'?['word','phrase','idiom']:['word','phrase'];options.difficulty='mixed';
  options.complications=true;options.modifierChance=chance;options.dice=false;options.awardTo='guesser';newGame();
  // TASK008 is a historical diagnostic of the pre-TASK009 per-kind selector.
  game.contentPack=selection;delete game.taskHistoryVersion;delete game.taskHistory;game.modifierSelectionVersion=1;delete game.modifierCatalogVersion;
  const counts={},levels={easy:0,medium:0,hard:0},methods={},cycles={},seenAcrossKinds=new Map();
  let optional=0,modified=0,forced=0,forcedModified=0,approx=0,approxModified=0,unnecessaryRepeats=0,releasedOldest=0,crossKindRepeats=0;
  const originalWord=pullWord,originalQuestion=pullApproxQuestion;
  pullWord=function(kind,level,excluded=[]){
   const pool=getPromptPool(kind,level).filter(w=>!excluded.includes(w)),key=(kind==='blitz'?'easy':level)+':'+kind+':'+(game.promptTypes||[]).join(',');
   const unused=pool.filter(w=>!(game.used[key]||[]).includes(w));const selected=originalWord(kind,level,excluded);
   if(unused.length&&!unused.includes(selected))throw Error('Early word repeat '+id+'/'+key);
   if(!unused.length)cycles[key]=(cycles[key]||0)+1;
   if(seenAcrossKinds.has(selected)&&seenAcrossKinds.get(selected)!==kind)crossKindRepeats++;
   seenAcrossKinds.set(selected,kind);return selected;
  };
  pullApproxQuestion=function(level){
   const pool=getPackQuestionPool(game.contentPack,level),unused=pool.filter(q=>!(game.used['approx:'+level]||[]).includes(q.id)),selected=originalQuestion(level);
   if(unused.length&&!unused.some(q=>q.id===selected.id))throw Error('Early numeric repeat '+id+'/'+level);
   if(!unused.length)cycles['approx:'+level]=(cycles['approx:'+level]||0)+1;return selected;
  };
  for(let i=0;i<rounds;i++){
   const recent=game.modifierRecent.slice(),last=game.modeHistory.slice(-2);const c=rollOutcome();
   if(last.includes(c.modeId))throw Error('Mode repeated in last two rounds');
   counts[c.modeId]=(counts[c.modeId]||0)+1;levels[c.difficulty]++;
   if(c.modeId==='secret'){forced++;if(c.complication)forcedModified++;methods[c.methodId]=(methods[c.methodId]||0)+1;}
   else if(c.modeId==='approx'){approx++;if(c.complication)approxModified++;}
   else{optional++;if(c.complication)modified++;}
   if(c.complication){
    const pool=getModifierPool(c.methodId,c.difficulty),free=pool.filter(m=>!recent.some(r=>r.id===m.id||r.key===normalizeModifierText(m.text)));
    const repeated=recent.some(r=>r.id===c.complicationId||r.key===normalizeModifierText(c.complication));
    if(repeated){if(free.length)unnecessaryRepeats++;else releasedOldest++;}
   }
   if(c.blitzWords&&new Set(c.blitzWords).size!==3)throw Error('Duplicate in Blitz');
   if(id!=='general'){
    if(c.question&&c.question.pack!==id+'-v2')throw Error('Foreign numeric source');
    if(c.modeId==='secret'&&!pack.secretMethods.includes(c.methodId))throw Error('Unsupported Secret method');
   }
   game.roundIndex++;game.current=null;
  }
  return {id,chance,rounds,counts,levels,optional,modified,observedPercent:Math.round(modified/optional*10000)/100,
   forced,forcedModified,approx,approxModified,methods,unnecessaryRepeats,releasedOldest,cycles,crossKindRepeats};
 })()`)));
}
function poolReport(){
 const h=createSimulation(8008);
 return JSON.parse(JSON.stringify(h.eval(`(()=>{
 const result={};for(const id of ['general','geography','science']){const selection={id,version:2},p=getContentPack(selection),types=id==='general'?['word','phrase','idiom']:['word','phrase'];
 result[id]={};for(const kind of ['words','people','songs','blitz','number'])result[id][kind]=Object.fromEntries(PARTY_CARD_LEVELS.map(level=>[level,(kind==='number'?getPackQuestionPool(selection,level):getPackCardPool(selection,kind,level,types)).length]));
 }return result})()`)));
}
function checkSettings(){
 const h=createSimulation(8008);return JSON.parse(JSON.stringify(h.eval(`(()=>{
 let checked=0;for(const id of ['geography','science']){const selection={id,version:2},modes=getContentPack(selection).allowedModes;
 for(let mask=1;mask<2**modes.length;mask++)for(const promptTypes of [['word'],['phrase'],['word','phrase']])for(const difficulty of ['easy','medium','hard','mixed']){
 const result=checkContentPack(selection,{...options,modes:modes.filter((_,i)=>mask&(1<<i)),promptTypes,difficulty});checked++;if(!result.available)throw Error(JSON.stringify({id,mask,promptTypes,difficulty,result}));
 }}return {checked,deadEnds:0}})()`)));
}
function audit({rounds=1200,seed=8008}={}){
 const pools=poolReport(),settings=checkSettings(),runs=[];
 for(const id of ['general','geography','science'])for(const chance of [10,20,50,100]){
  const r=simulate(id,chance,rounds,seed+runs.length);assert.equal(r.unnecessaryRepeats,0);assert.equal(r.forced,r.forcedModified);assert.equal(r.approxModified,0);
  for(const n of Object.values(r.levels))assert.equal(n,rounds/3);runs.push(r);
 }
 return {seed,roundsPerRun:rounds,totalRounds:rounds*runs.length,pools,settings,runs};
}
function markdown(a){
 const lines=['# КВИП — аудит баланса TASK 008','',
 'Детерминированная диагностика выбора, а не оценка справедливости наград. Выполнено production-функциями из текущих скриптов; правила, очки, риск, таймеры, «Микс» и вероятности не изменены.','',
 'Воспроизведение: `node party-game/scripts/balance-audit.cjs --write`. Начальный seed '+a.seed+'; '+a.runs.length+' прогонов по '+a.roundsPerRun+' ходов, всего '+a.totalRounds+'. Каждый прогон получает seed + его индекс. Ходы завершаются без начисления очков: проверяются выбор контента и планирование, а не вероятность победы.','',
 '## Пулы','', '| Набор | Пул | Easy | Medium | Hard |','|---|---|---:|---:|---:|'];
 for(const [id,kinds]of Object.entries(a.pools))for(const[k,levels]of Object.entries(kinds))lines.push('| '+[id,k,levels.easy,levels.medium,levels.hard].join(' | ')+' |');
 lines.push('','`words` объединяет выбранные типы: у общего словаря word/phrase/idiom, у тем word/phrase. При выборе только фраз тематический пул — 12/12/11. Блиц всегда использует easy независимо от сложности; три уникальных слова за ход. Нулевой songs у тем означает явно отключённый «Напой».','',
 '## Частоты','', '| Набор | Настройка | Усложнение / обычные ходы | Фактически | Секретка с усложнением | Примерно с усложнением |','|---|---:|---:|---:|---:|---:|');
 for(const r of a.runs)lines.push('| '+[r.id,r.chance+'%',r.modified+'/'+r.optional,r.observedPercent+'%',r.forcedModified+'/'+r.forced,r.approxModified+'/'+r.approx].join(' | ')+' |');
 lines.push('','Частота считается только среди допускающих случайное усложнение ходов. Секретка учитывается отдельно: усложнение обязательно. «Примерно» усложнений не получает. Отклонения на конечной выборке ожидаемы; заданные 10/20/50/100% не корректировались.','',
 '| Набор / шанс | Слова | Жесты | Нарисуй | Напой | Данетки | Секретка | Блиц | Примерно | Микс E/M/H |','|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
 for(const r of a.runs)lines.push('| '+[r.id+' / '+r.chance+'%',...['talk','mime','draw','sing','yesno','secret','blitz','approx'].map(m=>r.counts[m]||0),['easy','medium','hard'].map(l=>r.levels[l]).join('/')].join(' | ')+' |');
 lines.push('','Выбор режима исключает последние два режима. Таблица показывает конечные частоты, а не обещание одинакового числа каждого режима. «Микс» даёт ровно '+a.roundsPerRun/3+' ходов каждой сложности во всех прогонах.','',
 '## Повторы и тупики','',
 '- Проверено '+a.settings.checked+' допустимых комбинаций двух тем: все непустые подмножества семи режимов × три набора типов × четыре сложности. Тупиков: '+a.settings.deadEnds+'. Песни и отсутствующие фразеологизмы явно недоступны, без подстановки общего словаря.',
 '- Во всех '+a.totalRounds+' ходах нет преждевременного повтора внутри фактического пула, пока остаётся неиспользованная альтернатива. Сброс цикла разрешён после исчерпания. В каждом Блице ровно три разных слова.',
 '- Повторов усложнения из последних пяти при наличии незаблокированного подходящего варианта: '+a.runs.reduce((s,r)=>s+r.unnecessaryRepeats,0)+'. Ослабление самого старого ограничения из-за малого применимого пула: '+a.runs.reduce((s,r)=>s+r.releasedOldest,0)+'. Это предусмотренный ограниченный fallback, а не изменение каталога.',
 '- Секретка тематических партий выбирает только talk/mime/draw/yesno. Все четыре способа представлены в прогонах; пустых способов и общих числовых вопросов в теме нет.','',
 '## Ограничения и дальнейшие улучшения','',
 '1. У каждой темы только 30 коротких easy-слов: 10 полных Блицев до нового цикла. В «Данетках» 9/8/8 персон, в режиме только фраз 12/12/11 заданий. Для длинных вечеринок первыми расширять эти пулы, особенно easy-слова и узнаваемые личности.',
 '2. words и blitz имеют разные истории использования. Поэтому знакомое слово может встретиться в другом режиме до исчерпания его собственного пула. Это действующая механика; глобальное объединение историй требует отдельного решения и здесь не выполнялось. Таких переходов в симуляции: '+a.runs.reduce((s,r)=>s+r.crossKindRepeats,0)+'.',
 '3. Конечные пулы циклические: отсутствие повторов навсегда не обещается. Детальные числа сбросов каждого пула сохранены в `balance-audit.json`.',
 '4. Статистика не измеряет сложность объяснения, узнаваемость персон и справедливость очков между людьми. Следующий шаг — наблюдения живых партий и редакторская проверка сложности; автоматическая перенастройка наград, длительности, риска и шансов не обоснована.','');
 return lines.join('\n');
}
if(require.main===module){const a=audit();if(process.argv.includes('--write')){fs.writeFileSync(require('node:path').join(__dirname,'../BALANCE-AUDIT.md'),markdown(a));fs.writeFileSync(require('node:path').join(__dirname,'../balance-audit.json'),JSON.stringify(a,null,2)+'\n')}console.log(JSON.stringify({totalRounds:a.totalRounds,settings:a.settings,pools:a.pools,runs:a.runs.map(({id,chance,observedPercent,unnecessaryRepeats,releasedOldest})=>({id,chance,observedPercent,unnecessaryRepeats,releasedOldest}))},null,2))}
module.exports={simulate,poolReport,checkSettings,audit,markdown};
