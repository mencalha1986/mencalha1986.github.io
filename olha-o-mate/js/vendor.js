/* =========================================================================
   VENDEDOR DE MATE — visto de lado, andando para a direita na areia:
   boné, camiseta laranja, galão de mate e de limão no ombro, biscoito
   ========================================================================= */
(function () {
  const U = CNB.U;
  const GY = CNB.World.GY;

  class Vendor {
    constructor(cfg) { this.cfg = cfg; this.reset(); }
    reset() {
      this.x = 360; this.y = GY; this.vy = 0; this.jumpH = 0; this.air = false;
      this.speed = 0; this.impulse = 0; this.turbo = 0; this.rush = false; this.retreat = 0;
      this.stun = 0; this.sell = 0; this.walk = 0; this.shout = 0; this.cup = 0; this.dead = false; this.fall = 0;
      this.headScreen = { x: this.x + 10, y: GY - 250 };
    }
    // pulo: 1 s no ar (o ponto mais alto chega em 0,5 s)
    jump(power = 1) { if (this.air || this.stun > 0 || this.dead) return false; this.vy = -1150 * power; this.air = true; return true; }
    update(dt) {
      if (this.air) { this.vy += 2300 * dt; this.jumpH -= this.vy * dt; if (this.jumpH <= 0) { this.jumpH = 0; this.vy = 0; this.air = false; } }
      this.stun = Math.max(0, this.stun - dt); this.shout = Math.max(0, this.shout - dt); this.cup = Math.max(0, this.cup - dt);
      this.fall = U.damp(this.fall, this.stun > 0 || this.dead ? 1 : 0, 10, dt);
      if (this.speed !== 0 && !this.air && this.sell <= 0 && this.stun <= 0) this.walk += dt * (3 + Math.abs(this.speed) * 1.6) * Math.sign(this.speed);
      this.y = GY - this.jumpH;
      this.headScreen = { x: this.x + 14, y: this.y - 250 };
    }
    draw(ctx, t) {
      const x = this.x, y = this.y, ph = this.walk, run = this.turbo > 0;
      const leg = this.air ? 0.6 : Math.sin(ph) * (run ? 0.75 : 0.45), bob = this.air ? 0 : Math.abs(Math.cos(ph)) * (run ? 10 : 5);
      // sombra
      ctx.fillStyle = 'rgba(80,60,30,0.25)'; ctx.beginPath(); ctx.ellipse(x, GY + 4, 70 - this.jumpH * 0.05, 14, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y - bob);
      if (this.fall > 0.01) { ctx.translate(0, -10); ctx.rotate(this.fall * 1.35); ctx.translate(0, 10 * this.fall); }
      if (run) ctx.rotate(0.12);
      const skin = '#b9774d';
      const limb = (px, py, a, len, w, col) => { ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = col; U.roundRect(ctx, -w / 2, 0, w, len, w / 2); ctx.fill(); ctx.restore(); };
      // perna de trás + chinelo
      limb(-8, -120, -leg, 112, 26, '#9a5f3a'); ctx.save(); ctx.translate(-8, -120); ctx.rotate(-leg); ctx.fillStyle = '#1d4ed8'; U.roundRect(ctx, -12, 106, 42, 10, 5); ctx.fill(); ctx.restore();
      // galão de trás (limão)
      this._barrel(ctx, -58, -175, '#facc15', 'LIMÃO');
      // perna da frente
      limb(8, -120, leg, 112, 28, skin); ctx.save(); ctx.translate(8, -120); ctx.rotate(leg); ctx.fillStyle = '#2563eb'; U.roundRect(ctx, -12, 106, 44, 10, 5); ctx.fill(); ctx.restore();
      // bermuda
      ctx.fillStyle = '#1e3a5f'; U.roundRect(ctx, -32, -138, 66, 52, 10); ctx.fill();
      // tronco: camiseta laranja "MATE"
      ctx.fillStyle = '#f97316'; U.roundRect(ctx, -34, -240, 70, 112, 18); ctx.fill();
      ctx.fillStyle = '#fff7ed'; ctx.font = `900 20px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.save(); ctx.translate(2, -180); ctx.rotate(-0.04); ctx.fillText('MATE', 0, 0); ctx.restore();
      // alça do galão atravessando o peito
      ctx.strokeStyle = '#78350f'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-26, -236); ctx.lineTo(30, -150); ctx.stroke();
      // cabeça + boné
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(6, -268, 30, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(20, -272, 3.5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3f1d0c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(22, -256, 9, this.shout > 0 ? -0.2 : 0.3, this.shout > 0 ? 1.6 : 1.3); ctx.stroke();
      if (this.shout > 0) { ctx.fillStyle = '#3f1d0c'; ctx.beginPath(); ctx.ellipse(26, -254, 6, 8, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(4, -282, 30, Math.PI, 0); ctx.fill(); U.roundRect(ctx, 6, -290, 52, 12, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `900 13px ${U.FONT_UI}`; ctx.fillText('MATE', 2, -290);
      // galão da frente (mate) e saco de biscoito
      this._barrel(ctx, 52, -170, '#f59e0b', 'MATE');
      ctx.fillStyle = '#f8fafc'; U.roundRect(ctx, -60, -150, 34, 52, 6); ctx.fill(); ctx.fillStyle = '#16a34a'; ctx.fillRect(-60, -132, 34, 12); ctx.fillStyle = '#ef4444'; ctx.fillRect(-60, -116, 34, 6);
      // braço: levantado gritando / servindo / balançando
      const arm = this.sell > 0 ? -1.9 : this.shout > 0 ? -2.6 : run ? -leg * 1.4 - 0.6 : -leg * 0.8;
      ctx.save(); ctx.translate(14, -230); ctx.rotate(arm); ctx.fillStyle = skin; U.roundRect(ctx, -9, 0, 18, 92, 9); ctx.fill();
      if (this.cup > 0 || this.sell > 0) { ctx.fillStyle = '#fff7ed'; U.roundRect(ctx, -14, 86, 28, 34, 5); ctx.fill(); ctx.fillStyle = '#d97706'; ctx.fillRect(-12, 96, 24, 22); }
      ctx.restore();
      ctx.restore();
    }
    _barrel(ctx, x, y, color, label) {
      ctx.save(); ctx.translate(x, y);
      const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#9ca3af'); g.addColorStop(0.5, '#f3f4f6'); g.addColorStop(1, '#6b7280');
      ctx.fillStyle = g; U.roundRect(ctx, -30, -50, 60, 100, 12); ctx.fill();
      ctx.fillStyle = color; ctx.fillRect(-30, -14, 60, 30);
      ctx.fillStyle = '#1f2937'; ctx.font = `900 14px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText(label, 0, 6);
      ctx.fillStyle = '#374151'; U.roundRect(ctx, -10, 44, 20, 14, 4); ctx.fill();
      ctx.restore();
    }
  }
  CNB.Vendor = Vendor;
})();
