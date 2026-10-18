'use strict';
(() => {
  const core=window.R6RoomCore;
  const $=id=>document.getElementById(id);
  const dialog=document.createElement('dialog');dialog.id='teamRoomDialog';
  dialog.innerHTML=`<button class="dialog-close" id="roomClose" aria-label="Close">×</button><div class="eyebrow">R6- FLAMINGO/STRAT · 5</div><h2 data-room-text="roomTitle"></h2><p data-room-text="roomIntro"></p><label class="field-label" for="roomName" data-room-text="roomName"></label><input id="roomName" class="text-field" maxlength="30" autocomplete="nickname"><div id="roomSetup"><button id="roomCreate" class="primary" data-room-text="roomCreate"></button><label class="field-label" for="roomInvite" data-room-text="roomInvite"></label><input id="roomInvite" class="text-field" type="text" autocomplete="off" spellcheck="false"><button id="roomJoin" class="secondary" data-room-text="roomJoin"></button></div><button id="roomRecovery" class="secondary" data-room-text="roomRecovery" hidden></button><p id="roomStatus" role="status" aria-live="polite"></p><section id="roomLive" hidden><label class="field-label" for="roomLink" data-room-text="roomLink"></label><input id="roomLink" class="text-field" readonly><button id="roomCopy" class="secondary" data-room-text="roomCopy"></button><ul id="roomMembers"></ul><button id="roomDownload" class="secondary" data-room-text="roomDownload"></button><button id="roomLeave" class="secondary" data-room-text="roomLeave"></button></section><p class="credit" data-room-text="roomLimit"></p>`;
  document.body.append(dialog);
  const API='https://r6-flamingo-team-service.stony-elk-7524.chatgpt.site/api/room';
  let session=null,meta=null,doc=null,baseline=null,version=-1,queue=[],timer=null,pollTimer=null,busy=false,joining=false,lastPacket=null,currentMembers=[],generation=0,failures=0,cooldownUntil=0;
  const language=()=>document.documentElement.lang.toLowerCase();
  const rateText={es:'Demasiadas solicitudes. Esperá un momento y volvé a intentar.',en:'Too many requests. Wait a moment and try again.','pt-br':'Muitas solicitações. Aguarde um momento e tente novamente.'};
  const text=(key,values={})=>(key==='roomRate'?rateText[language()]||rateText.es:window.BREACH_I18N[language()]?.[key]||window.BREACH_I18N.es[key]||key).replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');
  function translate(){dialog.querySelectorAll('[data-room-text]').forEach(e=>e.textContent=text(e.dataset.roomText));$('roomClose').setAttribute('aria-label',text('close'));$('teamRoomBtn').title=text('roomTitle');if(session&&currentMembers.length)showMembers(currentMembers);}
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});translate();
  const status=key=>$('roomStatus').textContent=text(key);
  const nickname=()=>($('roomName').value.trim()||text('playerN',{n:1})).slice(0,30);
  function invite(){const url=new URL(location.href);url.hash=new URLSearchParams({room:session.id,key:session.key}).toString();return url.href;}
  function parseInvite(value){try{const url=new URL(value);if(url.protocol!=='https:')throw 0;const params=new URLSearchParams(url.hash.slice(1)),id=params.get('room'),key=params.get('key');if(!/^[a-f\d-]{36}$/.test(id)||!/^[a-f\d]{64}$/.test(key))throw 0;return{id,key};}catch{throw new Error('roomInvalidInvite');}}
  async function rpc(payload){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{const result=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'omit',redirect:'error',signal:controller.signal,cache:'no-store'});const data=await result.json();if(!result.ok){const error=new Error(data.error||'roomNetwork');error.retryAfter=Math.min(60,Math.max(1,Number(data.retryAfter)||Number(result.headers.get('Retry-After'))||5));throw error;}return data;}
    catch(error){throw error.message?.startsWith('room')?error:new Error('roomNetwork');}
    finally{clearTimeout(timeout);}
  }
  function auth(action,extra={}){return{action,id:session.id,member:session.member,token:session.token,...extra};}
  function showMembers(members){currentMembers=members;$('roomMembers').replaceChildren();for(const member of members){const li=document.createElement('li');li.textContent=member.name+(member.host?' · '+text('roomHost'):'');$('roomMembers').append(li);} $('teamRoomBtn').textContent=text('roomCount',{n:members.length});}
  function live(){joining=false;$('roomSetup').hidden=true;$('roomLive').hidden=false;$('roomLink').value=invite();$('teamRoomBtn').classList.add('active');status('roomConnected');pollTimer=setInterval(sync,1200);}
  function capture(){
    if(!doc||!baseline)return;
    const next=core.flatten(window.R6TeamBridge.snapshot().data,meta.id),ops=core.diff(baseline,next);baseline=next;
    if(ops.length)queue.push(ops);
  }
  function applyState(state){
    if(state.doc){core.validateDoc(state.doc,meta.id);doc=state.doc;let visible=doc;for(const ops of queue)visible=core.apply(visible,ops,meta.id);window.R6TeamBridge.apply(core.inflate(visible,meta.id));baseline=core.flatten(window.R6TeamBridge.snapshot().data,meta.id);}
    version=state.version;showMembers(state.members);
  }
  async function sync(){
    if(!session||!doc||busy||joining||Date.now()<cooldownUntil)return;
    const current=session,gen=generation;busy=true;
    try{
      capture();const sent=queue[0];const state=await rpc(auth(sent?'edit':'poll',{version,...(sent?{ops:sent}:{})}));
      if(session!==current||gen!==generation)return;
      capture();if(sent)queue.shift();applyState(state);failures=0;status('roomConnected');
    }catch(error){
      if(session!==current||gen!==generation)return;
      if(['roomExpired','roomDisconnected'].includes(error.message)){await stop(error.message);return;}
      if(error.message==='roomRate'){cooldownUntil=Date.now()+(error.retryAfter||5)*1000;status('roomRate');return;}
      if(['roomSize','roomInvalid'].includes(error.message)){queue.shift();status(error.message);}
      else{failures++;status('roomReconnecting');if(failures>=5)await stop('roomNetwork');}
    }finally{if(gen===generation){busy=false;if(queue.length&&session)setTimeout(sync,failures?1200:0);}}
  }
  function localChanged(){clearTimeout(timer);timer=setTimeout(sync,180);}
  async function stop(message='roomDisconnected'){
    generation++;clearTimeout(timer);clearInterval(pollTimer);timer=null;joining=false;busy=false;cooldownUntil=0;
    if(doc)try{lastPacket=window.R6TeamBridge.packet();$('roomRecovery').hidden=false;}catch{}
    const leaving=session;session=null;doc=null;queue=[];meta=null;baseline=null;currentMembers=[];
    if(leaving)rpc({action:'leave',id:leaving.id,member:leaving.member,token:leaving.token}).catch(()=>{});
    await window.R6TeamBridge?.end();
    $('roomSetup').hidden=false;$('roomLive').hidden=true;$('roomCreate').disabled=false;$('roomJoin').disabled=false;$('teamRoomBtn').classList.remove('active');$('teamRoomBtn').textContent=text('roomButton');status(message);
  }
  async function start(asHost){
    if(session||joining)return;if(!window.R6TeamBridge){status('roomNotReady');return;}
    joining=true;generation++;const gen=generation;$('roomCreate').disabled=true;$('roomJoin').disabled=true;status('roomConnecting');
    try{
      if(location.protocol!=='https:'||!window.isSecureContext)throw new Error('roomHTTPS');
      const name=nickname();let request;
      if(asHost){const snapshot=window.R6TeamBridge.snapshot();request={action:'create',name,meta:snapshot.map,floor:snapshot.floor,doc:core.flatten(snapshot.data,snapshot.map.id)};}
      else request={action:'join',name,...parseInvite($('roomInvite').value)};
      const result=await rpc(request);if(gen!==generation)return;
      session={...result,key:asHost?result.key:request.key};
      const state=await rpc(auth('poll',{version:-1}));meta=state.meta;core.validateDoc(state.doc,meta.id);doc=state.doc;version=state.version;
      await window.R6TeamBridge.begin(meta,core.inflate(doc,meta.id),state.floor);baseline=core.flatten(window.R6TeamBridge.snapshot().data,meta.id);failures=0;live();showMembers(state.members);
    }catch(error){if(gen===generation)await stop(error.message||'roomNetwork');}
  }
  $('roomRecovery').onclick=()=>{if(lastPacket)window.R6TeamBridge.export(lastPacket);};
  $('roomClose').onclick=()=>dialog.close();$('roomCreate').onclick=()=>start(true);$('roomJoin').onclick=()=>start(false);
  $('roomLeave').onclick=async()=>{await sync();await stop('roomLeft');};$('roomDownload').onclick=()=>window.R6TeamBridge.export();
  $('roomCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('roomLink').value);status('copied');}catch{$('roomLink').focus();$('roomLink').select();status('copyManual');}};
  window.addEventListener('beforeunload',event=>{if(doc){event.preventDefault();event.returnValue='';}});
  window.R6Collab={localChanged,open(){translate();if(new URLSearchParams(location.hash.slice(1)).has('room'))$('roomInvite').value=location.href;dialog.showModal();}};
})();
