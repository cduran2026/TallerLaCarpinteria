(function (root, factory) {
  "use strict";
  const schema = typeof module === "object" && module.exports
    ? require("./schema.js") : root.TALLER_DESIGNER_V2_SCHEMA;
  const profiles = typeof module === "object" && module.exports
    ? require("./profiles.js") : root.TALLER_DESIGNER_V2_PROFILES;
  const distribution = typeof module === "object" && module.exports
    ? require("./closet-distribution.js") : root.TALLER_DESIGNER_V2_CLOSET_DISTRIBUTION;
  const api = factory(schema, profiles, distribution);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_DESIGNER_V2_FIXTURES = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema, profiles, distribution) {
  "use strict";
  if (!schema || !profiles || !distribution) throw new Error("Designer V2 fixtures requiere schema.js, profiles.js y closet-distribution.js.");

  function quantity(mode, recommended, applied) {
    return { mode, recommended, applied, resolved: applied };
  }

  function materials(profile) {
    return {
      catalog: [{
        id: "material-carcass",
        category: "board",
        substrate: "particleboard",
        coating: "melamine",
        thicknessMm: profile.panels.carcassThicknessMm,
        finish: { name: "Blanco", color: "#f2ede4" },
        sheet: {
          widthMm: profile.panels.defaultSheetWidthMm,
          lengthMm: profile.panels.defaultSheetLengthMm,
        },
        grain: { mode: "none" },
      }],
      assignments: { carcass: "material-carcass", fronts: "material-carcass" },
    };
  }

  function module(id, runId, zone, order, type, widthMm, heightMm, depthMm, components) {
    return {
      id, runId, zone, order, type,
      dimensions: { widthMm, heightMm, depthMm },
      components: components || [],
      options: {},
      locks: { width: false },
    };
  }

  function component(id, type, mode, recommended, applied, options) {
    return {
      id,
      type,
      quantity: quantity(mode, recommended, applied),
      options: options || {},
    };
  }

  function envelope(configuration) {
    return schema.createEnvelope(configuration);
  }

  function createCloset(profile, totalWidthMm) {
    profile = profile || profiles.DEFAULT_PROFILE;
    const standards = profiles.createStandardsSnapshot(profile);
    totalWidthMm = totalWidthMm || profile.closet.targetBodyWidthMm * 3;
    const plan = distribution.planClosetWidths(totalWidthMm, profile.closet);
    if (!plan.isFeasible) throw new Error(plan.reason);
    const height = profile.closet.defaultHeightMm;
    const depth = profile.closet.defaultDepthMm;
    const usableHeight = height - profile.closet.shelfTopClearanceMm - profile.closet.shelfBottomClearanceMm;
    const recommendedShelves = Math.max(0, Math.round(usableHeight / profile.closet.targetShelfSpacingMm) - 1);
    const modules = plan.widths.map(function (width, index) {
      const number = index + 1;
      const id = "closet-body-" + number;
      if (index === 0) return module(id, "closet-main", "body", index, "closet.hanging", width, height, depth, [
        component(id + "-shelf", "shelfSet", "manual", 1, 1, {
          distribution: "manual", positionsMm: [height - profile.closet.topShelfOffsetMm],
        }),
        component(id + "-rod", "rodSet", "automatic", 1, 1, { heightMm: profile.closet.defaultRodHeightMm }),
      ]);
      if (index === 1) return module(id, "closet-main", "body", index, "closet.shelves", width, height, depth, [
        component(id + "-shelves", "shelfSet", "automatic", recommendedShelves, recommendedShelves, {
          distribution: "equal", targetSpacingMm: profile.closet.targetShelfSpacingMm,
        }),
      ]);
      if (index === 2) return module(id, "closet-main", "body", index, "closet.mixed", width, height, depth, [
        component(id + "-drawers", "drawerStack", "manual", profile.closet.defaultDrawerCount, profile.closet.defaultDrawerCount),
        component(id + "-shelves", "shelfSet", "manual", recommendedShelves, 2, { distribution: "equal" }),
      ]);
      return module(id, "closet-main", "body", index, "closet.open", width, height, depth, []);
    });
    return envelope({
      type: "closet",
      units: schema.UNIT,
      dimensions: { widthMm: totalWidthMm, heightMm: height, depthMm: depth },
      materials: materials(profile),
      standards,
      layout: {
        kind: "linear",
        runs: [{
          id: "closet-main",
          lengthMm: totalWidthMm,
          originMm: { x: 0, z: 0 },
          rotationDeg: 0,
          zones: [{ id: "body", startReserveMm: 0, endReserveMm: 0 }],
        }],
      },
      modules,
      provenance: { createdFrom: "fixture", migration: null },
    });
  }

  function createClosetThreeBodies(profile) {
    profile = profile || profiles.DEFAULT_PROFILE;
    return createCloset(profile, profile.closet.targetBodyWidthMm * 3);
  }

  function kitchenBaseModule(id, runId, order, type, width, profile, componentType, amount) {
    const components = componentType
      ? [component(id + "-component", componentType, "automatic", amount, amount)]
      : [];
    return module(
      id, runId, "base", order, type, width,
      profile.kitchen.baseCarcassHeightMm,
      profile.kitchen.baseCarcassDepthMm,
      components
    );
  }

  function kitchenWallModule(id, runId, order, width, profile, type) {
    const leaves = Math.max(1, Math.ceil(width / profile.kitchen.maxDoorLeafWidthMm));
    return module(
      id, runId, "wall", order, type || "kitchen.wall.door", width,
      profile.kitchen.wallCarcassHeightMm,
      profile.kitchen.wallCarcassDepthMm,
      [component(id + "-doors", "doorSet", "automatic", leaves, leaves)]
    );
  }

  function createStraightKitchen(profile) {
    profile = profile || profiles.DEFAULT_PROFILE;
    const standards = profiles.createStandardsSnapshot(profile);
    const drawerWidth = profile.kitchen.defaultDrawerModuleWidthMm;
    const doorWidth = profile.kitchen.defaultDoorModuleWidthMm;
    const widths = [drawerWidth, profile.kitchen.defaultSinkWidthMm, profile.kitchen.defaultOvenWidthMm, doorWidth];
    const length = widths.reduce(function (total, value) { return total + value; }, 0);
    const base = [
      kitchenBaseModule("straight-base-drawers", "kitchen-main", 0, "kitchen.base.drawers", widths[0], profile, "drawerStack", profile.kitchen.defaultDrawerCount),
      kitchenBaseModule(
        "straight-base-sink", "kitchen-main", 1, "kitchen.base.sink", widths[1], profile,
        "doorSet", Math.max(1, Math.ceil(widths[1] / profile.kitchen.maxDoorLeafWidthMm))
      ),
      kitchenBaseModule("straight-base-oven", "kitchen-main", 2, "kitchen.base.oven", widths[2], profile),
      kitchenBaseModule(
        "straight-base-door", "kitchen-main", 3, "kitchen.base.door", widths[3], profile,
        "doorSet", Math.max(1, Math.ceil(widths[3] / profile.kitchen.maxDoorLeafWidthMm))
      ),
    ];
    const wall = widths.map(function (width, index) {
      return kitchenWallModule("straight-wall-" + (index + 1), "kitchen-main", index, width, profile);
    });
    return envelope({
      type: "kitchen",
      units: schema.UNIT,
      dimensions: {
        heightMm: profile.kitchen.plinthHeightMm + profile.kitchen.baseCarcassHeightMm +
          profile.kitchen.countertopThicknessMm + profile.kitchen.wallGapMm +
          profile.kitchen.wallCarcassHeightMm,
        depthMm: profile.kitchen.countertopDepthMm,
      },
      materials: materials(profile),
      standards,
      layout: {
        kind: "straight",
        runs: [{
          id: "kitchen-main",
          lengthMm: length,
          originMm: { x: 0, z: 0 },
          rotationDeg: 0,
          zones: [
            { id: "base", startReserveMm: 0, endReserveMm: 0 },
            { id: "wall", startReserveMm: 0, endReserveMm: 0 },
          ],
        }],
      },
      modules: base.concat(wall),
      provenance: { createdFrom: "fixture", migration: null },
    });
  }

  function createLKitchen(profile) {
    profile = profile || profiles.DEFAULT_PROFILE;
    const standards = profiles.createStandardsSnapshot(profile);
    const corner = profile.kitchen.defaultCornerWidthMm;
    const side = profile.kitchen.defaultDrawerModuleWidthMm;
    const wide = profile.kitchen.defaultDoorModuleWidthMm;
    const mainLength = corner + side + profile.kitchen.defaultSinkWidthMm;
    const returnLength = corner + profile.kitchen.defaultOvenWidthMm + wide;
    return envelope({
      type: "kitchen",
      units: schema.UNIT,
      dimensions: {
        heightMm: profile.kitchen.plinthHeightMm + profile.kitchen.baseCarcassHeightMm + profile.kitchen.countertopThicknessMm,
        depthMm: profile.kitchen.countertopDepthMm,
      },
      materials: materials(profile),
      standards,
      layout: {
        kind: "l",
        runs: [
          {
            id: "kitchen-main",
            lengthMm: mainLength,
            originMm: { x: 0, z: 0 },
            rotationDeg: 0,
            zones: [{ id: "base", startReserveMm: 0, endReserveMm: 0 }],
          },
          {
            id: "kitchen-return",
            lengthMm: returnLength,
            originMm: { x: mainLength, z: 0 },
            rotationDeg: 90,
            zones: [{ id: "base", startReserveMm: corner, endReserveMm: 0 }],
          },
        ],
      },
      modules: [
        kitchenBaseModule("l-main-corner", "kitchen-main", 0, "kitchen.base.corner", corner, profile, "doorSet", 1),
        kitchenBaseModule("l-main-drawers", "kitchen-main", 1, "kitchen.base.drawers", side, profile, "drawerStack", profile.kitchen.defaultDrawerCount),
        kitchenBaseModule(
          "l-main-sink", "kitchen-main", 2, "kitchen.base.sink",
          profile.kitchen.defaultSinkWidthMm, profile, "doorSet",
          Math.max(1, Math.ceil(profile.kitchen.defaultSinkWidthMm / profile.kitchen.maxDoorLeafWidthMm))
        ),
        kitchenBaseModule("l-return-oven", "kitchen-return", 0, "kitchen.base.oven", profile.kitchen.defaultOvenWidthMm, profile),
        kitchenBaseModule(
          "l-return-door", "kitchen-return", 1, "kitchen.base.door", wide, profile, "doorSet",
          Math.max(1, Math.ceil(wide / profile.kitchen.maxDoorLeafWidthMm))
        ),
      ],
      provenance: { createdFrom: "fixture", migration: null },
    });
  }

  return { quantity, createCloset, createClosetThreeBodies, createStraightKitchen, createLKitchen };
});
