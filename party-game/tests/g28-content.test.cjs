'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const api=require('../scripts/content.cjs');
const root=path.resolve(__dirname,'../..');
const priorRef='9b40e8683878bd0887a0a610a051ff1fa3a4fbc2';
const previous=(file)=>cp.execFileSync('git',['show',priorRef+':'+file],{cwd:root,encoding:'utf8',maxBuffer:18000000});

test('G28: 50 stable IDs, 40 individual words and 10 phrases, levels 20/20/10',()=>{
 const data=api.readDataset(),r=data.cards.filter(c=>c.pack==='general-diversity-v14');
 assert.equal(r.length,50);
 assert.deepEqual(['word','phrase'].map(t=>r.filter(x=>x.type===t).length),[40,10]);
 assert.deepEqual(['easy','medium','hard'].map(l=>r.filter(x=>x.difficulty===l).length),[20,20,10]);
 for(const [level,w,p] of [['easy',16,4],['medium',16,4],['hard',8,2]]){
  assert.equal(r.filter(x=>x.type==='word'&&x.difficulty===level).length,w);
  assert.equal(r.filter(x=>x.type==='phrase'&&x.difficulty===level).length,p);
 }
 const words=r.filter(x=>x.type==='word'),phrases=r.filter(x=>x.type==='phrase');
 words.forEach((x,i)=>assert.equal(x.id,'word-053'+String(i+1).padStart(3,'0')));
 phrases.forEach((x,i)=>assert.equal(x.id,'phrase-053'+String(i+1).padStart(3,'0')));
 const cats=new Set(data.manifest.categories.map(c=>c.id));
 r.forEach(c=>{assert.ok(c.text&&c.categories.length&&c.categories.every(tag=>cats.has(tag)));assert.equal(c.pack,'general-diversity-v14')});
});

test('G28: general@30 appends exactly 50 to general@29 without changing prior pinned snapshots',()=>{
 const d=api.readDataset(),one=v=>d.packs.find(x=>x.id==='general'&&x.version===v);
 const published=one(27),g26=one(28),g27=one(29),g28=one(30),r=d.cards.filter(c=>c.pack==='general-diversity-v14');
 assert.ok(published&&g26&&g27&&g28);
 assert.equal(published.criteria.cardIds.length,6000);
 assert.equal(g26.criteria.cardIds.length,6050);
 assert.equal(g27.criteria.cardIds.length,6100);
 assert.equal(g28.criteria.cardIds.length,6150);
 assert.deepEqual(g28.criteria.cardIds.slice(0,6100),g27.criteria.cardIds);
 assert.deepEqual(g28.criteria.cardIds.slice(6100),r.map(c=>c.id));
 assert.equal(new Set(g28.criteria.cardIds).size,6150);
 const prior=new Set(d.cards.filter(c=>c.pack!=='general-diversity-v14').map(c=>api.normalize(c.text))),fresh=new Set();
 for(const c of r){const s=api.normalize(c.text);assert.ok(!prior.has(s)&&!fresh.has(s),'Duplicate: '+c.text);fresh.add(s)}
 assert.ok(api.validate(d).ok,'Full dictionary validation passes');
});

test('G28: all G27 and earlier JSON source files remain byte-for-byte unchanged',()=>{
 const priorManifest=JSON.parse(previous('party-game/content/manifest.json'));
 const newManifest=api.readDataset().manifest;
 for(const k of ['cards','questions','packs']){
  const paths=new Set(newManifest[k].map(x=>x.path));
  for(const s of priorManifest[k]){
   assert.ok(paths.has(s.path),'Historical path removed: '+s.path);
   const f='party-game/content/'+s.path;
   assert.equal(fs.readFileSync(path.join(root,f),'utf8'),previous(f),'Historical bytes changed: '+f);
  }
 }
});
