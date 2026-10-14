'use strict';
(async () => {
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const DATA = window.R6_DATA;
  const STORE = 'breach-r6-atlas-v1';
  const layers = {
    bmb:['Bombas','#f5d646'],sec:['Área segura','#c97fda'],hst:['Rehén','#53b6cf'],
    bw:['Paredes destructibles','#ef775b'],losw:['Líneas de visión: paredes','#d077bd'],
    losf:['Líneas de visión: pisos','#79c9d9'],fh:['Trampillas en el piso','#f0b765'],ch:['Trampillas en el techo','#a5cbef'],
    cam:['Cámaras de seguridad','#80aaff'],dt:['Túneles de dron','#a3d397'],ld:['Escaleras de mano','#c9ce97'],
    sl:['Claraboyas','#73bad3'],fe:['Extintores','#f09089'],gp:['Tuberías de gas','#93bfca'],
    md:['Detectores de metal','#e5b186'],ns:['Fuentes de ruido','#ac96d8'],ip:['Puntos de aparición','#c4dcab'],
    txt:['Nombres de callouts','#f5cf55'],cmp:['Brújula','#9ab0c2'],lg:['Leyenda del plano','#9ab0c2']
  };
  const defaults = {map:'bank',floor:1,language:'es',bilingual:true,labelSize:100,studyFavorites:false,studyKind:'recognize',sites:{},siteNotes:{},annotationArchives:{},actionRevisions:{},teamTasks:{},checklists:{},shareBase:'',aliases:{},favoriteMaps:[],favoriteCalls:[],notes:{},actions:{},layers:{},study:{known:0,again:0}};
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { /* Can run without storage. */ }
  let config = {...defaults,...saved};
  for(const key of ['webhook','webhookURL','discordWebhook'])delete config[key];
  if(!config.layers || typeof config.layers!=='object' || Array.isArray(config.layers))config.layers={};
  for (const id of Object.keys(layers)) if(typeof config.layers[id] !== 'boolean') config.layers[id] = !['sec','hst','losf','losw','lg'].includes(id);
  for (const key of ['favoriteMaps','favoriteCalls']) if(!Array.isArray(config[key])) config[key]=[];
  for (const key of ['notes','actions','study','aliases','sites','siteNotes','annotationArchives','actionRevisions','teamTasks','checklists']) if(!config[key] || typeof config[key]!=='object' || Array.isArray(config[key])) config[key]={};
  if(!['en','es','pt-br'].includes(config.language))config.language='es';
  config.labelSize=Number.isFinite(config.labelSize)?Math.max(75,Math.min(150,config.labelSize)):100;
  config.bilingual=config.bilingual!==false;config.studyFavorites=config.studyFavorites===true;
  config.shareBase=typeof config.shareBase==='string'?config.shareBase.slice(0,2048):'';
  config.studyKind=config.studyKind==='locate'?'locate':'recognize';
  const query=new URLSearchParams(location.search);if(DATA.maps.some(m=>m.id===query.get('map')))config.map=query.get('map');if(['es','en','pt-br'].includes(query.get('lang')))config.language=query.get('lang');
  const baseRevisions=new Map(DATA.maps.map(m=>[m.id,{revision:m.revision,sourceSha256:m.sourceSha256}]));
  await window.BreachModules.updates.initialize(DATA);
  // Reconcile drawings against installed metadata even if a previous preferences write failed.
  for(const m of DATA.maps){const prior=config.actionRevisions[m.id]||baseRevisions.get(m.id);if((config.actions[m.id]||[]).length&&prior.sourceSha256!==m.sourceSha256){archiveActions({...m,...prior},config.actions[m.id]);config.actions[m.id]=[];}config.actionRevisions[m.id]={revision:m.revision,sourceSha256:m.sourceSha256};}
  let map = DATA.maps.find(m => m.id===config.map) || DATA.maps[0];
  let floor = map.floors.includes(config.floor) ? config.floor : (map.floors.includes(1)?1:map.floors[0]);
  let svg, overlay, selectionLayer, siteLayer, defaultView, view, mode='explore', tool='move', panel='calls';
  let selected=null, favoritesOnly=false, favoriteMapsOnly=false, loadSequence=0, pointer=null, pendingPin=null;
  let studyTarget=null, studyLast=null, sessionKnown=0, sessionAgain=0, toastTimer, reviewQueue=[];
  let labelAnchors=new Map();
  let bombAnchors=new Map(),selectedSite=null,pendingUpdate=null,updateBusy=false;
  let recovery=null,recoveryLayer=null,comparison=null,receivedPlan=null,discordBusy=false;
  let challenge={attempts:0,correct:0,resolved:false};
  let roomPersonal=null,roomMap=null,roomApplying=false;
  let operatorId='',operatorNote='',operatorRoutes=true,operatorLoader,pdfLoader;
  const labelLoads=new Map();
  function loadAssetScript(src){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);});}
  function ensureMapLabels(target){if(!DATA.lazyLabels||target.labels.length||target.labelsLoaded)return Promise.resolve();if(!labelLoads.has(target.id))labelLoads.set(target.id,loadAssetScript('maps/'+target.id+'.labels.js?v=labels-1').then(()=>{target.labels=window.R6_LABELS[target.id]||[];target.labelsLoaded=true;labelLoads.delete(target.id);}).catch(error=>{labelLoads.delete(target.id);throw error;}));return labelLoads.get(target.id);}
  async function ensureOperatorModule(){operatorLoader ||= loadAssetScript('operators.js?v=icons-1');try{await operatorLoader;}catch(error){operatorLoader=null;throw error;}}
  async function ensureOperatorImages(){if(floorActions().some(a=>a.operator)){await ensureOperatorModule();await Promise.all(floorActions().filter(a=>a.operator).map(a=>window.R6Operators.asset(a.operator)));renderAnnotations();}}

  function t(key,values={}){const s=window.BREACH_I18N[config.language]?.[key]||window.BREACH_I18N.es[key]||key;return s.replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');}
  function mapName(m=map){return m.names?.[config.language]||m.name;}
  function callName(l,language=config.language){return l.custom?l.name:(l.names?.[language]||l.name);}
  function languageCode(l=config.language){return l==='pt-br'?'PT-BR':l.toUpperCase();}
  function aliasFor(l){return config.aliases[keyFor(l)]||'';}
  function matchesCall(l,query){return norm([l.name,...Object.values(l.names||{}),...(l.aliases||[]),aliasFor(l)].join(' | ')).includes(query);}
  function applyLanguage(){
    document.documentElement.lang=config.language==='pt-br'?'pt-BR':config.language;
    document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.getAttribute('data-i18n')));
    for(const [data,attr] of [['placeholder','placeholder'],['title','title'],['label','aria-label']])document.querySelectorAll('[data-'+data+']').forEach(e=>e.setAttribute(attr,t(e.dataset[data])));
    $('languageSelect').value=config.language;$('bilingual').checked=config.bilingual;$('studyFavorites').checked=config.studyFavorites;
    $('labelSize').value=config.labelSize;$('labelSizeValue').textContent=config.labelSize+'%';$('namesLanguage').textContent=languageCode();
    $('practiceKind').value=config.studyKind;renderCallControls();
    renderMapNames();renderMaps();renderHeader();renderFloors();renderSites();renderLayers();renderNotes();renderCalls();renderStudyText();
    if(recovery){const target=recovery.target,reviewed=$('reviewPosition').checked;renderRecovery();recovery.target=target;$('reviewPosition').checked=reviewed;$('commitRecovery').disabled=!reviewed;renderRecoveryGhost();}
    if(comparison&&$('compareDialog').open)renderComparison();
    if(selected)$('selectedTag').textContent=callName(selected)+' · '+floorName(selected.floor);
    $('modeHint').textContent=t(mode==='study'?(config.studyKind==='locate'?'challengeHint':'hintStudy'):'hint'+tool[0].toUpperCase()+tool.slice(1));
  }

  function el(tag,className,text) { const e=document.createElement(tag); if(className)e.className=className; if(text!==undefined)e.textContent=text; return e; }
  function node(tag,attrs={},parent) { const e=document.createElementNS(NS,tag); for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v); if(parent)parent.append(e); return e; }
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
  function save(){ if(roomMap){if(!roomApplying)window.R6Collab?.localChanged();$('saveStatus').textContent=t('roomTemporary');return;} config.map=map.id;config.floor=floor;config.actionRevisions[map.id]={revision:map.revision,sourceSha256:map.sourceSha256}; try{localStorage.setItem(STORE,JSON.stringify(config));$('saveStatus').textContent=t('saved');}catch{$('saveStatus').textContent=t('noSave');} }
  function shortFloor(f,m=map){return f===-1?'SS':f===0?'B':f===m.maxFloorNumber && f>1?'RF':f+'F';}
  function floorName(f,m=map){return f===-1?t('subBasement'):f===0?t('basement'):f===m.maxFloorNumber && f>1?t('roof'):f===1?t('ground'):t('upperFloor',{n:config.language==='en'?f:f-1});}
  function keyFor(label){return map.id+':'+label.floor+':'+label.id;}
  function actionList(){return config.actions[map.id] || (config.actions[map.id]=[]);}
  function floorActions(){return actionList().filter(a=>a.floor===floor&&(!selectedSite||!a.site||a.site===selectedSite.id));}
  function noteKey(){return map.id+':'+floor;}
  function calls(){return [...map.labels,...actionList().filter(a=>a.kind==='pin'&&(!selectedSite||!a.site||a.site===selectedSite.id)).map(a=>({id:a.id,name:a.label,floor:a.floor,custom:true,action:a}))];}
  function norm(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function renderMaps(){
    const search=norm($('mapSearch').value);const list=$('mapList');list.replaceChildren();
    DATA.maps.slice().sort((a,b)=>mapName(a).localeCompare(mapName(b),config.language)).forEach((m,index)=>{
      if(!norm([m.name,...(m.aliases||[]),...Object.values(m.names||{})].join(' | ')).includes(search) || (favoriteMapsOnly && !config.favoriteMaps.includes(m.id)))return;
      const b=el('button','map-row'+(m.id===map.id?' active':''));b.dataset.map=m.id;b.setAttribute('aria-pressed',m.id===map.id);
      b.append(el('span','map-number',String(index+1).padStart(2,'0')),el('span','',mapName(m)));
      if(config.favoriteMaps.includes(m.id))b.append(el('span','mini-star','★'));
      b.onclick=()=>loadMap(m.id);list.append(b);
    });
    if(!list.children.length)list.append(el('div','empty-state',t('noMaps')));
    $('totalMaps').textContent=DATA.maps.length;
  }
  function renderFloors(){
    $('floors').replaceChildren();
    if(!map.floors.length){const b=el('button','active',t('exterior'));b.disabled=true;$('floors').append(b);return;}
    map.floors.forEach(f=>{const b=el('button',f===floor?'active':'',shortFloor(f)+' · '+floorName(f));b.setAttribute('aria-pressed',f===floor);b.onclick=()=>changeFloor(f);$('floors').append(b);});
  }
  function renderHeader(){
    $('mapTitle').textContent=mapName();$('mapFloorsMeta').textContent=map.floors.length?t('levels',{n:map.floors.length}):t('exterior');
    $('mapEnglish').textContent=config.bilingual&&mapName()!==map.name?map.name:'';
    $('mapTitle').title=t('sourceMap',{source:map.nameSource==='ubisoft'?'Ubisoft':'R6Calls',name:map.name});
    $('mapCallsMeta').textContent=t('callCount',{n:map.labels.length});
    $('canvasLabel').textContent=mapName().toUpperCase()+' / '+(map.floors.length?shortFloor(floor):t('exterior').toUpperCase());
    $('favoriteMapBtn').textContent=config.favoriteMaps.includes(map.id)?'★':'☆';$('favoriteMapBtn').classList.toggle('active',config.favoriteMaps.includes(map.id));
    $('favoriteMapBtn').setAttribute('aria-label',t(config.favoriteMaps.includes(map.id)?'favoriteRemove':'favoriteAdd',{name:mapName()}));
  }
  async function loadMap(id){
    if(roomMap&&id!==roomMap){toast(t('roomMapLocked'));return;}
    const next=DATA.maps.find(m=>m.id===id);if(!next)return;if(recovery&&id!==map.id)endRecovery();
    const seq=++loadSequence;$('loading').hidden=false;

    try{
      if(window.BreachModules.updates.available){const local=await window.BreachModules.updates.get(id);if(local?.svg)window.R6_MAPS[id]=local.svg;}
      const labelLoad=ensureMapLabels(next);
      if(!window.R6_MAPS[id])await Promise.all([labelLoad,new Promise((resolve,reject)=>{const s=el('script');s.src='maps/'+id+'.js?v=maps-lite-1';s.onload=()=>{s.remove();resolve();};s.onerror=()=>{s.remove();reject(new Error(t('missingMap')));};document.head.append(s);})]);else await labelLoad;
      if(seq!==loadSequence)return;
      map=next;floor=map.floors.includes(floor)?floor:(map.floors.includes(1)?1:map.floors[0]??1);
      selected=null;studyTarget=null;studyLast=null;reviewQueue=[];
      $('selectedTag').hidden=true;
      const doc=new DOMParser().parseFromString(window.R6_MAPS[id],'image/svg+xml');
      if(doc.querySelector('parsererror'))throw new Error(t('invalidMap'));
      svg=document.importNode(doc.documentElement,true);svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('aria-label',mapName());
      $('mapHost').replaceChildren(svg);siteLayer=node('g',{'data-breach':'sites','pointer-events':'none'},svg);overlay=node('g',{'data-breach':'annotations'},svg);selectionLayer=node('g',{'data-breach':'selection','pointer-events':'none'},svg);
      defaultView=svg.getAttribute('viewBox').split(/[ ,]+/).map(Number);view=defaultView.slice();
      const selectedMap=id;for(const k of Object.keys(window.R6_MAPS))if(k!==selectedMap)delete window.R6_MAPS[k];
      svg.querySelectorAll('text[data-call]').forEach(t=>t.addEventListener('click',()=>{
        if(recovery || mode==='study' || tool!=='move' || pointer?.moved)return;
        const label=map.labels.find(l=>l.id===t.id);if(label)selectCall(label);
      }));
      captureLabelAnchors();selectedSite=(map.sites||[]).find(s=>s.id===config.sites[map.id])||null;
      renderMapNames();applyVisibility();fitFloor();renderMaps();renderFloors();renderHeader();renderSites();renderLayers();renderNotes();renderCalls();save();
      if(mode==='study')nextStudy();
    }catch(error){toast(error.message+' '+t('extract'));}
    finally{if(seq===loadSequence)$('loading').hidden=true;}
  }
  function byId(id){return svg?.getElementById(id);}
  function captureBombAnchors(){
    bombAnchors=new Map();for(const site of map.sites||[])for(const marker of site.markers){const r=byId(marker.id)?.querySelector('rect');if(r)bombAnchors.set(marker.id,rootPoint(r,Number(r.getAttribute('x'))+Number(r.getAttribute('width'))/2,Number(r.getAttribute('y'))+Number(r.getAttribute('height'))/2));}
  }
  function renderSites(){
    const select=$('siteSelect');select.replaceChildren();const all=el('option','',t('allSites'));all.value='';select.append(all);
    for(const site of map.sites||[]){const option=el('option','',t('siteNumber',{n:site.id})+' · '+[...new Set(site.markers.map(p=>shortFloor(p.floor)))].join('/'));option.value=site.id;select.append(option);}
    select.disabled=!(map.sites||[]).length;select.value=selectedSite?.id||'';$('siteContext').textContent=t(select.disabled?'noSites':selectedSite&&!selectedSite.markers.some(p=>p.floor===floor)?'remoteSite':selectedSite?'nearby':'siteReference',{floors:selectedSite?[...new Set(selectedSite.markers.map(p=>shortFloor(p.floor)))].join('/') : ''});
    renderSiteMarkers();
  }
  function renderSiteMarkers(){
    if(!svg||!siteLayer)return;siteLayer.replaceChildren();
    for(const site of map.sites||[])for(const marker of site.markers){const g=byId(marker.id);if(g){const shown=config.layers.bmb&&(!selectedSite||site.id===selectedSite.id);g.style.display=shown?'inline':'none';g.setAttribute('display',shown?'inline':'none');}}
    if(!selectedSite||!config.layers.bmb)return;
    for(const marker of selectedSite.markers.filter(p=>p.floor===floor)){const p=bombAnchors.get(marker.id);if(!p)continue;node('circle',{cx:p.x,cy:p.y,r:10,fill:'#f5cf5520',stroke:'#f5cf55','stroke-width':1.2},siteLayer);const name=node('text',{x:p.x,y:p.y-13,fill:'#f5cf55','font-size':5,'text-anchor':'middle','font-family':'Segoe UI, sans-serif','paint-order':'stroke',stroke:'#101820','stroke-width':.8},siteLayer);name.textContent=marker.letter;}
  }
  function floorWidth(){try{const picture=byId(floor+'-pic');return picture?bounds(picture).width:defaultView?.[2]||1000;}catch{return defaultView?.[2]||1000;}}
  function siteDistance(label){if(!selectedSite)return Infinity;const p=callPoint(label);if(!p)return Infinity;const markers=selectedSite.markers.filter(m=>m.floor===label.floor).map(m=>bombAnchors.get(m.id)).filter(Boolean);return Math.min(...markers.map(q=>Math.hypot(q.x-p.x,q.y-p.y)));}
  function chooseSite(id){
    selectedSite=(map.sites||[]).find(s=>s.id===id)||null;config.sites[map.id]=selectedSite?.id||'';
    if(selectedSite){config.layers.bmb=true;if(!selectedSite.markers.some(p=>p.floor===floor))changeFloor(selectedSite.markers[0].floor);}
    applyVisibility();renderSites();renderCalls();renderNotes();renderLayers();save();
    if(selectedSite){const points=selectedSite.markers.filter(p=>p.floor===floor).map(m=>bombAnchors.get(m.id)).filter(Boolean);if(points.length){const pad=Math.max(20,floorWidth()*.2),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),w=Math.max(...points.map(p=>p.x))-x,h=Math.max(...points.map(p=>p.y))-y;updateView([x-pad,y-pad,w+pad*2,h+pad*2]);}}
  }
  function captureLabelAnchors(){
    labelAnchors=new Map();
    // Measure original geometry before changing text, including hidden floors.
    const groups=[...svg.querySelectorAll('g')],states=groups.map(g=>[g,g.getAttribute('display'),g.style.display]);
    groups.forEach(g=>{g.setAttribute('display','inline');g.style.display='inline';});
    try{
      for(const l of [...map.labels,...(map.auxiliary||[])]){
        const e=byId(l.id);if(!e)continue;
        const first=e.querySelector('tspan')||e;
        const font=parseFloat(first.getAttribute('font-size')||e.getAttribute('font-size')||first.style.fontSize||e.style.fontSize)||16;
        let b;try{b=e.getBBox();}catch{b=null;}
        if(!b||!b.width||!b.height)b={x:parseFloat(first.getAttribute('x'))||0,y:(parseFloat(first.getAttribute('y'))||0)-font*.8,width:Math.max(1,l.name.length)*font*.55,height:font};
        const x=b.x+b.width/2,y=b.y+b.height/2,point=rootPoint(e,x,y);
        const maxChars=Math.max(12,Math.min(26,Math.round(b.width/(font*.55))));
        labelAnchors.set(l.id,{x,y,font,maxChars,point,original:l.name,kind:l.kind});
      }
      captureBombAnchors();
    }finally{states.forEach(([g,display,style])=>{if(display===null)g.removeAttribute('display');else g.setAttribute('display',display);g.style.display=style||'';});}
  }
  function wrapName(name,maxChars){
    const lines=[];let line='';
    for(const word of name.split(/\s+/)){if(line&&(line+' '+word).length>maxChars){lines.push(line);line=word;}else line+=(line?' ':'')+word;}
    if(line)lines.push(line);return lines;
  }
  function renderMapNames(){
    if(!svg)return;
    for(const label of [...map.labels,...(map.auxiliary||[])]){
      const e=byId(label.id),a=labelAnchors.get(label.id);if(!e||!a)continue;
      const name=callName(label);let lines=wrapName(name,a.kind==='compass'?2:a.maxChars);
      const size=a.font*(label.kind?1:config.labelSize/100);
      e.replaceChildren();e.setAttribute('text-anchor','middle');e.setAttribute('x',a.x);e.setAttribute('y',a.y);e.style.textAlign='center';
      e.setAttribute('font-size',size);e.style.fontSize=size+'px';e.setAttribute('aria-label',name);
      lines.forEach((line,i)=>{const span=node('tspan',{x:a.x,y:a.y+(i-(lines.length-1)/2)*size*1.12+size*.32,'font-size':size,'text-anchor':'middle'},e);span.textContent=line;});
    }
    svg.setAttribute('aria-label',mapName());
  }
  function applyVisibility(){
    if(!svg)return;
    for(const g of [...svg.children]){
      const match=/^Floor (-?\d+)$/.exec(g.id);
      if(match){g.setAttribute('display',Number(match[1])===floor?'inline':'none');g.style.display=Number(match[1])===floor?'inline':'none';}
    }
    DATA.mapLayers.forEach(l=>{
      for(const prefix of ['bg',...map.floors]){
        const g=byId(prefix+'-'+l.id);if(g){const display=config.layers[l.id] && !(mode==='study' && l.id==='txt')?'inline':'none';g.setAttribute('display',display);g.style.display=display;}
      }
    });
    renderAnnotations();renderSiteMarkers();
  }
  function changeFloor(f){
    if(!map.floors.includes(f))return;floor=f;selected=null;studyTarget=null;studyLast=null;reviewQueue=[];$('selectedTag').hidden=true;selectionLayer?.replaceChildren();
    applyVisibility();fitFloor();renderFloors();renderHeader();renderSites();renderLayers();renderNotes();renderCalls();save();if(mode==='study')nextStudy();if(recovery){$('recoverFloor').value=String(floor);$('reviewPosition').checked=false;$('commitRecovery').disabled=true;renderRecoveryGhost();}
  }
  function updateView(next){
    if(!svg || !next.every(Number.isFinite) || next[2]<=0 || next[3]<=0)return;
    view=next;svg.setAttribute('viewBox',view.join(' '));$('zoomValue').textContent=Math.round(defaultView[2]/view[2]*100)+'%';
  }
  function rootPoint(element,x,y){
    let p=svg.createSVGPoint();p.x=x;p.y=y;const ctm=element.getCTM(),root=svg.getCTM();
    if(!ctm||!root)return {x,y};return p.matrixTransform(ctm).matrixTransform(root.inverse());
  }
  function bounds(element){
    const b=element.getBBox();const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>rootPoint(element,x,y));
    const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};
  }
  function fitFloor(){
    if(!svg)return;
    const pic=byId(floor+'-pic');
    if(pic){try{const b=bounds(pic);if(b.width>0){const pad=Math.max(b.width,b.height)*.09;updateView([b.x-pad,b.y-pad,b.width+pad*2,b.height+pad*2]);return;}}catch{}}
    updateView(defaultView.slice());
  }
  function pointFromEvent(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  function zoom(factor,point){
    if(!svg)return;const nextWidth=view[2]*factor;
    if(nextWidth<defaultView[2]/18 || nextWidth>defaultView[2]*2)return;
    const c=point||{x:view[0]+view[2]/2,y:view[1]+view[3]/2};
    updateView([c.x-(c.x-view[0])*factor,c.y-(c.y-view[1])*factor,nextWidth,view[3]*factor]);
  }
  function callPoint(label){
    if(label.custom)return {x:label.action.points[0][0],y:label.action.points[0][1]};
    if(labelAnchors.has(label.id))return labelAnchors.get(label.id).point;
    const target=byId(label.id);if(!target)return null;
    const parent=target.closest('g[id$="-txt"]'),oldStyle=parent?.style.display,oldDisplay=parent?.getAttribute('display');
    try{if(parent){parent.style.display='inline';parent.setAttribute('display','inline');}const b=bounds(target);return {x:b.x+b.width/2,y:b.y+b.height/2};}catch{return null;}
    finally{if(parent){parent.style.display=oldStyle||'';if(oldDisplay===null)parent.removeAttribute('display');else parent.setAttribute('display',oldDisplay);}}
  }
  function markPoint(p,color='#f5cf55'){
    selectionLayer.replaceChildren();if(!p)return;
    node('circle',{cx:p.x,cy:p.y,r:5.5,fill:color+'35',stroke:color,'stroke-width':1.1},selectionLayer);
    node('circle',{cx:p.x,cy:p.y,r:1.7,fill:color},selectionLayer);
  }
  function focusPoint(p){if(!p)return;const width=defaultView[2]/2.4,height=defaultView[3]/2.4;updateView([p.x-width/2,p.y-height/2,width,height]);markPoint(p);}
  function selectCall(label){
    if(label.floor!==floor)changeFloor(label.floor);
    selected=label;focusPoint(callPoint(label));$('selectedTag').textContent=callName(label)+' · '+floorName(label.floor);$('selectedTag').hidden=false;$('callDetails').open=true;renderCalls();
  }
  function toggleFavoriteCall(label){const key=keyFor(label);config.favoriteCalls=config.favoriteCalls.includes(key)?config.favoriteCalls.filter(k=>k!==key):[...config.favoriteCalls,key];save();renderCalls();}
  function renderCalls(){
    renderCallDetails();
    const list=$('callList');list.replaceChildren();
    if(mode==='study'){
      const summary=el('div','study-summary');if(config.studyKind==='locate'){summary.append(el('strong','',String(challenge.correct)),el('div','',t('locateChallenge')),el('p','',t('challengeStats',{good:challenge.correct,tries:challenge.attempts})));}else summary.append(el('strong','',String(sessionKnown)),el('div','',t('studyRecognized')),el('p','',t('studySummary',{n:reviewQueue.length})));
      const b=el('button','primary',t('nextSpot'));b.onclick=nextStudy;summary.append(b);list.append(summary);$('callCount').textContent=t('floorReview');return;
    }
    const search=norm($('callSearch').value),all=$('allFloors').checked||!!search;
    const matching=calls().filter(l=>(all||l.floor===floor)&&matchesCall(l,search)&&(!favoritesOnly||config.favoriteCalls.includes(keyFor(l)))).sort((a,b)=>(selectedSite&&!search?siteDistance(a)-siteDistance(b):0)||callName(a).localeCompare(callName(b),config.language)||a.floor-b.floor);
    $('callCount').textContent=t('callCount',{n:matching.length})+' · '+(all?t('allFloors').toLowerCase():shortFloor(floor));
    for(const label of matching){
      const row=el('div','call-row'+(selected?.id===label.id?' selected':'')+(siteDistance(label)<floorWidth()*.18?' near-site':'')),main=el('button','call-main');
      main.title=callName(label)+' — '+floorName(label.floor);main.append(el('span','floor-badge',shortFloor(label.floor)));
      const name=el('span','call-name',callName(label));if(config.bilingual&&!label.custom&&callName(label)!==label.name)name.append(el('small','english-reference',label.name));if(aliasFor(label))name.append(el('small','team-reference',aliasFor(label)));if(label.custom)name.append(el('span','custom-badge',t('yourTeam')));else if(label.origins?.[config.language]==='segments')name.append(el('span','source-badge','≈'));main.append(name);main.onclick=()=>selectCall(label);
      const favorite=config.favoriteCalls.includes(keyFor(label)),star=el('button','call-star'+(favorite?' active':''),favorite?'★':'☆');
      star.setAttribute('aria-label',t(favorite?'favoriteRemove':'favoriteAdd',{name:callName(label)}));star.onclick=()=>toggleFavoriteCall(label);row.append(main,star);list.append(row);
    }
    if(!matching.length)list.append(el('div','empty-state',t(map.labels.length?'noCalls':'noSourceCalls')));
  }
  function originText(label){
    if(label.custom)return t('sourceCustom');
    const origin=label.origins?.[config.language];
    return t(origin==='segments'?'sourceSegments':origin==='nickname'?'sourceNickname':origin==='reference'?'sourceReference':'sourceExact',{lang:languageCode()});
  }
  function renderCallDetails(){
    const box=$('callDetails');box.hidden=!selected||mode==='study';if(box.hidden)return;
    $('callDetailTitle').textContent=callName(selected)+' · '+shortFloor(selected.floor);
    $('callEquivalents').replaceChildren();
    for(const lang of ['en','es','pt-br']){
      const row=el('div','equivalent-row');row.append(el('b','',languageCode(lang)),el('span','',callName(selected,lang)));$('callEquivalents').append(row);
    }
    $('callProvenance').textContent=originText(selected);$('aliasInput').value=aliasFor(selected);
  }
  function renderLayers(){
    $('layerList').replaceChildren();
    for(const [id,[,color]] of Object.entries(layers)){const name=t('layer_'+id);
      const exists=!!(byId(floor+'-'+id)||byId('bg-'+id));const label=el('label','layer-row'+(exists?'':' unavailable'));
      const dot=el('span','layer-dot');dot.style.borderColor=color;const input=el('input');input.type='checkbox';input.checked=config.layers[id];input.disabled=!exists;input.setAttribute('aria-label',name);
      input.onchange=()=>{config.layers[id]=input.checked;applyVisibility();save();document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));};
      label.append(dot,el('span','',name),input);if(!exists)label.title=t('missingLayer');$('layerList').append(label);
    }
  }
  function renderAnnotations(){
    if(!overlay)return;overlay.replaceChildren();
    for(const a of floorActions()){
      const g=node('g',{'data-action':a.id},overlay);
      if(a.kind==='pin'){
        const [x,y]=a.points[0];if(a.operator&&/^[a-z][a-z0-9-]{0,40}$/.test(a.operator)){operatorBadge(a.operator,x,y,g);}else node('circle',{cx:x,cy:y,r:3.5,fill:a.color,stroke:'#0b141b','stroke-width':.9},g);
        if(mode!=='study'){const t=node('text',{x:x+(a.operator?7:5),y:y+1.5,fill:a.color,'font-size':4.5,'font-family':'Segoe UI, sans-serif','font-weight':600,'paint-order':'stroke','stroke':'#101820','stroke-width':.9},g);t.textContent=a.label;}
        g.style.cursor='pointer';g.onclick=()=>{if(!recovery&&tool==='move'&&mode!=='study')selectCall({id:a.id,name:a.label,floor:a.floor,custom:true,action:a});};
      }else{
        node('polyline',{points:a.points.map(p=>p.join(',')).join(' '),fill:'none',stroke:a.color,'stroke-width':1.3,'stroke-linecap':'round','stroke-linejoin':'round'},g);
        if(a.kind==='line'&&a.points.length>1){const p=a.points.at(-1),prev=a.points.at(-2),angle=Math.atan2(p[1]-prev[1],p[0]-prev[0]);const points=[p,[p[0]-5*Math.cos(angle-.48),p[1]-5*Math.sin(angle-.48)],[p[0]-5*Math.cos(angle+.48),p[1]-5*Math.sin(angle+.48)]];node('polygon',{points:points.map(q=>q.join(',')).join(' '),fill:a.color},g);}
        if(a.operator&&/^[a-z][a-z0-9-]{0,40}$/.test(a.operator))operatorBadge(a.operator,a.points[0][0],a.points[0][1],g);
      }
    }
  }
  function operatorBadge(id,x,y,parent){
    const source=window.R6_OPERATOR_IMAGES?.[id];
    if(typeof source==='string'&&source.startsWith('data:image/webp;base64,')){
      node('circle',{cx:x,cy:y,r:18,fill:'transparent','pointer-events':'all','data-operator-handle':'',cursor:'grab'},parent);
      node('image',{x:x-5,y:y-5,width:10,height:10,href:source,'data-operator':id,'pointer-events':'none'},parent);
    }
    else{ensureOperatorModule().then(()=>window.R6Operators.asset(id)).catch(()=>{});}
  }
  document.addEventListener('r6-operator-ready',()=>renderAnnotations());
  function renderNotes(){
    $('floorNotes').value=config.notes[noteKey()]||'';$('notesSubtitle').textContent=mapName()+' / '+floorName(floor);$('annotationCount').textContent=floorActions().length;$('siteNotesBox').hidden=!selectedSite;$('siteNotes').value=selectedSite?(config.siteNotes[map.id+':'+selectedSite.id]||''):'';
    const list=$('annotationList');list.replaceChildren();
    floorActions().forEach(a=>{const row=el('div','annotation-row');const label=el('button','annotation-label',(a.kind==='pin'?'● '+a.label:a.kind==='line'?'↗ '+t('route'):'✎ '+t('freehand')));label.title=a.note||'';label.onclick=()=>{const p=a.points[0];focusPoint({x:p[0],y:p[1]});};const del=el('button','delete','×');del.setAttribute('aria-label',t('delete',{name:a.label||t('annotation')}));del.onclick=()=>removeAction(a.id);row.append(label,del);list.append(row);});
    if(!list.children.length)list.append(el('div','empty-state',t('noAnnotations')));
    renderCrew();renderChecklist();
    $('undoBtn').disabled=!floorActions().length;$('clearFloorBtn').disabled=!floorActions().length;
  }
  function addAction(a){if(selectedSite)a.site=selectedSite.id;actionList().push(a);save();renderAnnotations();renderNotes();renderCalls();}
  function removeAction(id){config.actions[map.id]=actionList().filter(a=>a.id!==id);save();renderAnnotations();renderNotes();renderCalls();}
  function setPanel(next){
    const focusedPanel=document.activeElement?.closest('.detail-panel');panel=next;
    ['calls','layers','notes'].forEach(id=>$(id+'Panel').hidden=id!==next);
    document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===next;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    if(focusedPanel?.id!==undefined&&focusedPanel.id!==next+'Panel')$(next+'Tab').focus({preventScroll:true});
  }
  function renderCallControls(){
    const studying=mode==='study';
    $('callBrowseControls').hidden=studying;$('studyOptions').hidden=!studying;
    for(const [id,key] of [['callsHeading',studying?'studyPanelTitle':'callsTitle'],['callsIntro',studying?'studyPanelIntro':'callsIntro'],['callsFoot',studying?'studyPanelFoot':'callFoot']]){
      $(id).dataset.i18n=key;$(id).textContent=t(key);
    }
  }
  function setTool(next){
    if(next==='operator'&&!operatorId){ensureOperatorModule().then(()=>window.R6Operators.open()).catch(()=>toast(t('operatorFailed')));return;}
    if(mode==='study'||recovery)return;
    tool=next;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===next));$('mapStage').style.cursor=next==='move'?'grab':'crosshair';
    $('modeHint').textContent=t('hint'+next[0].toUpperCase()+next.slice(1));
    if(next!=='move')setPanel('notes');
  }
  function setMode(next){
    if(recovery)endRecovery();mode=next;selected=null;selectionLayer?.replaceChildren();$('selectedTag').hidden=true;
    document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===next);b.setAttribute('aria-pressed',b.dataset.mode===next);});
    $('tools').hidden=next==='study';$('studyPrompt').hidden=next!=='study';
    renderCallControls();
    if(next==='study'){tool='move';setPanel('calls');studyTarget=null;studyLast=null;sessionKnown=0;sessionAgain=0;reviewQueue=[];challenge={attempts:0,correct:0,resolved:false};applyVisibility();nextStudy();$('modeHint').textContent=t(config.studyKind==='locate'?'challengeHint':'hintStudy');}
    else{setTool('move');applyVisibility();if(next==='plan')setPanel('notes');renderCalls();}
  }
  function renderStudyText(){
    if(mode!=='study')return;
    const locate=config.studyKind==='locate';$('challengeStats').hidden=!locate;$('challengeStats').textContent=t('challengeStats',{good:challenge.correct,tries:challenge.attempts});$('studyAgain').hidden=locate;$('studyKnown').textContent=t(locate?'nextSpot':'known');$('revealBtn').textContent=t(locate?'challengeAnswer':'reveal');
    const revealed=$('revealBtn').hidden;
    $('studyPrompt').querySelector('small').textContent=t(locate?'challengeIntro':'studyPrompt');
    $('studyName').textContent=studyTarget?((revealed||config.studyKind==='locate')?callName(studyTarget):t('question')):t('noStudy');
    $('studyNames').hidden=!revealed||!studyTarget;
    $('studyNames').replaceChildren();
    if(revealed&&studyTarget){
      for(const language of ['en','es','pt-br'])$('studyNames').append(el('div','',languageCode(language)+' · '+callName(studyTarget,language)));
      $('studyNames').append(el('small','',originText(studyTarget)));
    }
  }
  function nextStudy(){
    if(!svg)return;
    const available=calls().filter(l=>l.floor===floor&&(!config.studyFavorites||config.favoriteCalls.includes(keyFor(l))));
    reviewQueue=reviewQueue.filter(id=>available.some(l=>l.id===id));
    if(!available.length){challenge.resolved=true;$('challengeFeedback').hidden=true;studyTarget=null;$('studyName').textContent=t('noStudy');$('revealBtn').disabled=true;$('revealBtn').hidden=false;selectionLayer.replaceChildren();$('studyRating').hidden=true;$('studyNames').hidden=true;renderCalls();return;}
    const due=reviewQueue.find(id=>id!==studyLast||available.length===1);
    if(due&&(sessionKnown+sessionAgain)%3===0){studyTarget=available.find(l=>l.id===due);reviewQueue=reviewQueue.filter(id=>id!==due);}
    else{const candidates=available.filter(l=>l.id!==studyLast);const pool=candidates.length?candidates:available;studyTarget=pool[Math.floor(Math.random()*pool.length)];}
    challenge.resolved=false;$('challengeFeedback').hidden=true;studyLast=studyTarget.id;$('revealBtn').hidden=false;$('revealBtn').disabled=false;$('studyRating').hidden=true;renderStudyText();
    if(config.studyKind==='locate'){fitFloor();selectionLayer.replaceChildren();}else focusPoint(callPoint(studyTarget));renderCalls();
  }
  function answerChallenge(point){
    if(!studyTarget||challenge.resolved)return;
    challenge.attempts++;
    const tolerance=Math.max(8,floorWidth()*.055),same=calls().filter(l=>l.floor===floor&&l.name===studyTarget.name);
    const correct=same.some(l=>{const p=callPoint(l);return p&&Math.hypot(p.x-point.x,p.y-point.y)<=tolerance;});
    markPoint(point,correct?'#79caae':'#ef775b');$('challengeFeedback').hidden=false;$('challengeFeedback').textContent=t(correct?'challengeCorrect':'challengeWrong');
    if(correct){challenge.correct++;challenge.resolved=true;$('studyRating').hidden=false;$('revealBtn').hidden=true;}
    renderStudyText();renderCalls();
  }
  function download(content,name,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  async function exportView(){
    if(!svg)return;await ensureOperatorImages();const copy=svg.cloneNode(true);copy.querySelector('[data-breach="recovery"]')?.remove();copy.setAttribute('width','1920');copy.setAttribute('height','1080');copy.setAttribute('xmlns',NS);
    const box=view.slice();copy.setAttribute('viewBox',box.join(' '));const background=node('rect',{x:box[0],y:box[1],width:box[2],height:box[3],fill:'#10171c'});copy.insertBefore(background,copy.firstChild);
    download(new XMLSerializer().serializeToString(copy),'R6-flamingo-strat-'+map.id+'-'+shortFloor(floor)+'-'+config.language+'.svg','image/svg+xml');toast(t('viewExported'));
  }
  function shareSVG(){
    const copy=svg.cloneNode(true);copy.querySelector('[data-breach="recovery"]')?.remove();copy.setAttribute('xmlns',NS);copy.setAttribute('width','2000');copy.setAttribute('height','1125');copy.setAttribute('viewBox',view.join(' '));
    copy.insertBefore(node('rect',{x:view[0],y:view[1],width:view[2],height:view[3],fill:'#10171c'}),copy.firstChild);return new XMLSerializer().serializeToString(copy);
  }
  function shareNotes(){return [config.notes[noteKey()]||'',selectedSite?config.siteNotes[map.id+':'+selectedSite.id]||'':'',...floorActions().filter(a=>a.note).map(a=>a.label+': '+a.note),preparationText()].filter(Boolean).join('\n\n');}
  async function exportRaster(kind){
    if(!svg||updateBusy)return;updateBusy=true;toast(t('exporting'));
    try{await ensureOperatorImages();if(kind==='pdf'){pdfLoader ||= loadAssetScript('vendor/jspdf.umd.min.js');await pdfLoader;}const canvas=await window.BreachModules.rasterize(shareSVG()),title=mapName()+' / '+floorName(floor),subtitle=[selectedSite?t('siteNumber',{n:selectedSite.id}):t('allSites'),languageCode(),'r'+map.revision].join(' · '),visible=Object.keys(layers).filter(id=>config.layers[id]&&(byId(floor+'-'+id)||byId('bg-'+id))&&!(mode==='study'&&id==='txt')).map(id=>t('layer_'+id));
      const name='R6-flamingo-strat-'+map.id+'-'+shortFloor(floor)+'-'+config.language;
      if(kind==='pdf')download(window.BreachModules.makePDF(canvas.toDataURL('image/jpeg',.9),title,subtitle,visible,shareNotes(),t),name+'.pdf','application/pdf');
      else{const output=window.BreachModules.makePNG(canvas,title,subtitle,visible,shareNotes(),t),blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(new Error()),'image/png'));download(blob,name+'.png','image/png');}
      toast(t('exportDone'));
    }catch{if(kind==='pdf')pdfLoader=null;toast(t('exportFailed'));}finally{updateBusy=false;}
  }
  function exportPlan(){download(JSON.stringify(planPacket(),null,2),'R6-flamingo-strat-plan-'+map.id+'-'+shortFloor(floor)+'.json','application/json');}
  function archiveActions(m,actions= config.actions[m.id]||[]){const item={id:crypto.randomUUID(),revision:m.revision,sourceSha256:m.sourceSha256,created:new Date().toISOString(),actions:JSON.parse(JSON.stringify(actions))};config.annotationArchives[m.id]=[item,...(config.annotationArchives[m.id]||[])].slice(0,6);return item.id;}
  async function importPlan(e){const file=e.target.files[0];if(!file)return;try{if(file.size>12*1024*1024)throw {code:'badPlan'};await reviewPlan(JSON.parse(await file.text()));}catch(error){toast(t(error.code||'badPlan'));}e.target.value='';}
  function updateError(error){toast(t(error.code||'badUpdate'));$('updateStatus').textContent=t(error.code||'badUpdate');}
  async function openUpdates(){
    pendingUpdate=null;$('updatePreview').hidden=true;$('remoteUpdates').replaceChildren();$('updateStatus').textContent='';$('currentRevision').textContent=mapName()+' · '+t('currentRevision',{revision:map.revision});$('updatesDialog').showModal();await renderUpdateHistory();
  }
  async function renderUpdateHistory(){
    const list=$('updateHistory');list.replaceChildren();let record;
    try{if(window.BreachModules.updates.available)record=await window.BreachModules.updates.get(map.id);}catch{}
    for(const [index,item] of (record?.previous||[]).entries()){const row=el('div','revision-row');row.append(el('span','',item.at.slice(0,10)));const button=el('button','secondary',t('restoreRevision',{revision:item.metadata.revision}));button.onclick=()=>restoreUpdate(index);row.append(button);const compare=el('button','secondary',t('compare'));compare.onclick=()=>showComparison({metadata:item.metadata,svg:item.svg},{metadata:map,svg:window.R6_MAPS[map.id]});row.append(compare);if(item.actions?.length){const recover=el('button','secondary',t('recoverDrawings'));recover.onclick=()=>startRecovery({id:item.archiveId,revision:item.metadata.revision,actions:item.actions});row.append(recover);}if(item.actions?.length){const exportButton=el('button','secondary','JSON');exportButton.onclick=()=>download(JSON.stringify({app:'breach-strategy',version:1,map:{id:map.id,revision:item.metadata.revision,sourceSha256:item.metadata.sourceSha256},floor:item.actions[0].floor,data:{actions:{[map.id]:item.actions}}},null,2),'R6-flamingo-strat-historial-'+map.id+'-r'+item.metadata.revision+'.json','application/json');row.append(exportButton);}list.append(row);}
    if(!record?.previous?.length)list.append(el('p','',t('noHistory')));
    for(const item of config.annotationArchives[map.id]||[]){const row=el('div','revision-row');row.append(el('small','',t('revisionArchive',{revision:item.revision,n:item.actions.length})));const button=el('button','secondary','JSON');button.onclick=()=>download(JSON.stringify({app:'breach-strategy',version:1,date:item.created,map:{id:map.id,revision:item.revision,sourceSha256:item.sourceSha256},floor:item.actions[0]?.floor??floor,data:{actions:{[map.id]:item.actions}}},null,2),'R6-flamingo-strat-archivo-'+map.id+'-r'+item.revision+'.json','application/json');list.append(row);row.append(button);if(item.actions.length){const recover=el('button','secondary',t('recoverDrawings'));recover.onclick=()=>startRecovery(item);row.append(recover);}}
  }
  async function previewUpdate(packet){
    const target=DATA.maps.find(m=>m.id===packet.map?.id);if(!target)throw {code:'badUpdate'};
    if(target.id!==map.id)await loadMap(target.id);
    pendingUpdate=await window.BreachModules.prepareUpdate(packet,map);$('updatePreview').hidden=false;$('updatePreviewTitle').textContent=t('updateReady',{map:mapName(),old:map.revision,next:pendingUpdate.metadata.revision});$('updateSource').textContent=t('updateSource',{date:pendingUpdate.date.slice(0,10)});$('updateImpact').textContent=t(pendingUpdate.changed?'changedPlan':'unchangedPlan');$('applyUpdate').disabled=!window.BreachModules.updates.available;$('currentRevision').textContent=mapName()+' · '+t('currentRevision',{revision:map.revision});$('updateStatus').textContent=window.BreachModules.updates.available?'':t('updateStorageFailed');diffCounts(window.BreachAdvanced.compareRevisions({metadata:map,svg:window.R6_MAPS[map.id]},{metadata:pendingUpdate.metadata,svg:pendingUpdate.svg}),$('updateDiffSummary'));await renderUpdateHistory();
  }
  async function importUpdate(e){const file=e.target.files[0];if(!file)return;try{await previewUpdate(await window.BreachModules.readUpdateFile(file));}catch(error){updateError(error);}e.target.value='';}
  async function applyUpdate(){
    if(!pendingUpdate||updateBusy)return;updateBusy=true;$('applyUpdate').disabled=true;
    try{const prior=JSON.parse(JSON.stringify(map)),oldSvg=window.R6_MAPS[map.id],archiveId=crypto.randomUUID();await window.BreachModules.updates.commit(prior,oldSvg,pendingUpdate,archiveId,config.actions[map.id]||[]);
      if(pendingUpdate.changed){const actions=JSON.parse(JSON.stringify(config.actions[map.id]||[]));config.annotationArchives[map.id]=[{id:archiveId,revision:prior.revision,sourceSha256:prior.sourceSha256,created:new Date().toISOString(),actions},...(config.annotationArchives[map.id]||[])].slice(0,6);config.actions[map.id]=[];}
      Object.assign(map,pendingUpdate.metadata);window.R6_MAPS[map.id]=pendingUpdate.svg;pendingUpdate=null;save();await loadMap(map.id);$('updatePreview').hidden=true;await renderUpdateHistory();$('currentRevision').textContent=t('currentRevision',{revision:map.revision});toast(t('updateApplied'));
    }catch(error){updateError(error);}finally{updateBusy=false;$('applyUpdate').disabled=false;}
  }
  async function restoreUpdate(index){
    if(updateBusy)return;updateBusy=true;
    try{const prior=JSON.parse(JSON.stringify(map)),archiveId=crypto.randomUUID(),chosen=await window.BreachModules.updates.restore(prior,window.R6_MAPS[map.id],index,archiveId,config.actions[map.id]||[]);
      config.annotationArchives[map.id]=[{id:archiveId,revision:prior.revision,sourceSha256:prior.sourceSha256,created:new Date().toISOString(),actions:JSON.parse(JSON.stringify(config.actions[map.id]||[]))},...(config.annotationArchives[map.id]||[])].slice(0,6);
      const archived=(config.annotationArchives[map.id]||[]).find(a=>a.id===chosen.archiveId);config.actions[map.id]=archived?JSON.parse(JSON.stringify(archived.actions)):Array.isArray(chosen.actions)?JSON.parse(JSON.stringify(chosen.actions)):prior.sourceSha256===chosen.metadata.sourceSha256?config.actions[map.id]||[]:[];
      Object.assign(map,chosen.metadata);window.R6_MAPS[map.id]=chosen.svg;save();await loadMap(map.id);await renderUpdateHistory();$('currentRevision').textContent=t('currentRevision',{revision:map.revision});toast(t('restored'));
    }catch(error){updateError(error);}finally{updateBusy=false;}
  }
  async function checkUpdates(){
    if(location.protocol==='file:'){$('updateStatus').textContent=t('localUpdateHelp');return;}
    $('updateStatus').textContent=t('checkingUpdates');$('remoteUpdates').replaceChildren();
    try{const response=await fetch(new URL('updates/catalog.json',location.href),{cache:'no-store'});if(!response.ok)throw new Error();const catalog=await response.json();let count=0;
      for(const entry of catalog.maps||[]){const installed=DATA.maps.find(m=>m.id===entry.id);if(!installed||entry.revision<=installed.revision||typeof entry.file!=='string')continue;const url=new URL(entry.file,new URL('updates/',location.href));if(url.origin!==location.origin||!url.pathname.endsWith('.json.gz'))continue;
        count++;const button=el('button','secondary',mapName(installed)+' · '+t('updateDownload',{revision:entry.revision}));button.onclick=async()=>{try{const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw {code:'updateNetworkFailed'};await previewUpdate(await window.BreachModules.readUpdateFile(await res.blob()));}catch(error){updateError(error);}};$('remoteUpdates').append(button);}
      $('updateStatus').textContent=count?t('updateSource',{date:catalog.date?.slice(0,10)||''}):t('noUpdates');
    }catch{$('updateStatus').textContent=t('updateNetworkFailed');}
  }
  const safeBackup=window.R6Validation.createValidator(DATA,baseRevisions,t);

  $('mapSearch').oninput=renderMaps;$('callSearch').oninput=renderCalls;$('allFloors').onchange=renderCalls;
  $('languageSelect').onchange=()=>{if(!['en','es','pt-br'].includes($('languageSelect').value))return;config.language=$('languageSelect').value;applyLanguage();save();};
  $('bilingual').onchange=()=>{config.bilingual=$('bilingual').checked;renderHeader();renderCalls();save();};
  $('labelSize').oninput=()=>{config.labelSize=Number($('labelSize').value);$('labelSizeValue').textContent=config.labelSize+'%';renderMapNames();save();};
  $('studyFavorites').onchange=()=>{config.studyFavorites=$('studyFavorites').checked;reviewQueue=[];studyLast=null;if(mode==='study')nextStudy();save();};
  $('saveAliasBtn').onclick=()=>{if(!selected)return;const value=$('aliasInput').value.trim();if(value)config.aliases[keyFor(selected)]=value;else delete config.aliases[keyFor(selected)];save();renderCalls();toast(t('aliasSaved'));};
  $('starredCalls').onclick=()=>{favoritesOnly=!favoritesOnly;$('starredCalls').classList.toggle('active',favoritesOnly);$('starredCalls').textContent=favoritesOnly?'★':'☆';renderCalls();};
  $('allMaps').onclick=()=>{favoriteMapsOnly=false;$('allMaps').classList.add('active');$('favoriteMaps').classList.remove('active');renderMaps();};
  $('favoriteMaps').onclick=()=>{favoriteMapsOnly=true;$('allMaps').classList.remove('active');$('favoriteMaps').classList.add('active');renderMaps();};
  $('favoriteMapBtn').onclick=()=>{config.favoriteMaps=config.favoriteMaps.includes(map.id)?config.favoriteMaps.filter(id=>id!==map.id):[...config.favoriteMaps,map.id];save();renderMaps();renderHeader();};
  const detailTabs=[...document.querySelectorAll('[data-tab]')];
  detailTabs.forEach((b,i)=>{b.onclick=()=>setPanel(b.dataset.tab);b.onkeydown=e=>{
    const next=e.key==='ArrowRight'?detailTabs[(i+1)%detailTabs.length]:e.key==='ArrowLeft'?detailTabs[(i+detailTabs.length-1)%detailTabs.length]:e.key==='Home'?detailTabs[0]:e.key==='End'?detailTabs.at(-1):null;
    if(next){e.preventDefault();setPanel(next.dataset.tab);next.focus();}
  };});
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>b.dataset.tool==='operator'?openOperatorPicker():setTool(b.dataset.tool));
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.mode!==mode)setMode(b.dataset.mode);else setPanel(mode==='plan'?'notes':'calls');});
  $('restartStudy').onclick=()=>setMode('study');
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{
    const preset=b.dataset.preset;for(const id of Object.keys(layers))config.layers[id]=preset==='all'||(preset==='calls'?['txt','cmp','ip'].includes(id):!['sec','hst','lg','losw','losf'].includes(id));
    document.querySelectorAll('[data-preset]').forEach(p=>p.classList.toggle('active',p===b));applyVisibility();renderLayers();save();
  });
  function openOperatorPicker(){ensureOperatorModule().then(()=>window.R6Operators.open()).catch(()=>toast(t('operatorFailed')));}
  $('floorNotes').oninput=()=>{config.notes[noteKey()]=$('floorNotes').value;save();};
  $('undoBtn').onclick=()=>{const last=floorActions().at(-1);if(last)removeAction(last.id);};
  $('clearFloorBtn').onclick=()=>{const current=floorActions();if(!current.length)return;const ids=new Set(current.map(a=>a.id));config.actions[map.id]=actionList().filter(a=>!ids.has(a.id));save();renderAnnotations();renderNotes();renderCalls();toast(t('floorCleared'));};
  $('zoomIn').onclick=()=>zoom(.8);$('zoomOut').onclick=()=>zoom(1.25);$('fitBtn').onclick=fitFloor;$('contextBtn').onclick=()=>updateView(defaultView.slice());
  $('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('mapStage').requestFullscreen();}catch{toast(t('fullscreenError'));}};
  $('exportViewBtn').onclick=openShare;$('exportSVG').onclick=exportView;$('exportPNG').onclick=()=>exportRaster('png');$('exportPDF').onclick=()=>exportRaster('pdf');$('exportPlan').onclick=exportPlan;$('importPlan').onchange=importPlan;
  $('siteSelect').onchange=()=>chooseSite($('siteSelect').value);$('siteNotes').oninput=()=>{if(selectedSite){config.siteNotes[map.id+':'+selectedSite.id]=$('siteNotes').value;save();}};
  $('practiceKind').onchange=()=>{config.studyKind=$('practiceKind').value==='locate'?'locate':'recognize';save();setMode('study');};
  $('updatesBtn').onclick=openUpdates;$('checkUpdates').onclick=checkUpdates;$('importUpdate').onchange=importUpdate;$('applyUpdate').onclick=applyUpdate;
  $('helpBtn').onclick=()=>$('helpDialog').showModal();$('backupBtn').onclick=()=>$('backupDialog').showModal();
  $('sourcesBtn').onclick=()=>$('sourcesDialog').showModal();
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $('pinForm').onsubmit=e=>{
    e.preventDefault();const name=$('pinName').value.trim();if(!name||!pendingPin)return;
    addAction({id:crypto.randomUUID(),kind:'pin',floor,points:[[pendingPin.x,pendingPin.y]],label:name,note:$('pinNote').value.trim(),color:$('drawColor').value});$('pinDialog').close();pendingPin=null;toast(t('pinAdded'));
  };
  $('revealBtn').onclick=()=>{if(!studyTarget)return;$('revealBtn').hidden=true;$('studyRating').hidden=false;if(config.studyKind==='locate'){challenge.resolved=true;markPoint(callPoint(studyTarget));$('challengeFeedback').hidden=false;$('challengeFeedback').textContent=t('challengeRevealed');}renderStudyText();};
  $('studyKnown').onclick=()=>{if(!studyTarget)return;if(config.studyKind==='locate'){nextStudy();return;}reviewQueue=reviewQueue.filter(id=>id!==studyTarget.id);sessionKnown++;config.study.known=(config.study.known||0)+1;save();nextStudy();};
  $('studyAgain').onclick=()=>{if(!studyTarget)return;if(!reviewQueue.includes(studyTarget.id))reviewQueue.push(studyTarget.id);sessionAgain++;config.study.again=(config.study.again||0)+1;save();nextStudy();};
  $('exportBackup').onclick=()=>{download(JSON.stringify({app:'breach-r6-atlas',version:1,exported:new Date().toISOString(),data:config},null,2),'R6-flamingo-strat-respaldo-'+new Date().toISOString().slice(0,10)+'.json','application/json');toast(t('backupExported'));};
  $('importBackup').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>12*1024*1024)throw new Error(t('backupTooBig'));const incoming=safeBackup(JSON.parse(await file.text()));
      config.favoriteMaps=[...new Set([...config.favoriteMaps,...incoming.favoriteMaps])];config.favoriteCalls=[...new Set([...config.favoriteCalls,...incoming.favoriteCalls])];config.notes={...config.notes,...incoming.notes};config.siteNotes={...config.siteNotes,...incoming.siteNotes};for(const m of DATA.maps)if(incoming.annotationArchives[m.id].length)config.annotationArchives[m.id]=[...incoming.annotationArchives[m.id],...(config.annotationArchives[m.id]||[])].slice(0,6);
      config.aliases={...config.aliases,...incoming.aliases};config.teamTasks={...config.teamTasks,...incoming.teamTasks};config.checklists={...config.checklists,...incoming.checklists};Object.assign(config,incoming.preferences);
      for(const m of DATA.maps){const prior=incoming.actionRevisions[m.id];if(incoming.actions[m.id].length&&prior.sourceSha256!==m.sourceSha256){archiveActions({...m,...prior},incoming.actions[m.id]);continue;}const known=new Set((config.actions[m.id]||[]).map(a=>a.id));config.actions[m.id]=[...(config.actions[m.id]||[]),...incoming.actions[m.id].filter(a=>!known.has(a.id))];}
      applyLanguage();renderAnnotations();if(mode==='study')nextStudy();save();$('backupDialog').close();toast(t('backupImported'));
    }catch(error){toast(error.message||t('backupFailed'));}e.target.value='';
  };

  function scopeKey(){return map.id+':'+(selectedSite?'site-'+selectedSite.id:'floor-'+floor);}
  function scopeCaption(){return mapName()+' · '+(selectedSite?t('siteNumber',{n:selectedSite.id}):floorName(floor));}
  function team(){const key=scopeKey();if(!Array.isArray(config.teamTasks[key]))config.teamTasks[key]=Array.from({length:5},()=>({name:'',task:'',point:null,done:false}));while(config.teamTasks[key].length<5)config.teamTasks[key].push({name:'',task:'',point:null,done:false});return config.teamTasks[key];}
  function checklistKey(){return selectedSite?map.id+':'+selectedSite.id:null;}
  function checklist(){const key=checklistKey();return key?(config.checklists[key]||(config.checklists[key]=[])):[];}
  function taskSpot(task){return task.point?calls().find(l=>l.id===task.point.id&&l.floor===task.point.floor):null;}
  function renderCrew(){
    const list=$('crewList');list.replaceChildren();
    team().slice(0,5).forEach((task,index)=>{
      const card=el('div','player-card');card.append(el('b','',t('playerN',{n:index+1})));
      const name=el('input');name.type='text';name.maxLength=60;name.placeholder=t('playerName');name.setAttribute('aria-label',t('playerN',{n:index+1})+' · '+t('playerName'));name.value=task.name||'';name.oninput=()=>{task.name=name.value.slice(0,60);save();};
      const text=el('textarea');text.maxLength=600;text.placeholder=t('playerTask');text.setAttribute('aria-label',t('playerN',{n:index+1})+' · '+t('playerTask'));text.value=task.task||'';text.oninput=()=>{task.task=text.value.slice(0,600);save();};
      const select=el('select');select.setAttribute('aria-label',t('taskLocation'));const none=el('option','',t('noLocation'));none.value='';select.append(none);
      for(const l of calls().slice().sort((a,b)=>a.floor-b.floor||callName(a).localeCompare(callName(b),config.language))){const option=el('option','',shortFloor(l.floor)+' · '+callName(l));option.value=l.floor+':'+l.id;select.append(option);}
      const pointValue=task.point?task.point.floor+':'+task.point.id:'';if(pointValue&&!taskSpot(task)){const missing=el('option','',t('missingLocation'));missing.value=pointValue;select.append(missing);}select.value=pointValue;
      const go=el('button','quiet',t('goLocation'));go.disabled=!taskSpot(task);go.onclick=()=>{const spot=taskSpot(task);if(spot)selectCall(spot);};select.onchange=()=>{const option=calls().find(l=>l.floor+':'+l.id===select.value);task.point=option?{id:option.id,floor:option.floor}:null;go.disabled=!option;save();};
      const done=el('label'),check=el('input');check.type='checkbox';check.checked=task.done===true;check.onchange=()=>{task.done=check.checked;save();};done.append(check,el('span','',t('taskDone')));card.append(name,text,select,go,done);list.append(card);
    });
  }
  function renderChecklist(){
    const items=checklist(),list=$('checkList');list.replaceChildren();$('checkText').disabled=!selectedSite;$('addCheck').disabled=!selectedSite;$('resetCheck').disabled=!items.length;$('checkContext').textContent=selectedSite?t('checkProgress',{done:items.filter(x=>x.done).length,total:items.length}):t('chooseChecklist');
    for(const item of items){const row=el('div','check-row'+(item.done?' done':'')),done=el('input'),text=el('input'),remove=el('button','delete','×');done.type='checkbox';done.checked=item.done===true;done.setAttribute('aria-label',t('taskDone')+' · '+item.text);done.onchange=()=>{item.done=done.checked;save();renderChecklist();};text.type='text';text.maxLength=300;text.value=item.text;text.setAttribute('aria-label',t('checkItem'));text.oninput=()=>{item.text=text.value.slice(0,300);save();};remove.setAttribute('aria-label',t('delete',{name:item.text}));remove.onclick=()=>{config.checklists[checklistKey()]=items.filter(x=>x.id!==item.id);save();renderChecklist();};row.append(done,text,remove);list.append(row);}
    if(selectedSite&&!items.length)list.append(el('p','section-hint',t('checkEmpty')));
  }
  function preparationText(){
    const lines=[];team().forEach((task,i)=>{if(!task.name&&!task.task&&!task.point)return;const spot=taskSpot(task);lines.push((task.done?'[x] ':'[ ] ')+(task.name||t('playerN',{n:i+1}))+': '+(task.task||'')+(spot?' — '+callName(spot)+' / '+shortFloor(spot.floor):task.point?' — '+t('missingLocation'):''));});
    const checks=checklist();if(checks.length)lines.push('',t('checkTitle'),...checks.map(item=>(item.done?'[x] ':'[ ] ')+item.text));return lines.join('\n');
  }
  function planPacket(){
    const assigned=team(),linkedPins=actionList().filter(a=>a.kind==='pin'&&assigned.some(task=>task.point?.id===a.id&&task.point.floor===a.floor)),drawings=[...new Map([...floorActions(),...linkedPins].map(a=>[a.id,a])).values()];
    const data={layers:{...config.layers},teamTasks:{[scopeKey()]:JSON.parse(JSON.stringify(assigned))},checklists:selectedSite?{[checklistKey()]:JSON.parse(JSON.stringify(checklist()))}:{},notes:{[noteKey()]:config.notes[noteKey()]||''},siteNotes:selectedSite?{[map.id+':'+selectedSite.id]:config.siteNotes[map.id+':'+selectedSite.id]||''}:{},actions:{[map.id]:drawings},aliases:Object.fromEntries(Object.entries(config.aliases).filter(([k])=>k.startsWith(map.id+':'+floor+':')))};
    return {app:'breach-strategy',version:1,date:new Date().toISOString(),map:{id:map.id,revision:map.revision,sourceSha256:map.sourceSha256},floor,view:view.slice(),site:selectedSite?.id||'',language:config.language,data};
  }
  async function pngBlob(){await ensureOperatorImages();const source=shareSVG(),title=mapName()+' / '+floorName(floor),subtitle=scopeCaption()+' · '+languageCode()+' · r'+map.revision,notes=shareNotes(),visible=Object.keys(layers).filter(id=>config.layers[id]&&(byId(floor+'-'+id)||byId('bg-'+id))&&!(mode==='study'&&id==='txt')).map(id=>t('layer_'+id));const canvas=await window.BreachModules.rasterize(source),output=window.BreachModules.makePNG(canvas,title,subtitle,visible,notes,t);return new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(new Error()),'image/png'));}
  async function copyField(id){const field=$(id);try{if(!field.value)return;await navigator.clipboard.writeText(field.value);toast(t('copied'));}catch{field.focus();field.select?.();toast(t('copyManual'));}}
  function openShare(){
    $('shareBase').value=config.shareBase||(/^https:/.test(location.href)?location.href.split('#')[0].split('?')[0]:'');$('planLinkOutput').value='';$('linkStatus').textContent='';$('discordStatus').textContent='';$('discordMessage').value=discordText();$('shareDialog').showModal();
  }
  function generateLink(){try{const base=$('shareBase').value.trim();$('planLinkOutput').value=window.BreachAdvanced.planLink(planPacket(),base);config.shareBase=base;save();$('linkStatus').textContent=base?'':t('localCode');}catch(error){$('linkStatus').textContent=t(error.code||'badShareURL');}}
  function discordText(){const notes=[preparationText(),config.notes[noteKey()]||'',selectedSite?config.siteNotes[map.id+':'+selectedSite.id]||'':''].filter(Boolean).join('\n\n');return ('R6- flamingo/strat · '+scopeCaption()+(selectedSite?' · '+floorName(floor):'')+' · r'+map.revision+'\n\n'+notes).slice(0,1850);}
  async function sendDiscord(){
    if(discordBusy)return;let url;try{url=window.BreachAdvanced.webhookURL($('discordWebhook').value.trim()).href;}catch{ $('discordStatus').textContent=t('badWebhook');return;}
    const message=$('discordMessage').value.trim();if(!message){$('discordStatus').textContent=t('discordIntro');return;}
    discordBusy=true;$('sendDiscord').disabled=true;$('discordStatus').textContent=t('sendingDiscord');const snapshot=planPacket(),files=[];
    try{if($('attachPNG').checked)files.push({name:'R6-flamingo-strat-'+snapshot.map.id+'.png',blob:await pngBlob()});if($('attachJSON').checked)files.push({name:'R6-flamingo-strat-plan-'+snapshot.map.id+'.json',blob:new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'})});await window.BreachAdvanced.sendWebhook(url,message,files);$('discordStatus').textContent=t('discordSent');$('discordWebhook').value='';}
    catch(error){$('discordStatus').textContent=t(error.code||'discordFailed');}finally{discordBusy=false;$('sendDiscord').disabled=false;}
  }
  async function reviewPlan(raw){
    let prepared;try{prepared=window.R6Validation.reviewPlan(raw,DATA,safeBackup);}catch{throw {code:'badPlan'};}const {target,incoming,mismatch}=prepared;await ensureMapLabels(target);
    receivedPlan={raw,incoming,target,mismatch};$('receivedPlanTitle').textContent=mapName(target)+' · r'+raw.map.revision+' · '+floorName(raw.floor,target);const tasks=Object.values(incoming.teamTasks).flat().filter(x=>x.name||x.task||x.point),checks=Object.values(incoming.checklists).flat();$('receivedPlanCounts').textContent=t('previewCounts',{drawings:incoming.actions[target.id].length,tasks:tasks.length,checks:checks.length});$('receivedPlanImpact').textContent=mismatch?t('planReviewMismatch'):t('planReviewCompatible');
    const lines=[...Object.values(incoming.notes),...Object.values(incoming.siteNotes),...tasks.map((x,i)=>(x.done?'[x] ':'[ ] ')+(x.name||t('playerN',{n:i+1}))+': '+x.task+(x.point?' · '+x.point.floor+'F / '+(target.labels.find(l=>l.id===x.point.id)?.names?.[config.language]||x.point.id):'')),...checks.map(x=>(x.done?'[x] ':'[ ] ')+x.text),...incoming.actions[target.id].map(a=>shortFloor(a.floor,target)+' · '+(a.kind==='pin'?a.label:a.kind==='line'?t('route'):t('freehand')))];$('receivedPlanDetails').textContent=lines.join('\n').slice(0,100000);$('planPreviewDialog').showModal();
  }
  async function acceptPlan(){
    if(roomMap){toast(t('roomMapLocked'));return;}
    if(!receivedPlan)return;const {raw,incoming,target,mismatch}=receivedPlan;receivedPlan=null;
    config.notes={...config.notes,...incoming.notes};config.siteNotes={...config.siteNotes,...incoming.siteNotes};config.aliases={...config.aliases,...incoming.aliases};config.teamTasks={...config.teamTasks,...incoming.teamTasks};config.checklists={...config.checklists,...incoming.checklists};
    const actions=incoming.actions[target.id];if(mismatch)archiveActions({...target,revision:raw.map.revision,sourceSha256:raw.map.sourceSha256},actions);else{const known=new Set((config.actions[target.id]||[]).map(a=>a.id));config.actions[target.id]=[...(config.actions[target.id]||[]),...actions.filter(a=>!known.has(a.id))];}
    config.sites[target.id]=(target.sites||[]).some(s=>s.id===raw.site)?raw.site:'';floor=raw.floor;for(const id of Object.keys(layers))if(typeof raw.data.layers?.[id]==='boolean')config.layers[id]=raw.data.layers[id];await loadMap(target.id);if(!mismatch&&Array.isArray(raw.view)&&raw.view.length===4&&raw.view.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)&&raw.view[2]>0&&raw.view[3]>0)updateView(raw.view);save();$('planPreviewDialog').close();$('shareDialog').close();toast(t(mismatch?'planMismatch':'planImported'));
  }
  async function reviewReceived(){try{await reviewPlan(window.BreachAdvanced.decodePlan($('receivedPlan').value));}catch(error){toast(t(error.code||'badPlan'));}}
  async function receiveHash(){try{const code=new URLSearchParams((location.hash||'').slice(1)).get('plan');if(code)await reviewPlan(window.BreachAdvanced.decodePlan(code));}catch(error){toast(t(error.code||'badPlan'));}}
  function diffCounts(report,parent){parent.replaceChildren();for(const [field,key] of [['added','addedCalls'],['removed','removedCalls'],['renamed','renamedCalls'],['moved','movedCalls'],['bombs','changedBombs']])parent.append(el('span','',t(key,{n:report[field].length})));}
  function showComparison(before,after){
    comparison={before,after,report:window.BreachAdvanced.compareRevisions(before,after)};const select=$('compareFloor');select.replaceChildren();for(const f of [...new Set([...before.metadata.floors,...after.metadata.floors])].sort((a,b)=>a-b)){const option=el('option','',String(f)+'F');option.value=String(f);select.append(option);}select.value=String(after.metadata.floors.includes(floor)?floor:after.metadata.floors[0]);$('compareBefore').textContent=t('compareBefore',{n:before.metadata.revision});$('compareAfter').textContent=t('compareAfter',{n:after.metadata.revision});diffCounts(comparison.report,$('compareCounts'));renderComparison();$('compareDialog').showModal();
  }
  function comparisonSVG(record,f,box,side){
    const root=new DOMParser().parseFromString(record.svg,'image/svg+xml').documentElement;root.removeAttribute('width');root.removeAttribute('height');root.setAttribute('viewBox',box.join(' '));root.setAttribute('aria-label',mapName(record.metadata)+' '+f+'F');
    for(const g of [...root.children])if(g.localName==='g'){const match=/^Floor (-?\d+)$/.exec(g.id);if(match){const show=Number(match[1])===f;g.style.display=show?'inline':'none';g.setAttribute('display',show?'inline':'none');}else if(g.id.startsWith('bg')){g.style.display='none';g.setAttribute('display','none');}}
    for(const g of root.querySelectorAll('g'))if(new RegExp('^'+f+'-[a-z]+$').test(g.id)){const id=g.id.split('-').at(-1);if(id in layers){const show=['txt','bmb'].includes(id)||config.layers[id];g.style.display=show?'inline':'none';g.setAttribute('display',show?'inline':'none');}}
    for(const label of record.metadata.labels){const text=[...root.querySelectorAll('text')].find(e=>e.id===label.id);if(!text)continue;const spans=[...text.querySelectorAll('tspan')].filter(e=>!e.querySelector('tspan'));if(spans.length){spans[0].textContent=callName(label);for(const span of spans.slice(1))span.textContent='';}else text.textContent=callName(label);}
    const marks=node('g',{'pointer-events':'none'},root),r=Math.max(3,box[2]/100);const mark=(p,color)=>{if(p)node('circle',{cx:p.x,cy:p.y,r,fill:color+'22',stroke:color,'stroke-width':r/5},marks);};
    for(const item of comparison.report[side==='old'?'removed':'added'])if(item.label.floor===f)mark(item.point,side==='old'?'#ef775b':'#79caae');
    for(const item of comparison.report.moved){const l=side==='old'?item.before:item.after;if(l.floor===f)mark(side==='old'?item.from:item.to,'#f5cf55');}
    for(const item of comparison.report.bombs){const b=side==='old'?item.before:item.after;if(b?.floor===f)mark(side==='old'?item.from:item.to,!item.before?'#79caae':!item.after?'#ef775b':'#f5cf55');}return document.importNode(root,true);
  }
  function renderComparison(){
    if(!comparison)return;const f=Number($('compareFloor').value),bounds=[window.BreachAdvanced.floorBounds(comparison.before.svg,f),window.BreachAdvanced.floorBounds(comparison.after.svg,f)].filter(Boolean);let box;
    if(bounds.length){const minX=Math.min(...bounds.map(b=>b[0])),minY=Math.min(...bounds.map(b=>b[1])),maxX=Math.max(...bounds.map(b=>b[0]+b[2])),maxY=Math.max(...bounds.map(b=>b[1]+b[3])),pad=(maxX-minX)*.07;box=[minX-pad,minY-pad,maxX-minX+pad*2,maxY-minY+pad*2];}else box=String(comparison.after.metadata.viewBox).split(/[ ,]+/).map(Number);
    $('compareOldMap').replaceChildren(comparisonSVG(comparison.before,f,box,'old'));$('compareNewMap').replaceChildren(comparisonSVG(comparison.after,f,box,'new'));const details=$('compareDetails');details.replaceChildren();const report=comparison.report;
    for(const item of report.added)details.append(el('p','', '+ '+callName(item.label)+' · '+item.label.floor+'F'));for(const item of report.removed)details.append(el('p','', '− '+callName(item.label)+' · '+item.label.floor+'F'));for(const item of report.renamed)details.append(el('p','',callName(item.before)+' → '+callName(item.after)));for(const item of report.moved)details.append(el('p','', '↔ '+callName(item.after)+' · '+item.before.floor+'F → '+item.after.floor+'F'));for(const item of report.bombs)details.append(el('p','',item.id+' · '+(item.before?.floor??'−')+'F → '+(item.after?.floor??'−')+'F'));if(!details.children.length)details.append(el('p','',t('compareNoChanges')));
  }
  function pendingComparison(){if(pendingUpdate)showComparison({metadata:JSON.parse(JSON.stringify(map)),svg:window.R6_MAPS[map.id]},{metadata:pendingUpdate.metadata,svg:pendingUpdate.svg});}
  function remainingRecovery(){return recovery?recovery.archive.actions.filter(a=>!actionList().some(existing=>existing.migratedFrom?.archiveId===recovery.archive.id&&existing.migratedFrom?.actionId===a.id)):[];}
  function startRecovery(archive){
    if(!archive.actions?.length)return;setMode('plan');recovery={archive:JSON.parse(JSON.stringify(archive)),target:null,current:null};if(!remainingRecovery().length){recovery=null;toast(t('recoveryEmpty'));return;}$('updatesDialog').close();$('tools').hidden=true;$('recoveryBar').hidden=false;renderRecovery();
  }
  function renderRecovery(){
    if(!recovery)return;const items=remainingRecovery();if(!items.length){endRecovery();toast(t('recoveryEmpty'));return;}
    const select=$('recoverItem'),previous=recovery.current?.id;select.replaceChildren();for(const [i,a] of items.entries()){const option=el('option','',shortFloor(a.floor)+' · '+(a.kind==='pin'?a.label:a.kind==='line'?t('route'):t('freehand'))+' '+(i+1));option.value=a.id;select.append(option);}recovery.current=items.find(a=>a.id===previous)||items[0];select.value=recovery.current.id;recovery.target={x:recovery.current.points[0][0],y:recovery.current.points[0][1]};
    const floors=$('recoverFloor');floors.replaceChildren();for(const f of map.floors){const option=el('option','',floorName(f));option.value=String(f);floors.append(option);}floors.value=String(floor);$('recoveryOrigin').textContent=t('recoveryOrigin',{revision:recovery.archive.revision,n:items.length});$('reviewPosition').checked=false;$('commitRecovery').disabled=true;renderRecoveryGhost();
  }
  function renderRecoveryGhost(){
    recoveryLayer?.remove();recoveryLayer=null;if(!recovery||!svg)return;
    recoveryLayer=node('g',{'data-breach':'recovery','pointer-events':'none'},svg);const moved=window.BreachAdvanced.relocate(recovery.current,recovery.target,floor,selectedSite?.id,recovery.archive.id,recovery.archive.revision);node('polyline',{points:moved.points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#d5a6ec','stroke-width':1.5,'stroke-dasharray':'3 2'},recoveryLayer);const p=moved.points[0];node('circle',{cx:p[0],cy:p[1],r:5,fill:'#d5a6ec44',stroke:'#d5a6ec','stroke-width':1.2},recoveryLayer);if(moved.kind==='pin'){const text=node('text',{x:p[0]+7,y:p[1],fill:'#d5a6ec','font-size':5,'font-family':'Segoe UI, sans-serif'},recoveryLayer);text.textContent=moved.label;}
  }
  function placeRecovery(p){if(!recovery)return;recovery.target={x:p.x,y:p.y};$('reviewPosition').checked=false;$('commitRecovery').disabled=true;renderRecoveryGhost();}
  function commitRecovery(){if(!recovery||!$('reviewPosition').checked)return;const a=window.BreachAdvanced.relocate(recovery.current,recovery.target,floor,selectedSite?.id,recovery.archive.id,recovery.archive.revision);addAction(a);renderRecovery();toast(t('recoveryAdded'));}
  function endRecovery(){recovery=null;recoveryLayer?.remove();recoveryLayer=null;$('recoveryBar').hidden=true;$('tools').hidden=mode==='study';}

  $('checkForm').onsubmit=e=>{e.preventDefault();if(!selectedSite)return;const text=$('checkText').value.trim();if(!text)return;if(checklist().length>=40){toast(t('checkLimit'));return;}checklist().push({id:crypto.randomUUID(),text:text.slice(0,300),done:false});$('checkText').value='';save();renderChecklist();};
  $('resetCheck').onclick=()=>{checklist().forEach(item=>item.done=false);save();renderChecklist();};
  $('makeLink').onclick=generateLink;$('copyLink').onclick=()=>copyField('planLinkOutput');$('previewReceived').onclick=reviewReceived;$('confirmPlan').onclick=acceptPlan;
  $('prepareMessage').onclick=()=>{$('discordMessage').value=discordText();};$('copyMessage').onclick=()=>copyField('discordMessage');$('sendDiscord').onclick=sendDiscord;
  $('compareUpdate').onclick=pendingComparison;$('compareFloor').onchange=renderComparison;
  $('recoverItem').onchange=()=>{if(!recovery)return;recovery.current=remainingRecovery().find(a=>a.id===$('recoverItem').value);if(recovery.current)renderRecovery();};
  $('recoverFloor').onchange=()=>{if(recovery)changeFloor(Number($('recoverFloor').value));};$('keepPosition').onclick=()=>{if(recovery)placeRecovery({x:recovery.current.points[0][0],y:recovery.current.points[0][1]});};$('reviewPosition').onchange=()=>{$('commitRecovery').disabled=!recovery||!$('reviewPosition').checked;};$('commitRecovery').onclick=commitRecovery;$('finishRecovery').onclick=endRecovery;
  $('shareDialog').addEventListener('close',()=>{$('discordWebhook').value='';});
  $('planPreviewDialog').addEventListener('close',()=>{receivedPlan=null;});
  window.addEventListener('hashchange',receiveHash);
  const stage=$('mapStage');
  stage.addEventListener('wheel',e=>{if(!svg)return;e.preventDefault();zoom(e.deltaY>0?1.1:1/1.1,pointFromEvent(e));},{passive:false});
  stage.addEventListener('pointerdown',e=>{
    if(!svg||e.button!==0||e.target.closest('button,input,select,textarea,.canvas-tools,.zoom-tools,.study-prompt,.recovery-bar'))return;
    const p=pointFromEvent(e),handle=mode!=='study'&&!recovery?e.target.closest('[data-operator-handle]'):null;
    const action=handle?floorActions().find(a=>a.id===handle.closest('[data-action]')?.getAttribute('data-action')):null;
    pointer={id:e.pointerId,start:p,startClient:[e.clientX,e.clientY],startTarget:e.target,view:view.slice(),moved:false,points:[[p.x,p.y]],action,originalPoints:action?action.points.map(q=>q.slice()):null};stage.setPointerCapture(e.pointerId);
    if(tool!=='move'&&tool!=='pin'&&tool!=='operator')pointer.preview=node('polyline',{points:p.x+','+p.y,fill:'none',stroke:$('drawColor').value,'stroke-width':1.3,'stroke-linecap':'round','stroke-linejoin':'round'},overlay);
  });
  stage.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    if(Math.hypot(e.clientX-pointer.startClient[0],e.clientY-pointer.startClient[1])>4)pointer.moved=true;
    if(pointer.action){
      if(pointer.moved){const p=pointFromEvent(e),dx=p.x-pointer.start.x,dy=p.y-pointer.start.y;pointer.action.points=pointer.originalPoints.map(([x,y])=>[x+dx,y+dy]);renderAnnotations();}
    }else if(tool==='move'){
      const ctm=svg.getScreenCTM().inverse(),start=svg.createSVGPoint(),now=svg.createSVGPoint();start.x=pointer.startClient[0];start.y=pointer.startClient[1];now.x=e.clientX;now.y=e.clientY;const a=start.matrixTransform(ctm),b=now.matrixTransform(ctm);updateView([pointer.view[0]-(b.x-a.x),pointer.view[1]-(b.y-a.y),pointer.view[2],pointer.view[3]]);
    }else if(pointer.preview){const p=pointFromEvent(e);if(tool==='line')pointer.points=[pointer.points[0],[p.x,p.y]];else if(Math.hypot(p.x-pointer.points.at(-1)[0],p.y-pointer.points.at(-1)[1])>.3)pointer.points.push([p.x,p.y]);pointer.preview.setAttribute('points',pointer.points.map(q=>q.join(',')).join(' '));}
  });
  stage.addEventListener('pointerup',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;const current=pointer;pointer=null;current.preview?.remove();
    if(current.action&&current.moved){save();renderAnnotations();renderNotes();renderCalls();}
    else if(current.action){if(current.action.kind==='pin')selectCall({id:current.action.id,name:current.action.label,floor:current.action.floor,custom:true,action:current.action});}
    else if(recovery&&!current.moved&&tool==='move')placeRecovery(current.start);
    else if(tool==='operator'&&!current.moved&&operatorId){addAction({id:crypto.randomUUID(),kind:'pin',operator:operatorId,label:window.R6Operators.name(operatorId),note:operatorNote,floor,points:[[current.start.x,current.start.y]],color:$('drawColor').value});}
    else if(tool==='pin'&&!current.moved){pendingPin=current.start;$('pinName').value='';$('pinNote').value='';$('pinDialog').showModal();$('pinName').focus();}
    else if(current.preview&&current.moved&&current.points.length>1)addAction({id:crypto.randomUUID(),kind:tool,floor,points:current.points,color:$('drawColor').value,...(operatorRoutes&&operatorId&&tool==='line'?{operator:operatorId,label:window.R6Operators.name(operatorId),note:operatorNote}:{} )});
    else if(tool==='move'&&!current.moved&&mode==='study'&&config.studyKind==='locate')answerChallenge(current.start);
    else if(tool==='move'&&!current.moved&&mode!=='study'){
      const text=current.startTarget.closest('text[data-call]'),custom=current.startTarget.closest('g[data-action]');
      const label=text?map.labels.find(l=>l.id===text.id):custom?calls().find(l=>l.id===custom.getAttribute('data-action')):null;
      if(label)selectCall(label);
    }
    if(current.moved && (tool==='move'||current.action)){
      const suppress=ev=>ev.stopImmediatePropagation();stage.addEventListener('click',suppress,{once:true,capture:true});
      setTimeout(()=>stage.removeEventListener('click',suppress,true),0);
    }
  });
  stage.addEventListener('pointercancel',()=>{if(pointer?.action&&pointer.originalPoints){pointer.action.points=pointer.originalPoints;renderAnnotations();}pointer?.preview?.remove();pointer=null;});
  document.addEventListener('keydown',e=>{
    if(e.target.matches('input,textarea,select')||document.querySelector('dialog[open]'))return;
    if(e.key==='/'){e.preventDefault();$('mapSearch').focus();}
    if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const index=map.floors.indexOf(floor),next=index+(e.key==='ArrowUp'?1:-1);if(map.floors[next]!==undefined)changeFloor(map.floors[next]);}
    if(e.key.toLowerCase()==='f')fitFloor();
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undoBtn').click();return;}
    if(!e.ctrlKey&&!e.metaKey){const tools={v:'move',p:'pin',l:'line',d:'pen'};if(e.key.toLowerCase()==='o')openOperatorPicker();else if(tools[e.key.toLowerCase()])setTool(tools[e.key.toLowerCase()]);}
    if(e.key==='Escape'){selected=null;selectionLayer?.replaceChildren();$('selectedTag').hidden=true;renderCallDetails();}
  });
  window.R6OperatorBridge={choose(id,note,routes){operatorId=id;operatorNote=String(note||'').slice(0,300);operatorRoutes=routes===true;setTool(id?'operator':'move');},current(){return {id:operatorId,note:operatorNote,routes:operatorRoutes};}};
  applyLanguage();setTool('move');renderMaps();await loadMap(map.id);receiveHash();

  function roomSnapshot(){
    const data={};for(const key of ['actions','notes','siteNotes','teamTasks','checklists','aliases'])data[key]=config[key];
    return {map:{id:map.id,revision:map.revision,sourceSha256:map.sourceSha256},floor,data};
  }
  function applyRoomData(data){
    const clean=safeBackup({app:'breach-r6-atlas',version:1,data});
    for(const key of ['notes','siteNotes','teamTasks','checklists','aliases']){
      for(const k of Object.keys(config[key]))if(k.startsWith(roomMap+':'))delete config[key][k];
      Object.assign(config[key],clean[key]);
    }
    config.actions[roomMap]=clean.actions[roomMap];
  }
  function refreshRoom(){
    const active=document.activeElement,identity=active?.id?{id:active.id}:active?.getAttribute('aria-label')?{label:active.getAttribute('aria-label')}:null;
    const start=active?.selectionStart,end=active?.selectionEnd;
    renderAnnotations();renderNotes();renderCalls();
    let replacement=identity?.id?$(identity.id):identity?.label?[...document.querySelectorAll('input,textarea,select')].find(e=>e.getAttribute('aria-label')===identity.label):null;
    if(replacement){replacement.focus({preventScroll:true});if(typeof start==='number'&&replacement.setSelectionRange)try{replacement.setSelectionRange(start,end);}catch{}}
  }
  window.R6TeamBridge={
    snapshot:roomSnapshot,
    async begin(meta,data,initialFloor){
      const target=DATA.maps.find(m=>m.id===meta.id);
      if(!target||target.revision!==meta.revision||target.sourceSha256!==meta.sourceSha256)throw new Error('roomRevision');
      if(roomMap)throw new Error('roomAlready');
      roomPersonal=JSON.parse(JSON.stringify(config));roomMap=meta.id;roomApplying=true;$('updatesBtn').disabled=true;$('backupBtn').disabled=true;
      try{applyRoomData(data);floor=target.floors.includes(initialFloor)?initialFloor:target.floors[0];await loadMap(target.id);if(map.id!==target.id)throw new Error('roomInvalid');save();}
      catch(error){config=roomPersonal;roomMap=null;roomPersonal=null;$('updatesBtn').disabled=false;$('backupBtn').disabled=false;await loadMap(config.map);throw error;}
      finally{roomApplying=false;}
    },
    apply(data){roomApplying=true;try{applyRoomData(data);refreshRoom();save();}finally{roomApplying=false;}},
    async end(){if(!roomMap)return;const personal=roomPersonal;roomMap=null;roomPersonal=null;config=personal;$('updatesBtn').disabled=false;$('backupBtn').disabled=false;floor=config.floor;await loadMap(config.map);applyLanguage();renderAnnotations();},
    packet(){const snapshot=roomSnapshot();const data=window.R6RoomCore.inflate(window.R6RoomCore.flatten(snapshot.data,map.id),map.id);return {app:'breach-strategy',version:1,date:new Date().toISOString(),map:snapshot.map,floor,view:view.slice(),site:selectedSite?.id||'',language:config.language,data};},
    export(packet){const value=packet||this.packet();download(JSON.stringify(value,null,2),'R6-flamingo-strat-team-'+value.map.id+'.json','application/json');},
  };

  document.dispatchEvent(new Event('r6-ready'));
})();
