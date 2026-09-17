# Diseñador técnico V2 — núcleo

Esta carpeta implementa FASE 3.1 y 3.2 sin DOM ni Three.js. No está cargada por la
web pública ni reemplaza el contrato V1 ubicado en assets/designer.

## Contrato

- schemaVersion: 2.
- generatorVersion: 2.0.0.
- Unidad canónica: milímetros enteros.
- El documento persistible contiene schemaVersion, generatorVersion y configuration.
- configuration.modules es la fuente de verdad de la distribución.
- Los tramos declaran zonas y reservas; la posición lineal se deriva del orden y ancho.
- Los estándares se guardan como un snapshot de un perfil versionado.

Un componente repetible conserva siempre esta estructura:

    {
      "quantity": {
        "mode": "automatic",
        "recommended": 4,
        "applied": 4,
        "resolved": 4
      }
    }

recommended es la recomendación del perfil, applied es el valor solicitado por el
estado actual y resolved es la cantidad que usará la geometría. En modo manual la
recomendación se conserva para poder volver a Automático.

## Archivos

- schema.js: versiones, tipos admitidos, clonación y envoltura persistible.
- profiles.js: perfil predeterminado, mezcla de perfiles y snapshots.
- validation.js: validadores puros estructurales, de dominio y geométricos.
- occupancy.js: ocupación independiente para cada combinación tramo/zona.
- store.js: store transaccional y operaciones atómicas.
- fixtures.js: Clóset de tres cuerpos, Cocina recta y Cocina en L.

Todos los módulos usan UMD: funcionan con require() en Node y exponen namespaces
TALLER_DESIGNER_V2_* si posteriormente se cargan como scripts clásicos.

## Design Store

createDesignStore(envelope, { idFactory }) ofrece:

- getState() y getConfiguration();
- validate() y getOccupancy();
- subscribe(callback);
- addModule, removeModule, duplicateModule, moveModule;
- changeModuleWidth, setModuleWidthLocked;
- addComponent, removeComponent.

Cada operación trabaja sobre una copia. Si rompe el contrato o las referencias, no
publica ningún cambio. Una operación correcta genera una sola notificación.

El store permite estados geométricos intermedios:

- exceso: diagnóstico RUN_EXCESS de severidad error;
- déficit: diagnóstico RUN_DEFICIT de severidad warning;
- exacto: sin diagnóstico de ocupación.

Esto permite mostrar el problema mientras el maestro sigue editando. Un documento con
exceso no debe guardarse como diseño final.

## Estado editable y validez técnica

validate() y getStatus() devuelven condiciones diferentes:

- isEditable: el contrato y sus referencias permiten mantener el estado en el store;
- isValid: no existen errores técnicos;
- isComplete: no existen errores ni advertencias;
- canGenerateTechnicalOutputs: el diseño es válido y está completo;
- valid y complete se conservan como alias compatibles.

Un déficit conserva isEditable e isValid, pero isComplete y
canGenerateTechnicalOutputs son falsos. Un exceso conserva isEditable, pero isValid,
isComplete y canGenerateTechnicalOutputs son falsos. Al corregir la ocupación, las
cuatro condiciones vuelven a ser verdaderas.

Los diagnósticos geométricos llevan category: geometry. Los errores de esta categoría
pueden permanecer en el store para ser corregidos. Los errores de contrato no son
editables y provocan el rechazo atómico de la operación.

Una operación que rompa la estructura, los identificadores o las referencias se
rechaza antes de publicar el estado. Por eso no puede dejar el store en un estado
estructuralmente inválido.

## Pruebas

    node tests/designer/v2-core.test.cjs

Las pruebas no necesitan navegador, Supabase, DOM ni WebGL.
