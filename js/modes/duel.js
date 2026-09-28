/* ==================================================================
   modes/duel.js — дуэль 60 секунд, два игрока перед ОДНОЙ камерой.
   A — слева на экране, B — справа (граница — середина кадра).

   Фазы: LOBBY ──оба подняли руки 🙌──► COUNTDOWN ──► FIGHT (60 с) ──► DONE
   • Жест «руки над головой» подтверждает готовность каждого игрока.
   • Если у игрока обязательный отдых (перегрузка) — дуэль заблокирована.
   • Если игрок перегрузился прямо в бою — его повторы перестают считаться.
   • Эло пересчитывается с учётом разницы рейтингов (elo.js).
   ================================================================== */
'use strict';

class DuelMode {
  constructor(profA, profB, ex) {
    this.kind = 'duel';
    this.ex = ex;
    this.players = [new Player(profA, ex, 'A'), new Player(profB, ex, 'B')];
    this.phase = 'lobby';
    this.ready = [false, false];
    this.timeLeft = CONFIG.DUEL_TIME;
    this.preview = Elo.preview(profA, profB);
    this.fightStart = 0;
  }

  elapsed() { return this.fightStart ? (Date.now() - this.fightStart) / 1000 : null; }
  locked() { return this.players.filter(p => Fatigue.isLocked(p.profile)); }

  begin() {
    this.players.forEach((p, i) => Demo.setExercise(i, this.ex));
    App.renderDemoControls();
    this.renderLobby();
    App.setPrimaryAction('▶️ Старт без жеста', () => this.startCountdown());
    UI.setIdle('Лобби дуэли', 'Оба игрока: подними обе руки над головой, чтобы подтвердить старт.');
    UI.feedback('idle', 'Лобби дуэли', 'Оба игрока: подними обе руки над головой, чтобы подтвердить старт.', { ms: 0 });
    Voice.say('Игроки, поднимите обе руки над головой, чтобы подтвердить старт.', { key: 'lobby' });
    this.renderHUD();
  }

  renderLobby() {
    const lockedNames = this.locked().map(p => p.label);
    const chip = (i) => {
      const p = this.players[i];
      const lock = Fatigue.isLocked(p.profile);
      const state = lock ? `⏸️ отдых ${U.fmt(Fatigue.lockLeft(p.profile))}` : this.ready[i] ? '✅ готов' : '🙌 подними руки';
      return `<span class="ready-chip ${this.ready[i] ? 'on' : ''} ${lock ? 'lock' : ''}">${p.slot}: ${U.esc(p.profile.name)} — ${state}</span>`;
    };
    UI.strip(`<b>${EXERCISES[this.ex].icon} ${EXERCISES[this.ex].name} · 60 секунд · A слева, B справа</b>
      <div class="flex flex-wrap gap-2 justify-center mt-1">${chip(0)}${chip(1)}</div>
      ${lockedNames.length ? `<span class="text-amber-300">Дуэль заблокирована: ${U.esc(lockedNames.join(', '))} на обязательном отдыхе.</span>` : ''}`);
  }

  setReady(i) {
    const p = this.players[i];
    if (Fatigue.isLocked(p.profile)) {
      UI.feedback('warn', `⏸️ ${p.label}`, `Обязательный отдых ещё ${U.fmt(Fatigue.lockLeft(p.profile))} — дуэль заблокирована.`, { banner: true });
      return;
    }
    if (this.ready[i]) return;
    this.ready[i] = true;
    Sound.ready();
    Voice.say(`Игрок ${p.slot} готов`, { key: 'ready' + i });
    UI.log('info', `${p.label} готов`);
    this.renderLobby();
    if (this.ready[0] && this.ready[1]) this.startCountdown();
  }

  startCountdown() {
    if (this.phase !== 'lobby') return;
    const locked = this.locked();
    if (locked.length) {
      UI.feedback('warn', '⏸️ Дуэль заблокирована', `${locked.map(p => p.label).join(', ')}: обязательный отдых.`, { banner: true });
      return;
    }
    this.phase = 'countdown';
    UI.strip(null); UI.gesture(0);
    App.setPrimaryAction(null);
    const session = App.session;
    UI.countdown(() => App.session === session, () => {
      this.phase = 'fight';
      this.fightStart = Date.now();
      this.players.forEach(p => p.analyzer.reset());
      Voice.say('Бой!', { key: 'fight' });
      UI.setIdle('⚔️ Дуэль идёт', 'Считаются только чистые повторы.');
      UI.feedback('idle', '⚔️ Дуэль идёт', 'Считаются только чистые повторы.', { ms: 0 });
      UI.log('info', 'Дуэль началась', 0);
    });
  }

  /** Раздаём позы игрокам: левая половина экрана — A, правая — B */
  assign(poses) {
    const items = poses.map(p => ({ p, b: Geo.bbox(p) })).filter(o => isFinite(o.b.cx));
    items.sort((a, b) => b.b.area - a.b.area);
    const two = items.slice(0, 2).sort((a, b) => a.b.cx - b.b.cx);
    if (two.length === 2) return [two[0].p, two[1].p];
    if (two.length === 1) return two[0].b.cx < 0.5 ? [two[0].p, null] : [null, two[0].p];
    return [null, null];
  }

  onPoses(poses, t) {
    const assigned = this.assign(poses);
    let gestureProgress = 0;

    assigned.forEach((pose, i) => {
      const pl = this.players[i];
      if (this.phase === 'lobby' && pose) {
        const g = pl.gesture.update(pose, t);
        gestureProgress = Math.max(gestureProgress, g.progress);
        if (g.error) App.gestureError(pl, g.error, t);
        if (g.fired) this.setReady(i);
      }
      const r = pl.analyze(pose, t);
      if (r?.rep) {
        if (this.phase === 'fight') App.processRep(pl, r.rep, t, i === 0 ? 25 : 75, this.elapsed());
        else if (this.phase === 'lobby') UI.feedback('warn', `⏳ ${pl.label}`, 'Дуэль ещё не началась — повтор не засчитан.', { ms: 1400 });
      }
    });

    if (this.phase === 'lobby') UI.gesture(gestureProgress, 'Готов');
    UI.metric(this.players[0].result, 'A · ');
    UI.status(this.players.map((p, i) => `${p.slot}: ${assigned[i] ? (p.result?.status || '…') : 'не вижу'}`).join('  |  '));
    this.renderHUD();
  }

  tick() {
    if (this.phase === 'lobby') this.renderLobby();
    if (this.phase !== 'fight') return;
    this.timeLeft--;
    if (this.timeLeft <= 5 && this.timeLeft > 0) Sound.beep();
    if (this.timeLeft === 30) Voice.say('Половина времени', { key: 'half' });
    if (this.timeLeft <= 0) this.finish('time');
    this.renderHUD();
  }

  renderHUD() {
    const [a, b] = this.players;
    const fill = (pfx, p, chance) => {
      U.$(`hd-${pfx}-name`).textContent = p.profile.name;
      U.$(`hd-${pfx}-rank`).textContent = `${UI.rankHTML(p.profile.elo)} · ${p.profile.elo}`;
      U.$(`hd-${pfx}-reps`).textContent = p.stats.reps;
      U.$(`hd-${pfx}-err`).textContent = `ошибок: ${p.stats.errors} · шанс ${Math.round(chance * 100)}%`;
    };
    fill('a', a, this.preview.chanceA);
    fill('b', b, this.preview.chanceB);
    U.$('hd-timer').textContent = U.fmt(this.timeLeft);
    U.$('hd-timer').classList.toggle('is-urgent', this.timeLeft <= 10);
    U.$('hd-ex').textContent = `${EXERCISES[this.ex].icon} ${EXERCISES[this.ex].name}`;
    const max = Math.max(10, a.stats.reps, b.stats.reps);
    U.$('hd-a-bar').style.width = `${a.stats.reps / max * 100}%`;
    U.$('hd-b-bar').style.width = `${b.stats.reps / max * 100}%`;
  }

  finish(reason) {
    if (this.phase === 'done') return;
    const wasFight = this.phase === 'fight';
    this.phase = 'done';
    const [A, B] = this.players;

    // Выход до конца боя — дуэль отменяется без изменения рейтинга
    if (reason === 'quit' || !wasFight) {
      UI.toast('Дуэль отменена — рейтинг не изменился', 'warn');
      App.finishSession(null, false);
      return;
    }

    const scoreA = A.stats.reps > B.stats.reps ? 1 : A.stats.reps === B.stats.reps ? 0.5 : 0;
    const before = { a: A.profile.elo, b: B.profile.elo, ra: Elo.rank(A.profile.elo), rb: Elo.rank(B.profile.elo) };
    const { da, db } = Elo.apply(A.profile, B.profile, scoreA);
    [A, B].forEach(p => { p.profile.records.duelBest = Math.max(p.profile.records.duelBest || 0, p.stats.reps); Store.saveProfile(p.profile); });

    const side = (p, d, eloBefore, rankBefore) => ({
      id: p.profile.id, name: p.profile.name, reps: p.stats.reps, errors: p.stats.errors,
      accuracy: Math.round(p.accuracy * 100), eloBefore, eloAfter: p.profile.elo, delta: d,
      rankBefore: rankBefore.name, rankAfter: Elo.rank(p.profile.elo).name, byCode: p.stats.byCode
    });
    const data = {
      type: 'duel', exercise: this.ex, scoreA,
      a: side(A, da, before.a, before.ra), b: side(B, db, before.b, before.rb),
      chanceA: Math.round(this.preview.chanceA * 100)
    };
    Store.addHistory(data);
    App.finishSession(data, true);
  }

  quit() { this.finish('quit'); }
}
