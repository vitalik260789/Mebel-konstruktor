import * as C from './core.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
const LS = 'mebel-project-v1';
const EDGE_STEPS = [0, 0.4, 1, 2];

let project, built;
const sel = { item: 0, uid: null, tab: '3d' };

// ---------- Проект ----------
const mkItem = tpl => ({ params: structuredClone(C.TEMPLATES[tpl].params), overrides: {} });
const newProject = () => ({ name: 'Мой проект', items: [mkItem('nightstand')], custom: [], settings: { ...C.DEFAULT_SETTINGS } });
function normalize(p) {
  p.items = p.items || []; p.custom = p.custom || [];
  p.settings = { ...C.DEFAULT_SETTINGS, ...(p.settings || {}) };
  p.items.forEach(it => (it.overrides = it.overrides || {}));
  return p;
}
function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(project)); } catch (e) { /* хранилище недоступно */ } }
function loadLocal() { try { const s = localStorage.getItem(LS); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

async function encodeProject(p) {
  const stream = new Blob([new TextEncoder().encode(JSON.stringify(p))]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let s = ''; for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function decodeProject(code) {
  const b = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(b, c => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(stream).text());
}

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => (t.hidden = true), 2600);
}
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; }
$('#modalClose').onclick = () => ($('#modal').hidden = true);

function download(name, data, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const fileBase = () => (project.name || 'proekt').replace(/[\\/:*?"<>|]+/g, '_');

// ---------- Пересчёт ----------
function update({ form = false } = {}) {
  built = C.buildProject(project);
  if (sel.item >= project.items.length) sel.item = Math.max(0, project.items.length - 1);
  renderItems();
  if (form) renderForm();
  renderWarn();
  renderTab();
  saveLocal();
}

function renderWarn() {
  const w = $('#warn');
  w.hidden = !built.warn.length;
  w.innerHTML = built.warn.map(x => '⚠ ' + esc(x)).join('<br>');
}

// ---------- Изделия ----------
function renderItems() {
  $('#items').innerHTML = project.items.map((it, i) => {
    const p = it.params, d = built.items[i]?.dims || {};
    return `<div class="item ${i === sel.item ? 'on' : ''}" data-i="${i}">
      <span class="nm">${esc(p.name)}</span><span class="sz">${d.W}×${d.H}×${d.D}</span>
      <button data-dup="${i}" title="Дублировать">⧉</button><button data-del="${i}" title="Удалить">✕</button></div>`;
  }).join('') || '<p class="muted">Нет изделий — добавь из шаблона ниже.</p>';
  $('#itemTitle').textContent = project.items[sel.item] ? '— ' + project.items[sel.item].params.name : '';
}
$('#items').addEventListener('click', e => {
  const del = e.target.dataset.del, dup = e.target.dataset.dup;
  if (del !== undefined) {
    if (!confirm(`Удалить «${project.items[del].params.name}»?`)) return;
    project.items.splice(+del, 1); sel.item = Math.min(sel.item, project.items.length - 1); sel.uid = null;
    update({ form: true }); return;
  }
  if (dup !== undefined) {
    const c = structuredClone(project.items[dup]); c.params.name += ' (копия)';
    project.items.splice(+dup + 1, 0, c); sel.item = +dup + 1; update({ form: true }); return;
  }
  const row = e.target.closest('.item');
  if (row) { sel.item = +row.dataset.i; sel.uid = null; update({ form: true }); }
});
$('#tplSelect').innerHTML = Object.entries(C.TEMPLATES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');
$('#btnAddItem').onclick = () => {
  project.items.push(mkItem($('#tplSelect').value));
  sel.item = project.items.length - 1; sel.uid = null; update({ form: true });
};

// ---------- Форма параметров ----------
const EDGE_OPT = [[0, 'нет'], [0.4, '0.4 мм'], [1, '1 мм'], [2, '2 мм']];
const hasDoors = p => p.layout === 'doors' || p.layout === 'drawers+doors';
const hasDrawers = p => p.layout === 'drawers' || p.layout === 'drawers+doors';
const FIELDS = [
  ['Габариты', [
    ['name', 'Название', 'text'],
    ['W', 'Ширина', 'num'], ['H', 'Высота корпуса (без ножек)', 'num'], ['D', 'Глубина корпуса (без фасада)', 'num'],
  ]],
  ['Материалы', [
    ['matCorpus', 'Корпус', 'mat', 'plate'], ['t', 'Толщина корпуса', 'thk', 'plate'],
    ['matFront', 'Фасады', 'mat', 'plate', p => p.layout !== 'none'], ['frontT', 'Толщина фасадов', 'thk', 'plate', p => p.layout !== 'none'],
    ['matBack', 'Задняя стенка, дно ящиков', 'mat', 'thin'], ['backT', 'Толщина задней стенки', 'thk', 'thin'],
  ]],
  ['Конструкция', [
    ['topType', 'Крышка', 'sel', [['overlay', 'Накладная'], ['inset', 'Вкладная']]],
    ['base', 'Основание', 'sel', [['plinth', 'Цоколь'], ['legs', 'Ножки']]],
    ['plinthH', 'Высота цоколя', 'num', p => p.base === 'plinth'],
    ['plinthSetback', 'Цоколь утоплен на', 'num', p => p.base === 'plinth'],
    ['legsH', 'Высота ножек', 'num', p => p.base === 'legs'],
    ['backType', 'Задняя стенка', 'sel', [['overlay', 'ХДФ накладная'], ['none', 'Нет']]],
  ]],
  ['Фасады', [
    ['layout', 'Компоновка', 'sel', [['doors', 'Двери'], ['drawers', 'Ящики'], ['drawers+doors', 'Ящики + двери'], ['none', 'Открытый']]],
    ['doors', 'Количество дверей', 'sel', [[1, '1'], [2, '2']], hasDoors],
    ['hingeSide', 'Петли (1 дверь)', 'sel', [['left', 'Слева'], ['right', 'Справа']], p => hasDoors(p) && +p.doors === 1],
    ['drawers', 'Количество ящиков', 'num', hasDrawers],
    ['drawerFrontH', 'Высота фасада ящика', 'num', p => p.layout === 'drawers+doors'],
    ['gap', 'Зазор между фасадами', 'num', p => p.layout !== 'none'],
    ['gapEdge', 'Зазор по краю', 'num', p => p.layout !== 'none'],
    ['handle', 'Ручка, межосевое', 'sel', [[0, 'Без ручек'], [64, '64'], [96, '96'], [128, '128'], [160, '160'], [192, '192'], [256, '256']], p => p.layout !== 'none'],
    ['runnerGap', 'Зазор под направляющую', 'num', hasDrawers],
  ]],
  ['Полки', [
    ['shelves', 'Количество полок', 'num', p => p.layout !== 'drawers'],
    ['shelfType', 'Крепление полок', 'sel', [['pins', 'Полкодержатели'], ['fixed', 'Конфирматы']], p => p.layout !== 'drawers'],
    ['shelfRecess', 'Полка утоплена на', 'num', p => p.layout !== 'drawers'],
  ]],
  ['Кромка', [
    ['edgeFront', 'Видимые торцы корпуса', 'sel', EDGE_OPT],
    ['edgeOther', 'Прочие торцы', 'sel', EDGE_OPT],
    ['edgeFacade', 'Фасады', 'sel', EDGE_OPT],
  ]],
];

function renderForm() {
  const it = project.items[sel.item];
  if (!it) { $('#form').innerHTML = ''; return; }
  const p = it.params;
  $('#form').innerHTML = FIELDS.map(([g, fs]) => {
    const rows = fs.filter(f => typeof f[3] === 'function' ? f[3](p) : !f[4] || f[4](p)).map(([k, label, type, opt]) => {
      const id = 'f_' + k;
      let ctl;
      if (type === 'mat') ctl = matSelect(id, k, p[k], opt);
      else if (type === 'thk') {
        const list = [...new Set([...C.THICKNESSES[opt], Number(p[k])])].sort((a, b) => a - b);
        ctl = `<select id="${id}" data-k="${k}">${list.map(v => `<option value="${v}" ${Number(p[k]) === v ? 'selected' : ''}>${v} мм</option>`).join('')}</select>`;
      } else if (type === 'sel') ctl = `<select id="${id}" data-k="${k}">${opt.map(([v, l]) => `<option value="${v}" ${String(p[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      else ctl = `<input id="${id}" data-k="${k}" ${type === 'num' ? 'type="number" step="any"' : ''} value="${esc(p[k])}">`;
      return `<div class="fr"><label for="${id}">${label}</label>${ctl}</div>`;
    }).join('');
    return rows ? `<fieldset><legend>${g}</legend>${rows}</fieldset>` : '';
  }).join('');
}
// ---------- Материалы ----------
const allMaterials = () => [...C.MATERIALS, ...(project.materials || []).map(m => ({ ...m, group: 'Мои материалы' }))];
function matSelect(id, k, val, kind) {
  const list = allMaterials().filter(m => !kind || m.kind === kind || m.group === 'Мои материалы');
  if (val && !allMaterials().some(m => m.name === val)) list.push({ name: val, group: 'Мои материалы' });
  const groups = [...new Set(list.map(m => m.group))];
  return `<select id="${id}" ${k ? `data-k="${k}"` : ''} data-kind="${kind || ''}">${groups.map(g => `<optgroup label="${esc(g)}">${list.filter(m => m.group === g).map(m => `<option ${m.name === val ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</optgroup>`).join('')}<option value="__new">+ Свой материал…</option></select>`;
}
function askNewMaterial(kind) {
  const name = (prompt('Название материала (например: ЛДСП Egger Дуб Гладстон):') || '').trim();
  if (!name) return null;
  project.materials = project.materials || [];
  if (!allMaterials().some(m => m.name === name)) project.materials.push({ name, kind: kind || 'plate', color: '#d9cfc2' });
  return name;
}
function matColor(name, role) {
  const m = allMaterials().find(x => x.name === name);
  return m ? m.color : { corpus: '#efe9df', front: '#c8a27a', back: '#d9d4cc', box: '#e6dccb', custom: '#e6dccb' }[role] || '#eeeeee';
}

let formTimer;
$('#form').addEventListener('input', e => {
  const k = e.target.dataset.k; if (!k) return;
  const it = project.items[sel.item], el = e.target;
  if (el.value === '__new') {
    const name = askNewMaterial(el.dataset.kind);
    if (name) it.params[k] = name;
    update({ form: true }); return;
  }
  const v = el.type === 'number' ? Number(el.value) : el.tagName === 'SELECT' && /^-?[\d.]+$/.test(el.value) ? Number(el.value) : el.value;
  if (el.type === 'number' && (el.value === '' || isNaN(v))) return;
  it.params[k] = v;
  clearTimeout(formTimer);
  if (el.tagName === 'SELECT') update({ form: true });
  else formTimer = setTimeout(() => update(), 250);
});

// ---------- Вкладки ----------
$('#tabs').addEventListener('click', e => {
  const t = e.target.dataset.tab; if (!t) return;
  setTab(t);
});
function setTab(t) {
  sel.tab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('.tab').forEach(s => (s.hidden = s.id !== 'tab-' + t));
  renderTab();
}
function renderTab() {
  ({ '3d': render3d, parts: renderParts, draw: renderDraw, nest: renderNest, hw: renderHW, help: () => {} })[sel.tab]();
}

// ---------- Ручные правки ----------
function ovFor(p) {
  if (p.role === 'custom') return project.custom.find(c => 'c:' + c.id === p.uid);
  const it = project.items[p.itemIdx];
  return (it.overrides[p.id] = it.overrides[p.id] || {});
}
function setEdge(group, e, v) {
  for (const p of group.parts) { const o = ovFor(p); o.edges = { ...(o.edges || {}), [e]: v }; }
}
const findGroup = uid => built.groups.find(g => g.parts.some(p => p.uid === uid));

// ---------- Детали ----------
function edgeChips(g) {
  return `<span class="chips">${['L1', 'L2', 'W1', 'W2'].map(e => {
    const v = g.rep.edges[e];
    return `<span class="chip ${v >= 2 ? 'k2' : v > 0 ? 'k1' : ''}" data-edge="${e}" data-key="${esc(g.rep.uid)}" title="Нажми, чтобы сменить">${C.EDGE_NAMES[e]}${v ? ' ' + fmt(v) : ' —'}</span>`;
  }).join('')}</span>`;
}
function renderParts() {
  const S = project.settings;
  let html = `<thead><tr><th>№</th><th>Деталь</th><th>Материал</th><th>Длина</th><th>Ширина</th><th>Толщ.</th><th>Кол.</th><th>Кромка</th><th>Пильный размер</th><th>Отв.</th><th></th></tr></thead><tbody>`;
  let lastItem = null;
  for (const g of built.groups) {
    const p = g.rep, cs = C.cutSize(p, S);
    if (p.item !== lastItem) { html += `<tr class="grp"><td colspan="11">${esc(p.item)}</td></tr>`; lastItem = p.item; }
    html += `<tr class="row" data-uid="${esc(p.uid)}"><td class="n">${g.no}</td><td>${esc(p.name)}</td><td>${esc(p.material)}</td>
      <td class="n">${fmt(p.L)}</td><td class="n">${fmt(p.W)}</td><td class="n">${p.T}</td><td class="n"><b>${g.qty}</b></td>
      <td>${edgeChips(g)}</td><td class="n">${fmt(cs.L)} × ${fmt(cs.W)}</td><td class="n">${p.holes.length || ''}</td>
      <td>${p.role === 'custom' ? `<button data-delc="${esc(p.uid)}" title="Удалить">✕</button>` : ''}</td></tr>`;
  }
  $('#partsTbl').innerHTML = html + '</tbody>';
  const cur = $('#cMat').value && $('#cMat').value !== '__new' ? $('#cMat').value : 'ЛДСП Белый';
  $('#cMatWrap').innerHTML = matSelect('cMat', '', cur, '');
  const s = C.summary(built, project);
  $('#partsTotals').innerHTML =
    Object.entries(s.area).map(([k, v]) => `<div><b>${esc(k)}</b><br>${fmt(v)} м²</div>`).join('') +
    Object.entries(s.edge).map(([k, v]) => `<div><b>Кромка ${fmt(+k)} мм</b><br>${fmt(v)} м</div>`).join('');
}
$('#partsTbl').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (chip) {
    const g = findGroup(chip.dataset.key), cur = g.rep.edges[chip.dataset.edge];
    const nx = EDGE_STEPS[(EDGE_STEPS.indexOf(cur) + 1) % EDGE_STEPS.length] ?? 0;
    setEdge(g, chip.dataset.edge, nx); update(); return;
  }
  if (e.target.dataset.delc) {
    project.custom = project.custom.filter(c => 'c:' + c.id !== e.target.dataset.delc); update(); return;
  }
  const row = e.target.closest('tr.row');
  if (row) { sel.uid = row.dataset.uid; setTab('draw'); }
});
$('#cMatWrap').addEventListener('change', e => {
  if (e.target.value !== '__new') return;
  const name = askNewMaterial('plate');
  $('#cMatWrap').innerHTML = matSelect('cMat', '', name || 'ЛДСП Белый', '');
  saveLocal();
});
$('#btnAddCustom').onclick = () => {
  const n = id => Number($(id).value);
  if (!(n('#cL') > 0 && n('#cW') > 0 && n('#cT') > 0)) { toast('Заполни размеры'); return; }
  const id = Date.now().toString(36);
  project.custom.push({ id, name: $('#cName').value || 'Деталь', material: $('#cMat').value || 'ЛДСП', T: n('#cT'), L: n('#cL'), W: n('#cW'), qty: Math.max(1, n('#cQ') || 1), edges: {}, holes: [] });
  update(); toast('Деталь добавлена');
};
function csv() {
  const S = project.settings;
  const rows = [['№', 'Изделие', 'Деталь', 'Материал', 'Толщина', 'Длина', 'Ширина', 'Кол-во', 'Кромка Д1', 'Кромка Д2', 'Кромка Ш1', 'Кромка Ш2', 'Пильная длина', 'Пильная ширина', 'Отверстий']];
  for (const g of built.groups) {
    const p = g.rep, cs = C.cutSize(p, S);
    rows.push([g.no, p.item, p.name, p.material, p.T, p.L, p.W, g.qty, p.edges.L1, p.edges.L2, p.edges.W1, p.edges.W2, cs.L, cs.W, p.holes.length]);
  }
  return '﻿' + rows.map(r => r.map(v => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');
}
$('#btnCSV').onclick = () => download(fileBase() + '_detali.csv', csv(), 'text/csv;charset=utf-8');
$('#btnDXFall').onclick = () => download(fileBase() + '_detali.dxf', C.toDXF(built.groups), 'application/dxf');

// ---------- Чертежи ----------
function drawSVG(p, VW = 900, VH = 600) {
  const m = 115, s = Math.min((VW - 2 * m) / p.L, (VH - 2 * m) / p.W);
  const pw = p.L * s, ph = p.W * s, x0 = (VW - pw) / 2, y0 = (VH - ph) / 2;
  const X = x => x0 + x * s, Y = y => y0 + ph - y * s;
  let o = `<svg viewBox="0 0 ${VW} ${VH}" class="dwg" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif">`;
  o += `<rect class="pnl" x="${x0}" y="${y0}" width="${pw}" height="${ph}"/>`;
  const E = { L1: [X(0), Y(0), X(p.L), Y(0)], L2: [X(0), Y(p.W), X(p.L), Y(p.W)], W1: [X(0), Y(0), X(0), Y(p.W)], W2: [X(p.L), Y(0), X(p.L), Y(p.W)] };
  for (const [e, c] of Object.entries(E)) {
    const v = p.edges[e];
    if (v > 0) o += `<line class="${v >= 2 ? 'k2' : 'k1'}" x1="${c[0]}" y1="${c[1]}" x2="${c[2]}" y2="${c[3]}"/>`;
    let lab = C.EDGE_NAMES[e] + (v ? ` · кромка ${fmt(v)}` : '');
    const front = p.frontEdge === e, top = p.topEdge === e;
    if (front) lab += ' · ПЕРЕД'; if (top) lab += ' · ВЕРХ';
    const cls = `elab${front || top ? ' f' : ''}`;
    if (e === 'L1') o += `<text class="${cls}" x="${X(p.L / 2)}" y="${Y(0) - 6}" text-anchor="middle">${lab}</text>`;
    if (e === 'L2') o += `<text class="${cls}" x="${X(p.L / 2)}" y="${Y(p.W) + 14}" text-anchor="middle">${lab}</text>`;
    if (e === 'W1') o += `<text class="${cls}" transform="translate(${X(0) + 13},${Y(p.W / 2)}) rotate(-90)" text-anchor="middle">${lab}</text>`;
    if (e === 'W2') o += `<text class="${cls}" transform="translate(${X(p.L) - 6},${Y(p.W / 2)}) rotate(-90)" text-anchor="middle">${lab}</text>`;
  }
  for (const h of p.holes) {
    if (h.face) {
      const rad = Math.max((h.d / 2) * s, 2.4), cls = h.through ? 'h-thru' : h.face === 'A' ? 'h-a' : 'h-b';
      o += `<circle class="${cls}" cx="${X(h.x)}" cy="${Y(h.y)}" r="${rad}"/>`;
      if (!h.through && rad > 5) o += `<circle cx="${X(h.x)}" cy="${Y(h.y)}" r="1" fill="#222"/>`;
    } else {
      const dep = h.depth * s, wd = Math.max(h.d * s, 3);
      let rx, ry, rw, rh;
      if (h.edge === 'W1') { rx = X(0); ry = Y(h.y) - wd / 2; rw = dep; rh = wd; }
      if (h.edge === 'W2') { rx = X(p.L) - dep; ry = Y(h.y) - wd / 2; rw = dep; rh = wd; }
      if (h.edge === 'L1') { rx = X(h.x) - wd / 2; ry = Y(0) - dep; rw = wd; rh = dep; }
      if (h.edge === 'L2') { rx = X(h.x) - wd / 2; ry = Y(p.W); rw = wd; rh = dep; }
      o += `<rect class="h-e" x="${rx}" y="${ry}" width="${rw}" height="${rh}"/>`;
    }
  }
  // габаритные размеры
  const by = y0 + ph + 48, lx = x0 - 48;
  o += `<path class="dim" d="M${X(0)},${y0 + ph + 6}V${by + 6}M${X(p.L)},${y0 + ph + 6}V${by + 6}M${X(0)},${by}H${X(p.L)}"/>`;
  o += `<path class="dim" d="M${X(0) - 4},${by + 4}l8,-8M${X(p.L) - 4},${by + 4}l8,-8"/>`;
  o += `<text class="dimt" x="${X(p.L / 2)}" y="${by - 5}" text-anchor="middle">${fmt(p.L)}</text>`;
  o += `<path class="dim" d="M${x0 - 6},${Y(0)}H${lx - 6}M${x0 - 6},${Y(p.W)}H${lx - 6}M${lx},${Y(0)}V${Y(p.W)}"/>`;
  o += `<path class="dim" d="M${lx - 4},${Y(0) + 4}l8,-8M${lx - 4},${Y(p.W) + 4}l8,-8"/>`;
  o += `<text class="dimt" transform="translate(${lx - 6},${Y(p.W / 2)}) rotate(-90)" text-anchor="middle">${fmt(p.W)}</text>`;
  // координаты отверстий (ординатные размеры от 0,0)
  const xs = [...new Set(p.holes.filter(h => h.face || h.edge[0] === 'L').map(h => h.x))].sort((a, b) => a - b);
  const ys = [...new Set(p.holes.filter(h => h.face || h.edge[0] === 'W').map(h => h.y))].sort((a, b) => a - b);
  xs.forEach((v, i) => {
    const len = 12 + (i % 3) * 24;
    o += `<line class="ord" x1="${X(v)}" y1="${y0}" x2="${X(v)}" y2="${y0 - len}"/>`;
    o += `<text class="ordt" transform="translate(${X(v) + 3},${y0 - len - 2}) rotate(-90)">${fmt(v)}</text>`;
  });
  ys.forEach((v, i) => {
    const len = 12 + (i % 3) * 24;
    o += `<line class="ord" x1="${X(p.L)}" y1="${Y(v)}" x2="${X(p.L) + len}" y2="${Y(v)}"/>`;
    o += `<text class="ordt" x="${X(p.L) + len + 2}" y="${Y(v) + 3}">${fmt(v)}</text>`;
  });
  o += `<circle cx="${X(0)}" cy="${Y(0)}" r="3.5" fill="#1d6fd1"/><text x="${X(0) - 6}" y="${Y(0) + 15}" font-size="11" fill="#1d6fd1" text-anchor="end">0,0</text>`;
  return o + '</svg>';
}
function holeRows(p) {
  const hs = [...p.holes].sort((a, b) => (a.face || a.edge).localeCompare(b.face || b.edge) || a.x - b.x || a.y - b.y);
  return hs.map((h, i) => {
    const side = h.face ? `Пласть ${h.face}` : `Торец ${C.EDGE_NAMES[h.edge]}`;
    const idx = p.holes.indexOf(h);
    return `<tr><td class="n">${i + 1}</td><td>${C.HOLE_TYPES[h.type] || h.type}</td><td>${side}</td><td class="n">${fmt(h.x)}</td><td class="n">${fmt(h.y)}</td><td class="n">Ø${fmt(h.d)}</td><td class="n">${h.through ? 'насквозь' : fmt(h.depth)}</td><td>${h.type === 'user' ? `<button data-delh="${idx}">✕</button>` : ''}</td></tr>`;
  }).join('');
}
const holeHead = '<thead><tr><th>№</th><th>Тип</th><th>Сторона</th><th>X</th><th>Y</th><th>Диаметр</th><th>Глубина</th><th></th></tr></thead>';
function renderDraw() {
  if (!built.groups.length) { $('#drawList').innerHTML = ''; $('#drawing').innerHTML = '<p class="muted" style="padding:20px">Нет деталей</p>'; return; }
  let g = sel.uid && findGroup(sel.uid);
  if (!g) { g = built.groups.find(x => x.rep.itemIdx === sel.item) || built.groups[0]; sel.uid = g.rep.uid; }
  let last = null, list = '';
  for (const x of built.groups) {
    if (x.rep.item !== last) { list += `<div class="dl-h">${esc(x.rep.item)}</div>`; last = x.rep.item; }
    list += `<div class="dl ${x === g ? 'on' : ''}" data-uid="${esc(x.rep.uid)}"><b>${x.no}.</b> ${esc(x.rep.name)}${x.qty > 1 ? ` ×${x.qty}` : ''}<div class="s">${fmt(x.rep.L)} × ${fmt(x.rep.W)} × ${x.rep.T} · отв. ${x.rep.holes.length}</div></div>`;
  }
  $('#drawList').innerHTML = list;
  const p = g.rep;
  $('#drawTitle').textContent = `№${g.no} ${p.name} — ${fmt(p.L)} × ${fmt(p.W)} × ${p.T} мм, ${g.qty} шт · ${p.material}`;
  $('#drawing').innerHTML = drawSVG(p);
  $('#holesTbl').innerHTML = p.holes.length ? holeHead + '<tbody>' + holeRows(p) + '</tbody>' : '<tr><td class="muted">Отверстий нет</td></tr>';
}
$('#drawList').addEventListener('click', e => {
  const d = e.target.closest('.dl'); if (d) { sel.uid = d.dataset.uid; renderDraw(); }
});
$('#holesTbl').addEventListener('click', e => {
  const i = e.target.dataset.delh; if (i === undefined) return;
  const g = findGroup(sel.uid), h = g.rep.holes[+i];
  for (const p of g.parts) {
    const o = ovFor(p);
    o.holes = (o.holes || []).filter(x => !(x.x === h.x && x.y === h.y && (x.face || x.edge) === (h.face || h.edge) && x.d === h.d));
  }
  update();
});
$('#btnAddHole').onclick = () => {
  const g = findGroup(sel.uid); if (!g) return;
  const side = $('#hSide').value, p = g.rep, n = id => Number($(id).value);
  const h = { d: n('#hD'), depth: $('#hThru').checked ? p.T : n('#hDepth'), through: $('#hThru').checked };
  if (side === 'A' || side === 'B') Object.assign(h, { face: side, x: n('#hX'), y: n('#hY') });
  else {
    h.through = false; h.edge = side; h.depth = n('#hDepth');
    Object.assign(h, side === 'L1' ? { x: n('#hX'), y: 0 } : side === 'L2' ? { x: n('#hX'), y: p.W } : side === 'W1' ? { x: 0, y: n('#hY') } : { x: p.L, y: n('#hY') });
  }
  if (!(h.d > 0) || h.x < 0 || h.y < 0 || h.x > p.L || h.y > p.W) { toast('Отверстие вне детали или не задан диаметр'); return; }
  for (const q of g.parts) { const o = ovFor(q); o.holes = [...(o.holes || []), h]; }
  update(); toast('Отверстие добавлено');
};
$('#btnDXF1').onclick = () => {
  const g = findGroup(sel.uid); if (!g) return;
  download(`${fileBase()}_${g.no}.dxf`, C.toDXF([g]), 'application/dxf');
};

// ---------- Раскрой ----------
const COLORS = ['#f6d7bf', '#d7e8f6', '#dcf0d6', '#f3e0f2', '#fff0b8', '#e2ddf7', '#d6f1ee', '#f7dcd6'];
function sheetSVG(sh, S) {
  const VW = 900, s = VW / S.sheetL, VH = S.sheetW * s;
  let o = `<svg viewBox="0 0 ${VW} ${VH}" class="dwg" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif">`;
  o += `<rect x="0" y="0" width="${VW}" height="${VH}" fill="#efe8dc" stroke="#555"/>`;
  o += `<rect x="${S.trim * s}" y="${S.trim * s}" width="${(S.sheetL - 2 * S.trim) * s}" height="${(S.sheetW - 2 * S.trim) * s}" fill="#e6dccb" stroke="#aaa" stroke-dasharray="4 3"/>`;
  for (const u of sh.used) {
    const x = (S.trim + u.x) * s, y = (S.trim + u.y) * s, w = u.w * s, h = u.h * s;
    o += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${COLORS[u.no % COLORS.length]}" stroke="#333" stroke-width="1"/>`;
    const fs = Math.max(7, Math.min(15, h * 0.32, w / 6));
    if (w > 18 && h > 12) {
      o += `<text x="${x + w / 2}" y="${y + h / 2}" font-size="${fs}" text-anchor="middle" font-weight="700">${u.no}${u.rotated ? '↻' : ''}</text>`;
      if (h > fs * 2.4 && w > 50) o += `<text x="${x + w / 2}" y="${y + h / 2 + fs}" font-size="${fs * 0.8}" text-anchor="middle" fill="#444">${fmt(u.L)}×${fmt(u.W)}</text>`;
    }
  }
  return o + '</svg>';
}
function renderNest() {
  const S = project.settings;
  $('#sL').value = S.sheetL; $('#sW').value = S.sheetW; $('#sKerf').value = S.kerf; $('#sTrim').value = S.trim;
  $('#sGrain').checked = !!S.grain; $('#sSub').checked = !!S.subtractEdge;
  const res = C.nest(built, S);
  $('#nestOut').innerHTML = res.map(m => `<div class="nest-mat"><h3>${esc(m.mat)} — листов: ${m.sheets.length}${m.sheets.length ? `, средняя загрузка ${Math.round(m.sheets.reduce((a, s) => a + s.util, 0) / m.sheets.length * 100)}%` : ''}</h3>
    ${m.unplaced.length ? `<div class="warn">Не помещаются на лист: ${m.unplaced.map(u => `№${u.no} ${u.w}×${u.h}`).join(', ')}</div>` : ''}
    ${m.sheets.map((sh, i) => `<div class="sheet"><h4>Лист ${i + 1} · ${S.sheetL}×${S.sheetW} · загрузка ${Math.round(sh.util * 100)}% · деталей ${sh.used.length}</h4>${sheetSVG(sh, S)}</div>`).join('')}</div>`).join('')
    + '<p class="muted">Номера на листах — это № деталей из вкладки «Детали». ↻ — деталь повёрнута. Размеры пильные.</p>';
}
for (const [id, k, type] of [['#sL', 'sheetL', 'n'], ['#sW', 'sheetW', 'n'], ['#sKerf', 'kerf', 'n'], ['#sTrim', 'trim', 'n'], ['#sGrain', 'grain', 'b'], ['#sSub', 'subtractEdge', 'b']]) {
  $(id).addEventListener('change', e => {
    const v = type === 'b' ? e.target.checked : Number(e.target.value);
    if (type === 'n' && !(v >= 0)) return;
    project.settings[k] = v; update();
  });
}

// ---------- Фурнитура ----------
function hwHTML() {
  const s = C.summary(built, project), res = C.nest(built, project.settings);
  return `<h3>Фурнитура и расходники</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Наименование</th><th>Кол-во</th><th>Ед.</th></tr></thead><tbody>
    ${s.hw.map(([n, q, u]) => `<tr><td>${esc(n)}</td><td class="n"><b>${fmt(q)}</b></td><td>${u}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Нет</td></tr>'}</tbody></table></div>
    <h3>Плитные материалы</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Материал</th><th>Площадь деталей</th><th>Листов ${project.settings.sheetL}×${project.settings.sheetW}</th></tr></thead><tbody>
    ${res.map(m => `<tr><td>${esc(m.mat)}</td><td class="n">${fmt(s.area[m.mat] || 0)} м²</td><td class="n"><b>${m.sheets.length}</b></td></tr>`).join('')}</tbody></table></div>`;
}
function renderHW() {
  $('#hwOut').innerHTML = hwHTML() + '<p class="muted">Количество рассчитано по присадке. Тип петель, направляющих и ручек уточни под свою фурнитуру.</p>';
}

// ---------- 3D ----------
let T3 = null, t3loading = false;
async function init3d() {
  if (T3 || t3loading) return;
  t3loading = true;
  try {
    const THREE = await import('three');
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    const { CSS2DRenderer, CSS2DObject } = await import('three/addons/renderers/CSS2DRenderer.js');
    const el = $('#view3d');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.className = 'labels3d';
    el.appendChild(labels.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 10, 50000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8278, 1.6));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(1, 2, 1.5); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.5); dl2.position.set(-1.5, 0.5, -1); scene.add(dl2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const group = new THREE.Group(); scene.add(group);
    const grid = new THREE.GridHelper(4000, 40, 0xbbbbbb, 0xd5d5d5); scene.add(grid);
    T3 = { THREE, CSS2DObject, renderer, labels, scene, camera, controls, group, grid, meshes: [], sel: null, fitKey: '' };
    const resize = () => {
      const w = el.clientWidth || 800, h = el.clientHeight || 500;
      renderer.setSize(w, h); labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(el); resize();
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); labels.render(scene, camera); });
    // выбор детали кликом
    let down = null;
    renderer.domElement.addEventListener('pointerdown', e => (down = [e.clientX, e.clientY]));
    renderer.domElement.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const rc = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(T3.meshes.filter(m => m.visible), false)[0];
      select3d(hit ? hit.object.userData.uid : null);
    });
  } catch (e) {
    console.error(e);
    $('#view3d').innerHTML = '<div class="err">3D-вид не загрузился (нужен интернет для библиотеки three.js). Остальные вкладки работают.</div>';
  }
  t3loading = false;
  render3d();
}
function select3d(uid) {
  T3.sel = uid;
  for (const m of T3.meshes) m.material.emissive?.setHex(m.userData.uid === uid ? 0x8a3c08 : 0x000000);
  const info = $('#v3dInfo');
  const p = built.parts.find(x => x.uid === uid);
  if (!p) { info.classList.remove('on'); return; }
  const g = findGroup(uid);
  info.innerHTML = `<b>${esc(p.name)}</b><br>${fmt(p.L)} × ${fmt(p.W)} × ${p.T} мм<br><span class="muted">${esc(p.material)} · отверстий: ${p.holes.length}</span><br><button id="go2draw" style="margin-top:6px">Чертёж №${g?.no}</button>`;
  info.classList.add('on');
  $('#go2draw').onclick = () => { sel.uid = uid; setTab('draw'); };
}
function render3d() {
  if (!T3) { init3d(); return; }
  const { THREE, group } = T3;
  group.traverse(o => o.isCSS2DObject && o.element.remove());
  group.clear(); T3.meshes = [];
  const g = built.items[sel.item];
  const dimsEl = $('#v3dDims');
  if (!g) { dimsEl.textContent = ''; return; }
  const parts = built.parts.filter(p => p.itemIdx === sel.item && p.orient);
  const d = g.dims;
  dimsEl.textContent = `Габариты: ${d.W} × ${d.H} × ${d.D} мм (Ш×В×Г) · деталей: ${parts.length}`;
  const showF = $('#optFronts').checked, transp = $('#optTransp').checked, holes = $('#optHoles').checked, expl = $('#optExplode').checked;
  const center = new THREE.Vector3(d.W / 2, 0, (parts.reduce((a, p) => Math.min(a, p.oz), 0) + d.D) / 2);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const cupMat = new THREE.MeshBasicMaterial({ color: 0x6b6b6b });
  for (const p of parts) {
    if (p.role === 'front' && !showF) continue;
    const size = C.worldSize(p);
    const mat = new THREE.MeshStandardMaterial({ color: matColor(p.material, p.role), roughness: 0.8, transparent: transp && p.role !== 'front', opacity: transp && p.role !== 'front' ? 0.3 : 1, depthWrite: !(transp && p.role !== 'front') });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    const pc = new THREE.Vector3(p.ox + size[0] / 2, p.oy + size[1] / 2, p.oz + size[2] / 2);
    let off = new THREE.Vector3();
    if (expl) {
      off = pc.clone().sub(new THREE.Vector3(center.x, d.H / 2, center.z)).multiplyScalar(0.35);
      if (p.role === 'front') off.z += 150;
    }
    mesh.position.copy(pc).sub(center).add(off);
    mesh.userData.uid = p.uid;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: 0x5a5148 }));
    mesh.add(edges);
    group.add(mesh); T3.meshes.push(mesh);
    if (holes) {
      const m = C.ORIENT[p.orient];
      for (const h of p.holes) {
        let axis, l, len;
        if (h.face) {
          len = h.through ? p.T : Math.min(h.depth, p.T);
          axis = m.z; l = { x: h.x, y: h.y, z: h.face === 'A' ? p.T - len / 2 + 0.3 : len / 2 - 0.3 };
        } else {
          len = h.depth;
          if (h.edge[0] === 'W') { axis = m.x; l = { x: h.edge === 'W1' ? len / 2 : p.L - len / 2, y: h.y, z: p.T / 2 }; }
          else { axis = m.y; l = { x: h.x, y: h.edge === 'L1' ? len / 2 : p.W - len / 2, z: p.T / 2 }; }
        }
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(h.d / 2, h.d / 2, len + 0.6, 18), h.type === 'cup' ? cupMat : holeMat);
        if (axis === 0) cyl.rotation.z = Math.PI / 2;
        if (axis === 2) cyl.rotation.x = Math.PI / 2;
        const w = C.toWorld(p, l);
        cyl.position.set(w[0], w[1], w[2]).sub(center).add(off);
        group.add(cyl);
      }
    }
  }
  if ($('#optDims').checked && parts.length) addDims(parts, center);
  T3.grid.position.y = -0.5;
  const key = `${sel.item}:${d.W}:${d.H}:${d.D}:${T3.camera.aspect < 1}`;
  if (T3.fitKey !== key) { fitCamera(d); T3.fitKey = key; }
  if (T3.sel) select3d(T3.sel);
}
// Габаритные размеры на 3D-модели
function addDims(parts, center) {
  const { THREE, CSS2DObject, group } = T3;
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const sz = C.worldSize(p), o = [p.ox, p.oy, p.oz];
    for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], o[i]); mx[i] = Math.max(mx[i], o[i] + sz[i]); }
  }
  mn[1] = 0;
  const off = Math.max(60, 0.12 * Math.max(mx[0] - mn[0], mx[1], mx[2] - mn[2]));
  const mat = new THREE.LineBasicMaterial({ color: 0xb4321f });
  const extMat = new THREE.LineBasicMaterial({ color: 0xb4321f, transparent: true, opacity: 0.45 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z).sub(center);
  const seg = (pts, m) => group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), m));
  const label = (text, pos) => {
    const d = document.createElement('div'); d.className = 'dim3d'; d.textContent = text;
    const o = new CSS2DObject(d); o.position.copy(pos); group.add(o);
  };
  const tick = off * 0.18;
  // dim(a, b, ext): a, b — концы размерной линии; ext — откуда вести выносные линии
  const dim = (a, b, ea, eb, text) => {
    seg([a, b], mat);
    seg([ea, a, eb, b], extMat);
    const dir = b.clone().sub(a).normalize();
    for (const q of [a, b]) seg([q.clone().addScaledVector(dir, -tick).add(new THREE.Vector3(0, 0, 0)), q.clone().addScaledVector(dir, tick)], mat);
    label(text, a.clone().add(b).multiplyScalar(0.5));
  };
  const zF = mx[2], xR = mx[0];
  // Ширина — по фронту внизу
  dim(V(mn[0], -off * 0.6, zF + off), V(mx[0], -off * 0.6, zF + off), V(mn[0], 0, zF), V(mx[0], 0, zF), `Ш ${Math.round(mx[0] - mn[0])}`);
  // Высота — справа спереди
  dim(V(xR + off, 0, zF), V(xR + off, mx[1], zF), V(xR, 0, zF), V(xR, mx[1], zF), `В ${Math.round(mx[1])}`);
  // Глубина — справа внизу
  dim(V(xR + off, -off * 0.6, mn[2]), V(xR + off, -off * 0.6, zF), V(xR, 0, mn[2]), V(xR, 0, zF), `Г ${Math.round(mx[2] - mn[2])}`);
}
function fitCamera(d, front = false) {
  const size = Math.max(d.W, d.H, d.D);
  const t = new T3.THREE.Vector3(0, d.H * 0.42, 0);
  const k = Math.max(1, 0.95 / T3.camera.aspect); // узкий (вертикальный) экран — отодвигаем камеру
  const v = front ? new T3.THREE.Vector3(0, 0, size * 2.9) : new T3.THREE.Vector3(size * 1.45, d.H * 0.08 + size * 0.85, size * 2.45);
  T3.controls.target.copy(t);
  T3.camera.position.copy(t).addScaledVector(v, k);
  T3.controls.update();
}
for (const id of ['#optFronts', '#optTransp', '#optHoles', '#optExplode', '#optDims']) $(id).addEventListener('change', render3d);
$('#btnResetView').onclick = () => { const g = built.items[sel.item]; if (T3 && g) fitCamera(g.dims, true); };

// ---------- Печать ----------
function buildPrint() {
  const S = project.settings;
  let h = `<div class="pr-page"><h2>${esc(project.name)}</h2><p>Дата: ${new Date().toLocaleDateString('ru-RU')} · Изделия: ${project.items.map(i => esc(i.params.name)).join(', ')}</p>
  <h3>Спецификация деталей</h3><table class="tbl"><thead><tr><th>№</th><th>Изделие</th><th>Деталь</th><th>Материал</th><th>Д×Ш×Т</th><th>Кол.</th><th>Д1</th><th>Д2</th><th>Ш1</th><th>Ш2</th><th>Пильный</th></tr></thead><tbody>
  ${built.groups.map(g => { const p = g.rep, cs = C.cutSize(p, S); return `<tr><td>${g.no}</td><td>${esc(p.item)}</td><td>${esc(p.name)}</td><td>${esc(p.material)}</td><td>${fmt(p.L)}×${fmt(p.W)}×${p.T}</td><td><b>${g.qty}</b></td><td>${p.edges.L1 || ''}</td><td>${p.edges.L2 || ''}</td><td>${p.edges.W1 || ''}</td><td>${p.edges.W2 || ''}</td><td>${fmt(cs.L)}×${fmt(cs.W)}</td></tr>`; }).join('')}
  </tbody></table>${hwHTML()}</div>`;
  for (const g of built.groups) {
    const p = g.rep;
    h += `<div class="pr-page"><h2>№${g.no} ${esc(p.name)} — ${fmt(p.L)}×${fmt(p.W)}×${p.T} мм, ${g.qty} шт</h2><p>${esc(p.item)} · ${esc(p.material)} · Кромка: Д1 ${p.edges.L1 || '—'}, Д2 ${p.edges.L2 || '—'}, Ш1 ${p.edges.W1 || '—'}, Ш2 ${p.edges.W2 || '—'} · Вид со стороны пласти A, отсчёт от 0,0</p>
      ${drawSVG(p)}${p.holes.length ? `<table class="tbl small">${holeHead}<tbody>${holeRows(p)}</tbody></table>` : ''}</div>`;
  }
  for (const m of C.nest(built, S)) m.sheets.forEach((sh, i) => {
    h += `<div class="pr-page"><h2>Раскрой: ${esc(m.mat)} — лист ${i + 1} из ${m.sheets.length} (загрузка ${Math.round(sh.util * 100)}%)</h2>${sheetSVG(sh, S)}</div>`;
  });
  $('#print').innerHTML = h;
}
$('#btnPrint').onclick = () => { buildPrint(); setTimeout(() => window.print(), 50); };

// ---------- Файл / ссылка ----------
$('#projName').addEventListener('input', e => { project.name = e.target.value; saveLocal(); });
$('#btnNew').onclick = () => {
  if (!confirm('Начать новый проект? Текущий будет заменён (сохрани его файлом, если нужно).')) return;
  project = newProject(); sel.item = 0; sel.uid = null; $('#projName').value = project.name; update({ form: true });
};
$('#btnSave').onclick = () => download(fileBase() + '.mebel.json', JSON.stringify(project, null, 1), 'application/json');
$('#btnOpen').onclick = () => $('#fileOpen').click();
$('#fileOpen').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { project = normalize(JSON.parse(await f.text())); sel.item = 0; sel.uid = null; $('#projName').value = project.name; update({ form: true }); toast('Проект открыт'); }
  catch (err) { toast('Не удалось прочитать файл'); }
  e.target.value = '';
};
$('#btnShare').onclick = async () => {
  try {
    const url = `${location.origin}${location.pathname}#p=${await encodeProject(project)}`;
    let copied = false;
    try { await navigator.clipboard.writeText(url); copied = true; } catch (e) { /* без буфера обмена */ }
    modal(`<h3 style="margin-top:0">Ссылка на проект</h3><p>${copied ? 'Ссылка скопирована в буфер обмена. ' : ''}Отправь её другу: у него откроется копия этого проекта, и он сможет её менять у себя.</p><textarea readonly onclick="this.select()">${esc(url)}</textarea>
      <p class="muted">Ссылка без проекта, просто программа: ${esc(location.origin + location.pathname)}</p>`);
  } catch (e) { toast('Браузер не поддерживает сжатие ссылки'); }
};

// ---------- Старт ----------
(async function start() {
  project = null;
  if (location.hash.startsWith('#p=')) {
    try { project = normalize(await decodeProject(location.hash.slice(3))); toast('Открыт проект по ссылке'); }
    catch (e) { toast('Ссылка повреждена — открыт сохранённый проект'); }
    history.replaceState(null, '', location.pathname + location.search);
  }
  if (!project) { const l = loadLocal(); project = l ? normalize(l) : newProject(); }
  $('#projName').value = project.name;
  update({ form: true });
})();
