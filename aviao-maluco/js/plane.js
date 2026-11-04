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
        speed: this.cfg.cruiseSpeed, shield: 0, prop: 0, wheels: 0, t: 0, dead: false, exploded: false, landed: false, flapT: 0, blink: 0 });
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
      if (this.shield > 0) {   // bolha do escudo
        const a = this.shield < 3 ? (Math.floor(t * 8) % 2 ? 0.25 : 0.6) : 0.6;
        const g = ctx.createRadialGradient(0, 0, 60, 0, 0, 175); g.addColorStop(0, 'rgba(34,211,238,0)'); g.addColorStop(0.8, `rgba(34,211,238,${a * 0.35})`); g.addColorStop(1, `rgba(180,250,255,${a})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 175, 110, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(200,255,255,${a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 175, 110, 0, -1.2 + t, 0.4 + t); ctx.stroke();
      }
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
      // porta de carga aberta (no pouso)
      if (this.doorOpen > 0.02) {
        const o = this.doorOpen;
        ctx.fillStyle = '#1d232a'; U.roundRect(ctx, -114, -26, 36, 44, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,220,150,0.25)'; ctx.fillRect(-110, -22, 28, 36);
        ctx.fillStyle = '#c69c6d'; ctx.fillRect(-108, -4, 14, 14); ctx.fillRect(-96, 0, 12, 10);   // caixas lá dentro
        ctx.fillStyle = '#e8eef1'; ctx.save(); ctx.translate(-78, -26); ctx.scale(1 - o * 0.85, 1); ctx.fillRect(0, 0, 36, 44); ctx.restore();
        ctx.strokeStyle = 'rgba(30,41,59,0.6)'; ctx.lineWidth = 1.5; U.roundRect(ctx, -114, -26, 36, 44, 4); ctx.stroke();
      }
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

  // caminhão baú (VUC) da marca, de lado, cabine à direita — desenhado uma vez e reaproveitado
  let truckImg = null;
  function truckSprite() {
    if (truckImg) return truckImg;
    const c = document.createElement('canvas'); c.width = 480; c.height = 260; const x = c.getContext('2d');
    const L = (x0, y0, x1, y1, st) => { const g = x.createLinearGradient(x0, y0, x1, y1); st.forEach(([o, cc]) => g.addColorStop(o, cc)); return g; };
    x.translate(200, 250);   // (0,0) = chão no meio do baú
    // chassi e para-choque
    x.fillStyle = '#2b3036'; x.fillRect(-196, -52, 420, 14);
    x.fillStyle = '#41474e'; x.fillRect(-200, -44, 16, 16);
    // baú com painéis
    x.fillStyle = L(0, -222, 0, -52, [[0, '#ffffff'], [0.7, '#eef2f4'], [1, '#d5dde2']]); x.fillRect(-196, -222, 300, 170);
    x.fillStyle = 'rgba(0,0,0,0.05)'; for (let px = -196; px < 104; px += 30) x.fillRect(px, -222, 2, 170);
    x.fillStyle = '#c9d2d8'; x.fillRect(-196, -222, 300, 6); x.fillRect(-196, -58, 300, 6);
    // faixa e marca
    x.fillStyle = L(-196, 0, 104, 0, [[0, '#0e3a4a'], [1, '#1c6a6a']]); x.fillRect(-196, -110, 300, 40);
    x.fillStyle = '#82e8cc'; x.fillRect(-196, -70, 300, 5);
    x.fillStyle = '#0e3a4a'; x.font = `44px ${U.FONT_TITLE}`; x.textAlign = 'left'; x.fillText('ACHADOS ÚTEIS', -138, -140);
    x.font = `800 17px ${U.FONT_UI}`; x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.fillText('achadosuteisporai.com.br', -36, -84); x.textAlign = 'left';
    logo(x, 72, -190, 1.6);
    // cabine
    x.fillStyle = L(104, -170, 104, -40, [[0, '#ff4d6d'], [1, '#c8163f']]);
    x.beginPath(); x.moveTo(108, -52); x.lineTo(108, -168); x.lineTo(176, -168); x.quadraticCurveTo(198, -166, 206, -130); x.lineTo(222, -96); x.lineTo(226, -52); x.closePath(); x.fill();
    x.fillStyle = L(170, -160, 214, -100, [[0, '#cfeaff'], [1, '#4e7fa8']]);  // para-brisa inclinado
    x.beginPath(); x.moveTo(180, -160); x.quadraticCurveTo(196, -158, 202, -132); x.lineTo(214, -102); x.lineTo(182, -102); x.closePath(); x.fill();
    x.fillStyle = L(120, -156, 172, -104, [[0, '#d7ecff'], [1, '#5c84a8']]); U.roundRect(x, 122, -156, 50, 52, 6); x.fill();   // janela da porta
    x.strokeStyle = 'rgba(80,10,25,0.45)'; x.lineWidth = 2; x.strokeRect(116, -160, 62, 104);              // contorno da porta
    x.fillStyle = '#2b3036'; x.fillRect(160, -96, 12, 4);                                                    // maçaneta
    x.fillStyle = '#1f2328'; x.fillRect(112, -150, 6, 30); x.fillRect(102, -150, 12, 4);                    // retrovisor
    x.fillStyle = '#e5e7eb'; U.roundRect(x, 206, -86, 22, 34, 4); x.fill(); x.fillStyle = '#fff6c8'; x.fillRect(212, -80, 12, 10);   // farol
    x.fillStyle = '#41474e'; x.fillRect(196, -54, 34, 12);                                                   // para-choque
    // caixas de roda
    x.fillStyle = '#1f2328'; [-140, -84, 170].forEach((wx) => { x.beginPath(); x.arc(wx, -40, 34, Math.PI, 0); x.fill(); });
    truckImg = c; return c;
  }
  function wheelDraw(ctx, x, y, rot) {
    ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.arc(x, y, 27, 0, 7); ctx.fill();
    ctx.fillStyle = '#9aa1a8'; ctx.beginPath(); ctx.arc(x, y, 14, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = '#5b6168';
    for (let i = 0; i < 5; i++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.arc(8, 0, 2.6, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function truck(ctx, x, y, open, t, wheelRot, cabDoor = 0) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(10, 2, 240, 12, 0, 0, 7); ctx.fill();
    ctx.drawImage(truckSprite(), -200, -250);
    [-140, -84, 170].forEach((wx) => wheelDraw(ctx, wx, -18, wheelRot));
    // portas traseiras abrindo (lado esquerdo) com o interior escuro
    if (open > 0.02) {
      ctx.fillStyle = '#20262c'; ctx.fillRect(-196, -216, 10 + 30 * open, 160);
      ctx.fillStyle = '#c69c6d'; for (let i = 0; i < 3; i++) ctx.fillRect(-192, -96 - i * 26, 22 * open, 24);
    }
    ctx.fillStyle = '#e6ebee'; ctx.save(); ctx.translate(-196, -222); ctx.scale(Math.max(0.12, 1 - open), 1); ctx.fillRect(-40, 0, 40, 170); ctx.restore();
    // porta da cabine abrindo
    if (cabDoor > 0.02) { ctx.fillStyle = '#b3123a'; ctx.save(); ctx.translate(178, -160); ctx.scale(1 - cabDoor * 0.8, 1); ctx.fillRect(-62, 0, 62, 104); ctx.restore(); ctx.fillStyle = '#20262c'; ctx.fillRect(116, -160, 62 * cabDoor * 0.8, 104); }
    ctx.restore();
  }

  // ajudante uniformizado (de lado), andando; leva a caixa nos braços
  function worker(ctx, w, gy, t, catalog) {
    const s = 1, wk = Math.sin(w.walk) * 0.5, carrying = !!w.carry;
    ctx.save(); ctx.translate(w.x, gy); ctx.scale(w.dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0, -2, 26, 6, 0, 0, 7); ctx.fill();
    const leg = (a, col) => { ctx.save(); ctx.translate(0, -52); ctx.rotate(a); ctx.fillStyle = col; U.roundRect(ctx, -6, 0, 12, 48, 5); ctx.fill(); ctx.fillStyle = '#1b1d20'; U.roundRect(ctx, -6, 44, 20, 9, 3); ctx.fill(); ctx.restore(); };
    leg(-wk, '#3b4652'); leg(wk, '#4a5663');                      // pernas (calça de trabalho)
    ctx.fillStyle = '#1f6f63'; U.roundRect(ctx, -13, -100, 26, 52, 8); ctx.fill();   // camisa polo
    ctx.fillStyle = '#82e8cc'; ctx.fillRect(-13, -72, 26, 4);
    ctx.fillStyle = '#c4935f'; ctx.fillRect(-4, -108, 8, 8);                         // pescoço
    ctx.beginPath(); ctx.ellipse(1, -117, 10, 11, 0, 0, 7); ctx.fill();               // cabeça
    ctx.fillStyle = '#0e3a4a'; ctx.beginPath(); ctx.arc(0, -121, 10.5, Math.PI, 0); ctx.fill(); ctx.fillRect(4, -123, 12, 4);   // boné
    ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.arc(6, -117, 1.4, 0, 7); ctx.fill();
    if (carrying) {
      // braços esticados segurando a caixa com o produto
      ctx.strokeStyle = '#1f6f63'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(2, -94); ctx.lineTo(20, -80); ctx.stroke();
      ctx.save(); ctx.translate(30, -84);
      ctx.fillStyle = '#c69c6d'; ctx.fillRect(-16, -20, 40, 36); ctx.fillStyle = '#a77d50'; ctx.fillRect(-16, -20, 40, 5); ctx.fillStyle = '#82e8cc'; ctx.fillRect(0, -20, 6, 36);
      if (catalog) { ctx.scale(w.dir, 1); catalog.drawPhoto(ctx, w.carry, -12, -12, 24, 3); }
      ctx.restore();
      ctx.fillStyle = '#e8e8e2'; ctx.beginPath(); ctx.arc(22, -70, 5, 0, 7); ctx.fill();   // luva
    } else {
      ctx.strokeStyle = '#1f6f63'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -94); ctx.lineTo(Math.sin(w.walk + Math.PI) * 14, -62); ctx.stroke();
      ctx.fillStyle = '#e8e8e2'; ctx.beginPath(); ctx.arc(Math.sin(w.walk + Math.PI) * 14, -60, 5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  Plane.logo = logo;
  CNB.Plane = Plane;
  CNB.drawTruck = truck;
  CNB.drawWorker = worker;
})();
