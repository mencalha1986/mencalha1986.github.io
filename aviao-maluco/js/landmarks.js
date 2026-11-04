/* =========================================================================
   PONTOS TURÍSTICOS DO BRASIL — ilustrações desenhadas uma vez em canvas
   separado (com degradês, textura e luz) e reaproveitadas no fundo do jogo
   ========================================================================= */
(function () {
  const U = CNB.U;
  const LIGHT = 'rgba(255,248,230,';   // luz vindo da esquerda/alto

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function lin(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; }
  function rnd(seed) { return U.mulberry32(seed); }

  // mata atlântica: copas arredondadas em 3 tons, mais claras no alto
  function forest(ctx, w, h, seed, dens = 1, cols = ['#2f5f3d', '#3c7449', '#4f8a57', '#6aa36a']) {
    const r = rnd(seed);
    for (let i = 0; i < 1400 * dens; i++) {
      const x = r() * w, y = r() * h, s = 6 + r() * 14, k = U.clamp(1 - y / h + (r() - 0.5) * 0.5, 0, 0.999);
      ctx.fillStyle = cols[Math.floor(k * cols.length)];
      ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.8, 0, 0, 7); ctx.fill();
    }
  }
  // granito: faixas verticais claras e escuras
  function granite(ctx, x0, y0, x1, y1, seed, base = ['#a8aea6', '#7f8780', '#666e68']) {
    ctx.fillStyle = lin(ctx, x0, y0, x1, y1, [[0, base[0]], [0.6, base[1]], [1, base[2]]]); ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const r = rnd(seed);
    for (let i = 0; i < 160; i++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0) * 0.8, l = 30 + r() * 140;
      ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1 + r() * 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r() - 0.5) * 10, y + l / 2, x + (r() - 0.5) * 16, y + l); ctx.stroke();
    }
  }
  function sea(ctx, w, h, y, seed) {
    ctx.fillStyle = lin(ctx, 0, y, 0, h, [[0, '#3d9bd6'], [1, '#1f6fa8']]); ctx.fillRect(0, y, w, h - y);
    const r = rnd(seed); ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 70; i++) ctx.fillRect(r() * w, y + 4 + r() * (h - y - 6), 10 + r() * 34, 2);
  }
  function haze(ctx, w, h, a0 = 0.05, a1 = 0.28) {
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, `rgba(205,228,245,${a0})`], [1, `rgba(205,228,245,${a1})`]]); ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  function shadeRight(ctx, x0, x1, y0, y1, a = 0.28) { ctx.fillStyle = lin(ctx, x0, 0, x1, 0, [[0, LIGHT + '0.10)'], [0.55, 'rgba(0,0,0,0)'], [1, `rgba(20,30,40,${a})`]]); ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
  function palm(ctx, x, y, h, lean, s = 1) {
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 7 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h); ctx.stroke();
    ctx.strokeStyle = '#2f7a3d'; ctx.lineWidth = 6 * s;
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.5; ctx.beginPath(); ctx.moveTo(x + lean, y - h); ctx.quadraticCurveTo(x + lean + Math.cos(a) * 40 * s, y - h + Math.sin(a) * 36 * s - 12 * s, x + lean + Math.cos(a) * 64 * s, y - h + Math.sin(a) * 20 * s + 20 * s); ctx.stroke(); }
  }

  const B = {};

  // ---------- CRISTO REDENTOR no Corcovado ----------
  B.cristo = () => {
    const w = 1000, h = 820, c = canvas(w, h), x = c.getContext('2d');
    x.translate(0, 60);
    const peak = [700, 168];
    const path = () => { x.beginPath(); x.moveTo(0, h); x.bezierCurveTo(140, 700, 240, 640, 330, 590); x.bezierCurveTo(430, 530, 520, 420, 590, 320); x.bezierCurveTo(640, 250, 660, 200, 682, 172); x.lineTo(720, 170); x.bezierCurveTo(738, 250, 770, 380, 810, 500); x.bezierCurveTo(860, 640, 930, 720, w, h); x.closePath(); };
    path(); x.fillStyle = lin(x, 0, 160, 0, h, [[0, '#5d8a68'], [1, '#2e5239']]); x.fill();
    x.save(); path(); x.clip();
    forest(x, w, h, 11, 1.2);
    // paredão de granito do lado direito
    x.save(); x.beginPath(); x.moveTo(720, 170); x.bezierCurveTo(738, 250, 770, 380, 810, 500); x.lineTo(760, 520); x.bezierCurveTo(735, 400, 712, 280, 696, 178); x.closePath(); x.clip();
    granite(x, 690, 160, 820, 530, 12); x.restore();
    shadeRight(x, 0, w, 0, h, 0.35);
    x.restore();
    // pedestal e estátua
    let cx = peak[0] + 1, cy = peak[1] - 2;
    x.save(); x.translate(cx, cy); x.scale(1.45, 1.45); x.translate(-cx, -cy);
    x.fillStyle = lin(x, cx - 18, 0, cx + 18, 0, [[0, '#e9e6dc'], [1, '#b9b5aa']]);
    U.poly(x, [cx - 18, cy + 4, cx - 13, cy - 26, cx + 13, cy - 26, cx + 18, cy + 4]); x.fill();
    const st = lin(x, cx - 70, 0, cx + 70, 0, [[0, '#fbfaf5'], [0.5, '#ecebe4'], [1, '#c4c1b6']]);
    x.fillStyle = st;
    U.poly(x, [cx - 11, cy - 26, cx - 7, cy - 98, cx + 7, cy - 98, cx + 11, cy - 26]); x.fill();                        // túnica
    U.poly(x, [cx - 74, cy - 104, cx - 6, cy - 108, cx + 6, cy - 108, cx + 74, cy - 104, cx + 74, cy - 97, cx - 74, cy - 97]); x.fill(); // braços
    U.poly(x, [cx - 56, cy - 98, cx - 8, cy - 98, cx - 8, cy - 74]); x.fill(); U.poly(x, [cx + 56, cy - 98, cx + 8, cy - 98, cx + 8, cy - 74]); x.fill(); // mangas
    x.fillRect(cx - 3, cy - 114, 6, 8); x.beginPath(); x.ellipse(cx, cy - 119, 6, 7, 0.1, 0, 7); x.fill();
    x.strokeStyle = 'rgba(120,115,100,0.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(cx, cy - 96); x.lineTo(cx + 1, cy - 28); x.stroke();
    x.restore();
    haze(x, w, h); return c;
  };

  // ---------- PÃO DE AÇÚCAR ----------
  B.pao = () => {
    const w = 1100, h = 640, c = canvas(w, h), x = c.getContext('2d');
    // Morro da Urca
    const urca = () => { x.beginPath(); x.moveTo(60, h - 40); x.bezierCurveTo(120, 470, 220, 400, 330, 395); x.bezierCurveTo(430, 392, 500, 470, 560, h - 40); x.closePath(); };
    urca(); x.fillStyle = '#3e6b49'; x.fill(); x.save(); urca(); x.clip(); forest(x, w, h, 21, 0.9); shadeRight(x, 60, 560, 380, h, 0.3); x.restore();
    // Pão de Açúcar: domo de granito
    const pao = () => { x.beginPath(); x.moveTo(560, h - 40); x.bezierCurveTo(590, 330, 640, 90, 790, 70); x.bezierCurveTo(900, 60, 960, 250, 1000, h - 40); x.closePath(); };
    pao(); x.save(); x.clip();
    granite(x, 560, 50, 1010, h, 22, ['#b9bdb5', '#8d958e', '#69716b']);
    x.fillStyle = lin(x, 560, 0, 1010, 0, [[0, LIGHT + '0.22)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(15,25,35,0.35)']]); x.fillRect(560, 50, 450, h);
    // vegetação na base e nas fendas
    x.save(); x.beginPath(); x.rect(540, h - 190, 500, 200); x.clip(); forest(x, w, h, 23, 0.6); x.restore();
    const r = rnd(24); for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(60,110,70,0.55)'; x.beginPath(); x.ellipse(600 + r() * 380, 140 + r() * 300, 4 + r() * 8, 3 + r() * 5, 0, 0, 7); x.fill(); }
    x.restore();
    // estações do bondinho
    x.fillStyle = '#e8e2d4'; x.fillRect(318, 386, 34, 14); x.fillRect(772, 62, 34, 14);
    sea(x, w, h, h - 44, 25);
    haze(x, w, h); return c;
  };
  B.paoLive = (ctx, ox, oy, t) => {   // cabo e bondinho andando
    const a = { x: ox + 340, y: oy + 392 }, b = { x: ox + 785, y: oy + 66 };
    ctx.strokeStyle = 'rgba(40,40,45,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + 60, b.x, b.y); ctx.stroke();
    const u = (t * 0.06) % 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + 60;
    const gx = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * mx + u * u * b.x, gy = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * my + u * u * b.y;
    ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + 8); ctx.stroke();
    ctx.fillStyle = '#d63b2f'; U.roundRect(ctx, gx - 13, gy + 8, 26, 18, 5); ctx.fill();
    ctx.fillStyle = 'rgba(200,230,255,0.9)'; ctx.fillRect(gx - 9, gy + 11, 18, 7);
  };

  // ---------- CONGRESSO NACIONAL ----------
  B.congresso = () => {
    const w = 1000, h = 540, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = lin(x, 0, h - 70, 0, h, [[0, '#8fbf6a'], [1, '#6a9c4e']]); x.fillRect(0, h - 70, w, 70);
    x.fillStyle = lin(x, 0, h - 40, 0, h, [[0, '#7fc3e8'], [1, '#4f9bd0']]); x.fillRect(80, h - 34, 840, 22);       // espelho d'água
    // plataforma
    x.fillStyle = lin(x, 0, h - 110, 0, h - 70, [[0, '#f7f7f2'], [1, '#d9dbd6']]); x.fillRect(120, h - 110, 760, 40);
    x.fillStyle = 'rgba(40,60,80,0.35)'; for (let i = 0; i < 38; i++) x.fillRect(132 + i * 20, h - 98, 10, 20);
    // torres gêmeas
    [[466, 0], [512, 1]].forEach(([tx, k]) => {
      x.fillStyle = lin(x, tx, 0, tx + 40, 0, [[0, k ? '#e4e7e6' : '#fafaf7'], [1, k ? '#b8bebf' : '#d7dbda']]); x.fillRect(tx, h - 470, 40, 360);
      x.fillStyle = 'rgba(60,90,110,0.45)'; for (let y = h - 462; y < h - 120; y += 12) x.fillRect(tx + 3, y, 34, 5);
    });
    x.fillStyle = '#e9ecea'; x.fillRect(506, h - 330, 6, 220);
    // Senado (cúpula) e Câmara (cuia)
    x.fillStyle = lin(x, 240, h - 190, 360, h - 110, [[0, '#ffffff'], [1, '#c9cecf']]); x.beginPath(); x.ellipse(300, h - 110, 70, 64, 0, Math.PI, 0); x.fill();
    x.fillStyle = lin(x, 600, 0, 840, 0, [[0, '#ffffff'], [0.6, '#e4e7e6'], [1, '#aeb5b7']]);
    x.beginPath(); x.moveTo(600, h - 166); x.bezierCurveTo(640, h - 110, 800, h - 110, 840, h - 166); x.lineTo(780, h - 110); x.lineTo(660, h - 110); x.closePath(); x.fill();
    x.fillStyle = '#eef0ef'; x.beginPath(); x.ellipse(720, h - 166, 120, 16, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.ellipse(720, h - 164, 110, 10, 0, 0, 7); x.fill();
    haze(x, w, h, 0.03, 0.2); return c;
  };

  // ---------- CATEDRAL DE BRASÍLIA ----------
  B.catedral = () => {
    const w = 760, h = 560, c = canvas(w, h), x = c.getContext('2d');
    const cx = 330, base = h - 60, top = 120;
    x.fillStyle = lin(x, 0, base, 0, h, [[0, '#9cc985'], [1, '#79a964']]); x.fillRect(0, base, w, h - base);
    x.fillStyle = '#7fc3e8'; x.fillRect(60, base + 18, 560, 16);
    // vidro azul
    x.fillStyle = lin(x, cx - 170, 0, cx + 170, 0, [[0, '#4f86c6'], [0.5, '#9cc8ec'], [1, '#3e6fae']]);
    x.beginPath(); x.moveTo(cx - 175, base); x.quadraticCurveTo(cx - 40, base - 190, cx - 120, top + 40); x.lineTo(cx + 120, top + 40); x.quadraticCurveTo(cx + 40, base - 190, cx + 175, base); x.closePath(); x.fill();
    // 16 pilares curvos (os de trás mais escuros)
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, front = Math.sin(a) > 0; if (front !== !!pass) continue;
      const bx = cx + Math.cos(a) * 175, tx = cx + Math.cos(a) * 150, mx = cx + Math.cos(a) * 40;
      x.strokeStyle = front ? '#ffffff' : '#c9d2da'; x.lineWidth = front ? 13 : 9; x.lineCap = 'round';
      x.beginPath(); x.moveTo(bx, base); x.quadraticCurveTo(mx, base - 200, tx, top); x.stroke();
      if (front) { x.strokeStyle = 'rgba(120,130,140,0.35)'; x.lineWidth = 4; x.beginPath(); x.moveTo(bx + 4, base); x.quadraticCurveTo(mx + 4, base - 200, tx + 4, top); x.stroke(); }
    }
    // campanário
    x.fillStyle = '#f2f3f1'; x.fillRect(620, base - 300, 12, 300); x.fillRect(560, base - 300, 132, 10);
    x.fillStyle = '#a07a3b'; [578, 606, 646, 674].forEach((bx) => { x.beginPath(); x.moveTo(bx - 9, base - 270); x.quadraticCurveTo(bx, base - 296, bx + 9, base - 270); x.closePath(); x.fill(); });
    haze(x, w, h, 0.03, 0.2); return c;
  };

  // ---------- MASP ----------
  B.masp = () => {
    const w = 900, h = 430, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = lin(x, 0, h - 70, 0, h, [[0, '#c9ccd0'], [1, '#a9adb3']]); x.fillRect(0, h - 70, w, 70);
    // prédios da Paulista atrás
    const r = rnd(41); for (let i = 0; i < 9; i++) { const bw = 70 + r() * 50, bh = 160 + r() * 160, bx = i * 100 + r() * 20; x.fillStyle = '#b8c6d3'; x.fillRect(bx, h - 70 - bh, bw, bh); x.fillStyle = 'rgba(255,255,255,0.35)'; for (let y = h - 60 - bh; y < h - 80; y += 16) x.fillRect(bx + 6, y, bw - 12, 4); }
    // caixa de vidro suspensa
    x.fillStyle = lin(x, 0, h - 300, 0, h - 170, [[0, '#4c5761'], [1, '#2e363d']]); x.fillRect(150, h - 300, 600, 130);
    x.fillStyle = 'rgba(170,200,220,0.35)'; for (let bx = 156; bx < 744; bx += 22) x.fillRect(bx, h - 292, 14, 114);
    x.fillStyle = 'rgba(255,255,255,0.12)'; U.poly(x, [150, h - 300, 330, h - 300, 230, h - 170, 150, h - 170]); x.fill();
    // pórticos vermelhos
    const red = lin(x, 0, h - 330, 0, h - 70, [[0, '#ef4133'], [1, '#b3241a']]);
    x.fillStyle = red; x.fillRect(130, h - 330, 36, 260); x.fillRect(734, h - 330, 36, 260); x.fillRect(130, h - 330, 640, 28); x.fillRect(130, h - 176, 640, 18);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(156, h - 330, 10, 260); x.fillRect(760, h - 330, 10, 260);
    // vão livre com gente
    const p = rnd(42); for (let i = 0; i < 22; i++) { const px = 190 + p() * 520; x.fillStyle = ['#334155', '#b91c1c', '#0f766e', '#ca8a04'][i % 4]; x.fillRect(px, h - 96, 5, 14); x.fillStyle = '#c98c64'; x.beginPath(); x.arc(px + 2.5, h - 100, 3, 0, 7); x.fill(); }
    haze(x, w, h, 0.03, 0.18); return c;
  };

  // ---------- PONTE ESTAIADA ----------
  B.estaiada = () => {
    const w = 1100, h = 640, c = canvas(w, h), x = c.getContext('2d');
    sea(x, w, h, h - 60, 51);
    const cx = 550, top = 40, deckY = h - 150;
    // cabos
    for (let i = 0; i < 14; i++) {
      const y = top + 60 + i * 20;
      x.strokeStyle = `rgba(250,250,250,${0.65 + i * 0.02})`; x.lineWidth = 2;
      x.beginPath(); x.moveTo(cx, y); x.lineTo(cx - 460 + i * 26, deckY + 6); x.moveTo(cx, y); x.lineTo(cx + 460 - i * 26, deckY + 6); x.stroke();
    }
    // mastro em X
    const m = lin(x, cx - 60, 0, cx + 60, 0, [[0, '#f5f5f3'], [1, '#bfc3c6']]);
    x.fillStyle = m; U.poly(x, [cx - 80, deckY + 40, cx - 52, deckY + 40, cx + 22, top, cx + 4, top]); x.fill();
    U.poly(x, [cx + 80, deckY + 40, cx + 52, deckY + 40, cx - 22, top, cx - 4, top]); x.fill();
    // tabuleiros curvos
    x.fillStyle = lin(x, 0, deckY, 0, deckY + 22, [[0, '#d9dcde'], [1, '#8f969b']]);
    x.beginPath(); x.moveTo(40, deckY + 30); x.quadraticCurveTo(cx, deckY - 30, w - 40, deckY + 30); x.lineTo(w - 40, deckY + 50); x.quadraticCurveTo(cx, deckY - 8, 40, deckY + 50); x.closePath(); x.fill();
    x.fillStyle = 'rgba(0,0,0,0.2)'; [200, 420, 680, 900].forEach((px) => x.fillRect(px, deckY + 30, 14, h - 60 - deckY - 30));
    haze(x, w, h, 0.03, 0.2); return c;
  };

  // ---------- ELEVADOR LACERDA ----------
  B.lacerda = () => {
    const w = 900, h = 580, c = canvas(w, h), x = c.getContext('2d');
    sea(x, w, h, h - 50, 61);
    // encosta da Cidade Alta
    x.beginPath(); x.moveTo(0, h - 50); x.lineTo(0, 210); x.lineTo(420, 210); x.bezierCurveTo(440, 300, 470, 420, 500, h - 50); x.closePath();
    x.save(); x.clip(); forest(x, w, h, 62, 0.8, ['#3c6a45', '#4f8455', '#679a60', '#7fb06c']); x.restore();
    // casario colorido do Pelourinho
    const cols = ['#f2c14e', '#e76f51', '#2a9d8f', '#f4a1c1', '#8ecae6', '#e9c46a', '#b5e48c'];
    for (let i = 0; i < 8; i++) { const hx = 10 + i * 50, hh = 60 + (i % 3) * 18; x.fillStyle = cols[i % cols.length]; x.fillRect(hx, 210 - hh, 48, hh); x.fillStyle = '#b5523b'; x.fillRect(hx - 2, 210 - hh - 8, 52, 10); x.fillStyle = 'rgba(40,40,60,0.55)'; x.fillRect(hx + 8, 210 - hh + 16, 10, 16); x.fillRect(hx + 30, 210 - hh + 16, 10, 16); }
    // torre art déco
    x.fillStyle = lin(x, 520, 0, 640, 0, [[0, '#fbf3e2'], [1, '#d4c7aa']]); x.fillRect(520, 130, 120, h - 180);
    x.fillStyle = 'rgba(140,120,90,0.35)'; for (let px = 532; px < 632; px += 18) x.fillRect(px, 150, 6, h - 220);
    x.fillStyle = '#fbf3e2'; x.fillRect(510, 110, 140, 30); x.fillRect(400, 190, 130, 26);   // topo e passarela
    x.fillStyle = 'rgba(60,80,100,0.55)'; for (let px = 410; px < 520; px += 16) x.fillRect(px, 196, 10, 12);
    // Mercado Modelo
    x.fillStyle = '#efe2c8'; x.fillRect(680, h - 140, 200, 90); x.fillStyle = '#c49a6c'; x.fillRect(674, h - 152, 212, 14);
    x.fillStyle = 'rgba(90,70,50,0.5)'; for (let px = 692; px < 870; px += 26) x.fillRect(px, h - 124, 14, 30);
    haze(x, w, h, 0.03, 0.2); return c;
  };

  // ---------- TEATRO AMAZONAS ----------
  B.amazonas = () => {
    const w = 860, h = 560, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#c9b38e'; x.fillRect(0, h - 50, w, 50);
    for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? '#2b2b2b' : '#f3f3f3'; x.beginPath(); x.ellipse(i * 22, h - 26, 11, 6, 0, 0, 7); x.fill(); }   // calçada de ondas
    // fachada rosa
    const fx = 180, fw = 500, fy = h - 260;
    x.fillStyle = lin(x, fx, 0, fx + fw, 0, [[0, '#f7c3c0'], [1, '#d99b97']]); x.fillRect(fx, fy, fw, 210);
    x.fillStyle = '#fbf3e6'; x.fillRect(fx - 10, fy - 14, fw + 20, 18); x.fillRect(fx - 10, fy + 90, fw + 20, 10);
    U.poly(x, [fx + 150, fy - 14, fx + fw / 2, fy - 70, fx + fw - 150, fy - 14]); x.fill();
    for (let i = 0; i < 10; i++) { const px = fx + 30 + i * 48; x.fillStyle = lin(x, px, 0, px + 16, 0, [[0, '#ffffff'], [1, '#d7d0c4']]); x.fillRect(px, fy + 100, 16, 110); x.fillRect(px, fy + 6, 16, 80); }
    x.fillStyle = 'rgba(80,50,50,0.4)'; for (let i = 0; i < 9; i++) { const px = fx + 52 + i * 48; x.fillRect(px, fy + 20, 18, 50); x.fillRect(px, fy + 130, 18, 70); }
    // cúpula de azulejos (verde, amarelo e azul)
    const dx = fx + fw / 2, dy = fy - 70, R = 120;
    x.save(); x.beginPath(); x.ellipse(dx, dy, R, R * 1.05, 0, Math.PI, 0); x.clip();
    for (let yy = dy - R * 1.1; yy < dy; yy += 14) for (let xx = dx - R; xx < dx + R; xx += 14) {
      const k = (Math.floor((xx - dx) / 14) + Math.floor(yy / 14)) % 3;
      x.fillStyle = ['#1f9d55', '#f2c230', '#2f66c4'][(k + 3) % 3];
      U.poly(x, [xx, yy + 7, xx + 7, yy, xx + 14, yy + 7, xx + 7, yy + 14]); x.fill();
    }
    x.fillStyle = lin(x, dx - R, 0, dx + R, 0, [[0, 'rgba(255,255,255,0.25)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]); x.fillRect(dx - R, dy - R * 1.1, R * 2, R * 1.1);
    x.restore();
    x.fillStyle = '#fbf3e6'; x.fillRect(dx - 10, dy - R * 1.05 - 34, 20, 36); x.beginPath(); x.arc(dx, dy - R * 1.05 - 36, 12, Math.PI, 0); x.fill();
    palm(x, 90, h - 50, 230, -20, 1.2); palm(x, 780, h - 50, 210, 24, 1.1);
    haze(x, w, h, 0.03, 0.18); return c;
  };

  // ---------- CATARATAS DO IGUAÇU ----------
  B.iguacu = () => {
    const w = 1100, h = 600, c = canvas(w, h), x = c.getContext('2d');
    // mata no alto e paredões em degraus
    x.save(); x.beginPath(); x.rect(0, 120, w, 120); x.clip(); forest(x, w, 260, 71, 0.9); x.restore();
    x.fillStyle = lin(x, 0, 220, 0, h, [[0, '#7a6a55'], [1, '#4f4436']]); x.fillRect(0, 220, w, h - 220);
    x.save(); x.beginPath(); x.rect(0, 380, w, 60); x.clip(); forest(x, w, 460, 72, 0.5); x.restore();
    // quedas d'água
    const falls = [[40, 120], [190, 90], [320, 140], [500, 180], [720, 130], [890, 160]];
    falls.forEach(([fx, fw]) => {
      x.fillStyle = lin(x, 0, 220, 0, h - 70, [[0, 'rgba(255,255,255,0.97)'], [1, 'rgba(210,235,250,0.95)']]);
      x.beginPath(); x.moveTo(fx, 226); x.lineTo(fx + fw, 226); x.lineTo(fx + fw + 12, h - 70); x.lineTo(fx - 12, h - 70); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(150,190,215,0.6)'; x.lineWidth = 2; for (let k = fx + 8; k < fx + fw; k += 14) { x.beginPath(); x.moveTo(k, 230); x.lineTo(k + 6, h - 80); x.stroke(); }
    });
    // rio e névoa
    x.fillStyle = lin(x, 0, h - 80, 0, h, [[0, '#7aa7a0'], [1, '#4f7f7a']]); x.fillRect(0, h - 80, w, 80);
    for (let i = 0; i < 30; i++) { x.fillStyle = 'rgba(255,255,255,0.45)'; x.beginPath(); x.ellipse(i * 40, h - 76, 50, 26, 0, 0, 7); x.fill(); }
    // arco-íris
    x.lineWidth = 8; ['rgba(255,80,80,0.32)', 'rgba(255,190,60,0.32)', 'rgba(250,240,90,0.30)', 'rgba(90,200,110,0.30)', 'rgba(70,140,240,0.30)', 'rgba(140,90,220,0.28)'].forEach((col, i) => { x.strokeStyle = col; x.beginPath(); x.arc(560, h - 40, 330 - i * 8, Math.PI * 1.08, Math.PI * 1.92); x.stroke(); });
    haze(x, w, h, 0.03, 0.15); return c;
  };
  B.iguacuLive = (ctx, ox, oy, t) => {   // água descendo
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    [[40, 120], [190, 90], [320, 140], [500, 180], [720, 130], [890, 160]].forEach(([fx, fw], i) => {
      for (let k = 0; k < 5; k++) { const yy = 230 + ((t * 260 + k * 70 + i * 37) % 300); ctx.fillRect(ox + fx + 6 + k * (fw / 5), oy + yy, 4, 26); }
    });
  };

  // ---------- PONTE HERCÍLIO LUZ ----------
  B.hercilio = () => {
    const w = 1100, h = 560, c = canvas(w, h), x = c.getContext('2d');
    // morros ao fundo
    x.fillStyle = '#7e9f86'; x.beginPath(); x.moveTo(0, h - 60); x.bezierCurveTo(120, 300, 260, 320, 380, h - 60); x.fill();
    x.beginPath(); x.moveTo(700, h - 60); x.bezierCurveTo(850, 280, 1000, 320, w, h - 60); x.fill();
    sea(x, w, h, h - 60, 81);
    const t1 = 300, t2 = 800, top = 120, deck = h - 140;
    // cabo principal (barras de olhal) e treliça
    x.strokeStyle = '#eceff1'; x.lineWidth = 7;
    x.beginPath(); x.moveTo(40, deck - 40); x.lineTo(t1, top); x.quadraticCurveTo((t1 + t2) / 2, deck + 140, t2, top); x.lineTo(w - 40, deck - 40); x.stroke();
    x.lineWidth = 2.5; x.strokeStyle = 'rgba(236,239,241,0.9)';
    for (let px = t1 + 20; px < t2; px += 26) { const u = (px - t1) / (t2 - t1), cy = (1 - u) * (1 - u) * top + 2 * (1 - u) * u * (deck + 140) + u * u * top; const yy = Math.min(cy, deck); x.beginPath(); x.moveTo(px, yy); x.lineTo(px, deck); x.stroke(); }
    // torres de treliça de aço
    [t1, t2].forEach((tx) => {
      x.strokeStyle = '#f4f6f7'; x.lineWidth = 6; x.beginPath(); x.moveTo(tx - 22, h - 60); x.lineTo(tx - 10, top - 20); x.moveTo(tx + 22, h - 60); x.lineTo(tx + 10, top - 20); x.stroke();
      x.lineWidth = 2; for (let y = top; y < h - 70; y += 26) { x.beginPath(); x.moveTo(tx - 18, y); x.lineTo(tx + 18, y + 26); x.moveTo(tx + 18, y); x.lineTo(tx - 18, y + 26); x.stroke(); }
    });
    x.fillStyle = lin(x, 0, deck, 0, deck + 16, [[0, '#d7dbde'], [1, '#8d9499']]); x.fillRect(20, deck, w - 40, 16);
    haze(x, w, h, 0.03, 0.18); return c;
  };

  // ---------- FAROL DA BARRA ----------
  B.barra = () => {
    const w = 860, h = 520, c = canvas(w, h), x = c.getContext('2d');
    sea(x, w, h, h - 70, 91);
    x.fillStyle = '#f0d9a6'; x.beginPath(); x.moveTo(0, h - 60); x.quadraticCurveTo(200, h - 90, 400, h - 70); x.lineTo(400, h); x.lineTo(0, h); x.fill();
    // forte (polígono de pedra)
    x.fillStyle = lin(x, 0, h - 170, 0, h - 60, [[0, '#e8d8b6'], [1, '#c2ab80']]);
    U.poly(x, [250, h - 60, 290, h - 160, 620, h - 160, 660, h - 60]); x.fill();
    x.fillStyle = 'rgba(120,95,60,0.35)'; for (let px = 300; px < 610; px += 40) x.fillRect(px, h - 160, 22, 10);
    x.fillStyle = '#f4ecd9'; x.fillRect(470, h - 210, 120, 50); x.fillStyle = '#c2604b'; x.fillRect(466, h - 218, 128, 10);
    // farol listrado
    const lx = 380;
    x.save(); x.beginPath(); x.moveTo(lx - 30, h - 160); x.lineTo(lx - 20, h - 420); x.lineTo(lx + 20, h - 420); x.lineTo(lx + 30, h - 160); x.closePath(); x.clip();
    for (let y = h - 420; y < h - 160; y += 52) { x.fillStyle = '#f7f7f4'; x.fillRect(lx - 40, y, 80, 26); x.fillStyle = '#1d1d1f'; x.fillRect(lx - 40, y + 26, 80, 26); }
    x.fillStyle = lin(x, lx - 30, 0, lx + 30, 0, [[0, 'rgba(255,255,255,0.2)'], [1, 'rgba(0,0,0,0.3)']]); x.fillRect(lx - 40, h - 420, 80, 260);
    x.restore();
    x.fillStyle = '#2f3438'; x.fillRect(lx - 28, h - 432, 56, 12); x.fillStyle = '#ffe9a0'; x.fillRect(lx - 16, h - 466, 32, 34);
    x.fillStyle = '#2f3438'; U.poly(x, [lx - 22, h - 466, lx, h - 492, lx + 22, h - 466]); x.fill();
    palm(x, 120, h - 70, 170, -16); palm(x, 720, h - 64, 160, 18);
    haze(x, w, h, 0.03, 0.18); return c;
  };

  // ---------- LENÇÓIS MARANHENSES ----------
  B.lencois = () => {
    const w = 1100, h = 420, c = canvas(w, h), x = c.getContext('2d');
    const r = rnd(101);
    for (let layer = 0; layer < 3; layer++) {
      for (let i = -1; i < 7; i++) {
        const cx = i * 190 + layer * 70 + r() * 40, ch = 140 + r() * 110 - layer * 30, by = h - 40 - layer * 26;
        x.fillStyle = lin(x, cx - 160, 0, cx + 160, 0, [[0, '#fffaf0'], [0.55, '#f2e6cc'], [1, '#d9c7a1']]);
        x.beginPath(); x.moveTo(cx - 200, by); x.bezierCurveTo(cx - 90, by - ch, cx + 20, by - ch, cx + 60, by - ch * 0.9); x.quadraticCurveTo(cx + 120, by - ch * 0.4, cx + 200, by); x.closePath(); x.fill();
      }
      for (let i = 0; i < 5; i++) {
        const lx = 60 + i * 230 + r() * 60, ly = h - 34 - layer * 26;
        x.fillStyle = lin(x, 0, ly - 10, 0, ly + 10, [[0, '#6fd6e0'], [1, '#2aa6b8']]);
        x.beginPath(); x.ellipse(lx, ly, 70 + r() * 30, 9, 0, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(lx - 30, ly - 3, 40, 2);
      }
    }
    haze(x, w, h, 0.02, 0.12); return c;
  };

  const LIST = [
    { key: 'cristo', name: 'CRISTO REDENTOR', place: 'Rio de Janeiro · RJ' },
    { key: 'pao', name: 'PÃO DE AÇÚCAR', place: 'Rio de Janeiro · RJ', live: 'paoLive' },
    { key: 'congresso', name: 'CONGRESSO NACIONAL', place: 'Brasília · DF' },
    { key: 'masp', name: 'MASP', place: 'São Paulo · SP' },
    { key: 'iguacu', name: 'CATARATAS DO IGUAÇU', place: 'Foz do Iguaçu · PR', live: 'iguacuLive' },
    { key: 'lacerda', name: 'ELEVADOR LACERDA', place: 'Salvador · BA' },
    { key: 'amazonas', name: 'TEATRO AMAZONAS', place: 'Manaus · AM' },
    { key: 'estaiada', name: 'PONTE ESTAIADA', place: 'São Paulo · SP' },
    { key: 'catedral', name: 'CATEDRAL DE BRASÍLIA', place: 'Brasília · DF' },
    { key: 'hercilio', name: 'PONTE HERCÍLIO LUZ', place: 'Florianópolis · SC' },
    { key: 'barra', name: 'FAROL DA BARRA', place: 'Salvador · BA' },
    { key: 'lencois', name: 'LENÇÓIS MARANHENSES', place: 'Maranhão · MA' }
  ];
  const cache = {};
  function get(i) {
    const L = LIST[i % LIST.length];
    if (!cache[L.key]) { try { cache[L.key] = B[L.key](); } catch (e) { console.warn(e); cache[L.key] = canvas(2, 2); } }
    return { ...L, img: cache[L.key], liveFn: L.live ? B[L.live] : null };
  }

  CNB.Landmarks = { LIST, get, scale: 0.86 };
})();
