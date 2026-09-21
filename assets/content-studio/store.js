(function (root, factory) {
  "use strict";
  const profiles = typeof module === "object" && module.exports ? require("./profiles.js") : root.TALLER_CONTENT_PROFILES;
  const templates = typeof module === "object" && module.exports ? require("./templates.js") : root.TALLER_CONTENT_TEMPLATES;
  const api = factory(profiles, templates);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_CONTENT_STORE = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (profiles, templates) {
  "use strict";
  if (!profiles || !templates) throw new Error("Content Store requiere perfiles y plantillas.");
  function clone(value) { return profiles.clone(value); }
  function uid() { return "media-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2); }

  function createContentStore(options) {
    options = options || {};
    let state = {
      schemaVersion: 1,
      projectId: options.projectId || null,
      templateId: "finished-work",
      formatId: "instagram-feed",
      customFormat: { width: 1080, height: 1080 },
      brandKit: clone(options.brandKit || profiles.createBrandKit(options.workshop)),
      text: {
        title: options.title || "Proyecto a medida",
        description: options.description || "Diseño · Fabricación · Instalación",
        cta: "Cotiza con nosotros",
        hashtags: "#MueblesAMedida #Carpintería #Diseño",
      },
      showLogo: true,
      media: [],
      selectedMediaIds: [],
    };
    const subscribers = new Set();
    function publish(operation) { const snapshot = clone(state); subscribers.forEach(callback => callback(snapshot, { operation })); }
    function mutate(operation, callback) { const next = clone(state); callback(next); state = next; publish(operation); }
    function getState() { return clone(state); }
    function subscribe(callback) { subscribers.add(callback); return function () { subscribers.delete(callback); }; }
    function find(next, id) { const media = next.media.find(item => item.id === id); if (!media) throw new Error("Contenido no encontrado."); return media; }
    function addMedia(input) {
      const id = input.id || uid();
      if (!input.kind || !["image", "video"].includes(input.kind)) throw new Error("Tipo de contenido no compatible.");
      mutate("addMedia", function (next) {
        if (next.media.some(item => item.id === id)) throw new Error("El contenido ya existe.");
        next.media.push({
          id, kind: input.kind, name: input.name || "Contenido", stage: input.kind === "video" ? "video" : (input.stage || "result"),
          projectId: input.projectId || next.projectId || null, durationSeconds: Number(input.durationSeconds) || 0,
          trimStartSeconds: 0,
          trimEndSeconds: input.kind === "video" ? Math.min(Number(input.durationSeconds) || profiles.VIDEO_PROFILE.maxClipSeconds, profiles.VIDEO_PROFILE.maxClipSeconds) : 0,
        });
      });
      return id;
    }
    function removeMedia(id) { mutate("removeMedia", next => { next.media = next.media.filter(item => item.id !== id); next.selectedMediaIds = next.selectedMediaIds.filter(item => item !== id); }); }
    function selectMedia(id, selected) { mutate("selectMedia", next => { find(next, id); const included = next.selectedMediaIds.includes(id); if (selected && !included) next.selectedMediaIds.push(id); if (!selected && included) next.selectedMediaIds = next.selectedMediaIds.filter(item => item !== id); }); }
    function moveSelected(id, direction) { mutate("moveSelected", next => { const index = next.selectedMediaIds.indexOf(id); const target = index + direction; if (index < 0 || target < 0 || target >= next.selectedMediaIds.length) return; [next.selectedMediaIds[index], next.selectedMediaIds[target]] = [next.selectedMediaIds[target], next.selectedMediaIds[index]]; }); }
    function updateMedia(id, changes) { mutate("updateMedia", next => { const media = find(next, id); if (changes.stage && profiles.CONTENT_STAGES.includes(changes.stage)) media.stage = changes.stage; if (changes.projectId !== undefined) media.projectId = changes.projectId || null; }); }
    function setVideoTrim(id, start, end) {
      mutate("setVideoTrim", next => {
        const media = find(next, id); if (media.kind !== "video") throw new Error("El recorte solo se aplica a videos.");
        start = Math.max(0, Number(start) || 0); end = Math.min(Number(end) || 0, media.durationSeconds || Infinity);
        if (end <= start) throw new Error("El final del clip debe ser posterior al inicio.");
        if (end - start > profiles.VIDEO_PROFILE.maxClipSeconds) end = Math.min(media.durationSeconds || Infinity, start + profiles.VIDEO_PROFILE.maxClipSeconds);
        media.trimStartSeconds = start; media.trimEndSeconds = end;
      });
    }
    function setTemplate(templateId) { mutate("setTemplate", next => { const template = templates.getTemplate(templateId); next.templateId = templateId; if (!template.supportedFormats.includes(next.formatId)) next.formatId = template.supportedFormats[0]; }); }
    function setFormat(formatId, custom) { mutate("setFormat", next => { const template = templates.getTemplate(next.templateId); const format = profiles.getFormat(formatId, custom || next.customFormat); if (!template.supportedFormats.includes(format.id)) throw new Error("La plantilla no admite este formato."); next.formatId = formatId; if (formatId === "custom") next.customFormat = { width: format.width, height: format.height }; }); }
    function setText(changes) { mutate("setText", next => { next.text = { ...next.text, ...changes }; }); }
    function setBrandKit(changes) { mutate("setBrandKit", next => { next.brandKit = { ...next.brandKit, ...changes }; }); }
    function setProject(projectId) { mutate("setProject", next => { next.projectId = projectId || null; }); }
    function setLogoVisibility(value) { mutate("setLogoVisibility", next => { next.showLogo = Boolean(value); }); }
    function getComposition() {
      const snapshot = getState(); const template = templates.getTemplate(snapshot.templateId);
      const selected = snapshot.selectedMediaIds.map(id => snapshot.media.find(item => item.id === id)).filter(Boolean);
      const missingSlots = template.mediaSlots.filter((slot, index) => slot.required && !selected[index]);
      return { ...snapshot, template, format: profiles.getFormat(snapshot.formatId, snapshot.customFormat), selectedMedia: selected,
        readiness: { isReady: missingSlots.length === 0, missingSlots: missingSlots.map(slot => slot.id) } };
    }
    return Object.freeze({ getState, getComposition, subscribe, addMedia, removeMedia, selectMedia, moveSelected, updateMedia,
      setVideoTrim, setTemplate, setFormat, setText, setBrandKit, setProject, setLogoVisibility });
  }
  return { createContentStore };
});
