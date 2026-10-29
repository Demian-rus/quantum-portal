'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../scripts/content.cjs');
test('GQ6: 15 sourced gaming magnitudes are unique and general@67 only appends IDs',()=>{
 const d=api.readDataset(),newRows=d.questions.filter(q=>q.pack==='approx-games-v6');
 const before=d.packs.find(p=>p.id==='general'&&p.version===66),after=d.packs.find(p=>p.id==='general'&&p.version===67);
 assert.ok(before&&after);assert.equal(newRows.length,15);assert.equal(d.questions.length,739);
 assert.deepEqual(newRows.map(q=>q.id),Array.from({length:15},(_,i)=>'approx-'+(23501+i)));
 assert.equal(new Set(newRows.map(q=>api.normalize(q.question))).size,15);
 assert.equal(new Set(newRows.map(q=>q.meta.measurementKey)).size,15);
 assert.ok(newRows.every(q=>q.question.length<=160&&q.categories.length===1&&q.categories[0]==='videogames'));
 assert.ok(newRows.every(q=>q.unit&&q.note&&q.source.startsWith('https://www.guinnessworldrecords.com/')&&q.meta.estimationVersion===3&&q.meta.batch===6));
 assert.ok(newRows.every(q=>q.meta.checkedAt==='2026-10-29'&&q.meta.asOf&&Number.isFinite(api.numericAnswer(q.answer))&&api.numericAnswer(q.answer)>0));
 const sources=require('../content/editorial/approx-games-v6-sources.json');
 for(const q of newRows){const s=sources[q.meta.sourceKey];assert.ok(s&&s.url===q.source&&s.asOf===q.meta.asOf&&s.measurementKey===q.meta.measurementKey&&s.checkedAt===q.meta.checkedAt);}
 assert.equal(Object.keys(sources).length,15);
 assert.equal(before.criteria.cardIds.length,7445);assert.equal(after.criteria.cardIds.length,7460);
 assert.deepEqual(after.criteria.cardIds.slice(0,7445),before.criteria.cardIds);
 assert.deepEqual(after.criteria.cardIds.slice(-15),newRows.map(q=>q.id));
 assert.equal(new Set(after.criteria.cardIds).size,7460);
 const older=new Set(d.questions.filter(q=>q.pack!=='approx-games-v6').map(q=>api.normalize(q.question)));
 assert.ok(newRows.every(q=>!older.has(api.normalize(q.question))));
 const newIds=new Set(newRows.map(q=>q.id));
 for(const p of d.packs.filter(p=>!(p.id==='general'&&p.version>=67)))
  assert.ok(!p.criteria.cardIds?.some(id=>newIds.has(id)),'Historical pool changed '+p.id+'@'+p.version);
 assert.equal(api.validate(d).errors.length,0);
});
