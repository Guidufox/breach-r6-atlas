import {ActionRowBuilder,AttachmentBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder,MessageFlags,PermissionFlagsBits,StringSelectMenuBuilder} from 'discord.js';
import {catalog,LANGUAGES,localeLanguage,mapName,resolveMap,suggestMaps,floorLabel,resolveFloor,suggestFloors,readImage} from './catalog.mjs';
const words={
 es:{previous:'Anterior',next:'Siguiente',all:'Todos los pisos',floor:'Elegir piso',lang:'Elegir idioma',open:'Abrir Atlas',missing:'No encontré ese mapa. Usá las sugerencias de /mapa.',badFloor:'Ese piso no existe en el mapa. Elegí uno de las sugerencias.',noLabels:'Este piso no tiene callouts originales en la fuente.',source:'Callouts comunitarios · R6Calls / Ubisoft',owner:'Estos controles pertenecen a quien pidió el mapa. Usá /mapa para abrir el tuyo.',wait:'Esperá un segundo antes de volver a pedirlo.',permissions:'Necesito permiso para ver el canal, enviar mensajes, adjuntar archivos e insertar enlaces.',failed:'No pude completar el envío. Revisá los permisos y usá /mapa para intentar nuevamente.',big:'La imagen supera el límite de este canal. Probá otro piso o revisá el límite de archivos.',help:'Usá /mapa mapa:Banco idioma:Español piso:Todos. /bot es un alias. Elegí un piso con las sugerencias o usá los botones. 1F = planta baja; B = sótano; RF = azotea. El bot usa una copia revisada de R6Calls, no datos en vivo de tu partida.'},
 en:{previous:'Previous',next:'Next',all:'All floors',floor:'Choose floor',lang:'Choose language',open:'Open Atlas',missing:'Map not found. Use /mapa suggestions.',badFloor:'This floor is not available. Choose one of the suggestions.',noLabels:'This floor has no source callouts.',source:'Community callouts · R6Calls / Ubisoft',owner:'These controls belong to the person who requested the map. Use /mapa for your own.',wait:'Wait a second before trying again.',permissions:'I need permission to view the channel, send messages, attach files and embed links.',failed:'The send could not be completed. Check permissions and try /mapa again.',big:'The image exceeds the channel file limit. Try another floor or review the upload limit.',help:'Use /mapa mapa:Bank idioma:English piso:All. /bot is an alias. Choose floors using suggestions or buttons. 1F = ground floor; B = basement; RF = roof. Maps are a reviewed R6Calls snapshot, not live match data.'},
 'pt-br':{previous:'Anterior',next:'Próximo',all:'Todos os andares',floor:'Escolher andar',lang:'Escolher idioma',open:'Abrir Atlas',missing:'Mapa não encontrado. Use as sugestões de /mapa.',badFloor:'Este andar não existe. Escolha uma das sugestões.',noLabels:'Este andar não tem callouts originais na fonte.',source:'Callouts da comunidade · R6Calls / Ubisoft',owner:'Estes controles pertencem a quem pediu o mapa. Use /mapa para abrir o seu.',wait:'Espere um segundo antes de tentar novamente.',permissions:'Preciso de permissão para ver o canal, enviar mensagens, anexar arquivos e inserir links.',failed:'Não consegui concluir o envio. Confira as permissões e tente /mapa novamente.',big:'A imagem excede o limite do canal. Tente outro andar ou confira o limite de arquivos.',help:'Use /mapa mapa:Banco idioma:Português piso:Todos. /bot é um alias. Escolha um andar pelas sugestões ou botões. 1F = térreo; B = porão; RF = cobertura. Os mapas são uma cópia revisada do R6Calls, não dados da partida em tempo real.'}
};
export function controls(map,lang,floor,owner,website=''){
 const w=words[lang],i=map.floors.findIndex(f=>f.value===floor),id=(kind,value)=>['br1',kind,map.id,lang,value,owner].join(':');
 const nav=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(id('page',i>0?map.floors[i-1].value:floor??map.floors[0].value)).setLabel(w.previous).setStyle(ButtonStyle.Secondary).setDisabled(i<=0),new ButtonBuilder().setCustomId(id('page',i>=0&&i<map.floors.length-1?map.floors[i+1].value:floor??map.floors[0].value)).setLabel(w.next).setStyle(ButtonStyle.Secondary).setDisabled(i<0||i===map.floors.length-1),new ButtonBuilder().setCustomId(id('page','all')).setLabel(w.all).setStyle(ButtonStyle.Primary).setDisabled(floor===null));
 if(website)nav.addComponents(new ButtonBuilder().setURL(website).setLabel(w.open).setStyle(ButtonStyle.Link));
 const floors=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(id('floor',floor??'all')).setPlaceholder(w.floor).addOptions(map.floors.map(f=>({label:floorLabel(map,f.value,lang),value:String(f.value),default:f.value===floor}))));
 const languages=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(id('lang',floor??'all')).setPlaceholder(w.lang).addOptions(LANGUAGES.map(l=>({label:{es:'Español',en:'English','pt-br':'Português (Brasil)'}[l],value:l,default:l===lang}))));
 return [nav,floors,languages];
}
export function parseControl(customId,values=[]){
 const [version,kind,mapId,lang,value,owner,...extra]=customId.split(':');const map=resolveMap(mapId);
 if(version!=='br1'||extra.length||!map||!LANGUAGES.includes(lang)||!/^\d{17,20}$/.test(owner)||!['page','floor','lang'].includes(kind))return null;
 const chosen=kind==='floor'?values[0]:value,newLang=kind==='lang'?values[0]:lang;
 if(!LANGUAGES.includes(newLang))return null;const floor=chosen==='all'?null:Number(chosen);if(floor!==null&&!map.floors.some(f=>f.value===floor))return null;
 return {map,lang:newLang,floor,owner};
}
export async function payloads(map,lang,floor,owner,limit,website=''){
 const selected=floor===null?map.floors:map.floors.filter(f=>f.value===floor),max=Math.min(limit||8*1024*1024,8*1024*1024),groups=[];let group=[],size=0;
 for(const f of selected){const image=await readImage(map,f.value,lang);if(image.data.length>max)throw new Error('IMAGE_LIMIT');if(group.length===10||size+image.data.length>8*1024*1024){groups.push(group);group=[];size=0;}group.push({f,image});size+=image.data.length;}if(group.length)groups.push(group);
 if(!groups.length)throw new Error('IMAGE_MISSING');
 return groups.map((images,index)=>({
  content:'Breach · '+mapName(map,lang)+' · '+lang.toUpperCase()+' · r'+map.revision+' · '+catalog.built.slice(0,10)+(groups.length>1?' · '+(index+1)+'/'+groups.length:''),
  files:images.map(({image})=>new AttachmentBuilder(image.data,{name:image.name,description:mapName(map,lang)+' · '+lang.toUpperCase()})),
  attachments:[],
  embeds:images.map(({f,image})=>new EmbedBuilder().setColor(0xf5cf55).setTitle(mapName(map,lang)+' / '+floorLabel(map,f.value,lang)).setImage('attachment://'+image.name).setDescription(f.labelCount?f.labelCount+' callouts':words[lang].noLabels).setFooter({text:words[lang].source})),
  components:controls(map,lang,floor,owner,website),allowedMentions:{parse:[]}
 }));
}
export function createHandler(config,{clock=Date.now,onError=()=>{}}={}){
 const recent=new Map();
 return async interaction=>{
  const lang=localeLanguage(interaction.locale,config.defaultLanguage),ephemeral=content=>interaction.reply({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  try{
   if(interaction.guildId!==config.guildId)return;
   if(interaction.isAutocomplete()){
    const focused=interaction.options.getFocused(true),chosen=interaction.options.getString('idioma')||lang;
    const matches=focused.name==='mapa'?suggestMaps(focused.value,chosen):suggestFloors(resolveMap(interaction.options.getString('mapa')),focused.value,chosen);
    await interaction.respond(matches);return;
   }
   const command=interaction.isChatInputCommand(),component=interaction.isButton()||interaction.isStringSelectMenu();
   if(!command&&!component)return;
   if(command&&interaction.commandName==='ayuda'){await ephemeral(words[lang].help);return;}
   let requested;
   if(command){if(!['mapa','bot'].includes(interaction.commandName))return;const chosen=interaction.options.getString('idioma')||lang,map=resolveMap(interaction.options.getString('mapa'));if(!map){await ephemeral(words[chosen].missing);return;}const floor=resolveFloor(map,interaction.options.getString('piso'));if(floor===undefined){await ephemeral(words[chosen].badFloor);return;}requested={map,lang:chosen,floor,owner:interaction.user.id};}
   else {if(!interaction.customId.startsWith('br1:'))return;requested=parseControl(interaction.customId,interaction.values);if(!requested){await ephemeral(words[lang].failed);return;}if(requested.owner!==interaction.user.id){await ephemeral(words[lang].owner);return;}}
   const w=words[requested.lang],required=[PermissionFlagsBits.ViewChannel,interaction.channel?.isThread?.()?PermissionFlagsBits.SendMessagesInThreads:PermissionFlagsBits.SendMessages,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks];if(interaction.appPermissions&&!required.every(p=>interaction.appPermissions.has(p))){await ephemeral(w.permissions);return;}
   const key=interaction.user.id,now=clock();if(now-(recent.get(key)??-Infinity)<1200){await ephemeral(w.wait);return;}recent.set(key,now);if(recent.size>10000)for(const [id,time] of recent)if(now-time>5000)recent.delete(id);
   // Acknowledge before reading files. No image generation or web request here.
   if(command)await interaction.deferReply();else await interaction.deferUpdate();
   const list=await payloads(requested.map,requested.lang,requested.floor,requested.owner,interaction.attachmentSizeLimit,config.website);
   await interaction.editReply(list[0]);for(const next of list.slice(1)){const follow={...next};delete follow.attachments;await interaction.followUp(follow);}
  }catch(error){onError(error);const content=error.message==='IMAGE_LIMIT'?words[lang].big:words[lang].failed;try{if(interaction.deferred&&interaction.isChatInputCommand()){try{await interaction.editReply({content,embeds:[],components:[],attachments:[],allowedMentions:{parse:[]}});}catch{await interaction.followUp({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});}}else if(interaction.deferred||interaction.replied)await interaction.followUp({content,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});else await ephemeral(content);}catch{}}
 };
}
