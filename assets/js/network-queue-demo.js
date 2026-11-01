import { NetworkQueueModel } from './network-queue-model.js';

const PRESETS = {
  baseline: { gamma: 1, feedback: 0.75, muCPU: 8, muIO: 5 },
  feedback: { gamma: 1, feedback: 0.85, muCPU: 8, muIO: 5 },
  upgrade: { gamma: 1, feedback: 0.85, muCPU: 8, muIO: 10 },
  reduce: { gamma: 1, feedback: 0.5, muCPU: 8, muIO: 5 },
};
const fmt = (n, d = 2) => Number.isFinite(n) ? n.toFixed(d) : '—';
const LIMIT = 300;

export function mountNetworkQueueDemo(host) {
  if (!document.querySelector('#network-queue-demo-css')) {
    const link = document.createElement('link'); link.id = 'network-queue-demo-css'; link.rel = 'stylesheet';
    link.href = new URL('../css/network-queue-demo.css', import.meta.url).href; document.head.append(link);
  }
  const abort = new AbortController();
  let config = { ...PRESETS.baseline, seed: 2026 }, model = new NetworkQueueModel(config);
  let timer = null, disposed = false, speed = 0.5, previous = 0;
  host.classList.add('network-queue-demo');
  host.innerHTML = `
    <div class="nq-presets"><b>试一试</b>
      <button type="button" data-preset="baseline" aria-pressed="true">① 教材例子</button>
      <button type="button" data-preset="feedback" aria-pressed="false">② 增加反馈</button>
      <button type="button" data-preset="upgrade" aria-pressed="false">③ 升级 I/O</button>
      <button type="button" data-preset="reduce" aria-pressed="false">④ 减少反馈</button>
      <p data-out="prompt">外部输入不变，内部流量会怎样变化？</p>
    </div>
    <div class="nq-settings">
      <label>外部到达 γ <b data-out="gamma-label"></b><input type="range" data-field="gamma" min="0.2" max="2" step="0.1" value="1" aria-label="外部到达率，每秒任务数"></label>
      <label>CPU 转去 I/O 的概率 p <b data-out="p-label"></b><input type="range" data-field="feedback" min="0" max="0.9" step="0.05" value="0.75" aria-label="CPU转去IO的概率"></label>
      <label>CPU 服务率 μ <b data-out="cpu-label"></b><input type="range" data-field="muCPU" min="4" max="20" step="1" value="8" aria-label="CPU每秒平均服务次数"></label>
      <label>I/O 服务率 μ <b data-out="io-label"></b><input type="range" data-field="muIO" min="2" max="16" step="1" value="5" aria-label="IO每秒平均服务次数"></label>
    </div>
    <div class="nq-controls">
      <button type="button" data-action="start" class="nq-primary">开始</button>
      <button type="button" data-action="step">下一事件</button>
      <button type="button" data-action="fast">快进 30 s</button>
      <button type="button" data-action="drain">停止到达并排空</button>
      <button type="button" data-action="reset">重置</button>
      <label>播放 <select data-field="speed" aria-label="仿真播放速度"><option value="0.5">0.5×</option><option value="1">1×</option><option value="4">4×</option></select></label>
      <p data-out="clock"></p>
    </div>
    <div class="nq-main">
      <div class="nq-network">
        <div class="nq-flow"><b data-out="external"></b><span>→ CPU → 以 1 − p 离网</span><b data-out="completed"></b></div>
        <div class="nq-nodes">
          <div class="nq-node"><div class="nq-node-title"><b>CPU</b><span data-out="cpu-count"></span></div><div class="nq-node-body"><div class="nq-queue" data-out="cpu-queue"></div><span>→</span><div class="nq-server" data-out="cpu-server"></div></div><p data-out="cpu-visits"></p><p data-out="cpu-load"></p></div>
          <div class="nq-forward"><b data-out="route-prob"></b><span>→</span></div>
          <div class="nq-node"><div class="nq-node-title"><b>I/O</b><span data-out="io-count"></span></div><div class="nq-node-body"><div class="nq-queue" data-out="io-queue"></div><span>→</span><div class="nq-server" data-out="io-server"></div></div><p data-out="io-visits"></p><p data-out="io-load"></p></div>
        </div>
        <div class="nq-return">←　I/O 完成后，任务返回 CPU</div>
        <div class="nq-rates"><p data-out="flow-equations"></p><p data-out="flow-values"></p></div>
        <div class="nq-event"><p data-out="event"></p><p data-out="tracked"></p></div>
      </div>
      <div class="nq-results">
        <div class="nq-theory"><b>Jackson 理论（稳态）</b><strong data-out="theory-t"></strong><p data-out="stability"></p></div>
        <div class="nq-metrics"><div><span>本轮平均网络时延 T</span><b data-out="mean-t"></b></div><div><span>时间平均任务总数 N</span><b data-out="mean-n"></b></div></div>
        <p class="nq-small">从空系统开始，实测为有限样本。<br>T 对已离网任务平均；N 对时间平均。</p>
        <div class="nq-little"><b>全网 Little：分母用外部进入率 γ</b><p data-out="little-equation"></p><p data-out="little-detail"></p></div>
      </div>
    </div>
    <p class="nq-footer" data-out="footer">假设：外部泊松到达；每次服务独立且为指数分布；无限缓冲、先来先服务，转移不耗时。改参数会重新开始。</p>`;
  const out = Object.fromEntries([...host.querySelectorAll('[data-out]')].map(el => [el.dataset.out, el]));
  const fields = Object.fromEntries([...host.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
  const actions = Object.fromEntries([...host.querySelectorAll('[data-action]')].map(el => [el.dataset.action, el]));
  const set = (key, value) => { const text = String(value); if (out[key].textContent !== text) out[key].textContent = text; };
  function queue(key, node) {
    const box = out[key]; box.replaceChildren();
    if (node.queueLength > 5) { const n = document.createElement('span'); n.className = 'nq-more'; n.textContent = '+' + (node.queueLength - 5); box.append(n); }
    node.queue.slice(0, 5).reverse().forEach(task => { const n = document.createElement('span'); n.className = 'nq-task'; n.textContent = task.id; n.title = '任务 #' + task.id; box.append(n); });
    if (!node.queueLength) box.textContent = '无等待';
  }
  function paint() {
    if (disposed) return;
    const s = model.snapshot(), th = s.theory;
    host.dataset.running = String(timer !== null); host.dataset.simulationTime = String(s.time); host.dataset.drained = String(s.drained);
    set('gamma-label', fmt(config.gamma, 1) + ' 个/s'); set('p-label', fmt(config.feedback * 100, 0) + '%');
    set('cpu-label', config.muCPU + ' 次/s'); set('io-label', config.muIO + ' 次/s');
    set('clock', (s.drained ? '已排空' : timer !== null ? '运行中' : '已暂停') + ' · ' + fmt(s.time, 1) + ' s');
    set('external', '外部进入 ' + s.arrived + ' 个'); set('completed', '离网 ' + s.completed + ' 个'); set('route-prob', '概率 ' + fmt(config.feedback, 2));
    for (const [index, name] of ['cpu', 'io'].entries()) {
      const node = s.nodes[index];
      set(name + '-count', '等待 ' + node.queueLength + ' 个'); queue(name + '-queue', node);
      set(name + '-server', node.serving ? '#' + node.serving.id : '空闲'); out[name + '-server'].classList.toggle('busy', !!node.serving);
      set(name + '-visits', '累计访问 ' + node.visits + ' 次 · 实测 ' + fmt(node.observedRate) + ' 次/s');
      set(name + '-load', '所需负荷 ρ = ' + fmt(th.rho[index]) + ' · 忙碌 ' + fmt(node.utilization * 100, 0) + '%');
      out[name + '-load'].classList.toggle('nq-overload', th.rho[index] >= 1);
    }
    set('flow-equations', '流量方程：λCPU = γ + λIO；λIO = p × λCPU');
    set('flow-values', '所需访问率：CPU ' + fmt(th.lambda[0]) + '，I/O ' + fmt(th.lambda[1]) + ' 次/s；外部 γ = ' + fmt(config.gamma, 1) + ' 个/s。');
    const event = s.recentEvents[0];
    set('event', event ? fmt(event.time, 2) + ' s · #' + event.id + ' ' + event.text : '点击“下一事件”，跟随同一编号观察任务如何往返。');
    const packet = s.recentCompleted[0];
    set('tracked', packet ? '刚离网 #' + packet.id + '：CPU ' + packet.visits[0] + ' 次，I/O ' + packet.visits[1] + ' 次，网络停留 ' + fmt(packet.sojourn) + ' s。' : '一个任务可以多次访问节点；每次服务都会重新独立抽样。');
    set('theory-t', th.stable ? 'T = ' + fmt(th.meanT) + ' s' : '无稳态平均时延');
    set('stability', th.stable ? '两个节点的 ρ 均小于 1；T = (NCPU + NIO) / γ。' : (th.rho[0] >= 1 ? 'CPU' : 'I/O') + ' 所需负荷达到或超过 1，持续输入会积累任务。');
    set('mean-t', s.completed ? fmt(s.meanT) + ' s' : '—'); set('mean-n', s.time ? fmt(s.avgN) + ' 个' : '—');
    out['little-equation'].classList.toggle('verified', s.drained && !!s.completed);
    if (s.drained && s.completed) {
      set('little-equation', 'N = ' + fmt(s.avgN, 3) + '　γ实测 T = ' + fmt(s.littleProduct, 3));
      set('little-detail', '这批 ' + s.completed + ' 个任务全部离网。实测 γ = ' + s.arrived + '/' + fmt(s.time) + ' = ' + fmt(s.observedGamma, 3) + ' 个/s。');
    } else {
      set('little-equation', 'T = N / γ，不能除以内部访问率');
      set('little-detail', s.drained ? '没有任务样本，重置后开始实验。' : s.accepting ? '停止到达并排空后，用同一批完整任务核对 N = γ实测 × T。' : '正在排空，还有 ' + s.count + ' 个任务；可点“立即排空”。');
    }
    const limited = s.accepting && s.time >= LIMIT;
    actions.start.textContent = timer !== null ? '暂停' : '开始'; actions.fast.textContent = s.accepting ? '快进 30 s' : '立即排空';
    for (const key of ['start', 'step', 'fast']) actions[key].disabled = s.drained || limited;
    actions.drain.disabled = !s.accepting;
    set('footer', limited ? '已观察 300 s，可停止到达并排空或重置。所需访问率是处理全部输入所需的量；过载时实际访问率受服务能力限制。' : s.drained && !th.stable ? '停止输入后的有限样本等式仍成立，但不能据此认为持续输入的过载网络稳定。' : '蓝色等待（队首在右），红色服务。外部泊松到达、每次服务独立指数分布；先来先服务、无限缓冲。改参数重置。');
  }
  function pause() { if (timer !== null) clearInterval(timer); timer = null; paint(); }
  function start() {
    const s = model.snapshot(); if (timer !== null || disposed || s.drained || (s.accepting && s.time >= LIMIT)) return;
    previous = performance.now();
    timer = setInterval(() => {
      const now = performance.now(), state = model.snapshot();
      const dt = Math.min(0.2, Math.max(0, now - previous) / 1000) * (state.accepting ? speed : Math.max(4, speed)); previous = now;
      model.advance(state.accepting ? Math.min(dt, LIMIT - state.time) : dt);
      const after = model.snapshot();
      if (after.drained || (after.accepting && after.time >= LIMIT)) pause(); else paint();
    }, 50);
    paint();
  }
  function reset(preset) {
    pause(); config = preset ? { ...PRESETS[preset], seed: 2026 } : { gamma: +fields.gamma.value, feedback: +fields.feedback.value, muCPU: +fields.muCPU.value, muIO: +fields.muIO.value, seed: 2026 };
    for (const key of ['gamma', 'feedback', 'muCPU', 'muIO']) fields[key].value = config[key];
    host.querySelectorAll('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === preset)));
    set('prompt', preset === 'feedback' ? '只增加反馈，哪个节点先成为瓶颈？' : preset === 'upgrade' ? '只加快 I/O，能解除哪个瓶颈？' : preset === 'reduce' ? '减少往返次数，能节省多少时延？' : '外部输入不变，内部流量会怎样变化？');
    model = new NetworkQueueModel(config); paint();
  }
  host.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || !host.contains(button) || button.disabled) return;
    if (button.dataset.preset) reset(button.dataset.preset);
    switch (button.dataset.action) {
      case 'start': if (timer === null) start(); else pause(); break;
      case 'reset': reset(); break;
      case 'step': { pause(); const s = model.snapshot(); if (s.accepting && s.nextEventTime > LIMIT) model.advance(LIMIT-s.time); else model.nextEvent(); paint(); break; }
      case 'fast': { pause(); const s = model.snapshot(); if (s.accepting) model.advance(Math.min(30, LIMIT-s.time)); else model.drain(); paint(); break; }
      case 'drain': pause(); model.stopArrivals(); paint(); if (!model.snapshot().drained) start(); break;
    }
  }, { signal: abort.signal });
  for (const key of ['gamma', 'feedback', 'muCPU', 'muIO']) fields[key].addEventListener('input', () => reset(), { signal: abort.signal });
  fields.speed.addEventListener('change', () => { speed = +fields.speed.value; }, { signal: abort.signal });
  paint(); host.dataset.demoReady = 'true';
  return { pause, destroy() { if (timer !== null) clearInterval(timer); timer = null; disposed = true; abort.abort(); host.dataset.running = 'false'; } };
}
