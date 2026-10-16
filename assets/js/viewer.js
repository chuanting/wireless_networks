import { loadDeck, renderSlide, setStep, stepsOf, mountScaled, sectionAt } from './deck-runtime.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const deckId = q.get('deck') || '';
const loader = $('#loader'), loaderMsg = $('#loader-msg');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let deck = null, N = 0, idx = -1, step = 0, cur = null, channel = null;

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
  i = clamp(i, 0, N - 1);
  const r = renderSlide(deck.slides[i].html);
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
}
function next() {
  if (step < stepsOf(cur.el)) { step++; setStep(cur.el, step); updateUI(); broadcastState(); }
  else if (idx < N - 1) go(idx + 1, 0);
}
function prev() {
  if (step > 0) { step--; setStep(cur.el, step); updateUI(); broadcastState(); }
  else if (idx > 0) go(idx - 1, 'full');
}

function updateUI() {
  $('#counter').textContent = (idx + 1) + ' / ' + N;
  $('#progress i').style.width = (N > 1 ? idx / (N - 1) * 100 : 100) + '%';
  const sec = sectionAt(deck, idx);
  $('#section').textContent = sec ? sec.description : '';
  $('#n-body').textContent = cur.notes;
  const st = stepsOf(cur.el);
  $('#n-count').textContent = '第 ' + (idx + 1) + ' 页' + (st ? ' · 点击步骤 ' + step + '/' + st : '');
  $('#btn-prev').disabled = idx === 0 && step === 0;
  $('#btn-next').disabled = idx === N - 1 && step >= st;
  document.title = (idx + 1) + '/' + N + ' · ' + deck.meta.title;
  if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + (idx + 1));
}

/* ---------- 与「讲者视图」窗口同步 ---------- */
function broadcastState() {
  if (!channel || !cur) return;
  channel.postMessage({ type: 'state', idx, step, steps: stepsOf(cur.el), total: N, notes: cur.notes, title: cur.title });
}
function openSpeaker() {
  const w = window.open('notes.html?deck=' + encodeURIComponent(deckId), 'wn-speaker', 'popup=yes,width=1200,height=800');
  if (!w) alert('浏览器拦截了弹出窗口，请允许本站弹出窗口后再试。');
}

/* ---------- 面板 ---------- */
function toggleNotes(force) {
  const n = $('#notes');
  n.hidden = force === undefined ? !n.hidden : !force;
  $('#btn-notes').setAttribute('aria-pressed', String(!n.hidden));
}
let ovBuilt = false;
function openOverview() {
  const ov = $('#overview');
  if (!ovBuilt) buildOverview();
  ov.hidden = false;
  ov.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('cur', +t.dataset.i === idx));
  const c = ov.querySelector('.thumb.cur'); if (c) c.scrollIntoView({ block: 'center' });
}
function closeOverview() { $('#overview').hidden = true; }
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
      g.appendChild(t);
    }
    body.append(h, g);
  });
  body.addEventListener('click', (e) => { const t = e.target.closest('.thumb'); if (t) { closeOverview(); go(+t.dataset.i, 0); } });
  body.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const t = e.target.closest('.thumb'); if (t) { closeOverview(); go(+t.dataset.i, 0); } } });
  ovBuilt = true;
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
  deck.slides.forEach((s) => {
    const r = renderSlide(s.html); setStep(r.el, stepsOf(r.el));
    const p = document.createElement('div'); p.className = 'page'; p.appendChild(r.el); host.appendChild(p);
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
  if (q.has('print')) { printMode(); return; }

  // 顶栏
  const back = $('#back');
  back.href = '../index.html' + (info.chapter ? '#' + info.chapter.id : '');
  $('#deck-title').textContent = (info.chapter ? '第' + info.chapter.no + '章 · ' : '') + (info.section ? info.section.no + ' ' : '') + deck.meta.title;
  $('#export').href = '?deck=' + encodeURIComponent(deckId) + '&print=auto';

  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel('wn-deck-' + deckId);
    channel.onmessage = (e) => {
      const m = e.data || {};
      if (m.type !== 'cmd') return;
      if (m.cmd === 'hello') broadcastState();
      else if (m.cmd === 'next') next();
      else if (m.cmd === 'prev') prev();
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
  click('#hit-prev', prev); click('#hit-next', next);
  click('#btn-notes', () => toggleNotes()); click('#n-close', () => toggleNotes(false));
  click('#btn-speaker', openSpeaker); click('#btn-overview', openOverview);
  click('#btn-full', toggleFull); click('#btn-help', () => { $('#help').hidden = false; });
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
    switch (k) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); go(0, 0); break;
      case 'End': e.preventDefault(); go(N - 1, 'full'); break;
      case 'f': case 'F': toggleFull(); break;
      case 'n': case 'N': toggleNotes(); break;
      case 's': case 'S': openSpeaker(); break;
      case 'o': case 'O': case 'g': case 'G': openOverview(); break;
      case 't': case 'T': timerToggle(); break;
      case 'r': case 'R': timerReset(); break;
      case 'b': case 'B': case '.': $('#blackout').hidden = !$('#blackout').hidden; break;
      case '?': $('#help').hidden = false; break;
      case 'Escape': $('#blackout').hidden = true; break;
      default: break;
    }
  });

  // 触摸滑动
  let tx = 0, ty = 0;
  const vp = $('#viewport');
  vp.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY; }, { passive: true });
  vp.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) next(); else prev(); }
  }, { passive: true });

  // 控制条自动隐藏
  let idleTimer = 0;
  const wake = () => { document.body.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => document.body.classList.add('idle'), 2800); };
  ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
  wake();
}
main();
