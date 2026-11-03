'use strict';
// Explicit, individual editorial decisions. No guessing of tiers or categories.
const fs=require('node:fs'),path=require('node:path'),E=require('./editor.cjs');
const COLUMNS=Object.freeze(['id','text','form','categories','themes','ambiguities','talk','mime','draw','sing','yesno','blitz','approx','rationale']);
function sourcesDigest(ids,c){return E.hash(ids.map(id=>{const s=c.sources.get(id);if(!s)throw Error('Unknown review ID '+id);return {id,fingerprint:s.fingerprint};}));}
function parse(table,c=E.context()){
 const lines=table.trimEnd().split(/\r?\n/);if(!lines[0].startsWith('# '))throw Error('Missing review header');const meta=JSON.parse(lines.shift().slice(2));
 if(Object.keys(meta).sort().join(',')!=='edition,rubric,schemaVersion,sourcesDigest'||meta.schemaVersion!==1||meta.edition!==c.spec.id+'@'+c.spec.version||meta.rubric!=='quip-rubric@1')throw Error('Unsupported review table');
 if(lines.shift()!==COLUMNS.join('|'))throw Error('Explicit mode columns are required');
 const rows=lines.map((line,i)=>{const cells=line.split('|');if(cells.length!==COLUMNS.length)throw Error('Wrong column count at '+(i+3));return Object.fromEntries(COLUMNS.map((k,n)=>[k,cells[n]]));});
 if(!rows.length||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Empty or duplicate review IDs');
 if(meta.sourcesDigest!==sourcesDigest(rows.map(r=>r.id),c))throw Error('Review table source changed');
 return rows.map(r=>{
  const source=c.sources.get(r.id);if(!c.idSet.has(r.id)||(source.row.text||source.row.question)!==r.text)throw Error('Review label/ID mismatch '+r.id);
  const modes=Object.fromEntries(E.MODES.map(mode=>{
   if(mode==='secret')return [mode,{policy:'actual-method'}];
   const parts=r[mode].split(':');if(parts.length!==2||!E.REASONS.includes(parts[1]))throw Error('Explicit mode reason required '+r.id+'/'+mode);
   const eligible=parts[0]!=='-';if(eligible&&!E.LEVELS.includes(parts[0]))throw Error('Invalid tier '+r.id+'/'+mode);
   return [mode,{eligible,difficulty:eligible?parts[0]:null,reason:parts[1]}];
  }));
  const classification={form:r.form,categories:r.categories.split('+'),themes:r.themes?r.themes.split('+'):[],ambiguities:r.ambiguities?r.ambiguities.split('~'):[],modes};
  E.validateClassification(classification,source.row,c);
  return {id:r.id,fingerprint:source.fingerprint,classification,rationale:r.rationale};
 });
}
function run(argv=process.argv.slice(2)){
 if(argv.length!==2)throw Error('Use: node review-table.cjs table.psv reviewer');
 const c=E.context(),decisions=parse(fs.readFileSync(path.resolve(argv[0]),'utf8'),c),next=E.apply(E.readEdition(c),decisions,{reviewer:argv[1]},c);
 // The main writer performs another full validation and a single file rename.
 E.writeDraft(next,c);console.log(JSON.stringify(E.validate(next,c)));
}
module.exports={COLUMNS,sourcesDigest,parse};
if(require.main===module)try{run()}catch(e){console.error(e.message);process.exitCode=1;}
