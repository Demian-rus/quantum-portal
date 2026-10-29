'use strict';
// Only these exact presentation/resource hunks are reversible. Unrelated edits
// remain visible to every inherited historical source guard.
const hunks=require('./reviewed-hunks.json');
function normalizeTask036(source){for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask036,hunks};
