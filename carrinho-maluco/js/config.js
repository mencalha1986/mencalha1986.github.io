/* =========================================================================
   CARRINHO MALUCO — CONFIGURAÇÃO (tudo que é ajustável na live fica aqui)
   ========================================================================= */
window.CNB = window.CNB || {};

CNB.CONFIG = {
  // ---------- Loja ----------
  siteUrl: 'achadosuteisporai.com.br',
  // link aberto ao clicar no final (as tags utm mostram no Google Analytics quem veio da live)
  siteLink: 'https://achadosuteisporai.com.br/?utm_source=tiktok&utm_medium=live&utm_campaign=carrinho-maluco',
  profile: '@romulo.mencalha',   // perfil do TikTok mostrado no "link na bio"
  qrImage: 'qr-site.png',        // QR Code do site (troque o arquivo se mudar o link)
  // os achados vêm do seu site (produtos.js). Se não carregar, usa a cópia js/produtos-reserva.js
  productsUrl: 'https://achadosuteisporai.com.br/produtos.js',
  trackLength: 260,          // metros até o CAIXA
  itemSpacing: [8, 13],      // distância entre achados no chão
  obstacleSpacing: [7, 12],  // distância entre "furadas" (menor = mais obstáculos)
  autoWalkSpeed: 0.35,       // anda sozinho bem devagar sem presentes
  walkSpeed: 2.4,
  runSpeed: 11,
  backSpeed: 3,
  control: 'auto',           // 'auto' (vai atrás dos achados sozinho) | 'manual' (você conduz com ← →)
  autoPickSkill: 0.72,       // no automático: chance de mirar certo no achado

  // ---------- Rodada ----------
  restartCountdown: 12,
  receiptTime: 11,           // segundos mostrando a nota fiscal antes da contagem
  gameOverTime: 6,

  audio: { master: 0.9, music: 0.38, sfx: 0.85 },
  announcer: { enabled: true, every: [22, 38] },  // locutor da loja

  ui: { safeTop: 170, feedMax: 4, rankingSize: 3 },

  // ---------- PRESENTES ----------
  // action: advance | turbo | magnet | back | slip | sale | gameover
  // O ÚLTIMO PRESENTE MANDA: um presente novo cancela a ação em andamento.
  gifts: {
    rosa:      { label: 'Rosa',      action: 'advance', amount: 4,  points: 1,  color: '#ff4d6d', icon: 'rose',   key: '1', demo: 30 },
    tiktok:    { label: 'TikTok',    action: 'advance', amount: 12, points: 1,  color: '#25f4ee', icon: 'note',   key: '2', demo: 20 },
    turbo:     { label: 'Turbo',     action: 'turbo',   duration: 6, points: 10, color: '#ffd23f', icon: 'bolt',  key: '3', demo: 10 },
    ima:       { label: 'Ímã',       action: 'magnet',  duration: 8, amount: 6, points: 5, color: '#60a5fa', icon: 'magnet', key: '4', demo: 9 },
    voltar:    { label: 'Esqueci',   action: 'back',    amount: 15, points: 5,  color: '#a78bfa', icon: 'back',   key: '5', demo: 9 },
    molhado:   { label: 'Chão molhado', action: 'slip', points: 5,  color: '#facc15', icon: 'wet',    key: '6', demo: 8 },
    liquidacao:{ label: 'Liquidação', action: 'sale',   count: 6,   points: 10, color: '#fb7185', icon: 'tag',    key: '7', demo: 6 },
    recusado:  { label: 'Cartão recusado', action: 'gameover', points: 50, color: '#e879f9', icon: 'card', key: '8', demo: 0 },
    // NOVO SEGUIDOR (de graça): o carrinho volta e achados caem de volta no corredor para serem pegos de novo.
    // Não cancela a ação em andamento. Cada pessoa conta uma vez só.
    seguir:    { label: 'Seguidor', action: 'follow', back: 8, drop: 2, points: 1, color: '#ff4fa3', icon: 'follow', key: '9', demo: 6 }
  },

  // nome do presente que chega da live -> presente do jogo (minúsculas)
  giftAliases: {
    'rose': 'rosa', 'rosa': 'rosa',
    'tiktok': 'tiktok',
    'finger heart': 'turbo', 'coração com os dedos': 'turbo', 'turbo': 'turbo',
    'doughnut': 'ima', 'donut': 'ima', 'ímã': 'ima', 'ima': 'ima',
    'gg': 'voltar', 'esqueci': 'voltar', 'voltar': 'voltar',
    'ice cream cone': 'molhado', 'sorvete': 'molhado', 'chão molhado': 'molhado', 'molhado': 'molhado',
    'perfume': 'liquidacao', 'liquidação': 'liquidacao', 'liquidacao': 'liquidacao',
    'follow': 'seguir', 'seguir': 'seguir', 'seguiu': 'seguir',
    'galaxy': 'recusado', 'galáxia': 'recusado', 'cartão recusado': 'recusado', 'recusado': 'recusado'
  },

  specialEvents: {
    recusado: { title: 'CARTÃO RECUSADO', subtitle: 'Volta tudo pra prateleira...' }
  },

  test: {
    demoInterval: [1.2, 3.0],
    fakeUsers: ['@zezinho_do_corte', '@mari.carioca', '@tio_paulo', '@bia_da_laje', '@ze_da_esquina',
                '@luana.of', '@pedrinho_gamer', '@dona_cida', '@rafa_rj', '@juninho_123', '@carol.vibes',
                '@madrugadao_br', '@nanda_zl', '@cabelo_de_milho', '@grazi_tijuca']
  }
};
