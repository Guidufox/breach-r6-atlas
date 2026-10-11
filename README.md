# R6- flamingo/strat

App portable y web para estudiar mapas y preparar estrategias de Rainbow Six Siege. Interfaz y callouts en inglés, español y portugués de Brasil, con referencias documentadas de R6Calls y nombres de mapas contrastados con Ubisoft.

Versión 1.3.0. 29 mapas y 2.943 etiquetas, capas tácticas, favoritos, notas, pines, rutas, selección de sitios A/B, desafío de ubicación, exportación SVG/PNG/PDF/JSON y revisión controlada de mapas con historial.

**PC:** extraer todo el ZIP y abrir `Abrir-Breach.bat` o `index.html`. Los mapas incluidos funcionan sin Internet.

**Web:** ver [PUBLICAR-WEB.md](PUBLICAR-WEB.md). Las herramientas de GitHub Pages publican solo los archivos estáticos de la app. No requiere un backend.

Para conservar datos al cambiar de carpeta, PC o navegador, exportar/importar un respaldo. Guardar aparte los paquetes de mapas actualizados.

Fuentes y licencias: [FUENTES-NOMBRES.txt](FUENTES-NOMBRES.txt), [LICENSE-R6MAPS.txt](LICENSE-R6MAPS.txt) y `vendor/LICENSE-*.txt`.

Tareas para cinco jugadores, checklist por sitio, comparación de revisiones, recuperación revisada de dibujos, compartir mediante Discord y enlaces/códigos con vista previa antes de importar. Tareas y listas incluidas en respaldos y exportaciones. La web está publicada en GitHub Pages con su dirección gratuita.

## Repositorio y web

Este repositorio reúne Breach R6 Atlas 1.3.0 y el bot Discord 1.0.0 en discord-bot/. La web funciona como sitio estático de GitHub Pages; el bot requiere Node.js y un proceso separado. Ver PUBLICAR-WEB.md para el estado de publicación.

Web pública: https://guidufox.github.io/breach-r6-atlas/
Repositorio: https://github.com/Guidufox/breach-r6-atlas

Paneles laterales: Mostrar/Ocultar mapas y Mostrar/Ocultar detalles funcionan por separado y recuerdan la elección en este navegador. En pantallas de hasta 800 px comienzan cerrados; cada panel tiene un botón para cerrar y volver al mapa. Las preferencias de PC y pantalla pequeña se guardan por separado.

Paneles laterales: controles con iconos y transición suave. En móvil se muestran como cajones sobre el mapa; se cierran con su botón, tocando el fondo o con Escape. Se respeta la preferencia de movimiento reducido.

Icono de Rainbow Six Siege: asset original de Ubisoft, obtenido de https://static-dm.ubisoft.com/siege/prod/r6x_favicon_144.png, usado en https://www.ubisoft.com/en-us/game/rainbow-six/siege (11 oct. 2026). Rainbow Six y su icono pertenecen a Ubisoft. Esta herramienta es un proyecto de la comunidad.

## Salas para cinco jugadores

El botón Equipo carga la colaboración bajo demanda. Crear sala comparte solo dibujos, notas, tareas, checklist y alias del mapa actual; no comparte otros mapas ni preferencias. El enlace permite editar: compartirlo solo con el equipo. Límite de cinco personas incluido el anfitrión. Los pisos y sitios se exploran de forma independiente; las ediciones se sincronizan al terminar cada trazo y con un breve retardo al escribir. Cambios en campos diferentes se combinan; en el mismo campo prevalece el último recibido por el anfitrión.

El trabajo personal queda separado y se restaura al salir. Descargar la táctica completa de la sala antes de salir; no hay persistencia en servidor. Tras una desconexión, la última táctica permanece descargable en memoria mientras no se recargue ni cierre esta página. El anfitrión debe permanecer conectado; cerrar su navegador termina la sesión. PeerJS 1.5.5 se incluye localmente, pero solo se carga cuando se conecta una sala. PeerJS Cloud ofrece señalización; los datos viajan mediante WebRTC entre navegadores. Algunas redes necesitan TURN, que esta versión no configura; no se garantiza conexión desde todas las redes. No incluye voz ni vídeo.

La publicación comprime únicamente los fondos raster de los planos con WebP, sin cambiar dimensiones ni SVG táctico. Los originales siguen en maps/ para el portable, actualizaciones y bot. tools/optimize_maps.py genera un informe de bytes gzip por mapa; el ahorro no equivale a una garantía de tiempo de carga.
