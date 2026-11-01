/* Open CPU / I/O Jackson network. Every visit draws a fresh independent
 * exponential service time. Time is in seconds; routing takes zero time. */
function randomStream(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (((x ^ (x >>> 14)) >>> 0) + 0.5) / 4294967296;
  };
}
function validate({ gamma, feedback, muCPU, muIO }) {
  if (!Number.isFinite(gamma) || gamma < 0) throw new RangeError('gamma must be nonnegative');
  if (!Number.isFinite(feedback) || feedback < 0 || feedback >= 1) throw new RangeError('feedback must be in [0, 1)');
  if (![muCPU, muIO].every(x => Number.isFinite(x) && x > 0)) throw new RangeError('service rates must be positive');
}
export function networkTheory({ gamma = 1, feedback = 0.75, muCPU = 8, muIO = 5 } = {}) {
  validate({ gamma, feedback, muCPU, muIO });
  const visits = [1 / (1 - feedback), feedback / (1 - feedback)];
  const lambda = visits.map(v => gamma * v);
  const mu = [muCPU, muIO];
  const rho = lambda.map((v, i) => v / mu[i]);
  const stable = rho.every(r => r < 1);
  const meanN = stable ? lambda.map((v, i) => v / (mu[i] - v)) : [null, null];
  const totalN = stable ? meanN[0] + meanN[1] : null;
  const meanT = stable ? visits.reduce((sum, v, i) => sum + v / (mu[i] - lambda[i]), 0) : null;
  return { visits, lambda, rho, stable, meanN, totalN, meanT };
}

export class NetworkQueueModel {
  constructor({ gamma = 1, feedback = 0.75, muCPU = 8, muIO = 5, seed = 2026 } = {}) {
    validate({ gamma, feedback, muCPU, muIO });
    if (!Number.isFinite(seed)) throw new RangeError('seed must be finite');
    this.config = { gamma, feedback, muCPU, muIO, seed };
    this.theory = networkTheory(this.config);
    this._arrivalRandom = randomStream(seed);
    this._serviceRandom = [randomStream(seed ^ 0xABC123), randomStream(seed ^ 0xDEF456)];
    this._routeRandom = randomStream(seed ^ 0x719CAB);
    this.time = 0;
    this.accepting = true;
    this.drained = false;
    this.arrived = 0;
    this.completed = 0;
    this.totalSojourn = 0;
    this.totalCompletedVisits = [0, 0];
    this.feedbackCount = 0;
    this._recent = [];
    this._events = [];
    this.nodes = [muCPU, muIO].map(mu => ({ mu, queue: [], serving: null, areaN: 0, areaQ: 0, busyTime: 0, visits: 0, completions: 0, totalSojourn: 0 }));
    this._nextArrival = this._externalInterval();
  }
  _externalInterval() { return this.config.gamma ? -Math.log1p(-this._arrivalRandom()) / this.config.gamma : Infinity; }
  _eventTime() { return Math.min(this._nextArrival, ...this.nodes.map(n => n.serving ? n.serving.end : Infinity)); }
  _count() { return this.nodes.reduce((sum, n) => sum + n.queue.length + (n.serving ? 1 : 0), 0); }
  _integrate(to) {
    const dt = Math.max(0, to - this.time);
    for (const n of this.nodes) {
      n.areaQ += n.queue.length * dt;
      n.busyTime += (n.serving ? 1 : 0) * dt;
      n.areaN += (n.queue.length + (n.serving ? 1 : 0)) * dt;
    }
    this.time = Math.max(this.time, to);
  }
  _log(text, id) {
    this._events.unshift({ time: this.time, text, id });
    this._events.length = Math.min(this._events.length, 5);
  }
  _begin(nodeIndex, packet) {
    const node = this.nodes[nodeIndex];
    const duration = -Math.log1p(-this._serviceRandom[nodeIndex]()) / node.mu;
    packet.start = this.time;
    packet.end = this.time + duration;
    packet.waitTotal += this.time - packet.nodeArrival;
    packet.serviceTotal += duration;
    node.serving = packet;
  }
  _enter(nodeIndex, packet) {
    const node = this.nodes[nodeIndex];
    node.visits++;
    packet.visits[nodeIndex]++;
    packet.nodeArrival = this.time;
    packet.start = null; packet.end = null;
    if (node.serving) node.queue.push(packet);
    else this._begin(nodeIndex, packet);
  }
  _finishDrain() { if (!this.accepting && this._count() === 0) this.drained = true; }
  _event(at) {
    this._integrate(at);
    const eps = Number.EPSILON * 32 * Math.max(1, at);
    const finished = [];
    this.nodes.forEach((node, index) => {
      if (node.serving && node.serving.end <= at + eps) {
        const packet = node.serving;
        node.completions++;
        node.totalSojourn += this.time - packet.nodeArrival;
        node.serving = null;
        finished.push([index, packet]);
        if (node.queue.length) this._begin(index, node.queue.shift());
      }
    });
    for (const [index, packet] of finished) {
      if (index === 1) {
        this._enter(0, packet);
        this._log('I/O → CPU，继续处理', packet.id);
      } else if (this._routeRandom() < this.config.feedback) {
        this.feedbackCount++;
        this._enter(1, packet);
        this._log('CPU → I/O，尚未离网', packet.id);
      } else {
        packet.sojourn = this.time - packet.arrival;
        packet.departure = this.time;
        this.completed++;
        this.totalSojourn += packet.sojourn;
        packet.visits.forEach((v, i) => { this.totalCompletedVisits[i] += v; });
        this._recent.unshift({ ...packet, visits: [...packet.visits] });
        this._recent.length = Math.min(5, this._recent.length);
        this._log('CPU → 离网，任务完成', packet.id);
      }
    }
    if (this.accepting && this._nextArrival <= at + eps) {
      const packet = { id: ++this.arrived, arrival: this.time, visits: [0, 0], waitTotal: 0, serviceTotal: 0 };
      this._enter(0, packet);
      this._nextArrival = this.time + this._externalInterval();
      this._log('外部 → CPU，新任务到达', packet.id);
    }
    this._finishDrain();
  }
  nextEvent() {
    if (!this.drained) {
      const next = this._eventTime();
      if (Number.isFinite(next)) this._event(next);
      else this._finishDrain();
    }
    return this.snapshot();
  }
  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(this.time + dt)) throw new RangeError('invalid interval');
    if (this.drained) return this.snapshot();
    const target = this.time + dt;
    let next = this._eventTime();
    while (!this.drained && Number.isFinite(next) && next <= target) { this._event(next); next = this._eventTime(); }
    if (!this.drained) this._integrate(target);
    return this.snapshot();
  }
  stopArrivals() { this.accepting = false; this._nextArrival = Infinity; this._finishDrain(); return this.snapshot(); }
  drain(maxEvents = 1000000) {
    this.stopArrivals();
    let events = 0;
    while (!this.drained && events++ < maxEvents) {
      const at = this._eventTime();
      if (!Number.isFinite(at)) break;
      this._event(at);
    }
    if (!this.drained) throw new Error('Drain event limit exceeded');
    return this.snapshot();
  }
  snapshot() {
    const copy = packet => packet ? { ...packet, visits: [...packet.visits] } : null;
    const nodes = this.nodes.map(n => ({
      queue: n.queue.map(copy), serving: copy(n.serving), queueLength: n.queue.length,
      count: n.queue.length + (n.serving ? 1 : 0), visits: n.visits, completions: n.completions,
      areaN: n.areaN, areaQ: n.areaQ, busyTime: n.busyTime, totalSojourn: n.totalSojourn,
      avgN: this.time ? n.areaN / this.time : 0, utilization: this.time ? n.busyTime / this.time : 0,
      observedRate: this.time ? n.visits / this.time : 0,
    }));
    const avgN = nodes.reduce((sum, n) => sum + n.avgN, 0);
    const meanT = this.completed ? this.totalSojourn / this.completed : 0;
    const observedGamma = this.time ? this.arrived / this.time : 0;
    const next = this._eventTime();
    return { ...this.config, time: this.time, accepting: this.accepting, drained: this.drained,
      arrived: this.arrived, completed: this.completed, count: this._count(), nodes, avgN, meanT,
      observedGamma, littleProduct: this.drained ? observedGamma * meanT : null,
      totalSojourn: this.totalSojourn, feedbackCount: this.feedbackCount,
      meanVisits: this.totalCompletedVisits.map(v => this.completed ? v / this.completed : 0),
      recentCompleted: this._recent.map(copy), recentEvents: this._events.map(e => ({ ...e })),
      nextEventTime: Number.isFinite(next) ? next : null,
      theory: { ...this.theory, visits: [...this.theory.visits], lambda: [...this.theory.lambda], rho: [...this.theory.rho], meanN: [...this.theory.meanN] },
    };
  }
}
