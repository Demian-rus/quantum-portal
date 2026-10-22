'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {readDataset,validate,numericAnswer}=require('../scripts/content.cjs'),{createSimulation}=require('../scripts/game-simulation.cjs');
const plain=x=>JSON.parse(JSON.stringify(x)),data=readDataset(),fresh=data.questions.filter(q=>q.pack==='approx-estimation-v2');
test('TASK009 E all 150 additions have checked real quantities and every former question has a decision',()=>{
 assert.equal(fresh.length,150);assert.equal(new Set(fresh.map(q=>q.id)).size,150);
 const sources=require('../content/editorial/estimation-sources-v2.json'),review=require('../content/editorial/estimation-historical-review.json');assert.equal(review.length,150);assert.equal(new Set(review.map(r=>r.id)).size,150);
 assert.equal(review.filter(r=>r.decision==='retain').length,13);assert.equal(review.filter(r=>r.decision==='historical-only-pending-source').length,4);
 for(const q of fresh){assert.ok(q.unit&&q.note&&Number.isFinite(numericAnswer(q.answer)));assert.equal(q.source,sources[q.meta.sourceKey].url);assert.equal(q.meta.checkedAt,sources[q.meta.sourceKey].checkedAt);assert.ok(q.question.length<=160);assert.doesNotMatch(q.question,/^В каком году|Сколько месяцев в календарном|Сколько миллиметров в одном/)}
 assert.ok(validate(data).ok);
});
test('TASK009 E old general and themed question pools remain object-equivalent',()=>{
 const h=createSimulation(1);h.context.beforeE=data.questions.filter(q=>q.pack!=='approx-estimation-v2');
 for(const selection of [{id:'general',version:1},{id:'general',version:2},{id:'general',version:3},{id:'general',version:4},{id:'geography',version:2},{id:'science',version:2}])for(const level of ['easy','medium','hard']){
  h.context.args={selection,level};assert.deepEqual(plain(h.eval('getPackQuestionPool(args.selection,args.level)')),plain(h.eval('getPackQuestionPool(args.selection,args.level,beforeE)')));
 }
});
test('TASK009 E new pools exclude retired questions and retain every nonnumeric task exactly',()=>{
 const h=createSimulation(2),active=require('../content/editorial/estimation-selection-v2.json'),ids=new Set([...active.newIds,...active.retainedHistoricalIds]);
 const pool=plain(h.eval('PARTY_CARD_LEVELS.flatMap(level=>getPackQuestionPool({id:"general",version:5},level))'));assert.equal(pool.length,163);assert.ok(pool.every(q=>ids.has(q.id)));assert.equal(pool.some(q=>q.id==='approx-0001'||q.id==='approx-8208'),false);
 for(const [id,before,after] of [['general',4,5],['geography',2,3],['science',2,3]])for(const kind of ['words','blitz','songs','people'])for(const level of ['easy','medium','hard']){
  h.context.args={id,before,after,kind,level};assert.deepEqual(plain(h.eval('getPackCardPool({id:args.id,version:args.before},args.kind,args.level,["word","phrase","idiom"])')),plain(h.eval('getPackCardPool({id:args.id,version:args.after},args.kind,args.level,["word","phrase","idiom"])')));
 }
 for(const id of ['general','geography','science'])for(const level of ['easy','medium','hard']){h.context.args={id,level};const n=h.eval('getPackQuestionPool(latestContentPackSelection(args.id),args.level).length');assert.ok(n>=5,id+'/'+level+' '+n)}
});
test('TASK009 E a revealed former arithmetic question restores byte-exact and keeps its original answer',()=>{
 const store=new Map(),h=createSimulation(3,store);h.eval('options.modes=["approx"];options.dice=false;newGame();game.contentPack={id:"general",version:4};roll();game.current.question={...QUIP_APPROX_QUESTIONS.find(q=>q.id==="approx-0001")};game.current.answerRevealed=true;game.phase="judge";game.dice=true;persist()');
 const snapshot=h.eval('JSON.stringify(game)'),again=createSimulation(4,store);assert.equal(again.eval('JSON.stringify(game)'),snapshot);assert.equal(again.eval('game.current.question.answer'),'12');again.eval('Math.random=()=>{throw Error("restore must not select")};render()');assert.equal(again.eval('JSON.stringify(game)'),snapshot);
 again.eval('Math.random=()=>0;options.modes=["approx"];options.dice=false;newGame();roll()');assert.equal(again.eval('game.contentPack.version'),again.eval('latestContentPackSelection("general").version'));assert.notEqual(again.eval('game.current.question.id'),'approx-0001');assert.equal(JSON.parse(store.get('iskra-party:v1')).version,1);
});
test('TASK009 E only new enabled thematic parties upgrade, disabled and unknown revisions remain blocked',()=>{
 for(const id of ['geography','science']){
  const h=createSimulation(5);h.context.id=id;h.eval('options.contentPack={id,version:2};options.modes=["approx"];options.promptTypes=["word"];options.difficulty="hard";options.dice=false;Math.random=()=>.99999;newGame();roll()');assert.equal(h.eval('game.contentPack.version'),h.eval('latestContentPackSelection(id).version'));assert.ok(h.eval('getPackQuestionPool(game.contentPack,"hard").some(q=>q.id===game.current.question.id)'));assert.equal(h.eval('game.current.question.categories.includes(id)'),true);
  const before=h.eval('JSON.stringify(game)');for(const version of [1,999]){h.context.version=version;h.eval('options.contentPack={id,version};newGame()');assert.equal(h.eval('JSON.stringify(game)'),before)}
 }
});
test('TASK009 E a catalog revision inherits stored theme preferences without rewriting old profiles',()=>{
 const h=createSimulation(6);h.eval('options.contentPack={id:"general",version:5};options.modes=["sing"];options.promptTypes=["idiom"];options.packPreferences={"science@2":{modes:["draw","approx"],promptTypes:["phrase"]}}');const before=h.eval('JSON.stringify(options.packPreferences)');
 assert.deepEqual(plain(h.eval('packSetupSettings({id:"science",version:3},options).modes')),['draw','approx']);assert.deepEqual(plain(h.eval('packSetupSettings({id:"science",version:3},options).promptTypes')),['phrase']);assert.equal(h.eval('JSON.stringify(options.packPreferences)'),before);
 h.eval('options.packPreferences["science@3"]={modes:["blitz"],promptTypes:["word"]}');assert.deepEqual(plain(h.eval('packSetupSettings({id:"science",version:3},options).modes')),['blitz']);
});
test('TASK009 E checked rounding examples and offline artifacts use the same static catalog',()=>{
 const bySource=(key,answer)=>fresh.find(q=>q.meta.sourceKey===key&&q.answer===answer);
 assert.equal(numericAnswer(bySource('iss','420').answer),Math.round(419725/1000/10)*10);assert.equal(numericAnswer(bySource('hoover','221').answer),Math.round(726.4*.3048));assert.equal(numericAnswer(bySource('moon-diameter','3480').answer),Math.round(3475/10)*10);assert.equal(numericAnswer(bySource('weather-records','408').answer),Math.round(113.2*3.6));
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),sw=fs.readFileSync(require.resolve('../sw.js'),'utf8');for(const file of ['approx-questions.js','content-packs.js','app.js']){const url=html.match(new RegExp(file.replace('.','\\.')+'\\?v=\\d+'))[0];assert.ok(sw.includes(url))}
 const broken=structuredClone(data);delete broken.questions.find(q=>q.meta?.estimationVersion===2).meta.sourceKey;assert.ok(validate(broken).errors.some(e=>e.code==='estimation-review'));
});
