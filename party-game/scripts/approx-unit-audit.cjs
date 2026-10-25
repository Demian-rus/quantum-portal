'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function auditApproxUnits(){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'content/manifest.json'),'utf8'));
 const files=[],units={},empty=[],manualCandidates=[],ids=new Set();
 for(const source of manifest.questions){
  const rows=JSON.parse(fs.readFileSync(path.join(root,'content',source.path),'utf8'));files.push({path:source.path,questions:rows.length});
  for(const q of rows){
   assert.ok(!ids.has(q.id),'Duplicate question '+q.id);ids.add(q.id);
   const unit=typeof q.unit==='string'?q.unit.trim():'';units[unit]=(units[unit]||0)+1;
   const row={id:q.id,file:source.path,question:q.question,unit:q.unit??null};
   if(!unit)empty.push(row);
   else{
    const reasons=[];
    if(/^(?:тыс\.|млн|млрд|трлн)\s/u.test(unit))reasons.push('scaled-unit: review explicit scale in the question; not an established defect');
    if(['тс','Тл','моль⁻¹','гПа','Па','Гц'].includes(unit))reasons.push('specialized-abbreviation: consider an explanatory display label in a future editorial revision');
    if(reasons.length)manualCandidates.push({...row,reasons});
   }
  }
 }
 return {version:1,total:ids.size,withUnit:ids.size-empty.length,files,unitCounts:Object.fromEntries(Object.entries(units).sort(([a],[b])=>a.localeCompare(b,'ru'))),empty,manualCandidates};
}
if(require.main===module){
 const result=auditApproxUnits(),text=JSON.stringify(result,null,2)+'\n';
 if(process.argv[2]==='check'){
  assert.equal(fs.readFileSync(path.join(root,'APPROX-UNIT-AUDIT.json'),'utf8'),text,'Regenerate and semantically review the audit after any source change');
  console.log(JSON.stringify({ok:true,total:result.total,withUnit:result.withUnit,empty:result.empty.length,manualCandidates:result.manualCandidates.length}));
 }else process.stdout.write(text);
}
module.exports={auditApproxUnits};
