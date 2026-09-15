# Diseñador persistible — Fase 1

No utiliza Supabase. El estado contiene solamente valores JSON, nunca DOM, geometrías,
materiales Three.js ni cámara. Las direcciones de cliente e instalación serán opcionales
en Fase 2; esta fase no implementa esas entidades.

## Carga

Scripts clásicos con `defer`, en este orden: `serialization.js`, `controller.js`,
`script.js`. El controlador se inicializa en `DOMContentLoaded` si existe el formulario
del diseñador. El visor continúa cargándose de forma diferida. Hay una instancia activa
por página, acorde con el diseñador actual.

## API: `window.TALLER_CONFIGURATION`

- `getState()`: copia independiente y completa del estado.
- `loadState(configuration)`: recibe el estado completo (no el sobre versionado).
  Valida antes de modificar; devuelve una copia del nuevo estado. Sin clics simulados,
  sin aplicar defaults por cambio de tipo. Sincroniza el DOM y emite un único
  `taller:configuration`, aun si el visor no ha cargado o WebGL no está disponible.
- `reset()`: conserva el tipo activo, aplica los valores predeterminados de ese tipo,
  restablece estándar/grafito/cm y emite un cambio. Conserva los parámetros inactivos
  del otro tipo, como hacía el formulario original. Devuelve el estado resultante.
- `subscribe(callback)`: notifica los cambios posteriores con una copia independiente.
  Devuelve una función para desuscribirse. No ejecuta el callback al suscribirse.

El evento `taller:configuration` se conserva para el cotizador; su `detail` es una
copia congelada del estado. Las API no exponen el objeto mutable interno.
El formulario se actualiza sincrónicamente. Three.js reconstruye la representación
en el siguiente frame visible; si está fuera de pantalla, lo hace al volver a verse.

## Formato y unidades

`TALLER_SERIALIZATION.serialize(state)` produce una cadena JSON con:

```json
{
  "schemaVersion": 1,
  "generatorVersion": "1.0.0",
  "configuration": {
    "type": "kitchen",
    "kitchenLayout": "l",
    "width": 280,
    "secondLeg": 180,
    "height": 240,
    "depth": 65,
    "upper": true,
    "lower": true,
    "rod": true,
    "shelves": 3,
    "drawers": 0,
    "sink": true,
    "oven": true,
    "hood": true,
    "material": "premium",
    "color": "#8a6a46",
    "unit": "cm"
  }
}
```

`deserialize(json)` valida versiones y contenido, y devuelve la configuración lista
para `loadState()`. `validate(state)` permite validar sin cargar ni guardar.

Todas las longitudes se guardan **en cm**, incluso cuando `unit` es `mm` (solo cambia
las etiquetas). `height` corresponde a la altura del closet; la altura geométrica de
cocina se deriva de las reglas actuales. Los campos inactivos también se conservan.
Solo se admiten los rangos, pasos, colores y cantidades del formulario existente:
repisas 0/3 y cajones 0/2. No se admiten horno o lavaplatos sin bases de cocina.

Estados incompletos, campos desconocidos, valores incompatibles, JSON corrupto y
versiones desconocidas se rechazan sin alterar el diseño. No se migran silenciosamente.
`generatorVersion: 1.0.0` identifica la geometría actual: paneles de 18 mm, reglas
actuales de bases/aéreos, módulos automáticos y closet. Si esas reglas cambian, se debe
actualizar la versión y conservar compatibilidad o implementar una migración explícita.

## Prueba manual temporal

Abrir `index.html?designerTest=1#cotizador` desde un servidor HTTP local. También se
mantiene la apertura directa del sitio, pero el comportamiento de localStorage bajo
`file://` depende del navegador. El origen HTTP ofrece una prueba repetible.

1. Configurar el diseño.
2. Pulsar **Guardar diseño**.
3. Pulsar **Cambiar configuración** (cambia también Cocina ↔ Closet).
4. Pulsar **Recuperar diseño**.
5. Comparar medidas, controles, precio y geometría. También probar tras recargar.

Los botones solo se cargan con ese parámetro. Sin él no hay panel ni acceso automático
a localStorage. Se usa únicamente la clave `taller:designer:persistence-test:v1`.
El panel informa errores de almacenamiento o datos corruptos; no modifica otras claves.
Para borrar la prueba: `localStorage.removeItem('taller:designer:persistence-test:v1')`.

```js
const api = window.TALLER_CONFIGURATION;
const codec = window.TALLER_SERIALIZATION;
const original = api.getState();
const json = codec.serialize(original);
api.reset();
api.loadState(codec.deserialize(json));
console.assert(codec.serialize(api.getState()) === json);
```

## Pruebas automatizadas

`node tests/designer/persistence.test.cjs` usa Playwright (instalado en el entorno,
sin añadir dependencia a producción). Variables opcionales: `PLAYWRIGHT_MODULE`
(ruta al paquete), `BROWSER_CHANNEL` (por ejemplo `msedge`) y `TEST_ARTIFACTS`
(carpeta para capturas y JSON generado). Levanta un servidor local temporal y lo cierra.
Comprueba estado, formulario, precio, WhatsApp y firma geométrica antes/después;
la instrumentación de Three.js existe solo en el navegador de prueba.
