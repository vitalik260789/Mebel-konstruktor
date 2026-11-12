import * as C from './core.js?v=202611120957';

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
  p.items.forEach(it => {
    it.overrides = it.overrides || {};
    it.params = C.normalizeParams(it.params);
    for (const k of ['layout', 'doors', 'hingeSide', 'drawers', 'drawerFrontH', 'shelves']) delete it.params[k];
  });
  return p;
}
function saveLocal() { try { localStorage.setItem(LS, JSON.stringify(project)); } catch (e) { /* хранилище недоступно */ } histSnap(); }
// ---------- История (отмена) ----------
const hist = { stack: [], i: -1, tm: null };
function histSnap(now = false) {
  clearTimeout(hist.tm);
  const go = () => {
    const st = JSON.stringify(project);
    if (hist.stack[hist.i] === st) return;
    hist.stack = hist.stack.slice(0, hist.i + 1); hist.stack.push(st);
    if (hist.stack.length > 100) hist.stack.shift();
    hist.i = hist.stack.length - 1; histBtns();
  };
  if (now) go(); else hist.tm = setTimeout(go, 400);
}
function histBtns() { $('#btnUndo').disabled = hist.i <= 0; $('#btnRedo').disabled = hist.i >= hist.stack.length - 1; }
function histGo(d) {
  histSnap(true);
  const j = hist.i + d; if (j < 0 || j >= hist.stack.length) return;
  hist.i = j; project = JSON.parse(hist.stack[j]); $('#projName').value = project.name;
  update({ form: true }); histBtns(); toast(d < 0 ? 'Отменено' : 'Возвращено');
}
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
function update({ form = false, refreshPlaceholders = false } = {}) {
  built = C.buildProject(project);
  if (refreshPlaceholders && !form) {
    const info = built.items[sel.item]?.extra?.secInfo || [];
    document.querySelectorAll('#form [data-sf="w"]').forEach(el => (el.placeholder = `авто ${info[+el.dataset.s]?.w ?? ''}`));
    document.querySelectorAll('#form [data-bf="h"]').forEach(el => (el.placeholder = `авто ${info[+el.dataset.s]?.blocks[+el.dataset.b] ?? ''}`));
  }
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
const blocksOf = p => (p.sections || []).flatMap(s => s.blocks || []);
const hasDrawers = p => blocksOf(p).some(b => b.type === 'drawers');
const hasFronts = p => blocksOf(p).some(b => b.type !== 'open');
const hasShelves = p => blocksOf(p).some(b => b.type !== 'drawers');
const FIELDS = [
  ['Габариты', [
    ['name', 'Название', 'text'],
    ['W', 'Ширина', 'num'], ['H', 'Высота корпуса (без ножек)', 'num'], ['D', 'Глубина корпуса (без фасада)', 'num'],
  ]],
  ['Материалы', [
    ['matCorpus', 'Корпус', 'mat', 'plate'], ['t', 'Толщина корпуса', 'thk', 'plate'],
    ['matFront', 'Фасады', 'mat', 'plate', hasFronts], ['frontT', 'Толщина фасадов', 'thk', 'plate', hasFronts],
    ['matBack', 'Задняя стенка, дно ящиков', 'mat', 'thin'], ['backT', 'Толщина задней стенки', 'thk', 'thin'],
  ]],
  ['Конструкция', [
    ['topType', 'Крышка', 'sel', [['overlay', 'Накладная'], ['inset', 'Вкладная'], ['rails', 'Царги (под столешницу)']]],
    ['base', 'Основание', 'sel', [['plinth', 'Цоколь'], ['legs', 'Ножки'], ['hang', 'Навесной (без основания)']]],
    ['plinthH', 'Высота цоколя', 'num', p => p.base === 'plinth'],
    ['plinthSetback', 'Цоколь утоплен на', 'num', p => p.base === 'plinth'],
    ['legsH', 'Высота ножек', 'num', p => p.base === 'legs'],
    ['backType', 'Задняя стенка', 'sel', [['overlay', 'Накладная (на гвозди)'], ['groove', 'В паз'], ['none', 'Нет']]],
    ['grooveOff', 'Паз: отступ от заднего края', 'num', p => p.backType === 'groove'],
    ['grooveDepth', 'Паз: глубина', 'num', p => p.backType === 'groove'],
  ]],
  ['Столешница', [
    ['worktop', 'Столешница', 'sel', [[0, 'Нет'], [1, 'Есть']]],
    ['worktopMat', 'Материал столешницы', 'text', p => +p.worktop],
    ['worktopT', 'Толщина', 'num', p => +p.worktop],
    ['worktopD', 'Глубина', 'num', p => +p.worktop],
    ['worktopOver', 'Свес перед фасадом', 'num', p => +p.worktop],
  ]],
  ['Шкаф-купе', [
    ['slide', 'Двери-купе', 'sel', [[0, 'Нет'], [1, 'Да (раздвижные)']]],
    ['slideN', 'Количество дверей', 'num', p => +p.slide],
    ['slideOverlap', 'Перекрытие дверей', 'num', p => +p.slide],
    ['slideTrack', 'Зона под двери (глубина)', 'num', p => +p.slide],
    ['slideHDed', 'Дверь ниже проёма на', 'num', p => +p.slide],
  ]],
  ['Крепёж и фурнитура', [
    ['joint', 'Соединение корпуса', 'sel', Object.entries(C.JOINTS)],
    ['hingeBrand', 'Петли', 'sel', [...Object.entries(C.HINGES).map(([k, v]) => [k, v.label]), ['custom', 'Свои размеры']], p => blocksOf(p).some(b => b.type === 'doors')],
    ['cupOffset', 'Центр чашки от края двери', 'num', p => blocksOf(p).some(b => b.type === 'doors')],
    ['cupDepth', 'Глубина чашки Ø35', 'num', p => blocksOf(p).some(b => b.type === 'doors')],
    ['hingeEnd', 'Петля от верха/низа двери', 'num', p => blocksOf(p).some(b => b.type === 'doors')],
    ['runner', 'Направляющие ящиков', 'sel', Object.entries(C.RUNNERS).map(([k, v]) => [k, v.label]), hasDrawers],
  ]],
  ['Фасады', [
    ['gap', 'Зазор между фасадами', 'num', hasFronts],
    ['gapEdge', 'Зазор по краю', 'num', hasFronts],
    ['handle', 'Ручка, межосевое', 'sel', [[0, 'Без ручек'], [64, '64'], [96, '96'], [128, '128'], [160, '160'], [192, '192'], [256, '256']], hasFronts],
  ]],
  ['Полки', [
    ['shelfType', 'Крепление полок', 'sel', [['pins', 'Полкодержатели'], ['fixed', 'Конфирматы']], hasShelves],
    ['shelfRecess', 'Полка утоплена на', 'num', hasShelves],
  ]],
  ['Кромка', [
    ['edgeFront', 'Видимые торцы корпуса', 'sel', EDGE_OPT],
    ['edgeOther', 'Прочие торцы', 'sel', EDGE_OPT],
    ['edgeFacade', 'Фасады', 'sel', EDGE_OPT],
  ]],
];

const BLK_TYPES = [['drawers', 'Ящики'], ['doors', 'Двери'], ['open', 'Ниша']];
function sectionsHTML(p) {
  const info = built.items[sel.item]?.extra?.secInfo || [];
  const secs = p.sections || [];
  const opt = (list, v) => list.map(([k, l]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${l}</option>`).join('');
  let h = `<fieldset class="secs"><legend>Секции и наполнение</legend>
    <div class="fr"><label>Количество секций</label><select data-sact="count">${opt([1, 2, 3, 4, 5, 6].map(n => [n, n]), secs.length)}</select></div>
    <p class="hint">Секции — слева направо, между ними вертикальные перегородки. Блоки внутри секции — сверху вниз. Пустая ширина/высота = авто.</p>`;
  secs.forEach((se, i) => {
    const si = info[i] || { blocks: [] };
    h += `<div class="sec"><div class="sec-h"><b>Секция ${i + 1}</b><label>ширина <input type="number" data-s="${i}" data-sf="w" value="${Number(se.w) > 0 ? se.w : ''}" placeholder="авто ${si.w ?? ''}"></label></div>`;
    (se.blocks || []).forEach((b, j) => {
      const bh = si.blocks[j];
      const at = `data-s="${i}" data-b="${j}"`;
      h += `<div class="blk blk-${b.type}"><div class="blk-r">
        <select ${at} data-bf="type">${opt(BLK_TYPES, b.type)}</select>
        <input type="number" ${at} data-bf="h" value="${Number(b.h) > 0 ? b.h : ''}" placeholder="авто ${bh ?? ''}" title="Высота зоны по фасаду, мм">
        <span class="blk-btn"><button ${at} data-bact="up" title="Выше">↑</button><button ${at} data-bact="down" title="Ниже">↓</button><button ${at} data-bact="del" title="Удалить блок">✕</button></span></div>`;
      if (b.type === 'drawers') h += `<div class="blk-r"><label>ящиков</label><input type="number" min="1" max="8" ${at} data-bf="n" value="${b.n || 1}"></div>`;
      if (b.type === 'doors') {
        h += `<div class="blk-r"><label>дверей</label><select ${at} data-bf="n">${opt([[1, '1'], [2, '2']], b.n || 1)}</select>`;
        if (Number(b.n || 1) === 1) h += `<label>петли</label><select ${at} data-bf="hinge">${opt([['left', 'слева'], ['right', 'справа']], b.hinge || 'left')}</select>`;
        h += '</div>';
      }
      if (b.type !== 'drawers') h += `<div class="blk-r"><label>полок</label><input type="number" min="0" max="12" ${at} data-bf="shelves" value="${b.shelves || 0}">
        <input class="pos" ${at} data-bf="pos" value="${esc(b.pos || '')}" placeholder="высоты: 300, 650" title="Высота низа полки от дна ниши, мм, через запятую. Если заполнено — количество берётся отсюда."></div>`;
      h += '</div>';
    });
    h += `<button class="addblk" data-s="${i}" data-sact="addblk">+ блок</button></div>`;
  });
  return h + '</fieldset>';
}
function onSectionsEvent(e) {
  const el = e.target, it = project.items[sel.item]; if (!it) return false;
  const p = it.params, secs = p.sections;
  const si = el.dataset.s !== undefined ? +el.dataset.s : null, bi = el.dataset.b !== undefined ? +el.dataset.b : null;
  if (el.dataset.sact === 'count' && e.type !== 'click') {
    const n = +el.value;
    while (secs.length < n) secs.push(C.sec([C.blk('doors', { shelves: 1 })]));
    secs.length = n; secs.forEach(s => (s.w = 0));
    update({ form: true }); return true;
  }
  if (el.dataset.sact === 'addblk' && e.type === 'click') { secs[si].blocks.push(C.blk('open')); update({ form: true }); return true; }
  if (el.dataset.bact && e.type === 'click') {
    const B = secs[si].blocks, a = el.dataset.bact;
    if (a === 'del') { B.splice(bi, 1); if (!B.length) B.push(C.blk('open')); }
    if (a === 'up' && bi > 0) [B[bi - 1], B[bi]] = [B[bi], B[bi - 1]];
    if (a === 'down' && bi < B.length - 1) [B[bi + 1], B[bi]] = [B[bi], B[bi + 1]];
    update({ form: true }); return true;
  }
  if (el.dataset.sf && e.type !== 'click') { secs[si][el.dataset.sf] = Number(el.value) || 0; debounced(); return true; }
  if (el.dataset.bf && e.type !== 'click') {
    const f = el.dataset.bf, b = secs[si].blocks[bi];
    b[f] = ['type', 'hinge', 'pos'].includes(f) ? el.value : Number(el.value) || 0;
    if (el.tagName === 'SELECT') update({ form: true }); else debounced(f === 'pos' ? 600 : 300);
    return true;
  }
  return false;
}
let secTimer;
function debounced(ms = 300) { clearTimeout(secTimer); secTimer = setTimeout(() => update({ form: false, refreshPlaceholders: true }), ms); }

function renderForm() {
  const it = project.items[sel.item];
  if (!it) { $('#form').innerHTML = ''; return; }
  const p = it.params;
  const FS = FIELDS.map(([g, fs]) => {
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
  });
  FS.splice(3, 0, sectionsHTML(p));
  $('#form').innerHTML = FS.join('');
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
  return m ? m.color : { corpus: '#efe9df', front: '#c8a27a', back: '#d9d4cc', box: '#e6dccb', custom: '#e6dccb', worktop: '#8f8579', slide: '#c8a27a' }[role] || '#eeeeee';
}

let formTimer;
$('#form').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') onSectionsEvent(e); });
$('#form').addEventListener('input', e => {
  if (onSectionsEvent(e)) return;
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
  if (k === 'hingeBrand' && C.HINGES[v]) Object.assign(it.params, { cupOffset: C.HINGES[v].cupOffset, cupDepth: C.HINGES[v].cupDepth });
  if ((k === 'cupOffset' || k === 'cupDepth') && C.HINGES[it.params.hingeBrand] && C.HINGES[it.params.hingeBrand][k] !== v) it.params.hingeBrand = 'custom';
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
  ({ '3d': render3d, parts: renderParts, draw: renderDraw, nest: renderNest, hw: renderHW, cost: renderCost, help: () => {} })[sel.tab]();
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
    html += `<tr class="row" data-uid="${esc(p.uid)}"><td class="n">${g.no}</td><td>${esc(p.name)}${p.resized ? ' <span title="Размер изменён вручную">✎</span>' : ''}</td><td>${esc(p.material)}</td>
      <td class="n">${fmt(p.L)}</td><td class="n">${fmt(p.W)}</td><td class="n">${p.T}</td><td class="n"><b>${g.qty}</b></td>
      <td>${edgeChips(g)}</td><td class="n">${fmt(cs.L)} × ${fmt(cs.W)}</td><td class="n">${p.holes.length || ''}</td>
      <td>${p.role === 'custom' ? `<button data-delc="${esc(p.uid)}" title="Удалить">✕</button>` : ''}</td></tr>`;
  }
  $('#partsTbl').innerHTML = html + '</tbody>';
  const cur = $('#cMat').value && $('#cMat').value !== '__new' ? $('#cMat').value : 'ЛДСП Белый';
  $('#cMatWrap').innerHTML = matSelect('cMat', '', cur, '');
  $('#offParts').innerHTML = built.off.length ? `<div class="offbox"><b>Исключённые детали:</b> ${built.off.map(p => `<span class="offp">${esc(p.item)}: ${esc(p.name)} <button data-restore="${esc(p.uid)}">вернуть</button></span>`).join('')}</div>` : '';
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
$('#offParts').addEventListener('click', e => {
  const uid = e.target.dataset.restore; if (!uid) return;
  const [idx, id] = [uid.slice(0, uid.indexOf(':')), uid.slice(uid.indexOf(':') + 1)];
  delete project.items[+idx].overrides[id].off; update();
});
$('#btnAddCustom').onclick = () => {
  const n = id => Number($(id).value);
  if (!(n('#cL') > 0 && n('#cW') > 0 && n('#cT') > 0)) { toast('Заполни размеры'); return; }
  const id = Date.now().toString(36);
  project.custom.push({ id, name: $('#cName').value || 'Деталь', material: $('#cMat').value || 'ЛДСП', T: n('#cT'), L: n('#cL'), W: n('#cW'), qty: Math.max(1, n('#cQ') || 1), edges: {}, holes: [] });
  update(); toast('Деталь добавлена');
};
const expCfg = () => (project.exportCfg = project.exportCfg || { preset: 'ru', ...C.EXPORT_PRESETS.ru });
$('#expPreset').innerHTML = Object.entries(C.EXPORT_PRESETS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('') + '<option value="custom">Свой</option>';
$('#expFields').innerHTML = Object.entries(C.EXPORT_FIELDS).map(([k, v]) => `<div><code>${k}</code> — ${v}</div>`).join('');
function renderExpCfg() {
  const c = expCfg();
  $('#expPreset').value = c.preset || 'custom'; $('#expSep').value = c.sep || ';'; $('#expComma').checked = !!c.comma; $('#expCols').value = c.cols || '';
}
$('#btnExpCfg').onclick = () => { $('#expCfg').hidden = !$('#expCfg').hidden; renderExpCfg(); };
$('#expPreset').onchange = e => { const k = e.target.value; if (C.EXPORT_PRESETS[k]) project.exportCfg = { preset: k, ...C.EXPORT_PRESETS[k] }; else expCfg().preset = 'custom'; renderExpCfg(); saveLocal(); };
$('#expSep').onchange = e => { expCfg().sep = e.target.value; saveLocal(); };
$('#expComma').onchange = e => { expCfg().comma = e.target.checked; saveLocal(); };
$('#expCols').oninput = e => { const c = expCfg(); c.cols = e.target.value; c.preset = 'custom'; $('#expPreset').value = 'custom'; saveLocal(); };
$('#btnCSV').onclick = () => download(fileBase() + '_raspil.csv', C.toCSV(C.exportRows(built, project.settings, expCfg()), expCfg()), 'text/csv;charset=utf-8');
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
  for (const gq of p.grooves || []) {
    const [gx, gy, gw, gh] = gq.axis === 'y' ? [X(gq.pos), Y(gq.to), gq.w * s, (gq.to - gq.from) * s] : [X(gq.from), Y(gq.pos + gq.w), (gq.to - gq.from) * s, gq.w * s];
    o += `<rect class="groove${gq.face === 'B' ? ' b' : ''}" x="${gx}" y="${gy}" width="${Math.max(gw, 2)}" height="${Math.max(gh, 2)}"/>`;
    const lab = `паз ${fmt(gq.w)}×${fmt(gq.depth)}, пласть ${gq.face}, отступ ${fmt(gq.pos)}`;
    o += gq.axis === 'y'
      ? `<text class="glab" transform="translate(${gx + gw + 26},${Y((gq.from + gq.to) / 2)}) rotate(-90)" text-anchor="middle">${lab}</text>`
      : `<text class="glab" x="${X((gq.from + gq.to) / 2)}" y="${gy - 4}" text-anchor="middle">${lab}</text>`;
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
function grooveRows(p) {
  return (p.grooves || []).map(g => `<tr class="grv"><td></td><td>Паз под заднюю стенку</td><td>Пласть ${g.face}</td><td colspan="2">${g.axis === 'y' ? `X ${fmt(g.pos)}…${fmt(g.pos + g.w)}, по Y ${fmt(g.from)}…${fmt(g.to)}` : `Y ${fmt(g.pos)}…${fmt(g.pos + g.w)}, по X ${fmt(g.from)}…${fmt(g.to)}`}</td><td>шир. ${fmt(g.w)}</td><td>${fmt(g.depth)}</td><td></td></tr>`).join('');
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
  $('#eL').value = p.L; $('#eW').value = p.W;
  $('#btnResetSize').disabled = !p.resized; $('#btnExclude').textContent = p.role === 'custom' ? 'Удалить деталь' : 'Исключить деталь';
  $('#holesTbl').innerHTML = p.holes.length || p.grooves?.length ? holeHead + '<tbody>' + holeRows(p) + grooveRows(p) + '</tbody>' : '<tr><td class="muted">Отверстий нет</td></tr>';
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
$('#btnResize').onclick = () => {
  const g = findGroup(sel.uid); if (!g) return;
  const L = Number($('#eL').value), W = Number($('#eW').value);
  if (!(L > 0 && W > 0)) { toast('Укажи размеры'); return; }
  for (const p of g.parts) {
    if (p.role === 'custom') { const c = ovFor(p); c.L = L; c.W = W; }
    else { const o = ovFor(p); o.L = L; o.W = W; }
  }
  update(); toast('Размер изменён');
};
$('#btnResetSize').onclick = () => {
  const g = findGroup(sel.uid); if (!g) return;
  for (const p of g.parts) if (p.role !== 'custom') { const o = ovFor(p); delete o.L; delete o.W; }
  update(); toast('Возвращён авторазмер');
};
$('#btnExclude').onclick = () => {
  const g = findGroup(sel.uid); if (!g) return;
  if (!confirm(`Убрать «${g.rep.name}» (${g.qty} шт) из проекта?`)) return;
  for (const p of g.parts) {
    if (p.role === 'custom') project.custom = project.custom.filter(c => 'c:' + c.id !== p.uid);
    else ovFor(p).off = true;
  }
  sel.uid = null; update(); toast('Деталь исключена — вернуть можно во вкладке «Детали»');
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

// ---------- Смета ----------
const LSP = 'mebel-prices-v1';
function prices() {
  if (!project.prices) { let d = null; try { d = JSON.parse(localStorage.getItem(LSP) || 'null'); } catch (e) { /* нет */ } project.prices = d || { cur: 'Ft', markup: 0, v: {} }; }
  project.prices.v = project.prices.v || {};
  return project.prices;
}
function savePrices() { saveLocal(); try { localStorage.setItem(LSP, JSON.stringify(project.prices)); } catch (e) { /* нет */ } }
function costRows() {
  const s = C.summary(built, project), res = C.nest(built, project.settings), P = prices();
  const rows = [];
  const add = (sec, key, name, qty, unit) => rows.push({ sec, key, name, qty, unit, price: Number(P.v[key]) || 0 });
  const SA = project.settings.sheetL * project.settings.sheetW / 1e6;
  for (const m of res) {
    const q = P.byArea ? Math.round((s.area[m.mat] || 0) * 1.15 / SA * 100) / 100 : m.sheets.length;
    add('Плитные материалы', 'sheet:' + m.mat, `${m.mat}, лист ${project.settings.sheetL}×${project.settings.sheetW}${P.byArea ? ' (по площади +15%)' : ''}`, q, 'лист');
  }
  const wt = {};
  for (const g of built.groups) if (g.rep.role === 'worktop') wt[g.rep.material] = (wt[g.rep.material] || 0) + g.rep.L * g.qty / 1000;
  for (const [m, len] of Object.entries(wt)) add('Плитные материалы', 'worktop:' + m, `${m} (погонные метры)`, Math.round(len * 100) / 100, 'м');
  for (const h of s.hw.filter(h => h[3].startsWith('edge:'))) add('Кромка', h[3], h[0], h[1], h[2]);
  add('Услуги', 'svc:cut', 'Распил (по длине реза)', s.cutLen, 'м');
  const edgeTotal = Object.values(s.edge).reduce((a, b) => a + b, 0);
  add('Услуги', 'svc:band', 'Кромкование (работа)', Math.round(edgeTotal * 10) / 10, 'м');
  add('Услуги', 'svc:drill', 'Присадка (сверление)', s.holes, 'отв.');
  for (const h of s.hw.filter(h => !h[3].startsWith('edge:'))) add('Фурнитура', 'hw:' + h[3], h[0], h[1], h[2]);
  return rows;
}
function renderCost() {
  const P = prices(), rows = costRows();
  $('#curSel').value = P.cur || 'Ft'; $('#markup').value = P.markup || 0; $('#byArea').checked = !!P.byArea;
  let html = '<div class="tblwrap"><table class="tbl cost"><thead><tr><th>Позиция</th><th>Кол-во</th><th>Ед.</th><th>Цена за ед.</th><th>Сумма</th></tr></thead><tbody>';
  let last = '', total = 0;
  const secSum = {};
  for (const r of rows) {
    const sum = r.qty * r.price; total += sum; secSum[r.sec] = (secSum[r.sec] || 0) + sum;
    if (r.sec !== last) { html += `<tr class="grp"><td colspan="5">${r.sec}</td></tr>`; last = r.sec; }
    html += `<tr><td>${esc(r.name)}</td><td class="n">${fmt(r.qty)}</td><td>${r.unit}</td><td><input type="number" min="0" step="any" class="price" data-key="${esc(r.key)}" value="${r.price || ''}" placeholder="0"></td><td class="n">${money(sum)}</td></tr>`;
  }
  const mk = Number(P.markup) || 0;
  html += `</tbody><tfoot>${Object.entries(secSum).map(([k, v]) => `<tr><td colspan="4">${k}</td><td class="n">${money(v)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="4">Себестоимость</td><td class="n">${money(total)}</td></tr>
    <tr class="tot"><td colspan="4">Цена с наценкой ${mk}%</td><td class="n">${money(total * (1 + mk / 100))}</td></tr></tfoot></table></div>`;
  $('#costOut').innerHTML = html;
}
const money = v => `${(Math.round(v * 100) / 100).toLocaleString('ru-RU')} ${esc(prices().cur || '')}`;
$('#costOut').addEventListener('change', e => {
  const k = e.target.dataset.key; if (!k) return;
  prices().v[k] = Number(e.target.value) || 0; savePrices(); renderCost();
});
$('#curSel').onchange = e => { prices().cur = e.target.value; savePrices(); renderCost(); };
$('#byArea').onchange = e => { prices().byArea = e.target.checked; savePrices(); renderCost(); };
$('#markup').onchange = e => { prices().markup = Number(e.target.value) || 0; savePrices(); renderCost(); };
$('#btnCostCSV').onclick = () => {
  const rows = costRows(), P = prices();
  const out = [['Раздел', 'Позиция', 'Кол-во', 'Ед.', `Цена, ${P.cur}`, `Сумма, ${P.cur}`], ...rows.map(r => [r.sec, r.name, r.qty, r.unit, r.price, Math.round(r.qty * r.price * 100) / 100])];
  const total = rows.reduce((a, r) => a + r.qty * r.price, 0);
  out.push(['', 'Себестоимость', '', '', '', Math.round(total * 100) / 100], ['', `С наценкой ${P.markup || 0}%`, '', '', '', Math.round(total * (1 + (P.markup || 0) / 100) * 100) / 100]);
  download(fileBase() + '_smeta.csv', C.toCSV(out, { sep: ';', comma: true }), 'text/csv;charset=utf-8');
};

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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
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
    if ((p.role === 'front' || p.role === 'slide') && !showF) continue;
    const size = C.worldSize(p);
    const mat = new THREE.MeshStandardMaterial({ color: matColor(p.material.replace('Дверь-купе: ', ''), p.role), roughness: 0.8, transparent: transp && !['front', 'slide', 'worktop'].includes(p.role), opacity: transp && !['front', 'slide', 'worktop'].includes(p.role) ? 0.3 : 1, depthWrite: !(transp && !['front', 'slide', 'worktop'].includes(p.role)) });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    const pc = new THREE.Vector3(p.ox + size[0] / 2, p.oy + size[1] / 2, p.oz + size[2] / 2);
    let off = new THREE.Vector3();
    if (expl) {
      off = pc.clone().sub(new THREE.Vector3(center.x, d.H / 2, center.z)).multiplyScalar(0.35);
      if (p.role === 'front') off.z += 150;
    }
    mesh.position.copy(pc).sub(center).add(off);
    mesh.userData.uid = p.uid;
    mesh.userData.no = findGroup(p.uid)?.no;
    if ($('#optNums').checked && mesh.userData.no) {
      const d0 = document.createElement('div'); d0.className = 'num3d'; d0.textContent = mesh.userData.no;
      const lo = new T3.CSS2DObject(d0); mesh.add(lo);
    }
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
  const ex = g.extra || {}, bot = parts.find(p => p.id === 'bottom');
  if (ex.legs && bot && ex.legsH > 0) {
    const legMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.5, roughness: 0.4 });
    const Dc = bot.W, xs = ex.legs > 4 ? [50, d.W / 2, d.W - 50] : [50, d.W - 50];
    for (const lx of xs) for (const lz of [50, Dc - 50]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(18, 14, ex.legsH, 16), legMat);
      leg.position.set(lx, ex.legsH / 2, lz).sub(center);
      group.add(leg);
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
for (const id of ['#optFronts', '#optTransp', '#optHoles', '#optExplode', '#optDims', '#optNums']) $(id).addEventListener('change', render3d);
$('#btnResetView').onclick = () => { const g = built.items[sel.item]; if (T3 && g) fitCamera(g.dims, true); };

// ---------- Шаблоны 1:1 ----------
// Лист A4 альбомный, поля 8 мм: рабочая зона 279×166 мм (сверху 14 мм на подписи), перекрытие листов 10 мм
const TW = 279, TH = 166, OV = 10;
function ruler() {
  let o = `<g transform="translate(0,${TH + 6})"><line x1="0" y1="0" x2="100" y2="0" stroke="#000" stroke-width="0.4"/>`;
  for (let i = 0; i <= 10; i++) o += `<line x1="${i * 10}" y1="${i % 5 ? -1.5 : -3}" x2="${i * 10}" y2="0" stroke="#000" stroke-width="0.3"/>`;
  return o + `<text x="103" y="1" font-size="3">← проверь линейкой: ровно 100 мм. Печатать в масштабе 100% («Фактический размер»).</text></g>`;
}
function holeMark(x, y, h) {
  const rr = h.d / 2, c = h.face === 'B' && !h.through ? '#c92a2a' : '#000';
  return `<circle cx="${x}" cy="${y}" r="${rr}" fill="none" stroke="${c}" stroke-width="0.3"/>` +
    `<line x1="${x - rr - 2}" y1="${y}" x2="${x + rr + 2}" y2="${y}" stroke="${c}" stroke-width="0.15"/><line x1="${x}" y1="${y - rr - 2}" x2="${x}" y2="${y + rr + 2}" stroke="${c}" stroke-width="0.15"/>` +
    `<text x="${x + rr + 1}" y="${y - 1}" font-size="2.4" fill="${c}">Ø${fmt(h.d)}${h.through ? ' скв.' : '×' + fmt(h.depth)} (${fmt(h.x)}; ${fmt(h.y)})</text>`;
}
const tplPage = (title, body) => `<div class="tpl-page"><div class="tpl-h">${title}</div><svg xmlns="http://www.w3.org/2000/svg" width="${TW}mm" height="${TH + 10}mm" viewBox="0 0 ${TW} ${TH + 10}" font-family="sans-serif">${body}${ruler()}</svg></div>`;
// Листы на пласть: face 'A' — вид со стороны A; 'B' — вид со стороны B (зеркально по X)
function faceTemplates(g, face) {
  const p = g.rep, pages = [];
  const holes = p.holes.filter(h => h.face && (h.face === face || h.through));
  if (!holes.length) return pages;
  const mx = x => (face === 'B' ? p.L - x : x);
  const stepX = TW - OV, stepY = TH - OV;
  const nx = Math.max(1, Math.ceil((p.L - OV) / stepX)), ny = Math.max(1, Math.ceil((p.W - OV) / stepY));
  const tiles = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x0 = i * stepX, y0 = j * stepY;
    const inside = holes.filter(h => { const hx = mx(h.x); return hx >= x0 - 1 && hx <= x0 + TW + 1 && h.y >= y0 - 1 && h.y <= y0 + TH + 1; });
    if (inside.length) tiles.push({ i, j, x0, y0, inside });
  }
  tiles.forEach((tl, k) => {
    const X = x => mx(x) - tl.x0, Y = y => TH - (y - tl.y0);
    // контур детали в пределах листа
    const rx0 = Math.max(0, -tl.x0), ry1 = Math.min(TH, TH + tl.y0), rx1 = Math.min(TW, p.L - tl.x0), ry0 = Math.max(0, TH - (p.W - tl.y0));
    let b = `<rect x="${rx0}" y="${ry0}" width="${rx1 - rx0}" height="${ry1 - ry0}" fill="none" stroke="#999" stroke-width="0.2" stroke-dasharray="2 1"/>`;
    const edgesIn = [];
    if (tl.x0 <= 0) edgesIn.push(face === 'B' ? 'Ш2' : 'Ш1'); if (tl.x0 + TW >= p.L) edgesIn.push(face === 'B' ? 'Ш1' : 'Ш2');
    if (tl.y0 <= 0) edgesIn.push('Д1'); if (tl.y0 + TH >= p.W) edgesIn.push('Д2');
    for (const [e, x1, y1, x2, y2] of [['L', 0, 0, p.L, 0], ['L', 0, p.W, p.L, p.W], ['W', 0, 0, 0, p.W], ['W', p.L, 0, p.L, p.W]])
      b += `<line x1="${mx(x1) - tl.x0}" y1="${Y(y1)}" x2="${mx(x2) - tl.x0}" y2="${Y(y2)}" stroke="#000" stroke-width="0.5"/>`;
    b = `<defs><clipPath id="c${k}${face}${g.no}"><rect x="0" y="0" width="${TW}" height="${TH}"/></clipPath></defs><g clip-path="url(#c${k}${face}${g.no})">${b}`;
    for (const h of tl.inside) b += holeMark(X(h.x), Y(h.y), h);
    b += '</g>';
    if (tl.x0 > 0) b += `<line x1="${OV}" y1="0" x2="${OV}" y2="${TH}" stroke="#2f7de1" stroke-width="0.2" stroke-dasharray="1 1"/><text x="${OV + 1}" y="4" font-size="2.5" fill="#2f7de1">совместить с предыдущим листом</text>`;
    if (tl.y0 > 0) b += `<line x1="0" y1="${TH - OV}" x2="${TW}" y2="${TH - OV}" stroke="#2f7de1" stroke-width="0.2" stroke-dasharray="1 1"/>`;
    pages.push(tplPage(`№${g.no} ${esc(p.name)} ${fmt(p.L)}×${fmt(p.W)} — пласть ${face}${face === 'B' ? ' (зеркально, накладывать на обратную сторону)' : ''} · лист ${k + 1}/${tiles.length} · X ${fmt(tl.x0)}…${fmt(Math.min(p.L, tl.x0 + TW))}, Y ${fmt(tl.y0)}…${fmt(Math.min(p.W, tl.y0 + TH))} · совмести с кромками ${edgesIn.join(', ') || '— (по меткам)'}`, b));
  });
  return pages;
}
// Полоски на торцы: длина вдоль торца, высота = толщина детали
function edgeTemplates(g) {
  const p = g.rep, strips = [];
  for (const e of ['L1', 'L2', 'W1', 'W2']) {
    const hs = p.holes.filter(h => h.edge === e);
    if (!hs.length) continue;
    const len = e[0] === 'L' ? p.L : p.W, pos = h => (e[0] === 'L' ? h.x : h.y);
    for (let a = 0; a < len; a += TW - OV) {
      const ins = hs.filter(h => pos(h) >= a - 1 && pos(h) <= a + TW + 1);
      if (ins.length) strips.push({ e, a, len, ins, pos });
    }
  }
  const pages = [], per = 5;
  for (let k = 0; k < strips.length; k += per) {
    let b = '';
    strips.slice(k, k + per).forEach((st, q) => {
      const y0 = q * 34 + 8, w = Math.min(TW, st.len - st.a);
      b += `<text x="0" y="${y0 - 2}" font-size="3">Торец ${C.EDGE_NAMES[st.e]} · ${fmt(st.a)}…${fmt(st.a + w)} мм (отсчёт от ${st.e[0] === 'L' ? 'Ш1' : 'Д1'}) · толщина ${p.T}</text>`;
      b += `<rect x="0" y="${y0}" width="${w}" height="${p.T}" fill="none" stroke="#000" stroke-width="0.4"/>`;
      b += `<line x1="0" y1="${y0 + p.T / 2}" x2="${w}" y2="${y0 + p.T / 2}" stroke="#999" stroke-width="0.15" stroke-dasharray="2 1"/>`;
      for (const h of st.ins) {
        const x = st.pos(h) - st.a, cy = y0 + p.T / 2, rr = h.d / 2;
        b += `<circle cx="${x}" cy="${cy}" r="${rr}" fill="none" stroke="#2b8a3e" stroke-width="0.3"/><line x1="${x}" y1="${y0 - 2}" x2="${x}" y2="${y0 + p.T + 2}" stroke="#2b8a3e" stroke-width="0.15"/>`;
        b += `<text x="${x + 1}" y="${y0 + p.T + 4}" font-size="2.4" fill="#2b8a3e">${fmt(st.pos(h))} · Ø${fmt(h.d)}×${fmt(h.depth)}</text>`;
      }
    });
    pages.push(tplPage(`№${g.no} ${esc(p.name)} ${fmt(p.L)}×${fmt(p.W)}×${p.T} — шаблоны на торцы (вырежи полоску и приложи к торцу)`, b));
  }
  return pages;
}
function templatesFor(groups) {
  return groups.flatMap(g => [...faceTemplates(g, 'A'), ...faceTemplates(g, 'B'), ...edgeTemplates(g)]);
}
function printTemplates(groups) {
  const pages = templatesFor(groups);
  if (!pages.length) { toast('У детали нет отверстий'); return; }
  $('#print').innerHTML = pages.join('');
  document.body.classList.add('print-tpl');
  setTimeout(() => window.print(), 50);
}
window.addEventListener('afterprint', () => document.body.classList.remove('print-tpl'));
$('#btnTpl1').onclick = () => { const g = findGroup(sel.uid); if (g) printTemplates([g]); };
$('#btnTplAll').onclick = () => printTemplates(built.groups.filter(g => g.rep.holes.length));

// ---------- Схема сборки ----------
function assemblySteps(idx) {
  const gs = built.groups.filter(g => g.rep.itemIdx === idx);
  const P = project.items[idx].params, ex = built.items[idx]?.extra || {};
  const by = re => gs.filter(g => re.test(g.rep.id) || re.test(g.rep.name));
  const L = arr => arr.map(g => `№${g.no}${g.qty > 1 ? ` (${g.qty} шт)` : ''}`).join(', ');
  const fast = { conf: 'конфирматы 7×50 (сверло под конфирмат, затем шестигранник)', minifix: 'шканты на клей + эксцентрики (вкрути штоки, вставь шканты, соедини и затяни эксцентрики)', dowel: 'шканты на клей ПВА, стянуть струбцинами' }[ex.joint || 'conf'];
  const st = [];
  st.push(`Разложи детали по номерам (номера — как в спецификации и на схеме). Проверь кромку и присадку по чертежам.`);
  const sides = by(/^side/), bottom = by(/^bottom$/), plinth = by(/^plinth$/);
  st.push(`Корпус: соедини боковины ${L(sides)} с дном ${L(bottom)}${plinth.length ? ` и цоколем ${L(plinth)}` : ''}. Крепёж: ${fast}.`);
  const parts = by(/^part\d/);
  if (parts.length) st.push(`Установи вертикальные перегородки ${L(parts)} на дно.`);
  const top = by(/^top$/), rails = by(/^rail/);
  if (top.length) st.push(`Установи крышку ${L(top)}.`);
  if (rails.length) st.push(`Установи царги ${L(rails)}.`);
  const dv = gs.filter(g => /dv\d/.test(g.rep.id)), fixedSh = gs.filter(g => g.rep.name === 'Полка' && g.rep.holes.length);
  if (dv.length || fixedSh.length) st.push(`Установи полки-перегородки и неподвижные полки ${L([...dv, ...fixedSh])}.`);
  const back = by(/^back$/);
  if (back.length) st.push(/в паз/.test(back[0].rep.name)
    ? `Задняя стенка ${L(back)} заводится в паз до установки крышки (шаги 2–4 выполняй с уже вставленной стенкой).`
    : `Проверь диагонали корпуса (должны быть равны) и прибей/прикрути заднюю стенку ${L(back)} — она фиксирует геометрию.`);
  if (ex.legs) st.push(`Прикрути ножки (${ex.legs} шт) к дну.`);
  if (ex.hang) st.push('Прикрути навесы в верхних углах боковин, на стене — монтажную шину или крюки; выставь по уровню регулировкой навесов.');
  const box = gs.filter(g => g.rep.role === 'box' || /Ящик: дно/.test(g.rep.name));
  if (box.length) st.push(`Собери короба ящиков ${L(box)} на конфирматах, прибей дно. Установи направляющие (${ex.runnerLabel}, L=${ex.runnerLen}) на боковины корпуса и короба, вставь ящики, прикрути фасады ${L(by(/Фасад/))} изнутри короба и выставь зазоры.`);
  const doors = gs.filter(g => g.rep.role === 'front' && /Дверь/.test(g.rep.name));
  if (doors.length) st.push(`Запрессуй петли в двери ${L(doors)}, прикрути планки к корпусу, навесь двери и отрегулируй зазоры (${P.gap} мм) винтами петель.`);
  const pinSh = gs.filter(g => g.rep.name === 'Полка' && !g.rep.holes.length);
  if (pinSh.length) st.push(`Вставь полкодержатели и уложи полки ${L(pinSh)}.`);
  if (ex.slide) st.push(`Шкаф-купе: прикрути верхнюю и нижнюю направляющие (L=${ex.slide.openW}), установи двери ${ex.slide.dw}×${ex.slide.dh} (${ex.slide.n} шт) — сначала задний путь, потом передний, отрегулируй ролики.`);
  if (by(/^worktop$/).length) st.push(`Установи столешницу ${L(by(/^worktop$/))} — крепи снизу через царги саморезами, торцы закрой планками/кромкой.`);
  st.push('Вставь заглушки, протри, проверь работу дверей и ящиков.');
  return st;
}
function captureAssembly() {
  const nums = $('#optNums').checked, expl = $('#optExplode').checked, fr = $('#optFronts').checked;
  $('#optNums').checked = false; $('#optExplode').checked = true; $('#optFronts').checked = true;
  render3d(); T3.renderer.render(T3.scene, T3.camera);
  const src = T3.renderer.domElement, c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(src, 0, 0);
  const k = src.width / src.clientWidth, seen = new Set();
  ctx.font = `bold ${13 * k}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const m of T3.meshes) {
    const no = m.userData.no; if (!no) continue;
    const v = m.getWorldPosition(new T3.THREE.Vector3()).project(T3.camera);
    const x = (v.x + 1) / 2 * c.width, y = (1 - v.y) / 2 * c.height, key = `${no}:${Math.round(x / 20)}:${Math.round(y / 20)}`;
    if (seen.has(key)) continue; seen.add(key);
    ctx.fillStyle = '#2b2520'; ctx.beginPath(); ctx.arc(x, y, 11 * k, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * k; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillText(no, x, y + 0.5 * k);
  }
  $('#optNums').checked = nums; $('#optExplode').checked = expl; $('#optFronts').checked = fr; render3d();
  return c.toDataURL('image/png');
}
$('#btnAssembly').onclick = () => {
  if (!T3) { toast('3D-вид ещё не загрузился'); return; }
  const it = project.items[sel.item]; if (!it) return;
  const img = captureAssembly(), steps = assemblySteps(sel.item);
  const gs = built.groups.filter(g => g.rep.itemIdx === sel.item);
  $('#print').innerHTML = `<div class="pr-page asm"><h2>Схема сборки: ${esc(it.params.name)}</h2><img src="${img}" alt="Схема сборки">
    <h3>Порядок сборки</h3><ol>${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
    <div class="pr-page"><h3>Детали</h3><table class="tbl"><thead><tr><th>№</th><th>Деталь</th><th>Д×Ш×Т</th><th>Кол.</th></tr></thead><tbody>${gs.map(g => `<tr><td>${g.no}</td><td>${esc(g.rep.name)}</td><td>${fmt(g.rep.L)}×${fmt(g.rep.W)}×${g.rep.T}</td><td>${g.qty}</td></tr>`).join('')}</tbody></table></div>`;
  setTimeout(() => window.print(), 80);
};

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
      ${drawSVG(p)}${p.holes.length || p.grooves?.length ? `<table class="tbl small">${holeHead}<tbody>${holeRows(p)}${grooveRows(p)}</tbody></table>` : ''}</div>`;
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

$('#btnUndo').onclick = () => histGo(-1);
$('#btnRedo').onclick = () => histGo(1);
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const tag = document.activeElement?.tagName, typing = (tag === 'INPUT' && !['checkbox', 'radio'].includes(document.activeElement.type)) || tag === 'TEXTAREA';
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); histGo(-1); }
  else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); histGo(1); }
});

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
  histSnap(true);
})();
