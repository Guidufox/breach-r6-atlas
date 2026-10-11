# Breach — Bot de Discord 1.0.0

29 mapas del Atlas, imágenes por piso con callouts EN/ES/PT-BR, bombas, búsqueda
por nombres/alias y controles para cambiar de piso e idioma. El instalador
incluye los mapas base y genera las 342 imágenes una sola vez; no se usa
un navegador ni se generan durante cada solicitud.

## Windows: primera instalación

1. Extraer **todo** el ZIP en una carpeta. No ejecutar desde el ZIP.
2. Instalar Node.js **24.17 o posterior** desde https://nodejs.org/ y abrir una
   ventana nueva si el instalador lo solicita.
3. Ejecutar **Instalar-Bot.bat**. Necesita Internet y descarga las dependencias
   fijadas en package-lock.json. Luego genera las imágenes de los 29 mapas;
   puede tardar unos minutos y muestra el progreso por mapa.
4. En https://discord.com/developers/applications crear una aplicación llamada
   Breach. Copiar **Application ID** de General Information. En Bot generar/copiar
   el token. No hace falta activar Message Content Intent, Server Members ni Presence.
5. En Discord activar Ajustes de usuario → Avanzado → Modo desarrollador.
   Clic derecho sobre tu servidor → Copiar ID del servidor.
6. Ejecutar **Configurar-Bot.bat**. Ingresar los dos IDs y pegar el token en el
   campo oculto. Dejar la URL del Atlas vacía mientras la web no esté publicada.
   No compartir .env ni el token por chat; se guardan solo en esta carpeta.
7. Abrir **Invitar-Bot.txt** y su enlace. Instalar el bot en tu servidor con los
   permisos solicitados: ver canal, enviar mensajes, adjuntar archivos, insertar
   enlaces y enviar en hilos. No requiere Administrador.
8. Ejecutar **Registrar-Comandos.bat**, luego **Iniciar-Bot.bat**.
   Mantener esa ventana abierta; Ctrl+C detiene el bot.
9. En tu servidor probar:

   /mapa mapa:Banco idioma:Español piso:Todos

   Elegir valores del autocompletado. /bot ofrece el mismo comando y /ayuda
   explica su uso. Si no se indica piso, envía todos. Sin idioma explícito usa
   el idioma de Discord si es EN/ES/PT-BR, o el idioma por defecto configurado.

## Cómo responde

- Cada piso tiene una imagen con nombres, marcadores A/B presentes y su revisión.
- Anterior/Siguiente, selector de piso, Todos y selector de idioma.
- Solo quien pidió el mapa puede cambiar esa respuesta; los demás pueden usar
  /mapa para tener la propia. Los controles también funcionan tras reiniciar.
- Usa búsqueda en los tres idiomas, sin distinguir tildes, y alias de mapas.
- 1F = planta baja; 2F = piso 1; B = sótano; RF = azotea. En el comando conviene
  seleccionar el piso desde las sugerencias para mantener esta referencia.
- Los callouts son las referencias comunitarias investigadas del Atlas. Los
  nombres pintados dentro de las capturas originales no se vuelven a dibujar.
- Los pisos sin callouts originales muestran una advertencia. District no
  tiene etiquetas originales ni pisos separados en R6Calls; se muestra su vista
  general y no se inventaron nombres.
- Las imágenes muestran todos los pares de bombas del piso, conservando el
  número de sitio y letras A/B de la fuente.

## Errores habituales

- Comando no aparece: comprobar Application ID/servidor, instalar la aplicación
  con applications.commands y ejecutar Registrar-Comandos.bat. Revisar permisos
  de comandos del rol/canal. El registro solo modifica /mapa, /bot y /ayuda.
- Bot offline: Iniciar-Bot.bat debe seguir abierto, con Internet; suspensión o
  apagado de la PC lo detienen. Para funcionamiento permanente se necesita hosting.
- Token inválido: regenerarlo en Bot y volver a Configurar-Bot.bat.
- No adjunta: comprobar Attach Files y Embed Links; los permisos del canal pueden
  sobrescribir los del rol. Un límite de archivo menor al tamaño de la imagen
  devuelve un aviso; no se informa éxito si Discord rechaza el mensaje.
- Interacción fallida: el bot confirma antes de leer los archivos. Una caída de
  conexión igualmente puede impedir responder. Volver a usar /mapa.
- Muchos clics: espera breve de 1,2 s por usuario. La biblioteca gestiona los
  límites de API; no se repiten automáticamente mensajes fallidos.
- No responde en otro servidor: esta versión está configurada para tu servidor.
  Cambiar el ID requiere registrar los comandos en el nuevo.

Verificar-Bot.bat comprueba configuración y archivos sin enviar mensajes.
No hay conexión probada con una cuenta real hasta configurar tu aplicación.

## Actualizar imágenes / desarrollo

Los mapas base son una copia del Atlas 1.3.0. La fecha del catálogo indica cuándo
se generaron las imágenes; no implica datos de R6Calls actualizados ese día.
No consultan la partida ni se actualizan solas desde R6Calls.
El bot no lee notas personales de tu navegador ni importa planes privados.

Para reconstruir desde los archivos confiables de una versión del Atlas:

    npm ci
    node tools/build-images.mjs "C:\\ruta\\a\\Breach"
    npm test

El constructor requiere las dependencias de desarrollo y conserva posiciones
vectoriales; incrusta PNG antes de renderizar, con una fuente incluida. Para
ejecutar el bot después de generar todas las imágenes basta npm ci --omit=dev.
Las revisiones instaladas dentro del navegador no modifican los archivos del
Atlas ni este catálogo: para incorporarlas hay que regenerar la fuente del
paquete y reconstruir las imágenes, revisando la salida.

En Linux/macOS: npm ci; node tools/build-images.mjs; copiar
.env.example a .env y completarlo; luego npm run register y npm start. Node.js 24.17+ y acceso a Discord necesarios.
ATLAS_URL permite agregar un botón a la futura web; no publica ni configura
GitHub, hosting ni dominio. Mantener .env fuera del repositorio.

## Créditos

Planos y referencias: R6Calls, DudeKiller y colaboradores; Rainbow Six Siege
y capturas: Ubisoft. Ver FUENTES-NOMBRES.txt y LICENSE-R6MAPS.txt. La licencia
MIT histórica no concede una licencia nueva a todos los materiales actuales.
Fuentes de desarrollo consultadas: documentación oficial de Discord y discord.js.
La tipografía DejaVu se distribuye con su licencia en tools/fonts.

Desde este repositorio, el generador usa los mapas de la carpeta superior. Ejecutar npm ci y npm run build:images dentro de discord-bot antes de iniciar o probar el bot.
