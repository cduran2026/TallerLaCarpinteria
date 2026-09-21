(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_CONTENT_TEMPLATES = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TEMPLATES = Object.freeze([
    {
      templateId: "finished-work", name: "Trabajo terminado", category: "finished",
      supportedFormats: ["instagram-feed", "instagram-story", "instagram-reel", "facebook", "custom"],
      mediaSlots: [{ id: "hero", accepts: ["image", "video"], required: true }],
      textSlots: ["title", "description", "cta"], branding: { logo: true, workshopName: true },
      layout: { type: "hero-editorial", overlay: "bottom", safeArea: 0.07 }, version: "1.0.0",
    },
    {
      templateId: "before-after", name: "Antes / Después", category: "comparison",
      supportedFormats: ["instagram-feed", "instagram-story", "facebook", "custom"],
      mediaSlots: [{ id: "before", accepts: ["image"], required: true }, { id: "after", accepts: ["image"], required: true }],
      textSlots: ["title", "description"], branding: { logo: true, workshopName: true },
      layout: { type: "split-comparison", split: 0.5, safeArea: 0.055 }, version: "1.0.0",
    },
    {
      templateId: "featured-project", name: "Proyecto destacado", category: "process",
      supportedFormats: ["instagram-feed", "instagram-story", "facebook", "custom"],
      mediaSlots: [{ id: "primary", accepts: ["image", "video"], required: true }, { id: "detail", accepts: ["image"], required: false }],
      textSlots: ["title", "description", "cta"], branding: { logo: true, workshopName: true },
      layout: { type: "featured-detail", detailRatio: 0.34, safeArea: 0.06 }, version: "1.0.0",
    },
    {
      templateId: "vertical-story", name: "Historia vertical", category: "story",
      supportedFormats: ["instagram-story", "instagram-reel", "custom"],
      mediaSlots: [{ id: "background", accepts: ["image", "video"], required: true }],
      textSlots: ["title", "description", "cta"], branding: { logo: true, workshopName: true },
      layout: { type: "vertical-story", overlay: "full", safeArea: 0.085 }, version: "1.0.0",
    },
    {
      templateId: "simple-promotion", name: "Promoción simple", category: "promotion",
      supportedFormats: ["instagram-feed", "instagram-story", "facebook", "custom"],
      mediaSlots: [{ id: "support", accepts: ["image", "video"], required: false }],
      textSlots: ["title", "description", "cta"], branding: { logo: true, workshopName: true },
      layout: { type: "promotion-panel", mediaRatio: 0.43, safeArea: 0.07 }, version: "1.0.0",
    },
  ]);
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function getTemplate(id) {
    const template = TEMPLATES.find(function (item) { return item.templateId === id; });
    if (!template) throw new Error("Plantilla no disponible.");
    return clone(template);
  }
  return { TEMPLATES, getTemplate };
});
