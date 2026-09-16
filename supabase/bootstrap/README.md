# Bootstrap LA-CARPINTERIA-PILOTO

Proyecto fijo: `jnzlultjyrtrkziqeocy`. Requiere PowerShell 7 y Node/npx.

## Validar la clave sin crear usuarios

```powershell
cd 'D:\Proyectos\La carpinteria'
pwsh -File supabase/bootstrap/bootstrap.ps1 -ValidateAuth
```

Solicita la clave con entrada oculta y ejecuta únicamente GET Auth Admin.
No solicita contraseñas, no muestra usuarios y no ejecuta SQL. Un 401 detiene
la ejecución sin reintentos. Verificar que la clave esté activa y sea del proyecto.

## Aprovisionar

```powershell
pwsh -File supabase/bootstrap/bootstrap.ps1 -Apply
```

Orden: clave oculta → GET Auth Admin → comprobar migraciones CLI → completar
lectura paginada de usuarios → tres contraseñas ocultas → crear/reutilizar cuentas
→ perfiles, talleres y membresías en transacción SQL.

| Cuenta | Taller | Rol |
| --- | --- | --- |
| admin@lacarpinteria.demo | La Carpintería | admin |
| johan@lacarpinteria.demo | La Carpintería | admin |
| maestro.demo@lacarpinteria.demo | Taller Demo | admin |

Las contraseñas tienen mínimo 12 caracteres, quedan en memoria y se descartan
si el usuario ya existe. No se actualizan ni eliminan usuarios. Las cuentas nuevas
se crean confirmadas mediante Auth Admin; no se envían correos. El SQL conserva
perfiles existentes, detecta talleres ambiguos, creador o membresías incompatibles.
Si SQL falla, sus cambios se revierten; las cuentas Auth creadas permanecen y
se reutilizan al reintentar. No hay transacción distribuida entre Auth y SQL.

## Credenciales y transporte

- `sb_secret_...` se envía exclusivamente en `apikey`, nunca como Bearer.
- El JWT antiguo service_role usa `apikey` y `Authorization: Bearer`.
- REST directo conserva el bootstrap PowerShell sin dependencias SDK adicionales.
- User-Agent explícito `LaCarpinteria-Bootstrap/1.0`; no identifica un navegador.
- Sin redirecciones HTTP ni salida verbose/debug del transporte.
- No se imprimen headers, claves, contraseñas ni cuerpos de error HTTP.
- Opcional: `-UseEnvironmentKey` lee `SUPABASE_BOOTSTRAP_ADMIN_KEY` del proceso
  y elimina esa variable antes de ejecutar CLI. No escribir su valor en comandos
  que se guarden en el historial. No enviar secretos al chat ni usar transcripciones.

## Pruebas

```powershell
pwsh -File tests/maestro/bootstrap.test.ps1
pwsh -File supabase/bootstrap/bootstrap.ps1 -TestInteractive
```

La primera prueba simula CLI/Auth y comprueba headers, errores, reintentos y
conservación de contraseñas. La segunda prueba solo la captura oculta con valores
ficticios, sin red ni archivos; no valida credenciales. Sin opciones se muestra el plan.
Los modos Apply, ValidateAuth y TestInteractive son excluyentes.

Documentación oficial:
https://supabase.com/docs/guides/getting-started/api-keys
https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys
