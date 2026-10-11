import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import readline from 'node:readline/promises';
import {emitKeypressEvents} from 'node:readline';
import {loadConfig} from '../src/config.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),envFile=path.join(root,'.env');
try{process.loadEnvFile(envFile);}catch{}
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
async function ask(label,previous=''){const answer=await rl.question(label+(previous?' ['+previous+']':'')+': ');return answer.trim()||previous;}
async function hidden(){if(!process.stdin.isTTY){const terminal=readline.createInterface({input:process.stdin,output:process.stdout});const token=await terminal.question('Token del bot: ');terminal.close();return token.trim();}
 return new Promise((resolve,reject)=>{console.log('Token del bot (oculto; Enter conserva el anterior):');emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();let token='';const finish=()=>{process.stdin.off('keypress',key);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};function key(text,k){if(k?.ctrl&&k.name==='c'){finish();reject(new Error('Configuración cancelada.'));}else if(k?.name==='return'){finish();resolve(token.trim());}else if(k?.name==='backspace'){if(token.length){token=token.slice(0,-1);process.stdout.write('\b \b');}}else if(text&&!k?.ctrl&&!k?.meta){token+=text;process.stdout.write('*'.repeat(text.length));}}process.stdin.on('keypress',key);});
}
try{
 console.log('BREACH — CONFIGURAR DISCORD\nLos datos se guardan solo en .env de esta carpeta. No pegues el token en un chat.\n');
 const applicationId=await ask('Application ID',process.env.DISCORD_APPLICATION_ID),guildId=await ask('ID del servidor',process.env.DISCORD_GUILD_ID),defaultLanguage=await ask('Idioma por defecto (es/en/pt-br)',process.env.DEFAULT_LANGUAGE||'es'),website=await ask('URL HTTPS del Atlas (opcional)',process.env.ATLAS_URL||'');
 rl.close();const token=(await hidden())||process.env.DISCORD_TOKEN;const settings={DISCORD_TOKEN:token,DISCORD_APPLICATION_ID:applicationId,DISCORD_GUILD_ID:guildId,DEFAULT_LANGUAGE:defaultLanguage,ATLAS_URL:website},config=loadConfig(settings);
 await fs.writeFile(envFile,Object.entries(settings).map(([key,value])=>key+'='+JSON.stringify(value||'')).join('\n')+'\n',{mode:0o600});
 const permissions=(1n<<10n)|(1n<<11n)|(1n<<14n)|(1n<<15n)|(1n<<38n),invite=new URL('https://discord.com/oauth2/authorize');invite.search=new URLSearchParams({client_id:config.applicationId,scope:'bot applications.commands',permissions:String(permissions),guild_id:config.guildId,disable_guild_select:'true'});
 await fs.writeFile(path.join(root,'Invitar-Bot.txt'),'Abrí este enlace para instalar el bot en tu servidor:\n'+invite.href+'\n');
 console.log('Configuración guardada. Abrí Invitar-Bot.txt, instalá el bot, luego ejecutá Registrar-Comandos.bat e Iniciar-Bot.bat.');
}catch(error){rl.close();console.error(error.message==='Configuración cancelada.'?error.message:'Configuración incompleta. Comprobá los IDs, token y URL.');process.exitCode=1;}
