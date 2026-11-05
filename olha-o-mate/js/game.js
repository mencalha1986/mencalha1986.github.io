/* =========================================================================
   OLHA O MATE! — o vendedor anda pela areia até o quiosque do Posto 6,
   para e serve quem levanta a mão, pula castelos e buracos, e reage aos
   presentes da live: HERÓI ajuda (empurrão, corrida, chuva de clientes),
   VILÃO atrapalha (gaivota rouba o biscoito, o rapa leva o isopor)
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const PXM = CNB.World.PXM, GY = CNB.World.GY;
  const GRITOS = ['Ó O MATE!', 'MATE! LIMÃO!', 'OLHA O MATE GELADINHO!', 'BISCOITO GLOBO!', 'MATE E LIMÃO, FREGUESIA!', 'Ó O GELADINHO!'];

  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.cfg = CNB.CONFIG;
      this.catalog = new CNB.Catalog(this.cfg);
      this.world = new CNB.World(this.cfg);
      this.vendor = new CNB.Vendor(this.cfg);
      this.audio = new CNB.AudioEngine(this.cfg.audio);
      this.fx = new CNB.Effects();
      this.hud = new CNB.HUD(this);
      this.gifts = new CNB.GiftSystem(this.cfg, (k, def, n, user) => this.applyGift(k, def, n, user));
      this.bridge = new CNB.Bridge(this.gifts, this.cfg);
      this.mode = 'loading'; this.time = 0; this.roundNo = 0; this.roundTime = 0; this.shake = 0;
      this.timers = []; this.followQueue = []; this.feathers = [];
      this.voice = { cfg: this.cfg.voice, stop: () => {}, setMuted: () => {} };
      this.setControl(new URLSearchParams(location.search).get('controle') || this.cfg.control);
      this.catalog.ready.then(() => { this.mode = 'title'; });
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    setControl(mode) { this.control = mode === 'manual' ? 'manual' : 'auto'; this.idleManual = 0; if (this.onControl) this.onControl(this.control); }
    // espaço / ↑ / clique: pula
    playerFlap() {
      if (this.mode !== 'playing') return;
      if (this.control !== 'manual') { this.setControl('manual'); this.hud.banner('MODO MANUAL', 'espaço / ↑ / clique para pular', '#38bdf8', 1.4); }
      this.idleManual = 0;
      if (this.vendor.jump()) this.audio.whoosh(true);
    }
    after(sec, fn, tag) { this.timers.push({ t: sec, fn, tag }); }
    say() {}

    // ------------------------------------------------------------ rodada
    start() { if (this.mode !== 'title') return; this.audio.start(); this.startRound(); }
    startRound() {
      this.roundNo++;
      this.world.reset(); this.vendor.reset();
      this.gifts.resetRound(); this.fx.clear(); this.timers = []; this.followQueue = []; this.feathers = [];
      this.mode = 'playing'; this.roundTime = 0; this.sumTime = -1; this.countdown = 0; this.overTime = 0;
      this.money = 0; this.sold = 0; this.lost = 0; this.helpM = 0; this.sabM = 0; this.combo = 0; this.comboT = -9;
      this.gull = null; this.rapa = null; this.overBy = ''; this.newRecord = false; this.arriveT = 0;
      try { this.record = parseFloat(localStorage.getItem('om-record')) || 0; } catch (e) { this.record = 0; }
      this.audio.intensity = 0; this.audio.tempoMul = 1; this.audio.setMusicLevel(this.cfg.audio.music);
      this.hud.banner(`RODADA ${this.roundNo}`, 'leve o mate até o Posto 6 — mandem presentes!', '#ffd23f', 2.4);
      this.shoutT = 1.2;
    }

    // ------------------------------------------------------------ presentes
    cancelCurrentAction() {
      const v = this.vendor;
      v.turbo = 0; v.impulse = 0; v.retreat = 0; v.rush = false;
      if (this.gull && !this.gull.hitDone) this.gull.flee = true;
      this.timers = this.timers.filter((tm) => tm.tag !== 'gift');
      this.fx.clearTag('gift'); this.hud.clearBanners();
    }
    comboMul() { const c = this.cfg.combo; return Math.min(c.max, 1 + Math.max(0, this.combo - 1) * c.step); }
    applyGift(key, def, n, user) {
      const v = this.vendor, head = v.headScreen;
      if (this.mode !== 'playing') { this.audio.gift(0); return; }
      if (def.action === 'follow') { this.followQueue.push(user); return; }
      this.cancelCurrentAction();   // o último presente manda
      this.combo = this.time - this.comboT < this.cfg.combo.window ? this.combo + 1 : 1; this.comboT = this.time;
      const mul = this.comboMul();
      if (this.combo >= 3 && this.combo % 2 === 1) this.audio.chime();
      this.fx.text(U.clamp(head.x, 200, 880), head.y - 120, user, def.color, 30, { life: 1.6, vy: -70, rot: 0, tag: 'gift' });
      switch (def.action) {
        case 'advance':
          v.impulse = Math.round(def.amount * n * mul); this.helpM += v.impulse; this.audio.gift(0);
          this.fx.text(head.x + 60, head.y - 40, `+${v.impulse} m`, '#7CFC9A', 52, { tag: 'gift' });
          break;
        case 'turbo':
          v.turbo = def.duration * n * mul; v.rush = !!def.rush; this.helpM += Math.round(v.turbo * (this.cfg.turboSpeed - this.cfg.walkSpeed));
          this.audio.turbo(); this.fx.doFlash(0.25, '255,220,80'); this.shake = 10;
          if (def.rush) { this.hud.banner('CHUVA DE CLIENTES!', `${user}: todo mundo quer mate — vendas em dobro!`, def.color, 2.2); this.audio.kaching(); for (const cu of this.world.customers) cu.wants = true; }
          else this.hud.banner('CORRE!', `${user} botou o vendedor pra correr`, def.color, 1.8);
          break;
        case 'gull':
          this.gull = { x: W + 140, y: 520, ph: 0, name: user, back: Math.round((def.amount || 30) * mul) };
          this.audio.whoosh(false);
          this.hud.banner('GAIVOTA!', `${user} mandou uma gaivota`, def.color, 1.5);
          break;
        case 'gameover':
          this.rapa = { x: W + 160, name: user, walk: 0, got: false };
          this.audio.whistle ? this.audio.whistle() : this.audio.beep();
          this.hud.banner('SUJOU! O RAPA!', `${user} chamou o rapa`, '#ef4444', 1.8);
          this.mode = 'rapa';
          break;
      }
    }
    // NOVO SEGUIDOR: o vendedor volta um pouquinho (sem cancelar a ação em andamento)
    _follow(user) {
      const v = this.vendor, back = (this.cfg.gifts.seguir && this.cfg.gifts.seguir.back) || 3;
      v.retreat = Math.max(v.retreat, back); this.sabM += back;
      this.audio.chime(); this.fx.confetti(v.x, v.y - 200, 40, 0.6);
      this.hud.banner('NOVO SEGUIDOR!', `${user} fez o vendedor voltar ${back} m`, '#fe2c55', 2.2);
    }

    // ------------------------------------------------------------ venda e tropeço
    _sell(cu, onTheRun) {
      const v = this.vendor, w = this.world, val = this.cfg.price * (v.rush ? 2 : 1);
      cu.served = true; this.money += val; this.sold++;
      this.audio.kaching(); v.cup = 0.5;
      this.fx.text(v.x + 40, v.y - 300, `+R$ ${val}`, '#4ade80', 54, { life: 1.2, vy: -90 });
      for (let i = 0; i < (v.rush ? 6 : 3); i++) w.coins.push({ x: w.x + U.rand(-20, 40), y: v.y - 260, vx: U.rand(-120, 160), vy: U.rand(-650, -380), rot: 0, vr: U.rand(-10, 10), age: 0 });
      if (onTheRun) this.fx.text(v.x, v.y - 360, 'VENDEU NO PIQUE!', '#ffd23f', 34, { life: 1, vy: -60 });
    }
    _trip(o) {
      const v = this.vendor;
      o.hit = true; v.stun = 1.1; v.impulse = 0;
      const loss = Math.min(this.money, this.cfg.price); this.money -= loss; this.lost++;
      this.audio.crash(); this.audio.splash && this.audio.splash(); this.shake = 16;
      this.fx.dust(v.x + 40, GY, 18, 1.4);
      this.fx.text(v.x + 30, v.y - 320, loss ? `−R$ ${loss}` : 'OPA!', '#ff8a8a', 50, { life: 1.3, vy: -70 });
      const nome = { castelo: 'NO CASTELO DE AREIA', buraco: 'NO BURACO', bola: 'NA BOLA', balde: 'NO BALDINHO' }[o.kind];
      this.hud.banner('TROPEÇOU!', `${nome} — derramou um mate`, '#facc15', 1.6);
    }

    // ------------------------------------------------------------ piloto automático (pula sozinho)
    _autopilot() {
      const v = this.vendor, w = this.world;
      if (this.control === 'manual' && v.turbo <= 0) return;
      const next = w.obstacles.find((o) => !o.hit && o.x - w.x > -10);
      if (!next) return;
      if (next.miss === undefined) next.miss = v.turbo > 0 ? false : Math.random() > this.cfg.autopilot.skill;
      const lead = Math.max(1, v.speed) * PXM * 0.5, dx = next.x - w.x;   // no alto bem em cima do obstáculo
      if (!next.miss && dx < lead && dx > 0 && v.jump(v.turbo > 0 ? 1.05 : 1)) this.audio.whoosh(true);
    }

    // ------------------------------------------------------------ chegada / fim
    _arrive() {
      this.mode = 'arrive'; this.arriveT = 0; this.cancelCurrentAction();
      this.audio.fanfare(); this.fx.confetti(540, 700, 90, 0.8);
      this.hud.banner('CHEGOU NO POSTO 6!', `vendeu ${this.sold} mates — R$ ${this.money}`, '#ffd23f', 2.6);
    }
    _summary() {
      this.mode = 'win'; this.finalTime = this.roundTime; this.sumTime = 0;
      if (this.money > this.record) { this.newRecord = true; this.record = this.money; try { localStorage.setItem('om-record', String(this.money)); } catch (e) {} }
      this.audio.cheer(); this.audio.setMusicLevel(this.cfg.audio.music * 1.4, 1);
      const burst = () => { this.fx.confetti(80, 1500, 80, 0.7); this.fx.confetti(1000, 1500, 80, 0.7); this.audio.pop(); };
      burst(); this.after(0.8, burst); this.after(1.8, burst);
      this.after(this.cfg.summaryTime, () => { this.countdown = this.cfg.restartCountdown; });
    }
    gameOver(user) {
      const v = this.vendor;
      this.cancelCurrentAction(); v.dead = true; v.speed = 0; this.overBy = user;
      this.mode = 'gameover'; this.overTime = 0; this.countdown = 0; this._goCount = false;
      this.audio.setMusicLevel(this.cfg.audio.music * 0.3, 1); this.audio.sadTrombone();
    }

    // ------------------------------------------------------------ loop
    loop(now) {
      let dt = Math.min(0.2, (now - this.last) / 1000); this.last = now;
      while (dt > 0.05) { this.update(0.05); dt -= 0.05; }
      this.update(dt); this.render();
      requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      this.time += dt;
      for (const tm of this.timers) tm.t -= dt;
      const due = this.timers.filter((tm) => tm.t <= 0); this.timers = this.timers.filter((tm) => tm.t > 0); due.forEach((tm) => tm.fn());
      const v = this.vendor, w = this.world, cfg = this.cfg;
      this.bridge.update(dt, this.mode === 'playing');
      if (this.mode === 'title') {
        w.x += 1.2 * PXM * dt; v.speed = 1.2; w.spawn();
      } else if (this.mode === 'playing') {
        this.roundTime += dt;
        if (this.followQueue.length && (this.followT = (this.followT || 0) - dt) <= 0) { this._follow(this.followQueue.shift()); this.followT = 1.3; }
        if (this.control === 'manual' && cfg.autopilot.returnAfter) {
          this.idleManual = (this.idleManual || 0) + dt;
          if (this.idleManual > cfg.autopilot.returnAfter) { this.setControl('auto'); this.hud.banner('AUTOMÁTICO', 'espaço / ↑ / clique para pular', '#38bdf8', 1.4); }
        }
        v.turbo = Math.max(0, v.turbo - dt); if (v.turbo <= 0) v.rush = false;
        if (v.sell > 0) { v.sell -= dt; if (v.sell <= 0 && this._selling) { this._sell(this._selling, false); this._selling = null; } }
        // velocidade
        let target = cfg.walkSpeed;
        if (v.impulse > 0) target = cfg.boostSpeed;
        if (v.turbo > 0) target = cfg.turboSpeed;
        if (v.retreat > 0) target = -5;
        if (v.stun > 0 || v.sell > 0) target = 0;
        v.speed = U.damp(v.speed, target, v.retreat > 0 ? 8 : 4, dt);
        const dx = v.speed * PXM * dt;
        w.x = U.clamp(w.x + dx, 0, w.goalX);
        if (v.impulse > 0 && v.speed > 0) v.impulse = Math.max(0, v.impulse - v.speed * dt);
        if (v.retreat > 0 && v.speed < 0) v.retreat = Math.max(0, v.retreat + v.speed * dt);
        if (w.x <= 0) v.retreat = 0;
        // venda: para na frente de quem levantou a mão (correndo, vende no pique)
        if (v.sell <= 0 && v.stun <= 0 && v.retreat <= 0) {
          const cu = w.customers.find((c) => c.wants && !c.served && Math.abs(c.x - w.x) < 26);
          if (cu) {
            if (v.turbo > 0) this._sell(cu, true);
            else { v.sell = cfg.sellTime; this._selling = cu; v.shout = 0.4; this.audio.pop(); }
          }
        }
        // obstáculos
        this._autopilot();
        // altura que precisa passar: castelo é alto; o buraco é no chão (só cai quem pisa dentro)
        const CLEAR = { castelo: 40, bola: 28, balde: 28, buraco: 3 };
        for (const o of w.obstacles) if (!o.hit && v.jumpH < CLEAR[o.kind] && Math.abs(o.x - w.x) < o.w / 2 - 14 && v.speed > 0.2) { this._trip(o); break; }
        // grito de vendedor de tempos em tempos
        this.shoutT -= dt;
        if (this.shoutT <= 0) { this.shoutT = U.rand(4.5, 8); v.shout = 1; this.hud.bubble('vendedor', U.choice(GRITOS), 1.6); }
        if (v.turbo > 0 && Math.random() < dt * 30) w.puffs.push({ x: w.x - 40, y: GY - 10, vx: -120, vy: -40, r: 10, age: 0, life: 0.6, a: 0.6, c: '214,190,140' });
        w.spawn();
        if (w.x >= w.goalX - 1) this._arrive();
        this._updateGull(dt);
        this.audio.intensity = v.turbo > 0 ? 1 : 0; this.audio.tempoMul = U.damp(this.audio.tempoMul, v.turbo > 0 ? 1.22 : 1, 3, dt);
      } else if (this.mode === 'rapa') {
        const r = this.rapa; v.speed = 0;
        if (r) {
          r.walk += dt * 12; r.x -= 520 * dt;
          if (!r.got && r.x < v.x + 120) { r.got = true; this.shake = 24; this.audio.crash(); this.fx.text(v.x + 60, v.y - 340, 'LEVOU O ISOPOR!', '#fca5a5', 54, { life: 1.6, vy: -50 }); this.gameOver(r.name); }
        }
      } else if (this.mode === 'arrive') {
        this.arriveT += dt; v.speed = U.damp(v.speed, 0, 3, dt);
        if (this.arriveT > 3) this._summary();
      } else if (this.mode === 'win') {
        this.sumTime += dt;
        if (this.countdown > 0) {
          const b = Math.ceil(this.countdown); this.countdown -= dt;
          if (Math.ceil(this.countdown) !== b && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) this.startRound();
        }
      } else if (this.mode === 'gameover') {
        this.overTime += dt;
        const r = this.rapa; if (r) { r.walk += dt * 12; r.x += 420 * dt; }   // o rapa sai correndo com o isopor
        if (this.overTime > this.cfg.gameOverTime) {
          if (!this._goCount) { this.countdown = this.cfg.restartCountdown * 0.6; this._goCount = true; }
          const b = Math.ceil(this.countdown); this.countdown -= dt;
          if (Math.ceil(this.countdown) !== b && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) { this._goCount = false; this.startRound(); }
        }
      }
      for (const f of this.feathers) { f.age += dt; f.vx *= Math.pow(0.12, dt); f.vy = f.vy * Math.pow(0.15, dt) + 60 * dt; f.x += (f.vx - 30) * dt + Math.sin(f.age * 4 + f.rot) * 40 * dt; f.y += f.vy * dt + 25 * dt; f.rot += f.vr * dt; }
      this.feathers = this.feathers.filter((f) => f.age < f.life);
      v.update(dt); w.update(dt, this.time);
      this.shake = Math.max(0, this.shake - dt * 45);
      this.fx.update(dt); this.hud.update(dt);
    }
    // gaivota mergulha, rouba o biscoito e o vendedor volta
    _updateGull(dt) {
      const gu = this.gull, v = this.vendor; if (!gu) return;
      gu.ph += dt * 12;
      if (gu.hitDone || gu.flee) { gu.x += (gu.flee ? 900 : 520) * dt; gu.y -= 380 * dt; if (gu.y < -200 || gu.x > W + 300) this.gull = null; return; }
      const tx = v.x + 20, ty = v.y - 240, dx = tx - gu.x, dy = ty - gu.y, d = Math.hypot(dx, dy);
      gu.x += dx / d * 900 * dt; gu.y += dy / d * 900 * dt;
      if (d < 60) {
        gu.hitDone = true; gu.biscoito = true; v.retreat = Math.max(v.retreat, gu.back); this.sabM += gu.back;
        const loss = Math.min(this.money, this.cfg.price); this.money -= loss;
        this.audio.crash(); this.shake = 18;
        this.fx.text(v.x + 60, v.y - 320, 'PÁ!', '#fff', 90, { life: 1.1, vy: -80, rot: -0.1 });
        this.fx.text(v.x, v.y - 400, `−${gu.back} m`, '#ff8a8a', 56, { life: 1.4, vy: -60 });
        for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, s = U.rand(120, 480); this.feathers.push({ x: v.x + 20, y: v.y - 240, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, rot: Math.random() * 6, vr: U.rand(-5, 5), age: 0, life: U.rand(1.8, 3), s: U.rand(0.6, 1.2), c: Math.random() < 0.7 ? '#f8fafc' : '#9ca3af' }); }
        this.hud.banner('ROUBOU O BISCOITO!', `a gaivota de ${gu.name} fez o vendedor voltar ${gu.back} m`, '#e5e7eb', 2);
      }
    }

    render() {
      const ctx = this.ctx, t = this.time, v = this.vendor, w = this.world;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (this.mode === 'loading') { this.hud.draw(ctx, t); return; }
      const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
      ctx.save(); ctx.translate(sx, sy);
      const camX = w.x - v.x;
      w.draw(ctx, t, camX);
      v.draw(ctx, t);
      if (this.rapa) this._drawRapa(ctx, t);
      if (this.gull) this._drawGull(ctx, t);
      for (const c of w.coins) { ctx.save(); ctx.translate(c.x - camX, c.y); ctx.rotate(c.rot); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 14 * Math.abs(Math.cos(c.rot)), 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#a16207'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      for (const f of this.feathers) { ctx.save(); ctx.globalAlpha = U.clamp((f.life - f.age) / 0.6, 0, 1); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(f.s, f.s); ctx.fillStyle = f.c; ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(8, -3, 0, 16); ctx.quadraticCurveTo(-8, -3, 0, -16); ctx.fill(); ctx.restore(); }
      if (v.turbo > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineCap = 'round'; for (let i = 0; i < 12; i++) { const y = v.y - 300 + ((i * 97) % 300), x = W - ((i * 331 + t * 2400) % (W + 300)); ctx.lineWidth = 2 + (i % 3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 120 + (i % 4) * 40, y); ctx.stroke(); } }
      if (v.rush && v.turbo > 0) for (let i = 0; i < 10; i++) { const x = (i * 113 + t * 90) % W, y = 380 + ((i * 271 + t * 420) % 1200); ctx.fillStyle = '#16a34a'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 3 + i)); ctx.fillRect(-26, -12, 52, 24); ctx.fillStyle = '#bbf7d0'; ctx.font = `900 14px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('R$', 0, 5); ctx.restore(); }
      ctx.restore();
      this.fx.draw(ctx);
      this.hud.draw(ctx, t);
    }
    _drawGull(ctx, t) {
      const g = this.gull; ctx.save(); ctx.translate(g.x, g.y); ctx.scale(-1.6, 1.6);
      const f = Math.sin(g.ph) * 14;
      ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 12, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(22, -6, 10, 0, 7); ctx.fill();
      ctx.fillStyle = '#f59e0b'; U.poly(ctx, [30, -6, 44, -2, 30, -1]); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(25, -8, 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#9ca3af'; U.poly(ctx, [-6, -4, 14, -4, -10, -40 - f]); ctx.fill(); U.poly(ctx, [-6, 2, 12, 2, -14, 26 + f * 0.4]); ctx.fill();
      ctx.fillStyle = '#e5e7eb'; U.poly(ctx, [-24, 0, -40, -8, -40, 8]); ctx.fill();
      if (g.biscoito) { ctx.fillStyle = '#f8fafc'; U.roundRect(ctx, 36, -2, 22, 30, 4); ctx.fill(); ctx.fillStyle = '#16a34a'; ctx.fillRect(36, 8, 22, 8); }
      ctx.restore();
      if (!g.hitDone) { ctx.font = `800 24px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = '#e5e7eb'; ctx.strokeText(g.name, g.x, g.y - 60); ctx.fillText(g.name, g.x, g.y - 60); }
    }
    // o rapa: fiscal correndo pela areia para levar o isopor
    _drawRapa(ctx, t) {
      const r = this.rapa, x = r.x, y = GY, leg = Math.sin(r.walk) * 0.6, dir = this.mode === 'gameover' ? 1 : -1;
      ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
      ctx.fillStyle = 'rgba(80,60,30,0.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 60, 12, 0, 0, 7); ctx.fill();
      const limb = (px, py, a, len, w2, col) => { ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = col; U.roundRect(ctx, -w2 / 2, 0, w2, len, w2 / 2); ctx.fill(); ctx.restore(); };
      limb(-8, -120, -leg, 116, 26, '#1f2937'); limb(8, -120, leg, 116, 26, '#374151');
      ctx.fillStyle = '#334155'; U.roundRect(ctx, -32, -246, 66, 130, 16); ctx.fill();
      ctx.fillStyle = '#f97316'; U.roundRect(ctx, -34, -240, 70, 92, 12); ctx.fill();
      ctx.fillStyle = '#facc15'; ctx.fillRect(-34, -200, 70, 10); ctx.fillRect(-34, -170, 70, 10);
      ctx.save(); ctx.scale(dir, 1); ctx.fillStyle = '#111'; ctx.font = `900 17px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('RAPA', 0, -214); ctx.restore();
      ctx.fillStyle = '#a16207'; ctx.beginPath(); ctx.arc(4, -272, 28, 0, 7); ctx.fill();
      ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(4, -284, 28, Math.PI, 0); ctx.fill(); U.roundRect(ctx, 8, -292, 44, 10, 5); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(18, -272, 3.5, 0, 7); ctx.fill();
      limb(10, -230, -1.4 + Math.sin(r.walk) * 0.2, 90, 18, '#a16207');
      if (this.mode === 'gameover') {   // carregando os galões
        ctx.fillStyle = '#d1d5db'; U.roundRect(ctx, 50, -230, 56, 92, 12); ctx.fill(); ctx.fillStyle = '#f59e0b'; ctx.fillRect(50, -196, 56, 26);
      }
      ctx.restore();
      ctx.font = `800 26px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = '#fca5a5';
      ctx.strokeText(r.name, x, y - 330); ctx.fillText(r.name, x, y - 330);
    }
  }

  CNB.Game = Game;
})();
