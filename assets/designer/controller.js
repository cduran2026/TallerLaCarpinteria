// Shared designer API. See README.md for state, units and notification contracts.
document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  if (!document.querySelector("[data-furniture-viewer]")) return;
  const DEFAULT_COLOR = "#333936";

  const els = {
    type: () => document.querySelector('input[name="fcType"]:checked'),
    kitchenLayout: () => document.querySelector('input[name="fcKitchenLayout"]:checked'),
    modules: () => document.querySelector('input[name="fcModules"]:checked'),
    finish: () => document.querySelector('input[name="fcFinish"]:checked'),
    color: () => document.querySelector('input[name="fcColor"]:checked'),
    width: document.querySelector("#fc-width"),
    widthLabel: document.querySelector("#fc-width-label"),
    widthOut: document.querySelector("#fc-width-value"),
    secondLeg: document.querySelector("#fc-second-leg"),
    secondLegOut: document.querySelector("#fc-second-leg-value"),
    secondLegGroup: document.querySelector("#fc-second-leg-group"),
    height: document.querySelector("#fc-height"),
    heightOut: document.querySelector("#fc-height-value"),
    depth: document.querySelector("#fc-depth"),
    depthOut: document.querySelector("#fc-depth-value"),
    rod: document.querySelector("#fc-rod"),
    shelves: document.querySelector("#fc-shelves"),
    drawers: document.querySelector("#fc-drawers"),
    sink: document.querySelector("#fc-sink"),
    oven: document.querySelector("#fc-oven"),
    hood: document.querySelector("#fc-hood"),
    kitchenLayoutGroup: document.querySelector("#fc-kitchen-layout-group"),
    closetHeightGroup: document.querySelector("#fc-closet-height-group"),
    kitchenFields: document.querySelector("#fc-kitchen-fields"),
    closetFields: document.querySelector("#fc-closet-fields"),
    appliancesGroup: document.querySelector("#fc-appliances-group"),
    reset: document.querySelector("#fc-reset"),
  };

  const SHELF_COUNT = 3;
  const DRAWER_COUNT = 2;

  // El formulario es la fuente del estado inicial y funciona sin el visor.
  const modulesInit = els.modules()?.value || "ambos";
  const finishInit = els.finish()?.value || "standard";
  const state = {
    type: els.type()?.value || "kitchen",
    kitchenLayout: els.kitchenLayout()?.value || "straight",
    width: Number(els.width?.value) || 220,
    secondLeg: Number(els.secondLeg?.value) || 150,
    height: Number(els.height?.value) || 240,
    depth: Number(els.depth?.value) || 60,
    upper: modulesInit !== "base",
    lower: modulesInit !== "aereos",
    rod: els.rod ? els.rod.checked : true,
    shelves: els.shelves && els.shelves.checked ? SHELF_COUNT : 0,
    drawers: els.drawers && els.drawers.checked ? DRAWER_COUNT : 0,
    sink: els.sink ? els.sink.checked : false,
    oven: els.oven ? els.oven.checked : false,
    hood: els.hood ? els.hood.checked : false,
    material: finishInit,
    color: els.color()?.value || DEFAULT_COLOR,
    unit: "cm",
  };

  const KITCHEN_DEFAULTS = { width: 220, depth: 60, kitchenLayout: "straight", secondLeg: 150, upper: true, lower: true, sink: false, oven: false, hood: false };
  const CLOSET_DEFAULTS = { width: 200, height: 240, depth: 60, rod: true, shelves: SHELF_COUNT, drawers: 0 };

  function fmt(cmValue) {
    return state.unit === "mm" ? `${Math.round(cmValue * 10)} mm` : `${Math.round(cmValue)} cm`;
  }

  function syncOutputs() {
    if (els.widthOut) els.widthOut.textContent = fmt(state.width);
    if (els.secondLegOut) els.secondLegOut.textContent = fmt(state.secondLeg);
    if (els.heightOut) els.heightOut.textContent = fmt(state.height);
    if (els.depthOut) els.depthOut.textContent = fmt(state.depth);
  }

  function syncFieldsToState() {
    document.querySelectorAll('input[name="fcType"]').forEach((i) => (i.checked = i.value === state.type));
    document.querySelectorAll('input[name="fcFinish"]').forEach((i) => (i.checked = i.value === state.material));
    if (els.width) els.width.value = String(state.width);
    if (els.secondLeg) els.secondLeg.value = String(state.secondLeg);
    if (els.height) els.height.value = String(state.height);
    if (els.depth) els.depth.value = String(state.depth);
    document.querySelectorAll('input[name="fcColor"]').forEach((i) => (i.checked = i.value === state.color));
    if (els.rod) els.rod.checked = state.rod;
    if (els.shelves) els.shelves.checked = state.shelves > 0;
    if (els.drawers) els.drawers.checked = state.drawers > 0;
    const hasBase = state.type === "kitchen" && state.lower;
    if (!hasBase) { state.sink = false; state.oven = false; }
    if (els.sink) { els.sink.disabled = !hasBase; els.sink.checked = state.sink; }
    if (els.oven) { els.oven.disabled = !hasBase; els.oven.checked = state.oven; }
    if (els.hood) els.hood.checked = state.hood;
    document.querySelectorAll('input[name="fcKitchenLayout"]').forEach((i) => (i.checked = i.value === state.kitchenLayout));
    const modulesValue = state.upper && state.lower ? "ambos" : state.upper ? "aereos" : "base";
    document.querySelectorAll('input[name="fcModules"]').forEach((i) => (i.checked = i.value === modulesValue));
  }

  function applyTypeVisibility() {
    const isKitchen = state.type === "kitchen";
    if (els.widthLabel) els.widthLabel.textContent = isKitchen ? "Largo principal" : "Ancho";
    if (els.kitchenLayoutGroup) els.kitchenLayoutGroup.hidden = !isKitchen;
    if (els.secondLegGroup) els.secondLegGroup.hidden = !isKitchen || state.kitchenLayout !== "l";
    if (els.closetHeightGroup) els.closetHeightGroup.hidden = isKitchen;
    if (els.kitchenFields) els.kitchenFields.hidden = !isKitchen;
    if (els.closetFields) els.closetFields.hidden = isKitchen;
    if (els.appliancesGroup) els.appliancesGroup.hidden = !isKitchen;
  }

  function publishConfiguration() {
    syncFieldsToState();
    applyTypeVisibility();
    syncOutputs();
    window.dispatchEvent(new CustomEvent("taller:configuration", { detail: Object.freeze({ ...state }) }));
  }

  applyTypeVisibility();

  document.querySelectorAll('input[name="fcType"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.type = input.value;
      Object.assign(state, state.type === "kitchen" ? KITCHEN_DEFAULTS : CLOSET_DEFAULTS);
      publishConfiguration();
    });
  });

  document.querySelectorAll('input[name="fcKitchenLayout"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.kitchenLayout = input.value;
      applyTypeVisibility();
      publishConfiguration();
    });
  });

  document.querySelectorAll('input[name="fcModules"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.upper = input.value !== "base";
      state.lower = input.value !== "aereos";
      publishConfiguration();
    });
  });

  document.querySelectorAll('input[name="fcFinish"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.material = input.value;
      publishConfiguration();
    });
  });

  document.querySelectorAll('input[name="fcColor"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.color = input.value;
      publishConfiguration();
    });
  });

  els.width?.addEventListener("input", (e) => {
    state.width = Number(e.target.value);
    publishConfiguration();
  });
  els.secondLeg?.addEventListener("input", (e) => {
    state.secondLeg = Number(e.target.value);
    publishConfiguration();
  });
  els.height?.addEventListener("input", (e) => {
    state.height = Number(e.target.value);
    publishConfiguration();
  });
  els.depth?.addEventListener("input", (e) => {
    state.depth = Number(e.target.value);
    publishConfiguration();
  });
  els.rod?.addEventListener("change", (e) => {
    state.rod = e.target.checked;
    publishConfiguration();
  });
  els.shelves?.addEventListener("change", (e) => {
    state.shelves = e.target.checked ? SHELF_COUNT : 0;
    publishConfiguration();
  });
  els.drawers?.addEventListener("change", (e) => {
    state.drawers = e.target.checked ? DRAWER_COUNT : 0;
    publishConfiguration();
  });
  els.sink?.addEventListener("change", (e) => {
    state.sink = e.target.checked;
    publishConfiguration();
  });
  els.oven?.addEventListener("change", (e) => {
    state.oven = e.target.checked;
    publishConfiguration();
  });
  els.hood?.addEventListener("change", (e) => {
    state.hood = e.target.checked;
    publishConfiguration();
  });

  function reset() {
    Object.assign(state, state.type === "kitchen" ? KITCHEN_DEFAULTS : CLOSET_DEFAULTS);
    state.material = "standard";
    state.color = DEFAULT_COLOR;
    state.unit = "cm";
    publishConfiguration();
    return getState();
  }
  els.reset?.addEventListener("click", reset);

  syncOutputs();

  syncFieldsToState();
  function getState() { return { ...state }; }

  // Validate first, then commit once. No synthetic input/change events or type defaults.
  function loadState(configuration) {
    const next = window.TALLER_SERIALIZATION.validate(configuration);
    Object.assign(state, next);
    publishConfiguration();
    return getState();
  }

  // No initial callback. Each notification receives its own detached snapshot.
  function subscribe(callback) {
    if (typeof callback !== "function") throw new TypeError("subscribe requiere una función.");
    const listener = () => callback(getState());
    window.addEventListener("taller:configuration", listener);
    return () => window.removeEventListener("taller:configuration", listener);
  }

  window.TALLER_CONFIGURATION = Object.freeze({ getState, loadState, reset, subscribe });

});
