'use strict';
(function(root){
  function createValidator(DATA,baseRevisions,t=key=>key){
    function safeBackup(raw){
    if(!raw||raw.app!=='breach-r6-atlas'||raw.version!==1||!raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))throw new Error(t('badBackup'));
    const d=raw.data,result={favoriteMaps:[],favoriteCalls:[],notes:{},siteNotes:{},annotationArchives:{},actionRevisions:{},teamTasks:{},checklists:{},actions:{},aliases:{},preferences:{}};
    result.favoriteMaps=(Array.isArray(d.favoriteMaps)?d.favoriteMaps:[]).filter(id=>DATA.maps.some(m=>m.id===id));
    result.favoriteCalls=(Array.isArray(d.favoriteCalls)?d.favoriteCalls:[]).filter(s=>typeof s==='string'&&s.length<160);
    for(const [key,value] of Object.entries(d.notes||{})){if(/^[a-z]+:-?\d+$/.test(key)&&typeof value==='string')result.notes[key]=value.slice(0,30000);}
    for(const [key,value] of Object.entries(d.siteNotes||{}))if(/^[a-z]+:\d+$/.test(key)&&typeof value==='string')result.siteNotes[key]=value.slice(0,30000);
    for(const [key,value] of Object.entries(d.aliases||{})){if(/^[a-z]+:-?\d+:[a-zA-Z0-9_.:-]+$/.test(key)&&key.length<180&&typeof value==='string')result.aliases[key]=value.slice(0,80);}
    if(['en','es','pt-br'].includes(d.language))result.preferences.language=d.language;
    for(const key of ['bilingual','studyFavorites'])if(typeof d[key]==='boolean')result.preferences[key]=d[key];
    if(Number.isFinite(d.labelSize))result.preferences.labelSize=Math.max(75,Math.min(150,d.labelSize));
    for(const m of DATA.maps){
      const incoming=Array.isArray(d.actions?.[m.id])?d.actions[m.id]:[];
      const supplied=d.actionRevisions?.[m.id];result.actionRevisions[m.id]=supplied&&typeof supplied.sourceSha256==='string'?{revision:Number(supplied.revision)||0,sourceSha256:supplied.sourceSha256.slice(0,64)}:baseRevisions.get(m.id);
      result.actions[m.id]=incoming.slice(0,1500).filter(a=>a&&['pin','line','pen'].includes(a.kind)&&Number.isInteger(a.floor)&&a.floor>=-1&&a.floor<=6&&Array.isArray(a.points)&&a.points.length>0&&a.points.length<=10000&&a.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6))).map(a=>({id:typeof a.id==='string'?a.id.slice(0,100):crypto.randomUUID(),floor:a.floor,site:typeof a.site==='string'&&/^\d+$/.test(a.site)?a.site:undefined,kind:a.kind,color:/^#[0-9a-f]{6}$/i.test(a.color)?a.color:'#f5cf55',points:a.points.map(p=>p.slice()),operator:typeof a.operator==='string'&&/^[a-z][a-z0-9-]{0,40}$/.test(a.operator)?a.operator:undefined,label:String(a.label||'Callout').slice(0,60),note:String(a.note||'').slice(0,300),migratedFrom:a.migratedFrom&&typeof a.migratedFrom.archiveId==='string'&&typeof a.migratedFrom.actionId==='string'?{archiveId:a.migratedFrom.archiveId.slice(0,100),actionId:a.migratedFrom.actionId.slice(0,100),revision:Number(a.migratedFrom.revision)||0}:undefined}));
    }
    for(const m of DATA.maps){const entries=Array.isArray(d.annotationArchives?.[m.id])?d.annotationArchives[m.id]:[];result.annotationArchives[m.id]=entries.slice(0,6).filter(a=>a&&typeof a.id==='string'&&Array.isArray(a.actions)).map(a=>({id:a.id.slice(0,100),revision:Number(a.revision)||0,sourceSha256:String(a.sourceSha256||'').slice(0,64),created:String(a.created||'').slice(0,40),actions:safeBackup({app:'breach-r6-atlas',version:1,data:{actions:{[m.id]:a.actions}}}).actions[m.id]}));}
    for(const [key,value] of Object.entries(d.teamTasks||{})){const hit=/^([a-z]+):(?:site-(\d+)|floor-(-?\d+))$/.exec(key);if(!hit||!DATA.maps.some(m=>m.id===hit[1])||!Array.isArray(value)||(hit[2]&&(+hit[2]<1||+hit[2]>20))||(hit[3]&&(+hit[3]<-1||+hit[3]>6)))continue;result.teamTasks[key]=value.slice(0,5).map(a=>({name:String(a?.name||'').slice(0,60),task:String(a?.task||'').slice(0,600),done:a?.done===true,point:a?.point&&typeof a.point.id==='string'&&a.point.id.length<100&&Number.isInteger(a.point.floor)&&a.point.floor>=-1&&a.point.floor<=6?{id:a.point.id,floor:a.point.floor}:null}));}
    for(const [key,value] of Object.entries(d.checklists||{})){const hit=/^([a-z]+):(\d+)$/.exec(key);if(!hit||!DATA.maps.some(m=>m.id===hit[1])||!Array.isArray(value)||+hit[2]<1||+hit[2]>20)continue;result.checklists[key]=value.slice(0,40).filter(a=>a&&typeof a.text==='string').map(a=>({id:typeof a.id==='string'?a.id.slice(0,100):crypto.randomUUID(),text:a.text.slice(0,300),done:a.done===true}));}
    return result;
  }

    return safeBackup;
  }
  function reviewPlan(raw,DATA,safeBackup){
    const target=DATA.maps.find(m=>m.id===raw?.map?.id);
    if(raw?.app!=='breach-strategy'||raw.version!==1||!target||!Number.isInteger(raw.floor)||raw.floor<-1||raw.floor>6||!Number.isInteger(raw.map.revision)||raw.map.revision<0||typeof raw.map.sourceSha256!=='string'||!(/^[a-f0-9]{64}$/i).test(raw.map.sourceSha256))throw new Error('badPlan');
    const incoming=safeBackup({app:'breach-r6-atlas',version:1,data:raw.data}),prefix=target.id+':';
    for(const collection of ['notes','siteNotes','aliases','teamTasks','checklists'])incoming[collection]=Object.fromEntries(Object.entries(incoming[collection]).filter(([key])=>key.startsWith(prefix)));
    incoming.actions={[target.id]:incoming.actions[target.id]};
    return {target,incoming,mismatch:raw.map.revision!==target.revision||raw.map.sourceSha256!==target.sourceSha256};
  }
  const api={createValidator,reviewPlan};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.R6Validation=api;
})(typeof window==='undefined'?globalThis:window);
