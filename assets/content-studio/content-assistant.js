(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_CONTENT_ASSISTANT = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function createContentAssistant(provider) {
    return Object.freeze({
      mode: provider ? "assisted" : "manual",
      isAvailable: Boolean(provider),
      async suggest(context) {
        if (!provider || typeof provider.suggest !== "function") throw new Error("El asistente de contenido todavía no está configurado.");
        return provider.suggest(structuredClone(context || {}));
      },
    });
  }
  return { createContentAssistant };
});
