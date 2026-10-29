'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../scripts/content.cjs');
test('GQ5: 15 independent dated gaming magnitude estimates, exact 7445 general IDs and historical pinning',()=>{
 const dataset=api.readDataset(),rows=dataset.questions.filter(q=>q.pack==='approx-games-v5');
 const before=dataset.packs.find(p=>p.id==='general'&&p.version===65),after=dataset.packs.find(p=>p.id==='general'&&p.version===66);
 assert.ok(before&&after);assert.equal(rows.length,15);assert.equal(dataset.questions.length,724);
 assert.deepEqual(rows.map(q=>q.id),Array.from({length:15},(_,i)=>'approx-'+(23401+i)));
 assert.equal(new Set(rows.map(q=>api.normalize(q.question))).size,15);
 assert.equal(new Set(rows.map(q=>q.meta.measurementKey)).size,15);
 assert.ok(rows.every(q=>q.categories.length===1&&q.categories[0]==='videogames'&&q.question.length<=160&&q.unit&&q.note));
 assert.ok(rows.every(q=>q.source.includes('.guinnessworldrecords.com/')&&q.meta.checkedAt==='2026-10-29'&&q.meta.asOf&&q.meta.estimationVersion===3));
 assert.ok(rows.every(q=>Number.isFinite(api.numericAnswer(q.answer))&&api.numericAnswer(q.answer)>0));
 const evidence=require('../content/editorial/approx-games-v5-sources.json');
 for(const q of rows){const item=evidence[q.meta.sourceKey];assert.ok(item&&item.url===q.source&&item.asOf===q.meta.asOf&&item.measurementKey===q.meta.measurementKey)}
 assert.equal(before.criteria.cardIds.length,7430);assert.equal(after.criteria.cardIds.length,7445);
 assert.deepEqual(after.criteria.cardIds.slice(0,7430),before.criteria.cardIds);
 assert.deepEqual(after.criteria.cardIds.slice(-15),rows.map(q=>q.id));
 assert.equal(new Set(after.criteria.cardIds).size,7445);
 const normalized=new Set(dataset.questions.filter(q=>q.pack!=='approx-games-v5').map(q=>api.normalize(q.question)));
 assert.ok(rows.every(q=>!normalized.has(api.normalize(q.question))));
 const ids=new Set(rows.map(q=>q.id));
 for(const pack of dataset.packs.filter(p=>!(p.id==='general'&&p.version>=66)))assert.ok(!pack.criteria.cardIds?.some(id=>ids.has(id)),'Changed historical pack '+pack.id+'@'+pack.version);
 assert.equal(api.validate(dataset).errors.length,0);
});