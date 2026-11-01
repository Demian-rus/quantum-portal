'use strict';
// Authoring only. No browser code, game saves or historical sources are written.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'../..'),DIR=__dirname,content=require('../../party-game/scripts/content.cjs');
const MODES=Object.freeze(['talk','mime','draw','sing','yesno','secret','blitz','approx']);
const LEVELS=Object.freeze(['easy','medium','hard']);
const FORMS=Object.freeze(['word','phrase','idiom','song','person','number']);
const REASONS=Object.freeze(['familiar','concrete','indirect','specialist','fast-clue','repertoire','recognisable-person','estimation','type','multiword','not-physical','not-visual','insufficient-clue','not-estimate','ambiguous','source-defect','rule-conflict','other-reviewed']);
function fail(message){throw Error('EDITORIAL: '+message);}
function ownKeys(value,allowed,required=allowed){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('Expected object');
 for(const key of Object.keys(value))if(!allowed.includes(key))fail('Unknown field '+key);
 for(const key of required)if(!Object.hasOwn(value,key))fail('Missing field '+key);
}
function jsonData(value,seen=new Set(),depth=0){
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value))fail('Non-finite number');return;}
 if(typeof value!=='object'||depth>100||seen.has(value))fail('Not plain finite JSON data');
 const proto=Object.getPrototypeOf(value);if(proto!==(Array.isArray(value)?Array.prototype:Object.prototype)&&proto!==null)fail('Invalid prototype');
 seen.add(value);const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Object.getOwnPropertySymbols(value).length)fail('Symbol property is not JSON data');
 for(const [key,d]of Object.entries(descriptors)){
  if(d.get||d.set||!Object.hasOwn(d,'value'))fail('Accessor is not editorial data');
  if(Array.isArray(value)&&key==='length')continue;
  if(!d.enumerable)fail('Hidden property is not JSON data');
  if(Array.isArray(value)&&! /^(0|[1-9][0-9]*)$/.test(key))fail('Extra array property');
  jsonData(d.value,seen,depth+1);
 }
 if(Array.isArray(value)&&Object.keys(value).length!==value.length)fail('Sparse array');
 seen.delete(value);
}
function canonical(value){jsonData(value);return JSON.stringify(value,(_,v)=>v&&!Array.isArray(v)&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
function hash(value){return crypto.createHash('sha256').update(canonical(value)).digest('hex');}
function readJSON(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function validateManifest(m){
 jsonData(m);ownKeys(m,['schemaVersion','rubric','acceptedGameCommit','editions','published']);
 if(m.schemaVersion!==1||m.rubric!=='quip-rubric@1'||! /^[a-f0-9]{40}$/.test(m.acceptedGameCommit))fail('Unknown authoring manifest');
 if(!Array.isArray(m.editions)||!m.editions.length)fail('No registered editions');
 const keys=new Set(),paths=new Set();let drafts=0;
 for(const e of m.editions){
  ownKeys(e,['id','version','status','path','catalogs','songLanguages','poolPolicies']);
  if(e.id!=='quip'||!Number.isSafeInteger(e.version)||e.version<1||!['draft','published'].includes(e.status))fail('Invalid edition registration');
  const key=e.id+'@'+e.version;if(keys.has(key)||paths.has(e.path))fail('Duplicate edition registration');keys.add(key);paths.add(e.path);
  if(e.path!==`editions/${e.id}-v${e.version}.json`)fail('Noncanonical edition path');fileWithin(e.path);
  ownKeys(e.songLanguages,['path','sha256']);if(typeof e.songLanguages.path!=='string'||! /^baselines\/song-languages-v[1-9][0-9]*\.json$/.test(e.songLanguages.path)||! /^[a-f0-9]{64}$/.test(e.songLanguages.sha256))fail('Invalid song language baseline');fileWithin(e.songLanguages.path);
  if(e.status==='draft')drafts++;
  if(!Array.isArray(e.catalogs)||!e.catalogs.length)fail('No catalog baselines');const names=new Set();
  for(const r of e.catalogs){ownKeys(r,['id','version','sha256']);if(typeof r.id!=='string'||! /^[a-z][a-z0-9-]*$/.test(r.id)||!Number.isSafeInteger(r.version)||r.version<1||names.has(r.id)||! /^[a-f0-9]{64}$/.test(r.sha256))fail('Invalid catalog reference');names.add(r.id);}
  ownKeys(e.poolPolicies,[...names]);for(const policy of Object.values(e.poolPolicies)){ownKeys(policy,['minimum','allowedModes']);if(!Number.isSafeInteger(policy.minimum)||policy.minimum<1)fail('Invalid pool minimum');list(policy.allowedModes,new Set(MODES),'allowed modes');}
 }
 if(drafts>1)fail('Only one active draft is allowed');
 if(!m.published||typeof m.published!=='object'||Array.isArray(m.published))fail('Invalid published locks');
 for(const [key,digest]of Object.entries(m.published))if(!keys.has(key)||! /^[a-f0-9]{64}$/.test(digest)||m.editions.find(e=>e.id+'@'+e.version===key).status!=='published')fail('Unknown published lock');
 for(const e of m.editions)if(e.status==='published'&&!Object.hasOwn(m.published,e.id+'@'+e.version))fail('Published edition has no digest');
 return m;
}
function manifest(){return validateManifest(readJSON(path.join(DIR,'manifest.json')));}
function fileWithin(relative){const p=path.resolve(DIR,relative);if(!p.startsWith(DIR+path.sep))fail('Path escapes authoring directory');return p;}
function context(data=content.readDataset(),m=manifest(),reference=null){
 validateManifest(m);
 const spec=reference?m.editions.find(e=>e.id===reference.id&&e.version===reference.version):m.editions.find(e=>e.status==='draft')||m.editions.at(-1);
 if(!spec||!['draft','published'].includes(spec.status))fail('Unknown registered edition');
 for(const s of data.sources.filter(s=>s.immutable)){const locked=data.lock.sources[s.path];if(!locked||locked.count!==s.rows.length||locked.sha256!==content.digest(s.rows))fail('Historical source changed '+s.path);}
 const sources=new Map();for(const s of data.sources.filter(s=>s.kind!=='packs'))for(const row of s.rows){if(sources.has(row.id))fail('Duplicate source ID '+row.id);sources.set(row.id,{row,path:'party-game/content/'+s.path,fingerprint:hash(row)});}
 const catalogs=spec.catalogs.map(ref=>{
  const pack=data.packs.find(p=>p.id===ref.id&&p.version===ref.version);if(!pack||!Array.isArray(pack.criteria?.cardIds))fail('Unknown explicit catalog '+ref.id+'@'+ref.version);
  const packDigest=hash(pack);if(packDigest!==ref.sha256)fail('Historical catalog definition changed '+ref.id+'@'+ref.version);
  if(spec.poolPolicies[ref.id].minimum<pack.minCardsPerPool)fail('A thematic minimum cannot be weakened');
  const ids=pack.criteria.cardIds.slice();if(new Set(ids).size!==ids.length)fail('Duplicate catalog ID');
  return {id:ref.id,version:ref.version,ids,idsDigest:hash(ids),packDigest,pack};
 });
 const ids=[...new Set(catalogs.flatMap(p=>p.ids))],general=catalogs.find(p=>p.id==='general');if(!general)fail('General baseline missing');
 for(const id of ids)if(!sources.has(id))fail('Missing source '+id);
 const languageRows=readJSON(fileWithin(spec.songLanguages.path));if(hash(languageRows)!==spec.songLanguages.sha256)fail('Song language baseline changed');
 const songLanguages=new Map();for(const r of languageRows){ownKeys(r,['id','text','language']);const source=sources.get(r.id)?.row;if(!source||source.type!=='song'||source.text!==r.text||!['ru','en'].includes(r.language)||songLanguages.has(r.id)||source.meta?.language&&source.meta.language!==r.language)fail('Invalid song language '+r.id);songLanguages.set(r.id,r.language);}
 for(const id of ids)if(sources.get(id).row.type==='song'&&!songLanguages.has(id))fail('Missing song language '+id);
 return {data,m,spec,sources,catalogs,ids,idSet:new Set(ids),general,songLanguages,categories:new Set(data.manifest.categories.map(c=>c.id)),themes:new Set(catalogs.filter(p=>p.id!=='general').map(p=>p.id))};
}
function proposal(id,c){
 const row=c.sources.get(id).row,type=row.type||'number';
 return {form:type,categories:(c.general.pack.categoryOverrides?.[id]||row.categories).slice(),legacyDifficulty:row.difficulty,themes:c.catalogs.filter(p=>p.id!=='general'&&p.ids.includes(id)).map(p=>p.id)};
}
function createDraft(c=context()){
 return {schemaVersion:1,id:c.spec.id,version:c.spec.version,rubric:'quip-rubric@1',songLanguagesDigest:c.spec.songLanguages.sha256,poolPolicies:JSON.parse(JSON.stringify(c.spec.poolPolicies)),catalogs:c.catalogs.map(({id,version,idsDigest,packDigest})=>({id,version,idsDigest,packDigest})),records:c.ids.map(id=>{
  const source=c.sources.get(id);return {id,source:{path:source.path,fingerprint:source.fingerprint},proposal:proposal(id,c),classification:null,review:{status:'pending',reviewer:null,reviewedAt:null,rationale:null}};
 })};
}
function text(value,name,min=1,max=1500){if(typeof value!=='string'||value.trim().length<min||value.length>max)fail('Invalid '+name);}
function list(value,allowed,name,{empty=false}={}){if(!Array.isArray(value)||(!empty&&!value.length)||new Set(value).size!==value.length||value.some(v=>!allowed.has(v)))fail('Invalid '+name);}
function typeAllows(form,mode,label){
 if(mode==='secret')return false;
 if(mode==='sing')return form==='song';if(mode==='yesno')return form==='person';if(mode==='approx')return form==='number';
 if(mode==='blitz')return form==='word'&&!/\s/u.test(label.trim());return ['word','phrase','idiom'].includes(form);
}
function validateClassification(value,source,c){
 ownKeys(value,['form','categories','themes','ambiguities','modes']);if(!FORMS.includes(value.form))fail('Unknown editorial form');
 // A versioned lexical correction may distinguish an old word-ID from a phrase,
 // but songs, people and numbers cannot silently become a different game kind.
 const rawForm=source.type||'number';if(!(['word','phrase','idiom'].includes(rawForm)&&['word','phrase','idiom'].includes(value.form))&&rawForm!==value.form)fail('Game kind changed');
 list(value.categories,c.categories,'categories');list(value.themes,c.themes,'themes',{empty:true});
 if(!Array.isArray(value.ambiguities)||value.ambiguities.length>8)fail('Invalid ambiguity list');value.ambiguities.forEach(v=>text(v,'ambiguity',1,200));
 ownKeys(value.modes,MODES);
 for(const mode of MODES){const judgement=value.modes[mode];
  if(mode==='secret'){ownKeys(judgement,['policy']);if(judgement.policy!=='actual-method')fail('Secret must use the actual method');continue;}
  ownKeys(judgement,['eligible','difficulty','reason','note'],['eligible','difficulty','reason']);
  if(typeof judgement.eligible!=='boolean'||!REASONS.includes(judgement.reason))fail('Invalid judgement '+mode);
  if(judgement.eligible){if(!LEVELS.includes(judgement.difficulty)||!typeAllows(value.form,mode,source.text||source.question))fail('Invalid eligible mode '+mode);}
  else if(judgement.difficulty!==null)fail('An ineligible mode has no difficulty');
  if(Object.hasOwn(judgement,'note'))text(judgement.note,'mode note',1,600);
 }
}
function validate(edition,c=context(),{release=false}={}){
 jsonData(edition);ownKeys(edition,['schemaVersion','id','version','rubric','songLanguagesDigest','poolPolicies','catalogs','records']);
 if(edition.schemaVersion!==1||edition.id!==c.spec.id||edition.version!==c.spec.version||edition.rubric!=='quip-rubric@1')fail('Unsupported editorial edition');
 if(edition.songLanguagesDigest!==c.spec.songLanguages.sha256)fail('Edition song language baseline changed');
 if(canonical(edition.poolPolicies)!==canonical(c.spec.poolPolicies))fail('Edition pool policies changed');
 const expected=c.catalogs.map(({id,version,idsDigest,packDigest})=>({id,version,idsDigest,packDigest}));if(canonical(edition.catalogs)!==canonical(expected))fail('Catalog baseline changed');
 if(!Array.isArray(edition.records)||edition.records.length!==c.ids.length)fail('Incomplete catalog coverage');
 const ids=new Set(),states={pending:0,'needs-source':0,reviewed:0};
 for(const r of edition.records){
  ownKeys(r,['id','source','proposal','classification','review']);if(!c.sources.has(r.id)||!c.idSet.has(r.id)||ids.has(r.id))fail('Unknown/duplicate ID '+r.id);ids.add(r.id);
  const source=c.sources.get(r.id);ownKeys(r.source,['path','fingerprint']);if(r.source.path!==source.path||r.source.fingerprint!==source.fingerprint)fail('Stale source '+r.id);
  ownKeys(r.proposal,['form','categories','legacyDifficulty','themes']);if(canonical(r.proposal)!==canonical(proposal(r.id,c)))fail('Migration hint changed; edit classification instead');
  ownKeys(r.review,['status','reviewer','reviewedAt','rationale']);if(!Object.hasOwn(states,r.review.status))fail('Unknown review status');states[r.review.status]++;
  if(r.classification!==null)validateClassification(r.classification,source.row,c);
  if(r.review.status==='reviewed'){
   if(r.classification===null)fail('Reviewed record has no classification');text(r.review.reviewer,'reviewer',1,100);text(r.review.rationale,'rationale',12,1500);
   if(typeof r.review.reviewedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(r.review.reviewedAt)||!Number.isFinite(Date.parse(r.review.reviewedAt)))fail('Invalid review timestamp');
  }else if(r.review.status==='pending'&&(r.review.reviewer!==null||r.review.reviewedAt!==null||r.review.rationale!==null))fail('A migrated hint is not a completed review');
  else if(r.review.status==='needs-source'){text(r.review.reviewer,'reviewer',1,100);text(r.review.rationale,'source question',12,1500);if(!Number.isFinite(Date.parse(r.review.reviewedAt)))fail('Invalid review timestamp');}
 }
 for(const id of c.ids)if(!ids.has(id))fail('Missing active ID '+id);
 const lock=c.m.published[edition.id+'@'+edition.version];if(lock&&hash(edition)!==lock)fail('Published edition is immutable; append a new version');
 const reviewComplete=states.reviewed===ids.size,releaseProblems=[];
 if(release&&!reviewComplete)fail('Release blocked: '+(c.ids.length-states.reviewed)+' records await semantic review');
 if(reviewComplete){
  const pools=poolMatrix(edition,c).filter(p=>p.theme==='general'&&p.category==='all');
  for(const mode of MODES)if(!pools.some(p=>p.mode===mode&&p.available))releaseProblems.push('no playable '+mode+' pool');
  if(!pools.some(p=>p.mode==='draw'&&p.tier==='easy'&&p.available))releaseProblems.push('safe drawing default is empty');
  for(const r of edition.records)if(r.classification.form==='word'&&/\s/u.test((c.sources.get(r.id).row.text||'').trim()))releaseProblems.push('multiword word '+r.id);
 }
 if(release&&releaseProblems.length)fail('Release blocked: '+releaseProblems[0]);
 return {ok:true,records:ids.size,general:c.general.ids.length,themeOnly:ids.size-c.general.ids.length,states,reviewComplete,releaseReady:reviewComplete&&!releaseProblems.length,releaseProblems};
}
function editionPath(c=context()){return fileWithin(c.spec.path);}
function readEdition(c=context()){return readJSON(editionPath(c));}
function apply(edition,decisions,{reviewer,at=new Date().toISOString()}={},c=context()){
 validate(edition,c);if(c.spec.status!=='draft'||c.m.published[edition.id+'@'+edition.version])fail('Cannot edit a published edition');text(reviewer,'reviewer',1,100);jsonData(decisions);
 if(!Array.isArray(decisions)||!decisions.length)fail('No individual decisions');const seen=new Set(),next=JSON.parse(JSON.stringify(edition)),records=new Map(next.records.map(r=>[r.id,r]));
 for(const d of decisions){ownKeys(d,['id','fingerprint','classification','rationale']);if(seen.has(d.id)||!records.has(d.id))fail('Unknown/duplicate decision ID');seen.add(d.id);const r=records.get(d.id);
  if(d.fingerprint!==r.source.fingerprint)fail('Stale decision '+d.id);validateClassification(d.classification,c.sources.get(d.id).row,c);text(d.rationale,'rationale',12,1500);
  r.classification=JSON.parse(JSON.stringify(d.classification));r.review={status:'reviewed',reviewer,reviewedAt:at,rationale:d.rationale};
 }
 validate(next,c);return next;
}
function poolMatrix(edition,c=context()){
 const counts=new Map(),generalIds=new Set(c.general.ids);
 const key=(theme,category,mode,tier)=>[theme,category,mode,tier].join('|');
 for(const r of edition.records){
  if(r.review.status!=='reviewed')continue;const cl=r.classification;
  const themes=[...(generalIds.has(r.id)?['general']:[]),...cl.themes],categories=['all',...cl.categories],levels=new Map();
  for(const mode of MODES.filter(m=>m!=='secret'))if(cl.modes[mode].eligible)levels.set(mode,[cl.modes[mode].difficulty]);
  levels.set('secret',[...new Set(['talk','mime','draw','sing','yesno'].filter(m=>cl.modes[m].eligible).map(m=>cl.modes[m].difficulty))]);
  const source=c.sources.get(r.id).row,label=content.normalize(source.text||source.question);
  for(const theme of themes)for(const category of categories)for(const [mode,tiers]of levels)for(const tier of tiers){const k=key(theme,category,mode,tier);if(!counts.has(k))counts.set(k,new Set());counts.get(k).add(label);}
 }
 const matrix=[];
 for(const theme of ['general',...c.themes])for(const category of ['all',...c.categories])for(const mode of MODES)for(const tier of LEVELS){
  const policy=c.spec.poolPolicies[theme],allowed=policy.allowedModes.includes(mode);
  const count=allowed?(counts.get(key(theme,category,mode,tier))?.size||0):0;
  const minimum=Math.max(policy.minimum,mode==='blitz'?3:1);matrix.push({theme,category,mode,tier,count,minimum,available:count>=minimum});
 }
 return matrix;
}
function audit(edition,c=context()){
 const tallies=()=>Object.fromEntries(MODES.map(m=>[m,m==='secret'?{eligible:0,ineligible:0,derived:0,byMethod:Object.fromEntries(['talk','mime','draw','sing','yesno'].map(method=>[method,{easy:0,medium:0,hard:0}]))}:{eligible:0,ineligible:0,easy:0,medium:0,hard:0,reasons:{}}]));
 const result=validate(edition,c),byMode=tallies(),byFormMode=Object.fromEntries(FORMS.map(f=>[f,tallies()])),byType={},byCategory={},intersections={},pending=[],uncertain=[],allExcluded=[],normalized=new Map(),pluralCandidates=[],formConflicts=[],themeChanges=[];
 for(const r of edition.records){const source=c.sources.get(r.id).row,form=source.type||'number';byType[form]=(byType[form]||0)+1;
  // Reports never contain numeric answers, derivations or answer-bearing URLs.
  const label=source.text||source.question,key=content.normalize(label);if(!normalized.has(key))normalized.set(key,[]);normalized.get(key).push(r.id);
  if(form==='word'&&/(?:ы|и)$/iu.test(label))pluralCandidates.push({id:r.id,text:label,status:'linguistic-review-only'});
  if(r.review.status!=='reviewed'){pending.push({id:r.id,type:form,text:label,status:r.review.status});continue;}
  const classification=r.classification;
  if(canonical(classification.themes.slice().sort())!==canonical(r.proposal.themes.slice().sort()))themeChanges.push({id:r.id,text:label,before:r.proposal.themes,after:classification.themes});
  if(classification.form==='word'&&/\s/u.test(label.trim()))formConflicts.push({id:r.id,text:label,form:'word',reason:'multiword'});
  for(const cat of classification.categories)byCategory[cat]=(byCategory[cat]||0)+1;
  for(const [i,a]of classification.categories.entries())for(const b of classification.categories.slice(i+1)){const pair=[a,b].sort().join('+');intersections[pair]=(intersections[pair]||0)+1;}
  if(r.classification.ambiguities.length)uncertain.push({id:r.id,text:label,meanings:r.classification.ambiguities});
  for(const target of [byMode,byFormMode[classification.form]])for(const mode of MODES){const j=classification.modes[mode];if(mode==='secret'){
   target[mode].derived++;const methods=['talk','mime','draw','sing','yesno'];target[mode][methods.some(m=>classification.modes[m].eligible)?'eligible':'ineligible']++;
   for(const method of methods){const actual=classification.modes[method];if(actual.eligible)target[mode].byMethod[method][actual.difficulty]++;}
  }else{target[mode][j.eligible?'eligible':'ineligible']++;if(j.eligible)target[mode][j.difficulty]++;else target[mode].reasons[j.reason]=(target[mode].reasons[j.reason]||0)+1;}}
  if(MODES.filter(m=>m!=='secret').every(m=>!r.classification.modes[m].eligible))allExcluded.push({id:r.id,text:label});
 }
 return {...result,byType,byMode,byFormMode,byCategory,intersections,pending,ambiguities:uncertain,allExcluded,formConflicts,themeChanges,duplicates:[...normalized].filter(([,ids])=>ids.length>1).map(([text,ids])=>({text,ids})),pluralCandidates,pools:poolMatrix(edition,c)};
}
function writeDraft(edition,c){validate(edition,c);const target=editionPath(c),temp=target+'.tmp';if(c.spec.status!=='draft'||c.m.published[edition.id+'@'+edition.version])fail('Cannot replace a published file');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(temp,JSON.stringify(edition,null,2)+'\n');fs.renameSync(temp,target);}
function run(argv=process.argv.slice(2)){
 const command=argv[0]||'audit',c=context();
 if(command==='init'){const target=editionPath(c);if(fs.existsSync(target))fail('Draft already exists');const e=createDraft(c);validate(e,c);writeDraft(e,c);console.log(JSON.stringify({created:path.relative(ROOT,target),...validate(e,c)}));return;}
 const edition=readEdition(c);
 if(command==='check')console.log(JSON.stringify(validate(edition,c,{release:argv.includes('--release')})));
 else if(command==='audit')console.log(JSON.stringify(audit(edition,c),null,2));
 else if(command==='review-batch'){
  validate(edition,c);const start=Number(argv[1]||0),size=Number(argv[2]||100);if(!Number.isInteger(start)||start<0||!Number.isInteger(size)||size<1||size>250)fail('Invalid batch');
  const rows=edition.records.filter(r=>r.review.status!=='reviewed').sort((a,b)=>hash(a.id).localeCompare(hash(b.id))).slice(start,start+size);
  console.log(JSON.stringify(rows.map(r=>({id:r.id,fingerprint:r.source.fingerprint,type:c.sources.get(r.id).row.type||'number',text:c.sources.get(r.id).row.text||c.sources.get(r.id).row.question,proposal:r.proposal})),null,2));
 }else if(command==='apply'){
  const file=argv[1],reviewer=argv[2];if(!file||!reviewer)fail('Use apply decisions.json reviewer');const next=apply(edition,readJSON(path.resolve(file)),{reviewer},c);writeDraft(next,c);console.log(JSON.stringify(validate(next,c)));
 }else fail('Use init, check [--release], audit, review-batch [offset] [size], or apply decisions.json reviewer');
}
module.exports={MODES,LEVELS,FORMS,REASONS,context,hash,jsonData,validateManifest,createDraft,validate,validateClassification,readEdition,writeDraft,apply,audit,poolMatrix,typeAllows,run};
if(require.main===module)try{run()}catch(e){console.error(e.message);process.exitCode=1;}
