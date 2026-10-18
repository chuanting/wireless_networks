/* 主页：由 data/course.js 生成「章 → 小节(二级菜单) → 课件」 */
(function () {
  'use strict';
  const COURSE = window.COURSE;
  const list = document.getElementById('chapters');
  const panel = document.getElementById('panel');
  if (!COURSE || !list || !panel) return;

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
      '<span class="txt"><b>' + esc(ch.title) + '</b><i>' + esc(ch.en) + '</i></span>' +
      '<span class="state ' + st.cls + '">' + st.text + '</span></button></li>';
  }).join('');

  /* 二级菜单：小节 */
  function sectionHtml(s) {
    if (s.status === 'ready' && s.deck) {
      const meta = s.slides ? s.slides + ' 页' : '';
      return '<li class="sec ready"><a href="viewer/?deck=' + encodeURIComponent(s.deck) + '">' +
        '<span class="s-no">' + esc(s.no) + '</span>' +
        '<span class="s-body"><b>' + esc(s.title) + '</b>' + (s.desc ? '<i>' + esc(s.desc) + '</i>' : '') + (meta ? '<span class="meta">' + meta + '</span>' : '') + '</span>' +
        '<span class="s-go">进入课件 →</span></a></li>';
    }
    return '<li class="sec todo"><div><span class="s-no">' + esc(s.no) + '</span>' +
      '<span class="s-body"><b>' + esc(s.title) + '</b></span><span class="s-tag">待补充</span></div></li>';
  }

  function renderHint() {
    panel.innerHTML = '<p class="hint">请选择左侧的章节，查看该章的小节。</p>';
  }

  function renderChapter(ch) {
    const body = ch.sections && ch.sections.length
      ? '<ul class="sections">' + ch.sections.map(sectionHtml).join('') + '</ul>'
      : '<p class="hint">本章课件待补充。</p>';
    panel.innerHTML = '<div class="p-in"><div class="p-head"><span class="p-no">第 ' + ch.no + ' 章</span>' +
      '<h3>' + esc(ch.title) + '</h3><p>' + esc(ch.en) + '</p></div>' + body + '</div>';
  }

  let current = null;
  function select(id, opts) {
    opts = opts || {};
    const ch = COURSE.chapters.find((c) => c.id === id);
    if (!ch || (current === id && !opts.keep)) {             // 再点一次：收起
      current = null;
      list.querySelectorAll('.chap').forEach((b) => { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); });
      renderHint();
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
    if (opts.scroll && window.matchMedia('(max-width: 920px)').matches) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  list.addEventListener('click', (e) => {
    const b = e.target.closest('.chap');
    if (b) select(b.dataset.id, { scroll: true });
  });

  renderHint();
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
