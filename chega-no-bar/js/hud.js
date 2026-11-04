/* =========================================================================
   HUD — interface discreta para TikTok LIVE (9:16, 1080x1920)
   Respeita áreas seguras: topo (cabeçalho do TikTok) e base (comentários).
   ========================================================================= */
(function () {
  const U = CNB.U;
  const W = 1080, H = 1920;
  const FT = U.FONT_TITLE, FU = U.FONT_UI;

  // imagens oficiais dos presentes (config: img), indexadas pelo ícone de cada presente
  const GIFT_IMG = {};
  for (const k in CNB.CONFIG.gifts) {
    const def = CNB.CONFIG.gifts[k];
    if (def.img) { const im = new Image(); im.src = def.img; GIFT_IMG[def.icon] = im; }
  }
  const giftImage = (icon) => { const im = GIFT_IMG[icon]; return im && im.complete && im.naturalWidth ? im : null; };

  // ---------------- ícones vetoriais dos presentes ----------------
  function giftIcon(ctx, icon, x, y, r, color) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = r * 0.1; ctx.stroke();
    const im = giftImage(icon);
    if (im) { const sz = r * 1.7; ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz); ctx.restore(); return; }
    const s = r / 30;
    ctx.scale(s, s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (icon) {
      case 'rose':
        ctx.strokeStyle = '#3fa34d'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, 20); ctx.stroke();
        ctx.fillStyle = '#3fa34d'; ctx.beginPath(); ctx.ellipse(6, 12, 6, 3, -0.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8244b';
        [[-6, -6], [6, -6], [0, -12], [-4, 0], [4, 0]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 7, 0, 7); ctx.fill(); });
        ctx.fillStyle = '#9e0f2c'; ctx.beginPath(); ctx.arc(0, -5, 4, 0, 7); ctx.fill();
        break;
      case 'note':
        ctx.lineWidth = 6;
        [['#25f4ee', -2, -2], ['#fe2c55', 2, 2], ['#ffffff', 0, 0]].forEach(([c, dx, dy]) => {
          ctx.strokeStyle = c;
          ctx.beginPath(); ctx.moveTo(4 + dx, -18 + dy); ctx.lineTo(4 + dx, 8 + dy); ctx.arc(-3 + dx, 8 + dy, 7, 0, Math.PI * 1.9); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(4 + dx, -18 + dy); ctx.quadraticCurveTo(8 + dx, -8 + dy, 16 + dx, -8 + dy); ctx.stroke();
        });
        break;
      case 'bolt':
        ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#7a5200'; ctx.lineWidth = 2;
        U.poly(ctx, [4, -22, -12, 3, -1, 3, -5, 22, 13, -5, 2, -5, 8, -22]); ctx.fill(); ctx.stroke();
        break;
      case 'beer':
        ctx.fillStyle = '#f5a623'; U.roundRect(ctx, -12, -10, 20, 28, 3); ctx.fill();
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(10, 4, 7, -1.3, 1.3); ctx.stroke();
        ctx.fillStyle = '#fff'; [[-8, -12, 7], [0, -14, 8], [7, -11, 6]].forEach(([a, b, rr]) => { ctx.beginPath(); ctx.arc(a, b, rr, 0, 7); ctx.fill(); });
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-8, -4, 3, 18);
        break;
      case 'back':
        ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(2, 2, 13, -Math.PI * 0.9, Math.PI * 0.7); ctx.stroke();
        ctx.fillStyle = '#c4b5fd'; U.poly(ctx, [-20, -6, -6, -12, -12, 4]); ctx.fill();
        break;
      case 'banana':
        ctx.fillStyle = '#facc15'; ctx.strokeStyle = '#6b4f00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-2, -16); ctx.quadraticCurveTo(-22, 6, -14, 18); ctx.quadraticCurveTo(-6, 6, -1, -6);
        ctx.quadraticCurveTo(4, 6, 14, 18); ctx.quadraticCurveTo(20, 4, 2, -16); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6b4f00'; ctx.fillRect(-3, -21, 5, 7);
        break;
      case 'dog':
        ctx.fillStyle = '#c88a46'; ctx.beginPath(); ctx.ellipse(0, 2, 14, 13, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#94602c';
        ctx.beginPath(); ctx.ellipse(-13, -2, 5, 11, 0.4, 0, 7); ctx.ellipse(13, -2, 5, 11, -0.4, 0, 7); ctx.fill();
        ctx.fillStyle = '#ecd2a8'; ctx.beginPath(); ctx.ellipse(0, 9, 8, 6, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(0, 6, 3.5, 2.6, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(-5.5, -2, 2, 0, 7); ctx.arc(5.5, -2, 2, 0, 7); ctx.fill();
        ctx.fillStyle = '#f2d24b'; ctx.beginPath(); ctx.moveTo(14, 16); ctx.quadraticCurveTo(18, 22, 15, 25); ctx.quadraticCurveTo(12, 22, 14, 16); ctx.fill();
        break;
      case 'moon':
        ctx.fillStyle = '#f0abfc'; ctx.beginPath(); ctx.arc(-2, 2, 15, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(20,10,40,1)'; ctx.beginPath(); ctx.arc(6, -4, 13, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `900 14px ${FU}`; ctx.fillText('z', 8, -2); ctx.font = `900 10px ${FU}`; ctx.fillText('z', 15, -10);
        break;
    }
    ctx.restore();
  }

  function glass(ctx, x, y, w, h, r, a = 0.55) {
    U.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = `rgba(12,10,20,${a})`; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();
  }

  function outlined(ctx, text, x, y, fill, stroke = 'rgba(0,0,0,0.85)', lw = 8) {
    ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }

  function headIcon(ctx, x, y, r, fem) {
    ctx.save(); ctx.translate(x, y);
    if (fem) { ctx.fillStyle = '#4a2e1c'; ctx.beginPath(); ctx.ellipse(0, r * 0.5, r * 1.25, r * 1.4, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#c98c64'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2018'; ctx.beginPath(); ctx.arc(0, -r * 0.2, r, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.strokeStyle = '#2b2018'; ctx.lineWidth = 3;
    [[-0.6, -1.4], [0, -1.6], [0.6, -1.4]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a * r * 0.6, -r * 0.8); ctx.lineTo(a * r, b * r); ctx.stroke(); });
    ctx.fillStyle = '#c2564a'; ctx.beginPath(); ctx.arc(0, r * 0.2, r * 0.28, 0, 7); ctx.fill();
    ctx.fillStyle = '#1b1410'; ctx.fillRect(-r * 0.45, -r * 0.15, r * 0.25, r * 0.12); ctx.fillRect(r * 0.2, -r * 0.15, r * 0.25, r * 0.12);
    ctx.restore();
  }

  function barIcon(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#1a1420'; U.roundRect(ctx, -30, -22, 60, 44, 8); ctx.fill();
    ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 3; ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 12; ctx.stroke();
    ctx.font = `30px ${FT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd0d8'; ctx.fillText('BAR', 0, 2);
    ctx.restore();
  }

  class HUD {
    constructor(game) {
      this.g = game;
      this.banners = [];
      this.bubble = null;
    }

    // aviso novo substitui o anterior na hora (o último presente manda)
    banner(title, sub, color = '#ffd23f', dur = 1.9) {
      this.banners = [{ title, sub, color, dur, age: 0 }];
    }
    clearBanners() { this.banners = []; }
    speak(text, dur) { this.bubble = { text, dur, age: 0 }; }

    update(dt) {
      this.banners.forEach((b) => (b.age += dt));
      this.banners = this.banners.filter((b) => b.age < b.dur);
      if (this.bubble) { this.bubble.age += dt; if (this.bubble.age > this.bubble.dur) this.bubble = null; }
    }

    draw(ctx, t) {
      const g = this.g;
      const top = g.cfg.ui.safeTop;
      if (g.mode !== 'title') {
        this.drawBubble(ctx, t);
        if (g.mode === 'playing' || (g.mode === 'win' && g.winTime < 0)) {
          this.drawTop(ctx, top, t);
          this.drawFeed(ctx, top + 236, t);
          this.drawRanking(ctx, top + 236);
        }
        this.drawBanners(ctx, t);
        if (g.mode === 'playing' && g.control === 'manual') this.drawSteerHint(ctx, t);
      }
      if (g.mode === 'title') this.drawTitle(ctx, t);
      if (g.mode === 'win') this.drawWin(ctx, t);
      if (g.mode === 'gameover') this.drawGameOver(ctx, t);
      // lista de presentes fixa na tela o tempo todo (por cima de tudo)
      if (g.mode !== 'title' && g.cfg.ui.giftGuide) this.drawGiftGuide(ctx, top + 236 + 214 + 16);
    }

    // guia fixo na lateral: qual presente do TikTok faz o quê (só os ligados a um presente real)
    drawGiftGuide(ctx, y0) {
      const G = this.g.cfg.gifts, keys = Object.keys(G).filter((k) => G[k].tiktok), rowH = 46;
      glass(ctx, 724, y0, 320, 56 + keys.length * rowH, 26, 0.62);
      ctx.textAlign = 'left'; ctx.font = `30px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('MANDE E VEJA', 748, y0 + 40);
      keys.forEach((k, i) => {
        const def = G[k], y = y0 + 56 + i * rowH;
        giftIcon(ctx, def.icon, 762, y + 20, 18, def.color);
        ctx.textAlign = 'left'; ctx.font = `800 19px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(U.truncate(def.tiktok, 22), 790, y + 15);
        ctx.font = `600 16px ${FU}`; ctx.fillStyle = def.color; ctx.fillText(U.truncate(this.actionText(def, 1), 28), 790, y + 36);
      });
    }

    // ---------------- barra superior ----------------
    drawTop(ctx, top, t) {
      const g = this.g, d = g.drunk;
      const total = g.world.track;
      const prog = U.clamp(d.z / total, 0, 1);
      const left = Math.max(0, Math.ceil(total - d.z));
      glass(ctx, 36, top, 1008, 146, 28);
      // logo
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `50px ${FT}`;
      ctx.save(); ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.fillText('CHEGA NO BAR', 66, top + 58); ctx.restore();
      // rodada
      ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`RODADA ${g.roundNo}  •  ${U.fmtTime(g.roundTime)}`, 312, top + 52);
      // distância
      ctx.textAlign = 'right';
      ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('FALTAM', 1012, top + 30);
      ctx.font = `64px ${FT}`;
      const near = left < 40;
      const pulse = near ? 1 + Math.sin(t * 8) * 0.05 : 1;
      ctx.save(); ctx.translate(1012, top + 82); ctx.scale(pulse, pulse);
      ctx.fillStyle = near ? '#ffd23f' : '#ffffff'; ctx.fillText(`${left} m`, 0, 0); ctx.restore();
      // trilho
      const x0 = 70, x1 = 930, y = top + 116;
      U.roundRect(ctx, x0, y - 8, x1 - x0, 16, 8); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      const px = x0 + (x1 - x0) * prog;
      if (prog > 0.002) {
        const gr = ctx.createLinearGradient(x0, 0, x1, 0);
        gr.addColorStop(0, '#ffb347'); gr.addColorStop(1, '#ff3355');
        U.roundRect(ctx, x0, y - 8, Math.max(16, px - x0), 16, 8); ctx.fillStyle = gr; ctx.fill();
        if (d.state === 'run') { ctx.save(); ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 20; ctx.fill(); ctx.restore(); }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let m = 50; m < total; m += 50) { const tx = x0 + (x1 - x0) * (m / total); ctx.fillRect(tx - 1, y - 4, 2, 8); }
      headIcon(ctx, px, y, 17, g.gender === 'f');
      barIcon(ctx, 990, y - 2);

      // linha de status
      const sy = top + 158;
      // bafômetro
      glass(ctx, 36, sy, 348, 60, 30);
      ctx.textAlign = 'left'; ctx.font = `700 20px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText('BAFÔMETRO', 60, sy + 38);
      for (let i = 0; i < 10; i++) {
        const on = i < Math.round(d.drunk * 10);
        ctx.fillStyle = on ? U.mix('#4ade80', '#ff3355', i / 9) : 'rgba(255,255,255,0.12)';
        U.roundRect(ctx, 196 + i * 17, sy + 18, 12, 24, 4); ctx.fill();
      }
      // turbo
      if (d.turbo > 0) {
        const blink = 0.75 + 0.25 * Math.sin(t * 16);
        glass(ctx, 398, sy, 284, 60, 30, 0.75);
        ctx.save(); ctx.globalAlpha = blink; giftIcon(ctx, 'bolt', 430, sy + 30, 22, '#ffd23f'); ctx.restore();
        ctx.font = `44px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(`TURBO ${d.turbo.toFixed(1)}s`, 462, sy + 46);
      }
      // status da integração (modo teste fica explícito)
      const st = g.bridge.status;
      const live = st === 'ao vivo';
      const label = live ? 'AO VIVO' : g.bridge.url ? (st === 'conectando' ? 'CONECTANDO' : 'SEM CONEXÃO') : 'MODO TESTE';
      ctx.font = `800 20px ${FU}`;
      const tw = ctx.measureText(label).width + 52;
      glass(ctx, 1044 - tw, sy, tw, 60, 30);
      ctx.fillStyle = live ? '#ff3355' : g.bridge.url ? '#f59e0b' : '#38bdf8';
      ctx.beginPath(); ctx.arc(1044 - tw + 24, sy + 30, 7 + (live ? Math.sin(t * 6) : 0), 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(label, 1044 - tw + 38, sy + 37);
    }

    // ---------------- feed de presentes (esquerda) ----------------
    drawFeed(ctx, y0, t) {
      const g = this.g;
      const now = performance.now() / 1000;
      const items = g.gifts.feed.filter((f) => now - f.t < 7).slice(0, g.cfg.ui.feedMax);
      items.forEach((f, i) => {
        const age = now - f.t;
        const slide = U.easeOutBack(U.clamp(age * 3, 0, 1));
        const fade = U.clamp((7 - age) / 0.6, 0, 1);
        const y = y0 + i * 78;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(-460 * (1 - slide), 0);
        glass(ctx, 36, y, 440, 68, 34, 0.62);
        if (age < 0.5) { ctx.strokeStyle = f.def.color; ctx.lineWidth = 3; ctx.globalAlpha = fade * (1 - age * 2); U.roundRect(ctx, 36, y, 440, 68, 34); ctx.stroke(); ctx.globalAlpha = fade; }
        giftIcon(ctx, f.def.icon, 70, y + 34, 26, f.def.color);
        ctx.textAlign = 'left';
        ctx.font = `700 24px ${FU}`; ctx.fillStyle = '#fff';
        ctx.fillText(U.truncate(f.user, 17), 108, y + 30);
        ctx.font = `600 21px ${FU}`; ctx.fillStyle = f.def.color;
        ctx.fillText(`${f.def.label.toUpperCase()}${f.count > 1 ? ' ×' + f.count : ''}  ·  ${this.actionText(f.def, f.count)}`, 108, y + 56);
        ctx.restore();
      });
    }

    actionText(def, n) {
      switch (def.action) {
        case 'advance': return `+${def.amount * n} m`;
        case 'turbo': return `corre ${def.duration * n}s`;
        case 'beer': return `+${def.amount * n} m, mais tonto`;
        case 'back': return `volta ${def.amount * n} m`;
        case 'trip': return 'derruba!';
        case 'gameover': return 'GAME OVER';
        case 'dog': return 'xixi na perna!';
      }
      return '';
    }

    // ---------------- ranking (direita) ----------------
    drawRanking(ctx, y0) {
      const g = this.g;
      const list = g.gifts.ranking(g.cfg.ui.rankingSize);
      const h = 64 + Math.max(1, list.length) * 50;
      glass(ctx, 724, y0, 320, h, 26);
      ctx.textAlign = 'left'; ctx.font = `30px ${FT}`; ctx.fillStyle = '#ffd23f';
      ctx.fillText('TOP DA RODADA', 748, y0 + 42);
      ctx.textAlign = 'right'; ctx.font = `600 18px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`${g.gifts.totalGifts} presentes`, 1022, y0 + 40);
      if (!list.length) {
        ctx.textAlign = 'left'; ctx.font = `500 20px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Mande um presente!', 748, y0 + 92);
        return;
      }
      const medal = ['#ffd23f', '#d6dbe4', '#d08a4a'];
      list.forEach((u, i) => {
        const y = y0 + 84 + i * 50;
        ctx.fillStyle = medal[i] || '#888'; ctx.beginPath(); ctx.arc(762, y - 7, 16, 0, 7); ctx.fill();
        ctx.fillStyle = '#1a1420'; ctx.font = `800 18px ${FU}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), 762, y - 1);
        ctx.textAlign = 'left'; ctx.font = `600 21px ${FU}`; ctx.fillStyle = '#fff';
        ctx.fillText(U.truncate(u.name, 14), 788, y);
        ctx.textAlign = 'right'; ctx.font = `800 21px ${FU}`; ctx.fillStyle = '#ffd23f';
        ctx.fillText(String(u.points), 1022, y);
      });
    }

    // ---------------- balão de fala ----------------
    drawBubble(ctx, t) {
      const b = this.bubble, g = this.g;
      if (!b) return;
      const hp = g.drunk.headScreen;
      const pop = U.easeOutBack(U.clamp(b.age * 5, 0, 1));
      const fade = U.clamp((b.dur - b.age) / 0.3, 0, 1);
      const shout = b.text === b.text.toUpperCase();
      ctx.font = `${shout ? 900 : 700} ${shout ? 38 : 34}px ${FU}`;
      const words = b.text.split(' ');
      const lines = []; let cur = '';
      words.forEach((w) => { const tst = cur ? cur + ' ' + w : w; if (ctx.measureText(tst).width > 600 && cur) { lines.push(cur); cur = w; } else cur = tst; });
      lines.push(cur);
      const lh = shout ? 46 : 42;
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 56;
      const bh = lines.length * lh + 34;
      let bx = U.clamp(hp.x - bw / 2 + 60, 30, W - bw - 30);
      const by = U.clamp(hp.y - bh - 46, 420, 1500);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(hp.x, by + bh); ctx.scale(pop, pop); ctx.translate(-hp.x, -(by + bh));
      ctx.rotate(Math.sin(t * 3) * 0.008);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; U.roundRect(ctx, bx + 6, by + 8, bw, bh, 26); ctx.fill();
      ctx.fillStyle = shout ? '#fff6c2' : '#ffffff';
      U.roundRect(ctx, bx, by, bw, bh, 26); ctx.fill();
      ctx.beginPath(); ctx.moveTo(U.clamp(hp.x - 16, bx + 30, bx + bw - 60), by + bh - 2); ctx.lineTo(U.clamp(hp.x + 22, bx + 60, bx + bw - 30), by + bh - 2); ctx.lineTo(hp.x + 4, hp.y - 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#1b1410'; ctx.lineWidth = 4; U.roundRect(ctx, bx, by, bw, bh, 26); ctx.stroke();
      ctx.fillStyle = '#1b1410'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      lines.forEach((l, i) => {
        const wob = Math.sin(t * 4 + i) * 1.5;
        ctx.fillText(l, bx + bw / 2, by + 17 + lh / 2 + i * lh + wob);
      });
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    }

    // ---------------- dica do modo manual (setas discretas na base) ----------------
    drawSteerHint(ctx, t) {
      const st = this.g.drunk.steer || 0, y = 1720;
      [[-1, 120], [1, W - 120]].forEach(([dir, x]) => {
        const on = Math.sign(st) === dir;
        ctx.save(); ctx.translate(x, y); ctx.scale(-dir, 1);
        ctx.globalAlpha = on ? 0.9 : 0.28;
        ctx.fillStyle = on ? '#38bdf8' : 'rgba(255,255,255,0.9)';
        U.poly(ctx, [-34, 0, 14, -42, 14, -16, 40, -16, 40, 16, 14, 16, 14, 42]); ctx.fill();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    }

    // ---------------- banners de evento ----------------
    drawBanners(ctx, t) {
      this.banners.forEach((b, i) => {
        const u = b.age / b.dur;
        const inT = U.clamp(b.age / 0.28, 0, 1);
        const sc = U.easeOutBack(inT) * (1 + (u > 0.8 ? (u - 0.8) * 0.6 : 0));
        const a = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
        const y = 600;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, y); ctx.scale(sc, sc); ctx.rotate(-0.04 + Math.sin(t * 6) * 0.01);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `110px ${FT}`;
        ctx.save(); ctx.shadowColor = b.color; ctx.shadowBlur = 30;
        outlined(ctx, b.title, 0, 0, b.color, '#120c18', 14);
        ctx.restore();
        if (b.sub) { ctx.font = `800 32px ${FU}`; outlined(ctx, b.sub, 0, 72, '#ffffff', '#120c18', 8); }
        ctx.restore();
      });
      ctx.textBaseline = 'alphabetic';
    }

    // ---------------- tela inicial ----------------
    drawTitle(ctx, t) {
      ctx.fillStyle = 'rgba(5,4,12,0.55)'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, 600);
      ctx.rotate(-0.05 + Math.sin(t * 1.2) * 0.02);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `210px ${FT}`;
      const fl = U.hash(Math.floor(t * 10)) > 0.95 ? 0.3 : 1;
      ctx.shadowColor = '#ff3355'; ctx.shadowBlur = 50 * fl;
      ctx.lineWidth = 10; ctx.strokeStyle = '#ff3355'; ctx.strokeText('CHEGA', 0, -100); ctx.strokeText('NO BAR', 0, 90);
      ctx.shadowBlur = 20 * fl; ctx.fillStyle = '#ffe3e8'; ctx.fillText('CHEGA', 0, -100); ctx.fillText('NO BAR', 0, 90);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.font = `600 34px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('Ajude quem bebeu demais a atravessar a rua.', W / 2, 860);
      ctx.fillText('Ou atrapalhe. A gente não julga.', W / 2, 906);
      // escolha do personagem
      this.titleCards = [];
      const choice = this.g.charChoice;
      [['homem', 'HOMEM', 230], ['mulher', 'MULHER', 590]].forEach(([key, label, x]) => {
        const y = 950, w = 260, h = 270, on = choice === key || choice === 'alternar';
        this.titleCards.push({ x, y, w, h, choice: key });
        U.roundRect(ctx, x, y, w, h, 28);
        ctx.fillStyle = on ? 'rgba(255,51,85,0.22)' : 'rgba(12,10,20,0.6)'; ctx.fill();
        ctx.strokeStyle = on ? '#ff3355' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = on ? 4 : 2; ctx.stroke();
        const pv = this.g.previews[key];
        ctx.save(); U.roundRect(ctx, x, y, w, h, 28); ctx.clip();
        pv.draw(ctx, x + w / 2, y + h - 58, 112, 0.9);
        ctx.restore();
        ctx.textAlign = 'center'; ctx.font = `46px ${FT}`; ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.7)';
        ctx.fillText(label, x + w / 2, y + h - 16);
      });
      const ay = 1240;
      this.titleCards.push({ x: 330, y: ay - 34, w: 420, h: 52, choice: 'alternar' });
      U.roundRect(ctx, 330, ay - 34, 420, 52, 26);
      ctx.fillStyle = choice === 'alternar' ? 'rgba(255,210,63,0.22)' : 'rgba(12,10,20,0.6)'; ctx.fill();
      ctx.strokeStyle = choice === 'alternar' ? '#ffd23f' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = `700 24px ${FU}`; ctx.fillStyle = choice === 'alternar' ? '#ffd23f' : 'rgba(255,255,255,0.75)';
      ctx.fillText('Alternar a cada rodada', W / 2, ay);
      const p = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.globalAlpha = p; ctx.font = `46px ${FT}`; ctx.fillStyle = '#ffd23f';
      ctx.fillText('ESCOLHA E CLIQUE PARA COMEÇAR', W / 2, 1312); ctx.globalAlpha = 1;
      // legenda dos presentes
      const keys = Object.keys(this.g.cfg.gifts);
      const cols = 2, cw = 450, x0 = W / 2 - cw;
      keys.forEach((k, i) => {
        const def = this.g.cfg.gifts[k];
        const x = x0 + (i % cols) * cw + 20, y = 1360 + Math.floor(i / cols) * 70;
        giftIcon(ctx, def.icon, x + 28, y + 26, 26, def.color);
        ctx.textAlign = 'left'; ctx.font = `800 26px ${FU}`; ctx.fillStyle = '#fff'; ctx.fillText(def.label, x + 68, y + 24);
        ctx.font = `500 21px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.fillText(this.actionText(def, 1), x + 68, y + 50);
      });
      ctx.textAlign = 'center'; ctx.font = `500 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('Teste: 1–8 presentes · ← → desviar · C manual/auto · G personagem · D demo · H painel', W / 2, 1690);
    }

    // ---------------- vitória ----------------
    drawWin(ctx, t) {
      const g = this.g, wt = g.winTime;
      if (wt < 0) return;
      // título
      const inT = U.clamp(wt / 0.6, 0, 1);
      const cardOn = g.winPhase >= 1;
      const ty = cardOn ? U.lerp(330, 300, U.clamp(g.cardTime * 3, 0, 1)) : 330;
      ctx.save(); ctx.translate(W / 2, ty);
      const sc = U.easeOutElastic(inT) * (cardOn ? 0.8 : 1) * (1 + Math.sin(t * 6) * 0.02);
      ctx.scale(sc, sc); ctx.rotate(-0.04);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const gr = ctx.createLinearGradient(0, -90, 0, 90);
      gr.addColorStop(0, '#fff3a8'); gr.addColorStop(0.5, '#ffd23f'); gr.addColorStop(1, '#ff8a1f');
      ctx.font = `150px ${FT}`;
      ctx.save(); ctx.shadowColor = '#ff8a1f'; ctx.shadowBlur = 40; outlined(ctx, g.gender === 'f' ? 'ELA CONSEGUIU!!!' : 'ELE CONSEGUIU!!!', 0, -50, gr, '#2a0c10', 18); ctx.restore();
      ctx.font = `96px ${FT}`;
      outlined(ctx, 'CHEGOU AO BAR!', 0, 70, '#ffffff', '#2a0c10', 14);
      ctx.restore();

      if (!cardOn) return;
      // cartão de estatísticas compacto na parte de baixo: a cena do brinde continua visível
      const ct = U.easeOutBack(U.clamp(g.cardTime * 2.5, 0, 1));
      ctx.save();
      const fade = ctx.createLinearGradient(0, 960, 0, H);
      fade.addColorStop(0, 'rgba(5,4,12,0)'); fade.addColorStop(0.35, `rgba(5,4,12,${0.6 * ct})`); fade.addColorStop(1, `rgba(5,4,12,${0.8 * ct})`);
      ctx.fillStyle = fade; ctx.fillRect(0, 960, W, H - 960);
      ctx.translate(0, (1 - ct) * 400); ctx.globalAlpha = U.clamp(g.cardTime * 3, 0, 1);
      const rank = g.gifts.ranking(5);
      const h = 340 + Math.max(1, rank.length) * 80, x = 60, w = 960, y = 1830 - h;
      glass(ctx, x, y, w, h, 40, 0.88);
      ctx.strokeStyle = 'rgba(255,210,63,0.6)'; ctx.lineWidth = 3; U.roundRect(ctx, x, y, w, h, 40); ctx.stroke();
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left'; ctx.font = `58px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(`RODADA ${g.roundNo}`, x + 44, y + 72);
      // contagem regressiva no canto
      const left = Math.max(0, Math.ceil(g.countdown));
      ctx.textAlign = 'right'; ctx.font = `600 22px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('NOVA RODADA EM', x + w - 120, y + 64);
      const pulse = 1 + (g.countdown % 1) * 0.25;
      ctx.save(); ctx.translate(x + w - 70, y + 72); ctx.scale(pulse, pulse);
      ctx.textAlign = 'center'; ctx.font = `72px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(left), 0, 0); ctx.restore();
      // números
      const stats = [['TEMPO', U.fmtTime(g.finalTime)], ['PRESENTES', String(g.gifts.totalGifts)], ['TOMBOS', String(g.falls)]];
      ctx.textAlign = 'center';
      stats.forEach(([l, v], i) => {
        const cx = x + 160 + i * 320;
        U.roundRect(ctx, cx - 140, y + 104, 280, 116, 22); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
        ctx.font = `700 20px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(l, cx, y + 140);
        ctx.font = `66px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(v, cx, y + 204);
      });
      // quem mais contribuiu
      ctx.textAlign = 'left'; ctx.font = `38px ${FT}`; ctx.fillStyle = '#ffd23f'; ctx.fillText('QUEM MAIS CONTRIBUIU', x + 44, y + 284);
      if (!rank.length) { ctx.font = `600 26px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('Chegou sozinho. Sem ajuda de ninguém.', x + 44, y + 340); }
      const medal = ['#ffd23f', '#d6dbe4', '#d08a4a', '#8b8b9a', '#8b8b9a'];
      rank.forEach((u, i) => {
        const ry = y + 306 + i * 80;
        const first = i === 0;
        U.roundRect(ctx, x + 36, ry, w - 72, 68, 34);
        ctx.fillStyle = first ? 'rgba(255,210,63,0.16)' : 'rgba(255,255,255,0.06)'; ctx.fill();
        ctx.fillStyle = medal[i]; ctx.beginPath(); ctx.arc(x + 80, ry + 34, 22, 0, 7); ctx.fill();
        if (first) {
          ctx.fillStyle = '#ffd23f';
          U.poly(ctx, [x + 62, ry + 4, x + 66, ry - 18, x + 73, ry - 6, x + 80, ry - 22, x + 87, ry - 6, x + 94, ry - 18, x + 98, ry + 4]); ctx.fill();
        }
        ctx.fillStyle = '#1a1420'; ctx.font = `900 24px ${FU}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x + 80, ry + 43);
        ctx.textAlign = 'left'; ctx.font = `${first ? 800 : 600} 28px ${FU}`; ctx.fillStyle = '#fff';
        ctx.fillText(U.truncate(u.name, 20), x + 122, ry + 44);
        ctx.textAlign = 'right'; ctx.font = `600 21px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(`${u.gifts} presente${u.gifts > 1 ? 's' : ''}`, x + w - 200, ry + 42);
        ctx.font = `800 28px ${FU}`; ctx.fillStyle = '#ffd23f'; ctx.fillText(`${u.points} pts`, x + w - 64, ry + 44);
      });
      ctx.restore();
    }

    drawGameOver(ctx, t) {
      const g = this.g, ev = g.overEvent;
      const a = U.clamp(g.overTime / 1.2, 0, 1);
      const vg = ctx.createRadialGradient(W / 2, 1100, 200, W / 2, 1100, 1300);
      vg.addColorStop(0, `rgba(40,0,30,${0.12 * a})`); vg.addColorStop(1, `rgba(10,0,15,${0.62 * a})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(W / 2, 420); ctx.rotate(-0.03);
      ctx.font = `180px ${FT}`; ctx.save(); ctx.shadowColor = '#e879f9'; ctx.shadowBlur = 40; outlined(ctx, ev.title, 0, 0, '#f5d0fe', '#1a0820', 16); ctx.restore();
      ctx.font = `800 40px ${FU}`; outlined(ctx, ev.subtitle, 0, 120, '#ffffff', '#1a0820', 10);
      if (g.overBy) { ctx.font = `600 30px ${FU}`; outlined(ctx, `${g.overBy} mandou o ESPECIAL`, 0, 180, '#e879f9', '#1a0820', 8); }
      ctx.restore();
      if (g.countdown > 0 && g.overTime > g.cfg.gameOverTime) {
        ctx.textAlign = 'center'; ctx.font = `600 30px ${FU}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText('NOVA RODADA EM', W / 2, 1560);
        ctx.font = `110px ${FT}`; ctx.fillStyle = '#fff'; ctx.fillText(String(Math.ceil(g.countdown)), W / 2, 1670);
      }
    }
  }

  HUD.giftIcon = giftIcon;
  CNB.HUD = HUD;
})();
