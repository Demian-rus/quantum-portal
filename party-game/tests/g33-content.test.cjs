'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..');
const priorRef='123967d0443afc79843eeefc47e94d28e5be8229';
const previous=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});

test('G33 contains 40 words/10 phrases, 20/20/10 tiers, stable IDs, Cyrillic prompts and no exact duplicates',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v19');
 assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(d=>rows.filter(c=>c.difficulty===d).length),[20,20,10]);
 for(const [level,words,phrases] of [['easy',16,4],['medium',16,4],['hard',8,2]]){
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='word').length,words);
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='phrase').length,phrases);
 }
 for(const type of ['word','phrase'])rows.filter(c=>c.type===type).forEach((c,i)=>assert.equal(c.id,type+'-058'+String(i+1).padStart(3,'0')));
 const categories=new Set(data.manifest.categories.map(c=>c.id)),seen=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v19').map(c=>api.normalize(c.text)));
 for(const c of rows){
  assert.match(c.text,/^[А-ЯЁ ]+$/u,'Non-Cyrillic: '+c.id);
  assert.ok(c.categories.length&&c.categories.every(cat=>categories.has(cat)),c.id);
  const n=api.normalize(c.text);assert.ok(!seen.has(n),'Duplicate '+c.text);seen.add(n);
 }
 assert.ok(api.validate(data).ok,'Catalog validation remains enabled');
});

test('G33 general@35 pins 6400 IDs with exact prefix from general@34',()=>{
 const data=api.readDataset(),get=v=>data.packs.find(p=>p.id==='general'&&p.version===v),versions=[27,28,29,30,31,32,33,34,35].map(get);
 assert.ok(versions.every(Boolean));
 assert.deepEqual(versions.map(p=>p.criteria.cardIds.length),[6000,6050,6100,6150,6200,6250,6300,6350,6400]);
 const added=data.cards.filter(c=>c.pack==='general-diversity-v19');
 assert.deepEqual(versions[8].criteria.cardIds.slice(0,6350),versions[7].criteria.cardIds);
 assert.deepEqual(versions[8].criteria.cardIds.slice(6350),added.map(c=>c.id));
 assert.equal(new Set(versions[8].criteria.cardIds).size,6400);
});

test('G33 preserves every previous source JSON byte for byte',()=>{
 const old=JSON.parse(previous('party-game/content/manifest.json')),cur=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){
  const paths=new Set(cur[kind].map(x=>x.path));
  for(const entry of old[kind]){
   assert.ok(paths.has(entry.path),'Removed '+entry.path);
   const file='party-game/content/'+entry.path;
   assert.equal(fs.readFileSync(path.join(root,file),'utf8'),previous(file),'Historical bytes changed '+file);
  }
 }
});
