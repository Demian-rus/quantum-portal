
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
// The first thematic editions used open category filters. Freeze their v78
// source universes so later tagged additions cannot change a saved old party.
const QUIP_PRE_EXPANSION_THEMATIC_SOURCES=Object.freeze({
 geography:Object.freeze(['geography-v2']),
 science:Object.freeze(['general-expansion-v1','science-v2'])
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
 if(!pack.allowedModes&&id!=='secret')return recipient;
 if(pack.allowedModes&&!pack.allowedModes.includes(id))return {available:false,reason:id==='sing'?'В теме нет песен':'Нет заданий этого режима'};
 const modes=id==='secret'?[...new Set([...settings.modes,'secret'])]:[id];
 const result=checkContentPack(selection,{...settings,modes});
 return {available:result.available,reason:result.problems[0]||''};
}
