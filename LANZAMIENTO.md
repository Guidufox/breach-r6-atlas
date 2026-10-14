# Preparar el lanzamiento público

**Web actual:** https://guidufox.github.io/breach-r6-atlas/  
**Código y reportes:** https://github.com/Guidufox/breach-r6-atlas

La web ya está publicada. Esta guía separa la comprobación técnica de la decisión de difundirla a una comunidad más amplia.

## Estado antes de anunciarla

| Área | Estado | Acción |
| --- | --- | --- |
| Sitio, HTTPS y despliegue desde `main` | Listo | Cada cambio pasa por pruebas, construcción y `release_check.py` en GitHub Actions. |
| Interfaz ES, EN y PT-BR | Disponible | Repasar modos, exportación, paneles y mensajes en un móvil real y en los navegadores que use el público. |
| Salas de cinco personas | Disponible | Dependen del servicio HTTPS separado; las invitaciones caducan a las dos horas. |
| Rendimiento móvil | Mejorado, pendiente de prueba amplia | Los mapas se cargan al pedirlos. La compresión del paquete publicado pasó de 36,97 a 20,18 MB en los 29 archivos de planos (gzip local, 13 oct. 2026); Banco pasó de 761 a 567 KB. Una conexión móvil lenta aún puede tardar varios segundos en abrir un plano grande. |
| Uso de material ajeno | **Pendiente** | La solicitud a R6Calls no tiene respuesta confirmada. Revisar por separado los derechos de planos, imágenes, emblemas y marca con sus titulares. Ver `docs/RIGHTS.md` y `docs/PERMISSION-REQUEST.md`. |

La licencia MIT del código propio y el aviso de no afiliación **no** conceden derechos sobre recursos ajenos. Antes de promoverlo masivamente, registrar por escrito el alcance de los permisos o sustituir los recursos cuyo uso no esté autorizado. No cambiar `permissionStatus` en `content-policy.json` solo para pasar una comprobación.

## Comprobación en un solo recorrido

1. En el repositorio local, ejecutar `node --test tests/*.test.cjs`.
2. Ejecutar `python3 tools/build_site.py` y `python3 tools/optimize_maps.py` (requiere Pillow, instalado por el workflow), y después `python3 tools/release_check.py`. Este control comprueba las páginas generadas, enlaces internos, mapas y guías esperados, el orden de la política de contenido, su hash de script en línea y que los SVG publicados no incluyan código activo ni referencias externas.
3. Ejecutar `python3 tools/release_check.py --public`. El código 2 indica que la difusión pública sigue pendiente de una revisión de permisos; el código 1 indica un fallo técnico. Un resultado favorable de este script tampoco sustituye la revisión humana de todos los derechos de terceros.
4. En un teléfono real, probar: abrir un mapa por primera vez con datos móviles, cerrar y abrir ambos paneles, cambiar idioma, buscar, repasar, dibujar, exportar PNG y descargar un respaldo. Repetir el recorrido principal en Chrome o Edge, Firefox y Safari cuando se disponga de esos dispositivos.
5. Probar una sala con dos cuentas o dispositivos de confianza: crear, unirse por invitación, editar elementos diferentes, descargar el plan y salir. No usar una táctica privada como prueba pública.
6. Compartir la URL principal cuando los puntos anteriores y la revisión de derechos estén resueltos. No hace falta comprar un dominio: GitHub Pages ya aloja la web en HTTPS. Para un dominio propio habría que actualizar URL canónica, enlaces, política CSP y origen permitido del servicio de salas.

**Actualización:** subir un cambio a `main` ejecuta `.github/workflows/pages.yml`. Comprobar que el workflow termine en verde y abrir la URL principal en una sesión nueva. Si la publicación falla, corregir o revertir el commit y dejar que el mismo workflow publique de nuevo. Los datos personales del visitante permanecen en su navegador; conviene recomendar un respaldo antes de cambios mayores.

## Textos breves preparados para compartir

Estos textos están listos como borradores. Publicarlos solo cuando se resuelva la revisión de derechos y se confirme el funcionamiento en los dispositivos elegidos.

**Español**

> R6- flamingo/strat es una herramienta comunitaria gratuita para aprender callouts y preparar tácticas de Rainbow Six Siege. Consultá mapas en español, inglés y portugués, dibujá rutas, asigná operadores y practicá con tu equipo. Las notas personales se guardan en tu navegador; las salas por invitación admiten hasta cinco personas. Proyecto independiente, no afiliado a Ubisoft ni a R6Calls. https://guidufox.github.io/breach-r6-atlas/

**English**

> R6- flamingo/strat is a free community tool for learning Rainbow Six Siege callouts and planning tactics. Explore maps in English, Spanish and Brazilian Portuguese, draw routes, assign operators and practice with your team. Personal notes stay in your browser; invite-only rooms support up to five people. Independent project, not affiliated with Ubisoft or R6Calls. https://guidufox.github.io/breach-r6-atlas/

**Português (Brasil)**

> R6- flamingo/strat é uma ferramenta comunitária gratuita para aprender callouts e planejar táticas de Rainbow Six Siege. Consulte mapas em português, inglês e espanhol, desenhe rotas, atribua operadores e pratique com sua equipe. As notas pessoais ficam no navegador; salas por convite aceitam até cinco pessoas. Projeto independente, sem afiliação com a Ubisoft ou o R6Calls. https://guidufox.github.io/breach-r6-atlas/

## Recorrido para nuevos usuarios

1. Elegir idioma, mapa y piso. Buscar un callout y abrir sus equivalencias.
2. Abrir **Estrategias**. Dibujar una ruta, colocar un operador y añadir una nota. Descargar un plano o un respaldo.
3. Abrir **Repasar** para entrenar. Entrar a **Equipo · 5** solo si quieren una sala compartida; exportar el plan antes de que expire.

Informar problemas y solicitudes de retirada en https://github.com/Guidufox/breach-r6-atlas/issues/new. La privacidad se explica en `docs/PRIVACY.md`.
