/* ============================================================
   ZONA CERO — Shooter 3D en primera persona
   HTML + CSS + JS + three.js (sin frameworks)
   ============================================================ */
(function () {
'use strict';

/* ------------------------------------------------------------
   0. Utilidades y configuración
   ------------------------------------------------------------ */
const clamp  = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp   = (a, b, t) => a + (b - a) * t;
const rand   = (a, b) => a + Math.random() * (b - a);
const randInt= (a, b) => Math.floor(rand(a, b + 1));
const damp   = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const $      = (id) => document.getElementById(id);

const CFG = {
  sens: 0.0022,          // sensibilidad del ratón
  turn: 2.7,             // velocidad de giro con ← → (rad/s)
  maxWaves: 3,           // oleadas para ganar la partida
  eye: 1.7,              // altura de los ojos
  radius: 0.42,          // radio de colisión del jugador
  walk: 6.0,
  sprint: 8.8,
  jump: 7.2,
  gravity: 22,
  half: 43,              // semitamaño del recinto
  mag: 30,
  reserveMax: 150,
  fireRate: 0.095,       // segundos entre disparos
  reloadTime: 1.35,
  dmgBody: 30,
  dmgHeadMult: 2.4,
  maxAlive: 16,
};

const ENEMY_TYPES = {
  grunt:  { hp: 45,  speed: 3.4, dmg: 12, range: 1.7, radius: 0.55, scale: 1.0,  color: 0xe0452f, glow: 0xff5533, score: 100, name: 'DROIDE MK-I' },
  runner: { hp: 28,  speed: 6.1, dmg: 8,  range: 1.5, radius: 0.44, scale: 0.85, color: 0xf2a413, glow: 0xffcc33, score: 150, name: 'ACECHADOR' },
  tank:   { hp: 165, speed: 2.1, dmg: 26, range: 2.2, radius: 0.85, scale: 1.45, color: 0x8b46d9, glow: 0xc07bff, score: 300, name: 'COLOSAL' },
};

/* ------------------------------------------------------------
   1. Referencias DOM
   ------------------------------------------------------------ */
const canvas        = $('c');
const elHud         = $('hud');
const elCross       = $('crosshair');
const elHit         = $('hitmarker');
const elDmg         = $('dmg');
const elLowHp       = $('lowhp');
const elBanner      = $('banner');
const elWave        = $('ui-wave');
const elEnemies     = $('ui-enemies');
const elScore       = $('ui-score');
const elMag         = $('ui-mag');
const elReserve     = $('ui-reserve');
const elBest        = $('ui-best');
const elHpFill      = $('health-fill');
const elHpNum       = $('hp-num');
const elReloadNote  = $('reload-note');
const elReloadHint  = $('reload-hint');
const scrStart      = $('screen-start');
const scrPause      = $('screen-pause');
const scrOver       = $('screen-over');
const stScore       = $('st-score');
const stWave        = $('st-wave');
const stKills       = $('st-kills');
const stAcc         = $('st-acc');
const stBest        = $('st-best');
const scrWin        = $('screen-win');
const wScore        = $('w-score');
const wWave         = $('w-wave');
const wKills        = $('w-kills');
const wAcc          = $('w-acc');
const wBest         = $('w-best');

/* ------------------------------------------------------------
   2. Renderizador, escena y cámara
   ------------------------------------------------------------ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x180a07);
scene.fog = new THREE.Fog(0x1c0d09, 35, 115);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------------------------------------
   3. Texturas procedurales
   ------------------------------------------------------------ */
function makeGroundTexture(th) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');

  // suelo (color por escenario)
  g.fillStyle = th.groundBase;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const v = 12 + Math.random() * 34;
    g.fillStyle = 'rgba(' + ((v + 14) | 0) + ',' + ((v + 4) | 0) + ',' + (v | 0) + ',0.55)';
    g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  // manchas de ceniza
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = rand(14, 58);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(8,6,5,0.55)');
    gr.addColorStop(1, 'rgba(8,6,5,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // detalle extra del escenario (placas metálicas del complejo industrial)
  if (th.plate) {
    g.strokeStyle = 'rgba(170,220,230,0.10)';
    g.lineWidth = 2;
    for (let k = 0; k <= 4; k++) {
      g.beginPath(); g.moveTo(k * 128, 0); g.lineTo(k * 128, 512); g.stroke();
      g.beginPath(); g.moveTo(0, k * 128); g.lineTo(512, k * 128); g.stroke();
    }
  }
  // grietas incandescentes (color por escenario)
  g.lineCap = 'round';
  for (let c = 0; c < 16; c++) {
    let x = Math.random() * 512, y = Math.random() * 512;
    let a = Math.random() * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 4 + (Math.random() * 5 | 0);
    for (let s = 0; s < segs; s++) {
      a += rand(-0.9, 0.9);
      x += Math.cos(a) * rand(16, 46);
      y += Math.sin(a) * rand(16, 46);
      g.lineTo(x, y);
    }
    g.strokeStyle = th.crack;
    g.lineWidth = rand(1.4, 3.2);
    g.shadowColor = th.crack;
    g.shadowBlur = th.crackGlow;
    g.stroke();
    g.shadowBlur = 0;
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(22, 22);
  t.anisotropy = 8;
  return t;
}

function makeFlashTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,235,1)');
  grad.addColorStop(0.25, 'rgba(255,205,110,0.95)');
  grad.addColorStop(0.6, 'rgba(255,140,30,0.35)');
  grad.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // estrella
  g.strokeStyle = 'rgba(255,235,180,0.85)';
  g.lineWidth = 5;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.moveTo(64, 64);
    g.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
  }
  g.stroke();
  return new THREE.CanvasTexture(cv);
}

/* ------------------------------------------------------------
   4. Mundo: 4 escenarios temáticos (uno por oleada)
   ------------------------------------------------------------ */
let obstacles         = [];   // { x, z, hw, hd }  -> colisión 2D
let obstacleMeshes = []; // mallas que bloquean la visión de los enemigos
let worldShootables = []; // mallas que bloquean las balas (incluye suelo y muros)
let fires        = [];   // hogueras parpadeantes del escenario activo

const THEMES = [
  {
    name: 'DISTRITO EN RUINAS',   bg: 0x180a07, fog: 0x1c0d09, fogNear: 35, fogFar: 115,
    hemi: 0x8a4a2e, hGround: 0x120806, hInt: 0.18, moon: 0xffb27a, moonInt: 0.5,
    amb: [0xff7a2a, 0xff3d1a, 0xffa02a, 0xff5a1a],
    sun: 0xffffff, stars: 0xffb070, ember: 0xff9038, fire: 0xff8a2a,
    groundBase: '#17110d', crack: 'rgba(255,122,26,0.95)', crackGlow: 12,
    emissive: 0xff5a1a, emissiveInt: 0.32, wall: 0x241e19, trim: 0xff7a1a,
  },
  {
    name: 'COMPLEJO INDUSTRIAL',  bg: 0x090d10, fog: 0x0c1214, fogNear: 30, fogFar: 110,
    hemi: 0x4a8a8a, hGround: 0x05080a, hInt: 0.2, moon: 0x9fd8d8, moonInt: 0.45,
    amb: [0x1faeae, 0x2adf9d, 0x3fd6ff, 0x27d08a],
    sun: 0xbfefff, stars: 0x9fe4e4, ember: 0x52ffc8, fire: 0x2affc8,
    groundBase: '#0b0e10', crack: 'rgba(42,255,190,0.9)', crackGlow: 9,
    emissive: 0x25d88f, emissiveInt: 0.3, wall: 0x131a1c, trim: 0x2affc8, plate: true,
  },
  {
    name: 'DEPÓSITO DE CHATARRA', bg: 0x0d1208, fog: 0x151a0c, fogNear: 33, fogFar: 106,
    hemi: 0x8a8a3a, hGround: 0x0a0c06, hInt: 0.2, moon: 0xd8e8a8, moonInt: 0.45,
    amb: [0xb8c42a, 0x7ab52a, 0xd8d02a, 0x8ac82a],
    sun: 0xeaff9a, stars: 0xd4e490, ember: 0xd8ff4a, fire: 0xd8e63a,
    groundBase: '#131107', crack: 'rgba(212,232,58,0.85)', crackGlow: 10,
    emissive: 0xb4d81a, emissiveInt: 0.3, wall: 0x1b2011, trim: 0xd4e83a,
  },
  {
    name: 'CRÁTER CERO',          bg: 0x190303, fog: 0x240404, fogNear: 26, fogFar: 92,
    hemi: 0x8a2a1a, hGround: 0x0a0202, hInt: 0.22, moon: 0xff8a6a, moonInt: 0.55,
    amb: [0xff3a1a, 0xd81818, 0xff6a2a, 0xff2211],
    sun: 0xff9060, stars: 0xff8878, ember: 0xff5230, fire: 0xff7a3a,
    groundBase: '#150505', crack: 'rgba(255,42,10,0.98)', crackGlow: 16,
    emissive: 0xff2e08, emissiveInt: 0.45, wall: 0x241412, trim: 0xff2e14,
  },
];

const arenas = [];      // { group, obstacles, meshes, shootables, fires }
let currentTheme = -1;
const lightRefs = {};   // hemi, moon, amb[4], sun, stars — tintes por escenario
const WAVE_THEMES = [0, 1, 3];   // arena de cada oleada: Distrito, Industrial, Cráter Cero
function arenaFor(n) {
  return WAVE_THEMES[clamp(n, 1, WAVE_THEMES.length) - 1];
}

function buildWorld() {
  // --- luces globales (recoloreadas por el tema activo) ---
  lightRefs.hemi = new THREE.HemisphereLight(0x8a4a2e, 0x120806, 0.18);
  scene.add(lightRefs.hemi);

  const moon = new THREE.DirectionalLight(0xffb27a, 0.5);
  moon.position.set(34, 52, 22);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const sc = moon.shadow.camera;
  sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55;
  sc.near = 1; sc.far = 140;
  moon.shadow.bias = -0.0012;
  scene.add(moon);
  lightRefs.moon = moon;

  // luces de ambiente (atmósfera)
  const warm = new THREE.PointLight(0xff7a2a, 7, 38, 2);
  warm.position.set(-26, 6, -26);
  scene.add(warm);
  const warm2 = new THREE.PointLight(0xff3d1a, 6, 38, 2);
  warm2.position.set(26, 6, 26);
  scene.add(warm2);
  const cool = new THREE.PointLight(0xffa02a, 7, 40, 2);
  cool.position.set(28, 6, -28);
  scene.add(cool);
  const cool2 = new THREE.PointLight(0xff5a1a, 7, 40, 2);
  cool2.position.set(-28, 6, 28);
  scene.add(cool2);
  lightRefs.amb = [warm, warm2, cool, cool2];

  // linterna suave del jugador
  const lamp = new THREE.PointLight(0xffd9a8, 1.5, 24, 2);
  lamp.position.set(0, 0.1, 0);
  camera.add(lamp);

  // --- cielo: sol muerto y estrellas (tinte por escenario) ---
  const sunTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 8, 128, 128, 126);
    gr.addColorStop(0, 'rgba(255,240,200,1)');
    gr.addColorStop(0.28, 'rgba(255,140,40,0.95)');
    gr.addColorStop(0.55, 'rgba(210,50,20,0.5)');
    gr.addColorStop(1, 'rgba(120,20,10,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(cv);
  })();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
  sun.scale.set(120, 120, 1);
  sun.position.set(-170, 34, -170);
  scene.add(sun);
  lightRefs.sun = sun;

  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.acos(rand(0.05, 1));
    const r = 260;
    starPos[i * 3]     = Math.sin(b) * Math.cos(a) * r;
    starPos[i * 3 + 1] = Math.cos(b) * r + 10;
    starPos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffb070, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.5
  });
  scene.add(new THREE.Points(starGeo, starMat));
  lightRefs.stars = starMat;

  for (let i = 0; i < THEMES.length; i++) buildArena(i);
  applyTheme(0);
}

function buildArena(ti) {
  const th = THEMES[ti];
  const root = new THREE.Group();
  const tObstacles = [], tMeshes = [], tShootables = [], tFires = [];

  function addO(mesh, hw, hd, cl) {
    if (cl !== false) tObstacles.push({ x: mesh.position.x, z: mesh.position.z, hw: hw, hd: hd });
    tMeshes.push(mesh);
    tShootables.push(mesh);
  }

  // --- suelo (variante por escenario) ---
  const gTex = makeGroundTexture(th);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({
      map: gTex, emissiveMap: gTex, emissive: th.emissive, emissiveIntensity: th.emissiveInt,
      roughness: 0.97, metalness: 0.05,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  tShootables.push(ground);

  // --- muros del recinto ---
  const H = CFG.half;
  const wallMat = new THREE.MeshStandardMaterial({ color: th.wall, roughness: 0.95, metalness: 0.1 });
  const trimMat = new THREE.MeshBasicMaterial({ color: th.trim });
  const wallGeo = new THREE.BoxGeometry(H * 2 + 2, 7, 1.4);
  const trimGeo = new THREE.BoxGeometry(H * 2 + 2, 0.16, 0.1);
  [[0, -H, 0], [0, H, Math.PI], [-H, 0, Math.PI / 2], [H, 0, -Math.PI / 2]].forEach(w => {
    const m = new THREE.Mesh(wallGeo, wallMat);
    m.position.set(w[0], 3.5, w[1]);
    m.rotation.y = w[2];
    m.castShadow = true; m.receiveShadow = true;
    root.add(m);
    tShootables.push(m);
    tMeshes.push(m);
    const t = new THREE.Mesh(trimGeo, trimMat);
    t.position.set(w[0], 7.1, w[1]);
    t.rotation.y = w[2];
    root.add(t);
  });

  // --- colocación de obstáculos ---
  const stripe = trimMat;
  function mkBox(w, h, d, mat, x, y, z, ry) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    tShootables.push(m);
    return m;
  }
  function mkCyl(rt, rb, h, seg, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    tShootables.push(m);
    return m;
  }

  const placed = [];
  function free(x, z, hw, hd, gap) {
    if (Math.hypot(x, z) < 7.5) return false;                       // centro libre
    if (Math.hypot(x, z) > 37) return false;                        // no pegado al muro
    for (const o of placed) {
      if (Math.abs(x - o.x) < o.hw + hw + gap && Math.abs(z - o.z) < o.hd + hd + gap) return false;
    }
    return true;
  }
  function place(hw, hd, maker) {
    for (let i = 0; i < 90; i++) {
      const x = rand(-H + 4, H - 4), z = rand(-H + 4, H - 4);
      if (!free(x, z, hw, hd, 3.2)) continue;
      placed.push({ x, z, hw, hd });
      maker(x, z);
      return true;
    }
    return false;
  }

  if (ti === 0) {
    // DISTRITO EN RUINAS: cajas calcinadas, coberturas, bidones y pilares
    const matCrate  = new THREE.MeshStandardMaterial({ color: 0x332c25, roughness: 0.9,  metalness: 0.15 });
    const matCrate2 = new THREE.MeshStandardMaterial({ color: 0x3d3222, roughness: 0.95, metalness: 0.1 });
    const matBlock  = new THREE.MeshStandardMaterial({ color: 0x2e2a25, roughness: 0.98, metalness: 0.05 });
    const matBarrel = new THREE.MeshStandardMaterial({ color: 0x6b2f1c, roughness: 0.7,  metalness: 0.6 });
    const matPillar = new THREE.MeshStandardMaterial({ color: 0x2a241f, roughness: 0.9,  metalness: 0.2 });

    for (let i = 0; i < 11; i++) {
      place(0.95, 0.95, (x, z) => {
        const m = mkBox(1.9, 1.9, 1.9, Math.random() < 0.5 ? matCrate : matCrate2, x, 0.95, z, Math.random() < 0.5 ? 0 : Math.PI / 2);
        addO(m, 0.95, 0.95, true);
        if (Math.random() < 0.45) {
          mkBox(1.6, 1.6, 1.6, matCrate, x + rand(-0.1, 0.1), 2.7, z + rand(-0.1, 0.1), rand(0, Math.PI));
        }
      });
    }
    for (let i = 0; i < 7; i++) {
      place(2.6, 0.8, (x, z) => {
        const horiz = Math.random() < 0.5;
        const m = mkBox(5.2, 2.4, 1.6, matBlock, x, 1.2, z, horiz ? 0 : Math.PI / 2);
        addO(m, horiz ? 2.6 : 0.8, horiz ? 0.8 : 2.6, true);
        const s = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 5.2 : 1.64, 0.1, horiz ? 1.64 : 5.2), stripe);
        s.position.set(x, 2.45, z);
        root.add(s);
      });
    }
    for (let i = 0; i < 7; i++) {
      place(0.6, 0.6, (x, z) => {
        const m = mkCyl(0.58, 0.58, 1.4, 14, matBarrel, x, 0.7, z);
        addO(m, 0.6, 0.6, true);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 14), stripe);
        ring.position.set(x, 0.95, z);
        root.add(ring);
      });
    }
    for (let i = 0; i < 5; i++) {
      place(0.8, 0.8, (x, z) => {
        const m = mkCyl(0.85, 1.0, 7, 12, matPillar, x, 3.5, z);
        addO(m, 0.85, 0.85, true);
      });
    }
  } else if (ti === 1) {
    // COMPLEJO INDUSTRIAL: contenedores, chimeneas, bloques metálicos
    const contCols = [0x8a3b2a, 0x1f6e6e, 0x5a6e1e, 0x6e3a6e];
    const matCont  = new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.6, metalness: 0.35 });
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x2b363a, roughness: 0.5, metalness: 0.6 });
    const matChim  = new THREE.MeshStandardMaterial({ color: 0x232b2e, roughness: 0.7, metalness: 0.5 });
    const matBarrel= new THREE.MeshStandardMaterial({ color: 0x2f5a55, roughness: 0.6, metalness: 0.6 });

    for (let i = 0; i < 8; i++) {
      place(2.6, 1.2, (x, z) => {
        const horiz = Math.random() < 0.5;
        matCont.color.setHex(contCols[i % contCols.length]);
        const m = mkBox(5.2, 2.5, 2.3, matCont.clone(), x, 1.25, z, horiz ? 0 : Math.PI / 2);
        addO(m, horiz ? 2.6 : 1.15, horiz ? 1.15 : 2.6, true);
        const chip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.1), stripe);
        chip.position.set(x + (horiz ? 2.4 : 1.0), 2.35, z + (horiz ? 1.0 : 2.4));
        root.add(chip);
      });
    }
    for (let i = 0; i < 6; i++) {
      place(1.0, 1.0, (x, z) => {
        const m = mkCyl(0.85, 1.0, 7.5, 12, matChim, x, 3.75, z);
        addO(m, 0.95, 0.95, true);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.14, 12), stripe);
        ring.position.set(x, 6.4, z);
        root.add(ring);
      });
    }
    for (let i = 0; i < 5; i++) {
      place(2.6, 0.8, (x, z) => {
        const horiz = Math.random() < 0.5;
        const m = mkBox(5.2, 2.2, 1.6, matMetal, x, 1.1, z, horiz ? 0 : Math.PI / 2);
        addO(m, horiz ? 2.6 : 0.8, horiz ? 0.8 : 2.6, true);
      });
    }
    for (let i = 0; i < 6; i++) {
      place(0.6, 0.6, (x, z) => {
        const m = mkCyl(0.58, 0.58, 1.4, 14, matBarrel, x, 0.7, z);
        addO(m, 0.6, 0.6, true);
      });
    }
  } else if (ti === 2) {
    // DEPÓSITO DE CHATARRA: coches siniestrados, montones de chatarra, grúas
    const carCols  = [0x7a4a26, 0x3c4a5a, 0x5a2a2a, 0x4a5a30];
    const matCar   = new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.75, metalness: 0.4 });
    const matGlass = new THREE.MeshStandardMaterial({ color: 0x20201c, roughness: 0.3, metalness: 0.7 });
    const matWheel = new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 1, metalness: 0.1 });
    const matJunk  = new THREE.MeshStandardMaterial({ color: 0x4a4033, roughness: 1, metalness: 0.2 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x33301f, roughness: 0.85, metalness: 0.45 });
    const matBarrel= new THREE.MeshStandardMaterial({ color: 0x5a5a1c, roughness: 0.7, metalness: 0.6 });

    for (let i = 0; i < 6; i++) {
      place(2.2, 1.2, (x, z) => {
        const horiz = Math.random() < 0.5;
        const ry = horiz ? 0 : Math.PI / 2;
        matCar.color.setHex(carCols[i % carCols.length]);
        mkBox(4.0, 0.9, 1.8, matCar, x, 0.55, z, ry);
        mkBox(1.9, 0.7, 1.6, matGlass, x, 1.25, z, ry);
        const wg = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10);
        for (const sq of [-1.3, 1.3]) for (const sd of [-0.95, 0.95]) {
          const w = new THREE.Mesh(wg, matWheel);
          w.rotation.x = horiz ? Math.PI / 2 : 0;
          w.rotation.z = horiz ? 0 : Math.PI / 2;
          w.position.set(horiz ? x + sq : x + sd, 0.3, horiz ? z + sd : z + sq);
          root.add(w);
        }
        tObstacles.push({ x: x, z: z, hw: horiz ? 2.1 : 1.0, hd: horiz ? 1.0 : 2.1 });
      });
    }
    for (let i = 0; i < 6; i++) {
      place(1.3, 1.3, (x, z) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 1.7, 1.5, 7), matJunk);
        m.position.set(x, 0.75, z);
        m.rotation.y = rand(0, Math.PI * 2);
        m.castShadow = m.receiveShadow = true;
        root.add(m);
        tShootables.push(m);
        tObstacles.push({ x: x, z: z, hw: 1.1, hd: 1.1 });
      });
    }
    for (let i = 0; i < 4; i++) {
      place(0.75, 0.75, (x, z) => {
        const m = mkBox(0.7, 7, 0.7, matSteel, x, 3.5, z, 0);
        addO(m, 0.7, 0.7, true);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.4), stripe);
        arm.position.set(x, 6.3, z);
        root.add(arm);
      });
    }
    for (let i = 0; i < 7; i++) {
      place(0.6, 0.6, (x, z) => {
        const m = mkCyl(0.58, 0.58, 1.4, 14, matBarrel, x, 0.7, z);
        addO(m, 0.6, 0.6, true);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 14), stripe);
        ring.position.set(x, 0.95, z);
        root.add(ring);
      });
    }
  } else {
    // CRÁTER CERO: rocas fundidas, pilares de basalto, cráteres humeantes
    const matRock  = new THREE.MeshStandardMaterial({ color: 0x241616, roughness: 1, metalness: 0.05 });
    const matBase  = new THREE.MeshStandardMaterial({ color: 0x1b1010, roughness: 0.95, metalness: 0.1 });
    const matCrat  = new THREE.MeshStandardMaterial({ color: 0x120404, roughness: 1, metalness: 0 });
    const matGlowR = new THREE.MeshBasicMaterial({ color: 0xff2e08, transparent: true, opacity: 0.35 });
    const matBarrel= new THREE.MeshStandardMaterial({ color: 0x401a12, roughness: 0.7, metalness: 0.6 });

    for (let i = 0; i < 9; i++) {
      place(1.0, 1.0, (x, z) => {
        const r = rand(0.8, 1.25);
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r), matRock);
        m.position.set(x, r * 0.55, z);
        m.scale.y = 0.75;
        m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
        m.castShadow = m.receiveShadow = true;
        root.add(m);
        tShootables.push(m);
        tObstacles.push({ x: x, z: z, hw: r * 0.9, hd: r * 0.9 });
      });
    }
    for (let i = 0; i < 6; i++) {
      place(0.9, 0.9, (x, z) => {
        const h = rand(4.2, 6.8);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.95, h, 6), matBase);
        m.position.set(x, h / 2, z);
        m.rotation.z = rand(-0.07, 0.07);
        m.rotation.x = rand(-0.07, 0.07);
        m.castShadow = m.receiveShadow = true;
        root.add(m);
        tShootables.push(m);
        tObstacles.push({ x: x, z: z, hw: 0.8, hd: 0.8 });
      });
    }
    for (let i = 0; i < 5; i++) {
      place(2.9, 2.9, (x, z) => {
        const r = rand(2.2, 3.2);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.07, 20), matCrat);
        disc.position.set(x, 0.035, z);
        disc.receiveShadow = true;
        root.add(disc);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.05, 18), matGlowR);
        ring.position.set(x, 0.06, z);
        root.add(ring);
      });
    }
    for (let i = 0; i < 4; i++) {
      place(0.6, 0.6, (x, z) => {
        const m = mkCyl(0.58, 0.58, 1.4, 14, matBarrel, x, 0.7, z);
        addO(m, 0.6, 0.6, true);
      });
    }
  }

  // --- hogueras (bidones ardiendo) en las esquinas ---
  const fireMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.8, metalness: 0.5 });
  const emberGlow = new THREE.MeshBasicMaterial({ color: th.fire });
  [[27.6, 27.6], [-27.6, 27.6], [27.6, -27.6], [-27.6, -27.6]].forEach(p => {
    const b = mkCyl(0.6, 0.6, 1.4, 14, fireMat, p[0], 0.7, p[1]);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.1, 14), emberGlow);
    top.position.set(p[0], 1.44, p[1]);
    root.add(top);
    const light = new THREE.PointLight(th.fire, 7, 24, 2);
    light.position.set(p[0], 2.0, p[1]);
    root.add(light);
    tFires.push({ x: p[0], z: p[1], light: light, phase: rand(0, 10) });
    addO(b, 0.6, 0.6, true);
  });

  scene.add(root);
  root.visible = false;
  arenas[ti] = { group: root, obstacles: tObstacles, meshes: tMeshes, shootables: tShootables, fires: tFires };
}

function applyTheme(i) {
  if (i === currentTheme) return;
  currentTheme = i;
  const th = THEMES[i];
  for (let k = 0; k < arenas.length; k++) arenas[k].group.visible = (k === i);

  scene.background.setHex(th.bg);
  scene.fog.color.setHex(th.fog);
  scene.fog.near = th.fogNear;
  scene.fog.far = th.fogFar;

  lightRefs.hemi.color.setHex(th.hemi);
  lightRefs.hemi.groundColor.setHex(th.hGround);
  lightRefs.hemi.intensity = th.hInt;
  lightRefs.moon.color.setHex(th.moon);
  lightRefs.moon.intensity = th.moonInt;
  for (let k = 0; k < 4; k++) lightRefs.amb[k].color.setHex(th.amb[k]);
  lightRefs.sun.material.color.setHex(th.sun);
  lightRefs.stars.color.setHex(th.stars);
  Embers.setColor(th.ember);

  const a = arenas[i];
  obstacles = a.obstacles;
  obstacleMeshes = a.meshes;
  worldShootables = a.shootables;
  fires = a.fires;

  // si alguien quedó atrapado en la geometría nueva, se empuja fuera
  collide(player.pos, CFG.radius);
  for (const e of enemies) if (e.state === 'alive') collide(e.pos, e.cfg.radius);
}

let fadeTimerA = null, fadeTimerB = null;
function enterArena(n) {
  const idx = arenaFor(n);
  if (idx === currentTheme) return;
  const el = document.getElementById('fade');
  if (!el) { applyTheme(idx); return; }
  el.style.opacity = '1';
  clearTimeout(fadeTimerA); clearTimeout(fadeTimerB);
  fadeTimerA = setTimeout(function () {
    applyTheme(idx);
    fadeTimerB = setTimeout(function () { el.style.opacity = '0'; }, 140);
  }, 240);
}

/* ------------------------------------------------------------
   5. Sistema de partículas (puntos aditivos)
   ------------------------------------------------------------ */
const Particles = (() => {
  const MAX = 900;
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const base = new Float32Array(MAX * 3);
  let count = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.14, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  function spawn(p, color, n, speed, up) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n && count < MAX; k++) {
      const i = count++;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      const a = Math.random() * Math.PI * 2, e = rand(-0.6, 1);
      const s = speed * rand(0.35, 1);
      vel[i * 3]     = Math.cos(a) * s * (1 - Math.abs(e) * 0.5);
      vel[i * 3 + 1] = (up === undefined ? 1 : up) * rand(0.5, 1) * s * 0.7 + e * s * 0.4;
      vel[i * 3 + 2] = Math.sin(a) * s * (1 - Math.abs(e) * 0.5);
      maxLife[i] = life[i] = rand(0.3, 0.75);
      base[i * 3] = c.r; base[i * 3 + 1] = c.g; base[i * 3 + 2] = c.b;
    }
  }

  function removeAt(i) {
    const last = --count;
    if (i !== last) {
      for (let k = 0; k < 3; k++) {
        pos[i * 3 + k] = pos[last * 3 + k];
        col[i * 3 + k] = col[last * 3 + k];
        vel[i * 3 + k] = vel[last * 3 + k];
        base[i * 3 + k] = base[last * 3 + k];
      }
      life[i] = life[last]; maxLife[i] = maxLife[last];
    }
  }

  function update(dt) {
    for (let i = count - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) { removeAt(i); continue; }
      vel[i * 3 + 1] -= 11 * dt;
      pos[i * 3]     += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.3; vel[i * 3] *= 0.6; vel[i * 3 + 2] *= 0.6; }
      const f = life[i] / maxLife[i];
      col[i * 3] = base[i * 3] * f;
      col[i * 3 + 1] = base[i * 3 + 1] * f;
      col[i * 3 + 2] = base[i * 3 + 2] * f;
    }
    geo.setDrawRange(0, count);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  function clear() { count = 0; geo.setDrawRange(0, 0); }

  return { spawn, update, clear };
})();

/* ------------------------------------------------------------
   5b. Brasas del ambiente y hogueras
   ------------------------------------------------------------ */
const Embers = (() => {
  const N = 240;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const phase = new Float32Array(N);

  function reset(i, initial) {
    pos[i * 3] = rand(-CFG.half, CFG.half);
    pos[i * 3 + 1] = initial ? rand(0, 12) : -0.3;
    pos[i * 3 + 2] = rand(-CFG.half, CFG.half);
    vel[i * 3] = rand(-0.2, 0.2);
    vel[i * 3 + 1] = rand(0.2, 0.75);
    vel[i * 3 + 2] = rand(-0.2, 0.2);
    phase[i] = rand(0, 10);
  }
  for (let i = 0; i < N; i++) reset(i, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xff9038, size: 0.1, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  let t = 0;
  function update(dt) {
    t += dt;
    for (let i = 0; i < N; i++) {
      pos[i * 3]     += (vel[i * 3] + Math.sin(t * 1.3 + phase[i]) * 0.25) * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(t * 1.1 + phase[i]) * 0.25) * dt;
      if (pos[i * 3 + 1] > 13) reset(i, false);
    }
    geo.attributes.position.needsUpdate = true;
  }

  return { update: update, setColor: function (c) { mat.color.setHex(c); } };
})();

// parpadeo de las hogueras + chispas
const _firePos = new THREE.Vector3();
function updateFires(dt) {
  for (let i = 0; i < fires.length; i++) {
    const f = fires[i];
    const t = gameTime * 9 + f.phase;
    f.light.intensity = 6 + Math.sin(t) * 1.5 + Math.sin(t * 2.7) * 0.9 + Math.random() * 0.9;
    if (Math.random() < dt * 30) {
      _firePos.set(f.x + rand(-0.3, 0.3), 1.5, f.z + rand(-0.3, 0.3));
      Particles.spawn(_firePos, Math.random() < 0.5 ? 0xff9a2a : 0xffd06a, 2, 2.4, 1.7);
    }
  }
}

/* ------------------------------------------------------------
   6. Trazadores de bala
   ------------------------------------------------------------ */
const Tracers = (() => {
  const pool = [];
  const geo = new THREE.BoxGeometry(0.022, 0.022, 1);
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xfff0b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.visible = false;
    scene.add(m);
    pool.push({ mesh: m, life: 0 });
  }
  let idx = 0;

  function fire(from, to) {
    const t = pool[idx = (idx + 1) % pool.length];
    const dir = new THREE.Vector3().subVectors(to, from);
    const dist = dir.length();
    if (dist < 0.2) return;
    dir.normalize();
    t.mesh.visible = true;
    t.mesh.position.copy(from).addScaledVector(dir, dist * 0.5);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, dist);
    t.mesh.material.opacity = 0.85;
    t.life = 0.07;
  }

  function update(dt) {
    for (const t of pool) {
      if (t.life > 0) {
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
        if (t.life <= 0) t.mesh.visible = false;
      }
    }
  }

  return { fire, update };
})();

/* ------------------------------------------------------------
   7. Audio sintetizado con WebAudio
   ------------------------------------------------------------ */
const Sfx = (() => {
  let ctx = null, master = null, noiseBuf = null;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  function resume() { if (ctx && ctx.state !== 'running') ctx.resume().catch(function () {}); }

  function noise(t, dur, v, type, freq, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.03);
  }

  function tone(t, dur, v, type, f0, f1) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  const guard = (fn) => function () { if (!ctx) return; fn.apply(null, arguments); };
  const T = () => ctx.currentTime;

  return {
    init, resume,
    shot: guard(function () {
      const t = T();
      noise(t, 0.13, 0.55, 'bandpass', 1100 + Math.random() * 500, 0.7);
      noise(t, 0.05, 0.4, 'highpass', 3000, 1);
      tone(t, 0.11, 0.42, 'square', 170, 48);
    }),
    dry: guard(function () { const t = T(); noise(t, 0.05, 0.22, 'bandpass', 2400, 3); }),
    reloadA: guard(function () { const t = T(); noise(t, 0.06, 0.3, 'bandpass', 900, 4); tone(t, 0.05, 0.2, 'square', 320, 160); }),
    reloadB: guard(function () { const t = T(); noise(t, 0.07, 0.35, 'bandpass', 1500, 4); tone(t, 0.06, 0.25, 'square', 520, 240); }),
    hit: guard(function () { const t = T(); tone(t, 0.06, 0.28, 'sine', 880, 620); }),
    head: guard(function () { const t = T(); tone(t, 0.09, 0.34, 'sine', 1500, 900); noise(t, 0.06, 0.2, 'highpass', 4000, 1); }),
    kill: guard(function () { const t = T(); tone(t, 0.22, 0.3, 'sawtooth', 340, 70); noise(t, 0.18, 0.25, 'lowpass', 900, 1); }),
    death: guard(function () { const t = T(); tone(t, 0.4, 0.3, 'sawtooth', 220, 42); noise(t, 0.35, 0.25, 'lowpass', 700, 1); }),
    hurt: guard(function () { const t = T(); noise(t, 0.28, 0.5, 'lowpass', 420, 1); tone(t, 0.2, 0.35, 'square', 110, 55); }),
    swipe: guard(function () { const t = T(); noise(t, 0.16, 0.28, 'bandpass', 500, 1.4); }),
    step: guard(function () { const t = T(); noise(t, 0.07, 0.09, 'lowpass', 480, 1); }),
    pickup: guard(function () { const t = T(); tone(t, 0.09, 0.25, 'sine', 620, 980); tone(t + 0.08, 0.13, 0.22, 'sine', 980, 1480); }),
    waveStart: guard(function () {
      const t = T();
      tone(t, 0.5, 0.22, 'sawtooth', 110, 160);
      tone(t + 0.12, 0.45, 0.2, 'sawtooth', 165, 220);
      tone(t + 0.24, 0.6, 0.22, 'sawtooth', 220, 330);
    }),
    waveClear: guard(function () {
      const t = T();
      tone(t, 0.2, 0.22, 'sine', 523, 0);
      tone(t + 0.12, 0.2, 0.22, 'sine', 659, 0);
      tone(t + 0.24, 0.4, 0.24, 'sine', 784, 0);
    }),
    win: guard(function () {
      const t = T();
      const notes = [523, 659, 784, 1046];
      for (let i = 0; i < notes.length; i++) tone(t + i * 0.16, 0.55, 0.24, 'sine', notes[i], 0);
      tone(t, 0.9, 0.18, 'triangle', 130, 65);
      noise(t, 0.5, 0.2, 'lowpass', 600, 1);
    }),
  };
})();

/* ------------------------------------------------------------
   8. Colisiones (círculo vs cajas AABB en el plano XZ)
   ------------------------------------------------------------ */
function collide(pos, r) {
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const cx = clamp(pos.x, o.x - o.hw, o.x + o.hw);
    const cz = clamp(pos.z, o.z - o.hd, o.z + o.hd);
    let dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-7) {
        const penX = o.hw + r - Math.abs(pos.x - o.x);
        const penZ = o.hd + r - Math.abs(pos.z - o.z);
        if (penX < penZ) pos.x = o.x + (pos.x >= o.x ? 1 : -1) * (o.hw + r);
        else pos.z = o.z + (pos.z >= o.z ? 1 : -1) * (o.hd + r);
      } else {
        const d = Math.sqrt(d2), push = (r - d) / d;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
  }
  const lim = CFG.half - r;
  pos.x = clamp(pos.x, -lim, lim);
  pos.z = clamp(pos.z, -lim, lim);
}

/* ------------------------------------------------------------
   9. Recogibles (salud y munición)
   ------------------------------------------------------------ */
const pickups = [];
const pickupGeoA = new THREE.BoxGeometry(0.72, 0.24, 0.24);
const pickupGeoB = new THREE.BoxGeometry(0.24, 0.72, 0.24);
const pickupGeoC = new THREE.BoxGeometry(0.52, 0.36, 0.36);
const matHealth = new THREE.MeshStandardMaterial({ color: 0x2bff88, emissive: 0x1fdc6a, emissiveIntensity: 1.1, roughness: 0.35 });
const matAmmo   = new THREE.MeshStandardMaterial({ color: 0xffc23b, emissive: 0xff9a1f, emissiveIntensity: 0.9, roughness: 0.4 });
const matDark   = new THREE.MeshBasicMaterial({ color: 0x101820 });

function dropPickup(type, x, z) {
  const g = new THREE.Group();
  if (type === 'health') {
    g.add(new THREE.Mesh(pickupGeoA, matHealth));
    g.add(new THREE.Mesh(pickupGeoB, matHealth));
  } else {
    g.add(new THREE.Mesh(pickupGeoC, matAmmo));
    for (let i = -1; i <= 1; i += 2) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.38), matDark);
      s.position.x = i * 0.14;
      g.add(s);
    }
  }
  g.position.set(x, 0.75, z);
  scene.add(g);
  pickups.push({ g: g, type: type, life: 22, t: Math.random() * 6 });
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    p.t += dt;
    p.g.rotation.y += dt * 2.2;
    p.g.position.y = 0.75 + Math.sin(p.t * 3) * 0.12;
    if (p.life < 4) p.g.visible = Math.floor(p.life * 8) % 2 === 0;

    const d = Math.hypot(player.pos.x - p.g.position.x, player.pos.z - p.g.position.z);
    if (d < 1.5) {
      if (p.type === 'health') {
        if (player.hp >= player.maxHp) continue;
        player.hp = Math.min(player.maxHp, player.hp + 25);
        Particles.spawn(p.g.position, 0x2bff88, 14, 4);
      } else {
        if (weapon.reserve >= CFG.reserveMax) continue;
        weapon.reserve = Math.min(CFG.reserveMax, weapon.reserve + 40);
        Particles.spawn(p.g.position, 0xffc23b, 14, 4);
      }
      Sfx.pickup();
      scene.remove(p.g);
      pickups.splice(i, 1);
      continue;
    }
    if (p.life <= 0) { scene.remove(p.g); pickups.splice(i, 1); }
  }
}

function clearPickups() {
  for (const p of pickups) scene.remove(p.g);
  pickups.length = 0;
}

/* ------------------------------------------------------------
   10. Enemigos
   ------------------------------------------------------------ */
const enemies = [];
const probeRay = new THREE.Raycaster();

function buildEnemyMesh(cfg) {
  const s = cfg.scale;
  const g = new THREE.Group();
  const body = new THREE.Group();     // grupo intermedio (para la animación de muerte)
  g.add(body);

  // chasis metálico con calor de combate (para el destello de impacto)
  const metal = new THREE.MeshStandardMaterial({
    color: 0x1e2126, roughness: 0.55, metalness: 0.5,
    emissive: 0xff5a2a, emissiveIntensity: 0.05,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.7, metalness: 0.5 });
  const accent = new THREE.MeshStandardMaterial({
    color: cfg.color, roughness: 0.5, metalness: 0.4,
    emissive: cfg.glow, emissiveIntensity: 0.55,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: cfg.glow });

  // --- torso: pecho blindado ---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62 * s, 0.6 * s, 0.42 * s), metal);
  torso.position.y = 1.12 * s;
  body.add(torso);

  // núcleo de energía (pecho)
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.17 * s, 0.07 * s), eyeMat);
  core.position.set(0, 1.13 * s, 0.22 * s);
  body.add(core);

  // placa frontal inclinada
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.16 * s, 0.1 * s), accent);
  plate.position.set(0, 1.32 * s, 0.22 * s);
  plate.rotation.x = -0.3;
  body.add(plate);

  // cadera
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.44 * s, 0.22 * s, 0.3 * s), dark);
  hips.position.y = 0.76 * s;
  body.add(hips);

  // --- cabeza ---
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32 * s, 0.26 * s, 0.3 * s), metal);
  head.position.y = 1.6 * s;
  body.add(head);

  // visor óptico (un solo ojo robotico)
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.075 * s, 12, 10), eyeMat);
  visor.position.set(0, 1.6 * s, 0.16 * s);
  body.add(visor);

  // antena con piloto
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.28 * s, 6), dark);
  antenna.position.set(0.11 * s, 1.84 * s, -0.05 * s);
  body.add(antenna);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.032 * s, 8, 6), eyeMat);
  tip.position.set(0.11 * s, 1.98 * s, -0.05 * s);
  body.add(tip);

  // --- articulaciones de hombro ---
  for (const sx of [-1, 1]) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.13 * s, 0.17 * s, 10), dark);
    sh.rotation.z = Math.PI / 2;
    sh.position.set(sx * 0.4 * s, 1.32 * s, 0);
    body.add(sh);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.1 * s, 0.32 * s), accent);
    pad.position.set(sx * 0.42 * s, 1.44 * s, 0);
    body.add(pad);
  }

  // --- brazos (brazo mecánico con pinza) ---
  function buildArm(sx) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.42 * s, 1.3 * s, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, 0.36 * s, 0.13 * s), metal);
    upper.position.y = -0.18 * s;
    pivot.add(upper);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.075 * s, 8, 6), dark);
    elbow.position.y = -0.36 * s;
    pivot.add(elbow);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.3 * s, 0.11 * s), accent);
    lower.position.y = -0.52 * s;
    pivot.add(lower);
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.17 * s, 0.1 * s, 0.15 * s), dark);
    claw.position.y = -0.71 * s;
    pivot.add(claw);
    body.add(pivot);
    return pivot;
  }
  const armL = buildArm(-1);
  const armR = buildArm(1);

  // --- piernas (actuadores con rodilla) ---
  function buildLeg(sx) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.17 * s, 0.72 * s, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.15 * s, 0.34 * s, 0.16 * s), metal);
    thigh.position.y = -0.17 * s;
    pivot.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.08 * s, 8, 6), dark);
    knee.position.y = -0.34 * s;
    pivot.add(knee);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, 0.3 * s, 0.14 * s), dark);
    shin.position.y = -0.5 * s;
    pivot.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.08 * s, 0.27 * s), metal);
    foot.position.set(0, -0.66 * s, 0.04 * s);
    pivot.add(foot);
    body.add(pivot);
    return pivot;
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  body.traverse(o => { if (o.isMesh) { o.castShadow = true; } });

  return {
    group: g, body: body, head: head, visor: visor,
    armL: armL, armR: armR, legL: legL, legR: legR,
    materials: [metal, accent], headParts: [head, visor, antenna, tip],
  };
}

class Enemy {
  constructor(type, pos) {
    this.type = type;
    this.cfg = ENEMY_TYPES[type];
    this.hp = this.cfg.hp;
    this.pos = pos.clone();
    this.state = 'alive';

    const built = buildEnemyMesh(this.cfg);
    this.mesh = built.group;
    this.body = built.body;
    this.armL = built.armL; this.armR = built.armR;
    this.legL = built.legL; this.legR = built.legR;
    this.materials = built.materials;
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = rand(0, Math.PI * 2);

    const self = this;
    this.mesh.traverse(function (o) {
      if (o.isMesh) { o.userData.enemy = self; o.userData.part = 'body'; }
    });
    built.headParts.forEach(function (m) { m.userData.part = 'head'; });

    this.attackCd = rand(0.4, 1.1);
    this.attackAnim = 0;
    this.flash = 0;
    this.deathT = 0;
    this.strafe = 0;
    this.avoidT = 0;
    this.stuckT = 0;
    this.walkT = rand(0, 6);
    this.lastHead = false;
    this.prevX = pos.x; this.prevZ = pos.z;

    scene.add(this.mesh);
    Particles.spawn(pos.clone().setY(0.9), this.cfg.glow, 18, 4);
  }

  probe(dx, dz) {
    probeRay.ray.origin.set(this.pos.x, 0.9 * this.cfg.scale, this.pos.z);
    probeRay.ray.direction.set(dx, 0, dz);
    probeRay.near = 0;
    probeRay.far = 2.6;
    return probeRay.intersectObjects(obstacleMeshes, false).length > 0;
  }

  hurt(amount, part, point) {
    if (this.state !== 'alive') return;
    const head = part === 'head';
    this.lastHead = head;
    this.hp -= amount;
    this.flash = 0.1;
    if (head) Sfx.head(); else Sfx.hit();
    Particles.spawn(point, head ? 0xffe6a8 : this.cfg.glow, head ? 12 : 7, 5);
    showHitmarker(head ? '#ffd257' : '#ffffff');
    if (this.hp <= 0) this.die();
  }

  die(headshot) {
    this.state = 'dying';
    this.deathT = 0;
    score += this.cfg.score + (this.lastHead ? 75 : 0);
    kills++;
    Sfx.death();
    const c = this.mesh.position.clone(); c.y = 1.1 * this.cfg.scale;
    Particles.spawn(c, this.cfg.glow, 34, 8);
    Particles.spawn(c, 0xfff2c0, 10, 6);

    if (pickups.length < 7) {
      const r = Math.random();
      const dropAmmo = weapon.reserve < 30 ? 0.42 : 0.2;      // más munición si vas escaso
      const dropHealth = player.hp < 45 ? 0.28 : 0.14;        // más salud si estás herido
      if (r < dropHealth) dropPickup('health', this.pos.x, this.pos.z);
      else if (r < dropHealth + dropAmmo) dropPickup('ammo', this.pos.x, this.pos.z);
    }
  }

  update(dt) {
    if (this.state === 'dying') {
      this.deathT += dt;
      const t = clamp(this.deathT / 0.5, 0, 1);
      this.body.rotation.x = -t * Math.PI * 0.5;
      this.mesh.position.y = this.pos.y - t * 0.25;
      if (this.deathT > 1.5) {
        Particles.spawn(this.mesh.position.clone().setY(0.4), this.cfg.color, 12, 3);
        this.dispose();
      }
      return;
    }

    const cfg = this.cfg;
    this.flash = Math.max(0, this.flash - dt);
    const glow = this.flash > 0 ? 1.4 : 0.05;
    this.materials[0].emissiveIntensity = glow;

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz) || 0.0001;
    let dirX = dx / dist, dirZ = dz / dist;

    // separación entre enemigos
    for (const e of enemies) {
      if (e === this || e.state !== 'alive') continue;
      const ox = this.pos.x - e.pos.x, oz = this.pos.z - e.pos.z;
      const d = Math.hypot(ox, oz);
      const minR = cfg.radius + e.cfg.radius;
      if (d > 0.001 && d < minR) {
        const push = (minR - d) / d * 0.5;
        this.pos.x += ox * push;
        this.pos.z += oz * push;
      }
    }

    // esquivar obstáculos
    this.avoidT -= dt;
    if (this.avoidT <= 0) {
      if (this.probe(dirX, dirZ)) {
        const leftX = dirZ, leftZ = -dirX;   // 90° izquierda
        const clearL = !this.probe(leftX, leftZ);
        const clearR = !this.probe(-leftX, -leftZ);
        if (clearL && !clearR) this.strafe = 1;
        else if (clearR && !clearL) this.strafe = -1;
        else this.strafe = Math.random() < 0.5 ? 1 : -1;
        this.avoidT = 0.7;
      } else {
        this.strafe = 0;
      }
    }
    if (this.strafe !== 0) {
      const ang = this.strafe * 1.15;
      const c = Math.cos(ang), s = Math.sin(ang);
      const nx = dirX * c - dirZ * s;
      const nz = dirX * s + dirZ * c;
      dirX = nx; dirZ = nz;
    }

    // ataque
    this.attackCd -= dt;
    this.attackAnim = Math.max(0, this.attackAnim - dt);
    const attacking = dist <= cfg.range + CFG.radius;
    if (attacking && this.attackCd <= 0) {
      this.attackCd = 1.15;
      this.attackAnim = 0.34;
      Sfx.swipe();
      damagePlayer(cfg.dmg, this.pos);
    }

    // movimiento
    let speed = 0;
    if (!attacking || dist > cfg.range) {
      speed = cfg.speed;
      this.pos.x += dirX * speed * dt;
      this.pos.z += dirZ * speed * dt;
    }
    collide(this.pos, cfg.radius);

    // detección de atasco
    this.stuckT += dt;
    if (this.stuckT > 0.45) {
      const moved = Math.hypot(this.pos.x - this.prevX, this.pos.z - this.prevZ);
      if (moved < cfg.speed * this.stuckT * 0.35 && speed > 0) {
        this.strafe = this.strafe === 0 ? (Math.random() < 0.5 ? 1 : -1) : -this.strafe;
        this.avoidT = 0.8;
      }
      this.prevX = this.pos.x; this.prevZ = this.pos.z;
      this.stuckT = 0;
    }

    // orientación y animación
    this.mesh.rotation.y = Math.atan2(dx, dz);
    this.walkT += dt * (speed > 0 ? cfg.speed * 1.7 : 2);
    const swing = Math.sin(this.walkT) * (speed > 0 ? 0.75 : 0.1);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    const lift = this.attackAnim > 0 ? Math.sin((0.34 - this.attackAnim) / 0.34 * Math.PI) * 1.9 : 0;
    this.armL.rotation.x = -swing * 0.75 - lift;
    this.armR.rotation.x = swing * 0.75 - lift;
    this.mesh.position.set(this.pos.x, (speed > 0 ? Math.abs(Math.sin(this.walkT)) * 0.06 : 0), this.pos.z);
  }

  dispose() {
    scene.remove(this.mesh);
    const i = enemies.indexOf(this);
    if (i >= 0) enemies.splice(i, 1);
  }
}

function clearEnemies() {
  for (const e of enemies) scene.remove(e.mesh);
  enemies.length = 0;
}

/* ------------------------------------------------------------
   11. Arma del jugador
   ------------------------------------------------------------ */
const weapon = new THREE.Group();
camera.add(weapon);
weapon.position.set(0.3, -0.3, -0.55);

const wState = {
  mag: CFG.mag,
  reserve: 120,
  heat: 0,
  reloadT: 0,
  reloadSnd: 0,
  recoil: 0,
  flashT: 0,
  lastShot: -10,
};

let muzzle, flashPlane, flashLight;

function buildWeapon() {
  const matGun  = new THREE.MeshStandardMaterial({ color: 0x23282f, roughness: 0.45, metalness: 0.85 });
  const matGun2 = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.6, metalness: 0.7 });
  const matAcc  = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff7a1a, emissiveIntensity: 0.75, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.52), matGun);
  weapon.add(body);

  const top = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.4), matGun2);
  top.position.set(0, 0.085, -0.05);
  weapon.add(top);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.34), matAcc);
  strip.position.set(0.057, 0.03, -0.06);
  weapon.add(strip);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.34, 12), matGun2);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -0.42);
  weapon.add(barrel);

  const muzzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.09, 12), matGun);
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.01, -0.6);
  weapon.add(muzzleTip);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.11), matGun2);
  grip.position.set(0, -0.14, 0.13);
  grip.rotation.x = -0.28;
  weapon.add(grip);

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), matGun2);
  mag.position.set(0, -0.13, -0.08);
  mag.rotation.x = 0.12;
  weapon.add(mag);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.03), matAcc);
  sight.position.set(0, 0.12, -0.18);
  weapon.add(sight);

  weapon.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });

  muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.01, -0.66);
  weapon.add(muzzle);

  flashPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({
      map: makeFlashTexture(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    })
  );
  flashPlane.position.set(0, 0.01, -0.7);
  flashPlane.rotation.y = Math.PI;
  flashPlane.visible = false;
  flashPlane.renderOrder = 999;
  weapon.add(flashPlane);

  flashLight = new THREE.PointLight(0xffb04d, 0, 14, 2);
  flashLight.position.set(0, 0.02, -0.68);
  weapon.add(flashLight);
}
buildWeapon();

function startReload() {
  if (state !== 'playing') return;
  if (wState.reloadT > 0 || wState.mag >= CFG.mag || wState.reserve <= 0) return;
  wState.reloadT = CFG.reloadTime;
  wState.reloadSnd = 0.55;
  Sfx.reloadA();
}

function finishReload() {
  const need = CFG.mag - wState.mag;
  const take = Math.min(need, wState.reserve);
  wState.mag += take;
  wState.reserve -= take;
}

function updateWeapon(dt) {
  if (wState.reloadT > 0) {
    wState.reloadT -= dt;
    wState.reloadSnd -= dt;
    if (wState.reloadSnd <= 0) Sfx.reloadB();
    if (wState.reloadT <= 0) { wState.reloadT = 0; finishReload(); }
  }

  wState.heat = Math.max(0, wState.heat - dt * 1.5);
  wState.recoil = damp(wState.recoil, 0, 13, dt);
  pitchKick = damp(pitchKick, 0, 9, dt);

  // animación de recarga (baja y gira)
  let reloadDip = 0, reloadRot = 0;
  if (wState.reloadT > 0) {
    const p = 1 - wState.reloadT / CFG.reloadTime;
    const k = Math.sin(p * Math.PI);
    reloadDip = k * 0.17;
    reloadRot = k * 0.7;
  }

  // balanceo por movimiento y retorcedor del ratón
  const moveF = clamp(Math.hypot(player.vel.x, player.vel.z) / CFG.walk, 0, 1.5);
  bobT += dt * (8 + moveF * 6);
  const bobY = Math.sin(bobT * 2) * 0.013 * moveF;
  const bobX = Math.sin(bobT) * 0.016 * moveF;

  swayX = damp(swayX, clamp(mouseDX * 0.0007, -0.05, 0.05), 8, dt);
  swayY = damp(swayY, clamp(mouseDY * 0.0007, -0.05, 0.05), 8, dt);
  mouseDX = 0; mouseDY = 0;

  weapon.position.set(0.3 + bobX + swayX, -0.3 + bobY - swayY - reloadDip, -0.55 + wState.recoil);
  weapon.rotation.set(-swayY * 1.6 - wState.recoil * 2.4 + reloadRot, swayX * 1.6, bobX * 0.8 + reloadRot * 0.35);

  // fogonazo
  if (wState.flashT > 0) {
    wState.flashT -= dt;
    const on = wState.flashT > 0;
    flashPlane.visible = on;
    flashLight.intensity = on ? 9 : 0;
    if (on) {
      const s = rand(0.75, 1.3);
      flashPlane.scale.set(s, s, s);
      flashPlane.rotation.z = rand(0, Math.PI * 2);
    }
  } else {
    flashPlane.visible = false;
    flashLight.intensity = 0;
  }
}

/* ------------------------------------------------------------
   12. Disparo
   ------------------------------------------------------------ */
const shootRay = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

function shoot() {
  if (state !== 'playing' || wState.reloadT > 0) return;
  const now = gameTime;
  if (now - wState.lastShot < CFG.fireRate) return;
  if (wState.mag <= 0) {
    wState.lastShot = now;
    Sfx.dry();
    if (wState.reserve > 0) startReload();
    return;
  }

  wState.lastShot = now;
  wState.mag--;
  wState.heat = Math.min(1, wState.heat + 0.16);
  wState.recoil = Math.min(0.14, wState.recoil + 0.055);
  pitchKick -= 0.013 + wState.heat * 0.004;
  wState.flashT = 0.05;
  shots++;
  Sfx.shot();

  // disperse según calor de disparo y movimiento
  scene.updateMatrixWorld();
  const moveF = clamp(Math.hypot(player.vel.x, player.vel.z) / CFG.walk, 0, 1.4);
  const spread = 0.0035 + wState.heat * 0.016 + moveF * 0.004;
  ndc.set(rand(-spread, spread), rand(-spread, spread));
  shootRay.setFromCamera(ndc, camera);
  shootRay.near = 0;
  shootRay.far = 250;

  const targets = worldShootables.slice();
  for (const e of enemies) if (e.state === 'alive') targets.push(e.mesh);
  const collisions = shootRay.intersectObjects(targets, true);

  // origen del trazador
  muzzle.getWorldPosition(tmpV);
  const end = collisions.length ? collisions[0].point : tmpV2.copy(shootRay.ray.origin).addScaledVector(shootRay.ray.direction, 120);
  Tracers.fire(tmpV.clone(), end.clone());

  // carcasa
  Particles.spawn(tmpV.clone().addScaledVector(shootRay.ray.direction, 0.3), 0xd9b246, 2, 2.5, 0.6);

  if (!collisions.length) return;
  const hit = collisions[0];
  const obj = hit.object;
  if (obj.userData && obj.userData.enemy) {
    const head = obj.userData.part === 'head';
    const dmg = CFG.dmgBody * (head ? CFG.dmgHeadMult : 1);
    hits++;
    obj.userData.enemy.hurt(dmg, obj.userData.part, hit.point);
  } else {
    Particles.spawn(hit.point, 0x9fb0c4, 6, 4, 0.4);
  }
}

/* ------------------------------------------------------------
   13. Jugador
   ------------------------------------------------------------ */
const player = {
  pos: new THREE.Vector3(0, 0, 6),
  vel: new THREE.Vector3(),
  onGround: true,
  hp: 100, maxHp: 100,
  yaw: 0, pitch: 0,
  noHurt: 99,
  bobT: 0,
  stepMark: 0,
};

let pitchKick = 0;
let shake = 0;
let dmgFlash = 0;
let bobT = 0;
let swayX = 0, swayY = 0, mouseDX = 0, mouseDY = 0;
let landDip = 0;
let camRoll = 0;

const keys = {};
let mouseDown = false;

function damagePlayer(amount, from) {
  if (state !== 'playing') return;
  player.hp = Math.max(0, player.hp - amount);
  player.noHurt = 0;
  dmgFlash = Math.min(1, dmgFlash + 0.55 + amount / 60);
  shake = Math.min(0.55, shake + 0.22);
  Sfx.hurt();
  if (player.hp <= 0) gameOver();
}

function updatePlayer(dt) {
  // giro de cámara con las flechas ← →
  const turnIn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
  player.yaw += turnIn * CFG.turn * dt;

  // input de movimiento (WASD se mantiene como alternativa; ↑ ↓ = avanzar/retroceder)
  const f = ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0);
  const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sprinting = (keys.ShiftLeft || keys.ShiftRight) === true && f > 0;
  const speed = sprinting ? CFG.sprint : CFG.walk;

  const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw);
  let wx = -sinY * f + cosY * s;
  let wz = -cosY * f - sinY * s;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }

  player.vel.x = damp(player.vel.x, wx * speed, 13, dt);
  player.vel.z = damp(player.vel.z, wz * speed, 13, dt);
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;

  // salto y gravedad
  if ((keys.KeyC || keys.ControlLeft || keys.ControlRight) && player.onGround) { player.vel.y = CFG.jump; player.onGround = false; }
  const fallSpeed = player.vel.y;
  player.vel.y -= CFG.gravity * dt;
  player.pos.y += player.vel.y * dt;
  if (player.pos.y <= 0) {
    player.pos.y = 0;
    if (fallSpeed < -4) landDip = Math.min(0.32, -fallSpeed * 0.03);   // alivio al aterrizar
    player.vel.y = 0;
    player.onGround = true;
  }

  // no atravesar enemigos
  for (const e of enemies) {
    if (e.state !== 'alive') continue;
    const dx = player.pos.x - e.pos.x, dz = player.pos.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    const minR = CFG.radius + e.cfg.radius;
    if (d > 0.001 && d < minR) {
      const push = (minR - d) / d;
      player.pos.x += dx * push;
      player.pos.z += dz * push;
    }
  }

  collide(player.pos, CFG.radius);

  // regeneración lenta tras 6 s sin recibir daño
  player.noHurt += dt;
  if (player.noHurt > 6 && player.hp < 60) player.hp = Math.min(60, player.hp + 3.5 * dt);

  // balanceo de cámara y pasos
  const moveF = clamp(Math.hypot(player.vel.x, player.vel.z) / CFG.walk, 0, 1.4);
  player.bobT += dt * (sprinting ? 15 : 11) * moveF;
  const stepMark = Math.floor(player.bobT / Math.PI);
  if (stepMark !== player.stepMark) {
    player.stepMark = stepMark;
    if (moveF > 0.25 && player.onGround) Sfx.step();
  }

  // la cámara "vive": balanceo al andar, respiración en reposo y alivio al caer
  landDip = damp(landDip, 0, 9, dt);
  const breathe = Math.sin(gameTime * 1.7) * 0.014;
  const bobY = Math.sin(player.bobT * 2) * 0.055 * moveF - landDip + breathe;
  const sideX = Math.sin(player.bobT) * 0.035 * moveF;
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  camRoll = damp(camRoll, -s * 0.022 - turnIn * 0.02 - Math.sin(player.bobT) * 0.008 * moveF, 6, dt);

  // cámara
  shake = Math.max(0, shake - dt * 1.6);
  const sh = shake * shake * 0.06;
  camera.position.set(
    player.pos.x + rx * sideX + rand(-sh, sh),
    player.pos.y + CFG.eye + bobY + rand(-sh, sh),
    player.pos.z + rz * sideX + rand(-sh, sh)
  );
  camera.rotation.y = player.yaw + rand(-sh, sh) * 0.5;
  camera.rotation.x = clamp(player.pitch + pitchKick, -1.52, 1.52) + rand(-sh, sh) * 0.5;
  camera.rotation.z = camRoll + rand(-sh, sh) * 0.4;
}

/* ------------------------------------------------------------
   14. Oleadas
   ------------------------------------------------------------ */
const wave = { number: 0, total: 0, toSpawn: 0, spawnTimer: 0, timer: 0, active: false };

function spawnPoint() {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(18, 38);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) > CFG.half - 3 || Math.abs(z) > CFG.half - 3) continue;
    if (Math.hypot(x - player.pos.x, z - player.pos.z) < 14) continue;
    if (obstacles.some(o => Math.abs(x - o.x) < o.hw + 1.3 && Math.abs(z - o.z) < o.hd + 1.3)) continue;
    return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(0, 0, -30);
}

function pickEnemyType() {
  const n = wave.number;
  const r = Math.random();
  if (n >= 2 && r < 0.05 + n * 0.05) return 'tank';   // oleadas 2-3: Colosales en la recta final
  if (n >= 2 && r < 0.55) return 'runner';
  return 'grunt';
}

function startWave(n) {
  wave.number = n;
  wave.total = Math.min(6 + Math.round(n * 2.2), 34);
  wave.toSpawn = wave.total;
  wave.spawnTimer = 1.1;
  wave.active = true;
  enterArena(n);
  Sfx.waveStart();
  banner('OLEADA ' + n, 'ZONA: ' + THEMES[arenaFor(n)].name + ' · ENEMIGOS: ' + wave.total, 2800);
}

function updateWaves(dt) {
  if (wave.active) {
    if (wave.toSpawn > 0) {
      wave.spawnTimer -= dt;
      const alive = enemies.filter(e => e.state === 'alive').length;
      if (wave.spawnTimer <= 0 && alive < CFG.maxAlive) {
        enemies.push(new Enemy(pickEnemyType(), spawnPoint()));
        wave.toSpawn--;
        wave.spawnTimer = Math.max(0.35, 1.25 - wave.number * 0.06);
      }
    } else if (!enemies.some(e => e.state === 'alive')) {
      const bonus = 300 * wave.number;
      score += bonus;
      weapon.reserve = Math.min(CFG.reserveMax, weapon.reserve + 45);
      if (wave.number >= CFG.maxWaves) {
        // victoria: todas las zonas despejadas
        wave.active = false;
        player.hp = player.maxHp;
        Sfx.waveClear();
        banner('ZONA DESPEJADA · +' + bonus, '¿LO HEMOS CONSEGUIDO…?', 2400);
        setTimeout(winGame, 1400);
      } else {
        wave.active = false;
        wave.timer = 4.5;
        player.hp = player.maxHp;
        Sfx.waveClear();
        banner('OLEADA ' + wave.number + ' SUPERADA', '+' + bonus + ' PUNTOS · SALUD AL 100% · +45 MUNICIÓN', 2600);
      }
    }
  } else {
    wave.timer -= dt;
    if (wave.timer <= 0 && wave.number < CFG.maxWaves) startWave(wave.number + 1);
  }
}

/* ------------------------------------------------------------
   15. HUD
   ------------------------------------------------------------ */
let bannerTimer = null;

function banner(title, sub, ms) {
  elBanner.innerHTML = '<div class="b-title">' + title + '</div>' + (sub ? '<div class="b-sub">' + sub + '</div>' : '');
  elBanner.classList.remove('hidden');
  elBanner.classList.remove('anim');
  void elBanner.offsetWidth;
  elBanner.classList.add('anim');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(function () { elBanner.classList.add('hidden'); }, ms || 2400);
}

function showHitmarker(color) {
  elHit.style.setProperty('--c', color);
  elHit.classList.remove('show');
  void elHit.offsetWidth;
  elHit.classList.add('show');
}

let hudTick = 0;
function updateHUD(dt) {
  // daño recibido (destello)
  dmgFlash = Math.max(0, dmgFlash - dt * 2.2);
  elDmg.style.opacity = dmgFlash.toFixed(3);

  // vida baja
  const low = player.hp <= 35;
  if (low !== elLowHp.classList.contains('on')) elLowHp.classList.toggle('on', low);

  // actualización menos frecuente de números
  hudTick -= dt;
  if (hudTick > 0) return;
  hudTick = 0.08;

  const pct = clamp(player.hp / player.maxHp, 0, 1) * 100;
  elHpFill.style.width = pct.toFixed(1) + '%';
  elHpFill.className = pct < 26 ? 'low' : pct < 55 ? 'mid' : '';
  elHpNum.textContent = Math.ceil(player.hp);

  elMag.textContent = wState.mag;
  elReserve.textContent = wState.reserve;
  const reloading = wState.reloadT > 0;
  elReloadNote.classList.toggle('on', reloading);
  elReloadHint.classList.toggle('off', reloading || wState.reserve <= 0 || wState.mag >= CFG.mag);

  elWave.textContent = wave.number;
  elScore.textContent = score;
  elEnemies.textContent = wave.toSpawn + enemies.filter(e => e.state === 'alive').length;

  const spread = 6 + wState.heat * 9 + clamp(Math.hypot(player.vel.x, player.vel.z) / CFG.walk, 0, 1.4) * 4;
  elCross.style.setProperty('--g', spread.toFixed(1) + 'px');
}

/* ------------------------------------------------------------
   16. Estados del juego
   ------------------------------------------------------------ */
let state = 'menu';
let gameTime = 0;
let score = 0, kills = 0, shots = 0, hits = 0, menuAngle = 0;
let bestScore = 0;
try { bestScore = parseInt(localStorage.getItem('zonacero_best') || '0', 10) || 0; } catch (e) {}
elBest.textContent = bestScore;

function requestLock() {
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(function () {});
  } catch (e) {}
}

function resetGame() {
  clearEnemies();
  clearPickups();
  Particles.clear();

  player.pos.set(0, 0, 6);
  player.vel.set(0, 0, 0);
  player.yaw = 0; player.pitch = 0;
  player.hp = player.maxHp;
  player.noHurt = 99;
  player.onGround = true;

  wState.mag = CFG.mag;
  wState.reserve = 120;
  wState.reloadT = 0;
  wState.heat = 0;
  wState.recoil = 0;
  wState.lastShot = -10;

  score = 0; kills = 0; shots = 0; hits = 0;
  pitchKick = 0; shake = 0; dmgFlash = 0;
  landDip = 0; camRoll = 0;
  wave.number = 0; wave.active = false; wave.timer = 0;
}

function startGame() {
  Sfx.init();
  Sfx.resume();
  resetGame();
  state = 'playing';
  scrStart.classList.add('hidden');
  scrPause.classList.add('hidden');
  scrOver.classList.add('hidden');
  scrWin.classList.add('hidden');
  elHud.classList.remove('hidden');
  weapon.visible = true;
  requestLock();
  startWave(1);
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  mouseDown = false;
  scrPause.classList.remove('hidden');
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  scrPause.classList.add('hidden');
  Sfx.resume();
  requestLock();
}

function goToMenu() {
  state = 'menu';
  clearEnemies();
  clearPickups();
  Particles.clear();
  elHud.classList.add('hidden');
  scrPause.classList.add('hidden');
  scrOver.classList.add('hidden');
  scrWin.classList.add('hidden');
  scrStart.classList.remove('hidden');
  elBest.textContent = bestScore;
  weapon.visible = false;
  applyTheme(0);
  if (document.pointerLockElement) document.exitPointerLock();
}

function gameOver() {
  state = 'gameover';
  mouseDown = false;
  if (score > bestScore) {
    bestScore = score;
    try { localStorage.setItem('zonacero_best', String(bestScore)); } catch (e) {}
  }
  stScore.textContent = score;
  stWave.textContent = wave.number;
  stKills.textContent = kills;
  stAcc.textContent = shots ? Math.round((hits / shots) * 100) + '%' : '0%';
  stBest.textContent = bestScore;
  scrOver.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

function winGame() {
  if (state !== 'playing') return;
  state = 'won';
  mouseDown = false;
  elHud.classList.add('hidden');
  if (score > bestScore) {
    bestScore = score;
    try { localStorage.setItem('zonacero_best', String(bestScore)); } catch (e) {}
  }
  wScore.textContent = score;
  wWave.textContent = wave.number;
  wKills.textContent = kills;
  wAcc.textContent = shots ? Math.round((hits / shots) * 100) + '%' : '0%';
  wBest.textContent = bestScore;
  Sfx.win();
  scrWin.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

/* ------------------------------------------------------------
   17. Entrada (teclado y ratón)
   ------------------------------------------------------------ */
window.addEventListener('keydown', function (e) {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Tab' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  if (e.code === 'KeyR' && state === 'playing') startReload();
  else if (e.code === 'Escape' && state === 'paused') resumeGame();
  else if (e.code === 'KeyP' && state === 'playing') pauseGame();
  else if (e.code === 'KeyP' && state === 'paused') resumeGame();
  else if (e.code === 'Escape' && state === 'playing') pauseGame();
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });

document.addEventListener('mousemove', function (e) {
  if (state !== 'playing') return;
  // apuntado con ratón: con el cursor fijado O manteniendo el botón (modo arrastre)
  if (!document.pointerLockElement && !mouseDown) return;
  player.yaw -= e.movementX * CFG.sens;
  player.pitch -= e.movementY * CFG.sens;
  player.pitch = clamp(player.pitch, -1.52, 1.52);
  mouseDX += e.movementX;
  mouseDY += e.movementY;
});

canvas.addEventListener('mousedown', function (e) {
  if (e.button !== 0 && e.button !== 2) return;   // clic izquierdo o derecho
  if (state !== 'playing') return;
  mouseDown = true;
  if (!document.pointerLockElement) requestLock(); // si el navegador lo permite, fijamos cursor
  shoot();                                          // y disparamos igualmente
});
window.addEventListener('mouseup', function (e) { if (e.button === 0 || e.button === 2) mouseDown = false; });
canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
document.addEventListener('contextmenu', function (e) { if (state === 'playing') e.preventDefault(); });

document.addEventListener('pointerlockchange', function () {
  if (!document.pointerLockElement && state === 'playing') pauseGame();
});

document.addEventListener('visibilitychange', function () {
  if (document.hidden && state === 'playing') pauseGame();
});

$('btn-start').addEventListener('click', function (e) { e.currentTarget.blur(); startGame(); });
$('btn-resume').addEventListener('click', function (e) { e.currentTarget.blur(); resumeGame(); });
$('btn-quit').addEventListener('click', function (e) { e.currentTarget.blur(); goToMenu(); });
$('btn-retry').addEventListener('click', function (e) { e.currentTarget.blur(); startGame(); });
$('btn-menu').addEventListener('click', function (e) { e.currentTarget.blur(); goToMenu(); });
$('btn-again').addEventListener('click', function (e) { e.currentTarget.blur(); startGame(); });
$('btn-menu2').addEventListener('click', function (e) { e.currentTarget.blur(); goToMenu(); });

/* ------------------------------------------------------------
   18. Bucle principal
   ------------------------------------------------------------ */
let lastTime = performance.now();

function update(dt) {
  gameTime += dt;
  if (state === 'playing') {
    updatePlayer(dt);
    updateWeapon(dt);
    for (let i = enemies.length - 1; i >= 0; i--) enemies[i].update(dt);
    updateWaves(dt);
    updatePickups(dt);
    if (mouseDown || keys.KeyF || keys.Enter || keys.Space) shoot();
    updateHUD(dt);
  } else if (state === 'menu') {
    menuAngle += dt * 0.05;
    camera.position.set(Math.sin(menuAngle) * 30, 11, Math.cos(menuAngle) * 30);
    camera.lookAt(0, 1.5, 0);
    for (let i = enemies.length - 1; i >= 0; i--) enemies[i].update(dt);
  }
  Particles.update(dt);
  Tracers.update(dt);
  Embers.update(dt);
  updateFires(dt);
}

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05;
  update(dt);
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------
   19. Arranque
   ------------------------------------------------------------ */
buildWorld();
weapon.visible = false;
loop();

/* ------------------------------------------------------------
   20. Modo depuración (?debug) — permite forzar la simulación
       desde la consola sin depender de requestAnimationFrame
   ------------------------------------------------------------ */
if (location.search.indexOf('debug') !== -1) {
  window.ZC = {
    start: startGame,
    step: function (dt, n) { for (let i = 0; i < (n || 1); i++) update(dt); },
    keys: keys,
    aim: function () {
      const e = enemies.find(function (x) { return x.state === 'alive'; });
      if (!e) return false;
      const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      player.yaw = Math.atan2(-dx, -dz);
      player.pitch = Math.atan2(1.74 * e.cfg.scale - CFG.eye, d);
      return true;
    },
    shoot: shoot,
    damage: damagePlayer,
    info: function () {
      return {
        state: state, wave: wave.number, toSpawn: wave.toSpawn,
        alive: enemies.filter(function (e) { return e.state === 'alive'; }).length,
        dying: enemies.filter(function (e) { return e.state === 'dying'; }).length,
        hp: Math.round(player.hp), score: score, kills: kills,
        mag: wState.mag, reserve: wState.reserve,
        px: +player.pos.x.toFixed(2), pz: +player.pos.z.toFixed(2),
        shots: shots, hits: hits, pickups: pickups.length,
      };
    },
    startWave: startWave,
    theme: applyTheme,
    themes: THEMES,
    win: winGame,
    ammo: function () { wState.mag = CFG.mag; wState.reserve = CFG.reserveMax; },
    sweep: function () {
      enemies.forEach(function (e) { if (e.state === 'alive') { e.hp = 0; e.die(); } });
    },
  };
}

})();
