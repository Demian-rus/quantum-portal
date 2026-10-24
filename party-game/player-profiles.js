'use strict';
// Local identity and compact lifetime statistics. Independent of gameplay RNG.
const QUIP_PROFILES_KEY='kvip-player-profiles:v1';
const QUIP_PROFILE_COLORS=Object.freeze({coral:'#ff827e',cyan:'#9aeee6',violet:'#af98ff',green:'#a8ef9b',yellow:'#f5df87',pink:'#f49ecb',orange:'#ffb06e',blue:'#88baff'});
const QUIP_PROFILE_COLOR_NAMES=Object.freeze({coral:'Коралловый',cyan:'Голубой',violet:'Фиолетовый',green:'Зелёный',yellow:'Жёлтый',pink:'Розовый',orange:'Оранжевый',blue:'Синий'});
// Statistics keys follow a safe ID format, not a hardcoded catalog of modes.
// This supports future modes and keeps retired mode totals readable.
function validProfileModeId(id){
  return typeof id==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(id)&&id!=='constructor'&&id!=='prototype';
}
const QUIP_RECENT_MATCH_LIMIT=100;
let profileStore=null,profileStoreProblem=null;
let selectedProfileIds=[null,null],statisticsProfileId=null;
function profileUUID(){
  if(!globalThis.crypto?.getRandomValues)throw Error('На устройстве недоступно создание безопасного ID.');
  const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
}
function normalizeProfileName(value){return String(value??'').normalize('NFKC').replace(/\s+/gu,' ').trim();}
function profileNameKey(value){return normalizeProfileName(value).toLocaleLowerCase('ru-RU');}
function emptyProfileTotals(){return {matches:0,wins:0,losses:0,draws:0,points:0,turns:0,modes:{}};}
function freshProfileStore(){return {version:1,storeId:profileUUID(),nextSequence:1,settledThrough:0,profiles:[],totals:{},recent:[],lastPair:[]};}
function validProfileId(id){return typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);}
function profileCount(value,signed=false){return Number.isSafeInteger(value)&&(signed||value>=0);}
function validateProfileStore(data){
  const fail=()=>{throw Error('Данные профилей повреждены или имеют неизвестную версию. Исходные данные сохранены.');};
  if(!data||data.version!==1||!validProfileId(data.storeId)||!profileCount(data.nextSequence)||data.nextSequence<1||
     !profileCount(data.settledThrough)||data.settledThrough>=data.nextSequence||!Array.isArray(data.profiles)||
     !data.totals||typeof data.totals!=='object'||Array.isArray(data.totals)||!Array.isArray(data.recent)||data.recent.length>QUIP_RECENT_MATCH_LIMIT||!Array.isArray(data.lastPair))fail();
  const ids=new Set(),names=new Set();
  for(const p of data.profiles){
    if(!p||!validProfileId(p.id)||ids.has(p.id)||typeof p.name!=='string'||p.name!==normalizeProfileName(p.name)||
       !p.name||Array.from(p.name).length>24||names.has(profileNameKey(p.name))||!Object.hasOwn(QUIP_PROFILE_COLORS,p.color)||!profileCount(p.createdAt))fail();
    ids.add(p.id);names.add(profileNameKey(p.name));
    const total=data.totals[p.id];
    if(!total||!['matches','wins','losses','draws','points','turns'].every(key=>profileCount(total[key],key==='points'))||
       total.matches!==total.wins+total.losses+total.draws||!total.modes||typeof total.modes!=='object'||Array.isArray(total.modes))fail();
    for(const [mode,stats] of Object.entries(total.modes)){
      if(!validProfileModeId(mode)||!stats||!profileCount(stats.rounds)||!profileCount(stats.success)||stats.success>stats.rounds||!profileCount(stats.points,true))fail();
      if(stats.methods!=null){
        if(mode!=='secret'||typeof stats.methods!=='object'||Array.isArray(stats.methods))fail();
        for(const [method,value] of Object.entries(stats.methods))if(!validProfileModeId(method)||!value||
          !profileCount(value.rounds)||!profileCount(value.success)||value.success>value.rounds||!profileCount(value.points,true))fail();
      }
    }
  }
  if(Object.keys(data.totals).some(id=>!ids.has(id))||data.lastPair.length!==0&&
     (data.lastPair.length!==2||data.lastPair[0]===data.lastPair[1]||data.lastPair.some(id=>!ids.has(id))))fail();
  let previous=0;
  for(const row of data.recent){
    if(!row||!profileCount(row.sequence)||row.sequence<=previous||row.sequence>data.settledThrough||!profileCount(row.completedAt)||
       !Array.isArray(row.profileIds)||row.profileIds.length!==2||row.profileIds[0]===row.profileIds[1]||row.profileIds.some(id=>!ids.has(id))||
       !Array.isArray(row.scores)||row.scores.length!==2||row.scores.some(score=>!profileCount(score))||!profileCount(row.turns))fail();
    previous=row.sequence;
  }
  return data;
}
function readProfileStore(){
  try{
    const raw=localStorage.getItem(QUIP_PROFILES_KEY);
    profileStore=raw===null?null:validateProfileStore(JSON.parse(raw));profileStoreProblem=null;
    return profileStore;
  }catch(error){profileStore=null;profileStoreProblem='Не удалось открыть профили. Данные сохранены; проверьте доступ к памяти и версию приложения.';throw error;}
}
function writeProfileStore(next){
  validateProfileStore(next);
  const raw=JSON.stringify(next);
  localStorage.setItem(QUIP_PROFILES_KEY,raw);
  if(localStorage.getItem(QUIP_PROFILES_KEY)!==raw)throw Error('Не удалось подтвердить сохранение.');
  profileStore=next;profileStoreProblem=null;
}
function restoreProfiles(){
  try{readProfileStore();selectedProfileIds=profileStore?.lastPair.length===2?profileStore.lastPair.slice():[null,null];}
  catch{selectedProfileIds=[null,null];}
}
function createPlayerProfile(name,color){
  name=normalizeProfileName(name);
  if(!name)throw Error('Введите имя профиля.');
  if(Array.from(name).length>24)throw Error('Имя — не больше 24 символов.');
  if(!Object.hasOwn(QUIP_PROFILE_COLORS,color))throw Error('Выберите цвет из палитры.');
  const current=readProfileStore()||freshProfileStore();
  if(current.profiles.some(p=>profileNameKey(p.name)===profileNameKey(name)))throw Error('Профиль с таким именем уже есть.');
  const next=JSON.parse(JSON.stringify(current)),profile={id:profileUUID(),name,color,createdAt:Date.now()};
  next.profiles.push(profile);next.totals[profile.id]=emptyProfileTotals();writeProfileStore(next);return profile;
}
function selectedPlayerProfiles(){
  const profiles=selectedProfileIds.map(id=>profileStore?.profiles.find(p=>p.id===id));
  return profiles.every(Boolean)&&profiles[0].id!==profiles[1].id?profiles:null;
}
function reserveProfileMatch(){
  readProfileStore();
  const profiles=selectedPlayerProfiles();
  if(!profiles)throw Error('Выберите два разных профиля.');
  const next=JSON.parse(JSON.stringify(profileStore)),sequence=next.nextSequence++;
  next.lastPair=profiles.map(p=>p.id);writeProfileStore(next);
  return {version:1,storeId:next.storeId,sequence,participants:profiles.map(({id,name,color})=>({id,name,color}))};
}
function validateProfileMatch(match){
  if(match.profileMatch==null)return;
  const value=match.profileMatch;
  if(value.version!==1||!validProfileId(value.storeId)||!profileCount(value.sequence)||value.sequence<1||
     match.matchId!==value.storeId+':'+value.sequence||!Array.isArray(value.participants)||value.participants.length!==2||
     value.participants[0].id===value.participants[1].id||value.participants.some((p,i)=>!validProfileId(p.id)||
       typeof p.name!=='string'||p.name!==match.teams[i]||!Object.hasOwn(QUIP_PROFILE_COLORS,p.color)))throw Error('Invalid player profile snapshot');
}
function profileColorForMatch(match,index){
  const color=match?.profileMatch?.participants?.[index]?.color;
  return QUIP_PROFILE_COLORS[color]||QUIP_PROFILE_COLORS[index===0?'coral':'cyan'];
}
function completedProfileSummary(match){
  validateProfileMatch(match);
  if(!match.profileMatch||match.phase!=='results'||!Array.isArray(match.history)||match.history.length!==match.roundIndex||
     !Array.isArray(match.scores)||match.scores.length!==2||match.scores.some(score=>!profileCount(score))||
     !(match.finishType==='score'?match.roundIndex%2===0&&Math.max(...match.scores)>=match.targetScore&&match.scores[0]!==match.scores[1]:match.roundIndex>=match.rounds))throw Error('Партия ещё не завершена.');
  // Each prompt belongs to the setter on that turn. Points may belong
  // to another player, so assignment must never be derived from score.
  const first=match.startingTeamIndex??0;
  if(![0,1].includes(first))throw Error('Некорректный первый игрок.');
  const summaries=[emptyProfileTotals(),emptyProfileTotals()];
  summaries.forEach((s,i)=>{s.matches=1;s.points=match.scores[i];
    s[match.scores[0]===match.scores[1]?'draws':match.scores[i]>match.scores[1-i]?'wins':'losses']=1;});
  for(const [turn,row] of match.history.entries()){
    const owner=(first+turn)%2;
    if(row.setterIndex!=null&&row.setterIndex!==owner)throw Error('Некорректный владелец задания.');
    if(!validProfileModeId(row.mode))throw Error('Некорректный ID режима в истории.');
    // Most modes assign one question to the setter. «Примерно» is answered
    // by BOTH profiles; a future simultaneous mode can specify assignedIndices.
    const assignedIndices=row.assignedIndices??(row.mode==='approx'?[0,1]:[owner]);
    if(!Array.isArray(assignedIndices)||!assignedIndices.length||
       assignedIndices.some(i=>![0,1].includes(i))||
       new Set(assignedIndices).size!==assignedIndices.length||
       !assignedIndices.includes(owner))throw Error('Некорректные участники задания.');
    assignedIndices.forEach(i=>summaries[i].turns++);
    // A shared-award mode supplies per-player deltas; future modes can use
    // this contract without adding their ID to the statistics module.
    const shared=Object.hasOwn(row,'deltas');
    const deltas=shared?row.deltas:[0,0];
    if(row.mode==='approx'&&!shared)throw Error('Нет индивидуальных результатов Примерно.');
    if(shared&&(!Array.isArray(row.recipients)||row.recipients.some(i=>![0,1].includes(i))||new Set(row.recipients).size!==row.recipients.length))throw Error('Повреждены получатели общего результата.');
    if(!shared){
      if(![0,1].includes(row.recipientIndex)||!profileCount(row.awarded,true))throw Error('Неизвестный получатель очков.');
      deltas[row.recipientIndex]=row.awarded;
    }
    if(!Array.isArray(deltas)||deltas.length!==2||deltas.some(d=>!profileCount(d,true)))throw Error('Повреждён результат хода.');
    if(row.mode==='secret'&&!validProfileModeId(row.methodId))throw Error('Некорректный ID способа Секретки.');
    summaries.forEach((summary,i)=>{
      const assigned=assignedIndices.includes(i);
      // An unassigned participant can still earn or lose real points.
      if(!assigned&&deltas[i]===0)return;
      const mode=summary.modes[row.mode]||(summary.modes[row.mode]={rounds:0,success:0,points:0});
      if(assigned){
        const success=shared?row.recipients.includes(i):row.taskSuccess??row.correct;
        if(typeof success!=='boolean')throw Error('Неизвестен исход задания.');
        mode.rounds++;mode.success+=Number(success);
      }
      mode.points+=deltas[i];
      if(row.mode==='secret'){
        mode.methods=mode.methods||{};
        const method=mode.methods[row.methodId]||(mode.methods[row.methodId]={rounds:0,success:0,points:0});
        if(assigned){method.rounds++;method.success+=Number(row.taskSuccess??row.correct);}
        method.points+=deltas[i];
      }
    });
  }
  summaries.forEach(s=>{if(Object.values(s.modes).reduce((sum,mode)=>sum+mode.points,0)!==s.points)throw Error('Очки не совпадают с историей.');});
  return summaries;
}
// One active local match: reserving a later sequence supersedes abandoned older
// sessions. A lifetime watermark also rejects replays after recent[] is pruned.
function commitProfileResult(match){
  if(!match?.profileMatch)return true;
  const current=readProfileStore(),identity=match.profileMatch;
  validateProfileMatch(match);
  if(!current||current.storeId!==identity.storeId||identity.sequence>=current.nextSequence||
     identity.participants.some(p=>!current.profiles.some(saved=>saved.id===p.id)))throw Error('Профили этой партии недоступны.');
  if(identity.sequence<=current.settledThrough)return true;
  const summaries=completedProfileSummary(match),next=JSON.parse(JSON.stringify(current));
  summaries.forEach((summary,i)=>{
    const total=next.totals[identity.participants[i].id];
    for(const key of ['matches','wins','losses','draws','points','turns'])total[key]+=summary[key];
    for(const [id,stats] of Object.entries(summary.modes)){
      const mode=total.modes[id]||(total.modes[id]={rounds:0,success:0,points:0});
      for(const key of ['rounds','success','points'])mode[key]+=stats[key];
      if(stats.methods){
        mode.methods=mode.methods||{};
        for(const [id,value] of Object.entries(stats.methods)){
          const method=mode.methods[id]||(mode.methods[id]={rounds:0,success:0,points:0});
          for(const key of ['rounds','success','points'])method[key]+=value[key];
        }
      }
    }
  });
  next.settledThrough=identity.sequence;
  next.recent.push({sequence:identity.sequence,completedAt:Date.now(),profileIds:identity.participants.map(p=>p.id),scores:match.scores.slice(),turns:match.roundIndex});
  next.recent=next.recent.slice(-QUIP_RECENT_MATCH_LIMIT);writeProfileStore(next);return true;
}
let profileResultProblem=null;
function saveCompletedProfileResult(){
  if(!game?.profileMatch||game.phase!=='results')return true;
  try{
    // Preserve a durable retry source before committing the atomic aggregate.
    if(storageBlocked||JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')?.game?.matchId!==game.matchId||
       JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')?.game?.phase!=='results'){
      if(!persist())throw Error('Не удалось сохранить завершённую партию.');
    }
    commitProfileResult(game);profileResultProblem=null;return true;
  }catch{profileResultProblem='Результат пока не сохранён в статистику. Освободите память и нажмите «Повторить запись». Результат остаётся на экране для повторной попытки.';return false;}
}
