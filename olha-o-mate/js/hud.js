/* =========================================================================
   HUD — interface 9:16 para TikTok LIVE (Olha o Mate!)
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const FT = U.FONT_TITLE, FU = U.FONT_UI;

  // imagens oficiais dos presentes (config: img), indexadas pelo ícone de cada presente
  const GIFT_IMG = {};
  for (const k in CNB.CONFIG.gifts) {
    const def = CNB.CONFIG.gifts[k];
    if (def.img) { const im = new Image(); im.src = def.img; GIFT_IMG[def.icon] = im; }
  }
  const giftImage = (icon) => { const im = GIFT_IMG[icon]; return im && im.complete && im.naturalWidth ? im : null; };

  function giftIcon(ctx, icon, x, y, r, color) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = r * 0.1; ctx.stroke();
    const im = giftImage(icon);
    if (im) { const s = r * 1.7; ctx.drawImage(im, -s / 2, -s / 2, s, s); ctx.restore(); return; }
    ctx.scale(r / 30, r / 30); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (icon) {
      case 'rose':
        ctx.strokeStyle = '#3fa34d'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 20); ctx.stroke();
        ctx.fillStyle = '#e8244b'; [[-6, -6], [6, -6], [0, -12], [-4, 0], [4, 0]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 7, 0, 7); ctx.fill(); });
        ctx.fillStyle = '#9e0f2c'; ctx.beginPath(); ctx.arc(0, -5, 4, 0, 7); ctx.fill(); break;
      case 'note':
        ctx.lineWidth = 6;
        [['#25f4ee', -2, -2], ['#fe2c55', 2, 2], ['#ffffff', 0, 0]].forEach(([c, dx, dy]) => {
          ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(4 + dx, -18 + dy); ctx.lineTo(4 + dx, 8 + dy); ctx.arc(-3 + dx, 8 + dy, 7, 0, Math.PI * 1.9); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(4 + dx, -18 + dy); ctx.quadraticCurveTo(8 + dx, -8 + dy, 16 + dx, -8 + dy); ctx.stroke();
        }); break;
      case 'bolt':
        ctx.fillStyle = '#ffd23f'; U.poly(ctx, [4, -22, -12, 3, -1, 3, -5, 22, 13, -5, 2, -5, 8, -22]); ctx.fill(); break;
      case 'magnet':
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 9; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI, 0); ctx.lineTo(12, 14); ctx.moveTo(-12, 0); ctx.lineTo(-12, 14); ctx.stroke();
        ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-16.5, 10, 9, 7); ctx.fillRect(7.5, 10, 9, 7); break;
      case 'back':
        ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(2, 2, 13, -Math.PI * 0.9, Math.PI * 0.7); ctx.stroke();
        ctx.fillStyle = '#c4b5fd'; U.poly(ctx, [-20, -6, -6, -12, -12, 4]); ctx.fill(); break;
      case 'wet':
        ctx.fillStyle = '#facc15'; U.poly(ctx, [-12, 18, -4, -18, 4, -18, 12, 18, 7, 18, 2, -10, -2, -10, -7, 18]); ctx.fill();
        ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(6, 4, 0, 9); ctx.quadraticCurveTo(-6, 4, 0, -4); ctx.fill(); break;
      case 'tag':
        ctx.fillStyle = '#fb7185'; U.poly(ctx, [-16, -6, -2, -20, 18, -20, 18, 0, 4, 14]); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(11, -13, 3, 0, 7); ctx.fill();
        ctx.font = `900 13px ${FU}`; ctx.textAlign = 'center'; ctx.fillText('%', 0, 2); break;
      case 'follow':   // botão "+" vermelho de seguir do TikTok
        ctx.fillStyle = '#fe2c55'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke(); break;
      case 'horn':   // buzina
        ctx.fillStyle = '#38bdf8'; U.poly(ctx, [-16, -7, -6, -7, 10, -17, 10, 17, -6, 7, -16, 7]); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        [8, 14].forEach((r) => { ctx.beginPath(); ctx.arc(10, 0, r, -0.7, 0.7); ctx.stroke(); }); break;
      case 'loop':
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, -2, 13, 0.3, Math.PI * 2.1); ctx.stroke();
        ctx.fillStyle = '#38bdf8'; U.poly(ctx, [12, 4, 22, -6, 4, -8]); ctx.fill(); break;
      case 'bird':
        ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-20, -6); ctx.quadraticCurveTo(-8, -2, 0, 6); ctx.quadraticCurveTo(8, -2, 20, -6); ctx.stroke(); break;
      case 'shield':
        ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, -12); ctx.quadraticCurveTo(16, 10, 0, 20); ctx.quadraticCurveTo(-16, 10, -16, -12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(9, -7); ctx.quadraticCurveTo(9, 6, 0, 12); ctx.closePath(); ctx.fill(); break;
      case 'bouquet':
        ctx.strokeStyle = '#3fa34d'; ctx.lineWidth = 3; [-8, 0, 8].forEach((dx) => { ctx.beginPath(); ctx.moveTo(dx * 0.4, 18); ctx.lineTo(dx, -4); ctx.stroke(); });
        ctx.fillStyle = '#f472b6'; [[-9, -8], [0, -14], [9, -8], [-4, -2], [5, -2]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 6, 0, 7); ctx.fill(); }); break;
      case 'confetti':
        ['#facc15', '#f472b6', '#38bdf8', '#4ade80', '#fb923c'].forEach((c2, i) => { ctx.fillStyle = c2; ctx.save(); ctx.rotate(i * 1.3); ctx.fillRect(4 + i * 2, -3, 9, 5); ctx.restore(); });
        ctx.fillStyle = '#facc15'; U.poly(ctx, [-18, 18, -6, -6, 6, 6]); ctx.fill(); break;
      case 'moneygun':
        ctx.fillStyle = '#4ade80'; U.roundRect(ctx, -18, -10, 30, 14, 4); ctx.fill(); ctx.fillRect(-14, 2, 8, 14);
        ctx.fillStyle = '#bbf7d0'; ctx.fillRect(12, -14, 10, 6); ctx.fillRect(14, -4, 10, 6); break;
      case 'share':
        ctx.fillStyle = '#60a5fa'; U.poly(ctx, [-16, 10, -16, 2, 4, -6, 4, -16, 20, 0, 4, 16, 4, 6, -8, 8]); ctx.fill(); break;
      case 'like':
        ctx.fillStyle = '#fb7185'; ctx.beginPath(); ctx.moveTo(0, 16); ctx.bezierCurveTo(-24, 0, -12, -20, 0, -8); ctx.bezierCurveTo(12, -20, 24, 0, 0, 16); ctx.fill(); break;
      case 'card':
        ctx.fillStyle = '#e879f9'; U.roundRect(ctx, -18, -12, 36, 24, 4); ctx.fill();
        ctx.fillStyle = '#1a0820'; ctx.fillRect(-18, -6, 36, 5);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, -18); ctx.lineTo(8, 18); ctx.moveTo(8, -18); ctx.lineTo(-8, 18); ctx.stroke(); break;
    }
    ctx.restore();
  }

  function glass(ctx, x, y, w, h, r, a = 0.6) {
    U.roundRect(ctx, x, y, w, h, r); ctx.fillStyle = `rgba(14,12,22,${a})`; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();
  }
  function outlined(ctx, text, x, y, fill, stroke = 'rgba(0,0,0,0.85)', lw = 8) {
    ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function cartIcon(ctx, x, y, s, color = '#fff') {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = color; ctx.lineWidth = 3.2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16, -12); ctx.lineTo(-11, -12); ctx.lineTo(-6, 6); ctx.lineTo(13, 6); ctx.lineTo(16, -7); ctx.lineTo(-9, -7); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-4, 12, 2.8, 0, 7); ctx.arc(11, 12, 2.8, 0, 7); ctx.fill();
    ctx.restore();
  }
  function wrap(ctx, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    lines.push(cur); return lines;
  }

  function stars(ctx, x, y, r, value, color = '#ffd23f') {
    for (let i = 0; i < 5; i++) {
      const f = U.clamp(value - i, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; U.star(ctx, x + i * r * 2.3, y, r, r * 0.45, 5); ctx.fill();
      if (f > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x + i * r * 2.3 - r, y - r, r * 2 * f, r * 2); ctx.clip(); ctx.fillStyle = color; U.star(ctx, x + i * r * 2.3, y, r, r * 0.45, 5); ctx.fill(); ctx.restore(); }
    }
  }
  function arrow(ctx, x, y, s, type) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (type === 'dest') {
      ctx.fillStyle = '#fe2c55'; ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 0.5, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(0, s * 0.7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 0.2, 0, 7); ctx.fill();
    } else {
      const d = type === 'right' ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(-d * s * 0.2, s * 0.6); ctx.lineTo(-d * s * 0.2, -s * 0.1); ctx.quadraticCurveTo(-d * s * 0.2, -s * 0.35, d * s * 0.1, -s * 0.35); ctx.lineTo(d * s * 0.35, -s * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(d * s * 0.62, -s * 0.35); ctx.lineTo(d * s * 0.3, -s * 0.62); ctx.lineTo(d * s * 0.3, -s * 0.08); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  const VERSAO = 'versão 05/11';
  class HUD {
    constructor(game) {
      this.g = game; this.banners = []; this.card = null; this.bubbles = [];
      this.qr = new Image(); this.qr.src = game.cfg.qrImage; this.linkRect = null;
    }
    banner(title, sub, color = '#ffd23f', dur = 1.9) { this.banners = [{ title, sub, color, dur, age: 0 }]; }
    clearBanners() { this.banners = []; }
    showCard(d) { this.card = { ...d, age: 0, dur: 1.4 }; }
    bubble(who, text, dur) { this.bubbles = this.bubbles.filter((b) => b.who !== who); this.bubbles.push({ who, text, dur, age: 0 }); }
    update(dt) {
      this.banners.forEach((b) => (b.age += dt)); this.banners = this.banners.filter((b) => b.age < b.dur);
      if (this.card) { this.card.age += dt; if (this.card.age > this.card.dur) this.card = null; }
      this.bubbles.forEach((b) => (b.age += dt)); this.bubbles = this.bubbles.filter((b) => b.age < b.dur);
    }
    actionText(def) {
      switch (def.action) {
        case 'advance': return `empurrão +${def.amount} m`;
        case 'turbo': return def.rush ? `todos compram ${def.duration}s` : `corre ${def.duration}s`;
        case 'gull': return `gaivota: volta ${def.amount} m`;
        case 'gameover': return 'O RAPA leva o isopor';
        case 'follow': return `vendedor volta ${def.back || 3} m`;
      }
      return '';
    }

    draw(ctx, t) {
      const g = this.g, top = g.cfg.ui.safeTop;
      if (g.mode === 'loading') return this.drawLoading(ctx, t);
      if (g.mode === 'title') return this.drawTitle(ctx, t);
      if (g.mode === 'playing' || g.mode === 'rapa' || g.mode === 'arrive') {
        this.drawTop(ctx, top, t);
        this.drawFeed(ctx, top + 250);
        this.drawRanking(ctx, top + 250);
        this.drawBubbles(ctx, t);
        if (g.mode === 'arrive') this.drawFinal(ctx, t);
        this.drawBanners(ctx, t);
        if (g.control === 'manual' && g.mode === 'playing') this.drawFlapHint(ctx, t);
      }
      if (g.mode === 'win') this.drawSummary(ctx, t);
      if (g.mode === 'gameover') { this.drawBanners(ctx, t); this.drawGameOver(ctx, t); }
      // lista de presentes fixa na tela o tempo todo (por cima de tudo)
      if (g.cfg.ui.giftGuide) this.drawGiftGuide(ctx, top + 250 + 214 + 12, t);
    }

    drawLoading(ctx, t) {
      ctx.fillStyle = '#0e0c16'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.font = `90px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText('OLHA O MATE!', W / 2, 900);
      ctx.font = `600 30px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Enchendo os galões' + '.'.repeat(1 + Math.floor(t * 3) % 3), W / 2, 970);
    }

    drawTop(ctx, top, t) {
      const g = this.g, w = g.world, v = g.vendor;
      glass(ctx, 36, top, 1008, 150, 28);
      ctx.textAlign = 'left'; ctx.font = `50px ${FT}`;
      ctx.save(); ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.fillText('OLHA O MATE!', 66, top + 58); ctx.restore();
      ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`RODADA ${g.roundNo}  •  ${U.fmtTime(g.roundTime)}`, 350, top + 52);
      const left = w.left;
      ctx.textAlign = 'right'; ctx.font = `600 20px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('METROS PRO POSTO 6', 1012, top + 28);
      ctx.font = `70px ${FT}`; ctx.fillStyle = left < 60 ? '#ffd23f' : '#fff'; ctx.fillText(left.toLocaleString('pt-BR'), 1012, top + 90);
      // trilha da areia com os postos
      const x0 = 70, x1 = 960, y = top + 122;
      U.roundRect(ctx, x0, y - 8, x1 - x0, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      const f = U.clamp(w.x / w.goalX, 0, 1), px = x0 + (x1 - x0) * f;
      const gr = ctx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#fcd34d'); gr.addColorStop(1, '#f59e0b');
      U.roundRect(ctx, x0, y - 8, Math.max(16, px - x0), 16, 8); ctx.fillStyle = gr; ctx.fill();
      for (let i = 1; i <= 3; i++) { const mx = x0 + (x1 - x0) * i / 4; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(mx - 1, y - 12, 3, 24); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, y, 13, 0, 7); ctx.fill(); ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(px, y, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#16a34a'; ctx.beginPath(); ctx.arc(x1 + 30, y, 22, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 13px ${FU}`; ctx.textAlign = 'center'; ctx.fillText('P6', x1 + 30, y + 5);
      // vendas
      const sy = top + 164;
      glass(ctx, 36, sy, 620, 72, 32, 0.8);
      ctx.textAlign = 'left'; ctx.font = `34px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('VENDAS', 62, sy + 48);
      ctx.font = `44px ${FT}`; ctx.fillStyle = '#4ade80'; ctx.fillText(`R$ ${g.money}`, 200, sy + 52);
      ctx.font = `700 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(`${g.sold} ${g.sold === 1 ? 'mate' : 'mates'}` + (g.lost ? `  ·  ${g.lost} derramado${g.lost > 1 ? 's' : ''}` : ''), 360, sy + 46);
      // poderes / cabo de guerra
      let bx = 668;
      const pill = (label, color, icon, val) => {
        glass(ctx, bx, sy, 376, 72, 34, 0.78);
        giftIcon(ctx, icon, bx + 34, sy + 36, 22, color);
        ctx.textAlign = 'left'; ctx.font = `34px ${FT}`; ctx.fillStyle = color; ctx.fillText(`${label} ${Math.ceil(val)}s`, bx + 64, sy + 48);
        bx += 384;
      };
      if (v.turbo > 0) pill(v.rush ? 'CHUVA DE CLIENTES' : 'CORRENDO', v.rush ? '#4ade80' : '#25f4ee', v.rush ? 'moneygun' : 'note', v.turbo);
      if (bx === 668) {
        glass(ctx, 668, sy, 376, 72, 34, 0.7);
        const hp = g.helpM, sb = g.sabM, tot = Math.max(1, hp + sb), mid = 690 + 330 * (hp / tot);
        ctx.fillStyle = '#22c55e'; U.roundRect(ctx, 690, sy + 46, Math.max(8, mid - 690), 14, 7); ctx.fill();
        ctx.fillStyle = '#ef4444'; U.roundRect(ctx, mid, sy + 46, Math.max(8, 1020 - mid), 14, 7); ctx.fill();
        ctx.textAlign = 'left'; ctx.font = `800 17px ${FU}`; ctx.fillStyle = '#86efac'; ctx.fillText(`HERÓI +${Math.round(hp)} m`, 690, sy + 36);
        ctx.textAlign = 'right'; ctx.fillStyle = '#fca5a5'; ctx.fillText(`VILÃO −${Math.round(sb)} m`, 1020, sy + 36);
      }
      // COMBO
      if (g.combo > 1 && g.time - g.comboT < g.cfg.combo.window) {
        const k = U.clamp((g.cfg.combo.window - (g.time - g.comboT)) / g.cfg.combo.window, 0, 1);
        ctx.save(); ctx.translate(360, 1480); ctx.rotate(-0.05); ctx.scale(1 + Math.sin(t * 12) * 0.03, 1 + Math.sin(t * 12) * 0.03);
        ctx.textAlign = 'center'; ctx.font = `60px ${FT}`; outlined(ctx, `COMBO x${g.combo}`, 0, 0, '#ffd23f', '#3a1d00', 10); ctx.font = `800 24px ${FU}`; outlined(ctx, `próximo presente ${g.comboMul().toFixed(2).replace('.', ',')}× mais forte`, 0, 48, '#fff', '#3a1d00', 6);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; U.roundRect(ctx, -160, 64, 320, 10, 5); ctx.fill(); ctx.fillStyle = '#ffd23f'; U.roundRect(ctx, -160, 64, 320 * k, 10, 5); ctx.fill();
        ctx.restore();
      }
    }

    drawFeed(ctx, y0) {
      const g = this.g, now = performance.now() / 1000;
      g.gifts.feed.filter((f) => now - f.t < 6).slice(0, 3).forEach((f, i) => {
        const age = now - f.t, slide = U.easeOutBack(U.clamp(age * 3, 0, 1)), fade = U.clamp((6 - age) / 0.6, 0, 1), y = y0 + i * 74;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(-420 * (1 - slide), 0);
        glass(ctx, 36, y, 370, 64, 32, 0.66);
        giftIcon(ctx, f.def.icon, 70, y + 32, 24, f.def.color);
        ctx.textAlign = 'left'; ctx.font = `700 21px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(U.truncate(f.user, 16), 104, y + 28);
        ctx.font = `600 18px ${FU}`; ctx.fillStyle = f.def.color; ctx.fillText(U.truncate(this.actionText(f.def), 26), 104, y + 52);
        ctx.restore();
      });
    }

    // guia de presentes: aparece no começo e de tempos em tempos (para não tampar os obstáculos)
    // guia de presentes SEMPRE visível: cada presente, quanto custa e o que faz
    drawGiftGuide(ctx, y0, t) {
      const g = this.g, G = g.cfg.gifts, keys = Object.keys(G);
      const help = keys.filter((k) => G[k].team !== 'vilao'), sab = keys.filter((k) => G[k].team === 'vilao');
      const groups = [['HERÓI', '#4ade80', help], ['VILÃO', '#f87171', sab]].filter((x) => x[2].length);
      const rowH = 72, headH = 30, h = 58 + groups.length * headH + keys.length * rowH + 8;
      ctx.save();
      glass(ctx, 718, y0, 326, h, 24, 0.82);
      ctx.textAlign = 'left'; ctx.font = `32px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('MANDE E VEJA', 740, y0 + 40);
      let y = y0 + 52;
      for (const [title, col, list] of groups) {
        ctx.fillStyle = col; ctx.font = `900 15px ${FU}`; ctx.fillText(title, 740, y + 21); ctx.fillRect(740 + ctx.measureText(title).width + 8, y + 15, 1020 - (740 + ctx.measureText(title).width + 8), 2);
        y += headH;
        for (const k of list) {
          const def = G[k];
          giftIcon(ctx, def.icon, 768, y + 34, 32, def.color);
          ctx.textAlign = 'left'; ctx.font = `800 23px ${FU}`; ctx.fillStyle = '#fff';
          ctx.fillText(U.truncate(def.tiktok || def.label, 20), 810, y + 30);
          ctx.font = `700 18px ${FU}`; ctx.fillStyle = def.color; ctx.fillText(U.truncate(this.actionText(def), 24), 810, y + 54);
          y += rowH;
        }
      }
      ctx.restore();
    }

    drawRanking(ctx, y0) {
      const g = this.g, list = g.gifts.ranking(g.cfg.ui.rankingSize);
      glass(ctx, 724, y0, 320, 64 + 3 * 50, 26, 0.55);
      ctx.textAlign = 'left'; ctx.font = `30px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('HERÓIS DA PRAIA', 748, y0 + 42);
      ctx.textAlign = 'right'; ctx.font = `600 18px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText(`${g.gifts.totalGifts} 🎁`, 1022, y0 + 40);
      if (!list.length) { ctx.textAlign = 'left'; ctx.font = `500 20px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText('Mande um presente!', 748, y0 + 92); return; }
      const medal = ['#ffd23f', '#d6dbe4', '#d08a4a'];
      list.forEach((u, i) => {
        const y = y0 + 84 + i * 50;
        ctx.fillStyle = medal[i]; ctx.beginPath(); ctx.arc(762, y - 7, 16, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1420'; ctx.font = `800 18px ${FU}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), 762, y - 1);
        ctx.textAlign = 'left'; ctx.font = `600 21px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(U.truncate(u.name, 14), 788, y);
        ctx.textAlign = 'right'; ctx.font = `800 21px ${FU}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(String(u.points), 1022, y);
      });
    }

    // chegada no quiosque
    drawFinal(ctx, t) {
      const g = this.g;
      ctx.textAlign = 'center'; ctx.font = `120px ${FT}`;
      ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 30; outlined(ctx, `R$ ${g.money}`, W / 2, 820, '#4ade80', '#052e16', 14); ctx.restore();
      ctx.font = `800 34px ${FU}`; outlined(ctx, `${g.sold} mates vendidos na areia`, W / 2, 870, '#fff', '#052e16', 8);
    }

    // produto saindo do avião para o caminhão
    drawCard(ctx, t) {
      const c = this.card; if (!c) return;
      const inT = U.easeOutBack(U.clamp(c.age * 5, 0, 1)), out = U.clamp((c.dur - c.age) / 0.25, 0, 1);
      const w = 760, h = 200, x = (W - w) / 2, y = 900;
      ctx.save(); ctx.globalAlpha = out; ctx.translate(W / 2, y + h / 2); ctx.scale(inT, inT); ctx.translate(-W / 2, -(y + h / 2));
      glass(ctx, x, y, w, h, 30, 0.9);
      ctx.strokeStyle = '#82e8cc'; ctx.lineWidth = 4; U.roundRect(ctx, x, y, w, h, 30); ctx.stroke();
      this.g.catalog.drawPhoto(ctx, c.item, x + 18, y + 18, h - 36, 18);
      const tx = x + h + 4;
      ctx.textAlign = 'left'; ctx.font = `40px ${FT}`; ctx.fillStyle = '#82e8cc'; ctx.fillText(`CAIXA ${c.n}`, tx, y + 52);
      ctx.font = `700 24px ${FU}`; ctx.fillStyle = '#fff';
      wrap(ctx, c.item.short, w - h - 30).slice(0, 2).forEach((l, i) => ctx.fillText(l, tx, y + 92 + i * 30));
      ctx.font = `44px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(CNB.fmtBRL(c.item.price), tx, y + 176);
      ctx.restore();
    }

    drawBubbles(ctx, t) {
      for (const b of this.bubbles) {
        const g = this.g, anchor = g.vendor.headScreen;
        if (!anchor) continue;
        const pop = U.easeOutBack(U.clamp(b.age * 5, 0, 1)), fade = U.clamp((b.dur - b.age) / 0.3, 0, 1);
        ctx.font = `800 30px ${FU}`;
        const text = b.who === 'torre' ? '📡 ' + b.text : b.text;
        const lines = wrap(ctx, text, 520), lh = 36, bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44, bh = lines.length * lh + 26;
        const bx = U.clamp(anchor.x - bw / 2, 30, W - bw - 30), by = U.clamp(anchor.y - bh - 30, 430, 1600);
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(anchor.x, by + bh); ctx.scale(pop, pop); ctx.translate(-anchor.x, -(by + bh));
        ctx.fillStyle = b.who === 'torre' ? '#e3ecff' : '#ffffff';
        U.roundRect(ctx, bx, by, bw, bh, 22); ctx.fill();
        if (b.who !== 'torre') { ctx.beginPath(); ctx.moveTo(U.clamp(anchor.x - 14, bx + 24, bx + bw - 44), by + bh - 2); ctx.lineTo(U.clamp(anchor.x + 16, bx + 44, bx + bw - 24), by + bh - 2); ctx.lineTo(anchor.x, anchor.y - 6); ctx.closePath(); ctx.fill(); }
        ctx.strokeStyle = '#1b1410'; ctx.lineWidth = 3; U.roundRect(ctx, bx, by, bw, bh, 22); ctx.stroke();
        ctx.fillStyle = '#1b1410'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 13 + lh / 2 + i * lh));
        ctx.restore(); ctx.textBaseline = 'alphabetic';
      }
    }

    drawBanners(ctx, t) {
      this.banners.forEach((b) => {
        const u = b.age / b.dur, inT = U.clamp(b.age / 0.28, 0, 1);
        const sc = U.easeOutBack(inT) * (1 + (u > 0.8 ? (u - 0.8) * 0.6 : 0)), a = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 1220); ctx.scale(sc, sc); ctx.rotate(-0.04);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `100px ${FT}`;
        ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 30; outlined(ctx, b.title, 0, 0, b.color, '#120c18', 14); ctx.restore();
        if (b.sub) { ctx.font = `800 30px ${FU}`; outlined(ctx, b.sub, 0, 68, '#fff', '#120c18', 8); }
        ctx.restore();
      });
      ctx.textBaseline = 'alphabetic';
    }

    drawFlapHint(ctx, t) {
      const on = this.g.vendor.air;
      ctx.save(); ctx.globalAlpha = on ? 0.9 : 0.3; ctx.translate(W - 110, 1580);
      ctx.fillStyle = on ? '#82e8cc' : '#fff'; U.poly(ctx, [0, -44, 40, 4, 16, 4, 16, 40, -16, 40, -16, 4, -40, 4]); ctx.fill();
      ctx.restore();
    }

    // ---------------- tela inicial ----------------
    drawTitle(ctx, t) {
      ctx.fillStyle = 'rgba(8,14,22,0.35)'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 380); ctx.rotate(-0.05 + Math.sin(t * 1.4) * 0.015);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `190px ${FT}`;
      ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 36; ctx.lineWidth = 10; ctx.strokeStyle = '#3a1d00';
      ctx.strokeText('OLHA O', 0, -90); ctx.strokeText('MATE!', 0, 80);
      ctx.shadowBlur = 0; ctx.fillStyle = '#fff7ed'; ctx.fillText('OLHA O', 0, -90); ctx.fillStyle = '#f59e0b'; ctx.fillText('MATE!', 0, 80);
      ctx.restore();
      ctx.textAlign = 'center'; ctx.font = `700 30px ${FU}`; outlined(ctx, 'ACHADOS ÚTEIS POR AÍ · NA AREIA DE COPACABANA', W / 2, 600, '#ffd23f', 'rgba(0,0,0,0.6)', 6);
      const items = this.g.catalog.items;
      if (items.length) {
        const n = 4, size = 170, gap = 26, x0 = (W - (n * size + (n - 1) * gap)) / 2, off = Math.floor(t / 2.2);
        for (let i = 0; i < n; i++) {
          const it = items[(off * n + i) % items.length], x = x0 + i * (size + gap), y = 640 + Math.sin(t * 2 + i) * 6;
          ctx.fillStyle = '#f59e0b'; U.roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 18); ctx.fill();
          this.g.catalog.drawPhoto(ctx, it, x, y, size, 14);
        }
      }
      ctx.font = `600 31px ${FU}`;
      outlined(ctx, 'Leve o mate até o Posto 6 vendendo na areia!', W / 2, 890, '#fff', 'rgba(0,0,0,0.6)', 6);
      outlined(ctx, 'HERÓI ajuda o vendedor · VILÃO atrapalha', W / 2, 934, '#fff', 'rgba(0,0,0,0.6)', 6);
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); ctx.font = `60px ${FT}`;
      outlined(ctx, 'CLIQUE PARA COMEÇAR', W / 2, 1030, '#fcd34d', '#3a1d00', 8); ctx.globalAlpha = 1;
      const keys = Object.keys(this.g.cfg.gifts), cw = 470, x0 = W / 2 - cw, rh = 54, rows = Math.ceil(keys.length / 2);
      glass(ctx, 60, 1076, 960, 24 + rows * rh, 26, 0.65);
      keys.forEach((k, i) => {
        const def = this.g.cfg.gifts[k], x = x0 + (i % 2) * cw + 20, y = 1090 + Math.floor(i / 2) * rh;
        giftIcon(ctx, def.icon, x + 22, y + 20, 20, def.color);
        ctx.textAlign = 'left'; ctx.font = `800 21px ${FU}`; ctx.fillStyle = def.team === 'vilao' ? '#fca5a5' : '#bbf7d0'; ctx.fillText(def.tiktok || def.label, x + 52, y + 17);
        ctx.font = `500 17px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(this.actionText(def), x + 52, y + 39);
      });
      const ty = 1076 + 24 + rows * rh + 34;
      ctx.textAlign = 'center'; ctx.font = `500 22px ${FU}`; outlined(ctx, 'Teste: teclas dos presentes no painel · espaço/↑ pular · D demo · H painel', W / 2, ty, 'rgba(255,255,255,0.9)', 'rgba(0,0,0,0.5)', 5);
      ctx.font = `700 22px ${FU}`; outlined(ctx, VERSAO, W / 2, ty + 36, '#ffd23f', 'rgba(0,0,0,0.5)', 5);
    }

    // ---------------- chegou no Posto 6 ----------------
    drawSummary(ctx, t) {
      const g = this.g, pt = g.sumTime; if (pt < 0) return;
      const a = U.clamp(pt * 2, 0, 1);
      ctx.fillStyle = `rgba(6,16,22,${0.6 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 250); const sc = U.easeOutElastic(U.clamp(pt / 0.7, 0, 1)); ctx.scale(sc, sc); ctx.rotate(-0.03);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `118px ${FT}`;
      ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 30; outlined(ctx, 'VENDEU TUDO!', 0, -24, '#ffe9a0', '#2a1a00', 16); ctx.restore();
      ctx.font = `800 32px ${FU}`; outlined(ctx, `chegou no Posto 6 em ${U.fmtTime(g.finalTime)}` + (g.newRecord ? '  ·  RECORDE DE VENDAS!' : g.record ? `  ·  recorde R$ ${g.record}` : ''), 0, 48, g.newRecord ? '#ffd23f' : '#fff', '#2a1a00', 8);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
      const x = 90, w = 900, y0 = 350;
      ctx.save(); ctx.globalAlpha = a;
      glass(ctx, x, y0, w, 250, 32, 0.88);
      ctx.textAlign = 'center'; ctx.font = `120px ${FT}`; ctx.fillStyle = '#4ade80'; ctx.fillText(`R$ ${g.money}`, W / 2, y0 + 130);
      ctx.font = `700 30px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(`${g.sold} mates vendidos` + (g.lost ? `  ·  ${g.lost} derramado${g.lost > 1 ? 's' : ''}` : ''), W / 2, y0 + 190);
      ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(`HERÓI empurrou +${Math.round(g.helpM)} m  ·  VILÃO atrasou −${Math.round(g.sabM)} m`, W / 2, y0 + 228);
      ctx.restore();
      const ly = 1236;   // abaixo da lista fixa de presentes
      this.linkRect = null;
      if (pt > 1.2) {
        const la = U.clamp((pt - 1.2) * 2, 0, 1), lh = 176;
        ctx.save(); ctx.globalAlpha = la;
        U.roundRect(ctx, 70, ly, 940, lh, 30);
        const lg = ctx.createLinearGradient(70, 0, 1010, 0); lg.addColorStop(0, '#7c2d12'); lg.addColorStop(1, '#c2410c'); ctx.fillStyle = lg; ctx.fill();
        ctx.strokeStyle = '#fcd34d'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#fff'; U.roundRect(ctx, 92, ly + 16, 144, 144, 14); ctx.fill();
        if (this.qr.complete && this.qr.naturalWidth) ctx.drawImage(this.qr, 98, ly + 22, 132, 132);
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 24px ${FU}`; ctx.fillText('ACHADOS ÚTEIS PRA PRAIA E PRA CASA:', 262, ly + 48);
        ctx.font = `58px ${FT}`; ctx.fillText(g.cfg.siteUrl, 262, ly + 108);
        const tip = '📌 link na bio  ·  ou escaneie o QR'; let fs = 24; ctx.font = `700 ${fs}px ${FU}`;
        while (ctx.measureText(tip).width > 725 && fs > 16) { fs--; ctx.font = `700 ${fs}px ${FU}`; }
        ctx.fillStyle = '#ffedd5'; ctx.fillText(tip, 262, ly + 146);
        ctx.restore();
        if (la > 0.5) this.linkRect = { x: 70, y: ly, w: 940, h: lh };
      }
      const by = ly + 200;
      if (pt > 1.8) {
        const rank = g.gifts.ranking(3);
        ctx.save(); ctx.globalAlpha = U.clamp((pt - 1.8) * 2, 0, 1);
        glass(ctx, 90, by, 900, 116, 30, 0.85);
        ctx.textAlign = 'left'; ctx.font = `32px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('HERÓIS DA PRAIA', 124, by + 46);
        ctx.font = `600 19px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillText(`${g.gifts.totalGifts} presentes · ${g.gifts.followers || 0} seguidores`, 124, by + 80);
        rank.forEach((u, i) => {
          const xx = 500 + i * 165;
          ctx.fillStyle = ['#ffd23f', '#d6dbe4', '#d08a4a'][i]; ctx.beginPath(); ctx.arc(xx, by + 44, 17, 0, 7); ctx.fill();
          ctx.fillStyle = '#1a1420'; ctx.font = `800 19px ${FU}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), xx, by + 51);
          ctx.fillStyle = '#fff'; ctx.font = `600 17px ${FU}`; ctx.fillText(U.truncate(u.name, 13), xx, by + 92);
        });
        if (!rank.length) { ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `600 20px ${FU}`; ctx.fillText('Ninguém ajudou dessa vez!', 500, by + 70); }
        if (g.countdown > 0) {
          ctx.textAlign = 'center'; ctx.font = `600 24px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText('NOVA RODADA EM', W / 2, by + 166);
          ctx.font = `76px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(Math.ceil(g.countdown)), W / 2, by + 238);
        }
        ctx.restore();
      }
    }

    drawGameOver(ctx, t) {
      const g = this.g, a = U.clamp(g.overTime - 1, 0, 1);
      ctx.fillStyle = `rgba(20,0,25,${0.5 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(W / 2, 400); ctx.rotate(-0.03);
      ctx.font = `140px ${FT}`; ctx.save(); ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 40; outlined(ctx, 'O RAPA LEVOU!', 0, 0, '#fecaca', '#1a0808', 16); ctx.restore();
      ctx.font = `800 38px ${FU}`; outlined(ctx, `Levaram o isopor a ${g.world.left} m do Posto 6...`, 0, 100, '#fff', '#1a0808', 10);
      ctx.font = `800 34px ${FU}`; outlined(ctx, `Tinha vendido R$ ${g.money}`, 0, 154, '#86efac', '#1a0808', 8);
      if (g.overBy) { ctx.font = `700 32px ${FU}`; outlined(ctx, `🚨 rapa chamado por ${g.overBy}`, 0, 208, '#fca5a5', '#1a0808', 8); }
      ctx.restore();
      if (g.countdown > 0 && g.overTime > g.cfg.gameOverTime) {
        ctx.textAlign = 'center'; ctx.font = `600 30px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText('NOVA RODADA EM', W / 2, 1000);
        ctx.font = `110px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(Math.ceil(g.countdown)), W / 2, 1110);
      }
    }
  }

  HUD.giftIcon = giftIcon;
  HUD.giftImgEl = (icon) => GIFT_IMG[icon] || null;
  CNB.HUD = HUD;
})();
