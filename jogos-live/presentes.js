/* =========================================================================
   PRESENTES DA LIVE — integração real com o TikTok LIVE (comum aos 4 jogos)
   -------------------------------------------------------------------------
   DE ONDE VÊM OS EVENTOS
   O TikTok LIVE Studio não entrega os eventos da live para outros programas.
   Quem faz isso é o app do TikFinity para Windows: ele fica conectado à live e
   repassa cada evento pelo WebSocket local ws://localhost:21213, no formato
   { event, data } do TikTok-Live-Connector:
     gift   → uniqueId, nickname, giftId, giftName, repeatCount, repeatEnd,
              giftType (1 = presente de combo), diamondCount (moedas),
              giftPictureUrl, msgId
     follow → uniqueId, nickname (novo seguidor)
   Se a conexão cair, o bridge.js de cada jogo reconecta sozinho a cada 3 s.

   O QUE ESTE ARQUIVO FAZ (carregado logo depois do config.js do jogo)
   - lê também o ID, as moedas e a imagem de cada presente recebido;
   - reconhece o presente pelo ID oficial do TikTok, mesmo que o nome chegue
     em outro idioma (os IDs abaixo vêm da lista oficial de presentes do TikTok);
   - descarta eventos repetidos (mesmo msgId, ou a mesma mensagem idêntica em 3 s);
   - FILA: processa um presente por vez, na ordem em que chegaram, com um
     intervalo curto, para que vários presentes juntos apareçam todos;
   - PAINEL HERÓI / VILÃO no controle: troca qual presente faz cada ação, sem
     mexer no código (fica salvo neste navegador). A janela da live recarrega
     sozinha com o novo mapeamento;
   - registro dos presentes reais que chegaram (quem, presente, quantidade,
     moedas, ID), para conferir durante a live.
   O modo de teste (botões 1 a 9 do painel) continua separado: não passa pela
   fila nem pelo filtro de repetidos.
   ========================================================================= */
(function () {
  const CNB = window.CNB; if (!CNB || !CNB.CONFIG) return;
  const cfg = CNB.CONFIG, G = cfg.gifts;
  const GAME = location.pathname.split('/').filter((s) => s && !s.includes('.')).pop() || 'jogo';
  const KEY = 'live-presentes:' + GAME, SEEN = 'live-presentes:vistos';
  const LIVE_WIN = new URLSearchParams(location.search).get('modo') === 'live';
  const GAP = 0.35;              // segundos entre um presente e o próximo da fila
  const ch = 'BroadcastChannel' in window ? new BroadcastChannel('live-presentes:' + GAME) : null;

  // IDs oficiais (lista de presentes do TikTok) dos presentes usados hoje nos jogos
  const OFFICIAL_ID = { 'rosa': 5655, 'tiktok': 5269, 'pistola de dinheiro': 7168, 'rosquinha': 5879, 'galáxia': 11046 };

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const low = (s) => String(s || '').trim().toLowerCase();
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // equipe: VILÃO atrapalha o personagem, HERÓI ajuda
  const VILAO = ['back', 'wind', 'engine', 'birds', 'gameover', 'slip', 'trip', 'dog', 'flat', 'follow', 'blitz'];
  const team = (def) => def.team || (VILAO.includes(def.action) ? 'vilao' : 'heroi');

  // ------------------------------------------------------------ mapeamento salvo
  const DEFAULT = {};
  for (const k in G) DEFAULT[k] = { name: G[k].tiktok || '', img: G[k].img || null, id: OFFICIAL_ID[low(G[k].tiktok)] || null };
  const seen = load(SEEN, {});                 // presentes reais já recebidos: nome → { name, id, coins, img }
  const saved = load(KEY, { map: {} });
  const giftId = {};                            // id oficial → chave do presente no jogo
  for (const k in G) {
    if (G[k].action === 'follow' || G[k].free) continue;   // seguir não é presente
    const m = saved.map[k];
    if (m && m.name && low(m.name) !== low(DEFAULT[k].name)) {
      // presente trocado no painel: os nomes antigos deixam de valer para esta ação
      for (const a in cfg.giftAliases) if (cfg.giftAliases[a] === k) delete cfg.giftAliases[a];
      G[k].tiktok = m.name;
      const s = seen[low(m.name)];
      G[k].img = (s && s.img) || m.img || null;
      if (!G[k].img) delete G[k].img;
      cfg.giftAliases[low(m.name)] = k;
      if (m.id || (s && s.id)) giftId[m.id || s.id] = k;
    } else if (DEFAULT[k].id) giftId[DEFAULT[k].id] = k;
    if (G[k].tiktok) cfg.giftAliases[low(G[k].tiktok)] = k;
  }

  // ------------------------------------------------------------ ponte: moedas, ID, repetidos e fila
  const recent = new Map();   // assinatura → horário (descarta repetidos)
  const isDup = (sig, ttl) => {
    const now = Date.now();
    for (const [s, t] of recent) if (now - t > 120000) recent.delete(s);
    if (recent.has(sig) && now - recent.get(sig) < ttl) return true;
    recent.set(sig, now); return false;
  };
  const log = [];             // últimos eventos reais (aparecem no painel do controle)
  function report(e) {
    log.unshift(e); if (log.length > 15) log.length = 15;
    if (ch) ch.postMessage({ type: 'evento', e });
    if (window.LivePresentes && window.LivePresentes.onEvent) window.LivePresentes.onEvent(e);
  }

  function patchBridge(B) {
    if (!B || B.__livePresentes) return; B.__livePresentes = true;
    const orig = B.prototype.normalize;
    B.prototype.normalize = function (msg) {
      const g = orig.call(this, msg);
      if (!g) return null;
      const env = msg && typeof msg.data === 'object' ? msg.data : msg && typeof msg.payload === 'object' ? msg.payload : msg || {};
      const gi = env.gift && typeof env.gift === 'object' ? env.gift : {};
      g.giftId = env.giftId || gi.id || null;
      const coins = env.diamondCount !== undefined ? env.diamondCount : gi.diamond_count;
      g.coins = coins !== undefined && coins !== null ? Number(coins) : null;
      g.img = env.giftPictureUrl || (gi.image && gi.image.url_list && gi.image.url_list[0]) || null;
      g.msgId = env.msgId || env.msg_id || null;
      const name = String(g.gift || '');
      // repetidos: mesmo msgId (2 min) ou exatamente a mesma mensagem em até 3 s
      if (g.msgId ? isDup('m' + g.msgId, 120000) : isDup('j' + JSON.stringify(msg), 3000)) return null;
      // aprende nome, ID, moedas e imagem dos presentes reais (ajuda a montar o mapeamento)
      if (name && name !== 'follow') {
        seen[low(name)] = { name, id: g.giftId || (seen[low(name)] || {}).id || null, coins: g.coins, img: g.img || (seen[low(name)] || {}).img || null };
        save(SEEN, seen);
      }
      // reconhece pelo ID oficial (o nome pode chegar em inglês ou português) ou pelo nome do mapeamento;
      // presente real nunca é reconhecido pelo nome interno da ação (ex.: "TikTok" trocado no painel não vale mais)
      const key = (g.giftId && giftId[g.giftId]) || cfg.giftAliases[low(name)] || null;
      if (key) g.gift = key;
      else if (G[low(name)] || Object.values(G).some((d) => low(d.label) === low(name))) g.gift = name + ' (sem ação)';
      report({ t: Date.now(), user: g.user, gift: name === 'follow' ? 'Seguiu o perfil' : name, count: g.count, coins: g.coins, id: g.giftId, action: key ? G[key].label : null, team: key ? team(G[key]) : null });
      // fila: processa em ordem, um por vez
      this.__fila = this.__fila || [];
      this.__fila.push(g);
      if (!this.__filaT) {
        let last = 0;
        this.__filaT = setInterval(() => {
          const now = performance.now() / 1000;
          if (!this.__fila.length || now - last < GAP) return;
          last = now; this.gifts.receive(this.__fila.shift());
        }, 50);
      }
      return null;
    };
  }
  // o bridge.js de cada jogo é carregado depois deste arquivo: aplica assim que ele aparecer
  let bridgeClass = CNB.Bridge;
  Object.defineProperty(CNB, 'Bridge', { configurable: true, get: () => bridgeClass, set: (v) => { bridgeClass = v; patchBridge(v); } });
  if (bridgeClass) patchBridge(bridgeClass);

  window.LivePresentes = { GAME, team, log, seen, fila: () => (CNB.game && CNB.game.bridge && CNB.game.bridge.__fila || []).length };

  // janela da live: recarrega quando o mapeamento muda (reconecta sozinha pelo endereço salvo)
  if (LIVE_WIN) { if (ch) ch.onmessage = (ev) => { if (ev.data && ev.data.type === 'mapa') location.reload(); }; return; }

  // ------------------------------------------------------------ PAINEL HERÓI / VILÃO (controle)
  window.addEventListener('load', () => {
    const panel = document.getElementById('test-panel'); if (!panel) return;
    const css = document.createElement('style');
    css.textContent = `
      .lp-box{margin:12px 0;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.03)}
      .lp-box h3{margin:0 0 6px;font:400 20px 'Bebas Neue',Impact,sans-serif;letter-spacing:.5px;color:#ffd23f}
      .lp-team{margin:8px 0 4px;font:800 11px Rubik,sans-serif;letter-spacing:1px}
      .lp-row{display:grid;grid-template-columns:1fr 1.25fr;gap:6px;align-items:center;margin:4px 0}
      .lp-row b{display:block;font:700 12.5px Rubik,sans-serif;color:#fff}
      .lp-row small{display:block;font:500 11px Rubik,sans-serif;color:#b9b3c9}
      .lp-row input{width:100%;box-sizing:border-box;padding:7px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:#14111d;color:#fff;font:600 12.5px Rubik,sans-serif}
      .lp-row input:disabled{opacity:.6}
      .lp-btns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
      .lp-log{margin-top:6px;max-height:190px;overflow:auto;font:500 11.5px Rubik,sans-serif;color:#d8d3e6}
      .lp-log div{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.06)}
      .lp-log .no{color:#fca5a5}
      .lp-note{font:500 11px Rubik,sans-serif;color:#b9b3c9;margin:4px 0 0;line-height:1.4}`;
    document.head.appendChild(css);

    const box = document.createElement('div'); box.className = 'lp-box';
    const names = new Set(Object.values(DEFAULT).map((d) => d.name).filter(Boolean));
    for (const s of Object.values(seen)) names.add(s.name);
    const rows = (t) => Object.keys(G).filter((k) => team(G[k]) === t).map((k) => {
      const d = G[k], free = d.action === 'follow' || d.free;
      const act = CNB.game && CNB.game.hud && CNB.game.hud.actionText ? CNB.game.hud.actionText(d, 1) : '';
      return `<div class="lp-row"><div><b>${esc(d.label)}</b><small>${esc(act)}</small></div>
        <input data-k="${esc(k)}" list="lp-nomes" value="${esc(free ? 'Seguir (evento, grátis)' : (d.tiktok || ''))}" ${free ? 'disabled' : ''} placeholder="nome do presente"></div>`;
    }).join('');
    box.innerHTML = `<h3>PRESENTES DA LIVE</h3>
      <p class="lp-note">Escreva ou escolha o presente do TikTok que faz cada ação. Vale para esta live e as próximas (fica salvo neste computador).</p>
      <div class="lp-team" style="color:#4ade80">HERÓI · ajuda o personagem</div>${rows('heroi')}
      <div class="lp-team" style="color:#f87171">VILÃO · atrapalha o personagem</div>${rows('vilao')}
      <datalist id="lp-nomes">${[...names].map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="lp-btns"><button class="ctrl" id="lp-salvar">Salvar presentes</button><button class="ctrl" id="lp-padrao">Voltar ao padrão</button></div>
      <div class="lp-team" style="color:#38bdf8;margin-top:12px">PRESENTES REAIS RECEBIDOS <span id="lp-fila"></span></div>
      <div class="lp-log" id="lp-log"><div style="color:#8d86a0">Nenhum ainda. Eles aparecem aqui assim que chegam pela live.</div></div>`;
    const anchor = panel.querySelector('#unknown-gifts');
    (anchor && anchor.parentElement ? anchor.parentElement : panel.querySelector('h2')).insertAdjacentElement('afterend', box);

    // separa os botões de teste do que vem da live
    const btns = panel.querySelector('#gift-buttons');
    if (btns) {
      const tu = panel.querySelector('#test-user'), at = tu && tu.previousElementSibling && tu.previousElementSibling.tagName === 'LABEL' ? tu.previousElementSibling : (tu || btns);
      const h = document.createElement('div'); h.className = 'lp-team'; h.style.cssText = 'color:#facc15;margin-top:14px';
      h.textContent = 'MODO DE TESTE · não usa presentes reais';
      at.insertAdjacentElement('beforebegin', h);
    }

    const reloadAll = () => { if (ch) ch.postMessage({ type: 'mapa' }); setTimeout(() => location.reload(), 150); };
    box.querySelector('#lp-salvar').addEventListener('click', () => {
      const map = {};
      box.querySelectorAll('input[data-k]').forEach((inp) => {
        const k = inp.dataset.k, v = inp.value.trim(); if (inp.disabled || !v) return;
        const s = seen[low(v)];
        map[k] = { name: v, id: (s && s.id) || OFFICIAL_ID[low(v)] || null, img: (s && s.img) || (low(v) === low(DEFAULT[k].name) ? DEFAULT[k].img : null) };
      });
      save(KEY, { map }); reloadAll();
    });
    box.querySelector('#lp-padrao').addEventListener('click', () => { save(KEY, { map: {} }); reloadAll(); });

    const logEl = box.querySelector('#lp-log'), filaEl = box.querySelector('#lp-fila'), shown = [];
    const fmt = (e) => {
      const h = new Date(e.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const q = e.count > 1 ? ` ×${e.count}` : '', c = e.coins ? ` · ${e.coins * (e.count || 1)} moedas` : '', id = e.id ? ` · id ${e.id}` : '';
      const a = e.action ? ` → <b style="color:${e.team === 'vilao' ? '#f87171' : '#4ade80'}">${esc(e.action)}</b>` : ' → <span class="no">sem ação</span>';
      return `<div>${h} · <b>${esc(e.user)}</b>: ${esc(e.gift)}${esc(q)}${esc(c)}${esc(id)}${a}</div>`;
    };
    const add = (e) => { shown.unshift(e); if (shown.length > 15) shown.length = 15; logEl.innerHTML = shown.map(fmt).join(''); };
    window.LivePresentes.onEvent = add;                                   // eventos recebidos nesta janela
    if (ch) ch.onmessage = (ev) => { if (ev.data && ev.data.type === 'evento') add(ev.data.e); };   // e os da janela da live
    setInterval(() => { const n = window.LivePresentes.fila(); filaEl.textContent = n ? `· ${n} na fila` : ''; }, 500);
  });
})();
