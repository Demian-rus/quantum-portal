'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../scripts/content.cjs');
test('VG1 only expands general@51 with 50 Cyrillic videogames prompts, keeping theme and legacy separate',()=>{
 const d=api.readDataset(),old=d.packs.find(x=>x.id==='general'&&x.version===50),now=d.packs.find(x=>x.id==='general'&&x.version===51);
 assert.ok(old&&now);
 assert.equal(d.manifest.categories.filter(c=>c.id==='videogames'&&c.name==='Видеоигры').length,1,'Use existing videogames category');
 const rows=d.cards.filter(c=>c.pack==='general-games-v1'),newIds=rows.map(c=>c.id);
 assert.equal(rows.length,50);
 assert.equal(rows.filter(c=>c.type==='word').length,40);
 assert.equal(rows.filter(c=>c.type==='phrase').length,10);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(x=>[x,rows.filter(c=>c.difficulty===x).length])),{easy:20,medium:20,hard:10});
 assert.ok(rows.every(c=>c.categories.length===1&&c.categories[0]==='videogames'));
 assert.ok(rows.every(c=>/^[А-ЯЁа-яё -]+$/u.test(c.text)&&/^[А-ЯЁа-яё -]+$/u.test(c.meta?.game||'')));
 assert.ok(rows.every(c=>c.type==='word'?!/\s/u.test(c.text):/\s/u.test(c.text)));
 assert.equal(new Set(rows.map(c=>c.id)).size,50);
 assert.equal(new Set(rows.map(c=>api.normalize(c.text))).size,50);
 assert.equal(old.criteria.cardIds.length,7020);
 assert.equal(now.criteria.cardIds.length,7070);
 assert.deepEqual(now.criteria.cardIds.slice(0,7020),old.criteria.cardIds,'All general@50 IDs pinned unchanged');
 assert.deepEqual(now.criteria.cardIds.slice(7020),newIds);
 assert.ok(d.packs.filter(x=>x.id!=='general').every(x=>!x.criteria.cardIds.some(id=>newIds.includes(id))),'No new thematic game pack');
 assert.deepEqual(now.criteria.cardIds.filter(id=>!newIds.includes(id)),old.criteria.cardIds);
 const active=new Set(now.criteria.cardIds),by=new Map(d.cards.map(c=>[c.id,c])),norm=new Set();
 for(const id of active){if(id.startsWith('approx-'))continue;const card=by.get(id);assert.ok(card,'Known card '+id);const key=api.normalize(card.text);assert.ok(!norm.has(key),'Duplicate active text '+card.text);norm.add(key);}
 assert.ok(api.validate(d).ok,'Existing content and historical locks must pass');
});
