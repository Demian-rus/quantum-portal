'use strict';
// Remove only TASK039's explicitly reviewed cache-buster changes from legacy
// byte-exact historical tests. No gameplay JavaScript/CSS is normalized.
const REVISIONS=Object.freeze([
 ['kvip-pwa-v107-20261031-task039-mixed-blitz-categories','kvip-pwa-v106-20261030-general-categories-candidate-n'],
 ['mode-config.js?v=4','mode-config.js?v=3'],
 ['rules.js?v=6','rules.js?v=5'],
 ['round-selection.js?v=7','round-selection.js?v=6'],
 ['team-engine.js?v=14','team-engine.js?v=13'],
 ['content-packs.js?v=22','content-packs.js?v=21']
]);
function normalizeTask039Resources(source){
 return REVISIONS.reduce((result,[current,previous])=>result.replaceAll(current,previous),source);
}
module.exports={normalizeTask039Resources,REVISIONS};
