'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {readDataset,validate,normalize}=require('../scripts/content.cjs'),{createSimulation}=require('../scripts/game-simulation.cjs'),H=require('../task-history.js');
const plain=x=>JSON.parse(JSON.stringify(x));
test('TASK009 D2 universal music themes have independent evidence, unique text and balanced languages',()=>{
 const d=readDataset(),rows=d.sources.find(s=>s.path==='cards/music-themes-v2.json').rows;
 assert.equal(rows.length,197);assert.equal(new Set(rows.map(r=>normalize(r.text))).size,197);
 assert.ok(rows.every(r=>r.meta.examples.length===2&&r.text.split(/\s+/).length<=2));
 for(const row of rows){assert.equal(new Set(row.meta.examples.map(e=>normalize(e.artist+' '+e.title))).size,2);for(const e of row.meta.examples)assert.ok(e.source.startsWith('https://')&&e.wordForm&&e.checkedAt)}
 const h=createSimulation(1),pool=plain(h.eval('PARTY_CARD_LEVELS.flatMap(level=>getPackCardPool({id:"general",version:4},"songs",level))'));
 assert.equal(pool.length,224);assert.equal(pool.filter(r=>r.meta.themeVersion!==2).length,27);assert.equal(new Set(pool.map(r=>normalize(r.text))).size,224);
 const ledger=require('../content/editorial/music-theme-review.json');assert.equal(ledger.filter(r=>r.language==='ru').length,118);assert.equal(ledger.filter(r=>r.language==='en').length,106);
 assert.ok(validate(d).ok);
});
test('TASK009 D2 earlier general and thematic pools remain object-equivalent, nonmusic is unchanged',()=>{
 const d=readDataset(),old=d.cards.filter(r=>r.pack!=='music-themes-v2'),h=createSimulation(2);h.context.beforeD2=old;
 for(const selection of [{id:'general',version:1},{id:'general',version:2},{id:'general',version:3},{id:'geography',version:2},{id:'science',version:2}])for(const kind of ['words','blitz','songs','people'])for(const level of ['easy','medium','hard']){
  h.context.args={...selection,kind,level};assert.deepEqual(plain(h.eval('getPackCardPool(args,args.kind,args.level,["word","phrase","idiom"])')),plain(h.eval('getPackCardPool(args,args.kind,args.level,["word","phrase","idiom"],beforeD2)')));
 }
 for(const kind of ['words','blitz','people'])for(const level of ['easy','medium','hard']){h.context.args={kind,level};assert.deepEqual(plain(h.eval('getPackCardPool({id:"general",version:4},args.kind,args.level,["word","phrase","idiom"])')),plain(h.eval('getPackCardPool({id:"general",version:3},args.kind,args.level,["word","phrase","idiom"])')))}
});
test('TASK009 D2 reviewed cross-mode words share history, arbitrary within-type duplicates are rejected',()=>{
 const d=readDataset();for(const group of d.manifest.reviewedCrossTypeCollisions){const [a,b]=group.ids.map(id=>d.cards.find(r=>r.id===id));assert.ok(H.taskRecordKeys(a).some(k=>H.taskRecordKeys(b).includes(k)))}
 const row=d.cards.find(r=>r.pack==='music-themes-v2');row.text=d.cards.find(r=>r.pack==='music-themes-v2'&&r.id!==row.id).text;assert.ok(validate(d).errors.some(e=>e.code==='normalized-duplicate'));
});
test('TASK009 D2 rule copy and saved song stay pinned, new parties alone adopt music policy',()=>{
 const store=new Map(),h=createSimulation(3,store);h.eval('options.dice=false;options.modes=["sing"];options.complications=false;newGame();roll()');assert.equal(h.eval('game.contentPack.version'),h.eval('latestGeneralPackSelection().version'));assert.match(h.eval('modeInformation().rule'),/любую песню/);
 h.eval('game.contentPack={id:"general",version:3};game.dice=true;persist()');const snapshot=h.eval('JSON.stringify(game)'),again=createSimulation(4,store);assert.equal(again.eval('JSON.stringify(game)'),snapshot);assert.doesNotMatch(again.eval('modeInformation().rule'),/любую песню/);
 again.eval('newGame();roll()');assert.match(again.eval('modeInformation().rule'),/любую песню/);
});
