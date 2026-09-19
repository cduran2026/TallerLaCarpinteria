(function (root, factory) {
  "use strict";
  const schema = typeof module === "object" && module.exports ? require("./schema.js") : root.TALLER_PRODUCTION_SCHEMA;
  const api = factory(schema);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.TALLER_CUT_OPTIMIZER = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function (schema) {
  "use strict";
  if (!schema) throw new Error("Cut optimizer requiere schema.js.");

  function round(value, digits) { const factor = Math.pow(10, digits || 0); return Math.round(value * factor) / factor; }
  function orientationOptions(piece) {
    const normal = { rotated: false, placedWidthMm: piece.widthMm, placedLengthMm: piece.lengthMm };
    if (!piece.allowRotation || piece.grainDirection !== "none" || piece.widthMm === piece.lengthMm) return [normal];
    return [normal, { rotated: true, placedWidthMm: piece.lengthMm, placedLengthMm: piece.widthMm }];
  }
  function sortInstances(instances) {
    return instances.sort(function (a, b) {
      const aMax = Math.max(a.lengthMm, a.widthMm); const bMax = Math.max(b.lengthMm, b.widthMm);
      return bMax - aMax || (b.lengthMm * b.widthMm) - (a.lengthMm * a.widthMm) ||
        a.pieceId.localeCompare(b.pieceId) || a.quantityIndex - b.quantityIndex;
    });
  }
  function createBoardState(board, index) {
    return { index, boardInstanceId: board.boardId + "#" + String(index + 1).padStart(3, "0"), shelves: [], placements: [] };
  }
  function usable(board) {
    return {
      x: board.trimLeftMm, y: board.trimTopMm,
      width: board.widthMm - board.trimLeftMm - board.trimRightMm,
      length: board.lengthMm - board.trimTopMm - board.trimBottomMm,
    };
  }
  function candidatesForShelf(board, boardState, shelf, piece) {
    const space = usable(board); const gap = shelf.placements.length ? board.kerfMm : 0;
    return orientationOptions(piece).filter(function (item) {
      return item.placedLengthMm <= shelf.heightMm && shelf.cursorMm + gap + item.placedWidthMm <= space.width;
    }).map(function (item) {
      return { ...item, gap, horizontalRemainder: space.width - shelf.cursorMm - gap - item.placedWidthMm,
        verticalRemainder: shelf.heightMm - item.placedLengthMm };
    });
  }
  function newShelfY(board, state) {
    if (!state.shelves.length) return 0;
    const last = state.shelves[state.shelves.length - 1];
    return last.yMm + last.heightMm + board.kerfMm;
  }
  function candidatesForNewShelf(board, state, piece) {
    const space = usable(board); const y = newShelfY(board, state);
    return orientationOptions(piece).filter(function (item) {
      return item.placedWidthMm <= space.width && y + item.placedLengthMm <= space.length;
    }).map(function (item) {
      return { ...item, yMm: y, horizontalRemainder: space.width - item.placedWidthMm,
        verticalRemainder: space.length - y - item.placedLengthMm };
    });
  }
  function best(candidates) {
    return candidates.sort(function (a, b) {
      return a.horizontalRemainder - b.horizontalRemainder || a.verticalRemainder - b.verticalRemainder || Number(a.rotated) - Number(b.rotated);
    })[0];
  }
  function placeOnShelf(board, state, shelf, piece, choice) {
    const space = usable(board);
    const localX = shelf.cursorMm + choice.gap;
    const placement = {
      boardIndex: state.index, boardInstanceId: state.boardInstanceId,
      pieceId: piece.pieceId, pieceInstanceId: piece.pieceInstanceId,
      sourceDesignId: piece.sourceDesignId || null,
      sourceModuleId: piece.sourceModuleId, sourceComponentId: piece.sourceComponentId,
      name: piece.name, pieceType: piece.pieceType, materialId: piece.materialId, thicknessMm: piece.thicknessMm,
      xMm: space.x + localX, yMm: space.y + shelf.yMm,
      widthMm: choice.placedWidthMm, lengthMm: choice.placedLengthMm,
      rotated: choice.rotated, grainDirection: piece.grainDirection,
    };
    shelf.cursorMm = localX + choice.placedWidthMm;
    shelf.placements.push(placement); state.placements.push(placement);
  }
  function tryPlace(board, state, piece) {
    const shelfChoices = [];
    state.shelves.forEach(function (shelf) {
      const choice = best(candidatesForShelf(board, state, shelf, piece));
      if (choice) shelfChoices.push({ shelf, choice });
    });
    shelfChoices.sort(function (a, b) {
      return a.choice.horizontalRemainder - b.choice.horizontalRemainder || a.choice.verticalRemainder - b.choice.verticalRemainder || a.shelf.yMm - b.shelf.yMm;
    });
    if (shelfChoices.length) {
      placeOnShelf(board, state, shelfChoices[0].shelf, piece, shelfChoices[0].choice); return true;
    }
    const choice = best(candidatesForNewShelf(board, state, piece));
    if (!choice) return false;
    const shelf = { yMm: choice.yMm, heightMm: choice.placedLengthMm, cursorMm: 0, placements: [] };
    state.shelves.push(shelf); placeOnShelf(board, state, shelf, piece, { ...choice, gap: 0 }); return true;
  }
  function reusable(leftover, profile) {
    return leftover.lengthMm >= profile.minLengthMm && leftover.widthMm >= profile.minWidthMm && leftover.areaMm2 >= profile.minAreaMm2;
  }
  function finishBoard(board, state) {
    const space = usable(board); const leftovers = [];
    state.shelves.forEach(function (shelf, index) {
      const width = space.width - shelf.cursorMm;
      if (width > 0) leftovers.push({ leftoverId: state.boardInstanceId + ":right:" + index,
        xMm: space.x + shelf.cursorMm, yMm: space.y + shelf.yMm, widthMm: width, lengthMm: shelf.heightMm, areaMm2: width * shelf.heightMm });
    });
    const usedLength = state.shelves.length ? state.shelves[state.shelves.length - 1].yMm + state.shelves[state.shelves.length - 1].heightMm : 0;
    if (space.length - usedLength > 0) leftovers.push({ leftoverId: state.boardInstanceId + ":bottom",
      xMm: space.x, yMm: space.y + usedLength, widthMm: space.width, lengthMm: space.length - usedLength, areaMm2: space.width * (space.length - usedLength) });
    leftovers.forEach(function (item) { item.reusable = reusable(item, board.reusableLeftover || { minLengthMm: Infinity, minWidthMm: Infinity, minAreaMm2: Infinity }); });
    const usedAreaMm2 = state.placements.reduce(function (sum, item) { return sum + item.widthMm * item.lengthMm; }, 0);
    const grossAreaMm2 = board.widthMm * board.lengthMm;
    const reusableLeftoverAreaMm2 = leftovers.filter(function (item) { return item.reusable; }).reduce(function (sum, item) { return sum + item.areaMm2; }, 0);
    const remainingAreaMm2 = grossAreaMm2 - usedAreaMm2;
    const wasteAreaMm2 = Math.max(0, remainingAreaMm2 - reusableLeftoverAreaMm2);
    let kerfAreaMm2 = 0; let kerfCuts = 0;
    state.shelves.forEach(function (shelf, shelfIndex) {
      const horizontalCuts = Math.max(0, shelf.placements.length - 1);
      kerfCuts += horizontalCuts; kerfAreaMm2 += horizontalCuts * board.kerfMm * shelf.heightMm;
      if (shelfIndex > 0) { kerfCuts += 1; kerfAreaMm2 += board.kerfMm * space.width; }
    });
    return {
      boardIndex: state.index, boardInstanceId: state.boardInstanceId,
      placements: state.placements, leftovers,
      metrics: {
        pieceCount: state.placements.length, usedAreaMm2, grossAreaMm2,
        remainingAreaMm2, wasteAreaMm2,
        utilizationPercent: round(usedAreaMm2 / grossAreaMm2 * 100, 2),
        remainingPercent: round(remainingAreaMm2 / grossAreaMm2 * 100, 2),
        wastePercent: round(wasteAreaMm2 / grossAreaMm2 * 100, 2),
        reusableLeftoverPercent: round(reusableLeftoverAreaMm2 / grossAreaMm2 * 100, 2),
        kerfMm: board.kerfMm, kerfCuts, kerfAreaMm2: round(kerfAreaMm2, 2),
        reusableLeftoverAreaMm2,
      },
    };
  }

  function optimize(input) {
    const board = schema.clone(input?.board); const pieces = schema.clone(input?.pieces || []);
    const strategy = input?.strategy || "shelf-best-fit-v1";
    const boardErrors = schema.validateBoard(board);
    if (boardErrors.length) throw new Error("Plancha inválida: " + boardErrors.join(" "));
    if (!schema.STRATEGIES.includes(strategy)) throw new Error("Estrategia no compatible: " + strategy);
    pieces.forEach(function (piece) {
      if (piece.materialId !== board.materialId || piece.thicknessMm !== board.thicknessMm) {
        throw Object.assign(new Error("No se pueden mezclar materiales o espesores en una optimización."), { code: "MATERIAL_GROUP_MISMATCH" });
      }
    });
    const instances = sortInstances(schema.expandQuantities(pieces)); const states = []; const unplacedPieces = [];
    instances.forEach(function (piece) {
      let placed = states.some(function (state) { return tryPlace(board, state, piece); });
      if (!placed) {
        const state = createBoardState(board, states.length);
        placed = tryPlace(board, state, piece);
        if (placed) states.push(state); else unplacedPieces.push(piece);
      }
    });
    const boards = states.map(function (state) { return finishBoard(board, state); });
    const placedPieces = boards.flatMap(function (item) { return item.placements; });
    const grossAreaMm2 = boards.length * board.lengthMm * board.widthMm;
    const usedAreaMm2 = placedPieces.reduce(function (sum, item) { return sum + item.widthMm * item.lengthMm; }, 0);
    const reusableLeftovers = boards.flatMap(function (item) { return item.leftovers.filter(function (leftover) { return leftover.reusable; }); });
    const reusableLeftoverAreaMm2 = reusableLeftovers.reduce(function (sum, item) { return sum + item.areaMm2; }, 0);
    const remainingAreaMm2 = grossAreaMm2 - usedAreaMm2;
    const wasteAreaMm2 = Math.max(0, remainingAreaMm2 - reusableLeftoverAreaMm2);
    return {
      cutPlanVersion: schema.CUT_PLAN_VERSION, strategy,
      groupKey: board.materialId + "::" + board.thicknessMm,
      board, boardCount: boards.length, boards, placedPieces, unplacedPieces,
      reusableLeftovers,
      totals: {
        requestedPieces: instances.length, placedPieces: placedPieces.length, unplacedPieces: unplacedPieces.length,
        grossAreaMm2, usedAreaMm2, remainingAreaMm2, wasteAreaMm2, reusableLeftoverAreaMm2,
        utilizationPercent: grossAreaMm2 ? round(usedAreaMm2 / grossAreaMm2 * 100, 2) : 0,
        remainingPercent: grossAreaMm2 ? round(remainingAreaMm2 / grossAreaMm2 * 100, 2) : 0,
        wastePercent: grossAreaMm2 ? round(wasteAreaMm2 / grossAreaMm2 * 100, 2) : 0,
        reusableLeftoverPercent: grossAreaMm2 ? round(reusableLeftoverAreaMm2 / grossAreaMm2 * 100, 2) : 0,
        kerfAreaMm2: round(boards.reduce(function (sum, item) { return sum + item.metrics.kerfAreaMm2; }, 0), 2),
      },
    };
  }

  function optimizeByMaterial(input) {
    const groups = new Map();
    (input?.pieces || []).forEach(function (piece) {
      const key = schema.groupKey(piece); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(piece);
    });
    const plans = [];
    Array.from(groups.keys()).sort().forEach(function (key) {
      const pieces = groups.get(key); const board = input.boardForGroup(key, pieces[0]);
      plans.push(optimize({ board, pieces, strategy: input.strategy }));
    });
    return plans;
  }

  return { optimize, optimizeByMaterial };
});
