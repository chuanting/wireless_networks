// M/M/m with one shared FCFS queue, or M/M/m/m with no waiting room.
// Arrival and service draws use separate streams; all time units are seconds.
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return (((x ^ (x >>> 14)) >>> 0) + 0.5) / 4294967296;
  };
}
function validate({ arrivalRate, serviceRate, servers, mode }) {
  if (!Number.isFinite(arrivalRate) || arrivalRate < 0) throw new RangeError('arrivalRate');
  if (!Number.isFinite(serviceRate) || serviceRate <= 0) throw new RangeError('serviceRate');
  if (!Number.isInteger(servers) || servers < 1 || servers > 16) throw new RangeError('servers');
  if (!['wait', 'loss'].includes(mode)) throw new RangeError('mode');
}
export function mmTheory(config) {
  validate(config);
  const { arrivalRate: lambda, serviceRate: mu, servers: m, mode } = config;
  const a = lambda / mu, rho = a / m;
  let blocking = 1;
  for (let k = 1; k <= m; k++) blocking = a * blocking / (k + a * blocking);
  if (mode === 'loss') {
    const effectiveRate = lambda * (1 - blocking);
    return { stable: true, a, rho, blocking, waitProbability: 0, meanW: 0,
      meanT: 1 / mu, effectiveRate, avgN: effectiveRate / mu,
      utilization: effectiveRate / (m * mu) };
  }
  if (rho >= 1) return { stable: false, a, rho, blocking: 0, effectiveRate: lambda,
    waitProbability: null, meanW: null, meanT: null, avgN: null, utilization: null };
  let term = 1, sum = 1;
  for (let k = 1; k < m; k++) { term *= a / k; sum += term; }
  const tail = term * a / m / (1 - rho);
  const waitProbability = tail / (sum + tail);
  const meanW = waitProbability / (m * mu - lambda);
  return { stable: true, a, rho, blocking: 0, waitProbability, meanW,
    meanT: meanW + 1 / mu, effectiveRate: lambda,
    avgN: lambda * (meanW + 1 / mu), utilization: rho };
}

export class MMQueueModel {
  constructor({ arrivalRate = 4, serviceRate = 5, servers = 1, mode = 'wait', seed = 2026 } = {}) {
    this.config = { arrivalRate, serviceRate, servers, mode, seed };
    validate(this.config);
    this._arrivalRandom = rng(seed); this._serviceRandom = rng(seed ^ 0x9E3779B9);
    this.time = 0; this.accepting = true; this.drained = false;
    this.attempted = 0; this.admitted = 0; this.rejected = 0; this.completed = 0; this.waited = 0;
    this.areaN = 0; this.areaQ = 0; this.busyArea = 0;
    this.totalWait = 0; this.totalSojourn = 0; this.totalService = 0;
    this.queue = []; this.servers = Array(servers).fill(null); this.recentCompleted = [];
    this.lastRejected = null; this._arrivalAt = this._arrivalInterval();
  }
  _arrivalInterval() { return this.config.arrivalRate ? -Math.log1p(-this._arrivalRandom()) / this.config.arrivalRate : Infinity; }
  _next() { return Math.min(this._arrivalAt, ...this.servers.map(p => p ? p.end : Infinity)); }
  _integrate(t) {
    const dt = Math.max(0, t - this.time), busy = this.servers.filter(Boolean).length;
    this.areaQ += this.queue.length * dt; this.busyArea += busy * dt;
    this.areaN += (this.queue.length + busy) * dt; this.time = Math.max(this.time, t);
  }
  _begin(packet, slot) {
    packet.start = this.time; packet.wait = Math.max(0, this.time - packet.arrival);
    packet.service = -Math.log1p(-this._serviceRandom()) / this.config.serviceRate;
    packet.end = this.time + packet.service; packet.slot = slot;
    this.servers[slot] = packet;
  }
  _event(t) {
    this._integrate(t);
    const tolerance = Number.EPSILON * 32 * Math.max(1, t);
    for (let i = 0; i < this.servers.length; i++) {
      const packet = this.servers[i];
      if (!packet || packet.end > t + tolerance) continue;
      packet.sojourn = packet.end - packet.arrival;
      this.completed++; this.totalWait += packet.wait;
      this.totalService += packet.service; this.totalSojourn += packet.sojourn;
      this.recentCompleted.unshift({ ...packet }); this.recentCompleted.length = Math.min(5, this.recentCompleted.length);
      this.servers[i] = null;
      if (this.queue.length) this._begin(this.queue.shift(), i);
    }
    if (this.accepting && this._arrivalAt <= t + tolerance) {
      const packet = { id: ++this.attempted, arrival: this.time };
      const slot = this.servers.findIndex(p => !p);
      if (slot < 0 && this.config.mode === 'loss') {
        this.rejected++; this.lastRejected = { ...packet };
      } else {
        this.admitted++;
        if (slot >= 0) this._begin(packet, slot);
        else { this.waited++; this.queue.push(packet); }
      }
      this._arrivalAt = this.time + this._arrivalInterval();
    }
    this._finish();
  }
  _finish() { if (!this.accepting && !this.queue.length && this.servers.every(p => !p)) this.drained = true; }
  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt');
    const target = this.time + dt;
    while (!this.drained && this._next() <= target) this._event(this._next());
    if (!this.drained) this._integrate(target);
    return this.snapshot();
  }
  nextEvent() { const next = this._next(); if (!this.drained && Number.isFinite(next)) this._event(next); return this.snapshot(); }
  stopArrivals() { this.accepting = false; this._arrivalAt = Infinity; this._finish(); return this.snapshot(); }
  drainAll() {
    this.stopArrivals();
    while (!this.drained) this._event(this._next());
    return this.snapshot();
  }
  snapshot() {
    const busy = this.servers.filter(Boolean).length, t = this.time;
    const meanW = this.completed ? this.totalWait / this.completed : null;
    const meanT = this.completed ? this.totalSojourn / this.completed : null;
    const effectiveRate = t ? this.admitted / t : null;
    return { ...this.config, time: t, accepting: this.accepting, drained: this.drained,
      attempted: this.attempted, admitted: this.admitted, rejected: this.rejected, completed: this.completed,
      waited: this.waited, busy, queueLength: this.queue.length, systemCount: this.queue.length + busy,
      queue: this.queue.slice(0, 8).map(p => ({ ...p })), servers: this.servers.map(p => p ? { ...p } : null),
      recentCompleted: this.recentCompleted.map(p => ({ ...p })), lastRejected: this.lastRejected && { ...this.lastRejected },
      nextEventTime: Number.isFinite(this._next()) ? this._next() : null,
      meanW, meanT, effectiveRate, meanService: this.completed ? this.totalService / this.completed : null,
      avgN: t ? this.areaN / t : null, avgQ: t ? this.areaQ / t : null,
      utilization: t ? this.busyArea / (this.config.servers * t) : null,
      blocking: this.attempted ? this.rejected / this.attempted : null,
      waitProbability: this.admitted ? this.waited / this.admitted : null,
      areaN: this.areaN, areaQ: this.areaQ, busyArea: this.busyArea,
      totalWait: this.totalWait, totalSojourn: this.totalSojourn, totalService: this.totalService,
      littleProduct: this.drained && this.completed ? effectiveRate * meanT : null,
      theory: mmTheory(this.config) };
  }
}
