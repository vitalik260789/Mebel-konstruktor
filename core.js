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
  handleD: 5, boxConfEnd: 30,
};

export const HOLE_TYPES = {
  conf: 'Конфирмат', pin: 'Полкодержатель', cup: 'Петля (чашка)', plate: 'Планка петли',
  handle: 'Ручка', user: 'Доп. отверстие',
};

export const EDGE_NAMES = { L1: 'Д1', L2: 'Д2', W1: 'Ш1', W2: 'Ш2' };

const BASE = {
  type: 'cabinet', t: 16, matCorpus: 'ЛДСП Белый', frontT: 16, matFront: 'ЛДСП Дуб Сонома',
  backType: 'overlay', backT: 3, matBack: 'ХДФ Белый', topType: 'overlay', base: 'plinth',
  plinthH: 60, plinthSetback: 40, legsH: 100, layout: 'doors', doors: 1, hingeSide: 'left',
  drawers: 1, drawerFrontH: 150, shelves: 1, shelfType: 'pins', shelfRecess: 10, gap: 3, gapEdge: 1.5,
  handle: 96, edgeFront: 2, edgeOther: 0.4, edgeFacade: 2, runnerGap: 13,
};

export const TEMPLATES = {
  nightstand: { label: 'Тумба прикроватная', params: { ...BASE, name: 'Тумба прикроватная', W: 450, H: 550, D: 400, layout: 'drawers+doors', drawers: 1, drawerFrontH: 150, doors: 1, shelves: 1 } },
  dresser: { label: 'Комод с ящиками', params: { ...BASE, name: 'Комод', W: 800, H: 850, D: 450, layout: 'drawers', drawers: 4, shelves: 0, handle: 128 } },
  wardrobe: { label: 'Шкаф 2-дверный', params: { ...BASE, name: 'Шкаф', W: 800, H: 2000, D: 550, plinthH: 80, layout: 'doors', doors: 2, shelves: 4, handle: 128 } },
  shelving: { label: 'Стеллаж открытый', params: { ...BASE, name: 'Стеллаж', W: 800, H: 1800, D: 300, layout: 'none', shelves: 4, shelfType: 'fixed', shelfRecess: 0, handle: 0 } },
  base: { label: 'Тумба с дверцами', params: { ...BASE, name: 'Тумба', W: 600, H: 720, D: 500, layout: 'doors', doors: 2, shelves: 1, base: 'legs', legsH: 100 } },
};

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
export function generate(P0, hw = HW) {
  const P = { ...BASE, ...P0 };
  const num = k => Number(P[k]) || 0;
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

  const conf = (face, edgeP, w) => {
    const le = toLocal(edgeP, w), edge = edgeOf(edgeP, le);
    if (!edge) return;
    edgeP.holes.push({ type: 'conf', edge, x: r(le.x), y: r(le.y), d: hw.confEdgeD, depth: hw.confEdgeDepth });
    const lf = toLocal(face, w);
    face.holes.push({ type: 'conf', face: contactFace(face, lf) === 'B' ? 'A' : 'B', x: r(lf.x), y: r(lf.y), d: hw.confFaceD, depth: face.T, through: true });
  };
  const faceHole = (p, w, h) => {
    const l = toLocal(p, w);
    p.holes.push({ ...h, face: contactFace(p, l), x: r(l.x), y: r(l.y) });
  };

  // Боковины
  const sideEdges = { W2: eF, L2: overlayTop ? 0 : eO, L1: 0, W1: P.backType === 'none' ? eO : 0 };
  const sideL = add(panel('sideL', 'Боковина левая', 'S', [0, baseY, 0], D, sideH, t, C, 'corpus', sideEdges));
  const sideR = add(panel('sideR', 'Боковина правая', 'S', [W - t, baseY, 0], D, sideH, t, C, 'corpus', sideEdges));

  const joinH = h => {
    for (const o of spots(h.W, hw.confEnd, hw.confStep)) {
      const Y = h.oy + h.T / 2, Z = h.oz + o;
      conf(sideL, h, [t, Y, Z]);
      conf(sideR, h, [W - t, Y, Z]);
    }
  };

  // Крышка
  if (overlayTop) {
    const top = add(panel('top', 'Крышка', 'H', [0, baseY + sideH, 0], W, D, t, C, 'corpus', { L2: eF, W1: eF, W2: eF, L1: eO }));
    for (const o of spots(D, hw.confEnd, hw.confStep)) {
      conf(top, sideL, [t / 2, top.oy, o]);
      conf(top, sideR, [W - t / 2, top.oy, o]);
    }
  } else {
    joinH(add(panel('top', 'Крышка', 'H', [t, topOuter - t, 0], innerW, D, t, C, 'corpus', { L2: eF })));
  }

  // Дно
  joinH(add(panel('bottom', 'Дно', 'H', [t, bottomY, 0], innerW, D, t, C, 'corpus', { L2: eF })));

  // Цоколь
  if (plinth > 0) {
    const pl = add(panel('plinth', 'Цоколь', 'F', [t, 0, D - num('plinthSetback') - t], innerW, plinth, t, C, 'corpus'));
    const offs = plinth <= 100 ? [plinth / 2] : spots(plinth, 30, 400);
    for (const o of offs) {
      conf(sideL, pl, [t, o, pl.oz + t / 2]);
      conf(sideR, pl, [W - t, o, pl.oz + t / 2]);
    }
    for (const o of spots(innerW, 80, 400)) conf(parts.find(p => p.id === 'bottom'), pl, [t + o, bottomY, pl.oz + t / 2]);
  }

  // Задняя стенка
  if (P.backType === 'overlay') {
    add(panel('back', 'Задняя стенка', 'F', [2, bottomY + 2, -backT], W - 4, topOuter - bottomY - 4, backT, P.matBack, 'back'));
  }

  // Фасады
  const g = num('gap'), ge = num('gapEdge'), fT = num('frontT');
  const fx0 = ge, fx1 = W - ge, fy0 = bottomY + ge, fy1 = topOuter - ge;
  const handle = num('handle');
  let shelfTop = innerY1;
  let drawerCount = 0, runnerLen = 0;

  const makeDrawer = (i, fy, fh) => {
    const f = add(panel(`dfront${i + 1}`, 'Фасад ящика', 'F', [fx0, fy, D], fx1 - fx0, fh, fT, P.matFront, 'front',
      { L1: eFac, L2: eFac, W1: eFac, W2: eFac }));
    const lens = [650, 600, 550, 500, 450, 400, 350, 300, 250];
    runnerLen = lens.find(l => l <= D - 10) || 0;
    if (!runnerLen) { warn.push(`Глубина ${D} мм мала для направляющих (мин. 260).`); return; }
    const rg = num('runnerGap'), bt = t, x0 = t + rg, bw = innerW - 2 * rg;
    let bh = Math.floor(fh - 50);
    if (bh < 60) { warn.push(`Ящик ${i + 1}: фасад ${r(fh)} мм слишком низкий, высота короба принята 60 мм.`); bh = 60; }
    const by = Math.max(fy + 25, innerY0 + 5);
    const z0 = D - 2 - runnerLen;
    const sL = add(panel(`d${i + 1}sL`, 'Ящик: боковина левая', 'S', [x0, by, z0], runnerLen, bh, bt, C, 'box', { L2: eO }));
    const sR = add(panel(`d${i + 1}sR`, 'Ящик: боковина правая', 'S', [x0 + bw - bt, by, z0], runnerLen, bh, bt, C, 'box', { L2: eO }));
    const bk = add(panel(`d${i + 1}back`, 'Ящик: задняя стенка', 'F', [x0 + bt, by, z0], bw - 2 * bt, bh, bt, C, 'box', { L2: eO }));
    const fr = add(panel(`d${i + 1}front`, 'Ящик: передняя стенка', 'F', [x0 + bt, by, z0 + runnerLen - bt], bw - 2 * bt, bh, bt, C, 'box', { L2: eO }));
    add(panel(`d${i + 1}bot`, 'Ящик: дно', 'H', [x0, by - backT, z0], bw, runnerLen, backT, P.matBack, 'back'));
    const offs = bh >= 100 ? [hw.boxConfEnd, bh - hw.boxConfEnd] : [bh / 2];
    for (const o of offs) for (const bp of [bk, fr]) {
      conf(sL, bp, [x0 + bt, by + o, bp.oz + bt / 2]);
      conf(sR, bp, [x0 + bw - bt, by + o, bp.oz + bt / 2]);
    }
    if (handle > 0) {
      for (const dx of [-handle / 2, handle / 2]) {
        const hx = f.L / 2 + dx, hy = fh / 2;
        f.holes.push({ type: 'handle', face: 'A', x: r(hx), y: r(hy), d: hw.handleD, depth: fT, through: true });
        const w = toWorld(f, { x: hx, y: hy, z: 0 });
        const lb = toLocal(fr, [w[0], w[1], fr.oz]);
        if (lb.x > 0 && lb.x < fr.L && lb.y > 0 && lb.y < fr.W)
          fr.holes.push({ type: 'handle', face: 'A', x: r(lb.x), y: r(lb.y), d: hw.handleD, depth: bt, through: true });
      }
    }
    drawerCount++;
  };

  let doorTop = fy1;
  if (P.layout === 'drawers') {
    const n = Math.max(1, num('drawers'));
    const fh = (fy1 - fy0 - (n - 1) * g) / n;
    for (let i = 0; i < n; i++) makeDrawer(i, fy1 - (i + 1) * fh - i * g, fh);
  } else if (P.layout === 'drawers+doors') {
    const n = Math.max(1, num('drawers')), fh = num('drawerFrontH');
    let lastY = fy1;
    for (let i = 0; i < n; i++) { lastY = fy1 - (i + 1) * fh - i * g; makeDrawer(i, lastY, fh); }
    doorTop = lastY - g;
    const div = add(panel('divider', 'Перегородка', 'H', [t, lastY - g / 2 - t / 2, 0], innerW, D, t, C, 'corpus', { L2: eF }));
    joinH(div);
    shelfTop = div.oy;
    if (doorTop - fy0 < 150) warn.push('Под ящиками слишком мало места для двери.');
  }

  if (P.layout === 'doors' || P.layout === 'drawers+doors') {
    const n = Math.min(2, Math.max(1, num('doors')));
    const dw = (fx1 - fx0 - (n - 1) * g) / n, dh = doorTop - fy0;
    if (dw > 600) warn.push(`Ширина двери ${r(dw)} мм — больше 600, лучше сделать 2 двери.`);
    for (let i = 0; i < n; i++) {
      const hinge = n === 1 ? P.hingeSide : i === 0 ? 'left' : 'right';
      const door = add(panel(`door${i + 1}`, n > 1 ? `Дверь ${i === 0 ? 'левая' : 'правая'}` : 'Дверь', 'F',
        [fx0 + i * (dw + g), fy0, D], dw, dh, fT, P.matFront, 'front', { L1: eFac, L2: eFac, W1: eFac, W2: eFac }, { hinge }));
      const hc = hingeCount(dh), e = hw.hingeEnd;
      const side = hinge === 'left' ? sideL : sideR, X = hinge === 'left' ? t : W - t;
      for (let k = 0; k < hc; k++) {
        const hy = r(e + ((dh - 2 * e) * k) / (hc - 1));
        door.holes.push({ type: 'cup', face: 'B', x: r(hinge === 'left' ? hw.cupOffset : dw - hw.cupOffset), y: hy, d: hw.cupD, depth: hw.cupDepth });
        const wy = door.oy + hy;
        if (wy < innerY0 || wy > innerY1) warn.push(`Петля на высоте ${r(wy)} мм попадает вне внутреннего объёма.`);
        for (const dy of [-hw.plateSpacing / 2, hw.plateSpacing / 2])
          faceHole(side, [X, wy + dy, D - hw.plateFront], { type: 'plate', d: hw.plateD, depth: hw.plateDepth });
      }
      if (handle > 0) {
        const hx = hinge === 'left' ? dw - 40 : 40;
        let yc = dh < 1000 ? dh - 60 - handle / 2 : 1000 - fy0;
        yc = Math.min(Math.max(yc, handle / 2 + 40), dh - handle / 2 - 40);
        for (const dy of [-handle / 2, handle / 2])
          door.holes.push({ type: 'handle', face: 'A', x: r(hx), y: r(yc + dy), d: hw.handleD, depth: fT, through: true });
      }
    }
  }

  // Полки
  if (P.layout !== 'drawers') {
    const n = Math.max(0, num('shelves'));
    const y0 = innerY0, y1 = shelfTop;
    const clear = (y1 - y0 - n * t) / (n + 1);
    if (n > 0 && clear < 80) warn.push('Полки стоят слишком часто (просвет < 80 мм).');
    const sd = D - num('shelfRecess');
    for (let i = 0; i < n; i++) {
      const sy = r(y0 + clear * (i + 1) + t * i);
      if (P.shelfType === 'fixed') {
        joinH(add(panel(`shelf${i + 1}`, 'Полка', 'H', [t, sy, 0], innerW, sd, t, C, 'corpus', { L2: eF })));
      } else {
        add(panel(`shelf${i + 1}`, 'Полка', 'H', [t + 1, sy, 0], innerW - 2, sd, t, C, 'corpus', { L2: eF }));
        for (const X of [t, W - t]) for (const Z of [D - hw.pinFront, hw.pinBack])
          faceHole(X === t ? sideL : sideR, [X, sy - hw.pinBelow, Z], { type: 'pin', d: hw.pinD, depth: hw.pinDepth });
      }
    }
  }

  const legs = P.base === 'legs' ? (W > 1000 ? 6 : 4) : 0;
  return {
    parts, warn,
    dims: { W, H: topOuter, D: D + (P.backType === 'overlay' ? backT : 0) + (P.layout === 'none' ? 0 : fT) },
    extra: { drawers: drawerCount, runnerLen, legs, legsH: baseY, handle },
  };
}

export function holeSig(p) {
  return p.holes.map(h => [h.face || h.edge, h.x, h.y, h.d, h.depth, h.through ? 1 : 0].join(',')).sort().join('|');
}

// Собрать проект: все изделия + доп. детали, с учётом ручных правок
export function buildProject(proj) {
  const parts = [], warn = [], items = [];
  (proj.items || []).forEach((it, idx) => {
    const g = generate(it.params);
    g.parts.forEach(p => {
      p.item = it.params.name || `Изделие ${idx + 1}`;
      p.itemIdx = idx;
      p.uid = `${idx}:${p.id}`;
      const ov = it.overrides?.[p.id];
      if (ov) {
        if (ov.edges) Object.assign(p.edges, ov.edges);
        if (ov.holes) p.holes.push(...ov.holes.map(h => ({ ...h, type: 'user' })));
        if (ov.name) p.name = ov.name;
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
  return { parts, warn, items, groups: groupParts(parts) };
}

export function groupParts(parts) {
  const map = new Map();
  for (const p of parts) {
    const key = [p.item, p.name, p.material, p.T, p.L, p.W, JSON.stringify(p.edges), holeSig(p)].join('§');
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
  let conf = 0, pins = 0, cups = 0, handles = 0, backScrews = 0;
  for (const g of built.groups) {
    const p = g.rep, q = g.qty, k = matKey(p);
    area[k] = (area[k] || 0) + (p.L * p.W * q) / 1e6;
    for (const [e, v] of Object.entries(p.edges)) if (v > 0) {
      const len = e[0] === 'L' ? p.L : p.W;
      edge[v] = (edge[v] || 0) + (len * q) / 1000;
    }
    for (const h of p.holes) {
      if (h.type === 'conf' && h.face) conf += q;
      if (h.type === 'pin') pins += q;
      if (h.type === 'cup') cups += q;
      if (h.type === 'handle' && p.role === 'front') handles += q / 2;
    }
    if (p.role === 'back') backScrews += Math.ceil((2 * (p.L + p.W)) / 150) * q;
  }
  const hw = [];
  if (conf) hw.push(['Конфирмат 7×50 (+ заглушки)', conf, 'шт']);
  if (pins) hw.push(['Полкодержатель 5 мм', pins, 'шт']);
  if (cups) hw.push(['Петля накладная 110° с ответной планкой', cups, 'шт']);
  if (cups) hw.push(['Шуруп 3,5×16 для петель и планок', cups * 4, 'шт']);
  built.items.forEach((g, i) => {
    const name = proj.items[i].params.name;
    if (g.extra?.drawers) hw.push([`Направляющие роликовые L=${g.extra.runnerLen} (${name})`, g.extra.drawers, 'пар']);
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
