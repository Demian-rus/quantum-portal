'use strict';
// Reverse only the exact TASK032 additions for historical byte guards.
// New bindings/statistics are exercised by task032.test.cjs and native browser tests.
const hunks=require('./task032-presentation.json');
function normalizeTask032(source){
 // Reverse only the exact post-TASK032 release marker before historical byte comparisons.
 source=source.replace("// G46 2026-10-28: refresh the installed PWA catalog after the versioned editorial release.\n",'');
 for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);
 return source;
}
module.exports={normalizeTask032};
