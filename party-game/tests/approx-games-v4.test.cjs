'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../scripts/content.cjs');
test('GQ4 append-only 15 independently sourced in-game community estimates, preserving historical pools',()=>{
 const d=api.readDataset(),f=d.questions.filter(q=>q.pack==='approx-games-v4'),old=d.packs.find(p=>p.id==='general'&&p.version===64),p=d.packs.find(p=>p.id==='general'&&p.version===65);
 assert.ok(old&&p);assert.equal(f.length,15);assert.equal(d.questions.length,739);
 assert.deepEqual(f.map(x=>x.id),Array.from({length:15},(_,i)=>'approx-'+(23301+i)));
 assert.equal(new Set(f.map(x=>api.normalize(x.question))).size,15);
 assert.equal(new Set(f.map(x=>x.meta.measurementKey)).size,15);
 assert.ok(f.every(q=>q.categories.length===1&&q.categories[0]==='videogames'&&q.question.length<=160));
 assert.ok(f.every(q=>q.note&&q.unit&&q.source.startsWith('https://www.guinnessworldrecords.com/')&&q.meta.estimationVersion===3&&q.meta.checkedAt==='2026-10-29'&&q.meta.asOf&&Number.isFinite(api.numericAnswer(q.answer))));
 const proof=require('../content/editorial/approx-games-v4-sources.json');
 for(const q of f){const x=proof[q.meta.sourceKey];assert.ok(x&&x.url===q.source&&x.measurementKey===q.meta.measurementKey&&x.asOf===q.meta.asOf);}
 assert.equal(old.criteria.cardIds.length,7415);assert.equal(p.criteria.cardIds.length,7430);
 assert.deepEqual(p.criteria.cardIds.slice(0,7415),old.criteria.cardIds);
 assert.deepEqual(p.criteria.cardIds.slice(-15),f.map(x=>x.id));
 assert.equal(new Set(p.criteria.cardIds).size,7430);
 const existing=new Set(d.questions.filter(x=>x.pack!=='approx-games-v4').map(x=>api.normalize(x.question)));
 assert.ok(f.every(x=>!existing.has(api.normalize(x.question))));
 const newIds=new Set(f.map(x=>x.id));
 for(const pack of d.packs.filter(p=>p.id!=='general'||p.version<65))assert.ok(!pack.criteria.cardIds?.some(id=>newIds.has(id)),'Historic pack altered '+pack.id+'@'+pack.version);
 assert.equal(api.validate(d).errors.length,0);
});