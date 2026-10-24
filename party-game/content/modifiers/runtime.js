// Exact-tier V2 pools; V1 catalog and selection remain in modifiers.js.
function getV2ModifierPool(method,difficulty,match,request={},registry=QUIP_MODIFIERS_V2){
 if(!['easy','medium','hard'].includes(difficulty))throw Error('Unknown V2 modifier tier');
 return registry.filter(row=>row.enabled&&row.modes.includes(method)&&row.severity===difficulty&&
  (row.actor!=='guesser'||match.awardTo==='guesser')&&
  (!row.requires.concreteObject||request.card?.meta?.concreteObject===true));
}
function v2ModifierKeys(row){
 return ['modifier:v2:id:'+row.id,'modifier:v2:text:'+normalizeTaskText(row.text),'modifier:v2:family:'+row.family,
  ...(row.alternative?['modifier:v2:family:'+row.alternative.family]:[])];
}
function chooseV2PartyModifier(match,request,random=Math.random,registry=QUIP_MODIFIERS_V2){
 const recent=match.modifierRecent;
 if(!modeConfigForGame(match,request.modeId).usesModifiers)return {modifier:null,recent,taskHistory:match.taskHistory};
 if(request.modeId!=='secret'){
  if(!request.complications)return {modifier:null,recent,taskHistory:match.taskHistory};
  const chance=random();if(!Number.isFinite(chance)||chance<0||chance>=1)throw Error('Invalid V2 modifier random value');
  if(chance>=match.modifierChance/100)return {modifier:null,recent,taskHistory:match.taskHistory};
 }
 const pool=getV2ModifierPool(request.methodId,request.difficulty,match,request,registry);
 if(!pool.length){
  if(request.modeId==='secret')throw Error('No eligible V2 Secret modifier');
  return {modifier:null,recent,taskHistory:match.taskHistory};
 }
 const selected=selectHistoryRecord(pool,match.taskHistory,request.memory,{random,keysFor:v2ModifierKeys,onExhaustion:request.modeId==='secret'?'oldest':'skip'});
 const modifier=selected.record;
 return {modifier,taskHistory:selected.history,recent:modifier?[...recent,{id:modifier.id,key:normalizeModifierText(modifier.text)}].slice(-5):recent};
}
function v2SecretMethods(selection,match,difficulty){
 if(modeCompatibilityPolicy(match)){
  const methods=secretMethodsForPack(selection,match,QUIP_CONTENT_PACKS,difficulty);
  if(!methods.length)throw Error('Нет подходящих способов Секретки на выбранной сложности.');
  return methods;
 }
 // Historical pre-G selection below is pinned by the absence of a compatibility version.
 const eligible=method=>getV2ModifierPool(method,difficulty,match).length>0;
 const level=match.songLanguagePolicyVersion===2?difficulty:null;
 let methods=secretMethodsForPack(selection,match,QUIP_CONTENT_PACKS,level).filter(eligible);
 // Proposal documented in MODIFIERS-V2-AUDIT.md: never give a setter a
 // guesser's condition. If only an incompatible method is enabled, use another
 // supported pack method rather than removing Secret's mandatory modifier.
 if(!methods.length)methods=secretMethodsForPack(selection,{...match,modes:['secret']},QUIP_CONTENT_PACKS,level).filter(eligible);
 if(!methods.length)throw Error('No supported V2 Secret method');
 return methods;
}
