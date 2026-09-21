(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_CONTENT_RENDERER = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function font(ctx, weight, size, family) { ctx.font = weight + " " + Math.round(size) + "px " + (family || "Inter") + ", sans-serif"; }
  function cover(ctx, source, x, y, width, height) {
    if (!source || !source.videoWidth && !source.naturalWidth) {
      ctx.fillStyle = "#D9D2C4"; ctx.fillRect(x, y, width, height); return;
    }
    const sourceWidth = source.videoWidth || source.naturalWidth; const sourceHeight = source.videoHeight || source.naturalHeight;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale; const drawHeight = sourceHeight * scale;
    ctx.drawImage(source, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }
  function overlay(ctx, x, y, width, height, from, to) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height); gradient.addColorStop(0, from); gradient.addColorStop(1, to);
    ctx.fillStyle = gradient; ctx.fillRect(x, y, width, height);
  }
  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean); const lines = []; let current = "";
    words.forEach(function (word) {
      const candidate = current ? current + " " + word : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate;
      else { lines.push(current); current = word; }
    });
    if (current) lines.push(current);
    if (maxLines && lines.length > maxLines) { const clipped = lines.slice(0, maxLines); clipped[maxLines - 1] = clipped[maxLines - 1].replace(/[.,;:]?$/, "…"); return clipped; }
    return lines;
  }
  function textBlock(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const lines = wrapLines(ctx, text, maxWidth, maxLines); lines.forEach(function (line, index) { ctx.fillText(line, x, y + lineHeight * index); });
    return y + lines.length * lineHeight;
  }
  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius); ctx.closePath();
  }
  async function loadImage(url) {
    if (!url) return null;
    return new Promise(function (resolve) {
      const image = new Image(); image.onload = function () { resolve(image); }; image.onerror = function () { resolve(null); }; image.src = url;
    });
  }
  async function sources(composition, resolver) {
    const result = [];
    for (const media of composition.selectedMedia) result.push(await resolver(media.id));
    return result;
  }
  async function brandMark(ctx, composition, x, y, size, alignRight) {
    const brand = composition.brandKit; const logo = composition.showLogo ? await loadImage(brand.logoUrl) : null;
    const textX = alignRight ? x - size - 18 : x + size + 18;
    if (logo) {
      ctx.save(); roundRect(ctx, alignRight ? x - size : x, y, size, size, size * .22); ctx.clip(); cover(ctx, logo, alignRight ? x - size : x, y, size, size); ctx.restore();
    }
    ctx.fillStyle = brand.textColor || "#fff"; font(ctx, 700, size * .29, brand.fontFamily);
    ctx.textAlign = alignRight ? "right" : "left"; ctx.textBaseline = "middle"; ctx.fillText(brand.workshopName || "", textX, y + size / 2);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
  function cta(ctx, composition, x, y, width, size) {
    if (!composition.text.cta) return;
    font(ctx, 750, size, composition.brandKit.fontFamily); const padding = size * .8;
    const buttonWidth = Math.min(width, ctx.measureText(composition.text.cta).width + padding * 2);
    ctx.fillStyle = composition.brandKit.accentColor; roundRect(ctx, x, y, buttonWidth, size * 2.25, size * .55); ctx.fill();
    ctx.fillStyle = composition.brandKit.primaryColor; ctx.textBaseline = "middle"; ctx.fillText(composition.text.cta, x + padding, y + size * 1.12); ctx.textBaseline = "alphabetic";
  }

  async function hero(ctx, composition, media, width, height) {
    cover(ctx, media[0], 0, 0, width, height); overlay(ctx, 0, height * .3, width, height * .7, "rgba(11,20,15,0)", "rgba(11,20,15,.94)");
    const pad = width * .07; await brandMark(ctx, composition, pad, pad, width * .078, false);
    ctx.fillStyle = composition.brandKit.accentColor; ctx.fillRect(pad, height * .67, width * .12, Math.max(5, width * .006));
    ctx.fillStyle = composition.brandKit.textColor; font(ctx, 800, width * .065, composition.brandKit.fontFamily);
    let y = textBlock(ctx, composition.text.title.toUpperCase(), pad, height * .75, width * .82, width * .073, 3);
    ctx.fillStyle = "rgba(255,255,255,.82)"; font(ctx, 500, width * .025, composition.brandKit.fontFamily);
    y = textBlock(ctx, composition.text.description, pad, y + width * .018, width * .72, width * .038, 3);
    cta(ctx, composition, pad, y + width * .025, width * .68, width * .022);
  }
  async function comparison(ctx, composition, media, width, height) {
    const split = width / 2; cover(ctx, media[0], 0, 0, split, height); cover(ctx, media[1], split, 0, split, height);
    ctx.fillStyle = composition.brandKit.accentColor; ctx.fillRect(split - Math.max(3, width * .003), 0, Math.max(6, width * .006), height);
    overlay(ctx, 0, 0, width, height * .33, "rgba(13,24,18,.72)", "rgba(13,24,18,0)"); overlay(ctx, 0, height * .66, width, height * .34, "rgba(13,24,18,0)", "rgba(13,24,18,.82)");
    const pad = width * .055; await brandMark(ctx, composition, pad, pad, width * .07, false);
    font(ctx, 800, width * .032, composition.brandKit.fontFamily); ctx.fillStyle = "#fff";
    ctx.fillText("ANTES", pad, height - pad); ctx.fillText("DESPUÉS", split + pad, height - pad);
    font(ctx, 800, width * .054, composition.brandKit.fontFamily); ctx.textAlign = "center"; ctx.fillText(composition.text.title.toUpperCase(), width / 2, height * .19); ctx.textAlign = "left";
  }
  async function featured(ctx, composition, media, width, height) {
    ctx.fillStyle = composition.brandKit.secondaryColor; ctx.fillRect(0, 0, width, height);
    const vertical = height > width * 1.25; const pad = width * .06;
    if (vertical) {
      cover(ctx, media[0], 0, 0, width, height * .58); if (media[1]) { ctx.save(); roundRect(ctx, width * .58, height * .46, width * .34, height * .2, width * .02); ctx.clip(); cover(ctx, media[1], width * .58, height * .46, width * .34, height * .2); ctx.restore(); }
      ctx.fillStyle = composition.brandKit.primaryColor; font(ctx, 800, width * .065, composition.brandKit.fontFamily); textBlock(ctx, composition.text.title, pad, height * .71, width * .84, width * .075, 3);
      ctx.fillStyle = "#5D665F"; font(ctx, 500, width * .027, composition.brandKit.fontFamily); textBlock(ctx, composition.text.description, pad, height * .84, width * .75, width * .04, 3);
    } else {
      cover(ctx, media[0], 0, 0, width * .62, height); ctx.fillStyle = composition.brandKit.secondaryColor; ctx.fillRect(width * .62, 0, width * .38, height);
      if (media[1]) cover(ctx, media[1], width * .68, height * .08, width * .26, height * .3);
      ctx.fillStyle = composition.brandKit.primaryColor; font(ctx, 800, width * .043, composition.brandKit.fontFamily); textBlock(ctx, composition.text.title, width * .68, height * .5, width * .26, width * .052, 4);
      ctx.fillStyle = "#5D665F"; font(ctx, 500, width * .018, composition.brandKit.fontFamily); textBlock(ctx, composition.text.description, width * .68, height * .72, width * .26, width * .029, 4);
    }
    ctx.save(); ctx.fillStyle = composition.brandKit.primaryColor; await brandMark(ctx, { ...composition, brandKit: { ...composition.brandKit, textColor: composition.brandKit.primaryColor } }, pad, height - pad - width * .06, width * .06, false); ctx.restore();
  }
  async function story(ctx, composition, media, width, height) {
    cover(ctx, media[0], 0, 0, width, height); overlay(ctx, 0, 0, width, height, "rgba(11,20,15,.3)", "rgba(11,20,15,.9)");
    const pad = width * .085; await brandMark(ctx, composition, width / 2 + width * .12, pad, width * .09, true);
    ctx.fillStyle = composition.brandKit.accentColor; font(ctx, 700, width * .025, composition.brandKit.fontFamily); ctx.letterSpacing = width * .004 + "px"; ctx.fillText("PROYECTO A MEDIDA", pad, height * .56); ctx.letterSpacing = "0px";
    ctx.fillStyle = composition.brandKit.textColor; font(ctx, 800, width * .078, composition.brandKit.fontFamily); let y = textBlock(ctx, composition.text.title, pad, height * .64, width * .82, width * .088, 4);
    ctx.fillStyle = "rgba(255,255,255,.8)"; font(ctx, 500, width * .03, composition.brandKit.fontFamily); y = textBlock(ctx, composition.text.description, pad, y + width * .03, width * .75, width * .045, 3);
    cta(ctx, composition, pad, y + width * .05, width * .7, width * .026);
  }
  async function promotion(ctx, composition, media, width, height) {
    ctx.fillStyle = composition.brandKit.primaryColor; ctx.fillRect(0, 0, width, height);
    const vertical = height > width * 1.25; const mediaRatio = vertical ? .43 : .44;
    if (media[0]) {
      if (vertical) cover(ctx, media[0], 0, 0, width, height * mediaRatio);
      else cover(ctx, media[0], width * (1 - mediaRatio), 0, width * mediaRatio, height);
    }
    const pad = width * .07; const areaWidth = vertical ? width * .86 : width * .46; const startY = vertical ? height * .54 : height * .25;
    await brandMark(ctx, composition, pad, vertical ? height * .48 : pad, width * .065, false);
    ctx.fillStyle = composition.brandKit.accentColor; ctx.fillRect(pad, startY, width * .1, Math.max(5, width * .006));
    ctx.fillStyle = composition.brandKit.textColor; font(ctx, 800, width * (vertical ? .065 : .05), composition.brandKit.fontFamily); let y = textBlock(ctx, composition.text.title, pad, startY + width * .065, areaWidth, width * (vertical ? .075 : .058), 5);
    ctx.fillStyle = "rgba(255,255,255,.76)"; font(ctx, 500, width * .023, composition.brandKit.fontFamily); y = textBlock(ctx, composition.text.description, pad, y + width * .025, areaWidth, width * .036, 4);
    cta(ctx, composition, pad, y + width * .035, areaWidth, width * .021);
  }

  async function renderComposition(canvas, composition, resolver) {
    const width = composition.format.width; const height = composition.format.height;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, width, height); ctx.imageSmoothingQuality = "high";
    const media = await sources(composition, resolver || async function () { return null; });
    const type = composition.template.layout.type;
    if (type === "hero-editorial") await hero(ctx, composition, media, width, height);
    else if (type === "split-comparison") await comparison(ctx, composition, media, width, height);
    else if (type === "featured-detail") await featured(ctx, composition, media, width, height);
    else if (type === "vertical-story") await story(ctx, composition, media, width, height);
    else if (type === "promotion-panel") await promotion(ctx, composition, media, width, height);
    else throw new Error("Layout de plantilla no implementado.");
    return { width, height, templateId: composition.templateId, formatId: composition.formatId, canvas };
  }
  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) { canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen.")); }, type || "image/png", quality || .94); });
  }
  async function exportRenderedContent(canvas, composition) {
    const blob = await canvasToBlob(canvas, "image/png");
    return { schemaVersion: 1, kind: "image", mimeType: "image/png", blob, width: canvas.width, height: canvas.height,
      templateId: composition.templateId, formatId: composition.formatId };
  }
  return { renderComposition, exportRenderedContent };
});
