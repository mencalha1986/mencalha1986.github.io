/* =========================================================================
   CARRINHO MALUCO — loop, câmera, coleta de achados, furadas, presentes,
   locutor da loja, caixa e nota fiscal
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const S = CNB.Shopper.S;
  const CAM_WALK = { dist: 5.5, y: 2.95, F: 1450, hz: 620 };
  const CAM_RUN = { dist: 6.3, y: 2.75, F: 1350, hz: 650 };
  const CAM_PAY = { dist: 5.2, y: 2.5, F: 1300, hz: 700 };

  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.cfg = CNB.CONFIG;
      this.catalog = new CNB.Catalog(this.cfg);
      this.shopper = new CNB.Shopper(this.cfg);
      this.audio = new CNB.AudioEngine(this.cfg.audio);
      this.fx = new CNB.Effects();
      this.hud = new CNB.HUD(this);
      this.gifts = new CNB.GiftSystem(this.cfg, (k, def, n, user) => this.applyGift(k, def, n, user));
      this.bridge = new CNB.Bridge(this.gifts, this.cfg);
      this.cam = { x: 0, y: CAM_WALK.y, z: -CAM_WALK.dist, F: CAM_WALK.F, horizon: CAM_WALK.hz, sx: 0, sy: 0 };
      this.mode = 'loading'; this.time = 0; this.roundNo = 0; this.roundTime = 0; this.shake = 0;
      this.seed = Math.floor(Math.random() * 1000);
      this.timers = []; this.announce = null; this.annT = 6;
      // locutor (áudios gerados)
      this.annAudio = {};
      for (const k in CNB.ANUNCIOS || {}) { const a = new Audio(CNB.ANUNCIOS[k].src); a.preload = 'auto'; this.annAudio[k] = a; }
      let saved = null; try { saved = localStorage.getItem('cm-controle'); } catch (e) {}
      this.setControl(new URLSearchParams(location.search).get('controle') || saved || this.cfg.control);
      this._bind();
      this.catalog.ready.then(() => {
        this.store = new CNB.Store(this.cfg, this.catalog);
        this.store.reset(this.seed);
        this.mode = 'title';
      });
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    setControl(mode) {
      this.control = mode === 'manual' ? 'manual' : 'auto';
      this.shopper.manual = this.control === 'manual';
      try { localStorage.setItem('cm-controle', this.control); } catch (e) {}
    }

    _bind() {
      const d = this.shopper;
      d.onStep = (run) => this.audio.rattle(run);
      d.onEvent = (ev, arg) => {
        if (ev === 'runEnd') this.hud.banner('ACABOU O GÁS', null, '#9ae6ff', 1.2);
        if (ev === 'state' && arg === S.PAY) this._startPay();
      };
    }

    after(sec, fn, tag) { this.timers.push({ t: sec, fn, tag }); }

    // ------------------------------------------------------------ locutor
    speak(key, force = false) {
      const a = (CNB.ANUNCIOS || {})[key];
      if (!a || !this.cfg.announcer.enabled) return;
      if (!force && this.announce && this.announce.age < this.announce.dur) return;
      Object.values(this.annAudio).forEach((x) => { x.pause(); });
      this.audio.chime();
      this.audio.duck(0.3, a.dur + 1);
      this.announce = { text: a.text, dur: a.dur + 1.2, age: 0 };
      const el = this.annAudio[key];
      if (el && !this.audio.muted) setTimeout(() => { el.currentTime = 0; el.play().catch(() => {}); }, 650);
    }

    // ------------------------------------------------------------ rodada
    start() { if (this.mode !== 'title') return; this.audio.start(); this.startRound(); }

    startRound() {
      this.seed++; this.roundNo++;
      this.store.reset(this.seed); this.store.cheer = 0; this.store.glow = 1;
      const man = this.shopper.manual; this.shopper.reset(); this.shopper.manual = man; this._bind();
      this.gifts.resetRound(); this.fx.clear(); this.timers = [];
      this.mode = 'playing'; this.roundTime = 0; this.crashes = 0; this.lost = 0;
      this.payTime = -1; this.paid = false; this.scanned = 0; this.scanAt = []; this.countdown = 0; this.overTime = 0;
      this.cam.z = -CAM_WALK.dist; this.cam.x = 0;
      this.lastSection = null; this.annT = U.rand(14, 22);
      this.audio.intensity = 0; this.audio.tempoMul = 1; this.audio.setMusicLevel(this.cfg.audio.music);
      this.hud.banner(`RODADA ${this.roundNo}`, 'Mande presentes pra encher o carrinho!', '#ff8fab', 2.4);
      this.after(1.0, () => this.speak('inicio', true));
    }

    // ------------------------------------------------------------ presentes
    cancelCurrentAction() {
      this.shopper.cancelAction();
      this.timers = this.timers.filter((tm) => tm.tag !== 'gift');
      this.fx.clearTag('gift');
      this.hud.clearBanners();
    }

    applyGift(key, def, n, user) {
      const d = this.shopper, head = d.headScreen;
      if (this.mode !== 'playing' || d.finished) { this.audio.gift(0); return; }
      this.cancelCurrentAction();   // o último presente manda
      this.fx.text(U.clamp(head.x, 200, 880), head.y - 120, user, def.color, 30, { life: 1.6, vy: -70, rot: 0, tag: 'gift' });
      switch (def.action) {
        case 'advance':
          d.impulse = def.amount * n;
          this.audio.gift(def.amount >= 10 ? 1 : 0);
          this.fx.text(head.x, head.y - 40, `+${def.amount * n} m`, '#7CFC9A', 52, { tag: 'gift' });
          if (def.amount >= 10) this.hud.banner(`+${def.amount * n} m`, `${user} empurrou o carrinho`, def.color, 1.5);
          break;
        case 'turbo':
          d.turbo = def.duration * n;
          this.audio.turbo(); this.fx.doFlash(0.3, '255,220,80'); this.shake = 12;
          this.hud.banner('TURBO!', `${user} ligou o carrinho a jato`, def.color, 1.9);
          this.after(0.6, () => this.speak('turbo'), 'gift');
          break;
        case 'magnet':
          d.magnet = def.duration * n; d.impulse = def.amount;
          this.audio.magnet();
          this.hud.banner('ÍMÃ DE OFERTAS!', `${user}: os achados vêm sozinhos`, def.color, 1.9);
          this.after(0.5, () => this.speak('ima'), 'gift');
          break;
        case 'back':
          d.retreat = def.amount * n;
          this.audio.back();
          this.hud.banner('ESQUECI A LISTA!', `${user} mandou voltar ${def.amount * n} m`, def.color, 1.9);
          this.after(0.5, () => this.speak('esqueci'), 'gift');
          break;
        case 'slip':
          this._slip(Math.random() < 0.5 ? -1 : 1, `${user} molhou o chão`);
          this.after(0.6, () => this.speak('molhado'), 'gift');
          break;
        case 'sale': {
          const list = this.store.spawnSale(d.z, def.count * n);
          this.audio.kaching(); this.fx.doFlash(0.25, '255,120,150');
          this.hud.banner('LIQUIDAÇÃO!', `${user} jogou ${list.length} achados no corredor`, def.color, 2);
          this.after(0.4, () => this.speak('liquidacao', true), 'gift');
          break;
        }
        case 'gameover': this.gameOver(user); break;
      }
    }

    _slip(dir, sub) {
      const d = this.shopper;
      d.spinDir = dir; d.force(S.SLIP);
      this.audio.slip(); this.after(0.5, () => this.audio.crash());
      const lost = d.drop(2);
      this._lostFx(lost);
      this.hud.banner('DERRAPOU!', sub || (lost.length ? `perdeu ${lost.length} achado${lost.length > 1 ? 's' : ''}` : null), '#facc15', 1.8);
      this.shake = 14;
    }

    _lostFx(list) {
      this.lost += list.length;
      list.forEach((it, i) => this.fx.text(U.clamp(this.shopper.cartScreen.x + (i ? 150 : -60), 220, 860), this.shopper.cartScreen.y - 40 - i * 52, '− ' + U.truncate(it.short, 16), '#ff6b6b', 30, { life: 1.6, vy: -110, rot: 0 }));
    }

    // ------------------------------------------------------------ coleta + furadas
    // o cliente pega o achado e joga por cima do ombro: ele voa até a cesta
    _grab(it) {
      if (it.taken || it.flying) return;
      it.flying = { t: 0, x0: it.x, z0: it.z };
      this.audio.whoosh(true);
    }
    _updateFlying(dt) {
      const d = this.shopper;
      for (const it of this.store.items) {
        if (!it.flying || it.taken) continue;
        const f = it.flying; f.t += dt / 0.55;
        const cc = d.cartCenter(), u = Math.min(1, f.t), e = U.easeInOut(u);
        it.x = U.lerp(f.x0, cc.x, e); it.z = U.lerp(f.z0, cc.z, e);
        it.h = 0.85 + Math.sin(u * Math.PI) * 1.7 - (u > 0.8 ? (u - 0.8) * 1.5 : 0);
        if (u >= 1) this._collect(it);
      }
    }
    _collect(it) {
      if (it.taken) return;
      it.taken = true;
      const d = this.shopper;
      d.cart.push(it.p); d.lastAddAge = 0;
      this.audio.pickup(d.cart.length);
      this.hud.showcase(it.p);
      this.fx.text(d.cartScreen.x, d.cartScreen.y - 60, '+' + CNB.fmtBRL(it.p.price), '#ffd23f', 46, { life: 1.2 });
      this.fx.sparks(d.cartScreen.x, d.cartScreen.y - 20, 10, CNB.Catalog.CAT_COLOR[it.p.cat]);
    }

    _pickups(prevZ, dt) {
      const d = this.shopper;
      if (d.finished || d.busy) return;
      const front0 = prevZ + 0.35, front1 = d.z + 0.35;
      for (const it of this.store.items) {
        if (it.taken) continue;
        if (it.drop > 0) continue;
        // ímã: puxa achados próximos para o carrinho
        if (it.flying) continue;
        if (d.magnet > 0 && it.z - d.z < 8 && it.z - d.z > -1 && Math.abs(it.x - d.x) < 3.3) { this._grab(it); continue; }
        const crossed = (front0 <= it.z && front1 >= it.z) || (front0 >= it.z && front1 <= it.z);
        if (crossed && Math.abs(it.x - d.x) < 0.8) this._grab(it);
      }
    }

    _obstacles(prevZ) {
      const d = this.shopper;
      if (d.finished || d.busy) return;
      const f0 = prevZ + 0.35, f1 = d.z + 0.35;
      for (const o of this.store.obstacles) {
        if (o.hit) continue;
        const crossed = (f0 < o.z && f1 >= o.z) || (f0 > o.z && f1 <= o.z);
        if (!crossed) continue;
        if (Math.abs(d.x - o.x) > o.w / 2 + 0.3) { o.hit = true; o.passed = true; continue; }
        o.hit = true; o.knockDir = Math.sign(o.x - d.x) || 1;
        this.crashes++;
        if (o.type === 'wet' || o.type === 'spill') { this._slip(o.knockDir, o.type === 'wet' ? 'pisou no chão molhado' : 'escorregou nas laranjas'); }
        else {
          const lost = d.drop(1); this._lostFx(lost);
          d.force(S.CRASH); d.slide = d.state === S.RUN ? 2.5 : 1.4; d.turbo = 0;
          this.audio.crash(); this.shake = 18;
          this.hud.banner(o.type === 'cart' ? 'TROMBOU NO CARRINHO!' : o.type === 'pallet' ? 'BATEU NA PALETEIRA!' : 'DERRUBOU AS CAIXAS!', lost.length ? 'perdeu 1 achado' : null, '#ff6b6b', 1.6);
          if (Math.random() < 0.5) this.after(0.6, () => this.speak('bateu'));
        }
        break;
      }
    }

    _autoSteer() {
      const d = this.shopper;
      d.avoiding = false; d.chasing = false;
      if (d.manual || d.finished || d.busy || d.state === S.BACK) return;
      // 1) desvia de furada próxima
      const range = d.state === S.RUN ? 14 : 8;
      const ob = this.store.obstacles.find((o) => !o.hit && o.z - d.z > 0 && o.z - d.z < range);
      if (ob) {
        if (ob.dodge === undefined) ob.dodge = Math.random() < 0.8;
        if (ob.dodge) {
          let side = Math.sign(d.x - ob.x) || 1;
          if (Math.abs(ob.x + side * (ob.w / 2 + 0.9)) > CNB.Store.AISLE - 0.5) side *= -1;
          d.targetX = ob.x + side * (ob.w / 2 + 0.95); d.avoiding = true; return;
        }
      }
      // 2) vai atrás do próximo achado (às vezes erra)
      const it = this.store.items.find((i) => !i.taken && !i.flying && !(i.drop > 0) && i.z - d.z > 0.5 && i.z - d.z < 16);
      if (it) {
        if (it.aim === undefined) it.aim = Math.random() < this.cfg.autoPickSkill ? 0 : (Math.random() < 0.5 ? -1 : 1) * 1.4;
        d.targetX = it.x + it.aim; d.chasing = true;
      }
    }

    // ------------------------------------------------------------ caixa
    startArrive() {
      const d = this.shopper;
      d.turbo = 0; d.impulse = 0; d.retreat = 0; d.magnet = 0; d.force(S.ARRIVE);
      this.mode = 'win'; this.finalTime = this.roundTime; this.payTime = -1;
      this.audio.intensity = 2; this.audio.whoosh(true);
    }

    _startPay() {
      this.payTime = 0; this.scanned = 0; this.scanAt = []; this.paid = false;
      const n = this.shopper.cart.length;
      const step = n > 12 ? 0.18 : 0.32;
      for (let i = 0; i < n; i++) this.after(0.9 + i * step, () => { this.scanned = i + 1; this.scanAt[i] = this.payTime; this.audio.beep(); });
      this.after(1.2 + n * step, () => {
        this.paid = true; this.paidAt = this.payTime;
        this.audio.kaching(); this.audio.fanfare(); this.after(0.3, () => this.audio.cheer());
        this.store.cheer = 1; this.fx.doFlash(0.5, '180,255,200');
        const burst = () => { this.fx.confetti(80, 1500, 80, 0.7); this.fx.confetti(1000, 1500, 80, 0.7); this.audio.pop(); };
        burst(); this.after(0.8, burst); this.after(1.8, burst);
        this.speak(n ? 'obrigado' : 'vazio', true);
        this.countdown = 0;
        this.after(this.cfg.receiptTime, () => { this.countdown = this.cfg.restartCountdown; });
      });
      this.speak('caixa', true);
    }

    gameOver(user) {
      const d = this.shopper;
      d.turbo = 0; d.impulse = 0; d.retreat = 0; d.magnet = 0; d.force(S.DECLINED);
      this.timers = [];
      this.mode = 'gameover'; this.overBy = user; this.overTime = 0; this.countdown = 0; this._goCount = false;
      this.audio.setMusicLevel(this.cfg.audio.music * 0.3, 1); this.audio.sadTrombone();
      this.after(0.8, () => this.speak('recusado', true));
      // os achados voltam para a prateleira, um por um
      const n = d.cart.length;
      for (let i = 0; i < n; i++) this.after(1 + i * 0.22, () => { const l = d.drop(1); if (l.length) this.fx.text(d.cartScreen.x + U.rand(-120, 120), d.cartScreen.y - 30, '− ' + U.truncate(l[0].short, 14), '#f5d0fe', 28, { life: 1.4, vy: -140 }); this.audio.pop(); });
    }

    // ------------------------------------------------------------ loop
    loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.update(dt); this.render();
      requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      this.time += dt;
      for (const tm of this.timers) tm.t -= dt;
      const due = this.timers.filter((tm) => tm.t <= 0); this.timers = this.timers.filter((tm) => tm.t > 0); due.forEach((tm) => tm.fn());
      if (this.announce) { this.announce.age += dt; if (this.announce.age > this.announce.dur) this.announce = null; }
      if (!this.store) return;
      const d = this.shopper, st = this.store;
      this.bridge.update(dt, this.mode === 'playing');
      // achados da liquidação caindo do teto
      for (const it of st.items) if (it.drop > 0) it.drop = Math.max(0, it.drop - dt * 1.6);

      if (this.mode === 'playing') {
        this.roundTime += dt;
        this._autoSteer();
        const prevZ = d.z;
        d.update(dt, st);
        this._pickups(prevZ, dt); this._obstacles(prevZ);
        this._updateFlying(dt);
        if (d.z >= st.track) this.startArrive();
        // locutor: corredor novo + avisos de tempos em tempos
        const sec = st.sectionAt(d.z + 6);
        if (sec && sec !== this.lastSection) { if (this.lastSection) this.after(0.2, () => this.speak(sec.cat)); this.lastSection = sec; }
        this.annT -= dt;
        if (this.annT <= 0) { this.annT = U.rand(this.cfg.announcer.every[0], this.cfg.announcer.every[1]); this.speak(st.track - d.z < 60 ? 'fecha' : 'promo'); }
        this.audio.tempoMul = U.damp(this.audio.tempoMul, d.state === S.RUN ? 1.25 : 1, 3, dt);
        this.audio.intensity = d.state === S.RUN ? 1 : 0;
      } else if (this.mode === 'title') {
        d.update(dt, st); if (d.z > 40) d.z = 0;
      } else if (this.mode === 'win') {
        d.update(dt, st);
        if (this.payTime >= 0) this.payTime += dt;
        if (this.paid && Math.random() < dt * 5) this.fx.rain(2);
        if (this.countdown > 0) {
          const before = Math.ceil(this.countdown); this.countdown -= dt;
          if (Math.ceil(this.countdown) !== before && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) this.startRound();
        }
      } else if (this.mode === 'gameover') {
        d.update(dt, st); this.overTime += dt;
        if (this.overTime > this.cfg.gameOverTime) {
          if (!this._goCount) { this.countdown = this.cfg.restartCountdown * 0.6; this._goCount = true; }
          const before = Math.ceil(this.countdown); this.countdown -= dt;
          if (Math.ceil(this.countdown) !== before && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) { this._goCount = false; this.startRound(); }
        }
      }
      for (const o of st.obstacles) if (o.hit && !o.passed) o.knock = U.damp(o.knock, 1, 9, dt);
      st.glow = U.damp(st.glow, this.paid ? 1.8 + Math.sin(this.time * 8) * 0.2 : 1, 3, dt);
      this._camera(dt);
      this.fx.update(dt); this.hud.update(dt);
    }

    _camera(dt) {
      const d = this.shopper, c = this.cam;
      const P = d.state === S.RUN ? CAM_RUN : d.finished ? CAM_PAY : CAM_WALK;
      c.F = U.damp(c.F, P.F, 3, dt); c.y = U.damp(c.y, P.y, 3, dt); c.horizon = U.damp(c.horizon, P.hz, 3, dt);
      const tz = d.z - P.dist;
      c.z = U.damp(c.z, tz, tz < c.z ? 9 : 6, dt);
      if (d.z - c.z < 4.3) c.z = d.z - 4.3;
      c.x = U.damp(c.x, d.finished ? 0 : d.x * 0.55, 2.5, dt);
      this.shake = Math.max(0, this.shake - dt * 45);
      c.sx = (Math.random() - 0.5) * this.shake;
      c.sy = (Math.random() - 0.5) * this.shake + (d.busy || d.finished ? 0 : Math.sin(d.phase * 2) * (d.state === S.RUN ? 4 : 1.2));
    }

    render() {
      const ctx = this.ctx, c = this.cam, t = this.time;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.store) { this.hud.draw(ctx, t); return; }
      const st = this.store, d = this.shopper;
      st.drawEnv(ctx, c, t);
      const sprites = st.collectSprites(c, t);
      sprites.push({ z: d.z - 1.1, draw: (cx) => d.draw(cx, st, c, this.catalog) });
      sprites.sort((a, b) => b.z - a.z);
      for (const s of sprites) s.draw(ctx);
      if (d.state === S.RUN) CNB.Effects.speedLines(ctx, W / 2 - c.x * 40, c.horizon, 1, t);
      // vinheta
      const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.78);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,0.5)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      this.fx.draw(ctx);
      this.hud.draw(ctx, t);
    }
  }

  CNB.Game = Game;
})();
