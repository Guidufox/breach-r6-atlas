import {REST,Routes} from 'discord.js';
import {loadConfig,safeError} from './config.mjs';
import {registerCommands} from './commands.mjs';
try{const config=loadConfig(),rest=new REST({version:'10'}).setToken(config.token);await registerCommands(rest,Routes,config);console.log('Listos en el servidor: /mapa, /bot, /ayuda.');}
catch(error){console.error('No se pudieron registrar los comandos. Revisá los IDs, el token y la invitación. '+safeError(error));process.exitCode=1;}
