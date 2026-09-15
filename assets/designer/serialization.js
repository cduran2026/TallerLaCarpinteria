(function () {
  "use strict";
  const SCHEMA_VERSION = 1;
  const GENERATOR_VERSION = "1.0.0";
  const enums = {
    type: ["kitchen", "closet"], kitchenLayout: ["straight", "l"],
    shelves: [0, 3], drawers: [0, 2], material: ["standard", "premium"],
    color: ["#333936", "#8a6a46", "#f2ede4", "#5c1a24", "#1b2a4a", "#cbb896"],
    unit: ["cm", "mm"],
  };
  // Lengths are ALWAYS centimeters; unit only changes displayed measurements.
  const ranges = { width: [120, 400, 10], secondLeg: [100, 300, 10], height: [200, 260, 10], depth: [45, 75, 5] };
  const booleans = ["upper", "lower", "rod", "sink", "oven", "hood"];
  const keys = ["type", "kitchenLayout", "width", "secondLeg", "height", "depth", "upper", "lower", "rod", "shelves", "drawers", "sink", "oven", "hood", "material", "color", "unit"];

  function object(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  /** Validate a COMPLETE state before any mutation. Returns a detached plain object. */
  function validate(configuration) {
    if (!object(configuration) || Object.keys(configuration).length !== keys.length ||
        keys.some((key) => !Object.prototype.hasOwnProperty.call(configuration, key))) {
      throw new Error("La configuración debe contener exactamente todos los campos del esquema 1.");
    }
    for (const [key, values] of Object.entries(enums)) {
      if (!values.includes(configuration[key])) throw new Error(`Valor no compatible: ${key}.`);
    }
    for (const [key, [min, max, step]] of Object.entries(ranges)) {
      const value = configuration[key];
      if (!Number.isFinite(value) || value < min || value > max || (value - min) % step !== 0) {
        throw new Error(`Medida fuera del rango o paso admitido: ${key}.`);
      }
    }
    for (const key of booleans) {
      if (typeof configuration[key] !== "boolean") throw new Error(`Se esperaba verdadero/falso: ${key}.`);
    }
    if (!configuration.upper && !configuration.lower) throw new Error("Selecciona bases, aéreos o ambos.");
    if ((configuration.type !== "kitchen" || !configuration.lower) && (configuration.sink || configuration.oven)) {
      throw new Error("Lavaplatos y horno requieren una cocina con bases.");
    }
    return Object.fromEntries(keys.map((key) => [key, configuration[key]]));
  }

  /** Serialize an explicit state, normally controller.getState(). No storage or DOM access. */
  function serialize(configuration) {
    return JSON.stringify({ schemaVersion: SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION,
      configuration: validate(configuration) }, null, 2);
  }

  /** Parse and validate a versioned JSON string. Unknown versions are never silently migrated. */
  function deserialize(json) {
    const saved = JSON.parse(json);
    if (!object(saved) || saved.schemaVersion !== SCHEMA_VERSION || saved.generatorVersion !== GENERATOR_VERSION) {
      throw new Error("Versión de diseño no compatible; no se modificó el diseño actual.");
    }
    return validate(saved.configuration);
  }

  window.TALLER_SERIALIZATION = Object.freeze({
    schemaVersion: SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION, validate, serialize, deserialize,
  });
})();
