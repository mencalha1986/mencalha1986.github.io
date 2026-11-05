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
     ChegaNoBar.gift('@fulano', 'Rose', 3)
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
      window.ChegaNoBar = window.ChegaNoBar || {};
      window.ChegaNoBar.gift = (user, gift, count = 1) => this.gifts.receive({ user, gift, count, source: 'api' });
    }

    // ---------------- modo de teste ----------------
    fakeUser() { return U.choice(this.cfg.test.fakeUsers); }
    test(key, user) { return this.gifts.receive({ user: user || this.fakeUser(), gift: key, count: 1, source: 'teste' }); }
    toggleDemo(v) { this.demo = v === undefined ? !this.demo : v; this.demoT = 0.5; return this.demo; }
    update(dt, canAct) {
      if (!this.demo || !canAct) return;
      this.demoT -= dt;
      if (this.demoT > 0) return;
      const r = Math.random();
      const key = r < 0.34 ? 'rosa' : r < 0.58 ? 'tiktok' : r < 0.68 ? 'cerveja' : r < 0.78 ? 'voltar' : r < 0.86 ? 'tropeco' : r < 0.95 ? 'turbo' : 'cachorro';
      this.gifts.receive({ user: this.fakeUser(), gift: key, count: key === 'rosa' && Math.random() < 0.3 ? U.randInt(2, 6) : 1, source: 'demo' });
      this.demoT = U.rand(this.cfg.test.demoInterval[0], this.cfg.test.demoInterval[1]);
    }

    // ---------------- integração por WebSocket ----------------
    connect(url) {
      this.url = url;
      this.status = 'conectando';
      try { this.ws = new WebSocket(url); } catch (e) { this.status = 'desconectado'; this._retry(); return; }
      this.ws.onopen = () => { this.status = 'ao vivo'; console.info('[CHEGA NO BAR] integração conectada:', url); };
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
      // novo seguidor: evento "follow" (ou "social" com displayType de follow)
      if (type.includes('follow') || type === 'seguir' || (type.includes('social') && String(env.displayType || env.label || '').toLowerCase().includes('follow'))) {
        const fu = env.user && typeof env.user === 'object' ? env.user : {};
        return { user: env.nickname || env.uniqueId || env.username || fu.nickname || fu.uniqueId || fu.username || 'anônimo', gift: 'follow', count: 1, source: 'live' };
      }
      if (!type.includes('gift') && !type.includes('presente')) return null;
      const u = env.user && typeof env.user === 'object' ? env.user : {};
      const user = env.nickname || env.uniqueId || env.username || u.nickname || u.uniqueId || u.username || (typeof env.user === 'string' ? env.user : '') || 'anônimo';
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
