'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process'),{chromium,devices}=require('playwright-core');
const {provisionProfiles}=require('./profile-fixtures.cjs'),{chooseTeamProfiles,duplicateTeamProfileRejected}=require('./team-profile-fixtures.cjs');
const {config,answer,idle,click}=require('./team-game-browser.cjs'),{installProbe,summary}=require('../../diagnostics/task029/mobile-perf.cjs');
const width=Number(process.env.QUIP032_WIDTH||390),height={320:568,390:844,412:915,844:390}[width],URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/',folder='artifacts/quip-task032/'+width;
assert(height);fs.mkdirSync(folder,{recursive:true});
const shot=(p,name)=>p.screenshot({path:folder+'/'+name+'.png'}),step=(p,n)=>p.locator('[data-wizard-step="'+n+'"]').tap();
const totals=p=>p.evaluate(()=>JSON.stringify(profileStore.totals)),raw=p=>p.evaluate(()=>localStorage.getItem(QuipTeamStorage.KEY));
function installSurfaceProbe(){
 const probe=window.__surface032={arm(kind,target,label){if(probe.pending)throw Error('Pending surface measure');probe.wait=new Promise((resolve,reject)=>{probe.pending={kind,target,label,resolve,reject};});}};
 document.addEventListener('pointerdown',event=>{
  const a=probe.pending;if(!a)return;probe.pending=null;const start=event.timeStamp,timer=setTimeout(()=>a.reject(Error('Surface not painted: '+a.label)),30000);
  const poll=()=>{
   const ready=a.kind==='profile'?!document.getElementById('profile-backdrop').hidden===a.target:window.QuipTeams?.active===a.target&&document.getElementById(a.target?'wizard-format-teams':'wizard-format-duel').getAttribute('aria-pressed')==='true';
   if(!ready){requestAnimationFrame(poll);return;}
   requestAnimationFrame(()=>setTimeout(()=>{clearTimeout(timer);a.resolve({label:a.label,start,end:performance.now(),ms:performance.now()-start,trusted:event.isTrusted,pointer:event.pointerType});},0));
  };requestAnimationFrame(poll);
 },true);
}
async function geometry(p,label,rows){
 const g=await p.evaluate(()=>({width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,visualHeight:visualViewport.height,active:document.activeElement?.id,inputFocused:document.activeElement?.matches('input,textarea,[contenteditable="true"]'),buttons:[...document.querySelectorAll('#team-setup button,#mode-song-sources button')].filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {id:n.id,width:r.width,height:r.height,scroll:n.scrollWidth,client:n.clientWidth};})}));
 assert.equal(g.width,width);assert.equal(g.height,height);assert(g.documentWidth<=width+1&&g.documentHeight<=height+1,label+' viewport overflow');for(const b of g.buttons)assert(b.width>=44&&b.height>=44&&b.scroll<=b.client+1,label+' target '+JSON.stringify(b));rows.push({label,...g});return g;
}
async function newProfile(p,slot,name,color){
 await p.locator('#team-profile-'+Math.floor(slot/2)+'-'+slot%2).tap();await p.locator('#profile-create-open').tap();
 assert.equal(await p.evaluate(()=>document.activeElement.id),'profile-name','text input only after explicit Create');await p.locator('#profile-name').fill(name);await p.locator('[data-profile-color="'+color+'"]').tap();await shot(p,'create-profile-'+slot);await p.locator('#profile-create-save').tap();assert.equal(await p.locator('#profile-backdrop').isHidden(),true);
}
async function grammar(p,evidence){
 evidence.grammar=[];
 for(const format of ['duel','teams']){
  await step(p,2);await p.locator('#wizard-format-'+format).tap();await step(p,3);await p.locator('#finish-rounds').locator('..').tap();
  for(const n of [2,4,12,14,22,24,74,100]){
   await p.locator('#custom-rounds').evaluate((input,n)=>{input.value=n;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},String(n));
   const text=await p.evaluate(()=>({rounds:options.rounds,value:$('rounds-value').textContent,preview:$('score-goal-preview').textContent,footer:$('wizard-footer-caption').textContent,summary:$('wizard-summary').textContent}));
   const few=[2,4,22,24,74].includes(n),expected=n+' '+(few?'хода':'ходов');assert.equal(text.rounds,n);assert.equal(text.value,expected);assert.equal(text.preview,'После '+n+' ходов');assert(text.footer.includes(expected));assert(text.summary.includes(expected));evidence.grammar.push({format,n,...text});
   if(n===74){await p.locator('#custom-rounds').scrollIntoViewIfNeeded();await shot(p,format+'-74-turns');await step(p,4);await shot(p,format+'-74-summary');await step(p,3);}
  }
  await p.locator('#finish-score').locator('..').tap();for(const n of [15,20,25,75,100]){
   await p.locator('#target-score').evaluate((input,n)=>{input.value=n;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},String(n));
   assert.equal(await p.locator('#target-score-value').textContent(),n+' очков');assert.equal(await p.locator('#score-goal-preview').textContent(),n+' очков');
  }
 }
 await step(p,2);await p.locator('#wizard-format-teams').tap();
}
async function flatModes(p,evidence){
 await step(p,3);await p.locator('#wizard-mode-settings').tap();assert.equal(await p.locator('.wizard-rule-details[open]').count(),0);assert.equal(await p.locator('.wizard-rule').count(),8);await shot(p,'mode-dividers-top');
 await p.locator('[data-wizard-rule="sing"]').evaluate(n=>n.scrollIntoView({block:'start'}));
 evidence.flatSources=await p.locator('#mode-song-sources .song-source').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {label:n.textContent,pressed:n.getAttribute('aria-pressed'),background:s.backgroundColor,radius:s.borderRadius,shadow:s.boxShadow,width:r.width,height:r.height};}));
 for(const s of evidence.flatSources){assert.equal(s.background,'rgba(0, 0, 0, 0)');assert.equal(parseFloat(s.radius),0);assert.equal(s.shadow,'none');assert(s.width>=44&&s.height>=44);}
 await shot(p,'flat-song-sources');
 const ru=p.locator('[data-song-language="ru"]'),en=p.locator('[data-song-language="en"]');if(await ru.getAttribute('aria-pressed')!=='true')await ru.tap();if(await en.getAttribute('aria-pressed')==='true')await en.tap();
 await ru.tap();assert.equal(await ru.getAttribute('aria-pressed'),'true','last source cannot be removed');await en.tap();assert.deepEqual(await p.evaluate(()=>options.modeSettings.sing.songLanguages),['ru','en']);await ru.tap();assert.deepEqual(await p.evaluate(()=>options.modeSettings.sing.songLanguages),['en']);
 await en.focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');assert.equal(await en.evaluate(n=>n.matches(':focus-visible')),true);await shot(p,'song-source-keyboard-focus');await ru.tap();await en.tap();
 evidence.dividers=await p.locator('.wizard-rule').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return {mode:n.dataset.wizardRule,border:s.borderBottomWidth,color:s.borderBottomColor,background:s.backgroundColor,radius:s.borderRadius,padding:s.paddingTop};}));
 assert(evidence.dividers.every(d=>parseFloat(d.border)===1&&parseFloat(d.radius)===0));
 await p.locator('[data-wizard-rule="approx"]').evaluate(n=>n.scrollIntoView({block:'end'}));await shot(p,'mode-dividers-bottom');await p.locator('#wizard-rules-done').tap();
}
async function performanceChecks(p,evidence){
 await step(p,2);await p.locator('#wizard-format-teams').tap();await p.evaluate(()=>{window.__checks032=0;window.__pools032=0;const check=checkContentPack,pool=getPackCardPool;checkContentPack=function(...args){__checks032++;return check.apply(this,args);};getPackCardPool=function(...args){__pools032++;return pool.apply(this,args);};renderOptions();});
 const rows=[];
 for(let i=-1;i<20;i++){
  for(const [kind,target,label,selector]of [['profile',true,'profile_open','#team-profile-0-0'],['profile',false,'profile_back','#profile-panel-back'],['format',false,'teams_duel','#wizard-format-duel'],['format',true,'duel_teams','#wizard-format-teams']]){
   await p.locator(selector).scrollIntoViewIfNeeded();await p.evaluate(a=>__surface032.arm(...a),[kind,target,label]);await p.locator(selector).tap();const row=await p.evaluate(()=>__surface032.wait);assert(row.trusted&&row.pointer==='touch');if(i>=0)rows.push(row);
  }
  for(const [label,selector,target]of [['players_rules','#wizard-next','rules'],['rules_players','#wizard-back','players']]){
   await p.locator(selector).scrollIntoViewIfNeeded();await p.evaluate(a=>__perf29.arm(...a),['wizard',target,label]);await p.locator(selector).tap();const row=await p.evaluate(()=>__perf29.wait);assert(row.trusted&&row.pointer==='touch');if(i>=0)rows.push({label,...row});
  }
  if(i===-1)await p.evaluate(()=>{__checks032=0;__pools032=0;});
 }
 evidence.performance={rows,stats:Object.fromEntries([...new Set(rows.map(r=>r.label))].map(label=>[label,summary(rows.filter(r=>r.label===label),'ms')])),scans:await p.evaluate(()=>[__checks032,__pools032])};assert.deepEqual(evidence.performance.scans,[0,0]);
 for(const [label,s]of Object.entries(evidence.performance.stats)){assert.equal(s.n,20);assert(s.median<=200&&s.p95<=350,label+' '+JSON.stringify(s));}
 console.log('TASK032 PERF',width,height,JSON.stringify(evidence.performance.stats));
}
async function startSelected(p){await config(p,{rounds:4});await p.locator('#start-game').tap();await idle(p);assert.equal(await p.evaluate(()=>game.phase),'ready');}
async function verifyStatistics(p,ids,count){
 const rows=await p.evaluate(ids=>ids.map(id=>QuipTeamStatistics.forProfile(profileTeamResults(),profileStore.storeId,id)),ids);for(const [i,row]of rows.entries()){assert.equal(row.matches,count);assert.equal(row.wins,i<2?count:0);assert.equal(row.losses,i<2?0:count);assert.equal(row.setter,count);assert.equal(row.guesser,count);assert.equal(Object.hasOwn(row,'points'),false);}return rows;
}
async function missingProfileAtStart(p,evidence){
 await config(p,{rounds:4});assert.equal(await p.locator('#start-game').isDisabled(),false);
 const before=await p.evaluate(()=>localStorage.getItem(QUIP_PROFILES_KEY));
 await p.evaluate(()=>{const next=JSON.parse(localStorage.getItem(QUIP_PROFILES_KEY)),id=QuipTeams.selectedProfileId({format:'teams-2x2',slot:3});next.profiles=next.profiles.filter(p=>p.id!==id);delete next.totals[id];validateProfileStore(next);localStorage.setItem(QUIP_PROFILES_KEY,JSON.stringify(next));window.__random032=Math.random;window.__randomCalls032=0;Math.random=()=>{__randomCalls032++;return __random032();};});
 await p.locator('#start-game').tap();await p.evaluate(()=>QuipTeams.whenIdle());
 evidence.missingProfileStart=await p.evaluate(()=>({blocked:QuipTeams.blocked,raw:localStorage.getItem(QuipTeamStorage.KEY),randomCalls:__randomCalls032}));assert.deepEqual(evidence.missingProfileStart,{blocked:true,raw:null,randomCalls:0});
 await shot(p,'missing-profile-start-blocked');await p.evaluate(before=>{localStorage.setItem(QUIP_PROFILES_KEY,before);Math.random=__random032;readProfileStore();},before);
 await p.locator('#team-reload').tap();await p.evaluate(()=>QuipTeams.whenIdle());await p.locator('#new-game-menu').tap();await p.locator('#standard-game').tap();await p.locator('#wizard-format-teams').tap();
}
async function concurrentConfirmation(ctx,p,ids,matches,evidence){
 const tab=await ctx.newPage();await tab.goto(URL);await tab.evaluate(()=>QuipTeams.whenReady());
 const current=await p.evaluate(()=>({raw:localStorage.getItem(QuipTeamStorage.KEY),record:QuipTeams.record()}));
 const action=async(page)=>page.evaluate(async({raw,record})=>{try{const store=QuipTeamStorage.create({storage:localStorage,validateMatch:QuipTeamsEngine.validateRecord,validateReplacement:QuipTeamsEngine.validateReplacement,validateTransition:QuipTeamsEngine.validateTransition});await store.commit({expectedRaw:raw,match:record});return {ok:true};}catch(e){return {ok:false,code:e.code};}},current);
 evidence.concurrent=await Promise.all([action(p),action(tab)]);assert.equal(evidence.concurrent.filter(r=>r.ok).length,1);assert.equal(evidence.concurrent.find(r=>!r.ok).code,'CONFLICT');await tab.close();await p.reload();await p.evaluate(()=>QuipTeams.whenReady());await verifyStatistics(p,ids,matches);
}
async function interruptedResult(p,ids,evidence){
 await p.locator('#exit-game').tap();await idle(p);await p.locator('#new-game-menu').tap();await p.locator('#standard-game').tap();await p.locator('#wizard-format-teams').tap();await startSelected(p);for(const success of [true,false,true,false])await answer(p,{success});
 await p.evaluate(()=>{window.__originalSet032=Storage.prototype.setItem;window.__fault032=0;Storage.prototype.setItem=function(k,v){if(k===QuipTeamStorage.KEY&&JSON.parse(v).match.game.phase==='results'&&!__fault032++){throw Error('TASK032 injected quota at final result');}return __originalSet032.call(this,k,v);};});
 await p.locator('[data-action="confirm-results"]').tap();await p.evaluate(()=>QuipTeams.whenIdle());assert.equal(await p.evaluate(()=>QuipTeams.blocked),true);assert.equal(await p.evaluate(()=>game.phase),'review','unacknowledged result must not display success');await shot(p,'interrupted-result');
 await p.evaluate(()=>Storage.prototype.setItem=__originalSet032);
 evidence.interrupted=await p.evaluate(async()=>{const store=QuipTeamStorage.create({storage:localStorage,validateMatch:QuipTeamsEngine.validateRecord,validateReplacement:QuipTeamsEngine.validateReplacement,validateTransition:QuipTeamsEngine.validateTransition}),pending=await store.pending();return {status:pending.status,before:JSON.parse(pending.before).match.profileResults.length,after:JSON.parse(pending.after).match.profileResults.length,afterPhase:JSON.parse(pending.after).match.game.phase};});
 assert.deepEqual(evidence.interrupted,{status:'pending',before:1,after:2,afterPhase:'results'});await p.locator('#team-safe-menu').tap();await p.locator('#continue-teams').tap();await p.evaluate(()=>QuipTeams.whenIdle());await p.locator('#team-recover-after').tap();await p.locator('#team-data-backdrop').waitFor({state:'hidden'});await p.locator('#continue-teams').tap();await idle(p);await verifyStatistics(p,ids,2);
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox']}),ctx=await browser.newContext({...devices['Pixel 7'],viewport:{width,height},screen:{width,height},deviceScaleFactor:2.625,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'allow'}),p=await ctx.newPage(),errors=[],evidence={head:execFileSync('git',['rev-parse','HEAD']).toString().trim(),base:'7852bfe05cfa193b8084860a7c4faa0f01ae5786',width,height,cpu:4,physicalDevice:false,browser:browser.version(),geometry:[]};
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.addInitScript(installProbe);await p.addInitScript(installSurfaceProbe);
 try{
  const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await p.goto(URL);await p.evaluate(()=>QuipTeams.whenReady());await provisionProfiles(p);
  const duelIds=await p.evaluate(()=>selectedProfileIds.slice()),duelTotals=await p.evaluate(()=>JSON.stringify(profileStore.totals));
  await p.locator('#new-game-menu').tap();await p.locator('#standard-game').tap();await p.locator('#wizard-format-teams').tap();
  const g=await geometry(p,'empty profiles / no IME',evidence.geometry);assert.equal(g.inputFocused,false);assert(Math.abs(g.visualHeight-height)<=1);assert.equal(await p.locator('#team-setup input').count(),0);assert.equal(await p.locator('#profile-backdrop').isHidden(),true);await p.locator('#team-setup').scrollIntoViewIfNeeded();await shot(p,'four-empty-profiles');await step(p,4);assert.equal(await p.locator('#start-game').isDisabled(),true);await step(p,2);
  for(let slot=0;slot<2;slot++){await p.locator('#team-profile-0-'+slot).tap();await p.locator('[data-profile-id="'+duelIds[slot]+'"]').tap();}
  await newProfile(p,2,'Третий '+width,'violet');await newProfile(p,3,'Четвёртый '+width,'green');const ids=await p.evaluate(()=>[0,1,2,3].map(slot=>QuipTeams.selectedProfileId({format:'teams-2x2',slot})));assert.equal(new Set(ids).size,4);assert.deepEqual(await p.evaluate(()=>selectedProfileIds),duelIds);const originals=JSON.parse(duelTotals);assert.deepEqual(await p.evaluate(ids=>ids.map(id=>profileStore.totals[id]),duelIds),duelIds.map(id=>originals[id]));
  await p.locator('#team-setup').scrollIntoViewIfNeeded();await geometry(p,'four selected profiles',evidence.geometry);await shot(p,'four-selected-profiles');
  await p.locator('#team-profile-1-1').tap();for(const id of ids.slice(0,3))assert.equal(await p.locator('[data-profile-id="'+id+'"]').isDisabled(),true);await p.locator('#profile-panel-back').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.matches(':focus-visible')),true);await shot(p,'profile-picker-keyboard');await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>document.activeElement.id),'team-profile-1-1');
  await grammar(p,evidence);await flatModes(p,evidence);await performanceChecks(p,evidence);
  if(width===390)await missingProfileAtStart(p,evidence);
  const profileRaw=await p.evaluate(()=>localStorage.getItem(QUIP_PROFILES_KEY));await startSelected(p);assert.equal(await p.evaluate(()=>game.teamFormat.version),2);assert.deepEqual(await p.evaluate(()=>game.teamFormat.profileBinding.participants.flat().map(p=>p.id)),ids);
  for(const success of [true,false,true,false])await answer(p,{success});assert.equal(await p.evaluate(()=>QuipTeams.record().profileResults.length),0);await p.locator('[data-action="confirm-results"]').tap();await idle(p);assert.equal(await p.evaluate(()=>game.phase),'results');evidence.statistics=await verifyStatistics(p,ids,1);assert.equal(await p.evaluate(()=>localStorage.getItem(QUIP_PROFILES_KEY)),profileRaw,'team result must not rewrite duel/profile RAW');
  const confirmed=await raw(p);await p.locator('#results-content [data-review-expand="0"]').tap();await idle(p);assert.equal(await raw(p),confirmed);await shot(p,'confirmed-team-result');
  if(width===390)await interruptedResult(p,ids,evidence);const matches=width===390?2:1;
  await p.locator('#exit-game').tap();await idle(p);await p.locator('#statistics-menu').tap();await shot(p,'statistics-duel');await p.locator('#statistics-teams').evaluate(n=>n.scrollIntoView({block:'start'}));await shot(p,'statistics-teams');await verifyStatistics(p,ids,matches);await p.locator('#statistics-back').tap();
  if(width===390)await concurrentConfirmation(ctx,p,ids,matches,evidence);
  await p.evaluate(async()=>{await navigator.serviceWorker.ready});await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await p.reload();await p.evaluate(()=>QuipTeams.whenReady());await p.locator('#continue-teams').tap();await idle(p);await verifyStatistics(p,ids,matches);await shot(p,'offline-result');await p.locator('#exit-game').tap();await idle(p);
  const text=await p.evaluate(()=>createProfileBackupText(readProfileStore()));fs.writeFileSync(folder+'/profiles-both-formats.json',text);const backup=JSON.parse(text);assert.equal(backup.version,2);assert.equal(backup.payload.teamStatistics.results.length,matches);evidence.backup={version:backup.version,profiles:backup.payload.profiles.length,matches};
  if(width===390){
   await ctx.setOffline(false);const target=await browser.newContext({viewport:{width,height},hasTouch:true}),tp=await target.newPage();await tp.goto(URL);await tp.evaluate(()=>QuipTeams.whenReady());await tp.locator('#settings-menu').click();await tp.locator('#backup-file').setInputFiles(folder+'/profiles-both-formats.json');await tp.waitForFunction(()=>$('backup-title').textContent==='АРХИВ НАЙДЕН');await shot(tp,'backup-preview');await tp.locator('#backup-apply').click();await tp.waitForFunction(()=>$('backup-title').textContent==='ПРОФИЛИ ВОССТАНОВЛЕНЫ');assert.deepEqual(await tp.evaluate(()=>profileStore.totals),backup.payload.totals);assert.deepEqual(await tp.evaluate(()=>profileStore.profiles),backup.payload.profiles);await verifyStatistics(tp,ids,matches);await target.close();
  }
  assert.deepEqual(errors,[]);evidence.profileIds=ids;evidence.errors=errors;evidence.offline='native worker cold restart / identical profile IDs / no double count';console.log('TASK032 Android profiles/statistics/grammar/flat sources/native persistence PASS',width,height);
 }catch(error){await shot(p,'failure').catch(()=>{});evidence.failure=String(error.stack||error);throw error;}
 finally{fs.writeFileSync(folder+'/evidence.json',JSON.stringify(evidence,null,2));await ctx.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
