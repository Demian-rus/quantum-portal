'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../scripts/content.cjs');
test('G47 general@49 replaces only three verified semantic duplicates, preserves 7000 IDs',()=>{
 const d=api.readDataset(),old=d.packs.find(x=>x.id==='general'&&x.version===48),next=d.packs.find(x=>x.id==='general'&&x.version===49);
 assert.ok(old&&next);
 assert.equal(old.criteria.cardIds.length,7000);
 assert.equal(next.criteria.cardIds.length,7000);
 const removed=["phrase-071004","phrase-071139","phrase-065003"],added=["word-072001","word-072002","word-072003"];
 assert.deepEqual(old.criteria.cardIds.filter(id=>!next.criteria.cardIds.includes(id)),removed.filter(id=>old.criteria.cardIds.includes(id)).sort((a,b)=>old.criteria.cardIds.indexOf(a)-old.criteria.cardIds.indexOf(b)));
 assert.deepEqual(next.criteria.cardIds.slice(-3),added);
 assert.deepEqual(next.criteria.cardIds.slice(0,-3),old.criteria.cardIds.filter(id=>!removed.includes(id)));
 assert.deepEqual(next.criteria.cardIds.filter(id=>id.startsWith('song-')),old.criteria.cardIds.filter(id=>id.startsWith('song-')));
 const by=new Map(d.cards.map(x=>[x.id,x])),seen=new Map();
 for(const id of next.criteria.cardIds){
  if(id.startsWith('approx-'))continue;
  const card=by.get(id);assert.ok(card,'Unknown card ID '+id);
  const key=api.normalize(card.text);assert.ok(!seen.has(key),'Exact duplicate: '+card.text);seen.set(key,id);
 }
 const newRows=d.cards.filter(x=>x.pack==='general-editorial-v2');
 assert.equal(newRows.length,3);
 assert.deepEqual(newRows.map(x=>x.text),['КРАТОН','ЛИБРАЦИЯ','ВОЛЧОК']);
 assert.ok(newRows.every(x=>x.type==='word'&&!/\s/.test(x.text)&&!/[ЫИ]$/.test(x.text)));
 assert.equal(seen.size,6538);
 assert.equal(api.validate(d).ok,true);
});
