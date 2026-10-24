'use strict';
// Explicit test data for pre-profile gameplay regression suites. Production boot
// never creates profiles. Profile lifecycle itself is covered through the UI.
async function provisionProfiles(page){
  await page.evaluate(()=>{
    if(typeof createPlayerProfile!=='function')return;
    if(!profileStore){createPlayerProfile('Молнии','coral');createPlayerProfile('Кометы','cyan');}
    if(!selectedPlayerProfiles())selectedProfileIds=profileStore.profiles.slice(0,2).map(p=>p.id);
    if(selectedPlayerProfiles()&&JSON.stringify(profileStore.lastPair)!==JSON.stringify(selectedProfileIds))
      writeProfileStore({...profileStore,lastPair:selectedProfileIds.slice()});
    renderOptions();
  });
}
// A historical deployment must serve every script its own HTML references.
// Partial file lists would mix new profile-aware views with a pre-profile app.
function historicalRuntimeFiles(git,reference,files){
  const html=git(['show',reference+':party-game/index.html']).toString();
  const scripts=Array.from(html.matchAll(/<script src="\.\/([^?"/]+\.js)(?:\?[^" ]*)?" defer><\/script>/g),match=>match[1]);
  return [...new Set([...files,...scripts])];
}
async function chooseNamedProfile(page,slot,name,color='violet'){
  await page.locator(slot===0?'#team-a':'#team-b').click();
  const existing=page.locator('#profile-list [data-profile-id]').filter({hasText:name});
  if(await existing.count()){await existing.first().click();return;}
  await page.locator('#profile-create-open').click();
  await page.locator('#profile-name').fill(name);
  await page.locator('[data-profile-color="'+color+'"]').click();
  await page.locator('#profile-create-save').click();
}
module.exports={provisionProfiles,chooseNamedProfile,historicalRuntimeFiles};
