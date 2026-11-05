/* =========================================================================
   CATÁLOGO — os achados do site achadosuteisporai.com.br
   Carrega o produtos.js do site (sempre atualizado). Se não der, usa a
   cópia local js/produtos-reserva.js. Pré-carrega as fotos para o canvas.
   ========================================================================= */
(function () {
  const U = CNB.U;

  const CAT_LABEL = { tecnologia: 'TECNOLOGIA', cozinha: 'COZINHA', organizacao: 'ORGANIZAÇÃO', limpeza: 'LIMPEZA', casa: 'CASA', moda: 'MODA PRAIA' };
  const CAT_COLOR = { tecnologia: '#38bdf8', cozinha: '#fb923c', organizacao: '#a78bfa', limpeza: '#34d399', casa: '#f472b6', moda: '#facc15' };

  function parsePrice(p) {
    if (typeof p === 'number') return p;
    const s = String(p || '').replace(/[^\d,.]/g, '');
    const v = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(v) ? v : 0;
  }
  CNB.fmtBRL = (v) => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  function shortName(n) {
    // nome curto para a tela: corta em parênteses e detalhes
    let s = n.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > 34) s = s.split(' ').reduce((a, w) => ((a + ' ' + w).trim().length <= 32 ? (a + ' ' + w).trim() : a), '');
    return s;
  }

  class Catalog {
    constructor(cfg) {
      this.cfg = cfg;
      this.items = [];
      this.source = 'carregando';
      this.ready = this._load();
    }

    _load() {
      return new Promise((resolve) => {
        const done = (list, source) => {
          this.items = (list || []).map((p, i) => ({
            id: p.itemId || p.slug || String(i),
            name: p.nome, short: shortName(p.nome),
            call: p.chamada || '',
            price: parsePrice(p.preco), from: !!p.aPartir,
            cat: CAT_LABEL[p.categoria] ? p.categoria : 'casa',
            sold: p.vendidos || 0,
            img: (p.fotos && p.fotos[0]) || p.img,
            slug: p.slug
          })).filter((p) => p.price > 0 && p.img);
          this.source = source;
          this.items.forEach((it) => this._image(it));
          resolve(this);
        };
        // 1) produtos do site (sempre atualizados)
        const s = document.createElement('script');
        s.src = this.cfg.productsUrl + '?v=' + Math.floor(Date.now() / 3.6e6);
        const timer = setTimeout(() => fallback(), 4000);
        const fallback = () => { clearTimeout(timer); if (!this.items.length) done(window.PRODUTOS_RESERVA, 'reserva'); };
        s.onload = () => { clearTimeout(timer); window.PRODUTOS && window.PRODUTOS.length ? done(window.PRODUTOS, 'site') : fallback(); };
        s.onerror = fallback;
        document.head.appendChild(s);
      });
    }

    _image(it) {
      const im = new Image();
      im.referrerPolicy = 'no-referrer';
      im.decoding = 'async';
      im.onload = () => (it.ok = true);
      im.onerror = () => (it.ok = false);
      im.src = it.img;
      it.image = im;
    }

    byCategory(cat) { return this.items.filter((i) => i.cat === cat); }
    get categories() { return [...new Set(this.items.map((i) => i.cat))]; }

    /** desenha a foto do produto num quadrado (com fundo branco de vitrine) */
    drawPhoto(ctx, it, x, y, size, radius = 0) {
      ctx.save();
      if (radius) { U.roundRect(ctx, x, y, size, size, radius); ctx.clip(); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, size, size);
      if (it.ok && it.image.naturalWidth) {
        const iw = it.image.naturalWidth, ih = it.image.naturalHeight, s = Math.min(size / iw, size / ih);
        ctx.drawImage(it.image, x + (size - iw * s) / 2, y + (size - ih * s) / 2, iw * s, ih * s);
      } else {
        // sem foto: caixinha com a cor da categoria
        ctx.fillStyle = CAT_COLOR[it.cat]; ctx.fillRect(x + size * 0.2, y + size * 0.25, size * 0.6, size * 0.55);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + size * 0.2, y + size * 0.42, size * 0.6, size * 0.08);
      }
      ctx.restore();
    }
  }

  Catalog.CAT_LABEL = CAT_LABEL;
  Catalog.CAT_COLOR = CAT_COLOR;
  CNB.Catalog = Catalog;
})();
