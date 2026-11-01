/* Three FCFS M/G/1 systems driven by the same Poisson arrival stream.
 * Each lane has its own independent service RNG. Times and moments use seconds.
 * Theory is calculated from the distribution, never from simulated statistics.
 */
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return (((n ^ (n >>> 14)) >>> 0) + 0.5) / 4294967296;
  };
}
const expo = (random, mean) => -Math.log1p(-random()) * mean;

export function serviceMoments(meanService, longProbability = 0.1) {
  if (!(meanService > 0) || !Number.isFinite(meanService)) throw new RangeError('Positive mean service required');
  if (!(longProbability > 0 && longProbability < 1)) throw new RangeError('Probability must lie in (0,1)');
  const short = meanService * 0.1;
  const long = (meanService - (1 - longProbability) * short) / longProbability;
  return [
    { key: 'fixed', label: '固定服务', mean: meanService, second: meanService ** 2, cv2: 0 },
    { key: 'exponential', label: '指数服务', mean: meanService, second: 2 * meanService ** 2, cv2: 1 },
    { key: 'mixed', label: '短长混合', mean: meanService, second: (1 - longProbability) * short ** 2 + longProbability * long ** 2,
      cv2: (1 - longProbability) * (short / meanService - 1) ** 2 + longProbability * (long / meanService - 1) ** 2,
      short, long, longProbability },
  ];
}

export function pkTheory(arrivalRate, meanService, longProbability = 0.1) {
  if (!(arrivalRate >= 0) || !Number.isFinite(arrivalRate)) throw new RangeError('Nonnegative arrival rate required');
  const rho = arrivalRate * meanService;
  return serviceMoments(meanService, longProbability).map(m => ({ ...m, rho, stable: rho < 1,
    W: rho < 1 ? arrivalRate * m.second / (2 * (1 - rho)) : null,
    T: rho < 1 ? meanService + arrivalRate * m.second / (2 * (1 - rho)) : null }));
}

export class MG1Comparison {
  constructor({ arrivalRate = 4, meanService = 0.2, longProbability = 0.1, seed = 2026 } = {}) {
    this.theory = pkTheory(arrivalRate, meanService, longProbability);
    this.config = { arrivalRate, meanService, longProbability, seed };
    this.time = 0; this.arrived = 0; this.accepting = true; this.drained = false;
    this.arrivalRng = rng(seed);
    this.nextArrival = this._arrivalInterval();
    this.arrivalSample = [];
    this.lanes = this.theory.map((m, i) => ({ key: m.key, random: rng(seed + 1009 * (i + 1)), queue: [], head: 0, serving: null,
      completed: 0, totalWait: 0, totalSojourn: 0, totalService: 0, totalServiceSquared: 0,
      sampledService: 0, sampledServiceSquared: 0, longCount: 0,
      areaQ: 0, areaN: 0, busyTime: 0, recent: [] }));
  }
  _arrivalInterval() { return this.config.arrivalRate ? expo(this.arrivalRng, 1 / this.config.arrivalRate) : Infinity; }
  _size(lane) { return lane.queue.length - lane.head; }
  _sample(lane) {
    const { meanService, longProbability } = this.config;
    if (lane.key === 'fixed') return { service: meanService, long: false };
    if (lane.key === 'exponential') return { service: expo(lane.random, meanService), long: false };
    const long = lane.random() < longProbability, m = this.theory[2];
    return { service: long ? m.long : m.short, long };
  }
  _start(lane, packet) {
    packet.start = this.time; packet.end = this.time + packet.service;
    packet.wait = Math.max(0, this.time - packet.arrival); lane.serving = packet;
  }
  _integrate(to) {
    const dt = Math.max(0, to - this.time);
    for (const lane of this.lanes) {
      const q = this._size(lane), busy = lane.serving ? 1 : 0;
      lane.areaQ += q * dt; lane.areaN += (q + busy) * dt; lane.busyTime += busy * dt;
    }
    this.time = Math.max(this.time, to);
  }
  _nextTime() { return Math.min(this.nextArrival, ...this.lanes.map(l => l.serving?.end ?? Infinity)); }
  _event(at) {
    this._integrate(at);
    const eps = Number.EPSILON * 32 * Math.max(1, at);
    for (const lane of this.lanes) if (lane.serving && lane.serving.end <= at + eps) {
      const p = lane.serving; p.sojourn = p.end - p.arrival;
      lane.completed++; lane.totalWait += p.wait; lane.totalSojourn += p.sojourn;
      lane.totalService += p.service; lane.totalServiceSquared += p.service ** 2;
      lane.recent.unshift({ ...p }); lane.recent.length = Math.min(lane.recent.length, 4);
      lane.serving = null;
      if (this._size(lane)) this._start(lane, lane.queue[lane.head++]);
      if (lane.head > 1024 && lane.head * 2 > lane.queue.length) { lane.queue = lane.queue.slice(lane.head); lane.head = 0; }
    }
    if (this.accepting && this.nextArrival <= at + eps) {
      const id = ++this.arrived;
      if (this.arrivalSample.length < 12) this.arrivalSample.push(this.time);
      for (const lane of this.lanes) {
        const sample = this._sample(lane);
        const packet = { id, arrival: this.time, ...sample };
        lane.sampledService += sample.service; lane.sampledServiceSquared += sample.service ** 2;
        if (sample.long) lane.longCount++;
        if (lane.serving) lane.queue.push(packet); else this._start(lane, packet);
      }
      this.nextArrival = this.time + this._arrivalInterval();
    }
    this._finishDrain();
  }
  _finishDrain() { if (!this.accepting && this.lanes.every(l => !l.serving && !this._size(l))) this.drained = true; }
  advance(dt) {
    if (!(dt >= 0) || !Number.isFinite(dt)) throw new RangeError('Finite nonnegative time required');
    if (this.drained) return this.snapshot();
    const target = this.time + dt;
    if (!Number.isFinite(target)) throw new RangeError('Time overflow');
    let at = this._nextTime();
    while (!this.drained && Number.isFinite(at) && at <= target) { this._event(at); at = this._nextTime(); }
    if (!this.drained) this._integrate(target);
    return this.snapshot();
  }
  nextEvent() { const t = this._nextTime(); if (!this.drained && Number.isFinite(t)) this._event(t); return this.snapshot(); }
  stopArrivals() { this.accepting = false; this.nextArrival = Infinity; this._finishDrain(); return this.snapshot(); }
  drain() { this.stopArrivals(); while (!this.drained) this._event(this._nextTime()); return this.snapshot(); }
  snapshot() {
    return { ...this.config, time: this.time, arrived: this.arrived, accepting: this.accepting, drained: this.drained,
      nextEventTime: Number.isFinite(this._nextTime()) ? this._nextTime() : null,
      arrivalSample: [...this.arrivalSample], theory: this.theory.map(t => ({...t})),
      lanes: this.lanes.map(l => ({ key: l.key, arrived: this.arrived, queueLength: this._size(l),
        queue: l.queue.slice(l.head, l.head + 6).map(p => ({ ...p })), serving: l.serving ? {...l.serving} : null,
        completed: l.completed, areaQ: l.areaQ, areaN: l.areaN, busyTime: l.busyTime,
        avgQ: this.time ? l.areaQ / this.time : 0, avgN: this.time ? l.areaN / this.time : 0,
        utilization: this.time ? l.busyTime / this.time : 0,
        meanW: l.completed ? l.totalWait / l.completed : null,
        meanT: l.completed ? l.totalSojourn / l.completed : null,
        meanService: l.completed ? l.totalService / l.completed : null,
        meanSecond: l.completed ? l.totalServiceSquared / l.completed : null,
        sampledMean: this.arrived ? l.sampledService / this.arrived : null,
        totalWait: l.totalWait, totalSojourn: l.totalSojourn, totalService: l.totalService,
        longCount: l.longCount, recent: l.recent.map(p => ({...p})) })) };
  }
}
