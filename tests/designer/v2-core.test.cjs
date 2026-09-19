const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const schema = require("../../assets/designer/v2/schema.js");
const profiles = require("../../assets/designer/v2/profiles.js");
const closetDistribution = require("../../assets/designer/v2/closet-distribution.js");
const validation = require("../../assets/designer/v2/validation.js");
const fixtures = require("../../assets/designer/v2/fixtures.js");
const { createDesignStore } = require("../../assets/designer/v2/store.js");

function findModule(envelope, id) {
  return envelope.configuration.modules.find((module) => module.id === id);
}

function codes(result) {
  return result.issues.map((issue) => issue.code);
}

function testFixtures() {
  assert.equal(schema.SCHEMA_VERSION, 2);
  assert.equal(schema.GENERATOR_VERSION, "2.0.0");
  for (const [name, envelope] of Object.entries({
    "closet-3-bodies": fixtures.createClosetThreeBodies(),
    "straight-kitchen": fixtures.createStraightKitchen(),
    "l-kitchen": fixtures.createLKitchen(),
  })) {
    const result = validation.validateEnvelope(envelope);
    assert.equal(result.valid, true, name);
    assert.equal(result.complete, true, name);
    assert.ok(result.occupancy.every((row) => row.status === "exact"), name);
    for (const module of envelope.configuration.modules) {
      for (const component of module.components) {
        assert.deepEqual(
          Object.keys(component.quantity).sort(),
          ["applied", "mode", "recommended", "resolved"],
          name + ": repeatable quantity contract"
        );
      }
    }
  }
  console.log("PASS V2 fixtures and exact occupancy");
}

function testConfigurableProfile() {
  const profile = profiles.createProfile({
    id: "test-profile",
    version: "7.2.0",
    panels: { carcassThicknessMm: 15 },
    closet: { targetBodyWidthMm: 700, targetShelfSpacingMm: 400 },
    kitchen: { baseCarcassHeightMm: 700 },
  });
  const closet = fixtures.createClosetThreeBodies(profile);
  assert.equal(closet.configuration.dimensions.widthMm, 2100);
  assert.equal(closet.configuration.materials.catalog[0].thicknessMm, 15);
  assert.equal(closet.configuration.standards.profileId, "test-profile");
  assert.equal(closet.configuration.standards.profileVersion, "7.2.0");
  assert.equal(closet.configuration.standards.snapshot.closet.targetShelfSpacingMm, 400);
  assert.equal(validation.validateEnvelope(closet).complete, true);
  profile.closet.targetBodyWidthMm = 999;
  assert.equal(closet.configuration.standards.snapshot.closet.targetBodyWidthMm, 700);
  console.log("PASS configurable, detached standards snapshot");
}

function testAutomaticClosetDistribution() {
  const profile = profiles.DEFAULT_PROFILE.closet;
  assert.deepEqual(closetDistribution.planClosetWidths(1800, profile).widths, [600, 600, 600]);
  assert.deepEqual(closetDistribution.planClosetWidths(2000, profile).widths, [667, 667, 666]);
  assert.deepEqual(closetDistribution.planClosetWidths(1800, profile, { preferredCount: 4 }).widths, [450, 450, 450, 450]);
  assert.equal(closetDistribution.planClosetWidths(400, profile).isFeasible, false);

  const generated = fixtures.createCloset(profiles.DEFAULT_PROFILE, 2000);
  assert.deepEqual(generated.configuration.modules.map((item) => item.dimensions.widthMm), [667, 667, 666]);
  const generatedStatus = validation.validateEnvelope(generated);
  assert.equal(generatedStatus.isValid, true);
  assert.equal(generatedStatus.isComplete, true);
  assert.equal(generatedStatus.canGenerateTechnicalOutputs, true);

  const incomplete = fixtures.createClosetThreeBodies();
  incomplete.configuration.modules = [incomplete.configuration.modules[0]];
  incomplete.configuration.modules[0].order = 0;
  let sequence = 0;
  const store = createDesignStore(incomplete, { idFactory: kind => `${kind}-auto-${++sequence}` });
  assert.equal(store.getOccupancy()[0].status, "deficit");
  const plan = closetDistribution.planClosetWidths(1800, profile, { preferredCount: 1 });
  store.autoDistributeCloset(plan.widths);
  assert.equal(store.getState().configuration.modules.length, 3);
  assert.deepEqual(store.getState().configuration.modules.map((item) => item.dimensions.widthMm), [600, 600, 600]);
  assert.equal(store.getStatus().canGenerateTechnicalOutputs, true);
  store.changeModuleWidth(store.getState().configuration.modules[0].id, 550);
  assert.equal(store.getOccupancy()[0].status, "deficit", "manual editing remains available");

  store.setModuleWidthLocked(store.getState().configuration.modules[0].id, true);
  const beforeLocked = store.getState();
  assert.throws(() => store.autoDistributeCloset([600, 600, 600]), error => error.code === "WIDTH_LOCKED");
  assert.deepEqual(store.getState(), beforeLocked, "locked automatic distribution rejects atomically");
  store.setModuleWidthLocked(store.getState().configuration.modules[0].id, false);
  const beforeOutOfRange = store.getState();
  assert.throws(() => store.autoDistributeCloset([400, 700, 700]), error => error.code === "CLOSET_DISTRIBUTION_RANGE");
  assert.deepEqual(store.getState(), beforeOutOfRange, "out-of-profile distribution rejects atomically");
  console.log("PASS automatic closet distribution from technical profile");
}

function testPureValidation() {
  const valid = fixtures.createClosetThreeBodies();
  const original = schema.clone(valid);
  const future = schema.clone(valid);
  future.schemaVersion = 3;
  assert.ok(codes(validation.validateEnvelope(future)).includes("SCHEMA_VERSION"));

  const badUnit = schema.clone(valid);
  badUnit.configuration.units = "cm";
  assert.ok(codes(validation.validateEnvelope(badUnit)).includes("UNITS"));

  const badQuantity = schema.clone(valid);
  delete badQuantity.configuration.modules[0].components[0].quantity.resolved;
  assert.ok(codes(validation.validateEnvelope(badQuantity)).includes("QUANTITY_VALUE"));

  const duplicate = schema.clone(valid);
  duplicate.configuration.modules[1].id = duplicate.configuration.modules[0].id;
  assert.ok(codes(validation.validateEnvelope(duplicate)).includes("DUPLICATE_ID"));
  assert.deepEqual(valid, original, "validators do not mutate input");
  console.log("PASS pure structural and domain validation");
}

function testStoreOperations() {
  let sequence = 0;
  const store = createDesignStore(fixtures.createStraightKitchen(), {
    idFactory: (kind) => kind + "-generated-" + (++sequence),
  });
  let events = 0;
  let lastOperation;
  const unsubscribe = store.subscribe((snapshot, metadata) => {
    events++;
    lastOperation = metadata.operation;
    snapshot.configuration.type = "mutated-by-subscriber";
  });

  store.changeModuleWidth("straight-base-drawers", 650);
  assert.equal(lastOperation, "changeModuleWidth");
  assert.equal(store.getOccupancy().find((row) => row.zone === "base").status, "excess");
  assert.ok(codes(store.validate()).includes("RUN_EXCESS"));
  const resumedOverfilled = createDesignStore(store.getState());
  assert.equal(resumedOverfilled.getOccupancy().find((row) => row.zone === "base").status, "excess");

  store.changeModuleWidth("straight-base-drawers", 500);
  const deficit = store.validate();
  assert.equal(deficit.valid, true);
  assert.equal(deficit.complete, false);
  assert.ok(codes(deficit).includes("RUN_DEFICIT"));

  store.setModuleWidthLocked("straight-base-drawers", true);
  assert.equal(findModule(store.getState(), "straight-base-drawers").locks.width, true);
  const beforeLockedWidth = store.getState();
  assert.throws(() => store.changeModuleWidth("straight-base-drawers", 550),
    (error) => error.code === "WIDTH_LOCKED");
  assert.deepEqual(store.getState(), beforeLockedWidth, "locked width rejection is atomic");
  store.setModuleWidthLocked("straight-base-drawers", false);

  store.addModule({
    id: "straight-base-filler",
    runId: "kitchen-main",
    zone: "base",
    order: 99,
    type: "kitchen.filler",
    dimensions: { widthMm: 100, heightMm: 720, depthMm: 560 },
    components: [],
    options: {},
    locks: { width: true },
  }, { index: 1 });
  assert.equal(store.getOccupancy().find((row) => row.zone === "base").status, "exact");

  store.moveModule("straight-base-filler", { index: 4 });
  assert.equal(findModule(store.getState(), "straight-base-filler").order, 4);

  const duplicateId = store.duplicateModule("straight-base-filler", { id: "straight-base-filler-copy" });
  assert.equal(duplicateId, "straight-base-filler-copy");
  assert.equal(store.getOccupancy().find((row) => row.zone === "base").status, "excess");
  store.removeModule(duplicateId);
  assert.equal(store.getOccupancy().find((row) => row.zone === "base").status, "exact");

  const component = {
    id: "oven-door-test",
    type: "doorSet",
    quantity: { mode: "manual", recommended: 1, applied: 1, resolved: 1 },
    options: {},
  };
  store.addComponent("straight-base-oven", component);
  assert.equal(findModule(store.getState(), "straight-base-oven").components.length, 1);
  store.updateComponent("straight-base-oven", "oven-door-test", {
    quantity: { mode: "manual", recommended: 1, applied: 2, resolved: 2 },
    options: { opening: "swing" },
  });
  assert.equal(findModule(store.getState(), "straight-base-oven").components[0].quantity.resolved, 2);
  assert.equal(findModule(store.getState(), "straight-base-oven").components[0].options.opening, "swing");
  store.removeComponent("straight-base-oven", "oven-door-test");
  assert.equal(findModule(store.getState(), "straight-base-oven").components.length, 0);

  const beforeFailure = store.getState();
  const eventsBeforeFailure = events;
  assert.throws(() => store.addComponent("straight-base-oven", {
    id: "invalid-component",
    type: "shelfSet",
  }), (error) => error.code === "QUANTITY_REQUIRED");
  assert.deepEqual(store.getState(), beforeFailure, "failed operation is atomic");
  assert.equal(events, eventsBeforeFailure, "failed operation is not published");

  const detached = store.getState();
  detached.configuration.modules[0].dimensions.widthMm = 1;
  assert.notEqual(store.getState().configuration.modules[0].dimensions.widthMm, 1);
  assert.notEqual(store.getState().configuration.type, "mutated-by-subscriber");
  unsubscribe();
  console.log("PASS atomic add/remove/duplicate/move/width/lock/component operations");
}

function testMoveAcrossZonesAndDuplicateComponents() {
  const store = createDesignStore(fixtures.createStraightKitchen(), {
    idFactory: (() => {
      let value = 0;
      return (kind) => kind + "-copy-" + (++value);
    })(),
  });
  const copyId = store.duplicateModule("straight-base-drawers");
  const copy = findModule(store.getState(), copyId);
  assert.notEqual(copy.components[0].id, "straight-base-drawers-component");
  store.removeModule(copyId);

  store.addModule({
    id: "movable-filler",
    runId: "kitchen-main",
    zone: "base",
    order: 0,
    type: "kitchen.filler",
    dimensions: { widthMm: 50, heightMm: 720, depthMm: 560 },
    components: [],
    options: {},
    locks: { width: false },
  });
  store.moveModule("movable-filler", { runId: "kitchen-main", zone: "wall", index: 0 });
  const moved = findModule(store.getState(), "movable-filler");
  assert.equal(moved.zone, "wall");
  assert.equal(moved.order, 0);
  assert.equal(store.getOccupancy().find((row) => row.zone === "wall").status, "excess");
  console.log("PASS cross-zone move and regenerated duplicate identifiers");
}

function testEditableAndTechnicalValidityContract() {
  const store = createDesignStore(fixtures.createStraightKitchen());

  const exact = store.getStatus();
  assert.equal(exact.isEditable, true);
  assert.equal(exact.isValid, true);
  assert.equal(exact.isComplete, true);
  assert.equal(exact.canGenerateTechnicalOutputs, true);
  assert.equal(exact.occupancy.find((row) => row.zone === "base").status, "exact");

  store.changeModuleWidth("straight-base-drawers", 500);
  const deficit = store.getStatus();
  assert.equal(deficit.isEditable, true);
  assert.equal(deficit.isValid, true);
  assert.equal(deficit.isComplete, false);
  assert.equal(deficit.canGenerateTechnicalOutputs, false);
  assert.equal(deficit.occupancy.find((row) => row.zone === "base").status, "deficit");
  assert.ok(deficit.issues.some((item) =>
    item.code === "RUN_DEFICIT" && item.severity === "warning"));

  store.changeModuleWidth("straight-base-drawers", 650);
  const excess = store.getStatus();
  assert.equal(excess.isEditable, true);
  assert.equal(excess.isValid, false);
  assert.equal(excess.isComplete, false);
  assert.equal(excess.canGenerateTechnicalOutputs, false);
  assert.equal(excess.occupancy.find((row) => row.zone === "base").status, "excess");
  assert.ok(excess.issues.some((item) =>
    item.code === "RUN_EXCESS" && item.severity === "error"));

  store.changeModuleWidth("straight-base-drawers", 600);
  const corrected = store.getStatus();
  assert.equal(corrected.isEditable, true);
  assert.equal(corrected.isValid, true);
  assert.equal(corrected.isComplete, true);
  assert.equal(corrected.canGenerateTechnicalOutputs, true);

  const beforeInvalidOperation = store.getState();
  assert.throws(() => store.addComponent("straight-base-oven", {
    id: "structurally-invalid-component",
    type: "drawerStack",
  }), (error) => error.code === "QUANTITY_REQUIRED");
  assert.deepEqual(store.getState(), beforeInvalidOperation);
  assert.equal(store.getStatus().isValid, true);
  console.log("PASS editable state versus technical validity contract");
}

function testBrowserPortabilityWithoutDomOrThree() {
  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  const base = path.resolve(__dirname, "../../assets/designer/v2");
  for (const file of ["schema.js", "profiles.js", "closet-distribution.js", "occupancy.js", "validation.js", "store.js", "fixtures.js"]) {
    vm.runInContext(fs.readFileSync(path.join(base, file), "utf8"), context, { filename: file });
  }
  const envelope = context.TALLER_DESIGNER_V2_FIXTURES.createClosetThreeBodies();
  const result = context.TALLER_DESIGNER_V2_VALIDATION.validateEnvelope(envelope);
  assert.equal(result.complete, true);
  const store = context.TALLER_DESIGNER_V2_STORE.createDesignStore(envelope);
  assert.equal(store.getConfiguration().type, "closet");
  assert.equal("document" in context, false);
  assert.equal("THREE" in context, false);
  console.log("PASS browser globals without DOM or Three.js");
}

testFixtures();
testConfigurableProfile();
testAutomaticClosetDistribution();
testPureValidation();
testStoreOperations();
testMoveAcrossZonesAndDuplicateComponents();
testEditableAndTechnicalValidityContract();
testBrowserPortabilityWithoutDomOrThree();
console.log("PASS Designer V2 core");
