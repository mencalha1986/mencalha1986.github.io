/* =========================================================================
   LOJA — corredor em perspectiva real (mesmo motor do Chega no Bar)
   Seções por categoria do site, prateleiras, chão encerado, luzes de teto,
   placas penduradas, ACHADOS para pegar, FURADAS para desviar e o CAIXA.
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const AISLE = 2.7, SHELF_D = 0.7, SHELF_H = 2.5, CEIL = 3.8;
  const FOG = '#151820';
  const BOX_COLORS = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ecf0f1', '#e67e22', '#1abc9c', '#ff7aa2', '#2c3e50', '#d35400'];
  const OB_TYPES = {
    wet:    { w: 1.1, label: 'chão molhado' },
    boxes:  { w: 1.0, label: 'pilha de caixas' },
    pallet: { w: 1.3, label: 'paleteira' },
    cart:   { w: 0.9, label: 'carrinho largado' },
    spill:  { w: 1.2, label: 'laranjas no chão' }
  };

  class Store {
    constructor(cfg, catalog) {
      this.cfg = cfg; this.catalog = catalog;
      this.glow = 1; this.cheer = 0;
      this.reset(1);
    }

    reset(seed) {
      const r = (this.rand = U.mulberry32(seed * 7919 + 3));
      const cfg = this.cfg;
      this.track = cfg.trackLength;
      this.checkoutZ = this.track + 6;
      // seções por categoria (ordem embaralhada)
      const cats = this.catalog.categories.slice();
      for (let i = cats.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cats[i], cats[j]] = [cats[j], cats[i]]; }
      const n = Math.max(1, Math.min(cats.length, 5));
      const len = this.track / n;
      this.sections = cats.slice(0, n).map((c, i) => ({ cat: c, z0: i * len, z1: (i + 1) * len }));
      // achados no chão
      this.items = [];
      const used = new Set();
      for (const sec of this.sections) {
        const pool = this.catalog.byCategory(sec.cat);
        let z = sec.z0 + 7;
        while (z < sec.z1 - 3) {
          let it = pool[Math.floor(r() * pool.length)];
          if (used.has(it.id) && pool.length > 2) it = pool.find((p) => !used.has(p.id)) || it;
          used.add(it.id);
          this.items.push({ p: it, z, x: (r() * 2 - 1) * (AISLE - 0.9), taken: false, fly: 0, seed: r() });
          z += U.lerp(cfg.itemSpacing[0], cfg.itemSpacing[1], r());
        }
      }
      // furadas
      this.obstacles = [];
      const types = Object.keys(OB_TYPES);
      let z = 20, last = '';
      while (z < this.track - 12) {
        let t; do { t = types[Math.floor(r() * types.length)]; } while (t === last);
        last = t;
        // não coloca em cima de um achado
        let x = (r() * 2 - 1) * (AISLE - 0.9);
        const near = this.items.find((i) => Math.abs(i.z - z) < 2.5);
        if (near && Math.abs(near.x - x) < 1.4) x = near.x > 0 ? near.x - 1.8 : near.x + 1.8;
        this.obstacles.push({ type: t, z, x: U.clamp(x, -AISLE + 0.6, AISLE - 0.6), w: OB_TYPES[t].w, hit: false, knock: 0, seed: r(), decided: false });
        z += U.lerp(cfg.obstacleSpacing[0], cfg.obstacleSpacing[1], r());
      }
      // detalhes de prateleira por módulo (2 m)
      this.lights = [];
      for (let lz = 0; lz < this.track + 8; lz += 4) this.lights.push({ z: lz, flick: r() < 0.06 });
    }

    sectionAt(z) { return this.sections.find((s) => z >= s.z0 && z < s.z1) || this.sections[this.sections.length - 1]; }

    /** liquidação: joga achados no chão logo à frente */
    spawnSale(z, count) {
      const pool = this.catalog.items, r = Math.random;
      const out = [];
      for (let i = 0; i < count; i++) {
        const it = { p: pool[Math.floor(r() * pool.length)], z: z + 7 + i * 2.6 + r() * 1.5, x: (r() * 2 - 1) * (AISLE - 0.9), taken: false, fly: 0, seed: r(), drop: 1.2 + i * 0.15, sale: true };
        this.items.push(it); out.push(it);
      }
      return out;
    }

    proj(cam, x, y, z) {
      const dz = z - cam.z;
      if (dz < 0.05) return null;
      const s = cam.F / dz;
      return { x: W / 2 + (x - cam.x) * s + cam.sx, y: cam.horizon + (cam.y - y) * s + cam.sy, s, dz };
    }
    fogT(dz) { return Math.pow(U.clamp((dz - 15) / 220, 0, 1), 0.8) * 0.8; }
    _fog(hex, dz) { return U.mix(hex, FOG, this.fogT(dz)); }
    _rgbFog(rgb, dz) {
      const m = rgb.match(/\d+/g); const hex = '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('');
      return this._fog(hex, dz);
    }
    _quad(ctx, a, b, c, d, col) {
      if (!a || !b || !c || !d) return;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    }

    // ------------------------------------------------------------------ cenário
    drawEnv(ctx, cam, t) {
      ctx.fillStyle = FOG; ctx.fillRect(0, 0, W, H);
      const zNear = cam.z + 0.4, zEnd = this.checkoutZ + 6;
      const zs = [zNear]; let z = zNear;
      while (z < zEnd) { const dz = z - cam.z, st = dz < 40 ? 1 : dz < 110 ? 2 : 4; z = (Math.floor(z / st) + 1) * st; zs.push(Math.min(z, zEnd)); }
      // parede do fundo (atrás do caixa)
      this._backWall(ctx, cam, t);
      for (let i = zs.length - 1; i > 0; i--) this._segment(ctx, cam, zs[i - 1], zs[i], t);
    }

    _backWall(ctx, cam, t) {
      const zb = this.checkoutZ + 6;
      const a = this.proj(cam, -20, 0, zb), b = this.proj(cam, 20, CEIL, zb);
      if (!a || !b) return;
      const g = ctx.createLinearGradient(0, b.y, 0, a.y);
      g.addColorStop(0, '#2b2f3a'); g.addColorStop(1, '#3d3f48');
      ctx.fillStyle = g; ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
      // vitrine com a rua de noite
      const w0 = this.proj(cam, -6, 0.9, zb), w1 = this.proj(cam, 6, 3.2, zb);
      if (w0 && w1) {
        const sg = ctx.createLinearGradient(0, w1.y, 0, w0.y);
        sg.addColorStop(0, '#0a1430'); sg.addColorStop(1, '#22264a');
        ctx.fillStyle = sg; ctx.fillRect(w0.x, w1.y, w1.x - w0.x, w0.y - w1.y);
        ctx.strokeStyle = 'rgba(200,210,230,0.35)'; ctx.lineWidth = Math.max(1, w0.s * 0.05);
        for (let i = 0; i <= 4; i++) { const x = U.lerp(w0.x, w1.x, i / 4); ctx.beginPath(); ctx.moveTo(x, w1.y); ctx.lineTo(x, w0.y); ctx.stroke(); }
      }
    }

    _segment(ctx, cam, zn, zf, t) {
      const P = (x, y, z) => this.proj(cam, x, y, z);
      const zm = (zn + zf) / 2, dz = zm - cam.z;
      const sec = this.sectionAt(zm);
      const cc = CNB.Catalog.CAT_COLOR[sec ? sec.cat : 'casa'];
      const idx = Math.floor(zm);
      // chão encerado em xadrez claro
      const cols = 6;
      for (let c = 0; c < cols; c++) {
        const x0 = -AISLE - 0.1 + ((AISLE * 2 + 0.2) * c) / cols, x1 = -AISLE - 0.1 + ((AISLE * 2 + 0.2) * (c + 1)) / cols;
        const light = (c + idx) % 2 === 0;
        this._quad(ctx, P(x0, 0, zn), P(x1, 0, zn), P(x1, 0, zf), P(x0, 0, zf), this._fog(light ? '#d8d6cf' : '#c4c1b8', dz));
      }
      // reflexo das luzes no chão encerado
      if (dz < 120) {
        const rg = this._fog('#f2f0ea', dz);
        ctx.globalAlpha = 0.35 * (1 - dz / 120);
        this._quad(ctx, P(-0.9, 0, zn), P(-0.6, 0, zn), P(-0.6, 0, zf), P(-0.9, 0, zf), rg);
        this._quad(ctx, P(0.6, 0, zn), P(0.9, 0, zn), P(0.9, 0, zf), P(0.6, 0, zf), rg);
        ctx.globalAlpha = 1;
      }
      // teto
      this._quad(ctx, P(-AISLE - SHELF_D, CEIL, zn), P(AISLE + SHELF_D, CEIL, zn), P(AISLE + SHELF_D, CEIL, zf), P(-AISLE - SHELF_D, CEIL, zf), this._fog('#e9eaee', dz + 20));
      if (idx % 4 < 3) { // calhas de luz fluorescente
        const on = !this.lights[Math.floor(zm / 4)] || !this.lights[Math.floor(zm / 4)].flick || Math.sin(t * 30 + zm) > -0.6;
        const lc = on ? '#ffffff' : '#c9cbd2';
        [-0.9, 0.9].forEach((lx) => this._quad(ctx, P(lx - 0.18, CEIL - 0.01, zn), P(lx + 0.18, CEIL - 0.01, zn), P(lx + 0.18, CEIL - 0.01, zf), P(lx - 0.18, CEIL - 0.01, zf), lc));
      }
      // prateleiras dos dois lados
      for (const side of [-1, 1]) {
        const xf = side * AISLE, xb = side * (AISLE + SHELF_D);
        // rodapé da gôndola
        this._quad(ctx, P(xf, 0, zn), P(xf, 0.18, zn), P(xf, 0.18, zf), P(xf, 0, zf), this._fog('#30343e', dz));
        // fundo da gôndola
        this._quad(ctx, P(xb, 0.18, zn), P(xb, SHELF_H, zn), P(xb, SHELF_H, zf), P(xb, 0.18, zf), this._fog('#e4e6ea', dz));
        // produtos nas prateleiras (4 níveis)
        if (dz < 160) {
          for (let lv = 0; lv < 4; lv++) {
            const y0 = 0.22 + lv * 0.56, hh = 0.36 + U.hash(idx * 7 + lv + side * 31) * 0.12;
            const nb = dz < 30 ? 3 : dz < 80 ? 2 : 1;
            for (let b = 0; b < nb; b++) {
              const za = U.lerp(zn, zf, b / nb) + 0.04, zb2 = U.lerp(zn, zf, (b + 1) / nb) - 0.04;
              const hv = U.hash(idx * 13.1 + lv * 5.3 + b * 2.7 + side * 17);
              const col = BOX_COLORS[Math.floor(hv * BOX_COLORS.length)];
              const xx = side * (AISLE + 0.12);
              this._quad(ctx, P(xx, y0, za), P(xx, y0 + hh, za), P(xx, y0 + hh, zb2), P(xx, y0, zb2), this._fog(col, dz));
              if (dz < 50) { // rótulo da embalagem
                const lab = this._fog(U.mix(col, '#ffffff', 0.55).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, bb) => '#' + [r, g, bb].map((v) => (+v).toString(16).padStart(2, '0')).join('')), dz);
                this._quad(ctx, P(xx - side * 0.005, y0 + hh * 0.35, za + 0.05), P(xx - side * 0.005, y0 + hh * 0.6, za + 0.05), P(xx - side * 0.005, y0 + hh * 0.6, zb2 - 0.05), P(xx - side * 0.005, y0 + hh * 0.35, zb2 - 0.05), lab);
              }
            }
            // prateleira (chapa) + etiqueta de preço amarela
            this._quad(ctx, P(xf, y0 - 0.04, zn), P(xf, y0, zn), P(xf, y0, zf), P(xf, y0 - 0.04, zf), this._fog('#9aa0ab', dz));
            if (dz < 60 && idx % 2 === 0) {
              const tz = zn + 0.3;
              this._quad(ctx, P(xf - side * 0.01, y0 - 0.1, tz), P(xf - side * 0.01, y0 - 0.02, tz), P(xf - side * 0.01, y0 - 0.02, tz + 0.18), P(xf - side * 0.01, y0 - 0.1, tz + 0.18), this._fog('#ffd84a', dz));
            }
          }
        }
        // topo da gôndola com faixa da cor da seção
        this._quad(ctx, P(xf, SHELF_H, zn), P(xf, SHELF_H + 0.22, zn), P(xf, SHELF_H + 0.22, zf), P(xf, SHELF_H, zf), this._fog(cc, dz));
        // coluna a cada módulo
        if (idx % 2 === 0 && dz < 120) {
          const a = P(xf, 0, zn), b = P(xf, SHELF_H + 0.22, zn);
          if (a && b) { ctx.strokeStyle = this._fog('#7d828c', dz); ctx.lineWidth = Math.max(1, a.s * 0.04); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
      }
    }

    // ------------------------------------------------------------------ sprites
    collectSprites(cam, t) {
      const list = [];
      const vis = (z) => z - cam.z > 0.6 && z - cam.z < 230;
      for (const s of this.sections) if (vis(s.z0 + 0.5)) list.push({ z: s.z0 + 0.5, draw: (c) => this._sign(c, cam, s) });
      for (const it of this.items) if (!it.taken && vis(it.z)) list.push({ z: it.flying ? it.z - 2 : it.z, draw: (c) => this._item(c, cam, it, t) });
      for (const o of this.obstacles) if (vis(o.z)) list.push({ z: o.z, draw: (c) => this._obstacle(c, cam, o, t) });
      if (this.checkoutZ - cam.z > 0.6) list.push({ z: this.checkoutZ, draw: (c) => this._checkout(c, cam, t) });
      return list;
    }

    _sign(ctx, cam, s) {
      const a = this.proj(cam, -1.6, CEIL - 0.6, s.z0 + 0.5), b = this.proj(cam, 1.6, CEIL - 1.25, s.z0 + 0.5);
      if (!a || !b) return;
      const w = b.x - a.x, h = b.y - a.y, col = CNB.Catalog.CAT_COLOR[s.cat];
      ctx.strokeStyle = this._fog('#555a66', a.dz); ctx.lineWidth = Math.max(1, a.s * 0.012);
      const top = this.proj(cam, 0, CEIL, s.z0 + 0.5);
      if (top) { ctx.beginPath(); ctx.moveTo(a.x + w * 0.2, top.y); ctx.lineTo(a.x + w * 0.2, a.y); ctx.moveTo(a.x + w * 0.8, top.y); ctx.lineTo(a.x + w * 0.8, a.y); ctx.stroke(); }
      ctx.save();
      ctx.globalAlpha = 1 - this.fogT(a.dz) * 0.6;
      U.roundRect(ctx, a.x, a.y, w, h, Math.max(2, h * 0.12)); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (h > 6) {
        ctx.font = `${Math.round(h * 0.62)}px ${U.FONT_TITLE}`;
        ctx.fillText(CNB.Catalog.CAT_LABEL[s.cat], a.x + w / 2, a.y + h * 0.56);
      }
      ctx.restore();
    }

    _item(ctx, cam, it, t) {
      const drop = it.drop > 0 ? it.drop : 0;
      const hover = it.flying ? it.h : 0.85 + Math.sin(t * 2.4 + it.seed * 9) * 0.07 + drop * 2.4;
      const g = this.proj(cam, it.x, 0, it.z), p = this.proj(cam, it.x, hover, it.z);
      if (!g || !p) return;
      const s = p.s, size = 0.62 * s, k = U.clamp(cam.y / g.dz, 0.05, 0.5);
      const a = 1 - this.fogT(g.dz);
      ctx.save(); ctx.globalAlpha = a;
      // anel de luz no chão (cor da categoria)
      const col = CNB.Catalog.CAT_COLOR[it.p.cat];
      ctx.save(); if (it.flying) ctx.globalAlpha = 0; ctx.translate(g.x, g.y); ctx.scale(1, k);
      const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.6);
      rg.addColorStop(0, U.rgba(col, 0.55)); rg.addColorStop(1, U.rgba(col, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, 7); ctx.fill();
      ctx.restore();
      // card com a foto do achado
      const x = p.x - size / 2, y = p.y - size;
      if (size > 6) {
        ctx.shadowColor = U.rgba(col, 0.9); ctx.shadowBlur = Math.min(40, size * 0.25);
        U.roundRect(ctx, x - size * 0.05, y - size * 0.05, size * 1.1, size * 1.1, size * 0.12);
        ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.shadowBlur = 0;
        this.catalog.drawPhoto(ctx, it.p, x, y, size, size * 0.08);
        // etiqueta de preço
        if (size > 30) {
          const ph = size * 0.26, pw = size * 0.95;
          U.roundRect(ctx, p.x - pw / 2, p.y + size * 0.08, pw, ph, ph * 0.3);
          ctx.fillStyle = it.sale ? '#ff2d55' : '#ffd23f'; ctx.fill();
          ctx.fillStyle = it.sale ? '#fff' : '#1a1420'; ctx.font = `900 ${Math.round(ph * 0.62)}px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(CNB.fmtBRL(it.p.price), p.x, p.y + size * 0.08 + ph * 0.54);
        }
      } else { ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 1, p.y - 2, 2, 2); }
      ctx.restore();
    }

    _obstacle(ctx, cam, o, t) {
      const p = this.proj(cam, o.x, 0, o.z);
      if (!p) return;
      const s = p.s, dz = p.dz, k = U.clamp(cam.y / dz, 0.04, 0.5), F = (c) => this._fog(c, dz);
      ctx.save(); ctx.translate(p.x, p.y);
      const shadow = (w) => { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, w * s, w * s * k + 1, 0, 0, 7); ctx.fill(); };
      ctx.rotate(o.knock * (o.knockDir || 1) * 0.9);
      switch (o.type) {
        case 'wet': {
          ctx.fillStyle = 'rgba(160,200,255,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 0.75 * s, 0.75 * s * k, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-0.2 * s, -0.02 * s, 0.25 * s, 0.07 * s * k + 0.5, 0, 0, 7); ctx.fill();
          // placa amarela de "piso molhado"
          const w = 0.32 * s, h = 0.62 * s;
          ctx.fillStyle = F('#f5c400');
          ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w * 0.35, -h); ctx.lineTo(w * 0.35, -h); ctx.lineTo(w, 0); ctx.lineTo(w * 0.8, 0); ctx.lineTo(w * 0.25, -h * 0.85); ctx.lineTo(-w * 0.25, -h * 0.85); ctx.lineTo(-w * 0.8, 0); ctx.closePath(); ctx.fill();
          ctx.fillStyle = F('#f5c400'); ctx.beginPath(); ctx.moveTo(-w * 0.75, -h * 0.05); ctx.lineTo(-w * 0.3, -h * 0.88); ctx.lineTo(w * 0.3, -h * 0.88); ctx.lineTo(w * 0.75, -h * 0.05); ctx.closePath(); ctx.fill();
          if (s > 25) {
            ctx.fillStyle = '#111'; ctx.font = `900 ${Math.round(s * 0.07)}px ${U.FONT_UI}`; ctx.textAlign = 'center';
            ctx.fillText('CUIDADO', 0, -h * 0.62); ctx.fillText('PISO', 0, -h * 0.45); ctx.fillText('MOLHADO', 0, -h * 0.3);
            ctx.beginPath(); ctx.arc(0, -h * 0.15, s * 0.035, 0, 7); ctx.fill();
          }
          break;
        }
        case 'boxes': {
          shadow(0.55);
          const bw = 0.62 * s, bh = 0.42 * s;
          [[-0.28, 0, 1], [0.3, 0, 0.95], [0, -1, 0.9]].forEach(([dx, row, sc]) => {
            const x = dx * s - (bw * sc) / 2, y = row * bh - bh * sc;
            ctx.fillStyle = F('#b98a52'); ctx.fillRect(x, y, bw * sc, bh * sc);
            ctx.fillStyle = F('#d0a46a'); ctx.fillRect(x, y, bw * sc, bh * sc * 0.15);
            ctx.fillStyle = F('#e8d9b4'); ctx.fillRect(x + bw * sc * 0.44, y, bw * sc * 0.12, bh * sc);
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + bw * sc * 0.75, y, bw * sc * 0.25, bh * sc);
            if (s > 30) { ctx.fillStyle = F('#7a4a1a'); ctx.font = `800 ${Math.round(s * 0.05)}px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('↑↑ FRÁGIL', x + bw * sc * 0.25, y + bh * sc * 0.6); }
          });
          break;
        }
        case 'pallet': {
          shadow(0.7);
          const w = 1.0 * s;
          ctx.fillStyle = F('#c5913f'); ctx.fillRect(-w / 2, -0.14 * s, w, 0.14 * s);
          ctx.fillStyle = F('#8a5f22'); for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2 + i * w * 0.42, -0.09 * s, w * 0.16, 0.09 * s);
          // caixas plastificadas
          ctx.fillStyle = F('#4f7fb8'); ctx.fillRect(-w * 0.45, -0.95 * s, w * 0.9, 0.8 * s);
          ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-w * 0.45, -0.95 * s, w * 0.18, 0.8 * s);
          ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = Math.max(1, s * 0.01);
          for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-w * 0.45, -0.15 * s - i * 0.2 * s); ctx.lineTo(w * 0.45, -0.15 * s - i * 0.2 * s); ctx.stroke(); }
          // cabo da paleteira
          ctx.strokeStyle = F('#c0392b'); ctx.lineWidth = Math.max(1, s * 0.04);
          ctx.beginPath(); ctx.moveTo(0, -0.12 * s); ctx.lineTo(0.05 * s, -0.9 * s); ctx.stroke();
          ctx.fillStyle = F('#222'); ctx.fillRect(-0.12 * s, -0.98 * s, 0.34 * s, 0.07 * s);
          break;
        }
        case 'cart': {
          shadow(0.5);
          const w = 0.62 * s, top = 0.95 * s, hb = 0.55 * s;
          ctx.strokeStyle = F('#a7adb6'); ctx.lineWidth = Math.max(1, s * 0.016);
          ctx.beginPath(); ctx.moveTo(-w / 2, -top); ctx.lineTo(w / 2, -top); ctx.lineTo(w * 0.42, -top + hb); ctx.lineTo(-w * 0.42, -top + hb); ctx.closePath(); ctx.stroke();
          ctx.lineWidth = Math.max(1, s * 0.007);
          for (let i = 1; i < 8; i++) { const u = i / 8; ctx.beginPath(); ctx.moveTo(U.lerp(-w / 2, w / 2, u), -top); ctx.lineTo(U.lerp(-w * 0.42, w * 0.42, u), -top + hb); ctx.stroke(); }
          ctx.fillStyle = F('#e74c3c'); ctx.fillRect(-w * 0.55, -top - 0.08 * s, w * 1.1, 0.05 * s);
          ctx.strokeStyle = F('#8b9099'); ctx.lineWidth = Math.max(1, s * 0.02);
          ctx.beginPath(); ctx.moveTo(-w * 0.4, -top + hb); ctx.lineTo(-w * 0.38, -0.05 * s); ctx.moveTo(w * 0.4, -top + hb); ctx.lineTo(w * 0.38, -0.05 * s); ctx.stroke();
          ctx.fillStyle = '#111'; [-0.38, 0.38].forEach((xx) => { ctx.beginPath(); ctx.arc(xx * w, -0.04 * s, s * 0.04, 0, 7); ctx.fill(); });
          // bolsa esquecida dentro
          ctx.fillStyle = F('#2e86de'); ctx.fillRect(-w * 0.2, -top + hb * 0.1, w * 0.3, hb * 0.5);
          break;
        }
        case 'spill': {
          // laranjas rolando pelo chão
          for (let i = 0; i < 12; i++) {
            const a = U.hash(i * 3.3 + o.seed * 10) * Math.PI * 2, r = U.hash(i * 1.7 + o.seed) * 0.6;
            const x = Math.cos(a) * r * s + Math.sin(t * 2 + i) * s * 0.01, y = Math.sin(a) * r * s * k;
            ctx.fillStyle = F('#f39c12'); ctx.beginPath(); ctx.arc(x, y - 0.06 * s, 0.07 * s, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(x - 0.02 * s, y - 0.085 * s, 0.02 * s, 0, 7); ctx.fill();
          }
          // caixa de feira virada
          ctx.fillStyle = F('#2e7d32'); ctx.fillRect(0.35 * s, -0.3 * s, 0.45 * s, 0.3 * s);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 3; i++) ctx.fillRect(0.38 * s + i * 0.14 * s, -0.27 * s, 0.08 * s, 0.24 * s);
          break;
        }
      }
      ctx.restore();
    }

    // ---------- O CAIXA (destino) ----------
    _checkout(ctx, cam, t) {
      const p = this.proj(cam, 0, 0, this.checkoutZ);
      if (!p) return;
      const s = p.s, glow = this.glow;
      const fa = this.fogT(p.dz) * 0.5, F = (c) => U.mix(c, FOG, fa);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s); // metros
      // dois caixas lado a lado
      [-2.1, 2.1].forEach((cx, n) => {
        // esteira + balcão
        ctx.fillStyle = F('#e6e8ec'); ctx.fillRect(cx - 1.3, -0.95, 2.6, 0.95);
        ctx.fillStyle = F('#2b2f38'); ctx.fillRect(cx - 1.25, -1.0, 1.6, 0.1);
        ctx.fillStyle = F('#c7cbd3'); ctx.fillRect(cx - 1.3, -0.95, 2.6, 0.06);
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(cx - 1.3, -0.4, 2.6, 0.4);
        // registradora
        ctx.fillStyle = F('#1f2229'); ctx.fillRect(cx + 0.5, -1.45, 0.55, 0.45);
        ctx.fillStyle = this.cheer && n === 0 ? '#7CFC9A' : F('#5fd4ff'); ctx.fillRect(cx + 0.55, -1.4, 0.45, 0.2);
        // número do caixa
        ctx.fillStyle = F('#c0392b'); ctx.fillRect(cx - 0.18, -2.75, 0.36, 0.36);
        ctx.fillStyle = '#fff'; ctx.save(); ctx.scale(0.01, 0.01); ctx.font = `30px ${U.FONT_TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n + 1), cx * 100, -257); ctx.restore();
        ctx.strokeStyle = F('#666'); ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(cx, -2.75); ctx.lineTo(cx, -3.8); ctx.stroke();
        // operadora do caixa
        const bob = this.cheer && n === 0 ? Math.abs(Math.sin(t * 8)) * 0.06 : 0;
        ctx.fillStyle = F(n ? '#2e86de' : '#e74c3c'); U.roundRect(ctx, cx - 0.55, -1.75 - bob, 0.45, 0.8, 0.15); ctx.fill();
        ctx.fillStyle = F('#b67a55'); ctx.beginPath(); ctx.arc(cx - 0.33, -1.92 - bob, 0.15, 0, 7); ctx.fill();
        ctx.fillStyle = F(n ? '#2a1a12' : '#5a3a20'); ctx.beginPath(); ctx.arc(cx - 0.33, -1.97 - bob, 0.16, Math.PI, 0); ctx.fill();
        if (this.cheer && n === 0) { // acenando
          ctx.strokeStyle = F('#e74c3c'); ctx.lineWidth = 0.1; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(cx - 0.15, -1.6 - bob); ctx.lineTo(cx + 0.05 + Math.sin(t * 10) * 0.12, -2.2 - bob); ctx.stroke();
        }
      });
      // letreiro neon CAIXA
      ctx.fillStyle = F('#121218'); U.roundRect(ctx, -2.3, -3.75, 4.6, 0.95, 0.1); ctx.fill();
      ctx.save(); ctx.scale(0.01, 0.01);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `86px ${U.FONT_TITLE}`;
      ctx.shadowColor = '#22e07a'; ctx.shadowBlur = Math.min(80, Math.max(6, s * 0.3)) * glow;
      ctx.lineWidth = 9; ctx.strokeStyle = '#22e07a'; ctx.strokeText('CAIXA', 0, -322);
      ctx.shadowBlur *= 0.5; ctx.lineWidth = 3; ctx.strokeStyle = '#d6ffe6'; ctx.strokeText('CAIXA', 0, -322);
      ctx.restore();
      // faixa com o site
      ctx.fillStyle = F('#ff2d55'); ctx.fillRect(-6, -4.4, 12, 0.5);
      ctx.save(); ctx.scale(0.01, 0.01);
      ctx.fillStyle = '#fff'; ctx.font = `800 34px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ACHADOS ÚTEIS POR AÍ  •  ' + this.cfg.siteUrl.toUpperCase(), 0, -415);
      ctx.restore();
      ctx.restore();
      // brilho no chão em frente ao caixa
      const lp = this.proj(cam, 0, 0, this.checkoutZ - 1.5);
      if (lp) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.translate(lp.x, lp.y); ctx.scale(1, 0.25);
        const R = lp.s * 4;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        g.addColorStop(0, `rgba(80,255,150,${0.16 * glow})`); g.addColorStop(1, 'rgba(80,255,150,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
  }

  Store.AISLE = AISLE;
  Store.OB_TYPES = OB_TYPES;
  CNB.Store = Store;
  CNB.W = W; CNB.H = H;
})();
