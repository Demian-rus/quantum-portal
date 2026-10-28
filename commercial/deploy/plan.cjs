'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {build}=require('../build/build.cjs');
function plan({sha,out,dryRun}){
 if(dryRun!==true)throw Error('REAL_DEPLOY_DISABLED: only --dry-run is implemented');
 const result=build({sha,out,variant:'public-web'}),root=path.resolve(out);
 const catalog=fs.readFileSync(path.join(root,'public-catalog.json'));
 const buildManifest=fs.readFileSync(path.join(root,'build-manifest.json'));
 const output={schemaVersion:1,sha,mode:'dry-run',networkOperations:[],cloudResources:[],paymentsEnabled:false,releaseEnabled:false,requiredBeforeRelease:['independent review','green checks for this exact SHA','configured protected release environment','separate explicit owner approval'],files:[...result.files,...[['public-catalog.json',catalog],['build-manifest.json',buildManifest]].map(([p,b])=>({path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}))]};
 fs.writeFileSync(path.join(root,'deployment-plan.json'),JSON.stringify(output,null,2)+'\n');return output;
}
if(require.main===module){const a=process.argv.slice(2),get=k=>a[a.indexOf(k)+1];if(a.some(x=>['--execute','--host','--upload','--release'].includes(x)))throw Error('REAL_DEPLOY_DISABLED');console.log(JSON.stringify(plan({sha:get('--sha'),out:get('--out'),dryRun:a.includes('--dry-run')})));}
module.exports={plan};
