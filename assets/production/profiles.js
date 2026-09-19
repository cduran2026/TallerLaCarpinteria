(function (root, factory) {
  "use strict";
  const schema = typeof module === "object" && module.exports ? require("./schema.js") : root.TALLER_PRODUCTION_SCHEMA;
  const api = factory(schema);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_PRODUCTION_PROFILES = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema) {
  "use strict";
  if (!schema) throw new Error("Production profiles requiere schema.js.");

  const DEFAULT_CUT_PROFILE = Object.freeze({
    id: "workshop-cut-default", version: "1.0.0", strategy: "shelf-best-fit-v1",
    kerfMm: 3.2,
    trims: { topMm: 10, bottomMm: 10, leftMm: 10, rightMm: 10 },
    reusableLeftover: { minLengthMm: 300, minWidthMm: 150, minAreaMm2: 90000 },
    closet: {
      frontInsetMm: 20, doorGapMm: 3, drawerFrontGapMm: 3,
      drawerBoxSideClearanceMm: 26, drawerDepthInsetMm: 60,
      drawerSideHeightMm: 150, drawerBottomInsetMm: 12,
    },
    edgeBanding: { carcassFront: "PVC 1 mm", front: "PVC 1 mm" },
  });

  function merge(base, overrides) {
    const result = schema.clone(base);
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return result;
    Object.entries(overrides).forEach(function ([key, value]) {
      result[key] = value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object"
        ? merge(result[key], value) : schema.clone(value);
    });
    return result;
  }
  function createCutProfile(overrides) { return merge(DEFAULT_CUT_PROFILE, overrides || {}); }

  function createBoardFromMaterial(material, thicknessMm, profile, boardId) {
    const cut = createCutProfile(profile);
    const sheet = material?.sheet || {};
    const board = {
      boardId: boardId || material.id + "-" + thicknessMm,
      materialId: material.id,
      materialName: material.name || material.id,
      lengthMm: sheet.lengthMm,
      widthMm: sheet.widthMm,
      thicknessMm,
      kerfMm: cut.kerfMm,
      trimTopMm: cut.trims.topMm,
      trimBottomMm: cut.trims.bottomMm,
      trimLeftMm: cut.trims.leftMm,
      trimRightMm: cut.trims.rightMm,
      reusableLeftover: schema.clone(cut.reusableLeftover),
    };
    const errors = schema.validateBoard(board);
    if (errors.length) throw new Error("Configuración de plancha inválida: " + errors.join(" "));
    return board;
  }

  return { DEFAULT_CUT_PROFILE: schema.clone(DEFAULT_CUT_PROFILE), createCutProfile, createBoardFromMaterial };
});
