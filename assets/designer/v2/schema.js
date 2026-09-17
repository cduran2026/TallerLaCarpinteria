(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_DESIGNER_V2_SCHEMA = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 2;
  const GENERATOR_VERSION = "2.0.0";
  const DESIGN_TYPES = Object.freeze(["kitchen", "closet"]);
  const UNIT = "mm";
  const ZONES = Object.freeze({ kitchen: ["base", "wall"], closet: ["body"] });
  const MODULE_TYPES = Object.freeze({
    kitchen: [
      "kitchen.base.door", "kitchen.base.drawers", "kitchen.base.sink",
      "kitchen.base.oven", "kitchen.base.corner", "kitchen.base.open",
      "kitchen.wall.door", "kitchen.wall.open", "kitchen.wall.hood",
      "kitchen.wall.corner", "kitchen.filler",
    ],
    closet: [
      "closet.hanging", "closet.shelves", "closet.drawers",
      "closet.mixed", "closet.open",
    ],
  });
  const COMPONENT_TYPES = Object.freeze([
    "shelfSet", "drawerStack", "rodSet", "doorSet", "verticalDivider", "openSpace",
  ]);
  const QUANTITY_MODES = Object.freeze(["automatic", "manual"]);

  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function createEnvelope(configuration, generatorVersion = GENERATOR_VERSION) {
    return { schemaVersion: SCHEMA_VERSION, generatorVersion, configuration: clone(configuration) };
  }

  return {
    SCHEMA_VERSION, GENERATOR_VERSION, DESIGN_TYPES, UNIT, ZONES, MODULE_TYPES,
    COMPONENT_TYPES, QUANTITY_MODES, isPlainObject, clone, createEnvelope,
  };
});
