/*
 * 主页背景：一个实时仿真的通信网络。
 *   · 路由器 / 6G 基站（向外扩散的覆盖圈）/ 终端 / 低轨卫星
 *   · 数据包沿「当前代价最小」的路径转发（Dijkstra，逐跳重新计算 → 自适应路由）
 *   · 链路利用率越高颜色越偏琥珀/红色，包的速度也越慢（拥塞）
 *   · 周期性演示：路由发现（最短路径波前扩散）与突发流量（拥塞 + 绕行）
 * 纯 Canvas 2D，无依赖；尊重 prefers-reduced-motion。
 */
(function () {
  'use strict';
  const canvas = document.getElementById('net');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  const TAU = Math.PI * 2;
  const C = {
    cyan: [53, 224, 255], violet: [139, 123, 255], amber: [255, 181, 71],
    red: [255, 92, 122], green: [56, 232, 160], base: [84, 140, 205], white: [232, 244, 255]
  };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const ek = (a, b) => (a < b ? a * 256 + b : b * 256 + a);
  function rng32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function utilColor(u, a) {
    return u < 0.5 ? rgba(mix(C.base, C.amber, u / 0.5), a) : rgba(mix(C.amber, C.red, (u - 0.5) / 0.5), a);
  }
  function makeGlow(rgb, r) {
    const c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, rgba(rgb, 1));
    gr.addColorStop(0.28, rgba(rgb, 0.5));
    gr.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, r * 2, r * 2);
    return c;
  }
  const glow = {
    cyan: makeGlow(C.cyan, 24), amber: makeGlow(C.amber, 24), white: makeGlow(C.white, 24),
    violet: makeGlow(C.violet, 24), green: makeGlow(C.green, 24), red: makeGlow(C.red, 24)
  };
  function blob(name, x, y, size, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.drawImage(glow[name], x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  /* ---------------- state ---------------- */
  let W = 0, H = 0, dpr = 1;
  let nodes = [], edges = [], adj = [], edgeMap = new Map(), ues = [], sats = [];
  let packets = [], routeAnim = null, burst = null;
  let clock = 0, last = 0, nextRoute = 2.0, nextBurst = 11, spawnAcc = 0;
  let avgDelay = 4;
  let rafId = 0;

  const el = {
    flight: document.getElementById('hud-flight'),
    delay: document.getElementById('hud-delay'),
    cong: document.getElementById('hud-cong'),
    event: document.getElementById('hud-event'),
    spark: document.getElementById('spark')
  };
  const sparkBuf = new Array(80).fill(0);
  let hudT = 1;

  /* ---------------- layout ---------------- */
  function build() {
    const rnd = rng32(20261016);
    const n = clamp(Math.round(W * H / 54000), 16, 46);
    const minD = Math.max(58, Math.sqrt(W * H / n) * 0.64);
    nodes = [];
    for (let tries = 0; nodes.length < n && tries < 8000; tries++) {
      const x = (0.035 + 0.93 * rnd()) * W, y = (0.14 + 0.80 * rnd()) * H;
      if (nodes.every(p => Math.hypot(p.x - x, p.y - y) > minD)) nodes.push({ x, y, type: 'r' });
    }
    // 基站：最远点采样，保证分布均匀
    const nb = clamp(Math.round(nodes.length * 0.2), 4, 8);
    let first = 0, bd = Infinity;
    nodes.forEach((p, i) => { const d = Math.hypot(p.x - W * 0.72, p.y - H * 0.5); if (d < bd) { bd = d; first = i; } });
    const chosen = [first];
    while (chosen.length < nb) {
      let best = -1, bestD = -1;
      nodes.forEach((p, i) => {
        if (chosen.includes(i)) return;
        const d = Math.min.apply(null, chosen.map(j => dist(p, nodes[j])));
        if (d > bestD) { bestD = d; best = i; }
      });
      chosen.push(best);
    }
    chosen.forEach(i => { nodes[i].type = 'b'; });

    edges = []; edgeMap = new Map(); adj = nodes.map(() => []);
    const addEdge = (a, b) => {
      const k = ek(a, b);
      if (edgeMap.has(k)) return;
      const e = { a, b, len: dist(nodes[a], nodes[b]), u: 0, n: 0 };
      edgeMap.set(k, e);
      adj[a].push(edges.length); adj[b].push(edges.length);
      edges.push(e);
    };
    nodes.forEach((p, i) => {
      const order = nodes.map((q, j) => [j, dist(p, q)]).filter(x => x[0] !== i).sort((s, t) => s[1] - t[1]);
      const k = p.type === 'b' ? 3 : 2 + (rnd() < 0.35 ? 1 : 0);
      for (let m = 0; m < k && m < order.length; m++) addEdge(i, order[m][0]);
    });
    // 保证连通
    const uf = nodes.map((_, i) => i);
    const find = x => (uf[x] === x ? x : (uf[x] = find(uf[x])));
    edges.forEach(e => { uf[find(e.a)] = find(e.b); });
    for (;;) {
      if (new Set(nodes.map((_, i) => find(i))).size <= 1) break;
      let best = null;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        if (find(i) !== find(j)) { const d = dist(nodes[i], nodes[j]); if (!best || d < best.d) best = { i, j, d }; }
      }
      addEdge(best.i, best.j); uf[find(best.i)] = find(best.j);
    }

    ues = [];
    nodes.forEach((p, i) => {
      if (p.type !== 'b') return;
      const m = 3 + ((rnd() * 3) | 0);
      for (let k = 0; k < m; k++) {
        const ang = rnd() * TAU, r = 34 + rnd() * 40;
        ues.push({ bs: i, x: clamp(p.x + Math.cos(ang) * r, 8, W - 8), y: clamp(p.y + Math.sin(ang) * r, 72, H - 8), ph: rnd() * 3 });
      }
    });
    sats = [{ ph: 0.1, sp: 16, y: 0.065 }, { ph: 0.46, sp: 22, y: 0.1 }, { ph: 0.8, sp: 12, y: 0.08 }];
    packets = []; routeAnim = null; burst = null;
  }

  /* ---------------- routing ---------------- */
  const weight = e => e.len * (1 + 4 * e.u);
  function dijkstra(src, dst, wf) {
    const n = nodes.length, d = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
    d[src] = 0;
    for (let it = 0; it < n; it++) {
      let u = -1, b = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && d[i] < b) { b = d[i]; u = i; }
      if (u < 0) break;
      done[u] = true;
      if (u === dst) break;
      for (const ei of adj[u]) {
        const e = edges[ei], v = e.a === u ? e.b : e.a, w = d[u] + wf(e);
        if (w < d[v]) { d[v] = w; prev[v] = u; }
      }
    }
    return { dist: d, prev };
  }
  function pathTo(prev, dst) {
    const p = [];
    for (let v = dst; v !== -1; v = prev[v]) p.push(v);
    return p.reverse();
  }
  function route(src, dst) {
    const r = dijkstra(src, dst, weight);
    if (!isFinite(r.dist[dst])) return null;
    return pathTo(r.prev, dst);
  }
  function pickOD(frac) {
    const minDist = Math.min(W, H) * frac;
    for (let k = 0; k < 40; k++) {
      const a = (Math.random() * nodes.length) | 0, b = (Math.random() * nodes.length) | 0;
      if (a !== b && dist(nodes[a], nodes[b]) > minDist) return [a, b];
    }
    return [0, nodes.length - 1];
  }
  function spawn(src, dst, tint) {
    if (packets.length > 260) return;
    const p = route(src, dst);
    if (!p || p.length < 2) return;
    packets.push({ path: p, seg: 0, t: 0, dst, speed: 190 + Math.random() * 90, tint: tint || 'cyan', born: clock });
  }

  /* ---------------- simulation ---------------- */
  function update(dt) {
    // 事件调度
    if (clock > nextRoute && !routeAnim) { startRoute(); nextRoute = clock + 8 + Math.random() * 4; }
    if (clock > nextBurst && !burst) { startBurst(); nextBurst = clock + 16 + Math.random() * 6; }
    if (burst && clock > burst.until) burst = null;

    // 产生分组
    spawnAcc += dt * clamp(nodes.length * 0.2, 4, 9);
    while (spawnAcc >= 1) { spawnAcc -= 1; const od = pickOD(0.25); spawn(od[0], od[1], 'cyan'); }
    if (burst) {
      burst.acc += dt * 15;
      while (burst.acc >= 1) { burst.acc -= 1; spawn(burst.s, burst.d, 'amber'); }
    }

    // 推进分组
    edges.forEach(e => { e.n = 0; });
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      const a = p.path[p.seg], b = p.path[p.seg + 1];
      const e = edgeMap.get(ek(a, b));
      e.n++;
      p.t += (p.speed * (1 - 0.72 * Math.min(1, e.u)) * dt) / e.len;
      if (p.t >= 1) {
        p.t = 0; p.seg++;
        const cur = p.path[p.seg];
        if (cur === p.dst) {
          avgDelay = lerp(avgDelay, clock - p.born, 0.06);
          packets.splice(i, 1);
        } else {
          const np = route(cur, p.dst);          // 逐跳自适应：按当前拥塞重新选路
          if (np && np.length > 1) { p.path = np; p.seg = 0; } else packets.splice(i, 1);
        }
      }
    }
    const k = 1 - Math.exp(-dt * 2.6);
    edges.forEach(e => { e.u += (clamp(e.n / 4, 0, 1) - e.u) * k; });
    if (routeAnim && clock - routeAnim.t0 > 5.8) routeAnim = null;
  }

  function startRoute() {
    const od = pickOD(0.4);
    const r = dijkstra(od[0], od[1], e => e.len);
    const path = pathTo(r.prev, od[1]);
    if (path.length < 3) return;
    routeAnim = { s: od[0], d: od[1], dist: r.dist, path, t0: clock, maxD: r.dist[od[1]] * 1.15 };
  }
  function startBurst() {
    const od = pickOD(0.45);
    burst = { s: od[0], d: od[1], until: clock + 5.5, acc: 0 };
  }

  /* ---------------- drawing ---------------- */
  function pos(p) {
    const a = nodes[p.path[p.seg]], b = nodes[p.path[p.seg + 1]];
    return [lerp(a.x, b.x, p.t), lerp(a.y, b.y, p.t)];
  }
  function mono(px) { return '500 ' + px + 'px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace'; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    // 链路（颜色 = 利用率）
    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      if (e.u > 0.45) {
        ctx.strokeStyle = utilColor(e.u, 0.18 + 0.2 * e.u);
        ctx.lineWidth = 6 + e.u * 6;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.strokeStyle = utilColor(e.u, 0.2 + 0.55 * e.u);
      ctx.lineWidth = 1.1 + e.u * 1.8;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    // 路由发现：波前扩散 + 最短路径
    if (routeAnim) drawRoute();

    // 终端与无线链路
    ues.forEach(u => {
      const b = nodes[u.bs];
      ctx.strokeStyle = rgba(C.violet, 0.22);
      ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = rgba(C.white, 0.55);
      ctx.beginPath(); ctx.arc(u.x, u.y, 1.9, 0, TAU); ctx.fill();
      const ph = ((clock * 0.55 + u.ph) % 3) / 3;      // 0..1 内，前 0.4 段有数据
      if (ph < 0.4) {
        const q = ph / 0.4, up = u.ph > 1.5;
        const x = up ? lerp(u.x, b.x, q) : lerp(b.x, u.x, q), y = up ? lerp(u.y, b.y, q) : lerp(b.y, u.y, q);
        ctx.globalCompositeOperation = 'lighter';
        blob('violet', x, y, 12, 0.9);
        ctx.globalCompositeOperation = 'source-over';
      }
    });

    // 卫星与星地链路
    const bsList = nodes.filter(p => p.type === 'b');
    sats.forEach((s, i) => {
      const x = ((s.ph * (W + 200) + clock * s.sp) % (W + 200)) - 100;
      const y = H * s.y + Math.sin(clock * 0.5 + s.ph * 9) * 8;
      let nb = null, nd = Infinity;
      bsList.forEach(b => { const d = Math.hypot(b.x - x, b.y - y); if (d < nd) { nd = d; nb = b; } });
      if (nb && nd < Math.max(W, H) * 0.55) {
        ctx.strokeStyle = rgba(C.green, 0.2); ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nb.x, nb.y); ctx.stroke(); ctx.setLineDash([]);
        const q = (clock * 0.6 + i * 0.37) % 1;
        ctx.globalCompositeOperation = 'lighter';
        blob('green', lerp(x, nb.x, q), lerp(y, nb.y, q), 14, 0.9);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = rgba(C.white, 0.9); ctx.fillRect(-3.5, -3.5, 7, 7);
      ctx.fillStyle = rgba(C.green, 0.85); ctx.fillRect(-11, -1.6, 6, 3.2); ctx.fillRect(5, -1.6, 6, 3.2);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter'; blob('green', x, y, 30, 0.45); ctx.globalCompositeOperation = 'source-over';
    });

    // 基站覆盖圈
    ctx.lineWidth = 1.2;
    bsList.forEach((b, i) => {
      for (let k = 0; k < 2; k++) {
        const ph = (clock * 0.28 + i * 0.31 + k * 0.5) % 1;
        ctx.strokeStyle = rgba(i % 2 ? C.cyan : C.violet, (1 - ph) * 0.32);
        ctx.beginPath(); ctx.arc(b.x, b.y, 12 + ph * 92, 0, TAU); ctx.stroke();
      }
    });

    // 节点
    nodes.forEach(p => {
      if (p.type === 'b') {
        ctx.globalCompositeOperation = 'lighter'; blob('violet', p.x, p.y, 52, 0.75); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(C.white, 0.95);
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x - 5.5, p.y + 6); ctx.lineTo(p.x + 5.5, p.y + 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgba(C.violet, 1);
        ctx.beginPath(); ctx.arc(p.x, p.y - 10, 2.4, 0, TAU); ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter'; blob('cyan', p.x, p.y, 20, 0.5); ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(C.white, 0.9);
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.8, 0, TAU); ctx.fill();
      }
    });

    // 分组
    ctx.globalCompositeOperation = 'lighter';
    packets.forEach(p => {
      const xy = pos(p), a = nodes[p.path[p.seg]], b = nodes[p.path[p.seg + 1]];
      const e = edgeMap.get(ek(p.path[p.seg], p.path[p.seg + 1]));
      const back = Math.min(p.t, 0.22);
      const x0 = lerp(a.x, b.x, p.t - back), y0 = lerp(a.y, b.y, p.t - back);
      const col = p.tint === 'amber' ? C.amber : C.cyan;
      ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(xy[0], xy[1]); ctx.stroke();
      blob(e.u > 0.6 ? 'red' : (p.tint === 'amber' ? 'amber' : 'cyan'), xy[0], xy[1], 15, 1);
    });
    ctx.globalCompositeOperation = 'source-over';

    // 突发流量标注
    if (burst) {
      const s = nodes[burst.s], d = nodes[burst.d], ph = (clock * 1.6) % 1;
      [s, d].forEach(p => { ctx.strokeStyle = rgba(C.amber, 0.7 * (1 - ph)); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(p.x, p.y, 10 + ph * 22, 0, TAU); ctx.stroke(); });
      ctx.font = mono(11); ctx.fillStyle = rgba(C.amber, 0.95);
      ctx.fillText('FLASH CROWD', s.x + 14, s.y - 14);
      ctx.fillText('SINK', d.x + 14, d.y - 14);
    }
  }

  function drawRoute() {
    const r = routeAnim, t = clock - r.t0;
    const wp = clamp(t / 1.5, 0, 1), rad = wp * r.maxD;
    const fade = t < 1.5 ? 1 : clamp(1 - (t - 1.5) / 0.9, 0, 1);
    const s = nodes[r.s], d = nodes[r.d];
    if (fade > 0) {
      edges.forEach(e => {
        const dm = Math.min(r.dist[e.a], r.dist[e.b]);
        if (!(dm <= rad)) return;
        const age = clamp((rad - dm) / (0.4 * r.maxD), 0, 1);
        ctx.strokeStyle = rgba(C.cyan, (0.12 + 0.6 * (1 - age)) * fade);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(nodes[e.a].x, nodes[e.a].y); ctx.lineTo(nodes[e.b].x, nodes[e.b].y); ctx.stroke();
      });
      if (wp < 1) {
        ctx.strokeStyle = rgba(C.cyan, 0.3 * (1 - wp)); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(s.x, s.y, rad, 0, TAU); ctx.stroke();
      }
    }
    // 最短路径逐段点亮
    if (t > 1.1) {
      const prog = clamp((t - 1.1) / 0.9, 0, 1);
      const fadeOut = t > 5.0 ? clamp((5.8 - t) / 0.8, 0, 1) : 1;
      let total = 0; const segs = [];
      for (let i = 0; i < r.path.length - 1; i++) { const a = nodes[r.path[i]], b = nodes[r.path[i + 1]]; const l = dist(a, b); segs.push([a, b, l]); total += l; }
      let remain = prog * total;
      ctx.beginPath();
      for (let i = 0; i < segs.length && remain > 0; i++) {
        const [a, b, l] = segs[i], q = Math.min(1, remain / l);
        ctx.moveTo(a.x, a.y); ctx.lineTo(lerp(a.x, b.x, q), lerp(a.y, b.y, q)); remain -= l;
      }
      ctx.strokeStyle = rgba(C.cyan, 0.2 * fadeOut); ctx.lineWidth = 11; ctx.stroke();
      ctx.strokeStyle = rgba(C.white, 0.95 * fadeOut); ctx.lineWidth = 2.6;
      ctx.setLineDash([14, 9]); ctx.lineDashOffset = -clock * 40; ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
    }
    if (t > 0.15) {
      const a = clamp(t < 5 ? 1 : (5.8 - t) / 0.8, 0, 1);
      ctx.strokeStyle = rgba(C.cyan, 0.9 * a); ctx.lineWidth = 1.6;
      [s, d].forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, TAU); ctx.stroke(); });
      ctx.font = mono(11); ctx.fillStyle = rgba(C.cyan, a);
      ctx.fillText('SRC', s.x + 13, s.y - 12);
      ctx.fillText('DST · ' + (r.path.length - 1) + ' hops · Dijkstra', d.x + 13, d.y - 12);
    }
  }

  /* ---------------- HUD ---------------- */
  function updateHud(dt) {
    hudT += dt;
    if (hudT < 0.25) return;
    hudT = 0;
    let sum = 0, cong = 0;
    edges.forEach(e => { sum += e.u; if (e.u > 0.55) cong++; });
    sparkBuf.push(sum / Math.max(1, edges.length)); sparkBuf.shift();
    if (el.flight) el.flight.textContent = packets.length;
    if (el.delay) el.delay.textContent = Math.round(avgDelay * 8);
    if (el.cong) el.cong.textContent = cong;
    if (el.event) {
      el.event.textContent = burst ? '突发流量 · 拥塞出现，路由自适应绕行'
        : routeAnim ? ('路由发现 · Dijkstra 最短路径 ' + (routeAnim.path.length - 1) + ' 跳')
        : '稳态转发';
      el.event.style.color = burst ? 'var(--amber)' : (routeAnim ? 'var(--cyan)' : 'var(--muted)');
    }
    drawSpark();
  }
  function drawSpark() {
    const s = el.spark; if (!s) return;
    const g = s.getContext('2d'), w = s.width, h = s.height;
    g.clearRect(0, 0, w, h);
    const max = 0.55, step = w / (sparkBuf.length - 1);
    g.beginPath();
    sparkBuf.forEach((v, i) => { const y = h - 4 - clamp(v / max, 0, 1) * (h - 10); if (i) g.lineTo(i * step, y); else g.moveTo(0, y); });
    g.strokeStyle = rgba(C.cyan, 0.95); g.lineWidth = 2 * dpr; g.lineJoin = 'round'; g.stroke();
    g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, rgba(C.cyan, 0.28)); gr.addColorStop(1, rgba(C.cyan, 0));
    g.fillStyle = gr; g.fill();
  }

  /* ---------------- loop / resize ---------------- */
  function frame(ts) {
    const t = ts / 1000;
    const dt = last ? clamp(t - last, 0, 0.05) : 0.016;
    last = t; clock += dt;
    update(dt); draw(); updateHud(dt);
    rafId = requestAnimationFrame(frame);
  }
  function resize(force) {
    const w = window.innerWidth, h = window.innerHeight;
    if (!force && Math.abs(w - W) < 2 && Math.abs(h - H) < 90) return;
    W = w; H = h; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (el.spark) { el.spark.width = Math.round((el.spark.clientWidth || 340) * dpr); el.spark.height = Math.round(56 * dpr); }
    build();
    if (reduce) staticFrame();
  }
  function staticFrame() {
    for (let i = 0; i < 90; i++) { clock += 0.05; update(0.05); }
    startRoute();
    if (routeAnim) routeAnim.t0 = clock - 3;
    draw(); hudT = 1; updateHud(0.3);
  }

  let timer = 0;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(resize, 150); });
  resize(true);
  if (!reduce) rafId = requestAnimationFrame(frame);
})();
