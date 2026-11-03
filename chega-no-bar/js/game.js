/* =========================================================================
   JOGO — loop principal, câmera, colisões, rodadas, presentes e chegada
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const S = CNB.Drunk.S;

  // poses de câmera
  const CAM_WALK = { dist: 5, y: 2.6, F: 1500, hz: 640 };
  const CAM_RUN = { dist: 5.8, y: 2.4, F: 1340, hz: 660 };
  const CAM_WIN = { dist: 4.6, y: 1.5, F: 1150, hz: 880 };
  const CAM_TABLE = { dist: 5.2, y: 1.5, F: 1150, hz: 800 };
  const CAM_SLEEP = { dist: 6.2, y: 3.3, F: 1400, hz: 660 };

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = CNB.CONFIG;
      this.world = new CNB.World(this.cfg);
      this.drunk = new CNB.Drunk(this.cfg);
      this.audio = new CNB.AudioEngine(this.cfg.audio);
      this.fx = new CNB.Effects();
      this.hud = new CNB.HUD(this);
      this.voice = new CNB.Voice(this.cfg.voice, (text, dur) => { this.hud.speak(text, dur); this.drunk.say(dur); });
      this.gifts = new CNB.GiftSystem(this.cfg, (k, def, n, user) => this.applyGift(k, def, n, user));
      this.bridge = new CNB.Bridge(this.gifts, this.cfg);
      this.dog = new CNB.DogActor();
      // escolha de personagem (salva no navegador)
      let saved = null;
      try { saved = localStorage.getItem('cnb-personagem'); } catch (e) {}
      const q = new URLSearchParams(location.search).get('personagem');
      this.charChoice = ['homem', 'mulher', 'alternar'].includes(q) ? q : saved || this.cfg.character;
      this.gender = this.charChoice === 'mulher' ? 'f' : 'm';
      this.drunk.setGender(this.gender); this.voice.gender = this.gender;
      let savedCtl = null;
      try { savedCtl = localStorage.getItem('cnb-controle'); } catch (e) {}
      const qc = new URLSearchParams(location.search).get('controle');
      this.setControl(qc || savedCtl || this.cfg.control);
      this.previews = { homem: new CNB.Drunk(this.cfg), mulher: new CNB.Drunk(this.cfg) };
      this.previews.homem.setGender('m'); this.previews.mulher.setGender('f');
      for (const k in this.previews) { const p = this.previews[k]; p.reset(); p.state = 'preview'; p.turnT = 1; p.faceTarget = 'front'; p.facing = 'front'; p.t = k === 'mulher' ? 2 : 0; }

      this.cam = { x: 0, y: CAM_WALK.y, z: -CAM_WALK.dist, F: CAM_WALK.F, horizon: CAM_WALK.hz, sx: 0, sy: 0, roll: 0 };
      this.mode = 'title';
      this.time = 0;
      this.roundNo = 0;
      this.roundTime = 0;
      this.shake = 0;
      this.seed = Math.floor(Math.random() * 1000);
      this.timers = [];
      this.idleT = 6;
      this.falls = 0;
      this._bindDrunk();
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    _bindDrunk() {
      const d = this.drunk;
      d.onStep = (run) => {
        this.audio.step_(run ? 1 : 0);
        if (run) this.fx.dust(d.footScreen.x, d.footScreen.y, 3, 0.8);
      };
      d.onEvent = (ev, arg) => {
        switch (ev) {
          case 'impact':
            this.audio.thud(); this.shake = 26; this.falls++;
            this.fx.dust(d.footScreen.x + d.fallDir * 120, d.footScreen.y, 18, 1.4);
            this.after(0.5, () => this.say('fall', true));
            break;
          case 'up': if (Math.random() < 0.6) this.say('getup'); break;
          case 'hiccup':
            this.audio.hiccup(this.gender);
            this.fx.text(d.headScreen.x + 70, d.headScreen.y, 'hic!', '#e9f5ff', 40, { life: 1.1, vy: -120 });
            break;
          case 'selfstumble': this.audio.step_(1); if (Math.random() < 0.6) this.say('stumble'); break;
          case 'runEnd': this.hud.banner('FÔLEGO ACABOU', null, '#9ae6ff', 1.3); break;
          case 'state':
            if (arg === S.WIN) this._celebrate();
            if (arg === S.TABLE) this.after(0.6, () => this.say('table', true));
            if (arg === S.SIT) this._sitDown();
            break;
        }
      };
    }

    after(sec, fn) { this.timers.push({ t: sec, fn }); }
    say(cat, force = false, text) { return this.voice.say(cat, this.time, { force, text }); }

    // ------------------------------------------------------------------ rodada
    setCharacter(choice) {
      this.charChoice = choice;
      try { localStorage.setItem('cnb-personagem', choice); } catch (e) {}
      if (this.mode === 'title') this._applyGender(choice === 'mulher' ? 'f' : 'm');
    }
    _applyGender(g) { this.gender = g; this.drunk.setGender(g); this.voice.gender = g; }
    // textos com gênero
    get ele() { return this.gender === 'f' ? 'ela' : 'ele'; }

    startRound() {
      this.seed++;
      if (this.charChoice === 'alternar') this._applyGender(this.roundNo === 0 ? 'm' : this.gender === 'm' ? 'f' : 'm');
      else this._applyGender(this.charChoice === 'mulher' ? 'f' : 'm');
      this.roundNo++;
      this.world.reset(this.seed);
      this.world.barGlow = 1; this.world.cheer = 0;
      this.drunk.reset();
      this.drunk.manual = this.control === 'manual';
      this.dog.reset();
      this._bindDrunk();
      this.gifts.resetRound();
      this.fx.clear();
      this.timers = [];
      this.mode = 'playing';
      this.roundTime = 0; this.falls = 0;
      this.winTime = -1; this.winPhase = 0; this.cardTime = 0; this.countdown = 0;
      this.cam.z = -CAM_WALK.dist; this.cam.x = 0;
      this.audio.intensity = 0; this.audio.tempoMul = 1; this.audio.setMusicLevel(this.cfg.audio.music);
      this.idleT = 3;
      this.hud.banner(`RODADA ${this.roundNo}`, `Mande presentes pra ${this.ele} chegar no bar!`, '#ffd23f', 2.4);
      this.after(1.2, () => this.say('idle', true, 'Bora... cadê esse bar, meu Deus?'));
    }

    start() {
      if (this.mode !== 'title') return;
      this.audio.start();
      this.startRound();
    }

    // ------------------------------------------------------------------ presentes
    applyGift(key, def, n, user) {
      const d = this.drunk;
      const head = d.headScreen;
      if (this.mode !== 'playing' || d.finished) { this.audio.gift(0); return; }
      this.fx.text(U.clamp(head.x, 200, 880), head.y - 150, user, def.color, 30, { life: 1.6, vy: -70, rot: 0 });
      switch (def.action) {
        case 'advance': {
          d.addImpulse(def.amount * n);
          this.audio.gift(def.amount * n >= 10 ? 1 : 0);
          this.fx.text(head.x + U.rand(-80, 80), head.y - 60, `+${def.amount * n} m`, '#7cff6b', 52);
          if (def.amount * n >= 10) this.hud.banner(`+${def.amount * n} m`, `${user} mandou ${def.label}`, def.color, 1.5);
          if (Math.random() < 0.45) this.say('go');
          break;
        }
        case 'turbo': {
          d.addTurbo(def.duration * n);
          this.audio.turbo();
          this.fx.doFlash(0.35, '255,220,80');
          this.shake = Math.max(this.shake, 14);
          this.hud.banner('TURBO!', `${user} ligou o modo corrida`, '#ffd23f', 2);
          this.after(0.25, () => this.say('turbo', true));
          break;
        }
        case 'beer': {
          d.addImpulse(def.amount * n);
          d.addDrunk(def.drunk * n);
          this.audio.gulp();
          this.after(0.75, () => this.audio.burp());
          this.hud.banner('MAIS UMA!', `${user} pagou uma gelada`, def.color, 1.8);
          this.fx.text(head.x, head.y - 60, `+${def.amount * n} m`, '#ffd23f', 52);
          this.after(1.0, () => this.say('beer', true));
          this.after(2.4, () => { if (d.state === S.WALK && Math.random() < 0.55 + d.drunk * 0.3) d.stumble(0, 0); });
          break;
        }
        case 'back': {
          d.addRetreat(def.amount * n);
          d.impulse = Math.max(0, d.impulse - def.amount * n * 0.5);
          this.audio.back();
          this.hud.banner(`VOLTA ${def.amount * n} m!`, `${user} atrapalhou`, def.color, 1.8);
          this.after(0.2, () => this.say('back', true));
          break;
        }
        case 'trip': {
          d.trip();
          this.audio.slip();
          this.hud.banner('TROPEÇOU!', `${user} jogou uma casca de banana`, def.color, 1.8);
          break;
        }
        case 'gameover':
          this.gameOver(def.event, user);
          break;
        case 'dog':
          this.dog.request();
          this.hud.banner('CACHORRO!', `${user} soltou o caramelo`, def.color, 1.8);
          break;
      }
    }

    // ------------------------------------------------------------------ vitória
    startArrive() {
      const d = this.drunk;
      d.turbo = 0; d.impulse = 0; d.retreat = 0; d.slide = 0;
      d.state = null; d.setState(S.ARRIVE);
      this.mode = 'win';
      this.finalTime = this.roundTime;
      this.winTime = -1; this.winPhase = 0;
      this.audio.intensity = 2; this.audio.tempoMul = 1.08;
      this.audio.setMusicLevel(this.cfg.audio.music * 1.5, 1.5);
      this.audio.whoosh(true);
      this.say('near', true, 'Tá chegando, tá chegando!');
    }

    _celebrate() {
      this.winTime = 0;
      this.world.cheer = 1;
      this.audio.fanfare();
      this.after(0.3, () => this.audio.cheer());
      this.audio.setMusicLevel(this.cfg.audio.music * 1.9, 0.8);
      this.fx.doFlash(0.7, '255,230,170');
      this.shake = 12;
      this.after(0.25, () => this.say('win', true, 'EU CONSEGUI, RAPAZ!'));
      this.after(3.8, () => this.say('win', true, 'Desce uma gelada aí, Zé!'));
      const burst = () => { this.fx.confetti(80, 1500, 90, 0.7); this.fx.confetti(1000, 1500, 90, 0.7); this.audio.pop(); };
      burst(); this.after(0.6, () => this.fx.confetti(540, 1200, 120, 1)); this.after(1.4, burst); this.after(2.6, burst);
    }

    onDogStart() {
      this.after(0.4, () => this.say('idle', true, 'Ué... que bicho é esse?'));
      this.after(2.15, () => { this.say('dog', true); this.audio.slip(); this.shake = 8; });
      this.after(4.3, () => this.say('dogafter', true));
      this.after(3.9, () => this.audio.bark());
    }

    _sitDown() {
      this.audio.cardboard();
      this.after(0.9, () => this.say('sit', true, 'Saúde, rapaziada!'));
      this.after(2.2, () => { this.audio.glass(); this.audio.pop(); this.fx.sparks(this.drunk.headScreen.x - 90, this.drunk.headScreen.y + 30, 10, '#ffe08a'); });
      this.after(3.4, () => this.audio.cheer());
      this.after(5.5, () => this.say('sit', true, 'Ahhh... agora sim... valeu, gente!'));
    }

    gameOver(eventId, user) {
      this.timers = [];
      const ev = this.cfg.specialEvents[eventId] || this.cfg.specialEvents.dormiu;
      const d = this.drunk;
      d.turbo = 0; d.impulse = 0; d.retreat = 0;
      d.state = null; d.setState(S.SLEEP);
      this.mode = 'gameover';
      this.overEvent = ev; this.overBy = user; this.overTime = 0; this.countdown = 0;
      this.audio.intensity = 0; this.audio.setMusicLevel(this.cfg.audio.music * 0.35, 1);
      this.audio.sadTrombone();
      this.say('gameover', true, ev.phrase);
    }

    // ------------------------------------------------------------------ colisões
    // modo de controle: 'auto' (desvia sozinho, com chance de errar) ou 'manual' (você desvia com ← →)
    setControl(mode) {
      this.control = mode === 'manual' ? 'manual' : 'auto';
      this.drunk.manual = this.control === 'manual';
      try { localStorage.setItem('cnb-controle', this.control); } catch (e) {}
    }

    _avoidance() {
      const d = this.drunk;
      d.avoiding = false;
      if (d.manual) return;
      if (d.busy || d.finished) return;
      const dir = d.state === S.BACK ? -1 : 1;
      let next = null;
      for (const o of this.world.obstacles) {
        if (o.hit) continue;
        const ahead = (o.z - d.z) * dir;
        if (ahead > 0 && ahead < (d.state === S.RUN ? 16 : 8)) { if (!next || (o.z - d.z) * dir < (next.z - d.z) * dir) next = o; }
      }
      if (!next) return;
      if (!next.decided) {
        next.decided = true;
        let chance = this.cfg.obstacleHitChance + (d.drunk - 0.5) * 0.4;
        if (d.state === S.RUN) chance *= 0.85;
        next.willHit = Math.random() < chance;
        next.side = Math.abs(d.x - next.x) > 0.2 ? Math.sign(d.x - next.x) : next.x > 0 ? -1 : 1;
        if (Math.abs(next.x + next.side * (next.w / 2 + 0.9)) > CNB.World.ROAD - 0.5) next.side *= -1;
      }
      d.avoiding = true;
      d.targetX = next.willHit ? next.x + (next.seed - 0.5) * 0.3 : next.x + next.side * (next.w / 2 + 0.9);
    }

    _collide(prevZ) {
      const d = this.drunk;
      if (d.busy || d.finished) return;
      for (const o of this.world.obstacles) {
        if (o.hit) continue;
        const crossed = (prevZ < o.z && d.z >= o.z) || (prevZ > o.z && d.z <= o.z);
        if (!crossed) continue;
        if (Math.abs(d.x - o.x) > o.w / 2 + 0.28) { o.hit = true; o.passed = true; continue; }
        this._hit(o);
        break;
      }
    }

    _hit(o) {
      const d = this.drunk;
      o.hit = true;
      const dir = Math.sign(d.x - o.x) || (Math.random() < 0.5 ? -1 : 1);
      o.knockDir = -dir;
      const running = d.state === S.RUN;
      const back = d.state === S.BACK;
      const push = (m) => (back ? -m * 0.4 : m) * (running ? 1.6 : 1);
      let fall = false, name = '';
      switch (o.type) {
        case 'hole': fall = true; name = 'CAIU NO BURACO!'; this.audio.thud(); break;
        case 'cone': fall = running; name = 'BATEU NO CONE!'; this.audio.plastic(); break;
        case 'bottle': fall = true; name = 'ESCORREGOU!'; this.audio.slip(); this.audio.glass(); o.rollV = dir * 0.8; break;
        case 'box': fall = running; name = 'CHUTOU A CAIXA!'; this.audio.cardboard(); break;
        case 'trash': fall = running || Math.random() < 0.45; name = 'ABRAÇOU A LIXEIRA!'; this.audio.metal(); break;
        case 'step': fall = running || Math.random() < 0.3; name = 'TROPEÇOU NO DESNÍVEL!'; this.audio.thud(); break;
        case 'chair': fall = running; name = 'CADEIRA NO CAMINHO!'; this.audio.plastic(); break;
        case 'manhole': fall = true; name = 'CAIU NO BUEIRO!'; this.audio.metal(); this.audio.thud(); break;
        case 'cart': fall = running || Math.random() < 0.35; name = 'ATROPELOU O CARRINHO!'; this.audio.metal(); break;
      }
      const amount = o.type === 'hole' || o.type === 'manhole' ? 3.5 : fall ? 2.6 : 1.4;
      if (back) d.retreat = 0;
      if (fall) d.knockDown(dir, Math.max(0, push(amount)));
      else { d.stumble(dir, Math.max(0, push(amount))); this.say('stumble', true); }
      this.shake = fall ? 18 : 10;
      this.fx.dust(d.footScreen.x, d.footScreen.y, 10, 1.1);
      this.fx.text(d.headScreen.x, d.headScreen.y - 40, `-${amount.toFixed(1)} m`, '#ff6b6b', 46);
      this.hud.banner(name, null, '#ff6b6b', 1.5);
    }

    // ------------------------------------------------------------------ loop
    loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.render();
      requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
      this.time += dt;
      const d = this.drunk, w = this.world;
      // timers
      for (const tm of this.timers) tm.t -= dt;
      const due = this.timers.filter((tm) => tm.t <= 0);
      this.timers = this.timers.filter((tm) => tm.t > 0);
      due.forEach((tm) => tm.fn());

      this.bridge.update(dt, this.mode === 'playing');

      if (this.mode === 'playing') {
        this.roundTime += dt;
        this.dog.update(dt, d, this);
        this._avoidance();
        const prevZ = d.z;
        d.update(dt, w);
        this._collide(prevZ);
        if (d.z >= w.track) this.startArrive();
        // conversa espontânea
        this.idleT -= dt;
        if (this.idleT <= 0) {
          this.idleT = U.rand(this.cfg.voice.idleEvery[0], this.cfg.voice.idleEvery[1]);
          if (!d.busy) this.say(w.track - d.z < 70 ? 'near' : 'idle');
        }
        this.audio.tempoMul = U.damp(this.audio.tempoMul, d.state === S.RUN ? 1.3 : 1, 3, dt);
        this.audio.intensity = d.state === S.RUN ? 1 : 0;
      } else if (this.mode === 'title') {
        for (const k in this.previews) this.previews[k].update(dt, w);
        d.update(dt, w);
        if (d.z > 30) d.z = 0;
      } else if (this.mode === 'win') {
        d.update(dt, w);
        if (this.winTime >= 0) {
          this.winTime += dt;
          if (Math.random() < dt * 6) this.fx.rain(2);
          if (this.winPhase === 0 && this.winTime > this.cfg.winCelebrationTime) { this.winPhase = 1; this.cardTime = 0; this.countdown = this.cfg.restartCountdown; }
          if (this.winPhase === 1) {
            this.cardTime += dt;
            const before = Math.ceil(this.countdown);
            this.countdown -= dt;
            if (Math.ceil(this.countdown) !== before && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
            if (this.countdown <= 0) this.startRound();
          }
        }
      } else if (this.mode === 'gameover') {
        d.update(dt, w);
        this.overTime += dt;
        if (Math.random() < dt * 0.7) this.fx.zzz(d.headScreen.x + 30, d.headScreen.y);
        if (Math.floor(this.overTime / 2.6) !== Math.floor((this.overTime - dt) / 2.6)) this.audio.snore();
        if (this.overTime > this.cfg.gameOverTime) {
          if (this.countdown <= 0 && !this._goCount) { this.countdown = this.cfg.restartCountdown * 0.6; this._goCount = true; }
          const before = Math.ceil(this.countdown);
          this.countdown -= dt;
          if (Math.ceil(this.countdown) !== before && this.countdown > 0) this.audio.tick(this.countdown < 3.5);
          if (this.countdown <= 0) { this._goCount = false; this.startRound(); }
        }
      }

      // obstáculos derrubados
      for (const o of w.obstacles) {
        if (o.hit && !o.passed) {
          o.knock = U.damp(o.knock, 1, 9, dt);
          if (o.rollV) { o.roll += o.rollV * dt; o.rollV *= Math.exp(-dt * 1.5); }
        }
      }
      // luzes do bar
      const glowTarget = this.mode === 'win' ? (d.state === S.TABLE || d.state === S.SIT ? 1.35 : d.state === S.WIN ? 2.1 + Math.sin(this.time * 8) * 0.2 : 1.5) : 1 + U.clamp(1 - (w.track - d.z) / 80, 0, 1) * 0.35;
      w.barGlow = U.damp(w.barGlow, glowTarget, 2.5, dt);
      w.toast = U.damp(w.toast, d.state === S.SIT && d.st > 1.0 && d.st < 3.4 ? 1 : 0, 5, dt);

      this._updateCamera(dt);
      this.fx.update(dt);
      this.hud.update(dt);
    }

    _updateCamera(dt) {
      const d = this.drunk, c = this.cam, w = this.world;
      let P = CAM_WALK;
      if (d.state === S.RUN) P = CAM_RUN;
      if (d.state === S.ARRIVE || d.state === S.WIN) P = CAM_WIN;
      if (d.state === S.TABLE || d.state === S.SIT) P = CAM_TABLE;
      if (d.state === S.SLEEP) P = CAM_SLEEP;
      const winish = P === CAM_WIN || P === CAM_TABLE;
      const r = winish ? 1.6 : 3;
      c.F = U.damp(c.F, P.F, r, dt);
      c.y = U.damp(c.y, P.y, r, dt);
      c.horizon = U.damp(c.horizon, P.hz, r, dt);
      const tz = d.z - P.dist;
      // câmera alcança rápido quando o personagem é empurrado para trás
      c.z = U.damp(c.z, tz, tz < c.z ? 9 : d.state === S.RUN ? 7 : 6, dt);
      if (d.z - c.z < 3.2) c.z = d.z - 3.2;
      const lying = [S.FALL, S.DOWN, S.SLEEP].includes(d.state) || (d.state === S.GETUP && d.st < 0.8);
      const tx = P === CAM_TABLE ? U.lerp(d.x, w.seat.x - 0.35, U.clamp((d.z - w.track - 2) / 8, 0, 1)) : winish ? 0 : lying ? d.x + d.fallDir * 0.85 : d.x * 0.62;
      c.x = U.damp(c.x, tx, lying ? 3.2 : 2.2, dt);
      this.shake = Math.max(0, this.shake - dt * 45);
      const bob = (d.state === S.RUN ? 5 : 1.6) * Math.sin(d.phase * 2);
      c.sx = (Math.random() - 0.5) * this.shake;
      c.sy = (Math.random() - 0.5) * this.shake + (d.busy || d.finished ? 0 : bob);
      // câmera "bêbada": leve inclinação
      const rollT = d.finished ? 0 : d.drunk * 0.014 * Math.sin(this.time * 0.6) + (d.state === S.RUN ? Math.sin(d.phase) * 0.006 : 0) + d.pose.lean * 0.03;
      c.roll = U.damp(c.roll, rollT, 4, dt);
    }

    // ------------------------------------------------------------------ render
    render() {
      const ctx = this.ctx, c = this.cam, d = this.drunk, w = this.world, t = this.time;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#05050a'; ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.rotate(c.roll); ctx.scale(1.04, 1.04); ctx.translate(-W / 2, -H / 2);
      w.drawSky(ctx, c, t);
      w.drawGround(ctx, c, t);
      w.drawLightPools(ctx, c);

      const sprites = w.collectSprites(c, t).concat(this.dog.sprites(w, c, d, t));
      sprites.push({
        z: d.z, player: true, draw: (cx) => {
          const onBarSidewalk = d.z >= w.barSidewalkZ ? 0.14 : 0;
          const p = w.proj(c, d.x, onBarSidewalk, d.z);
          if (!p) return;
          d.footScreen = { x: p.x, y: p.y };
          d.draw(cx, p.x, p.y, p.s, U.clamp(w.lampLight(d.z), 0, 1));
        }
      });
      sprites.sort((a, b) => b.z - a.z);
      for (const s of sprites) s.draw(ctx);

      if (d.state === S.RUN) {
        const vp = w.proj(c, c.x, 1, c.z + 400) || { x: W / 2, y: c.horizon };
        CNB.Effects.speedLines(ctx, vp.x, vp.y, 1, t);
      }
      ctx.restore();

      // vinheta + clima noturno
      const vg = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.25, W / 2, H * 0.52, H * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,8,${d.state === S.RUN ? 0.75 : 0.6})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      // visão dupla quando muito bêbado
      if (d.drunk > 0.8 && !d.finished) {
        ctx.save(); ctx.globalAlpha = (d.drunk - 0.8) * 0.6; ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(this.canvas, Math.sin(t * 1.3) * 14, Math.cos(t * 1.1) * 6);
        ctx.restore();
      }

      this.fx.draw(ctx);
      this.hud.draw(ctx, t);
    }
  }

  CNB.Game = Game;
})();
