/* =========================================================================
   OLHA O MATE! 3D — desenho em 3D (three.js) da praia de Copacabana.
   A regra do jogo continua no game.js (mesma do jogo 2D); aqui só se desenha
   o estado: vendedor, banhistas, obstáculos, cenas com os achados do site,
   gaivotas, o rapa e as moedas. Personagens: modelos CC0 do Quaternius
   (pasta modelos/, ver LICENCA.txt).
   Eixos: o vendedor anda para -Z; o mar fica à esquerda (x < 0) e o
   calçadão, a avenida e os prédios à direita (x > 0). 1 unidade = 1 metro.
   ========================================================================= */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';

const CNB = window.CNB, U = CNB.U;
const PXM = CNB.World.PXM, GY = CNB.World.GY;
const JUMP_PX_PER_M = 150;            // pulo do jogo (px) → metros
const SHORE = -9;                     // linha da água
const W2 = 1080, H2 = 1920;

// ------------------------------------------------------------ texturas desenhadas no código
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const sandTex = () => canvasTex(512, 512, (x, w, h) => {
  x.fillStyle = '#e8d3a0'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 22000; i++) { const v = Math.random(); x.fillStyle = v < 0.5 ? 'rgba(160,125,70,0.10)' : 'rgba(255,250,235,0.16)'; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let i = 0; i < 60; i++) { x.fillStyle = 'rgba(150,115,60,0.10)'; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 3 + Math.random() * 5, Math.random() * 3, 0, 7); x.fill(); }
}, [10, 140]);
// calçadão de Copacabana: ondas pretas e brancas
const calcadaoTex = () => canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#1c1c1c';
  for (let k = -1; k < 3; k++) { x.beginPath(); for (let yy = 0; yy <= h; yy += 4) { const xx = w * 0.5 + Math.sin((yy / h) * Math.PI * 2) * w * 0.28 + k * w; yy === 0 ? x.moveTo(xx - w * 0.25, yy) : x.lineTo(xx - w * 0.25, yy); }
    for (let yy = h; yy >= 0; yy -= 4) x.lineTo(w * 0.5 + Math.sin((yy / h) * Math.PI * 2) * w * 0.28 + k * w + w * 0.25, yy); x.closePath(); x.fill(); }
}, [2, 60]);
const windowsTex = (base) => canvasTex(128, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let r = 0; r < 16; r++) for (let c = 0; c < 6; c++) { x.fillStyle = Math.random() < 0.25 ? '#ffe9a8' : `rgba(30,50,70,${0.55 + Math.random() * 0.3})`; x.fillRect(8 + c * 20, 8 + r * 15.5, 13, 9); }
  x.fillStyle = 'rgba(0,0,0,0.12)'; for (let r = 0; r < 16; r++) x.fillRect(0, 19 + r * 15.5, w, 2);
});
const stripesTex = (a, b, n = 8) => canvasTex(256, 64, (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect((i * w) / n, 0, w / n + 1, h); } });
const labelTex = (text, bg, fg, w = 256, h = 96, font = '900 54px Rubik, sans-serif') => canvasTex(w, h, (x) => {
  x.fillStyle = bg; const r = 26; x.beginPath(); x.moveTo(r, 0); x.arcTo(w, 0, w, h, r); x.arcTo(w, h, 0, h, r); x.arcTo(0, h, 0, 0, r); x.arcTo(0, 0, w, 0, r); x.fill();
  x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 4);
});
const ballTex = () => canvasTex(256, 128, (x, w, h) => { ['#ef4444', '#ffffff', '#2563eb', '#ffffff', '#facc15', '#ffffff'].forEach((c, i) => { x.fillStyle = c; x.fillRect((i * w) / 6, 0, w / 6 + 1, h); }); });

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
function shadowAll(obj, cast = true, receive = false) { obj.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } }); return obj; }

// ------------------------------------------------------------ personagens
const MODELS = {
  homem:  { file: 'modelos/homem.glb',  clips: { walk: 'Man_Walk', run: 'Man_Run', idle: 'Man_Idle', jump: 'Man_Jump', death: 'Man_Death', clap: 'Man_Clapping', sit: 'Man_Sitting', stand: 'Man_Standing' } },
  mulher: { file: 'modelos/mulher.glb', clips: { walk: 'Walking', run: 'Running', idle: 'Idle', jump: 'Jump', death: 'Death', clap: 'PickUp', sit: 'SitIdle', stand: 'Idle' } },
  humano: { file: 'modelos/humano.glb', clips: { walk: 'Walk', run: 'Run', idle: 'Idle', jump: 'Jump', death: 'Death', clap: 'Working', sit: 'Idle', stand: 'Idle' } }
};
const LOADED = {};
async function loadModels() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(MODELS).map(async ([k, m]) => {
    const g = await loader.loadAsync(m.file);
    // altura real pela cabeça do esqueleto (a caixa dos modelos com esqueleto vem em outra escala)
    g.scene.updateMatrixWorld(true);
    let head = null; g.scene.traverse((b) => { if (!head && b.isBone && /^Head$/i.test(b.name)) head = b; });
    const hy = head ? head.getWorldPosition(new THREE.Vector3()).y : 0;
    const box = new THREE.Box3().setFromObject(g.scene, true), hgt = box.max.y - box.min.y;
    const scale = hy > 0 ? 1.55 / hy : 1.72 / (hgt || 1);
    console.info('[3D] modelo', k, 'cabeça', hy.toFixed(3), 'caixa', hgt.toFixed(3), 'escala', scale.toFixed(4));
    LOADED[k] = { gltf: g, scale, clips: g.animations };
  }));
}
// um personagem pronto: grupo em metros (pés no chão), modelo animado dentro
class Person {
  constructor(kind, colors = {}, tint) {
    const L = LOADED[kind], def = MODELS[kind];
    this.kind = kind; this.def = def;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(L.gltf.scene);
    this.model.scale.setScalar(L.scale);
    this.model.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true; m.frustumCulled = false;
      const fix = (mm) => { const c = mm.clone(); if (colors[c.name]) c.color = new THREE.Color(colors[c.name]); if (tint && (!colors || !colors[c.name])) c.color = c.color.clone().multiply(new THREE.Color(tint)); return c; };
      m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
    });
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {}; this.cur = null;
    this.head = null; this.model.traverse((b) => { if (!this.head && b.isBone && /^Head$/i.test(b.name)) this.head = b; });
  }
  play(key, fade = 0.25, once = false, speed = 1) {
    const name = this.def.clips[key];
    if (this.curKey === key) { if (this.cur) this.cur.timeScale = speed; return; }
    let a = this.actions[key];
    if (!a) { const clip = LOADED[this.kind].clips.find((c) => c.name === name || c.name.endsWith('|' + name)); if (!clip) return; a = this.actions[key] = this.mixer.clipAction(clip); }
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.timeScale = speed;
    if (this.cur) a.crossFadeFrom(this.cur, fade, false);
    a.play(); this.cur = a; this.curKey = key;
  }
  update(dt) { this.mixer.update(dt); }
  headWorld(v) { if (this.head) return this.head.getWorldPosition(v); return this.root.getWorldPosition(v).add(new THREE.Vector3(0, 1.7, 0)); }
  dispose() { this.root.removeFromParent(); this.mixer.stopAllAction(); }
}

// ------------------------------------------------------------ cena
class R3D {
  constructor(canvas, game) {
    this.g = game; this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(1); r.setSize(720, 1280, false);
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.85;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    const s = this.scene = new THREE.Scene();
    s.fog = new THREE.Fog(0xcfe6f2, 90, 520);
    this.cam = new THREE.PerspectiveCamera(56, 720 / 1280, 0.1, 3000);
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3();
    this._sky(); this._ground(); this._city(); this._decor();
    this.ents = new Map();   // objeto do jogo → objeto 3D
    this.vendor = this._makeVendor();
    s.add(this.vendor.root);
  }

  _sky() {
    const sky = new Sky(); sky.scale.setScalar(10000); this.scene.add(sky);
    const u = sky.material.uniforms; u.turbidity.value = 5; u.rayleigh.value = 1.1; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(58), THREE.MathUtils.degToRad(200));
    u.sunPosition.value.copy(sun);
    this.scene.add(new THREE.HemisphereLight(0xcfe9ff, 0xe8d3a0, 1.1));
    const d = this.sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    d.position.copy(sun).multiplyScalar(60); d.castShadow = true;
    d.shadow.mapSize.set(2048, 2048); const sc = d.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 200; d.shadow.bias = -0.0004;
    this.scene.add(d); this.scene.add(d.target);
    this.sunDir = sun;
  }

  _ground() {
    const len = this.g.cfg.goal + 400;
    // areia
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, len), mat(0xffffff, { map: sandTex(), roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(10, 0, -len / 2 + 120); sand.receiveShadow = true; this.scene.add(sand);
    // areia molhada perto da água
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(5, len), mat(0xc9ad74, { roughness: 0.55 }));
    wet.rotation.x = -Math.PI / 2; wet.position.set(SHORE + 1.2, 0.01, -len / 2 + 120); wet.receiveShadow = true; this.scene.add(wet);
    // mar com ondas (vértices animados no shader)
    const seaGeo = new THREE.PlaneGeometry(700, len + 900, 140, 260); seaGeo.rotateX(-Math.PI / 2);
    const seaMat = new THREE.MeshStandardMaterial({ color: 0x1f86b8, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.96 });
    this.seaU = { time: { value: 0 } };
    seaMat.onBeforeCompile = (sh) => {
      sh.uniforms.time = this.seaU.time;
      sh.vertexShader = 'uniform float time;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float w1 = sin(position.x * 0.18 + time * 1.6) * 0.22 + sin(position.z * 0.07 + time * 0.9) * 0.18 + sin((position.x + position.z) * 0.33 + time * 2.4) * 0.07;
        transformed.y += w1;`).replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        objectNormal = normalize(vec3(-cos(position.x * 0.18 + time * 1.6) * 0.04, 1.0, -cos(position.z * 0.07 + time * 0.9) * 0.013));`);
    };
    const sea = new THREE.Mesh(seaGeo, seaMat); sea.position.set(SHORE - 350, -0.12, -len / 2 + 120 - 300); sea.receiveShadow = true; this.scene.add(sea);
    // espuma da onda chegando na areia
    this.foam = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(2.2, len), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
      f.rotation.x = -Math.PI / 2; f.position.set(SHORE - 1, 0.03 + i * 0.002, -len / 2 + 120); this.scene.add(f); this.foam.push(f);
    }
  }

  _city() {
    const len = this.g.cfg.goal + 400, z0 = 120, z1 = -len + 120;
    // calçadão, ciclovia, avenida e calçada dos prédios
    const strip = (x, w, m, y = 0.05) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, -len / 2 + 120); p.receiveShadow = true; this.scene.add(p); };
    strip(24, 7, mat(0xffffff, { map: calcadaoTex(), roughness: 0.9 }), 0.25);
    strip(29, 3, mat(0xb91c1c, { roughness: 0.9 }), 0.24);
    strip(36, 11, mat(0x3a3d42, { roughness: 0.95 }), 0.2);
    strip(44, 5, mat(0xd6d3cc), 0.25);
    // meio-fio entre areia e calçadão
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, len), mat(0xd9d6cf)); curb.position.set(20.3, 0.12, -len / 2 + 120); curb.receiveShadow = true; this.scene.add(curb);
    // prédios da orla
    const cols = ['#e9e4d8', '#d9c7a7', '#c9d6df', '#f1e6c8', '#d8b8a8', '#cfd8c4', '#e7d2c3'];
    const texs = cols.map((c) => windowsTex(c));
    for (let z = z0; z > z1 - 200; z -= U.rand(14, 22)) {
      const h = U.rand(22, 58), w = U.rand(11, 17), d = U.rand(14, 20), ti = Math.floor(Math.random() * texs.length);
      const t = texs[ti].clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.round(w / 6), Math.round(h / 12));
      const b = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), [mat(0xffffff, { map: t }), mat(0xffffff, { map: t }), mat(0xbdb8ae), mat(0xbdb8ae), mat(0xffffff, { map: t }), mat(0xffffff, { map: t })]);
      b.position.set(47 + d / 2, h / 2, z); b.castShadow = true; b.receiveShadow = true; this.scene.add(b);
    }
    // coqueiros no calçadão
    for (let z = z0; z > z1; z -= U.rand(13, 19)) this.scene.add(this._palm(21.5 + Math.random() * 1.5, z));
    // morros no fim da praia (Arpoador / Dois Irmãos) e no mar
    const rock = mat(0x5f7d5c, { roughness: 1, flatShading: true });
    const hill = (x, z, sx, sy, sz) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), rock); m.scale.set(sx, sy, sz); m.position.set(x, 0, z); this.scene.add(m); };
    const zEnd = -this.g.cfg.goal - 80;
    hill(-30, zEnd - 260, 80, 95, 60); hill(40, zEnd - 420, 70, 150, 70); hill(120, zEnd - 380, 60, 130, 60); hill(-160, zEnd - 120, 50, 40, 40);
  }

  _palm(x, z) {
    const g = new THREE.Group(), h = U.rand(7, 10), lean = U.rand(-0.15, 0.15);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 8), mat(0x8b6a43)); trunk.position.y = h / 2; trunk.rotation.z = lean; g.add(trunk);
    const top = new THREE.Vector3(-Math.sin(lean) * h, h, 0), leafM = mat(0x2f7d32, { side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9, 6, 1), leafM);
      const p = leaf.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const xx = p.getX(k); p.setY(k, p.getY(k) * (1 - Math.abs(xx) / 2.4)); p.setZ(k, -Math.pow(Math.max(0, xx), 2) * 0.12); }
      leaf.geometry.translate(2.1, 0, 0); leaf.position.copy(top); leaf.rotation.set(0.5, (i / 8) * Math.PI * 2, -0.35); g.add(leaf);
    }
    g.position.set(x, 0.25, z); return shadowAll(g);
  }

  _umbrella(colorA, colorB) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6), mat(0xe5e7eb, { metalness: 0.6, roughness: 0.4 })); pole.position.y = 1.15; g.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.45, 16, 1, true), mat(0xffffff, { map: stripesTex(colorA, colorB, 8), side: THREE.DoubleSide }));
    top.position.y = 2.35; g.add(top);
    return shadowAll(g);
  }

  _decor() {
    const len = this.g.cfg.goal, UMB = [['#ef4444', '#fff7ed'], ['#2563eb', '#fef9c3'], ['#16a34a', '#fefce8'], ['#f59e0b', '#ffffff'], ['#db2777', '#fdf2f8'], ['#7c3aed', '#ede9fe']];
    // guarda-sóis espalhados pela areia, longe do caminho do vendedor
    for (let z = 60; z > -len - 120; z -= U.rand(2.5, 5)) {
      const side = Math.random() < 0.5 ? -1 : 1, x = side < 0 ? U.rand(SHORE + 2, -4.5) : U.rand(5.5, 18);
      const c = UMB[Math.floor(Math.random() * UMB.length)], u = this._umbrella(c[0], c[1]);
      u.position.set(x, 0, z); u.rotation.z = U.rand(-0.08, 0.08); this.scene.add(u);
      if (Math.random() < 0.6) { const cg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.9), mat(0xffffff, { map: stripesTex(c[0], '#ffffff', 6) })); cg.rotation.x = -Math.PI / 2; cg.rotation.z = Math.random() * 3; cg.position.set(x + 0.8, 0.02, z + 0.5); cg.receiveShadow = true; this.scene.add(cg); }
    }
    // postos de salva-vidas
    for (let i = 1; i <= 4; i++) {
      const z = -(len * i) / 5, g = new THREE.Group();
      [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), mat(0xe5e7eb)); l.position.set(a, 1.6, b); g.add(l); });
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.4), mat(0x0f4c81)); cab.position.y = 3.9; g.add(cab);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), new THREE.MeshBasicMaterial({ map: labelTex(`POSTO ${i + 1}`, '#0f4c81', '#ffd23f') })); sign.position.set(0, 4.3, 1.21); g.add(sign);
      const sign2 = sign.clone(); sign2.rotation.y = Math.PI / 2; sign2.position.set(1.31, 4.3, 0); g.add(sign2);
      g.position.set(-6.5, 0, z); this.scene.add(shadowAll(g));
    }
    // quiosque do Posto 6 (chegada)
    const k = new THREE.Group(), zg = -len - 4;
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 3.2), mat(0xf59e0b)); base.position.y = 1.2; k.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.6, 4), mat(0x15803d)); roof.position.y = 4.2; roof.rotation.y = Math.PI / 4; k.add(roof);
    [[-2.2, -1.4], [2.2, -1.4], [-2.2, 1.4], [2.2, 1.4]].forEach(([a, b]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.6, 6), mat(0x7c4a24)); p.position.set(a, 1.8, b); k.add(p); });
    const ks = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.2), new THREE.MeshBasicMaterial({ map: labelTex('QUIOSQUE · POSTO 6', '#7c2d12', '#fde68a', 512, 120, '900 52px Rubik, sans-serif') })); ks.position.set(0, 3.0, 1.62); k.add(ks);
    k.position.set(3.5, 0, zg); this.scene.add(shadowAll(k, true, true));
    this.scene.add(this._palm(-1.5, zg - 3)); this.scene.add(this._palm(8.5, zg + 1));
  }

  // ------------------------------------------------------------ vendedor (camiseta laranja, boné, galões)
  _makeVendor() {
    const p = new Person('homem', { Shirt: '#f97316', Pants: '#1e3a5f', Socks: '#2563eb', Hair: '#1a120c' });
    const gal = (color) => { const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 18), mat(0xe5e7eb, { metalness: 0.35, roughness: 0.35 })); g.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.14, 18), mat(color)); g.add(band);
      const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), mat(0x222222)); tap.position.set(0, -0.28, 0.12); g.add(tap);
      return shadowAll(g); };
    const g1 = gal(0xf59e0b), g2 = gal(0xfacc15); g1.position.set(-0.36, 1.0, 0.0); g2.position.set(0.36, 1.0, 0.0); g1.userData.galao = g2.userData.galao = true;
    p.root.add(g1, g2);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 24, Math.PI), mat(0x78350f)); strap.position.set(0, 1.0, 0); strap.rotation.z = 0; strap.userData.galao = true; p.root.add(strap);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.12), mat(0xf8fafc)); bag.position.set(0.1, 0.85, -0.22); p.root.add(shadowAll(bag));
    const cap = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x16a34a)); cap.add(crown);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), mat(0x15803d)); brim.position.set(0, 0, 0.1); brim.scale.set(1, 1, 1.4); cap.add(brim);
    this.scene.add(shadowAll(cap)); p.cap = cap;
    p.play('walk');
    return p;
  }

  // ------------------------------------------------------------ objetos que vêm e vão (banhistas, obstáculos, cenas…)
  _ent(key, make) { let e = this.ents.get(key); if (!e) { e = make(); e.seen = true; this.ents.set(key, e); if (e.obj) this.scene.add(e.obj); } e.seen = true; return e; }
  _customer(cu) {
    const side = cu.seed < 0.5 ? -1 : 1, x = side * U.rand(2.4, 2.8), z = -cu.x / PXM, g = new THREE.Group();
    const UMB = [['#ef4444', '#fff7ed'], ['#2563eb', '#fef9c3'], ['#16a34a', '#fefce8'], ['#f59e0b', '#ffffff'], ['#db2777', '#fdf2f8']];
    const c = UMB[Math.floor(cu.seed * 97) % UMB.length], u = this._umbrella(c[0], c[1]); u.position.set(side * 0.9, 0, -0.4); g.add(u);
    const woman = cu.seed * 10 % 1 < 0.5, kind = woman ? 'mulher' : 'homem';
    const p = new Person(kind, woman ? {} : { Shirt: cu.suit, Pants: '#1f2937' }, woman ? cu.suit : null);
    p.root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; p.play('sit'); p.mixer.update(Math.random() * 2);
    if (cu.kind === 'cadeira') { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.6), mat(c[0])); ch.position.set(0, 0.42, 0); g.add(shadowAll(ch)); p.root.position.y = 0.0; }
    g.add(p.root);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('MATE!', '#ffffff', '#16a34a'), depthTest: false, transparent: true })); tag.scale.set(1.1, 0.42, 1); tag.position.set(0, 2.2, 0); tag.visible = false; g.add(tag);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.13, 10), mat(0xf59e0b)); cup.position.set(-side * 0.25, 0.75, 0.2); cup.visible = false; g.add(cup);
    g.position.set(x, 0, z);
    return { obj: g, person: p, tag, cup };
  }
  _obstacle(o) {
    const g = new THREE.Group(), sandM = mat(0xd6b678, { roughness: 1 });
    if (o.kind === 'castelo') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.7), sandM); b.position.y = 0.25; g.add(b);
      [[-0.38, -0.28], [0.38, -0.28], [-0.38, 0.28], [0.38, 0.28]].forEach(([a, c]) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.75, 10), sandM); t.position.set(a, 0.38, c); g.add(t); });
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.95, 10), sandM); k.position.y = 0.48; g.add(k);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4, 4), mat(0x7c5a2a)); pole.position.y = 1.12; g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), mat(0xef4444, { side: THREE.DoubleSide })); flag.position.set(0.11, 1.24, 0); g.add(flag);
    } else if (o.kind === 'buraco') {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), mat(0x5a4320, { roughness: 1 })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.012; hole.scale.set(1, 0.7, 1); g.add(hole);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.1, 6, 24), sandM); rim.rotation.x = -Math.PI / 2; rim.scale.set(1, 0.7, 0.6); rim.position.y = 0.03; g.add(rim);
      const shovel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), mat(0x2563eb)); shovel.position.set(0.8, 0.3, 0); shovel.rotation.z = 0.5; g.add(shovel);
    } else if (o.kind === 'bola') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 16), mat(0xffffff, { map: ballTex(), roughness: 0.45 })); ball.position.y = 0.28; g.add(ball); g.userData.ball = ball;
    } else {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 16), mat(0xf97316)); b.position.y = 0.2; g.add(b);
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.04), mat(0x22c55e)); sp.position.set(0.32, 0.22, 0); sp.rotation.z = -0.4; g.add(sp);
    }
    g.position.set(0, 0, -o.x / PXM); g.rotation.y = o.seed * 6;
    return { obj: shadowAll(g) };
  }
  _scene3(s) {
    const g = new THREE.Group(), side = -1, x = side * 3.4, people = [];
    const add = (kind, colors, tint, pos, rotY, anim) => { const p = new Person(kind, colors, tint); p.root.position.set(...pos); p.root.rotation.y = rotY; p.play(anim); p.mixer.update(Math.random() * 3); g.add(p.root); people.push(p); return p; };
    const faceCam = 0.6;
    switch (s.kind) {
      case 'copo': {
        add('mulher', {}, '#93c5fd', [-0.6, 0, 0], faceCam, 'clap');
        const m = add('homem', { Shirt: '#facc15', Pants: '#0f766e' }, null, [0.7, 0, 0.2], faceCam - 0.4, 'clap');
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.22, 16), mat(0xcbd5e1, { metalness: 0.8, roughness: 0.25 })); cup.position.set(0.95, 1.15, 0.35); g.add(cup);
        const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 16), mat(0x111827)); spk.position.set(0.95, 1.06, 0.35); g.add(spk);
        g.userData.notes = new THREE.Vector3(0.95, 1.35, 0.35);
        break;
      }
      case 'churrasco': {
        const grill = new THREE.Group();
        const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x1f2937, { metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide })); bowl.position.y = 0.75; grill.add(bowl);
        const coal = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); coal.rotation.x = -Math.PI / 2; coal.position.y = 0.72; grill.add(coal); g.userData.coal = coal;
        const grid = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), mat(0x9ca3af, { wireframe: true })); grid.rotation.x = -Math.PI / 2; grid.position.y = 0.76; grill.add(grid);
        [0, 2.1, 4.2].forEach((a) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 6), mat(0x111827)); l.position.set(Math.cos(a) * 0.3, 0.37, Math.sin(a) * 0.3); l.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); grill.add(l); });
        for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.08), mat(0x7c2d12)); m.position.set(-0.15 + i * 0.15, 0.79, 0); grill.add(m); }
        grill.position.set(0, 0, 0); g.add(shadowAll(grill));
        add('humano', {}, '#fca5a5', [-0.9, 0, 0.1], 1.2, 'clap');
        add('mulher', {}, '#f9a8d4', [1.0, 0, 0.6], -0.5, 'sit');
        const kid = add('homem', { Shirt: '#38bdf8', Pants: '#16a34a' }, null, [0.4, 0, 1.3], faceCam, 'jump'); kid.root.scale.setScalar(0.62);
        g.userData.smoke = [];
        for (let i = 0; i < 6; i++) { const sm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe5e7eb, transparent: true, opacity: 0.4, depthWrite: false })); g.add(sm); g.userData.smoke.push(sm); }
        break;
      }
      case 'cadeira': {
        const ch = new THREE.Group(), al = mat(0xcbd5e1, { metalness: 0.8, roughness: 0.3 });
        const seat = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), mat(0xffffff, { map: stripesTex('#ef4444', '#facc15', 6), side: THREE.DoubleSide })); seat.rotation.x = -Math.PI / 2; seat.position.y = 0.45; ch.add(seat);
        const back = seat.clone(); back.rotation.x = -0.35; back.position.set(0, 0.8, -0.35); ch.add(back);
        [[-0.3, 0.3], [0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), al); l.position.set(a, 0.22, b); ch.add(l); });
        ch.rotation.y = faceCam; g.add(shadowAll(ch));
        add('homem', { Shirt: '#0f766e', Pants: '#f8fafc' }, null, [0, 0, 0], faceCam, 'sit');
        break;
      }
      case 'infantil': {
        const u = this._umbrella('#f472b6', '#fef08a'); u.scale.setScalar(0.55); u.position.set(0.5, 0, -0.3); g.add(u);
        const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), mat(0x38bdf8)); ch.position.y = 0.25; g.add(shadowAll(ch));
        const kid = add('homem', { Shirt: '#fde68a', Pants: '#f97316' }, null, [0, 0, 0], faceCam, 'sit'); kid.root.scale.setScalar(0.6);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.2, 12), mat(0xef4444)); b.position.set(0.6, 0.1, 0.4); g.add(shadowAll(b));
        break;
      }
      case 'esteira': {
        const mt = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), mat(0xffffff, { map: stripesTex('#0ea5e9', '#f0f9ff', 10) })); mt.rotation.x = -Math.PI / 2; mt.rotation.z = 0.9; mt.position.y = 0.02; mt.receiveShadow = true; g.add(mt);
        const p = add('mulher', {}, '#fda4af', [0, 0.05, 0], faceCam, 'death'); p.play('death', 0, true); p.mixer.update(5);
        break;
      }
      case 'short': {
        add('mulher', {}, '#f5d0fe', [0, 0, 0], faceCam + 0.6, 'idle');
        break;
      }
    }
    g.position.set(x, 0, -s.x / PXM);
    return { obj: g, people };
  }
  _gull() {
    const g = new THREE.Group(), white = mat(0xf8fafc), grey = mat(0x9ca3af);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), white); body.scale.set(1, 0.7, 1.8); g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), white); head.position.set(0, 0.08, -0.38); g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), mat(0xf59e0b)); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.06, -0.54); g.add(beak);
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.32), grey), wr = wl.clone();
    wl.geometry = wl.geometry.clone(); wl.geometry.translate(-0.45, 0, 0); wr.geometry = wr.geometry.clone(); wr.geometry.translate(0.45, 0, 0);
    g.add(wl, wr); g.userData = { wl, wr };
    const bis = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.06), mat(0xf8fafc)); bis.position.set(0, -0.18, -0.4); bis.visible = false; g.add(bis); g.userData.bis = bis;
    return { obj: shadowAll(g) };
  }

  // rodada nova: tira tudo da areia e devolve os galões ao vendedor (o rapa pode ter levado)
  resetRound() {
    for (const e of this.ents.values()) { e.obj && e.obj.removeFromParent(); if (e.person) e.person.dispose(); if (e.people) e.people.forEach((p) => p.dispose()); }
    this.ents.clear();
    if (this.vendor) { this.vendor.dispose(); this.vendor.cap && this.vendor.cap.removeFromParent(); }
    this.vendor = this._makeVendor(); this.scene.add(this.vendor.root);
  }

  // ------------------------------------------------------------ desenho de um quadro
  render(t, dt) {
    const g = this.g, w = g.world, v = g.vendor, cfg = g.cfg;
    this.seaU.time.value = t;
    this.foam.forEach((f, i) => { const k = (Math.sin(t * 0.8 + i * 2.1) + 1) / 2; f.position.x = SHORE - 1 + k * 1.6 - i * 0.6; f.material.opacity = 0.15 + 0.45 * (1 - k); });
    const vz = -w.x / PXM, jump = (v.jumpH || 0) / JUMP_PX_PER_M;
    // vendedor
    const P = this.vendor;
    P.root.position.set(0, jump, vz); P.root.rotation.y = Math.PI;
    let anim = 'walk', spd = 1;
    if (g.mode === 'title') { anim = 'walk'; spd = 0.9; }
    else if (v.dead) anim = 'death';
    else if (v.stun > 0) anim = 'death';
    else if (g.mode === 'arrive' || g.mode === 'win') anim = 'clap';
    else if (v.air) anim = 'jump';
    else if (v.sell > 0 || Math.abs(v.speed) < 0.15) anim = 'idle';
    else if (v.turbo > 0 || Math.abs(v.speed) > 5) anim = 'run';
    else { anim = 'walk'; spd = U.clamp(Math.abs(v.speed) / 1.9, 0.6, 1.8) * (v.speed < 0 ? -1 : 1); }
    P.play(anim, 0.2, anim === 'death' || anim === 'jump', spd);
    P.update(dt);
    if (P.cap) { P.headWorld(this._v); P.cap.position.copy(this._v).add(this._v2.set(0, 0.12, 0)); P.cap.rotation.y = Math.PI; }
    // câmera atrás e um pouco acima, olhando à frente na areia
    const shake = g.shake || 0, sx = (Math.random() - 0.5) * shake * 0.01, sy = (Math.random() - 0.5) * shake * 0.01;
    this.cam.position.set(1.7 + sx, 3.1 + sy, vz + 6.6);
    this.cam.lookAt(0.2, 1.1, vz - 7);
    this.sun.position.set(this.sunDir.x * 60, this.sunDir.y * 60, vz + this.sunDir.z * 60); this.sun.target.position.set(0, 0, vz - 6);
    // entidades
    for (const e of this.ents.values()) e.seen = false;
    for (const cu of w.customers) {
      if (Math.abs(-cu.x / PXM - vz) > 90) continue;
      const e = this._ent(cu, () => this._customer(cu));
      e.tag.visible = cu.raise > 0.3; e.tag.position.y = 2.2 + Math.sin(t * 5 + cu.seed * 9) * 0.06; e.cup.visible = cu.served;
      if (e.person.kind === 'homem') e.person.play(cu.raise > 0.3 ? 'clap' : 'sit'); e.person.update(dt);
    }
    for (const o of w.obstacles) {
      if (Math.abs(-o.x / PXM - vz) > 90) continue;
      const e = this._ent(o, () => this._obstacle(o));
      if (e.obj.userData.ball) { e.obj.userData.ball.position.y = 0.28 + Math.abs(Math.sin(t * 5 + o.seed * 9)) * 0.5; e.obj.userData.ball.rotation.x += dt * 3; }
      e.obj.visible = true; if (o.hit) e.obj.rotation.z = Math.min(e.obj.rotation.z + dt * 3, 0.6);
    }
    for (const s of w.scenes) {
      if (Math.abs(-s.x / PXM - vz) > 110) continue;
      const e = this._ent(s, () => this._scene3(s));
      e.people.forEach((p) => p.update(dt));
      const ud = e.obj.userData;
      if (ud.coal) ud.coal.material.color.setHSL(0.05, 1, 0.45 + Math.sin(t * 9) * 0.08);
      if (ud.smoke) ud.smoke.forEach((sm, i) => { const p = (t * 0.35 + i / ud.smoke.length) % 1; sm.position.set(Math.sin(p * 5 + i) * 0.3 + p * 0.5, 0.9 + p * 3, 0); sm.scale.setScalar(0.6 + p * 2.2); sm.material.opacity = 0.35 * (1 - p); });
    }
    // gaivotas: saem do alto à frente e mergulham no vendedor
    const head = P.headWorld(new THREE.Vector3());
    for (const gu of (g.gulls || [])) {
      const e = this._ent(gu, () => this._gull());
      if (gu.d0 === undefined) gu.d0 = Math.hypot(gu.x - v.x, gu.y - v.y) || 1;
      const d = Math.hypot(gu.x - v.x - 20, gu.y - v.y + 240), p = U.clamp(1 - d / gu.d0, 0, 1);
      if (!gu.hitDone) { gu.z0 = gu.z0 || head.z - 26 - Math.random() * 6; gu.x3 = gu.x3 === undefined ? U.rand(-6, 6) : gu.x3; e.obj.position.set(U.lerp(gu.x3, head.x, p), U.lerp(9, head.y + 0.2, p), U.lerp(gu.z0, head.z - 0.3, p)); e.obj.lookAt(head); }
      else { e.obj.position.x += dt * 4; e.obj.position.y += dt * 5; e.obj.position.z -= dt * 6; e.obj.userData.bis.visible = true; }
      const f = Math.sin(t * 22 + gu.ph) * 0.7; e.obj.userData.wl.rotation.z = f; e.obj.userData.wr.rotation.z = -f;
    }
    // o rapa: vem correndo pela areia e leva o isopor
    const r = g.rapa;
    if (r) {
      const e = this._ent(r, () => { const p = new Person('humano', {}, '#fb923c'); const vest = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('RAPA', '#f97316', '#111'), depthTest: false })); vest.scale.set(0.9, 0.34, 1); vest.position.y = 2.15; p.root.add(vest); return { obj: p.root, person: p }; });
      if (r.d0 === undefined) r.d0 = Math.max(1, r.x - v.x - 120);
      const p = r.got ? 1 : U.clamp(1 - (r.x - v.x - 120) / r.d0, 0, 1);
      if (!r.got) { e.obj.position.set(U.lerp(1.2, 0.4, p), 0, U.lerp(vz - 28, vz - 0.9, p)); e.obj.rotation.y = 0; e.person.play('run'); }
      else { e.obj.position.z -= dt * 7; e.obj.rotation.y = Math.PI; e.person.play('run');
        if (!e.carry) { e.carry = P.root.children.filter((c) => c.userData.galao); e.carry.forEach((c) => { e.obj.add(c); c.position.y = 1.0; }); } }
      e.person.update(dt);
    }
    // moedas
    for (const c of w.coins) {
      const e = this._ent(c, () => ({ obj: shadowAll(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 14), mat(0xfacc15, { metalness: 0.9, roughness: 0.25 }))) }));
      e.obj.position.set((c.x - w.x) / 120, Math.max(0.05, (GY - c.y) / JUMP_PX_PER_M), vz); e.obj.rotation.x = c.rot; e.obj.rotation.z = c.rot * 0.5;
    }
    // remove o que saiu do jogo
    for (const [k, e] of this.ents) if (!e.seen) { e.obj && e.obj.removeFromParent(); if (e.person) e.person.dispose(); if (e.people) e.people.forEach((p) => p.dispose()); this.ents.delete(k); }
    this.renderer.render(this.scene, this.cam);
    // posição do vendedor na tela (para textos e balões do HUD, que é 2D)
    const feet = this.toScreen(this._v.set(0, jump, vz)), hs = this.toScreen(head.clone().add(this._v2.set(0, 0.35, 0)));
    if (feet) { v.x = feet.x; v.y = feet.y; } if (hs) v.headScreen = hs;
  }
  toScreen(p3) {
    const p = p3.clone().project(this.cam); if (p.z > 1) return null;
    return { x: (p.x + 1) / 2 * W2, y: (1 - p.y) / 2 * H2 };
  }
  // âncora da plaquinha de produto de uma cena (em cima do grupo)
  sceneAnchor(s) { const e = this.ents.get(s); if (!e) return null; const p = e.obj.position.clone(); p.y += 3.0; return this.toScreen(p); }
}

CNB.R3D = R3D;
loadModels().then(() => window.__r3dResolve && window.__r3dResolve(), (e) => { console.error('[3D] erro ao carregar os modelos', e); window.__r3dResolve && window.__r3dResolve(); });
