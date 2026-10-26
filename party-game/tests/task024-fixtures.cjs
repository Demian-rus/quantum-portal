'use strict';
const {provisionProfiles}=require('./profile-fixtures.cjs');
const scenarios=[{id:'sing',mode:'sing',modifier:null,word:'ОБЛАКА'},{id:'secret',mode:'secret',method:'talk',modifier:'v2-analogy',word:'ВОДОВОРОТ'},
 {id:'mime',mode:'mime',modifier:'v2-no-touch',word:'ВЕЛОСИПЕД'},{id:'talk-two',mode:'talk',modifier:null,word:'УВЕДОМЛЕНИЕ'},
 {id:'talk-three',mode:'talk',modifier:'v2-two-words',word:'ПЕРЕВОДИТЬ ТЕЛЕФОН В БЕЗЗВУЧНЫЙ РЕЖИМ'},
 {id:'blitz',mode:'blitz',modifier:'v2-unique-nouns',risk:true},
 {id:'draw',mode:'draw',modifier:'v2-other-hand',word:'ПОДВОДНАЯ ЛОДКА'},
 {id:'yesno',mode:'yesno',awardTo:'guesser',modifier:'v2-no-names-search',word:'КАПИТАН'}];
async function settled(p){await p.evaluate(()=>document.fonts.ready);await p.locator('.mode-art').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await p.locator('#scene-game').evaluate(el=>Promise.all(el.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));}
async function fixture(p,scenario={mode:'sing',modifier:null}){
 await p.evaluate(s=>{
  if(!$('result-history-backdrop').hidden)closeResultHistory(false);if(!$('report-backdrop').hidden)closeReportPanel();
  soundOn=false;chooseStartingTeam=()=>0;Math.random=()=>0;window.__now=1792930000000;Date.now=()=>window.__now;
  Object.assign(options,{modes:[s.mode],dice:false,difficulty:s.difficulty||'easy',complications:true,modifierChance:100,riskRounds:true,awardTo:s.awardTo||'setter',finishType:'rounds',rounds:12});
  newGame();game.dice=false;roll();game.dice=true;options.dice=true;
  const c=game.current,m=QUIP_MODIFIERS_V2.find(r=>r.id===s.modifier);
  Object.assign(c,{modeId:s.mode,methodId:s.mode==='secret'?s.method||'talk':s.mode,visible:false,risk:s.risk||false,
   modifierVersion:2,complicationId:m?.id||null,complication:m?.text||'',deadline:null,remainingMs:null,paused:false});
  if(s.word)c.word=s.word;
  c.basePoints=rewardForRound(game,s.mode,c.difficulty);c.modifierPoints=m?modeConfigForGame(game,s.mode).modifierBonus:0;c.points=rewardForRound(game,s.mode,c.difficulty,!!m);
  game.phase='task';persist();render();stopTicking();
 },scenario);await settled(p);
}
async function phase(p,name){
 await p.evaluate(name=>{const c=game.current;c.visible=name!=='hidden'&&name!=='task';game.phase=name==='task'||name==='opened'?'task':name==='countdown'?'countdown':'play';
  c.deadline=game.phase==='play'?Date.now()+c.seconds*1000:null;c.autoStartAt=game.phase==='countdown'?Date.now()+1000:null;c.paused=false;c.remainingMs=null;persist();render();stopTicking();},name);await settled(p);
}
const geometry=p=>p.evaluate(()=>{
 const box=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}},q=s=>box(document.querySelector(s));
 const region=document.querySelector('.round-condition-slot')||document.querySelector('.round-top'),condition=document.querySelector('.round-condition');
 let copy=null;if(condition){const r=document.createRange();r.selectNodeContents(condition.querySelector('strong'));copy=box(r);}
 const word=document.querySelector('.challenge-word');let wordBox=null;if(word){const r=document.createRange();r.selectNodeContents(word);wordBox=box(r);}
 const time=document.querySelector('.round-top .play-timer');let timeText=null;if(time){const r=document.createRange();r.selectNodeContents(time);timeText=box(r);}
 return {viewport:{w:innerWidth,h:innerHeight},phase:game.phase,card:q('.challenge-card'),fixed:q('.round-fixed-card'),top:q('.round-top'),condition:q('.round-condition'),conditionRegion:box(region),copy,word:wordBox,
  icon:q('.mode-symbol'),timer:q('.timer-ring'),timeText,caption:q('.round-top .game-eyebrow'),bottom:q('.round-bottom'),ratings:[...document.querySelectorAll('[data-feedback]')].map(box),
  decisions:[...document.querySelectorAll('.round-bottom--play button')].map(box),document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},
  regionScroll:region?{client:region.clientHeight,scroll:region.scrollHeight}:null,cardScroll:word?{client:word.parentElement.clientHeight,scroll:word.parentElement.scrollHeight,width:word.parentElement.clientWidth,scrollWidth:word.parentElement.scrollWidth}:null};
});
async function setup(p,url){await p.goto(url);await provisionProfiles(p);}
module.exports={scenarios,fixture,phase,settled,geometry,setup};
