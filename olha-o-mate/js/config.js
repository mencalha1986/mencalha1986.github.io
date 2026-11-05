/* =========================================================================
   OLHA O MATE! — CONFIGURAÇÃO (tudo que é ajustável na live fica aqui)
   O vendedor de mate anda pela areia de Copacabana até o Posto 6,
   vendendo para os banhistas que levantam a mão. Os presentes da live
   ajudam (HERÓI) ou atrapalham (VILÃO) o vendedor.
   ========================================================================= */
window.CNB = window.CNB || {};

CNB.CONFIG = {
  // ---------- Loja / site ----------
  siteUrl: 'achadosuteisporai.com.br',
  siteLink: 'https://achadosuteisporai.com.br/?utm_source=tiktok&utm_medium=live&utm_campaign=olha-o-mate',
  profile: '@romulo.mencalha',
  qrImage: 'qr-site.png',
  productsUrl: 'https://achadosuteisporai.com.br/produtos.js',

  // ---------- Praia ----------
  goal: 420,               // metros até o quiosque do Posto 6 (uns 4 min sem presentes)
  walkSpeed: 1.9,          // m/s andando sozinho
  boostSpeed: 4.2,         // andando com empurrão (Rosa)
  turboSpeed: 9,           // correndo (TikTok / Pistola de dinheiro)
  price: 8,                // R$ por copo de mate
  customerSpacing: [9, 16],  // metros entre banhistas que querem mate
  obstacleSpacing: [14, 24], // metros entre castelos de areia, buracos, bolas
  sellTime: 1.1,           // segundos parado servindo um copo

  control: 'auto',         // automático: pula sozinho; espaço / ↑ / clique pula na hora que você quiser
  autopilot: { skill: 0.94, returnAfter: 5 },

  restartCountdown: 12,
  summaryTime: 12,
  gameOverTime: 6,

  audio: { master: 0.9, music: 0.34, sfx: 0.85 },
  voice: { enabled: false, minGap: 3.2 },
  combo: { window: 3, step: 0.15, max: 2.5 },  // presentes seguidos deixam o próximo mais forte
  ui: { safeTop: 170, rankingSize: 3, giftGuide: true },

  // ---------- PRESENTES ----------
  // team: 'heroi' (ajuda o vendedor) | 'vilao' (atrapalha)
  // action: advance (empurra) | turbo (corre) | gull (gaivota rouba e ele volta) | gameover (o rapa) | follow
  // O painel "PRESENTES DA LIVE" (no controle) troca qual presente faz cada ação sem mexer aqui.
  gifts: {
    // --- HERÓI ---
    rose:    { tiktok: 'Rosa', img: 'img/presentes/rose.webp', label: 'Empurrão', team: 'heroi', action: 'advance', amount: 10, points: 1, color: '#ff4d6d', icon: 'rose', key: '1', demo: 30 },
    tiktok:  { tiktok: 'TikTok', img: 'img/presentes/tiktok.webp', label: 'Corrida', team: 'heroi', action: 'turbo', duration: 6, points: 5, color: '#25f4ee', icon: 'note', key: '2', demo: 20 },
    chuva:   { tiktok: 'Pistola de dinheiro', img: 'img/presentes/money-gun.png', label: 'Chuva de clientes', team: 'heroi', action: 'turbo', duration: 15, rush: true, points: 500, color: '#4ade80', icon: 'moneygun', key: '3', demo: 2 },
    // --- VILÃO ---
    gaivota: { tiktok: 'Rosquinha', img: 'img/presentes/doughnut.webp', label: 'Gaivota', team: 'vilao', action: 'gull', amount: 30, points: 30, color: '#a3a3a3', icon: 'bird', key: '4', demo: 7 },
    rapa:    { tiktok: 'Galáxia', img: 'img/presentes/galaxy.webp', label: 'O rapa', team: 'vilao', action: 'gameover', points: 1000, color: '#e879f9', icon: 'card', key: '5', demo: 0 },
    seguir:  { tiktok: 'Seguir (grátis)', label: 'Seguidor', team: 'vilao', action: 'follow', back: 3, points: 1, color: '#fe2c55', icon: 'follow', key: '9', demo: 4, free: true }
  },

  giftAliases: {
    'rose': 'rose', 'rosa': 'rose',
    'tiktok': 'tiktok',
    'money gun': 'chuva', 'pistola de dinheiro': 'chuva',
    'doughnut': 'gaivota', 'donut': 'gaivota', 'rosquinha': 'gaivota',
    'galaxy': 'rapa', 'galáxia': 'rapa',
    'follow': 'seguir', 'seguir': 'seguir', 'seguiu': 'seguir'
  },

  test: {
    demoInterval: [1.4, 3.2],
    fakeUsers: ['@zezinho_do_corte', '@mari.carioca', '@tio_paulo', '@bia_da_laje', '@ze_da_esquina',
                '@luana.of', '@pedrinho_gamer', '@dona_cida', '@rafa_rj', '@juninho_123', '@carol.vibes',
                '@madrugadao_br', '@nanda_zl', '@cabelo_de_milho', '@grazi_tijuca']
  }
};
