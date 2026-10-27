'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..'),priorRef='f6fc97694049fb083be488e8971731fcc97bd640';
const previous=file=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});

test('G30: 50 new permanent IDs are 40 words, 10 phrases at 20/20/10 difficulty',()=>{
 const data=api.readDataset(),rows=data.cards.filter(c=>c.pack==='general-diversity-v16');
 assert.equal(rows.length,50);
 assert.deepEqual(['word','phrase'].map(t=>rows.filter(c=>c.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(d=>rows.filter(c=>c.difficulty===d).length),[20,20,10]);
 for(const [difficulty,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){
  assert.equal(rows.filter(c=>c.type==='word'&&c.difficulty===difficulty).length,w);
  assert.equal(rows.filter(c=>c.type==='phrase'&&c.difficulty===difficulty).length,p);
 }
 rows.filter(c=>c.type==='word').forEach((c,i)=>assert.equal(c.id,'word-055'+String(i+1).padStart(3,'0')));
 rows.filter(c=>c.type==='phrase').forEach((c,i)=>assert.equal(c.id,'phrase-055'+String(i+1).padStart(3,'0')));
 const allowed=new Set(data.manifest.categories.map(c=>c.id));
 for(const c of rows){assert.ok(c.text&&c.categories.length&&c.categories.every(x=>allowed.has(x)),c.id)}
 const old=new Set(data.cards.filter(c=>c.pack!=='general-diversity-v16').map(c=>api.normalize(c.text))),fresh=new Set();
 for(const c of rows){const v=api.normalize(c.text);assert.ok(!old.has(v)&&!fresh.has(v),'Duplicate: '+c.text);fresh.add(v)}
 assert.ok(api.validate(data).ok,'Full content validation');
});

test('G30: general@32 has 6250 IDs, preserving the exact general@31 prefix',()=>{
 const d=api.readDataset(),pack=v=>d.packs.find(p=>p.id==='general'&&p.version===v);
 const versions=[27,28,29,30,31,32].map(pack);assert.ok(versions.every(Boolean));
 assert.deepEqual(versions.map(p=>p.criteria.cardIds.length),[6000,6050,6100,6150,6200,6250]);
 const prev=versions[4],next=versions[5],rows=d.cards.filter(c=>c.pack==='general-diversity-v16');
 assert.deepEqual(next.criteria.cardIds.slice(0,6200),prev.criteria.cardIds);
 assert.deepEqual(next.criteria.cardIds.slice(6200),rows.map(c=>c.id));
 assert.equal(new Set(next.criteria.cardIds).size,6250);
});

test('G30: all earlier registered JSON source files are byte-for-byte unchanged',()=>{
 const oldManifest=JSON.parse(previous('party-game/content/manifest.json'));
 const newManifest=api.readDataset().manifest;
 for(const type of ['cards','questions','packs']){
  const present=new Set(newManifest[type].map(item=>item.path));
  for(const source of oldManifest[type]){
   assert.ok(present.has(source.path),'Removed source '+source.path);
   const file='party-game/content/'+source.path;
   assert.equal(fs.readFileSync(path.join(root,file),'utf8'),previous(file),'Changed historical JSON '+file);
  }
 }
});
