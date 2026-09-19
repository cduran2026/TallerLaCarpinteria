(function (root, factory) {
  "use strict";
  const commonjs = typeof module === "object" && module.exports;
  const schema = commonjs ? require("./schema.js") : root.TALLER_PRODUCTION_SCHEMA;
  const profiles = commonjs ? require("./profiles.js") : root.TALLER_PRODUCTION_PROFILES;
  const validation = commonjs ? require("../designer/v2/validation.js") : root.TALLER_DESIGNER_V2_VALIDATION;
  const api = factory(schema, profiles, validation);
  if (commonjs) module.exports = api;
  else root.TALLER_PIECE_GENERATOR = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema, profiles, validation) {
  "use strict";
  if (!schema || !profiles || !validation) throw new Error("Piece generator requiere producción y validación V2.");

  function edge(top, bottom, left, right) { return { top: top || null, bottom: bottom || null, left: left || null, right: right || null }; }
  function resolved(component) { return Math.max(0, Number(component?.quantity?.resolved) || 0); }
  function materialById(configuration, id) { return configuration.materials.catalog.find(function (item) { return item.id === id; }); }
  function materialFor(configuration, role) {
    const id = configuration.materials.assignments[role] || configuration.materials.assignments.carcass;
    const material = materialById(configuration, id);
    if (!material) throw new Error("No existe material para el rol " + role + ".");
    return material;
  }
  function grainFor(material) { return material.grain?.mode === "directional" ? "length" : "none"; }
  function canRotate(material) { return material.grain?.mode !== "directional"; }
  function materialName(material) {
    if (material.name) return material.name;
    const substrate = material.coating === "melamine" ? "Melamina" : material.substrate || "Tablero";
    return substrate + (material.finish?.name ? " " + material.finish.name : "");
  }

  function generateClosetPieces(envelope, options) {
    if (envelope?.schemaVersion !== 2 || envelope.configuration?.type !== "closet") {
      throw Object.assign(new Error("El generador requiere un Clóset V2."), { code: "DESIGN_TYPE_UNSUPPORTED" });
    }
    const report = validation.validateEnvelope(envelope);
    if (!report.canGenerateTechnicalOutputs) {
      throw Object.assign(new Error("El diseño debe estar completo y técnicamente válido antes de generar producción."), {
        code: "DESIGN_NOT_READY", validation: report,
      });
    }
    const configuration = envelope.configuration;
    const cut = profiles.createCutProfile(options?.profile || configuration.production?.profile);
    const standards = configuration.standards.snapshot;
    const sourceDesignId = options?.designId || configuration.id || null;
    const carcass = materialFor(configuration, "carcass");
    const fronts = materialFor(configuration, "fronts");
    const pieces = [];

    function add(module, component, suffix, values) {
      const material = values.material || carcass;
      const piece = {
        pieceId: module.id + ":" + (component?.id || "structure") + ":" + suffix,
        sourceDesignId,
        sourceModuleId: module.id,
        sourceComponentId: component?.id || null,
        name: values.name,
        pieceType: values.pieceType,
        quantity: values.quantity || 1,
        lengthMm: Math.round(values.lengthMm), widthMm: Math.round(values.widthMm),
        thicknessMm: Math.round(values.thicknessMm || material.thicknessMm),
        materialId: material.id, materialName: materialName(material),
        grainDirection: values.grainDirection || grainFor(material),
        allowRotation: values.allowRotation === undefined ? canRotate(material) : values.allowRotation,
        edgeBanding: values.edgeBanding || edge(),
      };
      const errors = schema.validateTechnicalPiece(piece);
      if (errors.length) throw new Error("No se pudo generar " + piece.name + ": " + errors.join(" "));
      pieces.push(piece);
    }

    configuration.modules.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (module, moduleIndex) {
      const dimensions = module.dimensions;
      const thickness = carcass.thicknessMm;
      const innerWidth = dimensions.widthMm - thickness * 2;
      const innerHeight = dimensions.heightMm - thickness * 2;
      const label = "Cuerpo " + (moduleIndex + 1);
      const carcassEdge = edge(cut.edgeBanding.carcassFront, null, null, null);
      add(module, null, "side", { name: label + " · Costado", pieceType: "side", quantity: 2,
        lengthMm: dimensions.heightMm, widthMm: dimensions.depthMm, edgeBanding: carcassEdge });
      add(module, null, "top", { name: label + " · Tapa", pieceType: "top", lengthMm: innerWidth,
        widthMm: dimensions.depthMm, edgeBanding: carcassEdge });
      add(module, null, "bottom", { name: label + " · Piso", pieceType: "bottom", lengthMm: innerWidth,
        widthMm: dimensions.depthMm, edgeBanding: carcassEdge });
      if (standards.panels.backThicknessMm > 0) {
        add(module, null, "back", { name: label + " · Fondo", pieceType: "back", lengthMm: innerHeight,
          widthMm: innerWidth, thicknessMm: standards.panels.backThicknessMm, edgeBanding: edge(), allowRotation: true, grainDirection: "none" });
      }
      module.components.forEach(function (component) {
        const quantity = resolved(component);
        if (!quantity) return;
        if (component.type === "shelfSet") {
          add(module, component, "shelf", { name: label + " · Repisa", pieceType: "shelf", quantity,
            lengthMm: innerWidth, widthMm: dimensions.depthMm - cut.closet.frontInsetMm, edgeBanding: carcassEdge });
        } else if (component.type === "verticalDivider") {
          add(module, component, "divider", { name: label + " · División", pieceType: "divider", quantity,
            lengthMm: innerHeight, widthMm: dimensions.depthMm, edgeBanding: carcassEdge });
        } else if (component.type === "doorSet") {
          const leafWidth = (dimensions.widthMm - cut.closet.doorGapMm * (quantity + 1)) / quantity;
          add(module, component, "door", { name: label + " · Puerta", pieceType: "door", quantity, material: fronts,
            lengthMm: dimensions.heightMm - cut.closet.doorGapMm * 2, widthMm: leafWidth,
            edgeBanding: edge(cut.edgeBanding.front, cut.edgeBanding.front, cut.edgeBanding.front, cut.edgeBanding.front) });
        } else if (component.type === "drawerStack") {
          const drawerDepth = dimensions.depthMm - cut.closet.drawerDepthInsetMm;
          const boxWidth = innerWidth - cut.closet.drawerBoxSideClearanceMm;
          add(module, component, "drawer-side", { name: label + " · Lateral cajón", pieceType: "drawerSide", quantity: quantity * 2,
            lengthMm: drawerDepth, widthMm: cut.closet.drawerSideHeightMm, edgeBanding: edge() });
          add(module, component, "drawer-front-back", { name: label + " · Frente/trasera cajón", pieceType: "drawerFrontBack", quantity: quantity * 2,
            lengthMm: boxWidth - thickness * 2, widthMm: cut.closet.drawerSideHeightMm, edgeBanding: edge() });
          add(module, component, "drawer-bottom", { name: label + " · Fondo cajón", pieceType: "drawerBottom", quantity,
            lengthMm: drawerDepth - cut.closet.drawerBottomInsetMm, widthMm: boxWidth - cut.closet.drawerBottomInsetMm,
            thicknessMm: standards.panels.backThicknessMm, edgeBanding: edge(), grainDirection: "none", allowRotation: true });
          add(module, component, "drawer-front", { name: label + " · Frente de cajón", pieceType: "drawerFront", quantity, material: fronts,
            lengthMm: innerWidth - cut.closet.drawerFrontGapMm * 2,
            widthMm: Math.max(cut.closet.drawerSideHeightMm, Math.floor(innerHeight / quantity) - cut.closet.drawerFrontGapMm),
            edgeBanding: edge(cut.edgeBanding.front, cut.edgeBanding.front, cut.edgeBanding.front, cut.edgeBanding.front) });
        }
      });
    });
    return {
      schemaVersion: 1,
      designSchemaVersion: envelope.schemaVersion,
      designGeneratorVersion: envelope.generatorVersion,
      sourceDesignId,
      pieces,
      totals: summarizePieces(pieces),
      edgeBandingTotals: calculateEdgeBanding(pieces),
      validation: report,
    };
  }

  function summarizePieces(pieces) {
    return {
      groupedRows: pieces.length,
      totalPieces: pieces.reduce(function (sum, piece) { return sum + piece.quantity; }, 0),
      totalAreaMm2: pieces.reduce(function (sum, piece) { return sum + piece.lengthMm * piece.widthMm * piece.quantity; }, 0),
    };
  }
  function calculateEdgeBanding(pieces) {
    const totals = new Map();
    pieces.forEach(function (piece) {
      [["top", piece.lengthMm], ["bottom", piece.lengthMm], ["left", piece.widthMm], ["right", piece.widthMm]].forEach(function (entry) {
        const type = piece.edgeBanding[entry[0]];
        if (type) totals.set(type, (totals.get(type) || 0) + entry[1] * piece.quantity);
      });
    });
    return Array.from(totals, function ([type, lengthMm]) { return { type, lengthMm, linearMeters: Math.round(lengthMm) / 1000 }; })
      .sort(function (a, b) { return a.type.localeCompare(b.type); });
  }

  return { generateClosetPieces, summarizePieces, calculateEdgeBanding };
});
