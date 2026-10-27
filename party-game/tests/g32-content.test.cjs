'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..');
const priorRef='f96a9e96546d7c1f2a3a33a4c5c1a5a1282ba9c4';
const previous=(file)=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});

test('G32 has 50 unique prompts with stable ID namespaces and 40/10 by type, 20/20/10 by difficulty',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v18');
 assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(type=>rows.filter(c=>c.type===type).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(level=>rows.filter(c=>c.difficulty===level).length),[20,20,10]);
 for(const [level,wordCount,phraseCount] of [['easy',16,4],['medium',16,4],['hard',8,2]]){
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='word').length,wordCount);
  assert.equal(rows.filter(c=>c.difficulty===level&&c.type==='phrase').length,phraseCount);
 }
 rows.filter(c=>c.type==='word').forEach((c,i)=>assert.equal(c.id,'word-057'+String(i+1).padStart(3,'0')));
 rows.filter(c=>c.type==='phrase').forEach((c,i)=>assert.equal(c.id,'phrase-057'+String(i+1).padStart(3,'0')));
 const cats=new Set(data.manifest.categories.map(x=>x.id));
 for(const c of rows)assert.ok(c.text&&c.categories.length&&c.categories.every(cat=>cats.has(cat)),c.id);
 const prior=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v18').map(c=>api.normalize(c.text))),fresh=new Set();
 for(const c of rows){const name=api.normalize(c.text);assert.ok(!prior.has(name)&&!fresh.has(name),'Duplicate: '+c.text);fresh.add(name)}
 assert.ok(api.validate(data).ok,'Full catalog validation remains enabled');
});

test('G32 general@34 adds exactly 50 pinned IDs with unchanged earlier versions',()=>{
 const data=api.readDataset(),get=v=>data.packs.find(p=>p.id==='general'&&p.version===v);
 const versions=[27,28,29,30,31,32,33,34].map(get);
 assert.ok(versions.every(Boolean));
 assert.deepEqual(versions.map(x=>x.criteria.cardIds.length),[6000,6050,6100,6150,6200,6250,6300,6350]);
 const previousPack=versions[6],current=versions[7],added=data.cards.filter(c=>c.pack==='general-diversity-v18');
 assert.deepEqual(current.criteria.cardIds.slice(0,6300),previousPack.criteria.cardIds);
 assert.deepEqual(current.criteria.cardIds.slice(6300),added.map(c=>c.id));
 assert.equal(new Set(current.criteria.cardIds).size,6350);
});

test('G32 preserves every preexisting source JSON byte for byte relative to G31',()=>{
 const oldManifest=JSON.parse(previous('party-game/content/manifest.json'));
 const newManifest=api.readDataset().manifest;
 for(const kind of ['cards','questions','packs']){
  const currentPaths=new Set(newManifest[kind].map(x=>x.path));
  for(const source of oldManifest[kind]){
   assert.ok(currentPaths.has(source.path),'Historical source removed: '+source.path);
   const file='party-game/content/'+source.path;
   assert.equal(fs.readFileSync(path.join(root,file),'utf8'),previous(file),'Historical bytes changed: '+file);
  }
 }
});
