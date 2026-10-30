'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const api=require('../scripts/content.cjs');
test('GQ1: 16 dated videogame estimates, sourced numbers, original snapshots and independent measurements',()=>{
 const data=api.readDataset(),old=data.packs.find(p=>p.id==='general'&&p.version===61),next=data.packs.find(p=>p.id==='general'&&p.version===62);
 assert.ok(old&&next);
 const fresh=data.questions.filter(q=>q.pack==='approx-games-v1'),sources=require('../content/editorial/approx-games-v1-sources.json');
 assert.equal(fresh.length,16);
 assert.equal(new Set(fresh.map(q=>q.id)).size,16);
 assert.equal(new Set(fresh.map(q=>api.normalize(q.question))).size,16);
 assert.equal(new Set(fresh.map(q=>q.meta.measurementKey)).size,16);
 assert.deepEqual(fresh.map(q=>q.id),Array.from({length:16},(_,i)=>'approx-'+(23001+i)));
 assert.ok(fresh.every(q=>q.categories.length===1&&q.categories[0]==='videogames'));
 assert.ok(fresh.every(q=>q.difficulty==='easy'||q.difficulty==='medium'||q.difficulty==='hard'));
 assert.ok(fresh.every(q=>Number.isFinite(api.numericAnswer(q.answer))&&api.numericAnswer(q.answer)>0));
 assert.ok(fresh.every(q=>q.question.length<=160&&!/В каком году|сколько\s+(?:клеток|игроков|миллиметров)\s+в\b/iu.test(q.question)));
 assert.ok(fresh.every(q=>q.unit&&q.note&&q.source.startsWith('https://')&&q.meta.estimationVersion===3&&q.meta.checkedAt==='2026-10-29'));
 for(const q of fresh){const s=sources[q.meta.sourceKey];assert.ok(s&&s.url===q.source&&s.checkedAt===q.meta.checkedAt&&s.measurementKey===q.meta.measurementKey);}
 assert.equal(old.criteria.cardIds.length,7369);
 assert.equal(next.criteria.cardIds.length,7385);
 assert.deepEqual(next.criteria.cardIds.slice(0,7369),old.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(-16),fresh.map(q=>q.id));
 assert.equal(new Set(next.criteria.cardIds).size,7385);
 for(const p of data.packs.filter(x=>x.id!=='general'||x.version<62))assert.ok(!p.criteria.cardIds?.includes('approx-23001'),'Historical/question theme pool changed '+p.id+'@'+p.version);
 const existing=data.questions.filter(q=>q.pack!=='approx-games-v1'),historic=new Set(existing.map(q=>api.normalize(q.question)));
 assert.ok(fresh.every(q=>!historic.has(api.normalize(q.question))));
 assert.equal(api.validate(data).errors.length,0);
});