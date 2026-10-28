'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../scripts/content.cjs');
test('M1 memes are independently categorized inside latest general pack, no new game mode',()=>{
 const data=api.readDataset(),before=data.packs.find(p=>p.id==='general'&&p.version===49),after=data.packs.find(p=>p.id==='general'&&p.version===50);
 assert.ok(before&&after);assert.deepEqual(data.manifest.categories.find(c=>c.id==='memes'),{id:'memes',name:'Мемы'});
 const rows=data.cards.filter(c=>c.pack==='general-memes-v1'),ids=rows.map(c=>c.id);
 assert.equal(rows.length,20);assert.equal(rows.filter(c=>c.type==='word').length,6);assert.equal(rows.filter(c=>c.type==='phrase').length,14);
 assert.ok(rows.every(c=>c.categories.length===1&&c.categories[0]==='memes'));
 assert.ok(rows.every(c=>c.type==='word'?!/\\s/u.test(c.text):/\\s/u.test(c.text)));
 assert.equal(new Set(rows.map(c=>c.id)).size,20);assert.equal(new Set(rows.map(c=>api.normalize(c.text))).size,20);
 assert.equal(before.criteria.cardIds.length,7000);assert.equal(after.criteria.cardIds.length,7020);
 assert.deepEqual(after.criteria.cardIds.slice(0,7000),before.criteria.cardIds);
 assert.deepEqual(after.criteria.cardIds.slice(7000),ids);
 assert.ok(data.packs.filter(p=>p.id!=='general').every(p=>p.criteria.cardIds.every(id=>!ids.includes(id))));
 assert.deepEqual(after.criteria.cardIds.filter(id=>!ids.includes(id)),before.criteria.cardIds);
 assert.ok(api.validate(data).ok,'Full historical locks and content validation remain active');
});
