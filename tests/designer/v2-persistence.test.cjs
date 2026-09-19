const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fixtures = require('../../assets/designer/v2/fixtures.js');

(async () => {
  const repository = await import(pathToFileURL(path.resolve(__dirname, '../../maestro/js/repositories/designs.js')));
  const original = fixtures.createClosetThreeBodies();
  const encoded = repository.encodeDesign(original);
  assert.notEqual(encoded, original);
  assert.equal(encoded.schemaVersion, 2);
  assert.equal(encoded.generatorVersion, '2.0.0');
  assert.equal(encoded.configuration.type, 'closet');
  const restored = repository.decodeDesign({
    schema_version: encoded.schemaVersion,
    generator_version: encoded.generatorVersion,
    configuration: encoded.configuration,
    type: 'closet',
  });
  assert.deepEqual(restored, original);
  restored.configuration.modules[0].dimensions.widthMm = 1;
  assert.notEqual(original.configuration.modules[0].dimensions.widthMm, 1);
  console.log('PASS V2 persistence envelope encode/decode round-trip.');
})().catch(error => { console.error(error); process.exitCode = 1; });
