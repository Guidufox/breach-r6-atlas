# Servicio de salas y métricas

Código del servicio HTTPS usado por R6- flamingo/strat. La web estática permanece en GitHub Pages; este servicio necesita un entorno Vinext/Cloudflare con D1 (binding `DB`).

Publicación actual: https://r6-flamingo-team-service.stony-elk-7524.chatgpt.site

Este directorio conserva las rutas, validación y migraciones propias, no es un proyecto desplegable aislado. Para reproducirlo, crear un proyecto Sites Vinext con D1, integrar estos archivos y aplicar las migraciones en orden usando sus herramientas de publicación. El proyecto fuente completo también está guardado y versionado en Sites. No reutilizar credenciales ni el identificador del proyecto original.

- `POST /api/room`: crear, unirse, consultar, editar o abandonar una sala; máximo cinco miembros.
- `POST /api/visit`: contar visitas por fecha UTC, ruta e idioma, sin identificadores individuales.
- `GET /api/visit`: totales agregados de los últimos 90 días.
- Las salas vencen a las dos horas; la eliminación física ocurre durante actividad posterior del servicio.

No guardar secretos de invitación en tickets ni registros. Revisar `docs/PRIVACY.md` y ejecutar los tests del repositorio antes de publicar cambios.
