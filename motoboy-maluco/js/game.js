/* =========================================================================
   MOTOBOY MALUCO — loop, câmera, entregas, perseguição do caramelo,
   colisões, piloto automático, presentes, vozes e fim do expediente
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const S = CNB.Rider.S, ZONE = CNB.City.ZONE, OB = CNB.City.OB;
  const CAM = {
    ride:  { dist: 3.9, y: 2.35, F: 1400, hz: 830, side: 0 },
    run:   { dist: 4.8, y: 2.3,  F: 1300, hz: 840, side: 0 },
    chase: { dist: 7.0, y: 3.0,  F: 1300, hz: 760, side: 0 },
    stop:  { dist: 5.0, y: 2.55, F: 1250, hz: 800, side: 1.9 }
  };

  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.cfg = CNB.CONFIG;
      this.catalog = new CNB.Catalog(this.cfg);
      this.rider = new CNB.Rider(this.cfg);
      this.audio = new CNB.AudioEngine(this.cfg.audio);
      this.fx = new CNB.Effects();
      this.hud = new CNB.HUD(this);
      this.gifts = new CNB.GiftSystem(this.cfg, (k, def, n, user) => this.applyGift(k, def, n, user));
      this.bridge = new CNB.Bridge(this.gifts, this.cfg);
      this.cam = { x: 0, y: 2.5, z: -5, F: 1380, horizon: 760, sx: 0, sy: 0 };
      this.mode = 'loading'; this.time = 0; this.roundNo = 0; this.roundTime = 0; this.shake = 0;
      this.seed = Math.floor(Math.random() * 1000);
      this.timers = []; this.followQueue = []; this.borr = null; this.borrHead = null; this.followClients = []; this.delivered = [];
      // vozes (áudios gerados)
      this.voiceEls = {}; this.lastLine = {};
      for (const cat in CNB.FALAS || {}) CNB.FALAS[cat].forEach((l) => { const a = new Audio(l.src); a.preload = 'auto'; this.voiceEls[l.src] = a; });
      this.voice = { cfg: this.cfg.voice, stop: () => this._stopVoice(), setMuted: (m) => { this.voiceMuted = m; if (m) this._stopVoice(); } };
      this.setControl(new URLSearchParams(location.search).get('controle') || this.cfg.control);
      this._bind();
      this.catalog.ready.then(() => { this.city = new CNB.City(this.cfg, this.catalog); this.mode = 'title'; });
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    setControl(mode) { this.control = mode === 'manual' ? 'manual' : 'auto'; this.rider.manual = this.control === 'manual'; this.idleManual = 0; if (this.onControl) this.onControl(this.control); }
    _autoReturn(dt) {
      const sec = this.cfg.autopilot.returnAfter;
      if (this.control !== 'manual' || !sec || this.mode !== 'playing') return;
      if (this.rider.steer) { this.idleManual = 0; return; }
      this.idleManual = (this.idleManual || 0) + dt;
      if (this.idleManual > sec) { this.setControl('auto'); this.hud.banner('PILOTO AUTOMÁTICO', 'aperte ← → para pilotar', '#38bdf8', 1.4); }
    }

    _bind() {
      const d = this.rider;
      d.onEvent = (ev, arg) => {
        if (ev === 'impact') { this.audio.thud(); this.shake = 22; this.fx.dust(d.groundScreen.x, d.groundScreen.y, 16, 1.3); }
        if (ev === 'land') { this.audio.thud(); this.shake = 10; }
        if (ev === 'runEnd') this.hud.banner('ACABOU O TURBO', null, '#9ae6ff', 1.2);
        if (ev === 'chaseEnd') this._dogGiveUp();
        if (ev === 'state' && arg === S.STOP) this._deliver();
      };
    }
    after(sec, fn, tag) { this.timers.push({ t: sec, fn, tag }); }

    // ------------------------------------------------------------ vozes
    _stopVoice() { if (this.voiceNow) this.voiceNow.pause(); }
    say(cat, opts = {}) {
      const list = (CNB.FALAS || {})[cat]; if (!list || !list.length) return;
      if (!opts.force && this.time - (this.lastSay || -9) < this.cfg.voice.minGap) return;
      let pick = opts.index !== undefined ? list[opts.index] : list[Math.floor(Math.random() * list.length)];
      if (opts.index === undefined && list.length > 1 && pick === this.lastLine[cat]) pick = list[(list.indexOf(pick) + 1) % list.length];
      this.lastLine[cat] = pick; this.lastSay = this.time;
      if (pick.who !== 'g') this.hud.bubble(cat === 'cliente' ? 'cliente' : pick.who === 'b' ? 'borr' : 'motoboy', pick.text, pick.dur + 0.6);
      if (!this.cfg.voice.enabled || this.voiceMuted || this.audio.muted) return;
      const el = this.voiceEls[pick.src] || new Audio(pick.src);
      if (this.voiceNow && pick.who !== 'g' && cat !== 'cliente') this.voiceNow.pause();
      el.currentTime = 0; el.play().catch(() => {});
      if (pick.who !== 'g') this.voiceNow = el;
      this.audio.duck(0.45, pick.dur + 0.3);
    }

    // ------------------------------------------------------------ rodada
    start() { if (this.mode !== 'title') return; this.audio.start(); this.startRound(); }

    startRound() {
      this.seed++; this.roundNo++;
      this.city.reset(this.seed);
      const man = this.rider.manual; this.rider.reset(); this.rider.manual = man; this._bind();
      this.gifts.resetRound(); this.fx.clear(); this.timers = []; this.followQueue = [];
      this.mode = 'playing'; this.roundTime = 0; this.delivered = []; this.sumTime = -1; this.countdown = 0; this.overTime = 0;
      this.chaseDog = null; this.cust = null; this.stopping = null; this.pendingGift = null; this.flyBox = null;
      // pedidos: um achado do site para cada casa
      const items = this.catalog.items.slice().sort(() => Math.random() - 0.5);
      this.orders = this.city.stops.map((s, i) => ({ stop: s, item: items[i % items.length], stars: 5, client: null }));
      this.announced = new Set();
      this.cam.z = -5; this.cam.x = 0; this.cam.yaw = 0; this.cam.hd = 0; this.turning = null;
      this.audio.intensity = 0; this.audio.tempoMul = 1; this.audio.setMusicLevel(this.cfg.audio.music);
      this.hud.banner(`RODADA ${this.roundNo}`, `${this.orders.length} entregas no baú — mandem presentes!`, '#82e8cc', 2.4);
      this.after(1.0, () => this.say('partida', { force: true }));
    }

    nextStop() { return this.city && this.city.stops.find((s) => !s.done); }
    nextManeuver() {
      const z = this.rider.z;
      return this.city.maneuvers.find((m) => m.z > z - 2 && !(m.type === 'dest' && this.city.stops.find((s) => s.z === m.z && s.done)));
    }
    currentOrder() { const s = this.nextStop(); return s && this.orders[s.k]; }
    get currentStars() { const o = this.currentOrder(); return o ? o.stars : 5; }
    _penalty(v) { const o = this.currentOrder(); if (o) o.stars = Math.max(1, o.stars - v); }

    // ------------------------------------------------------------ presentes
    cancelCurrentAction() {
      this.rider.cancelAction();
      this._repairLeave();
      if (this.chaseDog && !this.chaseDog.giveUp) this._dogGiveUp(true);
      this.timers = this.timers.filter((tm) => tm.tag !== 'gift');
      this.fx.clearTag('gift');
      this.hud.clearBanners();
    }

    applyGift(key, def, n, user) {
      const d = this.rider, head = d.headScreen;
      if (this.mode !== 'playing') { this.audio.gift(0); return; }
      if (def.action === 'follow') { this.followQueue.push(user); return; }
      if (def.action === 'horn') { this._horn(user, def); return; }   // buzina não cancela nada
      if (d.finished) { this.pendingGift = [key, def, n, user]; this.audio.gift(0); return; }   // entregando: acontece quando sair
      this.cancelCurrentAction();   // o último presente manda
      this.fx.text(U.clamp(head.x, 200, 880), head.y - 110, user, def.color, 30, { life: 1.6, vy: -70, rot: 0, tag: 'gift' });
      switch (def.action) {
        case 'advance':
          d.impulse = def.amount * n; this.audio.gift(def.amount >= 15 ? 1 : 0);
          this.fx.text(head.x, head.y - 40, `+${def.amount * n} m`, '#7CFC9A', 52, { tag: 'gift' });
          if (def.amount >= 15) this.hud.banner('ACELERA!', `${user} deu gás na moto`, def.color, 1.5);
          if (Math.random() < 0.5) this.after(0.3, () => this.say('go'), 'gift');
          break;
        case 'turbo':
          d.turbo = def.duration * n; this.audio.turbo(); this.fx.doFlash(0.3, '255,220,80'); this.shake = 12;
          this.hud.banner('TURBO!', `${user} ligou o nitro`, def.color, 1.9);
          this.after(0.4, () => this.say('turbo', { force: true }), 'gift');
          break;
        case 'dog': this._dogChase(def.duration * n, user, def); break;
        case 'back':
          d.retreat = def.amount * n; this.audio.back();
          this.hud.banner('ENDEREÇO ERRADO!', `${user} trocou o endereço`, def.color, 1.9);
          this.say('gps', { index: 3, force: true }); this.after(1.8, () => this.say('errado', { force: true }), 'gift');
          this._penalty(0.5);
          break;
        case 'flat':
          d.force(S.FLAT); d.waitFix = true; d.tireOk = false; this.audio.slip(); this.audio.splash();
          this.fx.text(head.x + 60, head.y + 120, 'PFSSSS!', '#fff', 46, { life: 1.4 });
          this.hud.banner('PNEU FURADO!', `${user} jogou um prego`, def.color, 1.9);
          this.after(0.5, () => this.say('pneu', { force: true }), 'gift');
          this.after(2.0, () => this.say('chamar', { force: true }), 'gift');
          this.after(2.6, () => this._callRepair(), 'gift');
          this._penalty(0.5);
          break;
        case 'gameover': this.gameOver(user); break;
      }
    }
    // borracheiro vem da calçada, troca o pneu e vai embora
    _callRepair() {
      const d = this.rider, R = this.city.road(d.z), G = (t, fn) => this.after(t, fn, 'gift');
      const fx = d.x + 0.8;
      this.borr = { x: R + 2.6, tx: fx, z: d.z + 0.7, pose: 'walk', face: -1, alpha: 0, t: 0 };
      this.hud.banner('BORRACHEIRO A CAMINHO!', 'socorro 24 horas', '#facc15', 1.6);
      G(1.7, () => { const b = this.borr; if (!b) return; b.pose = 'work'; b.x = b.tx; this.say('borracheiro', { index: Math.random() < 0.5 ? 0 : 2, force: true }); this.audio.wrench(); });
      [2.4, 3.1, 3.8].forEach((tt) => G(tt, () => { this.audio.wrench(); const p = this.borrHead; if (p) { this.fx.sparks(p.x - 40, p.y + 140, 6, '#ffd23f'); this.fx.text(p.x - 60, p.y + 60, 'TREC TREC', '#ffd23f', 34, { life: 0.8, tag: 'gift' }); } }));
      G(4.3, () => { d.tireOk = true; this.audio.air(1.1); const p = this.borrHead; if (p) this.fx.text(p.x - 50, p.y + 70, 'TSSSS', '#bfe9ff', 40, { life: 1.1, tag: 'gift' }); });
      G(5.5, () => { const b = this.borr; if (!b) return; b.pose = 'thumb'; this.say('borracheiro', { index: 1, force: true }); this.audio.chime(); });
      G(7.2, () => { d.waitFix = false; d.tireOk = false; d.slowT = 1.5; if (d.state === S.FLAT) d.setState(S.RIDE); this._repairLeave(); this.after(0.6, () => this.say('valeu')); });
    }
    _repairLeave() { const b = this.borr; if (!b) return; b.pose = 'walk'; b.face = 1; b.tx = this.city.road(b.z) + 3; b.leaving = true; }

    _applyPending() { const p = this.pendingGift; this.pendingGift = null; if (p) this.applyGift(...p); }

    _follow(user) {
      const d = this.rider;
      this.followClients.push(user);
      if (!d.finished) d.retreat = Math.max(d.retreat, this.cfg.gifts.seguir.back);
      this.audio.chime(); this.fx.confetti(d.headScreen.x, d.headScreen.y + 80, 40, 0.6);
      this.hud.banner('NOVO SEGUIDOR!', `${user} vai receber uma entrega!`, '#fe2c55', 2.4);
      this.after(0.6, () => this.say('seguidor', { force: true }));
    }

    // BI-BI! carros abrem caminho, pedestres e cachorros correm, o caramelo foge
    _horn(user, def) {
      const d = this.rider, c = this.city;
      this.audio.honk(); this.after(0.5, () => this.audio.honk());
      this.fx.text(U.clamp(d.headScreen.x, 220, 860), d.headScreen.y - 30, 'BI-BI!', '#38bdf8', 64, { life: 1.2, vy: -120, rot: -0.08 });
      this.fx.text(U.clamp(d.headScreen.x, 200, 880), d.headScreen.y - 140, user, def.color, 30, { life: 1.6, vy: -70, rot: 0 });
      this.say('buzina', { force: true });
      let moved = 0;
      for (const o of c.obstacles) {
        const dz = o.z - d.z; if (o.hit || o.ghost || dz < 1 || dz > 40) continue;
        const R = c.road(o.z);
        if (o.vehicle && o.type !== 'oncoming') {
          // muda para a faixa mais longe do motoboy
          const lanes = c.zoneAt(o.z).type === 'av' ? [-3.6, 0, 3.6] : [R * 0.33];
          o.tx = lanes.reduce((a, b) => (Math.abs(b - d.x) > Math.abs(a - d.x) ? b : a), lanes[0]);
          if (o.v > 0) o.v += 2;   // e acelera
          moved++;
        } else if (o.type === 'ped' || o.type === 'dogx') {
          o.cross = o.x >= d.x ? 1 : -1; o.flee = true; o.hit = true; o.passed = true; moved++;
          this.fx.text(this.rider.headScreen.x + (o.x > d.x ? 200 : -200), this.rider.headScreen.y + 60, o.type === 'ped' ? 'AAAH!' : 'CAIN!', '#fff', 40, { life: 1 });
        }
      }
      if (this.chaseDog && !this.chaseDog.giveUp) { d.chase = 0; d.setState(S.RIDE); this._dogGiveUp(true); this.hud.banner('BI-BI!', 'o caramelo levou um susto e fugiu!', def.color, 2); return; }
      this.hud.banner('BI-BI!', moved ? `${user} buzinou — abriram caminho!` : `${user} apertou a buzina`, def.color, 1.6);
    }

    // ------------------------------------------------------------ o caramelo
    _dogChase(dur, user, def) {
      const d = this.rider;
      d.chase = dur;
      this.chaseDog = { gap: 14, x: d.x, close: 0, alpha: 0, t: 0, giveUp: false, z: d.z - 14, barkT: 0 };
      this.audio.growl(); this.after(0.3, () => this.audio.bark());
      this.hud.banner('CACHORRO!', `${user} soltou o caramelo!`, def.color, 2);
      this.after(0.7, () => this.say('cao', { force: true }), 'gift');
    }
    _dogGiveUp(silent) {
      const c = this.chaseDog; if (!c || c.giveUp) return;
      c.giveUp = true; c.t = 0;
      if (!silent) { this.after(0.4, () => this.say('caofim', { force: true })); this.audio.bark(); }
    }
    _updateDog(dt) {
      const c = this.chaseDog, d = this.rider; if (!c) return;
      c.t += dt;
      if (!c.giveUp) {
        // vem chegando, encosta na bota e fica pra trás um pouco, de novo e de novo
        const target = 1.2 + (Math.sin(c.t * 1.7) * 0.5 + 0.5) * 2.4;
        c.gap = U.damp(c.gap, target, c.t < 2 ? 1.2 : 2.6, dt);
        c.z = d.z - c.gap;
        c.x = U.damp(c.x, d.x + Math.sin(c.t * 2.3) * 0.5, 3.5, dt);
        c.close = U.clamp(1 - (c.gap - 1.2) / 6, 0, 1);
        c.alpha = U.damp(c.alpha, 1, 6, dt);
        c.barkT -= dt;
        if (c.barkT <= 0) { this.audio.bark(); c.barkT = U.rand(0.55, 1.1); this.fx.text(U.clamp(d.groundScreen.x + U.rand(-160, 160), 160, 920), d.groundScreen.y + 60, U.choice(['AU AU!', 'AU!', 'GRRR!', 'AUAUAU!']), '#ffd23f', 44, { life: 0.9, vy: -150 }); }
        if (c.gap < 1.5 && Math.random() < dt * 1.2) { this.fx.text(d.groundScreen.x, d.groundScreen.y - 30, 'NHAC!', '#ff6b6b', 50, { life: 0.8 }); this.audio.pop(); }
      } else {
        c.alpha = U.damp(c.alpha, 0, 3, dt);
        c.z += 0.5 * dt;   // para e senta, o motoboy se afasta
        if (c.t > 4 || d.z - c.z > 60) this.chaseDog = null;
      }
    }

    // ------------------------------------------------------------ entrega
    _clientName() {
      if (this.followClients.length) return this.followClients.shift();
      const used = new Set(this.delivered.map((x) => x.client));
      const fans = this.gifts.ranking(10).map((u) => u.name).filter((n) => !used.has(n));
      if (fans.length) return fans[0];
      return U.choice(this.cfg.customers);
    }

    _checkArrive() {
      const d = this.rider, s = this.nextStop();
      if (!s || this.stopping || d.finished || d.busy || d.state === S.BACK) return;
      if (d.z >= s.z - 14) {
        d.turbo = 0; d.impulse = 0; d.retreat = 0;
        if (d.chase > 0) { d.chase = 0; this._dogGiveUp(); }
        d.stopZ = s.z; d.force(S.ARRIVE);
        this.stopping = s;
        this.say('gps', { index: 2, force: true });
      }
    }

    _deliver() {
      const s = this.stopping, o = this.orders[s.k], d = this.rider;
      o.client = this._clientName();
      const look = this.city.customers[s.k], R = ZONE.rua.road, FX = R + ZONE.rua.side;
      this.cust = { x: FX + 0.3, z: s.z + 0.6, look, walking: false, box: false, wave: false, alpha: 0 };
      const T = (t, fn) => this.after(t, fn, 'stop');
      T(0.1, () => { this.audio.honk(); this.say('chegou', { force: true }); });
      T(0.6, () => { this.cust.walking = true; this.cust.tx = R + 0.45; });
      T(2.1, () => { this.cust.walking = false; this.flyBox = { t: 0, item: o.item }; });
      T(2.6, () => {
        this.cust.box = true; this.flyBox = null; s.done = true;
        this.audio.deliver(); this.fx.confetti(this.customerHead ? this.customerHead.x : 700, this.customerHead ? this.customerHead.y : 1100, 50, 0.6);
        this.delivered.push({ item: o.item, client: o.client, num: s.num, stars: o.stars });
        this.hud.showCard({ item: o.item, client: o.client, num: s.num, stars: o.stars });
        this.say('cliente', { force: true });
      });
      T(4.2, () => { this.cust.wave = true; this.say('tchau', { force: true }); });
      T(5.4, () => {
        this.cust.walking = true; this.cust.tx = FX + 0.6; this.cust.leaving = true;
        this.stopping = null;
        if (this.city.stops.every((x) => x.done)) { this._endRound(); return; }
        d.force(S.RIDE); this.audio.whoosh(true);
        this._applyPending();
      });
    }

    _endRound() {
      this.mode = 'win'; this.finalTime = this.roundTime; this.sumTime = 0;
      this.audio.fanfare(); this.after(0.3, () => this.audio.cheer()); this.audio.setMusicLevel(this.cfg.audio.music * 1.4, 1);
      const burst = () => { this.fx.confetti(80, 1500, 80, 0.7); this.fx.confetti(1000, 1500, 80, 0.7); this.audio.pop(); };
      burst(); this.after(0.8, burst); this.after(1.8, burst);
      this.after(this.cfg.summaryTime, () => { this.countdown = this.cfg.restartCountdown; });
    }

    gameOver(user) {
      const d = this.rider;
      this.cancelCurrentAction();
      d.force(S.NOGAS); this.timers = [];
      this.mode = 'gameover'; this.overBy = user; this.overTime = 0; this.countdown = 0; this._goCount = false;
      this.audio.setMusicLevel(this.cfg.audio.music * 0.3, 1); this.audio.sadTrombone();
      this.after(0.6, () => this.say('gasolina', { force: true }));
    }

    // ------------------------------------------------------------ colisões
    _collide(prevZ) {
      const d = this.rider; if (d.finished || d.busy || d.state === S.BACK) return;
      const f0 = prevZ + 0.9, f1 = d.z + 0.9;
      for (const o of this.city.obstacles) {
        if (o.hit || o.ghost) continue;
        const z0 = o.zPrev !== undefined ? o.zPrev : o.z;
        if (!(f0 - z0 < 0 && f1 - o.z >= 0)) continue;
        const def = OB[o.type];
        if (def.w < 50 && Math.abs(d.x - o.x) > o.w / 2 + 0.35) { o.hit = true; o.passed = true; continue; }
        o.hit = true; o.kdir = Math.sign(o.x - d.x) || 1;
        this._hit(o, def);
        break;
      }
    }
    _hit(o, def) {
      const d = this.rider, dir = -o.kdir || 1;
      if (def.hit === 'jump') {
        const fast = d.speed > 6;
        d.hit('jump');
        if (fast) { this.hud.banner('VOOU NA LOMBADA!', null, '#ffd23f', 1.4); this.say('lombada', { force: true }); this._penalty(0.25); }
        else this.audio.thud();
        return;
      }
      d.hit(def.hit, dir);
      if (def.hit === 'crash') { this.audio.crash(); this.shake = 20; this._penalty(1); this.after(0.7, () => this.say('bateu', { force: true })); }
      else if (def.hit === 'stop') { this.audio.skid(); if (o.type === 'dogx') this.audio.bark(); this.shake = 8; this.say('quase', { force: true }); }
      else if (o.type === 'puddle') { this.audio.splash(); this.fx.dust(d.groundScreen.x, d.groundScreen.y, 12, 1.2); this._penalty(0.25); }
      else { this.audio.plastic(); this.shake = 10; this._penalty(0.5); }
      this.hud.banner(def.banner, def.hit === 'crash' ? '−1 estrela' : null, def.hit === 'stop' ? '#ffd23f' : '#ff6b6b', 1.5);
    }

    // ------------------------------------------------------------ piloto automático
    _autoSteer(dt) {
      const d = this.rider, ap = this.cfg.autopilot;
      if (d.manual || d.finished || d.busy || d.state === S.BACK) return;
      this.apT = (this.apT || 0) - dt;
      if (this.apT > 0 && this.apLane !== undefined) { d.targetX = this.apLane; return; }
      this.apT = U.rand(0.22, 0.5);
      const fast = d.speed > 9, R = this.city.road(d.z + 8) - 0.6, look = fast ? 26 : 16;
      const obs = this.city.obstacles.filter((o) => !o.hit && !o.ghost && OB[o.type].w < 50 && o.z - d.z > 1.4 && o.z - d.z < look);
      for (const o of obs) if (o.seen === undefined) o.seen = Math.random() < (fast ? ap.dodgeFast : ap.dodge);
      let pref = this.city.zoneAt(d.z + 8).type === 'rua' ? R * 0.45 : 1.8;
      const K = this.city.nextCorner;
      if (K && K.zc - d.z < 30) pref = K.dir > 0 ? R - 0.6 : -R * 0.35;   // encosta do lado da conversão
      let best = d.targetX, bestS = -1e9;
      for (let x = -R; x <= R + 1e-6; x += 0.4) {
        let sc = -Math.abs(x - d.x) * 0.9 - Math.abs(x - pref) * 0.35;
        for (const o of obs) {
          if (!o.seen) continue;
          const tReach = (o.z - d.z) / Math.max(1, d.speed - o.v);
          const ox = o.cross ? o.x + o.cross * 1.4 * Math.min(tReach, 2) : o.x;
          if (Math.abs(ox - x) < o.w / 2 + 0.55) sc -= 40 / (1 + (o.z - d.z) * 0.08);
        }
        if (sc > bestS) { bestS = sc; best = x; }
      }
      if (Math.random() < ap.distract) best = U.clamp(best + U.rand(-1.4, 1.4), -R, R);
      this.apLane = best; d.targetX = best;
    }

    // ------------------------------------------------------------ esquinas: seta, freia, vira
    _corners(dt) {
      const d = this.rider, c = this.city, cam = this.cam, K = c.nextCorner, L = c.lastCorner;
      // não dá ré para antes da esquina que já virou
      if (L && d.z < L.zc + L.cw + 0.3) { d.z = L.zc + L.cw + 0.3; d.retreat = 0; }
      const tn = this.turning;
      const near = !!(tn || this.borr || (K && K.dir > 0 && K.zc - d.z < 34));
      this.guideAlpha = U.damp(this.guideAlpha === undefined ? 1 : this.guideAlpha, near ? 0 : 1, 5, dt);
      d.blink = tn ? tn.k.dir : K && K.zc - d.z < 38 && !d.finished ? K.dir : 0;
      d.speedCap = tn ? 6 : K ? 6.5 + Math.max(0, K.zc - d.z) * 0.55 : 99;
      if (d.blink) { this.blinkT = (this.blinkT || 0) + dt; if (this.blinkT > 0.38) { this.blinkT = 0; this.audio.blinker(); } }
      if (!tn && K && d.z >= K.zc + K.cw * 0.42) {
        if (d.z > K.zc + K.cw + 3) { K.turned = true; cam.hd += K.dir * 1.1; return; }   // pulou (tecla W)
        this.turning = { k: K, t: 0, swapped: false }; this.audio.skid(); this.audio.whoosh(true);
        this.fx.text(W / 2 + K.dir * 200, 900, K.dir > 0 ? 'VIROU À DIREITA ➜' : '⬅ VIROU À ESQUERDA', '#ffffff', 46, { life: 1.1, vy: -40, rot: 0 });
      }
      if (this.turning) {
        const T = this.turning, k = T.k, A = 0.65, T1 = 0.45, T2 = 0.55;
        T.t += dt;
        d.turnLean = k.dir * 0.42 * Math.sin(Math.PI * U.clamp(T.t / (T1 + T2), 0, 1));
        if (T.t < T1) cam.yaw = k.dir * A * U.easeInCubic(T.t / T1);
        else {
          if (!T.swapped) {
            T.swapped = true; k.turned = true; cam.hd += k.dir * A * 2 * 1.25;
            d.z = Math.max(d.z, k.zc + k.cw + 0.4);
            const R = c.road(d.z), nx = k.dir > 0 ? R * 0.45 : 1.8;
            d.x = d.baseX = d.targetX = nx; this.apLane = nx;
            const P = CAM.ride; cam.z = d.z - P.dist; cam.x = nx * 0.88;
            if (k.dir > 0) this.hud.banner(k.name, 'entrou na rua', '#22c55e', 1.4);
          }
          const u = U.clamp((T.t - T1) / T2, 0, 1);
          cam.yaw = -k.dir * A * (1 - (1 - Math.pow(1 - u, 3)));
          if (u >= 1) { cam.yaw = 0; d.turnLean = 0; this.turning = null; }
        }
      }
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
      if (!this.city) return;
      const d = this.rider, c = this.city;
      for (const o of c.obstacles) o.zPrev = o.z;
      c.update(dt, this.time);
      this.bridge.update(dt, this.mode === 'playing');

      if (this.mode === 'playing') {
        this.roundTime += dt;
        if (this.followQueue.length && (this.followT = (this.followT || 0) - dt) <= 0) { this._follow(this.followQueue.shift()); this.followT = 1.3; }
        this._autoSteer(dt); this._autoReturn(dt);
        const prevZ = d.z;
        d.update(dt, c);
        this._collide(prevZ);
        this._checkArrive();
        this._updateDog(dt);
        this._corners(dt);
        // GPS fala as curvas
        for (const m of c.maneuvers) {
          const key = m.type + m.z;
          if (this.announced.has(key)) continue;
          if (m.type === 'right' && m.z - d.z < 55 && m.z - d.z > 20) { this.announced.add(key); this.say('gps', { index: 0, force: true }); }
          if (m.type === 'left' && m.z - d.z < 14 && m.z - d.z > 0) { this.announced.add(key); this.say('gps', { index: 1, force: true }); }
        }
        this.audio.tempoMul = U.damp(this.audio.tempoMul, d.state === S.RUN || d.state === S.CHASE ? 1.22 : 1, 3, dt);
        this.audio.intensity = d.state === S.RUN || d.state === S.CHASE ? 1 : 0;
        this.audio.setEngine(d.speed, true);
      } else if (this.mode === 'title') {
        this._autoSteer(dt);
        d.update(dt, c); if (d.z > 70) { d.z = 0; }
      } else if (this.mode === 'win') {
        this.sumTime += dt; this.audio.setEngine(0, false);
        if (Math.random() < dt * 4) this.fx.rain(2);
        if (this.countdown > 0) {
          const b = Math.ceil(this.countdown); this.countdown -= dt;
          if (Math.ceil(this.countdown) !== b && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) this.startRound();
        }
      } else if (this.mode === 'gameover') {
        d.update(dt, c); this.overTime += dt; this.audio.setEngine(0, false);
        if (this.overTime > this.cfg.gameOverTime) {
          if (!this._goCount) { this.countdown = this.cfg.restartCountdown * 0.6; this._goCount = true; }
          const b = Math.ceil(this.countdown); this.countdown -= dt;
          if (Math.ceil(this.countdown) !== b && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) { this._goCount = false; this.startRound(); }
        }
      }
      // cliente andando
      const cu = this.cust;
      if (cu) {
        cu.alpha = U.damp(cu.alpha, cu.leaving && Math.abs(cu.x - cu.tx) < 0.1 ? 0 : 1, 5, dt);
        if (cu.walking && cu.tx !== undefined) { const dx = cu.tx - cu.x; cu.x += Math.sign(dx) * Math.min(Math.abs(dx), 1.1 * dt); if (Math.abs(dx) < 0.02) cu.walking = cu.leaving ? false : false; }
        if (cu.leaving && cu.alpha < 0.03) this.cust = null;
      }
      const bo = this.borr;
      if (bo) {
        bo.t += dt;
        if (bo.pose === 'walk') { const dx = bo.tx - bo.x; bo.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.2 * dt); }
        bo.alpha = U.damp(bo.alpha, bo.leaving && Math.abs(bo.tx - bo.x) < 0.3 ? 0 : 1, 5, dt);
        if ((bo.leaving && bo.alpha < 0.03) || bo.z < this.cam.z + 0.5) { this.borr = null; this.borrHead = null; }
      }
      if (this.flyBox) this.flyBox.t += dt / 0.5;
      for (const o of c.obstacles) if (o.hit && !o.passed) o.knock = U.damp(o.knock, 1, 9, dt);
      this._camera(dt);
      this.fx.update(dt); this.hud.update(dt);
    }

    _camera(dt) {
      const d = this.rider, c = this.cam;
      const P = this.chaseDog && !this.chaseDog.giveUp ? CAM.chase : d.state === S.RUN ? CAM.run : d.state === S.STOP || d.state === S.ARRIVE ? CAM.stop : CAM.ride;
      c.F = U.damp(c.F, P.F, 2.5, dt); c.y = U.damp(c.y, P.y, 2.5, dt); c.horizon = U.damp(c.horizon, P.hz, 2.5, dt);
      const tz = d.z - P.dist;
      c.z = U.damp(c.z, tz, tz < c.z ? 9 : 5, dt);
      if (d.z - c.z < 3.0) c.z = d.z - 3.0;
      c.x = U.damp(c.x, d.x * 0.88 + P.side, 2.4, dt);
      this.shake = Math.max(0, this.shake - dt * 45);
      c.sx = (Math.random() - 0.5) * this.shake;
      c.sy = (Math.random() - 0.5) * this.shake + (d.speed > 0.5 && !d.busy ? Math.sin(this.time * 30) * Math.min(1.5, d.speed * 0.1) : 0);
    }

    render() {
      const ctx = this.ctx, c = this.cam, t = this.time;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.city) { this.hud.draw(ctx, t); return; }
      const city = this.city, d = this.rider;
      const tb = this.turning ? Math.sin(Math.PI * U.clamp(this.turning.t / 1, 0, 1)) : 0;
      city.drawSky(ctx, c, t);
      city.drawGround(ctx, c, t);
      const sprites = city.collect(c, t);
      const cr = c.yaw ? Object.assign({}, c, { yaw: 0 }) : c;   // a moto vira junto com a câmera
      sprites.push({ z: d.z, draw: (cx) => d.draw(cx, city, cr) });
      const cu = this.cust;
      if (cu && cu.alpha > 0.02) sprites.push({ z: cu.z, draw: (cx) => {
        const p = city.proj(c, cu.x, 0.15, cu.z); if (!p) return;
        cx.save(); cx.globalAlpha = cu.alpha; CNB.Rider.customer(cx, p.x, p.y, p.s, cu.look, t, cu); cx.restore();
        this.customerHead = { x: p.x, y: p.y - p.s * 1.95 };
      } });
      const bo = this.borr;
      if (bo && bo.alpha > 0.02) sprites.push({ z: bo.z, draw: (cx) => {
        const p = city.proj(c, bo.x, 0, bo.z); if (!p) return;
        cx.save(); cx.globalAlpha = bo.alpha; this.borrHead = CNB.Rider.repairman(cx, p.x, p.y, p.s, t, bo); cx.restore();
      } });
      const dog = this.chaseDog;
      if (dog && dog.z - c.z > 0.8) sprites.push({ z: dog.z, draw: (cx) => { const p = city.proj(cr, dog.x, 0, dog.z); if (p) CNB.Rider.dogChaser(cx, p.x, p.y, p.s, dog.giveUp ? 0 : t, !dog.giveUp); } });
      sprites.sort((a, b) => b.z - a.z);
      for (const s of sprites) { if (tb > 0.2 && s.z !== d.z && s.z - c.z < 7) continue; s.draw(ctx); }   // na virada, some com o que está colado na câmera
      if (tb > 0) { ctx.fillStyle = `rgba(230,240,248,${(tb * 0.28).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
      if (this.turning) { ctx.save(); ctx.globalAlpha = 0.25 * Math.sin(Math.PI * U.clamp(this.turning.t / 1, 0, 1)); ctx.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { const y = 200 + ((i * 137) % 1500); ctx.fillRect(((i * 311 + t * 4000 * -this.turning.k.dir) % 1300 + 1300) % 1300 - 110, y, 220, 3); } ctx.restore(); }
      if (d.state === S.RUN || d.state === S.CHASE) CNB.Effects.speedLines(ctx, W / 2, c.horizon, d.state === S.RUN ? 1 : 0.6, t);
      // caixa voando do baú para o cliente
      if (this.flyBox && this.customerHead) {
        const u = U.clamp(this.flyBox.t, 0, 1), a = d.boxScreen, b = { x: this.customerHead.x, y: this.customerHead.y + 70 };
        const x = U.lerp(a.x, b.x, u), y = U.lerp(a.y, b.y, u) - Math.sin(u * Math.PI) * 160, sz = 70;
        ctx.save(); ctx.translate(x, y); ctx.rotate(u * 6);
        ctx.fillStyle = '#c69c6d'; ctx.fillRect(-sz / 2, -sz / 2, sz, sz); ctx.fillStyle = '#82e8cc'; ctx.fillRect(-8, -sz / 2, 16, sz);
        ctx.restore();
      }
      const vg = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.5, H * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,10,20,0.35)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      this.fx.draw(ctx);
      this.hud.draw(ctx, t);
    }
  }

  CNB.Game = Game;
})();
