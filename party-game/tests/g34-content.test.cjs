'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..');
const priorRef='7df6c81953f541990e306d3dcec1cef1c7a4075d';
const previous=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});

test('G34 includes exactly 40 words/10 phrases, difficulty 20/20/10, stable IDs, Cyrillic-only text and no duplicates',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v20');
 assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(type=>rows.filter(c=>c.type===type).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(level=>rows.filter(c=>c.difficulty===level).length),[20,20,10]);
 for(const [level,wordCount,phraseCount] of [['easy',16,4],['medium',16,4],['hard',8,2]]){
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='word').length,wordCount);
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='phrase').length,phraseCount);
 }
 for(const type of ['word','phrase'])rows.filter(c=>c.type===type).forEach((c,i)=>assert.equal(c.id,type+'-059'+String(i+1).padStart(3,'0')));
 const cats=new Set(data.manifest.categories.map(c=>c.id)),prior=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v20').map(c=>api.normalize(c.text)));
 for(const card of rows){
  assert.match(card.text,/^[А-ЯЁ ]+$/u,'Non-Cyrillic card: '+card.id);
  assert.ok(card.categories.length&&card.categories.every(cat=>cats.has(cat)),card.id);
  const key=api.normalize(card.text);assert.ok(!prior.has(key),'Duplicate '+card.text);prior.add(key);
 }
 assert.ok(api.validate(data).ok,'Full catalog validation must stay enabled');
});

test('G34 general@36 appends 50 pinned IDs after the exact 6400-ID general@35 prefix',()=>{
 const data=api.readDataset(),get=v=>data.packs.find(p=>p.id==='general'&&p.version===v);
 const versions=[27,28,29,30,31,32,33,34,35,36].map(get);
 assert.ok(versions.every(Boolean));
 assert.deepEqual(versions.map(p=>p.criteria.cardIds.length),[6000,6050,6100,6150,6200,6250,6300,6350,6400,6450]);
 const added=data.cards.filter(c=>c.pack==='general-diversity-v20');
 assert.deepEqual(versions[9].criteria.cardIds.slice(0,6400),versions[8].criteria.cardIds);
 assert.deepEqual(versions[9].criteria.cardIds.slice(6400),added.map(c=>c.id));
 assert.equal(new Set(versions[9].criteria.cardIds).size,6450);
});

test('G34 preserves every historical cards/questions/packs JSON source byte for byte',()=>{
 const priorManifest=JSON.parse(previous('party-game/content/manifest.json')),current=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){
  const present=new Set(current[kind].map(entry=>entry.path));
  for(const entry of priorManifest[kind]){
   assert.ok(present.has(entry.path),'Historical source missing '+entry.path);
   const file='party-game/content/'+entry.path;
   assert.equal(fs.readFileSync(path.join(root,file),'utf8'),previous(file),'Historical bytes changed '+file);
  }
 }
});
