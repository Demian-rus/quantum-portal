'use strict';
// Storage contract fixtures use their own validator; playable games are covered
// separately by team-game-browser.cjs with the full engine validator.
const assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright-core');
const {provisionProfiles}=require('./profile-fixtures.cjs');
const URL=process.env.QUIP_TEST_URL||'http://127.0.0.1:8765/party-game/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),a=await context.newPage();
  await a.goto(URL);await provisionProfiles(a);await a.evaluate(()=>{Object.assign(options,{dice:false,modes:['talk'],difficulty:'easy'});newGame();game.dice=false;roll();game.phase='judge';recordAnswer(true);persist();});
  const original=await a.evaluate(()=>({duel:localStorage.getItem('iskra-party:v1'),profiles:localStorage.getItem('kvip-player-profiles:v1')}));
  const b=await context.newPage();await b.goto(URL);
  async function install(page){
   for(const name of ['team-format.js','team-storage.js'])if(await page.evaluate(key=>typeof globalThis[key]==='undefined',name==='team-format.js'?'QuipTeamFormat':'QuipTeamStorage'))await page.addScriptTag({path:path.join(__dirname,'..',name)});
   await page.evaluate(()=>{
    window.fixtureHeader=QuipTeamFormat.create([['ДС','ПА'],['Мама','Папа']],{id:'browser-team-fixture-0001',random:()=>0});
    window.teamStore=QuipTeamStorage.create({storage:localStorage,validateMatch:m=>m.fixtureOnly===true&&Number.isSafeInteger(m.turn)&&m.turn>=0&&Object.keys(m).length===3});
   });
  }
  await install(a);await install(b);
  assert.equal(await a.evaluate(()=>navigator.locks!==undefined),true);
  const old=await a.evaluate(()=>teamStore.commit({expectedRaw:null,match:{teamFormat:fixtureHeader,fixtureOnly:true,turn:0}}));
  // Hold A's real origin-wide Web Lock while B submits the same revision.
  await a.evaluate(()=>{
   window.lockAcquired=false;window.releaseTeamLock=null;
   window.blockingLock=navigator.locks.request(QuipTeamStorage.LOCK,async()=>{window.lockAcquired=true;await new Promise(resolve=>window.releaseTeamLock=resolve);});
  });
  await a.waitForFunction(()=>window.lockAcquired);
  const writes=[a.evaluate(async raw=>{try{return {ok:true,value:await teamStore.commit({expectedRaw:raw,match:{teamFormat:fixtureHeader,fixtureOnly:true,turn:1}})};}catch(e){return {ok:false,code:e.code};}},old.raw),b.evaluate(async raw=>{try{return {ok:true,value:await teamStore.commit({expectedRaw:raw,match:{teamFormat:fixtureHeader,fixtureOnly:true,turn:2}})};}catch(e){return {ok:false,code:e.code};}},old.raw)];
  await a.evaluate(()=>releaseTeamLock());const results=await Promise.all(writes);
  assert.equal(results.filter(r=>r.ok).length,1,JSON.stringify(results));assert.equal(results.find(r=>!r.ok).code,'CONFLICT',JSON.stringify(results));
  assert.equal(await a.evaluate(()=>localStorage.getItem(QuipTeamStorage.JOURNAL_KEY)),null,'winner must have cleared the journal');
  const latest=await b.evaluate(()=>teamStore.load());assert.equal(latest.revision,2);assert.ok([1,2].includes(latest.match.turn));
  await context.setOffline(true);
  // Fresh store after page restart, using actual localStorage and SHA-256.
  await b.reload();await install(b);assert.deepEqual(await b.evaluate(()=>teamStore.load()),latest);
  assert.deepEqual(await b.evaluate(()=>({duel:localStorage.getItem('iskra-party:v1'),profiles:localStorage.getItem('kvip-player-profiles:v1')})),original);
  assert.equal(await b.evaluate(()=>storageBlocked),false);
  // A Web Locks-free environment must block saving rather than silently weaken
  // concurrency. Test injection does not change the browser's real navigator.
  const rejected=await b.evaluate(()=>{try{QuipTeamStorage.create({storage:localStorage,validateMatch:()=>false,exclusive:'invalid'});return null;}catch(e){return e.code;}});assert.equal(rejected,'DEPENDENCY');
  await context.close();console.log('TASK028 foundation PASS: real Web Locks / two tabs / conflict / localStorage / SHA-256 / restart offline / duel exact RAW');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
