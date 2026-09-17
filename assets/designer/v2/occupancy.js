(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_DESIGNER_V2_OCCUPANCY = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function calculateOccupancy(configuration) {
    const modules = Array.isArray(configuration?.modules) ? configuration.modules : [];
    const runs = Array.isArray(configuration?.layout?.runs) ? configuration.layout.runs : [];
    const result = [];

    for (const run of runs) {
      for (const zone of run.zones || []) {
        const startReserveMm = zone.startReserveMm || 0;
        const endReserveMm = zone.endReserveMm || 0;
        const availableMm = run.lengthMm - startReserveMm - endReserveMm;
        const members = modules
          .filter((module) => module.runId === run.id && module.zone === zone.id)
          .sort((left, right) => left.order - right.order);
        const occupiedMm = members.reduce((total, module) => total + module.dimensions.widthMm, 0);
        const deltaMm = availableMm - occupiedMm;
        result.push({
          runId: run.id,
          zone: zone.id,
          runLengthMm: run.lengthMm,
          startReserveMm,
          endReserveMm,
          availableMm,
          occupiedMm,
          deltaMm,
          status: deltaMm === 0 ? "exact" : deltaMm > 0 ? "deficit" : "excess",
          moduleIds: members.map((module) => module.id),
        });
      }
    }
    return result;
  }

  return { calculateOccupancy };
});
