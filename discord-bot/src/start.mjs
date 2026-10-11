import {Client,Events,GatewayIntentBits} from 'discord.js';
import {loadConfig,safeError} from './config.mjs';
import {createHandler} from './handler.mjs';
import {catalog,ROOT} from './catalog.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
let client;
try{
 const config=loadConfig();for(const m of catalog.maps)for(const f of m.floors)for(const relative of Object.values(f.images))await fs.access(path.join(ROOT,'assets',relative));
 client=new Client({intents:[GatewayIntentBits.Guilds],allowedMentions:{parse:[]}});
 client.on(Events.InteractionCreate,createHandler(config,{onError:e=>console.error('Solicitud no completada. '+safeError(e))}));
 client.on(Events.Error,e=>console.error('Conexión: '+safeError(e)));
 client.once(Events.ClientReady,ready=>{console.log('Breach conectado como '+ready.user.tag+'. '+catalog.maps.length+' mapas, ES/EN/PT-BR.');console.log('Probá /mapa en tu servidor. Mantener esta ventana abierta. Ctrl+C para detener.');if(!ready.guilds.cache.has(config.guildId))console.log('El bot todavía no está en el servidor configurado: usá el enlace de invitación.');});
 await client.login(config.token);
 for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>{client.destroy();process.exit(0);});
}catch(error){client?.destroy();console.error(error.message?.startsWith('Configurá')||error.message?.startsWith('Falta')?error.message:'No se pudo iniciar. Revisá .env, archivos e Internet. '+safeError(error));process.exitCode=1;}
