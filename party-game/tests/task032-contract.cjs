'use strict';
// Reverse only the exact TASK032 additions for historical byte guards.
// New bindings/statistics are exercised by task032.test.cjs and native browser tests.
const hunks=require('./task032-presentation.json');
// TASK033 reverses the precise new focus rule and two PWA version literals.
// G46 release marker and all historical byte comparisons remain guarded.
function normalizeTask033(source){
 return source.replace('.wizard-page .team-input-wrap:focus-within{box-shadow:none}\n','')
  .replaceAll('setup-wizard.css?v=6','setup-wizard.css?v=5')
  .replaceAll('kvip-pwa-v98-20261028-profile-focus-fix','kvip-pwa-v97-20261028-team-profiles-candidate');
}
function normalizeTask032(source){
 source=normalizeTask033(source);
 source=source.replace("// G46 2026-10-28: refresh the installed PWA catalog after the versioned editorial release.\n",'');
 for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);
 return source;
}
module.exports={normalizeTask032,normalizeTask033};
