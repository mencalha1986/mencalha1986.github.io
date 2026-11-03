/* Inicialização: canvas 9:16, fontes, entrada, painel de teste e integração */
(function () {
  const canvas = document.getElementById('game');
  const stage = document.getElementById('stage');
  const params = new URLSearchParams(location.search);

  function fit() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const scale = Math.min(ww / 1080, wh / 1920);
    stage.style.width = Math.floor(1080 * scale) + 'px';
    stage.style.height = Math.floor(1920 * scale) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  const boot = () => {
    const game = new CNB.Game(canvas);
    window.CNB.game = game;

    // integração com a live (opcional)
    let savedWs = null;
    try { savedWs = localStorage.getItem('cnb-ws'); } catch (e) {}
    const ws = params.get('ws') || savedWs;
    if (ws) game.bridge.connect(ws);
    if (params.get('demo') === '1') game.bridge.toggleDemo(true);
    if (params.get('voz') === '0') game.voice.cfg.enabled = false;

    // ---------- entrada ----------
    const startOnce = () => { game.audio.start(); game.start(); };
    stage.addEventListener('pointerdown', (e) => {
      if (game.mode === 'title' && game.hud.titleCards) {
        const r = canvas.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 1080, y = ((e.clientY - r.top) / r.height) * 1920;
        const card = game.hud.titleCards.find((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
        if (card) { game.setCharacter(card.choice); syncChar(); if (card.choice === 'alternar') return; }
      }
      if (game.mode === 'playing' && game.control === 'manual') {
        const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
        held.pointer = x < 0.4 ? -1 : x > 0.6 ? 1 : 0; applySteer();
        return;
      }
      startOnce();
    });
    const release = () => { held.pointer = 0; applySteer(); };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    // ---------- direção manual (setas ← → ou segurar o lado esquerdo/direito da tela) ----------
    const held = { left: false, right: false, pointer: 0 };
    const applySteer = () => { game.drunk.steer = held.pointer || ((held.right ? 1 : 0) - (held.left ? 1 : 0)); };
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') held.left = false;
      if (e.key === 'ArrowRight') held.right = false;
      applySteer();
    });
    window.addEventListener('blur', () => { held.left = held.right = false; held.pointer = 0; applySteer(); });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.key === 'ArrowLeft') held.left = true; else held.right = true;
        if (game.control !== 'manual' && game.mode === 'playing') { game.setControl('manual'); syncCtl(); game.hud.banner('MODO MANUAL', 'Use ← → para desviar', '#38bdf8', 1.6); }
        applySteer();
        return;
      }
      const k = e.key.toLowerCase();
      if (game.mode === 'title' && (k === ' ' || k === 'enter')) { startOnce(); return; }
      for (const gk in game.cfg.gifts) {
        if (game.cfg.gifts[gk].key === k) { startOnce(); game.bridge.test(gk, userInput.value.trim() || undefined); return; }
      }
      if (k === 'd') setDemo(game.bridge.toggleDemo());
      if (k === 'c') { game.setControl(game.control === 'manual' ? 'auto' : 'manual'); syncCtl(); game.hud.banner(game.control === 'manual' ? 'MODO MANUAL' : 'MODO AUTOMÁTICO', game.control === 'manual' ? 'Use ← → para desviar' : 'Ele desvia sozinho (ou não)', '#38bdf8', 1.6); }
      if (k === 'g') { const order = ['homem', 'mulher', 'alternar']; game.setCharacter(order[(order.indexOf(game.charChoice) + 1) % 3]); syncChar(); }
      if (k === 'h') panel.classList.toggle('hidden');
      if (k === 'f') toggleFull();
      if (k === 'm') { game.audio.setMuted(!game.audio.muted); game.voice.setMuted(game.audio.muted); }
      if (k === 'v') { game.voice.cfg.enabled = !game.voice.cfg.enabled; if (!game.voice.cfg.enabled) game.voice.stop(); syncVoice(); }
      if (k === 'r') { game.audio.start(); game.mode = 'playing'; game.startRound(); }
      if (k === 'w' && game.mode === 'playing') { game.drunk.z = game.world.track - 0.1; }
    });

    function toggleFull() {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    }

    // ---------- painel de teste (fora da área de captura, escondível) ----------
    const panel = document.getElementById('test-panel');
    const btns = document.getElementById('gift-buttons');
    const userInput = document.getElementById('test-user');
    for (const gk in game.cfg.gifts) {
      const def = game.cfg.gifts[gk];
      const b = document.createElement('button');
      b.className = 'gift-btn';
      b.style.setProperty('--c', def.color);
      b.innerHTML = `<canvas width="56" height="56"></canvas><span><b>${def.label}</b><small>${game.hud.actionText(def, 1)}</small></span><kbd>${def.key}</kbd>`;
      const ic = b.querySelector('canvas').getContext('2d');
      CNB.HUD.giftIcon(ic, def.icon, 28, 28, 26, def.color);
      b.addEventListener('click', () => { startOnce(); game.bridge.test(gk, userInput.value.trim() || undefined); });
      btns.appendChild(b);
    }
    const demoBtn = document.getElementById('btn-demo');
    const setDemo = (on) => { demoBtn.classList.toggle('on', on); demoBtn.textContent = on ? 'Demo automático: LIGADO' : 'Demo automático: desligado'; };
    demoBtn.addEventListener('click', () => { startOnce(); setDemo(game.bridge.toggleDemo()); });
    setDemo(game.bridge.demo);
    document.getElementById('btn-reset').addEventListener('click', () => { game.audio.start(); game.mode = 'playing'; game.startRound(); });
    document.getElementById('btn-win').addEventListener('click', () => { startOnce(); if (game.mode === 'playing') game.drunk.z = game.world.track - 0.1; });
    document.getElementById('btn-full').addEventListener('click', toggleFull);
    document.getElementById('btn-hide').addEventListener('click', () => panel.classList.add('hidden'));
    const voiceBtn = document.getElementById('btn-voice');
    const syncVoice = () => { voiceBtn.textContent = game.voice.cfg.enabled ? 'Voz: ligada' : 'Voz: desligada'; };
    voiceBtn.addEventListener('click', () => { game.voice.cfg.enabled = !game.voice.cfg.enabled; if (!game.voice.cfg.enabled) game.voice.stop(); syncVoice(); });
    syncVoice();
    const ctlSel = document.getElementById('ctl-select');
    const syncCtl = () => { ctlSel.value = game.control; };
    ctlSel.addEventListener('change', () => { game.setControl(ctlSel.value); ctlSel.blur(); });
    syncCtl();
    game.onControl = () => syncCtl();
    const charSel = document.getElementById('char-select');
    const syncChar = () => { charSel.value = game.charChoice; };
    charSel.addEventListener('change', () => game.setCharacter(charSel.value));
    syncChar();
    // ---------- conexão da live ----------
    const wsInput = document.getElementById('ws-url'), wsStatus = document.getElementById('ws-status');
    if (ws) wsInput.value = ws;
    document.getElementById('btn-ws').addEventListener('click', () => {
      const url = wsInput.value.trim();
      try { url ? localStorage.setItem('cnb-ws', url) : localStorage.removeItem('cnb-ws'); } catch (e) {}
      if (game.bridge.ws) { game.bridge.url = null; try { game.bridge.ws.close(); } catch (e) {} game.bridge.ws = null; game.bridge.status = 'teste'; }
      if (url) game.bridge.connect(url);
    });
    setInterval(() => {
      const st = game.bridge.status;
      wsStatus.className = st === 'ao vivo' ? 'live' : game.bridge.url ? 'bad' : '';
      wsStatus.textContent = st === 'ao vivo' ? '● Conectado — recebendo presentes da live'
        : game.bridge.url ? (st === 'conectando' ? 'Conectando…' : 'Sem conexão — a ferramenta está aberta? Tentando de novo…') : 'Modo teste (sem conexão)';
    }, 500);
    game.gifts.onUnknown = (u) => {
      document.getElementById('unknown-gifts').textContent = 'Presentes sem ação (adicione em giftAliases): ' +
        Object.entries(u).map(([n, c]) => `${n} ×${c}`).join(', ');
    };

    const vInfo = document.getElementById('voice-info');
    setInterval(() => { vInfo.textContent = 'Voz: ' + (game.voice.voiceName || 'carregando…'); }, 1500);
    if (params.get('painel') === '0') panel.classList.add('hidden');
  };

  // espera as fontes (com limite) para o canvas não piscar com fonte errada
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([
        Promise.all([document.fonts.load('64px "Bebas Neue"'), document.fonts.load('700 30px Rubik'), document.fonts.load('900 30px Rubik'), document.fonts.load('600 30px Rubik')]),
        new Promise((r) => setTimeout(r, 2500))
      ])
    : Promise.resolve();
  fontsReady.then(boot, boot);
})();
