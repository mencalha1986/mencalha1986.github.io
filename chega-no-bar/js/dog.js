/* =========================================================================
   PRESENTE "CACHORRO" — um vira-lata caramelo aparece correndo, levanta a
   pata e faz xixi na perna do bêbado. Depois sai correndo.
   Linha do tempo (segundos): chega 0–1.3 · xixi 1.3–3.7 · foge 3.9–5.4
   ========================================================================= */
(function () {
  const U = CNB.U;
  const T_ARRIVE = 1.3, T_PEE_END = 3.7, T_LEAVE = 3.9, T_GONE = 5.4;

  class DogActor {
    constructor() { this.active = false; this.pending = 0; this.puddles = []; }

    request() { this.pending = 1; }
    // presente novo chegou: o cachorro desiste e vai embora correndo
    cancel() {
      this.pending = 0;
      if (this.active && this.t < T_LEAVE) { this.t = T_LEAVE; this.peeing = false; }
    }
    reset() { this.active = false; this.pending = 0; this.puddles = []; }

    start(drunk) {
      this.active = true;
      this.t = 0;
      this.side = Math.random() < 0.5 ? -1 : 1;            // lado da perna atingida
      const ROAD = CNB.World.ROAD;
      this.fromX = this.side * (ROAD + 2.2);
      this.x = this.fromX; this.z = drunk.z - 1.6;
      this.phase = 0;
      this.peeing = false;
      this.puddle = null;
      this.barked = false;
    }

    get dir() { // para onde o cachorro está virado (+1 direita)
      if (this.t < T_ARRIVE) return -this.side;           // correndo em direção ao bêbado
      if (this.t < T_LEAVE) return this.side;             // de costas para a perna (traseiro na perna)
      return this.side;                                    // fugindo para o mesmo lado
    }

    update(dt, drunk, game) {
      if (!this.active) {
        if (this.pending > 0 && !drunk.busy && !drunk.finished) { this.pending--; this.start(drunk); drunk.startDog(this.side); game.onDogStart(); }
        return;
      }
      this.t += dt;
      const tx = drunk.x + this.side * 0.55, tz = drunk.z - 0.25;
      if (this.t < T_ARRIVE) {
        const u = U.easeInOut(this.t / T_ARRIVE);
        this.x = U.lerp(this.fromX, tx, u); this.z = U.lerp(drunk.z - 1.6, tz, u);
        this.phase += dt * 16;
      } else if (this.t < T_LEAVE) {
        this.x = U.damp(this.x, tx, 8, dt); this.z = U.damp(this.z, tz, 8, dt);
        if (!this.barked) { this.barked = true; game.audio.bark(); }
        const wasPeeing = this.peeing;
        this.peeing = this.t > T_ARRIVE + 0.35 && this.t < T_PEE_END;
        if (this.peeing && !wasPeeing) { game.audio.pee(T_PEE_END - this.t); this.puddle = { x: drunk.x + this.side * 0.25, z: drunk.z, r: 0.05 }; this.puddles.push(this.puddle); }
        if (this.peeing && this.puddle) this.puddle.r = Math.min(0.55, this.puddle.r + dt * 0.22);
        if (this.peeing) drunk.wetLeg = this.side;
      } else {
        this.peeing = false;
        const u = (this.t - T_LEAVE) / (T_GONE - T_LEAVE);
        this.x = tx + this.side * U.easeInCubic(u) * 6;
        this.z = tz - u * 1.5;
        this.phase += dt * 20;
        if (this.t > T_GONE) this.active = false;
      }
    }

    // ---------------------------------------------------------------- sprites
    sprites(world, cam, drunk, t) {
      const list = [];
      for (const p of this.puddles) if (p.z - cam.z > 0.6) list.push({ z: p.z + 0.4, draw: (ctx) => this._puddle(ctx, world, cam, p) });
      if (this.active) list.push({ z: this.z, draw: (ctx) => this._draw(ctx, world, cam, drunk, t) });
      return list;
    }

    _puddle(ctx, world, cam, p) {
      const c = world.proj(cam, p.x, 0, p.z);
      if (!c) return;
      const k = U.clamp(cam.y / c.dz, 0.05, 0.5);
      const R = p.r * c.s;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, k);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, 'rgba(220,190,60,0.55)'); g.addColorStop(0.8, 'rgba(190,160,50,0.4)'); g.addColorStop(1, 'rgba(190,160,50,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,0.25)'; ctx.beginPath(); ctx.ellipse(-R * 0.3, -R * 0.2, R * 0.3, R * 0.12, 0, 0, 7); ctx.fill();
      ctx.restore();
    }

    _draw(ctx, world, cam, drunk, t) {
      const p = world.proj(cam, this.x, 0, this.z);
      if (!p) return;
      const k = p.s / 100, dir = this.dir;
      const running = this.t < T_ARRIVE || this.t > T_LEAVE;
      const lift = this.t > T_ARRIVE && this.t < T_LEAVE ? U.clamp((this.t - T_ARRIVE) / 0.3, 0, 1) * U.clamp((T_LEAVE - this.t) / 0.2, 0, 1) : 0;
      const sw = running ? Math.sin(this.phase) : 0;
      const light = U.clamp(world.lampLight(this.z), 0, 1);
      const shade = (hex, a = 0) => U.mix(hex, '#1a1830', 0.32 - light * 0.18 + a);

      // sombra
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.22);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 48 * k);
      sg.addColorStop(0, 'rgba(0,0,0,0.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 48 * k, 0, 7); ctx.fill(); ctx.restore();

      ctx.save();
      ctx.translate(p.x, p.y - (running ? Math.abs(sw) * 3 * k : 0));
      ctx.scale(k * dir, k);
      ctx.rotate(lift * -0.08);
      const fur = shade('#c88a46'), furL = shade('#e2ab6a'), furD = shade('#94602c'), belly = shade('#ecd2a8');

      const leg = (x, far, swing, raised) => {
        ctx.strokeStyle = far ? furD : fur; ctx.lineCap = 'round'; ctx.lineWidth = 6.2;
        let hx = x, hy = -30, fx = x + swing, fy = -1;
        if (raised) { fx = x - 16; fy = -40; }
        const kx = (hx + fx) / 2 + (x > 0 ? 3 : -4), ky = (hy + fy) / 2 + (raised ? -6 : 0);
        ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke();
        ctx.fillStyle = far ? furD : belly; ctx.beginPath(); ctx.ellipse(fx + 1.5, fy, 4.2, 2.6, 0, 0, 7); ctx.fill();
      };
      // patas de trás/de frente do lado de lá
      leg(20, true, -sw * 9);
      leg(-20, true, sw * 9);
      // rabo abanando
      const wag = Math.sin(t * (this.peeing ? 9 : 20)) * 0.5;
      ctx.strokeStyle = fur; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-28, -42); ctx.quadraticCurveTo(-40, -50 - wag * 6, -42 + wag * 4, -64); ctx.stroke();
      // corpo
      const bg = ctx.createLinearGradient(0, -52, 0, -24);
      bg.addColorStop(0, furL); bg.addColorStop(0.55, fur); bg.addColorStop(1, belly);
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.ellipse(-2, -38, 30, 12.5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(22, -42, 11, 12, -0.3, 0, 7); ctx.fill();
      // costelas aparecendo (vira-lata de rua)
      ctx.strokeStyle = 'rgba(80,45,20,0.3)'; ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(4 + i * 5, -44); ctx.quadraticCurveTo(6 + i * 5, -37, 3 + i * 5, -31); ctx.stroke(); }
      // cabeça
      const hy = -56 + (running ? sw * 1.5 : Math.sin(t * 3) * 0.8);
      ctx.fillStyle = fur; ctx.beginPath(); ctx.ellipse(34, hy, 10.5, 9.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = furL; ctx.beginPath(); ctx.ellipse(44, hy + 4, 8, 5.5, 0.1, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(51, hy + 2.5, 2.6, 2.1, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(30,15,10,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(40, hy + 8); ctx.quadraticCurveTo(45, hy + 9.5, 50, hy + 7); ctx.stroke();
      if (running) { ctx.fillStyle = '#c45a6a'; ctx.beginPath(); ctx.ellipse(44, hy + 11, 2.4, 4, 0.3, 0, 7); ctx.fill(); } // língua de fora
      // orelha caída
      ctx.fillStyle = furD;
      ctx.beginPath(); ctx.moveTo(30, hy - 7); ctx.quadraticCurveTo(24, hy - 2 + (running ? sw * 3 : 0), 27, hy + 7); ctx.quadraticCurveTo(33, hy + 1, 34, hy - 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#120c0a'; ctx.beginPath(); ctx.arc(38, hy - 2.5, 1.6, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(38.3, hy - 3.4, 0.7, 0.7);
      // patas do lado de cá (a de trás levanta para o xixi)
      leg(18, false, sw * 9);
      leg(-22, false, -sw * 9, lift > 0.5);
      ctx.restore();

      // jato de xixi até a perna
      if (this.peeing) {
        const sx = p.x - dir * 0.27 * p.s, sy = p.y - 0.36 * p.s;
        const fx = drunk.footScreen.x + this.side * 14 * (p.s / 300), fy = drunk.footScreen.y - 0.42 * p.s * 0.95;
        const flick = Math.sin(t * 40) * 3;
        ctx.save();
        ctx.strokeStyle = 'rgba(235,205,70,0.75)'; ctx.lineWidth = Math.max(1.5, 0.018 * p.s); ctx.lineCap = 'round';
        ctx.setLineDash([0.06 * p.s, 0.025 * p.s]); ctx.lineDashOffset = -t * 400;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + fx) / 2, Math.min(sy, fy) - 0.18 * p.s + flick, fx, fy); ctx.stroke();
        ctx.setLineDash([]);
        // respingos na calça
        for (let i = 0; i < 4; i++) {
          const a = t * 13 + i * 1.7;
          ctx.fillStyle = 'rgba(240,215,90,0.7)';
          ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 0.04 * p.s, fy + Math.abs(Math.sin(a)) * 0.08 * p.s, Math.max(1, 0.008 * p.s), 0, 7); ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  DogActor.DURATION = T_GONE;
  CNB.DogActor = DogActor;
})();
