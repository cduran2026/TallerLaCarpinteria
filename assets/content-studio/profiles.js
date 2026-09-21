(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_CONTENT_PROFILES = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT_PROFILES = Object.freeze([
    { id: "instagram-feed", name: "Instagram Feed", width: 1080, height: 1080, aspect: "1:1", destination: "instagram" },
    { id: "instagram-story", name: "Instagram Story", width: 1080, height: 1920, aspect: "9:16", destination: "instagram" },
    { id: "instagram-reel", name: "Instagram Reel", width: 1080, height: 1920, aspect: "9:16", destination: "instagram" },
    { id: "facebook", name: "Facebook", width: 1200, height: 630, aspect: "1.91:1", destination: "facebook" },
    { id: "custom", name: "Formato personalizado", width: 1080, height: 1080, aspect: "variable", destination: "custom" },
  ]);
  const CONTENT_STAGES = Object.freeze(["before", "during", "after", "result", "detail", "video"]);
  const VIDEO_PROFILE = Object.freeze({ maxClipSeconds: 10, acceptedTypes: ["video/mp4", "video/webm", "video/quicktime"] });

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function getFormat(id, custom) {
    const profile = FORMAT_PROFILES.find(function (item) { return item.id === id; });
    if (!profile) throw new Error("Formato de publicación no compatible.");
    if (id !== "custom") return clone(profile);
    const width = Math.round(Number(custom?.width)); const height = Math.round(Number(custom?.height));
    if (width < 320 || width > 4096 || height < 320 || height > 4096) {
      throw new Error("El formato personalizado debe medir entre 320 y 4096 px por lado.");
    }
    return { ...clone(profile), width, height, aspect: width + ":" + height };
  }
  function createBrandKit(workshop) {
    return {
      workshopName: workshop?.name || "Mi taller",
      logoUrl: "../assets/brand/logo.jpg",
      primaryColor: "#18261E",
      secondaryColor: "#F4F1EA",
      accentColor: "#C2A15A",
      textColor: "#FFFFFF",
      fontFamily: "Inter",
      phone: "", whatsapp: "", instagram: "", website: "",
    };
  }
  return { FORMAT_PROFILES, CONTENT_STAGES, VIDEO_PROFILE, getFormat, createBrandKit, clone };
});
