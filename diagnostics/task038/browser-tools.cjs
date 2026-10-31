'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {serve,scaleFonts}=require('../task034/mobile.cjs');
const {collect}=require('../task034/geometry.cjs');
const {answer}=require('../../party-game/tests/team-game-browser.cjs');
const ROOT=path.resolve(__dirname,'../..'),BASE='af9eb4723a97c38394b6b9f0310506abb856ef4e';
const names=['Первый','Второй','Третий','Четвёртый'];
const raw=p=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
async function idle(p){await p.evaluate(()=>QuipTeams.whenIdle());assert.equal(await p.evaluate(()=>QuipTeams.blocked),false);}
async function tap(p,selector){await p.locator(selector).tap();await idle(p);}
async function format(p,kind){
 const selected=kind==='teams'?'#wizard-format-teams':'#wizard-format-duel';if(await p.locator(selected).getAttribute('aria-pressed')!=='true')await tap(p,selected);
 const ids=await p.evaluate(()=>profileStore.profiles.slice(0,4).map(p=>p.id));
 for(let n=0;n<(kind==='teams'?4:2);n++){
  const selector=kind==='teams'?'#team-profile-'+Math.floor(n/2)+'-'+n%2:['#team-a','#team-b'][n];
  await tap(p,selector);await tap(p,'[data-profile-id="'+ids[n]+'"]');
 }
}
async function wizard(p,kind='duel'){
 await tap(p,'#new-game-menu');await tap(p,'#standard-game');await format(p,kind);
}
async function configure(p,{modes=['talk'],difficulty='easy'}={}){
 await p.evaluate(({modes,difficulty})=>{soundOn=false;Object.assign(options,{modes,difficulty,finishType:'rounds',rounds:4,riskRounds:false,complications:false,dice:true});renderOptions();},{modes,difficulty});
 await tap(p,'[data-wizard-step="4"]');
}
async function seed(p,count=4){
 await p.evaluate(count=>{
  for(let n=0;n<count;n++)createPlayerProfile(n<4?['Первый','Второй','Третий','Четвёртый'][n]:'Профиль '+n,['coral','cyan','violet','green'][n%4]);
  selectedProfileIds=profileStore.profiles.slice(0,2).map(p=>p.id);soundOn=false;
  Object.assign(options,{modes:['talk'],difficulty:'easy',finishType:'rounds',rounds:4,complications:false,riskRounds:false,dice:true});
  newGame();game.dice=false;
  for(let n=0;n<4;n++){roll();toggleWord();startTimer();finishTimer('early');recordAnswer(n!==3,true);}
  confirmReviewedResults();backToMenu();newGame();game.dice=false;roll();game.dice=true;toggleWord();startTimer();pauseTimer();options=sanitizeOptions(options);persist();backToMenu();
 },count);
 assert(await p.evaluate(()=>Object.values(profileStore.totals).some(t=>t.matches>0)),'seed real nonzero duel statistics');
 await wizard(p,'teams');await configure(p);await tap(p,'#start-game');
 for(let n=0;n<4;n++)await answer(p,{success:n!==3});
 await tap(p,'[data-action="confirm-results"]');assert(await p.evaluate(()=>QuipTeams.record().profileResults.length>0),'seed real confirmed team ledger');
 await tap(p,'[data-action="menu"]');await wizard(p,'teams');await configure(p);await tap(p,'#start-game');
 await tap(p,'[data-action="roll"]');await p.waitForFunction(()=>game.phase==='task');await tap(p,'[data-action="toggle-word"]');await tap(p,'.timer-ring[role="button"]');await tap(p,'.timer-ring[role="button"]');assert(await p.evaluate(()=>game.current.paused));
 await tap(p,'#exit-game');await wizard(p,'duel');await tap(p,'#wizard-back');await tap(p,'#wizard-back');await idle(p);
 assert(await p.evaluate(()=>game.current.paused),'original paused duel is still restored');
}
async function inspect(p,out,label,scale,{baseline=false,reference}={}){
 await scaleFonts(p,scale);await p.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect.getTiming().iterations)).map(a=>a.finished.catch(()=>{})));});const geometry=await p.evaluate(collect,{sweep:true});
 const file=label+'.png';await p.screenshot({path:path.join(out,file),scale:'css',animations:'disabled'});
 assert(geometry.document.width<=geometry.viewport.width+1,label+' document overflow');
 assert.deepEqual(geometry.overlaps,[],label+' overlapping controls');if(!baseline)assert.deepEqual(geometry.small,reference?.small||[],label+' small targets must match accepted main exactly; new targets have no allowance');assert.deepEqual(geometry.clipped,[],label+' control overflow');assert.deepEqual(geometry.textClips,[],label+' text overflow');assert.deepEqual(geometry.reachable,[],label+' unreachable controls');
 assert(geometry.promptText.every(t=>t.readable),label+' prompt readability');assert(geometry.timerText.every(t=>t.fits&&!t.overlaps.length),label+' timer text fit');
 return {label,file,geometry,fontMethod:await p.evaluate(()=>window.__font034Method)};
}
function roots(){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'task038-base-')),tar=path.join(base,'base.tar');
 execFileSync('git',['archive','--format=tar','--output='+tar,BASE,'party-game'],{cwd:ROOT});execFileSync('tar',['-xf',tar,'-C',base]);return {base,after:ROOT,dispose(){fs.rmSync(base,{recursive:true,force:true});}};
}
async function detector(p){
 await p.evaluate(()=>{const n=document.createElement('div');n.id='geometry038';n.setAttribute('role','dialog');n.setAttribute('aria-modal','true');n.style.cssText='position:fixed;inset:0;z-index:99999';n.innerHTML='<button id="geometry038a" style="position:absolute;left:20px;top:20px;width:60px;height:50px;padding:0;min-width:0;min-height:0;transition:none!important;animation:none!important">A</button><button id="geometry038b" style="position:absolute;left:50px;top:40px;width:60px;height:50px;padding:0;min-width:0;min-height:0;transition:none!important;animation:none!important">B</button>';document.body.append(n);});
 try{const g=await p.evaluate(collect);assert(g.overlaps.some(o=>o.area===900));await p.locator('#geometry038b').evaluate(n=>n.style.top='100px');assert.equal((await p.evaluate(collect)).overlaps.length,0);return {positiveArea:900,separated:0};}finally{await p.locator('#geometry038').evaluate(n=>n.remove());}
}
module.exports={ROOT,BASE,names,raw,idle,tap,format,wizard,configure,seed,inspect,roots,serve,scaleFonts,collect,detector};
