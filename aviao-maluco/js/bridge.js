/* =========================================================================
   PONTE TIKTOK LIVE  +  MODO DE TESTE (separados)
   -------------------------------------------------------------------------
   O jogo NÃO se conecta diretamente ao TikTok. Ele recebe eventos de presente
   de uma ferramenta de eventos de live autorizada que você já usa (rodando no
   seu PC) através de um WebSocket local.

   Abra o jogo com:  index.html?ws=ws://localhost:PORTA
   Mensagens aceitas (JSON). Formato recomendado:
     { "type": "gift", "user": "@fulano", "gift": "Rose", "count": 5 }
   Também são aceitos campos comuns: nickname / uniqueId / username,
   giftName / gift.name, repeatCount / amount, e envelopes { event, data }.
   Combos (streak) com repeatEnd=false são ignorados até o fim do combo.

   Para integrar por outro meio (script, extensão), chame no console/JS:
     AviaoMaluco.gift('@fulano', 'Rose', 3)
   ========================================================================= */
(function () {
  const U = CNB.U;

  class Bridge {
    constructor(gifts, cfg) {
      this.gifts = gifts;
      this.cfg = cfg;
      this.status = 'teste';     // 'teste' | 'conectando' | 'ao vivo' | 'desconectado'
      this.demo = false;
      this.demoT = 1;
      this.ws = null;
      this.url = null;
      this.lastStreak = new Map();
      window.AviaoMaluco = window.AviaoMaluco || {};
      window.AviaoMaluco.gift = (user, gift, count = 1) => this.gifts.receive({ user, gift, count, source: 'api' });
    }

    // ---------------- modo de teste ----------------
    fakeUser() { return U.choice(this.cfg.test.fakeUsers); }
    test(key, user) { return this.gifts.receive({ user: user || this.fakeUser(), gift: key, count: 1, source: 'teste' }); }
    toggleDemo(v) { this.demo = v === undefined ? !this.demo : v; this.demoT = 0.5; return this.demo; }
    update(dt, canAct) {
      if (!this.demo || !canAct) return;
      this.demoT -= dt;
      if (this.demoT > 0) return;
      // sorteia pelo peso "demo" de cada presente na configuração
      const G = this.cfg.gifts, keys = Object.keys(G).filter((k) => G[k].demo);
      let r = Math.random() * keys.reduce((a, k) => a + G[k].demo, 0);
      const key = keys.find((k) => (r -= G[k].demo) < 0) || keys[0];
      this.gifts.receive({ user: this.fakeUser(), gift: key, count: 1, source: 'demo' });
      this.demoT = U.rand(this.cfg.test.demoInterval[0], this.cfg.test.demoInterval[1]);
    }

    // ---------------- integração por WebSocket ----------------
    connect(url) {
      this.url = url;
      this.status = 'conectando';
      try { this.ws = new WebSocket(url); } catch (e) { this.status = 'desconectado'; this._retry(); return; }
      this.ws.onopen = () => { this.status = 'ao vivo'; console.info('[AVIÃO MALUCO] integração conectada:', url); };
      this.ws.onclose = () => { this.status = 'desconectado'; this._retry(); };
      this.ws.onerror = () => { this.status = 'desconectado'; };
      this.ws.onmessage = (m) => {
        let data;
        try { data = JSON.parse(m.data); } catch (e) { return; }
        const list = Array.isArray(data) ? data : [data];
        list.forEach((d) => { const g = this.normalize(d); if (g) this.gifts.receive(g); });
      };
    }
    _retry() { clearTimeout(this._rt); this._rt = setTimeout(() => this.url && this.connect(this.url), 3000); }

    normalize(msg) {
      if (!msg || typeof msg !== 'object') return null;
      const env = msg.data && typeof msg.data === 'object' ? msg.data : msg.payload && typeof msg.payload === 'object' ? msg.payload : msg;
      const type = String(msg.type || msg.event || env.type || env.event || 'gift').toLowerCase();
      const u = env.user && typeof env.user === 'object' ? env.user : {};
      const user = env.nickname || env.uniqueId || env.username || u.nickname || u.uniqueId || u.username || (typeof env.user === 'string' ? env.user : '') || 'anônimo';
      // novo seguidor: evento "follow" (ou "social" com displayType de follow)
      const label = String(env.displayType || env.label || '').toLowerCase();
      if (type.includes('follow') || type === 'seguir' || (type.includes('social') && label.includes('follow'))) {
        return { user, gift: 'follow', count: 1, source: 'live' };
      }
      if (!type.includes('gift') && !type.includes('presente')) return null;
      const g = env.gift && typeof env.gift === 'object' ? env.gift : {};
      const gift = env.giftName || g.name || g.giftName || (typeof env.gift === 'string' ? env.gift : '') || env.name;
      let count = parseInt(env.repeatCount || env.count || env.amount || g.repeatCount || 1, 10) || 1;
      // combos: só conta quando o combo termina (repeatCount traz o total do combo)
      if (env.giftType === 1 && env.repeatEnd === false) return null;
      return { user, gift, count, source: 'live' };
    }
  }

  CNB.Bridge = Bridge;
})();
