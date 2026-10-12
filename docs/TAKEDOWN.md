# Procedimiento de retirada

Responsable del proyecto y de la revisión de cada temporada: Guidufox.
Contacto: https://github.com/Guidufox/breach-r6-atlas/issues/new.

1. Registrar el aviso, quién lo envía, qué contenido identifica y qué solicita. Confirmar el canal del titular sin publicar datos privados del aviso.
2. Desactivar la publicación del contenido cuestionado con content-policy.json y publicar el cambio. tools/restrict_content.py prepara ese ajuste. El build puede omitir planos, emblemas o ambos; si se retiran los mapas, publica una portada informativa sin datos de mapas.
3. Si se requiere retirar copias del repositorio, eliminar los archivos correspondientes en un commit y revisar también paquetes de actualizaciones, páginas SEO, capturas y archivos de distribución. Conservar únicamente los registros que corresponda conservar.
4. Si el aviso exige borrar versiones históricas, coordinarlo con GitHub y el titular. Un commit de eliminación no purga la historia, forks, copias offline ni cachés; no prometer una retirada universal e instantánea. Reescribir historia o destruir copias requiere una decisión específica del responsable.
5. Suspender las funciones o el servicio de salas si el contenido afectado también está allí. Las salas no contienen los planos raster originales, pero pueden incluir nombres y datos compartidos.
6. Confirmar la retirada publicada al solicitante y documentar la resolución. No restablecer los recursos sin verificar la autorización o resolución aplicable.

No hay anuncios ni monetización activada. Este procedimiento prepara una respuesta técnica; no afirma que se haya recibido una reclamación ni que todos los recursos tengan permiso.
