/* =========================================================================
   MOTOR DE ÁUDIO — 100% sintetizado com Web Audio API (nenhum arquivo externo)
   Música: samba de boteco procedural. Efeitos: passos, tombos, plástico,
   metal, vidro, turbo, soluço, arroto, sino de presente, torcida, fanfarra.
   ========================================================================= */
(function () {
  const U = CNB.U;
  const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

  class AudioEngine {
    constructor(cfg) {
      this.cfg = cfg;
      this.ctx = null;
      this.tempoMul = 1;
      this.intensity = 0;  // 0 normal, 1 turbo, 2 festa
      this.muted = false;
      this.step = 0;
      this.nextTime = 0;
    }

    start() {
      if (this.ctx) { this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = this.cfg.master;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(ctx.destination);

      this.music = ctx.createGain(); this.music.gain.value = this.cfg.music; this.music.connect(this.master);
      this.sfx = ctx.createGain(); this.sfx.gain.value = this.cfg.sfx; this.sfx.connect(this.master);

      // reverb do "boteco"
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(1.8, 2.5);
      this.revGain = ctx.createGain(); this.revGain.gain.value = 0.22;
      this.reverb.connect(this.revGain); this.revGain.connect(this.master);

      // buffer de ruído
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.nextTime = ctx.currentTime + 0.1;
      this._timer = setInterval(() => this._schedule(), 25);
    }

    setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.cfg.master, this.ctx.currentTime, 0.05); }
    setMusicLevel(v, time = 0.6) { if (this.music) this.music.gain.setTargetAtTime(v, this.ctx.currentTime, time / 3); }

    _impulse(sec, decay) {
      const ctx = this.ctx, len = ctx.sampleRate * sec, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    // ---------- primitivas ----------
    _osc(type, freq, t, dur, vol, dest, opts = {}) {
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + (opts.glide || dur));
      if (opts.detune) o.detune.value = opts.detune;
      const a = opts.attack || 0.005;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = o;
      if (opts.filter) {
        const f = ctx.createBiquadFilter(); f.type = opts.filter; f.frequency.value = opts.ff || 1500; f.Q.value = opts.q || 0.8;
        o.connect(f); node = f;
      }
      node.connect(g); g.connect(dest || this.sfx);
      if (opts.rev) g.connect(this.reverb);
      o.start(t); o.stop(t + dur + 0.05);
      return o;
    }
    _noise(t, dur, vol, type, freq, dest, opts = {}) {
      const ctx = this.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = this.noiseBuf; s.playbackRate.value = opts.rate || 1;
      f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = opts.q || 0.7;
      if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(dest || this.sfx);
      if (opts.rev) g.connect(this.reverb);
      s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }
    get now() { return this.ctx ? this.ctx.currentTime : 0; }
    get ok() { return !!this.ctx && !this.muted; }

    // ---------- MÚSICA: samba de boteco ----------
    _schedule() {
      const ctx = this.ctx;
      const bpm = 116 * this.tempoMul;
      const st = 60 / bpm / 4;
      while (this.nextTime < ctx.currentTime + 0.12) {
        this._playStep(this.step, this.nextTime, st);
        // leve swing
        this.nextTime += st * (this.step % 2 === 0 ? 1.08 : 0.92);
        this.step = (this.step + 1) % 64;
      }
    }

    _playStep(s, t, st) {
      const m = this.music, i = s % 16, bar = Math.floor(s / 16);
      const prog = [
        { root: 48, ch: [60, 64, 67, 71] }, // Cmaj7
        { root: 45, ch: [60, 64, 67, 69] }, // Am7
        { root: 50, ch: [62, 65, 69, 72] }, // Dm7
        { root: 43, ch: [59, 62, 65, 67] }  // G7
      ][bar];
      // melodia de vibrafone ("música de loja")
      const mel = [[76, 79, 0, 81, 0, 79, 76, 0, 74, 0, 76, 0, 0, 72, 0, 0], [72, 0, 76, 0, 79, 0, 81, 79, 0, 76, 0, 0, 74, 0, 72, 0],
                   [74, 0, 77, 0, 81, 0, 0, 79, 77, 0, 76, 0, 74, 0, 0, 0], [71, 0, 74, 0, 77, 0, 79, 0, 0, 77, 76, 0, 74, 0, 71, 0]][bar][i];
      if (mel) this._osc('sine', midi(mel), t, 0.5, 0.05, m, { rev: true }), this._osc('sine', midi(mel) * 4, t, 0.12, 0.012, m);
      const hot = this.intensity;

      // surdo: marcação no 2º tempo
      if (i === 0) this._osc('sine', 70, t, 0.25, 0.22, m, { to: 48, glide: 0.2 });
      if (i === 8) this._osc('sine', 62, t, 0.45, 0.5, m, { to: 40, glide: 0.35 });
      // ganzá
      const gz = [0.5, 0.15, 0.25, 0.15][i % 4] * (hot ? 1.3 : 1);
      this._noise(t, 0.06, 0.05 * gz * 2, 'highpass', 7000, m);
      // tamborim (teleco-teco)
      const tam = [1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1];
      if (tam[i]) this._osc('square', 1300, t, 0.04, hot ? 0.05 : 0.03, m, { filter: 'bandpass', ff: 2200, q: 3 });
      // baixo (sete cordas)
      const bassPat = { 0: 0, 6: 7, 8: 0, 11: 5, 14: 7 };
      if (bassPat[i] !== undefined) {
        const n = prog.root + bassPat[i] - 12 + 12;
        this._osc('triangle', midi(n), t, st * 2.2, 0.23, m, { filter: 'lowpass', ff: 600 });
      }
      // cavaquinho: palhetada sincopada
      const cav = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0];
      if (cav[i]) {
        prog.ch.forEach((n, k) => {
          this._osc('sawtooth', midi(n + 12), t + k * 0.008, 0.13, 0.025, m, { filter: 'lowpass', ff: 2600, q: 1.5 });
        });
      }
      // agogô / cuíca na festa
      if (hot >= 2) {
        if (i === 4 || i === 12) this._osc('triangle', i === 4 ? 1046 : 784, t, 0.18, 0.06, m, { rev: true });
        if (i === 2 || i === 10) this._osc('sine', 500, t, 0.2, 0.05, m, { to: 900, glide: 0.15 });
      }
      if (hot >= 1 && i % 4 === 2) this._noise(t, 0.05, 0.05, 'bandpass', 3500, m, { q: 2 });
    }

    // ---------- EFEITOS ----------
    step_(heavy = 0) {
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, 0.07, 0.10 + heavy * 0.08, 'lowpass', 600 + Math.random() * 300);
      this._osc('sine', 110 + Math.random() * 30, t, 0.06, 0.06 + heavy * 0.05);
    }
    thud() {
      if (!this.ok) return;
      const t = this.now;
      this._osc('sine', 140, t, 0.45, 0.75, null, { to: 38, glide: 0.35 });
      this._noise(t, 0.35, 0.45, 'lowpass', 900, null, { to: 150, rev: true });
    }
    plastic() {
      if (!this.ok) return;
      const t = this.now;
      this._osc('square', 420, t, 0.09, 0.12, null, { filter: 'bandpass', ff: 900, q: 4 });
      this._osc('square', 300, t + 0.07, 0.12, 0.09, null, { filter: 'bandpass', ff: 700, q: 4 });
      this._noise(t, 0.15, 0.15, 'bandpass', 1500, null, { q: 2 });
    }
    metal() {
      if (!this.ok) return;
      const t = this.now;
      [220, 347, 528, 811, 1200].forEach((f, k) => this._osc('triangle', f, t, 0.9 - k * 0.1, 0.12 / (k + 1) + 0.03, null, { rev: true }));
      this._noise(t, 0.3, 0.3, 'bandpass', 2500, null, { q: 1 });
    }
    glass() {
      if (!this.ok) return;
      const t = this.now;
      [2093, 3136, 4186].forEach((f, k) => this._osc('sine', f * (1 + Math.random() * 0.02), t + k * 0.03, 0.5, 0.08, null, { rev: true }));
      this._noise(t, 0.12, 0.12, 'highpass', 5000);
    }
    cardboard() {
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, 0.2, 0.35, 'lowpass', 1200, null, { to: 300 });
      this._osc('sine', 90, t, 0.18, 0.3, null, { to: 50 });
    }
    whoosh(up = true) {
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, 0.55, 0.35, 'bandpass', up ? 400 : 3000, null, { to: up ? 4000 : 300, q: 1.5, attack: 0.15 });
    }
    turbo() {
      if (!this.ok) return;
      const t = this.now;
      this.whoosh(true);
      this._osc('sawtooth', 110, t, 0.9, 0.12, null, { to: 880, glide: 0.8, filter: 'lowpass', ff: 1800 });
      this._osc('square', 220, t + 0.05, 0.8, 0.05, null, { to: 1760, glide: 0.7, filter: 'lowpass', ff: 2400 });
      // apito de samba
      [0.5, 0.62, 0.74].forEach((d) => this._osc('sine', 2600, t + d, 0.09, 0.08, null, { detune: 30 }));
    }
    // soluço com voz humana gravada (sounds/sfx/soluco_m0..2 / soluco_f0..2)
    // tocado como <audio> (funciona abrindo o jogo direto do arquivo, sem servidor)
    _hicEls() {
      if (!this.hicEls) {
        this.hicEls = { m: [], f: [] };
        ['m', 'f'].forEach((g) => [0, 1, 2].forEach((i) => {
          const a = new Audio(`sounds/sfx/soluco_${g}${i}.mp3`); a.preload = 'auto'; this.hicEls[g].push(a);
        }));
      }
      return this.hicEls;
    }
    hiccup(gender = 'm') {
      if (!this.ok) return;
      const t = this.now;
      // abaixa a música um instante para o soluço aparecer
      this.music.gain.cancelScheduledValues(t);
      this.music.gain.setTargetAtTime(this.cfg.music * 0.3, t, 0.02);
      this.music.gain.setTargetAtTime(this.cfg.music, t + 0.5, 0.15);
      const list = this._hicEls()[gender] || this.hicEls.m;
      const a = list[Math.floor(Math.random() * list.length)];
      a.currentTime = 0; a.volume = 1; a.playbackRate = 0.94 + Math.random() * 0.12;
      a.play().catch(() => {
        // reserva sintética, se o arquivo não tocar
        const f0 = gender === 'f' ? 330 : 190, t2 = this.now;
        this._noise(t2, 0.03, 0.35, 'bandpass', 1400, null, { q: 1.5 });
        this._osc('sawtooth', f0, t2 + 0.01, 0.16, 0.45, null, { to: f0 * 2.4, glide: 0.07, filter: 'lowpass', ff: 1800 });
      });
    }
    burp() {
      if (!this.ok) return;
      const t = this.now;
      const o = this._osc('sawtooth', 95, t, 0.75, 0.22, null, { to: 70, glide: 0.7, filter: 'lowpass', ff: 500, attack: 0.04 });
      const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      lfo.frequency.value = 28; lg.gain.value = 25; lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + 0.8);
    }
    gulp() {
      if (!this.ok) return;
      const t = this.now;
      for (let k = 0; k < 3; k++) this._osc('sine', 300, t + k * 0.18, 0.1, 0.18, null, { to: 160, glide: 0.08 });
    }
    gift(level = 0) {
      if (!this.ok) return;
      const t = this.now;
      const notes = level > 1 ? [76, 79, 84, 88] : level > 0 ? [76, 81, 84] : [79, 84];
      notes.forEach((n, k) => this._osc('triangle', midi(n), t + k * 0.07, 0.4, 0.09, null, { rev: true }));
    }
    back() {
      if (!this.ok) return;
      const t = this.now;
      this._osc('sine', 600, t, 0.4, 0.2, null, { to: 150, glide: 0.38 });
      this._osc('square', 300, t, 0.35, 0.05, null, { to: 80, glide: 0.33, filter: 'lowpass', ff: 900 });
    }
    slip() {
      if (!this.ok) return;
      const t = this.now;
      this._osc('sine', 300, t, 0.35, 0.2, null, { to: 1400, glide: 0.3 });
    }
    cheer() {
      if (!this.ok) return;
      const t = this.now;
      for (let k = 0; k < 7; k++) this._noise(t + k * 0.05, 2.4, 0.09, 'bandpass', 900 + k * 220, null, { q: 1.2, attack: 0.25, rev: true });
      for (let k = 0; k < 10; k++) this._noise(t + 0.2 + Math.random() * 1.8, 0.05, 0.25, 'bandpass', 2000, null, { q: 1 }); // palmas
      [0.3, 0.9].forEach((d) => this._osc('sine', 2400, t + d, 0.35, 0.06, null, { to: 3000, glide: 0.3 }));
    }
    fanfare() {
      if (!this.ok) return;
      const t = this.now;
      const seq = [[67, 0, 0.14], [72, 0.15, 0.14], [76, 0.3, 0.14], [79, 0.45, 0.5], [76, 0.95, 0.14], [79, 1.1, 0.9]];
      seq.forEach(([n, d, len]) => {
        [0, 4, 7].forEach((iv, k) => this._osc('sawtooth', midi(n + iv - 12 * (k > 0)), t + d, len + 0.1, 0.06, null,
          { filter: 'lowpass', ff: 2600, attack: 0.03, rev: true, detune: k * 6 }));
      });
    }
    sadTrombone() {
      if (!this.ok) return;
      const t = this.now;
      [[58, 0], [57, 0.45], [56, 0.9], [55, 1.35]].forEach(([n, d], k) => {
        const o = this._osc('sawtooth', midi(n - 12), t + d, k === 3 ? 1.4 : 0.42, 0.13, null, { filter: 'lowpass', ff: 900, attack: 0.05 });
        if (k === 3) {
          const l = this.ctx.createOscillator(), g = this.ctx.createGain();
          l.frequency.value = 6; g.gain.value = 4; l.connect(g); g.connect(o.frequency); l.start(t + d); l.stop(t + d + 1.4);
        }
      });
    }
    pop() {
      if (!this.ok) return;
      const t = this.now;
      this._osc('sine', 900 + Math.random() * 600, t, 0.08, 0.12, null, { to: 300, glide: 0.07 });
    }
    tick(high) {
      if (!this.ok) return;
      this._osc('sine', high ? 1320 : 880, this.now, 0.12, 0.15);
    }
    bark() {
      if (!this.ok) return;
      const t = this.now;
      [0, 0.28].forEach((d) => {
        this._osc('sawtooth', 560, t + d, 0.16, 0.22, null, { to: 330, glide: 0.14, filter: 'bandpass', ff: 1100, q: 1.2 });
        this._noise(t + d, 0.12, 0.18, 'bandpass', 1600, null, { q: 1.5 });
      });
    }
    pee(dur = 2.3) {
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, dur, 0.13, 'bandpass', 3200, null, { q: 0.8, attack: 0.15 });
      this._noise(t + 0.3, dur - 0.3, 0.07, 'bandpass', 900, null, { q: 2, attack: 0.3 });
    }
    beep() { // leitor de código de barras
      if (!this.ok) return;
      this._osc('square', 2350, this.now, 0.09, 0.07, null, { filter: 'lowpass', ff: 5000 });
    }
    paper() { // achado caindo na sacola de papel
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, 0.16, 0.22, 'bandpass', 2600, null, { q: 0.7, to: 1200 });
      this._noise(t + 0.05, 0.1, 0.12, 'highpass', 4000);
    }
    kaching() {
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, 0.08, 0.3, 'bandpass', 2500, null, { q: 1 });
      [2093, 2637, 3136, 4186].forEach((f, k) => this._osc('triangle', f, t + 0.08 + k * 0.025, 0.7, 0.08, null, { rev: true }));
      this._noise(t + 0.06, 0.4, 0.12, 'highpass', 6000, null, { rev: true });
    }
    pickup(n = 0) {
      if (!this.ok) return;
      const t = this.now, base = 72 + Math.min(n, 12);
      [0, 4, 7].forEach((iv, k) => this._osc('triangle', midi(base + iv), t + k * 0.05, 0.25, 0.08, null, { rev: true }));
      this.beep();
    }
    crash() {
      if (!this.ok) return;
      const t = this.now;
      this.metal();
      this._noise(t, 0.4, 0.4, 'lowpass', 1500, null, { to: 200 });
      this._osc('sine', 120, t, 0.3, 0.4, null, { to: 45 });
    }
    rattle(run) { // rodinhas do carrinho
      if (!this.ok) return;
      this._noise(this.now, 0.06, run ? 0.07 : 0.04, 'bandpass', 3800 + Math.random() * 1500, null, { q: 4 });
    }
    magnet() {
      if (!this.ok) return;
      const t = this.now;
      this._osc('sawtooth', 80, t, 0.9, 0.08, null, { to: 160, glide: 0.8, filter: 'lowpass', ff: 600 });
      [0, 0.12, 0.24].forEach((d) => this._osc('sine', 900 + d * 2000, t + d, 0.3, 0.06, null, { to: 1800 + d * 2000, glide: 0.25, rev: true }));
    }
    chime() { // "plim-plom" do alto-falante da loja
      if (!this.ok) return;
      const t = this.now;
      [[76, 0], [72, 0.38]].forEach(([n, d]) => { this._osc('sine', midi(n), t + d, 1.1, 0.16, null, { rev: true }); this._osc('sine', midi(n + 12), t + d, 0.6, 0.04, null, { rev: true }); });
    }
    duck(level = 0.35, dur = 3) {
      if (!this.music) return;
      const t = this.now;
      this.music.gain.cancelScheduledValues(t);
      this.music.gain.setTargetAtTime(this.cfg.music * level, t, 0.1);
      this.music.gain.setTargetAtTime(this.cfg.music, t + dur, 0.4);
    }
    // ronco do motor: liga junto com o áudio e acompanha a velocidade
    _engine() {
      if (this.eng || !this.ctx) return;
      const ctx = this.ctx, o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; o2.detune.value = 9;
      f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 2;
      g.gain.value = 0.0001;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx);
      o1.start(); o2.start();
      this.eng = { o1, o2, f, g };
    }
    setEngine(speed, on = true) {
      if (!this.ctx) return; this._engine();
      const t = this.now, v = Math.max(0, speed), f0 = 38 + v * 7.5;
      this.eng.o1.frequency.setTargetAtTime(f0, t, 0.08); this.eng.o2.frequency.setTargetAtTime(f0 * 0.5, t, 0.08);
      this.eng.f.frequency.setTargetAtTime(380 + v * 90, t, 0.1);
      this.eng.g.gain.setTargetAtTime(on && !this.muted ? 0.045 + Math.min(v, 16) * 0.004 : 0.0001, t, 0.15);
    }
    whistle() { // apito do guarda "priiii"
      if (!this.ok) return;
      const t = this.now, o = this.ctx.createOscillator(), g = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 2900; lfo.frequency.value = 38; lg.gain.value = 220;
      lfo.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(this.sfx || this.master);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.setValueAtTime(0.12, t + 0.42); g.gain.linearRampToValueAtTime(0, t + 0.5);
      o.start(t); lfo.start(t); o.stop(t + 0.52); lfo.stop(t + 0.52);
    }
    blinker() { // "tic" da seta
      if (!this.ok) return;
      this._osc('square', 2400, this.now, 0.015, 0.035, null, { filter: 'bandpass', ff: 2400, q: 8 });
    }
    wrench() { // catraca da chave de roda "trrrec"
      if (!this.ok) return;
      const t = this.now;
      for (let i = 0; i < 6; i++) this._osc('square', 1800 + Math.random() * 400, t + i * 0.045, 0.02, 0.06, null, { filter: 'bandpass', ff: 2600, q: 6 });
      this._osc('triangle', 640, t + 0.3, 0.25, 0.05, null, { rev: true });
    }
    air(dur = 1.2) { // calibrador enchendo o pneu "tssss"
      if (!this.ok) return;
      this._noise(this.now, dur, 0.18, 'highpass', 3500, null, { attack: 0.05 });
    }
    honk() { // buzina da moto "bi-bi"
      if (!this.ok) return;
      const t = this.now;
      [0, 0.24].forEach((d) => { this._osc('square', 415, t + d, 0.19, 0.16, null, { filter: 'lowpass', ff: 2200 }); this._osc('square', 523, t + d, 0.19, 0.13, null, { filter: 'lowpass', ff: 2200 }); });
    }
    skid() {
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, 0.6, 0.25, 'bandpass', 2600, null, { q: 6, to: 1800 });
      this._osc('sawtooth', 900, t, 0.5, 0.03, null, { to: 700, filter: 'bandpass', ff: 1500, q: 8 });
    }
    splash() {
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, 0.5, 0.3, 'lowpass', 2500, null, { to: 400 });
      for (let i = 0; i < 5; i++) this._osc('sine', 600 + Math.random() * 900, t + Math.random() * 0.2, 0.08, 0.05, null, { to: 300 });
    }
    deliver() { // entrega feita: "plim" + moedinhas
      if (!this.ok) return;
      const t = this.now;
      [[76, 0], [83, 0.12], [88, 0.24]].forEach(([n, d]) => this._osc('triangle', midi(n), t + d, 0.5, 0.1, null, { rev: true }));
      for (let i = 0; i < 6; i++) this._osc('square', 2600 + i * 120, t + 0.35 + i * 0.05, 0.06, 0.03, null, { filter: 'bandpass', ff: 3000 });
    }
    growl() {
      if (!this.ok) return;
      const t = this.now;
      const o = this._osc('sawtooth', 85, t, 0.7, 0.12, null, { filter: 'lowpass', ff: 420, attack: 0.08 });
      const l = this.ctx.createOscillator(), g = this.ctx.createGain(); l.frequency.value = 30; g.gain.value = 18; l.connect(g); g.connect(o.frequency); l.start(t); l.stop(t + 0.75);
    }
    snore() {
      if (!this.ok) return;
      const t = this.now;
      this._noise(t, 1.2, 0.12, 'lowpass', 300, null, { attack: 0.5, to: 200 });
      this._osc('sawtooth', 60, t, 1.2, 0.06, null, { filter: 'lowpass', ff: 220, attack: 0.5 });
    }
  }

  CNB.AudioEngine = AudioEngine;
})();
