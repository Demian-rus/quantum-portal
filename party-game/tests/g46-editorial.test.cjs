'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../scripts/content.cjs');
const normalize=api.normalize;
const immutableEndings=new Set('КОНФЕТТИ ХИНКАЛИ ТАКСИ КИВИ ГРАФФИТИ АЛИБИ ЦУНАМИ СУШИ СМУЗИ ПЕНАЛЬТИ ЭМОДЗИ БАЛИ СОЧИ ЧИЛИ МИССИСИПИ КЕПИ МЮСЛИ БРАУНИ КОЛЬРАБИ ВАСАБИ ЦУКИНИ ЧАХОХБИЛИ ХАЧАПУРИ САЦИВИ КОНФИ РАВИОЛИ КАННЕЛЛОНИ КОРГИ КОЛЛИ ШЕЛТИ ХАСКИ ОКАПИ ВАДИ ОРИГАМИ КИМЧИ ПОПУРРИ РЕГБИ АПОСТЕРИОРИ НЬОККИ ПАПАРАЦЦИ'.split(' '));
test('G46: 162 reviewed replacements, exact 7000 active IDs, clean word and phrase classification',()=>{
 const d=api.readDataset(),previous=d.packs.find(x=>x.id==='general'&&x.version===47),current=d.packs.find(x=>x.id==='general'&&x.version===48);
 const additions=d.cards.filter(c=>c.pack==='general-editorial-v1');
 assert.ok(previous&&current);
 assert.equal(previous.criteria.cardIds.length,7000);assert.equal(current.criteria.cardIds.length,7000);
 assert.equal(additions.length,162);assert.equal(new Set(additions.map(c=>c.id)).size,162);
 assert.equal(additions.filter(c=>c.type==='phrase'&&/\s/.test(c.text)).length,161);assert.equal(additions.filter(c=>c.id==='word-071001'&&c.text==='РОБОТ-ДОСТАВЩИК'&&c.type==='word').length,1);
 assert.ok(additions.every(c=>/^[А-ЯЁ —-]+$/u.test(c.text)));
 assert.deepEqual(additions.map(c=>c.id),current.criteria.cardIds.slice(-162));
 const removed=previous.criteria.cardIds.filter(id=>!current.criteria.cardIds.includes(id));
 assert.equal(removed.length,162);
 assert.deepEqual(current.criteria.cardIds.slice(0,-162),previous.criteria.cardIds.filter(id=>!removed.includes(id)));
 const byId=new Map(d.cards.map(c=>[c.id,c])),seen=new Map();
 for(const id of current.criteria.cardIds){
  if(id.startsWith('approx-'))continue;
  const row=byId.get(id);assert.ok(row,'Card reference missing '+id);
  if(row.type==='word'){
   assert.doesNotMatch(row.text,/\s/u,'Multiword task still in word type '+row.id);
   assert.ok(!(/^[А-ЯЁ-]+[ЫИ]$/u.test(row.text)&&!immutableEndings.has(row.text)),'Inflected plural remains '+row.id+' '+row.text);
   assert.ok(!['ХЛОПЬЯ','БРУСЬЯ'].includes(row.text),'Obvious plural remains '+row.id);
  }
  if(row.type==='phrase')assert.match(row.text,/\s/u,'Phrase lacking whitespace '+row.id);
  const key=normalize(row.text);assert.ok(!seen.has(key),'Exact active duplicate '+key+': '+seen.get(key)+' / '+row.id);seen.set(key,row.id);
 }
 assert.equal(seen.size,6538);
 assert.ok(api.validate(d).ok,'All historical catalog and content checks remain in force');
});
