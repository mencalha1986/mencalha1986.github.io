/* =========================================================================
   PRAIA — areia de Copacabana vista de lado: céu, morros, mar, banhistas
   que pedem mate, obstáculos na areia, postos de salva-vidas e o quiosque
   do Posto 6 no final
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const PXM = 50;          // pixels por metro
  const GY = 1650;         // linha da areia onde o vendedor pisa
  const SEA = 1000, SURF = 1300;
  const SKIN = ['#f1c7a3', '#d9a07a', '#a86a45', '#7a4a2c', '#5a3520'];
  const SUITS = ['#e63946', '#f4a261', '#2a9d8f', '#ffd23f', '#8d6cab', '#3a86ff', '#ff4fa3', '#0f766e'];
  const UMB = [['#ef4444', '#fff7ed'], ['#2563eb', '#fef9c3'], ['#16a34a', '#fefce8'], ['#f59e0b', '#fff'], ['#db2777', '#fdf2f8'], ['#7c3aed', '#ede9fe']];

  class World {
    constructor(cfg) { this.cfg = cfg; this.reset(); }
    reset() {
      const c = this.cfg;
      this.x = 0; this.goalX = c.goal * PXM; this.seed = Math.floor(Math.random() * 1e6);
      this.customers = []; this.obstacles = []; this.puffs = []; this.cups = []; this.coins = [];
      this.nextCust = 7 * PXM; this.nextObs = 16 * PXM;
      this.left = c.goal;
    }
    // banhistas e obstáculos vão aparecendo à frente
    spawn() {
      const c = this.cfg, ahead = this.x + W + 300;
      while (this.nextCust < Math.min(ahead, this.goalX - 14 * PXM)) {
        // banhista nunca colado num obstáculo (o vendedor para na frente dele para vender)
        if (this.obstacles.some((o) => Math.abs(o.x - this.nextCust) < 2.6 * PXM)) { this.nextCust += 3 * PXM; continue; }
        const s = Math.random();
        this.customers.push({ x: this.nextCust, kind: s < 0.45 ? 'cadeira' : s < 0.8 ? 'canga' : 'empe', seed: Math.random(), wants: Math.random() < 0.82, served: false, raise: 0, skin: U.choice(SKIN), suit: U.choice(SUITS), umb: U.choice(UMB), hair: U.choice(['#1f1410', '#3b2414', '#e8c170', '#7a3b1f', '#111']) });
        this.nextCust += U.rand(c.customerSpacing[0], c.customerSpacing[1]) * PXM;
      }
      while (this.nextObs < Math.min(ahead, this.goalX - 20 * PXM)) {
        const k = U.choice(['castelo', 'buraco', 'bola', 'balde', 'castelo']);
        // não coloca obstáculo colado num banhista (o vendedor para ali)
        if (!this.customers.some((cu) => Math.abs(cu.x - this.nextObs) < 2.6 * PXM)) this.obstacles.push({ x: this.nextObs, kind: k, w: { castelo: 84, buraco: 96, bola: 46, balde: 50 }[k], hit: false, seed: Math.random() });
        this.nextObs += U.rand(c.obstacleSpacing[0], c.obstacleSpacing[1]) * PXM;
      }
      this.customers = this.customers.filter((cu) => cu.x > this.x - 900);
      this.obstacles = this.obstacles.filter((o) => o.x > this.x - 900);
    }
    update(dt, t) {
      this.left = Math.max(0, Math.round((this.goalX - this.x) / PXM));
      for (const p of this.puffs) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      this.puffs = this.puffs.filter((p) => p.age < p.life);
      for (const c of this.cups) { c.t += dt; }
      this.cups = this.cups.filter((c) => c.t < 0.7);
      for (const c of this.coins) { c.age += dt; c.vy += 1400 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt; }
      this.coins = this.coins.filter((c) => c.age < 1.8);
      for (const cu of this.customers) cu.raise = U.damp(cu.raise, cu.wants && !cu.served && cu.x - this.x < 700 && cu.x - this.x > -40 ? 1 : 0, 6, dt);
    }

    // ------------------------------------------------------------ desenho
    draw(ctx, t, camX) {
      this._sky(ctx, t, camX);
      this._hills(ctx, camX);
      this._sea(ctx, t, camX);
      this._sand(ctx, camX);
      this._backBeach(ctx, camX, t);
      this._postos(ctx, camX);
      this._kiosk(ctx, this.goalX - camX, t);
      for (const o of this.obstacles) { const sx = o.x - camX; if (sx > -150 && sx < W + 150) this._obstacle(ctx, o, sx, t); }
      for (const cu of this.customers) { const sx = cu.x - camX; if (sx > -220 && sx < W + 220) this._customer(ctx, cu, sx, t); }
      for (const p of this.puffs) { ctx.globalAlpha = p.a * (1 - p.age / p.life); ctx.fillStyle = `rgb(${p.c})`; ctx.beginPath(); ctx.arc(p.x - camX, p.y, p.r * (1 + p.age), 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    _sky(ctx, t, camX) {
      const g = ctx.createLinearGradient(0, 0, 0, SEA); g.addColorStop(0, '#3b9fe0'); g.addColorStop(0.6, '#8fd0f5'); g.addColorStop(1, '#d9f1ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, SEA);
      // sol
      const sg = ctx.createRadialGradient(860, 300, 10, 860, 300, 220); sg.addColorStop(0, 'rgba(255,250,210,1)'); sg.addColorStop(0.25, 'rgba(255,236,150,0.9)'); sg.addColorStop(1, 'rgba(255,236,150,0)');
      ctx.fillStyle = sg; ctx.fillRect(600, 60, 520, 480);
      // nuvens
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (let i = 0; i < 6; i++) {
        const span = W + 600, x = ((i * 397 - camX * 0.06 - t * 6) % span + span) % span - 300, y = 430 + (i * 137) % 260, s = 0.7 + (i % 3) * 0.25;
        [[0, 0, 60], [55, -22, 48], [100, 4, 52], [50, 16, 56]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); ctx.fill(); });
      }
      // gaivotas ao longe
      ctx.strokeStyle = 'rgba(40,50,60,0.55)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const x = ((i * 300 - t * 30 - camX * 0.1) % 1300 + 1300) % 1300 - 100, y = 620 + i * 60 + Math.sin(t * 2 + i) * 10, f = Math.sin(t * 8 + i) * 6;
        ctx.beginPath(); ctx.moveTo(x - 16, y - f); ctx.quadraticCurveTo(x - 6, y - 8, x, y); ctx.quadraticCurveTo(x + 6, y - 8, x + 16, y - f); ctx.stroke(); }
    }
    // Dois Irmãos e Pão de Açúcar ao fundo
    _hills(ctx, camX) {
      const span = 2600, off = ((-camX * 0.08) % span + span) % span;
      for (let k = -1; k <= 1; k++) {
        const ox = off + k * span;
        ctx.fillStyle = '#6f9a86';
        // Dois Irmãos
        ctx.beginPath(); ctx.moveTo(ox - 200, SEA); ctx.quadraticCurveTo(ox - 60, SEA - 120, ox + 40, SEA - 250); ctx.quadraticCurveTo(ox + 90, SEA - 330, ox + 150, SEA - 250);
        ctx.quadraticCurveTo(ox + 190, SEA - 210, ox + 230, SEA - 230); ctx.quadraticCurveTo(ox + 280, SEA - 280, ox + 330, SEA - 210); ctx.quadraticCurveTo(ox + 430, SEA - 90, ox + 560, SEA); ctx.fill();
        // Pão de Açúcar e Urca
        const px = ox + 1450; ctx.fillStyle = '#5f8b77';
        ctx.beginPath(); ctx.moveTo(px - 160, SEA); ctx.quadraticCurveTo(px - 130, SEA - 140, px - 60, SEA - 150); ctx.quadraticCurveTo(px - 10, SEA - 150, px + 30, SEA - 90); ctx.lineTo(px + 60, SEA); ctx.fill();
        ctx.beginPath(); ctx.moveTo(px + 40, SEA); ctx.quadraticCurveTo(px + 60, SEA - 330, px + 160, SEA - 360); ctx.quadraticCurveTo(px + 250, SEA - 330, px + 280, SEA); ctx.fill();
        ctx.strokeStyle = 'rgba(40,50,60,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 60, SEA - 150); ctx.lineTo(px + 150, SEA - 358); ctx.stroke();
      }
    }
    _sea(ctx, t, camX) {
      const g = ctx.createLinearGradient(0, SEA, 0, SURF); g.addColorStop(0, '#1d6fa3'); g.addColorStop(0.5, '#2389b8'); g.addColorStop(1, '#3fb2c9');
      ctx.fillStyle = g; ctx.fillRect(0, SEA, W, SURF - SEA);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const y = SEA + 20 + i * 30, sp = 0.25 + i * 0.06, len = 50 + i * 12;
        for (let k = 0; k < 7; k++) { const x = ((k * 190 + i * 70 - camX * sp + Math.sin(t + i) * 20) % 1300 + 1300) % 1300 - 110; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y - 4, x + len, y); ctx.stroke(); }
      }
      // espuma da onda chegando
      const sw = Math.sin(t * 0.9) * 14;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.moveTo(0, SURF - 8 + sw);
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, SURF - 8 + sw + Math.sin((x + camX * 0.9) * 0.03 + t * 2) * 6);
      ctx.lineTo(W, SURF + 14 + sw); ctx.lineTo(0, SURF + 14 + sw); ctx.fill();
    }
    _sand(ctx, camX) {
      const g = ctx.createLinearGradient(0, SURF, 0, H); g.addColorStop(0, '#d8bf8e'); g.addColorStop(0.08, '#ead6a8'); g.addColorStop(1, '#f2e2b8');
      ctx.fillStyle = g; ctx.fillRect(0, SURF + 10, W, H - SURF);
      // marquinhas na areia
      ctx.fillStyle = 'rgba(160,130,80,0.18)';
      for (let i = 0; i < 70; i++) { const x = ((i * 157 - camX) % 1200 + 1200) % 1200 - 60, y = SURF + 60 + (i * 97) % (H - SURF - 80); ctx.beginPath(); ctx.ellipse(x, y, 8, 3, 0, 0, 7); ctx.fill(); }
    }
    // guarda-sóis e banhistas lá atrás (não pedem mate)
    _backBeach(ctx, camX, t) {
      const span = 2400;
      for (let i = 0; i < 14; i++) {
        const x = ((i * 173 - camX * 0.6) % span + span) % span - 200, y = SURF + 70 + (i % 3) * 22, s = 0.55, c = UMB[i % UMB.length];
        ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
        ctx.strokeStyle = '#6b5a45'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, -170); ctx.stroke();
        this._umbrella(ctx, 4, -170, 120, c);
        ctx.restore();
      }
    }
    _umbrella(ctx, x, y, r, c) {
      for (let k = 0; k < 6; k++) { ctx.fillStyle = c[k % 2]; ctx.beginPath(); ctx.moveTo(x, y - r * 0.32); const a0 = Math.PI + k * Math.PI / 6, a1 = a0 + Math.PI / 6; ctx.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r * 0.36); ctx.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r * 0.36); ctx.closePath(); ctx.fill(); }
    }
    // postos de salva-vidas marcando o caminho (Posto 2 ao Posto 6)
    _postos(ctx, camX) {
      for (let i = 0; i < 4; i++) {
        const x = (this.goalX * (i + 1)) / 5 - camX, n = 2 + i; if (x < -200 || x > W + 200) continue;
        ctx.save(); ctx.translate(x, SURF + 140);
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-8, -220, 16, 220);
        ctx.fillStyle = '#0f4c81'; U.roundRect(ctx, -70, -300, 140, 90, 10); ctx.fill();
        ctx.fillStyle = '#ffd23f'; ctx.font = `900 34px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText(`POSTO ${n}`, 0, -242);
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-70, -212, 140, 10);
        ctx.restore();
      }
    }
    // quiosque do Posto 6 (chegada)
    _kiosk(ctx, x, t) {
      if (x < -500 || x > W + 500) return;
      ctx.save(); ctx.translate(x + 120, GY + 10);
      ctx.fillStyle = '#7c4a24'; [-150, 150].forEach((dx) => ctx.fillRect(dx - 10, -330, 20, 330));
      ctx.fillStyle = '#16a34a'; U.poly(ctx, [-210, -320, 210, -320, 170, -410, -170, -410]); ctx.fill();
      ctx.fillStyle = '#fff'; for (let k = -190; k < 200; k += 40) { ctx.fillRect(k, -322, 20, 14); }
      ctx.fillStyle = '#f59e0b'; U.roundRect(ctx, -170, -150, 340, 150, 12); ctx.fill();
      ctx.fillStyle = '#7c2d12'; ctx.font = `46px ${U.FONT_TITLE}`; ctx.textAlign = 'center'; ctx.fillText('QUIOSQUE', 0, -86);
      ctx.font = `800 26px ${U.FONT_UI}`; ctx.fillText('POSTO 6 · CHEGADA', 0, -42);
      // coqueiros
      [-300, 290].forEach((dx, i) => { ctx.save(); ctx.translate(dx, 0); ctx.strokeStyle = '#8b5a2b'; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(i ? 30 : -30, -200, i ? 10 : -10, -420); ctx.stroke();
        ctx.fillStyle = '#15803d'; for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.5 + Math.sin(t * 1.5 + k) * 0.05; ctx.save(); ctx.translate(i ? 10 : -10, -420); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(70, 0, 80, 16, 0.25, 0, 7); ctx.fill(); ctx.restore(); }
        ctx.restore(); });
      ctx.restore();
    }
    _obstacle(ctx, o, sx, t) {
      ctx.save(); ctx.translate(sx, GY);
      if (o.hit) ctx.globalAlpha = 0.55;
      switch (o.kind) {
        case 'castelo':
          ctx.fillStyle = '#d6b678'; ctx.fillRect(-42, -54, 84, 54); ctx.fillStyle = '#c9a463';
          [-42, -14, 14].forEach((dx) => ctx.fillRect(dx, -70, 28, 16)); ctx.fillRect(-12, -96, 24, 30);
          ctx.fillStyle = '#ef4444'; U.poly(ctx, [0, -96, 0, -126, 22, -116]); ctx.fill(); ctx.strokeStyle = '#7c5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -96); ctx.lineTo(0, -128); ctx.stroke();
          ctx.fillStyle = '#7c5a2a'; U.roundRect(ctx, -10, -26, 20, 26, 8); ctx.fill(); break;
        case 'buraco':
          ctx.fillStyle = '#8a6a3c'; ctx.beginPath(); ctx.ellipse(0, -2, 52, 14, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#5a4320'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 9, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#e7cf9b'; ctx.beginPath(); ctx.ellipse(-62, -8, 18, 8, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(60, -6, 14, 7, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#2563eb'; ctx.save(); ctx.translate(58, -26); ctx.rotate(0.5); ctx.fillRect(-3, -30, 6, 40); U.roundRect(ctx, -12, 6, 24, 18, 4); ctx.fill(); ctx.restore(); break;
        case 'bola': {
          const b = Math.abs(Math.sin(t * 5 + o.seed * 9)) * 26;
          ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0, -2, 22 - b * 0.2, 6, 0, 0, 7); ctx.fill();
          ctx.translate(0, -24 - b); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
          ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 22, -0.6, 0.6); ctx.lineTo(0, 0); ctx.fill(); ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.arc(0, 0, 22, 1.5, 2.7); ctx.lineTo(0, 0); ctx.fill();
          ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(0, 0, 22, 3.6, 4.8); ctx.lineTo(0, 0); ctx.fill(); break;
        }
        case 'balde':
          ctx.fillStyle = '#f97316'; U.poly(ctx, [-22, -48, 22, -48, 16, 0, -16, 0]); ctx.fill();
          ctx.strokeStyle = '#7c2d12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -48, 22, Math.PI, 0); ctx.stroke();
          ctx.fillStyle = '#22c55e'; ctx.save(); ctx.translate(30, -6); ctx.rotate(-0.4); U.roundRect(ctx, -6, -40, 12, 44, 5); ctx.fill(); ctx.restore(); break;
      }
      ctx.restore();
    }
    // banhista sob o guarda-sol; quando quer mate, levanta a mão e grita
    _customer(ctx, cu, sx, t) {
      const y = GY - 70;
      ctx.save(); ctx.translate(sx, y);
      ctx.strokeStyle = '#6b5a45'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-60, 40); ctx.lineTo(-56, -230); ctx.stroke();
      this._umbrella(ctx, -56, -230, 150, cu.umb);
      const sk = cu.skin, su = cu.suit, r = cu.raise;
      if (cu.kind === 'canga') {
        ctx.fillStyle = su; U.roundRect(ctx, -110, 26, 200, 20, 6); ctx.fill();
        ctx.fillStyle = sk; U.roundRect(ctx, -80, 6, 130, 24, 12); ctx.fill(); ctx.beginPath(); ctx.arc(-86, 12, 17, 0, 7); ctx.fill();
        ctx.fillStyle = cu.hair; ctx.beginPath(); ctx.arc(-90, 6, 15, Math.PI, 0); ctx.fill();
        ctx.fillStyle = cu.suit === '#fff' ? '#111' : U.mix ? U.mix(su, '#000', 0.25) : su; U.roundRect(ctx, -20, 6, 36, 22, 6); ctx.fill();
        ctx.save(); ctx.translate(-60, 10); ctx.rotate(-1.2 - r * 0.9 + Math.sin(t * 9) * 0.15 * r); ctx.fillStyle = sk; U.roundRect(ctx, -6, -54, 12, 54, 6); ctx.fill(); ctx.restore();
      } else if (cu.kind === 'cadeira') {
        ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-40, 40); ctx.lineTo(0, -6); ctx.moveTo(30, 40); ctx.lineTo(-20, -6); ctx.stroke();
        ctx.fillStyle = cu.umb[0]; U.poly(ctx, [-36, -6, 14, -6, 0, -70, -46, -64]); ctx.fill();
        ctx.fillStyle = sk; U.roundRect(ctx, -30, -60, 30, 52, 12); ctx.fill(); ctx.beginPath(); ctx.arc(-16, -76, 18, 0, 7); ctx.fill();
        ctx.fillStyle = cu.hair; ctx.beginPath(); ctx.arc(-18, -82, 17, Math.PI, 0.2); ctx.fill();
        ctx.fillStyle = su; U.roundRect(ctx, -30, -24, 30, 20, 6); ctx.fill();
        ctx.fillStyle = sk; ctx.save(); ctx.translate(-8, -14); ctx.rotate(-0.25); U.roundRect(ctx, 0, -8, 56, 16, 8); ctx.fill(); ctx.translate(52, 0); ctx.rotate(1.2); U.roundRect(ctx, 0, -7, 46, 14, 7); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(-10, -50); ctx.rotate(-0.4 - r * 2.2 + Math.sin(t * 9) * 0.15 * r); ctx.fillStyle = sk; U.roundRect(ctx, -6, 0, 12, 50, 6); ctx.fill(); ctx.restore();
      } else {
        ctx.fillStyle = sk; U.roundRect(ctx, -20, -40, 14, 80, 7); ctx.fill(); U.roundRect(ctx, 2, -40, 14, 80, 7); ctx.fill();
        ctx.fillStyle = su; U.roundRect(ctx, -24, -54, 44, 26, 8); ctx.fill();
        ctx.fillStyle = sk; U.roundRect(ctx, -22, -120, 40, 70, 16); ctx.fill(); ctx.beginPath(); ctx.arc(-2, -140, 20, 0, 7); ctx.fill();
        ctx.fillStyle = cu.hair; ctx.beginPath(); ctx.arc(-4, -146, 19, Math.PI, 0.1); ctx.fill();
        ctx.save(); ctx.translate(12, -112); ctx.rotate(0.3 - r * 3 + Math.sin(t * 9) * 0.15 * r); ctx.fillStyle = sk; U.roundRect(ctx, -6, 0, 12, 56, 6); ctx.fill(); ctx.restore();
      }
      if (cu.served) { ctx.fillStyle = '#f59e0b'; U.roundRect(ctx, 24, -30, 22, 30, 4); ctx.fill(); ctx.fillStyle = '#fef3c7'; ctx.fillRect(24, -30, 22, 6); }
      ctx.restore();
      if (r > 0.3) {   // balão "MATE!"
        const bx = sx - 20, by = y - 300 - Math.sin(t * 6) * 6;
        ctx.save(); ctx.globalAlpha = r; ctx.fillStyle = '#fff'; U.roundRect(ctx, bx - 70, by - 34, 140, 54, 18); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx - 10, by + 18); ctx.lineTo(bx + 10, by + 18); ctx.lineTo(bx - 4, by + 40); ctx.fill();
        ctx.fillStyle = '#16a34a'; ctx.font = `900 30px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('MATE!', bx, by + 4); ctx.restore();
      }
    }
  }
  World.PXM = PXM; World.GY = GY; World.SURF = SURF;
  CNB.World = World;
})();
