'use strict';
// One reproducible before/after experiment. Both selectors use the same seed,
// settings and initial random player; only mode selection consumes the stream.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSimulation}=require('./game-simulation.cjs');
const root=path.resolve(__dirname,'..');
function audit(){
 const h=createSimulation(10010);
 return JSON.parse(JSON.stringify(h.eval(`(()=>{
 const results=[],seedBase=10010,seeds=32;
 const lengths=[2,12,40,400];
 const rng=seed=>{let state=seed>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296}};
 const summarize=rows=>{
  const gaps=rows.map(r=>r.gap).sort((a,b)=>a-b),n=rows.length;
  const sum=key=>rows.reduce((s,row)=>s+row[key],0);
  return {games:n,meanGap:sum('gap')/n,p95Gap:gaps[Math.ceil(n*.95)-1],maxGap:gaps.at(-1),
   meanModeGap:sum('modeGap')/n,maxModeGap:Math.max(...rows.map(r=>r.maxModeGap)),
   immediateRepeats:sum('repeats'),repeatSlots:sum('repeatSlots'),recentTwoRepeats:sum('recentTwoRepeats'),
   mirroredPairs:sum('mirroredPairs'),pairs:sum('pairs'),starter0:sum('starter0'),
   meanPairedGap:sum('meanPairedGap')/n,maxStateBytes:Math.max(...rows.map(r=>r.stateBytes)),
   counts:Object.fromEntries(MODE_LIST.map(m=>[m.id,[0,1].map(p=>rows.reduce((s,r)=>s+r.counts[p][m.id],0))])),
   potential:[0,1].map(p=>rows.reduce((s,r)=>s+r.potential[p],0)),
   distinctSequences:new Set(rows.map(r=>r.sequence)).size};
 };
 for(const packId of ['general','geography','science'])for(const awardTo of ['setter','guesser']){
  const selection=latestContentPackSelection(packId);
  const settings={...options,awardTo,contentPack:selection,promptTypes:packId==='general'?['word','phrase','idiom']:['word','phrase']};
  settings.modes=compatibleAwardModes({...settings,modes:getContentPack(selection).allowedModes||MODE_LIST.map(m=>m.id)});
  const active=MODE_LIST.filter(m=>packModeAvailability(selection,settings,m.id).available).map(m=>m.id);
  const cases={talk:['talk'],secret:['secret'],approx:['approx'],twoCost:['talk','secret'],twoShared:['talk','approx'],three:['talk','secret','approx'],all:active};
  for(const [name,modes]of Object.entries(cases))for(const turns of lengths){
   const samples={old:[],new:[]};
   for(let sample=0;sample<seeds;sample++)for(const policy of ['old','new']){
    Math.random=rng((Math.imul(sample+1,0x9e3779b9)^seedBase)>>>0);
    game={...settings,modes,scoringVersion:2,rulesVersion:5,modeConfigVersion:1,awardPolicyVersion:1,
     roundIndex:0,startingTeamIndex:chooseStartingTeam(),scores:[0,0],modeHistory:[]};
    if(policy==='new'){game.modePlannerVersion=QUIP_MODE_PLANNER_VERSION;game.modePlannerState=freshModePlan();}
    const counts=[0,1].map(()=>Object.fromEntries(MODE_LIST.map(m=>[m.id,0]))),potential=[0,0],sequence=[];
    let repeats=0,recentTwoRepeats=0,mirroredPairs=0,pairedGap=0;
    for(let turn=0;turn<turns;turn++){
     const mode=pickMode('easy'),id=mode.id,recipient=awardTeamIndex();
     const points=modeOpportunityRewards(game,[id],'easy')[id];
     if(mode.supportsSharedAward)for(const p of [0,1]){counts[p][id]++;potential[p]+=points;}
     else{counts[recipient][id]++;potential[recipient]+=points;}
     if(sequence.at(-1)===id)repeats++;
     if(sequence.slice(-2).includes(id))recentTwoRepeats++;
     if(turn%2&&sequence.at(-1)===id)mirroredPairs++;
     sequence.push(id);game.modeHistory.push(id);game.roundIndex++;
     if(turn%2)pairedGap+=Math.abs(potential[0]-potential[1]);
    }
    const diffs=modes.map(id=>Math.abs(counts[0][id]-counts[1][id]));
    samples[policy].push({gap:Math.abs(potential[0]-potential[1]),modeGap:diffs.reduce((s,n)=>s+n,0)/modes.length,
     maxModeGap:Math.max(...diffs),counts,potential,repeats,repeatSlots:turns-1,recentTwoRepeats,mirroredPairs,pairs:turns/2,
     starter0:game.startingTeamIndex===0?1:0,meanPairedGap:pairedGap/(turns/2),
     stateBytes:JSON.stringify(game.modePlannerState||{}).length,sequence:sequence.join(',')});
   }
   results.push({packId,awardTo,name,modes,turns,old:summarize(samples.old),new:summarize(samples.new)});
  }
 }
 return {seedBase,seeds,lengths,results};
 })()`)));
}
function markdown(a){
 const round=n=>Number(n.toFixed(3)),percent=(n,d)=>(100*n/d).toFixed(1)+'%';
 const lines=['# КВИП — TASK 010: баланс возможностей','',
 'Воспроизведение: `node party-game/scripts/mode-balance-audit.cjs --write`. Один сравнительный эксперимент: '+a.results.length+' настроек × '+a.seeds+' seed × старый/новый выбор. Базовый seed '+a.seedBase+'; seed партии = (imul(индекс+1, 0x9e3779b9) XOR база) >>> 0. Используется production `pickMode`, а не его копия. Обе политики получают одинаковые настройки и поток случайных чисел; первым числом выбирается стартующий игрок. Счёт и успешность не участвуют.','',
 'Потенциал — базовая награда действующих правил V5; для Секретки добавлен обязательный бонус, для Блица — полная награда за три слова. Случайные усложнения не включены. «Примерно» добавляет одну и ту же возможность обоим игрокам; это не прогноз фактического ручного начисления. Сравнение фиксирует 2/12/40/400 ходов: только завершённые пары, без зависимой от результатов остановки по очкам.','',
 'Проверены общий, географический и научный наборы, setter/guesser, один режим (Слова, Секретка, Примерно), два (Слова + Секретка; Слова + Примерно), три и все совместимые режимы. Данетки доступны в guesser; исключены в setter действующей политикой. У тем нет Напой. Все эти ограничения сохранены.','',
 '## Алгоритм','',
 'Отдельная политика `modePlannerVersion:1` хранит восемь разностей количества возможностей между получателями и два последних режима. У общего режима разность всегда нулевая. Стоимость кандидата: сумма квадратов отклонений по режимам + половина квадрата разницы потенциальных наград. На первом ходе оценивается лучшая достижимая стоимость после ответа; конкретный ответ не фиксируется. На втором — накопленная стоимость завершённой пары.','',
 'Выбор случайный: вес = штраф недавнего повтора × exp(−(стоимость − минимум)/2). Штраф немедленного повтора: 0.15, предпоследнего — 0.55. Нулевых запретов нет; большой перекос может перевесить защиту от повторов. Нет перебросов, ожидания подходящего случайного числа или планирования партии целиком. При одном режиме RNG выбора не нужен. Это уменьшает перекосы, но не резервирует зеркальный ответ.','',
 '## Все совместимые режимы','',
 '| Набор | Получатель | Ходы | Средняя разница потенциала до → после | P95 до → после | Средняя разница числа режимов до → после | Повторы подряд до → после | Одинаковый режим в паре после |','|---|---|---:|---:|---:|---:|---:|'];
 for(const r of a.results.filter(r=>r.name==='all'))lines.push('| '+[r.packId,r.awardTo,r.turns,
  round(r.old.meanGap)+' → '+round(r.new.meanGap),r.old.p95Gap+' → '+r.new.p95Gap,
  round(r.old.meanModeGap)+' → '+round(r.new.meanModeGap),
  percent(r.old.immediateRepeats,r.old.repeatSlots)+' → '+percent(r.new.immediateRepeats,r.new.repeatSlots),
  percent(r.new.mirroredPairs,r.new.pairs)].join(' | ')+' |');
 lines.push('','## Граничные сочетания (общий набор, guesser)','','| Режимы | Ходы | Средняя разница потенциала до → после | Максимум до → после | Средняя разница числа режимов до → после | Повторы подряд после |','|---|---:|---:|---:|---:|---:|');
 for(const r of a.results.filter(r=>r.packId==='general'&&r.awardTo==='guesser'&&r.name!=='all'))lines.push('| '+[r.modes.join(', '),r.turns,round(r.old.meanGap)+' → '+round(r.new.meanGap),r.old.maxGap+' → '+r.new.maxGap,round(r.old.meanModeGap)+' → '+round(r.new.meanModeGap),percent(r.new.immediateRepeats,r.new.repeatSlots)].join(' | ')+' |');
 lines.push('','## Распределение режимов: общий набор, guesser, 400 ходов','','Числа — суммарные возможности первого/второго игрока по всем seed. У «Примерно» оба счётчика увеличиваются вместе. Индивидуальные средние абсолютные отклонения приведены выше; агрегаты не заменяют их.','','| Режим | До: игрок 0 / 1 | После: игрок 0 / 1 |','|---|---:|---:|');
 const all=a.results.find(r=>r.packId==='general'&&r.awardTo==='guesser'&&r.name==='all'&&r.turns===400);
 for(const id of all.modes)lines.push('| '+[id,all.old.counts[id].join(' / '),all.new.counts[id].join(' / ')].join(' | ')+' |');
 lines.push('','## Случайность и границы','',
 '- Для всех режимов общий/guesser/400: '+all.new.distinctSequences+' различных последовательностей на '+a.seeds+' seed; совпадения режимов внутри пары — '+percent(all.new.mirroredPairs,all.new.pairs)+'. Это конечная проверка разнообразия, не доказательство непредсказуемости генератора. Используется существующий Math.random, фиксированного расписания нет.',
 '- Стартовая сторона: '+all.new.starter0+' из '+a.seeds+' начал игрок 0. Отдельные тесты принудительно проверяют обе стороны во всех допустимых подмножествах, уровнях и схемах наград.',
 '- Состояние в этом эксперименте: максимум '+Math.max(...a.results.map(r=>r.new.maxStateBytes))+' байт JSON. Размер массива режимов и истории ограничен; значения разностей — безопасные целые числа.',
 '- На двух ходах невозможно одновременно гарантировать отсутствие повторов, равные награды и разные режимы. С одним режимом разнообразия нет; Секретка в каждой паре даёт равный потенциал, Примерно — общий потенциал каждый ход. При двух разных наградах прежнее строгое чередование закрепляло дорогой режим за одним игроком; теперь повторы необходимы для смены этой привязки.',
 '- При трёх режимах старое исключение последних двух превращается в фиксированный цикл. На 6/12 ходах он может давать точный нулевой перекос, а новый случайный выбор — небольшой ненулевой. Улучшение не универсально для каждой длины и сочетания; таблица показывает это явно. Здесь сохраняется случайность вместо обязательного цикла.',
 '- Одинаковый потенциал не гарантирует равной субъективной трудности, владения темой или победы. Усложнения, риск и успешность не адаптируются. Возможны временные отклонения; абсолютное равенство на каждой короткой партии не обещается.','',
 '## Сохранения и проверки','',
 'Новая политика включается только в `newGame`. Отсутствие версии сохраняет прежний pickMode и порядок RNG режим → сложность. Новая политика фиксируется вместе с выбранной карточкой до анимации; restore/render не выбирают заново. Неизвестное или повреждённое состояние защищает исходное сохранение. Версия Микса, таблицы наград, риск, таймеры, получатель и ключ `iskra-party:v1` сохранены. Кэш PWA и URL только изменённых runtime-скриптов обновлены; обработчики Back и fullscreen не менялись.','',
 'Целевые Node-тесты охватывают 6096 комбинаций (все непустые совместимые подмножества × 3 набора × получатели × четыре сложности × обе стартовые стороны), 73152 ограниченных перехода. Проверки reload включают текущую карточку, таймер, две политики планирования, историю, старые партии, неизвестные версии и независимость от счёта. Браузерный сценарий проверяет состояние выбора и после offline reload. GitHub Actions исполняет новый набор в logic; результаты CI конкретного коммита — в PR.','');
 return lines.join('\n');
}
if(require.main===module){
 const a=audit();
 for(const r of a.results){assert.equal(r.old.starter0,r.new.starter0);assert.ok(r.new.starter0>0&&r.new.starter0<a.seeds);if(['talk','secret','approx'].includes(r.name)){assert.equal(r.new.meanGap,0);assert.equal(r.old.meanGap,0)}}
 if(process.argv.includes('--write')){fs.writeFileSync(path.join(root,'MODE-BALANCE-AUDIT.md'),markdown(a));fs.writeFileSync(path.join(root,'mode-balance-audit.json'),JSON.stringify(a)+'\n')}
 console.log(JSON.stringify({settings:a.results.length,games:a.results.length*a.seeds*2,allLong:a.results.filter(r=>r.name==='all'&&r.turns===400).map(r=>({pack:r.packId,awardTo:r.awardTo,before:r.old.meanGap,after:r.new.meanGap,repeatPct:100*r.new.immediateRepeats/r.new.repeatSlots})),twoCost:a.results.find(r=>r.name==='twoCost'&&r.packId==='general'&&r.awardTo==='guesser'&&r.turns===40)},null,2));
}
module.exports={audit,markdown};
