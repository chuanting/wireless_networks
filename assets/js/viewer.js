import { loadDeck, renderSlide, setStep, stepsOf, mountScaled, sectionAt } from './deck-runtime.js';
import { createRoute, resolveIndex, adjacentIndex, routePosition } from './route.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const deckId = q.get('deck') || '';
const loader = $('#loader'), loaderMsg = $('#loader-msg');

let deck = null, N = 0, idx = -1, step = 0, cur = null, channel = null;
let route = null;
let liveDemo = null, demoGeneration = 0;
const LIVE_DEMOS = {
  queue: () => import('./queue-demo.js').then(module => module.mountQueueDemo),
  'mm-queue': () => import('./mm-queue-demo.js').then(module => module.mountMMQueueDemo),
  mg1: () => import('./mg1-demo.js').then(module => module.mountMG1Demo),
  'network-queue': () => import('./network-queue-demo.js').then(module => module.mountNetworkQueueDemo),
};

/* Only the main slide mounts live controls. Thumbnails, speaker previews and
   printed pages keep the useful static content stored in the slide source. */
function pauseDemo() { if (liveDemo) liveDemo.pause(); }
function disposeDemo() {
  demoGeneration++;
  if (liveDemo) liveDemo.destroy();
  liveDemo = null;
  document.body.classList.remove('interactive-slide');
}
async function mountDemo(slide) {
  const host = slide.querySelector('[data-live-demo]');
  const load = host && LIVE_DEMOS[host.dataset.liveDemo];
  if (!load) return;
  document.body.classList.add('interactive-slide');
  const generation = demoGeneration, fallback = host.innerHTML;
  try {
    const mount = await load();
    // The user may have changed slides before the module finished loading.
    if (generation !== demoGeneration || cur?.el !== slide || !host.isConnected) return;
    liveDemo = mount(host);
    if (document.hidden || !$('#overview').hidden || !$('#notes').hidden || !$('#help').hidden || !$('#blackout').hidden) pauseDemo();
  } catch (error) {
    if (generation !== demoGeneration || cur?.el !== slide) return;
    host.innerHTML = fallback;
    const message = document.createElement('p');
    message.setAttribute('role', 'status');
    message.style.cssText = 'font-size:28px;line-height:1.4;color:#B4381F;margin-top:20px';
    message.textContent = '互动演示暂时未能加载。可先按本页步骤讨论，刷新页面后重试。';
    host.appendChild(message);
    console.error('Live demo could not load:', error);
  }
}
function toggleBlackout() {
  const blackout = $('#blackout');
  blackout.hidden = !blackout.hidden;
  if (!blackout.hidden) pauseDemo();
}
function openHelp() { pauseDemo(); $('#help').hidden = false; }

function fail(text) {
  loader.classList.add('err');
  loaderMsg.innerHTML = text + '<br><a href="../index.html">← 返回课程目录</a>';
}

/* ---------- 课程信息（来自 data/course.js） ---------- */
function courseInfo() {
  const C = window.COURSE;
  if (C) for (const ch of C.chapters) for (const s of (ch.sections || [])) if (s.deck === deckId) return { chapter: ch, section: s };
  return {};
}
const info = courseInfo();
const targetMin = (info.section && info.section.minutes) || 60;

/* ---------- 计时器 ---------- */
let tStart = 0, tAcc = 0, tRun = false;
const elapsed = () => tAcc + (tRun ? performance.now() - tStart : 0);
const fmt = (ms) => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function timerToggle() { if (tRun) { tAcc += performance.now() - tStart; tRun = false; } else { tStart = performance.now(); tRun = true; } paintClock(); }
function timerReset() { tAcc = 0; tStart = performance.now(); paintClock(); }
function paintClock() {
  const c = $('#clock'); if (!c) return;
  const ms = elapsed();
  c.textContent = '⏱ ' + fmt(ms) + ' / ' + targetMin + ':00';
  c.classList.toggle('warn', ms > targetMin * 60000);
  c.classList.toggle('paused', !tRun);
}

/* ---------- 画布缩放 ---------- */
function fit() {
  const vp = $('#viewport');
  const s = Math.min(vp.clientWidth / 1920, vp.clientHeight / 1080);
  $('#stage').style.transform = 'translate(-50%, -50%) scale(' + s + ')';
}

/* ---------- 导航 ---------- */
function go(i, startStep, first) {
  i = resolveIndex(route, i);
  if (i < 0) return;
  const r = renderSlide(deck.slides[i].html);
  disposeDemo();
  const stage = $('#stage');
  const old = cur && cur.el;
  if (!first) r.el.classList.add('enter');
  stage.appendChild(r.el);
  if (old) setTimeout(() => old.remove(), 380);
  cur = r; idx = i;
  step = startStep === 'full' ? stepsOf(r.el) : (startStep || 0);
  setStep(r.el, step);
  r.el.setAttribute('aria-label', '第 ' + (i + 1) + ' 页，共 ' + N + ' 页');
  if (!first && !tRun && tAcc === 0) { tStart = performance.now(); tRun = true; }   // 第一次翻页时自动开始计时
  updateUI();
  broadcastState();
  mountDemo(r.el);
}
function next() {
  if (!cur) return;
  if (step < stepsOf(cur.el)) { step++; setStep(cur.el, step); updateUI(); broadcastState(); }
  else { const i = adjacentIndex(route, idx, 1); if (i !== null) go(i, 0); }
}
function prev() {
  if (!cur) return;
  if (step > 0) { step--; setStep(cur.el, step); updateUI(); broadcastState(); }
  else { const i = adjacentIndex(route, idx, -1); if (i !== null) go(i, 'full'); }
}

function updateRouteUI() {
  for (const id of ['#btn-core', '#ov-core']) {
    const button = $(id);
    button.hidden = !route.hasExtensions;
    button.setAttribute('aria-pressed', String(route.coreOnly));
    button.title = route.coreOnly ? '当前只讲核心，点击恢复完整课件' : '跳过拓展页，保留原始页码';
  }
  $('#ov-route-count').textContent = route.coreOnly
    ? '核心 ' + route.indices.length + ' 页 · 原始页码不变'
    : '全部 ' + N + ' 页' + (route.hasExtensions ? ' · 拓展 ' + route.extensions.size + ' 页' : '');
  if (route.coreOnly) q.set('core', '1'); else q.delete('core');
  const exportQuery = new URLSearchParams({ deck: deckId, print: 'auto' });
  if (route.coreOnly) exportQuery.set('core', '1');
  $('#export').href = '?' + exportQuery;
}

function toggleCore() {
  if (!route.hasExtensions) return;
  route = createRoute(deck.slides, deck.meta.teaching?.extensions, !route.coreOnly);
  updateRouteUI();
  if (ovBuilt) filterOverview();
  const target = resolveIndex(route, idx);
  if (target !== idx) go(target, 0);
  else { updateUI(); broadcastState(); }
  if (!$('#overview').hidden) markOverview();
}

function updateUI() {
  const position = routePosition(route, idx), total = route.indices.length;
  $('#counter').textContent = (idx + 1) + ' / ' + N + (route.coreOnly ? ' · 核心 ' + position + '/' + total : '');
  $('#progress i').style.width = (total > 1 ? (position - 1) / (total - 1) * 100 : 100) + '%';
  const sec = sectionAt(deck, idx);
  $('#section').textContent = sec ? sec.description : '';
  $('#n-body').textContent = cur.notes;
  const st = stepsOf(cur.el);
  $('#n-count').textContent = '第 ' + (idx + 1) + ' 页' + (st ? ' · 点击步骤 ' + step + '/' + st : '');
  $('#btn-prev').disabled = adjacentIndex(route, idx, -1) === null && step === 0;
  $('#btn-next').disabled = adjacentIndex(route, idx, 1) === null && step >= st;
  document.title = (idx + 1) + '/' + N + ' · ' + deck.meta.title;
  if (history.replaceState) history.replaceState(null, '', location.pathname + '?' + q + '#' + (idx + 1));
}

/* ---------- 与「讲者视图」窗口同步 ---------- */
function broadcastState() {
  if (!channel || !cur) return;
  const nextIdx = adjacentIndex(route, idx, 1), prevIdx = adjacentIndex(route, idx, -1);
  channel.postMessage({ type: 'state', idx, step, steps: stepsOf(cur.el), total: N,
    nextIdx, prevIdx, coreOnly: route.coreOnly, routePosition: routePosition(route, idx), routeTotal: route.indices.length,
    notes: cur.notes, title: cur.title });
}
function openSpeaker() {
  const speakerQuery = new URLSearchParams({ deck: deckId });
  if (route.coreOnly) speakerQuery.set('core', '1');
  const w = window.open('notes.html?' + speakerQuery + '#' + (idx + 1), 'wn-speaker', 'popup=yes,width=1200,height=800');
  if (!w) alert('浏览器拦截了弹出窗口，请允许本站弹出窗口后再试。');
}

/* ---------- 面板 ---------- */
function toggleNotes(force) {
  const n = $('#notes');
  n.hidden = force === undefined ? !n.hidden : !force;
  if (!n.hidden) pauseDemo();
  $('#btn-notes').setAttribute('aria-pressed', String(!n.hidden));
}
let ovBuilt = false;
function openOverview() {
  pauseDemo();
  const ov = $('#overview');
  if (!ovBuilt) buildOverview();
  ov.hidden = false;
  markOverview();
  const c = ov.querySelector('.thumb.cur'); if (c) c.scrollIntoView({ block: 'center' });
}
function markOverview() {
  $('#overview').querySelectorAll('.thumb').forEach((t) => t.classList.toggle('cur', +t.dataset.i === idx));
}
function closeOverview() { $('#overview').hidden = true; }
function filterOverview() {
  const visible = new Set(route.indices);
  $('#ov-body').querySelectorAll('.ov-grid').forEach((grid) => {
    let count = 0;
    grid.querySelectorAll('.thumb').forEach((thumb) => {
      thumb.hidden = !visible.has(+thumb.dataset.i);
      if (!thumb.hidden) count++;
    });
    grid.hidden = count === 0;
    grid.previousElementSibling.hidden = count === 0;
  });
}
function buildOverview() {
  const body = $('#ov-body');
  const secs = deck.sections.length ? deck.sections : [{ description: deck.meta.title, start: 0 }];
  secs.forEach((s, k) => {
    const end = k + 1 < secs.length ? secs[k + 1].start : N;
    const h = document.createElement('div'); h.className = 'ov-sec'; h.textContent = s.description;
    const g = document.createElement('div'); g.className = 'ov-grid';
    for (let i = s.start; i < end; i++) {
      const t = document.createElement('div'); t.className = 'thumb'; t.dataset.i = i; t.setAttribute('role', 'button'); t.tabIndex = 0;
      const r = renderSlide(deck.slides[i].html); setStep(r.el, stepsOf(r.el));
      mountScaled(t, r.el);
      const no = document.createElement('span'); no.className = 'no'; no.textContent = i + 1; t.appendChild(no);
      const kind = route.extensions.has(i) ? '拓展' : '核心';
      const badge = document.createElement('span'); badge.className = 'route-badge' + (kind === '拓展' ? ' extension' : '');
      badge.textContent = kind; t.appendChild(badge);
      t.setAttribute('aria-label', '第 ' + (i + 1) + ' 页 · ' + kind + ' · ' + r.title);
      g.appendChild(t);
    }
    body.append(h, g);
  });
  body.addEventListener('click', (e) => { const t = e.target.closest('.thumb'); if (t) { closeOverview(); go(+t.dataset.i, 0); } });
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const t = e.target.closest('.thumb'); if (t) { closeOverview(); go(+t.dataset.i, 0); } } });
  ovBuilt = true;
  filterOverview();
}
function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
}

/* ---------- 打印 / 导出 PDF ---------- */
async function printMode() {
  document.body.classList.add('print');
  loader.hidden = true;
  const host = document.createElement('div'); host.id = 'pages';
  route.indices.forEach((index) => {
    const s = deck.slides[index];
    const r = renderSlide(s.html); setStep(r.el, stepsOf(r.el));
    const p = document.createElement('div'); p.className = 'page'; p.dataset.originalPage = index + 1;
    p.appendChild(r.el); host.appendChild(p);
  });
  document.body.appendChild(host);
  if (q.get('print') === 'auto') { try { await document.fonts.ready; } catch (e) { /* ignore */ } setTimeout(() => window.print(), 600); }
}

/* ---------- 启动 ---------- */
async function main() {
  if (!deckId) { fail('缺少课件参数，例如：viewer/?deck=ch1-3-graph-theory'); return; }
  try {
    deck = await loadDeck(deckId, (d, n) => { loaderMsg.textContent = '正在加载课件… ' + d + ' / ' + n; });
  } catch (e) { fail(e.message); return; }
  N = deck.slides.length;
  if (!N) { fail('课件中没有幻灯片。'); return; }
  route = createRoute(deck.slides, deck.meta.teaching?.extensions, q.get('core') === '1');
  if (q.has('print')) { printMode(); return; }

  // 顶栏
  const back = $('#back');
  back.href = '../index.html' + (info.chapter ? '#' + info.chapter.id : '');
  $('#deck-title').textContent = (info.chapter ? '第' + info.chapter.no + '章 · ' : '') + (info.section ? info.section.no + ' ' : '') + deck.meta.title;
  updateRouteUI();

  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel('wn-deck-' + deckId);
    channel.onmessage = (e) => {
      const m = e.data || {};
      if (m.type !== 'cmd') return;
      if (m.cmd === 'hello') broadcastState();
      else if (m.cmd === 'next') next();
      else if (m.cmd === 'prev') prev();
      else if (m.cmd === 'home') go(route.indices[0], 0);
      else if (m.cmd === 'end') go(route.indices[route.indices.length - 1], 'full');
      else if (m.cmd === 'timer') timerToggle();
      else if (m.cmd === 'reset') timerReset();
    };
    setInterval(() => channel.postMessage({ type: 'tick', ms: elapsed(), running: tRun, target: targetMin }), 1000);
  }

  loader.hidden = true;
  $('#app').hidden = false;
  fit();
  new ResizeObserver(fit).observe($('#viewport'));
  const h = parseInt((location.hash || '').slice(1), 10);
  go(Number.isFinite(h) ? h - 1 : 0, 0, true);
  paintClock(); setInterval(paintClock, 500);

  /* 交互 */
  const click = (id, fn) => $(id).addEventListener('click', (e) => { fn(); e.currentTarget.blur(); });
  click('#btn-prev', prev); click('#btn-next', next);
  click('#hit-prev', () => { if (!document.body.classList.contains('interactive-slide')) prev(); });
  click('#hit-next', () => { if (!document.body.classList.contains('interactive-slide')) next(); });
  click('#btn-notes', () => toggleNotes()); click('#n-close', () => toggleNotes(false));
  click('#btn-speaker', openSpeaker); click('#btn-overview', openOverview);
  click('#btn-core', toggleCore); click('#ov-core', toggleCore);
  click('#btn-full', toggleFull); click('#btn-help', openHelp);
  click('#ov-close', closeOverview); click('#help-close', () => { $('#help').hidden = true; });
  click('#clock', timerToggle);
  window.addEventListener('hashchange', () => {
    const n = parseInt((location.hash || '').slice(1), 10);
    if (Number.isFinite(n) && n - 1 !== idx) go(n - 1, 0);
  });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (!$('#overview').hidden) { if (k === 'Escape' || k === 'o' || k === 'O' || k === 'g' || k === 'G') closeOverview(); return; }
    if (!$('#help').hidden) { if (k === 'Escape' || k === '?' || k === 'Enter') $('#help').hidden = true; return; }
    // Sliders/selects need arrows and Home/End; demo buttons keep their native
    // keys too. A key used to edit or operate a control must never turn a page.
    const control = e.target instanceof Element && e.target.closest('button,a,input,select,textarea,[contenteditable="true"]');
    if (control && (control.closest('[data-live-demo]') || [' ', 'Enter'].includes(k) || control.matches('input,select,textarea,[contenteditable="true"]'))) return;
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); go(route.indices[0], 0); break;
      case 'End': e.preventDefault(); go(route.indices[route.indices.length - 1], 'full'); break;
      case 'f': case 'F': toggleFull(); break;
      case 'n': case 'N': toggleNotes(); break;
      case 's': case 'S': openSpeaker(); break;
      case 'o': case 'O': case 'g': case 'G': openOverview(); break;
      case 't': case 'T': timerToggle(); break;
      case 'r': case 'R': timerReset(); break;
      case 'b': case 'B': case '.': toggleBlackout(); break;
      case '?': openHelp(); break;
      case 'Escape': $('#blackout').hidden = true; break;
      default: break;
    }
  });

  // 触摸滑动
  let tx = 0, ty = 0, swipeEnabled = false;
  const vp = $('#viewport');
  vp.addEventListener('touchstart', (e) => {
    swipeEnabled = !(e.target instanceof Element && e.target.closest('[data-live-demo],button,a,input,select,textarea'));
    if (!swipeEnabled) return;
    tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY;
  }, { passive: true });
  vp.addEventListener('touchend', (e) => {
    if (!swipeEnabled) return;
    swipeEnabled = false;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) next(); else prev(); }
  }, { passive: true });

  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseDemo(); });
  window.addEventListener('pagehide', pauseDemo);

  // 控制条自动隐藏
  let idleTimer = 0;
  const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 2800); };
  ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
  wake();
}
main();
