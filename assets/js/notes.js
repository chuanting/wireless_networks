/* 讲者视图：与课件主窗口通过 BroadcastChannel 同步（同一浏览器内，无需服务器）。 */
import { loadDeck, renderSlide, setStep, stepsOf, mountScaled } from './deck-runtime.js';

const $ = (s) => document.querySelector(s);
const q = new URLSearchParams(location.search);
const deckId = q.get('deck') || '';
const msg = $('#msg');

let deck = null, shownIdx = -2, shownNextIdx = -2, curEl = null, state = null, lastTick = 0, tickInfo = { ms: 0, running: false, target: 60 };
const fmt = (ms) => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

async function main() {
  if (!deckId) { msg.textContent = '缺少课件参数。请从课件页面按 S 打开讲者视图。'; return; }
  try { deck = await loadDeck(deckId); } catch (e) { msg.textContent = e.message; return; }
  document.title = '讲者视图 · ' + deck.meta.title;
  msg.hidden = true; $('#sv').hidden = false;

  if (!('BroadcastChannel' in window)) { $('#status').textContent = '此浏览器不支持同步'; $('#status').className = 'bad'; return; }
  const chan = new BroadcastChannel('wn-deck-' + deckId);
  const cmd = (c) => chan.postMessage({ type: 'cmd', cmd: c });
  chan.onmessage = (e) => {
    const m = e.data || {};
    if (m.type === 'state') { state = m; render(); }
    else if (m.type === 'tick') { tickInfo = m; lastTick = performance.now(); paint(); }
  };
  cmd('hello');
  $('#bn').onclick = () => cmd('next'); $('#bp').onclick = () => cmd('prev');
  $('#tg').onclick = () => cmd('timer'); $('#rs').onclick = () => cmd('reset');
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); cmd('next'); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); cmd('prev'); }
    else if (e.key === 'Home') { e.preventDefault(); cmd('home'); }
    else if (e.key === 'End') { e.preventDefault(); cmd('end'); }
    else if (e.key === 't' || e.key === 'T') cmd('timer');
    else if (e.key === 'r' || e.key === 'R') cmd('reset');
  });
  setInterval(paint, 500);
}

function render() {
  if (!state || !deck || !deck.slides[state.idx]) return;
  if (shownIdx !== state.idx) {
    const r = renderSlide(deck.slides[state.idx].html);
    curEl = r.el; mountScaled($('#pv-cur'), r.el);
    shownIdx = state.idx;
  }
  // Core/full can change while the current original page stays the same.
  const nextIdx = state.nextIdx === undefined
    ? (state.idx + 1 < deck.slides.length ? state.idx + 1 : null)
    : state.nextIdx;
  if (shownNextIdx !== nextIdx) {
    const nb = $('#pv-next');
    if (nextIdx !== null && deck.slides[nextIdx]) {
      const n = renderSlide(deck.slides[nextIdx].html);
      mountScaled(nb, n.el);
      nb.setAttribute('aria-label', '下一页：原第 ' + (nextIdx + 1) + ' 页');
    } else {
      nb.textContent = '';
      nb.setAttribute('aria-label', '已是当前路线的最后一页');
      nb.insertAdjacentHTML('beforeend', '<div style="position:absolute;inset:0;display:grid;place-content:center;color:#8fa0c0">已是当前路线的最后一页</div>');
    }
    shownNextIdx = nextIdx;
  }
  setStep(curEl, state.step);
  $('#cnt').textContent = (state.idx + 1) + ' / ' + state.total
    + (state.coreOnly ? ' · 核心 ' + state.routePosition + '/' + state.routeTotal : '');
  $('#bp').disabled = state.step === 0 && (state.prevIdx === null || state.prevIdx === undefined && state.idx === 0);
  $('#bn').disabled = nextIdx === null && state.step >= state.steps;
  if (state.coreOnly) q.set('core', '1'); else q.delete('core');
  if (history.replaceState) history.replaceState(null, '', location.pathname + '?' + q + '#' + (state.idx + 1));
  $('#steps').textContent = state.steps ? '点击步骤 ' + state.step + '/' + state.steps : '';
  $('#nt').textContent = state.notes || '';
  $('#nt').scrollTop = 0;
}

function paint() {
  const alive = performance.now() - lastTick < 3500;
  const st = $('#status');
  st.textContent = alive ? '● 已连接主窗口' : '未连接主窗口';
  st.className = alive ? '' : 'bad';
  st.style.color = alive ? 'var(--cyan)' : '';
  const c = $('#clock2');
  c.textContent = fmt(tickInfo.ms || 0);
  c.classList.toggle('warn', (tickInfo.ms || 0) > (tickInfo.target || 60) * 60000);
  c.style.opacity = tickInfo.running ? 1 : .6;
}
main();
