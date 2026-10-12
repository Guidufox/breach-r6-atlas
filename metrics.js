'use strict';
(() => {
  if(location.protocol!=='https:'||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true)return;
  const send=()=>{
    const language=document.documentElement.lang.toLowerCase();
    fetch('https://r6-flamingo-team-service.stony-elk-7524.chatgpt.site/api/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:location.pathname.replace(/\/index\.html$/,'/'),language:['es','en','pt-br'].includes(language)?language:'es'}),credentials:'omit',keepalive:true,cache:'no-store',redirect:'error'}).catch(()=>{});
  };
  if('requestIdleCallback' in window)requestIdleCallback(send,{timeout:5000});else setTimeout(send,2000);
})();
