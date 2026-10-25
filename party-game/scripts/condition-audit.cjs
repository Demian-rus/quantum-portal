'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function auditConditions(){
 const context=vm.createContext({showTask(){},showJudge(){}});
 for(const name of ['modifiers.js','modifiers-v2.js','round-presentation.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context);
 return JSON.parse(JSON.stringify(vm.runInContext(`({
  rows:[...QUIP_MODIFIERS.map(r=>({version:1,id:r.id,source:r.text,display:displayedRoundCondition({modifierVersion:1,complicationId:r.id,complication:r.text})})),
   ...QUIP_MODIFIERS_V2.map(r=>({version:2,id:r.id,source:r.text,display:displayedRoundCondition({modifierVersion:2,complicationId:r.id,complication:r.text})}))]
 })`,context)));
}
module.exports={auditConditions};
if(require.main===module){
 const text=JSON.stringify(auditConditions(),null,2)+'\n',file=path.join(root,'CONDITION-AUDIT.json');
 if(process.argv[2]==='write')fs.writeFileSync(file,text);
 else if(process.argv[2]==='check'){if(fs.readFileSync(file,'utf8')!==text)throw Error('Condition audit is stale');console.log('Full V1/V2 condition audit PASS');}
 else throw Error('Usage: condition-audit.cjs write|check');
}
