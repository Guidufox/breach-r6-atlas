import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {DOMParser} from 'linkedom';
import {Resvg} from '@resvg/resvg-js';
import sharp from 'sharp';
const root=fileURLToPath(new URL('../',import.meta.url));
const bundled=path.join(root,'map-source');
const defaultSource=await fs.access(bundled).then(()=>bundled,()=>path.resolve(root,'..'));
const source=path.resolve(process.argv[2]||defaultSource);
const font={loadSystemFonts:false,fontFiles:[path.join(root,'tools/fonts/DejaVuSans.ttf')],defaultFontFamily:'DejaVu Sans',sansSerifFamily:'DejaVu Sans'};
const ctx=vm.createContext({window:{R6_MAPS:{}},DOMParser});vm.runInContext(await fs.readFile(path.join(source,'data.js'),'utf8'),ctx,{timeout:1000});vm.runInContext(await fs.readFile(path.join(source,'advanced.js'),'utf8'),ctx,{timeout:1000});const data=ctx.window.R6_DATA,geometry=ctx.window.BreachAdvanced,NS='http://www.w3.org/2000/svg';
const out=path.join(root,'assets');await fs.mkdir(path.join(out,'images'),{recursive:true});
const only=process.argv[3]||'',previous=only?JSON.parse(await fs.readFile(path.join(out,'catalog.json'),'utf8')):null;
const languages=['es','en','pt-br'],catalog={version:1,atlasVersion:'1.3.0',built:new Date().toISOString(),source:'https://www.r6calls.com/',maps:[]},audit=only?JSON.parse(await fs.readFile(path.join(root,'tools/render-audit.json'),'utf8')).filter(row=>row.map!==only):[];
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function floorName(m,f,l){if(m.id==='district')return {es:'Vista general',en:'Overview','pt-br':'Visão geral'}[l];return f===-1?({es:'Subsótano',en:'Sub-basement','pt-br':'Subsolo inferior'}[l]):f===0?({es:'Sótano',en:'Basement','pt-br':'Porão'}[l]):f===m.maxFloorNumber&&f>1?({es:'Azotea',en:'Roof','pt-br':'Cobertura'}[l]):f===1?({es:'Planta baja',en:'Ground floor','pt-br':'Térreo'}[l]):({es:'Piso '+(f-1),en:'Floor '+f,'pt-br':'Andar '+(f-1)}[l]);}
function wrap(s,n){const lines=[];let line='';for(const word of s.split(/\s+/)){if(line&&(line+' '+word).length>n){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);return lines;}
function byId(svg,id){return [...svg.querySelectorAll('[id]')].find(e=>e.id===id);}
for(const m of data.maps){
 if(only&&m.id!==only){catalog.maps.push(previous.maps.find(x=>x.id===m.id));continue;}
 vm.runInContext(await fs.readFile(path.join(source,'maps',m.id+'.js'),'utf8'),ctx,{timeout:1000});let original=ctx.window.R6_MAPS[m.id];const doc=new DOMParser().parseFromString(original,'image/svg+xml'),svg=doc.documentElement;
 // resvg receives embedded PNGs only; rebuild is deterministic on Windows/Linux.
 const rasterCache=new Map();for(const image of svg.querySelectorAll('image')){const key=image.hasAttribute('xlink:href')?'xlink:href':'href',href=image.getAttribute(key)||'';if(!href.startsWith('data:image/'))throw new Error('External image rejected: '+m.id);let png=rasterCache.get(href);if(!png){png='data:image/png;base64,'+(await sharp(Buffer.from(href.split(',')[1],'base64')).png().toBuffer()).toString('base64');rasterCache.set(href,png);}image.setAttribute(key,png);}
 original=svg.outerHTML;const anchors=new Map();
 for(const label of [...m.labels,...(m.auxiliary||[])]){const e=byId(svg,label.id);if(!e)throw new Error('Missing label '+m.id+':'+label.id);const clone=e.cloneNode(true);clone.removeAttribute('transform');clone.setAttribute('font-family','DejaVu Sans');const fontSize=parseFloat(e.getAttribute('font-size')||e.style.fontSize)||16;const b=new Resvg('<svg xmlns="'+NS+'" width="10000" height="10000">'+clone.outerHTML+'</svg>',{font}).getBBox();if(!b)continue;anchors.set(label.id,{x:b.x+b.width/2,y:b.y+b.height/2,size:fontSize,max:Math.max(12,Math.min(26,Math.round(b.width/(fontSize*.55))))});}
 const item={id:m.id,names:m.names,aliases:m.aliases||[],revision:m.revision,sourceSha256:m.sourceSha256,maxFloorNumber:m.maxFloorNumber,labelCount:m.labels.length,floors:[]};
 for(const f of (m.floors.length?m.floors:[1])){const floor={value:f,labelCount:m.labels.filter(l=>l.floor===f).length,images:{},bytes:{}};
  for(const lang of languages){const scene=new DOMParser().parseFromString(original,'image/svg+xml').documentElement;
   for(const group of [...scene.children])if(group.localName==='g'){if(/^Floor -?\d+$/.test(group.id)){const show=group.id==='Floor '+f;group.setAttribute('display',show?'inline':'none');group.style.display=show?'inline':'none';}else if(group.id==='Background'&&m.floors.length){group.setAttribute('display','none');group.style.display='none';}}
   for(const group of scene.querySelectorAll('g[id]'))if(/^-?\d+-/.test(group.id)){const match=/^(-?\d+)-(.+)$/.exec(group.id),show=+match[1]===f&&['txt','bmb','pic','cmp'].includes(match[2]);group.setAttribute('display',show?'inline':'none');group.style.display=show?'inline':'none';}
   let localized=0;for(const label of [...m.labels,...(m.auxiliary||[])]){const e=byId(scene,label.id),a=anchors.get(label.id);if(!e||!a)continue;const name=label.names?.[lang]||label.name,lines=wrap(name,label.kind==='compass'?2:a.max);e.replaceChildren();e.setAttribute('x',a.x);e.setAttribute('y',a.y);e.setAttribute('text-anchor','middle');e.setAttribute('font-family','DejaVu Sans');e.setAttribute('font-size',a.size);e.style.fontSize=a.size+'px';e.setAttribute('fill','#ffffff');e.setAttribute('stroke','#10151a');e.setAttribute('stroke-width',Math.min(1.1,a.size*.065));e.setAttribute('paint-order','stroke fill');
    lines.forEach((line,i)=>{const span=scene.ownerDocument.createElementNS(NS,'tspan');span.setAttribute('x',a.x);span.setAttribute('y',a.y+(i-(lines.length-1)/2)*a.size*1.12+a.size*.32);span.textContent=line;e.append(span);});if(label.floor===f)localized++;
   }
   const bounds=geometry.floorBounds(original,f)||scene.getAttribute('viewBox').split(/[ ,]+/).map(Number),margin=Math.max(bounds[2],bounds[3])*.025,box=[bounds[0]-margin,bounds[1]-margin,bounds[2]+margin*2,bounds[3]+margin*2];
   const width=2200,height=Math.max(400,Math.round(width*box[3]/box[2]));scene.setAttribute('viewBox',box.join(' '));scene.setAttribute('width',width);scene.setAttribute('height',height);scene.setAttribute('x',0);scene.setAttribute('y',125);scene.removeAttribute('class');
   const title=(m.names?.[lang]||m.name)+' / '+floorName(m,f,lang),warning=floor.labelCount===0?({es:'Sin callouts originales en este piso.',en:'No source callouts on this floor.','pt-br':'Sem callouts originais neste andar.'}[lang]):({es:'Nombres comunitarios de R6Calls',en:'Community names from R6Calls','pt-br':'Nomes da comunidade do R6Calls'}[lang]);
   const frame='<svg xmlns="'+NS+'" xmlns:xlink="http://www.w3.org/1999/xlink" width="'+width+'" height="'+(height+215)+'"><rect width="100%" height="100%" fill="#10171d"/><text x="46" y="65" font-size="40" font-family="DejaVu Sans" fill="#f5cf55">'+escape(title)+'</text><text x="46" y="105" font-size="24" font-family="DejaVu Sans" fill="#c1ced8">Breach · '+lang.toUpperCase()+' · r'+m.revision+' · '+floor.labelCount+' callouts</text>'+scene.outerHTML+'<text x="46" y="'+(height+168)+'" font-size="22" font-family="DejaVu Sans" fill="#c1ced8">'+escape(warning)+'</text><text x="46" y="'+(height+199)+'" font-size="19" font-family="DejaVu Sans" fill="#8697a4">R6Calls / Ubisoft · Atlas 1.3.0 · '+catalog.built.slice(0,10)+'</text></svg>';
   const png=new Resvg(frame,{font,background:'#10171d'}).render().asPng();const jpeg=await sharp(png).jpeg({quality:91,chromaSubsampling:'4:4:4'}).toBuffer();if(jpeg.length>8*1024*1024)throw new Error('Image too large '+m.id);const relative='images/'+m.id+'-'+(f<0?'sub':f)+'-'+lang+'.jpg';await fs.writeFile(path.join(out,relative),jpeg);floor.images[lang]=relative;floor.bytes[lang]=jpeg.length;audit.push({map:m.id,floor:f,language:lang,labels:floor.labelCount,localized,width,height:height+215,bytes:jpeg.length});if(localized!==floor.labelCount)throw new Error('Incomplete labels '+m.id+' '+f+' '+lang);
  }item.floors.push(floor);
 }catalog.maps.push(item);delete ctx.window.R6_MAPS[m.id];console.log(m.id+': '+item.floors.length+' pisos × 3 idiomas');
}
await fs.writeFile(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');await fs.writeFile(path.join(root,'tools/render-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log('Ready: '+audit.length+' images, '+catalog.maps.length+' maps.');
