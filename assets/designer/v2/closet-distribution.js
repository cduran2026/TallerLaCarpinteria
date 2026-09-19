(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_DESIGNER_V2_CLOSET_DISTRIBUTION = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function positiveInteger(value) { return Number.isInteger(value) && value > 0; }

  function planClosetWidths(totalWidthMm, closetProfile, options) {
    options = options || {};
    if (!positiveInteger(totalWidthMm)) throw new TypeError("El ancho disponible debe ser un entero positivo.");
    const target = closetProfile?.targetBodyWidthMm;
    const minimum = closetProfile?.minBodyWidthMm;
    const maximum = closetProfile?.maxBodyWidthMm;
    if (![target, minimum, maximum].every(positiveInteger) || minimum > target || target > maximum) {
      throw new TypeError("El perfil de cuerpos de clóset no es válido.");
    }

    const minimumCount = Math.ceil(totalWidthMm / maximum);
    const maximumCount = Math.floor(totalWidthMm / minimum);
    if (minimumCount > maximumCount || maximumCount < 1) {
      return {
        isFeasible: false,
        totalWidthMm,
        targetBodyWidthMm: target,
        minBodyWidthMm: minimum,
        maxBodyWidthMm: maximum,
        widths: [],
        reason: "El ancho disponible no admite cuerpos dentro de los límites del perfil.",
      };
    }

    const preferred = positiveInteger(options.preferredCount) &&
      options.preferredCount >= minimumCount && options.preferredCount <= maximumCount
      ? options.preferredCount
      : Math.round(totalWidthMm / target);
    const count = Math.max(minimumCount, Math.min(maximumCount, preferred || 1));
    const base = Math.floor(totalWidthMm / count);
    const remainder = totalWidthMm - base * count;
    const widths = Array.from({ length: count }, function (_, index) {
      return base + (index < remainder ? 1 : 0);
    });

    return {
      isFeasible: true,
      totalWidthMm,
      targetBodyWidthMm: target,
      minBodyWidthMm: minimum,
      maxBodyWidthMm: maximum,
      count,
      widths,
      exact: widths.reduce(function (sum, width) { return sum + width; }, 0) === totalWidthMm,
    };
  }

  return { planClosetWidths };
});
