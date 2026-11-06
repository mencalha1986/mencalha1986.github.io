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
  trafficSpacing: [22, 38],  // distância entre carros/ônibus no trânsito (menor = mais trânsito)
  busChance: 0.28,           // chance de cada veículo ser ônibus (na avenida)

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
    rosa:     { tiktok: 'Rosa', img: 'img/presentes/rose.webp', label: 'Rosa', action: 'advance', amount: 8, points: 1, color: '#ff4d6d', icon: 'rose', key: '1', demo: 30 },
    tiktok:   { tiktok: 'TikTok', img: 'img/presentes/tiktok.webp', label: 'Turbo', action: 'turbo', duration: 6, points: 10, color: '#25f4ee', icon: 'note', key: '2', demo: 20 },
    pistola:  { tiktok: 'Pistola de dinheiro', img: 'img/presentes/money-gun.png', label: 'Super turbo', action: 'turbo', duration: 15, points: 500, color: '#4ade80', icon: 'moneygun', key: '3', demo: 2 },
    cachorro: { tiktok: 'Rosquinha', img: 'img/presentes/doughnut.webp', label: 'Cachorro',    action: 'dog',     duration: 9, points: 5, color: '#e0a35a', icon: 'dog',  key: '4', demo: 12 },
    pneu:     { tiktok: 'Casquinha de sorvete', img: 'img/presentes/ice-cream-cone.webp', label: 'Pneu furado', action: 'flat', points: 5, color: '#facc15', icon: 'tire', key: '6', demo: 8 },
    blitz:    { tiktok: 'GG', img: 'img/presentes/gg.webp', label: 'Blitz', action: 'blitz', points: 5, color: '#3b82f6', icon: 'police', key: '5', demo: 8 },   // PM para o motoboy
    gasolina: { tiktok: 'Galáxia', img: 'img/presentes/galaxy.webp', label: 'Sem gasolina', action: 'gameover', points: 50, color: '#e879f9', icon: 'fuel', key: '7', demo: 0 },
    seguir:   { tiktok: 'Seguir (grátis)', label: 'Seguidor', action: 'follow', back: 3, points: 1, color: '#fe2c55', icon: 'follow', key: '9', demo: 6, free: true }
  },

  giftAliases: {
    'rose': 'rosa', 'rosa': 'rosa',
    'tiktok': 'tiktok', 'turbo': 'tiktok',
    'money gun': 'pistola', 'pistola de dinheiro': 'pistola', 'pistola': 'pistola',
    'doughnut': 'cachorro', 'donut': 'cachorro', 'rosquinha': 'cachorro', 'cachorro': 'cachorro',
    'ice cream cone': 'pneu', 'casquinha de sorvete': 'pneu', 'casquinha': 'pneu', 'sorvete': 'pneu', 'pneu': 'pneu', 'pneu furado': 'pneu',
    'gg': 'blitz', 'bom jogo': 'blitz', 'blitz': 'blitz', 'policia': 'blitz', 'polícia': 'blitz',
    'galaxy': 'gasolina', 'galáxia': 'gasolina', 'gasolina': 'gasolina', 'sem gasolina': 'gasolina',
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
