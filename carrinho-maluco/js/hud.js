/* =========================================================================
   HUD — interface 9:16 para TikTok LIVE (Carrinho Maluco)
   ========================================================================= */
(function () {
  const U = CNB.U, W = 1080, H = 1920;
  const FT = U.FONT_TITLE, FU = U.FONT_UI;

  function giftIcon(ctx, icon, x, y, r, color) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = r * 0.1; ctx.stroke();
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

  class HUD {
    constructor(game) { this.g = game; this.banners = []; this.show = null; this.bubble = null; }
    banner(title, sub, color = '#ffd23f', dur = 1.9) { this.banners = [{ title, sub, color, dur, age: 0 }]; }
    clearBanners() { this.banners = []; }
    showcase(item) { this.show = { item, age: 0, dur: 2.8 }; }
    speak(text, dur) { this.bubble = { text, dur, age: 0 }; }
    update(dt) {
      this.banners.forEach((b) => (b.age += dt)); this.banners = this.banners.filter((b) => b.age < b.dur);
      if (this.show) { this.show.age += dt; if (this.show.age > this.show.dur) this.show = null; }
      if (this.bubble) { this.bubble.age += dt; if (this.bubble.age > this.bubble.dur) this.bubble = null; }
    }

    draw(ctx, t) {
      const g = this.g, top = g.cfg.ui.safeTop;
      if (g.mode === 'loading') return this.drawLoading(ctx, t);
      if (g.mode === 'title') return this.drawTitle(ctx, t);
      if (g.mode === 'playing') {
        this.drawTop(ctx, top, t);
        this.drawFeed(ctx, top + 240);
        this.drawRanking(ctx, top + 240);
        this.drawShowcase(ctx, t);
        this.drawAnnouncer(ctx, t);
        this.drawBanners(ctx, t);
        if (g.control === 'manual') this.drawSteerHint(ctx);
      }
      if (g.mode === 'win') { this.drawAnnouncer(ctx, t); this.drawReceipt(ctx, t); }
      if (g.mode === 'gameover') { this.drawGameOver(ctx, t); this.drawAnnouncer(ctx, t); }
    }

    drawLoading(ctx, t) {
      ctx.fillStyle = '#0e0c16'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.font = `90px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText('CARRINHO MALUCO', W / 2, 900);
      ctx.font = `600 30px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Abrindo a loja' + '.'.repeat(1 + Math.floor(t * 3) % 3), W / 2, 970);
    }

    // ---------------- barra superior ----------------
    drawTop(ctx, top, t) {
      const g = this.g, d = g.shopper, total = g.store.track;
      const prog = U.clamp(d.z / total, 0, 1), left = Math.max(0, Math.ceil(total - d.z));
      glass(ctx, 36, top, 1008, 146, 28);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `50px ${FT}`; ctx.save(); ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.fillText('CARRINHO MALUCO', 66, top + 58); ctx.restore();
      ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`RODADA ${g.roundNo}  •  ${U.fmtTime(g.roundTime)}`, 380, top + 52);
      ctx.textAlign = 'right'; ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('ATÉ O CAIXA', 1012, top + 30);
      ctx.font = `64px ${FT}`; ctx.fillStyle = left < 40 ? '#22e07a' : '#fff'; ctx.fillText(`${left} m`, 1012, top + 86);
      const x0 = 70, x1 = 905, y = top + 116;
      U.roundRect(ctx, x0, y - 8, x1 - x0, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      // cores das seções na trilha
      g.store.sections.forEach((s) => {
        const a = x0 + (x1 - x0) * (s.z0 / total), b = x0 + (x1 - x0) * (s.z1 / total);
        ctx.fillStyle = U.rgba(CNB.Catalog.CAT_COLOR[s.cat], 0.35); ctx.fillRect(a + 1, y - 8, b - a - 2, 16);
      });
      const px = x0 + (x1 - x0) * prog;
      if (prog > 0.002) { const gr = ctx.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#ff8fab'); gr.addColorStop(1, '#ff2d55'); U.roundRect(ctx, x0, y - 8, Math.max(16, px - x0), 16, 8); ctx.fillStyle = gr; ctx.fill(); }
      ctx.fillStyle = '#ff2d55'; ctx.beginPath(); ctx.arc(px, y, 20, 0, 7); ctx.fill(); cartIcon(ctx, px, y - 1, 0.75);
      ctx.fillStyle = '#121218'; U.roundRect(ctx, 930, y - 22, 92, 40, 8); ctx.fill();
      ctx.strokeStyle = '#22e07a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.textAlign = 'center'; ctx.font = `30px ${FT}`; ctx.fillStyle = '#d6ffe6'; ctx.fillText('CAIXA', 976, y + 10);

      // linha de status: carrinho / poderes / conexão
      const sy = top + 158;
      glass(ctx, 36, sy, 440, 64, 32);
      cartIcon(ctx, 76, sy + 32, 1, '#ff8fab');
      ctx.textAlign = 'left'; ctx.font = `800 26px ${FU}`; ctx.fillStyle = '#fff';
      ctx.fillText(`${d.cart.length} ${d.cart.length === 1 ? 'achado' : 'achados'}`, 108, sy + 41);
      ctx.font = `44px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.textAlign = 'right';
      ctx.fillText(CNB.fmtBRL(d.total), 456, sy + 48);
      let bx = 490;
      const pill = (label, color, icon, v) => {
        glass(ctx, bx, sy, 250, 64, 32, 0.75);
        giftIcon(ctx, icon, bx + 32, sy + 32, 22, color);
        ctx.textAlign = 'left'; ctx.font = `40px ${FT}`; ctx.fillStyle = color; ctx.fillText(`${label} ${v.toFixed(1)}s`, bx + 62, sy + 46);
        bx += 262;
      };
      if (d.turbo > 0) pill('TURBO', '#ffd23f', 'bolt', d.turbo);
      if (d.magnet > 0) pill('ÍMÃ', '#60a5fa', 'magnet', d.magnet);
      if (bx === 490) {
        const st = g.bridge.status, live = st === 'ao vivo';
        const label = live ? 'AO VIVO' : g.bridge.url ? (st === 'conectando' ? 'CONECTANDO' : 'SEM CONEXÃO') : 'MODO TESTE';
        ctx.font = `800 20px ${FU}`; const tw = ctx.measureText(label).width + 52;
        glass(ctx, 1044 - tw, sy, tw, 64, 32);
        ctx.fillStyle = live ? '#ff3355' : g.bridge.url ? '#f59e0b' : '#38bdf8'; ctx.beginPath(); ctx.arc(1044 - tw + 24, sy + 32, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(label, 1044 - tw + 38, sy + 39);
      }
    }

    drawFeed(ctx, y0) {
      const g = this.g, now = performance.now() / 1000;
      g.gifts.feed.filter((f) => now - f.t < 6).slice(0, 3).forEach((f, i) => {
        const age = now - f.t, slide = U.easeOutBack(U.clamp(age * 3, 0, 1)), fade = U.clamp((6 - age) / 0.6, 0, 1);
        const y = y0 + i * 76;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(-460 * (1 - slide), 0);
        glass(ctx, 36, y, 430, 66, 33, 0.66);
        giftIcon(ctx, f.def.icon, 70, y + 33, 25, f.def.color);
        ctx.textAlign = 'left'; ctx.font = `700 23px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(U.truncate(f.user, 17), 106, y + 29);
        ctx.font = `600 20px ${FU}`; ctx.fillStyle = f.def.color; ctx.fillText(`${f.def.label.toUpperCase()}  ·  ${this.actionText(f.def)}`, 106, y + 54);
        ctx.restore();
      });
    }

    actionText(def) {
      switch (def.action) {
        case 'advance': return `+${def.amount} m`;
        case 'turbo': return `corre ${def.duration}s`;
        case 'magnet': return `puxa achados ${def.duration}s`;
        case 'back': return `volta ${def.amount} m`;
        case 'slip': return 'derrapa e perde 2';
        case 'sale': return `+${def.count} achados no chão`;
        case 'gameover': return 'GAME OVER';
      }
      return '';
    }

    drawRanking(ctx, y0) {
      const g = this.g, list = g.gifts.ranking(g.cfg.ui.rankingSize);
      const h = 64 + Math.max(1, list.length) * 50;
      glass(ctx, 724, y0, 320, h, 26);
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

    // vitrine do achado que acabou de entrar no carrinho
    drawShowcase(ctx, t) {
      const s = this.show; if (!s) return;
      const it = s.item, inT = U.easeOutBack(U.clamp(s.age * 4, 0, 1)), out = U.clamp((s.dur - s.age) / 0.3, 0, 1);
      const w = 640, h = 200, x = (W - w) / 2, y = 640;
      ctx.save(); ctx.globalAlpha = out; ctx.translate(W / 2, y + h / 2); ctx.scale(inT, inT); ctx.translate(-W / 2, -(y + h / 2));
      glass(ctx, x, y, w, h, 30, 0.88);
      const col = CNB.Catalog.CAT_COLOR[it.cat];
      ctx.strokeStyle = col; ctx.lineWidth = 4; U.roundRect(ctx, x, y, w, h, 30); ctx.stroke();
      this.g.catalog.drawPhoto(ctx, it, x + 18, y + 18, h - 36, 20);
      const tx = x + h + 4;
      ctx.textAlign = 'left';
      ctx.font = `800 18px ${FU}`; const lab = CNB.Catalog.CAT_LABEL[it.cat]; const lw = ctx.measureText(lab).width + 24;
      U.roundRect(ctx, tx, y + 22, lw, 30, 15); ctx.fillStyle = col; ctx.fill();
      ctx.fillStyle = '#10101a'; ctx.fillText(lab, tx + 12, y + 43);
      ctx.font = `800 20px ${FU}`; ctx.fillStyle = '#7CFC9A'; ctx.fillText('NO CARRINHO!', tx + lw + 14, y + 43);
      ctx.font = `700 28px ${FU}`; ctx.fillStyle = '#fff';
      wrap(ctx, it.short, w - h - 30).slice(0, 2).forEach((l, i) => ctx.fillText(l, tx, y + 90 + i * 34));
      ctx.font = `56px ${FT}`; ctx.fillStyle = '#ffd23f';
      ctx.fillText((it.from ? 'a partir de ' : '') + CNB.fmtBRL(it.price), tx, y + 178);
      ctx.restore();
    }

    // legenda do locutor da loja
    drawAnnouncer(ctx, t) {
      const b = this.g.announce; if (!b) return;
      const a = U.clamp(b.age / 0.25, 0, 1) * U.clamp((b.dur - b.age) / 0.4, 0, 1);
      if (a <= 0) return;
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = `700 26px ${FU}`;
      const lines = wrap(ctx, b.text, 820), h = 58 + lines.length * 34, y = this.show ? 860 : 650;
      glass(ctx, 80, y, 920, h, 24, 0.82);
      ctx.fillStyle = '#ffd23f'; ctx.font = `800 18px ${FU}`; ctx.textAlign = 'left'; ctx.fillText('📢  ALTO-FALANTE DA LOJA', 112, y + 34);
      ctx.fillStyle = '#fff'; ctx.font = `700 26px ${FU}`;
      lines.forEach((l, i) => ctx.fillText(l, 112, y + 72 + i * 34));
      ctx.restore();
    }

    drawBanners(ctx, t) {
      this.banners.forEach((b) => {
        const u = b.age / b.dur, inT = U.clamp(b.age / 0.28, 0, 1);
        const sc = U.easeOutBack(inT) * (1 + (u > 0.8 ? (u - 0.8) * 0.6 : 0)), a = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 1000); ctx.scale(sc, sc); ctx.rotate(-0.04);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `104px ${FT}`;
        ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 30; outlined(ctx, b.title, 0, 0, b.color, '#120c18', 14); ctx.restore();
        if (b.sub) { ctx.font = `800 30px ${FU}`; outlined(ctx, b.sub, 0, 70, '#fff', '#120c18', 8); }
        ctx.restore();
      });
      ctx.textBaseline = 'alphabetic';
    }

    drawSteerHint(ctx) {
      const st = this.g.shopper.steer || 0, y = 1720;
      [[-1, 120], [1, W - 120]].forEach(([dir, x]) => {
        const on = Math.sign(st) === dir;
        ctx.save(); ctx.translate(x, y); ctx.scale(-dir, 1); ctx.globalAlpha = on ? 0.9 : 0.28;
        ctx.fillStyle = on ? '#ff2d55' : '#fff'; U.poly(ctx, [-34, 0, 14, -42, 14, -16, 40, -16, 40, 16, 14, 16, 14, 42]); ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }

    // ---------------- tela inicial ----------------
    drawTitle(ctx, t) {
      ctx.fillStyle = 'rgba(8,6,14,0.62)'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 470); ctx.rotate(-0.05 + Math.sin(t * 1.2) * 0.015);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `200px ${FT}`;
      ctx.shadowColor = '#ff2d55'; ctx.shadowBlur = 40;
      ctx.lineWidth = 10; ctx.strokeStyle = '#ff2d55'; ctx.strokeText('CARRINHO', 0, -95); ctx.strokeText('MALUCO', 0, 85);
      ctx.shadowBlur = 16; ctx.fillStyle = '#ffe3e8'; ctx.fillText('CARRINHO', 0, -95); ctx.fillText('MALUCO', 0, 85);
      ctx.restore();
      ctx.textAlign = 'center'; ctx.font = `700 30px ${FU}`; ctx.fillStyle = '#ffd23f';
      ctx.fillText('ACHADOS ÚTEIS POR AÍ', W / 2, 690);
      // vitrine girando com os achados
      const items = this.g.catalog.items;
      if (items.length) {
        const n = 4, size = 190, gap = 26, x0 = (W - (n * size + (n - 1) * gap)) / 2, off = Math.floor(t / 2.2);
        for (let i = 0; i < n; i++) {
          const it = items[(off * n + i) % items.length], x = x0 + i * (size + gap), y = 740 + Math.sin(t * 2 + i) * 6;
          U.roundRect(ctx, x - 6, y - 6, size + 12, size + 58, 22); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
          this.g.catalog.drawPhoto(ctx, it, x, y, size, 16);
          ctx.font = `44px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(CNB.fmtBRL(it.price), x + size / 2, y + size + 44);
        }
      }
      ctx.font = `600 32px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText('Encha o carrinho de achados e chegue ao caixa.', W / 2, 1060);
      ctx.fillText('Seus presentes ajudam (ou atrapalham)!', W / 2, 1104);
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4); ctx.font = `60px ${FT}`; ctx.fillStyle = '#ff8fab';
      ctx.fillText('CLIQUE PARA ABRIR A LOJA', W / 2, 1200); ctx.globalAlpha = 1;
      const keys = Object.keys(this.g.cfg.gifts), cw = 470, x0 = W / 2 - cw;
      keys.forEach((k, i) => {
        const def = this.g.cfg.gifts[k], x = x0 + (i % 2) * cw + 20, y = 1250 + Math.floor(i / 2) * 76;
        giftIcon(ctx, def.icon, x + 28, y + 26, 26, def.color);
        ctx.textAlign = 'left'; ctx.font = `800 26px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(def.label, x + 68, y + 24);
        ctx.font = `500 21px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillText(this.actionText(def), x + 68, y + 50);
      });
      ctx.textAlign = 'center'; ctx.font = `500 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(`Teste: 1–8 presentes · ← → conduzir · C manual/auto · D demo · H painel   ·   ${this.g.catalog.items.length} achados (${this.g.catalog.source === 'site' ? 'do site' : 'cópia local'})`, W / 2, 1600);
    }

    // ---------------- nota fiscal ----------------
    drawReceipt(ctx, t) {
      const g = this.g, pt = g.payTime; if (pt < 0) return;
      const items = g.shopper.cart, shown = Math.min(items.length, g.scanned);
      // título
      const done = g.paid;
      ctx.save(); ctx.translate(W / 2, 270); const sc = U.easeOutElastic(U.clamp(pt / 0.7, 0, 1)); ctx.scale(sc, sc); ctx.rotate(-0.03);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const gr = ctx.createLinearGradient(0, -80, 0, 80); gr.addColorStop(0, '#d6ffe6'); gr.addColorStop(1, '#22e07a');
      ctx.font = `128px ${FT}`; ctx.save(); ctx.shadowColor = '#22e07a'; ctx.shadowBlur = 30;
      outlined(ctx, items.length ? 'COMPRA FINALIZADA!' : 'CHEGOU NO CAIXA!', 0, -30, gr, '#062a14', 16); ctx.restore();
      ctx.font = `800 34px ${FU}`; outlined(ctx, items.length ? `${items.length} achados no carrinho` : 'mas o carrinho tá vazio...', 0, 50, '#fff', '#062a14', 8);
      ctx.restore();
      // papel da nota
      const rows = Math.min(8, Math.max(1, items.length)), rh = 74;
      const pw = 760, ph = 230 + rows * rh + 150, px = (W - pw) / 2, py = 400;
      const rise = U.easeOutCubic(U.clamp(pt / 0.8, 0, 1));
      ctx.save(); ctx.translate(0, (1 - rise) * 900);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px + 10, py + 14, pw, ph);
      ctx.fillStyle = '#fbfaf6';
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let x = 0; x <= pw; x += 20) ctx.lineTo(px + x, py + (x / 20) % 2 * 10);
      ctx.lineTo(px + pw, py + ph);
      for (let x = pw; x >= 0; x -= 20) ctx.lineTo(px + x, py + ph - (x / 20) % 2 * 10);
      ctx.closePath(); ctx.fill();
      const ink = '#24222a';
      ctx.textAlign = 'center'; ctx.fillStyle = ink;
      ctx.font = `46px ${FT}`; ctx.fillText('ACHADOS ÚTEIS POR AÍ', W / 2, py + 64);
      ctx.font = `600 18px ${FU}`; ctx.fillStyle = '#6b6878';
      ctx.fillText(`CUPOM DA LIVE  •  RODADA ${g.roundNo}  •  ${g.cfg.siteUrl}`, W / 2, py + 94);
      ctx.strokeStyle = '#cfcbd6'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + 30, py + 116); ctx.lineTo(px + pw - 30, py + 116); ctx.stroke();
      // itens (os últimos 8 escaneados)
      const start = Math.max(0, shown - rows);
      for (let i = start; i < shown; i++) {
        const it = items[i], y = py + 132 + (i - start) * rh;
        const a = U.clamp((g.scanAt[i] !== undefined ? pt - g.scanAt[i] : 1) * 6, 0, 1);
        ctx.globalAlpha = a;
        g.catalog.drawPhoto(ctx, it, px + 34, y, 60, 10);
        ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = `700 25px ${FU}`;
        ctx.fillText(U.truncate(it.short, 30), px + 112, y + 28);
        ctx.font = `500 18px ${FU}`; ctx.fillStyle = '#7a7686'; ctx.fillText(CNB.Catalog.CAT_LABEL[it.cat], px + 112, y + 54);
        ctx.textAlign = 'right'; ctx.font = `800 27px ${FU}`; ctx.fillStyle = ink; ctx.fillText(CNB.fmtBRL(it.price), px + pw - 36, y + 38);
        ctx.globalAlpha = 1;
      }
      if (!items.length) { ctx.textAlign = 'center'; ctx.font = `600 26px ${FU}`; ctx.fillStyle = '#7a7686'; ctx.fillText('(nenhum achado — mandem presentes na próxima!)', W / 2, py + 170); }
      if (items.length > rows && shown > rows) { ctx.textAlign = 'center'; ctx.font = `600 18px ${FU}`; ctx.fillStyle = '#7a7686'; ctx.fillText(`+ ${shown - rows} itens acima`, W / 2, py + 128); }
      const ty = py + 132 + rows * rh + 10;
      ctx.beginPath(); ctx.moveTo(px + 30, ty); ctx.lineTo(px + pw - 30, ty); ctx.stroke(); ctx.setLineDash([]);
      const sum = items.slice(0, shown).reduce((a, it) => a + it.price, 0);
      ctx.textAlign = 'left'; ctx.font = `48px ${FT}`; ctx.fillStyle = ink; ctx.fillText('TOTAL', px + 36, ty + 62);
      ctx.textAlign = 'right'; ctx.font = `64px ${FT}`; ctx.fillStyle = done ? '#0f9d58' : ink; ctx.fillText(CNB.fmtBRL(sum), px + pw - 36, ty + 66);
      if (done) {
        ctx.save(); ctx.translate(px + pw - 170, ty - 70); ctx.rotate(-0.22);
        ctx.strokeStyle = 'rgba(15,157,88,0.85)'; ctx.lineWidth = 6; U.roundRect(ctx, -120, -38, 240, 76, 12); ctx.stroke();
        ctx.fillStyle = 'rgba(15,157,88,0.85)'; ctx.font = `56px ${FT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('PAGO', 0, 4);
        ctx.restore();
      }
      ctx.textAlign = 'center'; ctx.font = `600 20px ${FU}`; ctx.fillStyle = '#6b6878';
      ctx.fillText('Links de todos os achados: ' + g.cfg.siteUrl, W / 2, ty + 112);
      ctx.restore();

      // ranking + contagem
      if (g.paid) {
        const rank = g.gifts.ranking(3), by = py + ph + 30;
        const a = U.clamp((pt - g.paidAt) * 2, 0, 1);
        ctx.save(); ctx.globalAlpha = a;
        glass(ctx, 90, by, 900, 130, 30, 0.85);
        ctx.textAlign = 'left'; ctx.font = `34px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('QUEM MAIS AJUDOU', 124, by + 46);
        ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText(`${g.gifts.totalGifts} presentes · ${U.fmtTime(g.finalTime)}`, 124, by + 82);
        rank.forEach((u, i) => {
          const x = 470 + i * 175;
          ctx.fillStyle = ['#ffd23f', '#d6dbe4', '#d08a4a'][i]; ctx.beginPath(); ctx.arc(x, by + 50, 18, 0, 7); ctx.fill();
          ctx.fillStyle = '#1a1420'; ctx.font = `800 20px ${FU}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, by + 57);
          ctx.fillStyle = '#fff'; ctx.font = `600 18px ${FU}`; ctx.fillText(U.truncate(u.name, 13), x, by + 98);
        });
        if (!rank.length) { ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = `600 22px ${FU}`; ctx.fillText('Ninguém ajudou dessa vez!', 470, by + 72); }
        if (g.countdown > 0) {
          ctx.textAlign = 'center'; ctx.font = `600 26px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText('NOVA RODADA EM', W / 2, by + 196);
          ctx.font = `90px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(Math.ceil(g.countdown)), W / 2, by + 280);
        }
        ctx.restore();
      }
    }

    drawGameOver(ctx, t) {
      const g = this.g, a = U.clamp(g.overTime / 1, 0, 1);
      ctx.fillStyle = `rgba(20,0,25,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(W / 2, 520); ctx.rotate(-0.03 + Math.sin(t * 20) * 0.01 * Math.max(0, 1 - g.overTime));
      ctx.font = `150px ${FT}`; ctx.save(); ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 40; outlined(ctx, 'CARTÃO RECUSADO', 0, 0, '#f5d0fe', '#1a0820', 16); ctx.restore();
      ctx.font = `800 40px ${FU}`; outlined(ctx, 'Volta tudo pra prateleira...', 0, 110, '#fff', '#1a0820', 10);
      if (g.overBy) { ctx.font = `600 30px ${FU}`; outlined(ctx, `${g.overBy} mandou o Cartão Recusado`, 0, 168, '#e879f9', '#1a0820', 8); }
      ctx.restore();
      if (g.countdown > 0 && g.overTime > g.cfg.gameOverTime) {
        ctx.textAlign = 'center'; ctx.font = `600 30px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText('NOVA RODADA EM', W / 2, 1560);
        ctx.font = `110px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(Math.ceil(g.countdown)), W / 2, 1670);
      }
    }
  }

  HUD.giftIcon = giftIcon;
  CNB.HUD = HUD;
})();
