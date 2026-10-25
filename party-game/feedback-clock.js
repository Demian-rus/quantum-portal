'use strict';
// A report is a durable, exceptional timer hold. Ordinary pause policy is unchanged.
function validateFeedbackHold(match){
 const c=match?.current,h=c?.feedbackHold;if(h==null)return;
 if(Object.keys(h).sort().join('|')!=='phase|remainingMs|version|wasPaused'||h.version!==1||
  !['play','countdown'].includes(h.phase)||match.phase!==h.phase||
  !Number.isFinite(h.remainingMs)||h.remainingMs<0||h.remainingMs>Number.MAX_SAFE_INTEGER||
  typeof h.wasPaused!=='boolean'||h.phase==='countdown'&&h.wasPaused||
  c.paused!==true||c.remainingMs!==h.remainingMs||c.deadline!=null||
  h.phase==='countdown'&&c.autoStartAt!=null)throw Error('Unknown or invalid feedback timer hold');
}
function commitFeedbackClock(next){
 if(storageBlocked)throw Error('Таймер не изменён: сохранение защищено.');
 const previous=game.current;let raw;
 try{raw=localStorage.getItem(STORAGE_KEY);}catch{throw Error('Не удалось прочитать сохранение. Таймер не изменён.');}
 game.current=next;
 if(persist())return;
 game.current=previous;
 try{
  if(localStorage.getItem(STORAGE_KEY)!==raw){
   if(raw===null)localStorage.removeItem(STORAGE_KEY);else localStorage.setItem(STORAGE_KEY,raw);
  }
  if(localStorage.getItem(STORAGE_KEY)!==raw)throw Error('rollback');
 }catch{
  // Stop rather than run an unconfirmed deadline. The original key is never cleared.
  game.current=previous.feedbackHold?previous:next;storageBlocked=true;storageProblem='unavailable';stopTicking();
  throw Error('Не удалось подтвердить сохранение таймера. Перезапустите приложение; данные защищены.');
 }
 throw Error('Не удалось сохранить таймер. Освободите память и повторите действие.');
}
function holdFeedbackTimer(now=Date.now()){
 if(game?.current?.feedbackHold){validateFeedbackHold(game);return true;}
 if(!game||!roundUsesTimer()||!['play','countdown'].includes(game.phase))return false;
 const c=game.current,wasPaused=game.phase==='play'&&c.paused===true;
 const remainingMs=Math.max(0,game.phase==='countdown'?c.autoStartAt-now:wasPaused?c.remainingMs:c.deadline-now);
 if(!Number.isFinite(remainingMs))throw Error('Не удалось определить оставшееся время.');
 // A report cannot revive a round that had already expired before the click.
 if(!wasPaused&&remainingMs===0){
  const phase=game.phase;tick();
  return phase==='countdown'&&game.phase==='play'?holdFeedbackTimer(now):false;
 }
 const next={...c,paused:true,deadline:null,remainingMs,
  feedbackHold:{version:1,phase:game.phase,remainingMs,wasPaused}};
 if(game.phase==='countdown')next.autoStartAt=null;
 commitFeedbackClock(next);stopTicking();return true;
}
function releaseFeedbackTimer(now=Date.now()){
 const c=game?.current,h=c?.feedbackHold;if(!h)return false;
 validateFeedbackHold(game);
 const next={...c};delete next.feedbackHold;
 if(h.phase==='countdown'){
  next.autoStartAt=now+h.remainingMs;next.paused=false;next.remainingMs=null;
 }else if(h.wasPaused){next.paused=true;next.deadline=null;next.remainingMs=h.remainingMs;}
 else{next.paused=false;next.deadline=now+h.remainingMs;next.remainingMs=null;}
 commitFeedbackClock(next);return true;
}
