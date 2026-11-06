/* =========================================================================
   MUNDO — projeção em perspectiva real (pseudo-3D estilo "road renderer")
   Cada ponto do mundo (x lateral, y altura, z distância em metros) é
   projetado pela câmera: escala = focal / (z - camZ). Rua, calçadas, muros,
   postes, obstáculos e o BAR usam a mesma projeção — por isso o bar cresce
   com perspectiva verdadeira conforme a câmera se aproxima.
   ========================================================================= */
(function () {
  const U = CNB.U;
  const W = 1080, H = 1920;

  const ROAD = 3.4, SIDE = 2.6, WALLX = ROAD + SIDE, WALLH = 1.9, CURB = 0.14;
  const FOG = '#0a0912';
  const WALL_COLORS = ['#8c6f5a', '#6f7d6a', '#7a6a86', '#9a8a5e', '#6b7f8c', '#8a5f55', '#7f7466', '#5f7a73'];
  const POSTER_COLORS = ['#d94f3d', '#f2c14e', '#3d8bd9', '#f2f2f2', '#e86fa8', '#5fbf7a'];
  // fachadas realistas de bairro: reboco em tons gastos
  const FACADE = ['#b7a58c', '#a9b3a1', '#c2b49a', '#9fa8ad', '#b59a86', '#8f9a8a', '#c9bfae', '#a58f7c', '#b9aa95', '#97a3a8'];
  const SHOPS = [['MERCADINHO', '#c0392b'], ['FARMÁCIA', '#1f7a4d'], ['AÇOUGUE', '#8e1b1b'], ['SALÃO DA NEIDE', '#7b3fa0'], ['LANCHES', '#d35400'],
                 ['PADARIA', '#9a6a1f'], ['OFICINA', '#2c3e50'], ['BAZAR', '#1f5fa8'], ['DEPÓSITO', '#5d4a2f'], ['ADEGA 24H', '#6d1f3a']];
  const CHUNK = 10;
  function building(chunk) {
    const h = U.hash(chunk * 1.91 + 0.3);
    const type = h < 0.34 ? 'house' : h < 0.54 ? 'sobrado' : h < 0.76 ? 'shop' : 'wall';
    const H = { house: 3.4, sobrado: 6.2, shop: 3.9, wall: WALLH }[type] + (U.hash(chunk + 2) - 0.5) * 0.4;
    return { type, H, col: FACADE[Math.floor(U.hash(chunk + 0.5) * FACADE.length)], seed: U.hash(chunk * 3.3 + 1), shop: SHOPS[Math.floor(U.hash(chunk * 5.7) * SHOPS.length)] };
  }

  const OB_TYPES = {
    hole:   { w: 1.3, weight: 3, label: 'buraco' },
    cone:   { w: 0.55, weight: 3, label: 'cone' },
    bottle: { w: 0.6, weight: 2, label: 'garrafa' },
    box:    { w: 0.8, weight: 2, label: 'caixa' },
    trash:  { w: 0.75, weight: 2, label: 'lixeira' },
    step:   { w: 3.2, weight: 1.5, label: 'desnível' },
    chair:  { w: 0.7, weight: 2, label: 'cadeira' },
    manhole:{ w: 0.9, weight: 2, label: 'bueiro aberto' },
    cart:   { w: 0.95, weight: 2, label: 'carrinho' }
  };

  class World {
    constructor(cfg) {
      this.cfg = cfg;
      this.track = cfg.trackLength;
      this.barZ = this.track + 14;          // fachada
      this.barSidewalkZ = this.track + 9;   // calçada do bar
      this.barGlow = 1;
      this.cheer = 0;
      this.stars = [];
      const r = U.mulberry32(7);
      for (let i = 0; i < 140; i++) this.stars.push({ x: r() * W, y: r() * 620, r: r() * 1.8 + 0.4, p: r() * 6 });
      this.reset(1);
    }

    reset(seed) {
      const r = U.mulberry32(seed * 9973 + 17);
      const cfg = this.cfg;
      this.track = cfg.trackLength;
      this.barZ = this.track + 14;
      this.barSidewalkZ = this.track + 9;
      // obstáculos
      this.obstacles = [];
      const types = Object.keys(OB_TYPES);
      const total = types.reduce((a, k) => a + OB_TYPES[k].weight, 0);
      let z = 24;
      let last = '';
      while (z < this.track - 16) {
        let pick, tries = 0;
        do {
          let v = r() * total;
          pick = types.find((k) => (v -= OB_TYPES[k].weight) < 0) || 'cone';
        } while (pick === last && tries++ < 4);
        last = pick;
        const def = OB_TYPES[pick];
        const x = pick === 'step' ? (r() - 0.5) * 1.2 : (r() * 2 - 1) * (ROAD - 0.9);
        this.obstacles.push({ type: pick, z, x, w: def.w, hit: false, knock: 0, knockDir: r() < 0.5 ? -1 : 1, roll: 0, decided: false, willHit: false, seed: r() });
        z += U.lerp(cfg.obstacleSpacing[0], cfg.obstacleSpacing[1], r());
      }
      // cenário lateral
      this.lamps = [];
      for (let lz = 8, side = 1; lz < this.track + 2; lz += 22, side *= -1) this.lamps.push({ z: lz, side, flick: r() < 0.18 });
      this.trees = [];
      for (let tz = 14; tz < this.track - 6; tz += 18 + r() * 26) this.trees.push({ z: tz, side: r() < 0.5 ? -1 : 1, s: 0.8 + r() * 0.5, seed: r() });
      this.bags = [];
      for (let bz = 20; bz < this.track - 6; bz += 25 + r() * 40) this.bags.push({ z: bz, side: r() < 0.5 ? -1 : 1, seed: r() });
      const T = this.track;
      this.tables = [
        { x: -3.4, z: T + 11.6, pat: 0, seat: true }, { x: -5.6, z: T + 10.6, pat: -1 },
        { x: 3.5, z: T + 11.4, pat: 1 }, { x: 5.4, z: T + 12.4, pat: -1 }
      ];
      this.seatTable = this.tables[0];
      this.seat = { x: this.seatTable.x + 0.32, z: this.seatTable.z + 0.07 };
      this.toast = 0;
      this.dogs = [{ z: 60 + r() * 120, side: r() < 0.5 ? -1 : 1, x: 0 }, { z: this.track + 10.2, side: 1, x: 6.2, bar: true }];
    }

    // ------------------------------------------------------------------ projeção
    proj(cam, x, y, z) {
      const dz = z - cam.z;
      if (dz < 0.05) return null;
      const s = cam.F / dz;
      return { x: W / 2 + (x - cam.x) * s + cam.sx, y: cam.horizon + (cam.y - y) * s + cam.sy, s, dz };
    }
    fogT(dz) { return Math.pow(U.clamp((dz - 12) / 200, 0, 1), 0.75) * 0.88; }
    lampLight(z) {
      let l = 0;
      for (const lp of this.lamps) { const d = Math.abs(z - lp.z); if (d < 10) l += 1 - d / 10; }
      // luz do bar no fim da rua
      const db = this.track + 6 - z;
      if (db < 40) l += U.clamp(1 - db / 40, 0, 1) * 0.8 * this.barGlow;
      return U.clamp(l, 0, 1.2);
    }

    _quad(ctx, a, b, c, d, color) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    }
    _col(base, z, dz, litAmt = 1) {
      const lit = this.lampLight(z) * litAmt;
      let c = U.mix(base, '#a0805a', lit * 0.38);
      // converte rgb de volta para mistura com névoa
      return this._fog(c, dz);
    }
    _fog(rgbStr, dz) {
      const f = this.fogT(dz);
      if (f <= 0.01) return rgbStr;
      // rgbStr pode ser "rgb(...)" -> converter
      const m = rgbStr.match(/\d+/g);
      const hex = '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('');
      return U.mix(hex, FOG, f);
    }

    // ------------------------------------------------------------------ céu
    drawSky(ctx, cam, t) {
      const hz = cam.horizon + cam.sy;
      const g = ctx.createLinearGradient(0, -200, 0, hz + 40);
      g.addColorStop(0, '#03040b');
      g.addColorStop(0.55, '#0d0c22');
      g.addColorStop(0.85, '#2a1834');
      g.addColorStop(1, '#4a2838');
      ctx.fillStyle = g;
      ctx.fillRect(-200, -400, W + 400, hz + 440);
      // estrelas
      for (const s of this.stars) {
        if (s.y > hz - 40) continue;
        const a = 0.35 + 0.35 * Math.sin(t * 1.5 + s.p);
        ctx.fillStyle = `rgba(255,248,230,${a})`;
        ctx.fillRect(s.x, s.y + cam.sy * 0.3, s.r, s.r);
      }
      // lua
      const mx = 600 - cam.x * 4, my = cam.horizon - 200;
      const mg = ctx.createRadialGradient(mx, my, 20, mx, my, 170);
      mg.addColorStop(0, 'rgba(255,240,210,0.22)'); mg.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = mg; ctx.fillRect(mx - 180, my - 180, 360, 360);
      ctx.fillStyle = '#efe6cf'; ctx.beginPath(); ctx.arc(mx, my, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(160,150,130,0.35)';
      [[-12, -8, 9], [10, 6, 7], [-4, 16, 5], [16, -14, 4]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, 7); ctx.fill(); });

      // brilho quente do bar no céu
      const bp = this.proj(cam, 0, 3, this.barZ);
      if (bp) {
        const R = Math.max(260, bp.s * 22) * (0.8 + this.barGlow * 0.4);
        const bg = ctx.createRadialGradient(bp.x, bp.y, 0, bp.x, bp.y, R);
        bg.addColorStop(0, `rgba(255,150,70,${0.28 * this.barGlow})`);
        bg.addColorStop(0.5, `rgba(255,90,60,${0.10 * this.barGlow})`);
        bg.addColorStop(1, 'rgba(255,90,60,0)');
        ctx.fillStyle = bg; ctx.fillRect(bp.x - R, bp.y - R, R * 2, R * 2);
      }
      // silhueta baixa de morro e mata (sem prédios)
      ctx.fillStyle = '#0b0a14';
      ctx.beginPath(); ctx.moveTo(-200, hz + 10);
      for (let x = -200; x <= W + 200; x += 30) {
        const wx = x + cam.x * 2;
        const h = 26 + 22 * U.noise(wx * 0.004 + 3) + 10 * U.noise(wx * 0.02);
        ctx.lineTo(x, hz - h);
      }
      ctx.lineTo(W + 200, hz + 10); ctx.closePath(); ctx.fill();
    }

    // ------------------------------------------------------------------ chão
    drawGround(ctx, cam, t) {
      const hz = cam.horizon + cam.sy;
      ctx.fillStyle = '#07070b';
      ctx.fillRect(-300, hz - 2, W + 600, H - hz + 400);

      this._drawCrossStreet(ctx, cam, t);

      const zNear = cam.z + 0.4;
      const zEnd = this.track + 2;
      if (zEnd <= zNear) return;
      // limites alinhados ao mundo (chão se move de verdade)
      const zs = [zNear];
      let z = zNear;
      while (z < zEnd) {
        const dz = z - cam.z;
        const step = dz < 50 ? 1.5 : dz < 130 ? 3 : 6;
        z = (Math.floor(z / step) + 1) * step;
        zs.push(Math.min(z, zEnd));
      }
      for (let i = zs.length - 1; i > 0; i--) this._segment(ctx, cam, zs[i - 1], zs[i], t);
      this._facades(ctx, cam, t);
    }

    _segment(ctx, cam, zn, zf, t) {
      const P = (x, y, z) => this.proj(cam, x, y, z);
      const zm = (zn + zf) / 2, dz = zm - cam.z;
      const idx = Math.floor(zm / 1.5);
      const alt = idx % 2 === 0;

      // asfalto
      const asph = this._col(alt ? '#2b2c31' : '#28292e', zm, dz);
      const a = P(-ROAD, 0, zn), b = P(ROAD, 0, zn), c = P(ROAD, 0, zf), d = P(-ROAD, 0, zf);
      if (!a || !d) return;
      this._quad(ctx, a, b, c, d, asph);

      // remendos, bueiros e rachaduras (determinísticos -> rolam com o mundo)
      const h = U.hash(idx * 3.17);
      if (dz > 5 && dz < 140 && h > 0.72) {
        const px = (U.hash(idx * 7.1) * 2 - 1) * (ROAD - 1);
        const pr = P(px, 0, zm);
        if (pr) {
          ctx.fillStyle = this._col(h > 0.9 ? '#202125' : '#323338', zm, dz);
          ctx.beginPath(); ctx.ellipse(pr.x, pr.y, pr.s * (0.5 + h * 0.6), pr.s * (0.5 + h * 0.6) * Math.min(0.6, cam.y / dz * 0.9), 0, 0, 7); ctx.fill();
          if (h > 0.94) { // tampa de bueiro
            ctx.strokeStyle = this._col('#4a4a4f', zm, dz); ctx.lineWidth = Math.max(1, pr.s * 0.04);
            ctx.beginPath(); ctx.ellipse(pr.x, pr.y, pr.s * 0.35, pr.s * 0.35 * Math.min(0.6, cam.y / dz), 0, 0, 7); ctx.stroke();
          }
        }
      }
      // faixa central amarela tracejada (gasta)
      if (Math.floor(zm / 3) % 2 === 0 && zm < this.track - 4) {
        const y1 = this._col('#a88a2c', zm, dz, 0.6);
        this._quad(ctx, P(-0.07, 0, zn), P(0.07, 0, zn), P(0.07, 0, zf), P(-0.07, 0, zf), y1);
      }
      // faixa de pedestre na chegada
      if (zf > this.track - 3.6 && zn < this.track - 0.4) {
        const z0 = Math.max(zn, this.track - 3.6), z1 = Math.min(zf, this.track - 0.4);
        const wc = this._col('#d9d6cc', zm, dz, 0.5);
        for (let x = -ROAD + 0.3; x < ROAD - 0.3; x += 0.85) this._quad(ctx, P(x, 0, z0), P(x + 0.45, 0, z0), P(x + 0.45, 0, z1), P(x, 0, z1), wc);
      }

      for (const side of [-1, 1]) {
        // guia (meio-fio)
        this._quad(ctx, P(side * ROAD, 0, zn), P(side * ROAD, CURB, zn), P(side * ROAD, CURB, zf), P(side * ROAD, 0, zf), this._col('#8d887f', zm, dz));
        // calçada
        const sw = this._col(alt ? '#5a5650' : '#55514b', zm, dz);
        this._quad(ctx, P(side * ROAD, CURB, zn), P(side * WALLX, CURB, zn), P(side * WALLX, CURB, zf), P(side * ROAD, CURB, zf), sw);
        if (dz < 70) { // junta da calçada
          const j1 = P(side * ROAD, CURB, zf), j2 = P(side * WALLX, CURB, zf);
          ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, j1.s * 0.02);
          ctx.beginPath(); ctx.moveTo(j1.x, j1.y); ctx.lineTo(j2.x, j2.y); ctx.stroke();
        }
        // fachada (casa, sobrado, comércio ou muro) — base; detalhes em _facades()
        const chunk = Math.floor(zm / CHUNK) + (side > 0 ? 500 : 0);
        const bd = building(chunk);
        const isGate = bd.type === 'wall' && bd.seed > 0.6;
        const wcol = isGate ? '#3b3d42' : bd.col;
        const wallH = bd.H;
        const w0 = P(side * WALLX, 0, zn), w1 = P(side * WALLX, wallH, zn), w2 = P(side * WALLX, wallH, zf), w3 = P(side * WALLX, 0, zf);
        this._quad(ctx, w0, w1, w2, w3, this._col(wcol, zm, dz, 0.8));
        // umidade/sujeira na base e escurecendo no alto (luz do poste vem de baixo)
        this._quad(ctx, w0, P(side * WALLX, 0.5, zn), P(side * WALLX, 0.5, zf), w3, 'rgba(20,16,10,0.28)');
        this._quad(ctx, P(side * WALLX, wallH * 0.62, zn), w1, w2, P(side * WALLX, wallH * 0.62, zf), 'rgba(4,4,12,0.28)');
        // beiral / platibanda
        const eave = bd.type === 'wall' ? 0.08 : 0.22;
        this._quad(ctx, P(side * WALLX, wallH - eave, zn), w1, w2, P(side * WALLX, wallH - eave, zf), this._col(U.mix(wcol, '#000000', 0.35).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, b) => '#' + [r, g, b].map((v) => (+v).toString(16).padStart(2, '0')).join('')), zm, dz, 0.5));
        this._quad(ctx, w1, P(side * (WALLX + 0.3), wallH, zn), P(side * (WALLX + 0.3), wallH, zf), w2, this._col('#3a3836', zm, dz, 0.4));
        if (dz < 90 && bd.type === 'wall') {
          if (isGate) { // portão de grade
            ctx.strokeStyle = this._col('#202226', zm, dz); ctx.lineWidth = Math.max(1, w1.s * 0.035);
            ctx.beginPath(); ctx.moveTo(w1.x, w1.y); ctx.lineTo(w0.x, w0.y); ctx.stroke();
          } else if (U.hash(chunk * 1.3 + idx) > 0.8) { // lambe-lambe
            const pc = POSTER_COLORS[Math.floor(U.hash(idx * 1.7) * POSTER_COLORS.length)];
            this._quad(ctx, P(side * WALLX, 0.7, zn), P(side * WALLX, 1.45, zn), P(side * WALLX, 1.45, zf), P(side * WALLX, 0.7, zf), this._col(pc, zm, dz, 0.7));
          }
        }
      }
      // marcas de pneu e sarjeta escura (asfalto mais real)
      if (dz < 120) {
        const tc = 'rgba(0,0,0,0.13)';
        for (const tx of [-2.3, -1.2, 1.2, 2.3]) this._quad(ctx, P(tx - 0.22, 0, zn), P(tx + 0.22, 0, zn), P(tx + 0.22, 0, zf), P(tx - 0.22, 0, zf), tc);
        for (const side of [-1, 1]) this._quad(ctx, P(side * (ROAD - 0.35), 0, zn), P(side * ROAD, 0, zn), P(side * ROAD, 0, zf), P(side * (ROAD - 0.35), 0, zf), 'rgba(0,0,0,0.22)');
      }
    }

    // ---------- detalhes das fachadas: janelas, portas, portas de aço, letreiros ----------
    _facades(ctx, cam, t) {
      const z0 = Math.max(0, Math.floor((cam.z + 0.6) / CHUNK)), z1 = Math.floor(Math.min(this.track + 2, cam.z + 150) / CHUNK);
      for (let ci = z1; ci >= z0; ci--) {
        for (const side of [-1, 1]) {
          const chunk = ci + (side > 0 ? 500 : 0), bd = building(chunk), cz = ci * CHUNK;
          if (bd.type === 'wall') continue;
          const dz = cz + 5 - cam.z; if (dz > 150) continue;
          const X = side * (WALLX - 0.02);
          const P = (y, z) => this.proj(cam, X, y, Math.min(z, this.track + 2));
          const q = (za, zb, ya, yb, col, lit = 0.6) => {
            if (zb <= cam.z + 2.5 || za > this.track + 2) return;   // perto demais já está fora da tela
            za = Math.max(za, cam.z + 2.5);
            const a = P(ya, za), b = P(yb, za), c = P(yb, zb), d = P(ya, zb);
            if (a && b && c && d) this._quad(ctx, a, b, c, d, col.startsWith('rgba') ? col : this._col(col, (za + zb) / 2, (za + zb) / 2 - cam.z, lit));
          };
          const fog = 1 - this.fogT(dz);
          const win = (za, zb, ya, yb, k) => {   // janela com moldura, vidro e grade
            q(za - 0.08, zb + 0.08, ya - 0.1, yb + 0.06, '#5d5650');
            const h = U.hash(chunk * 7.7 + k * 3.1), tv = h > 0.88, lit = h > 0.45;
            if (lit) {
              const flick = tv ? 0.55 + 0.45 * Math.sin(t * 9 + k) * Math.sin(t * 3.7 + k * 2) : 1;
              const col = tv ? `rgba(110,160,255,${0.85 * fog * flick})` : `rgba(255,${190 + Math.floor(h * 30)},120,${0.9 * fog})`;
              q(za, zb, ya, yb, '#2a2118');
              q(za, zb, ya, yb, col);
              if (!tv) q(za, za + (zb - za) * 0.3, ya, yb, `rgba(150,60,40,${0.55 * fog})`);   // cortina
            } else {
              q(za, zb, ya, yb, '#141a22');
              q(za, zb, yb - (yb - ya) * 0.35, yb, 'rgba(120,140,170,0.10)');                    // reflexo
            }
            // grade
            ctx.strokeStyle = `rgba(20,20,22,${0.8 * fog})`;
            const p0 = P(ya, (za + zb) / 2), p1 = P(yb, (za + zb) / 2);
            if (p0 && p1) { ctx.lineWidth = Math.max(1, p0.s * 0.025); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }
            q(za - 0.12, zb + 0.12, ya - 0.16, ya - 0.08, '#d8d2c6', 0.7);                      // peitoril
          };
          const door = (za, zb, col) => { q(za - 0.08, zb + 0.08, 0, 2.18, '#4a443e'); q(za, zb, 0, 2.1, col); q(za, zb, 1.5, 1.9, 'rgba(0,0,0,0.25)'); };
          const shutter = (za, zb, top, open) => {   // porta de aço (de enrolar)
            if (open) {
              q(za, zb, 0, top, '#2b1d10');
              q(za, zb, 0, top, `rgba(255,214,150,${0.75 * fog})`);
              for (let y = 0.5; y < top - 0.3; y += 0.55) q(za + 0.15, zb - 0.15, y, y + 0.08, '#6b4a2a', 0.3);  // prateleiras
            } else {
              q(za, zb, 0, top, '#7b8086', 0.7);
              const p = P(top / 2, (za + zb) / 2);
              if (p && p.s > 7) for (let y = 0.12; y < top; y += 0.16) q(za, zb, y, y + 0.03, 'rgba(0,0,0,0.22)');
            }
            q(za - 0.1, zb + 0.1, top, top + 0.22, '#55595e', 0.6);   // caixa da porta
          };
          const r = (k) => U.hash(chunk * 2.3 + k);
          if (bd.type === 'house') {
            door(cz + 1.2, cz + 2.1, r(1) > 0.5 ? '#5a3b26' : '#3c4a52');
            win(cz + 3.4, cz + 4.9, 1.0, 2.1, 1);
            win(cz + 6.4, cz + 7.9, 1.0, 2.1, 2);
            if (r(4) > 0.6) q(cz + 8.6, cz + 9.3, 2.35, 2.75, '#d9d9d6', 0.5);    // ar-condicionado
          } else if (bd.type === 'sobrado') {
            shutter(cz + 0.9, cz + 3.9, 2.4, false);
            win(cz + 5.6, cz + 7.1, 1.0, 2.1, 1);
            door(cz + 8.0, cz + 8.9, '#4b3424');
            q(cz + 0.4, cz + 9.6, 2.85, 3.05, '#8c867d', 0.6);                   // laje
            win(cz + 1.4, cz + 2.9, 3.6, 4.8, 2);
            win(cz + 4.6, cz + 6.1, 3.6, 4.8, 3);
            win(cz + 7.4, cz + 8.9, 3.6, 4.8, 4);
            if (r(5) > 0.5) q(cz + 2.0, cz + 2.7, 5.1, 5.5, '#d9d9d6', 0.5);
          } else if (bd.type === 'shop') {
            const open = r(6) > 0.45;
            shutter(cz + 0.8, cz + 6.2, 2.7, !open ? false : true);
            door(cz + 7.2, cz + 8.3, '#3c3a38');
            // letreiro
            const [name, col] = bd.shop;
            q(cz + 0.5, cz + 9.5, 2.95, 3.65, col, 0.9);
            const zA = side < 0 ? cz + 0.8 : cz + 9.2, zB = side < 0 ? cz + 9.2 : cz + 0.8;
            const a = P(2.98, zA), b = P(2.98, zB), c = P(3.62, zA);
            if (a && b && c && a.s > 5 && Math.min(zA, zB) > cam.z + 0.6) {
              // texto em perspectiva (transformação afim sobre o plano da fachada)
              ctx.save();
              ctx.setTransform(1, 0, 0, 1, 0, 0);
              const base = ctx.getTransform ? null : null;
              ctx.restore();
              ctx.save();
              ctx.transform((b.x - a.x) / 100, (b.y - a.y) / 100, (c.x - a.x) / 20, (c.y - a.y) / 20, a.x, a.y);
              ctx.fillStyle = `rgba(255,248,230,${0.95 * fog})`;
              ctx.font = '900 15px Rubik, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.scale(1, -1); ctx.fillText(name, 50, -10, 96);
              ctx.restore();
            }
            if (open) {   // luz da loja aberta derramando na calçada
              const g = this.proj(cam, side * (WALLX - 1.2), CURB, cz + 3.5);
              if (g && cz + 3.5 > cam.z + 1) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter';
                ctx.translate(g.x, g.y); ctx.scale(1, U.clamp(cam.y / (cz + 3.5 - cam.z) * 1.1, 0.05, 0.5));
                const R = g.s * 3, gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
                gr.addColorStop(0, `rgba(255,200,130,${0.22 * fog})`); gr.addColorStop(1, 'rgba(255,200,130,0)');
                ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); ctx.restore();
              }
            }
          }
        }
      }
    }

    _drawCrossStreet(ctx, cam, t) {
      const P = (x, y, z) => this.proj(cam, x, y, z);
      const T = this.track;
      const z0 = T + 2, z1 = this.barSidewalkZ, z2 = this.barZ;
      if (z2 - cam.z < 0.3) return;
      const dz = Math.max(1, (z0 + z1) / 2 - cam.z);
      const glowBoost = this.barGlow;
      // calçada do bar
      const sA = P(-60, CURB, Math.max(z1, cam.z + 0.3)), sB = P(60, CURB, Math.max(z1, cam.z + 0.3)), sC = P(60, CURB, z2), sD = P(-60, CURB, z2);
      if (sA && sC) this._quad(ctx, sA, sB, sC, sD, this._fog('rgb(110,96,80)', dz));
      // rua transversal
      if (z1 - cam.z > 0.3) {
        const za = Math.max(z0, cam.z + 0.3);
        this._quad(ctx, P(-60, 0, za), P(60, 0, za), P(60, 0, z1), P(-60, 0, z1), this._fog('rgb(46,44,46)', dz));
        // guia da calçada do bar
        this._quad(ctx, P(-60, 0, z1), P(60, 0, z1), P(60, CURB, z1), P(-60, CURB, z1), this._fog('rgb(150,140,125)', dz));
        // faixa amarela contínua da transversal
        const zc = (z0 + z1) / 2;
        if (zc > cam.z + 0.3) this._quad(ctx, P(-60, 0, zc - 0.06), P(60, 0, zc - 0.06), P(60, 0, zc + 0.06), P(-60, 0, zc + 0.06), this._fog('rgb(150,120,40)', dz));
      }
      // poça de luz quente na frente do bar
      const lp = P(0, 0, T + 9.5);
      if (lp) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const R = lp.s * 12;
        ctx.translate(lp.x, lp.y); ctx.scale(1, Math.min(0.45, cam.y / (lp.dz) * 1.2 + 0.08));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        g.addColorStop(0, `rgba(255,170,80,${0.30 * glowBoost})`);
        g.addColorStop(0.6, `rgba(255,120,50,${0.10 * glowBoost})`);
        g.addColorStop(1, 'rgba(255,120,50,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
        ctx.restore();
      }
    }

    // luz dos postes no asfalto (aditiva)
    drawLightPools(ctx, cam) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const lp of this.lamps) {
        const dz = lp.z - cam.z;
        if (dz < 3 || dz > 160) continue;
        const p = this.proj(cam, lp.side * (ROAD - 1.3), 0, lp.z);
        if (!p) continue;
        const R = p.s * 5.5;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.scale(1, U.clamp(cam.y / dz * 1.1, 0.04, 0.5));
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        const a = (lp.flickOn === false ? 0.04 : 0.2) * (1 - this.fogT(dz));
        g.addColorStop(0, `rgba(255,190,110,${a})`); g.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
        ctx.restore();
        // reflexo comprido no asfalto úmido (efeito de chão molhado)
        if (lp.flickOn !== false) {
          const rp = this.proj(cam, lp.side * (ROAD - 1.15), 0, lp.z);
          if (rp) {
            const L = rp.s * 6, wv = rp.s * 0.35, a2 = 0.16 * (1 - this.fogT(dz));
            const rg = ctx.createLinearGradient(0, rp.y, 0, rp.y + L);
            rg.addColorStop(0, `rgba(255,200,130,${a2})`); rg.addColorStop(1, 'rgba(255,200,130,0)');
            ctx.fillStyle = rg;
            ctx.beginPath(); ctx.moveTo(rp.x - wv * 0.4, rp.y); ctx.lineTo(rp.x + wv * 0.4, rp.y); ctx.lineTo(rp.x + wv, rp.y + L); ctx.lineTo(rp.x - wv, rp.y + L); ctx.closePath(); ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    // ------------------------------------------------------------------ sprites
    collectSprites(cam, t) {
      const list = [];
      const maxD = 230;
      const vis = (z) => z - cam.z > 0.6 && z - cam.z < maxD;
      for (const lp of this.lamps) if (vis(lp.z)) list.push({ z: lp.z, draw: (ctx) => this.drawLamp(ctx, cam, lp, t) });
      for (const tr of this.trees) if (vis(tr.z)) list.push({ z: tr.z, draw: (ctx) => this.drawTree(ctx, cam, tr, t) });
      for (const b of this.bags) if (vis(b.z)) list.push({ z: b.z, draw: (ctx) => this.drawBags(ctx, cam, b) });
      for (const d of this.dogs) if (d.z - cam.z > 0.6) list.push({ z: d.z, draw: (ctx) => this.drawDog(ctx, cam, d, t) });
      for (const o of this.obstacles) if (vis(o.z)) list.push({ z: o.z, draw: (ctx) => this.drawObstacle(ctx, cam, o, t) });
      // bar: fachada + mesas + clientes
      if (this.barZ - cam.z > 0.6) list.push({ z: this.barZ, draw: (ctx) => this.drawBar(ctx, cam, t) });
      for (const tb of this.tables) if (tb.z - cam.z > 0.6) list.push({ z: tb.z, draw: (ctx) => this.drawTable(ctx, cam, tb, t) });
      // cadeira livre ao lado do cliente: sprite próprio para o bêbado sentar NA FRENTE do encosto
      const st = this.seatTable;
      if (st.z + 0.15 - cam.z > 0.6) list.push({ z: st.z + 0.15, draw: (ctx) => this._seatChair(ctx, cam, st) });
      return list;
    }

    // ---------- poste ----------
    drawLamp(ctx, cam, lp, t) {
      const x = lp.side * (ROAD + 0.35);
      const b = this.proj(cam, x, CURB, lp.z), top = this.proj(cam, x, 6.3, lp.z), head = this.proj(cam, x - lp.side * 1.5, 6.1, lp.z);
      if (!b || !top || !head) return;
      const dz = b.dz, fogC = (c) => this._fog(c, dz);
      lp.flickOn = !lp.flick || Math.sin(t * 23 + lp.z) > -0.7 || U.hash(Math.floor(t * 6) + lp.z) > 0.3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = fogC('rgb(70,72,78)');
      ctx.lineWidth = Math.max(1, b.s * 0.16);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      ctx.lineWidth = Math.max(1, b.s * 0.08);
      ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(top.x, head.y - b.s * 0.4, head.x, head.y); ctx.stroke();
      // luminária
      ctx.fillStyle = fogC('rgb(50,52,58)');
      ctx.beginPath(); ctx.ellipse(head.x, head.y, b.s * 0.38, b.s * 0.13, 0, 0, 7); ctx.fill();
      if (lp.flickOn) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const R = b.s * 2.4;
        const g = ctx.createRadialGradient(head.x, head.y + b.s * 0.1, 0, head.x, head.y + b.s * 0.1, R);
        const a = 0.7 * (1 - this.fogT(dz) * 0.6);
        g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(0.25, `rgba(255,170,80,${a * 0.35})`); g.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g; ctx.fillRect(head.x - R, head.y - R, R * 2, R * 2);
        // cone de luz
        const gp = this.proj(cam, x - lp.side * 1.5, 0, lp.z);
        if (gp) {
          const cg = ctx.createLinearGradient(0, head.y, 0, gp.y);
          cg.addColorStop(0, `rgba(255,200,130,${0.10 * (1 - this.fogT(dz))})`); cg.addColorStop(1, 'rgba(255,200,130,0)');
          ctx.fillStyle = cg;
          ctx.beginPath(); ctx.moveTo(head.x - b.s * 0.25, head.y); ctx.lineTo(head.x + b.s * 0.25, head.y);
          ctx.lineTo(gp.x + b.s * 2.2, gp.y); ctx.lineTo(gp.x - b.s * 2.2, gp.y); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath(); ctx.ellipse(head.x, head.y + b.s * 0.08, b.s * 0.26, b.s * 0.06, 0, 0, 7); ctx.fill();
      }
    }

    // ---------- árvore ----------
    drawTree(ctx, cam, tr, t) {
      const x = tr.side * (ROAD + 1.4);
      const b = this.proj(cam, x, CURB, tr.z);
      if (!b) return;
      const s = b.s * tr.s, dz = b.dz;
      const lit = this.lampLight(tr.z);
      ctx.fillStyle = this._fog('rgb(25,25,22)', dz);
      ctx.beginPath(); ctx.ellipse(b.x, b.y, s * 0.6, s * 0.15, 0, 0, 7); ctx.fill();
      // canteiro
      ctx.fillStyle = this._fog('rgb(40,34,28)', dz);
      ctx.fillRect(b.x - s * 0.45, b.y - s * 0.06, s * 0.9, s * 0.08);
      ctx.strokeStyle = this._fog('rgb(58,42,30)', dz); ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.22;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + s * 0.2, b.y - s * 1.6, b.x - s * 0.1, b.y - s * 2.8); ctx.stroke();
      const sway = Math.sin(t * 0.8 + tr.seed * 10) * s * 0.05;
      // galhos
      ctx.lineWidth = s * 0.09;
      ctx.beginPath(); ctx.moveTo(b.x + s * 0.05, b.y - s * 2.2); ctx.lineTo(b.x - s * 0.8, b.y - s * 3.0); ctx.moveTo(b.x, b.y - s * 2.5); ctx.lineTo(b.x + s * 0.9, b.y - s * 3.2); ctx.stroke();
      // copa em vários tufos: escuro embaixo, iluminado pelo poste por baixo/na lateral
      if (!tr.tufts) { const rr = U.mulberry32(Math.floor(tr.seed * 1e6)); tr.tufts = []; for (let k = 0; k < 16; k++) { const a = rr() * Math.PI * 2, d = Math.sqrt(rr()); tr.tufts.push([Math.cos(a) * d * 1.5, -3.7 + Math.sin(a) * d * 1.0 - rr() * 0.3, 0.45 + rr() * 0.45, rr()]); } tr.tufts.sort((p, q) => p[1] - q[1]); }
      const dark = this._fog('rgb(14,26,17)', dz);
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(b.x + sway, b.y - s * 3.6, s * 1.9, s * 1.35, 0, 0, 7); ctx.fill();
      tr.tufts.forEach(([bx, by, br, v]) => {
        const light = U.clamp(lit * 0.75 * (0.5 + (by + 3.7) * 0.5) + v * 0.12, 0, 1);
        const col = U.mix('#13261a', '#4f6e33', light);
        const cx = b.x + bx * s + sway * (1 + (-by - 3) * 0.4), cy = b.y + by * s;
        const gr = ctx.createRadialGradient(cx - br * s * 0.3, cy + br * s * 0.3, 0, cx, cy, br * s);
        gr.addColorStop(0, this._fog(U.mix(col, '#7c9a45', light * 0.4), dz)); gr.addColorStop(1, this._fog(col, dz));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, br * s, 0, 7); ctx.fill();
      });
    }

    drawBags(ctx, cam, bg) {
      const p = this.proj(cam, bg.side * (WALLX - 0.5), CURB, bg.z);
      if (!p) return;
      const s = p.s;
      ctx.fillStyle = this._fog('rgb(22,22,26)', p.dz);
      [[-0.3, 0.32], [0.15, 0.38], [0.45, 0.28]].forEach(([dx, r]) => {
        ctx.beginPath(); ctx.ellipse(p.x + dx * s, p.y - r * s * 0.8, r * s, r * s * 0.85, 0, 0, 7); ctx.fill();
      });
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.ellipse(p.x + 0.05 * s, p.y - 0.45 * s, 0.12 * s, 0.05 * s, -0.4, 0, 7); ctx.fill();
    }

    // ---------- vira-lata caramelo ----------
    drawDog(ctx, cam, d, t) {
      const x = d.x || d.side * (ROAD + 1.0);
      const p = this.proj(cam, x, CURB, d.z);
      if (!p) return;
      const s = p.s, dz = p.dz;
      const awake = d.bar && this.cheer > 0;
      ctx.save(); ctx.translate(p.x, p.y);
      if (d.side < 0) ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.08, 0, 0, 7); ctx.fill();
      const body = this._fog('rgb(196,132,62)', dz), dark = this._fog('rgb(150,92,40)', dz);
      // rabo
      ctx.strokeStyle = body; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
      const wag = Math.sin(t * (awake ? 18 : 2)) * 0.3;
      ctx.beginPath(); ctx.moveTo(-s * 0.38, -s * 0.15); ctx.quadraticCurveTo(-s * 0.6, -s * (0.2 + wag * 0.4), -s * 0.62, -s * (0.35 + wag)); ctx.stroke();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.16, s * 0.42, s * 0.16, 0, 0, 7); ctx.fill();
      const hy = awake ? -s * 0.42 : -s * 0.2;
      ctx.beginPath(); ctx.ellipse(s * 0.4, hy, s * 0.15, s * 0.13, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.53, hy + s * 0.04, s * 0.08, s * 0.06, 0, 0, 7); ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath(); ctx.ellipse(s * 0.32, hy - s * 0.1, s * 0.05, s * 0.09, -0.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(s * 0.6, hy + s * 0.03, s * 0.025, 0, 7); ctx.fill();
      if (awake) { ctx.beginPath(); ctx.arc(s * 0.44, hy - s * 0.02, s * 0.02, 0, 7); ctx.fill(); }
      else { ctx.strokeStyle = '#111'; ctx.lineWidth = s * 0.012; ctx.beginPath(); ctx.moveTo(s * 0.41, hy - s * 0.02); ctx.lineTo(s * 0.47, hy - s * 0.02); ctx.stroke(); }
      ctx.restore();
    }

    // ---------- obstáculos ----------
    drawObstacle(ctx, cam, o, t) {
      const p = this.proj(cam, o.x + o.roll, 0, o.z);
      if (!p) return;
      const s = p.s, dz = p.dz, k = U.clamp(cam.y / dz, 0.02, 0.6);
      const F = (c) => this._col(c, o.z, dz, 0.9);
      ctx.save();
      ctx.translate(p.x, p.y);
      const shadow = (w) => { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, w * s, w * s * k * 0.9 + 1, 0, 0, 7); ctx.fill(); };
      const kn = o.knock * o.knockDir;
      switch (o.type) {
        case 'hole': {
          const rx = 0.68 * s, ry = rx * k;
          ctx.fillStyle = F('#3a3a3e'); ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.12, ry * 1.18, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#060607'; ctx.beginPath(); ctx.ellipse(0, ry * 0.08, rx, ry, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(80,60,40,0.5)'; ctx.beginPath(); ctx.ellipse(0, ry * 0.45, rx * 0.8, ry * 0.45, 0, 0, Math.PI); ctx.fill();
          // água empoçada refletindo
          ctx.fillStyle = 'rgba(255,190,120,0.12)'; ctx.beginPath(); ctx.ellipse(-rx * 0.2, ry * 0.3, rx * 0.4, ry * 0.18, 0, 0, 7); ctx.fill();
          // galho com pano vermelho — a sinalização oficial do bairro
          if (s > 6) {
            ctx.strokeStyle = F('#5b3d22'); ctx.lineWidth = Math.max(1, s * 0.05); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(rx * 0.3, 0); ctx.lineTo(rx * 0.45, -s * 1.1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(rx * 0.42, -s * 0.75); ctx.lineTo(rx * 0.7, -s * 0.95); ctx.stroke();
            ctx.fillStyle = F('#c0262d');
            const fl = Math.sin(t * 4 + o.seed * 9) * s * 0.06;
            ctx.beginPath(); ctx.moveTo(rx * 0.45, -s * 1.08); ctx.lineTo(rx * 0.45 + s * 0.35, -s * 1.0 + fl); ctx.lineTo(rx * 0.45, -s * 0.85); ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'cone': {
          shadow(0.32);
          ctx.rotate(kn * 1.35);
          const hgt = 0.72 * s, bw = 0.42 * s;
          ctx.fillStyle = F('#1d1d1f'); ctx.fillRect(-bw / 2, -s * 0.05, bw, s * 0.05);
          ctx.fillStyle = F('#f06a1d');
          ctx.beginPath(); ctx.moveTo(-bw * 0.4, -s * 0.05); ctx.lineTo(bw * 0.4, -s * 0.05); ctx.lineTo(s * 0.04, -hgt); ctx.lineTo(-s * 0.04, -hgt); ctx.closePath(); ctx.fill();
          ctx.fillStyle = F('#eeeeee');
          const band = (y0, y1) => {
            const w0 = U.lerp(bw * 0.4, s * 0.04, y0), w1 = U.lerp(bw * 0.4, s * 0.04, y1);
            ctx.beginPath(); ctx.moveTo(-w0, -s * 0.05 - (hgt - s * 0.05) * y0); ctx.lineTo(w0, -s * 0.05 - (hgt - s * 0.05) * y0);
            ctx.lineTo(w1, -s * 0.05 - (hgt - s * 0.05) * y1); ctx.lineTo(-w1, -s * 0.05 - (hgt - s * 0.05) * y1); ctx.closePath(); ctx.fill();
          };
          band(0.3, 0.42); band(0.6, 0.7);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath(); ctx.moveTo(s * 0.0, -s * 0.05); ctx.lineTo(bw * 0.4, -s * 0.05); ctx.lineTo(s * 0.04, -hgt); ctx.lineTo(0, -hgt); ctx.closePath(); ctx.fill();
          break;
        }
        case 'bottle': {
          // poça de cerveja derramada
          ctx.fillStyle = 'rgba(200,150,40,0.35)';
          ctx.beginPath(); ctx.ellipse(-o.roll * s * 0.3, 0, 0.6 * s, 0.6 * s * k, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,230,160,0.25)';
          ctx.beginPath(); ctx.ellipse(-0.15 * s, -0.02 * s * k, 0.2 * s, 0.08 * s * k, 0, 0, 7); ctx.fill();
          ctx.save();
          ctx.rotate(0.25 + o.roll * 3);
          const L = 0.34 * s, R = 0.045 * s;
          ctx.fillStyle = F('#6b4114');
          U.roundRect(ctx, -L / 2, -R * 2, L * 0.7, R * 2, R); ctx.fill();
          ctx.fillRect(L * 0.18, -R * 1.6, L * 0.3, R * 1.2);
          ctx.fillStyle = F('#e8d9b0'); ctx.fillRect(-L * 0.28, -R * 1.9, L * 0.25, R * 1.8);
          ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-L / 2 + R, -R * 1.8, L * 0.5, R * 0.35);
          ctx.restore();
          break;
        }
        case 'box': {
          shadow(0.45);
          ctx.rotate(kn * 0.5);
          const bw = 0.75 * s, bh = (0.52 - o.knock * 0.2) * s, top = 0.55 * s * U.clamp((cam.y - 0.52) / dz, 0.02, 0.8);
          ctx.fillStyle = F('#a4794a'); ctx.fillRect(-bw / 2, -bh, bw, bh);
          ctx.fillStyle = F('#c29660');
          ctx.beginPath(); ctx.moveTo(-bw / 2, -bh); ctx.lineTo(bw / 2, -bh); ctx.lineTo(bw / 2 - bw * 0.06, -bh - top); ctx.lineTo(-bw / 2 + bw * 0.06, -bh - top); ctx.closePath(); ctx.fill();
          // abas abertas
          ctx.fillStyle = F('#b48552');
          ctx.beginPath(); ctx.moveTo(-bw / 2, -bh); ctx.lineTo(-bw * 0.75, -bh - bw * 0.25); ctx.lineTo(-bw * 0.45, -bh - top); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(bw / 2, -bh); ctx.lineTo(bw * 0.72, -bh - bw * 0.2); ctx.lineTo(bw * 0.45, -bh - top); ctx.closePath(); ctx.fill();
          ctx.fillStyle = F('#d8c79a'); ctx.fillRect(-bw * 0.06, -bh, bw * 0.12, bh);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bw * 0.2, -bh, bw * 0.3, bh);
          if (s > 20) { ctx.fillStyle = F('#5a3d22'); ctx.font = `700 ${Math.round(s * 0.09)}px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('FRÁGIL', -bw * 0.22, -bh * 0.4); }
          break;
        }
        case 'trash': {
          shadow(0.45);
          ctx.rotate(kn * 1.3);
          const bw = 0.62 * s, bh = 1.0 * s;
          // lixo transbordando
          ctx.fillStyle = F('#1c1c22');
          ctx.beginPath(); ctx.ellipse(-bw * 0.1, -bh * 1.02, bw * 0.38, bw * 0.24, 0, 0, 7); ctx.fill();
          ctx.fillStyle = F('#d8d0b8'); ctx.fillRect(bw * 0.05, -bh * 1.12, bw * 0.22, bw * 0.16);
          ctx.fillStyle = F('#2f7d4a');
          ctx.beginPath(); ctx.moveTo(-bw / 2, -bh); ctx.lineTo(bw / 2, -bh); ctx.lineTo(bw * 0.44, 0); ctx.lineTo(-bw * 0.44, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = F('#256a3d'); ctx.fillRect(-bw * 0.55, -bh * 1.02, bw * 1.1, bh * 0.08);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bw * 0.1, -bh * 0.94, bw * 0.34, bh * 0.94);
          ctx.fillStyle = F('#151515');
          ctx.beginPath(); ctx.arc(-bw * 0.38, -s * 0.06, s * 0.07, 0, 7); ctx.arc(bw * 0.38, -s * 0.06, s * 0.07, 0, 7); ctx.fill();
          break;
        }
        case 'step': {
          const hw = o.w / 2;
          const a = this.proj(cam, o.x - hw, 0, o.z), b = this.proj(cam, o.x + hw, 0, o.z);
          const c = this.proj(cam, o.x + hw, 0.22, o.z), d = this.proj(cam, o.x - hw, 0.22, o.z);
          const e = this.proj(cam, o.x + hw * 0.96, 0.22, o.z + 0.7), f = this.proj(cam, o.x - hw * 0.96, 0.22, o.z + 0.7);
          ctx.restore(); ctx.save();
          if (a && b && c && d && e && f) {
            this._quad(ctx, d, c, e, f, F('#6d6a63'));
            this._quad(ctx, a, b, c, d, F('#4b4842'));
            // borda quebrada
            ctx.strokeStyle = F('#2a2825'); ctx.lineWidth = Math.max(1, s * 0.02);
            ctx.beginPath(); ctx.moveTo(d.x, d.y);
            for (let i = 1; i <= 8; i++) ctx.lineTo(U.lerp(d.x, c.x, i / 8), d.y + (U.hash(i + o.seed * 50) - 0.5) * s * 0.05);
            ctx.stroke();
            // faixa de "atenção" pintada à mão
            ctx.fillStyle = F('#c9a227');
            for (let i = 0; i < 6; i++) if (i % 2 === 0) this._quad(ctx, { x: U.lerp(d.x, c.x, i / 6), y: d.y }, { x: U.lerp(d.x, c.x, (i + 1) / 6), y: d.y },
              { x: U.lerp(a.x, b.x, (i + 1) / 6), y: U.lerp(d.y, a.y, 0.35) }, { x: U.lerp(a.x, b.x, i / 6), y: U.lerp(d.y, a.y, 0.35) }, F('#c9a227'));
          }
          break;
        }
        case 'manhole': {
          // bueiro sem tampa (a tampa foi "emprestada")
          const rx = 0.42 * s, ry = rx * k;
          ctx.fillStyle = F('#55565c'); ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.25, ry * 1.25, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#040405'; ctx.beginPath(); ctx.ellipse(0, ry * 0.05, rx, ry, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(120,120,125,0.5)'; ctx.lineWidth = Math.max(1, s * 0.012);
          ctx.beginPath(); ctx.ellipse(0, ry * 0.05, rx * 0.8, ry * 0.8, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); // degraus de ferro
          // vapor saindo
          ctx.fillStyle = 'rgba(200,200,210,0.07)';
          for (let i = 0; i < 3; i++) { const yy = -((t * 0.4 + i / 3) % 1) * s * 0.9; ctx.beginPath(); ctx.arc(Math.sin(t + i) * s * 0.1, yy, s * (0.15 + i * 0.05), 0, 7); ctx.fill(); }
          break;
        }
        case 'cart': {
          shadow(0.5);
          ctx.rotate(kn * 1.2);
          const w = 0.8 * s, hb = 0.55 * s, top = 0.95 * s;
          ctx.strokeStyle = F('#9da2aa'); ctx.lineWidth = Math.max(1, s * 0.018);
          // cesto de arame
          ctx.beginPath(); ctx.moveTo(-w / 2, -top); ctx.lineTo(w / 2, -top); ctx.lineTo(w * 0.42, -top + hb); ctx.lineTo(-w * 0.42, -top + hb); ctx.closePath(); ctx.stroke();
          ctx.lineWidth = Math.max(1, s * 0.008);
          for (let i = 1; i < 8; i++) { const u = i / 8; ctx.beginPath(); ctx.moveTo(U.lerp(-w / 2, w / 2, u), -top); ctx.lineTo(U.lerp(-w * 0.42, w * 0.42, u), -top + hb); ctx.stroke(); }
          for (let j = 1; j < 4; j++) { const v = j / 4; ctx.beginPath(); ctx.moveTo(U.lerp(-w / 2, -w * 0.42, v), -top + hb * v); ctx.lineTo(U.lerp(w / 2, w * 0.42, v), -top + hb * v); ctx.stroke(); }
          // saco de lixo dentro e alça
          ctx.fillStyle = F('#1c1c22'); ctx.beginPath(); ctx.ellipse(-w * 0.1, -top + hb * 0.25, w * 0.25, hb * 0.35, 0, 0, 7); ctx.fill();
          ctx.lineWidth = Math.max(1, s * 0.02); ctx.strokeStyle = F('#c43a2e');
          ctx.beginPath(); ctx.moveTo(-w * 0.55, -top - s * 0.08); ctx.lineTo(w * 0.55, -top - s * 0.08); ctx.stroke();
          // chassi e rodinhas
          ctx.strokeStyle = F('#7d828a'); ctx.lineWidth = Math.max(1, s * 0.02);
          ctx.beginPath(); ctx.moveTo(-w * 0.4, -top + hb); ctx.lineTo(-w * 0.38, -s * 0.06); ctx.moveTo(w * 0.4, -top + hb); ctx.lineTo(w * 0.38, -s * 0.06); ctx.moveTo(-w * 0.38, -s * 0.12); ctx.lineTo(w * 0.38, -s * 0.12); ctx.stroke();
          ctx.fillStyle = F('#111');
          [-0.38, 0.38].forEach((xx) => { ctx.beginPath(); ctx.arc(xx * w, -s * 0.04, s * 0.045, 0, 7); ctx.fill(); });
          break;
        }
        case 'chair': {
          shadow(0.4);
          ctx.rotate(kn * 1.4);
          const c = F('#e8e2d0'), cd = F('#bdb6a2');
          const w = 0.48 * s;
          ctx.strokeStyle = cd; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w * 0.42, -0.45 * s); ctx.moveTo(w / 2, 0); ctx.lineTo(w * 0.42, -0.45 * s); ctx.stroke();
          ctx.fillStyle = c;
          U.roundRect(ctx, -w * 0.55, -0.5 * s, w * 1.1, 0.08 * s, s * 0.03); ctx.fill();
          U.roundRect(ctx, -w * 0.5, -0.92 * s, w, 0.42 * s, s * 0.06); ctx.fill();
          ctx.fillStyle = cd;
          for (let i = 0; i < 3; i++) U.roundRect(ctx, -w * 0.32 + i * w * 0.24, -0.84 * s, w * 0.13, 0.26 * s, s * 0.02), ctx.fill();
          break;
        }
      }
      ctx.restore();
    }

    // ---------- mesa de plástico com cerveja ----------
    drawTable(ctx, cam, tb, t) {
      const p = this.proj(cam, tb.x, CURB, tb.z);
      if (!p) return;
      const s = p.s, dz = p.dz;
      const F = (c) => this._fog(U.mix(c, '#ffb070', 0.18 * this.barGlow), dz);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.9, s * 0.12, 0, 0, 7); ctx.fill();
      // cadeiras atrás
      const chair = (cx, back) => {
        ctx.fillStyle = F('#e0b622');
        U.roundRect(ctx, cx - s * 0.26, -s * (back ? 0.95 : 0.48), s * 0.52, s * (back ? 0.5 : 0.08), s * 0.05); ctx.fill();
        ctx.fillStyle = F('#c49c16');
        ctx.fillRect(cx - s * 0.24, -s * 0.46, s * 0.04, s * 0.46); ctx.fillRect(cx + s * 0.2, -s * 0.46, s * 0.04, s * 0.46);
      };
      chair(-s * 0.55, true); if (!tb.seat) chair(s * 0.55, true);
      // cliente sentado
      if (tb.pat >= 0) this._drawPatron(ctx, s, tb.pat, t, F);
      // mesa
      ctx.fillStyle = F('#c99d15');
      ctx.fillRect(-s * 0.38, -s * 0.7, s * 0.05, s * 0.7); ctx.fillRect(s * 0.33, -s * 0.7, s * 0.05, s * 0.7);
      ctx.fillStyle = F('#f0c52a');
      U.roundRect(ctx, -s * 0.48, -s * 0.76, s * 0.96, s * 0.09, s * 0.02); ctx.fill();
      ctx.fillStyle = F('#b88a10'); ctx.fillRect(-s * 0.48, -s * 0.69, s * 0.96, s * 0.03);
      // garrafas 600 e copos americanos
      [[-0.22, 1], [0.05, 0], [0.24, 1]].forEach(([bx, full]) => {
        ctx.fillStyle = F('#5a3412');
        U.roundRect(ctx, s * bx - s * 0.04, -s * 1.03, s * 0.08, s * 0.27, s * 0.02); ctx.fill();
        ctx.fillRect(s * bx - s * 0.015, -s * 1.12, s * 0.03, s * 0.1);
        ctx.fillStyle = F('#e8dcb8'); ctx.fillRect(s * bx - s * 0.04, -s * 0.94, s * 0.08, s * 0.07);
      });
      [[-0.08], [0.15]].forEach(([cx]) => {
        ctx.fillStyle = 'rgba(240,190,70,0.85)'; ctx.fillRect(s * cx - s * 0.03, -s * 0.86, s * 0.06, s * 0.1);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(s * cx - s * 0.03, -s * 0.87, s * 0.06, s * 0.02);
      });
      ctx.restore();
    }

    _seatChair(ctx, cam, tb) {
      const p = this.proj(cam, tb.x + 0.32, CURB, tb.z + 0.15);
      if (!p) return;
      const s = p.s, F = (c) => this._fog(U.mix(c, '#ffb070', 0.18 * this.barGlow), p.dz);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = F('#e0b622');
      U.roundRect(ctx, -s * 0.26, -s * 0.95, s * 0.52, s * 0.5, s * 0.05); ctx.fill();
      ctx.fillStyle = F('#c49c16');
      ctx.fillRect(-s * 0.24, -s * 0.46, s * 0.04, s * 0.46); ctx.fillRect(s * 0.2, -s * 0.46, s * 0.04, s * 0.46);
      ctx.fillStyle = F('#d6ad1c'); U.roundRect(ctx, -s * 0.27, -s * 0.5, s * 0.54, s * 0.07, s * 0.03); ctx.fill();
      ctx.restore();
    }

    _drawPatron(ctx, s, which, t, F) {
      const shirts = ['#2f5d8a', '#8a2f3b'];
      const cheer = this.cheer;
      const bounce = cheer ? Math.abs(Math.sin(t * 9 + which)) * s * 0.06 : Math.sin(t * 1.3 + which * 2) * s * 0.01;
      const x = which === 0 ? -s * 0.55 : s * 0.55;
      ctx.save(); ctx.translate(x, -bounce);
      ctx.fillStyle = F(shirts[which]);
      U.roundRect(ctx, -s * 0.2, -s * 1.15, s * 0.4, s * 0.55, s * 0.12); ctx.fill();
      ctx.fillStyle = F('#b67a55');
      ctx.beginPath(); ctx.arc(0, -s * 1.3, s * 0.13, 0, 7); ctx.fill();
      ctx.fillStyle = F(which ? '#2a2a2a' : '#5a5a5a');
      ctx.beginPath(); ctx.arc(0, -s * 1.34, s * 0.135, Math.PI, 0); ctx.fill();
      // braço com copo
      const raise = cheer ? -0.5 - Math.abs(Math.sin(t * 6 + which)) * 0.35 : -0.1 - Math.max(0, Math.sin(t * 0.7 + which * 3)) * 0.4;
      const side = which === 0 ? 1 : -1;
      ctx.strokeStyle = F(shirts[which]); ctx.lineWidth = s * 0.09; ctx.lineCap = 'round';
      let ex = side * s * 0.3, ey = -s * 0.9 + raise * s * 0.3;
      if (which === 0 && this.toast > 0) { // brinde com o bêbado
        const k = this.toast;
        ex = U.lerp(ex, s * 0.4 + Math.sin(t * 3) * s * 0.02, k); ey = U.lerp(ey, -s * 1.45 + Math.abs(Math.sin(t * 2.2)) * s * 0.05, k);
      }
      ctx.beginPath(); ctx.moveTo(side * s * 0.16, -s * 1.05); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = 'rgba(240,190,70,0.9)'; ctx.fillRect(ex - s * 0.03, ey - s * 0.12, s * 0.06, s * 0.1);
      ctx.restore();
    }

    // ---------- O BAR ----------
    drawBar(ctx, cam, t) {
      const p = this.proj(cam, 0, 0, this.barZ);
      if (!p) return;
      const s = p.s, dz = p.dz;
      const glow = this.barGlow;
      const detail = s > 7;
      const fogAmt = this.fogT(dz) * 0.55; // o bar sempre "fura" a névoa
      const F = (hex) => U.mix(hex, FOG, fogAmt);

      ctx.save();
      ctx.translate(p.x, p.y + cam.y * 0 - CURB * s);
      ctx.scale(s, s); // a partir daqui: unidades em METROS, y negativo = para cima

      // --- vizinhança (muro baixo + mata escura, sem prédios)
      // casas da rua transversal (fachadas com janelas acesas)
      for (let hx = -60, k = 0; hx < 60; hx += 6.8, k++) {
        if (hx > -14.3 && hx < 7.5) continue;        // espaço do bar
        const hh = 3.2 + U.hash(k * 4.1) * 2.9, col = FACADE[Math.floor(U.hash(k * 1.7) * FACADE.length)];
        ctx.fillStyle = F(U.mix(col, '#0a0912', 0.55).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, b) => '#' + [r, g, b].map((v) => (+v).toString(16).padStart(2, '0')).join('')));
        ctx.fillRect(hx, -hh, 6.6, hh);
        ctx.fillStyle = F('#1c1a18'); ctx.fillRect(hx - 0.1, -hh - 0.18, 6.8, 0.22);
        if (detail) for (let wx = 0; wx < 2; wx++) for (let wy = 0; wy < (hh > 5 ? 2 : 1); wy++) {
          const on = U.hash(k * 9.1 + wx * 3 + wy * 7) > 0.45;
          ctx.fillStyle = on ? `rgba(255,${200 + wx * 10},130,0.85)` : F('#141a22');
          ctx.fillRect(hx + 1 + wx * 3.2, -1.9 - wy * 2.8, 1.4, 1.0);
        }
      }
      ctx.fillStyle = F('#0d140f');
      [[-11, 5.5, 2.6], [-15, 4.6, 2.2], [-20, 6.2, 3], [11.5, 5, 2.4], [16, 6.3, 3], [22, 4.8, 2.2]].forEach(([x, h, r]) => {
        ctx.beginPath(); ctx.arc(x, -h, r, 0, 7); ctx.arc(x + r * 0.6, -h + r * 0.5, r * 0.8, 0, 7); ctx.arc(x - r * 0.7, -h + r * 0.6, r * 0.7, 0, 7); ctx.fill();
        ctx.fillRect(x - 0.15, -h + r, 0.3, h - r);
      });
      // poste de luz com transformador e fios
      ctx.fillStyle = F('#2b2b30'); ctx.fillRect(-8.9, -8, 0.28, 8);
      ctx.fillRect(-9.3, -6.6, 1.1, 0.8);
      ctx.strokeStyle = F('#141418'); ctx.lineWidth = 0.04;
      ctx.beginPath(); ctx.moveTo(-60, -7.2); ctx.quadraticCurveTo(-30, -6.4, -8.8, -7.6); ctx.quadraticCurveTo(0, -6.8, 60, -7.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8.8, -7.3); ctx.quadraticCurveTo(-4, -5.6, 0.5, -5.2); ctx.stroke();

      // --- corpo do prédio (térreo)
      const wg = ctx.createLinearGradient(0, -5, 0, 0);
      wg.addColorStop(0, F('#7d6634')); wg.addColorStop(0.3, F('#b8954a')); wg.addColorStop(1, F('#9c7c3c'));
      ctx.fillStyle = wg; ctx.fillRect(-7.5, -4.6, 15, 4.6);
      // platibanda
      ctx.fillStyle = F('#8c7036'); ctx.fillRect(-7.7, -5.05, 15.4, 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-7.7, -4.6, 15.4, 0.08);
      // manchas de umidade
      if (detail) {
        ctx.fillStyle = 'rgba(40,30,15,0.18)';
        [[-6.4, -4.1, 0.6, 1.2], [5.8, -4.2, 0.5, 1.4], [-1, -4.4, 1.4, 0.3], [3.2, -4.3, 0.4, 0.9]].forEach(([x, y, w, h]) => {
          ctx.beginPath(); ctx.ellipse(x, y + h / 2, w, h, 0, 0, 7); ctx.fill();
        });
      }
      // azulejo verde na barra
      ctx.fillStyle = F('#2e6a52'); ctx.fillRect(-7.5, -1.1, 15, 1.1);
      if (s > 18) {
        ctx.strokeStyle = 'rgba(220,240,230,0.25)'; ctx.lineWidth = 0.015;
        for (let x = -7.5; x <= 7.5; x += 0.15) { ctx.beginPath(); ctx.moveTo(x, -1.1); ctx.lineTo(x, 0); ctx.stroke(); }
        for (let y = -1.1; y <= 0; y += 0.15) { ctx.beginPath(); ctx.moveTo(-7.5, y); ctx.lineTo(7.5, y); ctx.stroke(); }
      }

      // --- interior da porta principal (aberta)
      const ig = ctx.createLinearGradient(0, -2.9, 0, 0);
      ig.addColorStop(0, '#ffe2a0'); ig.addColorStop(0.6, '#f0b25c'); ig.addColorStop(1, '#c97a35');
      ctx.fillStyle = ig; ctx.fillRect(-1.7, -2.9, 3.4, 2.9);
      if (detail) {
        // prateleiras com garrafas
        ctx.fillStyle = '#7a4a22';
        [-2.55, -2.1, -1.65].forEach((y) => ctx.fillRect(-1.6, y, 3.2, 0.05));
        const bc = ['#3b6b2a', '#7a3a12', '#d8c27a', '#a51d1d', '#2a4f7a', '#e8e0d0', '#5a2a0a'];
        [-2.55, -2.1, -1.65].forEach((y, row) => {
          for (let i = 0; i < 14; i++) {
            const bx = -1.5 + i * 0.22 + (row % 2) * 0.08;
            ctx.fillStyle = bc[(i * 3 + row * 5) % bc.length];
            ctx.fillRect(bx, y - 0.32, 0.09, 0.32); ctx.fillRect(bx + 0.025, y - 0.42, 0.04, 0.1);
          }
        });
        // o Zé atrás do balcão
        const zb = this.cheer ? Math.abs(Math.sin(t * 7)) * 0.08 : 0;
        ctx.fillStyle = '#f2efe8'; U.roundRect(ctx, 0.25, -1.75 - zb, 0.7, 0.85, 0.2); ctx.fill();
        ctx.fillStyle = '#a8704a'; ctx.beginPath(); ctx.arc(0.6, -1.95 - zb, 0.2, 0, 7); ctx.fill();
        ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.ellipse(0.6, -1.86 - zb, 0.17, 0.07, 0, 0, Math.PI); ctx.fill(); // bigode
        ctx.fillStyle = '#2a201a'; ctx.beginPath(); ctx.arc(0.6, -2.02 - zb, 0.2, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
        if (this.cheer) { // Zé acenando com o pano de prato
          ctx.strokeStyle = '#f2efe8'; ctx.lineWidth = 0.12; ctx.lineCap = 'round';
          const wv = Math.sin(t * 10) * 0.3;
          ctx.beginPath(); ctx.moveTo(0.9, -1.6 - zb); ctx.lineTo(1.15 + wv * 0.3, -2.3 - zb); ctx.stroke();
          ctx.fillStyle = '#d33'; ctx.fillRect(1.05 + wv * 0.3, -2.6 - zb, 0.25, 0.3);
        }
        // balcão de inox com estufa
        ctx.fillStyle = '#8f9196'; ctx.fillRect(-1.7, -1.05, 3.4, 1.05);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-1.7, -1.05, 3.4, 0.08);
        ctx.fillStyle = 'rgba(255,240,200,0.55)'; ctx.fillRect(-1.5, -1.45, 1.4, 0.4);
        ctx.fillStyle = '#c98a3a';
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-1.35 + i * 0.27, -1.12, 0.1, 0.06, 0, 0, 7); ctx.fill(); } // coxinhas e pastéis
        // lâmpada pendurada
        ctx.strokeStyle = '#222'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(-0.6, -2.9); ctx.lineTo(-0.6, -2.62); ctx.stroke();
        ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(-0.6, -2.56, 0.07, 0, 7); ctx.fill();
      }
      // porta de enrolar recolhida
      ctx.fillStyle = F('#6d7076'); ctx.fillRect(-1.85, -3.2, 3.7, 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let y = -3.2; y < -2.9; y += 0.06) ctx.fillRect(-1.85, y, 3.7, 0.015);

      // --- vão esquerdo: porta meio fechada com a sinuca acesa embaixo
      ctx.fillStyle = '#e09a4a'; ctx.fillRect(-6.6, -1.05, 4.0, 1.05);
      if (detail) {
        ctx.fillStyle = '#1f6a3a'; ctx.fillRect(-5.8, -0.75, 2.4, 0.25);
        ctx.fillStyle = '#5a3418'; ctx.fillRect(-5.85, -0.52, 2.5, 0.5);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-4.2, -0.6, 0.12, 0.6); ctx.fillRect(-3.6, -0.68, 0.1, 0.68); // pernas de quem joga
      }
      ctx.fillStyle = F('#7a7d84'); ctx.fillRect(-6.6, -3.0, 4.0, 1.95);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let y = -3.0; y < -1.05; y += 0.08) ctx.fillRect(-6.6, y, 4.0, 0.02);
      if (detail) { // pichação
        ctx.strokeStyle = 'rgba(80,190,220,0.8)'; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-6.1, -1.6); ctx.bezierCurveTo(-5.7, -2.6, -5.3, -1.2, -4.9, -2.2); ctx.bezierCurveTo(-4.6, -2.8, -4.2, -1.4, -3.4, -2.3); ctx.stroke();
      }

      // --- janela direita com grade e geladeira
      const wg2 = ctx.createLinearGradient(0, -2.6, 0, -0.95);
      wg2.addColorStop(0, '#ffd690'); wg2.addColorStop(1, '#d88a40');
      ctx.fillStyle = wg2; ctx.fillRect(2.6, -2.6, 4.0, 1.65);
      if (detail) {
        ctx.fillStyle = '#cfe8ff'; ctx.fillRect(4.6, -2.5, 1.2, 1.55);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(4.68, -2.42, 1.04, 0.05);
        for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { ctx.fillStyle = (i + r) % 2 ? '#7a3a12' : '#3b6b2a'; ctx.fillRect(4.7 + i * 0.17, -2.32 + r * 0.36, 0.08, 0.26); }
        // cartaz de promoção
        ctx.fillStyle = '#fff'; ctx.fillRect(2.85, -2.35, 1.3, 0.9);
        ctx.save(); ctx.scale(0.01, 0.01);
        ctx.fillStyle = '#c4161c'; ctx.font = `bold 26px ${U.FONT_UI}`; ctx.textAlign = 'center';
        ctx.fillText('PROMOÇÃO', 350, -205); ctx.font = `900 34px ${U.FONT_UI}`; ctx.fillText('LITRÃO', 350, -165);
        ctx.fillStyle = '#111'; ctx.font = `900 30px ${U.FONT_UI}`; ctx.fillText('R$ 12', 350, -128);
        ctx.restore();
      }
      ctx.strokeStyle = F('#1c1c1f'); ctx.lineWidth = 0.05;
      for (let x = 2.6; x <= 6.6; x += 0.25) { ctx.beginPath(); ctx.moveTo(x, -2.6); ctx.lineTo(x, -0.95); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(2.6, -1.8); ctx.lineTo(6.6, -1.8); ctx.stroke();

      // --- faixa pintada à mão
      ctx.fillStyle = F('#9b2a22'); ctx.fillRect(-7.5, -4.15, 15, 0.7);
      ctx.save(); ctx.scale(0.01, 0.01);
      ctx.fillStyle = F('#f6d34a'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `900 50px ${U.FONT_UI}`;
      ctx.fillText('CERVEJA GELADA  •  PETISCOS  •  SINUCA', 0, -378);
      ctx.restore();

      // --- toldo listrado
      const aw = (x0, x1, y0, y1) => {
        const n = Math.round((x1 - x0) / 0.4);
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = F(i % 2 ? '#e9e2d0' : '#b8272b');
          const xa = x0 + (i * (x1 - x0)) / n, xb = x0 + ((i + 1) * (x1 - x0)) / n;
          ctx.beginPath(); ctx.moveTo(xa, y1); ctx.lineTo(xb, y1); ctx.lineTo(xb + (xb - (x0 + x1) / 2) * 0.05, y0); ctx.lineTo(xa + (xa - (x0 + x1) / 2) * 0.05, y0);
          ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.arc((xa + xb) / 2 + ((xa + xb) / 2 - (x0 + x1) / 2) * 0.05, y0, (xb - xa) / 2, 0, Math.PI); ctx.fill();
        }
      };
      aw(-2.2, 2.2, -2.95, -3.45);
      aw(2.4, 6.8, -2.65, -3.05);

      // --- varal de lâmpadas
      const bulbs = [];
      ctx.strokeStyle = F('#141414'); ctx.lineWidth = 0.025;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = -7.3 + (14.6 * i) / 40, y = -4.45 + Math.sin((i / 40) * Math.PI) * 0.35 + Math.sin((i / 20) * Math.PI * 2) * 0.08;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        if (i % 2 === 1) bulbs.push([x, y + 0.08]);
      }
      ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      bulbs.forEach(([x, y], i) => {
        const on = this.cheer ? (Math.floor(t * 8) + i) % 3 !== 0 : U.hash(i * 7.7) > 0.06;
        if (!on) return;
        const col = this.cheer ? ['255,80,80', '80,200,255', '255,220,90', '120,255,140'][i % 4] : '255,200,120';
        const br = 0.35 * glow;
        const g = ctx.createRadialGradient(x, y, 0, x, y, br);
        g.addColorStop(0, `rgba(${col},0.9)`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - br, y - br, br * 2, br * 2);
      });
      ctx.restore();

      // --- luz que sai da porta (brilho aditivo)
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const dr = 4.5 * glow;
      const dg = ctx.createRadialGradient(0, -1.4, 0.2, 0, -1.4, dr);
      dg.addColorStop(0, `rgba(255,190,100,${0.3 * Math.min(glow, 1.6)})`); dg.addColorStop(1, 'rgba(255,150,60,0)');
      ctx.fillStyle = dg; ctx.fillRect(-dr, -1.4 - dr, dr * 2, dr * 2);
      ctx.restore();

      // --- LETREIRO NEON "BAR"
      ctx.fillStyle = F('#141218'); U.roundRect(ctx, -2.6, -6.75, 5.2, 1.7, 0.12); ctx.fill();
      ctx.strokeStyle = F('#2a2730'); ctx.lineWidth = 0.08; ctx.stroke();
      ctx.fillStyle = F('#2a2730'); ctx.fillRect(-2.0, -5.08, 0.12, 0.1); ctx.fillRect(1.9, -5.08, 0.12, 0.1);
      this._neonText(ctx, s, t, glow);

      ctx.restore();
    }

    _neonText(ctx, s, t, glow) {
      // texto em escala 1/100 para tipografia nítida
      ctx.save(); ctx.scale(0.01, 0.01);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `150px ${U.FONT_TITLE}`;
      ctx.lineJoin = 'round';
      const letters = ['B', 'A', 'R'];
      const xs = [-125, 0, 125];
      const flick = U.hash(Math.floor(t * 9)) > 0.93 && !this.cheer;
      letters.forEach((L, i) => {
        const off = flick && i === 1;
        const pulse = this.cheer ? 0.85 + 0.15 * Math.sin(t * 14 + i) : 1;
        const blur = Math.min(90, Math.max(6, s * 0.35)) * glow * pulse;
        ctx.shadowColor = off ? 'transparent' : 'rgba(255,40,70,1)';
        ctx.shadowBlur = off ? 0 : blur;
        ctx.strokeStyle = off ? '#4a1b24' : '#ff3355';
        ctx.lineWidth = 16;
        ctx.strokeText(L, xs[i], -588);
        if (!off) {
          ctx.shadowBlur = blur * 0.5;
          ctx.strokeStyle = '#ffd0d8'; ctx.lineWidth = 5;
          ctx.strokeText(L, xs[i], -588);
        }
      });
      // moldura de neon azul
      ctx.shadowColor = 'rgba(60,170,255,1)'; ctx.shadowBlur = Math.min(60, Math.max(4, s * 0.2)) * glow;
      ctx.strokeStyle = '#7cc8ff'; ctx.lineWidth = 6;
      U.roundRect(ctx, -235, -660, 470, 145, 22); ctx.stroke();
      ctx.restore();
    }
  }

  World.ROAD = ROAD;
  World.OB_TYPES = OB_TYPES;
  CNB.World = World;
  CNB.W = W; CNB.H = H;
})();
