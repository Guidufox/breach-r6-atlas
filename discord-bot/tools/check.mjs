import fs from 'node:fs/promises';
import path from 'node:path';
import {loadConfig} from '../src/config.mjs';
import {catalog,ROOT} from '../src/catalog.mjs';
try{loadConfig();let count=0;for(const m of catalog.maps)for(const f of m.floors)for(const relative of Object.values(f.images)){await fs.access(path.join(ROOT,'assets',relative));count++;}console.log('Configuración válida. '+catalog.maps.length+' mapas y '+count+' imágenes presentes. El token no se comprobó con Discord.');}
catch{console.error('Falta configuración o algún archivo. Extraé todo el ZIP y ejecutá Configurar-Bot.bat.');process.exitCode=1;}
