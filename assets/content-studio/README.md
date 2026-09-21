# Estudio de Contenido

Arquitectura V1:

```
MediaLibrary (temporal)
  -> ContentStore
  -> Template + FormatProfile + BrandKit
  -> ContentRenderer
  -> RenderedContent
  -> ImageExport
  -> FutureSocialPublisher
```

Los perfiles de formato, contratos de plantilla y estado editorial son independientes del DOM. El renderer consume composición y medios resueltos en tiempo de ejecución; no contiene nombres de talleres ni integra proveedores de IA o redes sociales.

`ContentAssistant` queda como contrato opcional, sin proveedor en esta versión. `RenderedContent` fluye hacia `ImageExport`; un futuro `SocialPublisher` podrá consumir el resultado exportado sin cambiar el editor ni las plantillas.
