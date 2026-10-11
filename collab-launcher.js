'use strict';
(() => {
  let loading;
  const script = source => new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=source;node.onload=resolve;node.onerror=reject;document.head.append(node);});
  async function open(){
    const button=document.getElementById('teamRoomBtn');button.disabled=true;
    try{loading ||= script('collab-core.js?v=team-1').then(()=>script('collab.js?v=team-1'));await loading;window.R6Collab.open();}
    catch{loading=null;button.textContent=document.documentElement.lang==='es'?'Reintentar sala':'Retry room';}
    finally{button.disabled=false;}
  }
  document.getElementById('teamRoomBtn').onclick=open;
  if(new URLSearchParams(location.hash.slice(1)).has('room')){
    if(window.R6TeamBridge)open();else document.addEventListener('r6-ready',open,{once:true});
  }
})();
