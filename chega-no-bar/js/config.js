/* =========================================================================
   CHEGA NO BAR — CONFIGURAÇÃO
   Tudo que é ajustável na live fica aqui. Não é preciso mexer no resto.
   ========================================================================= */
window.CNB = window.CNB || {};

CNB.CONFIG = {
  // ---------- Percurso ----------
  trackLength: 300,          // metros até a faixa de pedestre em frente ao bar
  autoWalkSpeed: 0.22,       // m/s que ele anda sozinho sem presentes (0 = parado)
  walkSpeed: 2.1,            // m/s andando com impulso de presentes
  runSpeed: 10.5,            // m/s no turbo
  backSpeed: 2.6,            // m/s quando volta
  obstacleSpacing: [9, 16],  // distância mínima/máxima entre obstáculos
  obstacleHitChance: 0.38,   // chance base de não desviar (aumenta com a bebedeira)

  // ---------- Personagem ----------
  character: 'homem',
  control: 'auto',           // 'auto' (desvia sozinho) | 'manual' (você desvia com as setas ← →)
  autoReturnAfter: 5,        // no manual, volta ao automático depois de X s sem mexer (0 = nunca)

  // ---------- Bebedeira ----------
  drunkStart: 0.55,          // 0..1
  drunkMin: 0.4,
  drunkDecayPerSec: 0.004,

  // ---------- Rodada ----------
  restartCountdown: 12,      // segundos de contagem para a nova rodada
  winCelebrationTime: 13,     // segundos de festa (comemoração + ir até a mesa + brinde) antes do placar
  gameOverTime: 6,

  // ---------- Áudio ----------
  audio: { master: 0.9, music: 0.42, sfx: 0.85 },

  // ---------- Voz (Web Speech API) ----------
  // Para trocar por áudios gravados no futuro, veja js/voice.js -> RECORDED_CLIPS
  voice: {
    enabled: true,
    lang: 'pt-BR',
    rate: 0.78,      // mais lento = mais arrastado
    pitch: 0.55,     // mais grave
    volume: 1,
    // nomes (ou trechos) de vozes masculinas preferidas, na ordem
    preferred: ['Antonio', 'Daniel', 'Felipe', 'Ricardo', 'Fabio', 'Thiago', 'Male', 'Masculin', 'Google português'],
    minGap: 4.0,     // segundos mínimos entre falas espontâneas
    idleEvery: [8, 14]
  },

  // ---------- Interface (áreas seguras do TikTok LIVE) ----------
  ui: {
    safeTop: 170,       // abaixo do cabeçalho do TikTok (perfil/espectadores)
    feedMax: 4,
    rankingSize: 3,
    giftGuide: true     // lista "presente → ação" fixa na lateral
  },

  // ---------- PRESENTES ----------
  // key interna -> definição. "action" pode ser:
  //   advance  (amount = metros)
  //   turbo    (duration = segundos)
  //   beer     (amount = metros, drunk = quanto aumenta a bebedeira)
  //   back     (amount = metros)
  //   trip     (cai e precisa levantar)
  //   gameover (event = id em specialEvents)
  // "points" = peso no ranking (use o valor em moedas do presente, se quiser).
  // tiktok: nome do presente em português (TikTok pt-BR) mostrado na lista fixa; img: imagem oficial (img/presentes).
  // Sem "tiktok", o presente não aparece na lista (só funciona pelas teclas de teste).
  gifts: {
    rosa:     { tiktok: 'Rosa', img: 'img/presentes/rose.webp', label: 'Rosa', action: 'advance', amount: 3, points: 1, color: '#ff4d6d', icon: 'rose', key: '1' },
    tiktok:   { tiktok: 'TikTok', img: 'img/presentes/tiktok.webp', label: 'Turbo', action: 'turbo', duration: 6, points: 10, color: '#25f4ee', icon: 'note', key: '2' },
    pistola:  { tiktok: 'Pistola de dinheiro', img: 'img/presentes/money-gun.png', label: 'Super turbo', action: 'turbo', duration: 15, points: 500, color: '#4ade80', icon: 'moneygun', key: '3' },
    cerveja:  { tiktok: 'Cogumelo', img: 'img/presentes/mushroom.webp', label: 'Cerveja', action: 'beer', amount: 14, drunk: 0.14, points: 5, color: '#f5a623', icon: 'beer', key: '5' },   // mais uma dose: anda e fica mais bêbado
    voltar:   { tiktok: 'Rosquinha', img: 'img/presentes/doughnut.webp', label: 'Voltar', action: 'back', amount: 14, points: 5, color: '#a78bfa', icon: 'back', key: '4' },
    cachorro: { tiktok: 'Corgi', img: 'img/presentes/corgi.webp', label: 'Cachorro', action: 'dog', points: 5, color: '#e0a35a', icon: 'dog', key: '8' },   // xixi na perna (para ~5s)
    especial: { tiktok: 'Galáxia', img: 'img/presentes/galaxy.webp', label: 'Especial',action: 'gameover', event: 'dormiu', points: 50, color: '#e879f9', icon: 'moon', key: '7' },
    // NOVO SEGUIDOR (de graça): volta um pouquinho
    seguir:   { tiktok: 'Seguir (grátis)', label: 'Seguidor', action: 'back', amount: 3, points: 1, color: '#fe2c55', icon: 'follow', key: '9' }
  },

  // Nome do presente vindo da integração -> key interna (sem diferenciar maiúsculas)
  // Ajuste para os presentes que você usa na sua live.
  giftAliases: {
    'rose': 'rosa', 'rosa': 'rosa',
    'tiktok': 'tiktok', 'turbo': 'tiktok',
    'money gun': 'pistola', 'pistola de dinheiro': 'pistola', 'pistola': 'pistola',
    'cerveja': 'cerveja', 'beer': 'cerveja', 'cheers': 'cerveja', 'mushroom': 'cerveja', 'cogumelo': 'cerveja',
    'doughnut': 'voltar', 'donut': 'voltar', 'rosquinha': 'voltar', 'voltar': 'voltar',
    'cachorro': 'cachorro', 'dog': 'cachorro', 'doggo': 'cachorro', 'puppy': 'cachorro', 'corgi': 'cachorro',
    'especial': 'especial', 'galaxy': 'especial', 'galáxia': 'especial',
    'follow': 'seguir', 'seguir': 'seguir', 'seguiu': 'seguir'
  },

  // Eventos de GAME OVER configuráveis (presente "especial")
  specialEvents: {
    dormiu: {
      title: 'GAME OVER',
      subtitle: 'Dormiu na calçada...',
      phrase: 'Vou só... descansar... cinco minutinho...'
    },
    esposa: {
      title: 'GAME OVER',
      subtitle: 'Ligaram de casa. Acabou a noite.',
      phrase: 'Tô indo, amor... tô indo...'
    }
  },

  // Modo de teste / demo
  test: {
    demoInterval: [1.2, 3.2],
    fakeUsers: ['@zezinho_do_corte', '@mari.carioca', '@tio_paulo', '@bia_da_laje', '@ze_da_esquina',
                '@luana.of', '@pedrinho_gamer', '@dona_cida', '@rafa_rj', '@juninho_123', '@carol.vibes',
                '@madrugadao_br', '@nanda_zl', '@cabelo_de_milho', '@grazi_tijuca']
  }
};
