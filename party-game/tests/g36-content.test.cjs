'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..');
const priorRef='fe45663a0e725c644452e8e6259fa12e5b7fb46a';
const previous=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});

test('G36 has 50 Cyrillic-only unique prompts, 40 words/10 phrases, balanced tiers and stable 061 IDs',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v22');
 assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(d=>rows.filter(c=>c.difficulty===d).length),[20,20,10]);
 for(const [level,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='word').length,w);
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='phrase').length,p);
 }
 for(const type of ['word','phrase'])rows.filter(c=>c.type===type).forEach((c,i)=>assert.equal(c.id,type+'-061'+String(i+1).padStart(3,'0')));
 const categories=new Set(data.manifest.categories.map(c=>c.id));
 const prior=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v22').map(c=>api.normalize(c.text)));
 for(const c of rows){
  assert.match(c.text,/^[А-ЯЁ ]+$/u,'Non-Cyrillic prompt '+c.id);
  assert.ok(c.categories.length&&c.categories.every(cat=>categories.has(cat)),c.id);
  const name=api.normalize(c.text);assert.ok(!prior.has(name),'Duplicate: '+c.text);prior.add(name);
 }
 assert.ok(api.validate(data).ok,'Full catalog validation must remain enabled');
});

test('G36 general@38 retains all prior versions and appends only 50 IDs after general@37 prefix',()=>{
 const data=api.readDataset(),get=v=>data.packs.find(p=>p.id==='general'&&p.version===v),versions=[27,28,29,30,31,32,33,34,35,36,37,38].map(get);
 assert.ok(versions.every(Boolean));
 assert.deepEqual(versions.map(p=>p.criteria.cardIds.length),[6000,6050,6100,6150,6200,6250,6300,6350,6400,6450,6500,6550]);
 const added=data.cards.filter(c=>c.pack==='general-diversity-v22');
 assert.deepEqual(versions[11].criteria.cardIds.slice(0,6500),versions[10].criteria.cardIds);
 assert.deepEqual(versions[11].criteria.cardIds.slice(6500),added.map(c=>c.id));
 assert.equal(new Set(versions[11].criteria.cardIds).size,6550);
});

test('G36 preserves every prior cards/questions/packs source JSON byte-for-byte',()=>{
 const prior=JSON.parse(previous('party-game/content/manifest.json')),current=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){
  const present=new Set(current[kind].map(x=>x.path));
  for(const source of prior[kind]){
   assert.ok(present.has(source.path),'Historical source omitted '+source.path);
   const file='party-game/content/'+source.path;
   assert.equal(fs.readFileSync(path.join(root,file),'utf8'),previous(file),'Historical bytes changed '+file);
  }
 }
});
