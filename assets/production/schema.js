(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_PRODUCTION_SCHEMA = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CUT_PLAN_VERSION = 1;
  const STRATEGIES = Object.freeze(["shelf-best-fit-v1"]);
  const GRAIN_DIRECTIONS = Object.freeze(["none", "length", "width"]);

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
  function positive(value) { return Number.isFinite(value) && value > 0; }
  function nonNegative(value) { return Number.isFinite(value) && value >= 0; }
  function requiredString(value) { return typeof value === "string" && value.trim().length > 0; }

  function validateTechnicalPiece(piece) {
    const errors = [];
    ["pieceId", "sourceModuleId", "name", "pieceType", "materialId", "materialName"].forEach(function (field) {
      if (!requiredString(piece?.[field])) errors.push(field + " es obligatorio.");
    });
    if (!Number.isInteger(piece?.quantity) || piece.quantity < 1) errors.push("quantity debe ser un entero positivo.");
    ["lengthMm", "widthMm", "thicknessMm"].forEach(function (field) {
      if (!positive(piece?.[field])) errors.push(field + " debe ser positivo.");
    });
    if (!GRAIN_DIRECTIONS.includes(piece?.grainDirection)) errors.push("grainDirection no es compatible.");
    if (typeof piece?.allowRotation !== "boolean") errors.push("allowRotation debe ser booleano.");
    ["top", "bottom", "left", "right"].forEach(function (side) {
      const value = piece?.edgeBanding?.[side];
      if (value !== null && value !== undefined && !requiredString(value)) errors.push("edgeBanding." + side + " no es válido.");
    });
    return errors;
  }

  function validateBoard(board) {
    const errors = [];
    ["boardId", "materialId"].forEach(function (field) {
      if (!requiredString(board?.[field])) errors.push(field + " es obligatorio.");
    });
    ["lengthMm", "widthMm", "thicknessMm"].forEach(function (field) {
      if (!positive(board?.[field])) errors.push(field + " debe ser positivo.");
    });
    ["kerfMm", "trimTopMm", "trimBottomMm", "trimLeftMm", "trimRightMm"].forEach(function (field) {
      if (!nonNegative(board?.[field])) errors.push(field + " debe ser no negativo.");
    });
    if (positive(board?.lengthMm) && board.trimTopMm + board.trimBottomMm >= board.lengthMm) errors.push("El refilado vertical consume la plancha.");
    if (positive(board?.widthMm) && board.trimLeftMm + board.trimRightMm >= board.widthMm) errors.push("El refilado horizontal consume la plancha.");
    return errors;
  }

  function expandQuantities(pieces) {
    const instances = [];
    (pieces || []).forEach(function (piece) {
      const errors = validateTechnicalPiece(piece);
      if (errors.length) throw new Error("Pieza " + (piece?.pieceId || "sin id") + ": " + errors.join(" "));
      for (let index = 1; index <= piece.quantity; index += 1) {
        instances.push({
          ...clone(piece), quantity: 1,
          pieceInstanceId: piece.pieceId + "#" + String(index).padStart(3, "0"),
          quantityIndex: index,
        });
      }
    });
    return instances;
  }

  function groupKey(piece) { return piece.materialId + "::" + piece.thicknessMm; }

  return { CUT_PLAN_VERSION, STRATEGIES, GRAIN_DIRECTIONS, clone, validateTechnicalPiece, validateBoard, expandQuantities, groupKey };
});
