(function (root, factory) {
  "use strict";
  const schema = typeof module === "object" && module.exports
    ? require("./schema.js") : root.TALLER_DESIGNER_V2_SCHEMA;
  const occupancy = typeof module === "object" && module.exports
    ? require("./occupancy.js") : root.TALLER_DESIGNER_V2_OCCUPANCY;
  const api = factory(schema, occupancy);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_DESIGNER_V2_VALIDATION = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema, occupancy) {
  "use strict";
  if (!schema || !occupancy) throw new Error("Designer V2 validation requiere schema.js y occupancy.js.");

  function issue(code, path, message, severity, category) {
    return {
      code,
      path,
      message,
      severity: severity || "error",
      category: category || "contract",
    };
  }
  function integer(value, min) {
    return Number.isInteger(value) && value >= (min === undefined ? 0 : min);
  }
  function string(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function summarize(issues, occupancyRows) {
    const hasErrors = issues.some(function (item) { return item.severity === "error"; });
    const hasBlockingStructure = issues.some(function (item) {
      return item.severity === "error" && item.category !== "geometry";
    });
    const isValid = !hasErrors;
    const isComplete = issues.length === 0;
    return {
      isEditable: !hasBlockingStructure,
      isValid,
      isComplete,
      canGenerateTechnicalOutputs: isValid && isComplete,
      valid: isValid,
      complete: isComplete,
      issues,
      occupancy: occupancyRows,
    };
  }

  function validateQuantity(quantity, path, issues) {
    if (!schema.isPlainObject(quantity)) {
      issues.push(issue("QUANTITY_REQUIRED", path, "El componente debe declarar su cantidad."));
      return;
    }
    if (!schema.QUANTITY_MODES.includes(quantity.mode)) {
      issues.push(issue("QUANTITY_MODE", path + ".mode", "El modo debe ser automatic o manual."));
    }
    for (const field of ["recommended", "applied", "resolved"]) {
      if (!integer(quantity[field])) {
        issues.push(issue("QUANTITY_VALUE", path + "." + field, field + " debe ser un entero no negativo."));
      }
    }
  }

  function validateMaterials(materials, issues) {
    if (!schema.isPlainObject(materials) || !Array.isArray(materials.catalog) ||
        !schema.isPlainObject(materials.assignments)) {
      issues.push(issue("MATERIALS_SHAPE", "configuration.materials", "Materiales requiere catalog y assignments."));
      return;
    }
    const ids = new Set();
    materials.catalog.forEach(function (material, index) {
      const path = "configuration.materials.catalog[" + index + "]";
      if (!schema.isPlainObject(material) || !string(material.id)) {
        issues.push(issue("MATERIAL_ID", path + ".id", "El material requiere un identificador."));
        return;
      }
      if (ids.has(material.id)) issues.push(issue("DUPLICATE_ID", path + ".id", "Identificador de material duplicado."));
      ids.add(material.id);
      if (!integer(material.thicknessMm, 1)) {
        issues.push(issue("MATERIAL_THICKNESS", path + ".thicknessMm", "El espesor debe ser positivo."));
      }
      if (!schema.isPlainObject(material.sheet) || !integer(material.sheet.widthMm, 1) ||
          !integer(material.sheet.lengthMm, 1)) {
        issues.push(issue("SHEET_DIMENSIONS", path + ".sheet", "La plancha requiere ancho y largo positivos."));
      }
      if (!schema.isPlainObject(material.grain) || !["none", "directional"].includes(material.grain.mode)) {
        issues.push(issue("GRAIN_MODE", path + ".grain.mode", "La veta debe ser none o directional."));
      }
    });
    Object.entries(materials.assignments).forEach(function (entry) {
      if (!string(entry[1]) || !ids.has(entry[1])) {
        issues.push(issue("MATERIAL_REFERENCE", "configuration.materials.assignments." + entry[0], "El rol referencia un material inexistente."));
      }
    });
  }

  function validateStandards(standards, issues) {
    if (!schema.isPlainObject(standards) || !string(standards.profileId) ||
        !string(standards.profileVersion) || !schema.isPlainObject(standards.snapshot)) {
      issues.push(issue("STANDARDS_SHAPE", "configuration.standards", "Se requiere un snapshot de perfil versionado."));
      return;
    }
    const required = [
      ["panels.carcassThicknessMm", standards.snapshot.panels?.carcassThicknessMm],
      ["panels.backThicknessMm", standards.snapshot.panels?.backThicknessMm],
      ["panels.defaultSheetWidthMm", standards.snapshot.panels?.defaultSheetWidthMm],
      ["panels.defaultSheetLengthMm", standards.snapshot.panels?.defaultSheetLengthMm],
      ["closet.targetBodyWidthMm", standards.snapshot.closet?.targetBodyWidthMm],
      ["closet.minBodyWidthMm", standards.snapshot.closet?.minBodyWidthMm],
      ["closet.maxBodyWidthMm", standards.snapshot.closet?.maxBodyWidthMm],
      ["closet.defaultHeightMm", standards.snapshot.closet?.defaultHeightMm],
      ["closet.defaultDepthMm", standards.snapshot.closet?.defaultDepthMm],
      ["closet.targetShelfSpacingMm", standards.snapshot.closet?.targetShelfSpacingMm],
      ["closet.shelfTopClearanceMm", standards.snapshot.closet?.shelfTopClearanceMm],
      ["closet.shelfBottomClearanceMm", standards.snapshot.closet?.shelfBottomClearanceMm],
      ["closet.topShelfOffsetMm", standards.snapshot.closet?.topShelfOffsetMm],
      ["closet.defaultDrawerCount", standards.snapshot.closet?.defaultDrawerCount],
      ["closet.minDrawerCount", standards.snapshot.closet?.minDrawerCount],
      ["closet.maxDrawerCount", standards.snapshot.closet?.maxDrawerCount],
      ["closet.defaultRodHeightMm", standards.snapshot.closet?.defaultRodHeightMm],
      ["closet.maxDoorLeafWidthMm", standards.snapshot.closet?.maxDoorLeafWidthMm],
      ["kitchen.baseCarcassHeightMm", standards.snapshot.kitchen?.baseCarcassHeightMm],
      ["kitchen.baseCarcassDepthMm", standards.snapshot.kitchen?.baseCarcassDepthMm],
      ["kitchen.wallCarcassHeightMm", standards.snapshot.kitchen?.wallCarcassHeightMm],
      ["kitchen.wallCarcassDepthMm", standards.snapshot.kitchen?.wallCarcassDepthMm],
      ["kitchen.plinthHeightMm", standards.snapshot.kitchen?.plinthHeightMm],
      ["kitchen.countertopThicknessMm", standards.snapshot.kitchen?.countertopThicknessMm],
      ["kitchen.countertopDepthMm", standards.snapshot.kitchen?.countertopDepthMm],
      ["kitchen.wallGapMm", standards.snapshot.kitchen?.wallGapMm],
      ["kitchen.defaultDrawerModuleWidthMm", standards.snapshot.kitchen?.defaultDrawerModuleWidthMm],
      ["kitchen.defaultDoorModuleWidthMm", standards.snapshot.kitchen?.defaultDoorModuleWidthMm],
      ["kitchen.defaultSinkWidthMm", standards.snapshot.kitchen?.defaultSinkWidthMm],
      ["kitchen.defaultOvenWidthMm", standards.snapshot.kitchen?.defaultOvenWidthMm],
      ["kitchen.defaultCornerWidthMm", standards.snapshot.kitchen?.defaultCornerWidthMm],
      ["kitchen.defaultDrawerCount", standards.snapshot.kitchen?.defaultDrawerCount],
      ["kitchen.minDrawerCount", standards.snapshot.kitchen?.minDrawerCount],
      ["kitchen.maxDrawerCount", standards.snapshot.kitchen?.maxDrawerCount],
      ["kitchen.maxDoorLeafWidthMm", standards.snapshot.kitchen?.maxDoorLeafWidthMm],
    ];
    required.forEach(function (entry) {
      if (!integer(entry[1], 1)) {
        issues.push(issue("STANDARD_VALUE", "configuration.standards.snapshot." + entry[0], "El estándar debe ser un entero positivo."));
      }
    });
    const preferred = standards.snapshot.kitchen?.preferredWidthsMm;
    if (!Array.isArray(preferred) || preferred.length === 0 ||
        preferred.some(function (value) { return !integer(value, 1); })) {
      issues.push(issue(
        "STANDARD_WIDTHS",
        "configuration.standards.snapshot.kitchen.preferredWidthsMm",
        "Los anchos preferidos deben ser una lista de enteros positivos."
      ));
    }
    const closet = standards.snapshot.closet;
    if (closet && (closet.minBodyWidthMm > closet.targetBodyWidthMm ||
        closet.targetBodyWidthMm > closet.maxBodyWidthMm ||
        closet.minDrawerCount > closet.defaultDrawerCount ||
        closet.defaultDrawerCount > closet.maxDrawerCount)) {
      issues.push(issue("STANDARD_RANGE", "configuration.standards.snapshot.closet", "Los valores predeterminados deben estar dentro de sus rangos."));
    }
    const kitchen = standards.snapshot.kitchen;
    if (kitchen && (kitchen.minDrawerCount > kitchen.defaultDrawerCount ||
        kitchen.defaultDrawerCount > kitchen.maxDrawerCount)) {
      issues.push(issue("STANDARD_RANGE", "configuration.standards.snapshot.kitchen", "La cantidad predeterminada de cajones debe estar dentro del rango."));
    }
  }

  function validateConfiguration(configuration) {
    const issues = [];
    if (!schema.isPlainObject(configuration)) {
      return summarize(
        [issue("CONFIGURATION_REQUIRED", "configuration", "Se requiere una configuración V2.")],
        []
      );
    }
    if (!schema.DESIGN_TYPES.includes(configuration.type)) {
      issues.push(issue("DESIGN_TYPE", "configuration.type", "Tipo de diseño no compatible."));
    }
    if (configuration.units !== schema.UNIT) {
      issues.push(issue("UNITS", "configuration.units", "V2 utiliza milímetros como unidad canónica."));
    }
    if (!schema.isPlainObject(configuration.dimensions)) {
      issues.push(issue("DIMENSIONS_SHAPE", "configuration.dimensions", "Se requieren dimensiones generales."));
    } else {
      Object.entries(configuration.dimensions).forEach(function (entry) {
        if (entry[0].endsWith("Mm") && !integer(entry[1], 1)) {
          issues.push(issue("DIMENSION_VALUE", "configuration.dimensions." + entry[0], "La dimensión debe ser un entero positivo."));
        }
      });
    }
    validateMaterials(configuration.materials, issues);
    validateStandards(configuration.standards, issues);

    const runs = configuration.layout?.runs;
    const runIds = new Set();
    const zoneKeys = new Set();
    if (!schema.isPlainObject(configuration.layout) || !string(configuration.layout.kind) ||
        !Array.isArray(runs) || runs.length === 0) {
      issues.push(issue("LAYOUT_SHAPE", "configuration.layout", "El layout requiere al menos un tramo."));
    } else {
      runs.forEach(function (run, runIndex) {
        const path = "configuration.layout.runs[" + runIndex + "]";
        if (!schema.isPlainObject(run) || !string(run.id)) {
          issues.push(issue("RUN_ID", path + ".id", "El tramo requiere un identificador."));
          return;
        }
        if (runIds.has(run.id)) issues.push(issue("DUPLICATE_ID", path + ".id", "Identificador de tramo duplicado."));
        runIds.add(run.id);
        if (!integer(run.lengthMm, 1)) issues.push(issue("RUN_LENGTH", path + ".lengthMm", "El largo del tramo debe ser positivo."));
        if (!schema.isPlainObject(run.originMm) || !Number.isFinite(run.originMm.x) || !Number.isFinite(run.originMm.z)) {
          issues.push(issue("RUN_ORIGIN", path + ".originMm", "El tramo requiere un origen x/z."));
        }
        if (!Number.isFinite(run.rotationDeg)) issues.push(issue("RUN_ROTATION", path + ".rotationDeg", "La rotación debe ser numérica."));
        if (!Array.isArray(run.zones) || run.zones.length === 0) {
          issues.push(issue("RUN_ZONES", path + ".zones", "El tramo requiere al menos una zona."));
          return;
        }
        run.zones.forEach(function (zone, zoneIndex) {
          const zonePath = path + ".zones[" + zoneIndex + "]";
          if (!schema.isPlainObject(zone) || !schema.ZONES[configuration.type]?.includes(zone.id)) {
            issues.push(issue("ZONE_TYPE", zonePath + ".id", "Zona incompatible con el tipo de diseño."));
            return;
          }
          const key = run.id + ":" + zone.id;
          if (zoneKeys.has(key)) issues.push(issue("DUPLICATE_ZONE", zonePath + ".id", "Zona duplicada en el tramo."));
          zoneKeys.add(key);
          ["startReserveMm", "endReserveMm"].forEach(function (field) {
            if (!integer(zone[field])) issues.push(issue("ZONE_RESERVE", zonePath + "." + field, "La reserva debe ser un entero no negativo."));
          });
          if (integer(run.lengthMm, 1) && integer(zone.startReserveMm) && integer(zone.endReserveMm) &&
              zone.startReserveMm + zone.endReserveMm >= run.lengthMm) {
            issues.push(issue("ZONE_AVAILABLE", zonePath, "Las reservas consumen todo el tramo."));
          }
        });
      });
    }

    const modules = configuration.modules;
    const moduleIds = new Set();
    const componentIds = new Set();
    const orders = new Set();
    if (!Array.isArray(modules)) {
      issues.push(issue("MODULES_SHAPE", "configuration.modules", "modules debe ser una lista."));
    } else {
      modules.forEach(function (module, moduleIndex) {
        const path = "configuration.modules[" + moduleIndex + "]";
        if (!schema.isPlainObject(module) || !string(module.id)) {
          issues.push(issue("MODULE_ID", path + ".id", "El módulo requiere un identificador."));
          return;
        }
        if (moduleIds.has(module.id)) issues.push(issue("DUPLICATE_ID", path + ".id", "Identificador de módulo duplicado."));
        moduleIds.add(module.id);
        if (!runIds.has(module.runId)) issues.push(issue("RUN_REFERENCE", path + ".runId", "El módulo referencia un tramo inexistente."));
        if (!zoneKeys.has(module.runId + ":" + module.zone)) issues.push(issue("ZONE_REFERENCE", path + ".zone", "El módulo referencia una zona inexistente."));
        if (!schema.MODULE_TYPES[configuration.type]?.includes(module.type)) {
          issues.push(issue("MODULE_TYPE", path + ".type", "Tipo de módulo incompatible con el diseño."));
        }
        if (configuration.type === "kitchen" && module.type?.startsWith("kitchen.base.") && module.zone !== "base") {
          issues.push(issue("MODULE_ZONE", path + ".zone", "Un módulo base debe estar en la zona base."));
        }
        if (configuration.type === "kitchen" && module.type?.startsWith("kitchen.wall.") && module.zone !== "wall") {
          issues.push(issue("MODULE_ZONE", path + ".zone", "Un módulo aéreo debe estar en la zona wall."));
        }
        if (configuration.type === "closet" && module.zone !== "body") {
          issues.push(issue("MODULE_ZONE", path + ".zone", "Un cuerpo de clóset debe estar en la zona body."));
        }
        if (!integer(module.order)) issues.push(issue("MODULE_ORDER", path + ".order", "El orden debe ser un entero no negativo."));
        const orderKey = module.runId + ":" + module.zone + ":" + module.order;
        if (orders.has(orderKey)) issues.push(issue("DUPLICATE_ORDER", path + ".order", "Dos módulos ocupan el mismo orden."));
        orders.add(orderKey);
        if (!schema.isPlainObject(module.dimensions)) {
          issues.push(issue("MODULE_DIMENSIONS", path + ".dimensions", "El módulo requiere dimensiones."));
        } else {
          ["widthMm", "heightMm", "depthMm"].forEach(function (field) {
            if (!integer(module.dimensions[field], 1)) {
              issues.push(issue("MODULE_DIMENSION", path + ".dimensions." + field, "La dimensión debe ser un entero positivo."));
            }
          });
        }
        if (!schema.isPlainObject(module.locks) || typeof module.locks.width !== "boolean") {
          issues.push(issue("MODULE_LOCKS", path + ".locks.width", "El módulo debe declarar el bloqueo de ancho."));
        }
        if (!Array.isArray(module.components)) {
          issues.push(issue("COMPONENTS_SHAPE", path + ".components", "components debe ser una lista."));
        } else {
          module.components.forEach(function (component, componentIndex) {
            const componentPath = path + ".components[" + componentIndex + "]";
            if (!schema.isPlainObject(component) || !string(component.id)) {
              issues.push(issue("COMPONENT_ID", componentPath + ".id", "El componente requiere un identificador."));
              return;
            }
            if (componentIds.has(component.id)) issues.push(issue("DUPLICATE_ID", componentPath + ".id", "Identificador de componente duplicado."));
            componentIds.add(component.id);
            if (!schema.COMPONENT_TYPES.includes(component.type)) {
              issues.push(issue("COMPONENT_TYPE", componentPath + ".type", "Tipo de componente no compatible."));
            }
            validateQuantity(component.quantity, componentPath + ".quantity", issues);
          });
        }
      });
    }

    if (!schema.isPlainObject(configuration.provenance) || !string(configuration.provenance.createdFrom)) {
      issues.push(issue("PROVENANCE", "configuration.provenance", "Se requiere la procedencia del diseño."));
    }

    const occupancyRows = occupancy.calculateOccupancy(configuration);
    occupancyRows.forEach(function (row) {
      const path = "configuration.layout.runs." + row.runId + "." + row.zone;
      if (row.status === "excess") {
        issues.push(issue(
          "RUN_EXCESS",
          path,
          "Los módulos exceden el tramo en " + Math.abs(row.deltaMm) + " mm.",
          "error",
          "geometry"
        ));
      } else if (row.status === "deficit") {
        issues.push(issue(
          "RUN_DEFICIT",
          path,
          "Quedan " + row.deltaMm + " mm disponibles.",
          "warning",
          "geometry"
        ));
      }
    });
    return summarize(issues, occupancyRows);
  }

  function validateEnvelope(envelope) {
    const envelopeIssues = [];
    if (!schema.isPlainObject(envelope)) {
      return summarize([issue("ENVELOPE_REQUIRED", "", "Se requiere un documento V2.")], []);
    }
    if (envelope.schemaVersion !== schema.SCHEMA_VERSION) {
      envelopeIssues.push(issue("SCHEMA_VERSION", "schemaVersion", "La versión de esquema debe ser 2."));
    }
    if (!string(envelope.generatorVersion)) {
      envelopeIssues.push(issue("GENERATOR_VERSION", "generatorVersion", "Se requiere la versión del generador."));
    }
    const result = validateConfiguration(envelope.configuration);
    const issues = envelopeIssues.concat(result.issues);
    return summarize(issues, result.occupancy);
  }

  function assertIntrinsic(configuration) {
    const result = validateConfiguration(configuration);
    const intrinsicErrors = result.issues.filter(function (item) {
      return item.severity === "error" && item.category !== "geometry";
    });
    if (intrinsicErrors.length) {
      const error = new Error(intrinsicErrors[0].message);
      error.code = intrinsicErrors[0].code;
      error.issues = intrinsicErrors;
      throw error;
    }
    return configuration;
  }

  return { validateConfiguration, validateEnvelope, assertIntrinsic };
});
