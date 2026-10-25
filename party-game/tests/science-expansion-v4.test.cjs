'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,'content',p),'utf8'));
const rows=read('cards/science-expansion-v4.json'),packs=read('packs/science-expansion-v4.json'),manifest=read('manifest.json');
test('Science S4 contains 50 independently typed and unique records, with 13 scientists',()=>{
 assert.equal(rows.length,50);
 assert.equal(new Set(rows.map(r=>r.id)).size,50);
 assert.equal(new Set(rows.map(r=>r.text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е'))).size,50);
 assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map(d=>[d,rows.filter(r=>r.difficulty===d).length])),{easy:20,medium:20,hard:10});
 assert.deepEqual(Object.fromEntries(['word','phrase','person'].map(type=>[type,rows.filter(r=>r.type===type).length])),{word:17,phrase:20,person:13});
 for(const row of rows){assert.match(row.id,new RegExp('^'+row.type+'-038\\d{3}$'));assert.deepEqual(row.categories,['science']);assert.equal(row.pack,'science-expansion-v4');}
});
test('Science@8 and general@14 extend pinned previous catalogues only by S4',()=>{
 assert.ok(manifest.cards.some(s=>s.path==='cards/science-expansion-v4.json'));assert.ok(manifest.packs.some(s=>s.path==='packs/science-expansion-v4.json'));
 const [science,general]=packs,previousScience=read('packs/science-expansion-v3.json').find(p=>p.id==='science'&&p.version===7),previousGeneral=read('packs/idiom-expansion-v2.json').find(p=>p.id==='general'&&p.version===13);
 for(const [current,old,count]of [[science,previousScience,582],[general,previousGeneral,5400]]){
  assert.equal(current.version,old.version+1);assert.equal(current.criteria.cardIds.length,count);assert.deepEqual(current.criteria.cardIds.slice(0,old.criteria.cardIds.length),old.criteria.cardIds);assert.deepEqual(current.criteria.cardIds.slice(old.criteria.cardIds.length),rows.map(x=>x.id));
 }
});
