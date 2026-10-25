'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {createSimulation}=require('../scripts/game-simulation.cjs');
function simulation(){
 const h=createSimulation(77);h.context.TextEncoder=TextEncoder;h.context.localStorage.removeItem=key=>h.storage.delete(key);return h;
}
test('integration: restoring profiles and operating reports preserve the other archive and main RAW exactly',async()=>{
 const source=simulation(),target=simulation();
 const archived=await source.eval('createProfileBackupText(profileStore)');target.context.archived=archived;
 target.eval("var item={cardId:'word-integration-1',pack:{id:'general',version:6},context:'round',modeId:'talk',methodId:null,difficulty:'easy',text:'Мачта'};saveCardReport(item,'error')");
 const report=target.storage.get('kvip-card-reports:v1'),main=target.storage.get('iskra-party:v1'),oldProfiles=target.storage.get('kvip-player-profiles:v1');
 target.eval("Math.random=()=>{throw Error('Archive operation consumed gameplay RNG')}");
 await target.eval('restoreProfileBackupText(localStorage,archived,{allowReplace:true})');target.eval('restoreProfiles()');
 assert.equal(target.storage.get('kvip-card-reports:v1'),report);assert.equal(target.storage.get('iskra-party:v1'),main);
 assert.equal(JSON.parse(target.storage.get('kvip-player-profiles:import-recovery:v1')).raw,oldProfiles);
 const profile=target.storage.get('kvip-player-profiles:v1');
 assert.deepEqual(JSON.parse(profile),JSON.parse(archived).payload);
 assert.equal(JSON.parse(target.eval('createCardReportsText()')).archive.items.length,1);
 assert.equal(JSON.parse(await target.eval('createProfileBackupText(profileStore)')).payload.storeId,JSON.parse(profile).storeId);
 target.eval("var row=readCardReports().data.items[0];saveCardReport(item,'other','Проверить',{allowUpdate:true,expectedRow:JSON.stringify(row)});var row=readCardReports().data.items[0];deleteCardReport(row.itemKey,JSON.stringify(row));saveCardReport(item,'hard');clearCardReports(readCardReports().raw)");
 assert.equal(target.storage.get('kvip-player-profiles:v1'),profile);assert.equal(target.storage.get('iskra-party:v1'),main);
 assert.equal(JSON.parse(target.storage.get('kvip-card-reports:v1')).items.length,0);
});
test('integration: pinned storage cores and gameplay contracts are byte-exact from the accepted PRs',()=>{
 const root=path.resolve(__dirname,'../..');
 for(const [ref,names]of [
  ['6b68155a2584eda787dc383e60e36c54cbe8b9c5',['profile-backup.js','profile-backup-view.js','storage-controller.js']],
  ['cd6b2067acb984a6ea33d71e2f28d4f7ffde863c',['card-reports.js','round-selection.js','round-actions.js']]
 ])for(const name of names)assert.deepEqual(fs.readFileSync(path.join(root,'party-game',name)),execFileSync('git',['show',ref+':party-game/'+name],{cwd:root}),name);
});

test('integration: session restoration retains every previous guard plus the explicit report-hold guard',()=>{
 const current=fs.readFileSync(path.join(__dirname,'../session-restoration.js'),'utf8').replace('    validateResultReview(candidate);\n','').replace('    validateFeedbackHold(candidate);\n','').replace(' && !candidate.current?.feedbackHold &&',' &&');
 assert.equal(current,execFileSync('git',['show','6b68155a2584eda787dc383e60e36c54cbe8b9c5:party-game/session-restoration.js'],{encoding:'utf8'}));
});
