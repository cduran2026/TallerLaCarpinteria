document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const WA = "56988085830";
  const waURL = (message) => `https://wa.me/${WA}?text=${encodeURIComponent(message)}`;
  window.tallerAnalytics = window.tallerAnalytics || [];
  const track = (event, detail = {}) => {
    const payload = { event, ...detail, timestamp: new Date().toISOString() };
    window.tallerAnalytics.push(payload);
    window.dispatchEvent(new CustomEvent("taller:analytics", { detail: payload }));
  };

  // Estado y controles disponibles antes de cargar WebGL.
  if (document.querySelector("[data-furniture-viewer]")) {
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
    window.dispatchEvent(new CustomEvent("taller:configuration", { detail: { ...state } }));
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

  els.reset?.addEventListener("click", () => {
    Object.assign(state, state.type === "kitchen" ? KITCHEN_DEFAULTS : CLOSET_DEFAULTS);
    state.material = "standard";
    state.color = DEFAULT_COLOR;
    state.unit = "cm";
    document.querySelectorAll('input[name="fcFinish"]').forEach((i) => (i.checked = i.value === "standard"));
    publishConfiguration();
  });

  syncOutputs();

  syncFieldsToState();
  window.TALLER_CONFIGURATION = { getState: () => ({ ...state }) };
  }

  // Configurador 3D unificado (cocina + closet, Three.js): se carga sólo al acercarse a la pantalla.
  const furnitureViewer = document.querySelector("[data-furniture-viewer]");
  if (furnitureViewer) {
    const loadScript = (src) => new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = reject;
      document.body.appendChild(el);
    });
    const loadFurnitureConfigurator = () => {
      if (furnitureViewer.dataset.loaderStarted) return;
      furnitureViewer.dataset.loaderStarted = "true";
      const status = furnitureViewer.querySelector("#furniture-loading .furniture-status") || furnitureViewer.querySelector("#furniture-loading span:last-child");
      if (status) status.textContent = "Cargando visualizador 3D…";
      loadScript("assets/vendor/three.min.js")
        .then(() => loadScript("assets/vendor/OrbitControls.js"))
        .then(() => loadScript("assets/configurator.js"))
        .then(() => track("configurador_3d"))
        .catch(() => { if (status) status.textContent = "No fue posible cargar el visualizador 3D. Recarga la página o revisa tu conexión."; });
    };
    if ("IntersectionObserver" in window) {
      const furnitureObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { loadFurnitureConfigurator(); furnitureObserver.disconnect(); }
      }, { rootMargin: "450px" });
      furnitureObserver.observe(furnitureViewer);
    } else loadFurnitureConfigurator();
  }

  const menuButton = document.querySelector(".menu-toggle");
  const mobileNav = document.querySelector("#mobile-nav");
  const menu = (open) => {
    if (!menuButton || !mobileNav) return;
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    mobileNav.hidden = !open;
  };
  menuButton?.addEventListener("click", () => menu(menuButton.getAttribute("aria-expanded") !== "true"));
  mobileNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => menu(false)));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") menu(false); });

  const filters = [...document.querySelectorAll(".filter-button")];
  const cards = [...document.querySelectorAll(".project-card")];
  filters.forEach((button) => button.addEventListener("click", () => {
    filters.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    cards.forEach((card) => card.classList.toggle("hidden", button.dataset.filter !== "todos" && card.dataset.category !== button.dataset.filter));
  }));
  document.querySelectorAll(".project-whatsapp").forEach((button) => button.addEventListener("click", () => {
    const project = button.dataset.project || "un proyecto a medida";
    track("whatsapp_general", { source: "proyecto", project });
    window.open(waURL(`Hola, quiero cotizar el proyecto "${project}". ¿Me pueden orientar con medidas, materiales y valores?`), "_blank", "noopener,noreferrer");
  }));
  document.querySelectorAll("[data-compare]").forEach((compare) => {
    const slider = compare.querySelector('input[type="range"]');
    if (!slider) return;
    let tracked = false;
    const update = (value) => compare.style.setProperty("--position", `${Math.max(0, Math.min(100, Number(value)))}%`);
    slider.addEventListener("input", (event) => { update(event.currentTarget.value); if (!tracked) { track("antes_despues"); tracked = true; } });
    update(slider.value);
  });

  // Cotizador simplificado: lee los mismos campos #fc-* que usa el configurador 3D
  // (fusionado en una sola sección), sin duplicar estado ni formulario.
  const priceCard = document.querySelector("#price-range");
  if (priceCard) {
    const CONFIG = {
      rangeMargin: .12,
      kitchen: { base: 180000, layout: { straight: 1, l: 1.08 }, upper: .45, lower: 1 },
      closet: { base: 140000, interior: { 0: 1, 1: 1, 2: 1.12, 3: 1.25 } },
      finish: { standard: ["Estándar", 1], premium: ["Premium", 1.25] }
    };
    window.TALLER_PRICING_CONFIG = CONFIG;
    const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
    const decimals = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });
    const q = (selector) => document.querySelector(selector);
    const checkedValue = (name, fallback) => document.querySelector(`input[name="${name}"]:checked`)?.value || fallback;
    const colorName = () => document.querySelector('input[name="fcColor"]:checked')?.closest(".fc-color")?.querySelector("small")?.textContent || "Grafito";
    const send = q("#send-budget-whatsapp");
    const nameField = q("#customer-name");
    const locationField = q("#customer-location");
    const summaryEl = q("#result-summary");
    let budget = null;
    let started = false;
    let completed = "";

    const setSummary = (tags) => {
      if (summaryEl) summaryEl.innerHTML = tags.map((t) => `<span>${t}</span>`).join("");
    };

    const calculate = () => {
      const type = checkedValue("fcType", "kitchen");
      const finishKey = checkedValue("fcFinish", "standard");
      const finish = CONFIG.finish[finishKey];
      const color = colorName();
      const widthCm = Number(q("#fc-width")?.value) || 0;
      const width = widthCm / 100;
      const depthCm = Number(q("#fc-depth")?.value) || 60;
      const depth = depthCm / 100;
      let estimate, dimensionsText, extras, tags;

      if (type === "kitchen") {
        const layout = checkedValue("fcKitchenLayout", "straight");
        const legCm = layout === "l" ? Number(q("#fc-second-leg")?.value) || 0 : 0;
        const leg = legCm / 100;
        const modulesValue = checkedValue("fcModules", "ambos");
        const upper = modulesValue !== "base";
        const lower = modulesValue !== "aereos";
        const measure = width + leg;
        const modulesFactor = (upper ? CONFIG.kitchen.upper : 0) + (lower ? CONFIG.kitchen.lower : 0);
        estimate = measure * CONFIG.kitchen.base * modulesFactor * finish[1] * CONFIG.kitchen.layout[layout];
        dimensionsText = layout === "l"
          ? `${decimals.format(width)} m + ${decimals.format(leg)} m en L; profundidad ${decimals.format(depth)} m.`
          : `${decimals.format(width)} m de tramo recto; profundidad ${decimals.format(depth)} m.`;
        extras = modulesValue === "base" ? "Solo muebles base" : modulesValue === "aereos" ? "Solo muebles aéreos" : "Base + aéreos";
        tags = [
          layout === "l" ? "Cocina en L" : "Cocina recta",
          layout === "l" ? `${decimals.format(width)} m + ${decimals.format(leg)} m` : `${decimals.format(width)} m de largo`,
          `Profundidad ${decimals.format(depth)} m`,
          extras,
          `Terminación ${finish[0]}`,
          color,
        ];
      } else {
        const heightCm = Number(q("#fc-height")?.value) || 240;
        const height = heightCm / 100;
        const rod = Boolean(q("#fc-rod")?.checked);
        const shelves = Boolean(q("#fc-shelves")?.checked);
        const drawers = Boolean(q("#fc-drawers")?.checked);
        const activeCount = [rod, shelves, drawers].filter(Boolean).length;
        estimate = width * height * CONFIG.closet.base * finish[1] * CONFIG.closet.interior[activeCount];
        dimensionsText = `${decimals.format(width)} m × ${decimals.format(height)} m; profundidad ${decimals.format(depth)} m.`;
        const parts = [rod && "barras", shelves && "repisas", drawers && "cajoneras"].filter(Boolean);
        extras = parts.length ? `Interior: ${parts.join(", ")}` : "Interior sin repisas ni cajoneras";
        tags = [
          "Closet recto",
          `${decimals.format(width)} m × ${decimals.format(height)} m`,
          `Profundidad ${decimals.format(depth)} m`,
          extras,
          `Terminación ${finish[0]}`,
          color,
        ];
      }

      if (!Number.isFinite(estimate) || estimate <= 0) {
        budget = null;
        if (send) send.disabled = true;
        return;
      }

      setSummary(tags);
      const min = estimate * (1 - CONFIG.rangeMargin);
      const max = estimate * (1 + CONFIG.rangeMargin);
      budget = { type, dimensionsText, extras, finish: finish[0], color, min, max };
      priceCard.innerHTML = `<span class="price-range-label">Rango referencial</span><div class="price-main">${money.format(min)} <span>a</span> ${money.format(max)}</div>`;
      if (send) send.disabled = false;

      const signature = `${type}-${widthCm}-${Math.round(estimate)}`;
      if (signature !== completed) { track("cotizador_completado", { project: type, estimate: Math.round(estimate) }); completed = signature; }
    };

    window.addEventListener("taller:configuration", () => {
      if (!started) { track("cotizador_iniciado"); started = true; }
      calculate();
    });

    send?.addEventListener("click", () => {
      calculate();
      if (!budget) return;
      const projectLabel = budget.type === "kitchen" ? "Cocina a medida" : "Clóset / Walk-in closet";
      const appliances = [];
      if (budget.type === "kitchen") {
        if (checkedValue("fcModules", "ambos") !== "aereos" && q("#fc-sink")?.checked) appliances.push("lavaplatos");
        if (checkedValue("fcModules", "ambos") !== "aereos" && q("#fc-oven")?.checked) appliances.push("horno");
        if (q("#fc-hood")?.checked) appliances.push("campana");
      }
      const lines = [
        "Hola, realicé una estimación en el sitio de Taller La Carpintería:",
        "",
        `Proyecto: ${projectLabel}`,
        `Dimensiones: ${budget.dimensionsText}`,
        budget.extras ? `Configuración: ${budget.extras}` : "",
        `Terminación: ${budget.finish}`,
        `Color: ${budget.color}`,
        appliances.length ? `Artefactos referenciales de interés: ${appliances.join(", ")}` : "",
        `Rango estimado: ${money.format(budget.min)} a ${money.format(budget.max)}`,
      ].filter(Boolean);
      if (nameField?.value.trim()) lines.push(`Nombre: ${nameField.value.trim()}`);
      if (locationField?.value.trim()) lines.push(`Comuna: ${locationField.value.trim()}`);
      lines.push("", "Quisiera revisar esta estimación y coordinar una evaluación sin compromiso.");
      track("whatsapp_cotizador", { project: budget.type, min: Math.round(budget.min), max: Math.round(budget.max) });
      window.open(waURL(lines.join("\n")), "_blank", "noopener,noreferrer");
    });

    document.querySelectorAll(".direct-whatsapp-link,.floating-whatsapp,.contact-whatsapp").forEach((link) => link.addEventListener("click", () => track("whatsapp_general", { source: link.className })));

    calculate();
  }

  const revealItems = document.querySelectorAll(".reveal");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) revealItems.forEach((item) => item.classList.add("visible"));
  else {
    const observer = new IntersectionObserver((entries, instance) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("visible"); instance.unobserve(entry.target); } }),{threshold:.12,rootMargin:"0px 0px -30px 0px"});
    revealItems.forEach((item) => observer.observe(item));
  }
});
