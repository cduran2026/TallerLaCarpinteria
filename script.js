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
  // La galería y el asistente llevan al único cotizador existente.
  let selectedGalleryProject = "";
  document.querySelectorAll('input[name="fcType"]').forEach((input) => input.addEventListener("change", () => { selectedGalleryProject = ""; }));
  const selectProjectType = (type, source) => {
    const input = document.querySelector('input[name="fcType"][value="' + type + '"]');
    if (input && !input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    document.querySelector("#cotizador")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    track("cotizador_navegacion", { type, source });
  };
  document.querySelectorAll(".project-whatsapp").forEach((button) => button.addEventListener("click", () => {
    selectProjectType(button.dataset.type || "kitchen", "galeria");
    selectedGalleryProject = button.dataset.project || "";
  }));

  // El hero toma imágenes, títulos, categorías y acciones de las tarjetas reales de la galería.
  const showcase = document.querySelector(".hero-showcase");
  if (showcase) {
    const track = showcase.querySelector(".hero-showcase-track");
    const viewport = showcase.querySelector(".hero-showcase-viewport");
    const counter = showcase.querySelector(".hero-showcase-count");
    const progress = showcase.querySelector(".hero-showcase-progress");
    const projects = cards.filter((card) => card.dataset.heroOrder)
      .sort((a, b) => Number(a.dataset.heroOrder) - Number(b.dataset.heroOrder));
    if (projects.length && track && viewport && counter && progress) {
      const marks = projects.map(() => {
        const mark = document.createElement("span");
        progress.append(mark);
        return mark;
      });
      const makeSlide = (source, priority = false) => {
        const card = document.createElement("article");
        card.className = "hero-project-card";
        card.dataset.projectId = source.id;
        const sourceImage = source.querySelector("img");
        const image = document.createElement("img");
        image.className = "hero-project-image";
        image.src = sourceImage.getAttribute("src");
        image.alt = sourceImage.alt;
        image.loading = priority ? "eager" : "lazy";
        if (priority) image.fetchPriority = "high";
        const content = document.createElement("div");
        content.className = "hero-project-content";
        const category = document.createElement("span");
        category.className = "hero-project-category";
        category.textContent = source.querySelector(".project-content > span").textContent.split("·")[0].trim();
        const title = document.createElement("h2");
        title.textContent = source.dataset.heroTitle || source.querySelector(".project-content h3").textContent;
        const description = document.createElement("p");
        description.textContent = source.dataset.heroDescription || source.querySelector(".project-content p").textContent;
        const actions = document.createElement("div");
        actions.className = "hero-project-actions";
        const view = document.createElement("a");
        view.href = `#${source.id}`;
        view.textContent = "Ver proyecto";
        view.addEventListener("click", () => {
          document.querySelector('.filter-button[data-filter="todos"]')?.click();
        });
        const quote = document.createElement("button");
        quote.type = "button";
        quote.textContent = "Cotizar algo similar";
        quote.addEventListener("click", () => source.querySelector(".project-whatsapp")?.click());
        actions.append(view, quote);
        content.append(category, title, description, actions);
        card.append(image, content);
        return card;
      };
      track.append(makeSlide(projects.at(-1)), ...projects.map((project, index) => makeSlide(project, index === 0)), makeSlide(projects[0]));
      const slides = [...track.children];
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      let slideIndex = 1;
      let moving = false;
      let visible = false;
      let hovered = false;
      let focused = false;
      let pausedUntil = 0;
      const step = () => slides[0].getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap || 0);
      const position = () => { track.style.transform = `translate3d(${-slideIndex * step()}px, 0, 0)`; };
      const update = (announce) => {
        const current = ((slideIndex - 1 + projects.length) % projects.length);
        counter.setAttribute("aria-live", announce ? "polite" : "off");
        counter.textContent = `${String(current + 1).padStart(2, "0")} / ${String(projects.length).padStart(2, "0")}`;
        marks.forEach((mark, index) => mark.classList.toggle("active", index === current));
        slides.forEach((slide, index) => {
          slide.inert = index !== slideIndex;
          slide.setAttribute("aria-hidden", String(index !== slideIndex));
        });
      };
      const settle = () => {
        if (slideIndex === 0 || slideIndex === projects.length + 1) {
          slideIndex = slideIndex === 0 ? projects.length : 1;
          track.style.transition = "none";
          position();
          requestAnimationFrame(() => { track.style.transition = ""; });
          update(false);
        }
        moving = false;
      };
      const advance = (direction, manual = true) => {
        if (moving) return;
        if (manual) pausedUntil = Date.now() + 12000;
        slideIndex += direction;
        update(manual);
        if (reducedMotion.matches) { position(); settle(); return; }
        moving = true;
        position();
      };
      track.addEventListener("transitionend", (event) => { if (event.target === track && event.propertyName === "transform") settle(); });
      showcase.querySelector(".hero-showcase-prev").addEventListener("click", () => advance(-1));
      showcase.querySelector(".hero-showcase-next").addEventListener("click", () => advance(1));
      showcase.addEventListener("mouseenter", () => { hovered = true; });
      showcase.addEventListener("mouseleave", () => { hovered = false; });
      showcase.addEventListener("focusin", () => { focused = true; });
      showcase.addEventListener("focusout", () => { focused = showcase.contains(document.activeElement); });
      let touchStart = null;
      viewport.addEventListener("touchstart", (event) => {
        const touch = event.changedTouches[0];
        touchStart = { x: touch.clientX, y: touch.clientY };
        pausedUntil = Date.now() + 12000;
      }, { passive: true });
      viewport.addEventListener("touchend", (event) => {
        if (!touchStart) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStart.x;
        const dy = touch.clientY - touchStart.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) advance(dx < 0 ? 1 : -1);
        touchStart = null;
      }, { passive: true });
      track.style.transition = "none";
      position();
      update(false);
      requestAnimationFrame(() => { track.style.transition = ""; });
      window.addEventListener("resize", () => {
        track.style.transition = "none";
        position();
        if (moving) settle();
        else requestAnimationFrame(() => { track.style.transition = ""; });
      });
      reducedMotion.addEventListener("change", () => { if (reducedMotion.matches && moving) settle(); });
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: .15 }).observe(showcase);
      } else visible = true;
      window.setInterval(() => {
        if (visible && !document.hidden && !reducedMotion.matches && !hovered && !focused && Date.now() > pausedUntil) advance(1, false);
      }, 7000);
    }
  }

  // Interfaz pública mínima para el asistente; el estado y precio siguen en el cotizador.
  window.TALLER_PUBLIC_ACTIONS = Object.freeze({
    selectProjectType,
    openWhatsApp: (message, source = "asistente") => {
      track("whatsapp_general", { source });
      window.open(waURL(message), "_blank", "noopener,noreferrer");
    },
  });
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
    const mobileSummaryEl = q("#mobile-quote-summary");
    let budget = null;
    let started = false;
    let completed = "";

    const setSummary = (tags) => {
      if (summaryEl) summaryEl.innerHTML = tags.map((t) => `<span>${t}</span>`).join("");
      if (mobileSummaryEl) mobileSummaryEl.textContent = tags.slice(0, 2).join(" · ");
    };

    q("#mobile-quote-jump")?.addEventListener("click", () => {
      q(".calculator-result-card")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    });

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
          "Clóset recto",
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
      const projectLabel = budget.type === "kitchen" ? "Cocina a medida" : "Clóset a medida";
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
        selectedGalleryProject ? `Referencia de la galería: ${selectedGalleryProject}` : "",
        `Dimensiones: ${budget.dimensionsText}`,
        budget.extras ? `Configuración: ${budget.extras}` : "",
        `Terminación: ${budget.finish}`,
        `Color: ${budget.color}`,
        appliances.length ? `Artefactos referenciales de interés: ${appliances.join(", ")}` : "",
        `Rango estimado: ${money.format(budget.min)} a ${money.format(budget.max)}`,
      ].filter(Boolean);
      if (nameField?.value.trim()) lines.push(`Nombre: ${nameField.value.trim()}`);
      if (locationField?.value.trim()) lines.push(`Comuna: ${locationField.value.trim()}`);
      lines.push("", "Quisiera revisar esta estimación y saber cómo seguimos.");
      track("whatsapp_cotizador", { project: budget.type, min: Math.round(budget.min), max: Math.round(budget.max) });
      window.open(waURL(lines.join("\n")), "_blank", "noopener,noreferrer");
    });

    document.querySelectorAll(".direct-whatsapp-link,.contact-whatsapp").forEach((link) => link.addEventListener("click", () => track("whatsapp_general", { source: link.className })));

    calculate();
  }

  if (new URLSearchParams(window.location.search).get("designerTest") === "1") {
    const demo = document.createElement("script");
    demo.src = "tests/designer/persistence-demo.js";
    document.body.appendChild(demo);
  }

  const revealItems = document.querySelectorAll(".reveal");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) revealItems.forEach((item) => item.classList.add("visible"));
  else {
    const observer = new IntersectionObserver((entries, instance) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("visible"); instance.unobserve(entry.target); } }),{threshold:.12,rootMargin:"0px 0px -30px 0px"});
    revealItems.forEach((item) => observer.observe(item));
  }
});
