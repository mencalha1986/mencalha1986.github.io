/* =========================================================================
   JANELA DA LIVE + CONTROLE REMOTO
   - Botão "Abrir janela da live": abre uma janela separada só com o jogo
     (9:16, sem painel). É ela que você captura no TikTok LIVE Studio.
   - A janela original vira o controle remoto: os botões e teclas dela
     comandam a janela da live (via BroadcastChannel, no mesmo computador).
   ========================================================================= */
(function () {
  const params = new URLSearchParams(location.search);
  const LIVE = params.get('modo') === 'live';
  const ch = 'BroadcastChannel' in window ? new BroadcastChannel('cnb-remote-' + location.pathname) : null;
  const send = (m) => ch && ch.postMessage(m);
  const giftKeyFrom = (k) => { const G = CNB.game && CNB.game.cfg.gifts; return G && Object.keys(G).find((g) => G[g].key === k); };

  // ------------------------------------------------------------ JANELA DA LIVE
  if (LIVE) {
    document.documentElement.classList.add('live-window');
    const style = document.createElement('style');
    style.textContent = `#test-panel{display:none!important} body{cursor:none} #stage{box-shadow:none}
      #live-unlock{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:20;background:rgba(0,0,0,.72);
      color:#fff;font:700 20px Rubik,sans-serif;text-align:center;cursor:pointer;padding:24px;line-height:1.5}`;
    document.head.appendChild(style);
    // o navegador só libera som depois de um clique NESTA janela
    const un = document.createElement('div');
    un.id = 'live-unlock';
    un.innerHTML = 'JANELA DA LIVE<br><span style="font-weight:500;font-size:16px">Clique aqui uma vez para liberar o som.<br>Depois capture esta janela no LIVE Studio<br>e controle tudo pela outra janela.</span>';
    un.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); un.remove();
      const g = CNB.game; if (g) { g.audio.start(); if (g.start) g.start(); }
    });
    document.body.appendChild(un);
    setInterval(() => send({ type: 'hello' }), 800);
    window.addEventListener('beforeunload', () => send({ type: 'bye' }));
    if (ch) ch.onmessage = (ev) => {
      const m = ev.data || {}, g = CNB.game; if (!g) return;
      if (m.type === 'key' || m.type === 'keyup') {
        window.dispatchEvent(new KeyboardEvent(m.type === 'key' ? 'keydown' : 'keyup', { key: m.key, bubbles: true }));
      } else if (m.type === 'gift') {
        const gk = giftKeyFrom(m.key); if (!gk) return;
        if (g.mode === 'title' && g.start) g.start();
        g.bridge.test(gk, m.user || undefined);
      } else if (m.type === 'control' && g.setControl) g.setControl(m.value);
      else if (m.type === 'character' && g.setCharacter) g.setCharacter(m.value);
      else if (m.type === 'ann' && g.cfg.announcer) g.cfg.announcer.enabled = m.value;
      else if (m.type === 'voice' && g.voice) { g.voice.cfg.enabled = m.value; if (!m.value) g.voice.stop(); }
      else if (m.type === 'ws') {
        if (g.bridge.ws) { g.bridge.url = null; try { g.bridge.ws.close(); } catch (e) {} g.bridge.ws = null; g.bridge.status = 'teste'; }
        if (m.url) g.bridge.connect(m.url);
      }
      else if (m.type === 'status?') send({ type: 'status', bridge: g.bridge.status, url: g.bridge.url });
    };
    return;
  }

  // ------------------------------------------------------------ CONTROLE REMOTO
  const panel = document.getElementById('test-panel');
  if (!panel || !ch) return;
  let lastHello = 0, liveWin = null, wasLive = false;
  const isLive = () => performance.now() - lastHello < 2500;

  const box = document.createElement('div');
  box.className = 'live-box';
  box.innerHTML = `<button class="ctrl wide studio" id="btn-livewin" style="width:100%;font-size:14px;padding:12px">📺 Abrir janela da live (só o jogo)</button>
    <div id="livewin-status" style="font-size:12px;margin-top:6px;color:#8d86a0">Capture a janela da live no LIVE Studio. Esta aqui vira o controle.</div>`;
  const h2 = panel.querySelector('h2');
  h2.insertAdjacentElement('afterend', box);
  document.getElementById('btn-livewin').addEventListener('click', () => {
    const url = location.pathname + '?modo=live';
    liveWin = window.open(url, 'cnb-live-' + location.pathname, 'popup=yes,width=540,height=960,left=40,top=20');
    if (liveWin) liveWin.focus();
  });
  const status = document.getElementById('livewin-status');

  ch.onmessage = (ev) => {
    const m = ev.data || {};
    if (m.type === 'hello') lastHello = performance.now();
    if (m.type === 'bye') lastHello = 0;
  };

  setInterval(() => {
    const live = isLive(), g = CNB.game;
    if (live !== wasLive && g) {
      // com a janela da live aberta, esta janela fica muda e desconectada (quem recebe os presentes é a outra)
      g.audio.setMuted(live);
      if (g.voice && g.voice.setMuted) g.voice.setMuted(live);
      if (live && g.bridge.ws) { const u = g.bridge.url; g.bridge.url = null; try { g.bridge.ws.close(); } catch (e) {} g.bridge.ws = null; g.bridge.status = 'teste'; g.bridge._remoteUrl = u; }
      if (!live && g.bridge._remoteUrl) { g.bridge.connect(g.bridge._remoteUrl); g.bridge._remoteUrl = null; }
      document.getElementById('stage').style.opacity = live ? '0.35' : '';
      wasLive = live;
    }
    status.innerHTML = live
      ? '<b style="color:#4ade80">● Janela da live aberta.</b> Os botões e teclas daqui controlam ela.'
      : 'Capture a janela da live no LIVE Studio. Esta aqui vira o controle.';
  }, 500);

  // teclas: com a janela da live aberta, vão para ela (menos H e F, que são desta janela)
  const fwdKey = (type) => (e) => {
    if (!isLive()) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'h' || k === 'f') return;
    const userInput = document.getElementById('test-user');
    if (type === 'key' && /^[0-9]$/.test(k) && giftKeyFrom(k)) send({ type: 'gift', key: k, user: userInput && userInput.value.trim() });
    else send({ type, key: e.key });
    e.preventDefault(); e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', fwdKey('key'), true);
  window.addEventListener('keyup', fwdKey('keyup'), true);

  // botões do painel
  panel.addEventListener('click', (e) => {
    if (!isLive()) return;
    const b = e.target.closest('button'); if (!b) return;
    const userInput = document.getElementById('test-user');
    if (b.classList.contains('gift-btn')) {
      send({ type: 'gift', key: b.querySelector('kbd').textContent.trim(), user: userInput && userInput.value.trim() });
    } else {
      const map = { 'btn-demo': 'd', 'btn-reset': 'r', 'btn-win': 'w' };
      if (map[b.id]) send({ type: 'key', key: map[b.id] });
      else if (b.id === 'btn-ws') {
        // salva o endereço e conecta só a janela da live (esta continua desconectada)
        const u = document.getElementById('ws-url').value.trim();
        try { localStorage.setItem(location.pathname.includes('carrinho') ? 'cm-ws' : 'cnb-ws', u); } catch (err) {}
        send({ type: 'ws', url: u });
      }
      else if (b.id === 'btn-ann' || b.id === 'btn-voice') {
        // o botão alterna aqui (texto) e manda o novo estado para a live
        setTimeout(() => {
          const g = CNB.game;
          if (b.id === 'btn-ann') send({ type: 'ann', value: g.cfg.announcer.enabled });
          else send({ type: 'voice', value: g.voice.cfg.enabled });
        }, 30);
        return;
      } else return;
    }
    e.preventDefault(); e.stopImmediatePropagation();
  }, true);
  // seletores (controle manual/auto, personagem)
  panel.addEventListener('change', (e) => {
    if (!isLive()) return;
    if (e.target.id === 'ctl-select') send({ type: 'control', value: e.target.value });
    if (e.target.id === 'char-select') send({ type: 'character', value: e.target.value });
  }, true);
})();
