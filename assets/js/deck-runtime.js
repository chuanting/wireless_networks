/*
 * 幻灯片运行时：加载 decks/<id>/deck.json 与 slides/*.html，
 * 并把「受限 HTML 幻灯片格式」渲染成浏览器里可直接放映的页面。
 *
 * 幻灯片格式（1920×1080 画布，行内样式）里的自定义元素在这里转换为 SVG/DIV：
 *   <x-connector x1 y1 x2 y2 head=end|both|none>  → 直线 / 箭头
 *   <x-shape kind=ellipse|arrow-*>                  → 椭圆 / 块箭头
 *   <x-icon name=…>                                 → 线性图标
 *   data-build-in="fade|rise|pop N"                 → 第 N 次点击时出现
 *   <aside>                                         → 演讲备注（不显示在页面上）
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/* ---------- 加载 ---------- */
export async function loadDeck(deckId, onProgress) {
  if (!/^[\w.-]+$/.test(deckId)) throw new Error('非法的课件名：' + deckId);
  const base = '../decks/' + deckId + '/';
  const r = await fetch(base + 'deck.json');
  if (!r.ok) throw new Error('找不到课件 ' + deckId + '（' + r.status + '）');
  const meta = await r.json();
  let done = 0;
  const htmls = await Promise.all(meta.order.map(async (id) => {
    const res = await fetch(base + 'slides/' + id + '.html');
    if (!res.ok) throw new Error('缺少幻灯片 ' + id + '（' + res.status + '）');
    const text = await res.text();
    if (onProgress) onProgress(++done, meta.order.length);
    return text;
  }));
  const slides = meta.order.map((id, i) => ({ id, html: htmls[i] }));
  const idxOf = new Map(meta.order.map((id, i) => [id, i]));
  const sections = Object.entries(meta.sections || {})
    .map(([key, s]) => ({ key, description: s.description, start: idxOf.has(s.start) ? idxOf.get(s.start) : 0 }))
    .sort((a, b) => a.start - b.start);
  return { id: deckId, meta, slides, sections };
}

export function sectionAt(deck, idx) {
  let cur = null;
  for (const s of deck.sections) if (s.start <= idx) cur = s;
  return cur;
}

/* ---------- 渲染一页 ---------- */
export function renderSlide(html) {
  const host = document.createElement('div');
  host.innerHTML = html.trim();
  const sec = host.querySelector('section');
  if (!sec) throw new Error('幻灯片里没有 <section>');
  let notes = '';
  const aside = Array.from(sec.children).find((c) => c.tagName === 'ASIDE');
  if (aside) { notes = aside.textContent.replace(/\r/g, '').trim(); aside.remove(); }
  sec.classList.add('slide');
  sec.setAttribute('role', 'group');
  sec.setAttribute('aria-roledescription', 'slide');
  sec.querySelectorAll('x-connector').forEach((el) => el.replaceWith(makeConnector(el)));
  sec.querySelectorAll('x-shape').forEach((el) => el.replaceWith(makeShape(el)));
  sec.querySelectorAll('x-icon').forEach((el) => el.replaceWith(makeIcon(el)));
  parseBuilds(sec);
  const h = sec.querySelector('h1,h2');
  return { el: sec, notes, title: h ? h.textContent.trim() : '' };
}

/* ---------- 点击出现 ---------- */
function parseBuilds(sec) {
  const EFFECTS = ['fade', 'rise', 'pop', 'drop', 'left', 'right', 'scale'];
  const items = Array.from(sec.querySelectorAll('[data-build-in]')).map((node) => {
    const t = (node.getAttribute('data-build-in') || '').trim().split(/\s+/);
    const num = t.find((x) => /^\d+$/.test(x));
    return { node, effect: EFFECTS.includes(t[0]) ? t[0] : 'fade', order: num ? parseInt(num, 10) : 1 };
  });
  const orders = Array.from(new Set(items.map((i) => i.order))).sort((a, b) => a - b);
  items.forEach((i) => { i.rank = orders.indexOf(i.order); i.node.classList.add('build'); i.node.dataset.effect = i.effect; });
  sec._builds = items;
  sec._steps = orders.length;
  setStep(sec, 0);
}
export function setStep(sec, k) {
  (sec._builds || []).forEach((i) => i.node.classList.toggle('bhid', i.rank >= k));
}
export function stepsOf(sec) { return sec._steps || 0; }

/* ---------- 缩略图 ---------- */
export function mountScaled(box, slideEl) {
  box.textContent = '';
  const scaler = document.createElement('div');
  scaler.className = 'scaler';
  scaler.appendChild(slideEl);
  box.appendChild(scaler);
  const fit = () => { const w = box.clientWidth; if (w) scaler.style.transform = 'scale(' + (w / 1920) + ')'; };
  fit();
  if (window.ResizeObserver) new ResizeObserver(fit).observe(box);
}

/* ---------- 自定义元素 → SVG ---------- */
function fromSvg(markup) {
  const w = document.createElement('div');
  w.innerHTML = markup;
  return w.firstElementChild;
}
function num(v, d) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
function boxStyle(st) {
  return ['position', 'left', 'top', 'right', 'bottom', 'width', 'height', 'opacity', 'transform']
    .filter((p) => st[p]).map((p) => p.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()) + ':' + st[p]).join(';');
}

function makeConnector(el) {
  const x1 = num(el.getAttribute('x1'), 0), y1 = num(el.getAttribute('y1'), 0);
  const x2 = num(el.getAttribute('x2'), 0), y2 = num(el.getAttribute('y2'), 0);
  const st = el.style;
  const color = st.color || '#000';
  const w = num(st.borderWidth, 2);
  const bst = st.borderStyle || 'solid';
  const head = (el.getAttribute('head') || 'end').toLowerCase();
  let hs = head === 'both', he = head === 'end' || head === 'both';
  const hsAttr = el.getAttribute('head-start'), heAttr = el.getAttribute('head-end');
  if (hsAttr) hs = hsAttr !== 'none';
  if (heAttr) he = heAttr !== 'none';

  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const hl = Math.max(16, Math.min(30, w * 2.6)), hw = hl * 0.52;
  let ax = x1, ay = y1, bx = x2, by = y2, polys = '';
  const poly = (tx, ty, dx, dy) => {      // 箭头：尖端 (tx,ty)，方向 (dx,dy)
    const bx0 = tx - dx * hl, by0 = ty - dy * hl, nx = -dy, ny = dx;
    return '<polygon points="' + tx + ',' + ty + ' ' + (bx0 + nx * hw) + ',' + (by0 + ny * hw) + ' ' + (bx0 - nx * hw) + ',' + (by0 - ny * hw) + '" fill="' + color + '"/>';
  };
  if (he) { polys += poly(x2, y2, ux, uy); bx = x2 - ux * (hl - 2); by = y2 - uy * (hl - 2); }
  if (hs) { polys += poly(x1, y1, -ux, -uy); ax = x1 + ux * (hl - 2); ay = y1 + uy * (hl - 2); }
  let dash = '', cap = 'butt';
  if (bst === 'dashed') dash = ' stroke-dasharray="' + (w * 2.6) + ' ' + (w * 1.7) + '"';
  if (bst === 'dotted') { dash = ' stroke-dasharray="0.1 ' + (w * 2) + '"'; cap = 'round'; }
  return fromSvg('<svg class="conn" width="1920" height="1080" viewBox="0 0 1920 1080" style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none" aria-hidden="true">' +
    '<line x1="' + ax + '" y1="' + ay + '" x2="' + bx + '" y2="' + by + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="' + cap + '"' + dash + '/>' + polys + '</svg>');
}

function makeShape(el) {
  const kind = (el.getAttribute('kind') || 'rect').toLowerCase();
  const st = el.style;
  if (kind === 'ellipse' || kind === 'rect' || kind === 'rounded') {
    const d = document.createElement('div');
    d.setAttribute('style', el.getAttribute('style') || '');
    if (kind === 'ellipse') d.style.borderRadius = '50%';
    if (kind === 'rounded') d.style.borderRadius = d.style.borderRadius || '16px';
    d.setAttribute('aria-hidden', 'true');
    return d;
  }
  const w = num(st.width, 100), h = num(st.height, 60);
  const fill = st.backgroundColor || st.background || '#888';
  let pts;
  switch (kind) {
    case 'arrow-left':  pts = [[w, .25 * h], [.4 * w, .25 * h], [.4 * w, 0], [0, .5 * h], [.4 * w, h], [.4 * w, .75 * h], [w, .75 * h]]; break;
    case 'arrow-up':    pts = [[.25 * w, h], [.75 * w, h], [.75 * w, .4 * h], [w, .4 * h], [.5 * w, 0], [0, .4 * h], [.25 * w, .4 * h]]; break;
    case 'arrow-down':  pts = [[.25 * w, 0], [.75 * w, 0], [.75 * w, .6 * h], [w, .6 * h], [.5 * w, h], [0, .6 * h], [.25 * w, .6 * h]]; break;
    case 'diamond':     pts = [[.5 * w, 0], [w, .5 * h], [.5 * w, h], [0, .5 * h]]; break;
    case 'line':        pts = [[0, .5 * h - 1], [w, .5 * h - 1], [w, .5 * h + 1], [0, .5 * h + 1]]; break;
    default:            pts = [[0, .25 * h], [.6 * w, .25 * h], [.6 * w, 0], [w, .5 * h], [.6 * w, h], [.6 * w, .75 * h], [0, .75 * h]]; // arrow-right
  }
  return fromSvg('<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="' + boxStyle(st) + '" aria-hidden="true">' +
    '<polygon points="' + pts.map((p) => p.join(',')).join(' ') + '" fill="' + fill + '"/></svg>');
}

const ICONS = {
  Database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  Chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z"/>',
  Check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  CheckCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  Clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  Globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  Users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14c2.7 0 4.5 2 4.5 5"/>',
  Lightbulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  Link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  Search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  Star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9-4.3-4.1 5.9-.8z"/>',
  Warning: '<path d="M12 4L2.5 20h19z"/><path d="M12 10v5M12 17.5v.5"/>',
  Cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z"/>',
  Code: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  Chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  Activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  Lightning: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  Settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  Lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  Key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  Home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
  Book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  PaperPlane: '<path d="M21 3L3 11l7 3 3 7z"/><path d="M10 14l11-11"/>'
};
function makeIcon(el) {
  const name = el.getAttribute('name') || '';
  const st = el.style;
  const body = ICONS[name] || '<circle cx="12" cy="12" r="8"/>';
  return fromSvg('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
    'style="display:block;flex:none;color:' + (st.color || 'currentColor') + ';width:' + (st.width || '48px') + ';height:' + (st.height || '48px') + ';' + boxStyle({ position: st.position, left: st.left, top: st.top, right: st.right, bottom: st.bottom }) + '" aria-label="' + name + '" role="img">' + body + '</svg>');
}
