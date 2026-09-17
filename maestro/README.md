# Modo Maestro — FASE 2A

Aplicación estática HTML/CSS/JS con rutas hash. Abrir `/maestro/` mediante HTTP(S).
Sin valores reales en `js/config.js`, muestra **Conexión pendiente**, deshabilita login
y no carga el SDK ni llama a Supabase. No hay usuarios, proyectos ni números ficticios.

## Archivos

- `js/app.js`, `router.js`: sesión, rutas, montaje/desmontaje y cambios de taller.
- `js/auth.js`, `supabase-client.js`, `config.js`: SDK 2.116.0, correo/contraseña,
  persistencia de sesión y cierre. Registro público ausente. Recuperación diferida.
- `js/workshop-context.js`: contexto elegido entre talleres devueltos por RLS.
- `js/repositories/`: operaciones reales de clientes, proyectos, diseños y talleres.
- `js/views/`: login, dashboard, clientes, alta/ficha de proyecto y editor.
- `js/ui.js`: elementos DOM con textContent para datos del usuario, sin interpolar HTML.
- `js/designer-bridge.js`: reutiliza `.configurator-layout` del index público y los
  mismos scripts de Fase 1/Three.js dentro de un iframe. No duplica modelo ni controles.
  El cotizador sigue intacto en la web pública; el iframe interno muestra el diseñador.
  Desmontar la vista elimina el iframe y sus recursos. No pasa datos por URL/postMessage.

## Rutas

```
/maestro/#/login
/maestro/#/dashboard
/maestro/#/clientes
/maestro/#/proyectos/nuevo
/maestro/#/proyectos/{id}
/maestro/#/proyectos/{id}/disenos/nuevo
/maestro/#/proyectos/{id}/disenos/{id}
```

La app conserva verde oscuro/beige/dorado y fuentes existentes. El enlace Modo Maestro
es el único cambio funcional en la web pública. Los datos del cliente son independientes
de los del proyecto; crear un cliente y crear un proyecto son operaciones separadas.

Cada diseño se guarda explícitamente. Un fallo no muestra éxito; si se edita durante
el guardado, las nuevas modificaciones continúan marcadas como pendientes. No hay
historial ni resolución de ediciones simultáneas entre usuarios (último guardado gana).
La posición de cámara es temporal. Las versiones y configuración mantienen el contrato
de Fase 1. El tipo puede cambiarse en el editor y se persiste junto con su configuración.

## Validación local

`node tests/maestro/local.test.cjs` desde la raíz. Requiere Playwright disponible en
el entorno (`PLAYWRIGHT_MODULE` para ruta al paquete, `BROWSER_CHANNEL=msedge` opcional).
Verifica rutas estáticas/imports, bloqueo sin configuración, ausencia de llamadas a
Supabase, responsive, enlace público y montaje real del diseñador compartido.
No sustituye las pruebas de Auth, base de datos y RLS del proyecto Supabase real.

Ver `../supabase/README.md` para configuración y migraciones. Nada se despliega
automáticamente. No están implementados despiece, BOM, costos ni proveedores.

## Sistema visual de Modo Maestro

El shell de aplicación usa sidebar, header contextual y un área principal adaptable.
Los tokens viven bajo la clase maestro en maestro.css, separados de los estilos de la
web pública:

- fondos cálidos y superficies blancas;
- verde profundo para navegación y acciones primarias;
- dorado/madera para énfasis y materialidad;
- radios de 10, 16 y 24 px;
- sombras suaves para jerarquía, sin simular paneles pesados;
- escala de spacing basada principalmente en 8 px.

Los componentes compartidos incluyen botones, campos, cards, paneles, badges de
estado, avisos, estados vacíos, métricas de trabajo y filas de proyecto. ui.js
centraliza las etiquetas y badges para Borrador, En diseño, Aprobado y Archivado.

En tablet y móvil la sidebar se convierte en un menú superpuesto. El área principal
no impone columnas al editor, de modo que el futuro Diseñador V2 podrá usar una
composición Estructura | Visor 3D | Inspector sin modificar el shell general.
