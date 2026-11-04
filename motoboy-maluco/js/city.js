/* =========================================================================
   CIDADE — rua em perspectiva com CURVAS (estilo jogo de corrida clássico)
   A rota alterna AVENIDA (comércio, trânsito) e RUA de casas. Para entrar
   numa rua, a pista dobra para a direita; para voltar à avenida, para a
   esquerda. Tudo (pista, prédios, obstáculos, moto) usa a mesma projeção.
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const STEP = 0.5;
  const ZONE = {
    av:  { road: 5.4, side: 3.0, label: 'AVENIDA' },
    rua: { road: 3.2, side: 2.3, label: 'RUA' }
  };
  const SHOPS = [
    ['PADARIA', '#f59e0b'], ['FARMÁCIA', '#16a34a'], ['AÇAÍ', '#7c3aed'], ['LANCHES', '#dc2626'], ['MERCADINHO', '#0ea5e9'],
    ['BARBEARIA', '#1f2937'], ['PET SHOP', '#db2777'], ['ÓTICA', '#2563eb'], ['PIZZARIA', '#b91c1c'], ['SORVETERIA', '#ec4899'],
    ['LOJA DE 1,99', '#ca8a04'], ['ACADEMIA', '#111827'], ['SALÃO', '#9333ea'], ['CHAVEIRO', '#475569']
  ];
  const WALLS = ['#f4d35e', '#90be6d', '#f9844a', '#4d908e', '#f28482', '#84a59d', '#e9c46a', '#a8dadc', '#cdb4db', '#ffafcc', '#bde0fe', '#e76f51'];
  const STREETS = ['R. DAS FLORES', 'R. DOS IPÊS', 'R. SÃO JOÃO', 'R. DA PAZ', 'R. DAS ACÁCIAS', 'R. BOA VISTA', 'R. DO SOL', 'R. 7 DE SETEMBRO'];
  const CARS = ['#e63946', '#f1faee', '#457b9d', '#1d3557', '#2a9d8f', '#e9c46a', '#6d6875', '#adb5bd', '#f4a261', '#264653'];
  const SKY_TOP = '#5aa9e6', SKY_BOT = '#cfe8f7', HAZE = '#d6e3ec';

  // tipo de obstáculo -> o que acontece ao bater
  const OB = {
    hole:     { w: 1.2, hit: 'jolt',  banner: 'CAIU NO BURACO!' },
    cone:     { w: 0.6, hit: 'wobble', banner: 'ATROPELOU O CONE!' },
    bump:     { w: 99,  hit: 'jump',  banner: 'LOMBADA!' },
    puddle:   { w: 1.6, hit: 'wobble', banner: 'SPLASH!' },
    parked:   { w: 1.9, hit: 'crash', banner: 'BATEU NO CARRO!' },
    traffic:  { w: 1.9, hit: 'crash', banner: 'BATEU NA TRASEIRA!', move: true },
    bus:      { w: 2.5, hit: 'crash', banner: 'BATEU NO ÔNIBUS!', move: true },
    oncoming: { w: 1.9, hit: 'crash', banner: 'BATEU DE FRENTE!', move: true },
    dumpster: { w: 1.7, hit: 'crash', banner: 'BATEU NA CAÇAMBA!' },
    ped:      { w: 0.8, hit: 'stop',  banner: 'FREIOU NO SUSTO!', move: true },
    dogx:     { w: 0.9, hit: 'stop',  banner: 'CACHORRO ATRAVESSOU!', move: true }
  };

  class City {
    constructor(cfg, catalog) { this.cfg = cfg; this.catalog = catalog; this.reset(1); }

    reset(seed) {
      const r = (this.rand = U.mulberry32(seed * 6151 + 11)), cfg = this.cfg;
      const rr = (a) => U.lerp(a[0], a[1], r());
      this.zones = []; this.curves = []; this.stops = []; this.maneuvers = []; this.signs = []; this.corners = [];
      // ESQUINAS DE VERDADE: a avenida segue reto e a moto vira na rua (direita);
      // a rua termina num "T" com a avenida e a moto vira à esquerda.
      const CWR = ZONE.rua.road * 2, CWA = ZONE.av.road * 2;   // largura do cruzamento
      let z = 0;
      for (let k = 0; k < cfg.deliveries; k++) {
        const A = rr(cfg.avenueLength), zc = z + A;
        const streetName = STREETS[Math.floor(r() * STREETS.length)];
        const cR = { zc, cw: CWR, dir: 1, turned: false, name: streetName };
        this.corners.push(cR);
        this.zones.push({ type: 'av', z0: z, z1: zc + CWR, corner: cR, stopAt: Infinity });
        this.curves.push({ z0: zc, z1: zc + CWR, dir: 1 });
        this.maneuvers.push({ z: zc, type: 'right', name: streetName });
        this.signs.push({ z: zc - 3, name: streetName });
        const zs = zc + CWR, S = rr(cfg.streetLength), hz = zs + S;
        const num = 10 + Math.floor(r() * 890);
        this.stops.push({ z: hz, num, street: streetName, done: false, k });
        this.maneuvers.push({ z: hz, type: 'dest', num, name: streetName });
        const last = k === cfg.deliveries - 1;
        const ze = last ? hz + 40 : hz + 22;
        this.zones.push({ type: 'rua', z0: zs, z1: last ? ze : ze + CWA, stopAt: last ? ze - 8 : ze - 3 });
        if (!last) {
          this.corners.push({ zc: ze, cw: CWA, dir: -1, turned: false, name: 'AVENIDA' });
          this.curves.push({ z0: ze, z1: ze + CWA, dir: -1 });
          this.maneuvers.push({ z: ze, type: 'left', name: 'AVENIDA' });
        }
        z = ze + (last ? 0 : CWA);
      }
      this.length = z;
      this._buildCurve();
      // obstáculos (fora das curvas e longe das casas de entrega)
      this.obstacles = [];
      const freeAt = (zz) => !this.curves.some((c) => zz > c.z0 - 8 && zz < c.z1 + 8) && !this.stops.some((s) => Math.abs(zz - s.z) < 16) && zz > 18;
      let oz = 22, lastT = '';
      while (oz < this.length - 10) {
        if (freeAt(oz)) {
          const zt = this.zoneAt(oz).type, R = ZONE[zt].road;
          const pool = zt === 'av' ? ['hole', 'cone', 'bump', 'puddle', 'dumpster', 'ped', 'dogx', 'cone'] : ['hole', 'cone', 'bump', 'puddle', 'parked', 'parked', 'ped', 'dogx', 'dumpster'];
          let t; do { t = pool[Math.floor(r() * pool.length)]; } while (t === lastT);
          lastT = t;
          let x;
          if (t === 'parked' || t === 'dumpster') x = (r() < 0.5 ? -1 : 1) * (zt === 'rua' ? R - 0.45 : R - 1.1);
          else if (t === 'traffic') x = [-3.6, 0, 3.6][Math.floor(r() * 3)];
          else x = (r() * 2 - 1) * (R - 0.9);
          this.obstacles.push({ type: t, z: oz, x, x0: x, w: OB[t].w, hit: false, knock: 0, seed: r(), color: CARS[Math.floor(r() * CARS.length)],
            v: t === 'traffic' ? U.lerp(3, 5.5, r()) : 0, cross: (t === 'ped' || t === 'dogx') ? (r() < 0.5 ? -1 : 1) : 0 });
        }
        oz += rr(cfg.obstacleSpacing);
      }
      // TRÂNSITO: carros e ônibus na avenida; na rua, carro lento na mão e carro vindo na contramão
      const curveAt = (zz) => this.curves.some((c) => zz > c.z0 - 6 && zz < c.z1 + 6);
      let tz = 12;
      while (tz < this.length - 15) {
        if (!curveAt(tz) && !this.stops.some((st) => Math.abs(tz - st.z) < 14)) {
          const zone = this.zoneAt(tz), R = ZONE[zone.type].road;
          let type, x, v;
          if (zone.type === 'av') {
            type = r() < cfg.busChance ? 'bus' : 'traffic';
            x = [-3.6, 0, 3.6][Math.floor(r() * 3)];
            v = type === 'bus' ? U.lerp(2.5, 4, r()) : U.lerp(3, 6, r());
          } else if (r() < 0.55) { type = 'oncoming'; x = -R * 0.33; v = -U.lerp(3, 5, r()); }
          else { type = 'traffic'; x = R * 0.33; v = U.lerp(2, 3.5, r()); }
          this.obstacles.push({ type, z: tz, x, x0: x, tx: x, w: OB[type].w, hit: false, knock: 0, seed: r(), color: CARS[Math.floor(r() * CARS.length)], v, zone, vehicle: true,
            bus: type === 'bus' ? ['#f2b705', '#2a9d8f', '#e63946', '#3a86ff'][Math.floor(r() * 4)] : null, line: 100 + Math.floor(r() * 800) });
        }
        tz += rr(cfg.trafficSpacing);
      }
      this.obstacles.sort((a, b) => a.z - b.z);

      // árvores, postes e placas
      this.props = [];
      for (let pz = 6; pz < this.length; pz += 9 + r() * 10) {
        const side = r() < 0.5 ? -1 : 1, zt = this.zoneAt(pz).type;
        this.props.push({ z: pz, side, kind: r() < (zt === 'rua' ? 0.65 : 0.4) ? 'tree' : 'pole', seed: r() });
      }
      // parados na calçada da casa de entrega: cliente
      this.customers = this.stops.map(() => ({ shirt: WALLS[Math.floor(r() * WALLS.length)], hair: ['#2b1d14', '#5a3a1a', '#d4a24c', '#1b1b1b'][Math.floor(r() * 4)], skin: ['#c98c64', '#8d5a3b', '#e0b08e', '#a86e4b'][Math.floor(r() * 4)], fem: r() < 0.5 }));
    }

    // o que a câmera enxerga: antes de virar, depois da esquina aparece a avenida seguindo reto (ou o "T")
    get nextCorner() { return this.corners.find((c) => !c.turned); }
    get lastCorner() { let l = null; for (const c of this.corners) if (c.turned) l = c; return l; }
    viewType(z) {
      const K = this.nextCorner;
      if (K && z >= K.zc + K.cw) return K.dir > 0 ? 'av' : null;
      return this.zoneAt(z).type;
    }
    visibleZ(z, o) {
      const K = this.nextCorner, L = this.lastCorner;
      if (o && o.ghost) return !!(K && o.zone.corner === K);
      if (K && z >= K.zc - 0.3) return false;
      if (L && z < L.zc + L.cw) return false;
      return true;
    }

    zoneAt(z) { return this.zones.find((zn) => z >= zn.z0 && z < zn.z1) || this.zones[this.zones.length - 1]; }
    road(z) { return ZONE[this.zoneAt(z).type].road; }
    side(z) { return ZONE[this.zoneAt(z).type].side; }

    // ---------------- curva: posição lateral da pista acumulada ----------------
    _buildCurve() {
      const n = Math.ceil((this.length + 400) / STEP) + 2;
      this.cS = new Float32Array(n); this.cX = new Float32Array(n);
      const DELTA = 0.95; // quanto a pista "vira" em cada curva
      for (let i = 1; i < n; i++) {
        const z = i * STEP;
        let c = 0;
        for (const cv of (this.bends || [])) if (z >= cv.z0 && z < cv.z1) { const u = (z - cv.z0) / (cv.z1 - cv.z0); c = cv.dir * DELTA * Math.PI / (2 * (cv.z1 - cv.z0)) * Math.sin(u * Math.PI); }
        this.cS[i] = this.cS[i - 1] + c * STEP;
        this.cX[i] = this.cX[i - 1] + this.cS[i - 1] * STEP;
      }
    }
    _at(arr, z) { const f = Math.max(0, z) / STEP, i = Math.min(arr.length - 2, Math.floor(f)); return U.lerp(arr[i], arr[i + 1], f - i); }
    heading(z) { return this._at(this.cS, z); }
    offset(zc, z) { return this._at(this.cX, z) - this._at(this.cX, zc) - this._at(this.cS, zc) * (z - zc); }

    proj(cam, x, y, z) {
      const dz = z - cam.z;
      if (dz < 0.05) return null;
      const s = cam.F / dz;
      const off = this.offset(cam.z, z) - (cam.yaw || 0) * dz;
      return { x: W / 2 + (x + off - cam.x) * s + cam.sx, y: cam.horizon + (cam.y - y) * s + cam.sy, s, dz };
    }
    fogT(dz) { return Math.pow(U.clamp((dz - 25) / 230, 0, 1), 0.85) * 0.75; }
    _fog(c, dz) { return U.mix(c, HAZE, this.fogT(dz)); }
    _quad(ctx, a, b, c, d, col) {
      if (!a || !b || !c || !d) return;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    }

    // obstáculos que andam
    update(dt, t) {
      // trânsito: carro não atravessa o da frente na mesma faixa (acompanha a velocidade dele)
      const veh = this.obstacles.filter((o) => o.vehicle && !o.hit);
      for (const a of veh) {
        a.vNow = a.v;
        if (a.v <= 0) continue;
        for (const b of veh) if (b !== a && b.v > 0 && Math.abs(b.x - a.x) < 1.6 && b.z > a.z && b.z - a.z < (b.type === 'bus' || a.type === 'bus' ? 11 : 8)) a.vNow = Math.min(a.vNow, b.v * 0.95);
      }
      for (const o of this.obstacles) {
        if (o.vehicle && !o.hit) {
          // anda; não sai da avenida/rua onde nasceu (espera no fim, como num cruzamento)
          const nz = o.z + (o.vNow !== undefined ? o.vNow : o.v) * dt;
          if (nz > o.zone.z0 + 2 && nz < o.zone.stopAt && nz < o.zone.z1 + 260) o.z = nz;
          if (o.zone.corner && o.z > o.zone.corner.zc - 2) o.ghost = true;   // seguiu reto pela avenida
          if (o.tx !== undefined) o.x = U.damp(o.x, o.tx, 2.5, dt);   // abrindo caminho (buzina)
        }
        if (o.cross) {
          const R = this.road(o.z) + 0.5;
          o.x += o.cross * (o.type === 'dogx' ? 2.2 : 1.2) * (o.flee ? 3 : 1) * dt;
          if (o.flee) { if (Math.abs(o.x) > R + 1.2) { o.cross = 0; o.x = Math.sign(o.x) * (R + 1.2); } }
          else if (Math.abs(o.x) > R) { o.x = U.clamp(o.x, -R, R); o.cross *= -1; }
        }
      }
    }

    // ---------------- céu e cenário de fundo ----------------
    drawSky(ctx, cam, t) {
      const hz = cam.horizon + cam.sy, hd = this.heading(cam.z) + (cam.hd || 0) + (cam.yaw || 0) * 1.25;
      const g = ctx.createLinearGradient(0, 0, 0, hz);
      g.addColorStop(0, SKY_TOP); g.addColorStop(1, SKY_BOT);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 2);
      // sol
      const sx = ((820 - hd * 900) % 2400 + 2400) % 2400 - 400;
      const sg = ctx.createRadialGradient(sx, 260, 10, sx, 260, 220);
      sg.addColorStop(0, 'rgba(255,248,215,0.95)'); sg.addColorStop(0.2, 'rgba(255,240,190,0.5)'); sg.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - 220, 40, 440, 440);
      // nuvens com parallax
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 7; i++) {
        const cx = (((i * 337 + t * 6 - hd * 700) % 1700) + 1700) % 1700 - 300, cy = 140 + (i % 3) * 90;
        [[0, 0, 46], [40, -14, 38], [80, 4, 42], [-38, 8, 30]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r * (0.7 + (i % 2) * 0.3), 0, 7); ctx.fill(); });
      }
      // cidade ao longe (prédios baixos) com parallax
      for (let layer = 0; layer < 2; layer++) {
        ctx.fillStyle = layer ? '#9fb7c9' : '#b7cad8';
        const par = layer ? 1100 : 600, base = hz;
        for (let i = -2; i < 26; i++) {
          const bw = 60 + U.hash(i * 3 + layer) * 70, x = (((i * 90 - hd * par) % 2340) + 2340) % 2340 - 300;
          const bh = (layer ? 50 : 90) + U.hash(i * 7 + layer * 13) * (layer ? 60 : 120);
          ctx.fillRect(x, base - bh, bw, bh + 4);
        }
      }
    }

    drawGround(ctx, cam, t) {
      const hz = cam.horizon + cam.sy;
      ctx.fillStyle = '#8a9aa6'; ctx.fillRect(0, hz, W, H - hz);
      const zNear = cam.z + 0.4, zEnd = Math.min(this.length + 60, cam.z + 240);
      const zs = [zNear]; let z = zNear;
      while (z < zEnd) { const dz = z - cam.z, st = dz < 40 ? 1 : dz < 100 ? 2 : 4; z = (Math.floor(z / st) + 1) * st; zs.push(Math.min(z, zEnd)); }
      for (let i = zs.length - 1; i > 0; i--) this._segment(ctx, cam, zs[i - 1], zs[i], t);
    }

    _segment(ctx, cam, zn, zf, t) {
      const P = (x, y, z) => this.proj(cam, x, y, z);
      const zm = (zn + zf) / 2, dz = zm - cam.z, K = this.nextCorner, L = this.lastCorner, F = (c) => this._fog(c, dz);
      if (K && zm >= K.zc && zm < K.zc + K.cw) return this._junction(ctx, cam, zn, zf, zm, K, F, true);
      if (L && zm >= L.zc && zm < L.zc + L.cw) return this._junction(ctx, cam, zn, zf, zm, L, F, false);
      if (K && K.dir < 0 && zm >= K.zc + K.cw) { this._tFar(ctx, cam, zn, zf, zm, K, F); return; }
      const vt = this.viewType(zm), zone = { type: vt || this.zoneAt(zm).type }, Z = ZONE[zone.type], R = Z.road, SW = Z.side, FX = R + SW;
      if (K && K.dir > 0 && zf > K.zc + K.cw + 2.3 && zn <= K.zc + K.cw + 2.3) this._afterSeg = () => this._crossFacade(ctx, cam, K, F);
      const idx = Math.floor(zm);
      // asfalto
      this._quad(ctx, P(-R, 0, zn), P(R, 0, zn), P(R, 0, zf), P(-R, 0, zf), F(idx % 2 ? '#4a4d55' : '#474a52'));
      // faixas
      if (zone.type === 'av') {
        if (Math.floor(zm / 3) % 2 === 0) [-1.8, 1.8].forEach((lx) => this._quad(ctx, P(lx - 0.07, 0, zn), P(lx + 0.07, 0, zn), P(lx + 0.07, 0, zf), P(lx - 0.07, 0, zf), F('#f1f1f1')));
        [-R + 0.25, R - 0.25].forEach((lx) => this._quad(ctx, P(lx - 0.06, 0, zn), P(lx + 0.06, 0, zn), P(lx + 0.06, 0, zf), P(lx - 0.06, 0, zf), F('#e9e9e9')));
      } else if (Math.floor(zm / 2.5) % 2 === 0) this._quad(ctx, P(-0.06, 0, zn), P(0.06, 0, zn), P(0.06, 0, zf), P(-0.06, 0, zf), F('#f2c94c'));
      // faixa de pedestre perto das curvas
      for (const cv of this.curves) if (zm > cv.z0 - 6 && zm < cv.z0 - 2) for (let x = -R + 0.4; x < R - 0.4; x += 0.9) this._quad(ctx, P(x, 0, zn), P(x + 0.5, 0, zn), P(x + 0.5, 0, zf), P(x, 0, zf), F('#f4f4f4'));
      for (const side of [-1, 1]) {
        // meio-fio e calçada
        this._quad(ctx, P(side * R, 0, zn), P(side * R, 0.15, zn), P(side * R, 0.15, zf), P(side * R, 0, zf), F('#b8bcc2'));
        this._quad(ctx, P(side * R, 0.15, zn), P(side * FX, 0.15, zn), P(side * FX, 0.15, zf), P(side * R, 0.15, zf), F(idx % 2 ? '#c9c2b5' : '#d3ccbf'));
        const chunk = Math.floor(zm / (zone.type === 'av' ? 12 : 13)) + (side > 0 ? 700 : 0);
        if (zone.type === 'av') this._shop(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F);
        else this._house(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F);
        // esquina à direita: a rua lateral corta a calçada
      }
      if (this._afterSeg) { const f = this._afterSeg; this._afterSeg = null; f(); }
    }

    // cruzamento: antes de virar (pre) a rua lateral se abre do lado da seta; depois, é a via que ficou para trás
    _junction(ctx, cam, zn, zf, zm, C, F, pre) {
      const P = (x, y, z) => this.proj(cam, x, y, z), BIG = 90;
      const from = C.dir > 0 ? ZONE.av : ZONE.rua, R = from.road, FX = R + from.side;
      const both = !pre || C.dir < 0;          // "T" com a avenida, ou a via de onde viemos: asfalto dos dois lados
      const xl = both || C.dir < 0 ? -BIG : -R, xr = both || C.dir > 0 ? BIG : R;
      this._quad(ctx, P(xl, 0, zn), P(xr, 0, zn), P(xr, 0, zf), P(xl, 0, zf), F('#4a4d55'));
      // faixas pintadas da via que cruza (no sentido do x)
      const mid = C.zc + C.cw / 2, lines = C.dir > 0 ? [[mid, '#f2c94c']] : [[mid - 1.8, '#f1f1f1'], [mid + 1.8, '#f1f1f1']];
      for (const [lz, col] of lines) if (lz >= zn && lz < zf + 0.2) for (let x = (C.dir > 0 && pre ? R + 1 : -BIG); x < BIG; x += 3) this._quad(ctx, P(x, 0.01, lz - 0.07), P(x + 1.5, 0.01, lz - 0.07), P(x + 1.5, 0.01, lz + 0.07), P(x, 0.01, lz + 0.07), F(col));
      if (pre && C.dir > 0) {
        // lado esquerdo continua com calçada e lojas da avenida
        this._quad(ctx, P(-R, 0, zn), P(-R, 0.15, zn), P(-R, 0.15, zf), P(-R, 0, zf), F('#b8bcc2'));
        this._quad(ctx, P(-R, 0.15, zn), P(-FX, 0.15, zn), P(-FX, 0.15, zf), P(-R, 0.15, zf), F('#d3ccbf'));
        this._shop(ctx, P, cam, zn, zf, zm, zm - cam.z, -1, FX, Math.floor(zm / 12), F);
      }
    }
    // fachada das casas do outro lado da rua lateral (de frente para a câmera)
    _crossFacade(ctx, cam, K, F) {
      const P = (x, y, z) => this.proj(cam, x, y, z), z0 = K.zc + K.cw, z1 = z0 + 2.3, R = ZONE.av.road, FX = R + ZONE.av.side;
      this._quad(ctx, P(R, 0.15, z0), P(90, 0.15, z0), P(90, 0.15, z1), P(R, 0.15, z1), F('#d3ccbf'));
      this._quad(ctx, P(R, 0, z0), P(90, 0, z0), P(90, 0.15, z0), P(R, 0.15, z0), F('#b8bcc2'));
      for (let x = FX, i = 0; x < 90; x += 7, i++) {
        const h = 4 + U.hash(i + K.zc) * 2.2, col = WALLS[Math.floor(U.hash(i * 3 + K.zc) * WALLS.length)];
        this._quad(ctx, P(x, 0.15, z1), P(x + 7, 0.15, z1), P(x + 7, h, z1), P(x, h, z1), F(col));
        this._quad(ctx, P(x, h, z1), P(x + 7, h, z1), P(x + 7, h + 1.2, z1 + 1.4), P(x, h + 1.2, z1 + 1.4), F('#b5523b'));
        this._quad(ctx, P(x + 1.2, 1.2, z1 - 0.01), P(x + 2.6, 1.2, z1 - 0.01), P(x + 2.6, 2.6, z1 - 0.01), P(x + 1.2, 2.6, z1 - 0.01), F('#5d7a8c'));
        this._quad(ctx, P(x + 4, 0.15, z1 - 0.01), P(x + 5.4, 0.15, z1 - 0.01), P(x + 5.4, 2.4, z1 - 0.01), P(x + 4, 2.4, z1 - 0.01), F('#6b4a2f'));
      }
      // placa da rua na esquina
      const b = P(R + 0.6, 0.15, z0 + 0.3), tp = P(R + 0.6, 3.2, z0 + 0.3);
      if (b && tp) {
        ctx.strokeStyle = F('#4b5563'); ctx.lineWidth = Math.max(1, b.s * 0.08); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
      }
    }
    // fim da rua: do outro lado da avenida, uma fileira de lojas de frente
    _tFar(ctx, cam, zn, zf, zm, K, F) {
      const P = (x, y, z) => this.proj(cam, x, y, z), z0 = K.zc + K.cw, z1 = z0 + 3;
      if (zn > z1 + 0.5) return;
      if (zn <= z1 && zf > z0) {
        this._quad(ctx, P(-120, 0, z0), P(120, 0, z0), P(120, 0.15, z0), P(-120, 0.15, z0), F('#b8bcc2'));
        this._quad(ctx, P(-120, 0.15, z0), P(120, 0.15, z0), P(120, 0.15, z1), P(-120, 0.15, z1), F('#d3ccbf'));
      }
      if (zf > z1 && zn <= z1 + 0.5) {
        for (let x = -120, i = 0; x < 120; x += 9, i++) {
          const shop = SHOPS[Math.floor(U.hash(i + K.zc * 0.37) * SHOPS.length)], h = 4.5 + U.hash(i * 5 + K.zc) * 3;
          const wall = ['#efe6d8', '#e8d5b7', '#d9e4dd', '#f2d0a4', '#e5e5e5', '#cfd8e3'][Math.floor(U.hash(i * 7 + K.zc) * 6)];
          this._quad(ctx, P(x, 0.15, z1), P(x + 9, 0.15, z1), P(x + 9, h, z1), P(x, h, z1), F(wall));
          this._quad(ctx, P(x + 0.8, 0.25, z1 - 0.01), P(x + 8.2, 0.25, z1 - 0.01), P(x + 8.2, 2.5, z1 - 0.01), P(x + 0.8, 2.5, z1 - 0.01), F('#3e5566'));
          this._quad(ctx, P(x + 0.5, 2.6, z1 - 0.02), P(x + 8.5, 2.6, z1 - 0.02), P(x + 8.5, 2.9, z1 - 0.9), P(x + 0.5, 2.9, z1 - 0.9), F(shop[1]));
          const a = P(x + 1.5, 3.9, z1 - 0.03), b = P(x + 7.5, 3.1, z1 - 0.03);
          if (a && b) {
            ctx.fillStyle = F(shop[1]); ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
            const hh = b.y - a.y; if (hh > 7) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(Math.min(hh * 0.7, (b.x - a.x) / shop[0].length * 1.7))}px ${U.FONT_TITLE}`; ctx.fillText(shop[0], (a.x + b.x) / 2, a.y + hh * 0.55); ctx.textBaseline = 'alphabetic'; }
          }
        }
      }
    }

    _shop(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F) {
      const h = 4.2 + U.hash(chunk) * 4.5, shop = SHOPS[Math.floor(U.hash(chunk + 0.3) * SHOPS.length)];
      const wall = ['#efe6d8', '#e8d5b7', '#d9e4dd', '#f2d0a4', '#e5e5e5', '#cfd8e3'][Math.floor(U.hash(chunk + 0.7) * 6)];
      const x = side * FX;
      this._quad(ctx, P(x, 0.15, zn), P(x, h, zn), P(x, h, zf), P(x, 0.15, zf), F(wall));
      // vitrine (vidro escuro) com porta aberta
      const local = zm - Math.floor(zm / 12) * 12;
      const glass = local > 1 && local < 11;
      if (glass) this._quad(ctx, P(x, 0.25, zn), P(x, 2.5, zn), P(x, 2.5, zf), P(x, 0.25, zf), F(local > 5 && local < 7 ? '#3b3226' : '#3e5566'));
      // toldo na cor da loja
      this._quad(ctx, P(x, 2.6, zn), P(x - side * 0.9, 2.9, zn), P(x - side * 0.9, 2.9, zf), P(x, 2.6, zf), F(Math.floor(zm) % 2 ? shop[1] : '#ffffff'));
      // janelas do andar de cima
      if (h > 6 && dz < 140 && Math.floor(zm) % 3 === 1) this._quad(ctx, P(x, 4.3, zn), P(x, 5.6, zn), P(x, 5.6, zf), P(x, 4.3, zf), F('#6c8aa0'));
      // platibanda
      this._quad(ctx, P(x, h - 0.3, zn), P(x, h, zn), P(x, h, zf), P(x, h - 0.3, zf), F(shop[1]));
    }

    _house(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F) {
      const stop = side > 0 && this.stops.find((s) => Math.abs(zm - s.z) < 6.5);
      const col = stop ? '#ffffff' : WALLS[Math.floor(U.hash(chunk) * WALLS.length)];
      const hx = side * (FX + 3.2), wx = side * FX, hh = 4.4 + U.hash(chunk + 2) * 1.2;
      // casa recuada (fachada + telhado)
      this._quad(ctx, P(hx, 0.15, zn), P(hx, hh, zn), P(hx, hh, zf), P(hx, 0.15, zf), F(U.mix(col, '#ffffff', 0.35).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, a, b, c) => '#' + [a, b, c].map((v) => (+v).toString(16).padStart(2, '0')).join(''))));
      this._quad(ctx, P(hx, hh, zn), P(hx - side * 1.6, hh + 1.3, zn), P(hx - side * 1.6, hh + 1.3, zf), P(hx, hh, zf), F('#b5523b'));
      const local = zm - Math.floor(zm / 13) * 13;
      if (dz < 150 && (Math.floor(local) === 3 || Math.floor(local) === 9)) this._quad(ctx, P(hx, 2.2, zn), P(hx, 3.5, zn), P(hx, 3.5, zf), P(hx, 2.2, zf), F('#5d7a8c'));
      // muro com portão
      const gate = local > 5 && local < 8.5;
      this._quad(ctx, P(wx, 0.15, zn), P(wx, 1.9, zn), P(wx, 1.9, zf), P(wx, 0.15, zf), F(gate ? (stop ? '#2f855a' : '#3d4451') : col));
      if (!gate) this._quad(ctx, P(wx, 1.75, zn), P(wx, 1.95, zn), P(wx, 1.95, zf), P(wx, 1.75, zf), F('#f4f1ea'));
      // jardim entre o muro e a casa
      this._quad(ctx, P(wx, 0.16, zn), P(hx, 0.16, zn), P(hx, 0.16, zf), P(wx, 0.16, zf), F('#7cb26a'));
    }

    // ---------------- sprites ----------------
    collect(cam, t) {
      const L = [], vis = (z, o) => z - cam.z > 0.6 && z - cam.z < 230 && this.visibleZ(z, o);
      for (const p of this.props) if (vis(p.z)) L.push({ z: p.z, draw: (c) => this._prop(c, cam, p, t) });
      for (const s of this.signs) if (vis(s.z)) L.push({ z: s.z, draw: (c) => this._streetSign(c, cam, s) });
      for (const o of this.obstacles) if (vis(o.z, o)) L.push({ z: o.z, draw: (c) => this._ob(c, cam, o, t) });
      this.stops.forEach((s, i) => { if (vis(s.z) && !s.done) L.push({ z: s.z + 0.5, draw: (c) => this._pin(c, cam, s, t) }); });
      // placas das lojas (perpendiculares, de frente para a câmera)
      for (let z = Math.floor(cam.z / 12) * 12 + 12; z < cam.z + 160; z += 12) {
        if (this.viewType(z) !== 'av' || this.curves.some((c) => z > c.z0 - 4 && z < c.z1 + 4)) continue;
        for (const side of [-1, 1]) {
          const chunk = Math.floor(z / 12) + (side > 0 ? 700 : 0);
          if (U.hash(chunk * 1.9) < 0.35) continue;
          const zz = z + 2;
          L.push({ z: zz, draw: (c) => this._blade(c, cam, zz, side, SHOPS[Math.floor(U.hash(Math.floor(zz / 12) + (side > 0 ? 700 : 0) + 0.3) * SHOPS.length)]) });
        }
      }
      return L;
    }

    _blade(ctx, cam, z, side, shop) {
      const FX = ZONE.av.road + ZONE.av.side;
      const a = this.proj(cam, side * (FX - 1.6), 3.9, z), b = this.proj(cam, side * (FX - 0.1), 3.2, z);
      if (!a || !b) return;
      const x0 = Math.min(a.x, b.x), w = Math.abs(b.x - a.x), h = b.y - a.y;
      if (w < 4) return;
      ctx.save(); ctx.globalAlpha = 1 - this.fogT(a.dz) * 0.7;
      U.roundRect(ctx, x0, a.y, w, h, h * 0.15); ctx.fillStyle = shop[1]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, h * 0.06); ctx.stroke();
      if (h > 8) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(Math.min(h * 0.62, w / shop[0].length * 1.7))}px ${U.FONT_TITLE}`; ctx.fillText(shop[0], x0 + w / 2, a.y + h * 0.56); ctx.textBaseline = 'alphabetic'; }
      ctx.restore();
    }

    _streetSign(ctx, cam, s) {
      const R = ZONE.av.road + 0.6;
      const base = this.proj(cam, R, 0.15, s.z), top = this.proj(cam, R, 3.3, s.z);
      if (!base || !top) return;
      const sc = base.s;
      ctx.strokeStyle = this._fog('#4b5563', base.dz); ctx.lineWidth = Math.max(1, sc * 0.08);
      ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke();
      const w = sc * 2.1, h = sc * 0.5;
      ctx.fillStyle = '#1f6b3a'; U.roundRect(ctx, top.x - w * 0.15, top.y - h, w, h, h * 0.15); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, h * 0.06); ctx.stroke();
      if (h > 8) { ctx.fillStyle = '#fff'; ctx.font = `${Math.round(h * 0.55)}px ${U.FONT_TITLE}`; ctx.textAlign = 'center'; ctx.fillText(s.name, top.x - w * 0.15 + w / 2, top.y - h * 0.3); }
    }

    _pin(ctx, cam, s, t) {
      const R = ZONE.rua.road + ZONE.rua.side;
      const p = this.proj(cam, R + 1.5, 5.6 + Math.sin(t * 3) * 0.2, s.z);
      if (!p) return;
      const r = Math.max(8, p.s * 0.55);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = r * 0.4;
      ctx.fillStyle = '#fe2c55';
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(0, r * 1.9); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, 7); ctx.fill();
      ctx.fillStyle = '#fe2c55'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(r * 0.75)}px ${U.FONT_TITLE}`; ctx.fillText(String(s.num), 0, r * 0.06);
      if (r > 22) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(r * 0.32)}px ${U.FONT_UI}`; ctx.fillText('ENTREGA', 0, -r * 1.25); }
      ctx.restore(); ctx.textBaseline = 'alphabetic';
    }

    _prop(ctx, cam, p, t) {
      const zone = this.zoneAt(p.z), R = ZONE[zone.type].road, x = p.side * (R + 0.7);
      const b = this.proj(cam, x, 0.15, p.z); if (!b) return;
      const s = b.s, dz = b.dz, F = (c) => this._fog(c, dz);
      if (p.kind === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(b.x, b.y, s * 1.1, s * 0.25, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = F('#6b4a2f'); ctx.lineWidth = s * 0.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + s * 0.1, b.y - s * 2.6); ctx.stroke();
        const sway = Math.sin(t * 0.9 + p.seed * 9) * s * 0.06;
        [[0, -3.6, 1.35, '#3f8f3a'], [-0.85, -3.0, 0.95, '#4fa64a'], [0.85, -3.1, 1.0, '#3a8436'], [0.1, -4.4, 0.95, '#5cb85c']].forEach(([dx, dy, r, c]) => {
          ctx.fillStyle = F(c); ctx.beginPath(); ctx.arc(b.x + dx * s + sway, b.y + dy * s, r * s, 0, 7); ctx.fill();
        });
      } else {
        const top = this.proj(cam, x, 6.5, p.z), arm = this.proj(cam, x - p.side * 1.8, 6.3, p.z); if (!top || !arm) return;
        ctx.strokeStyle = F('#6b7280'); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, s * 0.13);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(top.x, top.y); ctx.lineTo(arm.x, arm.y); ctx.stroke();
        ctx.fillStyle = F('#374151'); ctx.beginPath(); ctx.ellipse(arm.x, arm.y + s * 0.05, s * 0.32, s * 0.1, 0, 0, 7); ctx.fill();
      }
    }

    // carro visto de trás (estacionado ou no trânsito)
    static carRear(ctx, x, y, s, color, F, brake) {
      const w = 1.75 * s;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.62, s * 0.16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#16171a'; ctx.fillRect(-w * 0.46, -s * 0.34, w * 0.16, s * 0.34); ctx.fillRect(w * 0.3, -s * 0.34, w * 0.16, s * 0.34);
      ctx.fillStyle = F(color); U.roundRect(ctx, -w / 2, -s * 1.0, w, s * 0.72, s * 0.12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w * 0.42, -s * 0.98); ctx.lineTo(-w * 0.32, -s * 1.42); ctx.lineTo(w * 0.32, -s * 1.42); ctx.lineTo(w * 0.42, -s * 0.98); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F('#25323d'); ctx.beginPath(); ctx.moveTo(-w * 0.36, -s * 1.02); ctx.lineTo(-w * 0.29, -s * 1.36); ctx.lineTo(w * 0.29, -s * 1.36); ctx.lineTo(w * 0.36, -s * 1.02); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-w * 0.25, -s * 1.3, w * 0.12, s * 0.22);
      ctx.fillStyle = brake ? '#ff2a2a' : '#b91c1c'; ctx.fillRect(-w * 0.48, -s * 0.84, w * 0.17, s * 0.13); ctx.fillRect(w * 0.31, -s * 0.84, w * 0.17, s * 0.13);
      if (brake) { ctx.fillStyle = 'rgba(255,60,60,0.35)'; ctx.beginPath(); ctx.arc(-w * 0.4, -s * 0.78, s * 0.25, 0, 7); ctx.arc(w * 0.4, -s * 0.78, s * 0.25, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#f5f5f5'; ctx.fillRect(-w * 0.13, -s * 0.62, w * 0.26, s * 0.14);
      ctx.fillStyle = F('#2b2d31'); ctx.fillRect(-w / 2, -s * 0.4, w, s * 0.1);
      ctx.restore();
    }

    static busRear(ctx, x, y, s, color, line, F, brake) {
      const w = 2.5 * s, h = 3.1 * s;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.6, s * 0.2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#16171a'; ctx.fillRect(-w * 0.44, -s * 0.38, w * 0.14, s * 0.38); ctx.fillRect(w * 0.3, -s * 0.38, w * 0.14, s * 0.38);
      ctx.fillStyle = F('#f1f1ee'); U.roundRect(ctx, -w / 2, -h, w, h - s * 0.25, s * 0.12); ctx.fill();
      ctx.fillStyle = F(color); ctx.fillRect(-w / 2, -h * 0.42, w, h * 0.16); ctx.fillRect(-w / 2, -h + s * 0.05, w, s * 0.22);
      ctx.fillStyle = F('#22303a'); U.roundRect(ctx, -w * 0.42, -h * 0.86, w * 0.84, h * 0.36, s * 0.06); ctx.fill();   // vidro traseiro
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-w * 0.3, -h * 0.84, w * 0.1, h * 0.3);
      ctx.fillStyle = '#111'; U.roundRect(ctx, -w * 0.32, -h * 0.98, w * 0.64, s * 0.22, s * 0.04); ctx.fill();         // letreiro
      if (s > 18) { ctx.fillStyle = '#ffb703'; ctx.font = `${Math.round(s * 0.17)}px ${U.FONT_TITLE}`; ctx.textAlign = 'center'; ctx.fillText(`${line} CENTRO`, 0, -h * 0.98 + s * 0.17); }
      ctx.fillStyle = brake ? '#ff2a2a' : '#b91c1c'; ctx.fillRect(-w * 0.48, -h * 0.4, w * 0.1, s * 0.4); ctx.fillRect(w * 0.38, -h * 0.4, w * 0.1, s * 0.4);
      ctx.fillStyle = '#f5f5f5'; ctx.fillRect(-w * 0.1, -s * 0.62, w * 0.2, s * 0.14);
      ctx.fillStyle = F('#2b2d31'); ctx.fillRect(-w / 2, -s * 0.42, w, s * 0.14);
      if (s > 30) { ctx.fillStyle = F('#333'); ctx.font = `800 ${Math.round(s * 0.12)}px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('CUIDADO, SAÍDA DE PASSAGEIROS', 0, -h * 0.47); }
      ctx.restore();
    }

    static carFront(ctx, x, y, s, color, F, t) {
      const w = 1.75 * s;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.62, s * 0.16, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#16171a'; ctx.fillRect(-w * 0.46, -s * 0.34, w * 0.16, s * 0.34); ctx.fillRect(w * 0.3, -s * 0.34, w * 0.16, s * 0.34);
      ctx.fillStyle = F(color); U.roundRect(ctx, -w / 2, -s * 0.95, w, s * 0.67, s * 0.12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w * 0.42, -s * 0.93); ctx.lineTo(-w * 0.3, -s * 1.38); ctx.lineTo(w * 0.3, -s * 1.38); ctx.lineTo(w * 0.42, -s * 0.93); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F('#3b5566'); ctx.beginPath(); ctx.moveTo(-w * 0.37, -s * 0.97); ctx.lineTo(-w * 0.27, -s * 1.33); ctx.lineTo(w * 0.27, -s * 1.33); ctx.lineTo(w * 0.37, -s * 0.97); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F('#c98c64'); ctx.beginPath(); ctx.arc(-w * 0.14, -s * 1.13, s * 0.09, 0, 7); ctx.fill();          // motorista
      ctx.fillStyle = F('#1f2328'); ctx.fillRect(-w * 0.22, -s * 0.66, w * 0.44, s * 0.16);                              // grade
      ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.ellipse(-w * 0.38, -s * 0.68, w * 0.08, s * 0.07, 0, 0, 7); ctx.ellipse(w * 0.38, -s * 0.68, w * 0.08, s * 0.07, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,210,0.25)'; ctx.beginPath(); ctx.arc(-w * 0.38, -s * 0.68, s * 0.3, 0, 7); ctx.arc(w * 0.38, -s * 0.68, s * 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#f5f5f5'; ctx.fillRect(-w * 0.13, -s * 0.46, w * 0.26, s * 0.12);
      ctx.restore();
    }

    _person(ctx, x, y, s, t, o, F) {
      const sw = Math.sin(t * 9 + o.seed * 7) * 0.35;
      ctx.save(); ctx.translate(x, y); ctx.scale(o.cross < 0 ? -1 : 1, 1);
      ctx.strokeStyle = F('#2d3748'); ctx.lineWidth = s * 0.11; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, -s * 0.85); ctx.lineTo(s * sw * 0.5, 0); ctx.moveTo(0, -s * 0.85); ctx.lineTo(-s * sw * 0.5, 0); ctx.stroke();
      ctx.fillStyle = F(['#e63946', '#2a9d8f', '#f4a261', '#7b2cbf'][Math.floor(o.seed * 4)]); U.roundRect(ctx, -s * 0.17, -s * 1.5, s * 0.34, s * 0.7, s * 0.1); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = s * 0.08;
      ctx.beginPath(); ctx.moveTo(0, -s * 1.38); ctx.lineTo(-s * sw * 0.4, -s * 0.95); ctx.stroke();
      ctx.fillStyle = F('#c98c64'); ctx.beginPath(); ctx.arc(s * 0.02, -s * 1.66, s * 0.13, 0, 7); ctx.fill();
      // celular na mão (atravessando distraído)
      ctx.fillStyle = '#111'; ctx.fillRect(s * 0.12, -s * 1.25, s * 0.07, s * 0.12);
      ctx.restore();
    }

    _dogSide(ctx, x, y, s, t, dir, F) {
      const run = Math.sin(t * 16);
      ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
      ctx.strokeStyle = F('#b77a3c'); ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
      [[-0.22, run], [0.22, -run]].forEach(([lx, a]) => { ctx.beginPath(); ctx.moveTo(lx * s, -s * 0.25); ctx.lineTo((lx + a * 0.1) * s, 0); ctx.stroke(); });
      ctx.fillStyle = F('#c88a46'); ctx.beginPath(); ctx.ellipse(0, -s * 0.32, s * 0.32, s * 0.12, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.34, -s * 0.44, s * 0.12, s * 0.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = F('#94602c'); ctx.beginPath(); ctx.ellipse(s * 0.3, -s * 0.5, s * 0.04, s * 0.08, -0.5, 0, 7); ctx.fill();
      ctx.strokeStyle = F('#c88a46'); ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.36); ctx.lineTo(-s * 0.42, -s * (0.5 + 0.06 * run)); ctx.stroke();
      ctx.restore();
    }

    _ob(ctx, cam, o, t) {
      const p = this.proj(cam, o.x, 0, o.z); if (!p) return;
      const s = p.s, dz = p.dz, k = U.clamp(cam.y / dz, 0.04, 0.55), F = (c) => this._fog(c, dz);
      const R = this.road(o.z);
      switch (o.type) {
        case 'hole': {
          const rx = 0.6 * s, ry = rx * k;
          ctx.fillStyle = F('#3b3d42'); ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * 1.15, ry * 1.2, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#121214'; ctx.beginPath(); ctx.ellipse(p.x, p.y + ry * 0.1, rx, ry, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(130,170,210,0.35)'; ctx.beginPath(); ctx.ellipse(p.x - rx * 0.2, p.y + ry * 0.3, rx * 0.45, ry * 0.25, 0, 0, 7); ctx.fill();
          break;
        }
        case 'cone': {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(o.knock * 1.3 * (o.kdir || 1));
          const hh = 0.7 * s, bw = 0.4 * s;
          ctx.fillStyle = '#222'; ctx.fillRect(-bw / 2, -s * 0.04, bw, s * 0.04);
          ctx.fillStyle = F('#ff7a1a'); ctx.beginPath(); ctx.moveTo(-bw * 0.42, -s * 0.04); ctx.lineTo(bw * 0.42, -s * 0.04); ctx.lineTo(s * 0.03, -hh); ctx.lineTo(-s * 0.03, -hh); ctx.closePath(); ctx.fill();
          ctx.fillStyle = F('#f5f5f5'); ctx.fillRect(-bw * 0.27, -hh * 0.58, bw * 0.54, hh * 0.13);
          ctx.restore(); break;
        }
        case 'bump': {
          const a = this.proj(cam, -R, 0, o.z - 0.4), b = this.proj(cam, R, 0, o.z - 0.4), c = this.proj(cam, R, 0.12, o.z), d = this.proj(cam, -R, 0.12, o.z), e = this.proj(cam, R, 0, o.z + 0.4), f = this.proj(cam, -R, 0, o.z + 0.4);
          this._quad(ctx, d, c, e, f, F('#6b6b6b')); this._quad(ctx, a, b, c, d, F('#7a7a7a'));
          if (a && b && c && d) for (let i = 0; i < 8; i += 2) this._quad(ctx, { x: U.lerp(a.x, b.x, i / 8), y: U.lerp(a.y, b.y, i / 8) }, { x: U.lerp(a.x, b.x, (i + 1) / 8), y: U.lerp(a.y, b.y, (i + 1) / 8) },
            { x: U.lerp(d.x, c.x, (i + 1) / 8), y: U.lerp(d.y, c.y, (i + 1) / 8) }, { x: U.lerp(d.x, c.x, i / 8), y: U.lerp(d.y, c.y, i / 8) }, F('#f2c94c'));
          break;
        }
        case 'puddle': {
          ctx.fillStyle = 'rgba(120,160,200,0.45)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.85 * s, 0.85 * s * k, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(p.x - 0.2 * s, p.y - 0.05 * s * k, 0.3 * s, 0.08 * s * k + 0.5, 0, 0, 7); ctx.fill();
          break;
        }
        case 'parked': case 'traffic':
          City.carRear(ctx, p.x, p.y, s, o.color, F, o.type === 'traffic' && Math.sin(t * 2 + o.seed * 9) > 0.6);
          break;
        case 'bus': City.busRear(ctx, p.x, p.y, s, o.bus, o.line, F, Math.sin(t * 1.5 + o.seed * 9) > 0.5); break;
        case 'oncoming': City.carFront(ctx, p.x, p.y, s, o.color, F, t); break;
        case 'dumpster': {
          const w = 1.6 * s, h = 1.0 * s;
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, w * 0.6, s * 0.12, 0, 0, 7); ctx.fill();
          ctx.fillStyle = F('#f59e0b'); ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y - h); ctx.lineTo(p.x + w / 2, p.y - h); ctx.lineTo(p.x + w * 0.42, p.y); ctx.lineTo(p.x - w * 0.42, p.y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = F('#8b8b8b'); [[-0.3, 0.25], [0.05, 0.3], [0.3, 0.2]].forEach(([dx, r]) => { ctx.beginPath(); ctx.arc(p.x + dx * w, p.y - h, r * s, Math.PI, 0); ctx.fill(); });
          ctx.fillStyle = F('#7c4a1e'); ctx.fillRect(p.x - w * 0.1, p.y - h - 0.35 * s, 0.08 * s, 0.4 * s);
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(p.x - w * 0.42, p.y - h * 0.55, w * 0.84, h * 0.08);
          break;
        }
        case 'ped': this._person(ctx, p.x, p.y, s, t, o, F); break;
        case 'dogx': this._dogSide(ctx, p.x, p.y, s, t, o.cross, F); break;
      }
    }
  }

  City.ZONE = ZONE; City.OB = OB; City.CARS = CARS;
  CNB.City = City; CNB.W = W; CNB.H = H;
})();
