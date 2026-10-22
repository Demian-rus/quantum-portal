'use strict';
// Independent of scoring/config versions. Missing version means historical behavior.
const QUIP_MODE_COMPATIBILITY_VERSION=1;
const QUIP_MODE_COMPATIBILITY_POLICIES=Object.freeze({1:Object.freeze({
 modes:Object.freeze(Object.fromEntries([
  ['talk',['setter','guesser']],['mime',['setter','guesser']],['draw',['setter','guesser']],
  ['sing',['setter','guesser']],['yesno',['guesser']],['secret',['setter','guesser']],
  ['blitz',['setter','guesser']],['approx',['setter','guesser']]
 ].map(([id,awardTo])=>[id,Object.freeze(awardTo)]))),
 soloSecretMethods:Object.freeze(['talk','mime','draw','sing','yesno'])
})});
function modeCompatibilityPolicy(settings){
 const version=settings?.modeCompatibilityVersion;
 if(version==null)return null;
 const policy=Number.isInteger(version)&&QUIP_MODE_COMPATIBILITY_POLICIES[version];
 if(!policy)throw Error('Unknown QUIP mode compatibility version');
 return policy;
}
function modeAwardAvailability(id,settings){
 const policy=modeCompatibilityPolicy(settings);
 if(!policy)return {available:true,reason:''};
 const recipients=policy.modes[id];
 if(!recipients)return {available:false,reason:'Совместимость режима пока не определена'};
 if(!['setter','guesser'].includes(settings.awardTo))return {available:false,reason:'Выберите получателя очков'};
 const available=recipients.includes(settings.awardTo);
 return {available,reason:available?'':recipients.length===1?
  'Доступно, когда очки получает '+(recipients[0]==='guesser'?'отгадывающий':'загадывающий'):'Режим недоступен для выбранного получателя очков'};
}
function compatibleAwardModes(settings){return settings.modes.filter(id=>modeAwardAvailability(id,settings).available);}
