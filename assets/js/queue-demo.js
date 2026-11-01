import { QueueModel } from './queue-model.js';

const PRESETS = {
  regular: { arrivalRate: 4, serviceTime: 0.2, arrivalMode: 'periodic' },
  random: { arrivalRate: 4, serviceTime: 0.2, arrivalMode: 'poisson' },
  overload: { arrivalRate: 6, serviceTime: 0.2, arrivalMode: 'poisson' },
};
const fmt = (n, digits = 2) => Number.isFinite(n) ? n.toFixed(digits) : '—';
const LIMIT = 300;

// Only the main presentation mounts this module. Thumbnails, notes and print
// keep the meaningful static content stored in the slide itself.
export function mountQueueDemo(host) {
  if (!document.querySelector('#queue-demo-css')) {
    const link = document.createElement('link');
    link.id = 'queue-demo-css'; link.rel = 'stylesheet';
    link.href = new URL('../css/queue-demo.css', import.meta.url).href;
    document.head.appendChild(link);
  }
  const abort = new AbortController();
  let config = { ...PRESETS.regular, seed: 2026 };
  let model = new QueueModel(config), running = false, disposed = false;
  let raf = 0, lastFrame = 0, paintAt = 0, speed = 0.5;
  let trace = [{ time: 0, count: 0 }], notice = '先预测：到达均匀时，需要等待吗？';
  host.classList.add('queue-demo');
  host.innerHTML = `
    <div class="qd-presets" aria-label="课堂实验">
      <b>试一试</b>
      <button type="button" data-preset="regular" aria-pressed="true">① 均匀到达</button>
      <button type="button" data-preset="random" aria-pressed="false">② 随机到达</button>
      <button type="button" data-preset="overload" aria-pressed="false">③ 超载</button>
      <p class="qd-prompt" data-out="prompt">${notice}</p>
    </div>
    <div class="qd-settings">
      <label>到达率 λ <b data-out="rate-label"></b>
        <input data-field="arrivalRate" type="range" min="1" max="10" step="0.5" value="4" aria-label="到达率，每秒分组数">
      </label>
      <label>每个分组的服务时间 <b data-out="service-label"></b>
        <input data-field="serviceTime" type="range" min="50" max="500" step="25" value="200" aria-label="每个分组的服务时间，毫秒">
      </label>
      <label>到达规律（服务时间固定）
        <select data-field="arrivalMode" aria-label="到达规律"><option value="periodic">均匀间隔</option><option value="poisson">随机间隔（泊松到达）</option></select>
      </label>
    </div>
    <div class="qd-toolbar">
      <button type="button" data-action="start" class="qd-primary">开始</button>
      <button type="button" data-action="step">下一事件</button>
      <button type="button" data-action="fast">快进 30 s</button>
      <button type="button" data-action="drain">停止到达并排空</button>
      <button type="button" data-action="reset">重置</button>
      <label class="qd-speed">播放 <select data-field="speed" aria-label="仿真播放速度"><option value="0.5">0.5×</option><option value="1">1×</option><option value="4">4×</option><option value="12">12×</option></select></label>
      <p class="qd-clock" data-out="clock"></p>
    </div>
    <div class="qd-workspace">
      <div class="qd-visual">
        <div class="qd-system" aria-label="单服务员先来先服务的排队系统">
          <div class="qd-arrival"><b>到达</b><span data-out="arrived"></span><span class="qd-arrow">→</span></div>
          <div class="qd-wait"><div class="qd-zone-title"><b>等待区</b><span data-out="queue-count"></span></div><div class="qd-packets" data-out="packets"></div><p class="qd-small">先来先服务 · 队首在右侧</p></div>
          <span class="qd-arrow">→</span>
          <div class="qd-service"><b>服务员</b><div class="qd-server" data-out="server"></div><div class="qd-service-track"><i data-out="service-progress"></i></div><span data-out="server-state"></span></div>
          <div class="qd-arrival"><span class="qd-arrow">→</span><b>离开</b><span data-out="completed"></span></div>
        </div>
        <div class="qd-packet-time">
          <p data-out="packet-title">跟踪一个分组：等待 + 服务 = 节点停留</p>
          <div class="qd-time-values"><span>等待 <b data-out="packet-wait">—</b></span><span>+ 服务 <b data-out="packet-service">—</b></span><span>＝ 停留 <b data-out="packet-total">—</b></span></div>
        </div>
        <div class="qd-chart-title"><b>节点内分组数 N(t)</b><span data-out="chart-window">最近 30 s</span></div>
        <svg class="qd-chart" viewBox="0 0 980 160" role="img" aria-label="节点内分组数随时间的变化">
          <path d="M44 12V128H958" fill="none" stroke="#b8ac99" stroke-width="2"/>
          <path data-out="chart-line" fill="none" stroke="#2f5d8a" stroke-width="3"/>
          <text x="5" y="24" data-out="chart-max">4</text><text x="14" y="132">0</text>
          <text x="44" y="156" data-out="chart-start">0 s</text><text x="958" y="156" text-anchor="end" data-out="chart-end">30 s</text>
        </svg>
      </div>
      <div class="qd-results">
        <div class="qd-load"><b data-out="rho"></b><p data-out="load-note"></p></div>
        <div class="qd-metrics">
          <div><span>平均等待 W</span><b data-out="mean-wait"></b></div>
          <div><span>平均停留 T</span><b data-out="mean-total"></b></div>
          <div><span>时间平均分组数 N</span><b data-out="mean-n"></b></div>
          <div><span>实测忙碌时间占比</span><b data-out="busy"></b></div>
        </div>
        <p class="qd-small">W、T 对已离开的分组平均；N、忙碌占比对时间平均。</p>
        <div class="qd-little" data-out="little-panel">
          <b>用同一批分组核对 Little 定理</b>
          <p data-out="little-status" aria-live="polite"></p>
          <p class="qd-equation" data-out="little-equation"></p>
          <p class="qd-small" data-out="little-detail"></p>
        </div>
      </div>
    </div>
    <p class="qd-footer" data-out="footer" aria-live="polite">单服务员、先来先服务、无限缓冲。节点停留 = 等待 + 服务；这里不计传播时延。修改参数会从空系统重新开始。</p>`;
  const out = Object.fromEntries([...host.querySelectorAll('[data-out]')].map(el => [el.dataset.out, el]));
  const controls = Object.fromEntries([...host.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
  const actions = Object.fromEntries([...host.querySelectorAll('[data-action]')].map(el => [el.dataset.action, el]));
  const set = (key, value) => {
    const text = String(value);
    if (out[key].textContent !== text) out[key].textContent = text;
  };

  function record(s) {
    if (trace.at(-1).time !== s.time || trace.at(-1).count !== s.systemCount) trace.push({ time: s.time, count: s.systemCount });
    const start = Math.max(0, s.time - 30);
    while (trace.length > 2 && trace[1].time < start) trace.shift();
  }
  function paintChart(s) {
    const start = Math.max(0, s.time - 30), end = start + 30;
    const maximum = Math.max(4, ...trace.map(p => p.count));
    const x = t => 44 + (Math.max(start, t) - start) / 30 * 914;
    const y = n => 128 - n / maximum * 110;
    let path = '';
    trace.forEach((p, i) => { path += i ? ` H${x(p.time)} V${y(p.count)}` : `M${x(p.time)} ${y(p.count)}`; });
    path += ` H${x(s.time)}`;
    out['chart-line'].setAttribute('d', path);
    set('chart-max', maximum); set('chart-start', fmt(start, 1) + ' s'); set('chart-end', fmt(end, 1) + ' s');
  }
  function paint() {
    if (disposed) return;
    const s = model.snapshot();
    record(s); paintChart(s);
    host.dataset.running = String(running);
    host.dataset.drained = String(s.drained);
    host.dataset.simulationTime = String(s.time);
    set('rate-label', fmt(config.arrivalRate, 1) + ' 个/s');
    set('service-label', fmt(config.serviceTime * 1000, 0) + ' ms');
    set('clock', (s.drained ? '已排空' : running ? '运行中' : '已暂停') + ' · ' + fmt(s.time, 1) + ' s');
    set('arrived', s.arrived + ' 个'); set('completed', s.completed + ' 个');
    set('queue-count', s.queueLength + ' 个');
    const packets = s.queue.slice(0, 10).reverse();
    out.packets.replaceChildren();
    if (s.queueLength > 10) {
      const more = document.createElement('span'); more.className = 'qd-more'; more.textContent = '+' + (s.queueLength - 10); out.packets.append(more);
    }
    for (const packet of packets) {
      const item = document.createElement('span'); item.className = 'qd-packet'; item.textContent = packet.id;
      item.title = '分组 #' + packet.id + '，已等待 ' + fmt(s.time - packet.arrival) + ' s'; out.packets.append(item);
    }
    if (!s.queueLength) out.packets.textContent = '暂无等待';
    set('server', s.serving ? '#' + s.serving.id : '空闲');
    out.server.classList.toggle('busy', !!s.serving);
    out['service-progress'].style.width = (s.serving ? Math.min(100, (s.time - s.serving.start) / config.serviceTime * 100) : 0) + '%';
    set('server-state', s.serving ? '正在服务' : '等待到达');
    const packet = s.recentCompleted[0];
    set('packet-title', packet ? '刚离开的分组 #' + packet.id + '：停留时间怎样组成？' : '第一个分组离开后，看看它经历了什么');
    set('packet-wait', packet ? fmt(packet.wait) + ' s' : '—');
    set('packet-service', packet ? fmt(packet.service) + ' s' : '—');
    set('packet-total', packet ? fmt(packet.sojourn) + ' s' : '—');
    set('rho', '负荷 ρ = λ × 服务时间 = ' + fmt(s.rho));
    set('load-note', s.rho > 1 ? '到达超过服务能力，持续输入会积累队列。' : s.rho === 1 ? '平均到达量恰好等于服务能力。' : '服务能力有余量，随机到达仍可能排队。');
    out['little-panel'].classList.toggle('qd-verified', s.drained && s.completed > 0);
    set('mean-wait', s.completed ? fmt(s.meanW) + ' s' : '—');
    set('mean-total', s.completed ? fmt(s.meanT) + ' s' : '—');
    set('mean-n', s.time ? fmt(s.avgN) + ' 个' : '—');
    set('busy', s.time ? fmt(s.utilization * 100, 1) + '%' : '—');
    if (s.drained && s.completed) {
      set('little-status', '这批 ' + s.completed + ' 个分组已全部离开，统计口径一致。');
      set('little-equation', 'N = ' + fmt(s.avgN, 3) + '　λT = ' + fmt(s.littleProduct, 3));
      set('little-detail', '实测 λ = ' + s.arrived + ' ÷ ' + fmt(s.time, 2) + ' = ' + fmt(s.observedRate, 3) + ' 个/s；T = ' + fmt(s.meanT, 3) + ' s。');
    } else {
      set('little-status', !s.accepting ? (s.systemCount ? '正在排空：还有 ' + s.systemCount + ' 个分组。' : '还没有样本，点击重置后开始。') : '先运行，再点击“停止到达并排空”。');
      set('little-equation', 'N = λ × T');
      set('little-detail', '从空系统开始，等这批分组全部离开后再比较；运行中未离开的分组仍在累计停留时间。');
    }
    actions.start.textContent = running ? '暂停' : '开始';
    actions.fast.textContent = s.accepting ? '快进 30 s' : '立即排空';
    const limited = s.accepting && s.time >= LIMIT;
    actions.start.disabled = s.drained || limited;
    actions.step.disabled = s.drained || limited;
    actions.fast.disabled = s.drained || limited;
    actions.drain.disabled = !s.accepting;
    set('footer', limited ? '已运行 300 s。可停止到达并排空，或重置开始新实验。' : s.drained && s.rho >= 1 ? '排空后的样本等式仍成立；它不表示持续过载的系统稳定。改变参数会从空系统重新开始。' : '单服务员、先来先服务、无限缓冲。节点停留 = 等待 + 服务；这里不计传播时延。修改参数会从空系统重新开始。');
    set('prompt', notice);
  }
  // Capture the exact event staircase, including when fast-forwarding.
  function advance(duration) {
    let s = model.snapshot();
    const target = s.accepting ? Math.min(LIMIT, s.time + duration) : s.time + duration;
    let count = 0;
    while (!s.drained && Number.isFinite(s.nextEventTime) && s.nextEventTime <= target && count++ < 20000) {
      s = model.nextEvent(); record(s);
    }
    if (!s.drained && target > s.time) { s = model.advance(target - s.time); record(s); }
    if (s.drained || (s.accepting && s.time >= LIMIT)) pause();
  }
  function frame(now) {
    if (!running || disposed) return;
    const delta = Math.min((now - lastFrame) / 1000, 0.1); lastFrame = now;
    // Drain faster so the final cohort comparison remains practical in class.
    const effectiveSpeed = model.snapshot().accepting ? speed : Math.max(4, speed);
    advance(delta * effectiveSpeed);
    if (now - paintAt > 70) { paint(); paintAt = now; }
    if (running) raf = requestAnimationFrame(frame);
  }
  function pause() {
    running = false; cancelAnimationFrame(raf); raf = 0;
    paint();
  }
  function start() {
    const s = model.snapshot();
    if (disposed || s.drained || (s.accepting && s.time >= LIMIT)) return;
    running = true; lastFrame = performance.now(); paintAt = 0; paint();
    raf = requestAnimationFrame(frame);
  }
  function reset(preset) {
    pause();
    if (preset) config = { ...PRESETS[preset], seed: 2026 };
    else config = { arrivalRate: +controls.arrivalRate.value, serviceTime: +controls.serviceTime.value / 1000, arrivalMode: controls.arrivalMode.value, seed: 2026 };
    controls.arrivalRate.value = config.arrivalRate;
    controls.serviceTime.value = config.serviceTime * 1000;
    controls.arrivalMode.value = config.arrivalMode;
    model = new QueueModel(config); trace = [{ time: 0, count: 0 }];
    host.querySelectorAll('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === preset)));
    notice = preset === 'regular' ? '先预测：到达均匀时，需要等待吗？' : preset === 'random' ? '同样 ρ = 0.8，只改到达规律，等待会怎样？' : preset === 'overload' ? 'λ 从 4 增至 6：服务能力只有每秒 5 个。' : '参数已更新，从空系统开始；先预测再运行。';
    paint();
  }
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !host.contains(button)) return;
    if (button.dataset.preset) reset(button.dataset.preset);
    switch (button.dataset.action) {
      case 'start': if (running) pause(); else start(); break;
      case 'reset': reset(); break;
      case 'step': {
        pause(); const s = model.snapshot();
        if (s.accepting && s.nextEventTime > LIMIT) model.advance(Math.max(0, LIMIT - s.time));
        else model.nextEvent();
        paint(); break;
      }
      case 'fast': {
        pause(); const s = model.snapshot();
        advance(s.accepting ? 30 : s.systemCount * config.serviceTime + 0.001);
        paint(); break;
      }
      case 'drain': pause(); model.stopArrivals(); paint(); if (!model.snapshot().drained) start(); break;
    }
  }, { signal: abort.signal });
  for (const key of ['arrivalRate', 'serviceTime', 'arrivalMode']) controls[key].addEventListener('input', () => reset(), { signal: abort.signal });
  controls.speed.addEventListener('change', () => { speed = +controls.speed.value; }, { signal: abort.signal });
  paint();
  host.dataset.queueDemoReady = 'true';
  return {
    pause,
    destroy() { running = false; disposed = true; cancelAnimationFrame(raf); abort.abort(); host.dataset.running = 'false'; },
  };
}
