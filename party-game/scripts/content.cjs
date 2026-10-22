'use strict';
// Build-time only. The browser still loads the same three static runtime modules.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),contentRoot=path.join(root,'content');
const normalize=text=>String(text).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function contentPath(relative){const target=path.resolve(contentRoot,relative);if(!target.startsWith(contentRoot+path.sep))throw Error('Content path escapes source directory');return target;}
function readDataset(){
 const manifest=JSON.parse(fs.readFileSync(contentPath('manifest.json'),'utf8')),lock=JSON.parse(fs.readFileSync(contentPath('baseline-lock.json'),'utf8'));
 if(manifest.schemaVersion!==1)throw Error('Unknown content manifest version');
 const data={manifest,lock,cards:[],questions:[],packs:[],sources:[]},seen=new Set();
 for(const kind of ['cards','questions','packs'])for(const source of manifest[kind]){
  if(seen.has(source.path))throw Error('Duplicate source path: '+source.path);seen.add(source.path);
  const rows=JSON.parse(fs.readFileSync(contentPath(source.path),'utf8'));if(!Array.isArray(rows))throw Error('Expected source array: '+source.path);
  data[kind].push(...rows);data.sources.push({kind,...source,rows});
 }
 return data;
}
function numericAnswer(value){
 let text=String(value).replace(/−/g,'-').replace(/,/g,'.').replace(/\s/g,'');
 const superscript={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-'};
 text=text.replace(/[×x*]10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g,(_,power)=>'e'+[...power].map(c=>superscript[c]).join(''));
 return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(text)?Number(text):NaN;
}
function checkedFormula(source){
 const expression=source.slice(8),tokens=expression.match(/[A-Za-z_][A-Za-z_0-9]*/g)||[];
 if(!/^[\d\s.+\-*/()%A-Za-z_]+$/.test(expression)||tokens.some(t=>!['Math','PI','round','sqrt','floor','ceil','abs','pow'].includes(t)))throw Error('Unsupported arithmetic expression');
 return vm.runInNewContext(expression,{Math},{timeout:25});
}
function groups(rows,field){const map=new Map();for(const row of rows){const key=normalize(row[field]);if(!map.has(key))map.set(key,[]);map.get(key).push(row.id)}return [...map].filter(([,ids])=>ids.length>1).map(([text,ids])=>({text,ids}));}
// Review candidates, not semantic identity. No stemming or automatic classification.
function nearCandidates(rows,field){
 const index=new Map(),pairs=new Map();
 for(const row of rows){const text=normalize(row[field]),tokens=[...new Set(text.split(' ').filter(t=>t.length>=4))],keys=new Set(['prefix:'+text.slice(0,4),...tokens.map(t=>'token:'+t)]);
  const candidates=new Set();for(const key of keys)for(const previous of index.get(key)||[])candidates.add(previous);
  for(const previous of candidates){if(previous.text===text)continue;const a=text.split(' '),b=previous.text.split(' '),common=a.filter(t=>b.includes(t)).length;
   const gram=t=>new Set(Array.from({length:Math.max(0,t.length-2)},(_,i)=>t.slice(i,i+3))),ga=gram(text),gb=gram(previous.text),overlap=[...ga].filter(t=>gb.has(t)).length;
   if(Math.min(a.length,b.length)>=2&&common/Math.max(a.length,b.length)>=.75||Math.min(text.length,previous.text.length)>=8&&2*overlap/(ga.size+gb.size)>=.88){const ids=[previous.id,row.id].sort();pairs.set(ids.join('|'),{ids,texts:[previous.text,text],decision:'manual-review'});}
  }
  const entry={id:row.id,text};for(const key of keys){if(!index.has(key))index.set(key,[]);index.get(key).push(entry)}
 }
 return [...pairs.values()];
}
function render(data){
 const template=(name,side)=>fs.readFileSync(contentPath('templates/'+name+'.'+side+'.js'),'utf8');
 const lines=rows=>rows.map(row=>'  '+JSON.stringify(row)).join(',\n');
 const tuples=data.questions.map(q=>[q.id.slice(7),q.difficulty,q.question,q.answer,q.unit,q.categories.join(','),q.note,q.source,q.pack]);
 return {'cards.js':template('cards','before')+'\n'+lines(data.cards)+template('cards','after'),
  'approx-questions.js':template('approx-questions','before')+'\n'+lines(tuples)+template('approx-questions','after'),
  'content-packs.js':template('content-packs','before')+'\n'+lines(data.packs)+template('content-packs','after')};
}
function validate(data,{locks=true,near=false}={}){
 const errors=[],warnings=[],add=(code,id,message)=>errors.push({code,id,message}),ids=new Set(),tags=new Set();
 for(const category of data.manifest.categories){if(!/^[a-z][a-z0-9-]*$/.test(category.id)||!category.name||tags.has(category.id))add('category',category.id,'Invalid or duplicate category');tags.add(category.id)}
 if(locks)for(const sourcePath of Object.keys(data.lock.sources))if(!data.sources.some(source=>source.path===sourcePath))add('historical-source',sourcePath,'Immutable source omitted from manifest');
 for(const source of data.sources){
  if(!source.review)warnings.push({code:'category-review',source:source.path,message:'Editorial provenance/category review is missing'});
  const locked=data.lock.sources[source.path];
  if(locks&&source.immutable&&(!locked||locked.count!==source.rows.length||locked.sha256!==digest(source.rows)))add('historical-source',source.path,'Immutable source changed; add a new source and selection policy instead');
 }
 for(const row of [...data.cards,...data.questions]){
  if(!row||typeof row!=='object'){add('schema','?', 'Record must be an object');continue;}
  if(typeof row.id!=='string'||ids.has(row.id))add('id',row.id,'Missing or duplicate ID');ids.add(row.id);
  if(!['easy','medium','hard'].includes(row.difficulty))add('difficulty',row.id,'Unknown difficulty');
  if(!Array.isArray(row.categories)||new Set(row.categories).size!==row.categories.length||row.categories.some(t=>!tags.has(t)))add('categories',row.id,'Unknown/duplicate category or missing category array');
  else if(!row.categories.length)warnings.push({code:'unclassified',id:row.id,message:'Category needs editorial review; never infer from a word match'});
  if(typeof row.pack!=='string'||!row.pack) add('origin',row.id,'Missing source pack; source and category are separate');
  if(row.meta!=null&&(typeof row.meta!=='object'||Array.isArray(row.meta)))add('metadata',row.id,'Metadata must be an object');
 }
 for(const row of data.cards){
  if(row.meta?.equivalenceKey!=null&&(typeof row.meta.equivalenceKey!=='string'||!normalize(row.meta.equivalenceKey)||row.meta.equivalenceKey.length>120))add('equivalence',row.id,'Editorial equivalence key must be a nonempty short string');
  if(!['word','phrase','idiom','song','person'].includes(row.type)||!new RegExp('^'+row.type+'-[0-9]{6}$').test(row.id))add('type',row.id,'Invalid type or typed permanent ID');
  if(typeof row.text!=='string'||!row.text.trim())add('text',row.id,'Missing playable text');
  else if(row.type==='word'&&/\s/.test(row.text)||row.type==='phrase'&&!/\s/.test(row.text))warnings.push({code:'possible-type',id:row.id,message:'Check word/phrase classification manually'});
 }
 for(const row of data.questions){
  if(!/^approx-[0-9]+$/.test(row.id)||typeof row.question!=='string'||!row.question.trim())add('question',row.id,'Missing question or permanent ID');
  if(typeof row.unit!=='string'||typeof row.note!=='string'||!Number.isFinite(numericAnswer(row.answer)))add('answer',row.id,'Missing unit/note or invalid finite numeric answer');
  try{
   if(typeof row.source!=='string'||!row.source)throw Error('Missing source');
   if(row.source.startsWith('https://')){const url=new URL(row.source);if(!url.hostname.includes('.')||url.username||url.password)throw Error('Invalid source URL');}
   else if(row.source.startsWith('formula:')){if(checkedFormula(row.source)!==numericAnswer(row.answer))throw Error('Formula does not match answer');}
   else if(!/^definition:[a-zA-Z0-9-]+$/.test(row.source))throw Error('Expected institutional URL, definition or arithmetic formula');
  }catch(error){add('source',row.id,error.message)}
 }
 const collisions=groups(data.cards,'text');
 for(const group of collisions){const old=data.manifest.legacyCollisions.find(g=>g.text===group.text&&g.ids.slice().sort().join('|')===group.ids.slice().sort().join('|'));
  if(!old)add('normalized-duplicate',group.ids.join(', '),group.text);else warnings.push({code:'historical-collision',ids:group.ids,message:group.text});}
 for(const group of groups(data.questions,'question'))add('normalized-question-duplicate',group.ids.join(', '),group.text);
 if(!errors.length)try{
  const context=vm.createContext({}),artifacts=render(data);
  for(const name of ['cards.js','approx-questions.js','mode-config.js','rules.js','content-packs.js'])vm.runInContext(artifacts[name]||fs.readFileSync(path.join(root,name),'utf8'),context);
  const problems=vm.runInContext(`Object.values(QUIP_CONTENT_PACKS).filter(p=>p.enabled).flatMap(p=>{
   const selection={id:p.id,version:p.version},settings={rulesVersion:5,awardTo:'guesser',difficulty:'mixed',modes:p.allowedModes||Object.keys(QUIP_MODES_V4).filter(id=>id!=='approx'||p.types.includes('number')),promptTypes:['word','phrase','idiom'].filter(t=>p.types.includes(t))};
   return checkContentPack(selection,settings).problems.map(reason=>({pack:p.id+'@'+p.version,reason}));})`,context);
  for(const p of problems)add('pool',p.pack,p.reason);
 }catch(error){add('runtime','catalog',error.message)}
 const candidates=near?[...nearCandidates(data.cards,'text'),...nearCandidates(data.questions,'question')]:[];
 return {ok:!errors.length,counts:{cards:data.cards.length,questions:data.questions.length,packs:data.packs.length},errors,warnings,nearCandidates:candidates,reviewLimit:'Normalization is exact-text comparison. Near matches, semantic equivalence, factual answers and category relevance need human review.'};
}
function statistics(data){
 const artifacts=render(data),bytes=Object.fromEntries(Object.entries(artifacts).map(([name,text])=>[name,{bytes:Buffer.byteLength(text),gzipBytes:zlib.gzipSync(text).length}]));
 const measure=source=>{const c=vm.createContext({});const start=performance.now();vm.runInContext(source,c);return Math.round((performance.now()-start)*100)/100};
 const tenThousand=Array.from({length:10000},(_,i)=>({...data.cards[i%data.cards.length],id:'benchmark-'+i}));
 return {runtime:bytes,measurements:{environment:'Node '+process.version+' VM, single run; not a phone/browser benchmark',currentCards:data.cards.length,currentParseMs:measure(artifacts['cards.js']),syntheticCards:10000,syntheticParseMs:measure("const rows="+JSON.stringify(tenThousand)+';const byId=new Map(rows.map(r=>[r.id,r]));')},decision:'Keep static runtime artifacts; editable source partitioning adds no browser requests.'};
}
if(require.main===module){
 try{const command=process.argv[2]||'check',data=readDataset(),result=validate(data,{near:command==='audit'});if(!result.ok){console.error(JSON.stringify(result.errors,null,2));process.exitCode=1}
 else if(command==='build'){for(const[name,text]of Object.entries(render(data)))fs.writeFileSync(path.join(root,name),text);console.log(JSON.stringify({built:Object.keys(render(data)),counts:result.counts}));}
 else if(command==='stats')console.log(JSON.stringify(statistics(data),null,2));
 else if(command==='audit')console.log(JSON.stringify(result,null,2));
 else if(command==='check'){const stale=Object.entries(render(data)).filter(([name,text])=>fs.readFileSync(path.join(root,name),'utf8')!==text).map(([name])=>name);if(stale.length){console.error('Generated files are stale: '+stale.join(', '));process.exitCode=1}else console.log(JSON.stringify({ok:true,...result.counts,historicalCollisions:result.warnings.filter(w=>w.code==='historical-collision').length,unclassified:result.warnings.filter(w=>w.code==='unclassified').length,sourceReview:'Institutional URLs and category relevance still require editorial verification'}));}
 else throw Error('Use check, build, audit or stats');
 }catch(error){console.error(error.message);process.exitCode=1}
}
module.exports={readDataset,validate,render,normalize,numericAnswer,checkedFormula,nearCandidates,statistics,digest};
