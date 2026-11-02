'use strict';
// TASK041: opt-in edition/policy. Absence keeps every historical selector intact.
const historicalCategorySelection=validateGeneralCategorySelection;
validateGeneralCategorySelection=function(selection){
 if(selection?.selectionPolicyVersion!==2)return historicalCategorySelection(selection);
 if(Object.keys(selection).sort().join(',')!=='edition,excluded,pack,selectionPolicyVersion'||!selection.pack||Object.keys(selection.pack).sort().join(',')!=='id,version'||QUIP_EDITORIAL_PACK_VERSIONS[selection.pack.id]!==selection.pack.version)throw Error('Unsupported editorial content selection');
 validateEditorialReference(selection.edition);
 const policy=generalCategoryPolicy({version:1,excluded:selection.excluded});
 if(selection.pack.id!=='general'&&policy.excluded.length)throw Error('Categories apply to general only');
 return policy;
};
const QUIP_TASK_DIFFICULTY_KEY='kvip:mode-difficulty:v1';
let taskDifficultyPreferenceCache=null;
function readTaskDifficultyPreferences(){
 let raw;try{raw=localStorage.getItem(QUIP_TASK_DIFFICULTY_KEY);}catch{return {policy:null,problem:'Не удалось прочитать сложности режимов. Настройки защищены.'};}
 if(taskDifficultyPreferenceCache?.raw===raw)return taskDifficultyPreferenceCache;
 try{const policy=QuipEditorialSelection.preferences(raw===null?undefined:JSON.parse(raw));return taskDifficultyPreferenceCache={raw,policy,problem:''};}
 catch{return taskDifficultyPreferenceCache={raw,policy:null,problem:'Настройки сложности созданы другой версией или повреждены. Исходные данные защищены.'};}
}
function writeTaskDifficultyPreference(mode,choice){
 const before=readTaskDifficultyPreferences();if(before.problem)throw Error(before.problem);
 const policy=QuipEditorialSelection.preferences({version:1,choices:{...before.policy.choices,[mode]:choice}}),raw=JSON.stringify(policy);
 if(localStorage.getItem(QUIP_TASK_DIFFICULTY_KEY)!==before.raw)throw Error('Сложности изменились в другой вкладке. Повторите выбор.');
 localStorage.setItem(QUIP_TASK_DIFFICULTY_KEY,raw);
 if(localStorage.getItem(QUIP_TASK_DIFFICULTY_KEY)!==raw)throw Error('Не удалось сохранить сложности.');
 taskDifficultyPreferenceCache=null;return policy;
}
function setupEditorialPolicy(){return {taskDifficultyPolicy:readTaskDifficultyPreferences().policy};}
function validateEditorialReference(ref){
 const e=QUIP_EDITORIAL_EDITION;
 if(!ref||Object.keys(ref).sort().join(',')!=='digest,id,version'||ref.id!==e.id||ref.version!==e.version||ref.digest!==e.digest)throw Error('Неизвестная редакция словаря. Сохранение защищено.');
 return ref;
}
function editorialSelection(selection){return selection?.selectionPolicyVersion===2;}
function pinEditorialSelection(selection){
 const pack=baseContentPackSelection(selection);
 if(QUIP_EDITORIAL_PACK_VERSIONS[pack.id]!==pack.version)throw Error('Для этой версии темы нет редакции словаря.');
 return {selectionPolicyVersion:2,pack:{id:pack.id,version:pack.version},excluded:(validateGeneralCategorySelection(selection)?.excluded||[]).slice(),edition:{id:QUIP_EDITORIAL_EDITION.id,version:QUIP_EDITORIAL_EDITION.version,digest:QUIP_EDITORIAL_EDITION.digest}};
}
let editorialIndex=null;
const editorialPools=new Map();
function getEditorialIndex(){return editorialIndex||(editorialIndex=QuipEditorialSelection.createIndex(QUIP_EDITORIAL_EDITION,[...PARTY_CARDS,...QUIP_APPROX_QUESTIONS]));}
function editorialRequest(selection,settings,mode,level,method=null){
 const pack=baseContentPackSelection(selection);
 if(QUIP_EDITORIAL_PACK_VERSIONS[pack.id]!==pack.version)throw Error('Для этой версии темы нет редакции словаря.');
 const policy=QuipEditorialSelection.preferences(settings.taskDifficultyPolicy);
 return {theme:pack.id,mode,method,tiers:QuipEditorialSelection.tiersFor(policy,mode,level,method),promptTypes:(settings.promptTypes||['word','phrase','idiom']).slice(),excludedCategories:(validateGeneralCategorySelection(selection)?.excluded||[]).slice(),languages:(songLanguagePolicy(settings)||['ru','en']).slice()};
}
function editorialPoolFor(selection,settings,mode,level,method=null){
 const request=editorialRequest(selection,settings,mode,level,method),key=JSON.stringify(request);
 if(!editorialPools.has(key)){if(editorialPools.size>=256)editorialPools.delete(editorialPools.keys().next().value);editorialPools.set(key,Object.freeze(getEditorialIndex().pool(request)));}
 return editorialPools.get(key);
}
function editorialPool(match,mode,level,method=null){return editorialPoolFor(match.contentPack,match,mode,level,method);}
function editorialAvailability(selection,settings,mode,level,method=null){
 const pool=editorialPoolFor(selection,settings,mode,level,method),minimum=Math.max(QUIP_EDITORIAL_EDITION.catalogs[baseContentPackSelection(selection).id].minimum,mode==='blitz'?3:1);
 const count=new Set(pool.map(row=>normalizeTaskText(row.text||row.question))).size;
 return {available:count>=minimum,count,minimum,reason:count>=minimum?'':getModeConfig(mode).title+': доступно '+count+', нужно '+minimum+'. Измените сложность, категории или тему.'};
}
function editorialSecretMethods(selection,settings,level){
 const pack=getContentPack(selection),policy=modeCompatibilityPolicy(settings),explicit=settings.modes.filter(id=>getModeConfig(id).secretMethod);
 const candidates=explicit.length?explicit:(policy?.soloSecretMethods||QuipEditorialSelection.METHODS);
 return candidates.filter(method=>modeAwardAvailability(method,settings).available&&(!pack.secretMethods||pack.secretMethods.includes(method))&&editorialAvailability(selection,settings,'secret',level,method).available&&
  (getV2ModifierPool(method,level,settings).length>0||editorialPoolFor(selection,settings,'secret',level,method).every(card=>getV2ModifierPool(method,level,settings,{card}).length>0)));
}
function checkEditorialPack(selection,settings){
 const problems=[];
 try{
  const pack=getContentPack(selection);QuipEditorialSelection.preferences(settings.taskDifficultyPolicy);
  if(!pack.enabled)problems.push('Набор пока недоступен: '+pack.name);
  if(!settings.modes.length)problems.push('Выберите хотя бы один совместимый режим');
  for(const mode of settings.modes){
   const award=modeAwardAvailability(mode,settings);if(!award.available){problems.push(award.reason);continue;}
   for(const level of settings.difficulty==='mixed'?PARTY_CARD_LEVELS:[settings.difficulty]){
    if(mode==='secret'){if(!editorialSecretMethods(selection,settings,level).length)problems.push('СЕКРЕТКА: нет подходящего способа. Измените сложности режимов, категории или тему.');}
    else{const status=editorialAvailability(selection,settings,mode,level);if(!status.available)problems.push(status.reason);}
   }
  }
 }catch(error){problems.push(readTaskDifficultyPreferences().problem||error.message);}
 return {available:!problems.length,problems:[...new Set(problems)]};
}
function validateEditorialGame(match){
 const selected=editorialSelection(match?.contentPack),policy=match?.taskDifficultyPolicy;
 if(!selected&&policy===undefined)return null;
 if(!selected||policy===undefined)throw Error('Missing editorial edition/difficulty policy');
 validateGeneralCategorySelection(match.contentPack);QuipEditorialSelection.preferences(policy);
 return policy;
}
// Guarded entry points also serve the existing Master's availability checks.
const historicalCheckContentPack=checkContentPack,historicalPackModeAvailability=packModeAvailability,historicalV2SecretMethods=v2SecretMethods;
checkContentPack=function(selection,settings,...catalogs){
 return editorialSelection(selection)||Object.hasOwn(settings,'taskDifficultyPolicy')?checkEditorialPack(selection,settings):historicalCheckContentPack(selection,settings,...catalogs);
};
packModeAvailability=function(selection,settings,id){
 if(!editorialSelection(selection)&&!Object.hasOwn(settings,'taskDifficultyPolicy'))return historicalPackModeAvailability(selection,settings,id);
 const result=checkEditorialPack(selection,{...settings,modes:id==='secret'?[...new Set([...settings.modes,'secret'])]:[id]});
 return {available:result.available,reason:result.problems[0]||''};
};
v2SecretMethods=function(selection,match,level){
 if(!editorialSelection(selection)&&!Object.hasOwn(match,'taskDifficultyPolicy'))return historicalV2SecretMethods(selection,match,level);
 const methods=editorialSecretMethods(selection,match,level);if(!methods.length)throw Error('Нет подходящих способов Секретки.');return methods;
};
