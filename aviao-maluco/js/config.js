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
  // Valores aproximados em moedas (podem variar por país/época — confira na bandeja de presentes da live)
  gifts: {
    // --- AJUDA (empurram o avião) ---
    rose:     { tiktok: 'Rosa', coins: 1, img: 'img/presentes/rose.webp', label: 'Rosa', action: 'advance', amount: 40, points: 1, color: '#ff4d6d', icon: 'rose', key: '1', demo: 30 },
    tiktok:   { tiktok: 'TikTok', coins: 1, img: 'img/presentes/tiktok.webp', label: 'Caça reboca', action: 'turbo', duration: 6, points: 5, color: '#25f4ee', icon: 'note', key: '2', demo: 20 },
    esquadrilha: { tiktok: 'Pistola de dinheiro', coins: 500, img: 'img/presentes/money-gun.png', label: 'Esquadrilha', action: 'turbo', duration: 15, points: 500, color: '#4ade80', icon: 'moneygun', key: 't', demo: 1 },
    // --- SABOTAGEM (atrapalham) ---
    urubus:   { tiktok: 'Rosquinha', coins: 30, img: 'img/presentes/doughnut.webp', label: 'Urubu', action: 'birds', amount: 80, points: 30, color: '#a3a3a3', icon: 'bird', key: '4', demo: 6 },
    gasolina: { tiktok: 'Galáxia', coins: 1000, img: 'img/presentes/galaxy.webp', label: 'Míssil', action: 'gameover', points: 1000, color: '#e879f9', icon: 'fuel', key: '7', demo: 0 },
    // --- DIVERSÃO / GRÁTIS ---
    seguir:   { tiktok: 'Seguir (grátis)', label: 'Seguidor', action: 'follow', back: 3, points: 1, color: '#fe2c55', icon: 'follow', key: '9', demo: 4, free: true }
  },

  giftAliases: {
    'rose': 'rose', 'rosa': 'rose',
    'tiktok': 'tiktok',
    'money gun': 'esquadrilha', 'pistola de dinheiro': 'esquadrilha', 'esquadrilha': 'esquadrilha',
    'doughnut': 'urubus', 'donut': 'urubus', 'rosquinha': 'urubus', 'urubu': 'urubus', 'urubus': 'urubus',
    'galaxy': 'gasolina', 'galáxia': 'gasolina', 'gasolina': 'gasolina', 'missil': 'gasolina', 'míssil': 'gasolina',
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
