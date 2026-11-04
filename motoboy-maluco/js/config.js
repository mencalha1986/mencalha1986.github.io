/* =========================================================================
   MOTOBOY MALUCO — CONFIGURAÇÃO (tudo que é ajustável na live fica aqui)
   ========================================================================= */
window.CNB = window.CNB || {};

CNB.CONFIG = {
  // ---------- Loja / site ----------
  siteUrl: 'achadosuteisporai.com.br',
  siteLink: 'https://achadosuteisporai.com.br/?utm_source=tiktok&utm_medium=live&utm_campaign=motoboy-maluco',
  profile: '@romulo.mencalha',
  qrImage: 'qr-site.png',
  productsUrl: 'https://achadosuteisporai.com.br/produtos.js',

  // ---------- Rota ----------
  deliveries: 4,             // entregas por rodada
  avenueLength: [90, 130],   // metros de avenida antes de virar
  streetLength: [55, 80],    // metros de rua até a casa
  obstacleSpacing: [11, 18], // distância entre obstáculos (menor = mais obstáculos)

  // ---------- Moto ----------
  cruiseSpeed: 3.2,          // anda sozinho, devagar, sem presentes (m/s)
  rideSpeed: 7.5,            // com impulso de presentes
  runSpeed: 16,              // turbo
  chaseSpeed: 12,            // fugindo do cachorro
  backSpeed: 5,

  control: 'auto',           // sempre começa no automático; ← → assume
  autopilot: { dodge: 0.8, dodgeFast: 0.55, distract: 0.04, returnAfter: 5 },

  // ---------- Rodada ----------
  restartCountdown: 12,
  summaryTime: 11,
  gameOverTime: 6,

  audio: { master: 0.9, music: 0.34, sfx: 0.85 },
  voice: { enabled: true, minGap: 3.2 },

  ui: { safeTop: 170, rankingSize: 3, giftGuide: true },

  // ---------- PRESENTES (o último presente cancela a ação em andamento) ----------
  // action: advance | turbo | dog | back | flat | gameover | follow
  gifts: {
    rosa:     { tiktok: 'Rose', img: 'img/presentes/rose.webp', label: 'Rosa',        action: 'advance', amount: 8,  points: 1,  color: '#ff4d6d', icon: 'rose',  key: '1', demo: 30 },
    tiktok:   { tiktok: 'TikTok', img: 'img/presentes/tiktok.webp', label: 'TikTok',      action: 'advance', amount: 22, points: 1,  color: '#25f4ee', icon: 'note',  key: '2', demo: 20 },
    turbo:    { tiktok: 'Finger Heart', img: 'img/presentes/finger-heart.webp', label: 'Turbo',       action: 'turbo',   duration: 6, points: 10, color: '#ffd23f', icon: 'bolt', key: '3', demo: 10 },
    cachorro: { tiktok: 'Doughnut', img: 'img/presentes/doughnut.webp', label: 'Cachorro',    action: 'dog',     duration: 9, points: 5, color: '#e0a35a', icon: 'dog',  key: '4', demo: 12 },
    errado:   { tiktok: 'GG', img: 'img/presentes/gg.webp', label: 'Endereço errado', action: 'back', amount: 25, points: 5, color: '#a78bfa', icon: 'back', key: '5', demo: 8 },
    pneu:     { tiktok: 'Ice Cream Cone', img: 'img/presentes/ice-cream-cone.webp', label: 'Pneu furado', action: 'flat',    points: 5,  color: '#facc15', icon: 'tire',  key: '6', demo: 8 },
    gasolina: { tiktok: 'Galaxy', img: 'img/presentes/galaxy.webp', label: 'Sem gasolina', action: 'gameover', points: 50, color: '#e879f9', icon: 'fuel', key: '7', demo: 0 },
    // NOVO SEGUIDOR (de graça): o seguidor vira cliente da próxima entrega e a moto volta 10 m
    seguir:   { tiktok: 'Seguir (grátis)', label: 'Seguidor',    action: 'follow',  back: 10, points: 1, color: '#fe2c55', icon: 'follow', key: '8', demo: 6, free: true }
  },

  giftAliases: {
    'rose': 'rosa', 'rosa': 'rosa',
    'tiktok': 'tiktok',
    'finger heart': 'turbo', 'coração com os dedos': 'turbo', 'turbo': 'turbo',
    'doughnut': 'cachorro', 'donut': 'cachorro', 'doggo': 'cachorro', 'dog': 'cachorro', 'puppy': 'cachorro', 'cachorro': 'cachorro',
    'gg': 'errado', 'endereço errado': 'errado', 'errado': 'errado',
    'ice cream cone': 'pneu', 'sorvete': 'pneu', 'pneu': 'pneu', 'pneu furado': 'pneu',
    'galaxy': 'gasolina', 'galáxia': 'gasolina', 'gasolina': 'gasolina',
    'follow': 'seguir', 'seguir': 'seguir', 'seguiu': 'seguir'
  },

  customers: ['Dona Cida', 'Seu Jorge', 'Tia Lúcia', 'Seu Zé', 'Dona Marta', 'Juninho', 'Bia', 'Seu Carlos', 'Dona Rosa', 'Rafa'],

  test: {
    demoInterval: [1.4, 3.2],
    fakeUsers: ['@zezinho_do_corte', '@mari.carioca', '@tio_paulo', '@bia_da_laje', '@ze_da_esquina',
                '@luana.of', '@pedrinho_gamer', '@dona_cida', '@rafa_rj', '@juninho_123', '@carol.vibes',
                '@madrugadao_br', '@nanda_zl', '@cabelo_de_milho', '@grazi_tijuca']
  }
};

CNB.CONFIG.announcer = CNB.CONFIG.voice;   // compatível com o controle remoto
