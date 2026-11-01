import { MG1Comparison } from './mg1-model.js';

const PRESETS = {
  baseline: { arrivalRate: 4, meanService: 0.2, longProbability: 0.1 },
  light: { arrivalRate: 2, meanService: 0.2, longProbability: 0.1 },
  heavy: { arrivalRate: 4.5, meanService: 0.2, longProbability: 0.1 },
  variable: { arrivalRate: 4, meanService: 0.2, longProbability: 0.05 },
};
const format = (n, k = 2) => Number.isFinite(n) ? n.toFixed(k) : '—';
const LIMIT = 20000;

export function mountMG1Demo(host) {
  if (!document.querySelector('#mg1-demo-css')) {
    const link = document.createElement('link'); link.id = 'mg1-demo-css'; link.rel = 'stylesheet';
    link.href = new URL('../css/mg1-demo.css', import.meta.url).href; document.head.appendChild(link);
  }
  const abort = new AbortController();
  let config = {...PRESETS.baseline, seed:2026}, model = new MG1Comparison(config);
  let running = false, disposed = false, timer = 0;
  host.classList.add('mg1-demo');
  host.innerHTML = `
    <div class="mg-presets"><b>保持均值，比较波动</b>
      <button type="button" data-preset="baseline" aria-pressed="true">基准 ρ = 0.8</button>
      <button type="button" data-preset="light" aria-pressed="false">轻载 ρ = 0.4</button>
      <button type="button" data-preset="heavy" aria-pressed="false">重载 ρ = 0.9</button>
      <button type="button" data-preset="variable" aria-pressed="false">长服务更少、更长</button>
    </div>
    <div class="mg-controls">
      <label>同一到达率 λ <b data-out="rate"></b><input data-field="arrivalRate" type="range" min="1" max="6" step="0.5" value="4" aria-label="三条队列共同到达率，每秒分组数"></label>
      <label>三组平均服务时间 <b data-out="mean"></b><input data-field="meanService" type="range" min="100" max="400" step="25" value="200" aria-label="三组平均服务时间，毫秒"></label>
      <label>混合组长服务概率 <b data-out="probability"></b><input data-field="longProbability" type="range" min="5" max="30" step="5" value="10" aria-label="混合组长服务概率，百分比"></label>
    </div>
    <div class="mg-toolbar">
      <button type="button" data-action="start" class="mg-primary">开始</button>
      <button type="button" data-action="step">下一事件</button>
      <button type="button" data-action="fast">快进 60 s</button>
      <button type="button" data-action="batch">长跑 5000 s</button>
      <button type="button" data-action="drain">停止到达并排空</button>
      <button type="button" data-action="reset">重置</button>
      <span data-out="clock" class="mg-clock"></span>
    </div>
    <p class="mg-status" data-out="status"></p>
    <div class="mg-lanes">
      ${['fixed','exponential','mixed'].map((key,i)=>`<div class="mg-lane mg-lane-${i}" data-lane="${key}">
        <h3>${['固定服务','指数服务','短长混合'][i]}</h3>
        <p class="mg-distribution" data-lane-out="distribution"></p>
        <p class="mg-moment" data-lane-out="moment"></p>
        <div class="mg-queue-label"><b>等待区</b><span data-lane-out="queue-count"></span></div>
        <div class="mg-packets" data-lane-out="packets"></div>
        <div class="mg-server-row"><div class="mg-server" data-lane-out="server"></div><div><p data-lane-out="service"></p><div class="mg-progress"><i data-lane-out="progress"></i></div></div></div>
        <div class="mg-metrics"><div><span>P-K 理论等待 W</span><b data-lane-out="theory-w"></b></div><div><span>本轮实测等待 W</span><b data-lane-out="sample-w"></b></div></div>
        <p class="mg-completed" data-lane-out="completed"></p>
      </div>`).join('')}
    </div>
    <div class="mg-conclusion"><b>W = λ × 二阶矩 ÷ [2 × (1 − ρ)]</b><span data-out="conclusion"></span></div>
    <p class="mg-footnote" data-out="footnote">三条队列共用同一批到达；均值相同指分布的理论均值。本轮从空系统开始，未做预热，实测为已离开分组的平均，有限样本会波动。</p>`;
  const outs = Object.fromEntries([...host.querySelectorAll('[data-out]')].map(el=>[el.dataset.out,el]));
  const fields = Object.fromEntries([...host.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el]));
  const actions = Object.fromEntries([...host.querySelectorAll('[data-action]')].map(el=>[el.dataset.action,el]));
  const lanes = [...host.querySelectorAll('[data-lane]')].map(el=>({el, out:Object.fromEntries([...el.querySelectorAll('[data-lane-out]')].map(n=>[n.dataset.laneOut,n]))}));
  function put(el, text) { text = String(text); if (el.textContent !== text) el.textContent = text; }
  function paint() {
    if (disposed) return;
    const s=model.snapshot(), rho=s.theory[0].rho;
    host.dataset.running=String(running); host.dataset.simulationTime=String(s.time); host.dataset.drained=String(s.drained);
    put(outs.rate,format(config.arrivalRate,1)+' 个/s'); put(outs.mean,format(config.meanService*1000,0)+' ms'); put(outs.probability,format(config.longProbability*100,0)+'%');
    put(outs.clock,(s.drained?'已排空':running?'播放 0.5×':'已暂停')+' · '+format(s.time,1)+' s');
    put(outs.status,'共同负荷 ρ = '+format(rho)+'　；　同一条泊松到达流，已向每组送入 '+s.arrived+' 个分组。');
    for (let i=0;i<3;i++) {
      const lane=s.lanes[i], theory=s.theory[i], view=lanes[i].out;
      put(view.distribution,i===0?'每次服务 '+format(config.meanService*1000,0)+' ms':i===1?'指数分布，平均 '+format(config.meanService*1000,0)+' ms':format((1-config.longProbability)*100,0)+'% 为 '+format(theory.short*1000,0)+' ms；'+format(config.longProbability*100,0)+'% 为 '+format(theory.long*1000,0)+' ms');
      put(view.moment,'二阶矩 '+format(theory.second,4)+' s·s');
      put(view['queue-count'],lane.queueLength+' 个');
      view.packets.replaceChildren();
      if (!lane.queueLength) put(view.packets,'暂无等待');
      else {
        if (lane.queueLength>6) { const more=document.createElement('span'); more.className='mg-more'; more.textContent='+'+(lane.queueLength-6); view.packets.append(more); }
        for (const p of [...lane.queue].reverse()) { const b=document.createElement('span'); b.className='mg-packet'; b.textContent=p.id; b.title='分组 #'+p.id; view.packets.append(b); }
      }
      const p=lane.serving;
      put(view.server,p?'#'+p.id:'空闲'); view.server.classList.toggle('busy',!!p); view.server.classList.toggle('long',!!p?.long);
      put(view.service,p?'本次 '+format(p.service)+' s；剩余 '+format(Math.max(0,p.end-s.time))+' s':'服务员等待到达');
      view.progress.style.width=(p?Math.min(100,(s.time-p.start)/p.service*100):0)+'%';
      put(view['theory-w'],theory.stable?format(theory.W)+' s':'无稳态');
      put(view['sample-w'],lane.completed?format(lane.meanW)+' s':'—');
      put(view.completed,'已完成 '+lane.completed+' 个 · 实测平均服务 '+(lane.completed?format(lane.meanService,3)+' s':'—'));
    }
    put(outs.conclusion,rho>=1?'ρ ≥ 1，P-K 稳态均值不适用。先降低到达率或缩短平均服务时间。':'均值与负荷相同，二阶矩越大，稳态平均等待越长。先预测，再用长跑比较。');
    put(outs.footnote,s.drained?'三组已处理完同一批分组。实测与理论仍可能有差异：样本有限，且从空系统开始、未做预热。参数变化会重新开始。':'三条队列共用同一批到达；均值相同指分布的理论均值。本轮从空系统开始、未做预热，实测对已离开分组平均，有限样本会波动。');
    const limited=s.accepting&&s.time>=LIMIT;
    actions.start.textContent=running?'暂停':'开始';
    for(const key of ['start','step','fast','batch']) actions[key].disabled=s.drained||limited;
    actions.drain.disabled=s.drained;
  }
  function pause() { running=false;clearInterval(timer);timer=0;paint(); }
  function start() {
    if(disposed||running||model.drained||model.time>=LIMIT)return;
    running=true;
    timer=setInterval(()=>{ if(disposed)return;model.advance(Math.min(.04,LIMIT-model.time));if(model.time>=LIMIT||model.drained)pause();else paint(); },80);
    paint();
  }
  function reset(preset) {
    pause();
    config={...(preset?PRESETS[preset]:{arrivalRate:+fields.arrivalRate.value,meanService:+fields.meanService.value/1000,longProbability:+fields.longProbability.value/100}),seed:2026};
    fields.arrivalRate.value=config.arrivalRate; fields.meanService.value=config.meanService*1000; fields.longProbability.value=config.longProbability*100;
    model=new MG1Comparison(config);
    host.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===preset)));
    paint();
  }
  host.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b||!host.contains(b))return;
    if(b.dataset.preset)reset(b.dataset.preset);
    switch(b.dataset.action) {
      case 'start': running?pause():start();break;
      case 'step': pause(); { const next=model.snapshot().nextEventTime;if(next>LIMIT)model.advance(LIMIT-model.time);else model.nextEvent(); } paint();break;
      case 'fast':pause();model.advance(Math.min(60,LIMIT-model.time));paint();break;
      case 'batch':pause();model.advance(Math.min(5000,LIMIT-model.time));paint();break;
      case 'drain':pause();model.drain();paint();break;
      case 'reset':reset();break;
    }
  },{signal:abort.signal});
  Object.values(fields).forEach(el=>el.addEventListener('input',()=>reset(),{signal:abort.signal}));
  paint();host.dataset.demoReady='true';
  return {pause,destroy(){running=false;disposed=true;clearInterval(timer);abort.abort();host.dataset.running='false';}};
}
