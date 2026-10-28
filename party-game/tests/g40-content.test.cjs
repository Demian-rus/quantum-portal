'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..'),priorRef='f2db47eda6869ae5116e7a3be247cfeecba17457';
const old=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});
test('G40 has 50 Cyrillic prompts of fixed types, difficulty distribution, unique 065 IDs',()=>{
 const d=api.readDataset(),rows=d.cards.filter(c=>c.pack==='general-diversity-v26');assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(l=>rows.filter(c=>c.difficulty===l).length),[20,20,10]);
 for(const [l,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){assert.equal(rows.filter(c=>c.difficulty===l&&c.type==='word').length,w);assert.equal(rows.filter(c=>c.difficulty===l&&c.type==='phrase').length,p)}
 for(const type of ['word','phrase'])rows.filter(c=>c.type===type).forEach((c,i)=>assert.equal(c.id,type+'-065'+String(i+1).padStart(3,'0')));
 const cats=new Set(d.manifest.categories.map(x=>x.id)),prior=new Set(d.cards.filter(x=>x.pack!=='general-diversity-v26').map(x=>api.normalize(x.text)));
 for(const row of rows){assert.match(row.text,/^[А-ЯЁ ]+$/u);assert.ok(row.categories.length&&row.categories.every(x=>cats.has(x)));const n=api.normalize(row.text);assert.ok(!prior.has(n),'Repeated '+row.text);prior.add(n)}
 assert.ok(api.validate(d).ok,'Content validation cannot be disabled');
});
test('G40 general@42 appends only 50 new IDs after an exact 6700-ID prefix',()=>{
 const d=api.readDataset(),before=d.packs.find(x=>x.id==='general'&&x.version===41),after=d.packs.find(x=>x.id==='general'&&x.version===42),newRows=d.cards.filter(x=>x.pack==='general-diversity-v26');
 assert.ok(before&&after);assert.equal(before.criteria.cardIds.length,6700);assert.equal(after.criteria.cardIds.length,6750);
 assert.deepEqual(after.criteria.cardIds.slice(0,6700),before.criteria.cardIds);assert.deepEqual(after.criteria.cardIds.slice(6700),newRows.map(x=>x.id));assert.equal(new Set(after.criteria.cardIds).size,6750);
});
test('G40 keeps all previously present card, question, pack JSON sources unchanged byte-for-byte',()=>{
 const before=JSON.parse(old('party-game/content/manifest.json')),current=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){const included=new Set(current[kind].map(x=>x.path));for(const source of before[kind]){assert.ok(included.has(source.path),'Missing previous '+source.path);const f='party-game/content/'+source.path;assert.equal(fs.readFileSync(path.join(root,f),'utf8'),old(f),'Changed old source '+f)}}
});
