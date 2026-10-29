'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {fromPublicPacks}=require('../contracts/catalog.cjs');
const ROOT=path.resolve(__dirname,'../..');
function git(args){return execFileSync('git',args,{cwd:ROOT,maxBuffer:32*1024*1024});}
function verifyResourceClosure(sha,allowed){
 const html=git(['show',sha+':party-game/index.html']).toString(),sw=git(['show',sha+':party-game/sw.js']).toString(),core=sw.slice(sw.indexOf('const CORE='),sw.indexOf("self.addEventListener('install'"));
 // Evaluate only the reviewed build-time CORE declaration (including its mode
 // map), not worker lifecycle handlers. This is not an untrusted-code sandbox.
 const resources=vm.runInNewContext(core+';CORE',Object.create(null),{timeout:100});if(!Array.isArray(resources)||resources.some(x=>typeof x!=='string'||!x.startsWith('./')))throw Error('Unsupported precache declaration');
 const cached=new Set(resources);
 function required(ref,file,precache=false){if(!ref.startsWith('./')&&!ref.startsWith('../'))return;const u=new URL(ref,'https://build.invalid/party-game/'+file),p=decodeURIComponent(u.pathname).replace(/^\/party-game\//,'');if(!u.pathname.startsWith('/party-game/')||!allowed.has(p))throw Error('Unreviewed public resource: '+ref);if(precache&&!cached.has('./'+p+u.search))throw Error('Missing offline resource: '+ref);}
 for(const ref of resources)if(ref!=='./')required(ref,'index.html');
 for(const m of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))required(m[1],'index.html',/\.(?:css|js)(?:\?|$)/.test(m[1]));
 for(const file of allowed)if(file.endsWith('.css'))for(const m of git(['show',sha+':party-game/'+file]).toString().matchAll(/url\(['"]?(\.\.?\/[^'"\s)]+)['"]?\)/g))required(m[1],file);
}
function build({sha,out,variant='public-web'}){
 if(!/^[a-f0-9]{40}$/.test(sha)||git(['rev-parse',sha+'^{commit}']).toString().trim()!==sha)throw Error('Exact commit SHA required');
 if(!['public-web','debug-preview','future-android-wrapper','future-ios-wrapper'].includes(variant))throw Error('Unknown build target');
 const output=path.resolve(out);if(output===ROOT||output.startsWith(ROOT+path.sep)||output===path.parse(output).root)throw Error('Use an isolated output outside the repository');
 if(fs.existsSync(output))throw Error('Output must not exist; do not overwrite a reviewed build');fs.mkdirSync(output,{recursive:true});
 // Read the reviewed allowlist from the SAME commit, never a dirty worktree.
 const allow=JSON.parse(git(['show',sha+':commercial/build/public-files.json']));
 if(allow.schemaVersion!==1||!Array.isArray(allow.files)||new Set(allow.files).size!==allow.files.length||!allow.files.length)throw Error('Unsupported public allowlist');
 verifyResourceClosure(sha,new Set(allow.files));
 const files=[];for(const file of allow.files){
  if(!/^[a-zA-Z0-9_./-]+$/.test(file)||file.split('/').includes('..')||file.startsWith('/')||/(?:^|\/)(commercial|debug|private|premium|content|tests|scripts)(?:\/|$)/i.test(file))throw Error('Non-public resource in allowlist');
  const bytes=git(['show',sha+':party-game/'+file]);const target=path.join(output,'party-game',file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);files.push({path:'party-game/'+file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
 }
 // Contract metadata contains no paid payload. Existing free runtime files are
 // copied byte-for-byte and do not load this metadata or any access module.
 const manifest=JSON.parse(git(['show',sha+':party-game/content/manifest.json']));
 const packs=manifest.packs.map(p=>{if(!p.path||p.path.split('/').includes('..'))throw Error('Invalid public source');return JSON.parse(git(['show',sha+':party-game/content/'+p.path]));});
 const flat=packs.flatMap(p=>Array.isArray(p)?p:p.packs||[p]);
 const catalog=fromPublicPacks(flat);
 fs.writeFileSync(path.join(output,'public-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 if(variant==='debug-preview')fs.writeFileSync(path.join(output,'DEBUG-ONLY.txt'),'Synthetic preview is a separate loopback Node process: node commercial/debug/preview.cjs. No real paid material or production grant.\n');
 const result={schemaVersion:1,sha,variant,files,catalogEntries:catalog.packs.length,deployEnabled:false,apkProduced:false,ipaProduced:false};
 fs.writeFileSync(path.join(output,'build-manifest.json'),JSON.stringify(result,null,2)+'\n');return result;
}
if(require.main===module){const args=process.argv.slice(2),get=k=>args[args.indexOf(k)+1];console.log(JSON.stringify(build({sha:get('--sha'),out:get('--out'),variant:args.includes('--variant')?get('--variant'):'public-web'})));}
module.exports={build};
