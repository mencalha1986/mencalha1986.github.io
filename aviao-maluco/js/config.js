/* =========================================================================
   AVIÃO MALUCO — CONFIGURAÇÃO (tudo que é ajustável na live fica aqui)
   ========================================================================= */
window.CNB = window.CNB || {};

CNB.CONFIG = {
  // ---------- Loja / site ----------
  siteUrl: 'achadosuteisporai.com.br',
  siteLink: 'https://achadosuteisporai.com.br/?utm_source=tiktok&utm_medium=live&utm_campaign=aviao-maluco',
  profile: '@romulo.mencalha',
  qrImage: 'qr-site.png',
  productsUrl: 'https://achadosuteisporai.com.br/produtos.js',

  // ---------- Voo ----------
  goal: 3000,              // metros até o aeroporto (aumente para missões mais longas)
  crates: 8,               // caixas de achados no avião
  cruiseSpeed: 5.5,        // m/s sem presentes
  boostSpeed: 12,          // com impulso de presentes
  turboSpeed: 24,          // turbo (atravessa tudo)
  gap: [530, 650],         // altura do vão entre os obstáculos (px) — maior = mais fácil
  spacing: [620, 780],     // distância entre obstáculos (px)

  control: 'auto',         // começa no automático; ↑ / espaço / clique assume
  autopilot: { skill: 0.96, returnAfter: 5 },

  restartCountdown: 12,
  summaryTime: 12,
  gameOverTime: 6,

  audio: { master: 0.9, music: 0.34, sfx: 0.85 },
  voice: { enabled: false, minGap: 3.2 },   // sem vozes neste jogo
  combo: { window: 3, step: 0.15, max: 2.5 }, // presentes seguidos multiplicam o empurrão
  ui: { safeTop: 170, rankingSize: 3, giftGuide: true },

  // ---------- PRESENTES (o último presente cancela a ação em andamento) ----------
  // action: advance | turbo | birds | wind | engine | loop | gameover | follow
  gifts: {
    rosa:     { tiktok: 'Rose', img: 'img/presentes/rose.webp', label: 'Rosa', action: 'advance', amount: 40, points: 1, color: '#ff4d6d', icon: 'rose', key: '1', demo: 30 },
    tiktok:   { tiktok: 'TikTok', img: 'img/presentes/tiktok.webp', label: 'TikTok', action: 'advance', amount: 150, points: 1, color: '#25f4ee', icon: 'note', key: '2', demo: 20 },
    turbo:    { tiktok: 'Finger Heart', img: 'img/presentes/finger-heart.webp', label: 'Caça reboca', action: 'turbo', duration: 6, points: 10, color: '#ffd23f', icon: 'bolt', key: '3', demo: 10 },
    urubus:   { tiktok: 'Doughnut', img: 'img/presentes/doughnut.webp', label: 'Urubu', action: 'birds', amount: 50, points: 5, color: '#a3a3a3', icon: 'bird', key: '4', demo: 10 },
    vento:    { tiktok: 'GG', img: 'img/presentes/gg.webp', label: 'Vento contra', action: 'wind', amount: 60, points: 5, color: '#a78bfa', icon: 'wind', key: '5', demo: 8 },
    pane:     { tiktok: 'Ice Cream Cone', img: 'img/presentes/ice-cream-cone.webp', label: 'Pane no motor', action: 'engine', duration: 5, amount: 40, points: 5, color: '#fb923c', icon: 'smoke', key: '6', demo: 8 },
    gasolina: { tiktok: 'Galaxy', img: 'img/presentes/galaxy.webp', label: 'Míssil', action: 'gameover', points: 50, color: '#e879f9', icon: 'fuel', key: '7', demo: 0 },
    looping:  { tiktok: 'Heart Me', label: 'Looping', action: 'loop', points: 1, color: '#38bdf8', icon: 'loop', key: '8', demo: 12 },
    // NOVO SEGUIDOR (de graça): uma caixa extra cai de paraquedas com o nome dele
    seguir:   { tiktok: 'Seguir (grátis)', label: 'Seguidor', action: 'follow', points: 1, color: '#fe2c55', icon: 'follow', key: '9', demo: 6, free: true }
  },

  giftAliases: {
    'rose': 'rosa', 'rosa': 'rosa',
    'tiktok': 'tiktok',
    'finger heart': 'turbo', 'coração com os dedos': 'turbo', 'turbo': 'turbo',
    'doughnut': 'urubus', 'donut': 'urubus', 'urubu': 'urubus', 'urubus': 'urubus',
    'gg': 'vento', 'vento': 'vento', 'vento contra': 'vento',
    'ice cream cone': 'pane', 'sorvete': 'pane', 'pane': 'pane',
    'galaxy': 'gasolina', 'galáxia': 'gasolina', 'gasolina': 'gasolina', 'missil': 'gasolina', 'míssil': 'gasolina',
    'heart me': 'looping', 'looping': 'looping',
    'follow': 'seguir', 'seguir': 'seguir', 'seguiu': 'seguir'
  },

  test: {
    demoInterval: [1.4, 3.2],
    fakeUsers: ['@zezinho_do_corte', '@mari.carioca', '@tio_paulo', '@bia_da_laje', '@ze_da_esquina',
                '@luana.of', '@pedrinho_gamer', '@dona_cida', '@rafa_rj', '@juninho_123', '@carol.vibes',
                '@madrugadao_br', '@nanda_zl', '@cabelo_de_milho', '@grazi_tijuca']
  }
};

CNB.CONFIG.announcer = CNB.CONFIG.voice;   // compatível com o controle remoto
