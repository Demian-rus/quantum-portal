'use strict';
// Add a new version when changing parameters. Saved rounds retain their snapshots.
const QUIP_MODE_CONFIG_VERSION=1;
const QUIP_MODES_V4=Object.freeze(Object.fromEntries([
 {"id":"talk","title":"СЛОВА","rule":"Объясняй словами, не называя ответ и однокоренные слова.","kind":"words","basePoints":1,"modifierBonus":1,"usesTimer":true,"allowsRisk":true,"blitzWordsCount":0,"supportsSharedAward":false,"cardType":"words","durationBonus":0,"secretMethod":true,"usesModifiers":true,"interaction":"explain","enabled":true},
 {"id":"mime","title":"ЖЕСТЫ","rule":"Только жесты и мимика. Нельзя говорить или издавать звуки.","kind":"words","basePoints":1,"modifierBonus":1,"usesTimer":true,"allowsRisk":true,"blitzWordsCount":0,"supportsSharedAward":false,"cardType":"words","durationBonus":0,"secretMethod":true,"usesModifiers":true,"interaction":"explain","enabled":true},
 {"id":"draw","title":"НАРИСУЙ","rule":"Рисуй на бумаге, не используя буквы, цифры и жесты.","kind":"words","basePoints":1,"modifierBonus":1,"usesTimer":true,"allowsRisk":true,"blitzWordsCount":0,"supportsSharedAward":false,"cardType":"words","durationBonus":30,"secretMethod":true,"usesModifiers":true,"interaction":"explain","enabled":true},
 {"id":"sing","title":"НАПОЙ","rule":"Напевай песню, связанную с темой. Соперник должен отгадать тему.","kind":"songs","basePoints":1,"modifierBonus":1,"usesTimer":true,"allowsRisk":true,"blitzWordsCount":0,"supportsSharedAward":false,"cardType":"songs","durationBonus":30,"secretMethod":true,"usesModifiers":true,"interaction":"explain","enabled":true},
 {"id":"yesno","title":"ДАНЕТКИ","rule":"Загадывающий видит персонажа и отвечает на вопросы соперника только «да», «нет» или «не знаю». Отгадывающий должен назвать персонажа.","kind":"people","basePoints":2,"modifierBonus":1,"usesTimer":true,"allowsRisk":true,"blitzWordsCount":0,"supportsSharedAward":false,"cardType":"people","durationBonus":30,"secretMethod":true,"usesModifiers":true,"interaction":"explain","enabled":true},
 {"id":"secret","title":"СЕКРЕТКА","rule":"Случайное задание с обязательным усложнением.","kind":"words","basePoints":2,"modifierBonus":1,"usesTimer":true,"allowsRisk":true,"blitzWordsCount":0,"supportsSharedAward":false,"cardType":"words","durationBonus":0,"secretMethod":false,"usesModifiers":true,"interaction":"explain","enabled":true},
 {"id":"blitz","title":"БЛИЦ","rule":"Отгадай все 5 слов за отведённое время! За 5 из 5 получи 3 очка. За неполный результат — 0.","kind":"words","basePoints":2,"modifierBonus":1,"usesTimer":true,"allowsRisk":true,"blitzWordsCount":3,"supportsSharedAward":false,"cardType":"blitz","durationBonus":30,"secretMethod":false,"usesModifiers":true,"interaction":"explain","enabled":true},
 {"id":"approx","title":"ПРИМЕРНО","rule":"Назовите свои ответы, затем откройте правильный и решите, кому начислить очки.","kind":"number","cardType":"number","basePoints":1,"modifierBonus":0,"usesTimer":false,"allowsRisk":false,"blitzWordsCount":0,"supportsSharedAward":true,"durationBonus":0,"secretMethod":false,"usesModifiers":false,"interaction":"estimate","enabled":false}
].map(mode=>[mode.id,Object.freeze(mode)])));
const QUIP_MODE_CONFIGS=Object.freeze({1:QUIP_MODES_V4});
const QUIP_LEGACY_MODES=Object.freeze(Object.fromEntries(Object.values(QUIP_MODES_V4)
 .filter(mode=>mode.id!=='approx').map(mode=>[mode.id,Object.freeze({...mode,blitzWordsCount:mode.id==='blitz'?5:0})])));
function getModeConfig(id,version=QUIP_MODE_CONFIG_VERSION){
 const config=QUIP_MODE_CONFIGS[version]?.[id];
 if(!config)throw Error('Unknown QUIP mode/config version: '+id+'/'+version);
 return config;
}
function modeConfigForGame(match,id){
 const rules=ruleSetForGame(match);
 const config=rules.version<4?QUIP_LEGACY_MODES[id]:
  getModeConfig(id,match?.modeConfigVersion??rules.modeConfigVersion);
 if(!config)throw Error('Unsupported historical QUIP mode: '+id);
 return config;
}
function blitzRequiredForRound(match,round){
 return round?.blitzRequired??ruleSetForGame(match).blitzRequired;
}
