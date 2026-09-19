(function (root, factory) {
  "use strict";
  const schema = typeof module === "object" && module.exports
    ? require("./schema.js") : root.TALLER_DESIGNER_V2_SCHEMA;
  const validation = typeof module === "object" && module.exports
    ? require("./validation.js") : root.TALLER_DESIGNER_V2_VALIDATION;
  const occupancy = typeof module === "object" && module.exports
    ? require("./occupancy.js") : root.TALLER_DESIGNER_V2_OCCUPANCY;
  const api = factory(schema, validation, occupancy);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_DESIGNER_V2_STORE = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema, validation, occupancy) {
  "use strict";
  if (!schema || !validation || !occupancy) {
    throw new Error("Designer V2 store requiere schema.js, validation.js y occupancy.js.");
  }

  function defaultIdFactory(kind) {
    if (globalThis.crypto?.randomUUID) return kind + "-" + globalThis.crypto.randomUUID();
    return kind + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function findModule(configuration, moduleId) {
    const module = configuration.modules.find(function (item) { return item.id === moduleId; });
    if (!module) fail("MODULE_NOT_FOUND", "No existe el módulo " + moduleId + ".");
    return module;
  }

  function ensureUniqueId(configuration, id) {
    const used = new Set();
    configuration.layout.runs.forEach(function (run) { used.add(run.id); });
    configuration.materials.catalog.forEach(function (material) { used.add(material.id); });
    configuration.modules.forEach(function (module) {
      used.add(module.id);
      module.components.forEach(function (component) { used.add(component.id); });
    });
    if (used.has(id)) fail("DUPLICATE_ID", "El identificador " + id + " ya existe.");
  }

  function group(configuration, runId, zone, excludedId) {
    return configuration.modules
      .filter(function (module) {
        return module.runId === runId && module.zone === zone && module.id !== excludedId;
      })
      .sort(function (left, right) { return left.order - right.order; });
  }

  function assignOrders(modules) {
    modules.forEach(function (module, index) { module.order = index; });
  }

  function place(configuration, module, index) {
    const modules = group(configuration, module.runId, module.zone, module.id);
    const target = index === undefined ? modules.length : index;
    if (!Number.isInteger(target) || target < 0 || target > modules.length) {
      fail("INVALID_INDEX", "La posición del módulo no es válida.");
    }
    modules.splice(target, 0, module);
    assignOrders(modules);
  }

  function resequence(configuration, runId, zone) {
    assignOrders(group(configuration, runId, zone));
  }

  function createDesignStore(initialEnvelope, options) {
    options = options || {};
    const idFactory = options.idFactory || defaultIdFactory;
    let current = schema.clone(initialEnvelope);
    if (!schema.isPlainObject(current) || current.schemaVersion !== schema.SCHEMA_VERSION ||
        typeof current.generatorVersion !== "string" || !current.generatorVersion) {
      fail("INVALID_DOCUMENT", "El documento no corresponde al contrato V2.");
    }
    validation.assertIntrinsic(current.configuration);
    const subscribers = new Set();

    function getState() {
      return schema.clone(current);
    }

    function getConfiguration() {
      return schema.clone(current.configuration);
    }

    function inspect() {
      return validation.validateEnvelope(current);
    }

    function notify(operation) {
      const snapshot = getState();
      const diagnostics = inspect();
      subscribers.forEach(function (callback) {
        callback(schema.clone(snapshot), { operation, diagnostics: schema.clone(diagnostics) });
      });
    }

    function transact(operation, mutate) {
      const next = schema.clone(current);
      const result = mutate(next.configuration);
      validation.assertIntrinsic(next.configuration);
      current = next;
      notify(operation);
      return result;
    }

    function addModule(module, target) {
      target = target || {};
      const input = schema.clone(module);
      return transact("addModule", function (configuration) {
        if (!schema.isPlainObject(input) || typeof input.id !== "string" || !input.id) {
          fail("MODULE_ID", "El módulo requiere un identificador.");
        }
        ensureUniqueId(configuration, input.id);
        (input.components || []).forEach(function (component) {
          ensureUniqueId(configuration, component.id);
        });
        if (target.runId !== undefined) input.runId = target.runId;
        if (target.zone !== undefined) input.zone = target.zone;
        configuration.modules.push(input);
        place(configuration, input, target.index);
        return input.id;
      });
    }

    function removeModule(moduleId) {
      return transact("removeModule", function (configuration) {
        const module = findModule(configuration, moduleId);
        const index = configuration.modules.findIndex(function (item) { return item.id === moduleId; });
        configuration.modules.splice(index, 1);
        resequence(configuration, module.runId, module.zone);
        return moduleId;
      });
    }

    function duplicateModule(moduleId, target) {
      target = target || {};
      let duplicatedId;
      transact("duplicateModule", function (configuration) {
        const source = findModule(configuration, moduleId);
        const copy = schema.clone(source);
        copy.id = target.id || idFactory("module");
        ensureUniqueId(configuration, copy.id);
        copy.components.forEach(function (component) {
          component.id = idFactory("component");
          ensureUniqueId(configuration, component.id);
        });
        copy.runId = target.runId || source.runId;
        copy.zone = target.zone || source.zone;
        configuration.modules.push(copy);
        const defaultIndex = copy.runId === source.runId && copy.zone === source.zone
          ? source.order + 1 : undefined;
        place(configuration, copy, target.index === undefined ? defaultIndex : target.index);
        duplicatedId = copy.id;
      });
      return duplicatedId;
    }

    function moveModule(moduleId, target) {
      if (!schema.isPlainObject(target)) fail("MOVE_TARGET", "Se requiere un destino.");
      return transact("moveModule", function (configuration) {
        const module = findModule(configuration, moduleId);
        const previousRunId = module.runId;
        const previousZone = module.zone;
        module.runId = target.runId || module.runId;
        module.zone = target.zone || module.zone;
        if (previousRunId !== module.runId || previousZone !== module.zone) {
          resequence(configuration, previousRunId, previousZone);
        }
        place(configuration, module, target.index);
        return moduleId;
      });
    }

    function changeModuleWidth(moduleId, widthMm) {
      if (!Number.isInteger(widthMm) || widthMm <= 0) fail("MODULE_WIDTH", "El ancho debe ser un entero positivo.");
      return transact("changeModuleWidth", function (configuration) {
        const module = findModule(configuration, moduleId);
        if (module.locks.width) fail("WIDTH_LOCKED", "El ancho del módulo está bloqueado.");
        module.dimensions.widthMm = widthMm;
        return moduleId;
      });
    }

    function setModuleWidthLocked(moduleId, locked) {
      if (typeof locked !== "boolean") fail("MODULE_LOCK", "El bloqueo debe ser verdadero o falso.");
      return transact("setModuleWidthLocked", function (configuration) {
        findModule(configuration, moduleId).locks.width = locked;
        return moduleId;
      });
    }

    function addComponent(moduleId, component, index) {
      const input = schema.clone(component);
      return transact("addComponent", function (configuration) {
        const module = findModule(configuration, moduleId);
        if (!schema.isPlainObject(input) || typeof input.id !== "string" || !input.id) {
          fail("COMPONENT_ID", "El componente requiere un identificador.");
        }
        ensureUniqueId(configuration, input.id);
        const target = index === undefined ? module.components.length : index;
        if (!Number.isInteger(target) || target < 0 || target > module.components.length) {
          fail("INVALID_INDEX", "La posición del componente no es válida.");
        }
        module.components.splice(target, 0, input);
        return input.id;
      });
    }

    function removeComponent(moduleId, componentId) {
      return transact("removeComponent", function (configuration) {
        const module = findModule(configuration, moduleId);
        const index = module.components.findIndex(function (item) { return item.id === componentId; });
        if (index < 0) fail("COMPONENT_NOT_FOUND", "No existe el componente " + componentId + ".");
        module.components.splice(index, 1);
        return componentId;
      });
    }

    function updateComponent(moduleId, componentId, changes) {
      if (!schema.isPlainObject(changes)) fail("COMPONENT_CHANGES", "Se requieren cambios para el componente.");
      const input = schema.clone(changes);
      delete input.id;
      return transact("updateComponent", function (configuration) {
        const module = findModule(configuration, moduleId);
        const index = module.components.findIndex(function (item) { return item.id === componentId; });
        if (index < 0) fail("COMPONENT_NOT_FOUND", "No existe el componente " + componentId + ".");
        module.components[index] = Object.assign({}, module.components[index], input, { id: componentId });
        return componentId;
      });
    }

    function subscribe(callback) {
      if (typeof callback !== "function") throw new TypeError("subscribe requiere una función.");
      subscribers.add(callback);
      return function () { subscribers.delete(callback); };
    }

    return Object.freeze({
      getState,
      getConfiguration,
      validate: inspect,
      getStatus: inspect,
      getOccupancy: function () { return occupancy.calculateOccupancy(current.configuration); },
      subscribe,
      addModule,
      removeModule,
      duplicateModule,
      moveModule,
      changeModuleWidth,
      setModuleWidthLocked,
      addComponent,
      removeComponent,
      updateComponent,
    });
  }

  return { createDesignStore };
});
