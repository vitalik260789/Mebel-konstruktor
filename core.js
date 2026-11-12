// Мебель-Конструктор — ядро: генерация деталей, присадка, раскрой, экспорт.
// Система координат изделия (мм): X — слева направо, Y — вверх от пола, Z — от задней стенки (0) к фронту (D).
// Деталь: L × W × T. Ориентация задаёт, вдоль каких мировых осей лежат L (x), W (y) и толщина (z):
//   H — горизонтальная (крышка, дно, полка): x→X, y→Z, z→Y
//   S — вертикальная боковая (боковины):      x→Z, y→Y, z→X
//   F — фронтальная (фасады, задняя, цоколь): x→X, y→Y, z→Z
// Пласть A — сторона z = T, пласть B — сторона z = 0.
// Торцы: Д1 (L1) — y = 0, Д2 (L2) — y = W, Ш1 (W1) — x = 0, Ш2 (W2) — x = L.

export const VERSION = '1.0';

export const DEFAULT_SETTINGS = {
  sheetL: 2800, sheetW: 2070, kerf: 4, trim: 10, grain: false, subtractEdge: true,
};

export const HW = {
  confFaceD: 7, confEdgeD: 5, confEdgeDepth: 50, confEnd: 50, confStep: 400,
  pinD: 5, pinDepth: 12, pinFront: 37, pinBack: 37, pinBelow: 5,
  cupD: 35, cupDepth: 13, cupOffset: 21.5, hingeEnd: 100,
  plateFront: 37, plateSpacing: 32, plateD: 5, plateDepth: 12,
  handleD: 5, boxConfEnd: 30, camDist: 34, camD: 15, stemEdgeD: 8, stemFaceD: 5, stemFaceDepth: 11, dowelD: 8, dowelEdgeDepth: 30,
};

// Петли: центр чашки от края двери и глубина чашки (проверь по каталогу своей петли)
export const HINGES = {
  std: { label: 'Стандартная (Boyard, GTV, Китай)', cupOffset: 21.5, cupDepth: 12 },
  blum: { label: 'Blum Clip top', cupOffset: 21.5, cupDepth: 13 },
  hettich: { label: 'Hettich Sensys', cupOffset: 22, cupDepth: 13.5 },
  hafele: { label: 'Häfele Metalla', cupOffset: 22.5, cupDepth: 12 },
};
// Направляющие: зазор на сторону, короб ниже фасада на boxMinus, доступные длины
export const RUNNERS = {
  roller: { label: 'Роликовые', gap: 13, boxMinus: 50, lens: [650, 600, 550, 500, 450, 400, 350, 300, 250] },
  ball: { label: 'Шариковые полного выдвижения', gap: 13, boxMinus: 40, lens: [600, 550, 500, 450, 400, 350, 300, 250] },
  hidden: { label: 'Скрытого монтажа (Blum Tandem, Hettich Quadro)', gap: 5, boxMinus: 60, lens: [600, 550, 500, 450, 400, 350, 300, 270] },
};
export const JOINTS = { conf: 'Конфирматы 7×50', minifix: 'Эксцентрики (минификс) + шканты', dowel: 'Шканты 8×30 (на клей)' };

export const HOLE_TYPES = {
  conf: 'Конфирмат', pin: 'Полкодержатель', cup: 'Петля (чашка)', plate: 'Планка петли',
  handle: 'Ручка', user: 'Доп. отверстие', cam: 'Эксцентрик (корпус)', stem: 'Шток эксцентрика', dowel: 'Шкант',
};

export const EDGE_NAMES = { L1: 'Д1', L2: 'Д2', W1: 'Ш1', W2: 'Ш2' };

// Каталог материалов. kind: plate — плиты корпуса/фасадов, thin — задние стенки и дно ящиков.
export const MATERIALS = [
  { group: 'ЛДСП', name: 'ЛДСП Белый', kind: 'plate', color: '#f2f0ec' },
  { group: 'ЛДСП', name: 'ЛДСП Белый шагрень', kind: 'plate', color: '#eceae4' },
  { group: 'ЛДСП', name: 'ЛДСП Серый', kind: 'plate', color: '#b9bbbd' },
  { group: 'ЛДСП', name: 'ЛДСП Антрацит', kind: 'plate', color: '#4b4e52' },
  { group: 'ЛДСП', name: 'ЛДСП Чёрный', kind: 'plate', color: '#2a2a2b' },
  { group: 'ЛДСП', name: 'ЛДСП Кашемир', kind: 'plate', color: '#d8cdbd' },
  { group: 'ЛДСП', name: 'ЛДСП Дуб Сонома', kind: 'plate', color: '#c8a27a' },
  { group: 'ЛДСП', name: 'ЛДСП Дуб Крафт золотой', kind: 'plate', color: '#c08a4e' },
  { group: 'ЛДСП', name: 'ЛДСП Дуб Галифакс', kind: 'plate', color: '#a07a55' },
  { group: 'ЛДСП', name: 'ЛДСП Дуб Вотан', kind: 'plate', color: '#8a6845' },
  { group: 'ЛДСП', name: 'ЛДСП Ясень Шимо светлый', kind: 'plate', color: '#e3d6c4' },
  { group: 'ЛДСП', name: 'ЛДСП Орех', kind: 'plate', color: '#7a5236' },
  { group: 'ЛДСП', name: 'ЛДСП Венге', kind: 'plate', color: '#3e2c22' },
  { group: 'ЛДСП', name: 'ЛДСП Бук', kind: 'plate', color: '#d9a877' },
  { group: 'МДФ', name: 'МДФ крашеный Белый', kind: 'plate', color: '#fafafa' },
  { group: 'МДФ', name: 'МДФ крашеный Серый', kind: 'plate', color: '#a9adb1' },
  { group: 'МДФ', name: 'МДФ под покраску', kind: 'plate', color: '#c9b79c' },
  { group: 'МДФ', name: 'МДФ шпонированный Дуб', kind: 'plate', color: '#b8905f' },
  { group: 'Фанера и массив', name: 'Фанера берёзовая', kind: 'plate', color: '#e2c9a0' },
  { group: 'Фанера и массив', name: 'Мебельный щит Сосна', kind: 'plate', color: '#e6c18c' },
  { group: 'Фанера и массив', name: 'Мебельный щит Дуб', kind: 'plate', color: '#bf9363' },
  { group: 'ХДФ / ДВП', name: 'ХДФ Белый', kind: 'thin', color: '#efede8' },
  { group: 'ХДФ / ДВП', name: 'ХДФ Серый', kind: 'thin', color: '#b5b7b9' },
  { group: 'ХДФ / ДВП', name: 'ХДФ Венге', kind: 'thin', color: '#4a3528' },
  { group: 'ХДФ / ДВП', name: 'ХДФ Дуб Сонома', kind: 'thin', color: '#c8a27a' },
  { group: 'ХДФ / ДВП', name: 'ДВП коричневый', kind: 'thin', color: '#8b6a4a' },
  { group: 'ХДФ / ДВП', name: 'Фанера 4 мм', kind: 'thin', color: '#e2c9a0' },
];
export const THICKNESSES = { plate: [8, 10, 12, 15, 16, 18, 19, 22, 25, 28, 32], thin: [3, 4, 5, 6, 8] };

const BASE = {
  type: 'cabinet', t: 16, matCorpus: 'ЛДСП Белый', frontT: 16, matFront: 'ЛДСП Дуб Сонома',
  backType: 'overlay', backT: 3, matBack: 'ХДФ Белый', topType: 'overlay', base: 'plinth',
  plinthH: 60, plinthSetback: 40, legsH: 100, shelfType: 'pins', shelfRecess: 10, gap: 3, gapEdge: 1.5,
  handle: 96, edgeFront: 2, edgeOther: 0.4, edgeFacade: 2,
  joint: 'conf', hingeBrand: 'std', cupOffset: 21.5, cupDepth: 12, hingeEnd: 100, runner: 'roller', grooveOff: 10, grooveDepth: 8,
};

// Блок наполнения секции (сверху вниз): type: drawers | doors | open; h — высота зоны по фасаду (0 = авто);
// n — число ящиков или дверей; hinge — сторона петель для одной двери; shelves — число полок; pos — высоты полок вручную.
export const blk = (type, o = {}) => ({ type, h: 0, n: 1, hinge: 'left', shelves: 0, pos: '', ...o });
export const sec = (blocks, w = 0) => ({ w, blocks });

export const TEMPLATES = {
  nightstand: { label: 'Тумба прикроватная', params: { ...BASE, name: 'Тумба прикроватная', W: 450, H: 550, D: 400,
    sections: [sec([blk('drawers', { h: 150 }), blk('doors', { shelves: 1 })])] } },
  dresser: { label: 'Комод с ящиками', params: { ...BASE, name: 'Комод', W: 800, H: 850, D: 450, handle: 128,
    sections: [sec([blk('drawers', { n: 4 })])] } },
  tv: { label: 'Тумба под ТВ (3 секции)', params: { ...BASE, name: 'Тумба под ТВ', W: 1500, H: 450, D: 400, base: 'legs', legsH: 100, handle: 128,
    sections: [sec([blk('doors', { hinge: 'left', shelves: 1 })], 450), sec([blk('open', { h: 200 }), blk('drawers')]), sec([blk('doors', { hinge: 'right', shelves: 1 })], 450)] } },
  wardrobe: { label: 'Шкаф 2-дверный', params: { ...BASE, name: 'Шкаф', W: 800, H: 2000, D: 550, plinthH: 80, handle: 128,
    sections: [sec([blk('doors', { n: 2, shelves: 4 })])] } },
  wardrobe3: { label: 'Шкаф 3-секционный', params: { ...BASE, name: 'Шкаф 3-секционный', W: 1200, H: 2100, D: 580, plinthH: 80, handle: 128,
    sections: [sec([blk('doors', { hinge: 'left', shelves: 5 })]), sec([blk('doors', { hinge: 'right', shelves: 2 }), blk('drawers', { h: 600, n: 3 })]), sec([blk('doors', { hinge: 'right', shelves: 1, pos: '1500' })])] } },
  shelving: { label: 'Стеллаж открытый', params: { ...BASE, name: 'Стеллаж', W: 800, H: 1800, D: 300, shelfType: 'fixed', shelfRecess: 0, handle: 0,
    sections: [sec([blk('open', { shelves: 4 })])] } },
  base: { label: 'Тумба с дверцами', params: { ...BASE, name: 'Тумба', W: 600, H: 720, D: 500, base: 'legs', legsH: 100,
    sections: [sec([blk('doors', { n: 2, shelves: 1 })])] } },
};

// Старые проекты (до секций) переводим в секции
export function normalizeParams(P0) {
  const P = { ...BASE, ...P0 };
  if (Array.isArray(P.sections) && P.sections.length) return P;
  const L = P.layout || 'doors', g = Number(P.gap) || 3;
  const doors = blk('doors', { n: Number(P.doors) || 1, hinge: P.hingeSide || 'left', shelves: Number(P.shelves) || 0 });
  if (L === 'drawers') P.sections = [sec([blk('drawers', { n: Number(P.drawers) || 1 })])];
  else if (L === 'drawers+doors') {
    const n = Number(P.drawers) || 1;
    P.sections = [sec([blk('drawers', { n, h: n * (Number(P.drawerFrontH) || 150) + (n - 1) * g }), doors])];
  } else if (L === 'none') P.sections = [sec([blk('open', { shelves: Number(P.shelves) || 0 })])];
  else P.sections = [sec([doors])];
  return P;
}

export const ORIENT = {
  H: { x: 0, y: 2, z: 1 },
  S: { x: 2, y: 1, z: 0 },
  F: { x: 0, y: 1, z: 2 },
};

export const r = v => Math.round(v * 10) / 10;
const TOL = 0.05;

export function toLocal(p, w) {
  const o = [p.ox, p.oy, p.oz], m = ORIENT[p.orient];
  return { x: w[m.x] - o[m.x], y: w[m.y] - o[m.y], z: w[m.z] - o[m.z] };
}
export function toWorld(p, l) {
  const v = [p.ox, p.oy, p.oz], m = ORIENT[p.orient];
  v[m.x] += l.x; v[m.y] += l.y; v[m.z] += l.z;
  return v;
}
export function worldSize(p) {
  const s = [0, 0, 0], m = ORIENT[p.orient];
  s[m.x] = p.L; s[m.y] = p.W; s[m.z] = p.T;
  return s;
}

function panel(id, name, orient, o, L, W, T, material, role, edges = {}, extra = {}) {
  return {
    id, name, orient, ox: o[0], oy: o[1], oz: o[2], L: r(L), W: r(W), T, material, role, qty: 1,
    edges: { L1: 0, L2: 0, W1: 0, W2: 0, ...edges }, holes: [],
    frontEdge: orient === 'S' ? 'W2' : orient === 'H' ? 'L2' : null,
    topEdge: orient === 'S' || orient === 'F' ? 'L2' : null,
    ...extra,
  };
}

function edgeOf(p, l) {
  if (Math.abs(l.x) < TOL) return 'W1';
  if (Math.abs(l.x - p.L) < TOL) return 'W2';
  if (Math.abs(l.y) < TOL) return 'L1';
  if (Math.abs(l.y - p.W) < TOL) return 'L2';
  return null;
}
const contactFace = (p, l) => (Math.abs(l.z) < TOL ? 'B' : 'A');

export function spots(len, end, step) {
  if (len < 2 * end + 20) return [r(len / 2)];
  const span = len - 2 * end, n = Math.max(1, Math.ceil(span / step)), a = [];
  for (let i = 0; i <= n; i++) a.push(r(end + (span * i) / n));
  return a;
}

function hingeCount(h) { return h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5; }

// Генерация корпусного изделия по параметрам
export function generate(P0, hw0 = HW) {
  const P = normalizeParams(P0);
  const num = k => Number(P[k]) || 0;
  const hw = { ...hw0, cupOffset: num('cupOffset') || hw0.cupOffset, cupDepth: num('cupDepth') || hw0.cupDepth, hingeEnd: num('hingeEnd') || hw0.hingeEnd };
  const RUN = RUNNERS[P.runner] || RUNNERS.roller;
  const SYS = JOINTS[P.joint] ? P.joint : 'conf';
  const t = num('t'), W = num('W'), H = num('H'), D = num('D');
  const warn = [], parts = [];
  const add = p => (parts.push(p), p);
  const C = P.matCorpus, eF = num('edgeFront'), eO = num('edgeOther'), eFac = num('edgeFacade');

  if (W < 2 * t + 50 || H < 100 || D < 100) {
    warn.push('Слишком маленькие габариты изделия.');
    return { parts, warn, dims: { W, H, D } };
  }

  const baseY = P.base === 'legs' ? num('legsH') : 0;
  const plinth = P.base === 'plinth' ? num('plinthH') : 0;
  const topOuter = baseY + H;
  const overlayTop = P.topType === 'overlay';
  const sideH = overlayTop ? H - t : H;
  const innerW = W - 2 * t;
  const bottomY = baseY + plinth;
  const innerY0 = bottomY + t;
  const innerY1 = overlayTop ? baseY + sideH : topOuter - t;
  const backT = num('backT');
  const groove = P.backType === 'groove', gOff = num('grooveOff'), gD = num('grooveDepth');
  const zB = groove ? r(gOff + backT + 1) : 0; // внутренние детали начинаются за пазом

  const conf = (face, edgeP, w) => {
    const le = toLocal(edgeP, w), edge = edgeOf(edgeP, le);
    if (!edge) return;
    edgeP.holes.push({ type: 'conf', edge, x: r(le.x), y: r(le.y), d: hw.confEdgeD, depth: hw.confEdgeDepth });
    const lf = toLocal(face, w);
    face.holes.push({ type: 'conf', face: contactFace(face, lf) === 'B' ? 'A' : 'B', x: r(lf.x), y: r(lf.y), d: hw.confFaceD, depth: face.T, through: true });
  };
  // Пласть, смотрящая внутрь изделия (туда прячем корпуса эксцентриков)
  const cen = [W / 2, (baseY + topOuter) / 2, D / 2];
  const innerFace = p => { const m = ORIENT[p.orient], o = [p.ox, p.oy, p.oz][m.z]; return cen[m.z] >= o + p.T / 2 ? 'A' : 'B'; };
  const camAt = (face, edgeP, w) => {
    const le = toLocal(edgeP, w), edge = edgeOf(edgeP, le);
    if (!edge) return;
    const cd = hw.camDist, c = { ...le };
    if (edge === 'W1') c.x += cd; if (edge === 'W2') c.x -= cd; if (edge === 'L1') c.y += cd; if (edge === 'L2') c.y -= cd;
    edgeP.holes.push({ type: 'stem', edge, x: r(le.x), y: r(le.y), d: hw.stemEdgeD, depth: cd });
    edgeP.holes.push({ type: 'cam', face: innerFace(edgeP), x: r(c.x), y: r(c.y), d: hw.camD, depth: edgeP.T <= 16 ? 12.5 : 13.5 });
    const lf = toLocal(face, w);
    face.holes.push({ type: 'stem', face: contactFace(face, lf), x: r(lf.x), y: r(lf.y), d: hw.stemFaceD, depth: hw.stemFaceDepth });
  };
  const dowelAt = (face, edgeP, w) => {
    const le = toLocal(edgeP, w), edge = edgeOf(edgeP, le);
    if (!edge) return;
    edgeP.holes.push({ type: 'dowel', edge, x: r(le.x), y: r(le.y), d: hw.dowelD, depth: hw.dowelEdgeDepth });
    const lf = toLocal(face, w);
    face.holes.push({ type: 'dowel', face: contactFace(face, lf), x: r(lf.x), y: r(lf.y), d: hw.dowelD, depth: Math.min(12, face.T - 4) });
  };
  // Соединение корпусных деталей выбранной системой; partner — точка для парного шканта у эксцентрика
  const joint = (face, edgeP, w, partner) => {
    if (SYS === 'minifix') { camAt(face, edgeP, w); if (partner) dowelAt(face, edgeP, partner); }
    else if (SYS === 'dowel') dowelAt(face, edgeP, w);
    else conf(face, edgeP, w);
  };
  const pair = (o, len) => (o <= len / 2 ? o + 32 : o - 32);
  const faceHole = (p, w, h) => {
    const l = toLocal(p, w);
    p.holes.push({ ...h, face: contactFace(p, l), x: r(l.x), y: r(l.y) });
  };

  // Боковины
  const sideEdges = { W2: eF, L2: overlayTop ? 0 : eO, L1: 0, W1: P.backType === 'overlay' ? 0 : eO };
  const sideL = add(panel('sideL', 'Боковина левая', 'S', [0, baseY, 0], D, sideH, t, C, 'corpus', sideEdges));
  const sideR = add(panel('sideR', 'Боковина правая', 'S', [W - t, baseY, 0], D, sideH, t, C, 'corpus', sideEdges));

  // Есть ли уже отверстие в проекции этой точки (любая пласть) — чтобы сверления не встречались внутри плиты
  const clash = (p, w, d) => {
    const l = toLocal(p, w);
    return p.holes.some(h => h.face && Math.hypot(h.x - l.x, h.y - l.y) < (h.d + d) / 2 + 3);
  };
  const SHIFTS = [0, 32, -32, 64, -64, 96, -96];
  // Горизонтальная деталь между двумя вертикальными (боковина/перегородка): {panel, X} слева и справа
  const joinBetween = (h, left, right) => {
    for (const side of [left, right]) {
      for (const o of spots(h.W, hw.confEnd, hw.confStep)) {
        const Y = h.oy + h.T / 2;
        let z = h.oz + o;
        const sh = SHIFTS.find(dz => { const zz = z + dz; return zz > h.oz + 20 && zz < h.oz + h.W - 20 && !clash(side.panel, [side.X, Y, zz], hw.confFaceD); });
        if (sh === undefined) warn.push(`${h.name}: крепёж пересекается с другим отверстием.`);
        z += sh || 0;
        joint(side.panel, h, [side.X, Y, z], [side.X, Y, h.oz + pair(z - h.oz, h.W)]);
      }
    }
  };
  const joinH = h => joinBetween(h, { panel: sideL, X: t }, { panel: sideR, X: W - t });

  // Крышка
  let top;
  if (overlayTop) {
    top = add(panel('top', 'Крышка', 'H', [0, baseY + sideH, 0], W, D, t, C, 'corpus', { L2: eF, W1: eF, W2: eF, L1: eO }));
    for (const o of spots(D, hw.confEnd, hw.confStep)) {
      joint(top, sideL, [t / 2, top.oy, o], [t / 2, top.oy, pair(o, D)]);
      joint(top, sideR, [W - t / 2, top.oy, o], [W - t / 2, top.oy, pair(o, D)]);
    }
  } else {
    top = add(panel('top', 'Крышка', 'H', [t, topOuter - t, 0], innerW, D, t, C, 'corpus', { L2: eF }));
    joinH(top);
  }

  // Дно
  const bottom = add(panel('bottom', 'Дно', 'H', [t, bottomY, 0], innerW, D, t, C, 'corpus', { L2: eF }));
  joinH(bottom);

  // Цоколь
  if (plinth > 0) {
    const pl = add(panel('plinth', 'Цоколь', 'F', [t, 0, D - num('plinthSetback') - t], innerW, plinth, t, C, 'corpus'));
    const offs = plinth <= 100 ? [plinth / 2] : spots(plinth, 30, 400);
    for (const o of offs) {
      joint(sideL, pl, [t, o, pl.oz + t / 2], null);
      joint(sideR, pl, [W - t, o, pl.oz + t / 2], null);
    }
    for (const o of spots(innerW, 80, 400)) joint(bottom, pl, [t + o, bottomY, pl.oz + t / 2], [t + pair(o, innerW), bottomY, pl.oz + t / 2]);
  }

  // Задняя стенка
  if (P.backType === 'overlay') {
    add(panel('back', 'Задняя стенка', 'F', [2, bottomY + 2, -backT], W - 4, topOuter - bottomY - 4, backT, P.matBack, 'back'));
  } else if (groove) {
    const gw = r(backT + 1);
    const gr = (p, axis, from, to) => (p.grooves = p.grooves || []).push({ face: innerFace(p), axis, pos: gOff, w: gw, depth: gD, from: r(from), to: r(to) });
    gr(sideL, 'y', 0, sideL.W); gr(sideR, 'y', 0, sideR.W);
    gr(bottom, 'x', 0, bottom.L);
    if (overlayTop) gr(top, 'x', t - gD + 1, W - t + gD - 1); else gr(top, 'x', 0, top.L);
    add(panel('back', 'Задняя стенка (в паз)', 'F', [t - gD + 1, innerY0 - gD + 1, gOff + 0.5], innerW + 2 * (gD - 1), innerY1 - innerY0 + 2 * (gD - 1), backT, P.matBack, 'back'));
  }

  // ---------- Секции, фасады, наполнение ----------
  const g = num('gap'), ge = num('gapEdge'), fT = num('frontT'), handle = num('handle');
  const fy0 = bottomY + ge, fy1 = topOuter - ge;
  const secs = P.sections.length ? P.sections : [sec([blk('open')])];
  const ns = secs.length;
  const avail = innerW - (ns - 1) * t;
  const fixedW = secs.reduce((a, s) => a + (Number(s.w) > 0 ? Number(s.w) : 0), 0);
  const autoN = secs.filter(s => !(Number(s.w) > 0)).length;
  const autoW = autoN ? (avail - fixedW) / autoN : 0;
  if (autoN && autoW < 100) warn.push(`Секции не помещаются: на авто-секции остаётся ${r(autoW)} мм.`);
  if (!autoN && Math.abs(fixedW - avail) > 0.5) warn.push(`Сумма ширин секций ${r(fixedW)} мм ≠ внутренней ширине ${r(avail)} мм — последняя секция подогнана.`);
  let drawerCount = 0, runnerLen = 0, hingesFull = 0, hingesHalf = 0;
  let x = t;
  const S = [];
  for (let i = 0; i < ns; i++) {
    const w = i === ns - 1 ? W - t - x : (Number(secs[i].w) > 0 ? Number(secs[i].w) : autoW);
    const se = { x0: x, x1: x + w, w, def: secs[i] };
    x += w;
    if (i < ns - 1) {
      const pt = add(panel(`part${i + 1}`, 'Перегородка вертикальная', 'S', [x, innerY0, zB], D - zB, innerY1 - innerY0, t, C, 'corpus', { W2: eF }));
      for (const o of spots(D - zB, hw.confEnd, hw.confStep)) {
        const z = zB + o, z2 = zB + pair(o, D - zB);
        joint(bottom, pt, [x + t / 2, innerY0, z], [x + t / 2, innerY0, z2]);
        joint(top, pt, [x + t / 2, innerY1, z], [x + t / 2, innerY1, z2]);
      }
      se.partR = pt;
      x += t;
    }
    S.push(se);
  }
  S.forEach((se, i) => {
    se.left = i === 0 ? { panel: sideL, X: t, half: false } : { panel: S[i - 1].partR, X: S[i - 1].partR.ox + t, half: true };
    se.right = i === ns - 1 ? { panel: sideR, X: W - t, half: false } : { panel: se.partR, X: se.partR.ox, half: true };
    se.fxL = i === 0 ? ge : S[i - 1].partR.ox + t / 2 + g / 2;
    se.fxR = i === ns - 1 ? W - ge : se.partR.ox + t / 2 - g / 2;
  });

  const pinHole = (side, w) => {
    const l = toLocal(side.panel, w);
    const ex = side.panel.holes.find(h => h.type === 'pin' && h.face && Math.hypot(h.x - l.x, h.y - l.y) < 1);
    if (ex) { ex.through = true; ex.depth = side.panel.T; return; }
    if (clash(side.panel, w, hw.pinD)) warn.push(`${side.panel.name}: полкодержатель на высоте ${r(w[1])} пересекается с другим отверстием.`);
    faceHole(side.panel, w, { type: 'pin', d: hw.pinD, depth: hw.pinDepth });
  };

  const shelvesIn = (se, b, y0, y1, pref) => {
    const n = Math.max(0, Number(b.shelves) || 0);
    let ys;
    const manual = String(b.pos || '').split(/[;, ]+/).map(Number).filter(v => v > 0);
    if (manual.length) ys = manual.map(v => y0 + v);
    else {
      const clear = (y1 - y0 - n * t) / (n + 1);
      if (n > 0 && clear < 80) warn.push('Полки стоят слишком часто (просвет < 80 мм).');
      ys = Array.from({ length: n }, (_, i) => y0 + clear * (i + 1) + t * i);
    }
    const sd = D - num('shelfRecess') - zB;
    ys.forEach((sy, i) => {
      sy = r(sy);
      if (sy < y0 + 20 || sy + t > y1 - 20) { warn.push(`Полка на высоте ${r(sy - y0)} мм выходит за пределы ниши (0…${r(y1 - y0 - t)}).`); return; }
      if (P.shelfType === 'fixed') {
        joinBetween(add(panel(`${pref}sh${i + 1}`, 'Полка', 'H', [se.x0, sy, zB], se.w, sd, t, C, 'corpus', { L2: eF })), se.left, se.right);
      } else {
        add(panel(`${pref}sh${i + 1}`, 'Полка', 'H', [se.x0 + 1, sy, zB], se.w - 2, sd, t, C, 'corpus', { L2: eF }));
        for (const side of [se.left, se.right]) for (const Z of [D - hw.pinFront, zB + hw.pinBack]) pinHole(side, [side.X, sy - hw.pinBelow, Z]);
      }
    });
  };

  const makeDrawer = (se, id, fy, fh, zoneBot) => {
    const fxw = se.fxR - se.fxL;
    const f = add(panel(`${id}f`, 'Фасад ящика', 'F', [se.fxL, fy, D], fxw, fh, fT, P.matFront, 'front', { L1: eFac, L2: eFac, W1: eFac, W2: eFac }));
    runnerLen = RUN.lens.find(l => l <= D - zB - 10) || 0;
    if (!runnerLen) { warn.push(`Глубина ${D} мм мала для направляющих (мин. 260).`); return; }
    const rg = RUN.gap, bt = t, x0 = se.x0 + rg, bw = se.w - 2 * rg;
    if (bw < 100) { warn.push('Секция слишком узкая для ящика.'); return; }
    let bh = Math.floor(fh - RUN.boxMinus);
    if (bh < 60) { warn.push(`Фасад ящика ${r(fh)} мм слишком низкий, высота короба принята 60 мм.`); bh = 60; }
    const by = Math.max(fy + 25, zoneBot + 5);
    const z0 = D - 2 - runnerLen;
    const sL = add(panel(`${id}sL`, 'Ящик: боковина левая', 'S', [x0, by, z0], runnerLen, bh, bt, C, 'box', { L2: eO }));
    const sR = add(panel(`${id}sR`, 'Ящик: боковина правая', 'S', [x0 + bw - bt, by, z0], runnerLen, bh, bt, C, 'box', { L2: eO }));
    const bk = add(panel(`${id}bk`, 'Ящик: задняя стенка', 'F', [x0 + bt, by, z0], bw - 2 * bt, bh, bt, C, 'box', { L2: eO }));
    const fr = add(panel(`${id}fr`, 'Ящик: передняя стенка', 'F', [x0 + bt, by, z0 + runnerLen - bt], bw - 2 * bt, bh, bt, C, 'box', { L2: eO }));
    add(panel(`${id}bt`, 'Ящик: дно', 'H', [x0, by - backT, z0], bw, runnerLen, backT, P.matBack, 'back'));
    const offs = bh >= 100 ? [hw.boxConfEnd, bh - hw.boxConfEnd] : [bh / 2];
    for (const o of offs) for (const bp of [bk, fr]) {
      conf(sL, bp, [x0 + bt, by + o, bp.oz + bt / 2]);
      conf(sR, bp, [x0 + bw - bt, by + o, bp.oz + bt / 2]);
    }
    if (handle > 0 && fxw > handle + 40) {
      for (const dx of [-handle / 2, handle / 2]) {
        const hx = f.L / 2 + dx, hy = fh / 2;
        f.holes.push({ type: 'handle', face: 'A', x: r(hx), y: r(hy), d: hw.handleD, depth: fT, through: true });
        const wpt = toWorld(f, { x: hx, y: hy, z: 0 });
        const lb = toLocal(fr, [wpt[0], wpt[1], fr.oz]);
        if (lb.x > 0 && lb.x < fr.L && lb.y > 0 && lb.y < fr.W)
          fr.holes.push({ type: 'handle', face: 'A', x: r(lb.x), y: r(lb.y), d: hw.handleD, depth: bt, through: true });
      }
    }
    drawerCount++;
  };

  const makeDoors = (se, b, id, dy0, dy1) => {
    const n = Math.min(2, Math.max(1, Number(b.n) || 1));
    const fxw = se.fxR - se.fxL;
    const dw = (fxw - (n - 1) * g) / n, dh = dy1 - dy0;
    if (dw > 600) warn.push(`Ширина двери ${r(dw)} мм — больше 600, лучше 2 двери.`);
    if (dh < 150) { warn.push('Слишком низкая зона для двери.'); return; }
    for (let k = 0; k < n; k++) {
      const hinge = n === 1 ? (b.hinge || 'left') : k === 0 ? 'left' : 'right';
      const side = hinge === 'left' ? se.left : se.right;
      const nm = n > 1 ? (k === 0 ? 'Дверь левая' : 'Дверь правая') : 'Дверь';
      const door = add(panel(`${id}d${k + 1}`, nm, 'F', [se.fxL + k * (dw + g), dy0, D], dw, dh, fT, P.matFront, 'front',
        { L1: eFac, L2: eFac, W1: eFac, W2: eFac }, { hinge, hingeType: side.half ? 'half' : 'full' }));
      const hc = hingeCount(dh), e = hw.hingeEnd;
      for (let q = 0; q < hc; q++) {
        let hy = e + ((dh - 2 * e) * q) / (hc - 1);
        const fits = yy => [-hw.plateSpacing / 2, hw.plateSpacing / 2].every(dd => !clash(side.panel, [side.X, door.oy + yy + dd, D - hw.plateFront], hw.plateD));
        const sh = SHIFTS.find(dz => hy + dz > 60 && hy + dz < dh - 60 && fits(hy + dz));
        if (sh === undefined) warn.push(`${nm}: планка петли пересекается с другими отверстиями на ${side.panel.name.toLowerCase()}.`);
        hy = r(hy + (sh || 0));
        door.holes.push({ type: 'cup', face: 'B', x: r(hinge === 'left' ? hw.cupOffset : dw - hw.cupOffset), y: hy, d: hw.cupD, depth: hw.cupDepth });
        const wy = door.oy + hy;
        if (wy < innerY0 || wy > innerY1) warn.push(`Петля на высоте ${r(wy)} мм вне внутреннего объёма.`);
        for (const dd of [-hw.plateSpacing / 2, hw.plateSpacing / 2])
          faceHole(side.panel, [side.X, wy + dd, D - hw.plateFront], { type: 'plate', d: hw.plateD, depth: hw.plateDepth });
        if (side.half) hingesHalf++; else hingesFull++;
      }
      if (handle > 0) {
        const hx = hinge === 'left' ? dw - 40 : 40;
        let yc = dh < 1000 ? dh - 60 - handle / 2 : 1000 - dy0;
        yc = Math.min(Math.max(yc, handle / 2 + 40), dh - handle / 2 - 40);
        for (const dd of [-handle / 2, handle / 2])
          door.holes.push({ type: 'handle', face: 'A', x: r(hx), y: r(yc + dd), d: hw.handleD, depth: fT, through: true });
      }
    }
  };

  const doorJobs = [];
  S.forEach((se, i) => {
    const B = (se.def.blocks && se.def.blocks.length) ? se.def.blocks : [blk('open')];
    const nb = B.length;
    const totalH = fy1 - fy0 - (nb - 1) * g;
    const fixedH = B.reduce((a, b) => a + (Number(b.h) > 0 ? Number(b.h) : 0), 0);
    const autoB = B.filter(b => !(Number(b.h) > 0)).length;
    const autoH = autoB ? (totalH - fixedH) / autoB : 0;
    if (autoB && autoH < 80) warn.push(`Секция ${i + 1}: блоки не помещаются по высоте (на авто-блок ${r(autoH)} мм).`);
    let ytop = fy1;
    const Z = B.map((b, j) => {
      const h = j === nb - 1 && !autoB ? ytop - fy0 : (Number(b.h) > 0 ? Number(b.h) : autoH);
      const z = { b, fyTop: ytop, fyBot: ytop - h, h };
      ytop = z.fyBot - g;
      return z;
    });
    se.zones = Z;
    if (!autoB && Math.abs(fixedH - totalH) > 0.5) warn.push(`Секция ${i + 1}: сумма высот блоков не равна высоте фасадов (${r(totalH)} мм) — нижний блок подогнан.`);
    // внутренние границы блоков (полки-перегородки)
    Z.forEach((z, j) => { z.top = j === 0 ? innerY1 : Z[j - 1].botBound; if (j === nb - 1) z.bot = innerY0; else {
      const nx = Z[j + 1], center = z.fyBot - g / 2;
      if (z.b.type === 'drawers' && nx.b.type === 'drawers') { z.bot = center; z.botBound = center; }
      else {
        const dv = add(panel(`s${i + 1}dv${j + 1}`, 'Полка-перегородка', 'H', [se.x0, r(center - t / 2), zB], se.w, D - zB, t, C, 'corpus', { L2: eF }));
        joinBetween(dv, se.left, se.right);
        z.bot = dv.oy + t; z.botBound = dv.oy;
      }
    } });
    Z.forEach((z, j) => {
      const id = `s${i + 1}b${j + 1}`;
      if (z.b.type === 'drawers') {
        const n = Math.max(1, Number(z.b.n) || 1), fh = (z.fyTop - z.fyBot - (n - 1) * g) / n;
        for (let k = 0; k < n; k++) makeDrawer(se, `${id}x${k + 1}`, z.fyTop - (k + 1) * fh - k * g, fh, k === n - 1 ? z.bot : 0);
      } else {
        if (z.b.type === 'doors') doorJobs.push(() => makeDoors(se, z.b, id, z.fyBot, z.fyTop));
        shelvesIn(se, z.b, z.bot, z.top, id);
      }
    });
  });
  doorJobs.forEach(f => f()); // двери после полок: планки петель обходят полкодержатели

  const legs = P.base === 'legs' ? (W > 1000 ? 6 : 4) : 0;
  return {
    parts, warn,
    dims: { W, H: topOuter, D: D + (P.backType === 'overlay' ? backT : 0) + (parts.some(p => p.role === 'front') ? fT : 0) },
    extra: { joint: SYS, runnerLabel: RUN.label, hingeLabel: (HINGES[P.hingeBrand] || {}).label || 'своя', secInfo: S.map(se => ({ w: r(se.w), blocks: (se.zones || []).map(z => r(z.h)) })), drawers: drawerCount, runnerLen, legs, legsH: baseY, handle, hingesFull, hingesHalf },
  };
}

export function holeSig(p) {
  return p.holes.map(h => [h.face || h.edge, h.x, h.y, h.d, h.depth, h.through ? 1 : 0].join(',')).sort().join('|');
}

// Собрать проект: все изделия + доп. детали, с учётом ручных правок
export function buildProject(proj) {
  const parts = [], warn = [], items = [], built_off = [];
  (proj.items || []).forEach((it, idx) => {
    const g = generate(it.params);
    const kept = [];
    g.parts.forEach(p => {
      const ov0 = it.overrides?.[p.id];
      if (ov0?.off) { p.item = it.params.name; p.uid = `${idx}:${p.id}`; p.itemIdx = idx; (built_off).push(p); return; }
      kept.push(p);
    });
    g.parts = kept;
    g.parts.forEach(p => {
      p.item = it.params.name || `Изделие ${idx + 1}`;
      p.itemIdx = idx;
      p.uid = `${idx}:${p.id}`;
      const ov = it.overrides?.[p.id];
      if (ov) {
        if (ov.edges) Object.assign(p.edges, ov.edges);
        if (ov.holes) p.holes.push(...ov.holes.map(h => ({ ...h, type: 'user' })));
        if (ov.name) p.name = ov.name;
        if (ov.L > 0 || ov.W > 0) {
          if (ov.L > 0) p.L = r(ov.L);
          if (ov.W > 0) p.W = r(ov.W);
          p.resized = true;
          const before = p.holes.length;
          p.holes = p.holes.filter(h => h.x >= -0.01 && h.y >= -0.01 && h.x <= p.L + 0.01 && h.y <= p.W + 0.01)
            .map(h => h.edge === 'W2' ? { ...h, x: p.L } : h.edge === 'L2' ? { ...h, y: p.W } : h);
          if (p.holes.length < before) warn.push(`${p.item}: «${p.name}» изменена вручную — ${before - p.holes.length} отв. вне детали убраны.`);
        }
      }
      parts.push(p);
    });
    g.warn.forEach(w => warn.push(`${it.params.name}: ${w}`));
    items.push(g);
  });
  (proj.custom || []).forEach(c => {
    parts.push({
      ...c, orient: null, uid: `c:${c.id}`, item: 'Доп. детали', itemIdx: -1, role: 'custom',
      edges: { L1: 0, L2: 0, W1: 0, W2: 0, ...c.edges }, holes: (c.holes || []).map(h => ({ ...h, type: 'user' })),
      qty: Number(c.qty) || 1,
    });
  });
  return { parts, warn, items, off: built_off, groups: groupParts(parts) };
}

export function groupParts(parts) {
  const map = new Map();
  for (const p of parts) {
    const key = [p.item, p.name, p.material, p.T, p.L, p.W, JSON.stringify(p.edges), holeSig(p), JSON.stringify(p.grooves || [])].join('§');
    if (!map.has(key)) map.set(key, { key, rep: p, parts: [], qty: 0 });
    const g = map.get(key);
    g.parts.push(p);
    g.qty += p.qty || 1;
  }
  const arr = [...map.values()];
  arr.forEach((g, i) => (g.no = i + 1));
  return arr;
}

const edgeCut = e => (e > 0.5 ? e : 0);
export function cutSize(p, S) {
  if (!S.subtractEdge) return { L: p.L, W: p.W };
  return {
    L: r(p.L - edgeCut(p.edges.W1) - edgeCut(p.edges.W2)),
    W: r(p.W - edgeCut(p.edges.L1) - edgeCut(p.edges.L2)),
  };
}

export const matKey = p => `${p.material} ${p.T} мм`;

// Итоги: площадь плиты, кромка, фурнитура
export function summary(built, proj) {
  const area = {}, edge = {};
  let conf = 0, pins = 0, cups = 0, handles = 0, backScrews = 0, cams = 0, dowels = 0;
  for (const g of built.groups) {
    const p = g.rep, q = g.qty, k = matKey(p);
    area[k] = (area[k] || 0) + (p.L * p.W * q) / 1e6;
    for (const [e, v] of Object.entries(p.edges)) if (v > 0) {
      const len = e[0] === 'L' ? p.L : p.W;
      edge[v] = (edge[v] || 0) + (len * q) / 1000;
    }
    for (const h of p.holes) {
      if (h.type === 'conf' && h.face) conf += q;
      if (h.type === 'cam') cams += q;
      if (h.type === 'dowel' && h.face) dowels += q;
      if (h.type === 'pin') pins += q;
      if (h.type === 'cup') cups += q;
      if (h.type === 'handle' && p.role === 'front') handles += q / 2;
    }
    if (p.role === 'back' && !/в паз/.test(p.name)) backScrews += Math.ceil((2 * (p.L + p.W)) / 150) * q;
  }
  const hw = [];
  if (conf) hw.push(['Конфирмат 7×50 (+ заглушки)', conf, 'шт']);
  if (cams) hw.push(['Эксцентрик (минификс) Ø15 + шток', cams, 'шт']);
  if (dowels) hw.push(['Шкант 8×30 (+ клей ПВА)', dowels, 'шт']);
  if (pins) hw.push(['Полкодержатель 5 мм', pins, 'шт']);
  const hf = built.items.reduce((a, g) => a + (g.extra?.hingesFull || 0), 0);
  const hh = built.items.reduce((a, g) => a + (g.extra?.hingesHalf || 0), 0);
  const hl = [...new Set(built.items.filter(g => g.extra?.hingesFull || g.extra?.hingesHalf).map(g => g.extra.hingeLabel))].join(', ');
  if (hf) hw.push([`Петля накладная 110° с ответной планкой — ${hl}`, hf, 'шт']);
  if (hh) hw.push([`Петля полунакладная 110° (двери на средней перегородке) — ${hl}`, hh, 'шт']);
  if (cups) hw.push(['Шуруп 3,5×16 для петель и планок', cups * 4, 'шт']);
  built.items.forEach((g, i) => {
    const name = proj.items[i].params.name;
    if (g.extra?.drawers) hw.push([`Направляющие ${g.extra.runnerLabel}, L=${g.extra.runnerLen} (${name})`, g.extra.drawers, 'пар']);
    if (g.extra?.legs) hw.push([`Ножки мебельные H=${g.extra.legsH} (${name})`, g.extra.legs, 'шт']);
  });
  if (handles) hw.push(['Ручка (межосевое по проекту) + винты М4', handles, 'шт']);
  if (backScrews) hw.push(['Саморез/гвоздь для ХДФ (задняя стенка, дно ящиков)', backScrews, 'шт']);
  for (const [v, m] of Object.entries(edge).sort((a, b) => b[0] - a[0]))
    hw.push([`Кромка ПВХ ${v} мм (с запасом 10%)`, Math.ceil(m * 1.1 * 10) / 10, 'м']);
  return { area, edge, hw };
}

// Гильотинный раскрой (пригоден для форматно-раскроечного станка)
export function nest(built, S) {
  const byMat = new Map();
  for (const g of built.groups) {
    const p = g.rep, k = matKey(p), cs = cutSize(p, S);
    if (!byMat.has(k)) byMat.set(k, []);
    for (let i = 0; i < g.qty; i++) byMat.get(k).push({ w: cs.L, h: cs.W, no: g.no, name: p.name });
  }
  const kerf = Number(S.kerf) || 0, BW = S.sheetL - 2 * S.trim + kerf, BH = S.sheetW - 2 * S.trim + kerf;
  const result = [];
  for (const [mat, list] of byMat) {
    list.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
    const sheets = [], unplaced = [];
    for (const it of list) {
      const w = it.w + kerf, h = it.h + kerf;
      let placed = false;
      for (const sh of sheets) { const pos = guillFind(sh, w, h, !S.grain); if (pos) { guillPlace(sh, pos, it); placed = true; break; } }
      if (!placed) {
        const sh = { free: [{ x: 0, y: 0, w: BW, h: BH }], used: [] };
        const pos = guillFind(sh, w, h, !S.grain);
        if (pos) { guillPlace(sh, pos, it); sheets.push(sh); } else unplaced.push(it);
      }
    }
    const sheetArea = S.sheetL * S.sheetW;
    sheets.forEach(sh => { sh.usedArea = sh.used.reduce((s, u) => s + u.w * u.h, 0); sh.util = sh.usedArea / sheetArea; });
    result.push({ mat, sheets, unplaced, total: list.length });
  }
  return result;
}
function guillFind(sh, w, h, rot) {
  let best = null;
  sh.free.forEach((f, i) => {
    const tryFit = (ww, hh, rotated) => {
      if (ww <= f.w + 1e-6 && hh <= f.h + 1e-6) {
        const ss = Math.min(f.w - ww, f.h - hh);
        if (!best || ss < best.ss) best = { i, x: f.x, y: f.y, w: ww, h: hh, ss, rotated };
      }
    };
    tryFit(w, h, false);
    if (rot && w !== h) tryFit(h, w, true);
  });
  return best;
}
function guillPlace(sh, pos, it) {
  const f = sh.free.splice(pos.i, 1)[0];
  const wR = f.w - pos.w, hB = f.h - pos.h;
  let a, b;
  if (wR < hB) { a = { x: f.x + pos.w, y: f.y, w: wR, h: pos.h }; b = { x: f.x, y: f.y + pos.h, w: f.w, h: hB }; }
  else { a = { x: f.x + pos.w, y: f.y, w: wR, h: f.h }; b = { x: f.x, y: f.y + pos.h, w: pos.w, h: hB }; }
  for (const n of [a, b]) if (n.w > 1 && n.h > 1) sh.free.push(n);
  sh.used.push({ x: pos.x, y: pos.y, w: pos.rotated ? it.h : it.w, h: pos.rotated ? it.w : it.h, rotated: pos.rotated, no: it.no, name: it.name, L: it.w, W: it.h });
}

// DXF (R12): детали в ряд, контур + отверстия по слоям
export function toDXF(groups) {
  const out = ['0', 'SECTION', '2', 'ENTITIES'];
  const line = (l, x1, y1, x2, y2) => out.push('0', 'LINE', '8', l, '10', x1, '20', y1, '30', 0, '11', x2, '21', y2, '31', 0);
  const circle = (l, x, y, rad) => out.push('0', 'CIRCLE', '8', l, '10', x, '20', y, '30', 0, '40', rad);
  const text = (l, x, y, hgt, s) => out.push('0', 'TEXT', '8', l, '10', x, '20', y, '30', 0, '40', hgt, '1', s);
  let ox = 0;
  for (const g of groups) {
    const p = g.rep;
    line('CONTOUR', ox, 0, ox + p.L, 0); line('CONTOUR', ox + p.L, 0, ox + p.L, p.W);
    line('CONTOUR', ox + p.L, p.W, ox, p.W); line('CONTOUR', ox, p.W, ox, 0);
    text('TEXT', ox, -40, 20, `N${g.no} ${p.L}x${p.W}x${p.T} qty ${g.qty}`);
    for (const gq of p.grooves || []) {
      const l = `GROOVE_${gq.face}_${gq.w}x${gq.depth}`;
      if (gq.axis === 'y') { line(l, ox + gq.pos, gq.from, ox + gq.pos, gq.to); line(l, ox + gq.pos + gq.w, gq.from, ox + gq.pos + gq.w, gq.to); }
      else { line(l, ox + gq.from, gq.pos, ox + gq.to, gq.pos); line(l, ox + gq.from, gq.pos + gq.w, ox + gq.to, gq.pos + gq.w); }
    }
    for (const h of p.holes) {
      if (h.face) circle(`${h.face}_D${h.d}_${h.through ? 'THRU' : 'H' + h.depth}`, ox + h.x, h.y, h.d / 2);
      else {
        const l = `EDGE_${h.edge}_D${h.d}_H${h.depth}`;
        const dir = { W1: [1, 0], W2: [-1, 0], L1: [0, 1], L2: [0, -1] }[h.edge];
        line(l, ox + h.x, h.y, ox + h.x + dir[0] * h.depth, h.y + dir[1] * h.depth);
      }
    }
    ox += p.L + 100;
  }
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n');
}
