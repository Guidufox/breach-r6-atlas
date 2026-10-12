# Revisión de temporadas

Responsable: Guidufox. El workflow update-maps.yml consulta semanalmente los números de revisión publicados por R6Calls y actualiza updates/status.json. Si encuentra revisiones nuevas, registra una incidencia de revisión en el repositorio; no reemplaza mapas instalados ni dibujos automáticamente.

La web avisa si hay revisiones pendientes, si la consulta falla o si no se ha comprobado la fuente recientemente. El estado solo certifica que se pudo consultar la metadata: no certifica que cada imagen, nombre o elemento coincida con la temporada actual de Siege.

En cada temporada, el responsable debe revisar las notas oficiales de Ubisoft, comparar mapas afectados, comprobar callouts y emblemas nuevos, generar paquetes con tools/create_updates.py y revisarlos en la app antes de incorporarlos. Los dibujos anteriores se archivan cuando cambia la identidad del plano. No se atribuye esta revisión a Ubisoft ni a R6Calls.

Si nadie ha completado la revisión manual, conservar el aviso de revisión pendiente; no anunciar «datos oficiales actualizados». No distribuir automáticamente archivos nuevos si existe una solicitud de retirada abierta.
