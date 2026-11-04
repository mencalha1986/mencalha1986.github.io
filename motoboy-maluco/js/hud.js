/* =========================================================================
   HUD — interface 9:16 para TikTok LIVE (Motoboy Maluco)
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

  class HUD {
    constructor(game) {
      this.g = game; this.banners = []; this.card = null; this.bubbles = [];
      this.qr = new Image(); this.qr.src = game.cfg.qrImage; this.linkRect = null;
    }
    banner(title, sub, color = '#ffd23f', dur = 1.9) { this.banners = [{ title, sub, color, dur, age: 0 }]; }
    clearBanners() { this.banners = []; }
    showCard(d) { this.card = { ...d, age: 0, dur: 4.2 }; }
    bubble(who, text, dur) { this.bubbles = this.bubbles.filter((b) => b.who !== who); this.bubbles.push({ who, text, dur, age: 0 }); }
    update(dt) {
      this.banners.forEach((b) => (b.age += dt)); this.banners = this.banners.filter((b) => b.age < b.dur);
      if (this.card) { this.card.age += dt; if (this.card.age > this.card.dur) this.card = null; }
      this.bubbles.forEach((b) => (b.age += dt)); this.bubbles = this.bubbles.filter((b) => b.age < b.dur);
    }

    draw(ctx, t) {
      const g = this.g, top = g.cfg.ui.safeTop;
      if (g.mode === 'loading') return this.drawLoading(ctx, t);
      if (g.mode === 'title') return this.drawTitle(ctx, t);
      this.drawBubbles(ctx, t);
      if (g.mode === 'playing') {
        this.drawTop(ctx, top, t);
        this.drawFeed(ctx, top + 240);
        this.drawRanking(ctx, top + 240);
        const ga = g.guideAlpha === undefined ? 1 : g.guideAlpha;   // some na esquina para mostrar a rua
        if (g.cfg.ui.giftGuide && !g.rider.finished && ga > 0.02) { ctx.save(); ctx.globalAlpha *= ga; this.drawGiftGuide(ctx, top + 240 + 214 + 16); ctx.restore(); }
        this.drawMirror(ctx, t);
        this.drawCard(ctx, t);
        this.drawBanners(ctx, t);
        if (g.control === 'manual') this.drawSteerHint(ctx);
      }
      if (g.mode === 'win') this.drawSummary(ctx, t);
      if (g.mode === 'gameover') this.drawGameOver(ctx, t);
    }

    drawLoading(ctx, t) {
      ctx.fillStyle = '#0e0c16'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.font = `90px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText('MOTOBOY MALUCO', W / 2, 900);
      ctx.font = `600 30px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Separando os pedidos' + '.'.repeat(1 + Math.floor(t * 3) % 3), W / 2, 970);
    }

    // ---------------- barra superior ----------------
    drawTop(ctx, top, t) {
      const g = this.g, d = g.rider, c = g.city, stop = g.nextStop();
      glass(ctx, 36, top, 1008, 146, 28);
      ctx.textAlign = 'left'; ctx.font = `50px ${FT}`;
      ctx.save(); ctx.shadowColor = '#82e8cc'; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.fillText('MOTOBOY MALUCO', 66, top + 58); ctx.restore();
      ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`RODADA ${g.roundNo}  •  ${U.fmtTime(g.roundTime)}`, 400, top + 52);
      ctx.textAlign = 'right'; ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(stop ? `ENTREGA ${stop.k + 1} DE ${c.stops.length}` : 'ENTREGAS', 1012, top + 30);
      const left = stop ? Math.max(0, Math.ceil(stop.z - d.z)) : 0;
      ctx.font = `64px ${FT}`; ctx.fillStyle = left < 40 ? '#82e8cc' : '#fff'; ctx.fillText(`${left} m`, 1012, top + 86);
      // trilha com as casas
      const x0 = 70, x1 = 905, y = top + 116, L = c.length;
      U.roundRect(ctx, x0, y - 8, x1 - x0, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      const px = x0 + (x1 - x0) * U.clamp(d.z / L, 0, 1);
      const gr = ctx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#82e8cc'); gr.addColorStop(1, '#2ec4b6');
      U.roundRect(ctx, x0, y - 8, Math.max(16, px - x0), 16, 8); ctx.fillStyle = gr; ctx.fill();
      c.stops.forEach((s) => { const sx = x0 + (x1 - x0) * (s.z / L); ctx.fillStyle = s.done ? '#82e8cc' : '#fe2c55'; ctx.beginPath(); ctx.arc(sx, y, 9, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); });
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(px, y, 18, 0, 7); ctx.fill();
      Rider.logo(ctx, px, y - 2, 1.4);
      // velocímetro
      const kmh = Math.round(Math.abs(d.speed) * 5.8);
      ctx.fillStyle = '#121218'; U.roundRect(ctx, 925, y - 24, 100, 44, 10); ctx.fill();
      ctx.textAlign = 'center'; ctx.font = `36px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(kmh), 960, y + 12);
      ctx.font = `700 13px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('km/h', 1003, y + 10);

      // linha de status: GPS + estrelas + poderes
      const sy = top + 158, man = g.nextManeuver();
      glass(ctx, 36, sy, 520, 64, 32, 0.8);
      if (man) {
        ctx.fillStyle = man.type === 'dest' ? '#fe2c55' : '#2563eb'; ctx.beginPath(); ctx.arc(70, sy + 32, 26, 0, 7); ctx.fill();
        arrow(ctx, 70, sy + 34, 30, man.type);
        const dist = Math.max(0, Math.round(man.z - d.z));
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 23px ${FU}`;
        const txt = man.type === 'dest' ? `Entrega no nº ${man.num}` : man.type === 'right' ? `Vire à direita · ${man.name}` : 'Vire à esquerda · Avenida';
        ctx.fillText(U.truncate(txt, 30), 108, sy + 28);
        ctx.font = `600 19px ${FU}`; ctx.fillStyle = '#82e8cc'; ctx.fillText(dist > 5 ? `em ${dist} m` : 'agora', 108, sy + 52);
      }
      let bx = 568;
      const pill = (label, color, icon, v) => {
        glass(ctx, bx, sy, 230, 64, 32, 0.78);
        giftIcon(ctx, icon, bx + 32, sy + 32, 22, color);
        ctx.textAlign = 'left'; ctx.font = `38px ${FT}`; ctx.fillStyle = color; ctx.fillText(`${label} ${v.toFixed(1)}s`, bx + 62, sy + 46);
        bx += 240;
      };
      if (d.turbo > 0) pill('TURBO', '#ffd23f', 'bolt', d.turbo);
      if (d.chase > 0) pill('CÃO', '#e0a35a', 'dog', d.chase);
      if (bx === 568) {
        glass(ctx, 568, sy, 476, 64, 32, 0.7);
        ctx.textAlign = 'left'; ctx.font = `700 19px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText('AVALIAÇÃO', 592, sy + 39);
        stars(ctx, 730, sy + 32, 15, g.currentStars);
        const st = g.bridge.status, live = st === 'ao vivo';
        ctx.fillStyle = live ? '#ff3355' : g.bridge.url ? '#f59e0b' : '#38bdf8'; ctx.beginPath(); ctx.arc(912, sy + 32, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `800 17px ${FU}`; ctx.fillText(live ? 'AO VIVO' : g.bridge.url ? 'SEM CONEXÃO' : 'TESTE', 926, sy + 38);
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

    actionText(def) {
      switch (def.action) {
        case 'advance': return `acelera +${def.amount} m`;
        case 'turbo': return `turbo ${def.duration}s`;
        case 'dog': return 'cachorro corre atrás!';
        case 'back': return `volta ${def.amount} m`;
        case 'flat': return 'fura o pneu';
        case 'gameover': return 'GAME OVER';
        case 'follow': return 'vira cliente da entrega';
        case 'horn': return 'BI-BI! abre caminho';
      }
      return '';
    }

    drawGiftGuide(ctx, y0) {
      const G = this.g.cfg.gifts, keys = Object.keys(G), rowH = 46;
      glass(ctx, 724, y0, 320, 56 + keys.length * rowH, 26, 0.62);
      ctx.textAlign = 'left'; ctx.font = `30px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('MANDE E VEJA', 748, y0 + 40);
      keys.forEach((k, i) => {
        const def = G[k], y = y0 + 56 + i * rowH;
        giftIcon(ctx, def.icon, 762, y + 20, 18, def.color);
        ctx.textAlign = 'left'; ctx.font = `800 19px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(U.truncate(def.tiktok || def.label, 15), 790, y + 15);
        ctx.font = `600 16px ${FU}`; ctx.fillStyle = def.color; ctx.fillText(U.truncate(this.actionText(def), 26), 790, y + 36);
      });
    }

    drawRanking(ctx, y0) {
      const g = this.g, list = g.gifts.ranking(g.cfg.ui.rankingSize);
      glass(ctx, 724, y0, 320, 64 + 3 * 50, 26);
      ctx.textAlign = 'left'; ctx.font = `30px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('TOP CLIENTES', 748, y0 + 42);
      ctx.textAlign = 'right'; ctx.font = `600 18px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText(`${g.gifts.totalGifts} presentes`, 1022, y0 + 40);
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

    // RETROVISOR: o caramelo bravo chegando
    drawMirror(ctx, t) {
      const g = this.g, ch = g.chaseDog; if (!ch || ch.alpha <= 0.01) return;
      const cx = 250, cy = 1420, rw = 165, rh = 100;
      ctx.save(); ctx.globalAlpha = ch.alpha;
      ctx.translate(cx, cy); ctx.rotate(Math.sin(t * 18) * 0.02);
      ctx.strokeStyle = '#1b1c20'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-rw * 0.7, rh * 0.9); ctx.lineTo(-rw * 0.95, rh * 1.7); ctx.stroke();
      ctx.fillStyle = '#1b1c20'; ctx.beginPath(); ctx.ellipse(0, 0, rw + 12, rh + 12, -0.06, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, rw, rh, -0.06, 0, 7); ctx.clip();
      const sk = ctx.createLinearGradient(0, -rh, 0, rh); sk.addColorStop(0, '#9fd3f5'); sk.addColorStop(0.45, '#d9edf8'); sk.addColorStop(0.46, '#5b5f68'); sk.addColorStop(1, '#3d4048');
      ctx.fillStyle = sk; ctx.fillRect(-rw, -rh, rw * 2, rh * 2);
      ctx.fillStyle = '#f2f2f2'; for (let i = 0; i < 4; i++) { const yy = rh * 0.1 + i * rh * 0.25 + ((t * 120) % (rh * 0.25)); ctx.fillRect(-3 - i * 2, yy, 6 + i * 4, rh * 0.1); }
      // o cachorro, cada vez maior conforme chega perto
      const sc = U.lerp(0.45, 1.25, ch.close) * (1 + Math.abs(Math.sin(t * 22)) * 0.05), bob = Math.abs(Math.sin(t * 22)) * 6;
      ctx.translate(Math.sin(t * 3) * 20, rh * 0.25 - bob); ctx.scale(sc, sc);
      ctx.fillStyle = '#c88a46'; ctx.beginPath(); ctx.ellipse(0, 10, 46, 30, 0, 0, 7); ctx.fill();               // peito
      ctx.beginPath(); ctx.ellipse(0, -30, 40, 34, 0, 0, 7); ctx.fill();                                           // cabeça
      ctx.fillStyle = '#94602c'; ctx.beginPath(); ctx.ellipse(-38, -46 + Math.sin(t * 22) * 6, 12, 22, -0.5, 0, 7); ctx.ellipse(38, -46 - Math.sin(t * 22) * 6, 12, 22, 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#e2ab6a'; ctx.beginPath(); ctx.ellipse(0, -14, 24, 17, 0, 0, 7); ctx.fill();               // focinho
      ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(0, -24, 8, 6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-15, -42, 5, 0, 7); ctx.arc(15, -42, 5, 0, 7); ctx.fill();                          // olhos
      ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-24, -54); ctx.lineTo(-8, -47); ctx.moveTo(24, -54); ctx.lineTo(8, -47); ctx.stroke(); // sobrancelha brava
      const open = 0.5 + 0.5 * Math.abs(Math.sin(t * 16));
      ctx.fillStyle = '#5c1414'; ctx.beginPath(); ctx.ellipse(0, -4, 14, 4 + open * 9, 0, 0, 7); ctx.fill();          // latindo
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-7, 0); ctx.lineTo(-4, -6); ctx.moveTo(4, -6); ctx.lineTo(7, 0); ctx.lineTo(10, -6); ctx.fill();
      ctx.restore();
      ctx.restore();
      ctx.save(); ctx.globalAlpha = ch.alpha; ctx.textAlign = 'center'; ctx.font = `800 18px ${FU}`; ctx.fillStyle = '#fff';
      outlined(ctx, 'RETROVISOR', cx, cy + rh + 40, '#fff', 'rgba(0,0,0,0.8)', 5); ctx.restore();
    }

    // cartão da entrega feita
    drawCard(ctx, t) {
      const c = this.card; if (!c) return;
      const inT = U.easeOutBack(U.clamp(c.age * 4, 0, 1)), out = U.clamp((c.dur - c.age) / 0.35, 0, 1);
      const w = 700, h = 236, x = (W - w) / 2, y = 1420;
      ctx.save(); ctx.globalAlpha = out; ctx.translate(W / 2, y + h / 2); ctx.scale(inT, inT); ctx.translate(-W / 2, -(y + h / 2));
      glass(ctx, x, y, w, h, 30, 0.9);
      ctx.strokeStyle = '#82e8cc'; ctx.lineWidth = 4; U.roundRect(ctx, x, y, w, h, 30); ctx.stroke();
      this.g.catalog.drawPhoto(ctx, c.item, x + 20, y + 20, h - 40, 20);
      const tx = x + h + 4;
      ctx.textAlign = 'left'; ctx.font = `46px ${FT}`; ctx.fillStyle = '#82e8cc'; ctx.fillText('ENTREGUE!', tx, y + 62);
      ctx.font = `700 24px ${FU}`; ctx.fillStyle = '#fff';
      wrap(ctx, c.item.short, w - h - 30).slice(0, 2).forEach((l, i) => ctx.fillText(l, tx, y + 100 + i * 30));
      ctx.font = `44px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(CNB.fmtBRL(c.item.price), tx, y + 178);
      ctx.font = `600 20px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(U.truncate(`para ${c.client} · nº ${c.num}`, 32), tx, y + 212);
      stars(ctx, x + w - 128, y + 172, 12, c.stars);
      ctx.restore();
    }

    drawBubbles(ctx, t) {
      for (const b of this.bubbles) {
        const g = this.g, anchor = b.who === 'cliente' ? g.customerHead : b.who === 'borr' ? g.borrHead : b.who === 'policia' ? (g.city && g.city.policeHead) : g.rider.headScreen;
        if (!anchor) continue;
        const pop = U.easeOutBack(U.clamp(b.age * 5, 0, 1)), fade = U.clamp((b.dur - b.age) / 0.3, 0, 1);
        ctx.font = `800 30px ${FU}`;
        const lines = wrap(ctx, b.text, 520), lh = 36, bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44, bh = lines.length * lh + 26;
        const bx = U.clamp(anchor.x - bw / 2, 30, W - bw - 30), by = U.clamp(anchor.y - bh - 30, 420, 1600);
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(anchor.x, by + bh); ctx.scale(pop, pop); ctx.translate(-anchor.x, -(by + bh));
        ctx.fillStyle = b.who === 'cliente' ? '#e6fff7' : b.who === 'borr' ? '#fff4d6' : b.who === 'policia' ? '#e3ecff' : '#ffffff';
        U.roundRect(ctx, bx, by, bw, bh, 22); ctx.fill();
        ctx.beginPath(); ctx.moveTo(U.clamp(anchor.x - 14, bx + 24, bx + bw - 44), by + bh - 2); ctx.lineTo(U.clamp(anchor.x + 16, bx + 44, bx + bw - 24), by + bh - 2); ctx.lineTo(anchor.x, anchor.y - 6); ctx.closePath(); ctx.fill();
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
        ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 1060); ctx.scale(sc, sc); ctx.rotate(-0.04);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `100px ${FT}`;
        ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 30; outlined(ctx, b.title, 0, 0, b.color, '#120c18', 14); ctx.restore();
        if (b.sub) { ctx.font = `800 30px ${FU}`; outlined(ctx, b.sub, 0, 68, '#fff', '#120c18', 8); }
        ctx.restore();
      });
      ctx.textBaseline = 'alphabetic';
    }

    drawSteerHint(ctx) {
      const st = this.g.rider.steer || 0, y = 1720;
      [[-1, 120], [1, W - 120]].forEach(([dir, x]) => {
        const on = Math.sign(st) === dir;
        ctx.save(); ctx.translate(x, y); ctx.scale(-dir, 1); ctx.globalAlpha = on ? 0.9 : 0.28;
        ctx.fillStyle = on ? '#82e8cc' : '#fff'; U.poly(ctx, [-34, 0, 14, -42, 14, -16, 40, -16, 40, 16, 14, 16, 14, 42]); ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }

    // ---------------- tela inicial ----------------
    drawTitle(ctx, t) {
      ctx.fillStyle = 'rgba(8,14,22,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 420); ctx.rotate(-0.05 + Math.sin(t * 1.4) * 0.015);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `190px ${FT}`;
      ctx.shadowColor = '#82e8cc'; ctx.shadowBlur = 36; ctx.lineWidth = 10; ctx.strokeStyle = '#0e3a4a';
      ctx.strokeText('MOTOBOY', 0, -90); ctx.strokeText('MALUCO', 0, 80);
      ctx.shadowBlur = 0; ctx.fillStyle = '#f3efe7'; ctx.fillText('MOTOBOY', 0, -90); ctx.fillStyle = '#82e8cc'; ctx.fillText('MALUCO', 0, 80);
      ctx.restore();
      ctx.textAlign = 'center'; ctx.font = `700 30px ${FU}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('ENTREGAS DO ACHADOS ÚTEIS POR AÍ', W / 2, 640);
      const items = this.g.catalog.items;
      if (items.length) {
        const n = 4, size = 180, gap = 26, x0 = (W - (n * size + (n - 1) * gap)) / 2, off = Math.floor(t / 2.2);
        for (let i = 0; i < n; i++) {
          const it = items[(off * n + i) % items.length], x = x0 + i * (size + gap), y = 690 + Math.sin(t * 2 + i) * 6;
          this.g.catalog.drawPhoto(ctx, it, x, y, size, 16);
          ctx.fillStyle = '#c69c6d'; ctx.fillRect(x + size - 46, y + size - 34, 40, 28); ctx.fillStyle = '#82e8cc'; ctx.fillRect(x + size - 30, y + size - 34, 8, 28);
        }
      }
      ctx.font = `600 31px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('Ajude o motoboy a entregar os achados!', W / 2, 950);
      ctx.fillText('Avenida, ruas, buracos... e um caramelo bravo.', W / 2, 994);
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); ctx.font = `60px ${FT}`; ctx.fillStyle = '#82e8cc';
      ctx.fillText('CLIQUE PARA SAIR PRA ENTREGA', W / 2, 1090); ctx.globalAlpha = 1;
      const keys = Object.keys(this.g.cfg.gifts), cw = 470, x0 = W / 2 - cw;
      keys.forEach((k, i) => {
        const def = this.g.cfg.gifts[k], x = x0 + (i % 2) * cw + 20, y = 1140 + Math.floor(i / 2) * 76;
        giftIcon(ctx, def.icon, x + 28, y + 26, 26, def.color);
        ctx.textAlign = 'left'; ctx.font = `800 26px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(def.tiktok || def.label, x + 68, y + 24);
        ctx.font = `500 21px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(this.actionText(def), x + 68, y + 50);
      });
      ctx.textAlign = 'center'; ctx.font = `500 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('Teste: 1–9 presentes · ← → pilotar · D demo · H painel · ' + this.g.catalog.items.length + ' achados', W / 2, 1490);
    }

    // ---------------- final do expediente ----------------
    drawSummary(ctx, t) {
      const g = this.g, pt = g.sumTime; if (pt < 0) return;
      const list = g.delivered, a = U.clamp(pt * 2, 0, 1);
      ctx.fillStyle = `rgba(6,16,22,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 250); const sc = U.easeOutElastic(U.clamp(pt / 0.7, 0, 1)); ctx.scale(sc, sc); ctx.rotate(-0.03);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `118px ${FT}`;
      ctx.save(); ctx.shadowColor = '#82e8cc'; ctx.shadowBlur = 30; outlined(ctx, 'ENTREGAS FEITAS!', 0, -24, '#d6fff2', '#062a1f', 16); ctx.restore();
      ctx.font = `800 32px ${FU}`; outlined(ctx, `${list.length} pedidos na porta do cliente`, 0, 48, '#fff', '#062a1f', 8);
      ctx.restore(); ctx.textBaseline = 'alphabetic';
      // lista das entregas
      const x = 90, w = 900, rh = 92, y0 = 360;
      ctx.save(); ctx.globalAlpha = a;
      glass(ctx, x, y0, w, 90 + list.length * rh + 90, 32, 0.88);
      ctx.textAlign = 'left'; ctx.font = `44px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(`RODADA ${g.roundNo}  ·  ${U.fmtTime(g.finalTime)}`, x + 36, y0 + 60);
      list.forEach((d, i) => {
        const y = y0 + 84 + i * rh, ap = U.clamp((pt - 0.3 - i * 0.25) * 4, 0, 1);
        ctx.save(); ctx.globalAlpha = a * ap; ctx.translate((1 - ap) * 60, 0);
        g.catalog.drawPhoto(ctx, d.item, x + 32, y, 76, 12);
        ctx.textAlign = 'left'; ctx.font = `700 25px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(U.truncate(d.item.short, 30), x + 126, y + 30);
        ctx.font = `600 19px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillText(U.truncate(`${d.client} · nº ${d.num}`, 34), x + 126, y + 60);
        stars(ctx, x + w - 250, y + 26, 11, d.stars);
        ctx.textAlign = 'right'; ctx.font = `36px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(CNB.fmtBRL(d.item.price), x + w - 32, y + 70);
        ctx.restore();
      });
      const ty = y0 + 84 + list.length * rh + 52;
      const avg = list.length ? list.reduce((s, d) => s + d.stars, 0) / list.length : 0;
      ctx.textAlign = 'left'; ctx.font = `36px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText('AVALIAÇÃO DO MOTOBOY', x + 36, ty);
      stars(ctx, x + 420, ty - 12, 16, avg);
      ctx.textAlign = 'right'; ctx.font = `44px ${FT}`; ctx.fillStyle = '#82e8cc'; ctx.fillText(avg.toFixed(1).replace('.', ','), x + w - 32, ty + 4);
      ctx.restore();
      // cartão do site com QR
      this.linkRect = null;
      const ly = ty + 70;
      if (pt > 1.2) {
        const la = U.clamp((pt - 1.2) * 2, 0, 1), lh = 176;
        ctx.save(); ctx.globalAlpha = la;
        U.roundRect(ctx, 70, ly, 940, lh, 30);
        const lg = ctx.createLinearGradient(70, 0, 1010, 0); lg.addColorStop(0, '#0e3a4a'); lg.addColorStop(1, '#14706a'); ctx.fillStyle = lg; ctx.fill();
        ctx.strokeStyle = '#82e8cc'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#fff'; U.roundRect(ctx, 92, ly + 16, 144, 144, 14); ctx.fill();
        if (this.qr.complete && this.qr.naturalWidth) ctx.drawImage(this.qr, 98, ly + 22, 132, 132);
        ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 24px ${FU}`; ctx.fillText('QUER RECEBER ESSES ACHADOS? TÁ NO SITE:', 262, ly + 48);
        ctx.font = `58px ${FT}`; ctx.fillText(g.cfg.siteUrl, 262, ly + 108);
        const tip = `📌 link na bio do ${g.cfg.profile}  ·  ou escaneie o QR`; let fs = 24; ctx.font = `700 ${fs}px ${FU}`;
        while (ctx.measureText(tip).width > 725 && fs > 16) { fs--; ctx.font = `700 ${fs}px ${FU}`; }
        ctx.fillStyle = '#d6fff2'; ctx.fillText(tip, 262, ly + 146);
        ctx.restore();
        if (la > 0.5) this.linkRect = { x: 70, y: ly, w: 940, h: lh };
      }
      // quem mais ajudou + contagem
      const by = ly + 200;
      if (pt > 1.8) {
        const rank = g.gifts.ranking(3);
        ctx.save(); ctx.globalAlpha = U.clamp((pt - 1.8) * 2, 0, 1);
        glass(ctx, 90, by, 900, 116, 30, 0.85);
        ctx.textAlign = 'left'; ctx.font = `32px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('QUEM MAIS AJUDOU', 124, by + 46);
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
      const g = this.g, a = U.clamp(g.overTime, 0, 1);
      ctx.fillStyle = `rgba(20,0,25,${0.5 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(W / 2, 520); ctx.rotate(-0.03);
      ctx.font = `160px ${FT}`; ctx.save(); ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 40; outlined(ctx, 'SEM GASOLINA', 0, 0, '#f5d0fe', '#1a0820', 16); ctx.restore();
      ctx.font = `800 40px ${FU}`; outlined(ctx, 'O motoboy vai ter que empurrar a moto...', 0, 110, '#fff', '#1a0820', 10);
      if (g.overBy) { ctx.font = `600 30px ${FU}`; outlined(ctx, `${g.overBy} secou o tanque`, 0, 166, '#e879f9', '#1a0820', 8); }
      ctx.restore();
      if (g.countdown > 0 && g.overTime > g.cfg.gameOverTime) {
        ctx.textAlign = 'center'; ctx.font = `600 30px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText('NOVA RODADA EM', W / 2, 1560);
        ctx.font = `110px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(Math.ceil(g.countdown)), W / 2, 1670);
      }
    }
  }

  const Rider = CNB.Rider;
  HUD.giftIcon = giftIcon;
  HUD.giftImgEl = (icon) => GIFT_IMG[icon] || null;
  CNB.HUD = HUD;
})();
