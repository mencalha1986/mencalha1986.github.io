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
      this.timers = []; this.followQueue = []; this.borr = null; this.borrHead = null; this.cop = null; this.copHead = null; this.copCarO = null; this.blitzWait = null; this.returning = false; this.followClients = []; this.delivered = [];
      // vozes (áudios gerados)
      this.voiceEls = {}; this.lastLine = {};
      for (const cat in CNB.FALAS || {}) CNB.FALAS[cat].forEach((l) => { const a = new Audio(l.src); a.preload = 'auto'; this.voiceEls[l.src] = a; });
      this.voice = { cfg: this.cfg.voice, stop: () => this._stopVoice(), setMuted: (m) => { this.voiceMuted = m; if (m) this._stopVoice(); } };
      this.setControl(new URLSearchParams(location.search).get('controle') || this.cfg.control);
      this._bind();
      this.catalog.ready.then(() => { this.city = new CNB.City(this.cfg, this.catalog); this.city.onSignal = (k) => this._onSignal(k); this.mode = 'title'; });
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
        if (ev === 'state' && arg === S.STOP && this.stopping) this._deliver();
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
      if (pick.who !== 'g') this.hud.bubble(cat === 'cliente' ? 'cliente' : pick.who === 'b' ? 'borr' : pick.who === 'p' ? 'policia' : 'motoboy', pick.text, pick.dur + 0.6);
      if (!pick.src || !this.cfg.voice.enabled || this.voiceMuted || this.audio.muted) return;
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
      this.chaseDog = null; this.cust = null; this.courier = null; this.rider.dismounted = false; this.stopping = null; this.pendingGift = null; this.flyBox = null;
      // pedidos: um achado do site para cada casa
      const items = this.catalog.items.slice().sort(() => Math.random() - 0.5);
      this.orders = this.city.stops.map((s, i) => ({ stop: s, item: items[i % items.length], stars: 5, client: null }));
      this.announced = new Set();
      this.cam.z = -5; this.cam.x = 0; this.cam.yaw = 0; this.cam.hd = 0; this.turning = null;
      this.audio.intensity = 0; this.audio.tempoMul = 1; this.audio.setMusicLevel(this.cfg.audio.music);
      this.hud.banner(`RODADA ${this.roundNo}`, `saindo do centro de distribuição com ${this.orders.length} entregas`, '#82e8cc', 2.4);
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
      this._blitzEnd(true); this.blitzWait = null;
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
        case 'blitz': this._blitz(user, def); break;
        case 'gameover': this.gameOver(user); break;
      }
    }

    // BLITZ: viatura no acostamento, o PM manda parar, confere a CNH e libera
    _blitz(user, def) {
      const d = this.rider, G = (t, fn) => this.after(t, fn, 'gift');
      if (!this._blitzOk()) { this.blitzWait = [user, def]; this.hud.banner('BLITZ À FRENTE!', `${user} chamou a polícia`, def.color, 1.8); return; }   // ainda no galpão: a blitz espera na rua
      const R = this.city.road(d.z + 6);
      d.force(S.BLITZ); d.waitFix = true;
      const stopZ = d.z + Math.max(1.2, d.speed * 0.32);
      const side = d.x > 0 ? -1 : 1;   // viatura e PM do lado oposto ao da moto, para aparecerem na tela
      this.copCarO = { x: side * (R - 0.9), z: stopZ + 7 };
      this.cop = { x: U.clamp(d.x + side * 1.8, -R + 0.5, R - 0.5), z: stopZ + 3.4, pose: 'stop', alpha: 0, t: 0 };
      this.audio.whistle(); this.after(0.55, () => this.audio.whistle());
      this.hud.banner('BLITZ!', `${user} chamou a polícia`, def.color, 2.2);
      this.fx.doFlash(0.2, '60,110,255');
      G(0.4, () => this.say('policia', { index: 1, force: true }));
      G(1.7, () => this.say('blitz', { index: 0, force: true }));
      G(3.8, () => { if (this.cop) this.cop.pose = 'doc'; this.say('blitz', { index: 1, force: true }); });
      G(5.6, () => this.say('blitz', { index: 2 + Math.floor(Math.random() * 2), force: true }));
      G(7.2, () => { if (this.cop) this.cop.pose = 'go'; this.say('blitz', { index: 4, force: true }); this.audio.chime(); });
      G(8.6, () => { this._blitzEnd(); this.after(0.5, () => this.say('blitz', { index: 5 })); });
      this._penalty(0.5);
    }
    _blitzOk() {   // só em rua reta, longe do galpão e de esquina
      const d = this.rider, m = this.nextManeuver();
      return d.z >= CNB.City.WH_END + 24 && (!m || m.z - d.z > 22) && !d.finished;
    }
    _blitzEnd(silent) {
      if (!this.cop && !this.copCarO) return;
      const d = this.rider;
      if (d.state === S.BLITZ) { d.waitFix = false; }
      if (this.cop) this.cop.leaving = true;
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
        const dz = o.z - d.z; if (o.hit || o.ghost || o.gone || dz < 1 || dz > 40) continue;
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
        d.stopZ = s.z; d.stopSide = s.side || 1; d.force(S.ARRIVE);
        this.stopping = s;
        this.say('gps', { index: 2, force: true });
      }
    }

    _deliver() {
      const s = this.stopping, o = this.orders[s.k], d = this.rider;
      o.client = this._clientName();
      const look = this.city.customers[s.k], sd = s.side || 1, R = ZONE.rua.road * sd, FX = R + ZONE.rua.side * sd;
      this.cust = { x: FX + 0.3 * sd, z: s.z + 0.9, look, walking: false, box: false, wave: false, alpha: 0 };
      const T = (t, fn) => this.after(t, fn, 'stop');
      const meetX = R + 0.15 * sd;
      T(0.1, () => { this.audio.honk(); this.say('chegou', { force: true }); });
      // desce da moto e tira a caixa do baú
      T(0.5, () => { d.dismounted = true; this.courier = { x: d.x + 0.55 * sd, z: d.z - 0.15, walking: false, box: false, face: sd }; this.audio.thud(); });
      T(1.0, () => { this.courier.box = true; this.audio.cardboard(); });
      T(1.2, () => { this.courier.walking = true; this.courier.tx = meetX - 0.5 * sd; this.courier.tz = s.z + 0.5; });
      T(0.8, () => { this.cust.walking = true; this.cust.tx = R + 0.5 * sd; });
      // entrega na mão
      T(2.9, () => {
        const cr = this.courier; cr.walking = false; cr.box = false;
        this.cust.walking = false; this.cust.box = true; s.done = true;
        this.audio.deliver(); this.fx.confetti(this.customerHead ? this.customerHead.x : 700, this.customerHead ? this.customerHead.y : 1100, 50, 0.6);
        this.delivered.push({ item: o.item, client: o.client, num: s.num, stars: o.stars });
        this.hud.showCard({ item: o.item, client: o.client, num: s.num, stars: o.stars });
        this.say('cliente', { force: true });
      });
      T(4.4, () => { this.cust.wave = true; this.say('tchau', { force: true }); });
      // volta e sobe na moto
      T(4.7, () => { const cr = this.courier; cr.walking = true; cr.tx = d.x + 0.55 * sd; cr.tz = d.z - 0.15; });
      T(5.9, () => { this.courier = null; d.dismounted = false; this.audio.thud(); });
      T(6.3, () => {
        this.cust.walking = true; this.cust.tx = FX + 0.6 * sd; this.cust.leaving = true; this.cust.box = true;
        this.stopping = null;
        if (this.city.stops.every((x) => x.done)) { this._goHome(); return; }
        d.force(S.RIDE); this.audio.whoosh(true);
        this._applyPending();
      });
    }

    // depois da última entrega: volta pro galpão pilotando
    _goHome() {
      const d = this.rider;
      this.returning = true;
      d.force(S.RIDE); this.audio.whoosh(true);
      this.hud.banner('ENTREGAS FEITAS!', 'agora é voltar pro galpão', '#82e8cc', 2.4);
      this.after(0.8, () => this.say('voltar', { force: true }));
      this._applyPending();
    }
    _checkHome() {
      const d = this.rider, c = this.city;
      if (!this.returning || d.busy || d.state === S.BACK) return;
      if (d.finished) { if (d.state === S.STOP) { this.returning = false; this.say('galpao', { force: true }); this.audio.honk(); this._endRound(); } return; }
      if (d.z >= c.wh2 + CNB.City.PARK - 12) {
        d.turbo = 0; d.impulse = 0; d.retreat = 0;
        if (d.chase > 0) { d.chase = 0; this._dogGiveUp(); }
        this._blitzEnd(true); this.blitzWait = null;
        d.stopZ = c.wh2 + CNB.City.PARK; d.stopSide = 1; d.force(S.ARRIVE);
        this.hud.banner('DE VOLTA AO GALPÃO!', 'moto estacionada', '#82e8cc', 2);
      }
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
        if (o.hit || o.ghost || o.gone) continue;
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
      const Kq = this.city.nextCorner, queue = (o) => o.vehicle && Kq && o.zone && o.zone.corner === Kq && Kq.zc - d.z < 70 && o.v > 0;
      const obs = this.city.obstacles.filter((o) => !o.hit && !o.ghost && !o.gone && !queue(o) && OB[o.type].w < 50 && o.z - d.z > 1.4 && o.z - d.z < look);
      for (const o of obs) if (o.seen === undefined) o.seen = Math.random() < (fast ? ap.dodgeFast : ap.dodge);
      let pref = this.city.zoneAt(d.z + 8).type === 'rua' ? R * 0.45 : 1.8;
      const K = this.city.nextCorner;
      if (K && K.zc - d.z < 50) pref = K.kind === 'side' ? K.dir * (R - 0.6) : ZONE.rua.road * 0.33;   // fica na faixa (atrás dos carros) para virar   // encosta do lado da conversão
      let best = d.targetX, bestS = -1e9;
      for (let x = -R; x <= R + 1e-6; x += 0.4) {
        let sc = -Math.abs(x - d.x) * 0.9 - Math.abs(x - pref) * (K && K.zc - d.z < 50 ? 1.6 : 0.35);
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
    _corners(dt, prevZ) {
      const d = this.rider, c = this.city, cam = this.cam, K = c.nextCorner, L = c.lastCorner;
      // não dá ré para antes da esquina que já virou
      if (L && d.z < L.zc + L.cw + 0.3) { d.z = L.zc + L.cw + 0.3; d.retreat = 0; }
      const tn = this.turning;
      const near = !!(tn || this.borr || (K && K.kind === 'side' && K.dir > 0 && K.zc - d.z < 34));
      this.guideAlpha = U.damp(this.guideAlpha === undefined ? 1 : this.guideAlpha, near ? 0 : 1, 5, dt);
      d.blink = tn ? tn.k.dir : K && K.zc - d.z < 38 && !d.finished ? K.dir : 0;
      d.speedCap = tn ? 5.5 : K ? 5.5 + Math.max(0, K.zc - d.z) * 0.5 : 99;
      if (!tn && K && !d.finished && this.mode === 'playing') this._signal(K, prevZ);
      if (d.blink) { this.blinkT = (this.blinkT || 0) + dt; if (this.blinkT > 0.38) { this.blinkT = 0; this.audio.blinker(); } }
      if (!tn && K) {
        // curva de verdade: arco de círculo da faixa atual até a faixa certa da rua nova
        const sideK = K.kind === 'side', from = sideK ? ZONE.av : ZONE.rua, E = K.dir * from.road, pc = K.zc + K.cw / 2;
        const laneB = sideK ? ZONE.rua.road * 0.45 : 1.8, zEnd = pc - K.dir * laneB;
        const r = Math.max(sideK ? 4 : (K.dir > 0 ? 4.5 : 6), K.dir * (E - d.x) + 0.6), z0 = zEnd - r;
        if (d.z > K.zc + K.cw + 3) { K.turned = true; cam.hd += K.dir * Math.PI / 2 * 1.25; return; }   // pulou (tecla W)
        if (d.z >= z0) {
          this.turning = { k: K, th: 0, r, x0: d.x, z0, E, pc, laneB, zs: K.zc + K.cw, lag: Math.max(0, (d.z - CAM.ride.dist) - cam.z) };
          d.z = z0; this.audio.skid();
        }
      }
    }

    // semáforo / guarda: espera no vermelho, faz fila atrás dos carros, e se furar o sinal leva bronca
    _signal(K, prevZ) {
      const d = this.rider, c = this.city, sl = c.stopLine(K), wild = d.state === S.RUN || d.state === S.CHASE;
      if (K.zc - d.z > 70 || K.ctl === 'none') return;
      let capZ = Infinity;
      if (K.sig !== 'g' && d.z < sl + 0.4 && !wild && !K.ran) {
        const room = sl - (d.z + 0.9);
        if (K.sig === 'r' || room > d.speed * 0.9 || K.holding) { capZ = sl - 1.0; K.holding = true; }
      }
      if (K.sig === 'g') K.holding = false;
      for (const o of c.obstacles) {
        if (!o.vehicle || o.hit || o.gone || o.ghost || o.v <= 0 || o.zone.corner !== K) continue;
        if (Math.abs(o.x - d.x) < 1.5 && o.z > d.z + 0.5) capZ = Math.min(capZ, o.z - (o.type === 'bus' ? 7 : 4.2));
      }
      if (capZ < Infinity) { const room = capZ - d.z; d.speedCap = Math.min(d.speedCap, room <= 0.05 ? 0 : Math.sqrt(2 * 2.2 * room)); }
      // esperando no sinal
      if (K.sig !== 'g' && d.speed < 0.3 && sl - d.z < 16 && !K.saidWait) {
        K.saidWait = true;
        if (K.ctl === 'police') { this.audio.whistle(); this.say('policia', { index: 1, force: true }); } else if (Math.random() < 0.7) this.say('sinal', { force: true });
      }
      // furou o sinal vermelho
      if (prevZ !== undefined && prevZ + 0.9 < sl && d.z + 0.9 >= sl && K.sig === 'r' && !K.ran) {
        K.ran = true; this._penalty(0.5);
        if (K.ctl === 'police') {
          this.audio.whistle(); this.after(0.35, () => this.audio.whistle());
          this.hud.banner('O GUARDA APITOU!', 'furou o sinal: −½ estrela', '#ff6b6b', 1.8);
          this.after(0.4, () => this.say('policia', { index: 2, force: true }));
        } else {
          this.hud.banner('FUROU O SINAL!', '−½ estrela', '#ff6b6b', 1.6);
          this.after(0.3, () => this.say('furou', { force: true }));
        }
      }
    }
    _onSignal(k) {
      const d = this.rider, near = k.zc - d.z < 70 && k.zc - d.z > -5;
      if (!near || this.mode !== 'playing') return;
      if (k.ctl === 'police' && k.zc - d.z < 50) this.audio.whistle();
      const waiting = d.speed < 0.6 && this.city.stopLine(k) - d.z < 25;
      if (k.sig === 'g' && waiting) {
        if (k.ctl === 'police') this.say('policia', { index: 0, force: true });
        else this.after(0.3, () => this.say('abriu', { force: true }));
      }
    }

    // anda pelo arco; no fim a moto já está na rua nova
    _turnStep(prevZ) {
      const T = this.turning, d = this.rider, c = this.city, k = T.k;
      const ds = Math.max(d.z - prevZ, 2.5 / 60);
      d.z = prevZ; d.retreat = 0;
      T.th = Math.min(Math.PI / 2, T.th + ds / T.r);
      const u = T.th / (Math.PI / 2);
      d.turnLean = k.dir * 0.4 * Math.sin(Math.PI * u);
      if (T.th >= Math.PI / 2) {
        k.turned = true; this.turning = null; d.turnLean = 0;
        const xa = T.x0 + k.dir * T.r, za = T.z0 + T.r;              // ponto final (mundo antigo)
        d.z = T.zs + k.dir * (xa - T.E); d.x = d.baseX = d.targetX = this.apLane = k.dir * (T.pc - za);
        c.adoptTurnTraffic(T, d.z);   // carros da avenida seguem na rua nova, vistos por trás
        const cam = this.cam; cam.turn = null; cam.z = d.z - CAM.ride.dist; cam.x = d.x * 0.88; cam.hd += k.dir * Math.PI / 2 * 1.25;
        if (k.kind === 'side') this.hud.banner(k.name, 'entrou na rua', '#22c55e', 1.4);
      }
    }
    _turnGeom(K) { const from = K.kind === 'side' ? ZONE.av : ZONE.rua; return { k: K, dir: K.dir, E: K.dir * from.road, zs: K.zc + K.cw, pc: K.zc + K.cw / 2 }; }
    // câmera atrás da moto, girando junto
    _turnCam() {
      const T = this.turning, cam = this.cam, k = T.k, d = this.rider;
      const ys = k.dir * T.th, u = T.th / (Math.PI / 2);
      const cx = T.x0 + k.dir * T.r, px = cx - k.dir * T.r * Math.cos(T.th), pz = T.z0 + T.r * Math.sin(T.th);
      const hx = Math.sin(ys), hz = Math.cos(ys), dist = CAM.ride.dist + T.lag * (1 - u);
      const side = U.lerp(-0.12 * T.x0, -0.12 * T.laneB * k.dir, u);   // mesmo enquadramento de antes e depois
      cam.turn = this._turnGeom(k);
      cam.tx = px - dist * hx + side * hz; cam.tz = pz - dist * hz - side * hx; cam.tyaw = ys;
      T.side = side; T.dist = dist;
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
      c.riderZ = this.turning ? this.turning.k.zc : d.z; c.riderV = d.speed;
      c.update(dt, this.time);
      this.bridge.update(dt, this.mode === 'playing');

      if (this.mode === 'playing') {
        this.roundTime += dt;
        if (this.followQueue.length && (this.followT = (this.followT || 0) - dt) <= 0) { this._follow(this.followQueue.shift()); this.followT = 1.3; }
        this._autoSteer(dt); this._autoReturn(dt);
        const prevZ = d.z;
        d.update(dt, c);
        if (this.turning) this._turnStep(prevZ);
        else { this._collide(prevZ); this._checkArrive(); this._checkHome(); }
        this._updateDog(dt);
        this._corners(dt, prevZ);
        // GPS fala as curvas
        for (const m of c.maneuvers) {
          const key = m.type + m.z;
          if (this.announced.has(key)) continue;
          if ((m.type === 'right' || m.type === 'left') && m.z - d.z < 55 && m.z - d.z > 12) { this.announced.add(key); this.say('gps', { index: m.type === 'right' ? 0 : 1, force: true }); }
        }
        this.audio.tempoMul = U.damp(this.audio.tempoMul, d.state === S.RUN || d.state === S.CHASE ? 1.22 : 1, 3, dt);
        this.audio.intensity = d.state === S.RUN || d.state === S.CHASE ? 1 : 0;
        this.audio.setEngine(d.speed, true);
      } else if (this.mode === 'title') {
        this._autoSteer(dt);
        d.update(dt, c); if (d.z > CNB.City.WH_END + 18) { d.z = 0; }
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
      if (this.blitzWait && this.mode === 'playing' && !this.rider.finished && this._blitzOk()) { const bw = this.blitzWait; this.blitzWait = null; this._blitz(...bw); }
      const cp = this.cop;
      if (cp) {
        cp.t += dt; cp.alpha = U.damp(cp.alpha, cp.leaving ? 0 : 1, cp.leaving ? 3 : 6, dt);
        if (cp.leaving) { cp.x = U.damp(cp.x, this.copCarO ? this.copCarO.x - 0.9 : cp.x, 2, dt); cp.pose = 'walk'; }
        if ((cp.leaving && cp.alpha < 0.03) || cp.z < this.cam.z + 0.5) { this.cop = null; this.copHead = null; }
      }
      if (this.copCarO && this.copCarO.z < this.cam.z + 0.6) this.copCarO = null;
      const cr = this.courier;
      if (cr && cr.walking && cr.tx !== undefined) {
        const dx = cr.tx - cr.x, dz = cr.tz - cr.z, dist = Math.hypot(dx, dz), st = Math.min(dist, 1.4 * dt);
        if (dist > 0.01) { cr.x += dx / dist * st; cr.z += dz / dist * st; } else cr.walking = false;
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
      c.x = U.damp(c.x, d.x * 0.88 + P.side * (P === CAM.stop ? (d.stopSide || 1) : 1), 2.4, dt);
      this.shake = Math.max(0, this.shake - dt * 45);
      c.sx = (Math.random() - 0.5) * this.shake;
      c.sy = (Math.random() - 0.5) * this.shake + (d.speed > 0.5 && !d.busy ? Math.sin(this.time * 30) * Math.min(1.5, d.speed * 0.1) : 0);
      const K = this.city.nextCorner;
      if (this.turning && this.mode === 'playing') this._turnCam();
      else if (K && K.zc - d.z < 260 && K.zc - d.z > -12 && this.mode !== 'win') {
        // perto da esquina: mesmo desenho da curva (com a câmera reta) para nada "pular" quando começar a virar
        c.turn = this._turnGeom(K); c.tx = c.x; c.tz = c.z; c.tyaw = 0;
      } else c.turn = null;
    }

    render() {
      const ctx = this.ctx, c = this.cam, t = this.time;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!this.city) { this.hud.draw(ctx, t); return; }
      const city = this.city, d = this.rider;
      city.drawSky(ctx, c, t);
      if (c.turn) {
        // perto da esquina / virando: as duas vias desenhadas juntas; a moto fica no centro
        const T = this.turning, fc = T ? Object.assign({}, c, { turn: null, x: d.x + T.side, z: d.z - T.dist }) : null;
        const ex = [{ d: T ? T.dist : d.z - c.z, draw: () => d.draw(ctx, city, fc || c) }];
        if (!T) for (const s of this._extraSprites(c, t)) ex.push({ d: s.z - c.z, draw: () => s.draw(ctx) });
        city.drawTurn(ctx, c, t, ex);
      } else this._renderWorld(ctx, c, t);
      this._renderTop(ctx, c, t);
    }

    _renderWorld(ctx, c, t) {
      const city = this.city, d = this.rider;
      city.drawGround(ctx, c, t);
      const sprites = city.collect(c, t).concat(this._extraSprites(c, t));
      sprites.push({ z: d.z, draw: (cx) => d.draw(cx, city, c) });
      sprites.sort((a, b) => b.z - a.z);
      for (const s of sprites) s.draw(ctx);
    }

    // cliente, borracheiro e cachorro
    _extraSprites(c, t) {
      const city = this.city, cr = c, sprites = [];
      const cu = this.cust;
      if (cu && cu.alpha > 0.02) sprites.push({ z: cu.z, draw: (cx) => {
        const p = city.proj(c, cu.x, 0.15, cu.z); if (!p) return;
        cx.save(); cx.globalAlpha = cu.alpha; CNB.Rider.customer(cx, p.x, p.y, p.s, cu.look, t, cu); cx.restore();
        this.customerHead = { x: p.x, y: p.y - p.s * 1.95 };
      } });
      const crr = this.courier;
      if (crr) sprites.push({ z: crr.z, draw: (cx) => { const p = city.proj(c, crr.x, 0.15, crr.z); if (p) this.courierHead = CNB.Rider.courier(cx, p.x, p.y, p.s, t, crr); } });
      const bo = this.borr;
      if (bo && bo.alpha > 0.02) sprites.push({ z: bo.z, draw: (cx) => {
        const p = city.proj(c, bo.x, 0, bo.z); if (!p) return;
        cx.save(); cx.globalAlpha = bo.alpha; this.borrHead = CNB.Rider.repairman(cx, p.x, p.y, p.s, t, bo); cx.restore();
      } });
      const cc = this.copCarO;
      if (cc) sprites.push({ z: cc.z, draw: (cx) => { const p = city.proj(c, cc.x, 0, cc.z); if (p) CNB.Rider.copCar(cx, p.x, p.y, p.s, t); } });
      const cop = this.cop;
      if (cop && cop.alpha > 0.02) sprites.push({ z: cop.z, draw: (cx) => {
        const p = city.proj(c, cop.x, 0, cop.z); if (!p) return;
        cx.save(); cx.globalAlpha = cop.alpha; this.copHead = CNB.Rider.cop(cx, p.x, p.y, p.s, t, cop); cx.restore();
      } });
      const dog = this.chaseDog;
      if (dog && dog.z - c.z > 0.8) sprites.push({ z: dog.z, draw: (cx) => { const p = city.proj(cr, dog.x, 0, dog.z); if (p) CNB.Rider.dogChaser(cx, p.x, p.y, p.s, dog.giveUp ? 0 : t, !dog.giveUp); } });
      return sprites;
    }

    _renderTop(ctx, c, t) {
      const city = this.city, d = this.rider;
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
