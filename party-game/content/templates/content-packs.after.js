
]);
function listThematicPacks(settings,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS,questions=QUIP_APPROX_QUESTIONS){
 const latest=new Map();
 for(const pack of Object.values(registry))if(pack.id!=='general'&&(!latest.has(pack.id)||latest.get(pack.id).version<pack.version))
  latest.set(pack.id,pack);
 return [...latest.values()].map(pack=>{const selection={id:pack.id,version:pack.version};return {pack,...checkContentPack(selection,pack.allowedModes?packSetupSettings(selection,settings,registry):settings,cards,registry,questions)};});
}
function getContentPack(selection,registry=QUIP_CONTENT_PACKS){
 const pack=registry[selection?.id+'@'+selection?.version];
 if(!pack)throw Error('Unknown QUIP content pack/version');
 return pack;
}
// General 1/2 were unbounded before TASK009. This adapter freezes their source
// universe without editing their historical declarations or current rounds.
const QUIP_PRE_TASK009_SOURCES=Object.freeze(['core','music','people','geography-v2','science-v2','approx-core-v1','approx-general-2026']);
function latestGeneralPackSelection(registry=QUIP_CONTENT_PACKS){
 return latestContentPackSelection('general',registry);
}
function latestContentPackSelection(id,registry=QUIP_CONTENT_PACKS){
 const versions=Object.values(registry).filter(pack=>pack.id===id&&pack.enabled).map(pack=>pack.version);
 if(!versions.length)throw Error('No enabled content pack: '+id);
 return {id,version:Math.max(...versions)};
}
function historicalGeneralRecord(pack,row){return pack.id!=='general'||pack.version>2||QUIP_PRE_TASK009_SOURCES.includes(row.pack);}
function getPackCardPool(selection,kind,level,promptTypes,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS){
 const pack=getContentPack(selection,registry);
 if(!PARTY_CARD_LEVELS.includes(level))throw Error('Unknown card difficulty');
 const types={words:promptTypes?.length?promptTypes:['word','phrase','idiom'],songs:['song'],people:['person'],blitz:['word']}[kind];
 if(!types||types.some(t=>!PARTY_CARD_TYPES.includes(t))||
  (kind==='words'&&types.some(t=>!['word','phrase','idiom'].includes(t))))throw Error('Incompatible card types');
 const tier=kind==='blitz'?'easy':level,seen=new Set();
 return cards.filter(card=>{
  if(!historicalGeneralRecord(pack,card)||seen.has(card.id)||card.difficulty!==tier||!types.includes(card.type)||!pack.types.includes(card.type)||
   (kind==='blitz'&&card.text.length>12)||
   (pack.categories.length&&!pack.categories.some(tag=>card.categories.includes(tag)))||
   (pack.criteria.cardIds.length&&!pack.criteria.cardIds.includes(card.id))||
   (pack.criteria.sourcePacks.length&&!pack.criteria.sourcePacks.includes(card.pack)))return false;
  seen.add(card.id);return true;
 });
}
function getPackQuestionPool(selection,level,questions=QUIP_APPROX_QUESTIONS,registry=QUIP_CONTENT_PACKS){
 const pack=getContentPack(selection,registry);
 if(!PARTY_CARD_LEVELS.includes(level))throw Error('Unknown question difficulty');
 if(!pack.types.includes('number'))return [];
 return questions.filter(question=>historicalGeneralRecord(pack,question)&&question.difficulty===level&&
  (!pack.categories.length||pack.categories.some(tag=>question.categories.includes(tag)))&&
  (!pack.criteria.cardIds.length||pack.criteria.cardIds.includes(question.id))&&
  (!pack.criteria.sourcePacks.length||pack.criteria.sourcePacks.includes(question.pack)));
}
// Each reachable mode/tier must be playable, especially all five unique Blitz words.
function checkContentPack(selection,settings,cards=PARTY_CARDS,registry=QUIP_CONTENT_PACKS,questions=QUIP_APPROX_QUESTIONS){
 const pack=getContentPack(selection,registry),problems=[];
 if(!pack.enabled)problems.push('Набор пока недоступен: '+pack.name);
 const levels=settings.difficulty==='mixed'?PARTY_CARD_LEVELS:[settings.difficulty];
 if(pack.allowedModes)for(const mode of settings.modes)if(!pack.allowedModes.includes(mode))problems.push('Режим «'+getModeConfig(mode).title+'» недоступен в теме «'+pack.name+'».');
 const methods=new Set(settings.modes.flatMap(mode=>mode==='secret'?secretMethodsForPack(selection,settings,registry):[mode]));
 if(settings.modes.includes('secret')&&!secretMethodsForPack(selection,settings,registry).length)problems.push('Нет способов для Секретки.');
 for(const method of methods){
  const kind=getModeConfig(method).cardType;
  if(!kind)throw Error('Unknown QUIP mode: '+method);
  for(const level of levels){
   const pool=kind==='number'?getPackQuestionPool(selection,level,questions,registry):getPackCardPool(selection,kind,level,settings.promptTypes,cards,registry);
   const count=new Set(pool.map(card=>card.text||card.question)).size,required=Math.max(pack.minCardsPerPool,kind==='blitz'?(settings.rulesVersion&&settings.rulesVersion<4?5:getModeConfig('blitz').blitzWordsCount):1);
   if(count<required)problems.push(method+'/'+level+': '+count+' из '+required+' заданий');
  }
 }
 return {available:problems.length===0,problems};
}

// Only new packs declare restricted methods. Older versions retain their choices.
function secretMethodsForPack(selection,settings,registry=QUIP_CONTENT_PACKS){
 const pack=selection?getContentPack(selection,registry):null;
 const basic=Object.values(QUIP_MODES_V4).filter(mode=>mode.secretMethod&&(!pack?.secretMethods||pack.secretMethods.includes(mode.id))).map(mode=>mode.id);
 const enabled=basic.filter(id=>settings.modes.includes(id));
 return enabled.length?enabled:basic;
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
  if(!modes.length)modes=pack.allowedModes.filter(id=>id!=='yesno'||settings.awardTo==='guesser');
  if(!modes.length)modes=pack.allowedModes.slice();
  promptTypes=promptTypes.filter(type=>pack.types.includes(type));
  if(!promptTypes.length)promptTypes=['word','phrase','idiom'].filter(type=>pack.types.includes(type));
 }
 return {...settings,modes,promptTypes,contentPack:{id:pack.id,version:pack.version}};
}
function packModeAvailability(selection,settings,id){
 const pack=getContentPack(selection);
 if(!pack.allowedModes)return {available:true,reason:''};
 if(!pack.allowedModes.includes(id))return {available:false,reason:id==='sing'?'В теме нет песен':'Нет заданий этого режима'};
 const result=checkContentPack(selection,{...settings,modes:[id]});
 return {available:result.available,reason:result.problems[0]||''};
}
