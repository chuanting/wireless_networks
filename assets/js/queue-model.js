/* Single-server FCFS queue, with exact event-time occupancy integrals.
 * All times are in seconds. Configuration is fixed for one run; construct a
 * new model when changing parameters so that one set of statistics has one
 * well-defined population and observation interval.
 */
export class QueueModel {
  constructor({ arrivalRate = 4, serviceTime = 0.2, arrivalMode = 'poisson', seed = 2026 } = {}) {
    if (!Number.isFinite(arrivalRate) || arrivalRate < 0) throw new RangeError('arrivalRate must be finite and nonnegative');
    if (!Number.isFinite(serviceTime) || serviceTime <= 0) throw new RangeError('serviceTime must be finite and positive');
    if (!['poisson', 'periodic'].includes(arrivalMode)) throw new RangeError('Unknown arrivalMode');
    if (!Number.isFinite(seed)) throw new RangeError('seed must be finite');
    this.arrivalRate = arrivalRate;
    this.serviceTime = serviceTime;
    this.arrivalMode = arrivalMode;
    this.seed = seed >>> 0;
    this._rngState = this.seed;
    this.time = 0;
    this.accepting = true;
    this.drained = false;
    this.drainTime = null;
    this.arrived = 0;
    this.completed = 0;
    this.areaN = 0;
    this.areaQ = 0;
    this.busyTime = 0;
    this.totalWait = 0;
    this.totalSojourn = 0;
    this._queue = [];
    this._serving = null;
    this._recentCompleted = [];
    this._nextArrival = this._interval();
  }

  // Mulberry32: a fixed seed gives the same trace regardless of animation FPS.
  _random() {
    this._rngState = (this._rngState + 0x6D2B79F5) >>> 0;
    let value = this._rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    // A midpoint in (0, 1) avoids zero and infinite exponential intervals.
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296 + 0.5 / 4294967296;
  }

  _interval() {
    if (this.arrivalRate === 0) return Infinity;
    return this.arrivalMode === 'periodic'
      ? 1 / this.arrivalRate
      : -Math.log1p(-this._random()) / this.arrivalRate;
  }

  _tolerance(t) { return Number.EPSILON * 32 * Math.max(1, Math.abs(t)); }

  _integrate(to) {
    const dt = Math.max(0, to - this.time);
    const busy = this._serving ? 1 : 0;
    this.areaQ += this._queue.length * dt;
    this.busyTime += busy * dt;
    this.areaN += (this._queue.length + busy) * dt;
    this.time = Math.max(this.time, to);
  }

  _begin(packet) {
    packet.start = this.time;
    packet.end = this.time + this.serviceTime;
    packet.wait = Math.max(0, packet.start - packet.arrival);
    packet.service = this.serviceTime;
    this._serving = packet;
  }

  _finishDrain() {
    if (!this.accepting && !this._serving && this._queue.length === 0) {
      this.drained = true;
      this.drainTime = this.time;
    }
  }

  _eventTime() {
    return Math.min(this._nextArrival, this._serving ? this._serving.end : Infinity);
  }

  _processEvent(at) {
    this._integrate(at);
    const tolerance = this._tolerance(at);
    // Finish service before handling an arrival at the same instant. Starting
    // the next waiting packet also happens at that instant, without idle time.
    if (this._serving && this._serving.end <= at + tolerance) {
      const packet = this._serving;
      packet.sojourn = Math.max(0, packet.end - packet.arrival);
      this.completed++;
      this.totalWait += packet.wait;
      this.totalSojourn += packet.sojourn;
      this._recentCompleted.unshift({ ...packet });
      this._recentCompleted.length = Math.min(8, this._recentCompleted.length);
      this._serving = null;
      if (this._queue.length) this._begin(this._queue.shift());
    }
    if (this.accepting && this._nextArrival <= at + tolerance) {
      const packet = { id: ++this.arrived, arrival: this.time, start: null, end: null };
      if (this._serving) this._queue.push(packet);
      else this._begin(packet);
      this._nextArrival = this.time + this._interval();
    }
    this._finishDrain();
  }

  /** Advance virtual time, handling every arrival/departure in the interval. */
  advance(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
    if (this.drained) return this.snapshot();
    const target = this.time + dt;
    if (!Number.isFinite(target)) throw new RangeError('time must remain finite');
    let next = this._eventTime();
    while (!this.drained && Number.isFinite(next) && next <= target + this._tolerance(target)) {
      this._processEvent(next);
      next = this._eventTime();
    }
    if (!this.drained) this._integrate(target);
    return this.snapshot();
  }

  /** Step to the next distinct event time, including coincident events. */
  nextEvent() {
    if (!this.drained) {
      const next = this._eventTime();
      if (Number.isFinite(next)) this._processEvent(next);
      else this._finishDrain();
    }
    return this.snapshot();
  }

  /** Close arrivals. Existing packets finish normally; time freezes on drain. */
  stopArrivals() {
    this.accepting = false;
    this._nextArrival = Infinity;
    this._finishDrain();
    return this.snapshot();
  }

  snapshot() {
    const elapsed = this.time;
    const meanW = this.completed ? this.totalWait / this.completed : 0;
    const meanT = this.completed ? this.totalSojourn / this.completed : 0;
    const observedRate = elapsed ? this.arrived / elapsed : 0;
    const next = this._eventTime();
    return {
      time: elapsed,
      arrivalRate: this.arrivalRate,
      serviceTime: this.serviceTime,
      arrivalMode: this.arrivalMode,
      seed: this.seed,
      rho: this.arrivalRate * this.serviceTime,
      accepting: this.accepting,
      drained: this.drained,
      drainTime: this.drainTime,
      arrived: this.arrived,
      completed: this.completed,
      queueLength: this._queue.length,
      systemCount: this._queue.length + (this._serving ? 1 : 0),
      queue: this._queue.map(packet => ({ ...packet })),
      serving: this._serving ? { ...this._serving } : null,
      recentCompleted: this._recentCompleted.map(packet => ({ ...packet })),
      nextEventTime: Number.isFinite(next) ? next : null,
      nextArrivalTime: Number.isFinite(this._nextArrival) ? this._nextArrival : null,
      areaN: this.areaN,
      areaQ: this.areaQ,
      busyTime: this.busyTime,
      avgN: elapsed ? this.areaN / elapsed : 0,
      avgQ: elapsed ? this.areaQ / elapsed : 0,
      utilization: elapsed ? this.busyTime / elapsed : 0,
      totalWait: this.totalWait,
      totalSojourn: this.totalSojourn,
      meanW,
      meanT,
      meanService: this.completed ? this.serviceTime : 0,
      observedRate,
      // Until drain, completed packets and occupancy cover different cohorts.
      // Do not silently present their product as a finite-window identity.
      littleProduct: this.drained ? observedRate * meanT : null,
    };
  }
}
