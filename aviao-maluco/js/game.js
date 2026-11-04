/* =========================================================================
   AVIÃO MALUCO — voo, piloto automático, colisões, presentes, vozes,
   pouso no aeroporto e o caminhão que descarrega os achados
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const PXM = CNB.World.PXM, GY = CNB.World.GY, TOP = CNB.World.TOP;
  const TD = GY - 58;   // altura do avião com as rodas no chão

  class Game {
    constructor(canvas) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.cfg = CNB.CONFIG;
      this.catalog = new CNB.Catalog(this.cfg);
      this.plane = new CNB.Plane(this.cfg);
      this.world = new CNB.World(this.cfg);
      this.audio = new CNB.AudioEngine(this.cfg.audio);
      this.fx = new CNB.Effects();
      this.hud = new CNB.HUD(this);
      this.gifts = new CNB.GiftSystem(this.cfg, (k, def, n, user) => this.applyGift(k, def, n, user));
      this.bridge = new CNB.Bridge(this.gifts, this.cfg);
      this.mode = 'loading'; this.time = 0; this.roundNo = 0; this.roundTime = 0; this.shake = 0;
      this.timers = []; this.followQueue = []; this.feathers = []; this.cargo = []; this.lostItems = []; this.unloaded = [];
      this.voiceEls = {}; this.lastLine = {};
      this.voice = { cfg: this.cfg.voice, stop: () => this._stopVoice(), setMuted: (m) => { this.voiceMuted = m; if (m) this._stopVoice(); } };
      this.setControl(new URLSearchParams(location.search).get('controle') || this.cfg.control);
      this.catalog.ready.then(() => { this.mode = 'title'; });
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    setControl(mode) { this.control = mode === 'manual' ? 'manual' : 'auto'; this.idleManual = 0; if (this.onControl) this.onControl(this.control); }
    // jogador apertou ↑ / espaço / clicou
    playerFlap() {
      if (this.mode !== 'playing') return;
      if (this.control !== 'manual') { this.setControl('manual'); this.hud.banner('MODO MANUAL', 'espaço / ↑ / clique para subir', '#38bdf8', 1.4); }
      this.idleManual = 0;
      if (!this.plane.turbo) { this.plane.flap(); this.audio.whoosh(true); }
    }
    after(sec, fn, tag) { this.timers.push({ t: sec, fn, tag }); }

    // ------------------------------------------------------------ vozes
    _stopVoice() { if (this.voiceNow) this.voiceNow.pause(); }
    say() {}   // este jogo não tem vozes

    // ------------------------------------------------------------ rodada
    start() { if (this.mode !== 'title') return; this.audio.start(); this.startRound(); }
    startRound() {
      this.roundNo++;
      this.world.reset(); this.plane.reset();
      this.gifts.resetRound(); this.fx.clear(); this.timers = []; this.followQueue = [];
      this.mode = 'playing'; this.roundTime = 0; this.sumTime = -1; this.countdown = 0; this.overTime = 0;
      this.truck = null; this.worker = null; this.flyCrate = null; this.unloaded = []; this.lostItems = []; this.retaFinal = false; this.landingSaid = false;
      const items = this.catalog.items.slice().sort(() => Math.random() - 0.5);
      this.cargo = Array.from({ length: this.cfg.crates }, (_, i) => items[i % Math.max(1, items.length)]).filter(Boolean);
      this.apTarget = null; this.passed = 0; this.helpM = 0; this.sabM = 0; this.combo = 0; this.comboT = -9; this.jet = null; this.likeAcc = 0; this.vulture = null; this.missile = null; this.debris = null; this.crashed = false; this.feathers = []; this.newRecord = false;
      try { this.record = parseFloat(localStorage.getItem('am-record')) || 0; } catch (e) { this.record = 0; }
      this.audio.intensity = 0; this.audio.tempoMul = 1; this.audio.setMusicLevel(this.cfg.audio.music);
      this.hud.banner(`VOO ${this.roundNo}`, `${this.cargo.length} caixas de achados até o aeroporto!`, '#82e8cc', 2.4);
      this.after(1.0, () => this.say('partida', { force: true }));
    }

    // ------------------------------------------------------------ presentes
    cancelCurrentAction() {
      const p = this.plane;
      p.turbo = 0; p.impulse = 0; p.engine = 0; p.wind = 0;
      if (this.jet && this.jet.phase !== 'out') this.jet.phase = 'out';
      if (this.vulture && !this.vulture.hitDone) this.vulture.flee = true;
      if (p.loop > 0) { p.loop = 0; p.ang = 0; p.vy = 0; }
      for (const b of this.world.birds) { b.v = -500; b.ty = b.y - 600; b.flee = true; }   // urubus vão embora
      this.timers = this.timers.filter((tm) => tm.tag !== 'gift');
      this.fx.clearTag('gift'); this.hud.clearBanners();
    }
    applyGift(key, def, n, user) {
      const p = this.plane, head = p.headScreen || { x: 420, y: 900 };
      if (this.mode !== 'playing') { this.audio.gift(0); return; }
      if (def.action === 'follow') { this.followQueue.push(user); return; }
      if (def.action === 'likes') {   // a cada X curtidas o avião anda um pouco
        this.likeAcc = (this.likeAcc || 0) + n;
        while (this.likeAcc >= def.every) { this.likeAcc -= def.every; p.impulse += def.amount; this.helpM += def.amount; this.fx.text(U.clamp(head.x, 200, 880), head.y - 80, `❤ ${def.every} curtidas +${def.amount} m`, def.color, 34, { life: 1.4, vy: -60 }); }
        return;
      }
      if (def.action === 'shield') {   // escudo não cancela nada
        p.shield = Math.max(p.shield || 0, def.duration * n); this.audio.chime(); this.fx.doFlash(0.2, '120,230,255');
        this.hud.banner('ESCUDO!', `${user} protegeu o avião por ${Math.round(p.shield)}s (até de míssil)`, def.color, 2);
        return;
      }
      this.cancelCurrentAction();   // o último presente manda
      // COMBO: presentes seguidos deixam o próximo mais forte
      this.combo = this.time - this.comboT < this.cfg.combo.window ? this.combo + 1 : 1; this.comboT = this.time;
      const mul = this.comboMul();
      if (this.combo >= 3 && this.combo % 2 === 1) this.audio.chime();
      this.fx.text(U.clamp(head.x, 200, 880), head.y - 120, user, def.color, 30, { life: 1.6, vy: -70, rot: 0, tag: 'gift' });
      switch (def.action) {
        case 'advance':
          p.impulse = Math.round(def.amount * n * mul); this.helpM += p.impulse; this.audio.gift(def.amount >= 100 ? 1 : 0);
          this.fx.text(head.x + 60, head.y - 40, `+${p.impulse} m`, '#7CFC9A', 52, { tag: 'gift' });
          if (def.amount >= 100) this.hud.banner('ACELERA!', `${user} encheu o tanque`, def.color, 1.5);
          if (Math.random() < 0.5) this.after(0.3, () => this.say('go'), 'gift');
          break;
        case 'turbo':
          // um caça chega, engata o cabo e reboca o avião bem rápido (Money Gun: esquadrilha com 3 caças)
          p.turbo = def.duration * n * mul; this.jet = { x: W + 260, y: p.y - 60, name: user, phase: 'in', t: 0, squad: def.duration >= 12 };
          this.helpM += Math.round(p.turbo * (this.cfg.turboSpeed - this.cfg.cruiseSpeed));
          this.audio.turbo(); this.fx.doFlash(0.25, '255,220,80'); this.shake = 12;
          this.hud.banner(def.duration >= 12 ? 'ESQUADRILHA!' : 'CAÇA NA ÁREA!', `${user} mandou rebocar o avião`, def.color, 1.9);
          break;
        case 'birds':
          // um urubu grandão vem direto no avião e PÁ! empurra pra trás
          this.vulture = { x: W + 160, y: p.y - 80, ph: 0, name: user, back: Math.round((def.amount || 50) * mul), color: def.color };
          this.audio.growl && this.audio.growl();
          this.hud.banner('URUBU!', `${user} mandou um urubu`, def.color, 1.5);
          this.after(0.5, () => this.say('urubu', { force: true }), 'gift');
          break;
        case 'wind':
          p.wind = def.amount * mul / 20; this.sabM += def.amount * mul; this.audio.whoosh(false); this.shake = 14;
          this.hud.banner('VENTO CONTRA!', `${user} empurrou o avião ${def.amount} m pra trás`, def.color, 1.9);
          this.after(0.5, () => this.say('vento', { force: true }), 'gift');
          break;
        case 'engine':
          p.engine = def.duration * n; p.engineBack = def.amount * mul / p.engine; this.sabM += def.amount * mul; this.audio.crash(); this.shake = 10;
          this.hud.banner('PANE NO MOTOR!', `${user} fez o avião voltar ${Math.round(def.amount * mul)} m`, def.color, 1.9);
          this.after(0.4, () => this.say('pane', { force: true }), 'gift');
          break;
        case 'loop':
          p.loop = 1.6; p.loopT = 0; this.audio.whoosh(true);
          this.hud.banner('LOOPING!', `${user} pediu manobra radical`, def.color, 1.6);
          this.say('looping', { force: true });
          break;
        case 'gameover': this._missile(user); break;
      }
    }
    comboMul() { const c = this.cfg.combo; return Math.min(c.max, 1 + Math.max(0, this.combo - 1) * c.step); }

    _follow(user) {
      const w = this.world, p = this.plane, items = this.catalog.items;
      w.chutes.push({ x: w.x + 160, y: p.y + 40, name: user, item: items.length ? U.choice(items) : null, catalog: this.catalog, seed: Math.random() });
      this.audio.chime(); this.fx.confetti(p.x, p.y, 40, 0.6);
      this.hud.banner('NOVO SEGUIDOR!', `caixa de paraquedas para ${user}`, '#fe2c55', 2.4);
      this.after(0.6, () => this.say('seguidor', { force: true }));
    }

    // ------------------------------------------------------------ perdeu carga
    _loseCrate(reason) {
      const p = this.plane, w = this.world;
      p.inv = 2;
      this.audio.crash(); this.shake = 20; this.fx.sparks(p.x + 60, p.y, 20, '#ffd23f');
      if (p.shield > 0) { this.audio.pop(); this.fx.sparks(p.x + 60, p.y, 24, '#22d3ee'); this.fx.text(p.x + 40, p.y - 90, 'ESCUDO!', '#22d3ee', 56, { life: 1 }); p.inv = 1.2; return; }
      if (!this.cargo.length) { this.hud.banner(reason, 'sem carga pra perder!', '#ff6b6b', 1.4); return; }
      const item = this.cargo.pop(); this.lostItems.push(item);
      w.lost.push({ x: w.x - 40, y: p.y + 20, vx: -80, vy: -350, rot: 0, vr: U.rand(-6, 6), item });
      this.hud.banner(reason, `caiu: ${U.truncate(item.short, 26)}`, '#ff6b6b', 1.8);
      this.after(0.5, () => this.say('bateu', { force: true }));
    }

    _collide() {
      const p = this.plane, w = this.world;
      if (p.y > GY - 46 && !p.landed && !p.dead) {
        p.y = GY - 46; p.vy = -720;
        if (!p.ghost) { this._loseCrate('BATEU NO CHÃO!'); this.after(0.9, () => this.say('chao')); }
        this.fx.dust(p.x, GY, 16, 1.4);
      }
      if (p.y < TOP - 60) { p.y = TOP - 60; p.vy = Math.max(p.vy, 0); }
      if (p.ghost) return;
      const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
      const pts = [[105, 0, 20], [40, -4, 32], [-30, 0, 30], [-100, -30, 18]].map(([dx, dy, r]) => ({ x: w.x + dx * ca - dy * sa, y: p.y + dx * sa + dy * ca, r }));
      for (const o of w.obstacles) {
        if (Math.abs(o.x - w.x) > 420) continue;
        for (const R of w.rects(o)) for (const c of pts) {
          const nx = U.clamp(c.x, R.x0, R.x1), ny = U.clamp(c.y, R.y0, R.y1);
          if ((nx - c.x) ** 2 + (ny - c.y) ** 2 < c.r * c.r) {
            o.hit = true; p.vy = c.y < o.gy ? 380 : -560;
            this._loseCrate(o.top === 'balao' && c.y < o.gy ? 'BATEU NO BALÃO!' : c.y < o.gy ? 'BATEU LÁ EM CIMA!' : 'BATEU NO PRÉDIO!');
            return;
          }
        }
      }
      for (const b of w.birds) {
        if (b.hit || b.flee) continue;
        if (Math.abs(b.x - w.x) < 90 && Math.abs(b.y - p.y) < 50) { b.hit = true; b.v = -300; this.fx.text(p.x + 40, p.y - 60, 'QUAAA!', '#fff', 44, { life: 1 }); this._loseCrate('ATROPELOU UM URUBU!'); return; }
      }
    }

    // ------------------------------------------------------------ piloto automático
    _autopilot(dt) {
      const p = this.plane, w = this.world, cfg = this.cfg;
      if (p.loop > 0 || p.landed || p.dead) return;
      const manual = this.control === 'manual' && !p.turbo && this.mode === 'playing';
      if (manual) return;
      let ty = 1000;
      // mira o vão do PRÓXIMO obstáculo, mas sem sair do vão do que está passando agora
      const next = w.obstacles.find((o) => o.x - o.w / 2 >= w.x + 170);
      const cur = w.obstacles.filter((o) => o.x + o.w / 2 > w.x - 150 && o.x - o.w / 2 < w.x + 170);
      if (this.mode === 'landing') ty = this.glideY;
      else if (next) {
        if (next.err === undefined) next.err = p.turbo ? 0 : Math.random() > cfg.autopilot.skill ? U.rand(-0.42, 0.42) * next.gap : U.rand(-0.08, 0.08) * next.gap;
        const dx = next.x - w.x;
        ty = next.gy + (p.turbo ? 0 : next.err);
        if (dx > 900) ty = U.lerp(ty, 1000, U.clamp((dx - 900) / 600, 0, 0.6));
      }
      for (const o of cur) if (o !== next) ty = U.clamp(ty, o.gy - o.gap / 2 + 110, o.gy + o.gap / 2 - 100);
      // desvia dos urubus
      for (const b of w.birds) if (!b.flee && !b.hit && b.x - w.x < 520 && b.x - w.x > -60 && Math.abs(b.y - ty) < 130) ty = b.y > ty ? b.y - 170 : b.y + 170;
      ty = U.clamp(ty, TOP + 30, GY - 90); this._ty = ty;
      this.apT = (this.apT || 0) - dt;
      if (this.apT > 0) return;
      this.apT = 0.05;
      const g = p.engine > 0 ? 1900 : 1450, look = 0.08, yP = p.y + p.vy * look + 0.5 * g * look * look;
      if (yP > ty + 40 && p.vy > -120) p.flap();
    }

    // ------------------------------------------------------------ fim de jogo / pouso
    // GALÁXIA: um míssil vem e explode o avião
    _missile(user) {
      const p = this.plane;
      this.missile = { x: W + 120, y: Math.max(TOP, p.y - 420), t: 0, name: user };
      this.audio.whoosh(false); this.hud.banner('MÍSSIL!', `${user} mandou um míssil`, '#ef4444', 1.6);
      this.mode = 'missile';
    }
    _explode() {
      const p = this.plane, m = this.missile;
      if (p.shield > 0) {   // o escudo segura o míssil!
        this.missile = null; this.mode = 'playing'; p.shield = 0; this.shake = 26; this.audio.crash();
        this.fx.doFlash(0.6, '120,230,255'); this.fx.sparks(p.x + 40, p.y, 50, '#22d3ee'); this.fx.text(p.x + 40, p.y - 120, 'BLOQUEADO!', '#22d3ee', 90, { life: 1.6, vy: -60 });
        this.hud.banner('O ESCUDO SEGUROU O MÍSSIL!', m ? `${m.name} errou o alvo` : '', '#22d3ee', 2.4); return;
      }
      this.missile = null; this.audio.crash(); this.audio.thud(); this.shake = 40;
      this.fx.doFlash(0.9, '255,200,120'); this.fx.sparks(p.x, p.y, 60, '#ffb020'); this.fx.sparks(p.x, p.y, 40, '#ff4d4d');
      this.fx.text(p.x + 40, p.y - 120, 'KABUM!', '#ffd23f', 110, { life: 1.6, vy: -60 });
      for (let i = 0; i < 26; i++) this.world.puffs.push({ x: this.world.x + U.rand(-90, 90), y: p.y + U.rand(-50, 50), vx: U.rand(-160, 160), vy: U.rand(-200, 40), r: U.rand(20, 46), age: 0, life: U.rand(1.2, 2.6), a: 0.85, c: i % 3 ? '70,70,70' : '255,150,40' });
      this.debris = Array.from({ length: 9 }, (_, i) => ({ x: p.x, y: p.y, vx: U.rand(-380, 380), vy: U.rand(-700, -150), rot: 0, vr: U.rand(-9, 9), k: i }));
      this.gameOver(m ? m.name : '');
    }
    gameOver(user) {
      const p = this.plane;
      this.cancelCurrentAction(); this.timers = this.timers.filter((tm) => tm.tag !== 'gift');
      p.dead = true; p.exploded = true; p.turbo = 0; this.overBy = user; this.jet = null;
      this.mode = 'gameover'; this.overTime = 0; this.countdown = 0; this._goCount = false; this.crashed = false;
      this.audio.setMusicLevel(this.cfg.audio.music * 0.3, 1); this.audio.sadTrombone();
      this.after(0.6, () => this.say('gasolina', { force: true }));
    }
    _startLanding() {
      this.mode = 'landing'; this.glideY = this.plane.y;
      this.hud.banner('RETA FINAL', 'preparar para o pouso!', '#82e8cc', 2);
      this.say('torre', { index: 0, force: true });
      this.after(2.6, () => this.say('retafinal', { force: true }));
    }
    _touchdown() {
      const p = this.plane;
      p.landed = true; p.y = TD; p.vy = 0;
      this.audio.thud(); this.shake = 12; this.fx.dust(p.x - 20, GY, 22, 1.6); this.fx.dust(p.x + 60, GY, 12, 1);
    }
    _arrived() {
      this.mode = 'unload'; this.unloaded = [];
      this.audio.fanfare(); this.fx.confetti(540, 700, 90, 0.8);
      this.hud.banner('POUSOU!', 'missão cumprida — chegou o caminhão', '#82e8cc', 2.4);
      this.plane.doorOpen = 0;
      // caminhão vem de ré até perto do avião; o ajudante desce e leva caixa por caixa
      this.truck = { x: W + 360, tx: 800, open: 0, wheel: 0, phase: 'in', cabDoor: 0 };
      this.worker = null;
      const T = (t, fn) => this.after(t, fn, 'unload');
      for (let i = 0; i < 6; i++) T(1.2 + i * 0.45, () => this.audio.beep());
      T(3.4, () => { this.truck.phase = 'open'; this.plane.doorTarget = 1; this.audio.cardboard(); });
      T(3.9, () => { this.truck.cabDoorT = 1; this.audio.thud(); });
      T(4.3, () => { this.worker = { x: this.truck.x + 150, dir: -1, state: this.cargo.length ? 'toPlane' : 'toCab', carry: null, t: 0, walk: 0 }; this.truck.cabDoorT = 0; });
    }
    // ajudante: vai até a porta do avião, pega a caixa, leva até o baú do caminhão
    _updateWorker(dt) {
      const w = this.worker, tr = this.truck, p = this.plane; if (!w || !tr) return;
      const doorX = p.x - 112, rearX = tr.x - 196, cabX = tr.x + 150, sp = 360;
      const go = (tx) => { const d = tx - w.x; w.dir = Math.sign(d) || w.dir; w.x += Math.sign(d) * Math.min(Math.abs(d), sp * dt); w.walk += dt * 9; return Math.abs(d) < 2; };
      w.t += dt;
      if (w.state === 'toPlane' && go(doorX)) { w.state = 'pick'; w.t = 0; }
      else if (w.state === 'pick' && w.t > 0.25) {
        w.carry = this.cargo.shift(); this.audio.cardboard(); w.state = 'toTruck';
        if (w.carry) this.hud.showCard({ item: w.carry, n: this.unloaded.length + 1, total: this.unloaded.length + 1 + this.cargo.length });
      }
      else if (w.state === 'toTruck' && go(rearX)) { w.state = 'drop'; w.t = 0; }
      else if (w.state === 'drop' && w.t > 0.22) {
        if (w.carry) { this.unloaded.push(w.carry); this.audio.pop(); }
        w.carry = null; w.state = this.cargo.length ? 'toPlane' : 'toCab';
      }
      else if (w.state === 'toCab' && go(cabX)) {
        this.worker = null; tr.cabDoorT = 1; this.audio.thud(); tr.phase = 'close'; this.plane.doorTarget = 0;
        const T = (t, fn) => this.after(t, fn, 'unload');
        T(0.5, () => { tr.cabDoorT = 0; });
        T(1.0, () => { this.audio.honk(); this.after(0.4, () => this.audio.honk(), 'unload'); tr.phase = 'out'; });
        T(2.8, () => this._summary());
      }
    }
    _summary() {
      this.mode = 'win'; this.finalTime = this.roundTime; this.sumTime = 0;
      if (!this.record || this.finalTime < this.record) { this.newRecord = true; this.record = this.finalTime; try { localStorage.setItem('am-record', String(this.finalTime)); } catch (e) {} }
      this.audio.cheer(); this.audio.setMusicLevel(this.cfg.audio.music * 1.4, 1);
      const burst = () => { this.fx.confetti(80, 1500, 80, 0.7); this.fx.confetti(1000, 1500, 80, 0.7); this.audio.pop(); };
      burst(); this.after(0.8, burst); this.after(1.8, burst);
      this.after(this.cfg.summaryTime, () => { this.countdown = this.cfg.restartCountdown; });
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
      const p = this.plane, w = this.world, cfg = this.cfg;
      this.bridge.update(dt, this.mode === 'playing');
      if (this.mode === 'title') {
        p.update(dt); this._titleFly(dt);
      } else if (this.mode === 'playing' || this.mode === 'landing') {
        this.roundTime += dt;
        if (this.followQueue.length && (this.followT = (this.followT || 0) - dt) <= 0) { this._follow(this.followQueue.shift()); this.followT = 1.3; }
        if (this.mode === 'playing' && this.control === 'manual' && cfg.autopilot.returnAfter) {
          this.idleManual = (this.idleManual || 0) + dt;
          if (this.idleManual > cfg.autopilot.returnAfter) { this.setControl('auto'); this.hud.banner('PILOTO AUTOMÁTICO', 'espaço / ↑ / clique para pilotar', '#38bdf8', 1.4); }
        }
        // velocidade
        p.turbo = Math.max(0, p.turbo - dt); p.engine = Math.max(0, p.engine - dt); p.shield = Math.max(0, (p.shield || 0) - dt);
        let target = p.impulse > 0 ? cfg.boostSpeed : cfg.cruiseSpeed;
        if (p.turbo > 0) target = this.jet && this.jet.phase === 'tow' ? cfg.turboSpeed : Math.max(target, cfg.boostSpeed);
        if (p.engine > 0) target = -(p.engineBack || 8);
        if (p.wind > 0) { p.wind -= dt; target = -20; }
        if (this.mode === 'landing') {
          const left = Math.max(0, (w.goalX - w.x) / PXM);
          target = Math.min(cfg.cruiseSpeed * 1.3, Math.max(p.landed ? 0 : 3, Math.sqrt(2 * 1.6 * left)));
          if (left < 0.05 && p.landed) { p.speed = 0; w.x = w.goalX; this._arrived(); }
        }
        p.speed = U.damp(p.speed, target, p.wind > 0 ? 6 : 2.5, dt);
        const dx = p.speed * PXM * dt;
        if (this.mode === 'landing') w.x = Math.min(w.goalX, w.x + dx); else w.x = Math.max(0, w.x + dx);
        if (p.impulse > 0 && p.speed > 0) p.impulse = Math.max(0, p.impulse - p.speed * dt);
        // planando para a pista
        if (this.mode === 'landing' && !p.landed) {
          const left = (w.goalX - w.x) / PXM;
          this.glideY = U.clamp(TD - Math.max(0, left - 30) * 9, TOP + 60, TD);
          p.wheels = U.damp(p.wheels, 1, 3, dt);
          p.vy = (this.glideY + 8 - p.y) * 2.2; p.y += p.vy * dt; p.ang = U.damp(p.ang, U.clamp(p.vy * 0.0008, -0.15, 0.2), 5, dt);
          if (p.y >= TD - 1 && left < 32) this._touchdown();
        } else if (this.mode === 'playing') {
          this._autopilot(dt); p.update(dt); this._collide();
        } else p.update(dt);
        if (this.mode === 'playing' && !this.retaFinal && w.left < 150) { this.retaFinal = true; this.hud.banner('RETA FINAL', `${w.left} metros pro pouso`, '#82e8cc', 1.8); }
        if (this.mode === 'playing' && w.left <= 62 && p.loop <= 0) { this.cancelCurrentAction(); this._startLanding(); }
        w.spawn();
        const vu = this.vulture;
        if (vu) {
          vu.ph += dt * 10;
          if (vu.hitDone || vu.flee) { vu.x += (vu.flee ? 900 : -300) * dt; vu.y -= 420 * dt; vu.spin = (vu.spin || 0) + dt * 8; if (vu.y < -200 || vu.x > W + 300) this.vulture = null; }
          else {
            const tx = p.x + 90, ty = p.y, dx = tx - vu.x, dy = ty - vu.y, d = Math.hypot(dx, dy);
            vu.x += dx / d * 820 * dt; vu.y += dy / d * 820 * dt;
            if (d < 70) {
              vu.hitDone = true; p.wind = vu.back / 20; this.sabM += vu.back; p.vy = -200;
              this.audio.crash(); this.audio.thud(); this.shake = 22;
              this.fx.text(p.x + 90, p.y - 90, 'PÁ!', '#fff', 90, { life: 1.1, vy: -80, rot: -0.1 });
              this.fx.text(p.x + 40, p.y - 170, `−${vu.back} m`, '#ff8a8a', 56, { life: 1.4, vy: -60 });
              this.fx.sparks(p.x + 90, p.y, 10, '#2b2b2f');
              for (let i = 0; i < 34; i++) { const a = Math.random() * Math.PI * 2, v = U.rand(120, 520); this.feathers.push({ x: p.x + 90, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, rot: Math.random() * 6, vr: U.rand(-5, 5), age: 0, life: U.rand(2.2, 3.8), s: U.rand(0.7, 1.5), c: Math.random() < 0.8 ? '#26262b' : '#4b4b52' }); }
              this.hud.banner('BATEU NO URUBU!', `o avião voltou ${vu.back} m`, vu.color, 1.8);
            }
          }
        }
        const jt = this.jet;
        if (jt) {
          jt.t += dt;
          const tx = p.x + 380, ty = p.y - 50;
          if (jt.phase === 'in') { jt.x = U.damp(jt.x, tx, 4, dt); jt.y = U.damp(jt.y, ty, 5, dt); if (Math.abs(jt.x - tx) < 12) { jt.phase = 'tow'; this.audio.pop(); } }
          else if (jt.phase === 'tow') { jt.x = tx + Math.sin(this.time * 3) * 6; jt.y = U.damp(jt.y, ty, 8, dt); if (p.turbo <= 0) jt.phase = 'out'; }
          else { jt.x += 1600 * dt; jt.y -= 500 * dt; if (jt.x > W + 400) this.jet = null; }
        }
        if (p.engine > 0 && Math.random() < dt * 30) w.puffs.push({ x: w.x + 100, y: p.y - 10, vx: -60, vy: -40, r: 14, age: 0, life: 1.4, a: 0.7, c: '60,60,60' });
        if (p.turbo > 0 && Math.random() < dt * 40) w.puffs.push({ x: w.x - 120, y: p.y + U.rand(-8, 8), vx: -200, vy: 0, r: 10, age: 0, life: 0.5, a: 0.8, c: '255,190,60' });
        this.audio.setEngine(this.mode === 'landing' && p.landed ? 0.5 : 3 + p.speed * 0.5, true);
        this.audio.intensity = p.turbo > 0 ? 1 : 0; this.audio.tempoMul = U.damp(this.audio.tempoMul, p.turbo > 0 ? 1.22 : 1, 3, dt);
      } else if (this.mode === 'missile') {
        const m = this.missile; p.update(dt); this._autopilot(dt);
        if (m) { m.t += dt; const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), v = 1500; m.x += dx / d * v * dt; m.y += dy / d * v * dt; m.ang = Math.atan2(dy, dx);
          if (Math.random() < 0.9) w.puffs.push({ x: w.x + m.x - p.x, y: m.y, vx: 0, vy: -20, r: 12, age: 0, life: 0.9, a: 0.6, c: '220,220,220' });
          if (d < 60) this._explode(); }
        w.x += p.speed * PXM * dt;
      } else if (this.mode === 'unload') {
        p.update(dt);
        const tr = this.truck;
        if (tr) {
          if (tr.phase === 'in') { const d = tr.tx - tr.x; tr.x += Math.sign(d) * Math.min(Math.abs(d), Math.max(60, Math.abs(d) * 1.6) * dt); tr.wheel -= dt * 4; }
          if (tr.phase === 'open') tr.open = U.damp(tr.open, 1, 6, dt);
          if (tr.phase === 'close') tr.open = U.damp(tr.open, 0, 6, dt);
          if (tr.phase === 'out') { tr.v = (tr.v || 0) + 600 * dt; tr.x += tr.v * dt; tr.wheel += dt * 8; }
        }
        tr && (tr.cabDoor = U.damp(tr.cabDoor || 0, tr.cabDoorT || 0, 10, dt));
        p.doorOpen = U.damp(p.doorOpen || 0, p.doorTarget || 0, 5, dt);
        this._updateWorker(dt);
        this.audio.setEngine(0, false);
      } else if (this.mode === 'win') {
        this.sumTime += dt; this.audio.setEngine(0, false);
        if (this.countdown > 0) {
          const b = Math.ceil(this.countdown); this.countdown -= dt;
          if (Math.ceil(this.countdown) !== b && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) this.startRound();
        }
      } else if (this.mode === 'gameover') {
        this.overTime += dt;
        p.speed = U.damp(p.speed, p.y >= GY - 50 ? 0 : 3, 1.5, dt); w.x += p.speed * PXM * dt;
        p.speed = 0;
        for (const d of this.debris || []) { if (d.y < GY - 14) { d.vy += 1300 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; } else { d.y = GY - 14; if (!d.down) { d.down = true; this.fx.dust(d.x, GY, 6, 0.8); } } }
        if (Math.random() < dt * 6) { const d = U.choice(this.debris || [{ x: p.x, y: GY }]); w.puffs.push({ x: w.x + d.x - p.x, y: d.y - 10, vx: -10, vy: -70, r: 14, age: 0, life: 2, a: 0.45, c: '60,60,60' }); }
        this.audio.setEngine(0, false);
        if (this.overTime > this.cfg.gameOverTime) {
          if (!this._goCount) { this.countdown = this.cfg.restartCountdown * 0.6; this._goCount = true; }
          const b = Math.ceil(this.countdown); this.countdown -= dt;
          if (Math.ceil(this.countdown) !== b && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) { this._goCount = false; this.startRound(); }
        }
      }
      for (const f of this.feathers) { f.age += dt; f.vx *= Math.pow(0.12, dt); f.vy = f.vy * Math.pow(0.15, dt) + 60 * dt; f.x += (f.vx - 30) * dt + Math.sin(f.age * 4 + f.rot) * 40 * dt; f.y += f.vy * dt + 25 * dt; f.rot += f.vr * dt * Math.max(0.2, 1 - f.age / 2); }
      this.feathers = this.feathers.filter((f) => f.age < f.life);
      w.update(dt, this.time, p.y);
      this.shake = Math.max(0, this.shake - dt * 45);
      this.fx.update(dt); this.hud.update(dt);
    }
    // na tela inicial o avião voa sozinho em ondas
    _titleFly(dt) {
      const p = this.plane, w = this.world;
      w.x += 6 * PXM * dt;
      if (p.y > 980 + Math.sin(this.time) * 120) p.flap(0.8);
    }

    render() {
      const ctx = this.ctx, t = this.time, p = this.plane, w = this.world;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (this.mode === 'loading') { this.hud.draw(ctx, t); return; }
      const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
      ctx.save(); ctx.translate(sx, sy);
      const camX = w.x - p.x;
      w.draw(ctx, t, camX, { catalog: this.catalog });
      // caminhão e caixa voando
      if (this.truck) CNB.drawTruck(ctx, this.truck.x, GY + 4, this.truck.open, t, this.truck.wheel, this.truck.cabDoor || 0);
      if (this.worker) CNB.drawWorker(ctx, this.worker, GY + 4, t, this.catalog);
      if (this.jet) this._drawJet(ctx, t);
      for (const f of this.feathers) {
        ctx.save(); ctx.globalAlpha = U.clamp((f.life - f.age) / 0.6, 0, 1); ctx.translate(f.x, f.y); ctx.rotate(f.rot + Math.sin(f.age * 5) * 0.5); ctx.scale(f.s, f.s);
        ctx.fillStyle = f.c; ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(9, -4, 0, 18); ctx.quadraticCurveTo(-9, -4, 0, -18); ctx.fill();
        ctx.strokeStyle = 'rgba(200,200,200,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 22); ctx.stroke();
        ctx.restore();
      }
      if (this.vulture) { const v = this.vulture; ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(v.spin || 0); ctx.scale(1.9, 1.9); w._bird(ctx, 0, 0, v.ph); ctx.restore();
        if (!v.hitDone) { ctx.font = `800 24px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = '#e5e7eb'; ctx.strokeText(v.name, v.x, v.y - 70); ctx.fillText(v.name, v.x, v.y - 70); } }
      if (!p.exploded && (this.mode !== 'win' || this.sumTime < 0.4)) p.draw(ctx, t);
      if (p.exploded) for (const d of this.debris || []) { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); ctx.fillStyle = ['#f8fafc', '#82e8cc', '#2a9d8f', '#cfd8dc', '#475569'][d.k % 5]; U.poly(ctx, [-26, -10, 22, -14, 28, 8, -18, 14]); ctx.fill(); ctx.restore(); }
      if (this.missile) { const m = this.missile; ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.ang || Math.PI); ctx.fillStyle = '#e5e7eb'; U.roundRect(ctx, -46, -9, 80, 18, 9); ctx.fill(); ctx.fillStyle = '#ef4444'; U.poly(ctx, [34, -9, 52, 0, 34, 9]); ctx.fill(); ctx.fillStyle = '#6b7280'; U.poly(ctx, [-46, -9, -58, -22, -36, -9]); ctx.fill(); U.poly(ctx, [-46, 9, -58, 22, -36, 9]); ctx.fill(); ctx.fillStyle = `rgba(255,${150 + Math.random() * 80},40,0.9)`; ctx.beginPath(); ctx.ellipse(-60, 0, 18 + Math.random() * 8, 7, 0, 0, 7); ctx.fill(); ctx.restore();
        ctx.font = `800 24px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 6; ctx.strokeText(m.name, m.x, m.y - 30); ctx.fillText(m.name, m.x, m.y - 30); }
      if (this.flyCrate) {
        const f = this.flyCrate, u = U.clamp(f.t, 0, 1);
        const x = U.lerp(f.from.x, f.to.x, u), y = U.lerp(f.from.y, f.to.y, u) - Math.sin(u * Math.PI) * 170;
        w._crate(ctx, x, y, 60, u * 5, f.item, this.catalog);
      }
      // vento: riscos voando para trás
      if (p.wind > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; for (let i = 0; i < 24; i++) { const y = 420 + ((i * 263) % 1250), x = ((i * 377 + t * 2600) % 1400) - 200; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 140, y); ctx.stroke(); } }
      if (p.turbo > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineCap = 'round'; for (let i = 0; i < 14; i++) { const y = p.y - 220 + ((i * 97) % 440), x = W - ((i * 331 + t * 2400) % (W + 300)); ctx.lineWidth = 2 + (i % 3); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 120 + (i % 4) * 40, y); ctx.stroke(); } }
      ctx.restore();
      this.fx.draw(ctx);
      this.hud.draw(ctx, t);
    }
  }

  // caça puxando o avião por um cabo
  Game.prototype._drawJet = function (ctx, t) {
    const j = this.jet, p = this.plane;
    if (j.phase !== 'out') { ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(p.x + 128 * Math.cos(p.ang), p.y + 128 * Math.sin(p.ang)); ctx.quadraticCurveTo((p.x + j.x) / 2, Math.max(p.y, j.y) + 30 + Math.sin(t * 6) * 6, j.x - 120, j.y + 10); ctx.stroke(); }
    ctx.save(); ctx.translate(j.x, j.y); ctx.rotate(j.phase === 'out' ? -0.3 : Math.sin(t * 2) * 0.03);
    // pós-combustor (animado) + caça desenhado uma vez só
    const fl = 0.8 + Math.random() * 0.4;
    const fg = ctx.createLinearGradient(-150 - 90 * fl, 0, -150, 0); fg.addColorStop(0, 'rgba(255,120,40,0)'); fg.addColorStop(0.5, 'rgba(255,160,60,0.85)'); fg.addColorStop(1, 'rgba(255,245,220,1)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-148, -9); ctx.quadraticCurveTo(-150 - 100 * fl, 0, -148, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(140,200,255,0.7)'; ctx.beginPath(); ctx.ellipse(-158, 0, 10 * fl, 5, 0, 0, 7); ctx.fill();
    ctx.drawImage(Game.jetSprite(), -170, -80);
    if (j.squad) { ctx.save(); ctx.globalAlpha = 0.95; ctx.scale(0.8, 0.8); ctx.drawImage(Game.jetSprite(), -230, -260); ctx.drawImage(Game.jetSprite(), -280, 110); ctx.restore(); }
    ctx.restore();
    ctx.font = `800 24px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = '#ffd23f';
    ctx.strokeText(`✈ ${j.name}`, j.x, j.y - 80); ctx.fillText(`✈ ${j.name}`, j.x, j.y - 80);
  };

  // caça (estilo Gripen da FAB) visto de lado, nariz para a direita
  Game.jetSprite = function () {
    if (Game._jet) return Game._jet;
    const c = document.createElement('canvas'); c.width = 340; c.height = 160; const x = c.getContext('2d');
    x.translate(170, 80);
    const L = (x0, y0, x1, y1, st) => { const g = x.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, cc]) => g.addColorStop(o, cc)); return g; };
    // asa delta (lado de lá, mais escura)
    x.fillStyle = '#5d6670'; U.poly(x, [-40, 4, 40, 4, -70, -24, -96, -24]); x.fill();
    // deriva (cauda vertical)
    x.fillStyle = L(0, -70, 0, -6, [[0, '#9aa4ad'], [1, '#6f7a84']]); U.poly(x, [-148, -6, -100, -6, -122, -64, -146, -68]); x.fill();
    x.fillStyle = '#1f9d55'; x.fillRect(-140, -48, 8, 22); x.fillStyle = '#f2c230'; x.fillRect(-132, -48, 8, 22);   // faixa verde-amarela
    // fuselagem
    x.fillStyle = L(0, -22, 0, 22, [[0, '#c3cbd2'], [0.45, '#97a1aa'], [1, '#5f6973']]);
    x.beginPath(); x.moveTo(-150, -10); x.lineTo(-150, 10); x.lineTo(-40, 16); x.quadraticCurveTo(60, 18, 110, 8); x.quadraticCurveTo(150, 3, 165, 0); x.quadraticCurveTo(150, -4, 110, -10); x.quadraticCurveTo(60, -20, 20, -18); x.lineTo(-40, -16); x.closePath(); x.fill();
    // radome escuro
    x.fillStyle = '#4a525a'; x.beginPath(); x.moveTo(128, -6); x.quadraticCurveTo(152, -3, 165, 0); x.quadraticCurveTo(152, 3, 128, 6); x.closePath(); x.fill();
    // entrada de ar
    x.fillStyle = '#2a3036'; U.poly(x, [10, -2, 52, -6, 54, 8, 14, 10]); x.fill(); x.fillStyle = '#7d8790'; x.fillRect(10, -3, 44, 2);
    // canard
    x.fillStyle = '#7d8790'; U.poly(x, [40, -10, 72, -10, 58, -30, 48, -30]); x.fill();
    // cabine
    x.fillStyle = L(70, -32, 120, -10, [[0, '#d7ecff'], [0.5, '#5c8fbf'], [1, '#1e3a5f']]);
    x.beginPath(); x.moveTo(64, -16); x.quadraticCurveTo(84, -36, 120, -14); x.closePath(); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.6)'; x.beginPath(); x.moveTo(78, -24); x.quadraticCurveTo(88, -31, 102, -26); x.lineTo(98, -24); x.quadraticCurveTo(88, -28, 80, -22); x.fill();
    x.fillStyle = '#2b2f33'; x.beginPath(); x.arc(86, -20, 5, 0, 7); x.fill();   // capacete
    // asa delta (lado de cá)
    x.fillStyle = L(0, 0, 0, 40, [[0, '#a5aeb6'], [1, '#6c7680']]); U.poly(x, [-50, 6, 46, 6, -78, 40, -112, 40]); x.fill();
    x.strokeStyle = 'rgba(40,50,60,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(-60, 22); x.lineTo(10, 10); x.stroke();
    // míssil na ponta da asa
    x.fillStyle = '#e5e7eb'; U.roundRect(x, -112, 38, 70, 6, 3); x.fill(); x.fillStyle = '#c1121f'; x.fillRect(-46, 38, 6, 6);
    // bocal do motor
    x.fillStyle = '#3a4047'; U.poly(x, [-150, -11, -160, -9, -160, 9, -150, 11]); x.fill();
    // linhas de painel, roundel da FAB e número
    x.strokeStyle = 'rgba(40,50,60,0.3)'; x.lineWidth = 1; [-100, -40, 30].forEach((px) => { x.beginPath(); x.moveTo(px, -15); x.lineTo(px, 15); x.stroke(); });
    [[11, '#1f9d55'], [8, '#f2c230'], [5.5, '#1d4ed8'], [3, '#ffffff']].forEach(([r, cc]) => { x.fillStyle = cc; x.beginPath(); x.arc(-78, 24, r, 0, 7); x.fill(); });
    x.fillStyle = '#2b2f33'; x.font = `900 11px ${U.FONT_UI}`; x.fillText('FAB 4100', -30, 2);
    Game._jet = c; return c;
  };

  CNB.Game = Game;
})();
