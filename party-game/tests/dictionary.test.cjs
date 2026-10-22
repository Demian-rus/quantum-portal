'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {readDataset,validate}=require('../scripts/content.cjs'),{audit}=require('../scripts/dictionary-audit.cjs'),{createSimulation}=require('../scripts/game-simulation.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
test('TASK009 D1 adds 637 standalone words and 331 scenes/expressions with reviewed tiers and categories',()=>{
 const a=audit();assert.equal(a.added,968);assert.equal(a.byType.word,637);assert.equal(a.byType.phrase+a.byType.idiom,331);assert.equal(a.newExactCollisions.length,0);assert.equal(a.newNearCandidates.length,0);assert.ok(Object.keys(a.byCategory).length>=10);assert.ok(a.newBlitzWords>=80);
 for(const levels of Object.values(a.typeDifficulty))for(const level of ['easy','medium','hard'])assert.ok(levels[level]>0);
 const rows=readDataset().sources.find(s=>s.path==='cards/general-expansion-v1.json').rows;
 assert.ok(rows.every(r=>r.categories.length&&r.pack==='general-expansion-v1'));assert.ok(rows.filter(r=>r.type==='word').every(r=>typeof r.meta.concreteObject==='boolean'));
});
test('TASK009 D1 historical general and thematic pools are byte-equivalent with new records present',()=>{
 const data=readDataset(),historical=data.sources.filter(s=>s.kind==='cards'&&s.immutable).flatMap(s=>s.rows),questions=data.sources.filter(s=>s.kind==='questions'&&s.immutable).flatMap(s=>s.rows),h=createSimulation(1);h.context.historical=historical;h.context.oldQuestions=questions;
 for(const id of ['general','geography','science'])for(const version of id==='general'?[1,2]:[2])for(const kind of ['words','blitz','songs','people'])for(const level of ['easy','medium','hard']){
  h.context.args={id,version,kind,level};assert.deepEqual(plain(h.eval('getPackCardPool(args,args.kind,args.level,["word","phrase","idiom"])')),plain(h.eval('getPackCardPool(args,args.kind,args.level,["word","phrase","idiom"],historical)')));
 }
 for(const level of ['easy','medium','hard']){h.context.level=level;assert.deepEqual(plain(h.eval('getPackQuestionPool({id:"general",version:2},level)')),plain(h.eval('getPackQuestionPool({id:"general",version:2},level,oldQuestions)')))}
});
test('TASK009 D1 only new general parties adopt latest content; an old active round and its next pool stay pinned',()=>{
 const store=new Map(),h=createSimulation(1,store);h.eval('options.modes=["talk"];options.dice=false;options.complications=false;newGame()');assert.equal(h.eval('game.contentPack.version'),h.eval('latestGeneralPackSelection().version'));
 h.eval('game.contentPack={id:"general",version:2};roll();game.dice=true;persist()');const snapshot=h.eval('JSON.stringify(game)'),again=createSimulation(2,store);assert.equal(again.eval('JSON.stringify(game)'),snapshot);
 assert.equal(again.eval('getPackCardPool(game.contentPack,"words","easy",["word"]).some(r=>r.pack==="general-expansion-v1")'),false);
 again.eval('newGame()');assert.equal(again.eval('game.contentPack.version'),again.eval('latestGeneralPackSelection().version'));assert.ok(again.eval('getPackCardPool(game.contentPack,"words","easy",["word"]).some(r=>r.pack==="general-expansion-v1")'));
});
test('TASK009 D1 cannot silently reuse a historical source or activate future themes',()=>{
 const d=readDataset(),source=d.sources.find(s=>s.path==='cards/general-expansion-v1.json');source.rows[0].pack='core';assert.ok(validate(d).errors.some(e=>e.code==='historical-origin'));
 const h=createSimulation(3);assert.deepEqual(plain(h.eval('listThematicPacks(options).filter(r=>r.available).map(r=>r.pack.id).sort()')),['geography','science']);
 assert.equal(h.eval('Object.values(QUIP_CONTENT_PACKS).filter(p=>p.id!=="general"&&!p.enabled).length'),6);
});
test('TASK009 D1 editorial exclusions and distribution report reproduce exactly',()=>{
 const result=audit(),saved=JSON.parse(fs.readFileSync(path.join(__dirname,'../dictionary-audit.json'),'utf8'));assert.deepEqual(result,saved);
 for(const file of result.editorialReview){const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));assert.ok(rows.length);assert.ok(rows.every(row=>(row.text||row.texts)&&row.reason&&row.decision))}
});
