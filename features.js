'use strict';
(() => {
  const NS='http://www.w3.org/2000/svg', MAX_PACKET=96*1024*1024;
  function failure(code){const error=new Error(code);error.code=code;return error;}
  function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(failure('updateStorageFailed'));});}
  class UpdateStore {
    constructor(){this.database=null;this.available=false;}
    async open(){
      if(this.database)return this.database;
      if(typeof indexedDB==='undefined')throw failure('updateStorageFailed');
      const req=indexedDB.open('breach-map-revisions',1);
      req.onupgradeneeded=()=>{for(const name of ['meta','maps'])if(!req.result.objectStoreNames.contains(name))req.result.createObjectStore(name,{keyPath:'id'});};
      this.database=await request(req);this.available=true;return this.database;
    }
    async initialize(data){
      try{const db=await this.open(),rows=await request(db.transaction('meta','readonly').objectStore('meta').getAll());
        for(const row of rows){const known=data.maps.find(m=>m.id===row.id);if(known)Object.assign(known,row.metadata);}
      }catch{this.available=false;}
    }
    async get(id){const db=await this.open();return request(db.transaction('maps','readonly').objectStore('maps').get(id));}
    async save(id,metadata,svg,previous=[]){
      const db=await this.open();await new Promise((resolve,reject)=>{
        const tx=db.transaction(['meta','maps'],'readwrite');
        tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(failure('updateStorageFailed'));
        tx.objectStore('meta').put({id,metadata,updatedAt:new Date().toISOString()});
        tx.objectStore('maps').put({id,svg,previous:previous.slice(0,3)});
      });
    }
    async commit(current,oldSvg,update,archiveId,actions=[]){
      const before=await this.get(current.id);
      const previous=[{metadata:JSON.parse(JSON.stringify(current)),svg:oldSvg,archiveId,actions:JSON.parse(JSON.stringify(actions)),at:new Date().toISOString()},...(before?.previous||[])];
      await this.save(current.id,update.metadata,update.svg,previous);return previous;
    }
    async restore(current,oldSvg,index,archiveId,actions=[]){
      const record=await this.get(current.id),chosen=record?.previous?.[index];if(!chosen)throw failure('badUpdate');
      const previous=[{metadata:JSON.parse(JSON.stringify(current)),svg:oldSvg,archiveId,actions:JSON.parse(JSON.stringify(actions)),at:new Date().toISOString()},...record.previous.filter((_,i)=>i!==index)];
      await this.save(current.id,chosen.metadata,chosen.svg,previous);return chosen;
    }
  }
  function leafParts(text){
    let parts=[...text.querySelectorAll('tspan')].filter(p=>!p.querySelector('tspan')).map(p=>p.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
    if(!parts.length)parts=[text.textContent.replace(/\s+/g,' ').trim()];
    const half=parts.length/2;if(Number.isInteger(half)&&parts.slice(0,half).join('|')===parts.slice(half).join('|'))parts=parts.slice(0,half);
    return parts;
  }
  function translateParts(parts,dict){
    const translated=[];let start=0;
    while(start<parts.length){let found=false;for(let end=parts.length;end>start;end--){const key=parts.slice(start,end).join(' ');if(typeof dict[key]==='string'&&dict[key]){translated.push(dict[key]);start=end;found=true;break;}}
      if(!found)return null;
    }return translated.join(' · ');
  }
  function unsafeURLs(text){return [...text.matchAll(/url\(([^)]*)\)/gi)].some(m=>!m[1].trim().replace(/^['"]|['"]$/g,'').startsWith('#'));}
  function sanitizeSVG(raw){
    if(typeof raw!=='string'||raw.length>80*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(raw))throw failure('badUpdate');
    const doc=new DOMParser().parseFromString(raw,'image/svg+xml'),root=doc.documentElement;
    if(root.localName!=='svg'||root.namespaceURI!==NS||doc.querySelector('parsererror'))throw failure('badUpdate');
    const vb=(root.getAttribute('viewBox')||'').split(/[ ,]+/).map(Number);if(vb.length!==4||!vb.every(Number.isFinite)||vb[2]<=0||vb[3]<=0)throw failure('badUpdate');
    for(const e of [root,...root.querySelectorAll('*')]){
      if(['script','foreignObject','iframe','object','embed','a','animate','set','animateMotion','animateTransform'].includes(e.localName)){e.remove();continue;}
      for(const attr of [...e.attributes]){
        if(/^on/i.test(attr.name))e.removeAttribute(attr.name);
        if(unsafeURLs(attr.value))throw failure('badUpdate');
        if(attr.localName==='href'&&!attr.value.startsWith('#')&&!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(attr.value))throw failure('badUpdate');
      }
      if(e.localName==='style'&&(/@import|javascript:/i.test(e.textContent)||unsafeURLs(e.textContent)))throw failure('badUpdate');
      const style=e.getAttribute('style');if(style){if(/@import|javascript:/i.test(style)||unsafeURLs(style))throw failure('badUpdate');e.setAttribute('style',style.replace(/(?:shape-inside|white-space):[^;]*(?:;|$)/g,''));}
    }
    for(const attr of [...root.attributes])if(/^on/i.test(attr.name))root.removeAttribute(attr.name);
    return {root,svg:new XMLSerializer().serializeToString(root)};
  }
  async function prepareUpdate(packet,current){
    if(!packet||packet.app!=='breach-map-update'||packet.version!==1||packet.source!=='https://www.r6calls.com/'||!packet.map||packet.map.id!==current.id||!Number.isSafeInteger(packet.map.revision)||!packet.languages)throw failure('badUpdate');
    if(packet.map.revision<current.revision)throw failure('olderUpdate');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(packet.svg));
    const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
    if(packet.sourceSha256&&packet.sourceSha256!==hash)throw failure('badUpdate');
    const {root,svg}=sanitizeSVG(packet.svg),labels=[],floors=[],ids=new Set(),pairs={},auxiliary=[];
    for(const group of [...root.children]){
      const match=/^Floor (-?\d+)$/.exec(group.id);if(!match)continue;const floor=Number(match[1]);if(!Number.isInteger(floor)||floor<-1||floor>6||floors.includes(floor))throw failure('badUpdate');floors.push(floor);
      const textGroup=[...group.querySelectorAll('g')].find(g=>g.id===floor+'-txt');
      for(const text of textGroup?.querySelectorAll('text')||[]){
        const parts=leafParts(text),original=parts.join(' ');if(!original)continue;
        if(!text.id||ids.has(text.id)||original.length>500)throw failure('badUpdate');ids.add(text.id);
        const label={id:text.id,name:original==='Breifing'?'Briefing':original,floor,names:{},origins:{en:'r6calls'},aliases:[original]};label.names.en=label.name;
        for(const lang of ['es','pt-br']){
          const source=packet.languages[lang],dict=source?.calls;if(!dict||typeof dict!=='object'||Array.isArray(dict))throw failure('badUpdate');
          let name,origin;
          if(typeof dict[original]==='string'&&dict[original]){name=dict[original];origin='r6calls';}
          else if(original==='"L"'){name=original;origin='reference';}
          else{name=translateParts(parts,dict);origin=name?'segments':'reference';name=name||label.name;}
          if(current.id==='bank'&&original==='Banana'){label.aliases.push(name);name='Banana';origin='nickname';}
          if(name.length>500)throw failure('badUpdate');label.names[lang]=name;label.origins[lang]=origin;
        }
        label.aliases=[...new Set([...label.aliases,...Object.values(label.names)])];text.setAttribute('data-call',label.name);labels.push(label);
      }
      for(const marker of group.querySelectorAll('g')){const hit=/^bomb-(\d+)([AB])$/.exec(marker.id);if(hit&&marker.closest('g[id$="-bmb"]'))(pairs[hit[1]]||=[]).push({id:marker.id,letter:hit[2],floor});}
    }
    if(!floors.length||labels.length>5000)throw failure('badUpdate');
    for(const text of root.querySelectorAll('text')){
      if(ids.has(text.id)||!text.id)continue;const original=leafParts(text).join(' '),names={en:original};let kind;
      for(const lang of ['es','pt-br']){
        const source=packet.languages[lang];if(source.legend?.[original]){names[lang]=source.legend[original];kind='legend';}
        else if(source.spawns?.[original]){names[lang]=source.spawns[original];kind='spawn';}
        else if(original==='W'&&text.closest('g[id$="-cmp"]')){names[lang]='O';kind='compass';}
        else names[lang]=original;
      }if(kind)auxiliary.push({id:text.id,name:original,names,kind});
    }
    const metadata={...JSON.parse(JSON.stringify(current)),revision:packet.map.revision,floors,labels,auxiliary,sites:Object.entries(pairs).filter(([,p])=>p.length===2&&new Set(p.map(v=>v.letter)).size===2).sort((a,b)=>Number(a[0])-Number(b[0])).map(([id,markers])=>({id,markers:markers.sort((a,b)=>a.letter.localeCompare(b.letter))})),viewBox:root.getAttribute('viewBox'),sourceSha256:hash,updatedAt:typeof packet.date==='string'?packet.date.slice(0,40):new Date().toISOString()};
    for(const field of ['minFloorNumber','maxFloorNumber','scaleFactor'])if(Number.isFinite(packet.map[field]))metadata[field]=packet.map[field];
    if(!Number.isInteger(metadata.minFloorNumber)||!Number.isInteger(metadata.maxFloorNumber)||metadata.minFloorNumber<-1||metadata.maxFloorNumber>6||metadata.minFloorNumber>metadata.maxFloorNumber||!Number.isFinite(metadata.scaleFactor)||metadata.scaleFactor<=0)throw failure('badUpdate');
    return {metadata,svg:new XMLSerializer().serializeToString(root),changed:current.sourceSha256!==hash,date:metadata.updatedAt};
  }
  async function readUpdateFile(file){
    if(file.size>48*1024*1024)throw failure('badUpdate');let bytes=new Uint8Array(await file.arrayBuffer());
    if(bytes[0]===31&&bytes[1]===139){
      const chunks=[];let count=0;const decoder=new window.fflate.Gunzip((chunk)=>{count+=chunk.length;if(count>MAX_PACKET)throw failure('badUpdate');chunks.push(chunk);});
      for(let offset=0;offset<bytes.length;offset+=16384)decoder.push(bytes.subarray(offset,offset+16384),offset+16384>=bytes.length);
      const result=new Uint8Array(count);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}bytes=result;
    }
    if(bytes.length>MAX_PACKET)throw failure('badUpdate');try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw failure('badUpdate');}
  }
  async function rasterize(svg,width=2000,height=1125){
    return new Promise((resolve,reject)=>{
      const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
      image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.fillStyle='#10171c';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);resolve(canvas);}catch(error){reject(error);}finally{URL.revokeObjectURL(url);}};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(failure('exportFailed'));};image.src=url;
    });
  }
  function makePDF(jpeg,title,subtitle,layers,notes,t){
    const pdf=new window.jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4',compress:true});
    const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();
    pdf.setProperties({title:'Flamingo/Strat — '+title,author:'Guidufox — community project',subject:subtitle});pdf.setTextColor(24,32,38);pdf.setFontSize(19);pdf.text(title,30,34);pdf.setFontSize(10);pdf.text(subtitle,30,52);
    const mapH=Math.min(h-140,(w-60)*1125/2000);pdf.addImage(jpeg,'JPEG',30,66,w-60,mapH,undefined,'FAST');pdf.setFontSize(8);pdf.setTextColor(70,85,95);
    const legend=pdf.splitTextToSize(t('legendTitle')+': '+layers.join(' · '),w-60);pdf.text(legend.slice(0,3),30,h-61);
    if(notes.trim()){pdf.text(t('notesContinued'),30,h-24);pdf.setFontSize(10);const lines=pdf.splitTextToSize(notes,w-70),perPage=Math.floor((h-100)/13);for(let i=0;i<lines.length;i+=perPage){pdf.addPage();pdf.setTextColor(24,32,38);pdf.setFontSize(16);pdf.text(title+' — '+t('notes'),35,34);pdf.setFontSize(10);pdf.text(lines.slice(i,i+perPage),35,65,{lineHeightFactor:1.3});}}
    pdf.setFontSize(8);for(let p=1;p<=pdf.getNumberOfPages();p++){pdf.setPage(p);pdf.setTextColor(100,115,125);pdf.text('Flamingo/Strat · Community / not affiliated · R6Calls / Ubisoft · '+p+'/'+pdf.getNumberOfPages(),w-30,h-10,{align:'right'});}
    return pdf.output('arraybuffer');
  }
  function makePNG(mapCanvas,title,subtitle,layers,notes,t){
    const canvas=document.createElement('canvas');canvas.width=2000;canvas.height=1510;const c=canvas.getContext('2d');c.fillStyle='#10171c';c.fillRect(0,0,canvas.width,canvas.height);
    c.fillStyle='#f5cf55';c.font='bold 36px Segoe UI, Arial';c.fillText(title,45,52);c.fillStyle='#a3b8c7';c.font='21px Segoe UI, Arial';c.fillText(subtitle,45,88);c.drawImage(mapCanvas,30,110,1940,1091);
    c.fillStyle='#f5cf55';c.font='bold 17px Segoe UI, Arial';c.fillText(t('legendTitle'),45,1242);c.fillStyle='#adbfcc';c.font='18px Segoe UI, Arial';
    function wrap(text,y,maxLines){let line='',count=0;for(const word of text.split(/\s+/)){if(c.measureText(line+' '+word).width>1875){c.fillText(line,45,y);y+=25;count++;line=word;if(count>=maxLines)return y;}else line+=(line?' ':'')+word;}if(line)c.fillText(line,45,y);return y+25;}
    const y=wrap(layers.join(' · '),1272,2);wrap(notes.replace(/\n+/g,' · ').slice(0,1200),y+12,4);c.fillStyle='#7995a8';c.font='16px Segoe UI, Arial';c.fillText(t('pngNotesLimit'),45,1483);return canvas;
  }
  window.BreachModules={updates:new UpdateStore(),prepareUpdate,readUpdateFile,sanitizeSVG,rasterize,makePDF,makePNG,UpdateStore};
})();
