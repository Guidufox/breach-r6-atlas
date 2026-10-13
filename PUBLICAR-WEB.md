# Publicación

La interfaz se publica en https://guidufox.github.io/breach-r6-atlas/ mediante GitHub Pages. El workflow pages.yml construye solo los recursos públicos, comprime los fondos de planos, separa callouts por mapa y genera páginas estáticas de referencia.

La colaboración requiere el servicio HTTPS de salas. Sites conserva su fuente y despliegue; el código de API, esquema y migraciones se conserva también en team-service/ de este repositorio. La página no requiere cuenta para uso local o para salas por invitación.

No hay bot de Discord ni workflow del bot. El webhook es una función opcional del usuario y no una credencial del sitio.

Antes de publicar: ejecutar las pruebas de tests/, revisar la política de contenido, las licencias separadas y el build. Las acciones de GitHub se fijan a commits concretos. El workflow ejecuta `tools/release_check.py` sobre la salida construida para detectar enlaces internos rotos, recursos ausentes y una CSP inconsistente. Para una revisión manual y textos de difusión, ver [LANZAMIENTO.md](LANZAMIENTO.md). El control opcional `python3 tools/release_check.py --public` señala permisos pendientes y no sustituye asesoramiento ni autorización de los titulares.
