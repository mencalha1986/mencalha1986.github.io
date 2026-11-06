/* =========================================================================
   O BÊBADO — personagem articulado com renderização "realista"
   - Esqueleto: quadril, tronco, pescoço, cabeça, ombro/cotovelo/punho,
     quadril/joelho/tornozelo. Cada estado gera uma pose-alvo e o corpo
     interpola até ela.
   - Sem contorno de desenho animado: membros são volumes (cápsulas) com
     sombreamento cilíndrico, roupa com dobras suaves, cabelo em fios.
   - O corpo é desenhado numa camada própria e recebe a luz da cena
     (ambiente noturno frio + luz quente dos postes e do bar).
   ========================================================================= */
(function () {
  const U = CNB.U;

  const S = {
    WALK: 'walk', RUN: 'run', STUMBLE: 'stumble', FALL: 'fall', DOWN: 'down',
    GETUP: 'getup', BACK: 'back', ARRIVE: 'arrive', WIN: 'win', TABLE: 'table', SIT: 'sit',
    SLEEP: 'sleep', IDLE: 'idle', DOG: 'dog', PREVIEW: 'preview'
  };

  // paleta (base, claro, escuro)
  const P3 = (b, l, d) => ({ b, l, d });
  const C = {
    skin: P3('#b57a5a', '#d29a76', '#7e4f38'),
    skinRed: P3('#b86a55', '#d98670', '#7d4334'),
    shirt: P3('#bdb498', '#ddd5ba', '#857d65'),
    pants: P3('#4a4034', '#6a5d4b', '#2a241d'),
    shoe: P3('#8f8a80', '#b9b3a7', '#56524b'),
    sole: P3('#4d4842', '#6e6860', '#2d2a26'),
    hair: P3('#2a211b', '#4a3c30', '#140f0c'),
    glass: P3('#2f5a26', '#6fa060', '#173012'),
    // personagem mulher
    skinF: P3('#c48b6a', '#e0ab88', '#8c5a40'),
    skinRedF: P3('#c47a63', '#e09a82', '#8a4c3c'),
    top: P3('#8a2346', '#bf4a72', '#4f1027'),
    skirt: P3('#26222c', '#413b4a', '#121015'),
    hairF: P3('#4a2e1c', '#7c5536', '#22140b'),
    heel: P3('#b0142c', '#e3455c', '#5e0a18')
  };

  // --------------------------------------------------------------- primitivas
  /** cápsula sombreada (membro): a->b, raios ra/rb, luz vinda de "lightSide" (+1 / -1 no eixo normal) */
  function capsule(ctx, a, b, ra, rb, pal, lightSide = 1) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 0.001;
    const ang = Math.atan2(dy, dx), nx = -dy / len, ny = dx / len;
    ctx.beginPath();
    ctx.arc(a.x, a.y, ra, ang + Math.PI / 2, ang - Math.PI / 2 + Math.PI * 2);
    ctx.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.closePath();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = Math.max(ra, rb) * 1.05;
    const g = ctx.createLinearGradient(mx - nx * r * lightSide, my - ny * r * lightSide, mx + nx * r * lightSide, my + ny * r * lightSide);
    g.addColorStop(0, pal.d); g.addColorStop(0.42, pal.b); g.addColorStop(0.72, pal.l); g.addColorStop(1, pal.b);
    ctx.fillStyle = g; ctx.fill();
  }
  function blob(ctx, x, y, rx, ry, color, rot = 0) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, color); g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1, ry / rx);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, 7); ctx.fill(); ctx.restore();
  }
  function softLine(ctx, pts, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
    else for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }

  class Drunk {
    constructor(cfg) {
      this.cfg = cfg;
      this.layer = document.createElement('canvas');
      this.lctx = this.layer.getContext('2d');
      // fios de cabelo pré-gerados (sempre os mesmos, como cabelo de verdade)
      const r = U.mulberry32(42);
      this.strands = [];
      for (let i = 0; i < 70; i++) {
        const a = -Math.PI * 0.95 + r() * Math.PI * 0.9; // do cocuruto para baixo/lados
        this.strands.push({ a, len: 7 + r() * 9, curl: (r() - 0.5) * 7, w: 0.7 + r() * 1.1, tone: r(), wild: r() < 0.12 });
      }
      this.stubble = [];
      for (let i = 0; i < 140; i++) this.stubble.push([r() * 2 - 1, r(), r()]);
      this.reset();
    }

    setGender(g) {
      this.gender = g === 'f' ? 'f' : 'm';
      this.SK = this.gender === 'f' ? C.skinF : C.skin;
      this.SKR = this.gender === 'f' ? C.skinRedF : C.skinRed;
    }

    reset() {
      if (!this.gender) this.setGender('m');
      this.z = 0; this.x = 0; this.baseX = 0; this.targetX = 0;
      this.speed = 0; this.impulse = 0; this.turbo = 0; this.retreat = 0; this.slide = 0;
      this.drunk = this.cfg.drunkStart;
      this.state = S.WALK; this.st = 0;
      this.phase = 0; this.t = 0;
      this.fallDir = 1; this.flip = 1;
      this.facing = 'back'; this.faceTarget = 'back'; this.turnT = 1;
      this.talk = 0; this.talkTurn = 1; this.expr = 'drunk';
      this.pose = this._basePose();
      this.headScreen = { x: 540, y: 900 };
      this.footScreen = { x: 540, y: 1400 };
      this.onStep = null; this.onEvent = null;
      this.blinkT = 2;
      this.hiccupT = U.rand(6, 12);
      this.stumbleRnd = 0;
      this.light = 0.4;
      this.avoiding = false;
      this.wetLeg = 0; this.dogSide = 1;
    }

    _basePose() {
      return {
        lean: 0, bob: 0, hipX: 0, fwd: 0, crouch: 0, fall: 0, ground: 0, sit: 0,
        lLift: 0, rLift: 0, lOut: 0, rOut: 0,
        laA: 0.15, laE: 0.25, raA: 0.15, raE: 0.3, laF: 0, raF: 0,
        hTilt: 0, hTurn: 0, hNod: 0
      };
    }

    get busy() { return [S.STUMBLE, S.FALL, S.DOWN, S.GETUP, S.DOG].includes(this.state); }
    get finished() { return [S.ARRIVE, S.WIN, S.TABLE, S.SIT, S.SLEEP].includes(this.state); }
    get scripted() { return [S.TABLE, S.SIT].includes(this.state); }

    setState(s) {
      if (this.state === s) return;
      this.prev = this.state; this.state = s; this.st = 0;
      this.onEvent && this.onEvent('state', s);
    }

    // ------------------------------------------------------------------ ações
    addImpulse(m) { this.impulse += m; }
    addTurbo(sec) { this.turbo = Math.min(30, this.turbo + sec); }
    addRetreat(m) { this.retreat += m; }
    addDrunk(v) { this.drunk = U.clamp(this.drunk + v, 0, 1); }
    trip(dir) {
      if (this.finished || this.state === S.FALL || this.state === S.DOWN) return;
      this.fallDir = dir || (Math.random() < 0.5 ? -1 : 1);
      this.setState(S.FALL);
    }
    stumble(dir, push = 0) {
      if (this.finished || this.busy) return;
      this.fallDir = dir || (Math.random() < 0.5 ? -1 : 1);
      this.slide += push;
      this.setState(S.STUMBLE);
    }
    knockDown(dir, push) { if (this.finished) return; this.slide += push; this.fallDir = dir; this.state = null; this.setState(S.FALL); }
    // cancela qualquer ação em andamento (o presente novo assume)
    cancelAction() {
      if (this.finished) return;
      this.turbo = 0; this.impulse = 0; this.retreat = 0; this.slide = 0;
      if ([S.RUN, S.BACK, S.STUMBLE, S.DOG].includes(this.state)) { this.state = null; this.setState(S.WALK); }
      else if ([S.FALL, S.DOWN].includes(this.state)) { this.state = null; this.setState(S.GETUP); this.st = 0.45; }
    }

    startDog(side) { this.dogSide = side; this.speed = 0; this.state = null; this.setState(S.DOG); }
    say(dur) { this.talk = dur; this.talkTurn = Math.random() < 0.5 ? -1 : 1; }

    // ------------------------------------------------------------------ update
    update(dt, world) {
      this.t += dt; this.st += dt;
      const cfg = this.cfg;
      this.drunk = Math.max(cfg.drunkMin, this.drunk - cfg.drunkDecayPerSec * dt);
      if (this.talk > 0) this.talk -= dt;
      this.blinkT -= dt; if (this.blinkT < -0.12) this.blinkT = U.rand(1.5, 4);

      let speed = 0;
      switch (this.state) {
        case S.WALK: case S.IDLE: {
          if (this.retreat > 0) { this.setState(S.BACK); break; }
          if (this.turbo > 0) { this.setState(S.RUN); this.onEvent && this.onEvent('run'); break; }
          if (this.impulse > 0) {
            speed = cfg.walkSpeed * (1 + Math.min(this.impulse / 40, 1) * 0.7);
            this.impulse = Math.max(0, this.impulse - speed * dt);
          } else speed = cfg.autoWalkSpeed;
          this.stumbleRnd += dt;
          if (this.stumbleRnd > 3 && Math.random() < dt * (0.015 + this.drunk * 0.05)) {
            this.stumbleRnd = 0; this.stumble(0, 0); this.onEvent && this.onEvent('selfstumble');
          }
          break;
        }
        case S.RUN: {
          if (this.retreat > 0) { this.setState(S.BACK); break; }
          speed = cfg.runSpeed;
          this.turbo -= dt;
          if (this.turbo <= 0) { this.turbo = 0; this.setState(S.WALK); this.onEvent && this.onEvent('runEnd'); }
          break;
        }
        case S.BACK: {
          speed = -cfg.backSpeed;
          this.retreat -= cfg.backSpeed * dt;
          if (this.retreat <= 0 || this.z <= 0) { this.retreat = 0; this.setState(S.WALK); }
          break;
        }
        case S.STUMBLE: speed = 0.6; if (this.st > 1.15) this.setState(S.WALK); break;
        case S.FALL: if (this.st > 0.55) { this.setState(S.DOWN); this.onEvent && this.onEvent('impact'); } break;
        case S.DOWN: if (this.st > 1.7) this.setState(S.GETUP); break;
        case S.GETUP: if (this.st > 1.35) { this.setState(S.WALK); this.onEvent && this.onEvent('up'); } break;
        case S.ARRIVE: {
          const goal = world.track + 2;
          speed = this.z < goal ? 2.6 : 0;
          if (this.z >= goal) { this.z = Math.min(this.z, goal + 0.3); if (this.st > 1.5) this.setState(S.WIN); }
          break;
        }
        case S.WIN:
          if (this.st > 3.8 && world.seat) this.setState(S.TABLE);
          break;
        case S.TABLE: {
          // vai até a cadeira livre ao lado do cliente
          const dx = world.seat.x - this.x, dz = world.seat.z - this.z, dist = Math.hypot(dx, dz);
          if (dist < 0.06) { this.x = world.seat.x; this.z = world.seat.z; this.speed = 0; this.setState(S.SIT); break; }
          const v = Math.min(2.1, 0.6 + dist * 2) * (this.st < 0.5 ? this.st * 2 : 1);
          this.x += (dx / dist) * v * dt; this.z += (dz / dist) * v * dt;
          this.speed = v;
          this.walkDirX = dx / dist;
          break;
        }
        case S.SIT: case S.SLEEP: case S.PREVIEW: break;
        case S.DOG: speed = 0; if (this.st > 5.0) this.setState(S.WALK); break;
      }

      if (!this.scripted) {
        if (this.slide > 0) { const r = Math.min(this.slide, dt * 5.5); this.slide -= r; this.z -= r; }
        this.speed = U.damp(this.speed, speed, this.state === S.RUN ? 5 : 8, dt);
        this.z = Math.max(0, this.z + this.speed * dt);
        const ROAD = CNB.World.ROAD - 0.7;
        if (this.state === S.ARRIVE || this.state === S.WIN) this.targetX = 0;
        else if (this.manual) {
          // você conduz, mas a bebida puxa para os lados: quanto mais bêbado, mais ele "escorrega"
          const drift = U.noise(this.t * 0.35 + 9) * (0.5 + this.drunk * 1.1);
          if (!this.busy) this.targetX += ((this.steer || 0) * 3.4 + drift) * dt;
        }
        else if (!this.avoiding) this.targetX = U.noise(this.t * 0.18 + 5) * 1.9 * (0.6 + this.drunk * 0.6);
        this.targetX = U.clamp(this.targetX, -ROAD, ROAD);
        const steerRate = this.manual ? 3.6 : this.state === S.RUN ? 2.4 : 1.2;
        if (!this.busy) this.baseX = U.damp(this.baseX, this.targetX, steerRate, dt);
        const wob = this.finished ? 0 : U.noise(this.t * 0.9) * 0.35 * this.drunk;
        this.x = U.clamp(this.baseX + wob, -ROAD - 0.4, ROAD + 0.4);
      }

      // fase do passo
      const absV = Math.abs(this.speed);
      const freq = this.state === S.RUN ? 3.3 : this.state === S.ARRIVE ? 2.6 : this.state === S.TABLE ? 2.0 : 0.6 + Math.min(absV, 3) * 0.55;
      const walking = [S.WALK, S.RUN, S.BACK, S.ARRIVE, S.TABLE, S.IDLE].includes(this.state);
      if (walking && (absV > 0.05 || this.state === S.WALK)) {
        const before = Math.floor(this.phase / Math.PI);
        this.phase += dt * freq * Math.PI * 2 * (this.speed < -0.05 ? -1 : 1) * (absV < 0.3 ? 0.55 : 1);
        if (Math.floor(this.phase / Math.PI) !== before) this.onStep && this.onStep(this.state === S.RUN);
      }

      this.hiccupT -= dt;
      if (this.hiccupT < 0 && !this.finished) { this.hiccupT = U.rand(7, 15) * (1.2 - this.drunk * 0.5); this.hic = 0.35; this.onEvent && this.onEvent('hiccup'); }
      if (this.hic > 0) this.hic -= dt;

      this._updatePose(dt);
    }

    // ------------------------------------------------------------------ poses
    _updatePose(dt) {
      const P = this.pose, T = this._basePose(), t = this.t, d = this.drunk, ph = this.phase;
      const sw = Math.sin(ph);
      let rate = 12, expr = 'drunk';
      const sway = d * (0.13 * U.noise(t * 0.75 + 11) + 0.06 * Math.sin(t * 1.7));

      switch (this.state) {
        case S.WALK: case S.IDLE: case S.ARRIVE: case S.TABLE: case S.PREVIEW: {
          const amp = Math.abs(this.speed) < 0.35 ? 0.55 : 1;
          T.lLift = Math.max(0, sw) * 0.85 * amp; T.rLift = Math.max(0, -sw) * 0.85 * amp;
          T.lOut = -2 + Math.max(0, sw) * 3 * d; T.rOut = 2 - Math.max(0, -sw) * 3 * d;
          T.bob = -Math.abs(sw) * 3 * amp;
          T.lean = sway + sw * 0.05 + (this.targetX - this.baseX) * (this.manual ? 0.1 : 0.06);
          T.hipX = sw * 3;
          T.laA = 0.16 + d * 0.1 + Math.max(0, -sw) * 0.22; T.laE = 0.25 + Math.max(0, -sw) * 0.55; T.laF = -sw;
          T.raA = 0.18 + d * 0.1 + Math.max(0, sw) * 0.22; T.raE = 0.35 + Math.max(0, sw) * 0.55; T.raF = sw;
          T.hTilt = -sway * 0.9 + U.noise(t * 0.6 + 2) * 0.18 * d;
          T.hNod = Math.sin(ph * 2) * 1.5 + U.noise(t * 0.5) * 3 * d;
          if (this.state === S.ARRIVE) { expr = 'happy'; T.laA = 0.9; T.raA = 0.9; T.laE = 0.6; T.raE = 0.6; }
          if (this.state === S.TABLE) { T.lean = (this.walkDirX || 0) * -0.08 + sway * 0.5; expr = 'happy'; }
          if (this.speed > 2.5 && this.state === S.WALK) expr = 'focus';
          break;
        }
        case S.RUN: {
          T.fwd = 0.38;
          T.lLift = Math.max(0, sw) * 1.4; T.rLift = Math.max(0, -sw) * 1.4;
          T.lOut = -3; T.rOut = 3;
          T.bob = -Math.abs(sw) * 9 + 3;
          T.lean = sw * 0.07 + sway * 0.4;
          T.hipX = sw * 4;
          T.laA = 0.55 + sw * 0.35; T.laE = 1.5 + sw * 0.4; T.laF = -sw;
          T.raA = 0.55 - sw * 0.35; T.raE = 1.5 - sw * 0.4; T.raF = sw;
          T.hTilt = sw * 0.08; T.hNod = 4;
          rate = 18; expr = 'shout';
          break;
        }
        case S.BACK: {
          T.fwd = -0.15;
          T.lLift = Math.max(0, sw) * 0.7; T.rLift = Math.max(0, -sw) * 0.7;
          T.bob = -Math.abs(sw) * 3;
          T.lean = Math.sin(t * 7) * 0.12;
          T.laA = 1.6 + Math.sin(t * 14) * 0.7; T.laE = 0.4; T.raA = 1.6 + Math.cos(t * 14) * 0.7; T.raE = 0.4;
          T.hTilt = Math.sin(t * 5) * 0.2; T.hNod = -4;
          rate = 16; expr = 'shock';
          break;
        }
        case S.STUMBLE: {
          const u = this.st / 1.15, fd = this.fallDir;
          T.lean = fd * 0.5 * Math.sin(u * Math.PI * 2.4) * (1 - u) + fd * 0.12 * (1 - u);
          T.fwd = 0.25 * Math.sin(u * Math.PI);
          T.lLift = fd > 0 ? Math.abs(Math.sin(u * 9)) * 0.8 : 0.1; T.rLift = fd < 0 ? Math.abs(Math.sin(u * 9)) * 0.8 : 0.1;
          T.lOut = -6 * (1 - u); T.rOut = 6 * (1 - u);
          T.laA = 1.7 + Math.sin(t * 19) * 0.7; T.laE = 0.6 + Math.sin(t * 23) * 0.5;
          T.raA = 1.7 + Math.cos(t * 17) * 0.7; T.raE = 0.6 + Math.cos(t * 21) * 0.5;
          T.hTilt = -fd * 0.35 * Math.sin(u * 7); T.hNod = 3;
          T.bob = -Math.abs(Math.sin(u * 9)) * 6;
          rate = 20; expr = 'shock';
          break;
        }
        case S.FALL: {
          const u = U.clamp(this.st / 0.55, 0, 1);
          T.fall = U.easeInCubic(u) * 1.48;
          T.laA = 2.2; T.laE = 0.3; T.raA = 2.2; T.raE = 0.3;
          T.lLift = 0.5; T.rLift = 0.1; T.hTilt = -this.fallDir * 0.3;
          rate = 30; expr = 'shock';
          break;
        }
        case S.DOWN: {
          const u = this.st;
          T.fall = 1.48 + Math.sin(u * 14) * Math.exp(-u * 6) * 0.06;
          T.laA = 1.3 + Math.sin(t * 3) * 0.08; T.laE = 0.8; T.raA = 0.9; T.raE = 1.2 + Math.sin(t * 4) * 0.2;
          T.lLift = 0.3; T.rLift = 0.6 + Math.sin(t * 2.5) * 0.15;
          T.hTilt = 0.2; T.hNod = 2;
          rate = 10; expr = 'dizzy';
          break;
        }
        case S.GETUP: {
          const u = U.clamp(this.st / 1.35, 0, 1);
          const e = u < 0.75 ? U.easeInOut(u / 0.75) : 1;
          const wob = u > 0.6 ? Math.sin((u - 0.6) * 22) * (1 - u) * 0.6 : 0;
          T.fall = 1.48 * (1 - e) + wob * 0.3;
          T.crouch = Math.sin(u * Math.PI) * 18;
          T.laA = 0.6 + (1 - u) * 1.2; T.laE = 0.4; T.raA = 0.5 + (1 - u) * 1.4; T.raE = 0.5;
          T.lLift = 0.2 * (1 - u); T.lOut = -4; T.rOut = 4;
          T.lean = wob * 0.4;
          T.hTilt = Math.sin(t * 6) * 0.15;
          rate = 14; expr = u < 0.6 ? 'pain' : 'drunk';
          break;
        }
        case S.WIN: {
          const tw = this.st;
          const jump = tw > 0.8 ? Math.max(0, Math.sin((tw - 0.8) * 7.5)) : 0;
          T.ground = -jump * 34;
          T.lLift = jump * 0.4; T.rLift = jump * 0.4; T.lOut = -6 - jump * 4; T.rOut = 6 + jump * 4;
          T.hipX = Math.sin(tw * 8) * 6;
          T.lean = Math.sin(tw * 4) * 0.08;
          const wave = Math.sin(tw * 9);
          // abre os braços primeiro, depois comemora pulando
          const open = tw < 0.8;
          T.laA = open ? 1.75 : 2.55 + wave * 0.25; T.laE = open ? 0 : -0.3 + wave * 0.3;
          T.raA = open ? 1.75 : 2.55 - wave * 0.25; T.raE = open ? 0 : -0.3 - wave * 0.3;
          T.hTilt = Math.sin(tw * 4.5) * 0.2; T.hNod = -2;
          T.bob = -jump * 4;
          rate = 16; expr = 'happy';
          break;
        }
        case S.SIT: {
          const u = U.clamp(this.st / 0.7, 0, 1);
          T.sit = U.easeInOut(u);
          // brinde: braço esquerdo levanta o copo até o do colega
          const toast = this.st > 1.2 && this.st < 3.2 ? Math.sin(((this.st - 1.2) / 2) * Math.PI) : 0;
          T.laA = 0.5 + toast * 1.7; T.laE = 1.5 - toast * 1.25;
          T.raA = 0.55 + Math.sin(t * 1.3) * 0.05; T.raE = 1.25;
          T.lean = Math.sin(t * 0.9) * 0.05 * d + (this.st > 3.4 ? Math.sin(t * 6) * 0.03 : 0);
          T.hTilt = -0.15 * toast + Math.sin(t * 0.8) * 0.1;
          T.hNod = this.st > 3.4 ? Math.abs(Math.sin(t * 7)) * -3 : 0; // gargalhada
          T.lOut = -4; T.rOut = 4;
          rate = 10; expr = 'happy';
          break;
        }
        case S.DOG: {
          // 0–2.1: nem percebe · 2.1–3.7: percebe o xixi · 3.7–5: sacode a perna
          const st = this.st, sd = this.dogSide;
          T.lean = sway * 0.6; T.hTilt = U.noise(t * 0.6) * 0.15;
          T.laA = 0.18 + d * 0.1; T.raA = 0.2 + d * 0.1; T.laE = 0.3; T.raE = 0.35;
          if (st > 2.1 && st < 3.7) {
            T.hTurn = sd * 0.95; T.hNod = 6; T.lean = -sd * 0.08;
            T.laA = 1.3 + Math.sin(t * 9) * 0.15; T.raA = 1.3 + Math.cos(t * 9) * 0.15; T.laE = 0.5; T.raE = 0.5;
            expr = 'shock';
          } else if (st >= 3.7) {
            const shake = 0.55 + 0.4 * Math.sin(t * 32);
            if (sd > 0) { T.rLift = shake; T.rOut = 9; } else { T.lLift = shake; T.lOut = -9; }
            T.lean = -sd * 0.12; T.hTurn = sd * 0.95; T.hNod = 4;
            T.laA = 1.0 + Math.sin(t * 20) * 0.3; T.raA = 1.0 + Math.cos(t * 20) * 0.3;
            expr = 'pain'; rate = 22;
          }
          break;
        }
        case S.SLEEP: {
          const u = U.clamp(this.st / 1.6, 0, 1);
          T.fall = U.easeInOut(u) * 1.5;
          T.laA = 0.6; T.laE = 1.2; T.raA = 1.9; T.raE = 1.6; T.lLift = 0.4; T.rLift = 0.15;
          T.bob = Math.sin(this.t * 1.6) * 1.5 * u;
          T.hTilt = 0.35;
          rate = 4; expr = u > 0.5 ? 'sleep' : 'dizzy';
          break;
        }
      }

      if (this.talk > 0 && !this.finished && this.state !== S.FALL && this.state !== S.DOWN && !(this.state === S.DOG && this.st > 2.1)) {
        T.hTurn = this.talkTurn * 0.9;
        if (expr === 'drunk') expr = 'talk';
      }
      if (this.hic > 0) T.hNod -= 6 * Math.sin((0.35 - this.hic) * 18);

      for (const k in T) {
        if (k === 'fall' && (this.state === S.FALL || this.state === S.DOWN)) { P[k] = T[k]; continue; }
        P[k] = U.damp(P[k], T[k], rate, dt);
      }
      this.expr = expr;

      // virar o corpo (costas <-> frente) com giro no eixo vertical
      const want = this.state === S.WIN || this.state === S.SIT || this.state === S.PREVIEW ? 'front' : 'back';
      if (want !== this.faceTarget) { this.faceTarget = want; this.turnT = 0; }
      if (this.turnT < 1) {
        this.turnT = Math.min(1, this.turnT + dt / 0.45);
        this.flip = Math.cos(this.turnT * Math.PI);
        this.facing = this.turnT >= 0.5 ? this.faceTarget : (this.faceTarget === 'front' ? 'back' : 'front');
      } else { this.flip = 1; this.facing = this.faceTarget; }
    }

    // ------------------------------------------------------------------ desenho
    /** pés em (sx, sy); pxPerMeter = escala da projeção; light 0..1 = luz do poste/bar sobre ele */
    draw(ctx, sx, sy, pxPerMeter, light = 0.4) {
      const P = this.pose;
      const k = pxPerMeter / 100;
      this.light = U.damp(this.light, light, 4, 1 / 60);

      // sombra de contato suave (no chão, fora da camada)
      const shrink = 1 + P.ground / 120;
      const shx = P.fall ? this.fallDir * Math.sin(P.fall) * 80 * k : 0;
      const sr = (36 + Math.sin(P.fall) * 60) * k * shrink;
      ctx.save(); ctx.translate(sx + shx, sy); ctx.scale(1, 0.24);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
      sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(0.6, 'rgba(0,0,0,0.3)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, sr, 0, 7); ctx.fill(); ctx.restore();

      // camada própria do personagem
      const LW = Math.ceil(520 * k), LH = Math.ceil(330 * k);
      const ox = LW / 2, oy = Math.ceil(275 * k);
      const L = this.layer, lc = this.lctx;
      if (L.width < LW || L.height < LH || L.width > LW * 2.2) { L.width = Math.ceil(LW * 1.25); L.height = Math.ceil(LH * 1.25); }
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'source-over';
      lc.clearRect(0, 0, L.width, L.height);
      lc.translate(ox, oy);
      const gs = this.gender === 'f' ? 0.95 : 1;
      lc.scale(k * gs * Math.max(0.06, Math.abs(this.flip)), k * gs);
      lc.translate(0, P.ground);
      if (P.fall) { const px = this.fallDir * 16; lc.translate(px, 0); lc.rotate(this.fallDir * P.fall); lc.translate(-px, 0); }
      lc.rotate(P.lean);
      lc.translate(0, P.crouch * 0.6);

      const R = this._rig();
      if (this.facing === 'front') this._drawFront(lc, R); else this._drawBack(lc, R);

      const m = lc.getTransform();
      const hp = m.transformPoint(new DOMPoint(R.head.x, R.head.y - 20));
      const hc = m.transformPoint(new DOMPoint(R.head.x, R.head.y));
      this.headScreen = { x: hp.x + sx - ox, y: hp.y + sy - oy };
      this.headCenter = { x: hc.x + sx - ox, y: hc.y + sy - oy, r: 16 * k };

      // ---- luz da cena sobre o corpo
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'source-atop';
      const lt = this.light;
      lc.fillStyle = `rgba(18,22,52,${0.27 - lt * 0.15})`;              // ambiente noturno frio
      lc.fillRect(0, 0, L.width, L.height);
      const top = oy - 230 * k;
      const wg = lc.createRadialGradient(ox, top, 0, ox, top, 300 * k);  // luz quente de cima (poste)
      wg.addColorStop(0, `rgba(255,186,110,${0.10 + lt * 0.2})`); wg.addColorStop(1, 'rgba(255,186,110,0)');
      lc.fillStyle = wg; lc.fillRect(0, 0, L.width, L.height);
      const bg = lc.createLinearGradient(0, oy - 80 * k, 0, oy);           // pernas mais escuras perto do chão
      bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.3)');
      lc.fillStyle = bg; lc.fillRect(0, 0, L.width, L.height);
      lc.globalCompositeOperation = 'source-over';

      ctx.drawImage(L, 0, 0, LW, LH, sx - ox, sy - oy, LW, LH);
      // sujeira de pixel: mantém nitidez
    }

    _rig() {
      const P = this.pose, fwd = P.fwd;
      const hipY = -92 + P.bob + P.crouch * 0.4 + P.sit * 44;
      const shY = hipY - 52 * Math.cos(fwd) + Math.max(0, fwd) * 6 + P.sit * 3;
      const shX = Math.sin(P.lean * 0.5) * 2;
      const neck = { x: shX * 1.3, y: shY - 4 };
      const head = { x: neck.x + Math.sin(P.hTilt) * 14, y: neck.y - 15 + P.hNod + Math.max(0, fwd) * 4 };
      const leg = (side, lift, out) => {
        const hip = { x: side * 10 + P.hipX * 0.4, y: hipY };
        const foot = { x: side * 12 + out + P.hipX * 0.1, y: -lift * 24 };
        let knee;
        if (P.sit > 0.01) {
          const kStand = { x: (hip.x + foot.x) / 2 + side * 3, y: (hip.y + foot.y) / 2 };
          const kSit = { x: side * 14, y: hipY + 9 };
          knee = { x: U.lerp(kStand.x, kSit.x, P.sit), y: U.lerp(kStand.y, kSit.y, P.sit) };
        } else {
          const mx = (hip.x + foot.x) / 2, my = (hip.y + foot.y) / 2;
          knee = { x: mx + side * (3 + lift * 4 + this.drunk * 2), y: my - lift * 6 + P.crouch * 0.3 };
        }
        return { hip, knee, foot, lift, side };
      };
      const arm = (side, a, e) => {
        const sh = { x: side * (this.gender === 'f' ? 18.5 : 21) + shX, y: shY + 5 };
        const el = { x: sh.x + Math.sin(a) * 29 * side, y: sh.y + Math.cos(a) * 29 };
        const hd = { x: el.x + Math.sin(a + e) * 26 * side, y: el.y + Math.cos(a + e) * 26 };
        return { sh, el, hd, a, e, side };
      };
      return { hipY, shY, shX, neck, head, lLeg: leg(-1, P.lLift, P.lOut), rLeg: leg(1, P.rLift, P.rOut), lArm: arm(-1, P.laA, P.laE), rArm: arm(1, P.raA, P.raE) };
    }

    // ------------------------------------------------------------------ partes
    _drawLeg(ctx, L, front) {
      if (this.gender === 'f') return this._drawLegF(ctx, L, front);
      const ankle = { x: L.foot.x, y: L.foot.y - 9 };
      const sitting = this.pose.sit > 0.5;
      if (front && sitting) {
        // sentado de frente: canela vertical e coxa em escorço
        capsule(ctx, L.knee, ankle, 7.6, 5.6, C.pants, L.side);
        this._shoe(ctx, L, true);
        capsule(ctx, L.hip, L.knee, 10, 8.6, C.pants, L.side);
        blob(ctx, L.knee.x, L.knee.y, 7, 6, 'rgba(255,240,220,0.10)');
        return;
      }
      capsule(ctx, L.hip, L.knee, 9.6, 7.8, C.pants, L.side);
      capsule(ctx, L.knee, ankle, 7.8, 5.8, C.pants, L.side);
      // dobras atrás do joelho e calça embolada no tornozelo
      softLine(ctx, [L.knee.x - 6, L.knee.y - 2, L.knee.x, L.knee.y + 2, L.knee.x + 6, L.knee.y - 1], 1.4, 'rgba(15,10,6,0.35)');
      softLine(ctx, [L.knee.x - 5, L.knee.y + 5, L.knee.x + 1, L.knee.y + 7, L.knee.x + 5, L.knee.y + 4], 1, 'rgba(255,240,220,0.10)');
      softLine(ctx, [ankle.x - 6, ankle.y - 8, ankle.x, ankle.y - 5, ankle.x + 6, ankle.y - 7], 1.2, 'rgba(15,10,6,0.3)');
      softLine(ctx, [ankle.x - 6, ankle.y - 3, ankle.x, ankle.y - 1, ankle.x + 6, ankle.y - 3], 1.2, 'rgba(15,10,6,0.25)');
      // sujeira de quem já caiu
      blob(ctx, L.knee.x + L.side * 2, L.knee.y + 8, 6, 4, 'rgba(120,100,70,0.35)');
      // calça molhada de xixi de cachorro
      if (this.wetLeg === L.side) {
        blob(ctx, U.lerp(L.knee.x, ankle.x, 0.55), U.lerp(L.knee.y, ankle.y, 0.55), 7, 14, 'rgba(20,14,6,0.45)');
        blob(ctx, U.lerp(L.knee.x, ankle.x, 0.85), U.lerp(L.knee.y, ankle.y, 0.85), 6, 6, 'rgba(20,14,6,0.4)');
      }
      this._shoe(ctx, L, front);
    }

    _shoe(ctx, L, front) {
      const f = L.foot, lift = L.lift;
      if (!front && lift > 0.12) {
        // calcanhar levantado: aparece a sola gasta
        const h = 6 + lift * 16;
        ctx.save(); ctx.translate(f.x, f.y - 2);
        const g = ctx.createLinearGradient(0, -h, 0, 4);
        g.addColorStop(0, C.sole.l); g.addColorStop(1, C.sole.d);
        ctx.fillStyle = g;
        U.roundRect(ctx, -8.5, -h + 2, 17, h + 2, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) { const y = -h + 2 + ((h + 2) * i) / 5; ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(6, y); ctx.stroke(); }
        ctx.restore();
      }
      // corpo do tênis (calcanhar visto de trás / bico visto de frente)
      ctx.save(); ctx.translate(f.x, f.y);
      const w = front ? 10.5 : 9.5, h = front ? 10 : 11;
      const g = ctx.createLinearGradient(-w, 0, w, 0);
      g.addColorStop(0, C.shoe.d); g.addColorStop(0.45, C.shoe.b); g.addColorStop(0.75, C.shoe.l); g.addColorStop(1, C.shoe.d);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w, -1); ctx.quadraticCurveTo(-w - 0.5, -h, -w * 0.4, -h - 1.5);
      ctx.lineTo(w * 0.4, -h - 1.5); ctx.quadraticCurveTo(w + 0.5, -h, w, -1); ctx.closePath(); ctx.fill();
      // sola de borracha
      ctx.fillStyle = C.sole.b; U.roundRect(ctx, -w - 1, -3.5, w * 2 + 2, 4.5, 2); ctx.fill();
      // sujeira e reforço do calcanhar
      blob(ctx, -2, -4, 6, 3, 'rgba(70,55,40,0.4)');
      if (!front) { ctx.fillStyle = 'rgba(40,36,32,0.55)'; U.roundRect(ctx, -3.5, -h - 1, 7, 6, 2); ctx.fill(); }
      else { softLine(ctx, [-4, -h + 2, 0, -h + 4, 4, -h + 2], 1.2, 'rgba(230,225,215,0.7)'); softLine(ctx, [-4, -h + 5, 0, -h + 7, 4, -h + 5], 1.2, 'rgba(230,225,215,0.7)'); }
      ctx.restore();
      if (L.side > 0) { // cadarço desamarrado arrastando
        softLine(ctx, [f.x + 3, f.y - 7, f.x + 10, f.y + 1 + Math.sin(this.t * 9) * 2, f.x + 15, f.y - 0.5], 1, 'rgba(210,205,195,0.8)');
      }
    }

    _drawArm(ctx, A, front) {
      if (this.gender === 'f') return this._drawArmF(ctx, A, front);
      const sl = { x: U.lerp(A.sh.x, A.el.x, 0.46), y: U.lerp(A.sh.y, A.el.y, 0.46) };
      const wr = { x: U.lerp(A.el.x, A.hd.x, 0.86), y: U.lerp(A.el.y, A.hd.y, 0.86) };
      capsule(ctx, A.sh, A.el, 6.6, 5.4, this.SK, A.side);
      capsule(ctx, A.el, wr, 5.4, 3.9, this.SK, A.side);
      // pelos e veias do antebraço
      ctx.strokeStyle = 'rgba(40,25,18,0.35)'; ctx.lineWidth = 0.6;
      for (let i = 0; i < 7; i++) {
        const u = 0.15 + i * 0.1, px = U.lerp(A.el.x, wr.x, u) + (i % 2 ? 1.5 : -1.5), py = U.lerp(A.el.y, wr.y, u);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 1.2, py + 1.6); ctx.stroke();
      }
      // manga curta amassada
      capsule(ctx, A.sh, sl, 9, 7.6, C.shirt, A.side);
      softLine(ctx, [sl.x - 6, sl.y - 1, sl.x, sl.y + 1.5, sl.x + 6, sl.y - 1], 1.2, 'rgba(60,50,35,0.35)');
      this._hand(ctx, A, wr, front);
    }

    _hand(ctx, A, wr, front) {
      const ang = Math.atan2(A.hd.y - wr.y, A.hd.x - wr.x);
      const holdsBottle = A.side > 0 && ![S.WIN, S.SIT].includes(this.state);
      const holdsGlass = A.side < 0 && this.state === S.SIT;
      ctx.save(); ctx.translate(wr.x, wr.y); ctx.rotate(ang - Math.PI / 2);
      if (holdsBottle) this._bottle(ctx);
      if (holdsGlass) { ctx.save(); ctx.rotate(-(ang - Math.PI / 2)); this._beerGlass(ctx, 0, 6); ctx.restore(); }
      // dorso da mão + dedos
      const g = ctx.createLinearGradient(-5, 0, 5, 0);
      g.addColorStop(0, this.SK.d); g.addColorStop(0.5, this.SK.b); g.addColorStop(1, this.SK.l);
      ctx.fillStyle = g;
      U.roundRect(ctx, -4.8, -1, 9.6, 10, 4); ctx.fill();
      for (let i = 0; i < 4; i++) { U.roundRect(ctx, -4.4 + i * 2.3, 7, 2.3, holdsBottle || holdsGlass ? 4 : 6, 1.1); ctx.fill(); }
      ctx.fillStyle = 'rgba(60,35,25,0.35)';
      for (let i = 0; i < 4; i++) ctx.fillRect(-4 + i * 2.3, 8.5, 1.4, 0.6);
      ctx.restore();
    }

    _bottle(ctx) {
      // long neck de vidro verde segurada PELO GARGALO: o punho fecha no gargalo e o corpo pende para baixo
      ctx.save(); ctx.translate(0.3, 7); ctx.rotate(0.12 + Math.sin(this.t * 3.1) * 0.06);
      const g = ctx.createLinearGradient(-3.6, 0, 3.6, 0);
      g.addColorStop(0, C.glass.d); g.addColorStop(0.3, C.glass.l); g.addColorStop(0.55, C.glass.b); g.addColorStop(1, C.glass.d);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-1.5, -6); ctx.lineTo(1.5, -6);                      // boca
      ctx.lineTo(1.6, 9); ctx.quadraticCurveTo(3.6, 11.5, 3.6, 16);   // ombro
      ctx.lineTo(3.6, 31); ctx.quadraticCurveTo(3.6, 33, 0, 33); ctx.quadraticCurveTo(-3.6, 33, -3.6, 31);
      ctx.lineTo(-3.6, 16); ctx.quadraticCurveTo(-3.6, 11.5, -1.6, 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(200,150,50,0.55)'; ctx.fillRect(-3.4, 28, 6.8, 4.5);             // restinho de cerveja no fundo
      ctx.fillStyle = 'rgba(232,220,190,0.9)'; ctx.fillRect(-3.6, 18, 7.2, 7);               // rótulo
      ctx.fillStyle = 'rgba(180,40,40,0.8)'; ctx.fillRect(-3.6, 20, 7.2, 1.6);
      ctx.fillStyle = 'rgba(232,220,190,0.9)'; ctx.fillRect(-1.6, 10.5, 3.2, 2.2);           // gargantilha
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-2.4, 15, 0.9, 13); ctx.fillRect(-0.9, -4, 0.6, 12);
      ctx.fillStyle = '#7a6f62'; ctx.fillRect(-1.7, -7, 3.4, 1.4);                            // boca sem tampa
      ctx.restore();
    }

    _beerGlass(ctx, x, y) {
      // copo americano com cerveja e espuma
      ctx.save(); ctx.translate(x, y - 22);
      const g = ctx.createLinearGradient(-5, 0, 5, 0);
      g.addColorStop(0, 'rgba(190,130,30,0.95)'); g.addColorStop(0.5, 'rgba(245,190,70,0.95)'); g.addColorStop(1, 'rgba(180,120,25,0.95)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.lineTo(5.5, 0); ctx.lineTo(4.5, 16); ctx.lineTo(-4.5, 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(250,245,230,0.95)'; U.roundRect(ctx, -6, -3, 12, 4.5, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-5 + i * 2, 3); ctx.lineTo(-4.2 + i * 1.7, 15); ctx.stroke(); }
      ctx.restore();
    }

    _pantsSeat(ctx, R, front) {
      const y = R.hipY;
      const g = ctx.createLinearGradient(-21, 0, 21, 0);
      g.addColorStop(0, C.pants.d); g.addColorStop(0.5, C.pants.b); g.addColorStop(0.8, C.pants.l); g.addColorStop(1, C.pants.d);
      ctx.fillStyle = g;
      U.roundRect(ctx, -21, y - 9, 42, 26, 11); ctx.fill();
      if (!front) {
        ctx.strokeStyle = 'rgba(15,10,6,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y - 6); ctx.quadraticCurveTo(0.5, y + 6, 0, y + 16); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,220,0.12)';
        U.roundRect(ctx, -15, y, 10, 9, 2); ctx.stroke(); U.roundRect(ctx, 5, y, 10, 9, 2); ctx.stroke();
        // carteira marcando o bolso
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; U.roundRect(ctx, 6, y + 1, 8, 7, 1.5); ctx.fill();
        // cueca aparecendo
        ctx.fillStyle = '#3e5f8c'; U.roundRect(ctx, -19, y - 13, 15, 5, 2); ctx.fill();
      }
      ctx.fillStyle = '#1e1a16'; ctx.fillRect(-21, y - 9, 42, 3.5);
      if (front) { ctx.fillStyle = '#8a7a52'; ctx.fillRect(-3.5, y - 10, 7, 5.5); }
    }

    _torso(ctx, R, front) {
      if (this.gender === 'f') return this._torsoF(ctx, R, front);
      const y0 = R.hipY + 6, y1 = R.shY, sx = R.shX;
      this._pantsSeat(ctx, R, front);
      const hemL = y0 + (front ? -2 : 3), hemR = y0 - (front ? -3 : 9);
      ctx.beginPath();
      ctx.moveTo(-21, hemL);
      ctx.quadraticCurveTo(-10, hemL + 5, 0, hemL - 1);
      ctx.quadraticCurveTo(8, hemR + 3, 20, hemR);
      ctx.quadraticCurveTo(24, (hemR + y1) / 2, 22 + sx, y1 + 7);
      ctx.quadraticCurveTo(20 + sx, y1 - 2, 8 + sx, y1 - 3);
      ctx.lineTo(-8 + sx, y1 - 3);
      ctx.quadraticCurveTo(-20 + sx, y1 - 2, -22 + sx, y1 + 7);
      ctx.quadraticCurveTo(-24, (hemL + y1) / 2, -21, hemL);
      ctx.closePath();
      const g = ctx.createLinearGradient(-23, 0, 23, 0);
      g.addColorStop(0, C.shirt.d); g.addColorStop(0.3, C.shirt.b); g.addColorStop(0.62, C.shirt.l); g.addColorStop(1, C.shirt.d);
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      // volume vertical (ombros mais claros, cintura em sombra)
      const vg = ctx.createLinearGradient(0, y1, 0, y0 + 6);
      vg.addColorStop(0, 'rgba(255,250,235,0.18)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,20,10,0.25)');
      ctx.fillStyle = vg; ctx.fillRect(-30, y1 - 5, 60, y0 - y1 + 15);
      if (!front) {
        blob(ctx, -9 + sx, y1 + 12, 9, 7, 'rgba(255,250,235,0.16)');      // escápulas
        blob(ctx, 9 + sx, y1 + 12, 9, 7, 'rgba(255,250,235,0.16)');
        softLine(ctx, [sx, y1 + 6, sx * 0.5, (y1 + y0) / 2, 0, y0], 2.2, 'rgba(60,50,30,0.16)'); // coluna
        blob(ctx, sx * 0.5, y1 + 22, 11, 16, 'rgba(110,95,55,0.30)');     // suor
      } else {
        blob(ctx, 2, y0 - 12, 10, 9, 'rgba(255,250,235,0.14)');          // barriga
        blob(ctx, -9, y1 + 22, 6, 5, 'rgba(110,70,30,0.40)');
        blob(ctx, 11, y1 + 35, 4, 6, 'rgba(110,70,30,0.35)');
      }
      // manchas de bebida e gordura
      blob(ctx, -12, y0 - 14, 5.5, 4, 'rgba(110,75,35,0.38)', 0.4);
      blob(ctx, 13, y0 - 5, 6, 3, 'rgba(110,75,35,0.32)', -0.3);
      blob(ctx, 9, y1 + 30, 3.5, 2.5, 'rgba(90,60,30,0.35)');
      // dobras de tecido amarrotado (sombra + realce)
      const folds = [[-17, y0 - 4, -6, y0 - 15, 5], [3, y0 - 2, 15, y0 - 14, -5], [-15, y1 + 13, -3, y1 + 20, 4], [5, y1 + 23, 17, y1 + 15, 3], [-6, y0 - 22, 6, y0 - 26, 2]];
      folds.forEach(([a, b, c, d, e]) => {
        softLine(ctx, [a, b, (a + c) / 2 + e, (b + d) / 2 + e, c, d], 2.4, 'rgba(50,40,25,0.22)');
        softLine(ctx, [a + 1, b + 2.2, (a + c) / 2 + e + 1, (b + d) / 2 + e + 2.2, c + 1, d + 2.2], 1.6, 'rgba(255,250,235,0.16)');
      });
      ctx.restore();
      // gola
      if (front) {
        ctx.fillStyle = this.SKR.b; ctx.beginPath(); ctx.moveTo(-7 + sx, y1 - 3); ctx.lineTo(7 + sx, y1 - 3); ctx.lineTo(sx, y1 + 10); ctx.closePath(); ctx.fill();
        // pelos do peito
        ctx.strokeStyle = 'rgba(30,20,15,0.5)'; ctx.lineWidth = 0.6;
        for (let i = 0; i < 8; i++) { const px = sx - 3 + (i % 4) * 2, py = y1 + 1 + Math.floor(i / 4) * 3; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 1, py + 1.5); ctx.stroke(); }
        ctx.fillStyle = C.shirt.l;
        ctx.beginPath(); ctx.moveTo(-8 + sx, y1 - 3); ctx.lineTo(-1 + sx, y1 + 9); ctx.lineTo(-11 + sx, y1 + 3); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(8 + sx, y1 - 3); ctx.lineTo(1 + sx, y1 + 9); ctx.lineTo(11 + sx, y1 + 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d8d0b8';
        [[-1, y1 + 14], [-2, y1 + 25], [-4, y1 + 35]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x + sx, y, 1.6, 0, 7); ctx.fill(); });
      } else {
        ctx.fillStyle = C.shirt.d; ctx.beginPath(); ctx.ellipse(sx * 1.2, y1 - 2, 9, 3.2, 0, 0, 7); ctx.fill();
      }
      // sombra da camisa sobre a calça
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-20, hemL + 1, 20, 2.5);
    }

    _drawBack(ctx, R) {
      const P = this.pose;
      if (P.laF > 0.2) this._drawArm(ctx, R.lArm, false);
      if (P.raF > 0.2) this._drawArm(ctx, R.rArm, false);
      this._drawLeg(ctx, R.lLeg, false);
      this._drawLeg(ctx, R.rLeg, false);
      this._torso(ctx, R, false);
      this._head(ctx, R, false);
      if (P.laF <= 0.2) this._drawArm(ctx, R.lArm, false);
      if (P.raF <= 0.2) this._drawArm(ctx, R.rArm, false);
    }
    _drawFront(ctx, R) {
      this._drawLeg(ctx, R.lLeg, true);
      this._drawLeg(ctx, R.rLeg, true);
      this._torso(ctx, R, true);
      this._head(ctx, R, true);
      this._drawArm(ctx, R.lArm, true);
      this._drawArm(ctx, R.rArm, true);
    }

    // ------------------------------------------------------------------ cabeça
    _head(ctx, R, front) {
      const P = this.pose, h = R.head;
      capsule(ctx, R.neck, { x: h.x * 0.6 + R.neck.x * 0.4, y: h.y + 9 }, 6.4, 6, this.SKR, 1);
      if (!front) { // rugas da nuca queimada de sol
        softLine(ctx, [R.neck.x - 4, R.neck.y - 6, R.neck.x, R.neck.y - 5, R.neck.x + 4, R.neck.y - 6], 0.8, 'rgba(70,30,20,0.4)');
        softLine(ctx, [R.neck.x - 4, R.neck.y - 9, R.neck.x, R.neck.y - 8, R.neck.x + 4, R.neck.y - 9], 0.8, 'rgba(70,30,20,0.35)');
      }
      ctx.save();
      ctx.translate(h.x, h.y); ctx.rotate(P.hTilt);
      const turn = front ? 0 : P.hTurn;
      const prof = Math.abs(turn) > 0.35, dir = U.sign(turn);
      // orelhas
      const fem = this.gender === 'f';
      const view = front ? 'front' : prof ? 'profile' : 'back';
      if (fem) this._hairBackF(ctx, view, dir);
      if (!prof && !fem) [-1, 1].forEach((sd) => this._ear(ctx, sd * 12.5, 1, sd));
      // crânio
      const sk = ctx.createRadialGradient(-3, -5, 2, 0, 0, 16);
      sk.addColorStop(0, this.SK.l); sk.addColorStop(0.6, this.SK.b); sk.addColorStop(1, this.SK.d);
      ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(0, 0, 12.6, 14.8, 0, 0, 7); ctx.fill();

      if (front) this._face(ctx);
      else if (prof) this._profile(ctx, dir);
      if (fem) this._hairF(ctx, view, dir); else this._hair(ctx, view, dir);
      ctx.restore();

      if (this.state === S.DOWN || (this.state === S.GETUP && this.st < 0.9)) {
        // tontura: pontinhos de brilho girando (sem estrelinha de desenho)
        for (let i = 0; i < 5; i++) {
          const a = this.t * 4 + (i * Math.PI * 2) / 5;
          blob(ctx, h.x + Math.cos(a) * 22, h.y - 18 + Math.sin(a) * 6, 3, 3, 'rgba(255,240,180,0.85)');
        }
      }
    }

    // ================================================================ MULHER
    _drawLegF(ctx, L, front) {
      const ankle = { x: L.foot.x, y: L.foot.y - 9 };
      const sitting = this.pose.sit > 0.5;
      if (front && sitting) {
        capsule(ctx, L.knee, ankle, 6, 4.4, this.SK, L.side);
        this._footF(ctx, L, true);
        capsule(ctx, L.hip, L.knee, 8.6, 6.8, this.SK, L.side);
        return;
      }
      capsule(ctx, L.hip, L.knee, 8.4, 6.2, this.SK, L.side);
      capsule(ctx, L.knee, ankle, 6.2, 4.2, this.SK, L.side);
      // joelho ralado do tombo
      blob(ctx, L.knee.x + L.side * 1.5, L.knee.y + 2, 4.5, 3.5, 'rgba(170,50,40,0.45)');
      blob(ctx, U.lerp(L.knee.x, ankle.x, 0.6), U.lerp(L.knee.y, ankle.y, 0.6), 4, 6, 'rgba(110,90,60,0.25)');
      if (this.wetLeg === L.side) {
        blob(ctx, U.lerp(L.knee.x, ankle.x, 0.65), U.lerp(L.knee.y, ankle.y, 0.65), 5, 10, 'rgba(230,200,90,0.35)');
      }
      this._footF(ctx, L, front);
    }

    _footF(ctx, L, front) {
      // descalça: calcanhar, tornozelo e sola encardida da rua
      const f = L.foot, lift = L.lift, sk = this.SK;
      ctx.save(); ctx.translate(f.x, f.y);
      const g = ctx.createLinearGradient(-6, 0, 6, 0);
      g.addColorStop(0, sk.d); g.addColorStop(0.55, sk.b); g.addColorStop(1, sk.l);
      if (front) {
        // peito do pé e dedos com esmalte vermelho
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-5, -12); ctx.quadraticCurveTo(-7.5, -2, -6.5, 0.5); ctx.lineTo(6.5, 0.5); ctx.quadraticCurveTo(7.5, -2, 5, -12); ctx.closePath(); ctx.fill();
        for (let i = 0; i < 5; i++) {
          const tx = -5.4 + i * 2.6, r = i === 0 ? 1.7 : 1.3;
          ctx.fillStyle = sk.b; ctx.beginPath(); ctx.ellipse(tx, 0.4, r, 1.7, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#b0142c'; ctx.beginPath(); ctx.ellipse(tx, -0.2, r * 0.6, 0.8, 0, 0, 7); ctx.fill();
        }
        blob(ctx, 0, 0.5, 7, 2, 'rgba(40,30,20,0.45)');
      } else if (lift > 0.12) {
        // pé levantado: aparece a sola inteira, preta de sujeira, com os dedos
        const h = 9 + lift * 13;
        const sg = ctx.createLinearGradient(0, -h - 4, 0, 2);
        sg.addColorStop(0, '#6e5442'); sg.addColorStop(0.5, '#4a382b'); sg.addColorStop(1, '#2a2019');
        ctx.fillStyle = sk.b; ctx.beginPath(); ctx.ellipse(0, -h * 0.4, 5.6, h * 0.55, 0, 0, 7); ctx.fill(); // borda do pé
        ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(0, -h * 0.4, 4.6, h * 0.5, 0, 0, 7); ctx.fill();
        for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#3a2b21' : '#4a382b'; ctx.beginPath(); ctx.arc(-3.6 + i * 1.8, 1 + Math.abs(i - 2) * -0.5, i === 0 ? 1.5 : 1.1, 0, 7); ctx.fill(); }
      } else {
        // calcanhar no chão visto de trás
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(-4.6, -10); ctx.quadraticCurveTo(-6.4, -3, -5.2, 0.5); ctx.quadraticCurveTo(0, 2.2, 5.2, 0.5); ctx.quadraticCurveTo(6.4, -3, 4.6, -10); ctx.closePath(); ctx.fill();
        softLine(ctx, [0, -10, 0.4, -6, 0, -2], 1.1, 'rgba(80,45,30,0.35)'); // tendão
        blob(ctx, 0, -0.5, 5.5, 2.2, 'rgba(45,32,22,0.6)');                   // sola suja aparecendo
      }
      // osso do tornozelo
      blob(ctx, L.side * 3.4, -10, 2, 2, 'rgba(255,225,200,0.25)');
      ctx.restore();
    }

    _drawArmF(ctx, A, front) {
      const wr = { x: U.lerp(A.el.x, A.hd.x, 0.86), y: U.lerp(A.el.y, A.hd.y, 0.86) };
      capsule(ctx, A.sh, A.el, 5.4, 4.4, this.SK, A.side);
      capsule(ctx, A.el, wr, 4.4, 3.2, this.SK, A.side);
      // pulseiras douradas
      const bx = U.lerp(A.el.x, wr.x, 0.82), by = U.lerp(A.el.y, wr.y, 0.82);
      ctx.strokeStyle = 'rgba(230,190,90,0.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(bx, by, 3.8, 1.4, Math.atan2(wr.y - A.el.y, wr.x - A.el.x) + Math.PI / 2, 0, 7); ctx.stroke();
      this._handF(ctx, A, wr, front);
    }

    _handF(ctx, A, wr, front) {
      const ang = Math.atan2(A.hd.y - wr.y, A.hd.x - wr.x);
      const free = ![S.WIN, S.SIT].includes(this.state);
      const holdsBottle = A.side > 0 && free;
      const holdsHeels = A.side < 0 && this.state !== S.SIT;
      const holdsGlass = A.side < 0 && this.state === S.SIT;
      ctx.save(); ctx.translate(wr.x, wr.y); ctx.rotate(ang - Math.PI / 2);
      if (holdsBottle) this._bottle(ctx);
      if (holdsGlass) { ctx.save(); ctx.rotate(-(ang - Math.PI / 2)); this._beerGlass(ctx, 0, 6); ctx.restore(); }
      if (holdsHeels) { ctx.save(); ctx.rotate(-(ang - Math.PI / 2)); this._heels(ctx); ctx.restore(); }
      const g = ctx.createLinearGradient(-4, 0, 4, 0);
      g.addColorStop(0, this.SK.d); g.addColorStop(0.5, this.SK.b); g.addColorStop(1, this.SK.l);
      ctx.fillStyle = g; U.roundRect(ctx, -3.8, -1, 7.6, 8.5, 3.5); ctx.fill();
      for (let i = 0; i < 4; i++) { U.roundRect(ctx, -3.5 + i * 1.85, 6, 1.8, holdsBottle || holdsGlass || holdsHeels ? 3.5 : 5.5, 0.9); ctx.fill(); }
      ctx.fillStyle = '#b0142c'; // unhas pintadas (descascando)
      for (let i = 0; i < 4; i++) if (i !== 2) ctx.fillRect(-3.3 + i * 1.85, holdsBottle || holdsGlass || holdsHeels ? 8.6 : 10.6, 1.3, 0.9);
      ctx.restore();
    }

    _heels(ctx) {
      // par de scarpins de verniz vermelho pendurados pelo calcanhar entre os dedos (bico para baixo)
      const t = this.t, sw = Math.sin(t * 4.2) * 0.16 + this.pose.lean * -0.5;
      const one = (dx, ph, back) => {
        ctx.save(); ctx.translate(dx, 5); ctx.rotate(sw * ph + (back ? 0.18 : -0.05)); ctx.scale(1.15, 1.15);
        // desenhado "em pé" (x = bico, y = para cima) e girado ~100° para pendurar pelo calcanhar
        ctx.rotate(Math.PI / 2 + 0.12); ctx.translate(0, 15);   // calcanhar (0,-15) fica nos dedos
        const Y = (y) => -y;
        // salto agulha (fino, saindo do calcanhar)
        ctx.fillStyle = back ? '#3a0710' : '#5a0b18';
        ctx.beginPath(); ctx.moveTo(-0.4, Y(9.5)); ctx.lineTo(3.4, Y(9)); ctx.lineTo(2.1, Y(0.6)); ctx.lineTo(1.3, Y(0.6)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#111'; ctx.fillRect(1.1, Y(0.7), 1.2, 1);
        // sola
        ctx.fillStyle = '#2a1a14';
        ctx.beginPath(); ctx.moveTo(-0.6, Y(9.8)); ctx.quadraticCurveTo(9, Y(6.5), 15, Y(1.2)); ctx.quadraticCurveTo(20, Y(-0.4), 24.6, Y(0.6)); ctx.lineTo(24.4, Y(1.8)); ctx.quadraticCurveTo(19, Y(1.1), 15, Y(2.4)); ctx.quadraticCurveTo(9, Y(7.8), -0.4, Y(11)); ctx.closePath(); ctx.fill();
        // corpo de verniz
        const g = ctx.createLinearGradient(0, Y(16), 0, Y(0));
        g.addColorStop(0, back ? '#8e0c22' : '#c3142f'); g.addColorStop(0.55, back ? '#6d0918' : '#9c0e25'); g.addColorStop(1, back ? '#4a0610' : '#6a0818');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-0.6, Y(10.6)); ctx.lineTo(-0.4, Y(15)); ctx.quadraticCurveTo(1, Y(16.2), 3, Y(15.6));     // contraforte do calcanhar
        ctx.quadraticCurveTo(9, Y(10.2), 15, Y(8.2));                                                     // linha da boca do sapato
        ctx.quadraticCurveTo(22, Y(6.4), 25, Y(2.6)); ctx.quadraticCurveTo(25.6, Y(1), 24.4, Y(1.4));     // bico fino
        ctx.quadraticCurveTo(19, Y(1.4), 15, Y(2.6)); ctx.quadraticCurveTo(8.5, Y(7.6), -0.6, Y(10.6)); ctx.closePath(); ctx.fill();
        // forro claro aparecendo pela boca do sapato
        ctx.fillStyle = back ? '#b99a84' : '#e6cbb3';
        ctx.beginPath(); ctx.moveTo(1, Y(15.2)); ctx.quadraticCurveTo(2.6, Y(15.4), 3.4, Y(14.9)); ctx.quadraticCurveTo(9, Y(10), 14.6, Y(8.1));
        ctx.quadraticCurveTo(9, Y(8.9), 3, Y(13)); ctx.closePath(); ctx.fill();
        // brilho do verniz
        ctx.strokeStyle = 'rgba(255,235,235,0.7)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(16, Y(6.6)); ctx.quadraticCurveTo(20.5, Y(5.2), 23.4, Y(2.8)); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,235,235,0.35)';
        ctx.beginPath(); ctx.moveTo(0.4, Y(11.5)); ctx.lineTo(0.6, Y(14.4)); ctx.stroke();
        ctx.restore();
      };
      one(2.2, -0.8, true);
      one(-1.2, 1, false);
    }

    _torsoF(ctx, R, front) {
      const y0 = R.hipY + 6, y1 = R.shY, sx = R.shX, hy = R.hipY;
      // saia justa escura (até o meio da coxa)
      ctx.beginPath();
      ctx.moveTo(-17, hy - 12); ctx.lineTo(17, hy - 12);
      ctx.quadraticCurveTo(22, hy + 4, 21, hy + 26); ctx.quadraticCurveTo(0, hy + 30, -21, hy + 26);
      ctx.quadraticCurveTo(-22, hy + 4, -17, hy - 12); ctx.closePath();
      let g = ctx.createLinearGradient(-22, 0, 22, 0);
      g.addColorStop(0, C.skirt.d); g.addColorStop(0.45, C.skirt.b); g.addColorStop(0.75, C.skirt.l); g.addColorStop(1, C.skirt.d);
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      [[-10, hy - 6, -4, hy + 22], [6, hy - 4, 10, hy + 24], [-2, hy + 2, 1, hy + 25]].forEach(([a, b, c, d]) => softLine(ctx, [a, b, (a + c) / 2 + 2, (b + d) / 2, c, d], 1.6, 'rgba(0,0,0,0.3)'));
      blob(ctx, 8, hy + 14, 6, 4, 'rgba(140,120,90,0.25)'); // poeira do tombo
      ctx.restore();
      if (this.pose.sit < 0.5) { // saia torta: barra subiu de um lado
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-21, hy + 24, 42, 2.5);
      }
      // ombros e costas (pele)
      capsule(ctx, { x: -14 + sx, y: y1 + 4 }, { x: 14 + sx, y: y1 + 4 }, 6.5, 6.5, this.SK, 1);
      // blusa de festa sem manga, cintura marcada
      ctx.beginPath();
      ctx.moveTo(-17, y0 - 6); ctx.quadraticCurveTo(-8, y0 - 1, 2, y0 - 4); ctx.quadraticCurveTo(10, y0 - 9, 17, y0 - 8);
      ctx.quadraticCurveTo(15, (y0 + y1) / 2, 18 + sx, y1 + (front ? 9 : 13));
      ctx.lineTo(9 + sx, y1 + (front ? 6 : 14));
      ctx.quadraticCurveTo(sx, y1 + (front ? 14 : 18), -9 + sx, y1 + (front ? 6 : 14));
      ctx.lineTo(-18 + sx, y1 + (front ? 9 : 13));
      ctx.quadraticCurveTo(-15, (y0 + y1) / 2, -17, y0 - 6); ctx.closePath();
      g = ctx.createLinearGradient(-20, 0, 20, 0);
      g.addColorStop(0, C.top.d); g.addColorStop(0.35, C.top.b); g.addColorStop(0.65, C.top.l); g.addColorStop(1, C.top.d);
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      // brilho do tecido acetinado + amassados + mancha de cerveja
      for (let i = 0; i < 14; i++) blob(ctx, -12 + U.hash(i) * 24 + sx * 0.5, y1 + 12 + U.hash(i + 7) * (y0 - y1 - 12), 1.6, 1.6, `rgba(255,220,235,${0.15 + 0.25 * Math.max(0, Math.sin(this.t * 3 + i))})`);
      [[-13, y0 - 10, -3, y0 - 20, 4], [4, y0 - 8, 14, y0 - 18, -4], [-8, y1 + 22, 6, y1 + 26, 3]].forEach(([a, b, c, d, e]) => {
        softLine(ctx, [a, b, (a + c) / 2 + e, (b + d) / 2 + e, c, d], 2, 'rgba(40,5,15,0.3)');
        softLine(ctx, [a + 1, b + 2, (a + c) / 2 + e + 1, (b + d) / 2 + e + 2, c + 1, d + 2], 1.3, 'rgba(255,200,215,0.18)');
      });
      blob(ctx, 9, y0 - 14, 5, 3.5, 'rgba(60,30,10,0.35)', 0.3);
      ctx.restore();
      // alças finas
      ctx.strokeStyle = C.top.d; ctx.lineWidth = 1.6;
      [-1, 1].forEach((sd) => { ctx.beginPath(); ctx.moveTo(sd * 10 + sx, y1 + (front ? 7 : 13)); ctx.lineTo(sd * 11 + sx, y1 - 1); ctx.stroke(); });
      if (front) { // colar
        ctx.strokeStyle = 'rgba(230,190,90,0.9)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-6 + sx, y1 - 1); ctx.quadraticCurveTo(sx, y1 + 7, 6 + sx, y1 - 1); ctx.stroke();
      }
    }

    _hairBackF(ctx, view, dir) {
      // cabelo comprido caindo atrás da cabeça (desenhado antes do rosto)
      const g = ctx.createLinearGradient(0, -18, 0, 46);
      g.addColorStop(0, C.hairF.l); g.addColorStop(0.5, C.hairF.b); g.addColorStop(1, C.hairF.d);
      ctx.fillStyle = g;
      const sw = Math.sin(this.t * 1.7) * 2 + this.pose.lean * -20;
      ctx.beginPath();
      if (view === 'profile') {
        const b = -dir;
        ctx.moveTo(dir * 4, -16); ctx.quadraticCurveTo(b * 18, -14, b * 17 + sw, 18); ctx.quadraticCurveTo(b * 14 + sw, 40, b * 4 + sw, 42);
        ctx.quadraticCurveTo(b * 2, 20, b * 2, 4); ctx.closePath();
      } else {
        ctx.moveTo(-14, -6); ctx.quadraticCurveTo(-19, 14, -17 + sw, 40); ctx.quadraticCurveTo(0 + sw, 47, 17 + sw, 40);
        ctx.quadraticCurveTo(19, 14, 14, -6); ctx.closePath();
      }
      ctx.fill();
    }

    _hairF(ctx, view, dir) {
      const g = ctx.createLinearGradient(0, -18, 0, 40);
      g.addColorStop(0, C.hairF.l); g.addColorStop(0.6, C.hairF.b); g.addColorStop(1, C.hairF.d);
      ctx.fillStyle = g;
      const sw = Math.sin(this.t * 1.7) * 2 + this.pose.lean * -20;
      ctx.beginPath();
      if (view === 'back') { // cobre a nuca e desce pelas costas
        ctx.moveTo(-13, 4); ctx.quadraticCurveTo(-15.5, -10, -8, -15.5); ctx.quadraticCurveTo(0, -19.5, 8, -15.5); ctx.quadraticCurveTo(15.5, -10, 13, 4);
        ctx.quadraticCurveTo(18, 20, 16 + sw, 42); ctx.quadraticCurveTo(0 + sw, 49, -16 + sw, 42); ctx.quadraticCurveTo(-18, 20, -13, 4);
      } else if (view === 'front') { // franja bagunçada e mechas dos lados do rosto
        ctx.moveTo(-14, 2); ctx.quadraticCurveTo(-15, -16, -2, -17); ctx.quadraticCurveTo(12, -17.5, 14, 0);
        ctx.quadraticCurveTo(10, -8, 6, -11); ctx.quadraticCurveTo(0, -6, -7, -9); ctx.quadraticCurveTo(-11, -4, -14, 2);
        ctx.moveTo(-13, -2); ctx.quadraticCurveTo(-17, 14, -15 + sw, 30); ctx.lineTo(-11 + sw, 30); ctx.quadraticCurveTo(-12, 12, -10.5, 0); ctx.closePath();
        ctx.moveTo(13, -2); ctx.quadraticCurveTo(17, 14, 15 + sw, 30); ctx.lineTo(11 + sw, 30); ctx.quadraticCurveTo(12, 12, 10.5, 0); ctx.closePath();
      } else {
        ctx.moveTo(dir * 7, -14); ctx.quadraticCurveTo(-dir * 6, -19, -dir * 13, -8); ctx.quadraticCurveTo(-dir * 14, 6, -dir * 9, 12);
        ctx.quadraticCurveTo(-dir * 2, 6, 0, -4); ctx.quadraticCurveTo(dir * 4, -9, dir * 10, -8); ctx.closePath();
      }
      ctx.fill();
      // fios soltos e arrepiados (cabelo desgrenhado da noite)
      for (const st of this.strands) {
        if (view === 'front' && Math.sin(st.a) > 0.1) continue;
        const x0 = Math.cos(st.a) * 9, y0 = -8 + Math.sin(st.a) * 7;
        const long = view === 'back' ? 26 + st.len : st.len;
        const x1 = x0 + Math.cos(st.a) * (st.wild ? 9 : 3) + st.curl, y1 = y0 + (st.wild ? 5 : long);
        ctx.strokeStyle = st.tone > 0.6 ? 'rgba(150,105,70,0.6)' : 'rgba(30,18,10,0.6)';
        ctx.lineWidth = st.w * 0.8; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + st.curl, (y0 + y1) / 2, x1 + sw * (y1 > 10 ? 1 : 0), y1); ctx.stroke();
      }
      // xuxinha caindo e brilho
      if (view === 'back') { ctx.fillStyle = '#d23a6a'; ctx.beginPath(); ctx.ellipse(3, 6, 4, 2.4, 0.3, 0, 7); ctx.fill(); }
      blob(ctx, -4, -13, 6, 2.5, 'rgba(230,200,170,0.25)');
      // brincos de argola
      if (view !== 'back') {
        ctx.strokeStyle = 'rgba(235,195,95,0.95)'; ctx.lineWidth = 1;
        if (view === 'front') [-1, 1].forEach((sd) => { ctx.beginPath(); ctx.arc(sd * 12.5, 10, 3.2, 0, 7); ctx.stroke(); });
        else { ctx.beginPath(); ctx.arc(-dir * 1.5, 10, 3.2, 0, 7); ctx.stroke(); }
      }
    }

    _makeupF(ctx, dir) {
      // rímel escorrido, blush, batom borrado
      const ex = dir ? [dir * 8] : [-5.5, 5.5];
      ex.forEach((x) => {
        softLine(ctx, [x - 1, 1, x - 1.5, 5, x - 0.5, 9], 0.9, 'rgba(15,10,20,0.55)');
        softLine(ctx, [x + 1.5, 1, x + 2, 4, x + 1.2, 6.5], 0.7, 'rgba(15,10,20,0.45)');
        blob(ctx, x, 0.5, 4.5, 2.4, 'rgba(40,20,40,0.35)'); // sombra borrada
      });
      if (!dir) { blob(ctx, -8.5, 5, 4, 2.8, 'rgba(220,90,100,0.35)'); blob(ctx, 8.5, 5, 4, 2.8, 'rgba(220,90,100,0.35)'); }
      else blob(ctx, dir * 7, 5, 3.6, 2.6, 'rgba(220,90,100,0.35)');
      const mx = dir ? dir * 9.5 : 0.3;
      blob(ctx, mx + (dir || 1) * 2.5, 10.5, dir ? 3.5 : 6.5, 2.4, 'rgba(190,20,50,0.45)'); // batom borrado
    }

    _ear(ctx, x, y, sd) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
      g.addColorStop(0, this.SKR.d); g.addColorStop(0.6, this.SKR.b); g.addColorStop(1, this.SKR.l);
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 3.6, 6, sd * 0.15, 0, 7); ctx.fill();
    }

    _hair(ctx, view, dir) {
      // massa de cabelo oleoso + fios soltos
      ctx.save();
      const base = ctx.createLinearGradient(0, -16, 0, 10);
      base.addColorStop(0, C.hair.l); base.addColorStop(1, C.hair.d);
      ctx.fillStyle = base;
      ctx.beginPath();
      if (view === 'back') {
        ctx.moveTo(-13, 5); ctx.quadraticCurveTo(-15.5, -9, -9, -14.8); ctx.quadraticCurveTo(0, -19.5, 9, -14.8);
        ctx.quadraticCurveTo(15.5, -9, 13, 5); ctx.quadraticCurveTo(7, 10.5, 0, 9.5); ctx.quadraticCurveTo(-7, 10.5, -13, 5);
      } else if (view === 'front') {
        ctx.moveTo(-13, -1); ctx.quadraticCurveTo(-14, -15, -3, -16.5); ctx.quadraticCurveTo(9, -18, 13.2, -3);
        ctx.quadraticCurveTo(10, -10, 4, -10.5); ctx.quadraticCurveTo(-3, -12, -8, -7.5); ctx.quadraticCurveTo(-11, -5, -13, -1);
      } else {
        const b = -dir;
        ctx.moveTo(dir * 6, -13.5); ctx.quadraticCurveTo(b * 4, -18.5, b * 12.5, -9); ctx.quadraticCurveTo(b * 15, 0, b * 11, 8);
        ctx.quadraticCurveTo(b * 4, 9, b * 2, 2); ctx.quadraticCurveTo(dir * 2, -6, dir * 9, -9); ctx.closePath();
      }
      ctx.fill();
      // entrada / calvície no cocuruto
      if (view === 'back') blob(ctx, 2, -11, 5.5, 4, 'rgba(205,150,115,0.75)');
      // fios
      for (const s of this.strands) {
        if (view === 'front' && Math.sin(s.a) > 0.2) continue;
        if (view === 'profile' && Math.cos(s.a) * dir > 0.5 && !s.wild) continue;
        const r0 = view === 'back' ? 8 : 10;
        const x0 = Math.cos(s.a) * r0 * 0.9, y0 = -6 + Math.sin(s.a) * r0 * 0.9 - 4;
        const len = s.wild ? s.len * 1.3 : s.len;
        const x1 = x0 + Math.cos(s.a) * len, y1 = y0 + Math.sin(s.a) * len * 0.8 + (s.wild ? -3 : 3);
        const sway = Math.sin(this.t * 2 + s.tone * 6) * 0.6;
        ctx.strokeStyle = s.tone > 0.7 ? 'rgba(90,72,55,0.75)' : s.tone > 0.35 ? 'rgba(40,30,22,0.85)' : 'rgba(15,10,8,0.85)';
        ctx.lineWidth = s.w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + s.curl, (y0 + y1) / 2 - 2, x1 + sway, y1); ctx.stroke();
      }
      // brilho de oleosidade
      blob(ctx, view === 'profile' ? -dir * 5 : -4, -13, 6, 2.5, 'rgba(200,180,160,0.25)');
      ctx.restore();
    }

    _stubble(ctx, cx, cy, w, h) {
      ctx.fillStyle = 'rgba(40,28,20,0.22)';
      ctx.beginPath(); ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = 'rgba(28,18,12,0.55)';
      for (const [a, r, q] of this.stubble) {
        const ang = Math.PI * (0.05 + q * 0.9);
        const x = cx + Math.cos(ang) * w * (0.2 + r * 0.85) * U.sign(a), y = cy + Math.sin(ang) * h * (0.2 + r * 0.85);
        ctx.fillRect(x, y, 0.55, 0.9);
      }
    }

    _eye(ctx, x, y, expr, s = 1, profile = 0) {
      const blink = this.blinkT < 0;
      // cavidade e olheira
      blob(ctx, x, y - 0.5, 5.2 * s, 4.2, 'rgba(70,35,30,0.35)');
      blob(ctx, x, y + 3.2, 4.4 * s, 2, 'rgba(90,45,55,0.35)');
      if (expr === 'happy' || expr === 'sleep' || blink) {
        softLine(ctx, [x - 3.6 * s, y + 0.3, x, y + (expr === 'happy' ? -1.2 : 1.4), x + 3.6 * s, y + 0.3], 1.2, 'rgba(25,15,10,0.85)');
        if (expr === 'happy') softLine(ctx, [x - 3 * s, y + 2.4, x, y + 3.4, x + 3 * s, y + 2.4], 0.8, 'rgba(90,45,35,0.5)');
        return;
      }
      if (expr === 'dizzy' || expr === 'pain') {
        softLine(ctx, [x - 3.6 * s, y, x, y + 1, x + 3.6 * s, y - 0.4], 1.3, 'rgba(25,15,10,0.85)');
        softLine(ctx, [x - 3 * s, y - 2, x, y - 2.8, x + 3 * s, y - 2.2], 1, 'rgba(25,15,10,0.6)');
        return;
      }
      const wide = expr === 'shock' || expr === 'shout';
      const rx = 3.8 * s, ry = wide ? 3.4 : 2.6;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.clip();
      ctx.fillStyle = '#e8d6c4'; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 2);
      ctx.strokeStyle = 'rgba(200,60,50,0.55)'; ctx.lineWidth = 0.4; // vasos (olho vermelho)
      ctx.beginPath(); ctx.moveTo(x - rx, y + 0.3); ctx.lineTo(x - rx * 0.4, y); ctx.moveTo(x + rx, y + 0.5); ctx.lineTo(x + rx * 0.5, y + 0.2); ctx.stroke();
      const px = x + profile * 1.2 + (expr === 'drunk' || expr === 'talk' ? U.noise(this.t * 0.7) * 1.1 : 0);
      ctx.fillStyle = '#4a3020'; ctx.beginPath(); ctx.arc(px, y + 0.4, 1.9, 0, 7); ctx.fill();
      ctx.fillStyle = '#120a06'; ctx.beginPath(); ctx.arc(px, y + 0.4, 0.9, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(px - 0.9, y - 0.6, 0.7, 0.7);
      // pálpebra pesada
      if (!wide) { ctx.fillStyle = this.SK.d; ctx.fillRect(x - rx, y - ry, rx * 2, ry * 1.05); }
      ctx.restore();
      softLine(ctx, [x - rx, y - (wide ? ry : 0.3), x, y - ry - (wide ? 1 : 0.2), x + rx, y - (wide ? ry * 0.8 : 0.4)], 0.9, 'rgba(30,18,12,0.8)');
      if (this.gender === 'f') { // cílios com rímel
        ctx.strokeStyle = 'rgba(10,6,6,0.9)'; ctx.lineWidth = 0.7;
        for (let i = 0; i < 5; i++) { const lx = x - rx * 0.8 + i * rx * 0.4; ctx.beginPath(); ctx.moveTo(lx, y - (wide ? ry : 0.4)); ctx.lineTo(lx + (i - 2) * 0.5, y - (wide ? ry : 0.4) - 1.8); ctx.stroke(); }
      }
    }

    _mouth(ctx, x, y, expr, w = 1) {
      const talking = this.talk > 0 && expr !== 'happy';
      const open = talking ? 0.4 + 0.6 * Math.abs(Math.sin(this.t * 13)) : expr === 'shout' ? 1 : expr === 'shock' ? 0.8 : expr === 'sleep' ? 0.35 : 0;
      if (expr === 'happy') {
        ctx.fillStyle = '#3a1410';
        ctx.beginPath(); ctx.moveTo(x - 6 * w, y - 1); ctx.quadraticCurveTo(x, y + 8, x + 6 * w, y - 1.5); ctx.quadraticCurveTo(x, y + 1.5, x - 6 * w, y - 1); ctx.fill();
        ctx.fillStyle = '#e2d6b8'; ctx.fillRect(x - 4.5 * w, y - 0.5, 3.6 * w, 2); ctx.fillRect(x + 1.2 * w, y - 0.8, 3 * w, 2); // falta um dente
        softLine(ctx, [x - 6.5 * w, y - 1.5, x - 7.5 * w, y - 3.5, x - 7.5 * w, y - 5], 0.8, 'rgba(80,40,30,0.5)');
        softLine(ctx, [x + 6.5 * w, y - 2, x + 7.5 * w, y - 4, x + 7.5 * w, y - 5.5], 0.8, 'rgba(80,40,30,0.5)');
        return;
      }
      if (open > 0.05) {
        ctx.fillStyle = '#2e0f0b';
        ctx.beginPath(); ctx.ellipse(x, y + 1, 4 * w, 0.8 + open * 3.4, 0.08, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(160,80,70,0.6)'; ctx.fillRect(x - 3 * w, y - 0.2 - open * 2.6, 6 * w, 1);
        return;
      }
      // boca entreaberta caída de bêbado
      softLine(ctx, [x - 5 * w, y + 0.5, x, y + 2.6, x + 5 * w, y - 1.5], 1.3, 'rgba(70,25,20,0.85)');
      softLine(ctx, [x - 4 * w, y + 3, x, y + 4.2, x + 3.5 * w, y + 2.4], 1.2, 'rgba(150,70,60,0.45)');
    }

    _nose(ctx, x, y, big = 1) {
      const g = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, 4.8 * big);
      g.addColorStop(0, '#e48c78'); g.addColorStop(0.6, '#bf5f4d'); g.addColorStop(1, 'rgba(150,70,55,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 4.6 * big, 3.9 * big, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(60,20,15,0.55)';
      ctx.beginPath(); ctx.ellipse(x - 1.8, y + 2, 1.1, 0.7, 0.3, 0, 7); ctx.ellipse(x + 1.8, y + 2, 1.1, 0.7, -0.3, 0, 7); ctx.fill();
    }

    _face(ctx) {
      const e = this.expr;
      // olhos fundos e testa
      blob(ctx, 0, -9, 10, 4, 'rgba(255,230,200,0.12)');
      if (this.gender === 'f') this._makeupF(ctx, 0); else this._stubble(ctx, 0, 3.5, 12, 11);
      blob(ctx, -8, 4, 4.5, 3.2, 'rgba(200,70,60,0.35)');
      blob(ctx, 8, 4, 4.5, 3.2, 'rgba(200,70,60,0.35)');
      // sobrancelhas grossas
      const up = e === 'happy' || e === 'shock' ? -1.5 : 0;
      softLine(ctx, [-9, -6.5 + up, -5.5, -8 + up, -2, -6.5 + up * 0.5], 2, 'rgba(30,20,15,0.85)');
      softLine(ctx, [2, -6 + up * 0.5, 5.5, -8.2 + up, 9, -7 + up], 2, 'rgba(30,20,15,0.85)');
      this._eye(ctx, -5.5, -2, e); this._eye(ctx, 5.5, -2, e);
      // sulco nasolabial
      softLine(ctx, [-4, 3, -5.5, 6, -5.5, 8.5], 0.8, 'rgba(80,40,30,0.4)');
      softLine(ctx, [4, 3, 5.5, 6, 5.5, 8.5], 0.8, 'rgba(80,40,30,0.4)');
      this._nose(ctx, 0.3, 3);
      this._mouth(ctx, 0.3, 9, e);
    }

    _profile(ctx, dir) {
      const e = this.expr;
      if (this.gender === 'f') this._makeupF(ctx, dir); else this._stubble(ctx, dir * 5, 3.5, 9, 10.5);
      if (this.gender !== 'f') this._ear(ctx, -dir * 2.5, 1, -dir);
      blob(ctx, dir * 6.5, 4, 3.8, 2.8, 'rgba(200,70,60,0.35)');
      // testa e sobrancelha
      softLine(ctx, [dir * 4, -7, dir * 8, -8.5, dir * 11.5, -7 - (e === 'shock' ? 1.5 : 0)], 2, 'rgba(30,20,15,0.85)');
      this._eye(ctx, dir * 8, -2, e, 0.8, dir);
      // nariz saliente fora do contorno do rosto
      ctx.save();
      const g = ctx.createRadialGradient(dir * 13.5, 2, 0, dir * 13.5, 2.5, 5);
      g.addColorStop(0, '#e48c78'); g.addColorStop(0.7, '#bf5f4d'); g.addColorStop(1, '#a65040');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(dir * 10.5, -3); ctx.quadraticCurveTo(dir * 17.5, 1, dir * 16, 5); ctx.quadraticCurveTo(dir * 13, 7, dir * 10.5, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(60,20,15,0.5)'; ctx.beginPath(); ctx.ellipse(dir * 13, 5, 1.2, 0.7, 0, 0, 7); ctx.fill();
      ctx.restore();
      // queixo duplo / papada
      softLine(ctx, [dir * 3, 13.5, dir * 7, 15, dir * 10, 12], 1, 'rgba(80,40,30,0.35)');
      this._mouth(ctx, dir * 9.5, 9.5, e, 0.6);
    }
  }

  Drunk.S = S;
  CNB.Drunk = Drunk;
})();
