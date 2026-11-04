/* =========================================================================
   AVIÃO DE CARGA (visto de lado) e o CAMINHÃO que descarrega no aeroporto
   ========================================================================= */
(function () {
  const U = CNB.U;

  function logo(ctx, x, y, s) {   // lupinha da marca
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = '#0e3a4a'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(-2, -2, 8, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(10, 10); ctx.stroke();
    ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(-3, 1); ctx.lineTo(3, -5); ctx.stroke();
    ctx.restore();
  }

  class Plane {
    constructor(cfg) { this.cfg = cfg; this.reset(); }
    reset() {
      Object.assign(this, { x: 330, y: 900, vy: 0, ang: 0, inv: 0, turbo: 0, impulse: 0, engine: 0, loop: 0, loopT: 0, wind: 0,
        speed: this.cfg.cruiseSpeed, prop: 0, wheels: 0, t: 0, dead: false, exploded: false, landed: false, flapT: 0, blink: 0 });
    }
    get busy() { return this.loop > 0; }
    get ghost() { return this.inv > 0 || this.turbo > 0 || this.loop > 0 || this.wind > 0; }
    flap(power = 1) {
      if (this.landed || this.dead) return;
      const k = this.engine > 0 ? 0.62 : 1;
      this.vy = Math.min(this.vy, -480 * k * power); this.flapT = 0.25;
    }
    update(dt) {
      this.t += dt; this.prop += dt * (this.dead ? 3 : 40 + this.speed * 3);
      this.inv = Math.max(0, this.inv - dt); this.flapT = Math.max(0, this.flapT - dt);
      if (this.loop > 0) {
        this.loop -= dt; this.loopT += dt;
        const u = U.clamp(this.loopT / 1.6, 0, 1);
        this.ang = -u * Math.PI * 2; this.vy = Math.sin(u * Math.PI * 2) * -520;   // sobe, vira de cabeça pra baixo e volta
        this.y += this.vy * dt;
        if (this.loop <= 0) { this.ang = 0; this.vy = 0; }
        return;
      }
      if (this.landed) { this.vy = 0; this.ang = U.damp(this.ang, 0, 6, dt); return; }
      const g = this.dead ? 520 : this.engine > 0 ? 1900 : 1450;
      this.vy = Math.min(this.vy + g * dt, this.dead ? 260 : 900);
      this.y += this.vy * dt;
      const target = U.clamp(this.vy * 0.0009, -0.45, 0.55);
      this.ang = U.damp(this.ang, target, 8, dt);
    }

    draw(ctx, t) {
      const blink = this.inv > 0 && Math.floor(t * 14) % 2 === 0;
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.ang); ctx.scale(1.18, 1.18);
      if (blink) ctx.globalAlpha = 0.45;
      if (this.turbo > 0) { const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 200); g.addColorStop(0, 'rgba(255,220,80,0.45)'); g.addColorStop(1, 'rgba(255,220,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 200, 0, 7); ctx.fill(); }
      // asa de trás
      ctx.fillStyle = '#1f6f63'; U.poly(ctx, [-20, -6, 40, -6, 18, -46, -2, -46]); ctx.fill();
      // cauda
      ctx.fillStyle = '#f8fafc'; U.poly(ctx, [-118, -12, -78, -12, -96, -78, -128, -80]); ctx.fill();
      ctx.fillStyle = '#82e8cc'; U.poly(ctx, [-112, -56, -98, -56, -96, -78, -128, -80]); ctx.fill();
      ctx.fillStyle = '#f8fafc'; U.poly(ctx, [-120, -6, -84, -6, -96, 6, -128, 6]); ctx.fill();
      // fuselagem
      const body = ctx.createLinearGradient(0, -40, 0, 40); body.addColorStop(0, '#ffffff'); body.addColorStop(1, '#cfd8dc');
      ctx.fillStyle = body; ctx.beginPath();
      ctx.moveTo(-122, -14); ctx.quadraticCurveTo(-60, -40, 40, -38); ctx.quadraticCurveTo(108, -36, 118, 0); ctx.quadraticCurveTo(108, 32, 40, 34); ctx.quadraticCurveTo(-60, 32, -122, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#82e8cc'; ctx.beginPath(); ctx.moveTo(-118, -2); ctx.quadraticCurveTo(-40, 6, 116, 4); ctx.lineTo(114, 12); ctx.quadraticCurveTo(-40, 16, -118, 6); ctx.fill();
      // MARCA bem grande no avião todo
      logo(ctx, -96, -14, 1.7);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `31px ${U.FONT_TITLE}`; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff';
      ctx.strokeText('ACHADOS ÚTEIS', -76, -6); ctx.fillStyle = '#0e3a4a'; ctx.fillText('ACHADOS ÚTEIS', -76, -6);
      ctx.fillStyle = '#0e3a4a'; ctx.font = `900 15px ${U.FONT_UI}`; ctx.fillText('POR AÍ', -88, 29);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-112, -58, 12, 0, 7); ctx.fill(); logo(ctx, -111, -57, 1.05);
      ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.moveTo(78, -34); ctx.quadraticCurveTo(104, -30, 110, -10); ctx.lineTo(82, -10); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(78, -34); ctx.quadraticCurveTo(104, -30, 110, -10); ctx.lineTo(82, -10); ctx.closePath(); ctx.clip();
      ctx.fillStyle = '#c98c64'; ctx.beginPath(); ctx.arc(92, -16, 10, 0, 7); ctx.fill();                 // piloto
      ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.arc(91, -20, 10, Math.PI, 0); ctx.fill();          // touca de aviador
      ctx.fillStyle = '#facc15'; ctx.fillRect(90, -20, 12, 5);                                              // óculos
      ctx.restore();
      // asa da frente
      ctx.fillStyle = '#2a9d8f'; U.poly(ctx, [-24, 6, 46, 6, 20, 52, -6, 52]); ctx.fill();
      ctx.fillStyle = '#fe2c55'; ctx.fillRect(-4, 46, 22, 6);
      // trem de pouso
      if (this.wheels > 0.02) {
        const L = 34 * this.wheels;
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(20, 28); ctx.lineTo(20, 28 + L); ctx.moveTo(-70, 22); ctx.lineTo(-70, 22 + L * 0.7); ctx.stroke();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(20, 32 + L, 12, 0, 7); ctx.arc(-70, 26 + L * 0.7, 9, 0, 7); ctx.fill();
      }
      // hélice
      ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.ellipse(122, 0, 9, 12, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(30,30,35,0.55)'; ctx.beginPath(); ctx.ellipse(128, 0, 6, 44 * Math.abs(Math.cos(this.prop)), 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(30,30,35,0.18)'; ctx.beginPath(); ctx.ellipse(128, 0, 5, 46, 0, 0, 7); ctx.fill();
      ctx.restore();
      const m = ctx.getTransform();
      this.headScreen = { x: this.x + Math.cos(this.ang) * 92 - Math.sin(this.ang) * -40, y: this.y + Math.sin(this.ang) * 92 + Math.cos(this.ang) * -40 };
      this.doorScreen = { x: this.x - 44 * Math.cos(this.ang), y: this.y - 44 * Math.sin(this.ang) - 8 };
      void m;
    }
  }

  // caminhão baú da marca (de lado, cabine para a direita)
  function truck(ctx, x, y, open, t, wheelRot) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(40, 4, 230, 14, 0, 0, 7); ctx.fill();
    // baú
    ctx.fillStyle = '#f8fafc'; U.roundRect(ctx, -170, -210, 300, 170, 10); ctx.fill();
    ctx.fillStyle = '#82e8cc'; ctx.fillRect(-170, -78, 300, 18);
    ctx.fillStyle = '#0e3a4a'; ctx.font = `46px ${U.FONT_TITLE}`; ctx.textAlign = 'center'; ctx.fillText('ACHADOS ÚTEIS', -20, -128);
    ctx.font = `800 20px ${U.FONT_UI}`; ctx.fillText('por aí · entregas', -20, -98);
    logo(ctx, 100, -175, 2);
    // porta traseira (lado esquerdo) abrindo
    ctx.fillStyle = '#e2e8f0'; ctx.save(); ctx.translate(-170, -210); ctx.scale(1 - open * 0.85, 1); ctx.fillRect(-0, 0, 26, 170); ctx.restore();
    if (open > 0.1) { ctx.fillStyle = '#334155'; ctx.fillRect(-168, -206, 22 * open, 162); }
    // chassi e cabine
    ctx.fillStyle = '#334155'; ctx.fillRect(-170, -42, 380, 16);
    ctx.fillStyle = '#fe2c55'; U.roundRect(ctx, 136, -150, 96, 112, 14); ctx.fill();
    ctx.fillStyle = '#7dd3fc'; U.roundRect(ctx, 176, -138, 46, 46, 8); ctx.fill();
    ctx.fillStyle = '#c98c64'; ctx.beginPath(); ctx.arc(196, -112, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(196, -118, 11, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fde68a'; ctx.fillRect(226, -64, 8, 14);
    // rodas
    [-120, -60, 170].forEach((wx) => {
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(wx, -18, 26, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(wx, -18); ctx.rotate(wheelRot); ctx.fillStyle = '#9ca3af'; ctx.fillRect(-12, -3, 24, 6); ctx.fillRect(-3, -12, 6, 24); ctx.restore();
    });
    ctx.restore();
  }

  Plane.logo = logo;
  CNB.Plane = Plane;
  CNB.drawTruck = truck;
})();
