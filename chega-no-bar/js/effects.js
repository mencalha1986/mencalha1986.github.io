/* Partículas e efeitos de tela: confete, poeira, faíscas, textos flutuantes, linhas de velocidade */
(function () {
  const U = CNB.U;
  const CONF = ['#ff3b5c', '#ffd23f', '#25f4ee', '#7cff6b', '#ff8a1f', '#b388ff', '#ffffff'];

  class Effects {
    constructor() { this.p = []; this.flash = 0; this.flashColor = '255,255,255'; }

    confetti(x, y, n = 120, spread = 1) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + U.rand(-1.1, 1.1) * spread;
        const v = U.rand(600, 1500);
        this.p.push({ k: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, drag: 2.2, life: U.rand(2.5, 4.5), age: 0,
          w: U.rand(10, 20), h: U.rand(6, 12), rot: U.rand(0, 6), vr: U.rand(-10, 10), c: U.choice(CONF), fl: U.rand(0, 6) });
      }
    }
    rain(n = 8) {
      for (let i = 0; i < n; i++) this.p.push({ k: 'conf', x: U.rand(0, 1080), y: -20, vx: U.rand(-60, 60), vy: U.rand(200, 400), g: 120, drag: 0.4,
        life: 6, age: 0, w: U.rand(10, 18), h: U.rand(6, 10), rot: U.rand(0, 6), vr: U.rand(-8, 8), c: U.choice(CONF), fl: U.rand(0, 6) });
    }
    dust(x, y, n = 10, scale = 1) {
      for (let i = 0; i < n; i++) this.p.push({ k: 'dust', x: x + U.rand(-30, 30) * scale, y: y + U.rand(-6, 4), vx: U.rand(-160, 160) * scale, vy: U.rand(-120, -20) * scale,
        g: 60, drag: 3, life: U.rand(0.5, 1.1), age: 0, r: U.rand(10, 26) * scale });
    }
    sparks(x, y, n = 14, color = '#ffd23f') {
      for (let i = 0; i < n; i++) { const a = U.rand(0, Math.PI * 2), v = U.rand(250, 700);
        this.p.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 500, drag: 2.5, life: U.rand(0.3, 0.7), age: 0, c: color }); }
    }
    text(x, y, str, color = '#fff', size = 46, opts = {}) {
      this.p.push({ k: 'text', x, y, vx: opts.vx || 0, vy: opts.vy ?? -90, g: 0, drag: 0.5, life: opts.life || 1.4, age: 0, s: str, c: color, size, rot: opts.rot || U.rand(-0.12, 0.12) });
    }
    zzz(x, y) { this.p.push({ k: 'text', x, y, vx: U.rand(20, 50), vy: -60, g: 0, drag: 0, life: 2.2, age: 0, s: 'Z', c: '#cfd8ff', size: U.rand(40, 70), rot: -0.2 }); }
    doFlash(a = 0.6, color = '255,255,255') { this.flash = a; this.flashColor = color; }

    update(dt) {
      for (const q of this.p) {
        q.age += dt;
        q.vx -= q.vx * q.drag * dt; q.vy -= q.vy * q.drag * dt;
        q.vy += q.g * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.rot !== undefined && q.vr) q.rot += q.vr * dt;
      }
      this.p = this.p.filter((q) => q.age < q.life && q.y < 2100);
      this.flash = Math.max(0, this.flash - dt * 2.5);
    }

    draw(ctx) {
      for (const q of this.p) {
        const a = 1 - q.age / q.life;
        if (q.k === 'conf') {
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
          ctx.scale(1, Math.cos(q.age * 9 + q.fl));
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.fillStyle = q.c; ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
          ctx.restore();
        } else if (q.k === 'dust') {
          ctx.fillStyle = `rgba(150,140,125,${a * 0.35})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1.6 - a * 0.6), 0, 7); ctx.fill();
        } else if (q.k === 'spark') {
          ctx.strokeStyle = q.c; ctx.globalAlpha = a; ctx.lineWidth = 4; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (q.k === 'text') {
          const pop = Math.min(1, q.age * 6);
          ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(U.easeOutBack(pop), U.easeOutBack(pop));
          ctx.globalAlpha = Math.min(1, a * 2.5);
          ctx.font = `900 ${q.size}px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = q.size * 0.16; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round';
          ctx.strokeText(q.s, 0, 0); ctx.fillStyle = q.c; ctx.fillText(q.s, 0, 0);
          ctx.restore();
        }
      }
      if (this.flash > 0) { ctx.fillStyle = `rgba(${this.flashColor},${this.flash})`; ctx.fillRect(0, 0, 1080, 1920); }
    }

    clear() { this.p = []; }
  }

  // linhas de velocidade do turbo, saindo do ponto de fuga
  Effects.speedLines = function (ctx, cx, cy, amount, t) {
    if (amount <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 34; i++) {
      const a = U.hash(i * 1.3 + Math.floor(t * 20)) * Math.PI * 2;
      const r0 = 260 + U.hash(i * 2.1 + Math.floor(t * 30)) * 500;
      const len = 180 + U.hash(i * 3.7) * 420;
      ctx.strokeStyle = `rgba(255,240,200,${0.07 * amount})`;
      ctx.lineWidth = 2 + U.hash(i) * 5;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); ctx.stroke();
    }
    ctx.restore();
  };

  CNB.Effects = Effects;
})();
