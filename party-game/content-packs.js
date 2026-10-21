'use strict';
// Versioned declarations, not another card database. Existing card IDs are untouched.
function defineContentPacks(entries){
 const registry={};
 for(const entry of entries){
  const key=entry.id+'@'+entry.version;
  if(!/^[a-z][a-z0-9-]*$/.test(entry.id)||!Number.isInteger(entry.version)||entry.version<1||!entry.name||Object.hasOwn(registry,key))
   throw Error('Invalid or duplicate content pack: '+key);
  for(const [field,values] of Object.entries({categories:entry.categories,types:entry.types,
   cardIds:entry.criteria?.cardIds,sourcePacks:entry.criteria?.sourcePacks}))
   if(!Array.isArray(values)||values.some(x=>typeof x!=='string'||!x)||new Set(values).size!==values.length)
    throw Error('Invalid pack '+field+': '+key);
  if(!entry.types.length||entry.types.some(t=>!PARTY_CARD_TYPES.includes(t))||
    !Number.isInteger(entry.minCardsPerPool)||entry.minCardsPerPool<1||typeof entry.enabled!=='boolean')
   throw Error('Invalid pack types/availability: '+key);
  registry[key]=Object.freeze({...entry,categories:Object.freeze(entry.categories.slice()),
   types:Object.freeze(entry.types.slice()),criteria:Object.freeze({
    cardIds:Object.freeze(entry.criteria.cardIds.slice()),sourcePacks:Object.freeze(entry.criteria.sourcePacks.slice())})});
 }
 return Object.freeze(registry);
}
const QUIP_CONTENT_PACKS=defineContentPacks([
 {id:'general',version:1,name:'Общий словарь',enabled:true,categories:[],types:PARTY_CARD_TYPES,
  criteria:{cardIds:[],sourcePacks:[]},minCardsPerPool:1},
 ...[['geography','География'],['biology','Биология'],['animals','Животные'],['history','История'],
  ['science','Наука'],['culture','Культура']].map(([id,name])=>({id,version:1,name,enabled:false,
   categories:[id],types:['word','phrase','idiom'],criteria:{cardIds:[],sourcePacks:[]},minCardsPerPool:1}))
]);
function getContentPack(selection,registry=QUIP_CONTENT_PACKS){
 const pack=registry[selection?.id+'@'+selection?.version];
 if(!pack)throw Error('Unknown QUIP content pack/version');
 return pack;
}
function getPackCardPool(selection,kind,level,promptTypes,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS){
 const pack=getContentPack(selection,registry);
 if(!PARTY_CARD_LEVELS.includes(level))throw Error('Unknown card difficulty');
 const types={words:promptTypes?.length?promptTypes:['word','phrase','idiom'],songs:['song'],people:['person'],blitz:['word']}[kind];
 if(!types||types.some(t=>!PARTY_CARD_TYPES.includes(t))||
  (kind==='words'&&types.some(t=>!['word','phrase','idiom'].includes(t))))throw Error('Incompatible card types');
 const tier=kind==='blitz'?'easy':level,seen=new Set();
 return cards.filter(card=>{
  if(seen.has(card.id)||card.difficulty!==tier||!types.includes(card.type)||!pack.types.includes(card.type)||
   (kind==='blitz'&&card.text.length>12)||
   (pack.categories.length&&!pack.categories.some(tag=>card.categories.includes(tag)))||
   (pack.criteria.cardIds.length&&!pack.criteria.cardIds.includes(card.id))||
   (pack.criteria.sourcePacks.length&&!pack.criteria.sourcePacks.includes(card.pack)))return false;
  seen.add(card.id);return true;
 });
}
// Each reachable mode/tier must be playable, especially all five unique Blitz words.
function checkContentPack(selection,settings,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS){
 const pack=getContentPack(selection,registry),problems=[];
 if(!pack.enabled)problems.push('Набор пока недоступен: '+pack.name);
 const levels=settings.difficulty==='mixed'?PARTY_CARD_LEVELS:[settings.difficulty];
 const basic=Object.values(QUIP_MODES_V4).filter(mode=>mode.secretMethod).map(mode=>mode.id);
 const methods=new Set(settings.modes.flatMap(mode=>mode==='secret'?
  (basic.some(x=>settings.modes.includes(x))?basic.filter(x=>settings.modes.includes(x)):basic):[mode]));
 for(const method of methods){
  const kind=getModeConfig(method).cardType;
  if(!kind)throw Error('Unknown QUIP mode: '+method);
  for(const level of levels){
   const pool=getPackCardPool(selection,kind,level,settings.promptTypes,cards,registry);
   const count=new Set(pool.map(card=>card.text)).size,required=Math.max(pack.minCardsPerPool,kind==='blitz'?(settings.rulesVersion&&settings.rulesVersion<4?5:getModeConfig('blitz').blitzWordsCount):1);
   if(count<required)problems.push(method+'/'+level+': '+count+' из '+required+' заданий');
  }
 }
 return {available:problems.length===0,problems};
}
