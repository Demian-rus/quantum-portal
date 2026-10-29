'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../scripts/content.cjs');
test('GQ3: 15 verifiable in-game community-scale events append to general@64 and preserve every earlier question and pack',()=>{
 const d=api.readDataset(),f=d.questions.filter(q=>q.pack==='approx-games-v3'),prev=d.packs.find(x=>x.id==='general'&&x.version===63),next=d.packs.find(x=>x.id==='general'&&x.version===64);
 assert.ok(prev&&next);assert.equal(f.length,15);assert.equal(d.questions.length,724);
 assert.deepEqual(f.map(q=>q.id),Array.from({length:15},(_,i)=>'approx-'+(23201+i)));
 assert.equal(new Set(f.map(q=>api.normalize(q.question))).size,15);
 assert.equal(new Set(f.map(q=>q.meta.measurementKey)).size,15);
 assert.ok(f.every(q=>q.categories.length===1&&q.categories[0]==='videogames'&&q.question.length<=160&&q.unit&&q.note));
 assert.ok(f.every(q=>q.source.startsWith('https://www.guinnessworldrecords.com/')&&q.meta.estimationVersion===3&&q.meta.checkedAt==='2026-10-29'&&q.meta.asOf));
 assert.ok(f.every(q=>Number.isFinite(api.numericAnswer(q.answer))&&api.numericAnswer(q.answer)>0));
 const proof=require('../content/editorial/approx-games-v3-sources.json');
 for(const q of f){const source=proof[q.meta.sourceKey];assert.ok(source&&source.url===q.source&&source.measurementKey===q.meta.measurementKey&&source.asOf===q.meta.asOf)}
 assert.equal(prev.criteria.cardIds.length,7400);assert.equal(next.criteria.cardIds.length,7415);
 assert.deepEqual(next.criteria.cardIds.slice(0,7400),prev.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(-15),f.map(q=>q.id));
 assert.equal(new Set(next.criteria.cardIds).size,7415);
 const historic=new Set(d.questions.filter(q=>q.pack!=='approx-games-v3').map(q=>api.normalize(q.question)));
 assert.ok(f.every(q=>!historic.has(api.normalize(q.question))));
 const newIds=new Set(f.map(q=>q.id));
 for(const p of d.packs.filter(p=>!(p.id==='general'&&p.version>=64)))assert.ok(!p.criteria.cardIds?.some(id=>newIds.has(id)),'Historical pool changed: '+p.id+'@'+p.version);
 assert.equal(api.validate(d).errors.length,0);
});