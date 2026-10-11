# Preparación de Cloudflare Pages — Taller La Carpintería

Esta rama `release/cloudflare-v1` parte del `main` estable y contiene únicamente la preparación de publicación. El desarrollo local de Estudio 4:5, Calendario, migración 006, scheduler y ajustes diagnósticos de Instagram permanece fuera. La release conserva el Estudio ya existente en `main` (Instagram Feed 1:1). Este documento no activa Cloudflare, DNS, Supabase ni Meta.

## Build estático

- Repositorio GitHub: raíz del proyecto.
- Framework preset: **None**.
- Build command: `node scripts/build-static.mjs`.
- Build output directory: `dist`.
- Node: versión LTS actual compatible con ESM (Node 20 o posterior).
- Enrutamiento: `/` y `/maestro/` son archivos `index.html`; Modo Maestro usa rutas con `#`, sin rewrite del servidor.
- `dist/` contiene exclusivamente archivos permitidos por `scripts/build-static.mjs`. No incluir `supabase/`, `tests/`, `scripts/`, documentación, `.env`, migraciones ni claves administrativas.
- Las variables `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_PUBLISHABLE_KEY` son **públicas**, se inyectan en `dist/maestro/js/config.js` durante el build. Pages exige ambas. La segunda debe empezar por `sb_publishable_`; nunca usar `sb_secret_` ni `service_role`.
- En local, sin estas variables, el build conserva los valores públicos actuales de `maestro/js/config.js` para probar el sitio. En Pages, el build falla si faltan.

Prueba local: `node scripts/build-static.mjs`, `node --test tests/deployment/build-static.test.cjs`, luego servir `dist/` con un servidor HTTP y abrir `/` y `/maestro/`. No abrir HTML mediante `file://`.

## Producción y pruebas

| Entorno | Rama/URL | Backend | Uso |
| --- | --- | --- | --- |
| Producción | `main` → `tallerlacarpinteria.cl` tras aprobación y DNS | Supabase actual `jnzlultjyrtrkziqeocy` | Datos reales del taller. |
| Pruebas | rama `staging` → preview Pages, protegido con Cloudflare Access | **Otro proyecto Supabase** con Auth, RLS y migraciones equivalentes | Datos y cuentas de prueba. |

Configurar las variables públicas de Pages por entorno. El build rechaza un preview que use la URL del Supabase actualmente codificado para producción. No conectar un preview a la base real para pruebas de escritura. Si aún no existe Supabase de pruebas, validar localmente o mantener previews sin Modo Maestro hasta crear ese proyecto. Los previews de Pages llevan `noindex`, pero son públicamente accesibles por defecto; activar una política de acceso antes de exponer datos de prueba. [Controles de rama](https://developers.cloudflare.com/pages/configuration/branch-build-controls/) y [protección de previews](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

El Kit de Marca y sesiones del navegador usan almacenamiento asociado al origen. Al pasar de GitHub Pages al dominio nuevo, cada usuario deberá iniciar sesión otra vez; cualquier dato del Kit guardado sólo en el navegador anterior debe exportarse o recrearse antes del cambio de dominio. Los proyectos/diseños guardados en Supabase no dependen de ese almacenamiento local.

## Preparación de URLs y servicios para el corte (pendiente; **no ejecutar en esta etapa**)

1. La web pública apunta `canonical`, Open Graph, imagen social y `LocalBusiness.url` a `https://tallerlacarpinteria.cl/`. Los enlaces internos siguen siendo relativos para funcionar en raíz, `/maestro/` y vistas embebidas del diseñador. El correo `contacto@lacarpinteriachile.cl` se conserva hasta comprobar que exista un buzón del dominio nuevo.
2. En Supabase Auth, revisar `Site URL` y allowlist de redirect para `https://tallerlacarpinteria.cl/maestro/` y cualquier preview autorizado. Confirmar si los flujos actuales usan esa redirección; no quitar la URL vieja antes del corte.
3. En Edge Functions, cambiar **en una ventana de corte posterior** `APP_URL` a `https://tallerlacarpinteria.cl/maestro/` y añadir `https://tallerlacarpinteria.cl` a `APP_ALLOWED_ORIGINS`; conservar temporalmente el origen GitHub Pages mientras haya usuarios en él. `APP_URL` es URL completa con slash final; `APP_ALLOWED_ORIGINS` son orígenes, sin path.
4. `META_REDIRECT_URI` sigue apuntando al callback de Supabase `https://jnzlultjyrtrkziqeocy.supabase.co/functions/v1/instagram-auth-callback`; el cambio de dominio frontend **no requiere** una nueva URI de callback si las funciones siguen en ese proyecto. No cambiar `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION` ni iniciar OAuth durante esta preparación. Para OAuth en staging se necesitaría un backend/app Meta de pruebas con su callback propio; dejar deshabilitada allí la conexión real mientras no exista.
5. Revisar enlaces absolutos de correos Auth y políticas CORS antes del corte. Verificar RLS por `workshop_id` y que ninguna tabla privada sea accesible con la clave publicable; el cambio de hosting no sustituye la seguridad de Supabase.

## Pasos para conectar Pages con GitHub (tras autorizar publicación)

1. Revisar los commits de `release/cloudflare-v1`, construir y probar desde un checkout limpio. Con autorización, subir sólo esa rama, abrir un PR hacia `main` y fusionarlo tras revisión. Nunca incluir el árbol de trabajo pendiente de `main`.
2. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git → GitHub**. Autorizar el repositorio de La Carpintería, sin conceder acceso a otros repositorios si no hace falta.
3. Elegir `main` como production branch, preset **None**, root `/`, build command `node scripts/build-static.mjs`, output `dist`. Configurar las dos variables `PUBLIC_*` de producción en **Settings → Environment variables**. No introducir secretos de Meta ni Supabase admin en Pages.
4. Configurar builds de previews sólo para `staging` o ramas revisadas; definir variables preview apuntando al Supabase aislado. Proteger previews con Cloudflare Access. Revisar build y pruebas de `/`, `/maestro/`, 3D y Estudio en la URL `*.pages.dev` antes de asociar el dominio.
5. Tras aprobación de corte: **Pages → Custom domains → Set up a domain**, agregar `tallerlacarpinteria.cl`. Para el dominio raíz se requiere delegar los nameservers de NIC Chile a Cloudflare; comprobar antes los registros de correo (MX, SPF, DKIM, DMARC) para no interrumpirlo. No cambiar DNS hasta esa aprobación. [Documentación oficial](https://developers.cloudflare.com/pages/configuration/custom-domains/).
6. Actualizar los ajustes pendientes de Supabase Auth y Edge Functions en la ventana aprobada. Verificar login, RLS, subida de medios, editor 3D, Estudio, Calendario, Instagram y callback OAuth sin publicar contenido. Sólo después definir redirección del dominio GitHub Pages y de `www` si corresponde.

Conexión de GitHub puede crear un primer despliegue Pages y `main` puede desplegar automáticamente cada push. Por eso los pasos 2–5 se reservan para una autorización explícita posterior.

## Costos y respaldos

Pages Free tiene límites de builds y archivos; Supabase Free tiene cuotas de base, Auth, Storage, ancho de banda y Edge Functions. Meta/Instagram puede imponer cuotas. Vigilar uso y alertas antes de activar automatización, campañas pagadas o servicios externos. El dominio NIC Chile mantiene su costo de registro/renovación; verificar precios y límites vigentes al activar. [Límites de Pages](https://developers.cloudflare.com/pages/platform/limits/) y [precios de Supabase](https://supabase.com/pricing).

En Supabase Free, planificar exportación periódica con `supabase db dump` desde un equipo o CI seguro, cifrar el respaldo, guardarlo fuera del repositorio y probar restauración en el proyecto de pruebas. El dump de base no reemplaza una copia de los objetos de Storage; respaldar ambos. No automatizar esta tarea con credenciales hasta decidir responsable, frecuencia, retención y destino. [Guía oficial de respaldos](https://supabase.com/docs/guides/platform/backups).
