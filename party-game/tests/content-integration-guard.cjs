'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const contentApi=require('../scripts/content.cjs');
const {auditApproxUnits}=require('../scripts/approx-unit-audit.cjs');
const catalogFiles=new Set(['cards.js','content-packs.js','approx-questions.js','APPROX-UNIT-AUDIT.json','content/manifest.json','content/baseline-lock.json']);
function verifyApprovedCatalogEvolution(root){
 const data=contentApi.readDataset(),result=contentApi.validate(data),rendered=contentApi.render(data);
 assert.equal(result.ok,true,'New catalog still satisfies all historical and current validations');
 // Locks may only grow for new immutable sources. Every previous lock and its
 // source bytes remain protected; unknown/orphan locks do not get an exception.
 const previous=JSON.parse(require('node:child_process').execFileSync('git',['show','0584e0df435782eec8a31d5f5040ac517d300315:party-game/content/baseline-lock.json'],{cwd:root,encoding:'utf8'}));
 assert.equal(data.lock.revision,previous.revision);assert.deepEqual(Object.keys(data.lock).sort(),Object.keys(previous).sort());
 for(const [file,locked]of Object.entries(previous.sources))assert.deepEqual(data.lock.sources[file],locked,'Historical source lock '+file);
 for(const [file,locked]of Object.entries(data.lock.sources)){
  const source=data.sources.find(s=>s.path===file);assert(source?.immutable,'Lock must identify an immutable registered source: '+file);
  assert.deepEqual(locked,{count:source.rows.length,sha256:contentApi.digest(source.rows)},'Exact source lock '+file);
 }
 for(const file of ['cards.js','content-packs.js','approx-questions.js'])
  assert.equal(fs.readFileSync(path.join(root,'party-game',file),'utf8'),rendered[file],'Deterministic content compiler: '+file);
 assert.equal(fs.readFileSync(path.join(root,'party-game/APPROX-UNIT-AUDIT.json'),'utf8'),JSON.stringify(auditApproxUnits(),null,2)+'\n','Exact numeric unit audit');
 const prev=data.packs.find(p=>p.id==='general'&&p.version===66),next=data.packs.find(p=>p.id==='general'&&p.version===67);
 assert.ok(prev&&next);assert.equal(prev.criteria.cardIds.length,7445);assert.equal(next.criteria.cardIds.length,7460);
 assert.deepEqual(next.criteria.cardIds.slice(0,7445),prev.criteria.cardIds,'Historic GQ5 IDs must remain in exact original order');
 return data;
}
module.exports={catalogFiles,verifyApprovedCatalogEvolution};
