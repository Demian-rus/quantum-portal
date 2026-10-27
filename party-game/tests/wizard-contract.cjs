'use strict';
// Narrow normalization of the explicitly approved TASK027 presentation additions.
// Every preexisting byte outside these exact additions must still match its base.
const OLD='Отгадай все 5 слов за отведённое время! За 5 из 5 получи 3 очка. За неполный результат — 0.';
const NEW='Отгадайте все 3 слова за один таймер. За 3 из 3 — 2 базовых очка, за неполный результат — 0.';
function normalizeWizardModeCopy(s){return s.replace(NEW,OLD).replace("rule:mode.id==='blitz'?'"+OLD+"':mode.rule,",'');}
function withoutWizardShell(s){return s.replace('  <link rel="stylesheet" href="./setup-wizard.css?v=1">\n','').replace('  <script src="./setup-wizard.js?v=1" defer></script>\n','').replace(",'./setup-wizard.css?v=1','./setup-wizard.js?v=1'",'').replaceAll('mode-config.js?v=3','mode-config.js?v=2').replace('kvip-pwa-v90-20261026-wizard-candidate','kvip-pwa-v89-20261026-general-content-release');}
module.exports={OLD,NEW,normalizeWizardModeCopy,withoutWizardShell};
