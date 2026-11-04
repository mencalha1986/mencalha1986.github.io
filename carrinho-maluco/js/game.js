/* =========================================================================
   CARRINHO MALUCO — loop, câmera, coleta de achados, furadas, presentes,
   locutor da loja, caixa e nota fiscal
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const S = CNB.Shopper.S;
  // câmera alta e um pouco à esquerda (por cima do ombro) para o carrinho aparecer
  const CAM_WALK = { dist: 3.5, y: 4.3, F: 1060, hz: 330, side: 0.3 };
  const CAM_RUN = { dist: 4.1, y: 4.1, F: 1000, hz: 350, side: 0.3 };
  const CAM_PAY = { dist: 3.8, y: 3.4, F: 1100, hz: 470, side: 0.2 };

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
      this.followQueue = []; this.followT = 0;
      // locutor (áudios gerados)
      this.annAudio = {};
      for (const k in CNB.ANUNCIOS || {}) { const a = new Audio(CNB.ANUNCIOS[k].src); a.preload = 'auto'; this.annAudio[k] = a; }
      // sempre começa no automático (ou ?controle=manual no link)
      this.setControl(new URLSearchParams(location.search).get('controle') || this.cfg.control);
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
      this.idleManual = 0;
      if (this.onControl) this.onControl(this.control);
    }
    // no manual, sem mexer por alguns segundos, o piloto automático assume de novo
    _autoReturn(dt) {
      const sec = this.cfg.autopilot.returnAfter;
      if (this.control !== 'manual' || !sec || this.mode !== 'playing') return;
      if (this.shopper.steer) { this.idleManual = 0; return; }
      this.idleManual = (this.idleManual || 0) + dt;
      if (this.idleManual > sec) { this.setControl('auto'); this.hud.banner('PILOTO AUTOMÁTICO', 'aperte ← → para assumir', '#38bdf8', 1.4); }
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
      this.gifts.resetRound(); this.fx.clear(); this.timers = []; this.followQueue = [];
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
      // seguidor novo não cancela nada: entra na fila e acontece por cima da ação atual
      if (def.action === 'follow') { this.followQueue.push({ user, def }); return; }
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

    _slip(dir, sub, title = 'DERRAPOU!') {
      const d = this.shopper;
      d.spinDir = dir; d.force(S.SLIP);
      this.audio.slip(); this.after(0.5, () => this.audio.crash());
      const lost = d.drop(2);
      this._lostFx(lost);
      this.hud.banner(title, sub || (lost.length ? `perdeu ${lost.length} achado${lost.length > 1 ? 's' : ''}` : null), '#facc15', 1.8);
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
    // NOVO SEGUIDOR: o carrinho volta e os últimos achados voam de volta para o corredor, à frente
    _follow(user, def) {
      const d = this.shopper, st = this.store;
      const lost = d.drop(def.drop);
      const cc = d.cartCenter();
      const out = lost.map((p, i) => {
        const tz = d.z + 5 + i * 3.2 + Math.random() * 1.5;
        const tx = U.clamp((Math.random() * 2 - 1) * (CNB.Store.AISLE - 0.9), -CNB.Store.AISLE + 0.8, CNB.Store.AISLE - 0.8);
        return { p, x: cc.x, z: cc.z, h: 1, taken: false, seed: Math.random(), back: true,
                 outFly: { t: -i * 0.18, x0: cc.x, z0: cc.z, x1: tx, z1: tz } };
      });
      st.items.push(...out);
      st.items.sort((a, b) => a.z - b.z);
      d.retreat = Math.max(d.retreat, def.back);   // vai pra trás (sem cancelar turbo/impulso)
      this.audio.chime(); this.audio.whoosh(false);
      this.fx.confetti(d.cartScreen.x, d.cartScreen.y, 40, 0.6);
      this.hud.banner('NOVO SEGUIDOR!', `${user} seguiu o canal${out.length ? ` — ${out.length} achado${out.length > 1 ? 's' : ''} caíram do carrinho` : ''}`, def.color, 2.2);
      this.fx.text(U.clamp(d.headScreen.x, 200, 880), d.headScreen.y - 120, '❤ ' + user, def.color, 32, { life: 1.8, vy: -70, rot: 0 });
    }
    _updateFollow(dt) {
      this.followT -= dt;
      const d = this.shopper;
      if (this.followT <= 0 && this.followQueue.length && !d.finished && !d.busy) {
        const f = this.followQueue.shift(); this._follow(f.user, f.def);
        this.followT = 1.3;   // vários seguidores juntos: um efeito a cada 1,3 s
      }
      for (const it of this.store.items) {
        const f = it.outFly; if (!f) continue;
        f.t += dt / 0.85; if (f.t < 0) continue;
        const u = Math.min(1, f.t), e = U.easeInOut(u);
        it.x = U.lerp(f.x0, f.x1, e); it.z = U.lerp(f.z0, f.z1, e);
        it.h = 1 + Math.sin(u * Math.PI) * 2.3 - u * 0.15;
        if (u >= 1) { it.outFly = null; it.h = 0; }
      }
    }

    _updateFlying(dt) {
      const d = this.shopper;
      for (const it of this.store.items) {
        if (!it.flying || it.taken) continue;
        const f = it.flying; f.t += dt / 0.55;
        const cc = d.cartCenter(), u = Math.min(1, f.t), e = U.easeInOut(u);
        it.x = U.lerp(f.x0, cc.x, e); it.z = U.lerp(f.z0, cc.z, e);
        it.h = 0.85 + Math.sin(u * Math.PI) * 0.9 - (u > 0.8 ? (u - 0.8) * 1.2 : 0);
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
      const front0 = prevZ + 1.35, front1 = d.z + 1.35;
      for (const it of this.store.items) {
        if (it.taken) continue;
        if (it.drop > 0) continue;
        // ímã: puxa achados próximos para o carrinho
        if (it.flying || it.outFly) continue;
        if (d.magnet > 0 && it.z - d.z < 8 && it.z - d.z > -1 && Math.abs(it.x - d.x) < 3.3) { this._grab(it); continue; }
        const crossed = (front0 <= it.z && front1 >= it.z) || (front0 >= it.z && front1 <= it.z);
        if (crossed && Math.abs(it.x - d.x) < 0.8) this._grab(it);
      }
    }

    _obstacles(prevZ) {
      const d = this.shopper;
      if (d.finished || d.busy) return;
      const f0 = prevZ + 1.4, f1 = d.z + 1.4;
      for (const o of this.store.obstacles) {
        if (o.hit) continue;
        const crossed = (f0 < o.z && f1 >= o.z) || (f0 > o.z && f1 <= o.z);
        if (!crossed) continue;
        if (Math.abs(d.x - o.x) > o.w / 2 + 0.3) { o.hit = true; o.passed = true; continue; }
        o.hit = true; o.knockDir = Math.sign(o.x - d.x) || 1;
        this.crashes++;
        const def = CNB.Store.OB_TYPES[o.type];
        if (def.slip) { this._slip(o.knockDir, null, def.banner); }
        else {
          const lost = d.drop(1); this._lostFx(lost);
          d.force(S.CRASH); d.slide = d.state === S.RUN ? 2.5 : 1.4; d.turbo = 0;
          this.audio.crash(); this.shake = 18;
          this.hud.banner(def.banner, lost.length ? 'perdeu 1 achado' : null, '#ff6b6b', 1.6);
          if (Math.random() < 0.5) this.after(0.6, () => this.speak('bateu'));
        }
        break;
      }
    }

    // PILOTO AUTOMÁTICO: olha o corredor à frente e escolhe a melhor faixa.
    // Pega a maioria dos achados, desvia da maioria das furadas, mas às vezes
    // se distrai, reage tarde e bate (correndo no turbo erra mais).
    _autoSteer(dt) {
      const d = this.shopper, cfg = this.cfg.autopilot;
      d.avoiding = false; d.chasing = false;
      if (d.manual || d.finished || d.busy || d.state === S.BACK) return;
      const run = d.state === S.RUN;
      this.apT = (this.apT || 0) - dt;
      if (this.apT > 0 && this.apLane !== undefined) { d.targetX = this.apLane; d.chasing = true; return; }
      // tempo de reação humano: decide de novo a cada 0,25–0,6 s
      this.apT = U.rand(0.25, 0.6);
      const AISLE = CNB.Store.AISLE, look = run ? 22 : 15, near = run ? 4 : 2;
      const obs = this.store.obstacles.filter((o) => !o.hit && o.z - d.z > 1.2 && o.z - d.z < look);
      const items = this.store.items.filter((i) => !i.taken && !i.flying && !i.outFly && !(i.drop > 0) && i.z - d.z > 1.5 && i.z - d.z < look);
      // cada furada/achado decide UMA vez se ele "percebe"/"quer"
      for (const o of obs) if (o.seen === undefined) o.seen = Math.random() < (run ? cfg.dodgeRun : cfg.dodge);
      for (const it of items) if (it.want === undefined) it.want = Math.random() < cfg.pick;
      let best = d.x, bestScore = -1e9;
      for (let x = -AISLE + 0.6; x <= AISLE - 0.6 + 1e-6; x += 0.3) {
        let sc = 0;
        for (const it of items) {
          if (!it.want) continue;
          const dz = it.z - d.z, reach = Math.abs(it.x - d.x) / Math.max(1, dz) ;
          if (reach > (run ? 0.35 : 0.6)) continue;                 // longe demais para alcançar a tempo
          if (Math.abs(it.x - x) < 0.7) sc += 10 / (1 + dz * 0.15) + it.p.price * 0.01;
        }
        for (const o of obs) {
          if (!o.seen) continue;                                      // não viu: pode bater
          const dz = o.z - d.z, late = dz < near ? 0.4 : 1;           // muito perto = reage mal
          if (Math.abs(o.x - x) < o.w / 2 + 0.45) sc -= (30 / (1 + dz * 0.1)) * late;
        }
        sc -= Math.abs(x - d.x) * 1.2;                                // preguiça de trocar de faixa
        sc -= Math.abs(x) * 0.15;                                     // gosta do meio do corredor
        if (sc > bestScore) { bestScore = sc; best = x; }
      }
      // de vez em quando se distrai olhando a prateleira
      if (Math.random() < cfg.distract) best = U.clamp(best + U.rand(-1.2, 1.2), -AISLE + 0.6, AISLE - 0.6);
      this.apLane = best; d.targetX = best; d.chasing = true;
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
      const step = n > 12 ? 0.22 : 0.4;
      for (let i = 0; i < n; i++) this.after(0.9 + i * step, () => { this.scanned = i + 1; this.scanAt[i] = this.payTime; this.audio.beep(); setTimeout(() => this.audio.paper(), 160); });
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
      // em máquina lenta (poucos quadros por segundo) roda o tempo em passos de até 0,05 s, sem deixar o jogo em câmera lenta
      let dt = Math.min(0.2, (now - this.last) / 1000); this.last = now;
      while (dt > 0.05) { this.update(0.05); dt -= 0.05; }
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
      st.update(dt, this.time);
      // achados da liquidação caindo do teto
      for (const it of st.items) if (it.drop > 0) it.drop = Math.max(0, it.drop - dt * 1.6);

      if (this.mode === 'playing') {
        this.roundTime += dt;
        this._autoSteer(dt);
        this._autoReturn(dt);
        const prevZ = d.z;
        d.update(dt, st);
        this._pickups(prevZ, dt); this._obstacles(prevZ);
        this._updateFlying(dt);
        this._updateFollow(dt);
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
      if (d.z - c.z < 3.0) c.z = d.z - 3.0;
      c.x = U.damp(c.x, (d.finished ? 0 : d.x * 0.7) - P.side, 2.5, dt);
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
      sprites.push({ z: d.z + 0.2, draw: (cx) => d.draw(cx, st, c, this.catalog) });
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
