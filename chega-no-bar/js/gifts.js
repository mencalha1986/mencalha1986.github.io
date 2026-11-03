/* =========================================================================
   SISTEMA DE PRESENTES — normaliza, contabiliza e despacha ações
   Fonte do evento (teste ou integração) não importa: tudo passa por receive()
   ========================================================================= */
(function () {
  const U = CNB.U;

  class GiftSystem {
    constructor(cfg, onAction) {
      this.cfg = cfg;
      this.onAction = onAction;
      this.feed = [];
      this.resetRound();
    }

    resetRound() {
      this.users = new Map();
      this.totalGifts = 0;
      this.totalPoints = 0;
      this.byType = {};
    }

    resolveKey(name) {
      if (!name) return null;
      const n = String(name).trim().toLowerCase();
      if (this.cfg.gifts[n]) return n;
      if (this.cfg.giftAliases[n]) return this.cfg.giftAliases[n];
      for (const k in this.cfg.gifts) if (this.cfg.gifts[k].label.toLowerCase() === n) return k;
      return null;
    }

    /** evt: { user, gift, count?, source? } */
    receive(evt) {
      const key = this.resolveKey(evt.gift);
      if (!key) { console.info('[CHEGA NO BAR] presente sem ação configurada:', evt.gift); return false; }
      const def = this.cfg.gifts[key];
      const count = U.clamp(parseInt(evt.count, 10) || 1, 1, 99);
      const user = String(evt.user || 'anônimo').slice(0, 32);
      const name = user.startsWith('@') ? user : '@' + user;

      this.totalGifts += count;
      this.totalPoints += def.points * count;
      this.byType[key] = (this.byType[key] || 0) + count;
      let u = this.users.get(name);
      if (!u) { u = { name, points: 0, gifts: 0, helped: 0, sabotaged: 0 }; this.users.set(name, u); }
      u.points += def.points * count;
      u.gifts += count;
      if (['back', 'trip', 'gameover'].includes(def.action)) u.sabotaged += count; else u.helped += count;

      this.feed.unshift({ user: name, key, def, count, t: performance.now() / 1000, source: evt.source || '' });
      if (this.feed.length > 12) this.feed.length = 12;

      this.onAction && this.onAction(key, def, count, name);
      return true;
    }

    ranking(n = 3) {
      return [...this.users.values()].sort((a, b) => b.points - a.points || b.gifts - a.gifts).slice(0, n);
    }
  }

  CNB.GiftSystem = GiftSystem;
})();
