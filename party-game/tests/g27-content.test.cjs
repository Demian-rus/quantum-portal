'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../scripts/content.cjs');

test('G27 has 40 words and 10 phrases split 20/20/10, with stable ID namespace',()=>{
 const d=api.readDataset(),rows=d.cards.filter(c=>c.pack==='general-diversity-v13');
 assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(t=>rows.filter(c=>c.difficulty===t).length),[20,20,10]);
 for(const [difficulty,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){
  assert.equal(rows.filter(c=>c.difficulty===difficulty&&c.type==='word').length,w);
  assert.equal(rows.filter(c=>c.difficulty===difficulty&&c.type==='phrase').length,p);
 }
 for(let i=0;i<40;i++)assert.equal(rows.filter(c=>c.type==='word')[i].id,'word-052'+String(i+1).padStart(3,'0'));
 for(let i=0;i<10;i++)assert.equal(rows.filter(c=>c.type==='phrase')[i].id,'phrase-052'+String(i+1).padStart(3,'0'));
 const tags=new Set(d.manifest.categories.map(c=>c.id));
 for(const c of rows){assert.ok(c.text&&c.categories.length>0&&c.categories.every(tag=>tags.has(tag)));assert.equal(c.pack,'general-diversity-v13')}
});
test('G27 general@29 extends only general@28, preserving all historical catalogs',()=>{
 const d=api.readDataset(),previous=d.packs.find(p=>p.id==='general'&&p.version===28),next=d.packs.find(p=>p.id==='general'&&p.version===29),published=d.packs.find(p=>p.id==='general'&&p.version===27);
 assert.ok(previous&&next&&published);
 assert.equal(published.criteria.cardIds.length,6000);
 assert.equal(previous.criteria.cardIds.length,6050);
 assert.equal(next.criteria.cardIds.length,6100);
 assert.deepEqual(next.criteria.cardIds.slice(0,6050),previous.criteria.cardIds);
 assert.equal(new Set(next.criteria.cardIds).size,6100);
 assert.deepEqual(next.criteria.cardIds.slice(6050),d.cards.filter(c=>c.pack==='general-diversity-v13').map(c=>c.id));
 const oldTexts=new Set(d.cards.filter(c=>c.pack!=='general-diversity-v13').map(c=>api.normalize(c.text)));
 const fresh=new Set();
 for(const c of d.cards.filter(c=>c.pack==='general-diversity-v13')){const n=api.normalize(c.text);assert.ok(!oldTexts.has(n)&&!fresh.has(n),c.text);fresh.add(n)}
 assert.ok(api.validate(d).ok,'original dictionary validation passes');
});
