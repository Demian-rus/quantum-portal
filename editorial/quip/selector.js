'use strict';
// Pure TASK041 selection contract; not connected to the shipped game yet.
// Random draws, scoring, timers and history remain owned by the game engine.
const QuipEditorialSelection=(()=>{
 const MODES=Object.freeze(['talk','mime','draw','sing','yesno','secret','blitz','approx']);
 const METHODS=Object.freeze(['talk','mime','draw','sing','yesno']);
 const TIERS=Object.freeze(['easy','medium','hard']);
 const FORMS=Object.freeze(['word','phrase','idiom','song','person','number']);
 const STORED_MODES=Object.freeze(MODES.filter(m=>m!=='secret'));
 const DEFAULT_CHOICES=Object.freeze({talk:'general',mime:'easy',draw:'easy',sing:'general',yesno:'general',secret:'method',blitz:'all',approx:'general'});
 function fail(message){throw Error('EDITORIAL SELECTION: '+message);}
 function plain(value,seen=new Set()){
  if(value===null||typeof value==='string'||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value))fail('Non-finite value');return;}
  if(typeof value!=='object'||seen.has(value)||Object.getOwnPropertySymbols(value).length)fail('Not JSON data');
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value);if(proto!==(array?Array.prototype:Object.prototype)&&proto!==null)fail('Invalid prototype');
  seen.add(value);for(const [key,d]of Object.entries(Object.getOwnPropertyDescriptors(value))){
   if(array&&key==='length')continue;
   if(!d.enumerable||d.get||d.set||!Object.hasOwn(d,'value')||array&&! /^(0|[1-9][0-9]*)$/.test(key))fail('Invalid property');plain(d.value,seen);
  }
  if(array&&Object.keys(value).length!==value.length)fail('Sparse array');seen.delete(value);
 }
 function keys(value,expected){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==expected.slice().sort().join(','))fail('Unexpected fields');}
 function list(value,known,{empty=false}={}){if(!Array.isArray(value)||(!empty&&!value.length)||new Set(value).size!==value.length||value.some(v=>!known.includes(v)))fail('Invalid list');}
 function preferences(raw={version:1,choices:DEFAULT_CHOICES}){
  plain(raw);keys(raw,['version','choices']);if(raw.version!==1)fail('Unknown task-level policy');keys(raw.choices,MODES);
  for(const mode of MODES){const allowed=[...TIERS,...(mode==='secret'?['method','general']:['general']),...(mode==='blitz'?['all']:[])];if(!allowed.includes(raw.choices[mode]))fail('Unknown '+mode+' choice');}
  return Object.freeze({version:1,choices:Object.freeze({...raw.choices})});
 }
 function tiersFor(raw,mode,roundTier,method=null){
  const policy=preferences(raw);if(!MODES.includes(mode)||!TIERS.includes(roundTier))fail('Unknown mode/round difficulty');
  if(mode==='secret'){
   if(!METHODS.includes(method))fail('Secret needs an actual method');
   const actual=tiersFor(policy,method,roundTier),choice=policy.choices.secret;
   return choice==='method'?actual:actual.filter(t=>t===(choice==='general'?roundTier:choice));
  }
  if(method!==null)fail('Actual method is only valid for Secret');
  const choice=policy.choices[mode];return choice==='all'?TIERS.slice():[choice==='general'?roundTier:choice];
 }
 function normalize(text){return text.normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
 function typeAllows(form,mode,text){
  if(mode==='sing')return form==='song';if(mode==='yesno')return form==='person';if(mode==='approx')return form==='number';
  if(mode==='blitz')return form==='word'&&!/\s/u.test(text.trim());return ['word','phrase','idiom'].includes(form);
 }
 function createIndex(edition,rows){
  plain(edition);keys(edition,['schemaVersion','id','version','rubric','digest','categories','themes','catalogs','records']);
  plain(rows);if(!Array.isArray(rows))fail('Invalid source rows');
  if(edition.schemaVersion!==1||edition.id!=='quip'||!Number.isSafeInteger(edition.version)||edition.version<1||edition.rubric!=='quip-rubric@1'||! /^[a-f0-9]{64}$/.test(edition.digest))fail('Unknown edition');
  if(!Array.isArray(edition.categories)||edition.categories.length>30||!edition.categories.length||edition.categories.some(x=>typeof x!=='string')||new Set(edition.categories).size!==edition.categories.length)fail('Invalid categories');
  if(!Array.isArray(edition.themes)||edition.themes.length>30||edition.themes.includes('general')||edition.themes.some(x=>typeof x!=='string')||new Set(edition.themes).size!==edition.themes.length)fail('Invalid themes');
  const source=new Map();for(const row of rows){if(source.has(row.id))fail('Duplicate source ID');source.set(row.id,row);}
  const data=new Map();keys(edition.catalogs,['general',...edition.themes]);
  const general=edition.catalogs.general;keys(general,['ids','minimum','allowedModes']);
  for(const pack of Object.values(edition.catalogs)){keys(pack,['ids','minimum','allowedModes']);list(pack.allowedModes,MODES);if(!Number.isSafeInteger(pack.minimum)||pack.minimum<1||!Array.isArray(pack.ids)||new Set(pack.ids).size!==pack.ids.length)fail('Invalid catalog');}
  if(!edition.records||Array.isArray(edition.records)||typeof edition.records!=='object')fail('Invalid metadata map');
  const categoryLimit=2**edition.categories.length-1,themeLimit=2**edition.themes.length-1;
  for(const [id,tuple]of Object.entries(edition.records)){
   const row=source.get(id);if(!row||!Array.isArray(tuple)||tuple.length!==5)fail('Missing source/metadata '+id);
   const [form,categoryMask,themeMask,levels,language]=tuple;
   if(!Number.isInteger(form)||!FORMS[form]||!Number.isSafeInteger(categoryMask)||categoryMask<1||categoryMask>categoryLimit||!Number.isSafeInteger(themeMask)||themeMask<0||themeMask>themeLimit||typeof levels!=='string'||! /^[0-3]{7}$/.test(levels)||!['','ru','en'].includes(language))fail('Invalid metadata '+id);
   const rawForm=row.type||'number',newForm=FORMS[form];if(!(['word','phrase','idiom'].includes(rawForm)&&['word','phrase','idiom'].includes(newForm))&&rawForm!==newForm)fail('Changed game kind '+id);
   if(newForm==='song'?!['ru','en'].includes(language):language!=='')fail('Invalid song language '+id);
   for(const [i,mode]of STORED_MODES.entries())if(levels[i]!=='0'&&!typeAllows(newForm,mode,row.text||row.question))fail('Incompatible method '+id);
   data.set(id,Object.freeze({row,form:newForm,categoryMask,themeMask,levels,language}));
  }
  const universe=new Set(Object.values(edition.catalogs).flatMap(p=>p.ids));
  if(universe.size!==data.size||[...universe].some(id=>!data.has(id)))fail('Catalog coverage mismatch');
  const categories=edition.categories.slice(),themes=edition.themes.slice(),catalogs=Object.fromEntries(Object.entries(edition.catalogs).map(([name,p])=>[name,{ids:p.ids.slice(),minimum:p.minimum,allowedModes:p.allowedModes.slice()}]));
  function pool(request){
   plain(request);keys(request,['theme','mode','method','tiers','promptTypes','excludedCategories','languages']);
   const {theme,mode,method,tiers,promptTypes,excludedCategories,languages}=request;
   if(!Object.hasOwn(catalogs,theme)||!MODES.includes(mode))fail('Unknown theme/mode');
   const actual=mode==='secret'?method:mode;if(mode==='secret'?!METHODS.includes(method):method!==null)fail('Unknown actual method');
   list(tiers,TIERS,{empty:true});list(promptTypes,['word','phrase','idiom'],{empty:true});list(excludedCategories,categories,{empty:true});list(languages,['ru','en'],{empty:true});
   const pack=catalogs[theme];if(!pack.allowedModes.includes(mode)||!pack.allowedModes.includes(actual))return [];
   const excluded=excludedCategories.reduce((mask,tag)=>mask|2**categories.indexOf(tag),0),tierCodes=new Set(tiers.map(t=>String(TIERS.indexOf(t)+1))),position=STORED_MODES.indexOf(actual);
   // A thematic selection is explicit metadata membership. General's historical
   // universe remains exactly the declared general IDs.
   const ids=theme==='general'?pack.ids:[...data.keys()].filter(id=>data.get(id).themeMask&2**themes.indexOf(theme));
   return ids.map(id=>data.get(id)).filter(r=>!(r.categoryMask&excluded)&&tierCodes.has(r.levels[position])&&
    (!['talk','mime','draw','blitz'].includes(actual)||promptTypes.includes(r.form))&&
    (actual!=='sing'||languages.includes(r.language))).map(r=>r.row);
  }
  function availability(request){
   const cards=pool(request),count=new Set(cards.map(row=>normalize(row.text||row.question))).size,minimum=Math.max(catalogs[request.theme].minimum,request.mode==='blitz'?3:1);
   return {available:count>=minimum,count,minimum,reason:count>=minimum?'':`Для выбранного режима и сложности доступно ${count}, нужно ${minimum}. Измените сложность, категории или тему.`};
  }
  return Object.freeze({pool,availability,reference:Object.freeze({id:edition.id,version:edition.version,digest:edition.digest})});
 }
 return Object.freeze({MODES,METHODS,TIERS,FORMS,STORED_MODES,DEFAULT_CHOICES,preferences,tiersFor,createIndex});
})();
if(typeof module==='object'&&module.exports)module.exports=QuipEditorialSelection;
