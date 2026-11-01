'use strict';
const {normalizeTask039}=require('../../diagnostics/task039/source-contract.cjs');
// The only TASK019 change to selection is this explicit policy dispatch.
// Keep byte guards over EVERY other byte of the historical selector.
function withoutRiskDispatch(source){
 source=normalizeTask039(source);
 const hook='risk:selectRoundRisk(game,mode.id),';
 if(!source.includes(hook))throw Error('Missing explicit TASK019 risk dispatch');
 return source.replace(hook,'risk:config.allowsRisk&&game.riskRounds&&game.roundIndex>=ruleSetForGame(game).risk.firstRoundIndex&&\n      shouldSelectRisk(game,Math.random(),mode.id),');
}
module.exports={withoutRiskDispatch};
