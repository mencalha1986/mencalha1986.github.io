/* =========================================================================
   VOZ E PERSONALIDADE
   - Web Speech API (pt-BR, grave, lento)
   - Falas por contexto, sem repetir as recentes
   - Pronto para áudios gravados: preencha RECORDED_CLIPS com arquivos .mp3
     (ex.: 'sounds/voz/idle_01.mp3'). Se existir clip para a frase, ele toca
     no lugar da voz sintética.
   ========================================================================= */
(function () {
  const U = CNB.U;

  const PHRASES = {
    idle: [
      'Ô meu parceiro... só mais um pouquinho...',
      'Cadê esse bar, meu Deus?',
      'Calma... eu tô andando reto!',
      'Eu tô bem... eu tô muito bem...',
      'Quem foi que entortou essa rua?',
      'A rua tá balançando... ou sou eu?',
      'Só vou tomar a saideira... juro...',
      'Essa calçada era menor ontem...',
      'Alguém viu minha chave? ...deixa pra lá.',
      'Ô Zé! Guarda uma gelada pra mim!'
    ],
    go: ['Agora vai, agora vai!', 'Isso aí, meu povo!', 'Valeu, parceiro! Te pago uma!', 'Bora, bora, bora!', 'Tô indo... tô indo...'],
    turbo: ['SAI DA FRENTE QUE EU TÔ CHEGANDO!', 'Segura que eu vou voando!', 'Abre a porta, Zé! Tô chegando!', 'Ninguém me seguraaa!'],
    beer: ['Ahh... essa desceu redondinha...', 'Mais uma... só mais uma...', 'Opa... ficou tudo duplicado agora...', 'Essa tava estupidamente gelada!'],
    back: ['Ué... o bar tá fugindo de mim!', 'Pra trás não, pô!', 'Quem mexeu no chão?!', 'Eu tava indo... pra lá, né?'],
    stumble: ['Eita porra! Quase fui de cara!', 'Opa opa opa!', 'Quem botou isso aí?!', 'Ninguém viu isso... ninguém viu.', 'Tá tudo sob controle!'],
    fall: ['Aaai... tô bem... tô bem...', 'Quem me empurrou?!', 'O chão veio me buscar...', 'Foi o tênis... foi o tênis.'],
    getup: ['Levantei... levantei... ninguém viu.', 'Tô de pé, tô de pé!', 'Faz parte do trajeto...'],
    near: ['Tô sentindo o cheiro do torresmo!', 'Tá chegando, tá chegando!', 'Tô vendo a luz... é o bar!', 'Ô Zé! Abre a gelada!'],
    win: ['EU CONSEGUI, RAPAZ!', 'Desce uma gelada aí, Zé!', 'Falei que eu chegava!'],
    table: ['Chega pra lá, compadre...', 'Essa cadeira tá vaga? Agora não tá mais!'],
    sit: ['Saúde, rapaziada!', 'Ahhh... agora sim... valeu, gente!'],
    gameover: ['Vou só... descansar... cinco minutinho...'],
    dog: ['Ô CACHORRO! NA MINHA PERNA NÃO!', 'Sai daqui, bicho! Eu não sou poste!', 'Ei! Isso aqui não é poste não!'],
    dogafter: ['Agora eu tô cheirando igual o banheiro do bar...', 'Pronto... tô molhado e bêbado.', 'Até o cachorro tá contra mim...']
  };

  // Falas gravadas: js/voice-clips.js (gerado) mapeia frase -> { src, dur }.
  // Para trocar por uma gravação humana, substitua o .mp3 mantendo o nome.
  // chave = 'm|frase' ou 'f|frase'
  const RECORDED_CLIPS = {};
  for (const t in CNB.VOICE_CLIPS || {}) RECORDED_CLIPS['m|' + t] = CNB.VOICE_CLIPS[t];
  for (const t in CNB.VOICE_CLIPS_F || {}) RECORDED_CLIPS['f|' + t] = CNB.VOICE_CLIPS_F[t];
  // frases que mudam quando a personagem é mulher
  const FEM_TEXT = {
    'Pronto... tô molhado e bêbado.': 'Pronto... tô molhada e bêbada.',
    'Foi o tênis... foi o tênis.': 'Foi o salto... foi o salto.'
  };
  const femText = (t) => FEM_TEXT[t] || t;
  // chave usada no estúdio de gravação (homem mantém a frase pura)
  const storeKey = (g, t) => (g === 'f' ? 'F|' + femText(t) : t);

  class Voice {
    constructor(cfg, onSay) {
      this.cfg = cfg;
      this.onSay = onSay;
      this.recent = [];
      this.voice = null;
      this.lastSay = -99;
      this.speaking = false;
      this.supported = 'speechSynthesis' in window;
      this.muted = false;
      this.current = null;
      this.cache = {};
      for (const t in RECORDED_CLIPS) { const a = new Audio(RECORDED_CLIPS[t].src); a.preload = 'auto'; this.cache[t] = a; }
      this.gender = 'm';
      this.clipCount = Object.keys(RECORDED_CLIPS).length;
      this.voiceName = this.clipCount ? 'neural gravada' : '(padrão do sistema)';
      this.humanCount = 0;
      // gravações feitas no estúdio (gravar-vozes.html) têm prioridade
      if (CNB.VoiceStore) CNB.VoiceStore.all().then((recs) => {
        for (const sk in recs) {
          const r = recs[sk];
          if (!r || !r.blob) continue;
          const key = sk.startsWith('F|') ? 'f|' + sk.slice(2) : 'm|' + sk;
          const src = URL.createObjectURL(r.blob);
          RECORDED_CLIPS[key] = { src, dur: r.dur || 2 };
          const a = new Audio(src); a.preload = 'auto'; this.cache[key] = a;
          this.humanCount++;
        }
        if (this.humanCount) this.voiceName = `${this.humanCount} falas gravadas por você + neural nas demais`;
      }).catch(() => {});
      if (this.supported) {
        const pick = () => this._pickVoice();
        pick();
        speechSynthesis.onvoiceschanged = pick;
      }
    }

    _pickVoice() {
      const all = speechSynthesis.getVoices();
      const pt = all.filter((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith('pt'));
      const br = pt.filter((v) => /br/i.test(v.lang));
      const pool = br.length ? br : pt;
      let chosen = null;
      for (const name of this.cfg.preferred) {
        chosen = pool.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
        if (chosen) break;
      }
      this.voice = chosen || pool[0] || null;
      if (!this.clipCount) this.voiceName = this.voice ? this.voice.name : '(padrão do sistema)';
    }

    pick(cat) {
      const list = PHRASES[cat] || PHRASES.idle;
      const fresh = list.filter((p) => !this.recent.includes(p));
      const p = U.choice(fresh.length ? fresh : list);
      this.recent.push(p);
      if (this.recent.length > 8) this.recent.shift();
      return p;
    }

    /** cat: categoria; opts.force interrompe a fala atual; opts.text frase específica */
    say(cat, now, opts = {}) {
      if (!opts.force && now - this.lastSay < this.cfg.minGap) return null;
      if (!opts.force && this.speaking && now - this.lastSay < 2.5) return null;
      const base = opts.text || this.pick(cat);
      const text = this.gender === 'f' ? femText(base) : base;
      const key = this.gender + '|' + text;
      this.lastSay = now;
      const clip = RECORDED_CLIPS[key];
      const dur = clip ? clip.dur + 0.7 : 1.4 + text.length * 0.07;
      this.onSay && this.onSay(text, dur, cat);
      if (!this.cfg.enabled || this.muted) return text;

      if (clip) {
        if (this.current) { this.current.pause(); }
        if (this.supported) speechSynthesis.cancel();
        const a = this.cache[key] || new Audio(clip.src);
        a.currentTime = 0;
        a.volume = this.cfg.volume;
        a.playbackRate = 1;
        a.play().catch(() => {});
        this.current = a;
        this.speaking = true;
        a.onended = () => (this.speaking = false);
        return text;
      }
      if (!this.supported) return text;
      try {
        if (opts.force) speechSynthesis.cancel();
        // pausas viram vírgulas para o sintetizador "arrastar"
        const spoken = text.replace(/\.\.\./g, ', ,').replace(/!/g, '!').replace(/\?/g, '?');
        const u = new SpeechSynthesisUtterance(spoken);
        u.lang = this.cfg.lang;
        if (this.voice) u.voice = this.voice;
        const shout = text === text.toUpperCase();
        u.rate = shout ? this.cfg.rate + 0.18 : this.cfg.rate + U.rand(-0.06, 0.04);
        u.pitch = (shout ? this.cfg.pitch + 0.25 : this.cfg.pitch + U.rand(-0.08, 0.08)) + (this.gender === 'f' ? 0.7 : 0);
        u.volume = this.cfg.volume;
        u.onstart = () => (this.speaking = true);
        u.onend = u.onerror = () => (this.speaking = false);
        speechSynthesis.speak(u);
      } catch (e) { /* sem voz: segue só o balão */ }
      return text;
    }

    stop() { if (this.supported) speechSynthesis.cancel(); if (this.current) this.current.pause(); this.speaking = false; }
    setMuted(m) { this.muted = m; if (m) this.stop(); }
  }

  Voice.femText = femText;
  Voice.storeKey = storeKey;
  CNB.Voice = Voice;
  CNB.PHRASES = PHRASES;
})();
