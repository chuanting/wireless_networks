import { MMQueueModel } from './mm-queue-model.js';

const PRESETS = {
  one: { arrivalRate: 4, serviceRate: 5, servers: 1, mode: 'wait' },
  two: { arrivalRate: 4, serviceRate: 5, servers: 2, mode: 'wait' },
  loss: { arrivalRate: 4, serviceRate: 5, servers: 2, mode: 'loss' },
};
const number = (v, digits = 2) => Number.isFinite(v) ? v.toFixed(digits) : '—';
const seconds = v => Number.isFinite(v) ? number(v, 3) + ' s' : '—';
const percent = v => Number.isFinite(v) ? number(v * 100, 1) + '%' : '—';
const LIMIT = 300;

export function mountMMQueueDemo(host) {
  if (!document.querySelector('#mm-queue-css')) {
    const css = document.createElement('link'); css.id = 'mm-queue-css'; css.rel = 'stylesheet';
    css.href = new URL('../css/mm-queue-demo.css', import.meta.url).href; document.head.append(css);
  }
  const abort = new AbortController();
  let config = { ...PRESETS.one, seed: 2026 }, model = new MMQueueModel(config);
  let running = false, timer = null, dead = false, trace = [{ time: 0, count: 0 }];
  let prompt = '同一股到达流，增加一个服务员能改善多少？';
  host.classList.add('mmq-demo');
  host.innerHTML = `
    <div class="mmq-presets"><b>试一试</b>
      <button type="button" data-preset="one" aria-pressed="true">① 一个服务员</button>
      <button type="button" data-preset="two" aria-pressed="false">② 两个服务员</button>
      <button type="button" data-preset="loss" aria-pressed="false">③ 全忙就拒绝</button>
      <p data-out="prompt"></p>
    </div>
    <div class="mmq-settings">
      <label>到达率 λ <b data-out="lambda"></b><input type="range" min="1" max="12" step="0.5" value="4" data-field="arrivalRate" aria-label="到达率，每秒分组数"></label>
      <label>每个服务员的服务率 μ <b data-out="mu"></b><input type="range" min="2" max="10" step="0.5" value="5" data-field="serviceRate" aria-label="每个服务员的服务率"></label>
      <label>服务员个数 m<select data-field="servers" aria-label="服务员个数"><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
      <label>全忙时怎么办？<select data-field="mode" aria-label="全忙时的处理方式"><option value="wait">排队等待（无限缓冲）</option><option value="loss">直接拒绝（无等待位）</option></select></label>
    </div>
    <div class="mmq-toolbar">
      <button type="button" data-action="start" class="mmq-primary">开始</button>
      <button type="button" data-action="step">下一事件</button>
      <button type="button" data-action="fast">快进 30 s</button>
      <button type="button" data-action="drain">停止到达并排空</button>
      <button type="button" data-action="reset">重置</button>
      <p data-out="clock"></p>
    </div>
    <div class="mmq-main">
      <div class="mmq-visual">
        <div class="mmq-flow"><b data-out="model-name"></b><span>尝试 <b data-out="attempted"></b></span><span>接纳 <b data-out="admitted"></b></span><span class="mmq-red">拒绝 <b data-out="rejected"></b></span><span>完成 <b data-out="completed"></b></span></div>
        <div class="mmq-wait"><div><b data-out="waiting-title"></b><span data-out="queue-count"></span></div><div class="mmq-packets" data-out="packets"></div><p data-out="queue-note"></p></div>
        <div class="mmq-servers" data-out="servers"></div>
        <p class="mmq-packet" data-out="packet"></p>
        <div class="mmq-chart-head"><b>节点内分组数 N(t)</b><span>最近 30 s</span></div>
        <svg class="mmq-chart" viewBox="0 0 920 120" role="img" aria-label="节点内分组数变化">
          <path d="M48 12V88H905" fill="none" stroke="#baad9b" stroke-width="2"/>
          <path data-out="chart" fill="none" stroke="#2f5d8a" stroke-width="3"/>
          <text x="4" y="26" data-out="chart-max">4</text><text x="14" y="92">0</text>
          <text x="48" y="118" data-out="chart-start">0 s</text><text x="905" y="118" text-anchor="end" data-out="chart-end">30 s</text>
        </svg>
      </div>
      <div class="mmq-results">
        <b class="mmq-rho" data-out="rho"></b>
        <p class="mmq-note" data-out="condition"></p>
        <table class="mmq-table"><thead><tr><th>指标</th><th>本轮实测</th><th>稳态理论</th></tr></thead><tbody>
          <tr><td>平均等待 W</td><td data-out="wait"></td><td data-out="theory-wait"></td></tr>
          <tr><td>平均停留 T</td><td data-out="sojourn"></td><td data-out="theory-sojourn"></td></tr>
          <tr><td data-out="probability-title"></td><td data-out="probability"></td><td data-out="theory-probability"></td></tr>
          <tr><td>平均分组数 N</td><td data-out="n"></td><td data-out="theory-n"></td></tr>
        </tbody></table>
        <p class="mmq-small">W、T：已完成接纳者；N：时间平均。有限样本会波动。</p>
        <div class="mmq-bottom-stat"><span>忙碌占比 <b data-out="utilization"></b></span><span>实际进入 <b data-out="effective-rate"></b></span></div>
        <p class="mmq-formula" data-out="lesson"></p>
        <div class="mmq-lesson"><p data-out="little"></p></div>
      </div>
    </div>
    <p class="mmq-footer" data-out="footer"></p>`;
  const outputs = Object.fromEntries([...host.querySelectorAll('[data-out]')].map(el => [el.dataset.out, el]));
  const fields = Object.fromEntries([...host.querySelectorAll('[data-field]')].map(el => [el.dataset.field, el]));
  const actions = Object.fromEntries([...host.querySelectorAll('[data-action]')].map(el => [el.dataset.action, el]));
  const put = (name, text) => { text = String(text); if (outputs[name].textContent !== text) outputs[name].textContent = text; };
  function record(s) {
    trace.push({ time: s.time, count: s.systemCount });
    while (trace.length > 2 && trace[1].time < s.time - 30) trace.shift();
  }
  function chart(s) {
    const start = Math.max(0, s.time - 30), maximum = Math.max(4, ...trace.map(p => p.count));
    const x = t => 48 + (Math.max(start, t) - start) / 30 * 857;
    const y = n => 88 - n / maximum * 76;
    let d = '';
    trace.forEach((p, i) => { d += i ? ` H${x(p.time)} V${y(p.count)}` : `M${x(p.time)} ${y(p.count)}`; });
    outputs.chart.setAttribute('d', d + ` H${x(s.time)}`);
    put('chart-max', maximum); put('chart-start', number(start, 1) + ' s'); put('chart-end', number(start + 30, 1) + ' s');
  }
  function paint() {
    if (dead) return;
    const s = model.snapshot(), theory = s.theory;
    host.dataset.running = String(running); host.dataset.simulationTime = String(s.time); host.dataset.drained = String(s.drained);
    put('prompt', prompt); put('lambda', number(config.arrivalRate, 1) + ' 个/s'); put('mu', number(config.serviceRate, 1) + ' 个/s');
    put('clock', (s.drained ? '已排空' : running ? '运行中' : '已暂停') + ' · ' + number(s.time, 1) + ' s');
    put('model-name', config.mode === 'loss' ? `M/M/${config.servers}/${config.servers}` : `M/M/${config.servers}`);
    for (const key of ['attempted', 'admitted', 'rejected', 'completed']) put(key, s[key]);
    put('waiting-title', config.mode === 'loss' ? '没有等待位' : '一个共用等待区'); put('queue-count', s.queueLength + ' 个');
    outputs.packets.replaceChildren();
    if (s.queueLength > 8) {
      const more = document.createElement('span'); more.textContent = '+' + (s.queueLength - 8); more.className = 'mmq-more'; outputs.packets.append(more);
    }
    for (const packet of [...s.queue].reverse()) {
      const item = document.createElement('span'); item.className = 'mmq-token'; item.textContent = packet.id; outputs.packets.append(item);
    }
    if (!s.queueLength) outputs.packets.textContent = config.mode === 'loss' ? '服务员全忙 → 新到达者被拒绝' : '暂无等待';
    put('queue-note', config.mode === 'loss' ? '等待为零，有些分组却无法进入。' : '队首在右；空闲服务员接走队首分组。');
    outputs.servers.replaceChildren();
    s.servers.forEach((packet, index) => {
      const box = document.createElement('div'); box.className = 'mmq-server' + (packet ? ' busy' : '');
      const label = document.createElement('span'); label.textContent = '服务员 ' + (index + 1);
      const value = document.createElement('b'); value.textContent = packet ? '#' + packet.id : '空闲';
      box.append(label, value); outputs.servers.append(box);
    });
    const packet = s.recentCompleted[0];
    put('packet', packet ? `完成 #${packet.id}：等待 ${number(packet.wait)} + 服务 ${number(packet.service)} = 停留 ${number(packet.sojourn)} s` : '跟踪一个分组：等待 + 服务 = 节点停留时间。');
    put('rho', `负荷 ρ = λ / (mμ) = ${number(theory.rho)}`);
    put('condition', config.mode === 'loss' ? '损失制：全忙就拒绝，有限状态下始终有稳态。' : theory.stable ? '无限等待：ρ < 1，存在稳态。' : '无限等待：ρ ≥ 1，无有限的稳态平均时延。');
    put('wait', seconds(s.meanW)); put('sojourn', seconds(s.meanT)); put('n', Number.isFinite(s.avgN) ? number(s.avgN, 3) : '—');
    put('theory-wait', theory.stable ? seconds(theory.meanW) : '无稳态'); put('theory-sojourn', theory.stable ? seconds(theory.meanT) : '无稳态'); put('theory-n', theory.stable ? number(theory.avgN, 3) : '无稳态');
    put('probability-title', config.mode === 'loss' ? '拒绝概率 B' : '到达时需等待');
    put('probability', percent(config.mode === 'loss' ? s.blocking : s.waitProbability));
    put('theory-probability', theory.stable ? percent(config.mode === 'loss' ? theory.blocking : theory.waitProbability) : '无稳态');
    put('utilization', percent(s.utilization)); put('effective-rate', Number.isFinite(s.effectiveRate) ? number(s.effectiveRate) + ' 个/s' : '—');
    put('lesson', config.mode === 'loss' ? `爱尔兰 B：理论进入率 λ(1 − B) = ${number(theory.effectiveRate, 3)} 个/s` : theory.stable ? '爱尔兰 C：W = P(等待) / (mμ − λ)' : '先增加服务能力或降低到达率，再用稳态公式。');
    put('little', s.drained && s.completed ? `排空核对：N = ${number(s.avgN, 3)}，实际进入率 × T = ${number(s.littleProduct, 3)}。` : '停止到达并排空后，核对 N = 实际进入率 × T。');
    put('footer', '泊松到达、独立指数服务；忙碌占比按全部服务员的总可用时间计算。参数改变会重置；每轮到达阶段最多 300 s。');
    const limited = s.accepting && s.time >= LIMIT;
    actions.start.textContent = running ? '暂停' : '开始'; actions.fast.textContent = s.accepting ? '快进 30 s' : '立即排空';
    for (const key of ['start', 'step', 'fast']) actions[key].disabled = s.drained || limited;
    actions.drain.disabled = !s.accepting;
    chart(s);
  }
  function advance(dt) {
    let s = model.snapshot(); const end = s.accepting ? Math.min(LIMIT, s.time + dt) : s.time + dt;
    while (!s.drained && Number.isFinite(s.nextEventTime) && s.nextEventTime <= end) { s = model.nextEvent(); record(s); }
    if (!s.drained && s.time < end) { s = model.advance(end - s.time); record(s); }
    if (s.drained || (s.accepting && s.time >= LIMIT)) pause();
    paint();
  }
  function pause() { running = false; if (timer !== null) clearInterval(timer); timer = null; paint(); }
  function start() {
    const s = model.snapshot(); if (dead || running || s.drained || (s.accepting && s.time >= LIMIT)) return;
    running = true; timer = setInterval(() => advance(model.snapshot().accepting ? 0.04 : 0.32), 80); paint();
  }
  function reset(key) {
    pause();
    config = key ? { ...PRESETS[key], seed: 2026 } : { arrivalRate: +fields.arrivalRate.value, serviceRate: +fields.serviceRate.value, servers: +fields.servers.value, mode: fields.mode.value, seed: 2026 };
    for (const field of Object.keys(fields)) fields[field].value = config[field];
    model = new MMQueueModel(config); trace = [{ time: 0, count: 0 }];
    host.querySelectorAll('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === key)));
    prompt = key === 'two' ? '到达流和单员速度不变：两个服务员共用一个队。' : key === 'loss' ? '仍是两个服务员：只改成“全忙就拒绝”。' : key === 'one' ? '同一股到达流，增加一个服务员能改善多少？' : '参数已更新：先预测，再开始。';
    paint();
  }
  host.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || !host.contains(button)) return;
    if (button.dataset.preset) reset(button.dataset.preset);
    switch (button.dataset.action) {
      case 'start': running ? pause() : start(); break;
      case 'reset': reset(); break;
      case 'step': { pause(); const s = model.snapshot(); if (s.accepting && s.nextEventTime > LIMIT) advance(LIMIT - s.time); else { record(model.nextEvent()); paint(); } break; }
      case 'fast': pause(); if (model.snapshot().accepting) advance(30); else { while (!model.snapshot().drained) record(model.nextEvent()); paint(); } break;
      case 'drain': pause(); model.stopArrivals(); paint(); if (!model.snapshot().drained) start(); break;
    }
  }, { signal: abort.signal });
  for (const field of Object.values(fields)) field.addEventListener('input', () => reset(), { signal: abort.signal });
  paint(); host.dataset.demoReady = 'true';
  return { pause, destroy() { dead = true; running = false; if (timer !== null) clearInterval(timer); abort.abort(); host.dataset.running = 'false'; } };
}
