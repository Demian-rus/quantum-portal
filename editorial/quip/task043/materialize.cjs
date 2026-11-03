'use strict';
// Serialization of explicit individual decisions; no automatic rating/tag rules.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const E=require('../editor.cjs'),R=require('../review-table.cjs'),C=require('../../../party-game/scripts/content.cjs');
const ROOT=path.resolve(__dirname,'../../..'),content=path.join(ROOT,'party-game/content');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
function decisions(){
 const candidates=new Map(read(path.join(__dirname,'candidates.json')).filter(c=>c.status==='accepted').map(c=>[c.candidateId,c]));
 const rows=fs.readFileSync(path.join(__dirname,'decisions.tsv'),'utf8').trim().split(/\r?\n/).filter(s=>!s.startsWith('#')).map(line=>{
  const [candidateId,form,categories,themes,ratings,ambiguities,rationale]=line.split('|');
  const candidate=candidates.get(candidateId);assert.ok(candidate,'Unaccepted '+candidateId);assert.match(ratings,/^[0-3]{5}$/);
  return {candidateId,id:form+'-'+(910000+Number(candidateId.slice(1))),text:candidate.text,form,categories:categories.split('+'),themes:themes?themes.split('+'):[],ratings,ambiguities:ambiguities?ambiguities.split('~'):[],rationale};
 });
 assert.equal(rows.length,candidates.size);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);return rows;
}
function materialize(){
 const rows=decisions(),data=C.readDataset(),mfile=path.join(ROOT,'editorial/quip/manifest.json'),m=read(mfile),v1=m.editions.find(s=>s.version===1),old=read(path.join(ROOT,'editorial/quip',v1.path));
 assert.equal(E.hash(old),read(path.join(__dirname,'baseline.json')).edition.digest,'Historical edition changed');
 const sourcePath='cards/task043-quality-v1.json',packPath='packs/task043-catalogs-v1.json';
 const cards=rows.map(r=>({id:r.id,text:r.text,type:r.form,difficulty:E.LEVELS[Number(r.ratings[0])-1]||E.LEVELS[Number(r.ratings[3])-1],categories:r.categories,pack:'quality-expansion-task043-v1',meta:{editorialCandidate:r.candidateId}}));
 const packs=v1.catalogs.map(ref=>{
  const p=structuredClone(data.packs.find(p=>p.id===ref.id&&p.version===ref.version));
  p.version++;p.criteria.cardIds.push(...rows.filter(r=>p.id==='general'||r.themes.includes(p.id)).map(r=>r.id));return p;
 });
 for(const [relative,value]of [[sourcePath,cards],[packPath,packs]]){
  const target=path.join(content,relative);if(fs.existsSync(target))assert.deepEqual(read(target),value,'Immutable addition changed');else write(target,value);
 }
 const manifest=read(path.join(content,'manifest.json')),lock=read(path.join(content,'baseline-lock.json'));
 for(const [kind,relative,value]of [['cards',sourcePath,cards],['packs',packPath,packs]]){
  if(!manifest[kind].some(s=>s.path===relative))manifest[kind].push({path:relative,immutable:true,review:'TASK043: individually reviewed additions; editorial/quip/task043/decisions.tsv and reviews/task043-v2.psv.'});
  const entry={count:value.length,sha256:C.digest(value)};
  if(lock.sources[relative])assert.deepEqual(lock.sources[relative],entry);else lock.sources[relative]=entry;
 }
 write(path.join(content,'manifest.json'),manifest);write(path.join(content,'baseline-lock.json'),lock);
 v1.status='published';m.published['quip@1']=E.hash(old);
 const spec={...structuredClone(v1),version:2,status:'draft',path:'editions/quip-v2.json',catalogs:packs.map(p=>({id:p.id,version:p.version,sha256:E.hash(p)}))};
 if(m.editions.some(s=>s.version===2))assert.deepEqual(m.editions.find(s=>s.version===2),spec);else m.editions.push(spec);write(mfile,m);
 const c=E.context(),draft=E.createDraft(c),oldRecords=new Map(old.records.map(r=>[r.id,r]));
 for(let i=0;i<draft.records.length;i++){const prior=oldRecords.get(draft.records[i].id);if(!prior)continue;
  assert.deepEqual(draft.records[i].source,prior.source);assert.deepEqual(draft.records[i].proposal,prior.proposal);draft.records[i]=structuredClone(prior);
 }
 const column=(r,mode)=>{
  const pos={talk:0,mime:1,draw:2,yesno:3,blitz:4}[mode],n=pos===undefined?0:Number(r.ratings[pos]);
  if(n)return E.LEVELS[n-1]+':'+(mode==='yesno'?'recognisable-person':mode==='blitz'?'fast-clue':'other-reviewed');
  return '-:'+(mode==='mime'&&['word','phrase','idiom'].includes(r.form)?'not-physical':mode==='draw'&&['word','phrase','idiom'].includes(r.form)?'not-visual':mode==='blitz'&&r.form!=='word'?'multiword':'type');
 };
 const table='# '+JSON.stringify({schemaVersion:1,edition:'quip@2',rubric:'quip-rubric@1',sourcesDigest:R.sourcesDigest(rows.map(r=>r.id),c)})+'\n'+R.COLUMNS.join('|')+'\n'+rows.map(r=>[r.id,r.text,r.form,r.categories.join('+'),r.themes.join('+'),r.ambiguities.join('~'),...['talk','mime','draw','sing','yesno','blitz','approx'].map(mode=>column(r,mode)),r.rationale].join('|')).join('\n')+'\n';
 const tablePath=path.join(ROOT,'editorial/quip/reviews/task043-v2.psv');fs.writeFileSync(tablePath,table);
 const result=E.apply(draft,R.parse(table,c),{reviewer:'TASK043 per-card editorial review (Codex); owner acceptance pending',at:'2026-11-03T12:00:00.000Z'},c);
 E.writeDraft(result,c);
 // One source-bound record per line keeps the additive edition reviewable and
 // within the repository connector's file-size limit; canonical hashes ignore formatting.
 const {records,...header}=result;fs.writeFileSync(path.join(ROOT,'editorial/quip',c.spec.path),JSON.stringify(header,null,2).slice(0,-2)+',\n  \"records\": [\n'+records.map(r=>'    '+JSON.stringify(r)).join(',\n')+'\n  ]\n}\n');
 assert.deepEqual(result.records.filter(r=>oldRecords.has(r.id)),old.records.filter(r=>result.records.some(n=>n.id===r.id)));
 console.log(JSON.stringify(E.validate(result,c,{release:true})));
}
module.exports={decisions,materialize};if(require.main===module)materialize();
