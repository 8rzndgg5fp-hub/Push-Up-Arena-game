/* ==================================================================
   ui.js — всё, что меняет DOM: экраны, тема, подсказки (панель +
   крупный баннер поверх видео), оверлеи сцены, журнал, шкалы нагрузки.
   Логика игры сюда не входит — только отображение.
   ================================================================== */
'use strict';

const UI = {
  /* ---------- Экраны и навигация ---------- */
  showScreen(id) {
    const target = U.$(id);
    const current = [...document.querySelectorAll('.screen')].find(s => !s.classList.contains('hidden') && s !== target);
    const reveal = () => {
      target.classList.remove('hidden');
      requestAnimationFrame(() => requestAnimationFrame(() => target.classList.remove('is-hidden')));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    document.querySelectorAll('[data-nav]').forEach(b => b.setAttribute('aria-current', b.dataset.nav === id ? 'page' : 'false'));
    if (current) { current.classList.add('is-hidden'); setTimeout(() => { current.classList.add('hidden'); reveal(); }, 300); }
    else reveal();
  },

  applyTheme(theme) {
    const dark = theme !== 'light';
    document.documentElement.classList.toggle('dark', dark);
    U.$('theme-icon').textContent = dark ? '🌙' : '☀️';
    U.$('theme-label').textContent = dark ? 'Тёмная' : 'Светлая';
  },

  toast(text, tone = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${tone}`;
    t.textContent = text;
    U.$('toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  },

  rankHTML(elo) { const r = Elo.rank(elo); return `${r.icon} ${r.name}`; },

  /* ---------- Подсказки ---------- */
  _fbTimer: null, _bnTimer: null,

  /**
   * Подсказка в панели справа; banner=true — ещё и крупно поверх видео.
   * type: good | error | warn | info | idle. ms=0 — не скрывать.
   */
  feedback(type, title, text = '', { ms = 1800, banner = false } = {}) {
    const f = U.$('feedback');
    f.dataset.state = type;
    U.$('feedback-title').textContent = title;
    U.$('feedback-text').textContent = text;
    U.restart(f, 'bump');
    clearTimeout(this._fbTimer);
    if (ms > 0) this._fbTimer = setTimeout(() => { f.dataset.state = 'idle'; U.$('feedback-title').textContent = this.idleTitle; U.$('feedback-text').textContent = this.idleText; }, ms);
    if (banner) this.banner(type, title, text, ms || 2600);
  },
  idleTitle: 'Готовься', idleText: '',
  setIdle(title, text) {
    this.idleTitle = title; this.idleText = text;
    const f = U.$('feedback');
    if (f.dataset.state === 'idle') { U.$('feedback-title').textContent = title; U.$('feedback-text').textContent = text; }
  },

  banner(type, title, text, ms = 2400) {
    const b = U.$('stage-banner');
    b.dataset.state = type;
    U.$('banner-title').textContent = title;
    U.$('banner-text').textContent = text;
    b.classList.remove('hide');
    U.restart(b, 'bump');
    clearTimeout(this._bnTimer);
    this._bnTimer = setTimeout(() => b.classList.add('hide'), ms);
  },

  /* ---------- Эффекты сцены ---------- */
  float(text, kind, xPct = 50) {
    const el = document.createElement('div');
    el.className = `float-dmg ${kind}`;
    el.style.left = `${U.clamp(xPct + (Math.random() * 16 - 8), 8, 92)}%`;
    el.style.top = `${38 + Math.random() * 14}%`;
    el.textContent = text;
    U.$('fx-layer').appendChild(el);
    setTimeout(() => el.remove(), 1250);
  },
  frame(kind) {
    const f = U.$('frame');
    f.classList.remove('good', 'bad'); void f.offsetWidth; f.classList.add(kind);
    setTimeout(() => f.classList.remove(kind), kind === 'good' ? 600 : 1000);
  },
  aura() { const a = U.$('aura'); a.classList.add('on'); setTimeout(() => a.classList.remove('on'), 1100); },

  /* ---------- Датчик и статус ---------- */
  metric(res, prefix = '') {
    if (!res || res.metric.d == null) { U.$('metric-value').textContent = '—'; return; }
    U.$('metric-label').textContent = prefix + res.metric.label;
    U.$('metric-value').textContent = res.metric.value;
    U.$('gauge-marker').style.left = `${U.clamp(res.metric.d, 0, 1.2) / 1.2 * 100}%`;
  },
  status(text) { U.$('status-chip').textContent = text; },

  /** Кольцо удержания жеста (поверх сцены, маленькое, в углу) */
  gesture(progress, label = '') {
    const g = U.$('gesture-ring');
    g.classList.toggle('hidden', progress <= 0);
    U.$('gesture-arc').style.strokeDashoffset = 150.8 * (1 - progress);
    U.$('gesture-label').textContent = label;
  },

  /** Полоса-инструкция внизу сцены (не закрывает игрока) */
  strip(html) {
    const s = U.$('stage-strip');
    if (!html) { s.classList.add('hidden'); return; }
    s.innerHTML = html; s.classList.remove('hidden');
  },

  show(id, on) { U.$(id).classList.toggle('hidden', !on); },

  /** Отсчёт 3-2-1; прерывается, если сессия сменилась */
  countdown(isAlive, done) {
    const ov = U.$('countdown-overlay'), txt = U.$('countdown-text');
    const steps = ['3', '2', '1', 'СТАРТ!'];
    let i = 0;
    ov.classList.remove('hidden');
    const tick = () => {
      if (!isAlive()) { ov.classList.add('hidden'); return; }
      if (i >= steps.length) { ov.classList.add('hidden'); done(); return; }
      txt.textContent = steps[i]; U.restart(txt, 'count-anim');
      Sound.beep(i === steps.length - 1);
      i++; setTimeout(tick, 850);
    };
    tick();
  },
  bigWord(word, ms = 1400) {
    const ov = U.$('countdown-overlay'), txt = U.$('countdown-text');
    ov.classList.remove('hidden'); txt.textContent = word; U.restart(txt, 'count-anim');
    setTimeout(() => ov.classList.add('hidden'), ms);
  },

  /* ---------- Журнал ---------- */
  log(type, text, elapsedSec = null) {
    const list = U.$('event-log');
    const li = document.createElement('li');
    li.className = type;
    li.innerHTML = `<span class="t">${elapsedSec == null ? '—' : U.fmt(elapsedSec)}</span><span>${U.esc(text)}</span>`;
    list.prepend(li);
    while (list.children.length > 40) list.lastChild.remove();
  },
  clearLog() { U.$('event-log').innerHTML = ''; },

  /* ---------- Нагрузка ---------- */
  renderLoad(players) {
    U.$('load-list').innerHTML = players.map(p => {
      const load = Math.round(Fatigue.load(p.profile));
      const locked = Fatigue.isLocked(p.profile);
      const tone = locked ? 'lock' : load >= 80 ? 'hot' : load >= 50 ? 'warm' : 'ok';
      return `<div class="load-row">
        <div class="flex justify-between text-xs font-semibold mb-1"><span>${U.esc(p.slot === 'solo' ? 'Нагрузка' : p.label)}</span>
        <span>${locked ? '⏸️ ' + U.fmt(Fatigue.lockLeft(p.profile)) : load + '%'}</span></div>
        <div class="load-track"><div class="load-fill ${tone}" style="width:${load}%"></div></div></div>`;
    }).join('');
  },

  /** Ошибки по типам за текущую сессию */
  renderErrors(players) {
    const rows = [];
    players.forEach(p => Object.entries(p.stats.byCode).forEach(([k, n]) => {
      const [ex, code] = k.split(':');
      rows.push({ who: players.length > 1 ? p.slot + ': ' : '', title: ERRORS[ex][code].title, n });
    }));
    rows.sort((a, b) => b.n - a.n);
    U.$('err-list').innerHTML = rows.length
      ? rows.map(r => `<li><span>${U.esc(r.who + r.title)}</span><b>${r.n}</b></li>`).join('')
      : '<li class="empty">Ошибок пока нет 👌</li>';
  },

  /* ---------- Панель камеры ---------- */
  camLoading(title, text) {
    const p = U.$('cam-panel');
    p.classList.remove('hidden');
    p.innerHTML = `<div class="text-center"><div class="spinner"></div>
      <div class="font-display text-xl">${U.esc(title)}</div>
      <div class="text-sm text-slate-300 mt-2 max-w-sm mx-auto">${U.esc(text)}</div></div>`;
  },
  camError(info, onDemo, onRetry) {
    const p = U.$('cam-panel');
    p.classList.remove('hidden');
    p.innerHTML = `<div class="cam-card">
      <div class="text-4xl mb-2">${info.icon}</div><h3>${info.title}</h3>
      <p class="text-sm text-slate-300 mt-1">${info.text}</p>
      <ol class="cam-steps">${info.steps.map(s => `<li>${s}</li>`).join('')}</ol>
      <div class="cam-actions">
        <button id="btn-cam-demo" class="btn-primary">🎮 Запустить симуляцию / Демо-режим</button>
        <button id="btn-cam-retry" class="btn-secondary">🔄 Попробовать снова</button>
      </div>
      <div class="cam-error-code">Код ошибки: ${U.esc(info.code)}</div></div>`;
    U.$('btn-cam-demo').onclick = onDemo;
    U.$('btn-cam-retry').onclick = onRetry;
  },
  camHide() { const p = U.$('cam-panel'); p.classList.add('hidden'); p.innerHTML = ''; }
};
