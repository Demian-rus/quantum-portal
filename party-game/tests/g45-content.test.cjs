'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..'),priorRef='a041c73bfacc1928c249481e1ca3045d02fa4fa0';
const previous=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});
test('G45 offers 50 Cyrillic words/phrases, 20/20/10 tiers, stable 070 IDs and unique normalized texts',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v31');assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(d=>rows.filter(c=>c.difficulty===d).length),[20,20,10]);
 for(const [d,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){assert.equal(rows.filter(c=>c.difficulty===d&&c.type==='word').length,w);assert.equal(rows.filter(c=>c.difficulty===d&&c.type==='phrase').length,p)}
 for(const t of ['word','phrase'])rows.filter(c=>c.type===t).forEach((c,i)=>assert.equal(c.id,t+'-070'+String(i+1).padStart(3,'0')));
 const categories=new Set(data.manifest.categories.map(c=>c.id)),older=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v31').map(c=>api.normalize(c.text)));
 for(const c of rows){assert.match(c.text,/^[А-ЯЁ ]+$/u);assert.ok(c.categories.length&&c.categories.every(cat=>categories.has(cat)));const n=api.normalize(c.text);assert.ok(!older.has(n),'Duplicate: '+c.text);older.add(n)}
 assert.ok(api.validate(data).ok,'Full content validation remains mandatory');
});
test('G45 general@47 includes exactly 7000 IDs and preserves all general@46 positions',()=>{
 const d=api.readDataset(),before=d.packs.find(p=>p.id==='general'&&p.version===46),after=d.packs.find(p=>p.id==='general'&&p.version===47),added=d.cards.filter(c=>c.pack==='general-diversity-v31');
 assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,6950);assert.equal(after.criteria.cardIds.length,7000);
 assert.deepEqual(after.criteria.cardIds.slice(0,6950),before.criteria.cardIds);assert.deepEqual(after.criteria.cardIds.slice(6950),added.map(c=>c.id));assert.equal(new Set(after.criteria.cardIds).size,7000);
});
test('G45 preserves every preceding card/question/pack JSON source byte-for-byte',()=>{
 const prior=JSON.parse(previous('party-game/content/manifest.json')),cur=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){const included=new Set(cur[kind].map(x=>x.path));for(const old of prior[kind]){assert.ok(included.has(old.path),'Missing '+old.path);const file='party-game/content/'+old.path;assert.equal(fs.readFileSync(path.join(root,file),'utf8'),previous(file),'Changed historical source '+file)}}
});
