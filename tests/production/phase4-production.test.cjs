const assert = require('node:assert/strict');
const designerFixtures = require('../../assets/designer/v2/fixtures.js');
const productionSchema = require('../../assets/production/schema.js');
const productionProfiles = require('../../assets/production/profiles.js');
const generator = require('../../assets/production/piece-generator.js');
const optimizer = require('../../assets/production/cut-optimizer.js');

function piece(id, lengthMm, widthMm, overrides = {}) {
  return {
    pieceId: id, sourceModuleId: overrides.sourceModuleId || 'module-1', sourceComponentId: overrides.sourceComponentId || null,
    name: overrides.name || id, pieceType: overrides.pieceType || 'test', quantity: overrides.quantity || 1,
    lengthMm, widthMm, thicknessMm: overrides.thicknessMm || 15,
    materialId: overrides.materialId || 'mat-a', materialName: overrides.materialName || 'Melamina A',
    grainDirection: overrides.grainDirection || 'none', allowRotation: overrides.allowRotation ?? true,
    edgeBanding: { top: null, bottom: null, left: null, right: null },
  };
}
function board(overrides = {}) {
  return {
    boardId: overrides.boardId || 'board-a', materialId: overrides.materialId || 'mat-a',
    lengthMm: overrides.lengthMm || 1000, widthMm: overrides.widthMm || 1000, thicknessMm: overrides.thicknessMm || 15,
    kerfMm: overrides.kerfMm ?? 0,
    trimTopMm: overrides.trimTopMm ?? 0, trimBottomMm: overrides.trimBottomMm ?? 0,
    trimLeftMm: overrides.trimLeftMm ?? 0, trimRightMm: overrides.trimRightMm ?? 0,
    reusableLeftover: overrides.reusableLeftover || { minLengthMm: 100, minWidthMm: 100, minAreaMm2: 10000 },
  };
}
function overlaps(a, b) {
  return a.xMm < b.xMm + b.widthMm && a.xMm + a.widthMm > b.xMm && a.yMm < b.yMm + b.lengthMm && a.yMm + a.lengthMm > b.yMm;
}
function test(name, callback) {
  try { callback(); console.log('✓', name); }
  catch (error) { console.error('✗', name); throw error; }
}

test('1. todas las piezas caben en una plancha', () => {
  const plan = optimizer.optimize({ board: board(), pieces: [piece('a', 400, 400), piece('b', 400, 400)] });
  assert.equal(plan.boardCount, 1); assert.equal(plan.totals.placedPieces, 2); assert.equal(plan.totals.unplacedPieces, 0);
});
test('2. crea varias planchas cuando una no alcanza', () => {
  const plan = optimizer.optimize({ board: board(), pieces: [piece('a', 700, 700, { quantity: 3 })] });
  assert.equal(plan.boardCount, 3); assert.equal(plan.totals.placedPieces, 3);
});
test('3. aplica rotación permitida cuando es necesaria', () => {
  const plan = optimizer.optimize({ board: board({ lengthMm: 1200 }), pieces: [piece('rot', 900, 1100)] });
  assert.equal(plan.totals.placedPieces, 1); assert.equal(plan.placedPieces[0].rotated, true);
});
test('4. la veta impide rotación', () => {
  const plan = optimizer.optimize({ board: board({ lengthMm: 1200 }), pieces: [piece('grain', 900, 1100, { grainDirection: 'length', allowRotation: false })] });
  assert.equal(plan.totals.placedPieces, 0); assert.equal(plan.totals.unplacedPieces, 1);
});
test('5. el kerf afecta el número de planchas', () => {
  const pieces = [piece('a', 200, 500), piece('b', 200, 500)];
  assert.equal(optimizer.optimize({ board: board({ lengthMm: 400 }), pieces }).boardCount, 1);
  assert.equal(optimizer.optimize({ board: board({ lengthMm: 400, kerfMm: 3.2 }), pieces }).boardCount, 2);
});
test('6. el refilado reduce el área útil', () => {
  const item = piece('trim', 1000, 1000, { allowRotation: false });
  assert.equal(optimizer.optimize({ board: board(), pieces: [item] }).totals.placedPieces, 1);
  assert.equal(optimizer.optimize({ board: board({ trimTopMm: 10 }), pieces: [item] }).totals.unplacedPieces, 1);
});
test('7. materiales y espesores se separan', () => {
  const mixed = [piece('a', 100, 100), piece('b', 100, 100, { materialId: 'mat-b' })];
  assert.throws(() => optimizer.optimize({ board: board(), pieces: mixed }), error => error.code === 'MATERIAL_GROUP_MISMATCH');
  const plans = optimizer.optimizeByMaterial({ pieces: mixed, boardForGroup: (_key, sample) => board({ materialId: sample.materialId }) });
  assert.equal(plans.length, 2); assert.deepEqual(plans.map(plan => plan.groupKey).sort(), ['mat-a::15', 'mat-b::15']);
});
test('8 y 9. no hay solapes ni piezas fuera del área útil', () => {
  const sheet = board({ lengthMm: 900, widthMm: 900, kerfMm: 3.2, trimTopMm: 10, trimBottomMm: 10, trimLeftMm: 10, trimRightMm: 10 });
  const plan = optimizer.optimize({ board: sheet, pieces: [piece('a', 300, 300, { quantity: 7 }), piece('b', 200, 250, { quantity: 3 })] });
  plan.boards.forEach(result => result.placements.forEach((placement, index) => {
    assert.ok(placement.xMm >= sheet.trimLeftMm && placement.yMm >= sheet.trimTopMm);
    assert.ok(placement.xMm + placement.widthMm <= sheet.widthMm - sheet.trimRightMm);
    assert.ok(placement.yMm + placement.lengthMm <= sheet.lengthMm - sheet.trimBottomMm);
    result.placements.slice(index + 1).forEach(other => assert.equal(overlaps(placement, other), false));
  }));
});
test('10. el resultado es determinista', () => {
  const input = { board: board({ kerfMm: 3.2 }), pieces: [piece('z', 220, 310, { quantity: 4 }), piece('a', 180, 250, { quantity: 2 })] };
  assert.deepEqual(optimizer.optimize(input), optimizer.optimize(input));
});
test('11. conserva trazabilidad diseño → módulo → componente → pieza', () => {
  const envelope = designerFixtures.createClosetThreeBodies();
  const generated = generator.generateClosetPieces(envelope, { designId: 'design-trace' });
  const shelf = generated.pieces.find(item => item.pieceType === 'shelf');
  assert.equal(shelf.sourceDesignId, 'design-trace'); assert.ok(shelf.pieceId); assert.ok(shelf.sourceModuleId); assert.ok(shelf.sourceComponentId);
  const material = envelope.configuration.materials.catalog[0];
  const cutBoard = productionProfiles.createBoardFromMaterial(material, shelf.thicknessMm, undefined, 'trace-board');
  const plan = optimizer.optimize({ board: cutBoard, pieces: generated.pieces.filter(item => productionSchema.groupKey(item) === productionSchema.groupKey(shelf)) });
  const placement = plan.placedPieces.find(item => item.pieceId === shelf.pieceId);
  assert.equal(placement.sourceDesignId, 'design-trace');
  assert.equal(placement.sourceModuleId, shelf.sourceModuleId); assert.equal(placement.sourceComponentId, shelf.sourceComponentId);
});
test('12. calcula aprovechamiento y desperdicio', () => {
  const plan = optimizer.optimize({ board: board({ reusableLeftover: { minLengthMm: 2000, minWidthMm: 2000, minAreaMm2: 4000000 } }), pieces: [piece('half', 500, 1000, { allowRotation: false })] });
  assert.equal(plan.totals.usedAreaMm2, 500000); assert.equal(plan.totals.remainingAreaMm2, 500000);
  assert.equal(plan.totals.utilizationPercent, 50); assert.equal(plan.totals.wastePercent, 50);
  const reusablePlan = optimizer.optimize({ board: board(), pieces: [piece('half', 500, 1000, { allowRotation: false })] });
  assert.equal(reusablePlan.totals.reusableLeftoverAreaMm2, 500000);
  assert.equal(reusablePlan.totals.reusableLeftoverPercent, 50); assert.equal(reusablePlan.totals.wastePercent, 0);
});
test('13. recupera exactamente las cantidades repetidas', () => {
  const plan = optimizer.optimize({ board: board(), pieces: [piece('repeat', 100, 100, { quantity: 7 })] });
  assert.equal(plan.totals.requestedPieces, 7); assert.equal(plan.totals.placedPieces, 7);
  assert.equal(new Set(plan.placedPieces.map(item => item.pieceInstanceId)).size, 7);
  assert.ok(plan.placedPieces.every(item => item.pieceId === 'repeat'));
});
test('el despiece solo se genera con salida técnica habilitada y suma tapacantos', () => {
  const envelope = designerFixtures.createClosetThreeBodies();
  envelope.configuration.materials.catalog[0].thicknessMm = 15;
  envelope.configuration.standards.snapshot.panels.carcassThicknessMm = 15;
  const result = generator.generateClosetPieces(envelope);
  assert.deepEqual(result, generator.generateClosetPieces(envelope));
  assert.ok(result.totals.totalPieces > 0); assert.ok(result.edgeBandingTotals[0].linearMeters > 0);
  envelope.configuration.modules[0].dimensions.widthMm += 100;
  assert.throws(() => generator.generateClosetPieces(envelope), error => error.code === 'DESIGN_NOT_READY');
});
test('fixture real usa plancha y corte desde configuración', () => {
  const material = { id: 'fixture-melamine', name: 'Melamina 15 mm', sheet: { lengthMm: 2500, widthMm: 1830 } };
  const profile = productionProfiles.createCutProfile({ kerfMm: 3.2, trims: { topMm: 10, bottomMm: 10, leftMm: 10, rightMm: 10 } });
  const configured = productionProfiles.createBoardFromMaterial(material, 15, profile, 'fixture-2500x1830');
  assert.deepEqual([configured.lengthMm, configured.widthMm, configured.thicknessMm, configured.kerfMm, configured.trimTopMm], [2500, 1830, 15, 3.2, 10]);
});

console.log('\nFASE 4: todos los escenarios de producción pasaron.');
