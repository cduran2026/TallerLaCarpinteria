# Producción: Despiece y Corte

Módulo puro y versionado que transforma un Clóset V2 técnicamente válido en una salida de producción.

```
Diseño V2 -> PieceGenerator -> TechnicalPieces[] -> CutOptimizer -> CutPlan -> UI Producción
```

## Contratos

- `TechnicalPiece` conserva diseño, módulo y componente de origen, cantidades agrupadas, dimensiones, material, veta, rotación y tapacanto por lado.
- `Board` toma dimensiones de `materials.catalog[].sheet` y parámetros de corte de un perfil configurable.
- `CutPlan` expande cantidades en instancias, conserva `pieceId`, registra coordenadas, rotación, métricas y sobrantes reutilizables.

## Estrategia inicial

`shelf-best-fit-v1` ordena las piezas de forma determinista y las acomoda en franjas horizontales. Prueba orientaciones permitidas, respeta refilado y deja el kerf entre piezas y franjas. Es verificable y no produce solapes, pero no garantiza el mínimo global de planchas ni realiza cortes de guillotina optimizados por secuencia.
