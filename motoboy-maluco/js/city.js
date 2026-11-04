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
      // cada rodada sorteia o caminho: vira à direita ou à esquerda, bairro de lojas, centro ou orla;
      // rua de casas, de prédios ou vila; e a casa do cliente pode ficar de qualquer lado
      const AVT = ['comercio', 'centro', 'orla'], RUT = ['casas', 'predios', 'vila'];
      const pick = (arr, prev) => { let v; do { v = arr[Math.floor(r() * arr.length)]; } while (v === prev && r() < 0.8); return v; };
      const ctl = () => ({ ctl: r() < 0.38 ? 'police' : 'light', sig: r() < 0.5 ? 'g' : 'r', sigT: r() * 6, cross: [], crossT: 0, turned: false });
      let z = 0, avT = null, ruT = null;
      // SAÍDA DO GALPÃO: pátio da empresa até o portão, depois vira na avenida
      {
        const zc0 = City.WH_END + City.YARD, d0 = r() < 0.5 ? 1 : -1;
        const c0 = { zc: zc0, cw: CWA, dir: d0, kind: 'T', name: 'AVENIDA', ctl: 'none', sig: 'g', sigT: 0, cross: [], crossT: 0, turned: false, exit: true };
        this.corners.push(c0); this.curves.push({ z0: zc0, z1: zc0 + CWA, dir: d0 });
        this.zones.push({ type: 'rua', theme: 'patio', z0: 0, z1: zc0 + CWA, stopAt: zc0 - 3, corner: c0 });
        this.maneuvers.push({ z: zc0, type: d0 > 0 ? 'right' : 'left', name: 'AVENIDA' });
        z = zc0 + CWA; this.startZ = z;
      }
      for (let k = 0; k < cfg.deliveries; k++) {
        const A = rr(cfg.avenueLength), zc = z + A, dirS = r() < 0.5 ? 1 : -1;
        const streetName = STREETS[Math.floor(r() * STREETS.length)];
        avT = pick(AVT, avT);
        const cR = Object.assign({ zc, cw: CWR, dir: dirS, kind: 'side', name: streetName }, ctl());
        this.corners.push(cR);
        this.zones.push({ type: 'av', theme: avT, beach: avT === 'orla' ? -dirS : 0, z0: z, z1: zc + CWR, corner: cR, stopAt: Infinity });
        this.curves.push({ z0: zc, z1: zc + CWR, dir: dirS });
        this.maneuvers.push({ z: zc, type: dirS > 0 ? 'right' : 'left', name: streetName });
        this.signs.push({ z: zc - 3, name: streetName, side: dirS });
        const zs = zc + CWR, S = rr(cfg.streetLength), hz = zs + S;
        const num = 10 + Math.floor(r() * 890);
        ruT = pick(RUT, ruT);
        this.stops.push({ z: hz, num, street: streetName, done: false, k, side: r() < 0.62 ? 1 : -1, theme: ruT });
        this.maneuvers.push({ z: hz, type: 'dest', num, name: streetName });
        const last = k === cfg.deliveries - 1;
        const ze = last ? hz + 40 : hz + U.lerp(18, 34, r()), dirT = r() < 0.5 ? 1 : -1;
        const cL = last ? null : Object.assign({ zc: ze, cw: CWA, dir: dirT, kind: 'T', name: 'AVENIDA' }, ctl());
        this.zones.push({ type: 'rua', theme: ruT, z0: zs, z1: last ? ze : ze + CWA, stopAt: last ? ze - 8 : Infinity, corner: cL });
        if (!last) {
          this.corners.push(cL);
          this.curves.push({ z0: ze, z1: ze + CWA, dir: dirT });
          this.maneuvers.push({ z: ze, type: dirT > 0 ? 'right' : 'left', name: 'AVENIDA' });
        }
        z = ze + (last ? 0 : CWA);
      }
      this.length = z;
      this._buildCurve();
      // obstáculos (fora das curvas e longe das casas de entrega)
      this.obstacles = [];
      const freeAt = (zz) => !this.curves.some((c) => zz > c.z0 - 8 && zz < c.z1 + 8) && !this.stops.some((s) => Math.abs(zz - s.z) < 16) && zz > this.startZ + 10;
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
      let tz = this.startZ + 12;   // nada de trânsito dentro do galpão nem no pátio
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
      for (let pz = this.startZ + 6; pz < this.length; pz += 9 + r() * 10) {
        const side = r() < 0.5 ? -1 : 1, zn = this.zoneAt(pz), zt = zn.type;
        if (this.stops.some((st) => st.side === side && Math.abs(st.z - pz) < 12)) continue;   // nada na frente da casa do cliente
        if (zn.beach && side === zn.beach) { this.props.push({ z: pz, side, kind: 'palm', seed: r() }); continue; }
        if (zn.theme === 'centro' && r() < 0.5) continue;
        this.props.push({ z: pz, side, kind: r() < (zt === 'rua' ? (zn.theme === 'vila' ? 0.3 : 0.65) : 0.4) ? 'tree' : 'pole', seed: r() });
      }
      // parados na calçada da casa de entrega: cliente
      this.customers = this.stops.map(() => ({ shirt: WALLS[Math.floor(r() * WALLS.length)], hair: ['#2b1d14', '#5a3a1a', '#d4a24c', '#1b1b1b'][Math.floor(r() * 4)], skin: ['#c98c64', '#8d5a3b', '#e0b08e', '#a86e4b'][Math.floor(r() * 4)], fem: r() < 0.5 }));
    }

    // o que a câmera enxerga: antes de virar, depois da esquina aparece a avenida seguindo reto (ou o "T")
    _done(c) { return c.turned || (this.frame === 'B' && c === this.turnK); }
    get nextCorner() { return this.corners.find((c) => !this._done(c)); }
    get lastCorner() { let l = null; for (const c of this.corners) if (this._done(c)) l = c; return l; }
    viewType(z) {
      const K = this.nextCorner;
      if (K && z >= K.zc + K.cw) return K.kind === 'side' ? 'av' : null;
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
      if (cam.turn) {
        // VIRANDO: câmera girando de verdade; pontos da rua nova (frame B) são levados para o mundo da rua antiga (A)
        const T = cam.turn; let xa = x, za = z;
        if (this.frame === 'B') { xa = T.E + T.dir * (z - T.zs); za = T.pc - T.dir * x; }
        const ex = xa - cam.tx, ez = za - cam.tz, co = Math.cos(cam.tyaw), si = Math.sin(cam.tyaw);
        const fw = ez * co + ex * si; if (fw < 0.05) return null;
        const sc = cam.F / fw;
        return { x: W / 2 + (ex * co - ez * si) * sc + cam.sx, y: cam.horizon + (cam.y - y) * sc + cam.sy, s: sc, dz: fw };
      }
      if (dz < 0.05) return null;
      const s = cam.F / dz;
      const off = this.offset(cam.z, z);
      return { x: W / 2 + (x + off - cam.x) * s + cam.sx, y: cam.horizon + (cam.y - y) * s + cam.sy, s, dz };
    }
    fogT(dz) { return Math.pow(U.clamp((dz - 25) / 230, 0, 1), 0.85) * 0.75; }
    _fog(c, dz) { return U.mix(c, HAZE, this.fogT(dz)); }
    _quad(ctx, a, b, c, d, col) {
      if (!a || !b || !c || !d) return;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    }

    // carro que anda no sentido da câmera depois que ela girou na curva: aparece por trás, não de lado
    static rearNow(cam, dir) { return !!cam.turn && Math.abs(cam.tyaw) > Math.PI / 4 && Math.sign(cam.tyaw) === Math.sign(dir); }
    // fim da curva: os carros que estavam passando/virando na avenida viram trânsito normal da rua nova (vistos por trás)
    adoptTurnTraffic(T, riderZ) {
      const k = T.k, dir = T.dir, map = (x, z) => ({ z: T.zs + dir * (x - T.E), x: dir * (T.pc - z) });
      const add = (x, z, bus, color, v) => {
        const p = map(x, z); if (p.z < riderZ + 8) return;   // colado na moto: some
        const type = bus ? 'bus' : 'traffic';
        this.obstacles.push({ type, z: p.z, x: p.x, x0: p.x, tx: p.x, w: OB[type].w, hit: false, knock: 0, seed: Math.random(), color, v: Math.min(Math.abs(v), bus ? 4 : 6),
          zone: this.zoneAt(p.z), vehicle: true, bus: bus ? color : null, line: 100 + Math.floor(Math.random() * 800) });
      };
      for (const c of k.cross || []) if (Math.sign(c.v) === dir) add(c.x, c.z, c.bus, c.color, c.v);
      k.cross = [];
      for (const o of this.obstacles) if (o.tl && !o.gone && o.zone.corner === k) { o.gone = true; if (o.side === dir) add(o.x, o.z, o.type === 'bus', o.type === 'bus' ? o.bus : o.color, o.v); }
      this.obstacles.sort((a, b) => a.z - b.z);
    }

    // obstáculos que andam
    // semáforo / guarda: verde 8 s, amarelo 1,6 s, vermelho 7 s (para quem vem pela via da moto)
    static SIG = { g: 8, y: 1.6, r: 7 };
    stopLine(K) { return K.zc - 7; }
    update(dt, t) {
      const K0 = this.nextCorner;
      for (const k of this.corners) {
        if (k.turned || k.ctl === 'none') continue;
        k.sigT += dt;
        if (k.sigT > City.SIG[k.sig]) {
          k.sigT = 0; k.sig = k.sig === 'g' ? 'y' : k.sig === 'y' ? 'r' : 'g';
          this.onSignal && k === K0 && this.onSignal(k);
          if (k.sig === 'r') this._crossPeds(k);
        }
        // no vermelho passa carro na avenida (no "T") de um lado para o outro
        if (k.kind === 'T') {
          k.crossT -= dt;
          if (k.sig === 'r' && k.sigT > 1 && k.sigT < City.SIG.r - 1.5 && k.crossT <= 0) {
            const d = k.dir, pc = k.zc + k.cw / 2, lane = [-3.6, 0, 3.6][Math.floor(Math.random() * 3)];   // avenida de mão única
            k.cross.push({ x: -d * 70, z: pc - d * lane, v: d * U.rand(7, 11), color: CARS[Math.floor(Math.random() * CARS.length)], bus: Math.random() < 0.2 });
            k.crossT = U.rand(0.9, 1.8);
          }
          for (const c of k.cross) c.x += c.v * dt;
          k.cross = k.cross.filter((c) => Math.abs(c.x) < 75);
        }
      }
      // trânsito: fila, semáforo e motoboy virando
      const veh = this.obstacles.filter((o) => o.vehicle && !o.hit && !o.gone).sort((a, b) => b.z - a.z);
      for (const a of veh) {
        a.vNow = a.v;
        if (a.v <= 0 || a.tl) continue;
        const K = a.zone.corner;
        if (K && !a.ghost && K.sig !== 'g') {
          const len = a.type === 'bus' ? 5.5 : 2.2, stopZ = this.stopLine(K) - len;
          if (a.z < stopZ + 0.5 && (K.sig === 'r' || stopZ - a.z > 3)) a.vNow = Math.min(a.vNow, Math.max(0, (stopZ - a.z) * 1.3));
        }
        for (const b of veh) {
          if (b === a || b.v <= 0 || b.ghost !== a.ghost && !b.tl || Math.abs(b.x - a.x) > 1.6 || b.z <= a.z) continue;
          const gap = b.type === 'bus' || a.type === 'bus' ? 8 : 5.5, dz = b.z - a.z;
          if (dz < gap + 10) a.vNow = Math.min(a.vNow, Math.max(0, (b.vNow || 0) + (dz - gap) * 1.2));
        }
        // motoboy vai virar logo à frente: o carro de trás espera
        const rz = this.riderZ;
        if (K0 && rz !== undefined && K === K0 && K0.zc - rz < 40 && rz - a.z > -4 && rz - a.z < (a.type === 'bus' ? 16 : 12)) a.vNow = Math.min(a.vNow, Math.max(0, (this.riderV || 0) * 0.85 - 0.5));
      }
      for (const o of this.obstacles) {
        if (o.gone) continue;
        if (o.vehicle && !o.hit) {
          const K = o.zone.corner;
          if (o.tl) {
            // virando à esquerda na avenida (sai do "T")
            const lz = K.zc + K.cw / 2 - K.dir * 1.8, kd = K.dir;
            if (o.z < lz) { o.z = Math.min(lz, o.z + o.v * dt); o.x += kd * o.v * 0.35 * dt; o.side = 0; }
            else { o.x += kd * Math.max(4, o.v * 1.4) * dt; o.side = kd; }
            if (Math.abs(o.x) > 70) o.gone = true;
            continue;
          }
          const nz = o.z + (o.vNow !== undefined ? o.vNow : o.v) * dt;
          if (nz > o.zone.z0 + 2 && nz < o.zone.stopAt && nz < o.zone.z1 + 260) o.z = nz;
          if (K && o.v > 0 && o.z > K.zc - 2) { o.ghost = true; if (K.kind === 'T') o.tl = true; }   // avenida: segue reto; rua: vira à esquerda
          if (o.tx !== undefined && !o.tl) o.x = U.damp(o.x, o.tx, 2.5, dt);   // abrindo caminho (buzina)
        }
        if (o.cross) {
          const R = this.road(o.z) + 0.5;
          o.x += o.cross * (o.type === 'dogx' ? 2.2 : 1.2) * (o.flee ? 3 : 1) * dt;
          if (o.once) { if (Math.abs(o.x) > R + 0.6 && Math.sign(o.x) === o.cross) { o.gone = true; o.hit = true; o.passed = true; } }
          else if (o.flee) { if (Math.abs(o.x) > R + 1.2) { o.cross = 0; o.x = Math.sign(o.x) * (R + 1.2); } }
          else if (Math.abs(o.x) > R) { o.x = U.clamp(o.x, -R, R); o.cross *= -1; }
        }
      }
    }
    // pedestres atravessando na faixa quando fecha para a moto
    _crossPeds(k) {
      const R = this.road(k.zc - 3), n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const d = Math.random() < 0.5 ? 1 : -1;
        this.obstacles.push({ type: Math.random() < 0.12 ? 'dogx' : 'ped', z: k.zc - 4 + U.rand(-1, 1), x: -d * (R + 0.4 + i * 0.9), x0: 0, w: 0.8, hit: false, knock: 0, seed: Math.random(), cross: d, once: true });
      }
      this.obstacles.sort((a, b) => a.z - b.z);
    }

    // ---------------- céu e cenário de fundo ----------------
    drawSky(ctx, cam, t) {
      const hz = cam.horizon + cam.sy, hd = this.heading(cam.z) + (cam.hd || 0) + (cam.turn ? cam.tyaw * 1.25 : 0);
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

    // part: 'all' (normal) | 'ground' | 'walls' (na virada o chão é desenhado antes de tudo e as paredes por lado)
    // desenho durante a curva: as duas vias (a de onde vem e a nova), chão primeiro, depois prédios e objetos por distância
    drawTurn(ctx, cam, t, extras) {
      const T = cam.turn, K = T.k; this.turnK = K;
      const hz = cam.horizon + cam.sy;
      ctx.fillStyle = '#4a4d55'; ctx.fillRect(0, hz, W, H - hz);
      const items = [], dist = (f, x, z) => { this.frame = f; const p = this.proj(cam, x, 0, z); this.frame = null; return p ? p.dz : -1; };
      const span = (f, z0, z1, czRef) => { const out = []; let z = z0; while (z < z1) { const st = Math.abs(z - czRef) < 40 ? 1 : Math.abs(z - czRef) < 100 ? 2 : 4; out.push([f, z, Math.min(z1, z + st)]); z += st; } return out; };
      const zB = (xa) => T.zs + T.dir * (xa - T.E);       // posição da câmera medida na rua nova
      const segs = span('A', Math.min(cam.tz + 0.4, K.zc - 34), Math.min(K.zc + K.cw + 170, cam.tz + 240), cam.tz).concat(K.zc - cam.tz < 230 ? span('B', K.kind === 'T' ? K.zc - 70 : K.zc, K.zc + K.cw + 170, zB(cam.tx)) : []);
      const setF = (f) => { this.frame = f; cam.z = f === 'A' ? cam.tz : zB(cam.tx); cam.x = f === 'A' ? cam.tx : 0; };
      const sorted = (arr) => arr.filter((i) => i.d > -30).sort((a, b) => b.d - a.d);
      // chão
      const ground = segs.map(([f, zn, zf]) => { setF(f); const pp = this.proj(cam, 0, 0, (zn + zf) / 2); const ex = pp ? pp.dz : -1; return { f, zn, zf, d: ex }; });
      for (const g of ground.filter((g) => g.d > -5).sort((a, b) => b.d - a.d)) { setF(g.f); this._segment(ctx, cam, g.zn, g.zf, t, 'ground'); }
      // prédios (cada lado é um item) + objetos
      for (const [f, zn, zf] of segs) for (const side of [-1, 1]) {
        setF(f); const zm = (zn + zf) / 2, vt = f === 'B' && zm < K.zc + K.cw ? 'av' : this.viewType(zm) || 'av', FX = ZONE[vt].road + ZONE[vt].side;
        const ex = this._eu(cam, side * FX, zm);
        items.push({ d: ex, draw: () => { setF(f); this._segment(ctx, cam, zn, zf, t, 'walls', side); } });
      }
      for (const f of ['A', 'B']) { setF(f); for (const sp of this.collect(cam, t)) { const pp = this.proj(cam, sp.x || 0, 0, sp.z); if (!pp || pp.dz < 1.4) continue; const ex = this._eu(cam, sp.x || 0, sp.z); items.push({ d: ex, draw: () => { setF(f); sp.draw(ctx); } }); } }
      for (const e of extras || []) items.push({ d: e.d, draw: () => { this.frame = null; cam.z = cam.tz; cam.x = cam.tx; e.draw(); } });
      for (const it of items.sort((a, b) => b.d - a.d)) it.draw();
      this.frame = null; cam.z = cam.tz; cam.x = cam.tx;
    }
    // distância (no chão) da câmera até um ponto do frame atual
    _eu(cam, x, z) {
      const T = cam.turn; let xa = x, za = z;
      if (this.frame === 'B') { xa = T.E + T.dir * (z - T.zs); za = T.pc - T.dir * x; }
      return Math.hypot(xa - cam.tx, za - cam.tz);
    }

    _segment(ctx, cam, zn, zf, t, part = 'all', only = 0) {
      const P = (x, y, z) => this.proj(cam, x, y, z), G = part !== 'walls', Wl = part !== 'ground', turnMode = !!cam.turn;
      const zm = (zn + zf) / 2, dz = zm - cam.z, K = this.nextCorner, L = this.lastCorner, F = (c) => this._fog(c, dz);
      // na curva, a via nova (frame B) antes do seu começo: no "T" é o outro braço da avenida; na direita não existe
      if (this.frame !== 'B' && zm < City.WH_END) { this._warehouse(ctx, P, zn, zf, zm, F, G, Wl, only); return; }   // galpão de saída
      let skipSide = 0, forceAv = false;
      if (turnMode && this.frame === 'B' && this.turnK && zm < this.turnK.zc + this.turnK.cw) {
        if (this.turnK.kind === 'side') return;
        forceAv = true; skipSide = this.turnK.dir;   // o lado de cá da avenida fica escondido atrás das casas da rua
      }
      if (!forceAv && K && zm >= K.zc && zm < K.zc + K.cw) return this._junction(ctx, cam, zn, zf, zm, K, F, true, G, Wl);
      if (!forceAv && L && zm >= L.zc && zm < L.zc + L.cw) return this._junction(ctx, cam, zn, zf, zm, L, F, false, G, Wl);
      if (K && K.kind === 'T' && zm >= K.zc + K.cw) { if (!turnMode) this._tFar(ctx, cam, zn, zf, zm, K, F); return; }
      const vt = forceAv ? 'av' : this.viewType(zm), zone = this._themeZone(zm, forceAv), Z = ZONE[zone.type], R = Z.road, SW = Z.side, FX = R + SW;
      if (!turnMode && K && K.kind === 'side' && zf > K.zc + K.cw + 2.3 && zn <= K.zc + K.cw + 2.3) this._afterSeg = () => this._crossFacade(ctx, cam, K, F);
      const idx = Math.floor(zm);
      if (G) {
        this._quad(ctx, P(-R, 0, zn), P(R, 0, zn), P(R, 0, zf), P(-R, 0, zf), F(idx % 2 ? '#4a4d55' : '#474a52'));
        if (zone.type === 'av') {
          if (Math.floor(zm / 3) % 2 === 0) [-1.8, 1.8].forEach((lx) => this._quad(ctx, P(lx - 0.07, 0, zn), P(lx + 0.07, 0, zn), P(lx + 0.07, 0, zf), P(lx - 0.07, 0, zf), F('#f1f1f1')));
          [-R + 0.25, R - 0.25].forEach((lx) => this._quad(ctx, P(lx - 0.06, 0, zn), P(lx + 0.06, 0, zn), P(lx + 0.06, 0, zf), P(lx - 0.06, 0, zf), F('#e9e9e9')));
        } else if (Math.floor(zm / 2.5) % 2 === 0) this._quad(ctx, P(-0.06, 0, zn), P(0.06, 0, zn), P(0.06, 0, zf), P(-0.06, 0, zf), F('#f2c94c'));
        const Kc = this.corners.find((c) => zm > c.zc - 7.4 && zm < c.zc - 6.6);
        if (Kc) { const x0 = zone.type === 'av' ? -R : 0; this._quad(ctx, P(x0, 0.005, zm - 0.2), P(R, 0.005, zm - 0.2), P(R, 0.005, zm + 0.2), P(x0, 0.005, zm + 0.2), F('#f4f4f4')); }
        for (const cv of this.curves) if (zm > cv.z0 - 6 && zm < cv.z0 - 2) for (let x = -R + 0.4; x < R - 0.4; x += 0.9) this._quad(ctx, P(x, 0, zn), P(x + 0.5, 0, zn), P(x + 0.5, 0, zf), P(x, 0, zf), F('#f4f4f4'));
      }
      for (const side of [-1, 1]) {
        if ((only && side !== only) || side === skipSide) continue;
        // na virada, a esquina do outro lado da rua lateral fica por conta da própria rua
        const corner = turnMode && K && K.kind === 'side' && side === K.dir && zm >= K.zc + K.cw && zm < K.zc + K.cw + ZONE.rua.side + 0.2;
        this._sideStrip(ctx, P, cam, zn, zf, zm, dz, side, R, FX, F, zone, G, Wl && !corner, idx);
      }
      if (this._afterSeg) { const f = this._afterSeg; this._afterSeg = null; f(); }
    }

    // ---------------- CENTRO DE DISTRIBUIÇÃO (de onde o motoboy sai) ----------------
    _warehouse(ctx, P, zn, zf, zm, F, G, Wl, only) {
      const WX = 6.2, HH = 5.6, idx = Math.floor(zm);
      if (G) {
        this._quad(ctx, P(-WX, 0, zn), P(WX, 0, zn), P(WX, 0, zf), P(-WX, 0, zf), idx % 2 ? '#8d9297' : '#888d92');   // piso de concreto
        this._quad(ctx, P(-0.08, 0.01, zn), P(0.08, 0.01, zn), P(0.08, 0.01, zf), P(-0.08, 0.01, zf), '#e8c547');       // faixa amarela de circulação
        [-2.6, 2.6].forEach((lx) => this._quad(ctx, P(lx - 0.06, 0.01, zn), P(lx + 0.06, 0.01, zn), P(lx + 0.06, 0.01, zf), P(lx - 0.06, 0.01, zf), '#f1f1f1'));
      }
      if (!Wl) return;
      for (const side of [-1, 1]) {
        if (only && side !== only) continue;
        const x = side * WX;
        this._quad(ctx, P(x, 0, zn), P(x, HH, zn), P(x, HH, zf), P(x, 0, zf), side < 0 ? '#b9bec3' : '#a9aeb3');   // parede
        // porta-palete com caixas
        const rx = side * (WX - 0.05);
        for (const y of [0.15, 1.55, 2.95, 4.35]) {
          this._quad(ctx, P(rx, y, zn), P(rx, y + 0.12, zn), P(rx, y + 0.12, zf), P(rx, y, zf), '#e06d1a');
          if (y < 4.3 && Math.floor(zm * 1.7 + y * 3) % 5 !== 0) {
            const k = Math.floor(zm * 2.3 + y * 7) % 3;
            this._quad(ctx, P(rx, y + 0.14, zn + 0.05), P(rx, y + 1.18, zn + 0.05), P(rx, y + 1.18, zf - 0.05), P(rx, y + 0.14, zf - 0.05), ['#c69c6d', '#b98c5c', '#d4ab7c'][k]);
            this._quad(ctx, P(rx, y + 0.55, zn + 0.05), P(rx, y + 0.7, zn + 0.05), P(rx, y + 0.7, zf - 0.05), P(rx, y + 0.55, zf - 0.05), '#82e8cc');
          }
        }
        if (idx % 3 === 0) this._quad(ctx, P(rx, 0, zn), P(rx, HH - 0.6, zn), P(rx, HH - 0.6, zn + 0.12), P(rx, 0, zn + 0.12), '#2563eb');   // colunas do porta-palete
      }
      // telhado com luminárias
      this._quad(ctx, P(-WX, HH, zn), P(WX, HH, zn), P(WX, HH, zf), P(-WX, HH, zf), '#4b5157');
      if (idx % 4 === 0) [-3, 3].forEach((lx) => this._quad(ctx, P(lx - 0.6, HH - 0.02, zn), P(lx + 0.6, HH - 0.02, zn), P(lx + 0.6, HH - 0.02, zn + 0.4), P(lx - 0.6, HH - 0.02, zn + 0.4), '#fffbe6'));
    }
    // portão do galpão (parede da frente com a abertura para a avenida) e o caminhão estacionado
    _whPortal(ctx, cam) {
      const P = (x, y, z) => this.proj(cam, x, y, z), z = City.WH_END, WX = 6.2, HH = 5.6, OX = 4.0, OY = 4.0;
      const col = '#9aa0a6';
      this._quad(ctx, P(-WX, 0, z), P(-OX, 0, z), P(-OX, HH, z), P(-WX, HH, z), col);
      this._quad(ctx, P(OX, 0, z), P(WX, 0, z), P(WX, HH, z), P(OX, HH, z), col);
      this._quad(ctx, P(-OX, OY, z), P(OX, OY, z), P(OX, HH, z), P(-OX, HH, z), col);
      this._quad(ctx, P(-OX, OY - 0.5, z), P(OX, OY - 0.5, z), P(OX, OY, z), P(-OX, OY, z), '#6b7177');   // porta de enrolar recolhida
      this._quad(ctx, P(-OX, 0, z), P(-OX + 0.25, 0, z), P(-OX + 0.25, OY, z), P(-OX, OY, z), '#f2c230');
      this._quad(ctx, P(OX - 0.25, 0, z), P(OX, 0, z), P(OX, OY, z), P(OX - 0.25, OY, z), '#f2c230');
      const a = P(-2.6, OY + 0.75, z - 0.02), b = P(2.6, OY + 1.35, z - 0.02);
      if (a && b) { ctx.fillStyle = '#0e3a4a'; ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y); const hh = a.y - b.y; if (hh > 8) { ctx.fillStyle = '#82e8cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.round(hh * 0.7)}px ${U.FONT_TITLE}`; ctx.fillText('ACHADOS ÚTEIS · CENTRO DE DISTRIBUIÇÃO', (a.x + b.x) / 2, (a.y + b.y) / 2 + hh * 0.05); ctx.textBaseline = 'alphabetic'; } }
    }
    // portão de saída com cancela levantada e guarita
    _gate(ctx, cam, K, t) {
      const P = (x, y, z) => this.proj(cam, x, y, z), z = K.zc - 1.5, R = ZONE.rua.road, FX = R + ZONE.rua.side;
      const ps = P(-R - 0.3, 0.1, z), pt = P(-R - 0.3, 1.2, z), arm = P(-R - 0.3 + 0.5, 1.2 + 3.2, z);
      if (ps && pt && arm) {
        ctx.fillStyle = '#facc15'; ctx.fillRect(ps.x - ps.s * 0.12, pt.y, ps.s * 0.24, ps.y - pt.y);
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = Math.max(2, ps.s * 0.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(arm.x, arm.y); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.setLineDash([ps.s * 0.25, ps.s * 0.25]); ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(arm.x, arm.y); ctx.stroke(); ctx.setLineDash([]);
      }
      // guarita
      const gx = R + 0.4, g0 = P(gx, 0.1, z), g1 = P(gx + 1.6, 2.5, z);
      if (g0 && g1) {
        const w = g1.x - g0.x, h = g0.y - g1.y;
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(g0.x, g1.y, w, h);
        ctx.fillStyle = '#0e3a4a'; ctx.fillRect(g0.x - w * 0.08, g1.y - h * 0.12, w * 1.16, h * 0.14);
        ctx.fillStyle = 'rgba(120,180,220,0.85)'; ctx.fillRect(g0.x + w * 0.12, g1.y + h * 0.18, w * 0.76, h * 0.36);
        ctx.fillStyle = '#c98c64'; ctx.beginPath(); ctx.arc(g0.x + w * 0.5, g1.y + h * 0.38, w * 0.12, 0, 7); ctx.fill();
        ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(g0.x + w * 0.5, g1.y + h * 0.33, w * 0.12, Math.PI, 0); ctx.fill();
        if (h > 30) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `${Math.round(h * 0.1)}px ${U.FONT_TITLE}`; ctx.fillText('PORTARIA', g0.x + w / 2, g1.y - h * 0.02); }
      }
      // placa "ATENÇÃO SAÍDA DE VEÍCULOS"
      const s0 = P(-FX + 0.3, 2.2, z + 0.5), s1 = P(-FX + 2.0, 1.4, z + 0.5);
      if (s0 && s1 && s1.x - s0.x > 20) {
        ctx.fillStyle = '#facc15'; ctx.fillRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
        ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round((s1.y - s0.y) * 0.3)}px ${U.FONT_UI}`; ctx.fillText('SAÍDA DE', (s0.x + s1.x) / 2, s0.y + (s1.y - s0.y) * 0.42); ctx.fillText('VEÍCULOS', (s0.x + s1.x) / 2, s0.y + (s1.y - s0.y) * 0.8);
      }
    }
    _pallet(ctx, cam, x, z, k) {   // pilhas de caixas no chão do galpão
      const p = this.proj(cam, x, 0, z); if (!p) return;
      const s = p.s, w = 1.3 * s;
      ctx.fillStyle = '#a0764a'; ctx.fillRect(p.x - w / 2, p.y - s * 0.15, w, s * 0.15);
      for (let r = 0; r < 2 + k % 2; r++) for (let c = 0; c < 2; c++) { const bx = p.x - w / 2 + c * w / 2, by = p.y - s * 0.15 - (r + 1) * s * 0.42;
        ctx.fillStyle = ['#c69c6d', '#d4ab7c'][(r + c) % 2]; ctx.fillRect(bx + 1, by, w / 2 - 2, s * 0.4); ctx.fillStyle = '#82e8cc'; ctx.fillRect(bx + w * 0.2, by, w * 0.08, s * 0.4); }
    }
    _whTruck(ctx, cam) {
      const p = this.proj(cam, -3.7, 0, 13); if (!p) return;
      City.truckRear(ctx, p.x, p.y, p.s);
    }

    _themeZone(zm, forceAv) {
      if (forceAv && this.turnK) return this.zoneAt(this.turnK.zc + this.turnK.cw + 1);
      const K = this.nextCorner, zn = this.zoneAt(zm);
      if (K && K.kind === 'side' && zm >= K.zc + K.cw && zn.type !== 'av') return this.zoneAt(K.zc - 1);
      return zn;
    }
    // um lado da via: calçada + o que tem atrás dela (lojas, prédios, casas, vila ou a praia)
    _sideStrip(ctx, P, cam, zn, zf, zm, dz, side, R, FX, F, zone, G, Wl, idx) {
      const av = zone.type === 'av';
      if (zone.theme === 'patio') {   // pátio da empresa: piso de concreto, muro com grade e a marca
        if (G) {
          this._quad(ctx, P(side * R, 0, zn), P(side * R, 0.1, zn), P(side * R, 0.1, zf), P(side * R, 0, zf), F('#c9cdd1'));
          this._quad(ctx, P(side * R, 0.1, zn), P(side * FX, 0.1, zn), P(side * FX, 0.1, zf), P(side * R, 0.1, zf), F(idx % 2 ? '#b3b7bb' : '#aeb2b6'));
        }
        if (!Wl) return;
        const x = side * FX;
        this._quad(ctx, P(x, 0.1, zn), P(x, 1.3, zn), P(x, 1.3, zf), P(x, 0.1, zf), F('#d9dcdf'));
        this._quad(ctx, P(x, 0.9, zn), P(x, 1.05, zn), P(x, 1.05, zf), P(x, 0.9, zf), F('#82e8cc'));
        if (Math.floor(zm * 2.5) % 2 === 0) this._quad(ctx, P(x, 1.3, zn), P(x, 2.6, zn), P(x, 2.6, zf), P(x, 1.3, zf), F('#4b5563'));   // grade
        this._quad(ctx, P(x, 2.5, zn), P(x, 2.6, zn), P(x, 2.6, zf), P(x, 2.5, zf), F('#4b5563'));
        return;
      }
      if (av && zone.beach === side) {
        if (G) {
          this._quad(ctx, P(side * R, 0, zn), P(side * R, 0.15, zn), P(side * R, 0.15, zf), P(side * R, 0, zf), F('#b8bcc2'));
          const wave = Math.floor(zm * 1.1 + Math.sin(zm * 0.7) * 1.2) % 2 === 0;   // calçadão de ondinhas
          this._quad(ctx, P(side * R, 0.15, zn), P(side * FX, 0.15, zn), P(side * FX, 0.15, zf), P(side * R, 0.15, zf), F(wave ? '#f4f1ea' : '#2a2a2c'));
          this._quad(ctx, P(side * FX, 0.1, zn), P(side * (FX + 4), 0.02, zn), P(side * (FX + 4), 0.02, zf), P(side * FX, 0.1, zf), F('#efd49a'));
          this._quad(ctx, P(side * (FX + 4), 0.01, zn), P(side * (FX + 4.6), 0.01, zn), P(side * (FX + 4.6), 0.01, zf), P(side * (FX + 4), 0.01, zf), F('#ffffff'));
          this._quad(ctx, P(side * (FX + 4.6), 0, zn), P(side * (FX + 600), 0, zn), P(side * (FX + 600), 0, zf), P(side * (FX + 4.6), 0, zf), F(idx % 2 ? '#2f8fd8' : '#3497de'));
        }
        return;
      }
      if (G) {
        this._quad(ctx, P(side * R, 0, zn), P(side * R, 0.15, zn), P(side * R, 0.15, zf), P(side * R, 0, zf), F('#b8bcc2'));
        this._quad(ctx, P(side * R, 0.15, zn), P(side * FX, 0.15, zn), P(side * FX, 0.15, zf), P(side * R, 0.15, zf), F(idx % 2 ? '#c9c2b5' : '#d3ccbf'));
      }
      if (!Wl) return;
      const chunk = Math.floor(zm / (av ? 12 : 13)) + (side > 0 ? 700 : 0);
      if (av) { if (zone.theme === 'centro') this._tower(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F); else this._shop(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F); }
      else if (zone.theme === 'predios') this._apt(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F);
      else if (zone.theme === 'vila') this._vila(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F);
      else this._house(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F);
    }
    _stopAt(zm, side) { return this.stops.find((s) => s.side === side && Math.abs(zm - s.z) < 6.5); }
    // CENTRO: prédios altos de vidro com loja no térreo
    _tower(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F) {
      const x = side * FX, h = 13 + U.hash(chunk) * 20, local = zm - Math.floor(zm / 12) * 12;
      const wall = ['#9fb3c8', '#c7d2de', '#7f97ad', '#d9d4c7', '#8aa1b1', '#b9c4cf'][Math.floor(U.hash(chunk + 0.7) * 6)];
      const gap = local > 11.2;
      this._quad(ctx, P(x, 0.15, zn), P(x, h, zn), P(x, h, zf), P(x, 0.15, zf), F(gap ? '#5b6b7a' : wall));
      this._quad(ctx, P(x, 0.25, zn), P(x, 3, zn), P(x, 3, zf), P(x, 0.25, zf), F(local > 5 && local < 7 ? '#3b3226' : '#3e5566'));
      this._quad(ctx, P(x, 3.1, zn), P(x - side * 0.8, 3.35, zn), P(x - side * 0.8, 3.35, zf), P(x, 3.1, zf), F(Math.floor(zm) % 2 ? '#2b2d31' : '#e9ecef'));
      if (!gap) for (let y = 4.4, i = 0; y < h - 1.2; y += 3.1, i++) {
        if (dz > 90 && i % 2) continue;
        this._quad(ctx, P(x, y, zn), P(x, y + 1.9, zn), P(x, y + 1.9, zf), P(x, y, zf), F((Math.floor(zm * 0.5) + i) % 5 === 0 ? '#a8c8e0' : '#4f6d86'));
      }
      this._quad(ctx, P(x, h, zn), P(x, h + 0.4, zn), P(x, h + 0.4, zf), P(x, h, zf), F('#6b7280'));
    }
    // RUA DE PRÉDIOS: condomínios com grade e portaria
    _apt(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F) {
      const stop = this._stopAt(zm, side), col = stop ? '#f7f7f2' : ['#f2e3c6', '#d8e2dc', '#ffe5d9', '#cddafd', '#e2ece9', '#fde2e4'][Math.floor(U.hash(chunk) * 6)];
      const hx = side * (FX + 2.6), wx = side * FX, hh = 9 + U.hash(chunk + 2) * 9, local = zm - Math.floor(zm / 13) * 13;
      this._quad(ctx, P(hx, 0.15, zn), P(hx, hh, zn), P(hx, hh, zf), P(hx, 0.15, zf), F(local > 12.3 ? '#9aa3ad' : col));
      if (local < 12.3) for (let y = 2.4, i = 0; y < hh - 1; y += 2.9, i++) {
        if (dz > 100 && i % 2) continue;
        const win = Math.floor(local) % 4 !== 0;
        if (win) this._quad(ctx, P(hx, y, zn), P(hx, y + 1.4, zn), P(hx, y + 1.4, zf), P(hx, y, zf), F('#5d7a8c'));
        this._quad(ctx, P(hx, y - 0.25, zn), P(hx - side * 0.7, y - 0.25, zn), P(hx - side * 0.7, y - 0.25, zf), P(hx, y - 0.25, zf), F('#e8e8e8'));   // sacada
      }
      const gate = local > 5 && local < 8;
      this._quad(ctx, P(wx, 0.15, zn), P(wx, 2.3, zn), P(wx, 2.3, zf), P(wx, 0.15, zf), F(gate ? (stop ? '#2f855a' : '#3d4451') : '#4b5563'));
      if (!gate && Math.floor(zm * 3) % 2 === 0) this._quad(ctx, P(wx, 0.6, zn), P(wx, 2.2, zn), P(wx, 2.2, zf), P(wx, 0.6, zf), F('#9ca3af'));   // grade
      this._quad(ctx, P(wx, 0.16, zn), P(hx, 0.16, zn), P(hx, 0.16, zf), P(wx, 0.16, zf), F('#8fbf7a'));
    }
    // VILA: casinhas coladas na calçada, coloridas, laje com caixa d'água
    _vila(ctx, P, cam, zn, zf, zm, dz, side, FX, chunk, F) {
      const stop = this._stopAt(zm, side), x = side * FX, local = zm - Math.floor(zm / 6) * 6, ch = Math.floor(zm / 6) + (side > 0 ? 500 : 0);
      const col = stop ? '#ffffff' : ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585', '#b5e48c', '#ff9f1c', '#9b5de5'][Math.floor(U.hash(ch) * 8)];
      const h = 3 + U.hash(ch + 1) * 3.2;
      this._quad(ctx, P(x, 0.15, zn), P(x, h, zn), P(x, h, zf), P(x, 0.15, zf), F(col));
      this._quad(ctx, P(x, h, zn), P(x, h + 0.3, zn), P(x, h + 0.3, zf), P(x, h, zf), F('#b0a99f'));
      if (local > 1 && local < 2.2) this._quad(ctx, P(x, 0.15, zn), P(x, 2.1, zn), P(x, 2.1, zf), P(x, 0.15, zf), F(stop ? '#2f855a' : ['#7c4a1e', '#334155', '#7f1d1d'][Math.floor(U.hash(ch + 3) * 3)]));
      if (local > 3 && local < 4.6) this._quad(ctx, P(x, 1.1, zn), P(x, 2.1, zn), P(x, 2.1, zf), P(x, 1.1, zf), F('#5d7a8c'));
      if (h > 4.5 && local > 2.5 && local < 5) this._quad(ctx, P(x, 3.6, zn), P(x, 4.4, zn), P(x, 4.4, zf), P(x, 3.6, zf), F('#5d7a8c'));
      if (U.hash(ch + 5) < 0.6 && local > 3.2 && local < 4.6) this._quad(ctx, P(x + side * 0.8, h + 0.3, zn), P(x + side * 0.8, h + 1.3, zn), P(x + side * 0.8, h + 1.3, zf), P(x + side * 0.8, h + 0.3, zf), F('#2b6cb0'));   // caixa d'água
    }

    // cruzamento: antes de virar (pre) a rua lateral se abre do lado da seta; depois, é a via que ficou para trás
    _junction(ctx, cam, zn, zf, zm, C, F, pre, G = true, Wl = true) {
      const P = (x, y, z) => this.proj(cam, x, y, z), BIG = 90;
      const sideK = C.kind === 'side', from = sideK ? ZONE.av : ZONE.rua, R = from.road, FX = R + from.side;
      const both = !pre || !sideK;          // "T" com a avenida, ou a via de onde viemos: asfalto dos dois lados
      const xl = both || C.dir < 0 ? -BIG : -R, xr = both || C.dir > 0 ? BIG : R;
      if (G) this._quad(ctx, P(xl, 0, zn), P(xr, 0, zn), P(xr, 0, zf), P(xl, 0, zf), F('#4a4d55'));
      // faixas pintadas da via que cruza (no sentido do x)
      const mid = C.zc + C.cw / 2, lines = sideK ? [[mid, '#f2c94c']] : [[mid - 1.8, '#f1f1f1'], [mid + 1.8, '#f1f1f1']];
      if (G) for (const [lz, col] of lines) if (lz >= zn && lz < zf + 0.2) for (let x = (sideK && pre && C.dir > 0 ? R + 1 : -BIG); x < (sideK && pre && C.dir < 0 ? -R - 1 : BIG); x += 3) this._quad(ctx, P(x, 0.01, lz - 0.07), P(x + 1.5, 0.01, lz - 0.07), P(x + 1.5, 0.01, lz + 0.07), P(x, 0.01, lz + 0.07), F(col));
      if (pre && sideK) {
        // o outro lado continua com calçada e lojas (ou a praia) da avenida
        const o = -C.dir, zone = this.zoneAt(C.zc - 1);
        this._sideStrip(ctx, P, cam, zn, zf, zm, zm - cam.z, o, R, FX, F, zone, G, Wl, Math.floor(zm));
      }
    }
    // fachada das casas do outro lado da rua lateral (de frente para a câmera)
    _crossFacade(ctx, cam, K, F) {
      const sg = K.dir, P = (x, y, z) => this.proj(cam, sg * x, y, z), z0 = K.zc + K.cw, z1 = z0 + 2.3, R = ZONE.av.road, FX = R + ZONE.av.side;
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
      const stop = this._stopAt(zm, side);
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
      const L = [], vis = (z, o) => (cam.turn ? z - cam.z > -40 : z - cam.z > 0.6) && z - cam.z < 230 && this.visibleZ(z, o);
      for (const p of this.props) if (vis(p.z)) L.push({ z: p.z, x: p.side * (this.road(p.z) + 0.7), draw: (c) => this._prop(c, cam, p, t) });
      for (const s of this.signs) if (vis(s.z)) L.push({ z: s.z, x: 6, draw: (c) => this._streetSign(c, cam, s) });
      for (const o of this.obstacles) if (!o.gone && vis(o.z, o)) L.push({ z: o.z, x: o.x, draw: (c) => this._ob(c, cam, o, t) });
      if (this.frame !== 'B') {
        if (City.WH_END - cam.z > 0.6) L.push({ z: City.WH_END, x: 0, draw: (c) => this._whPortal(c, cam) });
        if (13 - cam.z > 0.6) L.push({ z: 13, x: -3.7, draw: (c) => this._whTruck(c, cam) });
        for (const [px, pz, k] of [[3.9, 9, 0], [4.2, 19, 1], [-4.3, 23, 2]]) if (pz - cam.z > 0.6) L.push({ z: pz, x: px, draw: (c) => this._pallet(c, cam, px, pz, k) });
      }
      const KC = this.nextCorner;
      if (KC && KC.zc - cam.z < 200 && KC.zc - cam.z > -60) {
        const sl = this.stopLine(KC), R = this.road(sl);
        if (KC.ctl === 'none') { L.push({ z: KC.zc - 1.5, x: 0, draw: (c) => this._gate(c, cam, KC, t) }); }
        else if (KC.ctl === 'light') {
          L.push({ z: sl, x: R + 0.4, draw: (c) => this._light(c, cam, KC, R + 0.4, sl, t) });
          if (KC.kind === 'side') L.push({ z: KC.zc + KC.cw + 0.4, x: -KC.dir * (R + 0.4), draw: (c) => this._light(c, cam, KC, -KC.dir * (ZONE.av.road + 0.4), KC.zc + KC.cw + 0.6, t, true) });
        } else {
          const px = -KC.dir * (KC.kind === 'side' ? 1.6 : 3.3), pz = KC.zc + KC.cw / 2;
          L.push({ z: pz, x: px, draw: (c) => this._police(c, cam, KC, px, pz, t) });
        }
        for (const cc of KC.cross) L.push({ z: cc.z, x: cc.x, draw: (c) => {
          const p = this.proj(cam, cc.x, 0, cc.z); if (!p) return;
          const F = (q) => this._fog(q, p.dz);
          if (!City.rearNow(cam, cc.v)) City.carSide(c, p.x, p.y, p.s, cc.color, F, Math.sign(cc.v), t, cc.bus);
          else if (cc.bus) City.busRear(c, p.x, p.y, p.s, cc.color, 100, F, false);
          else City.carRear(c, p.x, p.y, p.s, cc.color, F, false);
        } });
      }
      this.stops.forEach((s, i) => { if (vis(s.z) && !s.done) L.push({ z: s.z + 0.5, x: 7 * (s.side || 1), draw: (c) => this._pin(c, cam, s, t) }); });
      // placas das lojas (perpendiculares, de frente para a câmera)
      for (let z = Math.floor(cam.z / 12) * 12 + 12; z < cam.z + 160; z += 12) {
        if (this.viewType(z) !== 'av' || this.curves.some((c) => z > c.z0 - 4 && z < c.z1 + 4)) continue;
        for (const side of [-1, 1]) {
          const chunk = Math.floor(z / 12) + (side > 0 ? 700 : 0), tz = this._themeZone(z);
          if (U.hash(chunk * 1.9) < 0.35 || tz.beach === side) continue;
          const zz = z + 2;
          L.push({ z: zz, x: side * 7, draw: (c) => this._blade(c, cam, zz, side, SHOPS[Math.floor(U.hash(Math.floor(zz / 12) + (side > 0 ? 700 : 0) + 0.3) * SHOPS.length)]) });
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
      const R = (s.side || 1) * (ZONE.av.road + 0.6);
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
      const p = this.proj(cam, (s.side || 1) * (R + 1.5), 5.6 + Math.sin(t * 3) * 0.2, s.z);
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
      if (p.kind === 'palm') {
        const lean = (p.seed - 0.5) * 1.4, top = { x: b.x + lean * s, y: b.y - s * 4.6 };
        ctx.strokeStyle = F('#8b6b43'); ctx.lineWidth = s * 0.18; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + lean * s * 0.2, b.y - s * 2.4, top.x, top.y); ctx.stroke();
        const sw = Math.sin(t * 1.2 + p.seed * 9) * 0.08;
        ctx.strokeStyle = F('#2e8b3e'); ctx.lineWidth = s * 0.16;
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.48 + sw, L = s * (1.6 + (i % 2) * 0.4);
          ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.quadraticCurveTo(top.x + Math.cos(a) * L * 0.6, top.y + Math.sin(a) * L * 0.6 - s * 0.3, top.x + Math.cos(a) * L, top.y + Math.sin(a) * L * 0.5 + s * 0.5); ctx.stroke();
        }
        ctx.fillStyle = F('#6b4a2f'); ctx.beginPath(); ctx.arc(top.x - s * 0.12, top.y + s * 0.15, s * 0.13, 0, 7); ctx.arc(top.x + s * 0.12, top.y + s * 0.18, s * 0.13, 0, 7); ctx.fill();
        return;
      }
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

    // caminhão baú da marca visto de trás, portas abertas, carregado de caixas
    static truckRear(ctx, x, y, s) {
      const w = 2.5 * s, h = 3.3 * s;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 0, w * 0.62, s * 0.18, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#16181b'; ctx.fillRect(-w * 0.46, -s * 0.5, w * 0.2, s * 0.5); ctx.fillRect(w * 0.26, -s * 0.5, w * 0.2, s * 0.5);   // rodas
      ctx.fillStyle = '#2b3036'; ctx.fillRect(-w / 2, -s * 0.62, w, s * 0.16);                                                   // para-choque
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d9e0e4');
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -h, w, h - s * 0.6);
      // interior com caixas
      ctx.fillStyle = '#20262c'; ctx.fillRect(-w * 0.44, -h + s * 0.12, w * 0.88, h - s * 0.85);
      const bw = w * 0.2;
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { if (r === 3 && c > 1) continue; const bx = -w * 0.42 + c * (bw + s * 0.02), by = -s * 0.86 - (r + 1) * s * 0.5;
        ctx.fillStyle = ['#c69c6d', '#b98c5c', '#d4ab7c'][(r + c) % 3]; ctx.fillRect(bx, by, bw, s * 0.48); ctx.fillStyle = '#82e8cc'; ctx.fillRect(bx + bw * 0.42, by, bw * 0.16, s * 0.48); }
      // portas abertas para os lados
      ctx.fillStyle = '#eef2f4'; ctx.fillRect(-w / 2 - w * 0.12, -h, w * 0.12, h - s * 0.62); ctx.fillRect(w / 2, -h, w * 0.12, h - s * 0.62);
      ctx.fillStyle = '#0e3a4a'; ctx.fillRect(-w / 2, -h, w, s * 0.14);
      ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-w / 2, -s * 0.78, w * 0.06, s * 0.14); ctx.fillRect(w / 2 - w * 0.06, -s * 0.78, w * 0.06, s * 0.14);
      if (s > 30) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `${Math.round(s * 0.12)}px ${U.FONT_TITLE}`; ctx.fillText('ACHADOS ÚTEIS', 0, -h + s * 0.11); }
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

    // semáforo: poste na calçada com braço sobre a pista
    _light(ctx, cam, K, x, z, t, small) {
      const b = this.proj(cam, x, 0.15, z), top = this.proj(cam, x, small ? 3.2 : 5.4, z), arm = this.proj(cam, small ? x : x - Math.sign(x) * 3.2, small ? 3.2 : 5.4, z);
      if (!b || !top || !arm) return;
      const s = b.s, F = (c) => this._fog(c, b.dz);
      ctx.strokeStyle = F('#2f3338'); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, s * 0.14);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(top.x, top.y); ctx.lineTo(arm.x, arm.y); ctx.stroke();
      const bw = s * 0.42, bh = s * 1.15, bx = arm.x - bw / 2, by = arm.y;
      ctx.fillStyle = F('#1c1f23'); U.roundRect(ctx, bx, by, bw, bh, bw * 0.2); ctx.fill();
      [['r', '#ff3030', 0], ['y', '#ffc107', 1], ['g', '#22e06b', 2]].forEach(([k, col, i]) => {
        const on = K.sig === k || (k === 'y' && K.sig === 'y'), cy = by + bh * (0.2 + i * 0.3), r = bw * 0.32;
        ctx.fillStyle = on ? col : F('#3a3f45');
        if (on) { ctx.shadowColor = col; ctx.shadowBlur = Math.max(6, s * 0.5); }
        ctx.beginPath(); ctx.arc(arm.x, cy, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      });
    }
    // guarda de trânsito no meio do cruzamento (de frente): mão levantada = pare; braço girando = pode passar
    _police(ctx, cam, K, x, z, t) {
      const p = this.proj(cam, x, 0, z); if (!p) return;
      const k = p.s / 100, go = K.sig === 'g', F = (c) => this._fog(c, p.dz);
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 44, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = F('#e9e9e9'); ctx.beginPath(); ctx.ellipse(0, -6, 42, 10, 0, 0, 7); ctx.fill(); ctx.fillRect(-42, -12, 84, 8);   // tablado
      ctx.strokeStyle = F('#1e2a44'); ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, -96); ctx.lineTo(-9, -16); ctx.moveTo(8, -96); ctx.lineTo(9, -16); ctx.stroke();
      ctx.fillStyle = '#111'; U.roundRect(ctx, -18, -20, 16, 9, 3); ctx.fill(); U.roundRect(ctx, 2, -20, 16, 9, 3); ctx.fill();
      ctx.fillStyle = F('#25406e'); U.roundRect(ctx, -21, -160, 42, 70, 14); ctx.fill();
      ctx.fillStyle = F('#c6ff3d'); U.roundRect(ctx, -21, -152, 42, 46, 10); ctx.fill();            // colete refletivo
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(-21, -134, 42, 4); ctx.fillRect(-21, -118, 42, 4);
      ctx.fillStyle = '#1e2a44'; ctx.font = `900 9px ${U.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('TRÂNSITO', 0, -140);
      // braços com luva branca
      const wave = Math.sin(t * 7) * 0.6;
      ctx.strokeStyle = F('#25406e'); ctx.lineWidth = 9;
      const hand = (sx, ex, ey) => { ctx.beginPath(); ctx.moveTo(sx, -150); ctx.lineTo(ex, ey); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, 7); ctx.fill(); };
      if (go) { hand(-18, -40 + Math.cos(wave) * 8, -150 + Math.sin(wave * 2) * 20); hand(18, 46, -146 + Math.sin(t * 7 + 1) * 10); }
      else { hand(-18, -26, -100); hand(18, 26, -206); ctx.fillStyle = '#fff'; U.roundRect(ctx, 18, -224, 16, 20, 5); ctx.fill(); }   // mão espalmada: PARE
      // cabeça, quepe e apito
      ctx.fillStyle = F('#b98258'); ctx.beginPath(); ctx.arc(0, -176, 15, 0, 7); ctx.fill();
      ctx.fillStyle = F('#1e2a44'); ctx.beginPath(); ctx.ellipse(0, -188, 18, 8, 0, 0, 7); ctx.fill(); ctx.fillRect(-14, -200, 28, 12);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(-4, -198, 8, 7);
      ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.arc(-5, -177, 1.8, 0, 7); ctx.arc(5, -177, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#d9d9d9'; ctx.fillRect(-2, -168, 10, 5);
      const m = ctx.getTransform(), hp = m.transformPoint(new DOMPoint(0, -210));
      ctx.restore();
      this.policeHead = { x: hp.x, y: hp.y };
    }

    // carro de lado (passando no cruzamento)
    static carSide(ctx, x, y, s, color, F, dir, t, bus) {
      const L = (bus ? 10 : 4.2) * s, h = (bus ? 2.9 : 1.35) * s;
      ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, L * 0.55, s * 0.18, 0, 0, 7); ctx.fill();
      if (bus) {
        ctx.fillStyle = F('#f1f1ee'); U.roundRect(ctx, -L / 2, -h, L, h - s * 0.3, s * 0.2); ctx.fill();
        ctx.fillStyle = F(color); ctx.fillRect(-L / 2, -h * 0.45, L, h * 0.14);
        ctx.fillStyle = F('#22303a'); for (let i = 0; i < 6; i++) ctx.fillRect(-L / 2 + s * 0.4 + i * L * 0.155, -h * 0.9, L * 0.12, h * 0.33);
      } else {
        ctx.fillStyle = F(color); U.roundRect(ctx, -L / 2, -h * 0.75, L, h * 0.5, s * 0.15); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-L * 0.28, -h * 0.74); ctx.lineTo(-L * 0.16, -h); ctx.lineTo(L * 0.2, -h); ctx.lineTo(L * 0.34, -h * 0.74); ctx.closePath(); ctx.fill();
        ctx.fillStyle = F('#2c3e4c'); ctx.beginPath(); ctx.moveTo(-L * 0.22, -h * 0.76); ctx.lineTo(-L * 0.14, -h * 0.95); ctx.lineTo(L * 0.18, -h * 0.95); ctx.lineTo(L * 0.28, -h * 0.76); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(L * 0.46, -h * 0.62, s * 0.12, s * 0.12);
      }
      const spin = t * 30;
      [-0.3, 0.3].forEach((u) => { ctx.fillStyle = '#16171a'; ctx.beginPath(); ctx.arc(u * L, -s * 0.3, s * 0.32, 0, 7); ctx.fill(); ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(u * L, -s * 0.3, s * 0.14 + Math.sin(spin) * 0.001, 0, 7); ctx.fill(); });
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
          if (o.side && !City.rearNow(cam, o.side)) { City.carSide(ctx, p.x, p.y, s, o.color, F, o.side, t, false); break; }
          City.carRear(ctx, p.x, p.y, s, o.color, F, o.type === 'traffic' && Math.sin(t * 2 + o.seed * 9) > 0.6);
          break;
        case 'bus': if (o.side && !City.rearNow(cam, o.side)) { City.carSide(ctx, p.x, p.y, s, o.bus, F, o.side, t, true); break; } City.busRear(ctx, p.x, p.y, s, o.bus, o.line, F, Math.sin(t * 1.5 + o.seed * 9) > 0.5); break;
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

  City.WH_END = 30;
  City.YARD = 26;   // pátio entre o portão do galpão e a saída para a avenida   // fim do galpão (o motoboy sai pela porta)
  City.ZONE = ZONE; City.OB = OB; City.CARS = CARS;
  CNB.City = City; CNB.W = W; CNB.H = H;
})();
