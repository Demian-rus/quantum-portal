'use strict';
// TASK043: edition dispatch is pinned in every party, including device snapshots.
// Historical selection, scoring and random calls remain with the shipped reader.
function usesEditorialV2(selection){
 if(editorialSelection(selection))return selection.edition?.id==='quip'&&selection.edition?.version===2;
 const pack=selection?.pack||selection;return !!pack&&Object.hasOwn(QUIP_EDITORIAL_PACK_VERSIONS_V2,pack.id)&&QUIP_EDITORIAL_PACK_VERSIONS_V2[pack.id]===pack.version;
}
const referenceBeforeV2=validateEditorialReference;
validateEditorialReference=function(ref){
 if(ref?.version!==2)return referenceBeforeV2(ref);
 const e=QUIP_EDITORIAL_EDITION_V2;
 if(Object.keys(ref).sort().join(',')!=='digest,id,version'||ref.id!==e.id||ref.digest!==e.digest)throw Error('Неизвестная редакция словаря. Сохранение защищено.');return ref;
};
const categorySelectionBeforeV2=validateGeneralCategorySelection;
validateGeneralCategorySelection=function(selection){
 if(!usesEditorialV2(selection)||!editorialSelection(selection))return categorySelectionBeforeV2(selection);
 const {deviceDictionary:snapshot,promptRevisionVersion:revision,...base}=selection;
 if(Object.keys(base).sort().join(',')!=='edition,excluded,pack,selectionPolicyVersion'||!base.pack||Object.keys(base.pack).sort().join(',')!=='id,version'||QUIP_EDITORIAL_PACK_VERSIONS_V2[base.pack.id]!==base.pack.version)throw Error('Unsupported editorial content selection');
 validateEditorialReference(base.edition);
 if(Object.hasOwn(selection,'deviceDictionary'))validateDeviceSnapshot(snapshot);
 if(Object.hasOwn(selection,'promptRevisionVersion')&&!Object.hasOwn(QUIP_PROMPT_REVISIONS,revision))throw Error('Неизвестная версия редакторских замен.');
 const policy=generalCategoryPolicy({version:1,excluded:base.excluded});
 if(policy.excluded.some(id=>!QUIP_EDITORIAL_EDITION_V2.categories.includes(id))||(base.pack.id!=='general'&&policy.excluded.length))throw Error('Неизвестная категория редакции. Сохранение защищено.');return policy;
};
const pinBeforeV2=pinEditorialSelection;
pinEditorialSelection=function(selection){
 if(!usesEditorialV2(selection))return pinBeforeV2(selection);
 const pack=baseContentPackSelection(selection),e=QUIP_EDITORIAL_EDITION_V2;
 if(getContentPack(selection)!==QUIP_CONTENT_PACKS[pack.id+'@'+pack.version])throw Error('Для этой версии темы нет редакции словаря.');
 return {selectionPolicyVersion:2,pack:{id:pack.id,version:pack.version},excluded:(validateGeneralCategorySelection(selection)?.excluded||[]).slice(),edition:{id:e.id,version:e.version,digest:e.digest},promptRevisionVersion:1,deviceDictionary:deviceDictionary().pin()};
};
const requestBeforeV2=editorialRequest;
editorialRequest=function(selection,settings,mode,level,method=null){
 if(!usesEditorialV2(selection))return requestBeforeV2(selection,settings,mode,level,method);
 const pack=baseContentPackSelection(selection),policy=QuipEditorialSelection.preferences(settings.taskDifficultyPolicy),excluded=(validateGeneralCategorySelection(selection)?.excluded||[]).slice();
 if(excluded.some(id=>!QUIP_EDITORIAL_EDITION_V2.categories.includes(id)))throw Error('Неизвестная категория редакции. Настройки защищены.');
 return {theme:pack.id,mode,method,tiers:QuipEditorialSelection.tiersFor(policy,mode,level,method),promptTypes:(mode==='blitz'?['word']:(settings.promptTypes||['word','phrase','idiom'])).slice(),excludedCategories:excluded,languages:(songLanguagePolicy(settings)||['ru','en']).slice()};
};
let editorialV2Index=null;
const poolBeforeV2=editorialPoolFor,editorialV2Pools=new Map(),editorialV2DevicePools=new WeakMap();
editorialPoolFor=function(selection,...args){
 if(!usesEditorialV2(selection))return poolBeforeV2(selection,...args);
 const request=editorialRequest(selection,...args),revision=selection?.promptRevisionVersion,key=JSON.stringify([revision??null,request]);
 if(!editorialV2Pools.has(key)){
  editorialV2Index||=QuipEditorialSelection.createIndex(QUIP_EDITORIAL_EDITION_V2,[...PARTY_CARDS,...QUIP_APPROX_QUESTIONS]);
  let rows=editorialV2Index.pool(request);
  if(revision!==undefined){if(!Object.hasOwn(QUIP_PROMPT_REVISIONS,revision))throw Error('Неизвестная версия редакторских замен.');rows=[...rows.filter(row=>!Object.hasOwn(QUIP_PROMPT_REVISIONS[revision],row.id)),...promptRevisionIndex().pool(request)];}
  if(editorialV2Pools.size>=256)editorialV2Pools.delete(editorialV2Pools.keys().next().value);editorialV2Pools.set(key,Object.freeze(rows));
 }
 const base=editorialV2Pools.get(key),snapshot=selectedDeviceSnapshot(selection);if(!snapshot?.cards.length)return base;
 let cache=editorialV2DevicePools.get(snapshot);if(!cache)editorialV2DevicePools.set(snapshot,cache=new Map());
 if(!cache.has(key)){const names=new Set(base.map(r=>QuipDeviceDictionary.normalize(r.text||r.question))),own=deviceIndex(snapshot).pool(request).filter(r=>!names.has(QuipDeviceDictionary.normalize(r.text||r.question)));if(cache.size>=256)cache.delete(cache.keys().next().value);cache.set(key,Object.freeze([...base,...own]));}return cache.get(key);
};
const recordBeforeV2=editorialRecordForId;
editorialRecordForId=function(match,id){return usesEditorialV2(match.contentPack)&&!id.startsWith('user-')&&!id.startsWith('approx-user-')?QUIP_EDITORIAL_EDITION_V2.records[id]:recordBeforeV2(match,id);};
const themeBeforeV2=configurableEditorialTheme;
configurableEditorialTheme=function(pack){return themeBeforeV2(pack)||(pack.id!=='general'&&pack.enabled&&QUIP_EDITORIAL_PACK_VERSIONS_V2[pack.id]===pack.version&&QUIP_CONTENT_PACKS[pack.id+'@'+pack.version]===pack);};
const countsBeforeV2=editorialCategoryCounts,editorialV2CategoryCounts=new Map();
editorialCategoryCounts=function(selection,policy=validateGeneralCategorySelection(selection)||QUIP_GENERAL_CATEGORIES_ALL){
 if(!usesEditorialV2(selection))return countsBeforeV2(selection,policy);
 const pack=baseContentPackSelection(selection);if(pack.id!=='general')return generalCategoryCounts(selection,policy);
 generalCategoryPolicy(policy);const key=JSON.stringify(policy.excluded.slice().sort());
 if(!editorialV2CategoryCounts.has(key)){
  const e=QUIP_EDITORIAL_EDITION_V2,ids=e.catalogs.general.ids,counts=Array(e.categories.length).fill(0),mask=policy.excluded.reduce((m,id)=>m|2**e.categories.indexOf(id),0);let available=0;
  for(const id of ids){const tags=e.records[id][1];if(!(tags&mask))available++;for(let i=0;i<counts.length;i++)if(tags&2**i)counts[i]++;}
  if(editorialV2CategoryCounts.size>=32)editorialV2CategoryCounts.delete(editorialV2CategoryCounts.keys().next().value);
  editorialV2CategoryCounts.set(key,{total:ids.length,available,categories:e.categories.map((id,i)=>({id,name:QUIP_GENERAL_CATEGORY_LABELS[id]||id,count:counts[i],enabled:!policy.excluded.includes(id)}))});
 }return editorialV2CategoryCounts.get(key);
};
