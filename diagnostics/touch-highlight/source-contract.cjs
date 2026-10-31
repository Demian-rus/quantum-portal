'use strict';
const {normalizeTask038}=require('../task038/source-contract.cjs');
const hunks=require('./reviewed-hunks.json');
function normalizeTouchHighlight(source){source=normalizeTask038(source);for(const h of hunks.slice().reverse())source=source.replace(h.after,h.before);return source;}
module.exports={normalizeTouchHighlight,hunks};
