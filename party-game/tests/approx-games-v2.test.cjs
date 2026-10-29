'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../scripts/content.cjs');
test('GQ2 sourced videogame magnitude estimates are independent, append-only and historic packs remain immutable',()=>{
 const d=api.readDataset(),f=d.questions.filter(q=>q.pack==='approx-games-v2'),prev=d.packs.find(p=>p.id==='general'&&p.version===62),next=d.packs.find(p=>p.id==='general'&&p.version===63);
 assert.equal(f.length,15);assert.ok(prev&&next);assert.equal(d.questions.length,679);
 assert.deepEqual(f.map(q=>q.id),Array.from({length:15},(_,i)=>'approx-'+(23101+i)));
 assert.equal(new Set(f.map(q=>api.normalize(q.question))).size,15);
 assert.equal(new Set(f.map(q=>q.meta.measurementKey)).size,15);
 assert.ok(f.every(q=>q.categories.length===1&&q.categories[0]==='videogames'&&q.question.length<=160));
 assert.ok(f.every(q=>q.source.startsWith('https://www.guinnessworldrecords.com/')&&q.unit&&q.note&&q.meta.estimationVersion===3&&q.meta.checkedAt==='2026-10-29'));
 assert.ok(f.every(q=>Number.isFinite(api.numericAnswer(q.answer))&&api.numericAnswer(q.answer)>0));
 const records=require('../content/editorial/approx-games-v2-sources.json');
 for(const q of f){const source=records[q.meta.sourceKey];assert.ok(source&&source.url===q.source&&source.asOf&&source.measurementKey===q.meta.measurementKey);}
 assert.equal(prev.criteria.cardIds.length,7385);assert.equal(next.criteria.cardIds.length,7400);
 assert.deepEqual(next.criteria.cardIds.slice(0,7385),prev.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(-15),f.map(q=>q.id));
 assert.equal(new Set(next.criteria.cardIds).size,7400);
 const historic=new Set(d.questions.filter(q=>q.pack!=='approx-games-v2').map(q=>api.normalize(q.question)));
 assert.ok(f.every(q=>!historic.has(api.normalize(q.question))));
 const newIds=new Set(f.map(q=>q.id));
 for(const p of d.packs.filter(p=>!(p.id==='general'&&p.version>=63)))assert.ok(!p.criteria.cardIds?.some(id=>newIds.has(id)),'Historical pool changed: '+p.id+'@'+p.version);
 assert.equal(api.validate(d).errors.length,0);
});