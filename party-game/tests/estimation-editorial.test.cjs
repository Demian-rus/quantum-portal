'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {readDataset,validate,nearCandidates,digest,numericAnswer}=require('../scripts/content.cjs');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const data=readDataset(),selection=require('../content/editorial/estimation-selection-v3.json'),decisions=require('../content/editorial/estimation-active-review-v3.json');
const additions=data.questions.filter(q=>q.pack==='approx-estimation-v3'),revisions=data.questions.filter(q=>q.pack==='approx-estimation-revision-v3'),plain=x=>JSON.parse(JSON.stringify(x));
test('TASK009 F recovers exactly 300 independent additions in three reviewed batches with the agreed difficulty split',()=>{
 assert.equal(additions.length,300);assert.equal(new Set(additions.map(q=>q.meta.measurementKey)).size,300);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(l=>[l,additions.filter(q=>q.difficulty===l).length])),{easy:89,medium:134,hard:77});
 const sources=require('../content/editorial/estimation-sources-v3.json'),review=require('../content/editorial/estimation-new-review-v3.json');
 assert.equal(Object.keys(sources).length,111);assert.equal(new Set(Object.values(sources).map(s=>s.url)).size,111);assert.deepEqual(review.map(q=>q.id),additions.map(q=>q.id));assert.ok(review.every(q=>q.decision==='accept'));
 for(const batch of [1,2,3])assert.equal(additions.filter(q=>q.meta.batch===batch).length,100);
 for(const q of additions){const source=sources[q.meta.sourceKey];assert.equal(q.source,source.url);assert.equal(q.meta.checkedAt,source.checkedAt);assert.ok(source.reference&&q.unit&&q.note&&Number.isFinite(numericAnswer(q.answer)));assert.deepEqual(q.categories,source.categories);assert.ok(q.question.length<=160);assert.doesNotMatch(q.question,/^В каком году|Сколько миллиметров в одном|Сколько месяцев в календарном/)}
});
test('TASK009 F every one of the 163 E-active questions has a decision and revisions preserve numerical identity',()=>{
 assert.equal(decisions.length,163);assert.equal(new Set(decisions.map(r=>r.id)).size,163);assert.deepEqual(Object.fromEntries(['keep','revise','retire'].map(d=>[d,decisions.filter(r=>r.decision===d).length])),{keep:114,revise:48,retire:1});assert.equal(revisions.length,48);
 const sourceChecks=require('../content/editorial/estimation-revision-sources-v3.json');assert.equal(sourceChecks.length,48);
 for(const q of revisions){const old=data.questions.find(x=>x.id===q.meta.replacesQuestionId),r=decisions.find(x=>x.id===old.id),proof=sourceChecks.find(x=>x.id===q.id);assert.equal(r.replacementId,q.id);assert.notEqual(q.question,old.question);for(const field of ['answer','unit','source','difficulty','categories'])assert.deepEqual(q[field],old[field]);assert.ok(proof.reference&&proof.answerUnchanged&&proof.unitUnchanged)}
 assert.equal(decisions.find(r=>r.id==='approx-20132').decision,'retire');assert.match(data.questions.find(q=>q.id==='approx-20132').question,/1961/);
 assert.match(revisions.find(q=>q.meta.replacesQuestionId==='approx-20004').question,/просвет/);
});
test('TASK009 F pre-F catalogs and every historical pool are preserved',()=>{
 const lock=require('../content/editorial/estimation-pre-f-lock.json');for(const key of ['cards','questions','packs'])assert.equal(digest(data[key].slice(0,lock[key].count)),lock[key].sha256,key);
 const h=createSimulation(22);h.eval('globalThis.beforeF=QUIP_APPROX_QUESTIONS.slice(0,300)');
 for(const pack of data.packs.slice(0,lock.packs.count))for(const level of ['easy','medium','hard']){h.context.args={selection:{id:pack.id,version:pack.version},level};assert.deepEqual(plain(h.eval('getPackQuestionPool(args.selection,args.level)')),plain(h.eval('getPackQuestionPool(args.selection,args.level,beforeF)')))}
 const oldReview=require('../content/editorial/estimation-historical-review.json');assert.equal(oldReview.length,150);assert.equal(oldReview.filter(r=>r.decision!=='retain').length,137);
});
test('TASK009 F explicit current pools have exact sizes, one revision per measurement, and unchanged nonnumeric tasks',()=>{
 const h=createSimulation(23);const active=selection.activeIds.map(id=>data.questions.find(q=>q.id===id));assert.equal(active.length,462);assert.equal(new Set(selection.activeIds).size,462);
 const replaced=new Set(revisions.map(q=>q.meta.replacesQuestionId));assert.ok(active.every(q=>!replaced.has(q.id)&&q.id!=='approx-20132'));
 for(const p of selection.pools){h.context.p=p;const pool=plain(h.eval('PARTY_CARD_LEVELS.flatMap(level=>getPackQuestionPool(p,level))'));assert.equal(pool.length,p.questions);assert.deepEqual(new Set(pool.map(q=>q.id)),new Set(active.filter(q=>p.id==='general'||q.categories.includes(p.id)).map(q=>q.id)));for(const level of ['easy','medium','hard']){assert.equal(pool.filter(q=>q.difficulty===level).length,p.levels[level]);assert.ok(p.levels[level]>=5)}
  const oldVersion=p.id==='general'?5:3;for(const kind of ['words','blitz','songs','people'])for(const level of ['easy','medium','hard']){h.context.args={id:p.id,before:oldVersion,after:p.version,kind,level};assert.deepEqual(plain(h.eval('getPackCardPool({id:args.id,version:args.before},args.kind,args.level,["word","phrase","idiom"])')),plain(h.eval('getPackCardPool({id:args.id,version:args.after},args.kind,args.level,["word","phrase","idiom"])')))}
 }
});
test('TASK009 F all near candidates are reviewed and same-source explanations do not give another active answer',()=>{
 const active=selection.activeIds.map(id=>data.questions.find(q=>q.id===id)),review=require('../content/editorial/estimation-near-review-v3.json');assert.deepEqual(review.map(p=>p.ids),nearCandidates(active,'question').map(p=>p.ids));assert.ok(review.every(p=>p.decision==='distinct-estimates'&&p.reason));
 for(const q of active){const numbers=[...q.note.matchAll(/[-−]?\d+(?:[.,]\d+)?/g)].map(m=>numericAnswer(m[0]));for(const other of active)if(q.id!==other.id&&q.source===other.source&&numericAnswer(other.answer)>=3)assert.ok(!numbers.includes(numericAnswer(other.answer)),q.id+' explanation discloses '+other.id)}
 assert.doesNotMatch(additions.find(q=>q.id==='approx-22264').note,/17/);
});
test('TASK009 F revealed pre-F questions restore exactly while only new games use the latest pack versions',()=>{
 const store=new Map(),h=createSimulation(24,store);h.eval('options.modes=["approx"];options.dice=false;newGame();game.contentPack={id:"general",version:5};roll();game.current.question={...QUIP_APPROX_QUESTIONS.find(q=>q.id==="approx-20132")};game.current.answerRevealed=true;game.phase="judge";game.dice=true;persist()');const snapshot=h.eval('JSON.stringify(game)'),again=createSimulation(25,store);assert.equal(again.eval('JSON.stringify(game)'),snapshot);assert.equal(again.eval('game.current.question.answer'),'333');again.eval('Math.random=()=>{throw Error("no reselection on restore")};render()');assert.equal(again.eval('JSON.stringify(game)'),snapshot);
 for(const p of selection.pools){again.context.p=p;again.eval('Math.random=()=>.99999;options.contentPack={id:p.id,version:p.id==="general"?5:3};options.modes=["approx"];options.difficulty="hard";options.dice=false;newGame();roll()');assert.equal(again.eval('game.contentPack.version'),({general:15,geography:6,science:8})[p.id]);assert.ok(selection.activeIds.includes(again.eval('game.current.question.id')));assert.equal(again.eval('game.rulesVersion'),5)}assert.equal(JSON.parse(store.get('iskra-party:v1')).version,1);
});
test('TASK009 F checked rounding and edition/measurement boundaries are retained',()=>{
 const by=id=>additions.find(q=>q.id==='approx-'+id),num=id=>numericAnswer(by(id).answer);
 assert.equal(num(22004),Math.round(12*2.54*10)/10);assert.equal(num(22112),Math.round(204*.3048));assert.equal(num(22239),Math.round(134300*.45359237/1000));assert.equal(num(22242),Math.round(48.25));assert.equal(num(22286),Math.round(1246.9));assert.equal(num(22298),Math.round(18/10)*10);assert.equal(num(22299),Math.round(18.6));assert.equal(num(22300),Math.round(23.3));
 assert.match(by(22141).question,/нью-йоркского/);assert.match(by(22285).question,/феврале 2021/);assert.match(by(22290).question,/2018/);assert.match(by(22293).question,/жидкой воды/);assert.match(by(22297).question,/1966/);
});
test('TASK009 F metadata validation also covers v3 and offline artifacts reference matching current catalogs',()=>{
 const bad=structuredClone(data);delete bad.questions.find(q=>q.meta?.estimationVersion===3).meta.sourceKey;assert.ok(validate(bad).errors.some(e=>e.code==='estimation-review'));assert.ok(validate(data).ok);
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');for(const file of ['approx-questions.js','content-packs.js']){const url=html.match(new RegExp(file.replace('.','\\.')+'\\?v=\\d+'))[0];assert.ok(sw.includes(url))}assert.match(sw,/kvip-pwa-v\d+-/);
});
