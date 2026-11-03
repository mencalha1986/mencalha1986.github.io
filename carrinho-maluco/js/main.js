/* Inicialização: canvas 9:16, entrada, painel de teste e conexão da live */
(function () {
  const canvas = document.getElementById('game'), stage = document.getElementById('stage');
  const params = new URLSearchParams(location.search);
  function fit() {
    const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.width = Math.floor(1080 * s) + 'px'; stage.style.height = Math.floor(1920 * s) + 'px';
  }
  window.addEventListener('resize', fit); fit();

  const boot = () => {
    const game = new CNB.Game(canvas);
    CNB.game = game;
    let savedWs = null; try { savedWs = localStorage.getItem('cm-ws'); } catch (e) {}
    const ws = params.get('ws') || savedWs;
    if (ws) game.bridge.connect(ws);
    if (params.get('demo') === '1') game.bridge.toggleDemo(true);
    if (params.get('locutor') === '0') game.cfg.announcer.enabled = false;

    const startOnce = () => { game.audio.start(); game.start(); };
    const held = { left: false, right: false, pointer: 0 };
    const applySteer = () => { game.shopper.steer = held.pointer || ((held.right ? 1 : 0) - (held.left ? 1 : 0)); };

    // clique no cartão do site (no final) abre o achadosuteisporai.com.br
    const linkHit = (e) => {
      const L = game.hud.linkRect; if (!L || game.mode !== 'win') return false;
      const r = canvas.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 1080, y = ((e.clientY - r.top) / r.height) * 1920;
      return x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + L.h;
    };
    stage.addEventListener('pointermove', (e) => { stage.style.cursor = linkHit(e) ? 'pointer' : ''; });
    stage.addEventListener('pointerdown', (e) => {
      if (linkHit(e)) { window.open(game.cfg.siteLink, '_blank', 'noopener'); return; }
      if (game.mode === 'playing' && game.control === 'manual') {
        const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
        held.pointer = x < 0.4 ? -1 : x > 0.6 ? 1 : 0; applySteer(); return;
      }
      startOnce();
    });
    const release = () => { held.pointer = 0; applySteer(); };
    window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
    window.addEventListener('blur', () => { held.left = held.right = false; held.pointer = 0; applySteer(); });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') held.left = false;
      if (e.key === 'ArrowRight') held.right = false;
      applySteer();
    });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.key === 'ArrowLeft') held.left = true; else held.right = true;
        if (game.control !== 'manual' && game.mode === 'playing') { game.setControl('manual'); syncCtl(); game.hud.banner('MODO MANUAL', 'Use ← → para conduzir', '#38bdf8', 1.6); }
        applySteer(); return;
      }
      if (game.mode === 'title' && (k === ' ' || k === 'enter')) { startOnce(); return; }
      for (const gk in game.cfg.gifts) if (game.cfg.gifts[gk].key === k) { startOnce(); game.bridge.test(gk, userInput.value.trim() || undefined); return; }
      if (k === 'd') setDemo(game.bridge.toggleDemo());
      if (k === 'c') { game.setControl(game.control === 'manual' ? 'auto' : 'manual'); syncCtl(); game.hud.banner(game.control === 'manual' ? 'MODO MANUAL' : 'MODO AUTOMÁTICO', game.control === 'manual' ? 'Use ← → para conduzir' : 'Vai atrás dos achados sozinho', '#38bdf8', 1.6); }
      if (k === 'h') panel.classList.toggle('hidden');
      if (k === 'f') toggleFull();
      if (k === 'm') game.audio.setMuted(!game.audio.muted);
      if (k === 'r' && game.store) { game.audio.start(); game.startRound(); }
      if (k === 'w' && game.mode === 'playing') game.shopper.z = game.store.track - 0.1;
    });
    function toggleFull() { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }

    // ---------- painel ----------
    const panel = document.getElementById('test-panel'), btns = document.getElementById('gift-buttons'), userInput = document.getElementById('test-user');
    for (const gk in game.cfg.gifts) {
      const def = game.cfg.gifts[gk], b = document.createElement('button');
      b.className = 'gift-btn'; b.style.setProperty('--c', def.color);
      b.innerHTML = `<canvas width="56" height="56"></canvas><span><b>${def.label}</b><small>${game.hud.actionText(def)}</small></span><kbd>${def.key}</kbd>`;
      CNB.HUD.giftIcon(b.querySelector('canvas').getContext('2d'), def.icon, 28, 28, 26, def.color);
      b.addEventListener('click', () => { startOnce(); game.bridge.test(gk, userInput.value.trim() || undefined); });
      btns.appendChild(b);
    }
    const demoBtn = document.getElementById('btn-demo');
    const setDemo = (on) => { demoBtn.classList.toggle('on', on); demoBtn.textContent = on ? 'Demo automático: LIGADO' : 'Demo automático: desligado'; };
    demoBtn.addEventListener('click', () => { startOnce(); setDemo(game.bridge.toggleDemo()); }); setDemo(game.bridge.demo);
    document.getElementById('btn-reset').addEventListener('click', () => { if (game.store) { game.audio.start(); game.startRound(); } });
    document.getElementById('btn-win').addEventListener('click', () => { startOnce(); if (game.mode === 'playing') game.shopper.z = game.store.track - 0.1; });
    document.getElementById('btn-full').addEventListener('click', toggleFull);
    document.getElementById('btn-hide').addEventListener('click', () => panel.classList.add('hidden'));
    const annBtn = document.getElementById('btn-ann');
    const syncAnn = () => (annBtn.textContent = game.cfg.announcer.enabled ? 'Locutor: ligado' : 'Locutor: desligado');
    annBtn.addEventListener('click', () => { game.cfg.announcer.enabled = !game.cfg.announcer.enabled; syncAnn(); }); syncAnn();
    const ctlSel = document.getElementById('ctl-select');
    const syncCtl = () => (ctlSel.value = game.control);
    ctlSel.addEventListener('change', () => { game.setControl(ctlSel.value); ctlSel.blur(); }); syncCtl();

    const wsInput = document.getElementById('ws-url'), wsStatus = document.getElementById('ws-status');
    if (ws) wsInput.value = ws;
    document.getElementById('btn-ws').addEventListener('click', () => {
      const url = wsInput.value.trim();
      try { url ? localStorage.setItem('cm-ws', url) : localStorage.removeItem('cm-ws'); } catch (e) {}
      if (game.bridge.ws) { game.bridge.url = null; try { game.bridge.ws.close(); } catch (e) {} game.bridge.ws = null; game.bridge.status = 'teste'; }
      if (url) game.bridge.connect(url);
    });
    const info = document.getElementById('voice-info');
    setInterval(() => {
      const st = game.bridge.status;
      wsStatus.className = st === 'ao vivo' ? 'live' : game.bridge.url ? 'bad' : '';
      wsStatus.textContent = st === 'ao vivo' ? '● Conectado — recebendo presentes da live' : game.bridge.url ? (st === 'conectando' ? 'Conectando…' : 'Sem conexão — o TikFinity está aberto? Tentando de novo…') : 'Modo teste (sem conexão)';
      info.textContent = `Achados: ${game.catalog.items.length} (${game.catalog.source === 'site' ? 'direto do site' : game.catalog.source === 'reserva' ? 'cópia local' : 'carregando'})`;
    }, 500);
    game.gifts.onUnknown = (u) => {
      document.getElementById('unknown-gifts').textContent = 'Presentes sem ação (adicione em giftAliases): ' + Object.entries(u).map(([n, c]) => `${n} ×${c}`).join(', ');
    };
    if (params.get('painel') === '0') panel.classList.add('hidden');
  };

  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([Promise.all([document.fonts.load('64px "Bebas Neue"'), document.fonts.load('700 30px Rubik'), document.fonts.load('900 30px Rubik')]), new Promise((r) => setTimeout(r, 2500))])
    : Promise.resolve();
  fontsReady.then(boot, boot);
})();
