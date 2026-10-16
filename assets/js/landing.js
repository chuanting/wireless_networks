/* 主页：由 data/course.js 生成「章 → 小节(二级菜单) → 课件」 */
(function () {
  'use strict';
  const COURSE = window.COURSE;
  const list = document.getElementById('chapters');
  const panel = document.getElementById('panel');
  if (!COURSE || !list || !panel) return;

  const ICONS = {
    graph: '<circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="8" r="2.2"/><circle cx="10" cy="19" r="2.2"/><path d="M7.1 6.4l9.8 1.3M6.2 8l3 9M17.9 9.9l-6.6 7.9"/>',
    transport: '<circle cx="4.5" cy="12" r="1.8"/><circle cx="19.5" cy="12" r="1.8"/><path d="M7 12h10M14 9l3 3-3 3"/><rect x="9" y="5" width="3.2" height="3.2" rx=".6"/>',
    delay: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    mac: '<circle cx="12" cy="15" r="1.8"/><path d="M9.4 12.4a3.7 3.7 0 0 1 5.2 0M6.7 9.7a7.5 7.5 0 0 1 10.6 0M4 7a11.3 11.3 0 0 1 16 0"/>',
    route: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M5 17v-5h7V5h5"/>',
    traffic: '<path d="M3 17l5-6 4 3 5-8 4 4"/><path d="M3 21h18"/>',
    sixg: '<g transform="rotate(-45 12 12)"><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="2.5" y="10" width="5" height="4" rx=".8"/><rect x="16.5" y="10" width="5" height="4" rx=".8"/><path d="M7.5 12h2M14.5 12h2"/></g><path d="M17.5 20a5 5 0 0 0 2.6-2.6M15 22a8 8 0 0 0 6.8-6.8"/>'
  };
  const svg = (name) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.graph) + '</svg>';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  function stateOf(ch) {
    const ready = ch.sections.filter((s) => s.status === 'ready').length;
    return ready ? { cls: 'ready', text: ready + ' / ' + ch.sections.length + ' 已发布' } : { cls: '', text: '待补充' };
  }

  /* 一级菜单：章 */
  list.innerHTML = COURSE.chapters.map((ch) => {
    const st = stateOf(ch);
    return '<li><button type="button" class="chap" data-id="' + ch.id + '" aria-expanded="false" aria-controls="panel">' +
      '<span class="no">' + pad(ch.no) + '</span>' +
      '<span class="ico">' + svg(ch.icon) + '</span>' +
      '<span class="txt"><b>' + esc(ch.title) + '</b><i>' + esc(ch.en) + '</i></span>' +
      '<span class="state ' + st.cls + '">' + st.text + '</span></button></li>';
  }).join('');

  /* 二级菜单：小节 */
  function sectionHtml(s) {
    if (s.status === 'ready' && s.deck) {
      const meta = [s.slides ? s.slides + ' 页' : '', s.minutes ? '约 ' + s.minutes + ' 分钟' : ''].filter(Boolean).join(' · ');
      return '<li class="sec ready"><a href="viewer/?deck=' + encodeURIComponent(s.deck) + '">' +
        '<span class="s-no">' + esc(s.no) + '</span>' +
        '<span class="s-body"><b>' + esc(s.title) + '</b>' + (s.desc ? '<i>' + esc(s.desc) + '</i>' : '') + (meta ? '<span class="meta">' + meta + '</span>' : '') + '</span>' +
        '<span class="s-go">进入课件 →</span></a></li>';
    }
    return '<li class="sec todo"><div><span class="s-no">' + esc(s.no) + '</span>' +
      '<span class="s-body"><b>' + esc(s.title) + '</b></span><span class="s-tag">待补充</span></div></li>';
  }

  function renderEmpty() {
    panel.innerHTML = '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS.graph + '</svg>' +
      '<p><b>点击一个章节</b><br>这里会展开该章的小节</p></div>';
  }

  function renderChapter(ch) {
    let body;
    if (ch.sections && ch.sections.length) {
      body = '<ul class="sections">' + ch.sections.map(sectionHtml).join('') + '</ul>';
    } else {
      body = '<div class="empty" style="min-height:220px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[ch.icon] || '') + '</svg>' +
        '<p><b>本章课件待补充</b><br>上线后会出现在这里</p></div>';
    }
    panel.innerHTML = '<div class="p-in"><div class="p-head"><span class="p-no">CHAPTER ' + pad(ch.no) + '</span>' +
      '<h3>' + esc(ch.title) + '</h3><p>' + esc(ch.en) + '</p></div>' + body + '</div>';
  }

  let current = null;
  function select(id, opts) {
    opts = opts || {};
    const ch = COURSE.chapters.find((c) => c.id === id);
    if (!ch || (current === id && !opts.keep)) {             // 再点一次：收起
      current = null;
      list.querySelectorAll('.chap').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); });
      renderEmpty();
      if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#curriculum');
      return;
    }
    current = id;
    list.querySelectorAll('.chap').forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle('on', on); b.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    renderChapter(ch);
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + id);
    if (opts.scroll && window.matchMedia('(max-width: 960px)').matches) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('.chap');
    if (b) select(b.dataset.id, { scroll: true });
  });

  renderEmpty();
  /* 从课件页「返回目录」时带着 #ch1 回来：直接展开对应章 */
  const h = (location.hash || '').slice(1);
  if (/^ch\d+$/.test(h) && COURSE.chapters.some((c) => c.id === h)) {
    select(h, { keep: true });
    const cur = document.getElementById('curriculum');
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'start' }), 60);
  }

  const repo = document.getElementById('nav-repo');
  if (repo && COURSE.repo) repo.href = COURSE.repo;
})();
