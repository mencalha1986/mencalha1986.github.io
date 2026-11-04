/* =========================================================================
   MOTOBOY — máquina de estados + desenho (visto de trás)
   Moto vermelha com BAÚ preto da marca, jaqueta preta, capacete branco.
   Também desenha o CLIENTE que sai do portão e o CARAMELO que persegue.
   ========================================================================= */
(function () {
  const U = CNB.U;
  const S = { RIDE: 'ride', RUN: 'run', CHASE: 'chase', BACK: 'back', WOBBLE: 'wobble', NEAR: 'near', FALL: 'fall', DOWN: 'down',
              GETUP: 'getup', FLAT: 'flat', ARRIVE: 'arrive', STOP: 'stop', NOGAS: 'nogas' };

  function logo(ctx, x, y, sc) {
    const MINT = '#82e8cc', CREAM = '#f3efe7', INK = '#0e3a4a', GOLD = '#ffd45e';
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.strokeStyle = CREAM; ctx.lineCap = 'round'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(4.2, 4.2); ctx.lineTo(8.6, 8.6); ctx.stroke();
    ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    ctx.fillStyle = MINT; ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-2.6, 0.2); ctx.lineTo(-0.6, 2.2); ctx.lineTo(2.9, -1.9); ctx.stroke();
    ctx.fillStyle = GOLD; U.star(ctx, 9.2, -6.2, 2.2, 0.7, 4); ctx.fill();
    ctx.fillStyle = CREAM; U.star(ctx, -8.8, -3.6, 1.4, 0.45, 4); ctx.fill();
    ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 6.4px ${U.FONT_UI}`; ctx.fillText('achados úteis', 0, 17.5);
    ctx.fillStyle = MINT; U.roundRect(ctx, -6.2, 19.2, 12.4, 4.8, 2.4); ctx.fill();
    ctx.fillStyle = INK; ctx.font = `800 3.5px ${U.FONT_UI}`; ctx.fillText('por aí', 0, 22.9);
    ctx.restore();
  }
  function cap(ctx, a, b, ra, rb, c1, c2) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 0.001, ang = Math.atan2(dy, dx), nx = -dy / len, ny = dx / len;
    ctx.beginPath(); ctx.arc(a.x, a.y, ra, ang + Math.PI / 2, ang - Math.PI / 2 + Math.PI * 2); ctx.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2); ctx.closePath();
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, r = Math.max(ra, rb);
    const g = ctx.createLinearGradient(m.x - nx * r, m.y - ny * r, m.x + nx * r, m.y + ny * r);
    g.addColorStop(0, c2); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fill();
  }

  class Rider {
    constructor(cfg) { this.cfg = cfg; this.reset(); }
    reset() {
      Object.assign(this, { z: 0, x: 1.6, baseX: 1.6, targetX: 1.6, steer: 0, speed: 0, impulse: 0, turbo: 0, chase: 0, retreat: 0, slide: 0,
        state: S.RIDE, st: 0, t: 0, phase: 0, roll: 0, jump: 0, vy: 0, fallDir: 1, fall: 0, slowT: 0, legsUp: 0, footDown: 0, brake: 0,
        lookSide: 0, stopZ: 0, manual: this.manual || false, headScreen: { x: 540, y: 900 }, boxScreen: { x: 540, y: 1100 } });
    }
    get busy() { return [S.WOBBLE, S.NEAR, S.FALL, S.DOWN, S.GETUP, S.FLAT].includes(this.state); }
    get finished() { return [S.ARRIVE, S.STOP, S.NOGAS].includes(this.state); }
    setState(s) { if (this.state === s) return; this.prev = this.state; this.state = s; this.st = 0; this.onEvent && this.onEvent('state', s); }
    force(s) { this.state = null; this.setState(s); }

    cancelAction() {
      if (this.finished) return;
      this.turbo = 0; this.impulse = 0; this.retreat = 0; this.chase = 0; this.slowT = 0; this.waitFix = false; this.tireOk = false;
      if ([S.RUN, S.CHASE, S.BACK, S.WOBBLE, S.NEAR, S.FLAT].includes(this.state)) this.force(S.RIDE);
      else if ([S.FALL, S.DOWN].includes(this.state)) { this.force(S.GETUP); this.st = 0.4; }
    }
    hit(kind, dir) {
      if (this.finished) return;
      this.fallDir = dir || 1;
      if (kind === 'crash') { this.turbo = 0; this.slide = Math.min(2, this.speed * 0.15); this.force(S.FALL); }
      else if (kind === 'stop') this.force(S.NEAR);
      else if (kind === 'wobble' || kind === 'jolt') { this.force(S.WOBBLE); if (kind === 'jolt') this.vy = 1.6; }
      else if (kind === 'jump') { if (this.speed > 6) this.vy = 3.6; else this.vy = 1.2; }
    }

    update(dt, city) {
      this.t += dt; this.st += dt;
      const c = this.cfg;
      let target = 0, lerp = 3;
      switch (this.state) {
        case S.RIDE:
          if (this.retreat > 0) { this.setState(S.BACK); break; }
          if (this.chase > 0) { this.setState(S.CHASE); break; }
          if (this.turbo > 0) { this.setState(S.RUN); break; }
          if (this.impulse > 0) { target = c.rideSpeed; this.impulse = Math.max(0, this.impulse - this.speed * dt); } else target = c.cruiseSpeed;
          if (this.slowT > 0) { this.slowT -= dt; target = Math.min(target, 2.2); }
          break;
        case S.RUN: target = c.runSpeed; lerp = 2.2; this.turbo -= dt; if (this.turbo <= 0) { this.turbo = 0; this.setState(S.RIDE); this.onEvent && this.onEvent('runEnd'); } break;
        case S.CHASE: target = c.chaseSpeed; lerp = 2.5; this.chase -= dt; if (this.chase <= 0) { this.chase = 0; this.setState(S.RIDE); this.onEvent && this.onEvent('chaseEnd'); } break;
        case S.BACK: target = -c.backSpeed; this.retreat -= c.backSpeed * dt; if (this.retreat <= 0 || this.z <= 0) { this.retreat = 0; this.setState(S.RIDE); } break;
        case S.WOBBLE: target = this.speed * 0.6; if (this.st > 0.9) this.setState(S.RIDE); break;
        case S.NEAR: target = 0; lerp = 9; this.brake = 1; if (this.st > 0.9) this.setState(S.RIDE); break;
        case S.FALL: target = 0; lerp = 4; if (this.st > 0.45) { this.setState(S.DOWN); this.onEvent && this.onEvent('impact'); } break;
        case S.DOWN: target = 0; if (this.st > 1.3) this.setState(S.GETUP); break;
        case S.GETUP: target = 0; if (this.st > 1.0) this.setState(S.RIDE); break;
        case S.FLAT: target = 0; lerp = 6; if (!this.waitFix && this.st > 2.8) { this.slowT = 3; this.setState(S.RIDE); } break;   // waitFix: esperando o borracheiro
        case S.ARRIVE: {
          const left = this.stopZ - this.z;
          target = U.clamp(left * 1.3, 0.8, Math.max(2.5, this.speed)); lerp = 4; this.brake = 1;
          if (left <= 0.08) { this.z = this.stopZ; this.speed = 0; this.setState(S.STOP); }
          break;
        }
        case S.STOP: target = 0; lerp = 20; break;
        case S.NOGAS: target = 0; lerp = 1.2; break;
      }
      if (target > 0 && this.speedCap !== undefined && this.speedCap < target) { target = this.speedCap; lerp = Math.max(lerp, 7); if (this.speed > target + 1) this.brake = 1; }   // freia para virar a esquina
      this.speed = U.damp(this.speed, target, lerp, dt);
      if (this.state === S.STOP) this.speed = 0;
      if (this.slide > 0) { const r = Math.min(this.slide, dt * 4); this.slide -= r; this.z += r; }
      this.z = Math.max(0, this.z + this.speed * dt);
      if (this.state !== S.NEAR && this.state !== S.ARRIVE) this.brake = Math.max(0, this.brake - dt * 3);

      // pulo (lombada / buraco)
      if (this.vy || this.jump > 0) { this.vy -= 14 * dt; this.jump = Math.max(0, this.jump + this.vy * dt); if (this.jump === 0 && this.vy < 0) { if (this.vy < -3) this.onEvent && this.onEvent('land'); this.vy = 0; } }

      // direção
      const R = city.road(this.z) - 0.6;
      if (this.state === S.ARRIVE || this.state === S.STOP) this.targetX = (this.stopSide || 1) * (R - 0.4);
      else if (this.manual && !this.busy) this.targetX += (this.steer || 0) * 5 * dt;
      this.targetX = U.clamp(this.targetX, -R, R);
      if (!this.busy || this.state === S.WOBBLE) this.baseX = U.damp(this.baseX, this.targetX, this.manual ? 4 : this.state === S.RUN || this.state === S.CHASE ? 3.4 : 2.6, dt);
      this.baseX = U.clamp(this.baseX, -R - 0.3, R + 0.3);
      const wob = this.state === S.WOBBLE ? Math.sin(this.st * 26) * 0.25 * (1 - this.st / 0.9) : this.state === S.CHASE ? Math.sin(this.t * 7) * 0.18 : 0;
      this.x = this.baseX + wob;
      const rollT = U.clamp((this.targetX - this.baseX) * 0.16, -0.38, 0.38) + wob * 0.6;
      this.roll = U.damp(this.roll, this.busy && this.state !== S.WOBBLE ? 0 : rollT, 6, dt);

      // poses
      const fallT = this.state === S.FALL ? U.easeInCubic(Math.min(1, this.st / 0.45)) * 1.3 : this.state === S.DOWN ? 1.3 : this.state === S.GETUP ? 1.3 * (1 - U.easeInOut(Math.min(1, this.st / 0.8))) : 0;
      this.fall = fallT;
      this.legsUp = U.damp(this.legsUp, this.state === S.CHASE ? 1 : 0, 8, dt);
      this.footDown = U.damp(this.footDown, [S.STOP, S.NEAR, S.FLAT, S.NOGAS].includes(this.state) || (this.speed < 0.6 && !this.finished && this.state !== S.FALL && this.state !== S.DOWN) ? 1 : 0, 8, dt);
      this.lookSide = U.damp(this.lookSide, this.state === S.STOP ? (this.stopSide || 1) : this.state === S.CHASE ? -0.6 * Math.sign(Math.sin(this.t * 2)) : 0, 5, dt);
      this.phase += this.speed * dt * 3;
    }

    // ------------------------------------------------------------ desenho
    draw(ctx, city, cam) {
      const p = city.proj(cam, this.x, this.jump, this.z), g = city.proj(cam, this.x, 0, this.z);
      if (!p || !g) return;
      const k = p.s / 100, t = this.t;
      // sombra
      ctx.save(); ctx.translate(g.x, g.y); ctx.scale(1, 0.25);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 60 * k);
      sg.addColorStop(0, 'rgba(0,0,0,0.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 60 * k * (1 - this.jump * 0.2), 0, 7); ctx.fill(); ctx.restore();

      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(k, k);
      if (this.fall) { const px = this.fallDir * 22; ctx.translate(px, 0); ctx.rotate(this.fallDir * this.fall); ctx.translate(-px, 0); }
      ctx.rotate(this.roll + (this.turnLean || 0));
      const L = this.legsUp, FD = this.footDown;
      const vib = this.speed > 0.3 && !this.finished ? Math.sin(t * 60) * 0.6 : 0;
      ctx.translate(0, vib);

      // guidão e retrovisores (lá na frente)
      ctx.strokeStyle = '#222'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      [-1, 1].forEach((sd) => {
        ctx.beginPath(); ctx.moveTo(sd * 30, -150); ctx.lineTo(sd * 40, -186); ctx.stroke();
        ctx.fillStyle = '#1b1c20'; ctx.beginPath(); ctx.ellipse(sd * 42, -190, 7, 5, sd * 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(180,210,240,0.7)'; ctx.beginPath(); ctx.ellipse(sd * 42, -190, 5, 3.4, sd * 0.3, 0, 7); ctx.fill();
        ctx.fillStyle = '#111'; U.roundRect(ctx, sd * 36 - 5, -155, 10, 9, 3); ctx.fill();
      });
      if (!this.dismounted) {   // motoboy desceu para entregar: só a moto fica
      // braços (jaqueta preta)
      const sh = (sd) => ({ x: sd * 20, y: -190 });
      [-1, 1].forEach((sd) => {
        const hand = L > 0.5 ? { x: sd * 36, y: -152 } : { x: sd * 36, y: -151 };
        const el = { x: sd * 34, y: -170 };
        cap(ctx, sh(sd), el, 8, 7, '#2a2d34', '#101116');
        cap(ctx, el, hand, 7, 6, '#2a2d34', '#101116');
        ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(hand.x, hand.y, 6, 0, 7); ctx.fill();
      });
      // tronco (jaqueta) com faixa refletiva
      const tg = ctx.createLinearGradient(-24, 0, 24, 0);
      tg.addColorStop(0, '#0e0f13'); tg.addColorStop(0.5, '#2b2e36'); tg.addColorStop(1, '#0e0f13');
      ctx.fillStyle = tg; U.roundRect(ctx, -24, -200, 48, 70, 16); ctx.fill();
      ctx.fillStyle = 'rgba(220,230,240,0.75)'; ctx.fillRect(-23, -170, 46, 4);
      // capacete
      const hx = this.lookSide * 6, hy = -218;
      const hg = ctx.createRadialGradient(hx - 5, hy - 6, 2, hx, hy, 18);
      hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.7, '#e8ebef'); hg.addColorStop(1, '#b9c0c8');
      ctx.fillStyle = '#1a1b1f'; U.roundRect(ctx, -9, -206, 18, 10, 4); ctx.fill();
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, 16, 17, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#82e8cc'; ctx.fillRect(hx - 3, hy - 17, 6, 34);
      if (Math.abs(this.lookSide) > 0.3) { const ls = Math.sign(this.lookSide); ctx.fillStyle = '#20252b'; ctx.beginPath(); ctx.ellipse(hx + 11 * ls, hy + 1, 5, 9, 0, 0, 7); ctx.fill(); }
      // pernas (dobradas na pedaleira; para cima fugindo do cachorro; pé no chão parado)
      [-1, 1].forEach((sd) => {
        const hip = { x: sd * 14, y: -112 };
        let knee = { x: sd * 32, y: -96 }, boot = { x: sd * 28, y: -42 };
        if (L > 0.01) { knee = { x: U.lerp(knee.x, sd * 46, L), y: U.lerp(knee.y, -140, L) }; boot = { x: U.lerp(boot.x, sd * 60 + Math.sin(t * 20 + sd) * 4 * L, L), y: U.lerp(boot.y, -122, L) }; }
        if (sd < 0 && FD > 0.01) { knee = { x: U.lerp(knee.x, -36, FD), y: U.lerp(knee.y, -66, FD) }; boot = { x: U.lerp(boot.x, -42, FD), y: U.lerp(boot.y, 0, FD) }; }
        if (this.state === S.FLAT && sd > 0 && this.st < 2.2) { boot = { x: 30 + Math.max(0, Math.sin(this.st * 9)) * 16, y: -30 }; }
        cap(ctx, hip, knee, 10, 9, '#3a4a66', '#1e2638');
        cap(ctx, knee, boot, 9, 7, '#3a4a66', '#1e2638');
        ctx.fillStyle = '#111'; U.roundRect(ctx, boot.x - 8, boot.y - 9, 16, 12, 4); ctx.fill();
      });
      }
      // carenagem lateral, banco
      ctx.fillStyle = '#c1121f'; U.roundRect(ctx, -22, -104, 44, 26, 10); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-18, -100, 12, 4);
      // escapamento (lado direito)
      cap(ctx, { x: 18, y: -38 }, { x: 30, y: -58 }, 5, 6, '#d6d9de', '#7c828a');
      if (this.speed > 0.3 && Math.random() < 0.3) { ctx.fillStyle = 'rgba(200,200,200,0.25)'; ctx.beginPath(); ctx.arc(34 + Math.random() * 6, -36 + Math.random() * 6, 5, 0, 7); ctx.fill(); }
      // pneu traseiro
      const flat = this.state === S.FLAT && !this.tireOk ? 1 : 0;
      if (flat) {
        // PNEU MURCHO: achatado no chão, borracha esparramada e enrugada
        ctx.fillStyle = '#121214'; U.roundRect(ctx, -10, -50, 20, 40, 8); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -6, 22, 8, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -14, 17, 9, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5;
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 9, -22); ctx.quadraticCurveTo(sd * 18, -12, sd * 12, -4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sd * 6, -30); ctx.quadraticCurveTo(sd * 13, -24, sd * 10, -16); ctx.stroke(); }
        ctx.fillStyle = '#9aa0a6'; ctx.fillRect(-2, -30, 4, 5);   // prego
        ctx.fillStyle = '#c9ccd2'; ctx.fillRect(-4, -33, 8, 3);
      } else {
        ctx.fillStyle = '#121214'; U.roundRect(ctx, -9, -64, 18, 64, 9); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 6; i++) ctx.fillRect(-7, -60 + ((i * 11 + this.phase * 30) % 60), 14, 2);
      }
      // para-lama, placa e lanterna
      ctx.fillStyle = '#1a1b1f'; U.roundRect(ctx, -14, -76, 28, 14, 5); ctx.fill();
      ctx.fillStyle = '#e9ecef'; U.roundRect(ctx, -13, -74, 26, 12, 2); ctx.fill();
      ctx.fillStyle = '#1d3a8a'; ctx.fillRect(-13, -74, 26, 3);
      ctx.fillStyle = '#222'; ctx.font = `800 6px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('ACH4D05', 0, -64.5);
      const br = this.brake;
      ctx.fillStyle = br > 0.3 ? '#ff3b3b' : '#9b1c1c'; U.roundRect(ctx, -10, -86, 20, 8, 3); ctx.fill();
      if (br > 0.3) { ctx.fillStyle = `rgba(255,60,60,${0.4 * br})`; ctx.beginPath(); ctx.arc(0, -82, 22, 0, 7); ctx.fill(); }
      // BAÚ da marca
      const bg = ctx.createLinearGradient(-28, 0, 28, 0);
      bg.addColorStop(0, '#0b0c0f'); bg.addColorStop(0.5, '#23262d'); bg.addColorStop(1, '#0b0c0f');
      ctx.fillStyle = '#3a3d44'; U.roundRect(ctx, -27, -168, 54, 10, 4); ctx.fill();
      ctx.fillStyle = bg; U.roundRect(ctx, -28, -160, 56, 62, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(130,232,204,0.6)'; ctx.lineWidth = 1.4; U.roundRect(ctx, -25, -157, 50, 56, 5); ctx.stroke();
      logo(ctx, 0, -138, 1.25);
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-24, -104, 6, 3); ctx.fillRect(18, -104, 6, 3);
      // SETA piscando (atrás, nas laterais da lanterna, e na frente, no guidão)
      if (this.blink && Math.floor(t * 2.6) % 2 === 0) {
        const sd = this.blink;
        ctx.fillStyle = '#4a4d55'; U.roundRect(ctx, -sd * 34 - 6, -93, 12, 7, 3); ctx.fill();
        ctx.fillStyle = '#ffb000'; ctx.shadowColor = '#ffb000'; ctx.shadowBlur = 24;
        U.roundRect(ctx, sd * 34 - 7, -94, 14, 9, 3); ctx.fill();
        ctx.beginPath(); ctx.arc(sd * 50, -176, 6, 0, 7); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,176,0,0.25)'; ctx.beginPath(); ctx.arc(sd * 34, -90, 26, 0, 7); ctx.fill();
      } else if (this.blink !== undefined) {
        ctx.fillStyle = '#4a4d55'; [-1, 1].forEach((sd) => { U.roundRect(ctx, sd * 34 - 6, -93, 12, 7, 3); ctx.fill(); });   // apagadas
      }
      const m = ctx.getTransform();
      const hp = m.transformPoint(new DOMPoint(0, -240)), bp = m.transformPoint(new DOMPoint(0, -168));
      this.headScreen = { x: hp.x, y: hp.y }; this.boxScreen = { x: bp.x, y: bp.y };
      ctx.restore();
      this.screenK = k; this.groundScreen = { x: g.x, y: g.y };
    }

    // motoboy a pé (de costas / 3/4), levando a caixa até o cliente
    static courier(ctx, x, y, s, t, st) {
      const k = s / 100, wk = st.walking ? Math.sin(t * 10) : 0, f = st.face || 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 7, 0, 0, 7); ctx.fill();
      // pernas (calça jeans) e botas
      ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, -92); ctx.lineTo(-8 + wk * 8, -8); ctx.moveTo(8, -92); ctx.lineTo(8 - wk * 8, -8); ctx.stroke();
      ctx.fillStyle = '#111'; U.roundRect(ctx, -16 + wk * 8, -12, 16, 11, 4); ctx.fill(); U.roundRect(ctx, 0 - wk * 8, -12, 16, 11, 4); ctx.fill();
      // jaqueta preta com faixa refletiva
      const g = ctx.createLinearGradient(-22, 0, 22, 0); g.addColorStop(0, '#0e0f13'); g.addColorStop(0.5, '#2b2e36'); g.addColorStop(1, '#0e0f13');
      ctx.fillStyle = g; U.roundRect(ctx, -22, -160, 44, 74, 14); ctx.fill();
      ctx.fillStyle = 'rgba(220,230,240,0.75)'; ctx.fillRect(-21, -128, 42, 4);
      logo(ctx, 0, -146, 0.9);
      // braços: segurando a caixa na frente (aparece pelos lados) ou balançando
      ctx.strokeStyle = '#1b1d22'; ctx.lineWidth = 10;
      if (st.box) {
        ctx.beginPath(); ctx.moveTo(-20, -150); ctx.lineTo(-30 * f, -118); ctx.moveTo(20, -150); ctx.lineTo(30, -118); ctx.stroke();
        ctx.save(); ctx.translate(24 * f, -122);
        ctx.fillStyle = '#c69c6d'; ctx.fillRect(-24, -18, 48, 36); ctx.fillStyle = '#a77d50'; ctx.fillRect(-24, -18, 48, 5); ctx.fillStyle = '#82e8cc'; ctx.fillRect(-4, -18, 8, 36);
        ctx.restore();
        ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(-30 * f, -116, 6, 0, 7); ctx.arc(30, -116, 6, 0, 7); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(-20, -150); ctx.lineTo(-26 - wk * 6, -100); ctx.moveTo(20, -150); ctx.lineTo(26 + wk * 6, -100); ctx.stroke();
      }
      // capacete
      const hg = ctx.createRadialGradient(-5, -186, 2, 0, -180, 18); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.7, '#e8ebef'); hg.addColorStop(1, '#b9c0c8');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, -180, 16, 17, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#82e8cc'; ctx.fillRect(-3, -197, 6, 34);
      ctx.restore();
      const m = ctx.getTransform(); void m;
      return { x, y: y - s * 2.1 };
    }

    // cliente de frente, andando do portão até a moto
    static customer(ctx, x, y, s, look, t, st) {
      const k = s / 100, walk = st.walking ? Math.sin(t * 10) : 0;
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 7, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2d3748'; ctx.lineWidth = 11; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, -88); ctx.lineTo(-8 + walk * 8, -4); ctx.moveTo(8, -88); ctx.lineTo(8 - walk * 8, -4); ctx.stroke();
      ctx.fillStyle = '#f5f5f5'; [-1, 1].forEach((sd) => { U.roundRect(ctx, sd * 8 - 7 + sd * walk * 8 * (sd < 0 ? 1 : -1), -8, 14, 8, 3); ctx.fill(); });
      ctx.fillStyle = look.shirt; U.roundRect(ctx, -20, -150, 40, 66, 14); ctx.fill();
      // braços: segurando a caixa / acenando
      ctx.strokeStyle = look.skin; ctx.lineWidth = 8;
      if (st.box) {
        ctx.beginPath(); ctx.moveTo(-18, -140); ctx.lineTo(-14, -112); ctx.moveTo(18, -140); ctx.lineTo(14, -112); ctx.stroke();
        ctx.fillStyle = '#c69c6d'; ctx.fillRect(-20, -132, 40, 30); ctx.fillStyle = '#e3c89c'; ctx.fillRect(-20, -132, 40, 5);
        ctx.fillStyle = '#82e8cc'; ctx.fillRect(-4, -132, 8, 30);
      } else {
        const wave = st.wave ? Math.sin(t * 14) * 12 : 0;
        ctx.beginPath(); ctx.moveTo(-18, -140); ctx.lineTo(-24, -100); ctx.moveTo(18, -140); ctx.lineTo(st.wave ? 34 + wave : 24, st.wave ? -185 : -100); ctx.stroke();
      }
      // cabeça
      ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(0, -168, 15, 0, 7); ctx.fill();
      ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(0, -173, 15.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      if (look.fem) { ctx.beginPath(); ctx.ellipse(-12, -160, 6, 16, 0.1, 0, 7); ctx.ellipse(12, -160, 6, 16, -0.1, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.arc(-5, -169, 1.8, 0, 7); ctx.arc(5, -169, 1.8, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a2d2d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -163, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.restore();
    }

    // borracheiro: macacão azul, boné, pneu no ombro / ajoelhado trocando o pneu / joinha
    static repairman(ctx, x, y, s, t, st) {
      const k = s / 100, face = st.face || -1;
      ctx.save(); ctx.translate(x, y); ctx.scale(k * face, k);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 30, 8, 0, 0, 7); ctx.fill();
      const suit = '#1f4fa3', suitD = '#163a7a', skin = '#b9805a', walk = st.pose === 'walk' ? Math.sin(t * 11) : 0;
      const kneel = st.pose === 'work' ? 1 : 0, by = kneel * 42;   // abaixa o corpo
      // pernas
      ctx.strokeStyle = suitD; ctx.lineWidth = 13; ctx.lineCap = 'round';
      if (kneel) {
        ctx.beginPath(); ctx.moveTo(-6, -50); ctx.lineTo(-22, -26); ctx.lineTo(-30, -4); ctx.moveTo(8, -50); ctx.lineTo(24, -12); ctx.lineTo(4, -4); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(-8, -88); ctx.lineTo(-8 + walk * 10, -6); ctx.moveTo(8, -88); ctx.lineTo(8 - walk * 10, -6); ctx.stroke();
      }
      ctx.fillStyle = '#2a1d14';
      if (kneel) { U.roundRect(ctx, -38, -10, 18, 10, 4); ctx.fill(); U.roundRect(ctx, -4, -10, 18, 10, 4); ctx.fill(); }
      else [-1, 1].forEach((sd) => { U.roundRect(ctx, sd * 8 - 9 + (sd < 0 ? walk : -walk) * 10, -10, 18, 10, 4); ctx.fill(); });
      ctx.save(); ctx.translate(0, by);
      // tronco (macacão) com bolso e nome
      ctx.fillStyle = suit; U.roundRect(ctx, -22, -152, 44, 70, 14); ctx.fill();
      ctx.fillStyle = suitD; ctx.fillRect(-22, -100, 44, 6);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-14, -140, 4, 30); ctx.fillRect(10, -140, 4, 30);
      ctx.fillStyle = '#fff'; ctx.font = `900 9px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.save(); ctx.scale(face, 1); ctx.fillText('BORRACHARIA', 0, -124); ctx.restore();
      // braços
      ctx.strokeStyle = suit; ctx.lineWidth = 10;
      if (st.pose === 'walk') {
        // pneu no ombro + caixa de ferramentas na outra mão
        ctx.beginPath(); ctx.moveTo(-18, -144); ctx.lineTo(-30, -178); ctx.moveTo(18, -144); ctx.lineTo(24, -100); ctx.stroke();
        ctx.fillStyle = '#c1121f'; U.roundRect(ctx, 14, -100, 26, 18, 3); ctx.fill(); ctx.fillStyle = '#7a0b13'; ctx.fillRect(20, -106, 14, 6);
        ctx.fillStyle = '#121214'; ctx.beginPath(); ctx.arc(-26, -176, 30, 0, 7); ctx.fill();
        ctx.fillStyle = '#5b5e66'; ctx.beginPath(); ctx.arc(-26, -176, 13, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-26, -176, 24, 0, 7); ctx.stroke();
      } else if (st.pose === 'work') {
        const r = Math.sin(t * 16) * 10;   // girando a chave
        ctx.beginPath(); ctx.moveTo(-18, -144); ctx.lineTo(-40, -118 + r * 0.4); ctx.moveTo(18, -144); ctx.lineTo(-30, -126 - r * 0.4); ctx.stroke();
        ctx.strokeStyle = '#c9ccd2'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-36, -122); ctx.lineTo(-56, -112 + r); ctx.stroke();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-38, -120, 6, 0, 7); ctx.fill();
      } else {
        // joinha
        ctx.beginPath(); ctx.moveTo(-18, -144); ctx.lineTo(-22, -100); ctx.moveTo(18, -144); ctx.lineTo(34, -178); ctx.stroke();
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(35, -182, 7, 0, 7); ctx.fill(); ctx.fillRect(32, -198, 5, 12);
        ctx.fillStyle = '#c1121f'; U.roundRect(ctx, -34, -100, 26, 18, 3); ctx.fill();
      }
      // cabeça + boné virado
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -170, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.arc(-4, -170, 1.8, 0, 7); ctx.arc(5, -170, 1.8, 0, 7); ctx.fill();
      ctx.strokeStyle = '#3b2416'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -161); ctx.quadraticCurveTo(0, -158, 7, -161); ctx.stroke();   // bigode
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, -176, 15.5, Math.PI, 0); ctx.fill();
      ctx.fillRect(-18, -178, 14, 4);
      ctx.fillStyle = '#c1121f'; ctx.fillRect(-15.5, -180, 31, 3);
      ctx.restore();
      const m = ctx.getTransform(), hp = m.transformPoint(new DOMPoint(0, -200 + by));
      ctx.restore();
      return { x: hp.x, y: hp.y };
    }

    // caramelo correndo atrás da moto (visto de trás)
    static dogChaser(ctx, x, y, s, t, bark) {
      const k = s / 100, run = Math.sin(t * 22);
      ctx.save(); ctx.translate(x, y - Math.abs(run) * 5 * k); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, Math.abs(run) * 5, 24, 7, 0, 0, 7); ctx.fill();
      const fur = '#c88a46', dark = '#94602c', light = '#e2ab6a';
      // patas traseiras correndo
      ctx.strokeStyle = fur; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-10, -26); ctx.lineTo(-12, -4 + run * 6); ctx.moveTo(10, -26); ctx.lineTo(12, -4 - run * 6); ctx.stroke();
      // corpo (de trás: traseiro + costas em perspectiva)
      ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, -38, 20, 18, 0, 0, 7); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(0, -48, 14, 9, 0, 0, 7); ctx.fill();
      // cabeça lá na frente, orelhas balançando
      ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(0, -60, 12, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(-11, -66 + run * 3, 5, 9, -0.6 + run * 0.3, 0, 7); ctx.ellipse(11, -66 - run * 3, 5, 9, 0.6 - run * 0.3, 0, 7); ctx.fill();
      // rabo abanando
      ctx.strokeStyle = fur; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, -48); ctx.quadraticCurveTo(Math.sin(t * 25) * 14, -66, Math.sin(t * 25) * 10, -78); ctx.stroke();
      ctx.restore();
    }
  }

  Rider.S = S; Rider.logo = logo;
  CNB.Rider = Rider;
})();
