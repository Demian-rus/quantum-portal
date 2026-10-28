'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..'),priorRef='941dc0140c3f7b24eb47f3bf9bd38a1792a7547a';
const previous=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});
test('G43 offers 50 Cyrillic words/phrases, 20/20/10 tiers, stable 068 IDs and unique normalized texts',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v29');assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(d=>rows.filter(c=>c.difficulty===d).length),[20,20,10]);
 for(const [d,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){assert.equal(rows.filter(c=>c.difficulty===d&&c.type==='word').length,w);assert.equal(rows.filter(c=>c.difficulty===d&&c.type==='phrase').length,p)}
 for(const t of ['word','phrase'])rows.filter(c=>c.type===t).forEach((c,i)=>assert.equal(c.id,t+'-068'+String(i+1).padStart(3,'0')));
 const categories=new Set(data.manifest.categories.map(c=>c.id)),older=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v29').map(c=>api.normalize(c.text)));
 for(const c of rows){assert.match(c.text,/^[А-ЯЁ ]+$/u);assert.ok(c.categories.length&&c.categories.every(cat=>categories.has(cat)));const n=api.normalize(c.text);assert.ok(!older.has(n),'Duplicate: '+c.text);older.add(n)}
 assert.ok(api.validate(data).ok,'Full content validation remains mandatory');
});
test('G43 general@45 includes exactly 6900 IDs and preserves all general@44 positions',()=>{
 const d=api.readDataset(),before=d.packs.find(p=>p.id==='general'&&p.version===44),after=d.packs.find(p=>p.id==='general'&&p.version===45),added=d.cards.filter(c=>c.pack==='general-diversity-v29');
 assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,6850);assert.equal(after.criteria.cardIds.length,6900);
 assert.deepEqual(after.criteria.cardIds.slice(0,6850),before.criteria.cardIds);assert.deepEqual(after.criteria.cardIds.slice(6850),added.map(c=>c.id));assert.equal(new Set(after.criteria.cardIds).size,6900);
});
test('G43 preserves every preceding card/question/pack JSON source byte-for-byte',()=>{
 const prior=JSON.parse(previous('party-game/content/manifest.json')),cur=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){const included=new Set(cur[kind].map(x=>x.path));for(const old of prior[kind]){assert.ok(included.has(old.path),'Missing '+old.path);const file='party-game/content/'+old.path;assert.equal(fs.readFileSync(path.join(root,file),'utf8'),previous(file),'Changed historical source '+file)}}
});
