(function (root, factory) {
  "use strict";
  const schema = typeof module === "object" && module.exports
    ? require("./schema.js") : root.TALLER_DESIGNER_V2_SCHEMA;
  const api = factory(schema);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_DESIGNER_V2_PROFILES = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema) {
  "use strict";
  if (!schema) throw new Error("Designer V2 profiles requiere schema.js.");

  const DEFAULT_PROFILE = {
    id: "taller-default",
    version: "1.0.0",
    panels: {
      carcassThicknessMm: 18,
      backThicknessMm: 6,
      defaultSheetWidthMm: 1830,
      defaultSheetLengthMm: 2500,
    },
    closet: {
      targetBodyWidthMm: 600,
      minBodyWidthMm: 450,
      maxBodyWidthMm: 900,
      defaultHeightMm: 2400,
      defaultDepthMm: 600,
      targetShelfSpacingMm: 330,
      shelfTopClearanceMm: 100,
      shelfBottomClearanceMm: 100,
      topShelfOffsetMm: 300,
      defaultDrawerCount: 3,
      minDrawerCount: 2,
      maxDrawerCount: 5,
      defaultRodHeightMm: 1650,
      maxDoorLeafWidthMm: 600,
    },
    kitchen: {
      baseCarcassHeightMm: 720,
      baseCarcassDepthMm: 560,
      wallCarcassHeightMm: 720,
      wallCarcassDepthMm: 330,
      plinthHeightMm: 100,
      countertopThicknessMm: 38,
      countertopDepthMm: 600,
      wallGapMm: 550,
      preferredWidthsMm: [300, 400, 450, 500, 600, 800],
      defaultDrawerModuleWidthMm: 600,
      defaultDoorModuleWidthMm: 800,
      defaultSinkWidthMm: 800,
      defaultOvenWidthMm: 600,
      defaultCornerWidthMm: 900,
      defaultDrawerCount: 3,
      minDrawerCount: 2,
      maxDrawerCount: 5,
      maxDoorLeafWidthMm: 600,
    },
  };

  function merge(base, overrides) {
    if (!schema.isPlainObject(overrides)) return schema.clone(base);
    const result = schema.clone(base);
    for (const [key, value] of Object.entries(overrides)) {
      if (schema.isPlainObject(value) && schema.isPlainObject(result[key])) {
        result[key] = merge(result[key], value);
      } else {
        result[key] = schema.clone(value);
      }
    }
    return result;
  }

  function createProfile(overrides = {}) {
    return merge(DEFAULT_PROFILE, overrides);
  }

  function createStandardsSnapshot(profile = DEFAULT_PROFILE) {
    const copy = schema.clone(profile);
    const profileId = copy.id;
    const profileVersion = copy.version;
    delete copy.id;
    delete copy.version;
    return { profileId, profileVersion, snapshot: copy };
  }

  return { DEFAULT_PROFILE: schema.clone(DEFAULT_PROFILE), createProfile, createStandardsSnapshot };
});
