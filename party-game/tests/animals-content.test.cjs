'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createSimulation}=require('../scripts/game-simulation.cjs');
const root=path.resolve(__dirname,'..');
const rows=JSON.parse(fs.readFileSync(path.join(root,'content/cards/animals-v1.json'),'utf8'));
const pack=JSON.parse(fs.readFileSync(path.join(root,'content/packs/animals-v1.json'),'utf8'))[0];
const norm=s=>String(s).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
test('Animals@1 curated records have distinct permanent IDs and normalized texts',()=>{
 assert.equal(rows.length,216);assert.equal(new Set(rows.map(x=>x.id)).size,rows.length);
 assert.equal(new Set(rows.map(x=>norm(x.text))).size,rows.length);
 for(const row of rows){assert.ok(row.categories.includes('animals'));assert.equal(row.pack,'animals-v1');}
 assert.ok(!rows.some(x=>norm(x.text)==='дядюшка скрудж'));
});
test('Animals@1 selection is a unique explicit mix of old and new records',()=>{
 assert.equal(pack.version,1);assert.equal(pack.enabled,true);assert.equal(pack.criteria.cardIds.length,457);
 assert.equal(new Set(pack.criteria.cardIds).size,457);
 assert.ok(rows.every(x=>pack.criteria.cardIds.includes(x.id)));
 assert.deepEqual(pack.allowedModes,['talk','mime','draw','yesno','secret','blitz','approx']);
});
test('Animals@1 production content pools are playable across tiers and preserve general@6',()=>{
 const h=createSimulation(101);
 assert.equal(h.eval('latestGeneralPackSelection().version'),6);
 assert.deepEqual(JSON.parse(JSON.stringify(h.eval('getContentPack({id:"animals",version:1}).types'))),['word','phrase','person','number']);
 const settings={...h.eval('options'),awardTo:'guesser',difficulty:'mixed',modes:['talk','mime','draw','yesno','secret','blitz','approx'],promptTypes:['word','phrase'],contentPack:{id:'animals',version:1}};
 h.context.animalsSettings=settings;
 const problems=JSON.parse(JSON.stringify(h.eval('checkContentPack({id:"animals",version:1},animalsSettings).problems')));
 assert.deepEqual(problems,[]);
 for(const tier of ['easy','medium','hard']){
   h.context.tier=tier;
   assert.ok(h.eval('getPackCardPool({id:"animals",version:1},"words",tier,["word","phrase"]).length')>=10);
   assert.ok(h.eval('getPackCardPool({id:"animals",version:1},"people",tier,["word","phrase"]).length')>=5);
   assert.ok(h.eval('getPackQuestionPool({id:"animals",version:1},tier).length')>=5);
 }
 assert.ok(h.eval('getPackCardPool({id:"animals",version:1},"blitz","hard",["word"]).length')>=15);
});
