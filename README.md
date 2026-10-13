# R6- flamingo/strat

Herramienta comunitaria para estudiar callouts y preparar tácticas de Rainbow Six Siege entre amigos y equipos de hasta cinco jugadores.

**Web:** https://guidufox.github.io/breach-r6-atlas/

No está afiliada, patrocinada ni aprobada por Ubisoft ni por R6Calls. Las marcas, mapas, nombres y emblemas ajenos pertenecen a sus respectivos titulares. El aviso y el uso gratuito no sustituyen las autorizaciones aplicables. [Créditos y derechos](docs/RIGHTS.md).

## Uso

- PC: abrir Abrir-Breach.bat o index.html con todos los archivos de la app juntos. Los mapas incluidos funcionan offline.
- Web: elegir mapa, piso, sitio e idioma (ES, EN o PT-BR). Los paneles se abren y cierran de forma independiente, con preferencias separadas para PC y móvil.
- Dibujos: pines, rutas y trazos; deshacer, notas, tareas para cinco jugadores y checklist por sitio. Emblemas de operadores disponibles bajo demanda, sin retratos. Se pueden asociar a nuevas rutas y exportar con la táctica.
- Estudio: reconocimiento y ubicación de callouts, favoritos y referencia en inglés. Los nombres comunitarios tienen procedencia documentada; no se anuncian como nombres oficiales del HUD.
- Exportaciones: SVG, PNG, PDF y planes JSON. Importaciones con validación y vista previa de planes antes de incorporarlos. Exportar un respaldo antes de mover trabajo a otro PC o navegador.
- Actualizaciones: revisiones y paquetes se revisan antes de instalarlos; los dibujos de versiones anteriores se archivan para recuperación manual.

## Equipo en directo

Equipo → Crear sala, o pegar una invitación → Entrar. Las salas usan un servicio HTTPS alojado por Sites; GitHub Pages aloja la interfaz. Hasta cinco participantes incluidos el creador. Se sincronizan dibujos terminados, notas, tareas, checklist y alias del mapa compartido. Cada persona explora pisos y sitios por separado. En campos distintos se combinan cambios; en el mismo campo prevalece el último recibido por el servidor.

El trabajo personal queda separado y se restaura al salir. Una sala dura hasta dos horas y la táctica admite hasta 1 MB. El creador puede salir sin cerrar la sala. Descargar la táctica completa del mapa para conservarla. Tras desconectarse, la última táctica queda descargable en memoria mientras no se cierre ni recargue la página. No hay voz ni vídeo. La conexión no se consulta al abrir el atlas si no se usa una sala.

## Rendimiento

La publicación comprime solo fondos raster WebP, sin cambiar dimensiones, etiquetas, geometría ni marcas tácticas del SVG. El ensayo inicial redujo 26,3% los bytes gzip de planos; no equivale a una garantía de tiempo de carga. Las etiquetas se cargan por mapa. Emblemas y exportador PDF se descargan cuando se necesitan. Los originales se conservan en maps/ para el portable y los paquetes de actualización.

## Documentación y mantenimiento

- [Privacidad](docs/PRIVACY.md), [derechos y contacto](docs/RIGHTS.md), [retirada de contenido](docs/TAKEDOWN.md).
- [Publicación](PUBLICAR-WEB.md), [revisión de temporadas](docs/MAINTENANCE.md), [SEO y métricas](docs/SEO.md).
- [Lanzamiento público: verificación y textos preparados](LANZAMIENTO.md).
- [English quick guide](docs/README-en.md), [guia em português](docs/README-pt-BR.md).
- Contacto público: https://github.com/Guidufox/breach-r6-atlas/issues/new.

El código original tiene licencia MIT (LICENSE); datos, emblemas y material de terceros se documentan por separado. FUENTES-NOMBRES.txt y LICENSE-R6MAPS.txt conservan las referencias del origen. No hay bot de Discord. El webhook opcional no se guarda y solo se usa al enviar explícitamente al canal elegido.

Responsable del proyecto y de revisar los cambios de cada temporada: **Guidufox**. No se afirma que una consulta automática de versiones certifique la vigencia de la jugabilidad.
