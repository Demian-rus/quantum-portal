
]);
// Generated from the editorial ledger, including reviewed legacy songs without metadata.
const QUIP_SONG_LANGUAGES=Object.freeze(/* reviewed-song-languages */{});
// V1 filters direct sing only; V2 also covers the singing method inside Secret.
const QUIP_SONG_LANGUAGE_POLICY_VERSION=2;
function songLanguagePolicy(match){
 if(match?.songLanguagePolicyVersion==null){
  if(match?.songLanguages!=null)throw Error('Missing QUIP song language policy');
  return null;
 }
 if(![1,2].includes(match.songLanguagePolicyVersion)||!Array.isArray(match.songLanguages)||!match.songLanguages.length||
  new Set(match.songLanguages).size!==match.songLanguages.length||match.songLanguages.some(language=>!['ru','en'].includes(language)))
  throw Error('Unsupported QUIP song language policy');
 return match.songLanguages;
}
function filterSongLanguagePool(pool,match,modeId='sing'){
 const languages=songLanguagePolicy(match);
 const applies=modeId==='sing'||match?.songLanguagePolicyVersion===2;
 return languages&&applies?pool.filter(card=>languages.includes(QUIP_SONG_LANGUAGES[card.id])):pool;
}
function listThematicPacks(settings,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS,questions=QUIP_APPROX_QUESTIONS){
 const latest=new Map();
 for(const pack of Object.values(registry))if(pack.id!=='general'&&(!latest.has(pack.id)||latest.get(pack.id).version<pack.version))
  latest.set(pack.id,pack);
 return [...latest.values()].map(pack=>{const selection={id:pack.id,version:pack.version},setup=pack.allowedModes?packSetupSettings(selection,settings,registry):settings;
  // Preview an empty setup without silently selecting modes in the actual settings.
  const preview=setup.modes.length?setup:{...setup,modes:(pack.allowedModes||Object.keys(QUIP_MODES_V4)).filter(id=>modeAwardAvailability(id,setup).available)};
  return {pack,...checkContentPack(selection,preview,cards,registry,questions)};});
}
function getContentPack(selection,registry=QUIP_CONTENT_PACKS){
 validateGeneralCategorySelection(selection);
 const pack=registry[selection?.id+'@'+selection?.version];
 if(!pack)throw Error('Unknown QUIP content pack/version');
 return pack;
}
// General 1/2 were unbounded before TASK009. This adapter freezes their source
// universe without editing their historical declarations or current rounds.
const QUIP_PRE_TASK009_SOURCES=Object.freeze(['core','music','people','geography-v2','science-v2','approx-core-v1','approx-general-2026']);
// TASK038: versioned exclusions belong to a pack snapshot, never to the RNG.
const QUIP_GENERAL_CATEGORY_LABELS=Object.freeze(/* general-category-labels */{});
const QUIP_GENERAL_CATEGORY_KEY='kvip:general-categories:v1';
const QUIP_GENERAL_CATEGORIES_ALL=Object.freeze({version:1,excluded:Object.freeze([])});
function generalCategoryPolicy(value){
 if(value===undefined)return null;
 if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||
  Object.keys(value).sort().join(',')!=='excluded,version'||!Array.isArray(value.excluded)||value.excluded.length>512||
  value.excluded.some(id=>typeof id!=='string'||!/^[a-z][a-z0-9-]*$/.test(id))||new Set(value.excluded).size!==value.excluded.length)
  throw Error('Unsupported general category policy');
 return value;
}
function validateGeneralCategorySelection(selection){
 const policy=generalCategoryPolicy(selection?.categoryPolicy);
 if(policy&&selection.id!=='general')throw Error('Category policy is only valid for the general dictionary');
 return policy;
}
function generalCategorySelection(selection,policy){
 if(selection.id!=='general')return selection;
 const requested=generalCategoryPolicy(policy),base={id:selection.id,version:selection.version};
 return requested?.excluded.length?{...base,categoryPolicy:{version:1,excluded:requested.excluded.slice()}}:base;
}
let generalCategoryPreferenceCache=null;
function readGeneralCategoryPreferences(){
 let raw;try{raw=localStorage.getItem(QUIP_GENERAL_CATEGORY_KEY);}catch{return {raw:null,policy:null,problem:'Не удалось прочитать категории. Настройки защищены.'};}
 if(generalCategoryPreferenceCache?.raw===raw)return generalCategoryPreferenceCache;
 try{const policy=raw===null?QUIP_GENERAL_CATEGORIES_ALL:JSON.parse(raw);generalCategoryPolicy(policy);
  if(!policy)throw Error('Missing policy');
  generalCategoryPreferenceCache={raw,policy:Object.freeze({version:1,excluded:Object.freeze(policy.excluded.slice())}),problem:''};
 }catch{generalCategoryPreferenceCache={raw,policy:null,problem:'Настройки категорий повреждены или созданы другой версией. Исходные данные защищены.'};}
 return generalCategoryPreferenceCache;
}
function writeGeneralCategoryPreferences(excluded){
 const policy={version:1,excluded:excluded.slice().sort()};generalCategoryPolicy(policy);
 const before=readGeneralCategoryPreferences();if(before.problem)throw Error(before.problem);
 const raw=JSON.stringify(policy);
 if(localStorage.getItem(QUIP_GENERAL_CATEGORY_KEY)!==before.raw)throw Error('Категории изменились в другой вкладке. Повторите выбор.');
 if(raw!==before.raw)localStorage.setItem(QUIP_GENERAL_CATEGORY_KEY,raw);
 if(localStorage.getItem(QUIP_GENERAL_CATEGORY_KEY)!==raw)throw Error('Не удалось сохранить категории. Проверьте настройки после перезагрузки.');
 generalCategoryPreferenceCache=null;return readGeneralCategoryPreferences();
}
function setupCategorySelection(selection){
 if(selection.id!=='general')return selection;
 const preferences=readGeneralCategoryPreferences();if(preferences.problem)throw Error(preferences.problem);
 return generalCategorySelection(selection,preferences.policy);
}
function setupCategoryProblem(selection){return selection?.id==='general'?readGeneralCategoryPreferences().problem:'';}
let generalCategoryIndexes=null;
function buildGeneralCategoryIndex(selection,rows,registry){
 const pack=getContentPack(selection,registry),ids=new Set(pack.criteria.cardIds),sources=new Set(pack.criteria.sourcePacks);
 const base=rows.filter(row=>historicalGeneralRecord(pack,row)&&pack.types.includes(row.type||'number')&&
  (!pack.categories.length||pack.categories.some(tag=>row.categories.includes(tag)))&&
  (!ids.size||ids.has(row.id))&&(!sources.size||sources.has(row.pack)));
 const tags=new Map();for(const row of base)for(const tag of row.categories){if(!tags.has(tag))tags.set(tag,new Set());tags.get(tag).add(row.id);}
 return {base,tags,ids:new Set(base.map(row=>row.id)),buckets:new Map()};
}
function generalCategoryIndex(selection,rows,registry=QUIP_CONTENT_PACKS){
 // Only installed immutable source identities are cached. Explicit custom or
 // mutable catalogs retain the uncached selector and its original dedup order.
 if(typeof QUIP_APPROX_QUESTIONS==='undefined'||registry!==QUIP_CONTENT_PACKS||(rows!==PARTY_CARDS&&rows!==QUIP_APPROX_QUESTIONS))return null;
 if(!generalCategoryIndexes||generalCategoryIndexes.cards!==PARTY_CARDS||generalCategoryIndexes.questions!==QUIP_APPROX_QUESTIONS||generalCategoryIndexes.packs!==registry)
  generalCategoryIndexes={cards:PARTY_CARDS,questions:QUIP_APPROX_QUESTIONS,packs:registry,entries:new Map(),summaries:new Map()};
 const key=selection.id+'@'+selection.version+':'+(rows===PARTY_CARDS?'cards':'questions'),entries=generalCategoryIndexes.entries;
 if(!entries.has(key)){if(entries.size>=16){entries.delete(entries.keys().next().value);generalCategoryIndexes.summaries.clear();}entries.set(key,buildGeneralCategoryIndex(selection,rows,registry));}
 return entries.get(key);
}
function categoryRecordAllowed(row,selection){const excluded=validateGeneralCategorySelection(selection)?.excluded;return !excluded?.length||!row.categories.some(tag=>excluded.includes(tag));}
function generalCategoryPool(index,selection,types,level,blitz=false){
 const key=JSON.stringify([[...new Set(types)].sort(),level,blitz]);
 if(!index.buckets.has(key))index.buckets.set(key,index.base.filter(row=>row.difficulty===level&&types.includes(row.type||'number')&&(!blitz||row.text.length<=12)));
 const excluded=new Set(validateGeneralCategorySelection(selection)?.excluded||[]);
 // Fresh caller-owned array, original record identities and original order.
 return index.buckets.get(key).filter(row=>!row.categories.some(tag=>excluded.has(tag)));
}
function generalCategoryCounts(selection,policy=QUIP_GENERAL_CATEGORIES_ALL,cards=PARTY_CARDS,questions=QUIP_APPROX_QUESTIONS,registry=QUIP_CONTENT_PACKS){
 const pack=getContentPack(selection,registry);if(pack.id!=='general')throw Error('Not a general dictionary');generalCategoryPolicy(policy);
 const indexes=[cards,questions].map(rows=>generalCategoryIndex(selection,rows,registry)||buildGeneralCategoryIndex(selection,rows,registry));
 const cached=registry===QUIP_CONTENT_PACKS&&cards===PARTY_CARDS&&questions===QUIP_APPROX_QUESTIONS?generalCategoryIndexes.summaries:null;
 const key=pack.id+'@'+pack.version,stamp=cached?.get(key);let summary=stamp;
 if(!summary||summary.indexes.some((index,i)=>index!==indexes[i])){
  const ids=new Set(),tags=new Map();for(const index of indexes){for(const id of index.ids)ids.add(id);for(const [tag,values]of index.tags){if(!tags.has(tag))tags.set(tag,new Set());for(const id of values)tags.get(tag).add(id);}}
  summary={indexes,ids,tags,policies:new Map()};if(cached)cached.set(key,summary);
 }
 const policyKey=JSON.stringify(policy.excluded.slice().sort());
 if(!summary.policies.has(policyKey)){
  const removed=new Set();for(const tag of policy.excluded)for(const id of summary.tags.get(tag)||[])removed.add(id);
  const result={total:summary.ids.size,available:summary.ids.size-removed.size,categories:[...summary.tags].map(([id,ids])=>({id,name:QUIP_GENERAL_CATEGORY_LABELS[id]||'Категория без названия',count:ids.size,enabled:!policy.excluded.includes(id)}))};
  if(summary.policies.size>=32)summary.policies.delete(summary.policies.keys().next().value);summary.policies.set(policyKey,result);
 }
 return summary.policies.get(policyKey);
}

function latestGeneralPackSelection(registry=QUIP_CONTENT_PACKS){
 return latestContentPackSelection('general',registry);
}
function latestContentPackSelection(id,registry=QUIP_CONTENT_PACKS){
 const versions=Object.values(registry).filter(pack=>pack.id===id&&pack.enabled).map(pack=>pack.version);
 if(!versions.length)throw Error('No enabled content pack: '+id);
 return {id,version:Math.max(...versions)};
}
// The first thematic editions used open category filters. Freeze their v78
// source universes so later tagged additions cannot change a saved old party.
const QUIP_PRE_EXPANSION_THEMATIC_SOURCES=Object.freeze({
 geography:Object.freeze(['geography-v2']),
 science:Object.freeze(['general-expansion-v1','science-v2']),
 culture:Object.freeze(['general-expansion-v1'])
});
function historicalGeneralRecord(pack,row){
 const sources=pack.id==='general'&&pack.version<=2?QUIP_PRE_TASK009_SOURCES:
  pack.version===1?QUIP_PRE_EXPANSION_THEMATIC_SOURCES[pack.id]:null;
 return !sources||sources.includes(row.pack);
}
function getPackCardPool(selection,kind,level,promptTypes,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS){
 const pack=getContentPack(selection,registry);
 if(!PARTY_CARD_LEVELS.includes(level))throw Error('Unknown card difficulty');
 const types={words:promptTypes?.length?promptTypes:['word','phrase','idiom'],songs:['song'],people:['person'],blitz:['word']}[kind];
 if(!types||types.some(t=>!PARTY_CARD_TYPES.includes(t))||
  (kind==='words'&&types.some(t=>!['word','phrase','idiom'].includes(t))))throw Error('Incompatible card types');
 const tier=kind==='blitz'?'easy':level,seen=new Set();
 const index=pack.id==='general'?generalCategoryIndex(selection,cards,registry):null;
 if(index)return generalCategoryPool(index,selection,types,tier,kind==='blitz');
 return cards.filter(card=>{
  if(!historicalGeneralRecord(pack,card)||seen.has(card.id)||card.difficulty!==tier||!types.includes(card.type)||!pack.types.includes(card.type)||
   (kind==='blitz'&&card.text.length>12)||
   (pack.categories.length&&!pack.categories.some(tag=>card.categories.includes(tag)))||
   (pack.criteria.cardIds.length&&!pack.criteria.cardIds.includes(card.id))||
   (pack.criteria.sourcePacks.length&&!pack.criteria.sourcePacks.includes(card.pack)))return false;
  if(!categoryRecordAllowed(card,selection))return false;
  seen.add(card.id);return true;
 });
}
function getPackQuestionPool(selection,level,questions=QUIP_APPROX_QUESTIONS,registry=QUIP_CONTENT_PACKS){
 const pack=getContentPack(selection,registry);
 if(!PARTY_CARD_LEVELS.includes(level))throw Error('Unknown question difficulty');
 if(!pack.types.includes('number'))return [];
 const index=pack.id==='general'?generalCategoryIndex(selection,questions,registry):null;
 if(index)return generalCategoryPool(index,selection,['number'],level);
 return questions.filter(question=>categoryRecordAllowed(question,selection)&&historicalGeneralRecord(pack,question)&&question.difficulty===level&&
  (!pack.categories.length||pack.categories.some(tag=>question.categories.includes(tag)))&&
  (!pack.criteria.cardIds.length||pack.criteria.cardIds.includes(question.id))&&
  (!pack.criteria.sourcePacks.length||pack.criteria.sourcePacks.includes(question.pack)));
}
// Each reachable mode/tier must be playable, especially all five unique Blitz words.
function checkContentPack(selection,settings,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS,questions=QUIP_APPROX_QUESTIONS){
 const pack=getContentPack(selection,registry),problems=[];
 if(!pack.enabled)problems.push('Набор пока недоступен: '+pack.name);
 const compatibility=modeCompatibilityPolicy(settings);
 if(compatibility&&!settings.modes.length)problems.push('Выберите хотя бы один совместимый режим');
 if(compatibility)for(const id of settings.modes){const status=modeAwardAvailability(id,settings);if(!status.available)problems.push(getModeConfig(id).title+': '+status.reason);}
 const levels=settings.difficulty==='mixed'?PARTY_CARD_LEVELS:[settings.difficulty];
 if(pack.allowedModes)for(const mode of settings.modes)if(!pack.allowedModes.includes(mode))problems.push('Режим «'+getModeConfig(mode).title+'» недоступен в теме «'+pack.name+'».');
 const tieredSecret=compatibility||settings.songLanguagePolicyVersion===2;
 const methods=new Set(settings.modes.flatMap(mode=>mode==='secret'?(tieredSecret?[]:secretMethodsForPack(selection,settings,registry)):[mode]));
 if(settings.modes.includes('secret')){
  if(tieredSecret){for(const level of levels)if(!secretMethodsForPack(selection,settings,registry,level,cards).length)problems.push('Нет подходящих способов Секретки на выбранной сложности.');}
  else if(!secretMethodsForPack(selection,settings,registry).length)problems.push('Нет способов для Секретки.');
 }
 for(const method of methods){
  const kind=getModeConfig(method).cardType;
  if(!kind)throw Error('Unknown QUIP mode: '+method);
  for(const level of levels){
   let pool=kind==='number'?getPackQuestionPool(selection,level,questions,registry):getPackCardPool(selection,kind,level,settings.promptTypes,cards,registry);
   if(method==='sing')pool=filterSongLanguagePool(pool,settings);
   const count=new Set(pool.map(card=>card.text||card.question)).size,required=Math.max(pack.minCardsPerPool,kind==='blitz'?(settings.rulesVersion&&settings.rulesVersion<4?5:getModeConfig('blitz').blitzWordsCount):1);
   if(count<required)problems.push(method+'/'+level+': '+count+' из '+required+' заданий');
  }
 }
 return {available:problems.length===0,problems};
}

// Only new packs declare restricted methods. Older versions retain their choices.
function secretMethodsForPack(selection,settings,registry=QUIP_CONTENT_PACKS,difficulty=null,cards=PARTY_CARDS){
 const pack=selection?getContentPack(selection,registry):null;
 const compatibility=modeCompatibilityPolicy(settings);
 if(compatibility){
  // Decide the source before filtering: an ineligible explicit choice never expands it.
  const explicit=settings.modes.filter(id=>getModeConfig(id).secretMethod);
  const candidates=explicit.length?explicit:compatibility.soloSecretMethods;
  const levels=difficulty?[difficulty]:settings.difficulty==='mixed'?PARTY_CARD_LEVELS:[settings.difficulty];
  return candidates.filter(id=>getModeConfig(id).secretMethod&&modeAwardAvailability(id,settings).available&&
   (!pack?.allowedModes||pack.allowedModes.includes(id))&&(!pack?.secretMethods||pack.secretMethods.includes(id))&&levels.some(level=>{
    let pool=getPackCardPool(selection,getModeConfig(id).cardType,level,settings.promptTypes,cards,registry);
    if(id==='sing')pool=filterSongLanguagePool(pool,settings,'secret');
    if(new Set(pool.map(card=>card.text)).size<Math.max(1,pack.minCardsPerPool))return false;
    // A mandatory condition must be possible for every card the existing selector can draw.
    return getV2ModifierPool(id,level,settings).length>0||pool.every(card=>getV2ModifierPool(id,level,settings,{card}).length>0);
   }));
 }
 const basic=Object.values(QUIP_MODES_V4).filter(mode=>mode.secretMethod&&(!pack?.secretMethods||pack.secretMethods.includes(mode.id))).map(mode=>mode.id);
 const enabled=basic.filter(id=>settings.modes.includes(id));
 const methods=enabled.length?enabled:basic;
 if(settings.songLanguagePolicyVersion!==2)return methods;
 const levels=difficulty?[difficulty]:settings.difficulty==='mixed'?PARTY_CARD_LEVELS:[settings.difficulty];
 return methods.filter(id=>levels.some(level=>{
  let pool=getPackCardPool(selection,getModeConfig(id).cardType,level,settings.promptTypes,cards,registry);
  if(id==='sing')pool=filterSongLanguagePool(pool,settings,'secret');
  return new Set(pool.map(card=>card.text)).size>=Math.max(1,pack?.minCardsPerPool||1);
 }));
}
function packSetupSettings(selection,settings,registry=QUIP_CONTENT_PACKS){
 const pack=getContentPack(selection,registry),key=pack.id+'@'+pack.version;
 const same=settings.contentPack?.id===pack.id&&settings.contentPack?.version===pack.version;
 // A new catalog version inherits the same theme's explicit preferences. An
 // existing profile for this exact version always wins over an older profile.
 const earlier=Object.keys(settings.packPreferences||{}).filter(value=>value.startsWith(pack.id+'@')&&Number(value.split('@')[1])<pack.version).sort((a,b)=>Number(b.split('@')[1])-Number(a.split('@')[1]));
 const previous=same?settings:settings.packPreferences?.[key]||
  (settings.contentPack?.id===pack.id&&settings.contentPack.version<pack.version?settings:null)||
  settings.packPreferences?.[earlier[0]]||settings;
 let modes=previous.modes.slice(),promptTypes=previous.promptTypes.slice();
 if(pack.allowedModes){
  modes=modes.filter(id=>pack.allowedModes.includes(id));
  if(!modes.length&&!modeCompatibilityPolicy(settings))modes=pack.allowedModes.slice();
  promptTypes=promptTypes.filter(type=>pack.types.includes(type));
  if(!promptTypes.length)promptTypes=['word','phrase','idiom'].filter(type=>pack.types.includes(type));
 }
 modes=compatibleAwardModes({...settings,modes});
 return {...settings,modes,promptTypes,contentPack:{id:pack.id,version:pack.version}};
}
function packModeAvailability(selection,settings,id){
 const pack=getContentPack(selection);
 const recipient=modeAwardAvailability(id,settings);if(!recipient.available)return recipient;
 if(!pack.allowedModes&&id!=='secret'&&!selection?.categoryPolicy?.excluded.length)return recipient;
 if(pack.allowedModes&&!pack.allowedModes.includes(id))return {available:false,reason:id==='sing'?'В теме нет песен':'Нет заданий этого режима'};
 const modes=id==='secret'?[...new Set([...settings.modes,'secret'])]:[id];
 const result=checkContentPack(selection,{...settings,modes});
 return {available:result.available,reason:result.problems[0]||''};
}
