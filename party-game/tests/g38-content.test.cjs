'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..'),priorRef='b0d9aa0ddd86cc4538022a5d7e9a077d0e5acee3';
const previous=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});
test('G38 has 50 Cyrillic-only unique prompts, 40 words/10 phrases, balanced tiers and stable 063 IDs',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v24');assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(d=>rows.filter(c=>c.difficulty===d).length),[20,20,10]);
 for(const [level,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='word').length,w);assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='phrase').length,p);}
 for(const type of ['word','phrase'])rows.filter(c=>c.type===type).forEach((c,i)=>assert.equal(c.id,type+'-063'+String(i+1).padStart(3,'0')));
 const categories=new Set(data.manifest.categories.map(c=>c.id)),prior=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v24').map(c=>api.normalize(c.text)));
 for(const c of rows){assert.match(c.text,/^[А-ЯЁ ]+$/u);assert.ok(c.categories.length&&c.categories.every(cat=>categories.has(cat)));const name=api.normalize(c.text);assert.ok(!prior.has(name),'Duplicate: '+c.text);prior.add(name);}
 assert.ok(api.validate(data).ok,'Full catalog validation must remain enabled');
});
test('G38 general@40 appends 50 IDs after general@39 without changing prior positions',()=>{
 const data=api.readDataset(),old=data.packs.find(p=>p.id==='general'&&p.version===39),next=data.packs.find(p=>p.id==='general'&&p.version===40),added=data.cards.filter(c=>c.pack==='general-diversity-v24');
 assert.ok(old&&next);assert.equal(old.criteria.cardIds.length,6600);assert.equal(next.criteria.cardIds.length,6650);
 assert.deepEqual(next.criteria.cardIds.slice(0,6600),old.criteria.cardIds);assert.deepEqual(next.criteria.cardIds.slice(6600),added.map(c=>c.id));assert.equal(new Set(next.criteria.cardIds).size,6650);
});
test('G38 preserves all historical card/question/pack source JSON byte-for-byte',()=>{
 const prev=JSON.parse(previous('party-game/content/manifest.json')),cur=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){const paths=new Set(cur[kind].map(x=>x.path));for(const src of prev[kind]){assert.ok(paths.has(src.path),'Missing '+src.path);const file='party-game/content/'+src.path;assert.equal(fs.readFileSync(path.join(root,file),'utf8'),previous(file),'Historical bytes changed '+file);}}
});
