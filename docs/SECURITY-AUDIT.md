# Revisión de seguridad — 18 de octubre de 2026

Alcance: portada estática, importación de respaldos y paquetes de mapas, exportación, colaboración de cinco personas, ruta `/api/room` y configuración de publicación. Se revisaron los flujos de datos y las rutas críticas, la CSP, los SVG publicados, los límites del servidor, los tokens, las escrituras D1 y las pruebas automatizadas. Es una revisión de código y de comportamiento acotado, no una auditoría externa ni una garantía contra todos los ataques.

## Hallazgos y medidas

| Área | Situación y medida |
| --- | --- |
| Invitación y acceso | La clave de invitación y la credencial de miembro tienen 256 bits aleatorios cada una. En D1 se guardan hashes SHA-256. El identificador de sala es un UUID, no es la credencial. Los enlaces en el fragmento de URL deben compartirse solo con el equipo. |
| Creación abusiva | Antes había un máximo de 100 salas simultáneas, sin cuota por origen. Se añadieron límites atómicos en D1 de 6 intentos de creación por cliente y 40 globales por hora. Se conserva el máximo de 100 salas activas. |
| Entradas y ediciones | 30 intentos de ingreso por cliente cada diez minutos y 30 ediciones por miembro por minuto. `429` indica cuánto esperar. Lecturas autenticadas: freno aproximado por instancia de 90 por miembro y minuto. El navegador respeta la espera sin expulsar al jugador. |
| Privacidad del límite | Los contadores guardan HMAC con una clave secreta, tipo de acción y ventana temporal; no guardan la IP cruda. Las filas vencidas se eliminan en creaciones posteriores. La IP de red compartida puede agrupar a varios usuarios. |
| XSS | Las plantillas `innerHTML` de salas y operadores contienen texto fijo. Apodos, notas, tareas, alias y detalles importados se muestran con `textContent` o valores de formulario. `RoomCore` valida claves, tipos, tamaños, coordenadas y alcance del mapa. Los SVG importados eliminan elementos activos y URLs ajenas; la publicación comprueba los SVG incluidos. |
| Tamaño y recursos | El servicio rechaza cuerpos de más de 1 MB más el envoltorio JSON. Los documentos finales no superan 1 MB; hay máximos de miembros, acciones y checklists. La limpieza de registros vencidos se realiza al crear una sala, evitando una escritura de limpieza en cada sondeo. El latido de presencia se actualiza cada 30 segundos como máximo. |
| Frontera web | CORS solo autoriza el origen de GitHub Pages, pero `Origin` no autentica clientes fuera del navegador. El acceso a una sala depende de la invitación y del token. Se valida `Content-Type`, UTF-8, forma de los datos y UUID; las respuestas desactivan caché y la detección MIME. |
| Dependencias | La web carga bibliotecas locales; las acciones de GitHub están fijadas por hash de commit y las dependencias del servicio se resuelven con el lockfile. Los webhooks se envían solo por acción explícita y no se guardan en el respaldo. |
| Arte y marcas | Los emblemas oficiales de operadores y el logo anterior se retiraron de la distribución y de la rama nueva. El código dibuja marcadores propios con abreviaturas. Los fondos rasterizados de los planos siguen requiriendo revisión de derechos aparte: la respuesta de R6Calls no los autoriza si son de terceros. |

## Límites que quedan

- Un atacante distribuido puede agotar la cuota global de creación o la cuota de D1. Las cuotas por IP no son una prueba de identidad, y el freno de sondeo por instancia no es global. Para una publicación con tráfico considerable harían falta límites de red administrados o un desafío para crear salas y observación de métricas de D1.
- Las salas no tienen cuentas ni moderación. Quien reciba el enlace puede entrar y editar; al llegar a cinco miembros se impiden nuevas incorporaciones. Los apodos no acreditan identidad.
- Los fondos de planos proceden de una fuente que no puede autorizar arte de Ubisoft o de terceros. No activar donaciones o publicidad hasta resolver también esa parte y consultar al mantenedor de R6Calls sobre el cambio comercial.
- Las pruebas de código y de construcción no sustituyen pruebas de carga ni un pentest independiente. Evitar pruebas de estrés contra el servicio público.

Documentación de referencia: [Cloudflare D1](https://developers.cloudflare.com/d1/worker-api/), [Cloudflare Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [OWASP API Security](https://owasp.org/API-Security/) y [derechos del proyecto](RIGHTS.md).
