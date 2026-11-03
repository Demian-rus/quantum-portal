'use strict';
// No token is stored by this client. Authentication is an HttpOnly server session.
const QuipDictionarySync=(()=>{
 const STATES=Object.freeze({queued:'Ожидает отправки',submitted:'Отправлено',review:'На проверке',accepted:'Принято',error:'Ошибка'});
 function create(store,{endpoint=null,fetcher=(...args)=>fetch(...args),online=()=>navigator.onLine,now=()=>Date.now(),changed=()=>{}}={}){
  let running=null,csrf=null;
  if(endpoint!==null){const u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('Нужен защищённый адрес сервера словаря');endpoint=u.href.replace(/\/$/,'');}
  const configured=()=>!!endpoint;
  async function request(path,{body,method='GET'}={}){
   const response=await fetcher(endpoint+path,{method,credentials:'include',cache:'no-store',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf||'','Idempotency-Key':body.key}:{})},...(body?{body:JSON.stringify(body)}:{})});
   if(!response.ok){const e=Error(response.status===401?'Войдите через GitHub на защищённом сервере':response.status===403?'Сервер не подтвердил права владельца':'Сервер вернул ошибку '+response.status);e.auth=[401,403].includes(response.status);throw e;}const data=await response.json();if(!data||data.version!==1)throw Error('Неизвестная версия ответа API');return data;
  }
  async function session(){if(!endpoint)throw Error('Сервер синхронизации не подключён');const data=await request('/session');if(data.owner!==true||typeof data.csrf!=='string'||data.csrf.length<16)throw Error('Сервер не подтвердил владельца');csrf=data.csrf;return data;}
  function receipt(data,key){
   if(data.key!==key||!['submitted','review','accepted'].includes(data.state)||typeof data.submissionId!=='string'||data.submissionId.length>150||!/^https:\/\/github.com\/Demian-rus\/quantum-portal\/pull\/\d+$/.test(data.url))throw Error('Неверная квитанция сервера; успех не подтверждён');
   return {state:data.state,remote:{submissionId:data.submissionId,url:data.url},error:'',nextAttemptAt:0};
  }
  function update(key,patch){store.write(d=>{d.queue=d.queue.map(q=>q.key===key?{...q,...patch}:q);return d;});changed();}
  async function drain(force=false){
   if(running)return running;
   if(!configured())return {sent:0,reason:'Сервер синхронизации не подключён. Задания остаются в очереди на устройстве.'};
   if(!online())return {sent:0,reason:'Нет интернета. Очередь сохранена.'};
   running=(async()=>{await session();let sent=0;
    for(const q of store.read().queue){
     if(q.state==='accepted'||q.state==='error'&&!force&&q.nextAttemptAt>now())continue;
     try{
      const data=q.remote?await request('/submissions/'+encodeURIComponent(q.remote.submissionId)):await request('/submissions',{method:'POST',body:{version:1,key:q.key,card:q.card,classification:QuipDeviceDictionary.classification(q.card)}});
      update(q.key,{...receipt(data,q.key),attempts:q.attempts+1});sent++;
     }catch(e){update(q.key,{state:'error',attempts:q.attempts+1,error:String(e.message).slice(0,500),nextAttemptAt:now()+Math.min(3600000,1000*2**Math.min(q.attempts+1,12))});if(e.auth)throw e;}
    }return {sent,reason:'Ответы сервера проверены. Непринятые задания остаются на редакторской проверке.'};
   })();try{return await running;}finally{running=null;}
  }
  return Object.freeze({configured,session,drain,loginURL:()=>endpoint?endpoint+'/auth/github/start':null,states:STATES});
 }
 return Object.freeze({create,STATES});
})();
if(typeof module==='object'&&module.exports)module.exports=QuipDictionarySync;
