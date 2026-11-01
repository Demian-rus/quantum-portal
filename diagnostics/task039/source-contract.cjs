'use strict';
// Reverse only the exact reviewed TASK039 additions, before older TASK038–034
// guards run. Unknown bytes, including edits inside these additions, remain
// visible. Editorial arrays are checked by the deterministic catalog guard.
const hunks=require('./reviewed-hunks.json');
function normalizeTask039(source){for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask039,hunks};
