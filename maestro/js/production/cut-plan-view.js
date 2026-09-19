import { h } from '../ui.js';

const palette = ['#315B47', '#B88945', '#607C68', '#9C7042', '#496B5B', '#C2A06C', '#748E7A'];

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function boardSvg(plan, boardResult) {
  const board = plan.board;
  const svg = svgElement('svg', {
    class: 'cut-board-svg', viewBox: `0 0 ${board.widthMm} ${board.lengthMm}`,
    role: 'img', 'aria-label': `Distribución de corte de la plancha ${boardResult.boardIndex + 1}`,
    preserveAspectRatio: 'xMidYMid meet',
  });
  const title = svgElement('title'); title.textContent = `Plancha ${boardResult.boardIndex + 1}: ${board.widthMm} × ${board.lengthMm} mm`;
  svg.append(title, svgElement('rect', { x: 0, y: 0, width: board.widthMm, height: board.lengthMm, class: 'cut-board-base' }));
  svg.append(svgElement('rect', {
    x: board.trimLeftMm, y: board.trimTopMm,
    width: board.widthMm - board.trimLeftMm - board.trimRightMm,
    height: board.lengthMm - board.trimTopMm - board.trimBottomMm,
    class: 'cut-board-usable',
  }));
  boardResult.leftovers.filter(item => item.reusable).forEach(item => {
    svg.append(svgElement('rect', { x: item.xMm, y: item.yMm, width: item.widthMm, height: item.lengthMm, class: 'cut-leftover' }));
  });
  boardResult.placements.forEach((placement, index) => {
    const group = svgElement('g', { class: 'cut-piece', 'data-piece-id': placement.pieceId });
    const color = palette[index % palette.length];
    group.append(svgElement('rect', {
      x: placement.xMm, y: placement.yMm, width: placement.widthMm, height: placement.lengthMm,
      fill: color, rx: 5, vectorEffect: 'non-scaling-stroke',
    }));
    const text = svgElement('text', {
      x: placement.xMm + placement.widthMm / 2,
      y: placement.yMm + placement.lengthMm / 2 - 8,
      class: 'cut-piece-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    });
    text.textContent = placement.name.replace(/^Cuerpo \d+ · /, '');
    const size = svgElement('text', {
      x: placement.xMm + placement.widthMm / 2,
      y: placement.yMm + placement.lengthMm / 2 + 22,
      class: 'cut-piece-size', 'text-anchor': 'middle', 'dominant-baseline': 'middle',
    });
    size.textContent = `${placement.lengthMm} × ${placement.widthMm}` + (placement.rotated ? ' ↻' : '');
    group.append(text, size); svg.append(group);
  });
  return svg;
}

export function cutPlanCard(plan, boardResult) {
  const reusable = boardResult.leftovers.filter(item => item.reusable);
  return h('article', { class: 'cut-plan-card' },
    h('header', { class: 'cut-plan-card-header' },
      h('div', {}, h('span', { class: 'section-kicker' }, `Plancha ${boardResult.boardIndex + 1} de ${plan.boardCount}`),
        h('h3', {}, `${plan.board.materialName || plan.board.materialId} · ${plan.board.thicknessMm} mm`),
        h('p', {}, `${plan.board.lengthMm} × ${plan.board.widthMm} mm · Kerf ${plan.board.kerfMm} mm`)),
      h('div', { class: 'cut-plan-score' }, h('strong', {}, `${boardResult.metrics.utilizationPercent}%`), h('span', {}, 'aprovechamiento'))),
    h('div', { class: 'cut-board-frame' }, boardSvg(plan, boardResult)),
    h('footer', { class: 'cut-plan-metrics' },
      h('span', {}, h('strong', {}, boardResult.metrics.pieceCount), ' piezas'),
      h('span', {}, h('strong', {}, `${boardResult.metrics.wastePercent}%`), ' desperdicio'),
      h('span', {}, h('strong', {}, reusable.length), ` sobrantes reutilizables (${boardResult.metrics.reusableLeftoverPercent}%)`),
      h('span', {}, h('strong', {}, boardResult.metrics.kerfCuts), ' separaciones con kerf')));
}
