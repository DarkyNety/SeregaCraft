// torch.js — Minecraft-факел с эффектами (Three.js)
import * as THREE from 'three';

/* ========================= УТИЛИТЫ ========================= */
const rnd    = (a, b) => a + Math.random() * (b - a);
const pick   = arr => arr[(Math.random() * arr.length) | 0];
const clamp01 = v => Math.max(0, Math.min(1, v));
const damp    = (speed, dt) => 1 - Math.exp(-speed * dt);
const mixC    = (a, b, t) => {
  t = clamp01(t);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
};

function radialGlowTexture(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  for (const [pos, col] of stops) g.addColorStop(pos, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ========================= ФАБРИКА ========================= */
export function createTorch(options = {}) {
  const {
    // Где стоит факел в режиме «на земле» (в координатах корневой группы)
    origin      = new THREE.Vector3(0, 0, 0),
    // Где стоит факел в режиме «на стене» и на сколько наклонён (рад, вокруг Z)
    wallPos     = new THREE.Vector3(-1.5 + 1/16, 0.85, 0),
    wallTiltZ   = -Math.PI / 8,
    // Воксель
    unit        = 1 / 16,
    // Настройки
    showPool    = true,
    shadows     = true,
    emberCount  = 150,
    smokeCount  = 42,
    initialState = 'ground',  // 'ground' | 'wall' | 'extinguished'
  } = options;

  const TIP_Y = 10 * unit;
  const voxelGeo = new THREE.BoxGeometry(unit * 1.02, unit * 1.02, unit * 1.02);

  /* ---------- Группы ---------- */
  const root       = new THREE.Group();
  const torchGroup = new THREE.Group();
  root.add(torchGroup);

  /* ---------- Материалы дерева ---------- */
  const woodMats = ['#6b4a2b','#7a5533','#8a6038','#5e4126','#7f5a37','#8e6741','#63431f','#946b44','#775232']
    .map(c => new THREE.MeshLambertMaterial({ color: c }));
  const darkWoodMats = ['#4f371e','#5a3f24','#452e18']
    .map(c => new THREE.MeshLambertMaterial({ color: c }));
  const charMats = ['#3d2716','#4d311c','#2c1b0e'].map(c => new THREE.MeshLambertMaterial({
    color: c,
    emissive: new THREE.Color(0x401500),
    emissiveIntensity: 1.0,
  }));

  /* ---------- Ствол: 2×2×8 вокселей ---------- */
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) {
        let mat;
        if      (y === 7) mat = pick(charMats);
        else if (y === 6) mat = Math.random() < 0.55 ? pick(charMats) : pick(woodMats);
        else if (y === 0) mat = Math.random() < 0.60 ? pick(darkWoodMats) : pick(woodMats);
        else              mat = pick(woodMats);

        const m = new THREE.Mesh(voxelGeo, mat);
        m.position.set((x - 0.5) * unit, (y + 0.5) * unit, (z - 0.5) * unit);
        m.castShadow = shadows;
        m.receiveShadow = shadows;
        torchGroup.add(m);
      }
    }
  }

  /* ---------- Пламя: ядро (y = 8..9) ---------- */
  const flameCoreColors = ['#fff8d6','#ffedaa','#ffe27a','#ffd24d'];
  const flameVoxels = [];
  for (let y = 0; y < 2; y++)
    for (let x = 0; x < 2; x++)
      for (let z = 0; z < 2; z++) {
        const mat = new THREE.MeshBasicMaterial({
          color: pick(flameCoreColors),
          transparent: true,
          depthWrite: false,
        });
        const m = new THREE.Mesh(voxelGeo, mat);
        m.position.set((x - 0.5) * unit, (8 + y + 0.5) * unit, (z - 0.5) * unit);
        m.userData = { baseY: m.position.y, phase: Math.random() * Math.PI * 2 };
        torchGroup.add(m);
        flameVoxels.push(m);
      }

  /* ---------- Пламя: объёмное свечение ---------- */
  const glowCubeBaseMats = [
    new THREE.MeshBasicMaterial({ color: 0xff7a00, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xffa63c, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];
  const glowCubes = [];
  for (let i = 0; i < 5; i++) {
    const s = rnd(1.5, 2.2) * unit;
    const mat = glowCubeBaseMats[i % glowCubeBaseMats.length].clone();
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
    m.position.set(
      rnd(-0.5, 0.5) * unit,
      9 * unit + rnd(-0.3, 0.7) * unit,
      rnd(-0.5, 0.5) * unit
    );
    m.userData = {
      baseY: m.position.y,
      phase: Math.random() * Math.PI * 2,
      speed: rnd(1.2, 2.6),
      baseOpacity: mat.opacity,
    };
    torchGroup.add(m);
    glowCubes.push(m);
  }

  /* ---------- Пламя: всплывающие язычки ---------- */
  const tongueBaseMats = [
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xff9a24, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];
  const tongues = [];
  for (let i = 0; i < 6; i++) {
    const s = rnd(0.65, 1.05) * unit;
    const mat = tongueBaseMats[i % tongueBaseMats.length].clone();
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
    m.userData = {
      phase: Math.random(),
      period: rnd(0.9, 1.9),
      offX: rnd(-0.022, 0.022),
      offZ: rnd(-0.022, 0.022),
    };
    torchGroup.add(m);
    tongues.push(m);
  }

  /* ---------- Спрайты-свечение ---------- */
  const glowTex = radialGlowTexture(128, [
    [0.00, 'rgba(255,255,255,1)'],
    [0.20, 'rgba(255,238,170,0.9)'],
    [0.48, 'rgba(255,170,55,0.38)'],
    [1.00, 'rgba(255,120,0,0)'],
  ]);

  const glowInner = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xfff2c0,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9,
  }));
  glowInner.position.set(0, TIP_Y + 0.02, 0);
  glowInner.scale.setScalar(0.52);
  torchGroup.add(glowInner);

  const glowOuter = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xff9a30,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.5,
  }));
  glowOuter.position.set(0, TIP_Y + 0.02, 0);
  glowOuter.scale.setScalar(1.35);
  torchGroup.add(glowOuter);

  /* ---------- Точечные источники ---------- */
  const torchLight = new THREE.PointLight(0xffa64d, 5.2, 12, 2);
  torchLight.position.set(0, TIP_Y + 0.03, 0);
  torchGroup.add(torchLight);

  const baseLight = new THREE.PointLight(0xff7a22, 0.65, 4, 2);
  baseLight.position.set(0, 0.18, 0);
  torchGroup.add(baseLight);

  /* ---------- Световое пятно на земле ---------- */
  let pool = null;
  if (showPool) {
    const poolTex = radialGlowTexture(256, [
      [0.00, 'rgba(255,190,90,0.60)'],
      [0.32, 'rgba(255,150,50,0.28)'],
      [0.68, 'rgba(255,110,20,0.09)'],
      [1.00, 'rgba(255,90,0,0)'],
    ]);
    pool = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({
        map: poolTex, transparent: true, opacity: 0.62,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.002;
    root.add(pool);
  }

  /* ---------- Частицы: искры ---------- */
  const emberPos = new Float32Array(emberCount * 3);
  const emberCol = new Float32Array(emberCount * 3);
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  emberGeo.setAttribute('color',    new THREE.BufferAttribute(emberCol, 3));

  const emberPoints = new THREE.Points(emberGeo, new THREE.PointsMaterial({
    size: 0.048, map: glowTex, vertexColors: true,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, sizeAttenuation: true, fog: false,
  }));
  emberPoints.frustumCulled = false;
  root.add(emberPoints);

  const EMBER_HOT  = [1.00, 0.96, 0.72];
  const EMBER_MID  = [1.00, 0.52, 0.09];
  const EMBER_COLD = [0.32, 0.05, 0.00];

  /* ---------- Частицы: дым ---------- */
  const smokePos = new Float32Array(smokeCount * 3);
  const smokeCol = new Float32Array(smokeCount * 4);  // RGBA
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  smokeGeo.setAttribute('color',    new THREE.BufferAttribute(smokeCol, 4));

  const smokeTex = radialGlowTexture(64, [
    [0.00, 'rgba(255,255,255,0.95)'],
    [0.50, 'rgba(255,255,255,0.35)'],
    [1.00, 'rgba(255,255,255,0)'],
  ]);
  const smokePoints = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
    size: 0.17, map: smokeTex, vertexColors: true, transparent: true,
    opacity: 0.55, depthWrite: false, sizeAttenuation: true, fog: false,
  }));
  smokePoints.frustumCulled = false;
  root.add(smokePoints);

  const SMOKE_FRESH = [0.34, 0.34, 0.37];
  const SMOKE_OLD   = [0.08, 0.08, 0.10];

  /* ========================= ЭМИТТЕР =========================
     Положение кончика факела в системе координат root.          */
  const emitterPos = new THREE.Vector3();
  function updateEmitter() {
    const th = torchGroup.rotation.z;
    emitterPos.set(
      torchGroup.position.x - Math.sin(th) * TIP_Y,
      torchGroup.position.y + Math.cos(th) * TIP_Y,
      torchGroup.position.z
    );
  }

  /* ========================= ЧАСТИЦЫ ========================= */
  const emberData = [];
  function initEmber(d, spread) {
    d.maxLife = rnd(0.8, 2.2);
    d.life = spread ? rnd(0.05, d.maxLife) : d.maxLife;
    const a = rnd(0, Math.PI * 2), r = rnd(0, 0.035);
    d.x = emitterPos.x + Math.cos(a) * r;
    d.z = emitterPos.z + Math.sin(a) * r;
    d.y = emitterPos.y + rnd(-0.02, 0.06);
    d.vx = rnd(-0.10, 0.10);
    d.vz = rnd(-0.10, 0.10);
    d.vy = rnd(0.18, 0.60);
    d.swirlAmp = rnd(0.006, 0.03);
    d.phase = Math.random() * 10;
    if (spread) {
      const e = d.maxLife - d.life;
      d.x += d.vx * e; d.y += d.vy * e; d.z += d.vz * e;
    }
  }
  for (let i = 0; i < emberCount; i++) {
    const d = {}; initEmber(d, true); emberData.push(d);
  }

  const smokeData = [];
  function initSmoke(d, spread) {
    d.maxLife = rnd(2.4, 4.4);
    d.life = spread ? rnd(0.1, d.maxLife) : d.maxLife;
    d.x = emitterPos.x + rnd(-0.03, 0.03);
    d.z = emitterPos.z + rnd(-0.03, 0.03);
    d.y = emitterPos.y + rnd(0.08, 0.16);
    d.vx = rnd(-0.03, 0.03);
    d.vz = rnd(-0.03, 0.03);
    d.vy = rnd(0.08, 0.22);
    d.phase = Math.random() * 10;
    d.wob = rnd(0.01, 0.035);
    if (spread) {
      const e = d.maxLife - d.life;
      d.x += d.vx * e; d.y += d.vy * e; d.z += d.vz * e;
    }
  }
  for (let i = 0; i < smokeCount; i++) {
    const d = {}; initSmoke(d, true); smokeData.push(d);
  }

  function updateEmbers(time, dt, intensity) {
    const active = intensity > 0.25;
    for (let i = 0; i < emberCount; i++) {
      const d = emberData[i];
      d.life -= dt;
      if (d.life <= 0) {
        if (active) initEmber(d, false);
        else {
          const o = i * 3;
          emberPos[o] = 0; emberPos[o+1] = -100; emberPos[o+2] = 0;
          emberCol[o] = 0; emberCol[o+1] = 0; emberCol[o+2] = 0;
          continue;
        }
      }
      d.x += (d.vx + Math.sin(time * 2.4 + d.phase) * d.swirlAmp) * dt;
      d.z += (d.vz + Math.cos(time * 2.1 + d.phase) * d.swirlAmp) * dt;
      d.y += d.vy * dt;
      d.vx *= (1 - 0.7 * dt);
      d.vz *= (1 - 0.7 * dt);
      d.vy *= (1 - 0.35 * dt);

      const k = Math.max(0, d.life / d.maxLife);
      const age = 1 - k;
      const col = age < 0.4 ? mixC(EMBER_HOT, EMBER_MID, age / 0.4)
                            : mixC(EMBER_MID, EMBER_COLD, (age - 0.4) / 0.6);
      const fade = Math.min(1, k * 4.0) * Math.min(1, age * 8.0 + 0.25) * intensity;

      const o = i * 3;
      emberPos[o]     = d.x;
      emberPos[o + 1] = d.y;
      emberPos[o + 2] = d.z;
      emberCol[o]     = col[0] * fade;
      emberCol[o + 1] = col[1] * fade;
      emberCol[o + 2] = col[2] * fade;
    }
    emberGeo.attributes.position.needsUpdate = true;
    emberGeo.attributes.color.needsUpdate = true;
  }

  function updateSmoke(time, dt, intensity) {
    const active = intensity > 0.12;
    for (let i = 0; i < smokeCount; i++) {
      const d = smokeData[i];
      d.life -= dt;
      if (d.life <= 0) {
        if (active) initSmoke(d, false);
        else {
          const o = i * 3;
          smokePos[o] = 0; smokePos[o+1] = -100; smokePos[o+2] = 0;
          const c = i * 4;
          smokeCol[c] = 0; smokeCol[c+1] = 0; smokeCol[c+2] = 0; smokeCol[c+3] = 0;
          continue;
        }
      }
      d.x += (d.vx + Math.sin(time * 1.3 + d.phase) * d.wob) * dt;
      d.z += (d.vz + Math.cos(time * 1.1 + d.phase) * d.wob) * dt;
      d.y += d.vy * dt;

      const k = Math.max(0, d.life / d.maxLife);
      const age = 1 - k;
      const col = mixC(SMOKE_FRESH, SMOKE_OLD, age);
      const alpha = Math.min(1, k * 2.5) * Math.min(1, age * 10) * Math.max(0.15, intensity);

      const po = i * 3;
      smokePos[po]     = d.x;
      smokePos[po + 1] = d.y;
      smokePos[po + 2] = d.z;
      const co = i * 4;
      smokeCol[co]     = col[0];
      smokeCol[co + 1] = col[1];
      smokeCol[co + 2] = col[2];
      smokeCol[co + 3] = alpha;
    }
    smokeGeo.attributes.position.needsUpdate = true;
    smokeGeo.attributes.color.needsUpdate = true;
  }

  /* ========================= СОСТОЯНИЯ ========================= */
  const states = {
    ground:      { pos: origin.clone(),        rotZ: 0,             fire: 1 },
    wall:        { pos: wallPos.clone(),       rotZ: wallTiltZ,     fire: 1 },
    extinguished:{                                               fire: 0 },
  };

  let currentState    = initialState;
  let fireIntensity   = 1;
  let targetFire      = 1;
  const targetPos     = origin.clone();
  let targetRotZ      = 0;

  // Применяем стартовое состояние
  {
    const st = states[initialState];
    if (st.pos)  torchGroup.position.copy(st.pos);
    if (st.rotZ !== undefined) torchGroup.rotation.z = st.rotZ;
    targetPos.copy(torchGroup.position);
    targetRotZ = torchGroup.rotation.z;
    targetFire = st.fire;
    fireIntensity = st.fire;
  }

  function setState(name) {
    if (!states[name]) return;
    currentState = name;
    const st = states[name];
    if (name !== 'extinguished') {
      targetPos.copy(st.pos);
      targetRotZ = st.rotZ;
    }
    targetFire = st.fire;
  }

  /* ========================= МЕРЦАНИЕ ========================= */
  let flicker = 1, flickerTarget = 1, flickerTimer = 0;

  /* ========================= ПЛАМЯ ========================= */
  function animateFlame(time, intensity) {
    for (const v of flameVoxels) {
      const ph = v.userData.phase;
      v.position.y = v.userData.baseY
        + Math.sin(time * 14 + ph) * 0.0018 * intensity
        + Math.sin(time * 27 + ph * 2) * 0.0008 * intensity;
      const s = (1 + Math.sin(time * 18 + ph) * 0.07 + Math.sin(time * 33 + ph * 3) * 0.04) * intensity;
      v.scale.setScalar(s);
      v.material.color.setHSL(
        0.10 + 0.025 * Math.sin(time * 4.5 + ph),
        0.95,
        (0.62 + 0.07 * Math.sin(time * 7.2 + ph * 1.7)) * intensity
      );
      v.material.opacity = intensity;
    }
    for (const g of glowCubes) {
      const d = g.userData;
      g.position.y = d.baseY + Math.sin(time * d.speed + d.phase) * 0.004;
      g.rotation.y = time * 0.4 + d.phase;
      g.rotation.x = time * 0.25 + d.phase * 1.3;
      g.material.opacity = d.baseOpacity * (0.7 + 0.3 * Math.sin(time * 5 + d.phase)) * intensity;
      g.scale.setScalar(0.3 + 0.7 * intensity);
    }
    for (const tg of tongues) {
      const d = tg.userData;
      const cyc = ((time / d.period) + d.phase) % 1;
      const env = Math.sin(cyc * Math.PI);
      tg.position.set(
        d.offX * Math.sin(time * 2.0 + d.phase * 6),
        TIP_Y - 0.01 + cyc * 0.10,
        d.offZ * Math.cos(time * 2.3 + d.phase * 6)
      );
      tg.scale.setScalar((0.45 + env * 0.95) * intensity);
      tg.material.opacity = env * 0.85 * intensity;
      tg.rotation.y = time * 1.5 + d.phase * 6;
    }
  }

  /* ========================= UPDATE ========================= */
  let time = 0;

  function update(dt) {
    time += dt;

    // Плавный переход положения/поворота/огня
    torchGroup.position.lerp(targetPos, damp(5, dt));
    torchGroup.rotation.z += (targetRotZ - torchGroup.rotation.z) * damp(5, dt);
    fireIntensity += (targetFire - fireIntensity) * damp(3.5, dt);

    // Куда указывает кончик (для частиц)
    updateEmitter();

    // Мерцание
    flickerTimer -= dt;
    if (flickerTimer <= 0) {
      flickerTimer = rnd(0.03, 0.11);
      flickerTarget = rnd(0.72, 1.18);
    }
    flicker += (flickerTarget - flicker) * Math.min(1, dt * 10);

    const f = Math.max(0.5, flicker * (1 + 0.04 * Math.sin(time * 27.3) + 0.03 * Math.sin(time * 43.1 + 1.7)));
    const fi = fireIntensity;

    torchLight.intensity = 5.2 * f * fi;
    baseLight.intensity  = 0.65 * f * fi;
    torchLight.position.x = Math.sin(time * 13.7) * 0.006 * fi;
    torchLight.position.z = Math.cos(time * 11.3) * 0.006 * fi;

    glowInner.material.opacity = clamp01(0.85 * f) * fi;
    glowOuter.material.opacity = clamp01(0.50 * f) * fi;
    glowInner.scale.setScalar(0.52 * (1 + 0.18 * (f - 1)) * (0.3 + 0.7 * fi));
    glowOuter.scale.setScalar(1.35 * (1 + 0.12 * (f - 1)) * (0.3 + 0.7 * fi));

    for (const m of charMats) m.emissiveIntensity = fi;

    if (pool) {
      pool.position.x += (emitterPos.x - pool.position.x) * damp(4, dt);
      pool.position.z += (emitterPos.z - pool.position.z) * damp(4, dt);
      pool.material.opacity = clamp01(0.62 + 0.30 * (f - 1)) * fi;
      pool.scale.setScalar(1 + 0.04 * (f - 1));
    }

    animateFlame(time, fi);
    updateEmbers(time, dt, fi);
    updateSmoke(time, dt, fi);
  }

  /* ========================= DISPOSE ========================= */
  function dispose() {
    const geos = new Set(), mats = new Set(), texes = new Set();
    root.traverse(o => {
      if (o.geometry) geos.add(o.geometry);
      if (o.material) {
        const arr = Array.isArray(o.material) ? o.material : [o.material];
        arr.forEach(m => {
          mats.add(m);
          if (m.map) texes.add(m.map);
        });
      }
    });
    geos.forEach(g => g.dispose());
    mats.forEach(m => m.dispose());
    texes.forEach(t => t.dispose());
  }

  // Инициализируем эмиттер для первого кадра
  updateEmitter();

  return {
    root,        // THREE.Group — добавьте в сцену
    setState,    // setState('ground' | 'wall' | 'extinguished')
    update,      // update(dt) — вызвать в цикле
    dispose,
    get state() { return currentState; },
  };
}