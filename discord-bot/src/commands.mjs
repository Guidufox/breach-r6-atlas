import {SlashCommandBuilder} from 'discord.js';
export function commands(){
 const mapCommand=name=>new SlashCommandBuilder().setName(name).setDescription('Mapas R6 con callouts por piso e idioma').setDescriptionLocalizations({'en-US':'R6 maps with callouts by floor and language','pt-BR':'Mapas R6 com callouts por andar e idioma'}).setDMPermission(false)
 .addStringOption(o=>o.setName('mapa').setDescription('Buscá el mapa: Banco, Bank, Casa…').setDescriptionLocalizations({'en-US':'Find a map: Bank, House…','pt-BR':'Busque o mapa: Banco, Residência…'}).setRequired(true).setAutocomplete(true))
 .addStringOption(o=>o.setName('idioma').setDescription('Idioma de los nombres en el plano').setDescriptionLocalizations({'en-US':'Language for map labels','pt-BR':'Idioma dos nomes na planta'}).addChoices({name:'Español',value:'es'},{name:'English',value:'en'},{name:'Português (Brasil)',value:'pt-br'}))
 .addStringOption(o=>o.setName('piso').setDescription('Un piso o todos; usá las sugerencias').setDescriptionLocalizations({'en-US':'One floor or all; use the suggestions','pt-BR':'Um andar ou todos; use as sugestões'}).setAutocomplete(true));
 return [mapCommand('mapa').toJSON(),mapCommand('bot').toJSON(),new SlashCommandBuilder().setName('ayuda').setDescription('Cómo usar Breach y consultar mapas').setDMPermission(false).toJSON()];
}
// Upsert only our named commands, preserving other application commands.
export async function registerCommands(rest,routes,config){
 const route=routes.applicationGuildCommands(config.applicationId,config.guildId),existing=await rest.get(route);
 for(const command of commands()){const old=existing.find(c=>c.name===command.name&&c.type===command.type);if(old)await rest.patch(routes.applicationGuildCommand(config.applicationId,config.guildId,old.id),{body:command});else await rest.post(route,{body:command});}
 return commands().map(c=>c.name);
}
