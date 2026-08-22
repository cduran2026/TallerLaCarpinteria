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

    document.querySelectorAll(
      '#fc-width, #fc-second-leg, #fc-height, #fc-depth, input[name="fcType"], input[name="fcKitchenLayout"], input[name="fcModules"], input[name="fcFinish"], input[name="fcColor"], #fc-rod, #fc-shelves, #fc-drawers'
    ).forEach((field) => {
      const eventName = field.type === "range" ? "input" : "change";
      field.addEventListener(eventName, () => {
        if (!started) { track("cotizador_iniciado"); started = true; }
        calculate();
      });
    });

    send?.addEventListener("click", () => {
      calculate();
      if (!budget) return;
      const projectLabel = budget.type === "kitchen" ? "Cocina a medida" : "Clóset / Walk-in closet";
      const appliances = [];
      if (budget.type === "kitchen") {
        if (q("#fc-sink")?.checked) appliances.push("lavaplatos");
        if (q("#fc-oven")?.checked) appliances.push("horno");
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
