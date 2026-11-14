# T17 · Páginas de organización

- Pública: `#/organizaciones/:slug`. Las solicitudes enlazan a la organización.
- Propia: `#/fundacion/organizacion`, `#/tienda/organizacion`, con RequireRole,
  sesión de perfiles y RLS. Las empresas tienen página pública; el modelo actual
  no tiene rol de empresa para iniciar sesión.
- Solo verificadas, activas y distintas de colectivos de búsqueda. La interfaz
  filtra explícitamente publicaciones retiradas incluso para su propia cuenta.
- Texto hasta 5000 caracteres, imágenes JPG/PNG/WebP de entrada hasta 5 MB,
  salida JPEG de hasta 2000 px, sin copiar EXIF/GPS. No se aceptan SVG ni GIF.
- Videos: enlaces HTTPS de YouTube o Vimeo, lista de proveedores cerrada,
  iframe aislado. No se suben archivos de video.
- Consentimiento obligatorio en creación y edición; registrado en la fila.
- Reportes en `public.reportes`, disponibles para moderación con service_role.
  No se añaden herramientas de moderación aquí.
- Bucket privado con URLs firmadas de cinco minutos; moderación se revalida al
  enfocar la ventana y cada minuto. Una URL ya firmada puede seguir funcionando
  hasta que expire después de retirar contenido o suspender una página.
- La función `t17-imagen` comprueba sesión y organización, limita la entrada y
  elimina segmentos APP/COM (EXIF/GPS/XMP/IPTC) antes de guardar. No hay INSERT
  directo de cliente al bucket. Desplegar esta función junto con la migración.
- Publicación y medios usan operaciones separadas con limpieza compensatoria;
  una interrupción de red puede dejar una publicación de texto o archivo huérfano.

Sin dependencias adicionales. Migración T17 autorizada por el usuario en el chat.

## Verificación local

```sh
npm --prefix web run build
npm --prefix web run lint
node --test web/tests/auth/session.test.ts web/tests/organizacion/media.test.ts
# Stack exclusivo hackatonmx-t17: API 57421, DB 57422.
npx supabase test db supabase/tests/database/t17.test.sql --workdir /tmp/agora-t17
# Con una imagen JPEG de prueba y la llave pública del stack:
T17_SUPABASE_URL=http://127.0.0.1:57421 T17_SUPABASE_KEY=<llave-publica-local> \
T17_JPEG=/ruta/imagen.jpg node web/tests/organizacion/local-image.mjs
```

El script integral solo admite ese endpoint de loopback; crea y elimina sus propios
registros y archivo. Inyecta un segmento EXIF/GPS al JPEG, verifica que el servidor
lo elimina y que conserva el scan comprimido, prueba la lectura anónima firmada,
el bloqueo de subida directa y el envío del reporte.
