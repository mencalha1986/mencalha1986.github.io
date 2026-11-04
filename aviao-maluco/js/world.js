/* =========================================================================
   MUNDO — cenário rolando de lado (cidade, praia, serra e o aeroporto no fim),
   obstáculos com vão para o avião passar, urubus, caixas caindo e paraquedas
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const PXM = 40;          // pixels por metro
  const GY = 1690;         // chão (tela)
  const TOP = 400;         // abaixo do HUD
  const STAGES = ['cidade', 'praia', 'serra'];
  const SKY = {
    cidade: ['#5fb4f0', '#d5efff'], praia: ['#ff9e6b', '#ffe3b5'], serra: ['#7cc3e6', '#e3f5ea'], aeroporto: ['#6fb8ea', '#e6f4ff']
  };
  const BLD = ['#c0583f', '#2a9d8f', '#e9c46a', '#577590', '#f4a261', '#8d6cab', '#43aa8b', '#e76f51'];

  class World {
    constructor(cfg) { this.cfg = cfg; this.reset(); }

    reset() {
      const cfg = this.cfg;
      this.x = 0;                       // quanto o mundo já andou (px)
      this.goalX = cfg.goal * PXM;
      this.obstacles = []; this.nextObs = 900; this.obsN = 0;
      this.birds = []; this.lost = []; this.chutes = []; this.puffs = [];
      this.stageLen = Math.max(600, cfg.goal / 3) * PXM;
    }
    get meters() { return this.x / PXM; }
    get left() { return Math.max(0, Math.ceil((this.goalX - this.x) / PXM)); }
    stageAt(x) {
      if (x > this.goalX - 75 * PXM) return 'aeroporto';
      return STAGES[Math.floor(Math.max(0, x) / this.stageLen) % STAGES.length];
    }

    // ---------------- obstáculos ----------------
    spawn() {
      const cfg = this.cfg, lastX = this.goalX - 95 * PXM;
      while (this.nextObs < this.x + 1500 && this.nextObs < lastX) {
        const ox = this.nextObs, st = this.stageAt(ox), n = this.obsN++;
        // começa mais fácil e vai apertando
        const hard = U.clamp(n / 40, 0, 1);
        const gap = U.lerp(cfg.gap[1] + 60, cfg.gap[0], hard * U.rand(0.6, 1));
        const prev = this.obstacles[this.obstacles.length - 1];
        let gy = U.rand(TOP + gap / 2 + 70, GY - gap / 2 - 90);
        if (prev) gy = U.clamp(gy, prev.gy - 270, prev.gy + 270);
        const w = U.rand(150, 200);
        const bot = st === 'cidade' ? (Math.random() < 0.8 ? 'predio' : 'antena') : st === 'praia' ? (Math.random() < 0.55 ? 'predioPraia' : 'farol') : (Math.random() < 0.6 ? 'torre' : 'rocha');
        const top = st === 'cidade' ? 'guindaste' : st === 'praia' ? 'dirigivel' : 'balao';
        this.obstacles.push({ x: ox, w, gy, gap, bot, top, color: U.choice(BLD), seed: Math.random(), hit: false, passed: false });
        this.nextObs += U.rand(cfg.spacing[0], cfg.spacing[1]) * (st === 'serra' ? 1.05 : 1);
      }
      this.obstacles = this.obstacles.filter((o) => o.x > this.x - 3500);
    }
    // retângulos de colisão (mundo)
    rects(o) {
      const top = o.gy - o.gap / 2, bot = o.gy + o.gap / 2, cx = o.x;
      const r = [{ x0: cx - o.w / 2, x1: cx + o.w / 2, y0: bot, y1: GY + 50 }];
      if (o.top === 'guindaste') r.push({ x0: cx - 70, x1: cx + 70, y0: top - 70, y1: top }, { x0: cx - 4, x1: cx + 4, y0: 0, y1: top - 70 });
      else if (o.top === 'dirigivel') r.push({ x0: cx - 150, x1: cx + 150, y0: top - 220, y1: top - 120 }, { x0: cx - 60, x1: cx + 60, y0: top - 130, y1: top });
      else r.push({ x0: cx - 75, x1: cx + 75, y0: top - 210, y1: top - 60 }, { x0: cx - 32, x1: cx + 32, y0: top - 60, y1: top });
      return r;
    }

    update(dt, t, planeY) {
      for (const b of this.birds) { b.x -= b.v * dt; b.ph += dt * 9; b.y += Math.sin(b.ph * 0.35) * 30 * dt + (b.ty - b.y) * 0.6 * dt; }
      this.birds = this.birds.filter((b) => b.x > this.x - 400);
      for (const c of this.lost) { c.vy += 1400 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; if (c.y > GY - 20) { c.y = GY - 20; c.vy *= -0.25; c.vx *= 0.6; c.vr *= 0.5; c.ground = true; } }
      this.lost = this.lost.filter((c) => c.x > this.x - 600);
      for (const c of this.chutes) { if (c.y < GY - 26) { c.y += 120 * dt; c.x += Math.sin(t * 1.5 + c.seed * 6) * 30 * dt; } else { c.y = GY - 26; c.landed = true; } }
      this.chutes = this.chutes.filter((c) => c.x > this.x - 700);
      for (const p of this.puffs) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += 30 * dt; }
      this.puffs = this.puffs.filter((p) => p.age < p.life);
    }

    addBirds(planeY) {
      const n = 5 + Math.floor(Math.random() * 3), x0 = this.x + 1250, y0 = U.clamp(planeY, TOP + 120, GY - 220);
      for (let i = 0; i < n; i++) this.birds.push({ x: x0 + i * 70 + Math.random() * 40, y: y0 + (i % 2 ? -1 : 1) * (40 + i * 22), ty: y0 + (Math.random() - 0.5) * 360, v: U.rand(140, 220), ph: Math.random() * 6, hit: false });
    }

    // ---------------- desenho ----------------
    draw(ctx, t, camX, extra) {
      const st = this.stageAt(camX + 600);
      this._sky(ctx, t, camX, st);
      this._far(ctx, camX, st, t);
      this._mid(ctx, camX, st, t);
      this._ground(ctx, camX, st, t);
      for (const o of this.obstacles) { const sx = o.x - camX; if (sx > -320 && sx < W + 320) this._obstacle(ctx, o, sx, t); }
      for (const c of this.chutes) this._chute(ctx, c, c.x - camX, t);
      for (const c of this.lost) this._crate(ctx, c.x - camX, c.y, 46, c.rot, c.item, extra && extra.catalog);
      for (const b of this.birds) this._bird(ctx, b.x - camX, b.y, b.ph);
      for (const p of this.puffs) { ctx.fillStyle = `rgba(${p.c},${(1 - p.age / p.life) * p.a})`; ctx.beginPath(); ctx.arc(p.x - camX, p.y, p.r, 0, 7); ctx.fill(); }
    }

    _sky(ctx, t, camX, st) {
      const g = ctx.createLinearGradient(0, 0, 0, GY);
      g.addColorStop(0, SKY[st][0]); g.addColorStop(1, SKY[st][1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (st === 'praia') { const sg = ctx.createRadialGradient(780, 1150, 20, 780, 1150, 360); sg.addColorStop(0, 'rgba(255,240,190,0.95)'); sg.addColorStop(0.25, 'rgba(255,200,120,0.5)'); sg.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = sg; ctx.fillRect(380, 760, 800, 800); }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 9; i++) {
        const span = 2400, x = (((i * 337 - camX * 0.08 - t * 8) % span) + span) % span - 300, y = 300 + (i % 4) * 170 + U.hash(i) * 60, s = 0.7 + U.hash(i + 3) * 0.7;
        [[0, 0, 50], [46, -16, 42], [92, 4, 46], [-40, 8, 32]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); });
      }
    }

    _far(ctx, camX, st, t) {
      const base = GY - 120;
      if (st === 'praia') {
        ctx.fillStyle = '#3b8fd0'; ctx.fillRect(0, base - 160, W, 200);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 14; i++) { const x = ((i * 157 - camX * 0.1 + t * 10) % 1300 + 1300) % 1300 - 100; ctx.fillRect(x, base - 120 + (i % 5) * 26, 60, 3); }
        ctx.fillStyle = '#5e8f6e';
        for (let i = -1; i < 6; i++) { const x = ((i * 420 - camX * 0.06) % 2520 + 2520) % 2520 - 400; ctx.beginPath(); ctx.moveTo(x, base - 160); ctx.quadraticCurveTo(x + 120, base - 330 - U.hash(i) * 120, x + 260, base - 160); ctx.fill(); }
        return;
      }
      if (st === 'serra') {
        ctx.fillStyle = '#9fb9a8';
        for (let i = -1; i < 8; i++) { const x = ((i * 330 - camX * 0.07) % 2640 + 2640) % 2640 - 400, h = 380 + U.hash(i * 7) * 320; U.poly(ctx, [x - 260, base, x, base - h, x + 260, base]); ctx.fill(); }
        ctx.fillStyle = '#f4f7f6'; for (let i = -1; i < 8; i++) { const x = ((i * 330 - camX * 0.07) % 2640 + 2640) % 2640 - 400, h = 380 + U.hash(i * 7) * 320; U.poly(ctx, [x - 50, base - h + 75, x, base - h, x + 50, base - h + 75]); ctx.fill(); }
        return;
      }
      // cidade / aeroporto: prédios ao longe
      ctx.fillStyle = st === 'aeroporto' ? '#b8cbd9' : '#a9c1d4';
      for (let i = -2; i < 30; i++) {
        const span = 2700, x = (((i * 90 - camX * 0.12) % span) + span) % span - 200, h = 140 + U.hash(i * 3.1) * (st === 'aeroporto' ? 120 : 320), w = 70 + U.hash(i) * 50;
        ctx.fillRect(x, base - h, w, h + 20);
      }
    }

    _mid(ctx, camX, st, t) {
      const base = GY - 40, k = 0.4;
      if (st === 'aeroporto') {
        // hangar e torre de controle
        const tx = this.goalX - 18 * PXM - camX * 1, hx = this.goalX + 6 * PXM - camX;
        ctx.fillStyle = '#d7dde3'; ctx.beginPath(); ctx.moveTo(hx - 220, base); ctx.lineTo(hx - 220, base - 160); ctx.quadraticCurveTo(hx, base - 300, hx + 220, base - 160); ctx.lineTo(hx + 220, base); ctx.fill();
        ctx.fillStyle = '#6b7c8c'; ctx.fillRect(hx - 140, base - 130, 280, 130);
        ctx.fillStyle = '#fff'; ctx.font = `800 26px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('ACHADOS CARGO', hx, base - 170);
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(tx - 26, base - 380, 52, 380);
        ctx.fillStyle = '#334155'; U.roundRect(ctx, tx - 70, base - 470, 140, 90, 14); ctx.fill();
        ctx.fillStyle = '#7dd3fc'; ctx.fillRect(tx - 60, base - 455, 120, 46);
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(tx, base - 488, 10 + Math.sin(t * 6) * 2, 0, 7); ctx.fill();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(tx, base - 470); ctx.lineTo(tx, base - 520); ctx.stroke();
        return;
      }
      for (let i = -2; i < 18; i++) {
        const span = 3000, x = (((i * 190 - camX * k) % span) + span) % span - 250, hs = U.hash(i * 1.7 + (st === 'praia' ? 50 : st === 'serra' ? 90 : 0));
        if (st === 'cidade') {
          const h = 180 + hs * 260, w = 120 + hs * 60;
          ctx.fillStyle = ['#d9c7b1', '#c8d5df', '#e6d2c5', '#c9d8cc', '#d6cfe3'][Math.floor(hs * 5)]; ctx.fillRect(x, base - h, w, h);
          ctx.fillStyle = 'rgba(70,100,130,0.35)'; for (let yy = base - h + 22; yy < base - 30; yy += 38) for (let xx = x + 16; xx < x + w - 22; xx += 32) ctx.fillRect(xx, yy, 16, 20);
        } else if (st === 'praia') {
          // coqueiros
          const h = 200 + hs * 120;
          ctx.strokeStyle = '#8b6b43'; ctx.lineWidth = 12; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + 30, base - h * 0.5, x + 18, base - h); ctx.stroke();
          ctx.strokeStyle = '#2e8b3e'; ctx.lineWidth = 10;
          for (let j = 0; j < 6; j++) { const a = -Math.PI / 2 + (j - 2.5) * 0.55 + Math.sin(t * 1.3 + i) * 0.05; ctx.beginPath(); ctx.moveTo(x + 18, base - h); ctx.quadraticCurveTo(x + 18 + Math.cos(a) * 60, base - h + Math.sin(a) * 60 - 20, x + 18 + Math.cos(a) * 95, base - h + Math.sin(a) * 50 + 30); ctx.stroke(); }
        } else {
          // araucárias
          const h = 220 + hs * 160;
          ctx.fillStyle = '#6b4a2f'; ctx.fillRect(x - 6, base - h, 12, h);
          ctx.fillStyle = '#2f6b45';
          for (let j = 0; j < 4; j++) { const yy = base - h + j * 26; ctx.beginPath(); ctx.ellipse(x, yy, 70 - j * 10, 16, 0, Math.PI, 0); ctx.fill(); }
        }
      }
    }

    _ground(ctx, camX, st, t) {
      const col = st === 'praia' ? ['#f2d49b', '#e6c27f'] : st === 'serra' ? ['#7cb26a', '#5f9a4f'] : st === 'aeroporto' ? ['#86b56f', '#6a9c56'] : ['#9aa3ad', '#7d8791'];
      ctx.fillStyle = col[0]; ctx.fillRect(0, GY, W, H - GY);
      ctx.fillStyle = col[1]; for (let i = 0; i < 16; i++) { const x = ((i * 90 - camX) % 1440 + 1440) % 1440 - 180; ctx.fillRect(x, GY + 6, 46, 10); }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, GY, W, 6);
      // pista do aeroporto
      const r0 = this.goalX - 40 * PXM - camX, r1 = this.goalX + 60 * PXM - camX;
      if (r1 > 0 && r0 < W) {
        ctx.fillStyle = '#4a4d55'; ctx.fillRect(Math.max(0, r0), GY - 6, Math.min(W, r1) - Math.max(0, r0), 46);
        ctx.fillStyle = '#f5f5f5'; for (let x = r0 + 40; x < r1; x += 140) if (x > -80 && x < W) ctx.fillRect(x, GY + 14, 80, 8);
        for (let x = r0; x < r1; x += 70) if (x > -10 && x < W) { ctx.fillStyle = Math.floor(t * 4 + x / 70) % 2 ? '#fde047' : '#fbbf24'; ctx.beginPath(); ctx.arc(x, GY - 8, 5, 0, 7); ctx.fill(); }
        // biruta
        const bx = r0 + 120; if (bx > -50 && bx < W + 50) { ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx, GY - 6); ctx.lineTo(bx, GY - 110); ctx.stroke(); ctx.fillStyle = '#f97316'; U.poly(ctx, [bx, GY - 110, bx - 70 - Math.sin(t * 5) * 6, GY - 102, bx - 70 - Math.sin(t * 5) * 6, GY - 88, bx, GY - 82]); ctx.fill(); }
      }
    }

    _obstacle(ctx, o, sx, t) {
      const top = o.gy - o.gap / 2, bot = o.gy + o.gap / 2, w = o.w;
      // ---- de baixo ----
      if (o.bot === 'predio' || o.bot === 'predioPraia') {
        const praia = o.bot === 'predioPraia', c = praia ? '#f4f1ea' : o.color;
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx - w / 2 + 10, bot + 10, w, GY - bot);
        ctx.fillStyle = c; ctx.fillRect(sx - w / 2, bot, w, GY - bot + 4);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(sx + w / 2 - 18, bot, 18, GY - bot);
        ctx.fillStyle = praia ? '#2a9d8f' : 'rgba(0,0,0,0.25)'; ctx.fillRect(sx - w / 2 - 8, bot - 14, w + 16, 16);
        const winC = praia ? '#7fc8e0' : '#ffe9a8';
        for (let yy = bot + 30; yy < GY - 40; yy += 46) for (let xx = sx - w / 2 + 18; xx < sx + w / 2 - 30; xx += 36) {
          ctx.fillStyle = U.hash(xx * 0.1 + yy + o.seed * 99) > 0.35 ? winC : '#3b4a5a'; ctx.fillRect(xx, yy, 20, 26);
          if (praia) { ctx.fillStyle = '#e5e7eb'; ctx.fillRect(xx - 4, yy + 28, 28, 5); }
        }
        ctx.fillStyle = '#5b4636'; ctx.fillRect(sx - 18, GY - 52, 36, 52);
      } else if (o.bot === 'farol') {
        ctx.fillStyle = '#e5e7eb'; U.poly(ctx, [sx - w * 0.4, GY, sx - w * 0.26, bot + 70, sx + w * 0.26, bot + 70, sx + w * 0.4, GY]); ctx.fill();
        ctx.fillStyle = '#dc2626'; for (let yy = bot + 120; yy < GY - 20; yy += 120) { const f = (yy - bot) / (GY - bot), hw = U.lerp(w * 0.26, w * 0.4, f); ctx.fillRect(sx - hw, yy, hw * 2, 55); }
        ctx.fillStyle = '#374151'; ctx.fillRect(sx - w * 0.32, bot + 50, w * 0.64, 22);
        ctx.fillStyle = '#fde68a'; ctx.fillRect(sx - w * 0.2, bot + 6, w * 0.4, 46);
        ctx.fillStyle = '#374151'; U.poly(ctx, [sx - w * 0.28, bot + 8, sx, bot - 30, sx + w * 0.28, bot + 8]); ctx.fill();
        ctx.fillStyle = `rgba(255,240,160,${0.25 + 0.2 * Math.sin(t * 3)})`; U.poly(ctx, [sx, bot + 28, sx - 260, bot - 30, sx - 260, bot + 90]); ctx.fill();
      } else if (o.bot === 'antena' || o.bot === 'torre') {
        const tw = w * 0.7;
        ctx.strokeStyle = o.bot === 'antena' ? '#b91c1c' : '#6b7280'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(sx - tw / 2, GY); ctx.lineTo(sx - 12, bot); ctx.moveTo(sx + tw / 2, GY); ctx.lineTo(sx + 12, bot); ctx.stroke();
        ctx.lineWidth = 4;
        for (let yy = GY; yy > bot + 40; yy -= 70) { const f = (yy - bot) / (GY - bot), hw = U.lerp(12, tw / 2, f), hw2 = U.lerp(12, tw / 2, (yy - 70 - bot) / (GY - bot)); ctx.beginPath(); ctx.moveTo(sx - hw, yy); ctx.lineTo(sx + hw2, yy - 70); ctx.moveTo(sx + hw, yy); ctx.lineTo(sx - hw2, yy - 70); ctx.moveTo(sx - hw, yy); ctx.lineTo(sx + hw, yy); ctx.stroke(); }
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(sx - 40, bot - 10, 80, 22);
        ctx.fillStyle = Math.sin(t * 5) > 0 ? '#ef4444' : '#7f1d1d'; ctx.beginPath(); ctx.arc(sx, bot - 18, 9, 0, 7); ctx.fill();
      } else {   // rocha
        ctx.fillStyle = '#8b8378'; U.poly(ctx, [sx - w * 0.6, GY, sx - w * 0.45, bot + 80, sx - w * 0.15, bot, sx + w * 0.25, bot + 30, sx + w * 0.55, bot + 140, sx + w * 0.62, GY]); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; U.poly(ctx, [sx - w * 0.15, bot, sx - w * 0.05, bot + 160, sx - w * 0.4, bot + 120]); ctx.fill();
        ctx.fillStyle = '#4f8a43'; ctx.beginPath(); ctx.ellipse(sx - w * 0.1, bot + 6, w * 0.2, 12, 0.1, 0, 7); ctx.fill();
      }
      // ---- de cima ----
      if (o.top === 'guindaste') {
        ctx.strokeStyle = '#3f3f46'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, top - 70); ctx.stroke();
        // contêiner pendurado
        const sw = Math.sin(t * 1.4 + o.seed * 6) * 4;
        ctx.save(); ctx.translate(sx + sw, top - 35);
        ctx.fillStyle = ['#c2410c', '#0369a1', '#15803d', '#a21caf'][Math.floor(o.seed * 4)]; ctx.fillRect(-70, -35, 140, 70);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; for (let xx = -60; xx < 70; xx += 16) ctx.fillRect(xx, -30, 5, 60);
        ctx.fillStyle = '#fff'; ctx.font = `800 13px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('ACHADOS', 0, 5);
        ctx.restore();
        ctx.fillStyle = '#1f2937'; ctx.fillRect(sx - 10, top - 82, 20, 14);
      } else if (o.top === 'dirigivel') {
        const by = top - 175, bob = Math.sin(t * 1.1 + o.seed * 9) * 6;
        ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(sx, by + bob, 150, 52, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#82e8cc'; ctx.fillRect(sx - 130, by + bob - 8, 260, 16);
        ctx.fillStyle = '#334155'; U.poly(ctx, [sx - 150, by + bob, sx - 190, by + bob - 46, sx - 175, by + bob, sx - 190, by + bob + 46]); ctx.fill();
        ctx.fillStyle = '#334155'; U.roundRect(ctx, sx - 34, by + bob + 46, 68, 22, 8); ctx.fill();
        // faixa de propaganda até o vão
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 50, by + bob + 50); ctx.lineTo(sx - 50, top - 120); ctx.moveTo(sx + 50, by + bob + 50); ctx.lineTo(sx + 50, top - 120); ctx.stroke();
        ctx.fillStyle = '#fe2c55'; ctx.fillRect(sx - 60, top - 125, 120, 125);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `30px ${U.FONT_TITLE}`; ctx.fillText('ACHADOS', sx, top - 80); ctx.fillText('ÚTEIS', sx, top - 50); ctx.font = `800 13px ${U.FONT_UI}`; ctx.fillText('por aí', sx, top - 26);
      } else {   // balão de ar quente
        const by = top - 140, bob = Math.sin(t * 0.9 + o.seed * 7) * 8, cols = [['#ef4444', '#facc15'], ['#3b82f6', '#f8fafc'], ['#22c55e', '#f97316']][Math.floor(o.seed * 3)];
        ctx.strokeStyle = '#78350f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 30, by + 60 + bob); ctx.lineTo(sx - 22, top - 40 + bob); ctx.moveTo(sx + 30, by + 60 + bob); ctx.lineTo(sx + 22, top - 40 + bob); ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.moveTo(sx - 32, by + 62 + bob); ctx.bezierCurveTo(sx - 120, by - 10 + bob, sx - 90, by - 140 + bob, sx, by - 140 + bob); ctx.bezierCurveTo(sx + 90, by - 140 + bob, sx + 120, by - 10 + bob, sx + 32, by + 62 + bob); ctx.closePath(); ctx.clip();
        for (let i = -4; i < 4; i++) { ctx.fillStyle = cols[(i + 4) % 2]; ctx.fillRect(sx + i * 32, by - 150 + bob, 32, 220); }
        ctx.restore();
        ctx.fillStyle = '#92400e'; U.roundRect(ctx, sx - 30, top - 44 + bob, 60, 40, 6); ctx.fill();
        ctx.fillStyle = '#b45309'; ctx.fillRect(sx - 30, top - 44 + bob, 60, 8);
      }
    }

    _bird(ctx, x, y, ph) {
      const f = Math.sin(ph) * 22;
      ctx.save(); ctx.translate(x, y);
      ctx.strokeStyle = '#1f1f23'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-46, -f); ctx.quadraticCurveTo(-20, -10, 0, 0); ctx.quadraticCurveTo(20, -10, 46, -f); ctx.stroke();
      ctx.fillStyle = '#1f1f23'; ctx.beginPath(); ctx.ellipse(0, 2, 20, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8b4a0'; ctx.beginPath(); ctx.arc(-20, -2, 8, 0, 7); ctx.fill();   // cabeça pelada do urubu
      ctx.fillStyle = '#f5d0b0'; U.poly(ctx, [-27, -2, -36, 2, -27, 3]); ctx.fill();
      ctx.restore();
    }

    _crate(ctx, x, y, s, rot, item, catalog) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
      ctx.fillStyle = '#c69c6d'; ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeStyle = '#8a6a43'; ctx.lineWidth = 3; ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = '#82e8cc'; ctx.fillRect(-s * 0.1, -s / 2, s * 0.2, s);
      if (item && catalog) { ctx.save(); ctx.translate(-s * 0.32, -s * 0.32); catalog.drawPhoto(ctx, item, 0, 0, s * 0.64, 6); ctx.restore(); }
      ctx.restore();
    }

    _chute(ctx, c, x, t) {
      const y = c.y;
      if (!c.landed) {
        const sw = Math.sin(t * 1.5 + c.seed * 6) * 0.08;
        ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
        ctx.strokeStyle = 'rgba(40,40,40,0.7)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-24, -20); ctx.lineTo(-70, -120); ctx.moveTo(24, -20); ctx.lineTo(70, -120); ctx.moveTo(0, -22); ctx.lineTo(0, -130); ctx.stroke();
        ctx.fillStyle = '#fe2c55'; ctx.beginPath(); ctx.ellipse(0, -120, 95, 50, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fff'; for (let i = -2; i <= 2; i += 2) { ctx.beginPath(); ctx.moveTo(i * 18, -170); ctx.lineTo(i * 30 - 12, -120); ctx.lineTo(i * 30 + 12, -120); ctx.fill(); }
        ctx.restore();
      }
      this._crate(ctx, x, y, 48, 0, c.item, c.catalog);
      ctx.font = `800 24px ${U.FONT_UI}`; ctx.textAlign = 'center';
      const tw = ctx.measureText(c.name).width + 24;
      ctx.fillStyle = 'rgba(254,44,85,0.95)'; U.roundRect(ctx, x - tw / 2, y + 32, tw, 34, 12); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(c.name, x, y + 57);
    }
  }

  World.PXM = PXM; World.GY = GY; World.TOP = TOP;
  CNB.World = World;
})();
