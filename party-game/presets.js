'use strict';
function freezePresetValue(value){
 if(value&&typeof value==='object'){
  Object.values(value).forEach(freezePresetValue);Object.freeze(value);
 }
 return value;
}
function validatePresetSettings(settings){
 const modes=['talk','mime','draw','sing','yesno','secret','blitz'];
 if(!settings||!['easy','medium','hard','mixed'].includes(settings.difficulty)||
  !['score','rounds'].includes(settings.finishType)||
  !Number.isInteger(settings.duration)||settings.duration<30||settings.duration>90||settings.duration%5||
  !Number.isInteger(settings.rounds)||settings.rounds<2||settings.rounds>100||settings.rounds%2||
  !Number.isInteger(settings.targetScore)||settings.targetScore<15||settings.targetScore>100||settings.targetScore%5||
  typeof settings.riskRounds!=='boolean'||typeof settings.complications!=='boolean')throw Error('Invalid QUIP preset settings');
 for(const [values,allowed] of [[settings.modes,modes],[settings.promptTypes,['word','phrase','idiom']]])
  if(!Array.isArray(values)||!values.length||new Set(values).size!==values.length||values.some(x=>!allowed.includes(x)))
   throw Error('Invalid QUIP preset modes/types');
 getContentPack(settings.contentPack);
}
function definePartyPresets(entries){
 const registry={};
 for(const entry of entries){
  const key=entry.id+'@'+entry.version;
  if(!/^[a-z][a-z0-9-]*$/.test(entry.id)||!Number.isInteger(entry.version)||entry.version<1||!entry.name||
   typeof entry.enabled!=='boolean'||!entry.settings||Object.hasOwn(registry,key))throw Error('Invalid or duplicate party preset: '+key);
  validatePresetSettings(entry.settings);
  registry[key]=freezePresetValue(JSON.parse(JSON.stringify(entry)));
 }
 return Object.freeze(registry);
}
const QUIP_CLASSIC_OPTIONS=freezePresetValue({difficulty:'easy',duration:60,rounds:12,finishType:'score',
 targetScore:25,riskRounds:true,complications:true,dice:true,blitzCount:5,scoring:'duel',
 modes:['talk','mime','draw','sing','yesno','secret','blitz'],promptTypes:['word','phrase','idiom'],
 contentPack:{id:'general',version:1}});
const QUIP_PARTY_PRESETS=definePartyPresets([
 {id:'classic-duel',version:1,name:'Классическая дуэль',enabled:true,settings:QUIP_CLASSIC_OPTIONS},
 {id:'thematic',version:1,name:'Тематическая партия',enabled:false,
  settings:{...QUIP_CLASSIC_OPTIONS,modes:['talk','mime','draw'],contentPack:{id:'geography',version:1}}},
 {id:'hardcore',version:1,name:'Хардкор',enabled:true,
  settings:{...QUIP_CLASSIC_OPTIONS,difficulty:'hard',duration:30,riskRounds:true,complications:true}}
]);
function optionsForPartyPreset(id,version,overrides={},registry=QUIP_PARTY_PRESETS){
 const preset=registry[id+'@'+version];
 if(!preset||!preset.enabled)throw Error('Unavailable QUIP party preset/version');
 const settings=JSON.parse(JSON.stringify({...preset.settings,...overrides,preset:{id,version}}));
 validatePresetSettings(settings);
 return settings;
}
