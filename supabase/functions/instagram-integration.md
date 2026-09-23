# Instagram Business · infraestructura inicial

Esta fase usa **Instagram API with Instagram Login**. No solicita la contraseña de Instagram, no expone tokens al navegador y no implementa publicación automática.

## Flujo

1. `instagram-auth-start` valida la sesión y el rol `admin`, crea un estado OAuth de un solo uso y devuelve la URL oficial de Instagram.
2. `instagram-auth-callback` intercambia el código en servidor, obtiene un token de larga duración, consulta la cuenta Business y cifra el token en Supabase Vault.
3. `instagram-connection` prueba o revoca la conexión. La desconexión elimina el token cifrado local incluso si Meta no responde.
4. `instagram-publish-story` exige confirmación en el request, vuelve a validar sesión/taller/rol/permisos, sube la imagen a un bucket privado, entrega a Meta una URL firmada por 15 minutos, crea y publica el contenedor y elimina el archivo temporal.

`social_connections` solo conserva metadatos no secretos. `private.social_connection_secrets` relaciona cada conexión con un secreto cifrado de Vault. `social_publications` registra el resultado sin almacenar la imagen.

## Configuración en Meta Developer

1. Crear o seleccionar una app de Meta Business.
2. Agregar **Instagram API** y configurar **API setup with Instagram Login**.
3. En *Business login settings*, registrar exactamente esta **Valid OAuth Redirect URI**:

   `https://jnzlultjyrtrkziqeocy.supabase.co/functions/v1/instagram-auth-callback`

4. Solicitar únicamente:
   - `instagram_business_basic`
   - `instagram_business_content_publish`
5. Durante desarrollo, agregar la cuenta Business usada para QA como tester/rol autorizado de la app. Para cuentas externas, completar App Review y los requisitos vigentes de Meta, incluyendo URLs públicas de privacidad y eliminación de datos cuando corresponda.
6. La cuenta debe ser **Instagram Business**. Este flujo no requiere enlazar una Página de Facebook; `associated_page` permanece vacío.

La versión de Graph API no está fijada en código: debe usarse la versión vigente habilitada en la app de Meta mediante `META_API_VERSION` (formato `vNN.N`).

## Secretos de Edge Functions

Configurar fuera de Git mediante `supabase secrets set` o Dashboard:

```text
META_APP_ID
META_APP_SECRET
META_API_VERSION
META_REDIRECT_URI=https://jnzlultjyrtrkziqeocy.supabase.co/functions/v1/instagram-auth-callback
APP_URL=https://cduran2026.github.io/TallerLaCarpinteria/maestro/
APP_ALLOWED_ORIGINS=https://cduran2026.github.io,http://127.0.0.1:4173
```

`APP_URL` es la URL completa del Modo Maestro. El callback conserva su ruta, normaliza la barra final y exige que su origen figure en `APP_ALLOWED_ORIGINS`. Al cambiar de dominio basta actualizar esos valores; la ruta no está fijada en el código. Si falta cualquier configuración OAuth, `instagram-auth-start` responde con error antes de crear estados o conexiones.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son secretos administrados por el entorno de Edge Functions. Nunca deben copiarse al frontend. No crear archivos `.env` versionados.

## Pruebas SQL

- `supabase/tests/instagram_isolation.sql`: **SOLO LOCAL / TEST PROJECT**. Ejecutar con `pwsh -File supabase/tests/run-instagram-local.ps1` después de iniciar Supabase local y aplicar allí las migraciones. El runner comprueba la instancia local y ejecuta `psql` únicamente dentro de su contenedor Docker; la prueba exige una marca de sesión y revierte los fixtures.
- `supabase/tests/instagram_cloud_smoke.sql`: consulta de solo lectura para Cloud después de aplicar 005. Comprueba tablas, RLS, permisos, funciones, restricción compuesta, Vault y bucket; no crea usuarios ni datos. Ejecutar con `npx supabase db query --linked --file supabase/tests/instagram_cloud_smoke.sql`. No sustituye la prueba de aislamiento con dos identidades, que permanece en local.

## Orden de aplicación posterior a revisión

No se ejecuta en esta entrega. Cuando la app Meta y sus secretos estén disponibles:

1. Revisar `supabase/migrations/005_instagram_integrations.sql`.
2. Ejecutar `npx supabase db push --dry-run`.
3. Si solo aparece la migración `005`, ejecutar `npx supabase db push`.
4. Cargar secretos con `npx supabase secrets set` sin escribirlos en el repositorio.
5. Desplegar:

```text
npx supabase functions deploy instagram-auth-start
npx supabase functions deploy instagram-auth-callback --no-verify-jwt
npx supabase functions deploy instagram-connection
npx supabase functions deploy instagram-publish-story
```

6. Conectar una cuenta de prueba desde Configuración → Integraciones → Instagram.
7. Probar conexión antes de habilitar la acción de Story en el Estudio de Contenido.
8. Revisar la imagen y confirmar manualmente la primera publicación real.

Referencias oficiales:

- Meta Instagram Platform: https://developers.facebook.com/docs/instagram-platform/
- Meta Content Publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing/
- Supabase Vault: https://supabase.com/docs/guides/database/vault
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
