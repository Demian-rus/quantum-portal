'use strict';
const E=require('./editor.cjs'),S=require('./selector.js');
function compile(edition,c=E.context()){
 E.validate(edition,c,{release:true});
 const categories=[...c.categories],themes=[...c.themes],mask=(values,names)=>values.reduce((n,v)=>n|2**names.indexOf(v),0);
 const catalogs=Object.fromEntries(c.catalogs.map(({id,ids,pack})=>[id,{ids:ids.slice(),minimum:pack.minCardsPerPool,allowedModes:pack.allowedModes?.slice()||S.MODES.slice()}]));
 const records=Object.fromEntries(edition.records.map(r=>{
  const cl=r.classification;
  const levels=S.STORED_MODES.map(mode=>cl.modes[mode].eligible?String(S.TIERS.indexOf(cl.modes[mode].difficulty)+1):'0').join('');
  const language=cl.form==='song'?c.songLanguages.get(r.id):'';
  if(cl.form==='song'&&!['ru','en'].includes(language))throw Error('Missing reviewed song language '+r.id);
  return [r.id,[S.FORMS.indexOf(cl.form),mask(cl.categories,categories),mask(cl.themes,themes),levels,language]];
 }));
 const compiled={schemaVersion:1,id:edition.id,version:edition.version,rubric:edition.rubric,digest:E.hash(edition),categories,themes,catalogs,records};
 S.createIndex(compiled,c.ids.map(id=>c.sources.get(id).row));return compiled;
}
module.exports={compile};
if(require.main===module)try{process.stdout.write(JSON.stringify(compile(E.readEdition()))+'\n')}catch(e){console.error(e.message);process.exitCode=1;}
