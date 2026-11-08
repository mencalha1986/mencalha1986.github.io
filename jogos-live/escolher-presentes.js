/* =========================================================================
   ESCOLHER PRESENTES — painel simples para o criador escolher qual presente
   do TikTok faz cada ação do jogo. Comum a todos os jogos.

   Uso no jogo:
     EscolherPresentes.init({
       jogo: 'autorama',                       // chave única do jogo
       acoes: [{ id:'nitro', texto:'Nitro no nosso carro', tipo:'bom', padrao:6064 }, ...],
       aoMudar: (escolha) => { ... }           // { nitro: {id, nome, moedas, img, en}, ... }
     });
     EscolherPresentes.abrir();
   A escolha fica salva neste computador e a janela da live atualiza sozinha.
   ========================================================================= */
(function () {
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || '../jogos-live/';
  const CDN = 'https://p16-webcast.tiktokcdn.com/img/maliva/webcast-va/';
  const L = (f) => BASE + 'img/' + f, C = (h) => CDN + h + '~tplv-obj.webp';
  // presentes mais usados nas lives do Brasil (id oficial, nome em português, moedas, ícone, nome em inglês)
  const CATALOGO = [
    [5655, 'Rosa', 1, L('rose.webp'), 'rose'],
    [5269, 'TikTok', 1, L('tiktok.webp'), 'tiktok'],
    [6064, 'GG', 1, L('gg.webp'), 'gg'],
    [5827, 'Casquinha de sorvete', 1, L('ice-cream-cone.webp'), 'ice cream cone'],
    [7934, 'Heart Me', 1, L('heart-me.png'), 'heart me'],
    [8239, 'Rosa branca', 1, C('a2d81f3847457be9083a9c76a59b08cb'), 'white rose'],
    [6784, 'Fatia de bolo', 1, C('f681afb4be36d8a321eac741d387f1e2'), 'cake slice'],
    [6788, 'Bastão luminoso', 1, C('8e1a5d66370c5586545e358e37c10d25'), 'glow stick'],
    [5487, 'Coração com os dedos', 5, L('finger-heart.webp'), 'finger heart'],
    [5576, 'Coração', 10, C('98bea1b189fba75bf0ca766b4dc1976e'), 'heart'],
    [9947, 'Colar da amizade', 10, C('e033c3f28632e233bebac1668ff66a2f'), 'friendship necklace'],
    [5658, 'Perfume', 20, L('perfume.webp'), 'perfume'],
    [5879, 'Rosquinha', 30, L('doughnut.webp'), 'doughnut'],
    [14488, 'Capivara', 30, C('6703facdac34caefbd0617a6321afe9b'), 'capybara'],
    [6104, 'Boné', 99, C('6c2ab2da19249ea570a2ece5e3377f04'), 'cap'],
    [6427, 'Chapéu e bigode', 99, C('2f1e4f3f5c728ffbfa35705b480fdc92'), 'hat and mustache'],
    [5659, 'Tsuru de papel', 99, C('0f158a08f7886189cdabf496e8a07c21'), 'paper crane'],
    [6097, 'Coroinha', 99, C('cf3db11b94a975417043b53401d0afe1'), 'little crown'],
    [5585, 'Confete', 100, C('cb4e11b3834e149f08e1cdcc93870b26'), 'confetti'],
    [5660, 'Coração com as mãos', 100, C('6cd022271dc4669d182cad856384870f'), 'hand heart'],
    [5509, 'Óculos de sol', 199, C('08af67ab13a8053269bf539fd27f3873'), 'sunglasses'],
    [5586, 'Corações', 199, C('934b5a10dee8376df5870a61d2ea5cb6'), 'hearts'],
    [6437, 'Tiara de flores', 199, C('bdbdd8aeb2b69c173a3ef666e63310f3'), 'garland headpiece'],
    [6267, 'Corgi', 299, L('corgi.webp'), 'corgi'],
    [5731, 'Coral', 499, C('d4faa402c32bf4f92bee654b2663d9f1'), 'coral'],
    [7168, 'Pistola de dinheiro', 500, L('money-gun.png'), 'money gun'],
    [5897, 'Cisne', 699, C('97a26919dbf6afe262c97e22a83f4bf1'), 'swan'],
    [5978, 'Trem', 899, C('4227ed71f2c494b554f9cbe2147d4899'), 'train'],
    [11046, 'Galáxia', 1000, L('galaxy.webp'), 'galaxy'],
    [6090, 'Fogos de artifício', 1088, C('9494c8a0bc5c03521ef65368e59cc2b8'), 'fireworks'],
    [14487, 'Dia de praia', 2999, C('8b87bbb88b80a5bf63abb6abcd4fa147'), 'beach day'],
    [5338, 'Unicórnio', 5000, C('483c644e67e9bb1dd5970f2df00b7576'), 'unicorn fantasy'],
    [6089, 'Carro esportivo', 7000, C('e7ce188da898772f18aaffe49a7bd7db'), 'sports car'],
    [6369, 'Leão', 29999, C('4fb89af2082a290b37d704e20f4fe729'), 'lion']
  ].map(([id, nome, moedas, img, en]) => ({ id, nome, moedas, img, en }));
  const porId = new Map(CATALOGO.map((g) => [g.id, g]));
  const EMO = { 1: '🎁' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const moedas = (n) => n.toLocaleString('pt-BR') + (n === 1 ? ' moeda' : ' moedas');

  let cfg = null, escolha = {};
  const KEY = () => 'escolher-presentes:' + cfg.jogo;
  function carregar() {
    escolha = {};
    let salvo = {};
    try { salvo = JSON.parse(localStorage.getItem(KEY()) || '{}'); } catch (e) {}
    cfg.acoes.forEach((a) => { escolha[a.id] = porId.get(salvo[a.id]) || porId.get(a.padrao) || CATALOGO[0]; });
  }
  function salvar() {
    const o = {}; for (const k in escolha) o[k] = escolha[k].id;
    try { localStorage.setItem(KEY(), JSON.stringify(o)); } catch (e) {}
  }
  function avisar() { if (cfg.aoMudar) cfg.aoMudar(Object.assign({}, escolha)); }

  // ---------------- interface ----------------
  const CSS = `
  #ep-fundo{position:fixed;inset:0;background:rgba(6,6,14,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;font-family:Nunito,Inter,system-ui,sans-serif;color:#fff}
  #ep-fundo[hidden]{display:none}
  #ep-caixa{background:#17162a;border:1px solid rgba(255,255,255,.14);border-radius:20px;width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.5)}
  #ep-caixa header{padding:18px 20px 8px}
  #ep-caixa h2{margin:0;font-size:22px;font-weight:900}
  #ep-caixa header p{margin:4px 0 0;color:#b9b5d6;font-size:14.5px;font-weight:600}
  #ep-lista{overflow:auto;padding:6px 14px 10px;display:grid;gap:8px}
  .ep-linha{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:8px 10px 8px 14px}
  .ep-linha.bom{border-left:4px solid #2ee59d}.ep-linha.mau{border-left:4px solid #ff5a7d}
  .ep-acao{flex:1;font-weight:800;font-size:15px;line-height:1.2}
  .ep-acao small{display:block;font-weight:700;font-size:12px;color:#9f9bbd;margin-top:2px}
  .ep-btn{display:flex;align-items:center;gap:8px;background:#26244a;border:2px solid rgba(255,255,255,.18);border-radius:12px;padding:5px 10px 5px 6px;color:#fff;font:inherit;font-weight:800;font-size:14px;cursor:pointer;min-width:190px}
  .ep-btn:hover{border-color:#ffd23f}
  .ep-btn img{width:36px;height:36px;object-fit:contain}
  .ep-btn span{flex:1;text-align:left;line-height:1.1}.ep-btn small{display:block;color:#ffd23f;font-size:11.5px}
  .ep-btn::after{content:'Trocar';font-size:11px;color:#b9b5d6;font-weight:700}
  #ep-caixa footer{display:flex;gap:10px;justify-content:space-between;padding:12px 16px 16px;border-top:1px solid rgba(255,255,255,.08)}
  .ep-ok{background:linear-gradient(90deg,#ff3d7f,#ff6a3d);color:#fff;border:0;border-radius:999px;padding:12px 26px;font:inherit;font-weight:900;font-size:16px;cursor:pointer}
  .ep-sec{background:transparent;color:#b9b5d6;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:10px 16px;font:inherit;font-weight:700;font-size:14px;cursor:pointer}
  #ep-grade-busca{margin:4px 16px 8px;padding:11px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0f0e1d;color:#fff;font:inherit;font-size:15px}
  #ep-grade{overflow:auto;padding:4px 14px 14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}
  .ep-g{background:rgba(255,255,255,.05);border:2px solid transparent;border-radius:14px;padding:8px 4px;color:#fff;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
  .ep-g:hover{border-color:#ffd23f}.ep-g.sel{border-color:#2ee59d;background:rgba(46,229,157,.12)}
  .ep-g img{width:52px;height:52px;object-fit:contain}
  .ep-g b{font-size:12.5px;line-height:1.1}.ep-g small{font-size:11px;color:#ffd23f;font-weight:700}
  .ep-g em{font-style:normal;font-size:10.5px;color:#ff9fb6;font-weight:700}
  @media (max-width:520px){.ep-linha{flex-direction:column;align-items:stretch}.ep-btn{min-width:0}}`;
  let fundo = null, acaoAtual = null;
  function montar() {
    if (fundo) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    fundo = document.createElement('div'); fundo.id = 'ep-fundo'; fundo.hidden = true;
    fundo.innerHTML = '<div id="ep-caixa" role="dialog" aria-modal="true" aria-labelledby="ep-titulo"></div>';
    document.body.appendChild(fundo);
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fundo && !fundo.hidden) { e.stopPropagation(); acaoAtual ? telaLista() : fechar(); } }, true);
  }
  const caixa = () => fundo.querySelector('#ep-caixa');
  function img(g) { return '<img src="' + esc(g.img) + '" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'🎁\',style:\'font-size:30px\'}))">'; }

  function telaLista() {
    acaoAtual = null;
    caixa().innerHTML =
      '<header><h2 id="ep-titulo">🎁 Escolher presentes</h2><p>Toque no presente para trocar. O que você escolher aparece na tela da live.</p></header>' +
      '<div id="ep-lista">' + cfg.acoes.map((a) => {
        const g = escolha[a.id];
        return '<div class="ep-linha ' + (a.tipo === 'mau' ? 'mau' : 'bom') + '"><div class="ep-acao">' + esc(a.texto) +
          '<small>' + (a.tipo === 'mau' ? 'atrapalha' : 'ajuda') + '</small></div>' +
          '<button class="ep-btn" type="button" data-a="' + esc(a.id) + '">' + img(g) + '<span>' + esc(g.nome) + '<small>' + moedas(g.moedas) + '</small></span></button></div>';
      }).join('') + '</div>' +
      '<footer><button class="ep-sec" type="button" id="ep-padrao">Voltar ao padrão</button><button class="ep-ok" type="button" id="ep-pronto">Pronto</button></footer>';
    caixa().querySelectorAll('.ep-btn').forEach((b) => b.addEventListener('click', () => telaGrade(b.dataset.a)));
    caixa().querySelector('#ep-pronto').addEventListener('click', fechar);
    caixa().querySelector('#ep-padrao').addEventListener('click', () => {
      cfg.acoes.forEach((a) => { escolha[a.id] = porId.get(a.padrao) || CATALOGO[0]; });
      salvar(); avisar(); telaLista();
    });
  }
  function telaGrade(aid) {
    acaoAtual = aid;
    const a = cfg.acoes.find((x) => x.id === aid);
    caixa().innerHTML =
      '<header><h2 id="ep-titulo">' + esc(a.texto) + '</h2><p>Escolha o presente que faz isso.</p></header>' +
      '<input id="ep-grade-busca" type="search" placeholder="Buscar presente (ex.: rosa, leão)" aria-label="Buscar presente">' +
      '<div id="ep-grade"></div>' +
      '<footer><button class="ep-sec" type="button" id="ep-voltar">← Voltar</button></footer>';
    const grade = caixa().querySelector('#ep-grade'), busca = caixa().querySelector('#ep-grade-busca');
    const usado = {}; for (const k in escolha) if (k !== aid) usado[escolha[k].id] = cfg.acoes.find((x) => x.id === k).texto;
    const desenhar = () => {
      const q = busca.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      grade.innerHTML = CATALOGO.filter((g) => !q || (g.nome + ' ' + g.en).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
        .map((g) => '<button type="button" class="ep-g' + (escolha[aid].id === g.id ? ' sel' : '') + '" data-id="' + g.id + '">' + img(g) +
          '<b>' + esc(g.nome) + '</b><small>' + moedas(g.moedas) + '</small>' + (usado[g.id] ? '<em>já usado: troca</em>' : '') + '</button>').join('') ||
        '<p style="grid-column:1/-1;color:#b9b5d6;text-align:center">Nenhum presente com esse nome.</p>';
      grade.querySelectorAll('.ep-g').forEach((b) => b.addEventListener('click', () => {
        const g = porId.get(Number(b.dataset.id));
        // se outro botão já usa esse presente, os dois trocam de lugar
        for (const k in escolha) if (k !== aid && escolha[k].id === g.id) escolha[k] = escolha[aid];
        escolha[aid] = g; salvar(); avisar(); telaLista();
      }));
    };
    busca.addEventListener('input', desenhar); desenhar();
    caixa().querySelector('#ep-voltar').addEventListener('click', telaLista);
    setTimeout(() => busca.focus(), 50);
  }
  function abrir() { montar(); telaLista(); fundo.hidden = false; }
  function fechar() { if (fundo) fundo.hidden = true; acaoAtual = null; }

  window.EscolherPresentes = {
    catalogo: CATALOGO,
    init(c) {
      cfg = c; carregar(); avisar();
      // a janela da live (mesmo computador) recebe a mudança na hora
      window.addEventListener('storage', (e) => { if (e.key === KEY()) { carregar(); avisar(); } });
      return Object.assign({}, escolha);
    },
    abrir, fechar,
    presente: (id) => porId.get(Number(id)) || null
  };
})();
