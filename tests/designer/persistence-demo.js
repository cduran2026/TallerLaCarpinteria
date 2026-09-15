(function () {
  "use strict";
  // Loaded only with ?designerTest=1. No automatic writes or automatic restoration.
  const api = window.TALLER_CONFIGURATION;
  const codec = window.TALLER_SERIALIZATION;
  const key = "taller:designer:persistence-test:v1";
  const panel = document.createElement("section");
  panel.id = "designer-persistence-test";
  panel.className = "fc-group";
  panel.setAttribute("aria-label", "Prueba temporal de persistencia");
  const title = document.createElement("strong");
  title.textContent = "Prueba temporal de persistencia";
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = "Almacenamiento local de prueba. No guarda datos del cliente.";
  panel.append(title);
  const action = (id, label, fn) => {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = "fc-reset-button";
    button.textContent = label;
    button.addEventListener("click", () => {
      try { status.textContent = fn(); }
      catch (error) { status.textContent = `No se pudo completar la prueba: ${error.message}`; }
    });
    panel.append(button);
  };
  action("designer-test-save", "Guardar diseño", () => {
    localStorage.setItem(key, codec.serialize(api.getState()));
    return "Diseño guardado temporalmente en este navegador.";
  });
  action("designer-test-change", "Cambiar configuración", () => {
    const type = api.getState().type === "kitchen" ? "closet" : "kitchen";
    api.loadState({ type, kitchenLayout: "l", width: 300, secondLeg: 200, height: 260, depth: 75,
      upper: true, lower: true, rod: false, shelves: 0, drawers: 2,
      sink: type === "kitchen", oven: type === "kitchen", hood: true,
      material: "premium", color: "#1b2a4a", unit: "mm" });
    return "Configuración cambiada. Puedes recuperar el diseño guardado.";
  });
  action("designer-test-load", "Recuperar diseño", () => {
    const saved = localStorage.getItem(key);
    if (saved === null) throw new Error("Primero guarda un diseño.");
    api.loadState(codec.deserialize(saved));
    return "Diseño recuperado.";
  });
  panel.append(status);
  document.querySelector(".configurator-controls").append(panel);
})();
