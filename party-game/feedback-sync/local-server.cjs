'use strict';
// Loopback-only acceptance fixture, NOT a cloud deployment or production ingress.
const http=require('node:http'),{DatabaseSync}=require('node:sqlite'),{createHash,timingSafeEqual}=require('node:crypto');
const P=require('./protocol.js');
class HttpError extends Error{constructor(status,message,retryAfter=0){super(message);this.status=status;this.retryAfter=retryAfter;}}
function createService({database=':memory:',ownerToken,origin='http://127.0.0.1:8765',now=Date.now,ratePerInstall=30,ratePerIP=60,maxVotes=10000,maxEvents=100000}={}){
 if(typeof ownerToken!=='string'||ownerToken.length<32)throw Error('A private owner token of at least 32 characters is required');
 if(new URL(origin).origin!==origin)throw Error('Invalid allowed origin');
 const db=new DatabaseSync(database),buckets=new Map();let globalWindow=-1,globalCount=0;
 db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS votes (install TEXT NOT NULL, item_key TEXT NOT NULL, revision INTEGER NOT NULL, hash TEXT NOT NULL, payload TEXT NOT NULL, rating TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(install,item_key)); CREATE TABLE IF NOT EXISTS events (install TEXT NOT NULL, revision INTEGER NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(install,revision));');
 const counts=()=>({votes:db.prepare('SELECT COUNT(*) AS n FROM votes').get().n,events:db.prepare('SELECT COUNT(*) AS n FROM events').get().n});
 function throttle(install,ip){
  const window=Math.floor(now()/60000);if(window!==globalWindow){buckets.clear();globalWindow=window;globalCount=0;}
  if(++globalCount>1000)throw new HttpError(429,'rate-limited',60);
  for(const [key,limit]of [['ip:'+ip,ratePerIP],['install:'+install,ratePerInstall]]){
   if(!buckets.has(key)&&buckets.size>=2000)throw new HttpError(429,'rate-limited',60);
   const n=(buckets.get(key)||0)+1;buckets.set(key,n);if(n>limit)throw new HttpError(429,'rate-limited',60);
  }
 }
 function accept(input,ip='loopback'){
  P.validateEvent(input);
  const vote={item:P.itemFromKey(P.itemKey(input.item)),rating:input.rating,reason:input.reason,comment:input.comment};
  const event=P.makeEvent(input.installId,input.revision,vote),payload=JSON.stringify(event),hash=createHash('sha256').update(payload).digest('hex'),key=P.itemKey(event.item);
  throttle(event.installId,ip);db.exec('BEGIN IMMEDIATE');
  try{
   const old=db.prepare('SELECT revision,hash FROM votes WHERE install=? AND item_key=?').get(event.installId,key);
   const prior=db.prepare('SELECT hash FROM events WHERE install=? AND revision=?').get(event.installId,event.revision);
   if(old&&old.revision>event.revision)throw new HttpError(409,'stale-revision');
   if(prior&&prior.hash!==hash||old&&old.revision===event.revision&&old.hash!==hash)throw new HttpError(409,'revision-conflict');
   let status='duplicate';
   if(!old||old.revision<event.revision){
    const c=counts();if(!old&&c.votes>=maxVotes||!prior&&c.events>=maxEvents)throw new HttpError(503,'capacity',3600);
    db.prepare('INSERT INTO events(install,revision,hash) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(event.installId,event.revision,hash);
    db.prepare('INSERT INTO votes(install,item_key,revision,hash,payload,rating,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(install,item_key) DO UPDATE SET revision=excluded.revision,hash=excluded.hash,payload=excluded.payload,rating=excluded.rating,updated_at=excluded.updated_at').run(event.installId,key,event.revision,hash,payload,event.rating,now());status='applied';
   }
   db.exec('COMMIT');return {version:1,installId:event.installId,revision:event.revision,eventId:event.eventId,status};
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 function ownerExport(){
  const aggregates=db.prepare("SELECT item_key,rating,COUNT(*) AS count FROM votes WHERE rating!='deleted' GROUP BY item_key,rating ORDER BY item_key,rating").all().map(({item_key,rating,count})=>({item:P.itemFromKey(item_key),rating,count}));
  const reports=db.prepare("SELECT payload FROM votes WHERE rating='report' ORDER BY updated_at DESC LIMIT 1000").all().map(({payload})=>{const e=JSON.parse(payload);return {item:e.item,reason:e.reason,comment:e.comment};});
  return {version:1,aggregates,reports,reportsLimit:1000};
 }
 function authenticated(header){const actual=Buffer.from(header||''),expected=Buffer.from('Bearer '+ownerToken);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
 async function handler(req,res){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  const reply=(status,data,extra={})=>{res.writeHead(status,{...headers,...extra});res.end(JSON.stringify(data));};
  try{
   if(req.url==='/owner/export'&&req.method==='GET'){
    if(req.headers.origin)throw new HttpError(403,'owner-browser-access-disabled');
    if(!authenticated(req.headers.authorization))throw new HttpError(401,'unauthorized');
    reply(200,ownerExport());return;
   }
   if(req.url!=='/v1/feedback')throw new HttpError(404,'not-found');
   if(req.headers.origin!==origin)throw new HttpError(403,'origin');headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Expose-Headers']='Retry-After';
   if(req.method==='OPTIONS'){
    if(req.headers['access-control-request-method']!=='POST'||(req.headers['access-control-request-headers']||'').toLowerCase().split(',').some(h=>h.trim()!=='content-type'))throw new HttpError(403,'preflight');
    reply(204,null,{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});return;
   }
   if(req.method!=='POST')throw new HttpError(405,'method');
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')||req.headers['content-encoding'])throw new HttpError(415,'content-type');
   if(req.headers.cookie||req.headers.authorization)throw new HttpError(400,'credentials-not-accepted');
   if(Number(req.headers['content-length']||0)>P.MAX_EVENT_BYTES)throw new HttpError(413,'body-too-large');
   let size=0;const chunks=[];
   for await(const chunk of req){size+=chunk.length;if(size>P.MAX_EVENT_BYTES)throw new HttpError(413,'body-too-large');chunks.push(chunk);}
   let event;try{event=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));P.validateEvent(event);}catch{throw new HttpError(400,'schema');}
   reply(200,accept(event,req.socket.remoteAddress));
  }catch(error){reply(error.status||500,{error:error.status?error.message:'unavailable'},error.retryAfter?{'Retry-After':String(error.retryAfter)}:{});}
 }
 return {accept,ownerExport,handler,counts,close:()=>db.close()};
}
function serve(options={}){
 const service=createService(options),server=http.createServer(service.handler);server.requestTimeout=10000;server.headersTimeout=5000;
 server.listen(options.port??8787,'127.0.0.1');server.on('close',service.close);return server;
}
if(require.main===module){
 const server=serve({database:process.env.KVIP_FEEDBACK_DB||'/tmp/kvip-feedback-023a.sqlite',ownerToken:process.env.KVIP_OWNER_TOKEN,origin:process.env.KVIP_TEST_ORIGIN||'http://127.0.0.1:8765'});
 server.on('listening',()=>console.log('TASK023A local fixture on http://127.0.0.1:'+server.address().port+' (no cloud deployment)'));
}
module.exports={createService,serve,HttpError};
