'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),{createSimulation}=require('../scripts/game-simulation.cjs');
test('TASK042A versioned idiom correction applies only to new selection; old RAW and RNG remain exact',()=>{
 const h=createSimulation(42);h.eval("options.modes=['talk'];options.complications=false;writeTaskDifficultyPreference('talk','medium');newGame();var selected042=game.contentPack;var fresh042=editorialPool(game,'talk','medium').find(c=>c.id==='idiom-000083');var historical042={...selected042};delete historical042.promptRevisionVersion;var old042=editorialPoolFor(historical042,game,'talk','medium').find(c=>c.id==='idiom-000083')");
 assert.equal(h.eval('selected042.promptRevisionVersion'),1);assert.equal(h.eval('fresh042.text'),'НАШЛА КОСА НА КАМЕНЬ');assert.equal(h.eval('old042'),undefined);assert.equal(h.eval("PARTY_CARDS.find(c=>c.id==='idiom-000083').text"),'НАЙТИ КОСА НА КАМЕНЬ');
 h.eval('game.dice=false;roll();toggleWord();startTimer();pauseTimer();persist()');const raw=h.storage.get('iskra-party:v1'),restored=createSimulation(43,new Map(h.storage));assert.equal(restored.eval('storageBlocked'),false);assert.equal(restored.storage.get('iskra-party:v1'),raw);
 h.eval('game.contentPack.promptRevisionVersion=99');assert.throws(()=>h.eval('validateEditorialGame(game)'));
});
test('TASK042A exact resource hunks reject changes to the new resource and preserve historical source guards',()=>{
 const {normalizeTask042,hunks}=require('../../diagnostics/task042/source-contract.cjs');
 for(const file of new Set(hunks.map(h=>h.file))){const source=require('../../diagnostics/task042/source-contract-b.cjs').normalizeTask042B(fs.readFileSync('party-game/'+file,'utf8')),before=cp.execFileSync('git',['show','86d5c216ba8a0650ed28cffa79112d3726c76f26:party-game/'+file],{encoding:'utf8'});assert.equal(normalizeTask042(source),before,file);for(const h of hunks.filter(h=>h.file===file)){assert(source.includes(h.after));const mutation=source.replace(h.after,h.after+'/* forbidden */');assert.notEqual(mutation,source);assert.notEqual(normalizeTask042(mutation),before);}}
});
