'use strict';
// Reverse only the three reviewed loader/cache additions. Game logic, payloads
// and historical presentation comparisons retain all their byte guards.
const BASE='4b84dc88bc39e0b0b4145dce240a0a66d964248a';
const LINK='  <link rel="stylesheet" href="./responsive-layout.css?v=1">\n';
const RESOURCE=",'./responsive-layout.css?v=1'";
const {normalizeTask035}=require('../task035/source-contract.cjs');
function normalizeTask034(s){return normalizeTask035(s).replace(LINK,'').replace(RESOURCE,'').replaceAll('kvip-pwa-v99-20261028-responsive-candidate','kvip-pwa-v98-20261028-profile-focus-fix');}
module.exports={BASE,LINK,RESOURCE,normalizeTask034};
