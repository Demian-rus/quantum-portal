'use strict';
const hunks=require('./reviewed-hunks.json');
function normalizeTask044(source){for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={hunks,normalizeTask044};
