/**
 * ANTIGRAVITY: VALLEY EXPLORER
 * High-fidelity 3D game engine using Three.js r128
 * Features:
 *   - Procedural valley terrain with Perlin-like noise
 *   - Dense procedural forests (pines, oaks, rocks)
 *   - Third-person character with WASD + mouse camera
 *   - Terrain collision & gravity physics
 *   - Dynamic directional light + ambient + hemisphere
 *   - Atmospheric fog (exponential)
 *   - Animated day-sky gradient skybox
 *   - Minimap, compass, HUD
 */

'use strict';

// ─── NOISE UTILITY ────────────────────────────────────────────────────────────
// Improved Perlin noise (compact implementation)
const Noise = (() => {
  const perm = new Uint8Array(512);
  const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,
    30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,
    219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,
    175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,
    230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,
    76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,
    186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,
    59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,
    70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,
    178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,
    241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,
    176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,
    128,195,78,66,215,61,156,180];
  for (let i = 0; i < 256; i++) perm[i] = perm[i+256] = p[i];

  const fade = t => t*t*t*(t*(t*6-15)+10);
  const lerp = (a,b,t) => a + t*(b-a);
  const grad = (h,x,y,z) => {
    const u = h<8?x:y, v = h<4?y:h===12||h===14?x:z;
    return ((h&1)?-u:u)+((h&2)?-v:v);
  };
  return {
    get(x, y, z=0) {
      const X=Math.floor(x)&255, Y=Math.floor(y)&255, Z=Math.floor(z)&255;
      x-=Math.floor(x); y-=Math.floor(y); z-=Math.floor(z);
      const u=fade(x),v=fade(y),w=fade(z);
      const A=perm[X]+Y, AA=perm[A]+Z, AB=perm[A+1]+Z;
      const B=perm[X+1]+Y, BA=perm[B]+Z, BB=perm[B+1]+Z;
      return lerp(lerp(lerp(grad(perm[AA],x,y,z),grad(perm[BA],x-1,y,z),u),
                       lerp(grad(perm[AB],x,y-1,z),grad(perm[BB],x-1,y-1,z),u),v),
                  lerp(lerp(grad(perm[AA+1],x,y,z-1),grad(perm[BA+1],x-1,y,z-1),u),
                       lerp(grad(perm[AB+1],x,y-1,z-1),grad(perm[BB+1],x-1,y-1,z-1),u),v),w);
    },
    fbm(x, y, octaves=6, lacunarity=2, gain=0.5) {
      let v=0, amp=0.5, freq=1, max=0;
      for (let i=0; i<octaves; i++) {
        v += amp * this.get(x*freq, y*freq);
        max += amp; amp *= gain; freq *= lacunarity;
      }
      return v / max;
    }
  };
})();

// ─── GAME STATE ───────────────────────────────────────────────────────────────
const STATE = {
  phase: 'START', // START | LOADING | PLAYING | PAUSED
  startTime: 0,
  elapsed: 0,
};

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('game3d-canvas');
const loadingEl   = document.getElementById('loading-screen');
const loaderBar   = document.getElementById('loader-bar');
const loaderText  = document.getElementById('loader-text');
const hud3d       = document.getElementById('hud3d');
const start3d     = document.getElementById('start3d');
const pause3d     = document.getElementById('pause3d');
const btnEnter    = document.getElementById('btn-enter-world');
const btnResume   = document.getElementById('btn-resume');
const btnBackMenu = document.getElementById('btn-back-menu');
const altVal      = document.getElementById('altitude-val');
const speedVal    = document.getElementById('speed-val');
const timeVal     = document.getElementById('time-val');
const compassEl   = document.getElementById('compass-needle');
const minimapCvs  = document.getElementById('minimap');
const minimapCtx  = minimapCvs.getContext('2d');

// ─── THREE.JS INIT ────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();

// Atmospheric fog
scene.fog = new THREE.FogExp2(0x8fb8d8, 0.0055);
scene.background = new THREE.Color(0x8fb8d8);

// ─── CAMERA ───────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 8, 15);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── TERRAIN CONFIG ───────────────────────────────────────────────────────────
const TERRAIN = {
  size: 512,
  segments: 128,
  maxHeight: 62,
  valleyDepth: 0.5,
};

let terrainMesh = null;
let terrainGeometry = null;

function getTerrainHeight(x, z) {
  // Normalised coords in [-1, 1]
  const nx = x / (TERRAIN.size * 0.5);
  const nz = z / (TERRAIN.size * 0.5);

  // Valley mask: low in centre, high at edges
  const valleyMask = Math.min(1, (Math.abs(nx) * 1.4 + Math.abs(nz) * 0.5));
  const vMask2 = Math.min(1, (Math.abs(nz) * 1.4 + Math.abs(nx) * 0.3));
  const valley = Math.max(valleyMask, vMask2) * TERRAIN.valleyDepth;

  // Layered noise
  const large = Noise.fbm(nx * 1.2 + 10, nz * 1.2 + 10, 5, 2.1, 0.55);
  const med   = Noise.fbm(nx * 3.5 + 5,  nz * 3.5 + 5,  4, 2.0, 0.48) * 0.35;
  const small = Noise.fbm(nx * 9 + 30,   nz * 9 + 30,   3, 2.0, 0.42) * 0.12;

  const raw = large + med + small;
  const h = (raw * 0.5 + 0.5) * TERRAIN.maxHeight;
  const masked = h * (0.12 + valley * 0.88);
  return masked;
}

function buildTerrain() {
  loaderText.textContent = 'Esculpiendo terreno...';
  loaderBar.style.width = '15%';

  const geo = new THREE.PlaneGeometry(
    TERRAIN.size, TERRAIN.size,
    TERRAIN.segments, TERRAIN.segments
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, getTerrainHeight(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  terrainGeometry = geo;

  // Vertex color for variation (grass / rock / snow)
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const frac = y / TERRAIN.maxHeight;
    const r = frac > 0.6 ? THREE.MathUtils.lerp(0.35, 0.82, (frac - 0.6) / 0.4) : THREE.MathUtils.lerp(0.12, 0.35, frac / 0.6);
    const g = frac > 0.6 ? THREE.MathUtils.lerp(0.35, 0.80, (frac - 0.6) / 0.4) : THREE.MathUtils.lerp(0.35, 0.45, frac / 0.6);
    const b = frac > 0.6 ? THREE.MathUtils.lerp(0.28, 0.82, (frac - 0.6) / 0.4) : THREE.MathUtils.lerp(0.12, 0.25, frac / 0.6);
    colors.push(r, g, b);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.0,
    wireframe: false,
  });

  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  scene.add(terrainMesh);
}

// ─── LIGHTING ─────────────────────────────────────────────────────────────────
function buildLighting() {
  loaderText.textContent = 'Configurando iluminación...';
  loaderBar.style.width = '30%';

  // Hemisphere (sky/ground)
  const hemi = new THREE.HemisphereLight(0xd4e8f5, 0x3d5a1e, 0.6);
  scene.add(hemi);

  // Main sun (directional with shadows)
  const sun = new THREE.DirectionalLight(0xfff5d6, 2.2);
  sun.position.set(80, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 500;
  sun.shadow.camera.left = -200;
  sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200;
  sun.shadow.camera.bottom = -200;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  // Fill light (sky blue)
  const fill = new THREE.DirectionalLight(0x93c5fd, 0.5);
  fill.position.set(-60, 40, -80);
  scene.add(fill);

  // Ambient
  scene.add(new THREE.AmbientLight(0xb0cfe8, 0.4));

  return { sun, hemi, fill };
}

// ─── SKY ──────────────────────────────────────────────────────────────────────
function buildSky() {
  loaderText.textContent = 'Pintando el cielo...';
  loaderBar.style.width = '40%';

  // Gradient sky dome using shader material
  const skyGeo = new THREE.SphereGeometry(450, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor:    { value: new THREE.Color(0x1a3a6e) },
      horizColor:  { value: new THREE.Color(0x8fb8d8) },
      bottomColor: { value: new THREE.Color(0x4a7c59) },
      offset:      { value: 25 },
      exponent:    { value: 0.55 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos + offset).y;
        vec3 col = mix(horizColor, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        col = mix(bottomColor, col, step(0.0, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Sun disc
  const sunGeo = new THREE.SphereGeometry(8, 16, 16);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff8c0 });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.set(160, 220, 100);
  scene.add(sunMesh);

  // Sun glow (lens flare simulation via sprite)
  const glowGeo = new THREE.SphereGeometry(22, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xfffbe0, transparent: true, opacity: 0.25,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.copy(sunMesh.position);
  scene.add(glowMesh);

  // Scattered clouds (flat ellipsoids)
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf0f8ff, transparent: true, opacity: 0.82,
    roughness: 1, metalness: 0,
  });
  for (let i = 0; i < 22; i++) {
    const w = Math.random() * 60 + 30;
    const h = Math.random() * 8 + 4;
    const cGeo = new THREE.SphereGeometry(1, 10, 6);
    const c = new THREE.Mesh(cGeo, cloudMat);
    c.scale.set(w, h, w * 0.55);
    c.position.set(
      (Math.random() - 0.5) * 440,
      Math.random() * 30 + 140,
      (Math.random() - 0.5) * 440,
    );
    c.castShadow = false;
    scene.add(c);
  }
}

// ─── VEGETATION & ROCKS ───────────────────────────────────────────────────────
const treeGroup = new THREE.Group();

function makePineTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const h = getTerrainHeight(x, z);

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 2.8 * scale, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3120, roughness: 0.95 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.4 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  // Layered cone foliage
  const green = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.28 + Math.random() * 0.08, 0.7, 0.2 + Math.random() * 0.08),
    roughness: 0.9,
  });
  const layers = 3 + Math.floor(Math.random() * 2);
  for (let l = 0; l < layers; l++) {
    const r = (1.4 - l * 0.28) * scale;
    const conGeo = new THREE.ConeGeometry(r, 1.6 * scale, 7);
    const con = new THREE.Mesh(conGeo, green);
    con.position.y = (2.2 + l * 1.2) * scale;
    con.castShadow = true;
    group.add(con);
  }

  group.position.set(x, h, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}

function makeOakTree(x, z, scale = 1) {
  const group = new THREE.Group();
  const h = getTerrainHeight(x, z);

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.22 * scale, 0.35 * scale, 3.5 * scale, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.95 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.75 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  // Round canopy
  const canopyGeo = new THREE.SphereGeometry(2.2 * scale, 10, 8);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.23 + Math.random() * 0.07, 0.65, 0.22 + Math.random() * 0.1),
    roughness: 0.88,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.y = 5.2 * scale;
  canopy.scale.y = 0.75;
  canopy.castShadow = true;
  group.add(canopy);

  // Secondary canopy blobs
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const bGeo = new THREE.SphereGeometry((1.2 + Math.random() * 0.6) * scale, 8, 6);
    const b = new THREE.Mesh(bGeo, canopyMat);
    b.position.set(Math.cos(a) * 1.4 * scale, (4.5 + Math.random()) * scale, Math.sin(a) * 1.4 * scale);
    b.castShadow = true;
    group.add(b);
  }

  group.position.set(x, h, z);
  group.rotation.y = Math.random() * Math.PI * 2;
  return group;
}

function makeRock(x, z) {
  const group = new THREE.Group();
  const h = getTerrainHeight(x, z);
  const scale = 0.5 + Math.random() * 2.5;

  const rockMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0, 0, 0.35 + Math.random() * 0.25),
    roughness: 0.95,
    metalness: 0.05,
  });

  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const rGeo = new THREE.DodecahedronGeometry(scale * (0.5 + Math.random() * 0.7), 0);
    const r = new THREE.Mesh(rGeo, rockMat);
    r.position.set(
      (Math.random() - 0.5) * scale * 1.2,
      scale * 0.35 + Math.random() * scale * 0.3,
      (Math.random() - 0.5) * scale * 1.2,
    );
    r.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    r.castShadow = true;
    r.receiveShadow = true;
    group.add(r);
  }

  group.position.set(x, h, z);
  return group;
}

function makeBushFern(x, z) {
  const h = getTerrainHeight(x, z);
  const scale = 0.3 + Math.random() * 0.6;
  const geo = new THREE.SphereGeometry(scale, 7, 5);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.26 + Math.random() * 0.06, 0.7, 0.22 + Math.random() * 0.08),
    roughness: 0.9,
  });
  geo.scale(1, 0.6, 1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, h + scale * 0.3, z);
  mesh.castShadow = true;
  return mesh;
}

function populateWorld() {
  loaderText.textContent = 'Plantando bosques...';
  loaderBar.style.width = '60%';

  const half = TERRAIN.size * 0.5;
  let placed = 0;

  // Seeded random grid for trees
  for (let attempts = 0; attempts < 2400; attempts++) {
    // Pseudo-random using attempt index for repeatability
    const nx = Noise.get(attempts * 0.317, 0.1) * 0.5 + 0.5;
    const nz = Noise.get(0.1, attempts * 0.437) * 0.5 + 0.5;
    const x = (nx - 0.5) * (TERRAIN.size - 30);
    const z = (nz - 0.5) * (TERRAIN.size - 30);
    const h = getTerrainHeight(x, z);
    const slope = h / TERRAIN.maxHeight;

    // Only plant on low-mid terrain (valley floor and gentle slopes)
    if (h < 4 || slope > 0.72) continue;

    const r = Math.random();
    let obj;
    if (r < 0.45) {
      obj = makePineTree(x, z, 0.7 + Math.random() * 0.9);
    } else if (r < 0.72) {
      obj = makeOakTree(x, z, 0.6 + Math.random() * 0.7);
    } else if (r < 0.86) {
      obj = makeRock(x, z);
    } else {
      obj = makeBushFern(x, z);
    }
    treeGroup.add(obj);
    placed++;
    if (placed >= 900) break;
  }

  scene.add(treeGroup);
}

// ─── WATER PLANE ──────────────────────────────────────────────────────────────
function buildWater() {
  loaderText.textContent = 'Añadiendo río...';
  loaderBar.style.width = '72%';

  // Low-lying water (valley floor ~y=3)
  const waterGeo = new THREE.PlaneGeometry(TERRAIN.size * 0.18, TERRAIN.size * 0.07);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1a78c2,
    transparent: true,
    opacity: 0.72,
    roughness: 0.12,
    metalness: 0.45,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(0, 3.2, 10);
  water.receiveShadow = true;
  scene.add(water);
  return water;
}

// ─── CHARACTER (third-person capsule) ────────────────────────────────────────
const CharacterDef = {
  height: 1.8,
  radius: 0.35,
  walkSpeed: 8,
  runSpeed: 16,
  jumpForce: 12,
  gravity: -28,
};

class Character {
  constructor() {
    this.group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(CharacterDef.radius, CharacterDef.height - CharacterDef.radius * 2, 6, 8)
      : new THREE.CylinderGeometry(CharacterDef.radius, CharacterDef.radius, CharacterDef.height, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.65 });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = CharacterDef.height * 0.5;
    this.bodyMesh.castShadow = true;
    this.group.add(this.bodyMesh);

    // Head
    const headGeo = new THREE.SphereGeometry(0.28, 10, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd4a76a, roughness: 0.7 });
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = CharacterDef.height + 0.28;
    this.headMesh.castShadow = true;
    this.group.add(this.headMesh);

    // Backpack
    const bpGeo = new THREE.BoxGeometry(0.4, 0.55, 0.22);
    const bpMat = new THREE.MeshStandardMaterial({ color: 0x2d4a6e, roughness: 0.8 });
    const bp = new THREE.Mesh(bpGeo, bpMat);
    bp.position.set(0, CharacterDef.height * 0.65, -0.3);
    bp.castShadow = true;
    this.group.add(bp);

    // Arms
    ['L','R'].forEach((side, i) => {
      const armGeo = new THREE.CapsuleGeometry
        ? new THREE.CapsuleGeometry(0.09, 0.6, 4, 6)
        : new THREE.CylinderGeometry(0.09, 0.09, 0.7, 6);
      const armMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.65 });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(side === 'L' ? -0.55 : 0.55, CharacterDef.height * 0.65, 0);
      arm.rotation.z = side === 'L' ? 0.2 : -0.2;
      arm.castShadow = true;
      this.group.add(arm);
      this[`${side.toLowerCase()}Arm`] = arm;
    });

    // Physics state
    this.velocity = new THREE.Vector3();
    this.onGround = false;
    this.position = new THREE.Vector3(0, 30, 0);
    this.group.position.copy(this.position);

    scene.add(this.group);
  }

  getTerrainY(x, z) {
    return getTerrainHeight(x, z);
  }

  update(dt, input, camYaw) {
    const moveDir = new THREE.Vector3();
    if (input.forward)  moveDir.z -= 1;
    if (input.backward) moveDir.z += 1;
    if (input.left)     moveDir.x -= 1;
    if (input.right)    moveDir.x += 1;

    // Rotate move direction by camera yaw
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), camYaw);
    if (moveDir.length() > 0.01) moveDir.normalize();

    const speed = input.sprint ? CharacterDef.runSpeed : CharacterDef.walkSpeed;
    this.velocity.x = moveDir.x * speed;
    this.velocity.z = moveDir.z * speed;

    // Gravity
    this.velocity.y += CharacterDef.gravity * dt;

    // Jump
    if (input.jump && this.onGround) {
      this.velocity.y = CharacterDef.jumpForce;
      this.onGround = false;
    }

    // Move
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Terrain collision
    const terrainY = this.getTerrainY(this.position.x, this.position.z);
    if (this.position.y <= terrainY) {
      this.position.y = terrainY;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // World bounds
    const bound = TERRAIN.size * 0.48;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -bound, bound);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -bound, bound);

    this.group.position.copy(this.position);

    // Face movement direction
    if (moveDir.length() > 0.01) {
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      this.group.rotation.y = THREE.MathUtils.lerp(
        this.group.rotation.y,
        targetAngle + Math.PI,
        0.15,
      );
    }

    // Arm swing animation
    const swing = Math.sin(Date.now() * 0.006) * 0.35;
    if (this.lArm) this.lArm.rotation.x =  swing * (moveDir.length() > 0.01 ? 1 : 0.05);
    if (this.rArm) this.rArm.rotation.x = -swing * (moveDir.length() > 0.01 ? 1 : 0.05);
  }
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
const Input = {
  keys: {},
  get forward()  { return !!(this.keys['KeyW']   || this.keys['ArrowUp']);    },
  get backward() { return !!(this.keys['KeyS']   || this.keys['ArrowDown']);  },
  get left()     { return !!(this.keys['KeyA']   || this.keys['ArrowLeft']);  },
  get right()    { return !!(this.keys['KeyD']   || this.keys['ArrowRight']); },
  get sprint()   { return !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']); },
  jump: false,
};

window.addEventListener('keydown', e => {
  Input.keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); Input.jump = true; }
  if (e.code === 'Escape' && STATE.phase === 'PLAYING') togglePause();
});
window.addEventListener('keyup', e => {
  Input.keys[e.code] = false;
  if (e.code === 'Space') Input.jump = false;
});

// ─── CAMERA CONTROLLER (third-person orbit) ───────────────────────────────────
const CameraCtrl = {
  yaw:     0,
  pitch:   -0.22,
  distance: 6.5,
  height:   2.4,
  sensitivity: 0.0018,
  locked: false,

  applyTo(camera, target) {
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const pitchClamped = THREE.MathUtils.clamp(this.pitch, -0.55, 0.8);
    this.pitch = pitchClamped;

    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);

    const offset = new THREE.Vector3(
      sinY * this.distance * cosP,
      sinP * this.distance + this.height,
      cosY * this.distance * cosP,
    );

    camera.position.copy(target).add(offset);
    camera.lookAt(target.clone().add(new THREE.Vector3(0, this.height * 0.6, 0)));
  },
};

document.addEventListener('pointerlockchange', () => {
  CameraCtrl.locked = (document.pointerLockElement === canvas);
});

canvas.addEventListener('click', () => {
  if (STATE.phase === 'PLAYING') {
    canvas.requestPointerLock();
  }
});

window.addEventListener('mousemove', e => {
  if (!CameraCtrl.locked) return;
  CameraCtrl.yaw   -= e.movementX * CameraCtrl.sensitivity;
  CameraCtrl.pitch += e.movementY * CameraCtrl.sensitivity;
});

// ─── MINIMAP ──────────────────────────────────────────────────────────────────
function drawMinimap(playerPos) {
  const W = minimapCvs.width, H = minimapCvs.height;
  minimapCtx.clearRect(0, 0, W, H);

  // Background
  minimapCtx.fillStyle = 'rgba(10,14,26,0.9)';
  minimapCtx.beginPath();
  minimapCtx.arc(W/2, H/2, W/2, 0, Math.PI*2);
  minimapCtx.fill();

  // Terrain sample
  const scale = W / TERRAIN.size;
  const img = minimapCtx.createImageData(W, H);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const wx = (px / W - 0.5) * TERRAIN.size;
      const wz = (py / H - 0.5) * TERRAIN.size;
      const h = getTerrainHeight(wx, wz) / TERRAIN.maxHeight;
      const inside = (px - W/2)**2 + (py - H/2)**2 < (W/2)**2;
      if (!inside) { img.data[4*(py*W+px)+3] = 0; continue; }
      const r = Math.floor(h > 0.6 ? THREE.MathUtils.lerp(100,220,(h-0.6)/0.4) : THREE.MathUtils.lerp(30,100,h/0.6));
      const g = Math.floor(h > 0.6 ? THREE.MathUtils.lerp(100,210,(h-0.6)/0.4) : THREE.MathUtils.lerp(80,130,h/0.6));
      const b = Math.floor(h > 0.6 ? THREE.MathUtils.lerp(80,220,(h-0.6)/0.4) : THREE.MathUtils.lerp(40,65,h/0.6));
      const idx = 4 * (py * W + px);
      img.data[idx]=r; img.data[idx+1]=g; img.data[idx+2]=b; img.data[idx+3]=220;
    }
  }
  minimapCtx.putImageData(img, 0, 0);

  // Clip to circle
  minimapCtx.globalCompositeOperation = 'destination-in';
  minimapCtx.beginPath();
  minimapCtx.arc(W/2, H/2, W/2, 0, Math.PI*2);
  minimapCtx.fill();
  minimapCtx.globalCompositeOperation = 'source-over';

  // Player dot
  const px = (playerPos.x / TERRAIN.size + 0.5) * W;
  const py = (playerPos.z / TERRAIN.size + 0.5) * H;
  minimapCtx.beginPath();
  minimapCtx.arc(px, py, 4, 0, Math.PI*2);
  minimapCtx.fillStyle = '#38bdf8';
  minimapCtx.fill();
  minimapCtx.strokeStyle = '#fff';
  minimapCtx.lineWidth = 1.2;
  minimapCtx.stroke();

  // Border
  minimapCtx.beginPath();
  minimapCtx.arc(W/2, H/2, W/2-1, 0, Math.PI*2);
  minimapCtx.strokeStyle = 'rgba(56,189,248,0.3)';
  minimapCtx.lineWidth = 2;
  minimapCtx.stroke();
}

let minimapDirty = true; // only redraw minimap periodically
let minimapTimer = 0;

// ─── HUD UPDATE ───────────────────────────────────────────────────────────────
let elapsedSeconds = 0;

function updateHUD(character) {
  const pos = character.position;
  const terrainY = getTerrainHeight(pos.x, pos.z);
  const altitude = Math.max(0, pos.y - terrainY);
  altVal.textContent = `${altitude.toFixed(1)}m`;

  const hspeed = Math.sqrt(character.velocity.x**2 + character.velocity.z**2);
  speedVal.textContent = `${(hspeed * 3.6).toFixed(1)} km/h`;

  const mins = Math.floor(elapsedSeconds / 60).toString().padStart(2,'0');
  const secs = Math.floor(elapsedSeconds % 60).toString().padStart(2,'0');
  timeVal.textContent = `${mins}:${secs}`;

  // Compass: yaw -> N/S/E/W
  const deg = (((-CameraCtrl.yaw * 180 / Math.PI) % 360) + 360) % 360;
  const dirs = ['N','NE','E','SE','S','SO','O','NO'];
  const idx = Math.round(deg / 45) % 8;
  compassEl.textContent = dirs[idx];

  // Minimap every 0.5s
  minimapTimer += 1/60;
  if (minimapTimer > 0.5) {
    minimapTimer = 0;
    drawMinimap(pos);
  }
}

// ─── PARTICLES (footstep dust) ────────────────────────────────────────────────
const dustParticles = [];
const dustGeo = new THREE.SphereGeometry(0.04, 4, 4);
const dustMat = new THREE.MeshBasicMaterial({ color: 0xc4a46a, transparent: true, opacity: 0.6 });
const DUST_POOL = 60;
for (let i = 0; i < DUST_POOL; i++) {
  const d = new THREE.Mesh(dustGeo, dustMat);
  d.visible = false;
  d.userData = { life: 0, maxLife: 0, vx: 0, vz: 0, vy: 0 };
  scene.add(d);
  dustParticles.push(d);
}
let dustIndex = 0;

function spawnDust(x, y, z) {
  const d = dustParticles[dustIndex % DUST_POOL];
  dustIndex++;
  d.visible = true;
  d.position.set(x + (Math.random()-.5)*0.5, y+0.1, z + (Math.random()-.5)*0.5);
  d.userData.life = 0;
  d.userData.maxLife = 0.5 + Math.random()*0.3;
  d.userData.vx = (Math.random()-.5)*1.2;
  d.userData.vz = (Math.random()-.5)*1.2;
  d.userData.vy = Math.random()*0.8;
}

function updateDust(dt) {
  for (const d of dustParticles) {
    if (!d.visible) continue;
    d.userData.life += dt;
    const t = d.userData.life / d.userData.maxLife;
    if (t >= 1) { d.visible = false; continue; }
    d.position.x += d.userData.vx * dt;
    d.position.y += d.userData.vy * dt;
    d.position.z += d.userData.vz * dt;
    d.userData.vy -= 1.5 * dt;
    d.material.opacity = 0.55 * (1 - t);
  }
}

// ─── WATER ANIMATION ──────────────────────────────────────────────────────────
let waterMesh = null;

// ─── PAUSE / RESUME ───────────────────────────────────────────────────────────
function togglePause() {
  if (STATE.phase === 'PLAYING') {
    STATE.phase = 'PAUSED';
    pause3d.classList.remove('hidden');
    document.exitPointerLock();
  } else if (STATE.phase === 'PAUSED') {
    STATE.phase = 'PLAYING';
    pause3d.classList.add('hidden');
    canvas.requestPointerLock();
  }
}

btnResume.addEventListener('click', () => {
  STATE.phase = 'PLAYING';
  pause3d.classList.add('hidden');
  canvas.requestPointerLock();
});
btnBackMenu.addEventListener('click', () => {
  STATE.phase = 'START';
  pause3d.classList.add('hidden');
  hud3d.classList.add('hidden');
  start3d.classList.remove('hidden');
  document.exitPointerLock();
});

// ─── LOADING SEQUENCE ─────────────────────────────────────────────────────────
let character = null;
let lights = null;

async function loadWorld() {
  STATE.phase = 'LOADING';

  await new Promise(r => setTimeout(r, 50)); buildTerrain();
  await new Promise(r => setTimeout(r, 50)); lights = buildLighting();
  await new Promise(r => setTimeout(r, 50)); buildSky();
  await new Promise(r => setTimeout(r, 50)); populateWorld();
  await new Promise(r => setTimeout(r, 50)); waterMesh = buildWater();

  loaderText.textContent = 'Generando personaje...';
  loaderBar.style.width = '85%';
  await new Promise(r => setTimeout(r, 50));
  character = new Character();

  // Draw minimap once
  drawMinimap(character.position);

  loaderText.textContent = 'Iniciando motor 3D...';
  loaderBar.style.width = '98%';
  await new Promise(r => setTimeout(r, 200));

  // Hide loader
  loadingEl.classList.add('fade-out');
  await new Promise(r => setTimeout(r, 800));
  loadingEl.style.display = 'none';

  // Show start screen
  start3d.classList.remove('hidden');
}

// ─── START BUTTON ─────────────────────────────────────────────────────────────
let dustTimer = 0;

btnEnter.addEventListener('click', () => {
  start3d.classList.add('hidden');
  hud3d.classList.remove('hidden');
  STATE.phase = 'PLAYING';
  STATE.startTime = performance.now();
  elapsedSeconds = 0;
  drawMinimap(character.position);
  canvas.requestPointerLock();
});

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (STATE.phase === 'PLAYING' && character) {
    elapsedSeconds += dt;

    // Character update
    character.update(dt, Input, CameraCtrl.yaw);

    // Camera follow
    const lookTarget = character.position.clone().add(new THREE.Vector3(0, CharacterDef.height * 0.8, 0));
    CameraCtrl.applyTo(camera, lookTarget);

    // Footstep dust
    const hspd = Math.sqrt(character.velocity.x**2 + character.velocity.z**2);
    if (hspd > 1 && character.onGround) {
      dustTimer += dt;
      if (dustTimer > 0.12) {
        dustTimer = 0;
        spawnDust(character.position.x, character.position.y, character.position.z);
      }
    }
    updateDust(dt);

    // Water ripple
    if (waterMesh) {
      waterMesh.position.y = 3.2 + Math.sin(Date.now() * 0.0008) * 0.08;
      waterMesh.material.opacity = 0.65 + Math.sin(Date.now() * 0.0012) * 0.07;
    }

    // HUD
    updateHUD(character);

    // Reset one-shot jump
    Input.jump = false;
  }

  renderer.render(scene, camera);
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
(async () => {
  await loadWorld();
  animate();
})();
