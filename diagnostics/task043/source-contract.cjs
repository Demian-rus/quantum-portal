'use strict';
const hunks=require('./reviewed-hunks.json');
function normalizeTask043(source){source=require('../task044/source-contract.cjs').normalizeTask044(source);for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTask043,hunks};
