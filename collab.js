'use strict';
(() => {
  const core=window.R6RoomCore;
  const $=id=>document.getElementById(id);
  const dialog=document.createElement('dialog');dialog.id='teamRoomDialog';
  dialog.innerHTML=`<button class="dialog-close" id="roomClose" aria-label="Close">×</button><div class="eyebrow">R6- FLAMINGO/STRAT · 5</div><h2 data-room-text="roomTitle"></h2><p data-room-text="roomIntro"></p><label class="field-label" for="roomName" data-room-text="roomName"></label><input id="roomName" class="text-field" maxlength="30" autocomplete="nickname"><div id="roomSetup"><button id="roomCreate" class="primary" data-room-text="roomCreate"></button><label class="field-label" for="roomInvite" data-room-text="roomInvite"></label><input id="roomInvite" class="text-field" type="text" autocomplete="off" spellcheck="false"><button id="roomJoin" class="secondary" data-room-text="roomJoin"></button></div><button id="roomRecovery" class="secondary" data-room-text="roomRecovery" hidden></button><p id="roomStatus" role="status" aria-live="polite"></p><section id="roomLive" hidden><label class="field-label" for="roomLink" data-room-text="roomLink"></label><input id="roomLink" class="text-field" readonly><button id="roomCopy" class="secondary" data-room-text="roomCopy"></button><ul id="roomMembers"></ul><button id="roomDownload" class="secondary" data-room-text="roomDownload"></button><button id="roomLeave" class="secondary" data-room-text="roomLeave"></button></section><p class="credit" data-room-text="roomLimit"></p>`;
  document.body.append(dialog);
  let peer=null,host=false,upstream=null,meta=null,secret='',roomId='',name='',doc=null,baseline=null,seq=0,lastSeq=-1,connections=new Map(),pending=new Map(),timer=null,connectTimer=null,joining=false;
  let library,lastPacket=null;
  let inbound=Promise.resolve();
  const language=()=>document.documentElement.lang.toLowerCase();
  const text=(key,values={})=>(window.BREACH_I18N[language()]?.[key]||window.BREACH_I18N.es[key]||key).replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');
  function translate(){dialog.querySelectorAll('[data-room-text]').forEach(e=>e.textContent=text(e.dataset.roomText));$('roomClose').setAttribute('aria-label',text('close'));$('teamRoomBtn').title=text('roomTitle');}
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});translate();
  const status=key=>$('roomStatus').textContent=text(key);
  const nickname=()=>($('roomName').value.trim()||text('playerN',{n:1})).slice(0,30);
  const loadLibrary=()=>library ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/peerjs.min.js';script.onload=resolve;script.onerror=()=>{library=null;reject(new Error('roomNetwork'));};document.head.append(script);});
  function invite(){const url=new URL(location.href);url.hash=new URLSearchParams({room:roomId,key:secret}).toString();return url.href;}
  function parseInvite(value){try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol))throw 0;const params=new URLSearchParams(url.hash.slice(1)),id=params.get('room'),key=params.get('key');if(!/^r6f-[a-f\d-]{36}$/.test(id)||!/^[a-f\d]{32}$/.test(key))throw 0;return{id,key};}catch{throw new Error('roomInvalidInvite');}}
  function send(connection,message){if(connection?.open)try{connection.send(message);}catch{status('roomNetwork');}}
  function roster(){return [{id:peer.id,name,host:true},...[...connections.values()].filter(c=>c.accepted).map(c=>({id:c.peer,name:c.memberName,host:false}))];}
  function showMembers(members){$('roomMembers').replaceChildren();for(const member of members){const li=document.createElement('li');li.textContent=member.name+(member.host?' · '+text('roomHost'):'');$('roomMembers').append(li);} $('teamRoomBtn').textContent=text('roomCount',{n:members.length});}
  function broadcast(message){for(const connection of connections.values())if(connection.accepted)send(connection,message);}
  function publishRoster(){const members=roster();showMembers(members);broadcast({type:'members',members});}
  function live(){clearTimeout(connectTimer);joining=false;$('roomSetup').hidden=true;$('roomLive').hidden=false;$('roomLink').value=invite();$('teamRoomBtn').classList.add('active');status('roomConnected');}
  async function renderDoc(){
    let visible=doc;for(const ops of pending.values())visible=core.apply(visible,ops,meta.id);
    window.R6TeamBridge.apply(core.inflate(visible,meta.id));baseline=core.flatten(window.R6TeamBridge.snapshot().data,meta.id);
  }
  function commit(ops,author,batch){
    doc=core.apply(doc,ops,meta.id);seq++;
    broadcast({type:'patch',ops,seq,author,batch});
    renderDoc();
  }
  function flush(){
    clearTimeout(timer);timer=null;if(!doc||!window.R6TeamBridge)return;
    try{const next=core.flatten(window.R6TeamBridge.snapshot().data,meta.id),ops=core.diff(baseline,next);baseline=next;if(!ops.length)return;
      if(host)commit(ops,peer.id,'host');
      else {const batch=crypto.randomUUID();pending.set(batch,ops);send(upstream,{type:'edit',ops,batch});}
    }catch(error){status(error.message);}
  }
  function localChanged(){clearTimeout(timer);timer=setTimeout(flush,120);}
  function validMessage(message){return message&&typeof message==='object'&&!Array.isArray(message)&&JSON.stringify(message).length<=core.MAX_BYTES+10000;}
  async function stop(message='roomDisconnected'){
    clearTimeout(timer);clearTimeout(connectTimer);timer=null;joining=false;
    if(doc)try{lastPacket=window.R6TeamBridge.packet();$('roomRecovery').hidden=false;}catch{}
    const current=peer;peer=null;doc=null;pending.clear();connections.clear();upstream=null;meta=null;
    current?.destroy();await window.R6TeamBridge?.end();
    $('roomSetup').hidden=false;$('roomLive').hidden=true;$('roomCreate').disabled=false;$('roomJoin').disabled=false;$('teamRoomBtn').classList.remove('active');$('teamRoomBtn').textContent=text('roomButton');status(message);
  }
  async function start(asHost){
    if(peer||joining)return;if(!window.R6TeamBridge){status('roomNotReady');return;}
    joining=true;$('roomCreate').disabled=true;$('roomJoin').disabled=true;status('roomConnecting');
    try{
      if(!window.isSecureContext)throw new Error('roomHTTPS');
      if(!window.RTCPeerConnection)throw new Error('roomUnsupported');
      name=nickname();host=asHost;seq=0;lastSeq=-1;
      let destination;if(!host)destination=parseInvite($('roomInvite').value);
      await loadLibrary();
      if(!joining)return;
      peer=new Peer('r6f-'+crypto.randomUUID(),{debug:0});
      connectTimer=setTimeout(()=>stop('roomTimeout'),25000);
      peer.on('error',()=>{if(!doc)stop('roomNetwork');else status('roomNetwork');});
      peer.on('disconnected',()=>{if(peer&&!peer.destroyed)peer.reconnect();});
      peer.on('open',async id=>{
        if(!peer)return;
        if(host){
          try{roomId=id;secret=crypto.randomUUID().replace(/-/g,'');const snapshot=window.R6TeamBridge.snapshot();meta=snapshot.map;doc=core.flatten(snapshot.data,meta.id);await window.R6TeamBridge.begin(meta,core.inflate(doc,meta.id),snapshot.floor);baseline=core.flatten(window.R6TeamBridge.snapshot().data,meta.id);live();publishRoster();}
          catch(error){stop(error.message);}
        } else {
          roomId=destination.id;secret=destination.key;
          upstream=peer.connect(roomId,{reliable:true,serialization:'json'});
          upstream.on('open',()=>send(upstream,{type:'hello',secret,name}));
          upstream.on('data',message=>{inbound=inbound.then(async()=>{
            if(!validMessage(message)||!peer)return;
            try{
              if(message.type==='reject'){await stop(message.reason==='full'?'roomFull':'roomInvalidInvite');return;}
              if(message.type==='welcome'&&!doc){
                meta=message.meta;core.validateDoc(message.doc,meta.id);doc=message.doc;lastSeq=message.seq;
                await window.R6TeamBridge.begin(meta,core.inflate(doc,meta.id),message.floor);baseline=core.flatten(window.R6TeamBridge.snapshot().data,meta.id);live();showMembers(message.members);
              } else if(message.type==='patch'&&doc&&Number.isInteger(message.seq)&&message.seq>lastSeq){
                // Preserve edits not yet flushed before applying another player's change.
                flush();doc=core.apply(doc,message.ops,meta.id);lastSeq=message.seq;
                if(message.author===peer.id)pending.delete(message.batch);renderDoc();
              } else if(message.type==='members'&&doc&&Array.isArray(message.members)&&message.members.length<=5)showMembers(message.members);
              else if(message.type==='resync'&&doc){pending.clear();core.validateDoc(message.doc,meta.id);doc=message.doc;lastSeq=message.seq;renderDoc();status('roomConflict');}
            }catch(error){await stop(error.message);}
          }).catch(()=>stop('roomInvalid'));});
          upstream.on('close',()=>{if(peer)stop('roomHostLeft');});
          upstream.on('error',()=>{if(peer)stop('roomNetwork');});
        }
      });
      peer.on('connection',connection=>{
        if(!host){connection.close();return;}
        connection.on('open',()=>{if(connections.size>=8){send(connection,{type:'reject',reason:'full'});setTimeout(()=>connection.close(),100);return;}connections.set(connection.peer,connection);});
        const helloTimeout=setTimeout(()=>{if(!connection.accepted)connection.close();},10000);
        let count=0,windowStart=Date.now();
        connection.on('data',message=>{
          if(!validMessage(message))return;
          if(Date.now()-windowStart>1000){windowStart=Date.now();count=0;}if(++count>30){connection.close();return;}
          if(!connection.accepted){
            if(message.type!=='hello')return;
            if(message.secret!==secret||typeof message.name!=='string'||[...connections.values()].filter(c=>c.accepted).length>=4){send(connection,{type:'reject',reason:message.secret===secret?'full':'invite'});setTimeout(()=>connection.close(),100);return;}
            clearTimeout(helloTimeout);connection.accepted=true;connection.memberName=message.name.slice(0,30)||text('playerN',{n:connections.size+1});
            flush();send(connection,{type:'welcome',meta,doc,seq,floor:window.R6TeamBridge.snapshot().floor,members:roster()});publishRoster();return;
          }
          if(message.type==='edit'&&typeof message.batch==='string'&&message.batch.length<100){
            try{flush();commit(message.ops,connection.peer,message.batch);}catch{send(connection,{type:'resync',doc,seq});}
          }
        });
        connection.on('close',()=>{clearTimeout(helloTimeout);connections.delete(connection.peer);if(peer&&doc)publishRoster();});
        connection.on('error',()=>connection.close());
      });
    }catch(error){await stop(error.message||'roomNetwork');}
  }
  $('roomRecovery').onclick=()=>{if(lastPacket)window.R6TeamBridge.export(lastPacket);};
  $('roomClose').onclick=()=>dialog.close();$('roomCreate').onclick=()=>start(true);$('roomJoin').onclick=()=>start(false);
  $('roomLeave').onclick=async()=>{flush();await stop('roomLeft');};$('roomDownload').onclick=()=>window.R6TeamBridge.export();
  $('roomCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('roomLink').value);status('copied');}catch{$('roomLink').focus();$('roomLink').select();status('copyManual');}};
  window.addEventListener('beforeunload',event=>{if(doc){event.preventDefault();event.returnValue='';}});
  window.R6Collab={localChanged,open(){translate();if(new URLSearchParams(location.hash.slice(1)).has('room'))$('roomInvite').value=location.href;dialog.showModal();}};
})();
