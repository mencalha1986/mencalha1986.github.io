/* =========================================================================
   CLIENTE + CARRINHO — máquina de estados e desenho
   O carrinho é desenhado com a projeção 3D real (cantos projetados), e os
   achados pegos aparecem DENTRO dele com a foto de verdade.
   ========================================================================= */
(function () {
  const U = CNB.U;
  const S = { WALK: 'walk', RUN: 'run', BACK: 'back', SLIP: 'slip', CRASH: 'crash', ARRIVE: 'arrive', PAY: 'pay', DECLINED: 'declined', IDLE: 'idle' };
  const P3 = (b, l, d) => ({ b, l, d });
  const C = {
    skin: P3('#c08a66', '#dca784', '#8a5a40'), shirt: P3('#1a1c21', '#3b3f48', '#08090b'),   // camiseta preta da marca
    jeans: P3('#3b5b8c', '#5a7fb5', '#22385c'), shoe: P3('#eceae4', '#ffffff', '#b8b4aa'),
    cap: P3('#1f2937', '#374151', '#0b1220'), hair: P3('#3a2a1e', '#5a4330', '#1e140d')
  };

  function capsule(ctx, a, b, ra, rb, pal, side = 1) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 0.001;
    const ang = Math.atan2(dy, dx), nx = -dy / len, ny = dx / len;
    ctx.beginPath();
    ctx.arc(a.x, a.y, ra, ang + Math.PI / 2, ang - Math.PI / 2 + Math.PI * 2);
    ctx.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.closePath();
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = Math.max(ra, rb);
    const g = ctx.createLinearGradient(mx - nx * r * side, my - ny * r * side, mx + nx * r * side, my + ny * r * side);
    g.addColorStop(0, pal.d); g.addColorStop(0.45, pal.b); g.addColorStop(0.75, pal.l); g.addColorStop(1, pal.b);
    ctx.fillStyle = g; ctx.fill();
  }

  class Shopper {
    constructor(cfg) { this.cfg = cfg; this.reset(); }

    reset() {
      this.z = 0; this.x = 0; this.baseX = 0; this.targetX = 0; this.steer = 0;
      this.speed = 0; this.impulse = 0; this.turbo = 0; this.retreat = 0; this.slide = 0; this.magnet = 0;
      this.state = S.WALK; this.st = 0; this.t = 0; this.phase = 0;
      this.cart = [];          // achados no carrinho
      this.spin = 0; this.yaw = 0; this.cartX = 0; this.cartYaw = 0; this.lastAddAge = 9;
      this.pose = { lean: 0, bob: 0, lL: 0, rL: 0, reach: 1, arms: 0, jump: 0, fall: 0 };
      this.headScreen = { x: 540, y: 1000 }; this.cartScreen = { x: 540, y: 1300 };
      this.onStep = null; this.onEvent = null;
      this.manual = this.manual || false; this.avoiding = false;
    }

    get busy() { return [S.SLIP, S.CRASH].includes(this.state); }
    get finished() { return [S.ARRIVE, S.PAY, S.DECLINED].includes(this.state); }
    get total() { return this.cart.reduce((a, it) => a + it.price, 0); }

    setState(s) { if (this.state === s) return; this.prev = this.state; this.state = s; this.st = 0; this.onEvent && this.onEvent('state', s); }
    force(s) { this.state = null; this.setState(s); }

    cancelAction() {
      if (this.finished) return;
      this.turbo = 0; this.impulse = 0; this.retreat = 0; this.slide = 0; this.magnet = 0;
      if ([S.RUN, S.BACK, S.CRASH, S.SLIP].includes(this.state)) this.force(S.WALK);
    }

    /** perde os últimos n achados (voam para fora) — devolve a lista perdida */
    drop(n) { return this.cart.splice(Math.max(0, this.cart.length - n), n); }

    update(dt, store) {
      this.t += dt; this.st += dt;
      const cfg = this.cfg;
      if (this.magnet > 0) this.magnet = Math.max(0, this.magnet - dt);
      let speed = 0;
      switch (this.state) {
        case S.WALK: case S.IDLE:
          if (this.retreat > 0) { this.setState(S.BACK); break; }
          if (this.turbo > 0) { this.setState(S.RUN); break; }
          if (this.impulse > 0) { speed = cfg.walkSpeed * (1 + Math.min(this.impulse / 40, 1) * 0.6); this.impulse = Math.max(0, this.impulse - speed * dt); }
          else speed = cfg.autoWalkSpeed;
          break;
        case S.RUN:
          if (this.retreat > 0) { this.setState(S.BACK); break; }
          speed = cfg.runSpeed; this.turbo -= dt;
          if (this.turbo <= 0) { this.turbo = 0; this.setState(S.WALK); this.onEvent && this.onEvent('runEnd'); }
          break;
        case S.BACK:
          speed = -cfg.backSpeed; this.retreat -= cfg.backSpeed * dt;
          if (this.retreat <= 0 || this.z <= 0) { this.retreat = 0; this.setState(S.WALK); }
          break;
        case S.SLIP:
          speed = Math.max(0, 2.5 - this.st * 2);
          this.spin = U.easeOutCubic(Math.min(1, this.st / 1.3)) * Math.PI * 2 * this.spinDir;
          if (this.st > 1.9) { this.spin = 0; this.setState(S.WALK); }
          break;
        case S.CRASH:
          if (this.st > 1.1) this.setState(S.WALK);
          break;
        case S.ARRIVE: {
          const goal = store.checkoutZ - 2.2;
          speed = this.z < goal ? 3 : 0;
          if (this.z >= goal) { this.z = goal; this.setState(S.PAY); }
          break;
        }
        case S.PAY: case S.DECLINED: break;
      }
      if (this.slide > 0) { const r = Math.min(this.slide, dt * 5); this.slide -= r; this.z -= r; }
      this.speed = U.damp(this.speed, speed, this.state === S.RUN ? 5 : 7, dt);
      this.z = Math.max(0, this.z + this.speed * dt);

      // direção
      const LIM = CNB.Store.AISLE - 0.55;
      if (this.finished) this.targetX = 0;
      else if (this.manual) { if (!this.busy) this.targetX += (this.steer || 0) * 3.6 * dt; }
      else if (!this.avoiding && !this.chasing) this.targetX = U.noise(this.t * 0.15 + 3) * 1.4;
      this.targetX = U.clamp(this.targetX, -LIM, LIM);
      if (!this.busy) this.baseX = U.damp(this.baseX, this.targetX, this.manual ? 4 : this.state === S.RUN ? 3 : 2.2, dt);
      this.x = this.baseX;
      this.yaw = U.damp(this.yaw, U.clamp((this.targetX - this.baseX) * 0.25, -0.35, 0.35), 6, dt);
      // o carrinho vem atrás, puxado: segue o cliente com atraso e vira na direção dele
      this.cartX = U.damp(this.cartX, this.x, this.state === S.RUN ? 4 : 3, dt);
      this.cartYaw = U.clamp(Math.atan2(this.x - this.cartX, 1.0), -0.6, 0.6);
      this.lastAddAge += dt;

      // passos
      const absV = Math.abs(this.speed);
      if (!this.busy && this.state !== S.PAY && this.state !== S.DECLINED && absV > 0.05) {
        const before = Math.floor(this.phase / Math.PI);
        this.phase += dt * (this.state === S.RUN ? 3.4 : 0.7 + Math.min(absV, 3) * 0.5) * Math.PI * 2 * Math.sign(this.speed);
        if (Math.floor(this.phase / Math.PI) !== before) this.onStep && this.onStep(this.state === S.RUN);
      }
      this._pose(dt);
    }

    _pose(dt) {
      const P = this.pose, sw = Math.sin(this.phase), t = this.t;
      const T = { lean: 0, bob: 0, lL: 0, rL: 0, reach: 1, arms: 0, jump: 0, fall: 0 };
      switch (this.state) {
        case S.WALK: case S.IDLE: case S.ARRIVE: case S.BACK: {
          const a = Math.abs(this.speed) < 0.4 ? 0.5 : 1;
          T.lL = Math.max(0, sw) * 0.8 * a; T.rL = Math.max(0, -sw) * 0.8 * a;
          T.bob = -Math.abs(sw) * 2.5 * a; T.lean = sw * 0.03 + this.yaw * 0.25;
          break;
        }
        case S.RUN:
          T.lL = Math.max(0, sw) * 1.4; T.rL = Math.max(0, -sw) * 1.4;
          T.bob = -Math.abs(sw) * 7 + 2; T.lean = sw * 0.05 + this.yaw * 0.3; T.reach = 1.2;
          break;
        case S.SLIP: {
          const u = this.st;
          T.lL = 1.2 + Math.sin(u * 20) * 0.4; T.rL = 0.3 + Math.cos(u * 18) * 0.3;
          T.lean = Math.sin(u * 9) * 0.35 * Math.max(0, 1 - u / 1.9); T.arms = 1; T.reach = 0.5;
          break;
        }
        case S.CRASH: {
          const u = this.st;
          T.lean = Math.sin(u * 14) * 0.15 * (1 - u / 1.1); T.reach = 0.7; T.bob = -6 * Math.exp(-u * 4);
          break;
        }
        case S.PAY: {
          const u = this.st;
          if (u > 2.2) { // comemoração
            const j = Math.max(0, Math.sin((u - 2.2) * 7));
            T.jump = j; T.arms = 1; T.reach = 0; T.lL = j * 0.4; T.rL = j * 0.4; T.lean = Math.sin(u * 4) * 0.06;
          }
          break;
        }
        case S.DECLINED:
          T.arms = 2; T.reach = 0; T.lean = Math.sin(t * 1.5) * 0.04; T.bob = 4;
          break;
      }
      for (const k in T) P[k] = U.damp(P[k], T[k], 12, dt);
    }

    // ------------------------------------------------------------------ desenho
    // O cliente anda para a frente EMPURRANDO o carrinho. A câmera fica alta e
    // um pouco de lado, e os achados empilham na frente da cesta (visíveis).
    cartCenter() { return { x: this.x, z: this.z + 0.95 }; }

    draw(ctx, store, cam, catalog, light = 0.6) {
      const P = this.pose, len = 0.9;
      const ang = this.spin + this.yaw * 0.5;
      const cs = Math.cos(ang), sn = Math.sin(ang);
      const cc = this.cartCenter();
      // lz: -len/2 = alça (perto do cliente) … +len/2 = bico (lá na frente)
      const W3 = (lx, y, lz) => store.proj(cam, cc.x + lx * cs + lz * sn, y, cc.z + lz * cs - lx * sn);
      const corners = {
        tn: [W3(-0.3, 1.0, -len / 2), W3(0.3, 1.0, -len / 2)], tf: [W3(-0.27, 0.95, len / 2), W3(0.27, 0.95, len / 2)],
        bn: [W3(-0.24, 0.42, -len / 2 + 0.06), W3(0.24, 0.42, -len / 2 + 0.06)], bf: [W3(-0.21, 0.42, len / 2 - 0.05), W3(0.21, 0.42, len / 2 - 0.05)]
      };
      const ok = Object.values(corners).every((p) => p[0] && p[1]);
      const feet = store.proj(cam, this.x, P.jump * 0.25, this.z), ground = store.proj(cam, this.x, 0, this.z);
      if (!feet) return;
      const k = feet.s / 100;
      // carrinho primeiro (está mais longe que o cliente)
      if (ok) this._cart(ctx, store, cam, corners, W3, catalog, light, len);
      // sombra do cliente
      ctx.save(); ctx.translate(ground.x, ground.y); ctx.scale(1, 0.22);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 45 * k);
      sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 45 * k, 0, 7); ctx.fill(); ctx.restore();
      // as duas mãos na alça
      const gl = W3(-0.24, 1.06, -len / 2 - 0.08), gr = W3(0.24, 1.06, -len / 2 - 0.08);
      const toLocal = (p) => ({ x: (p.x - feet.x) / k, y: (p.y - feet.y) / k });
      this._body(ctx, feet.x, feet.y, k, ok && gl && gr && P.reach > 0.3 ? [toLocal(gl), toLocal(gr)] : null, light);
      this.cartScreen = ok ? { x: (corners.tf[0].x + corners.tf[1].x) / 2, y: corners.tf[0].y } : { x: feet.x, y: feet.y - 80 * k };
    }

    _cart(ctx, store, cam, c, W3, catalog, light, len) {
      const poly = (pts, fill, stroke, lw) => {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
      };
      const s = c.tn[0].s, wire = '#d5d9e0', lw = Math.max(1, s * 0.011);
      const mesh = (a0, a1, b0, b1, n, alpha) => {
        ctx.strokeStyle = U.rgba('#d5d9e0', alpha); ctx.lineWidth = lw * 0.75;
        for (let i = 0; i <= n; i++) { const u = i / n; ctx.beginPath(); ctx.moveTo(U.lerp(a0.x, a1.x, u), U.lerp(a0.y, a1.y, u)); ctx.lineTo(U.lerp(b0.x, b1.x, u), U.lerp(b0.y, b1.y, u)); ctx.stroke(); }
      };
      const sh = [W3(-0.32, 0, -len / 2), W3(0.32, 0, -len / 2), W3(0.32, 0, len / 2), W3(-0.32, 0, len / 2)];
      if (sh.every(Boolean)) poly(sh, 'rgba(0,0,0,0.2)');
      // rodinhas + chassi
      const wheels = [W3(-0.22, 0.05, -len / 2 + 0.08), W3(0.22, 0.05, -len / 2 + 0.08), W3(-0.19, 0.05, len / 2 - 0.06), W3(0.19, 0.05, len / 2 - 0.06)];
      ctx.strokeStyle = '#8b919b'; ctx.lineWidth = lw * 1.6;
      [[wheels[0], c.bn[0]], [wheels[1], c.bn[1]], [wheels[2], c.bf[0]], [wheels[3], c.bf[1]]].forEach(([a, b]) => { if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } });
      ctx.fillStyle = '#15171c';
      wheels.forEach((w) => { if (w) { ctx.beginPath(); ctx.ellipse(w.x, w.y, w.s * 0.045, w.s * 0.055, 0, 0, 7); ctx.fill(); } });
      // bico (parede da frente), fundo da cesta
      poly([c.tf[0], c.tf[1], c.bf[1], c.bf[0]], 'rgba(120,128,140,0.35)', wire, lw);
      mesh(c.tf[0], c.tf[1], c.bf[0], c.bf[1], 9, 0.5);
      poly([c.bn[0], c.bn[1], c.bf[1], c.bf[0]], 'rgba(45,50,60,0.6)', wire, lw);
      // OS ACHADOS: empilham a partir da FRENTE da cesta e vão subindo (ficam à vista por cima do cliente)
      const items = this.cart.slice(-16), n = items.length;
      items.forEach((it, i) => {
        const layer = Math.floor(i / 4), slot = i % 4;
        const lx = [-0.12, 0.12, -0.12, 0.12][slot] + (layer % 2 ? 0.04 : -0.03);
        const lz = [0.3, 0.3, 0.06, 0.06][slot] - (layer % 2 ? 0.05 : 0);
        const p = W3(lx, 0.55 + layer * 0.17 + (slot < 2 ? 0.05 : 0), lz);
        if (!p) return;
        const size = p.s * 0.3, fresh = i === n - 1 ? U.clamp(this.lastAddAge * 4, 0, 1) : 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(((i * 37) % 11 - 5) * 0.06); ctx.scale(U.easeOutBack(fresh), U.easeOutBack(fresh));
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-size / 2 + 3, -size / 2 + 4, size, size);
        catalog.drawPhoto(ctx, it, -size / 2, -size / 2, size, size * 0.1);
        ctx.restore();
      });
      // laterais + parede da alça (grade translúcida) + borda
      mesh(c.tn[0], c.tf[0], c.bn[0], c.bf[0], 10, 0.5); mesh(c.tn[1], c.tf[1], c.bn[1], c.bf[1], 10, 0.5);
      poly([c.tn[0], c.tn[1], c.bn[1], c.bn[0]], 'rgba(205,210,220,0.08)', wire, lw);
      mesh(c.tn[0], c.tn[1], c.bn[0], c.bn[1], 9, 0.45);
      poly([c.tn[0], c.tn[1], c.tf[1], c.tf[0]], null, '#eef1f5', lw * 1.8);
      // alça vermelha (do lado do cliente)
      const h0 = W3(-0.33, 1.06, -len / 2 - 0.08), h1 = W3(0.33, 1.06, -len / 2 - 0.08);
      if (h0 && h1) {
        ctx.strokeStyle = wire; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.moveTo(h0.x, h0.y); ctx.lineTo(c.tn[0].x, c.tn[0].y); ctx.moveTo(h1.x, h1.y); ctx.lineTo(c.tn[1].x, c.tn[1].y); ctx.stroke();
        ctx.strokeStyle = '#d61f3c'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, s * 0.042);
        ctx.beginPath(); ctx.moveTo(h0.x, h0.y); ctx.lineTo(h1.x, h1.y); ctx.stroke();
      }
      if (this.magnet > 0) {
        const m = W3(0, 0.75, 0);
        if (m) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const R = m.s * (0.85 + Math.sin(this.t * 10) * 0.08);
          const g = ctx.createRadialGradient(m.x, m.y, R * 0.3, m.x, m.y, R);
          g.addColorStop(0, 'rgba(96,165,250,0)'); g.addColorStop(0.7, 'rgba(96,165,250,0.28)'); g.addColorStop(1, 'rgba(96,165,250,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, R, 0, 7); ctx.fill(); ctx.restore();
        }
      }
    }

    // logo da marca (lupa com "check" + "achados úteis" + pílula "por aí"), em cm do boneco
    _logo(ctx, x, y) {
      const MINT = '#82e8cc', CREAM = '#f3efe7', INK = '#0e3a4a', GOLD = '#ffd45e';
      ctx.save(); ctx.translate(x, y);
      // cabo da lupa
      ctx.strokeStyle = CREAM; ctx.lineCap = 'round'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(4.2, 4.2); ctx.lineTo(8.6, 8.6); ctx.stroke();
      // aro + lente verde-água
      ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
      ctx.fillStyle = MINT; ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, 7); ctx.fill();
      // check
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-2.6, 0.2); ctx.lineTo(-0.6, 2.2); ctx.lineTo(2.9, -1.9); ctx.stroke();
      // brilhos
      ctx.fillStyle = GOLD; U.star(ctx, 9.2, -6.2, 2.2, 0.7, 4); ctx.fill();
      ctx.fillStyle = CREAM; U.star(ctx, -8.8, -3.6, 1.4, 0.45, 4); ctx.fill();
      // "achados úteis"
      ctx.fillStyle = CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `800 6.4px ${U.FONT_UI}`; ctx.fillText('achados úteis', 0, 17.5);
      // pílula "por aí"
      ctx.fillStyle = MINT; U.roundRect(ctx, -6.2, 19.2, 12.4, 4.8, 2.4); ctx.fill();
      ctx.fillStyle = INK; ctx.font = `800 3.5px ${U.FONT_UI}`; ctx.fillText('por aí', 0, 22.9);
      ctx.restore();
    }

    _body(ctx, fx, fy, k, hands, light) {
      const P = this.pose, t = this.t;
      ctx.save(); ctx.translate(fx, fy); ctx.scale(k, k);
      const hipY = -90 + P.bob, shY = hipY - 52, lean = P.lean;
      const leg = (side, lift) => {
        const hip = { x: side * 10, y: hipY }, foot = { x: side * 12, y: -lift * 22 };
        const knee = { x: (hip.x + foot.x) / 2 + side * (2 + lift * 4), y: (hip.y + foot.y) / 2 - lift * 5 };
        capsule(ctx, hip, knee, 9.4, 7.8, C.jeans, side);
        capsule(ctx, knee, { x: foot.x, y: foot.y - 8 }, 7.8, 6, C.jeans, side);
        // tênis branco
        const g = ctx.createLinearGradient(foot.x - 9, 0, foot.x + 9, 0);
        g.addColorStop(0, C.shoe.d); g.addColorStop(0.6, C.shoe.b); g.addColorStop(1, C.shoe.l);
        ctx.fillStyle = g; U.roundRect(ctx, foot.x - 9, foot.y - 11, 18, 12, 6); ctx.fill();
        if (lift > 0.15) { ctx.fillStyle = '#9aa0a8'; U.roundRect(ctx, foot.x - 8.5, foot.y - 4 - lift * 10, 17, 5 + lift * 10, 5); ctx.fill(); }
        ctx.fillStyle = '#82e8cc'; ctx.fillRect(foot.x - 9, foot.y - 6, 18, 1.6);
      };
      ctx.save(); ctx.rotate(lean);
      leg(-1, P.lL); leg(1, P.rL);
      // quadril (jeans) + cinto
      const jg = ctx.createLinearGradient(-21, 0, 21, 0);
      jg.addColorStop(0, C.jeans.d); jg.addColorStop(0.55, C.jeans.b); jg.addColorStop(1, C.jeans.d);
      ctx.fillStyle = jg; U.roundRect(ctx, -20, hipY - 9, 40, 24, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
      U.roundRect(ctx, -15, hipY, 10, 9, 2); ctx.stroke(); U.roundRect(ctx, 5, hipY, 10, 9, 2); ctx.stroke();
      // camiseta rosa da marca com "ACHADOS" nas costas
      ctx.beginPath();
      ctx.moveTo(-20, hipY + 2); ctx.quadraticCurveTo(0, hipY + 6, 20, hipY + 2);
      ctx.quadraticCurveTo(23, (hipY + shY) / 2, 21, shY + 6); ctx.quadraticCurveTo(18, shY - 3, 7, shY - 3);
      ctx.lineTo(-7, shY - 3); ctx.quadraticCurveTo(-18, shY - 3, -21, shY + 6); ctx.quadraticCurveTo(-23, (hipY + shY) / 2, -20, hipY + 2); ctx.closePath();
      const sg = ctx.createLinearGradient(-22, 0, 22, 0);
      sg.addColorStop(0, C.shirt.d); sg.addColorStop(0.4, C.shirt.b); sg.addColorStop(0.7, C.shirt.l); sg.addColorStop(1, C.shirt.d);
      ctx.fillStyle = sg; ctx.fill();
      ctx.save(); ctx.clip();
      const vg = ctx.createLinearGradient(0, shY, 0, hipY);
      vg.addColorStop(0, 'rgba(255,255,255,0.15)'); vg.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = vg; ctx.fillRect(-25, shY - 4, 50, hipY - shY + 10);
      // estampa da logo "achados úteis por aí" nas costas
      this._logo(ctx, 0, shY + 15);
      ctx.restore();
      // pescoço + cabeça (de costas) com boné virado
      capsule(ctx, { x: 0, y: shY - 2 }, { x: 0, y: shY - 12 }, 6.2, 6, C.skin);
      const hy = shY - 26;
      const hg = ctx.createRadialGradient(-3, hy - 4, 2, 0, hy, 15);
      hg.addColorStop(0, C.hair.l); hg.addColorStop(1, C.hair.d);
      ctx.fillStyle = C.skin.b; ctx.beginPath(); ctx.ellipse(-12, hy + 2, 3.4, 5.5, 0, 0, 7); ctx.ellipse(12, hy + 2, 3.4, 5.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(0, hy, 12.4, 14.2, 0, 0, 7); ctx.fill();
      // boné para trás (aba para a câmera)
      ctx.fillStyle = C.cap.b; ctx.beginPath(); ctx.ellipse(0, hy - 6, 13, 9, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = C.cap.d; ctx.beginPath(); ctx.ellipse(0, hy - 1.5, 10, 3.5, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#82e8cc'; ctx.fillRect(-3, hy - 6, 6, 4);
      ctx.restore();

      // braços: até a alça do carrinho, para cima (comemorando) ou na cabeça (cartão recusado)
      const rot = (p) => ({ x: p.x * Math.cos(lean) - p.y * Math.sin(lean), y: p.x * Math.sin(lean) + p.y * Math.cos(lean) });
      [-1, 1].forEach((side, i) => {
        const sh = rot({ x: side * 20, y: shY + 5 });
        let hd;
        if (hands && P.reach > 0.3) hd = hands[i];
        else if (P.arms > 1.5) hd = rot({ x: side * 8, y: shY - 34 });     // mãos na cabeça
        else if (P.arms > 0.5) hd = rot({ x: side * (30 + Math.sin(t * 9 + i) * 4), y: shY - 48 }); // braços pra cima
        else hd = rot({ x: side * 24, y: shY + 50 });
        const len = Math.hypot(hd.x - sh.x, hd.y - sh.y), maxL = 58;
        if (len > maxL) hd = { x: sh.x + ((hd.x - sh.x) / len) * maxL, y: sh.y + ((hd.y - sh.y) / len) * maxL };
        const mid = { x: (sh.x + hd.x) / 2 + side * 6, y: (sh.y + hd.y) / 2 + 4 };
        capsule(ctx, sh, mid, 6.4, 5.2, C.skin, side);
        capsule(ctx, mid, hd, 5.2, 4.2, C.skin, side);
        capsule(ctx, sh, { x: U.lerp(sh.x, mid.x, 0.5), y: U.lerp(sh.y, mid.y, 0.5) }, 8.6, 7.6, C.shirt, side);
        ctx.fillStyle = C.skin.b; ctx.beginPath(); ctx.arc(hd.x, hd.y, 5.4, 0, 7); ctx.fill();
      });
      const m = ctx.getTransform();
      const hp = m.transformPoint(new DOMPoint(0, shY - 46));
      this.headScreen = { x: hp.x, y: hp.y };
      ctx.restore();
      // leve luz da loja sobre o corpo
    }
  }

  Shopper.S = S;
  CNB.Shopper = Shopper;
})();
