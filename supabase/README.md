# FASE 2A — Supabase Cloud conectado mediante CLI

Proyecto: LA-CARPINTERIA-PILOTO (`jnzlultjyrtrkziqeocy`). CLI validada: 2.117.0.
URL y clave publicable ya configuradas en `maestro/js/config.js`.

## Verificación CLI — 2026-09-15

Las migraciones 001–003 ya existían en Cloud, pero no en el historial CLI.
Se contrastaron tablas, restricciones, funciones, triggers, políticas y permisos;
se registraron como aplicadas con `migration repair --status applied 001 002 003`.
No se regeneraron ni modificaron los archivos de migración.

`db push --dry-run` y `db push` confirmaron `Remote database is up to date.`
La prueba `tests/workshop_isolation.sql` terminó sin errores mediante `db query`;
su ROLLBACK dejó cero usuarios, talleres, clientes, proyectos y diseños.
Esto valida RLS en SQL, no sustituye las pruebas con sesiones reales de Auth/API.

Para futuras migraciones desde la raíz del repositorio:

```powershell
npx --yes supabase migration list
npx --yes supabase db push --dry-run
# Revisar el resultado antes de aplicar:
npx --yes supabase db push
```

No repetir `migration repair` como procedimiento habitual. No ejecutar `config push`
con los valores locales predeterminados. `supabase/.temp` está excluido de Git.

Auth Email está habilitado; el registro público sigue habilitado y requiere cierre
para el piloto privado. Faltan los dos usuarios reales, aprovisionar sus talleres,
configurar las URLs de Auth y validar login/guardado/restauración mediante API y UI.
Los pasos siguientes sirven como referencia de instalación inicial; el proyecto,
las migraciones y la configuración pública ya están completados.

## 1. Crear y configurar el proyecto

1. Entrar en https://supabase.com/dashboard y crear un proyecto para La Carpintería.
   Elegir organización, nombre, región y contraseña de base de datos. Guardar esa
   contraseña de forma privada; NO enviarla ni ponerla en Git.
2. En **Connect / Project Settings → API**, obtener la URL del proyecto y la clave
   **publishable** `sb_publishable_...` (API Keys). Son los únicos dos valores de conexión
   necesarios para `maestro/js/config.js`.
3. En **Authentication → Providers / Sign In**, habilitar Email y deshabilitar el
   registro público (Allow new users to sign up). No hay registro desde la aplicación.
4. En **Authentication → URL Configuration**, definir Site URL con la URL real de
   `/maestro/` y autorizar el origen local que se use para pruebas. Servir la app por
   HTTP/HTTPS, no por file://. No inventar el dominio de despliegue.
5. En **Authentication → Users → Add user / Create new user**, crear dos usuarios de
   prueba A/B con correo y contraseña establecidos por el administrador. Para este
   bloque usar creación manual con correo confirmado. No compartir las contraseñas
   en el chat, en Git ni en capturas. La activación por invitación y recuperación de
   contraseña con su pantalla se completarán en un bloque posterior.
6. Confirmar que el esquema API expuesto incluye `public`, NUNCA `private`.

Fuentes: https://supabase.com/docs/guides/auth/passwords,
https://supabase.com/docs/guides/getting-started/api-keys,
https://supabase.com/docs/guides/database/postgres/row-level-security.

## 2. Aplicar migraciones

En un proyecto nuevo, ejecutar como `postgres` en **SQL Editor**, en este orden:

1. `migrations/001_tables_and_constraints.sql`: seis tablas públicas, contador privado,
   restricciones de configuración y relaciones, RLS activo sin permisos de cliente.
2. `migrations/002_access_policies.sql`: funciones de pertenencia/admin sin recursión,
   permisos mínimos por columna y políticas de lectura, inserción y actualización.
3. `migrations/003_controlled_operations.sql`: fechas, taller inmutable, código/snapshot
   generado en PostgreSQL y aprovisionamiento manual.

Cada archivo tiene BEGIN/COMMIT. Son migraciones de una sola aplicación: si ya hay
tablas equivalentes, detenerse y revisar el esquema; no borrar ni reemplazar datos.
No aplicar a producción sin revisar primero. Alternativa futura: Supabase CLI con
migraciones versionadas y proyecto vinculado; no es necesaria para usar SQL Editor.

## 3. Aprovisionar talleres

Copiar los UUID reales desde Authentication → Users. En SQL Editor, sustituir los
parámetros de esta llamada por esos valores (una vez por taller):

```sql
select private.provision_workshop(
  'UUID-REAL-DEL-USUARIO'::uuid,
  'Nombre real del taller',
  'Nombre real del maestro'
);
```

La llamada verifica que exista el usuario Auth y crea perfil, taller y membresía admin
en una transacción. No usarla repetidamente para el mismo taller: crearía otro taller.
Para un integrante adicional, un administrador de la base puede insertar su perfil y
su membresía con `role='member'` en SQL Editor. El frontend no puede inscribirse, ascender
su rol, eliminar miembros ni crear talleres. No hay interfaz de administración de miembros.

## 4. Datos y seguridad

- `clients.address` y `projects.site_address` aceptan NULL. Nombre, celular y comuna
  identifican al cliente. El proyecto tiene comuna de instalación obligatoria.
- `projects` no tiene tipo técnico. `designs.type` es kitchen/closet, y cada proyecto
  admite varios diseños.
- Código `LC-AAAA-0001`: contador por taller y año de creación en America/Santiago.
  `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` serializa inserciones concurrentes
  sobre el mismo contador. Unicidad `(workshop_id, code)`. El número no se trunca al
  superar 9999. El código y snapshot no se aceptan desde el navegador.
- Claves compuestas impiden relacionar cliente/proyecto/diseño entre talleres.
- RLS aplica tanto a admin como a member para los datos del taller. Solo admin puede
  editar su nombre. Los helpers SECURITY DEFINER tienen search_path vacío, UUID del
  usuario obtenido de auth.uid(), y están en private, fuera de la API expuesta.
- Sin permisos DELETE. Sin cambios de workshop_id ni de relaciones desde el cliente.
- `configuration` guarda SOLO el objeto de Fase 1, con versiones en columnas separadas.
  Al abrir se reconstruye el sobre `{schemaVersion,generatorVersion,configuration}`.
- Supabase Auth gestiona la sesión del navegador. Ninguna contraseña se guarda por el
  código de la app. No hay claves secretas/service_role en frontend.

## 5. Validación obligatoria antes de dar por completa la fase

En un proyecto de pruebas real, ejecutar `tests/workshop_isolation.sql` en SQL Editor.
Usa transacción y ROLLBACK; comprueba políticas actuando como authenticated/anon con
identidades de prueba y restricciones. No verifica el transporte HTTP de Auth.

Después ejecutar `node tests/maestro/supabase-api.test.cjs` desde la raíz con las
variables indicadas en ese archivo. Usa cuentas A/B reales, la API REST y la clave
publicable; no requiere service_role. Crea registros de prueba identificables y no
los borra (el MVP no concede DELETE). Ejecutar solamente en el proyecto de pruebas.
También comprueba dos inserciones de proyectos simultáneas y códigos distintos.

Validar manualmente en el navegador:
login A → crear cliente sin dirección → proyecto sin dirección → dos diseños de tipos
distintos → guardar → cerrar sesión → ingresar A → recuperar exactamente. Luego login B
debe mostrar exclusivamente Taller B. Probar las URL del proyecto/diseño A estando en B.

## Configuración pendiente que debe entregar el usuario

- URL de Supabase: configurada.
- Clave publicable: configurada.
- Migraciones verificadas y sincronizadas; faltan usuarios y talleres reales de prueba.
- Origen local y URL de despliegue que se utilizarán en Auth.

No se necesita recibir contraseña de base de datos, secret key ni service_role.
