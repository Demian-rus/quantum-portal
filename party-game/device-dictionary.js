'use strict';
// Device authoring contract quip-device@1; no game globals or network authority.
const QuipDeviceDictionary=(()=>{
 const KEY='kvip:device-dictionary:v1',FORMS=['word','phrase','idiom','person','song','number'],MODES=['talk','mime','draw','sing','yesno','blitz','approx'],TIERS=['easy','medium','hard'],MAX=500,MAX_BYTES=2000000;
 const copy=v=>JSON.parse(JSON.stringify(v));
 function fail(message){throw Error('Словарь: '+message);}
 function plain(v,depth=0){if(depth>25)fail('слишком глубокая структура');if(v===null||['string','boolean'].includes(typeof v))return;if(typeof v==='number'&&Number.isFinite(v))return;if(!v||typeof v!=='object'||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(v)))fail('ожидались данные JSON');for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))fail('небезопасное поле');plain(x,depth+1);}}
 function exact(v,fields){if(!v||Array.isArray(v)||Object.keys(v).sort().join('|')!==fields.slice().sort().join('|'))fail('неизвестные или неполные поля');}
 function text(v,label,max=240,{empty=false}={}){if(typeof v!=='string'||v.length>max||(!empty&&!v.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v))fail('проверьте '+label);return v.trim().replace(/\s+/gu,' ');}
 function normalize(s){return String(s).normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
 function canonical(v){plain(v);return JSON.stringify(v,(_,x)=>x&&!Array.isArray(x)&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);}
 // Synchronous SHA-256 lets START pin/verify without crossing an asynchronous turn.
 function hash(value){
  const bytes=unescape(encodeURIComponent(typeof value==='string'?value:canonical(value))),words=[],K=[],H=[];let prime=2;
  while(K.length<64){let is=true;for(let d=2;d*d<=prime;d++)if(prime%d===0){is=false;break;}if(is){if(H.length<8)H.push((Math.sqrt(prime)%1*4294967296)|0);K.push((Math.cbrt(prime)%1*4294967296)|0);}prime++;}
  for(let i=0;i<bytes.length;i++)words[i>>2]=(words[i>>2]||0)|bytes.charCodeAt(i)<<(24-i%4*8);
  words[bytes.length>>2]=(words[bytes.length>>2]||0)|0x80<<(24-bytes.length%4*8);words[(((bytes.length+8)>>6)+1)*16-1]=bytes.length*8;
  const R=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let offset=0;offset<words.length;offset+=16){const W=words.slice(offset,offset+16).map(x=>x|0);for(let t=0;t<16;t++)W[t]|=0;let [a,b,c,d,e,f,g,h]=H;
   for(let t=0;t<64;t++){if(t>=16){const x=W[t-15],y=W[t-2];W[t]=((R(x,7)^R(x,18)^(x>>>3))+W[t-16]+(R(y,17)^R(y,19)^(y>>>10))+W[t-7])|0;}const T1=(h+(R(e,6)^R(e,11)^R(e,25))+((e&f)^(~e&g))+K[t]+W[t])|0,T2=((R(a,2)^R(a,13)^R(a,22))+((a&b)^(a&c)^(b&c)))|0;[a,b,c,d,e,f,g,h]=[(T1+T2)|0,a,b,c,(d+T1)|0,e,f,g];}
   [a,b,c,d,e,f,g,h].forEach((v,i)=>H[i]=(H[i]+v)|0);
  }return H.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
 }
 function allowed(form,mode,label){if(mode==='sing')return form==='song';if(mode==='yesno')return form==='person';if(mode==='approx')return form==='number';if(mode==='blitz')return form==='word'&&!/\s/u.test(label);return ['word','phrase','idiom'].includes(form);}
 function classification(card){return {form:card.type,categories:card.categories.slice(),themes:card.themes.slice(),ambiguities:[],modes:Object.fromEntries([...MODES.map(m=>[m,{eligible:card.modes[m]!==null,difficulty:card.modes[m],reason:card.modes[m]!==null?(m==='approx'?'estimation':m==='sing'?'repertoire':m==='yesno'?'recognisable-person':'familiar'):'type'}]),['secret',{policy:'actual-method'}]])};}
 function card(value,env){
  plain(value);exact(value,['id','version','text','type','categories','themes','modes','comment','language','number']);const c=copy(value);
  if(!/^user-[a-f0-9-]{16,64}$/.test(c.id)||!Number.isSafeInteger(c.version)||c.version<1||!FORMS.includes(c.type))fail('неверный ID, версия или тип');
  c.text=text(c.text,'текст');if(!normalize(c.text))fail('нужны буквы или цифры');if(c.type==='word'&&/\s/u.test(c.text))fail('для нескольких слов выберите «Словосочетание»');
  for(const [name,known]of [['categories',env.categories],['themes',env.themes]])if(!Array.isArray(c[name])||c[name].length>(name==='categories'?30:10)||(!c[name].length&&name==='categories')||new Set(c[name]).size!==c[name].length||c[name].some(x=>!known.includes(x)))fail('неверные '+name);
  exact(c.modes,MODES);for(const m of MODES)if(c.modes[m]!==null&&(!TIERS.includes(c.modes[m])||!allowed(c.type,m,c.text)))fail('тип задания не подходит для режима '+m);
  if(!Object.values(c.modes).some(Boolean))fail('выберите сложность хотя бы одного режима');
  c.comment=text(c.comment,'комментарий',600,{empty:true});if(c.type==='song'?!['ru','en'].includes(c.language):c.language!=='')fail('проверьте язык песни');
  if(c.type==='number'){
   exact(c.number,['answer','unit','source','checks']);c.number.answer=text(c.number.answer,'ответ',50);if(!/^-?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(c.number.answer)||!Number.isFinite(Number(c.number.answer.replace(',','.'))))fail('ответ должен быть конечным числом');
   c.number.unit=text(c.number.unit,'единицы измерения',80);c.number.source=text(c.number.source,'источник',500);if(!/^https:\/\/[^\s<>]+$/i.test(c.number.source))fail('нужна HTTPS-ссылка на источник');c.number.checks=text(c.number.checks,'проверку ответа',600);if(c.number.checks.length<12)fail('опишите проверку ответа (не менее 12 символов)');
  }else if(c.number!==null)fail('числовые поля относятся только к вопросам');return c;
 }
 function fresh(){return {version:1,revision:0,enabled:false,cards:[],drafts:[],queue:[]};}
 function validate(value,env){
  plain(value);exact(value,['version','revision','enabled','cards','drafts','queue']);if(value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.enabled!=='boolean')fail('неизвестная версия; данные сохранены без изменений');
  if(!Array.isArray(value.cards)||value.cards.length>MAX||!Array.isArray(value.drafts)||value.drafts.length>MAX||!Array.isArray(value.queue)||value.queue.length>MAX*4)fail('слишком много записей');
  const ids=new Set(),names=new Set();for(const c of value.cards){card(c,env);const n=normalize(c.text);if(ids.has(c.id)||names.has(n))fail('повтор задания');ids.add(c.id);names.add(n);}
  for(const d of value.drafts){exact(d,['id','editingId','input']);if(!/^draft-[a-f0-9-]{16,64}$/.test(d.id)||ids.has(d.id)||canonical(d).length>8000||d.editingId!==null&&!/^user-[a-f0-9-]{16,64}$/.test(d.editingId))fail('неверный черновик');const x=d.input;exact(x,['text','type','categories','themes','modes','comment','language','number']);text(x.text,'черновик',240,{empty:true});if(!FORMS.includes(x.type))fail('тип черновика');for(const [k,known]of [['categories',env.categories],['themes',env.themes]])if(!Array.isArray(x[k])||new Set(x[k]).size!==x[k].length||x[k].some(t=>!known.includes(t)))fail('список черновика');exact(x.modes,MODES);if(Object.values(x.modes).some(v=>v!==null&&!TIERS.includes(v)))fail('сложность черновика');text(x.comment,'комментарий',600,{empty:true});if(!['','ru','en'].includes(x.language))fail('язык черновика');if(x.number!==null){exact(x.number,['answer','unit','source','checks']);for(const v of Object.values(x.number))text(v,'числовой черновик',600,{empty:true});}ids.add(d.id);}
  const keys=new Set();for(const q of value.queue){exact(q,['key','card','state','attempts','nextAttemptAt','error','remote']);card(q.card,env);if(q.key!==hash(q.card)||keys.has(q.key)||!['queued','submitted','review','accepted','error'].includes(q.state)||!Number.isSafeInteger(q.attempts)||q.attempts<0||!Number.isFinite(q.nextAttemptAt)||typeof q.error!=='string'||q.error.length>500)fail('повреждена очередь');keys.add(q.key);if(q.remote!==null){exact(q.remote,['submissionId','url']);if(typeof q.remote.submissionId!=='string'||q.remote.submissionId.length>150||!/^https:\/\/github.com\/[^\s]+$/.test(q.remote.url))fail('неверная квитанция');}}
  if(JSON.stringify(value).length>MAX_BYTES)fail('превышен размер словаря');return value;
 }
 function snapshot(cards,revision,env){cards.forEach(c=>card(c,env));const payload={version:1,revision,cards:copy(cards)};return {...payload,digest:hash(payload)};}
 function validateSnapshot(s,env){plain(s);exact(s,['version','revision','cards','digest']);validate({...fresh(),version:s.version,revision:s.revision,cards:s.cards},env);const {digest,...payload}=s;if(digest!==hash(payload))fail('снимок партии повреждён');return s;}
 function row(c){const base={id:c.type==='number'?'approx-'+c.id:c.id,type:c.type,difficulty:Object.values(c.modes).find(Boolean),categories:c.categories.slice(),pack:'device-v1',meta:{deviceCardId:c.id}};return c.type==='number'?{...base,question:c.text,answer:c.number.answer,unit:c.number.unit,source:c.number.source,note:c.number.checks}:{...base,text:c.text,...(c.type==='song'?{meta:{...base.meta,language:c.language}}:{})};}
 function createStore(storage,env,{uuid=()=>globalThis.crypto.randomUUID()}={}){
  let cache=null;
  function read(){const raw=storage.getItem(KEY);if(cache?.raw===raw)return copy(cache.data);let data;try{data=raw===null?fresh():validate(JSON.parse(raw),env);}catch(e){fail('данные повреждены или созданы другой версией. Экспортируйте исходный JSON. '+e.message);}cache={raw,data};return copy(data);}
  function write(fn){const before=storage.getItem(KEY),next=fn(read());next.revision++;validate(next,env);const raw=JSON.stringify(next);if(storage.getItem(KEY)!==before)fail('изменения в другой вкладке; повторите действие');try{storage.setItem(KEY,raw);if(storage.getItem(KEY)!==raw)throw Error('readback');}catch(e){try{if(storage.getItem(KEY)!==before){if(before===null)storage.removeItem(KEY);else storage.setItem(KEY,before);}}catch{}fail('не удалось сохранить. Предыдущие данные защищены; освободите память и перезапустите приложение.');}cache=null;return read();}
  function duplicate(c,data){const n=normalize(c.text);if(data.cards.some(x=>x.id!==c.id&&normalize(x.text)===n)||(env.builtins||[]).some(x=>normalize(x.text||x.question)===n))fail('такое задание уже есть (учтены регистр, пробелы и Ё/Е)');}
  function enqueue(data,c){const key=hash(c);if(!data.queue.some(q=>q.key===key))data.queue.push({key,card:copy(c),state:'queued',attempts:0,nextAttemptAt:0,error:'',remote:null});}
  function save(input,id=null,{draftId=null}={}){let saved;write(data=>{const old=id?data.cards.find(c=>c.id===id):null;if(id&&!old)fail('задание изменилось или удалено');saved=card({...input,id:old?.id||'user-'+uuid(),version:(old?.version||0)+1},env);duplicate(saved,data);data.cards=old?data.cards.map(c=>c.id===id?saved:c):[...data.cards,saved];data.queue=data.queue.filter(q=>q.card.id!==saved.id||q.remote!==null);enqueue(data,saved);if(draftId)data.drafts=data.drafts.filter(d=>d.id!==draftId);return data;});return saved;}
  function remove(id){return write(data=>{data.cards=data.cards.filter(c=>c.id!==id);data.queue=data.queue.filter(q=>q.card.id!==id);return data;});}
  function saveDraft(input,id=null,editingId=null){let result;write(data=>{result={id:id||'draft-'+uuid(),editingId,input:copy(input)};data.drafts=[...data.drafts.filter(d=>d.id!==result.id),result];return data;});return result;}
  function removeDraft(id){return write(data=>({...data,drafts:data.drafts.filter(d=>d.id!==id)}));}
  function exportJSON(){return JSON.stringify({kind:'quip-device-dictionary',version:1,data:read()},null,2);}
  function importJSON(raw){if(typeof raw!=='string'||raw.length>MAX_BYTES)fail('слишком большой файл');let doc;try{doc=JSON.parse(raw);}catch{fail('файл не является JSON');}plain(doc);exact(doc,['kind','version','data']);if(doc.kind!=='quip-device-dictionary'||doc.version!==1)fail('неизвестный формат импорта');validate(doc.data,env);
   return write(data=>{for(const c of doc.data.cards){const old=data.cards.find(x=>x.id===c.id);if(old){if(canonical(old)!==canonical(c))fail('конфликт ID; экспортируйте текущий словарь и измените задание вручную');continue;}duplicate(c,data);data.cards.push(copy(c));enqueue(data,c);}for(const d of doc.data.drafts){const old=data.drafts.find(x=>x.id===d.id);if(old&&canonical(old)!==canonical(d))fail('конфликт черновика');if(!old)data.drafts.push(copy(d));}return data;});
  }
  return Object.freeze({read,write,save,remove,saveDraft,removeDraft,exportJSON,importJSON,setEnabled:enabled=>write(d=>({...d,enabled:!!enabled})),pin(){const d=read();return snapshot(d.enabled?d.cards:[],d.revision,env);},original:()=>storage.getItem(KEY)});
 }
 return Object.freeze({KEY,FORMS,MODES,TIERS,MAX_BYTES,normalize,canonical,hash,allowed,classification,card,fresh,validate,snapshot,validateSnapshot,row,createStore});
})();
if(typeof module==='object'&&module.exports)module.exports=QuipDeviceDictionary;
