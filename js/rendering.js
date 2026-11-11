// js/rendering.js
import * as THREE from 'three';
import { createTextureAtlas } from './textures.js';
import { TEX_GRASS_PLANT, TEX_COLS, ATLAS_HEIGHT, TEX_CELL } from './constants.js';

// ----- Post-processing (three.js addons) -----
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// ---------- Экспортируемые переменные ----------
export let scene;
export let camera;
export let renderer;
export let materials;
export let atlasCanvas;
export let sunMesh;
export let sunDirection = new THREE.Vector3(0, 1, 0);

// ---------- Внутренние переменные ----------
let sunLight;
let moonLight;
let ambientLight;
let hemiLight;
let moonMesh;
const SKY_DIST = 900;
const SHADOW_DIST = 120;

// Пост-обработка
let composer;
let bloomPass;
let godRaysPass;
let smaaPass;

// Небо
let skyMesh;
let skyMaterial;
let skyUniforms;

// Отражения
let pmremGenerator;
let envRenderTarget = null;
let lastEnvUpdateTime = -100;
const ENV_UPDATE_INTERVAL = 4.0;
let envScene;
let envSkyMesh;

// Блики
let lensFlareGroup;
let lensFlareSprites = [];

// ---------- Ветер / общий таймер ----------
const TEX_ROWS = ATLAS_HEIGHT / TEX_CELL;                          // 16
const GRASS_ROW = Math.floor(TEX_GRASS_PLANT / TEX_COLS);          // 0
const GRASS_V_MIN = GRASS_ROW / TEX_ROWS;                          // 0.0

const windUniforms = {
    uTime:          { value: 0 },
    uWindStrength:  { value: 1.0 },
    uGrassVMin:     { value: GRASS_V_MIN },
};
let windElapsed = 0;
let windLastPerf = 0;

// ---------- Sky shader ----------
const skyVertexShader = /* glsl */`
    varying vec3 vDir;
    void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const skyFragmentShader = /* glsl */`
    uniform vec3 topColor;
    uniform vec3 horizonColor;
    uniform vec3 bottomColor;
    uniform vec3 sunDir;
    uniform vec3 sunColor;
    uniform float sunIntensity;
    varying vec3 vDir;

    void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;

        vec3 col = mix(horizonColor, topColor, smoothstep(0.0, 0.7, h));
        col = mix(col, bottomColor, smoothstep(0.0, -0.4, h));

        float sunDot = max(dot(dir, sunDir), 0.0);
        float glow = pow(sunDot, 64.0) * 3.0
                   + pow(sunDot, 8.0)  * 0.35
                   + pow(sunDot, 2.0)  * 0.08;
        col += sunColor * glow * sunIntensity;

        float disk = smoothstep(0.9997, 0.99995, sunDot);
        col += sunColor * disk * 15.0 * sunIntensity;

        float moonDot = max(dot(dir, -sunDir), 0.0);
        col += vec3(0.6, 0.7, 1.0) * pow(moonDot, 32.0) * 0.15 * (1.0 - sunIntensity);

        gl_FragColor = vec4(col, 1.0);
    }
`;

// ---------- God rays shader ----------
const GodRaysShader = {
    uniforms: {
        tDiffuse:     { value: null },
        sunScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
        sunOnScreen:  { value: 0.0 },
        rayStrength:  { value: 0.55 },
        sunColor:     { value: new THREE.Color(0xffaa55) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec2  sunScreenPos;
        uniform float sunOnScreen;
        uniform float rayStrength;
        uniform vec3  sunColor;
        varying vec2 vUv;

        void main() {
            vec4 base = texture2D(tDiffuse, vUv);
            if (sunOnScreen < 0.01) { gl_FragColor = base; return; }

            vec2 deltaUV = vUv - sunScreenPos;
            float distFromSun = length(deltaUV);

            const int SAMPLES = 24;
            vec2 stepUV = deltaUV / float(SAMPLES);
            vec2 sampleUV = vUv;
            vec3  accum = vec3(0.0);
            float weightSum = 0.0;

            for (int i = 0; i < SAMPLES; i++) {
                sampleUV -= stepUV;
                vec3 c = texture2D(tDiffuse, sampleUV).rgb;
                float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
                float mask = smoothstep(0.55, 1.4, lum);
                float w = exp(-float(i) * 0.12);
                accum += c * mask * w;
                weightSum += w;
            }
            accum /= max(weightSum, 0.001);

            float fade = 1.0 - smoothstep(0.0, 0.9, distFromSun);
            vec3 rays = accum * sunColor * rayStrength * sunOnScreen * fade;
            gl_FragColor = vec4(base.rgb + rays, base.a);
        }
    `
};

// ---------- Текстуры ----------
function createSunTexture(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const h = size / 2;
    const g = ctx.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(0.5, '#ffe8a0');
    g.addColorStop(0.85, '#ffbb44');
    g.addColorStop(1, '#ff6622');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
}

function createMoonTexture(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#d8dce8';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * size, y = Math.random() * size, r = Math.random() * 12 + 2;
        ctx.fillStyle = `rgba(140,150,170,${Math.random() * 0.35 + 0.15})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * size, y = Math.random() * size, r = Math.random() * 4 + 1;
        ctx.fillStyle = `rgba(230,235,245,${Math.random() * 0.4 + 0.2})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    return c;
}

function createFlareTexture(type, size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const h = size / 2;
    ctx.globalCompositeOperation = 'lighter';
    if (type === 'glow') {
        const g = ctx.createRadialGradient(h, h, 0, h, h, h);
        g.addColorStop(0, 'rgba(255,250,220,1)');
        g.addColorStop(0.2, 'rgba(255,210,120,0.8)');
        g.addColorStop(0.5, 'rgba(255,140,60,0.3)');
        g.addColorStop(1, 'rgba(255,80,20,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    } else if (type === 'ring') {
        ctx.strokeStyle = 'rgba(255,220,160,0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(h, h, h * 0.65, 0, Math.PI * 2); ctx.stroke();
    } else if (type === 'spike') {
        for (let i = 0; i < 16; i++) {
            ctx.save();
            ctx.translate(h, h);
            ctx.rotate((i / 16) * Math.PI * 2);
            const g = ctx.createLinearGradient(0, -h, 0, h);
            g.addColorStop(0, 'rgba(255,220,160,0)');
            g.addColorStop(0.5, 'rgba(255,230,180,0.7)');
            g.addColorStop(1, 'rgba(255,220,160,0)');
            ctx.fillStyle = g;
            ctx.fillRect(-1, -h, 2, size);
            ctx.restore();
        }
    } else if (type === 'disc') {
        const g = ctx.createRadialGradient(h, h, 0, h, h, h * 0.7);
        g.addColorStop(0, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.5, 'rgba(220,220,255,0.3)');
        g.addColorStop(1, 'rgba(120,120,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    }
    return new THREE.CanvasTexture(c);
}

function initLensFlares() {
    lensFlareGroup = new THREE.Group();
    lensFlareGroup.renderOrder = 999;
    lensFlareGroup.frustumCulled = false;
    scene.add(lensFlareGroup);

    const types   = ['glow', 'ring', 'spike', 'disc', 'glow', 'ring'];
    const scales  = [0.06, 0.04, 0.10, 0.05, 0.02, 0.03];
    const offsets = [0.0, -0.25, -0.55, -0.15, -0.75, -0.35];

    for (let i = 0; i < types.length; i++) {
        const tex = createFlareTexture(types[i], 128);
        const mat = new THREE.SpriteMaterial({
            map: tex,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            transparent: true,
            opacity: 0.4,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(20, 20, 1);
        sprite.userData.offset = offsets[i];
        sprite.userData.baseScale = scales[i];
        lensFlareGroup.add(sprite);
        lensFlareSprites.push(sprite);
    }
}

// ---------- ВЕТЕР: шейдеры травы и листвы ----------
function patchGrassWind(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime         = windUniforms.uTime;
        shader.uniforms.uWindStrength = windUniforms.uWindStrength;
        shader.uniforms.uGrassVMin    = windUniforms.uGrassVMin;

        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', /* glsl */`
                #include <common>
                uniform float uTime;
                uniform float uWindStrength;
                uniform float uGrassVMin;
            `)
            .replace('#include <begin_vertex>', /* glsl */`
                #include <begin_vertex>

                vec4 _wp = modelMatrix * vec4(position, 1.0);
                vec3 _world = _wp.xyz;

                float height01 = clamp(1.0 - (uv.y - uGrassVMin) * 16.0, 0.0, 1.0);
                height01 = height01 * height01;

                float t1 = uTime * 1.4 + _world.x * 0.5 + _world.z * 0.5;
                float t2 = uTime * 2.3 + _world.x * 1.1 + _world.z * 0.9 + 1.7;

                float windX = (sin(t1) + sin(t2) * 0.4) * uWindStrength;
                float windZ = (cos(t1 * 0.9 + 0.8)
                             + cos(t2 * 0.85 + 1.3) * 0.4) * uWindStrength * 0.7;

                transformed.x += windX * height01 * 0.18;
                transformed.z += windZ * height01 * 0.18;
            `);
    };
    material.customProgramCacheKey = () => 'grass-wind';
}

function patchLeavesWind(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime         = windUniforms.uTime;
        shader.uniforms.uWindStrength = windUniforms.uWindStrength;

        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', /* glsl */`
                #include <common>
                uniform float uTime;
                uniform float uWindStrength;
            `)
            .replace('#include <begin_vertex>', /* glsl */`
                #include <begin_vertex>

                vec4 _wp = modelMatrix * vec4(position, 1.0);
                vec3 _world = _wp.xyz;

                float t1 = uTime * 0.9  + _world.x * 0.15 + _world.z * 0.15 + _world.y * 0.25;
                float t2 = uTime * 1.7  + _world.x * 0.35 + _world.z * 0.3  + _world.y * 0.15;

                float sway = (sin(t1) * 0.7 + cos(t2) * 0.3) * uWindStrength;

                transformed.x += sway * 0.055;
                transformed.z += sway * 0.035;
            `);
    };
    material.customProgramCacheKey = () => 'leaves-wind';
}

// ---------- ФАКЕЛ: мерцание пламени ----------
function createTorchFlameMaterial() {
    const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        toneMapped: true,
    //side: THREE.DoubleSide, // <--- ДОБАВЛЕНО, ЧТОБЫ НЕ БЫЛО ВЫВЕРНУТО
    });
    mat.onBeforeCompile = (shader) => {
        // Общий таймер с ветром
        shader.uniforms.uTorchTime = windUniforms.uTime;

        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', /* glsl */`
                #include <common>
                varying vec3 vTorchWp;
            `)
            .replace('#include <begin_vertex>', /* glsl */`
                #include <begin_vertex>
                vec4 _twp = modelMatrix * vec4(position, 1.0);
                vTorchWp = _twp.xyz;
            `);

        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', /* glsl */`
                #include <common>
                uniform float uTorchTime;
                varying vec3 vTorchWp;
            `)
            .replace('#include <dithering_fragment>', /* glsl */`
                #include <dithering_fragment>
                float _tseed = dot(vTorchWp, vec3(12.9898, 78.233, 37.719));
                float _tflick = 0.82
                    + 0.10 * sin(uTorchTime * 12.0 + _tseed)
                    + 0.06 * sin(uTorchTime * 27.0 + _tseed * 2.0)
                    + 0.03 * sin(uTorchTime * 43.0 + _tseed * 3.0);
                gl_FragColor.rgb *= _tflick;
            `);
    };
    mat.customProgramCacheKey = () => 'torch-flame-flicker';
    return mat;
}

// ---------- Обновление env-map ----------
function updateEnvironmentMap(nowSec) {
    if (!pmremGenerator || !skyMaterial || !envScene) return;
    if (nowSec - lastEnvUpdateTime < ENV_UPDATE_INTERVAL) return;
    lastEnvUpdateTime = nowSec;
    if (envRenderTarget) envRenderTarget.dispose();
    envRenderTarget = pmremGenerator.fromScene(envScene, 0.04, 0.1, 200);
    scene.environment = envRenderTarget.texture;
}

// ---------- Инициализация ----------
export async function initRendering() {
    scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x87CEEB, 50, 160);

    camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);

    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    // ---------- Свет ----------
    sunLight = new THREE.DirectionalLight(0xffeedd, 5.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(4096, 4096);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 350;
    sunLight.shadow.camera.left = -80;
    sunLight.shadow.camera.right = 80;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    sunLight.shadow.radius = 3;

    moonLight = new THREE.DirectionalLight(0x8899ff, 0.3);
    ambientLight = new THREE.AmbientLight(0x8899bb, 0.5);
    hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x556633, 0.3);
    scene.add(ambientLight, sunLight, moonLight, hemiLight);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ---------- Небо ----------
    skyUniforms = {
        topColor:     { value: new THREE.Color(0x3d7bca) },
        horizonColor: { value: new THREE.Color(0xbfd8f0) },
        bottomColor:  { value: new THREE.Color(0x4a5a70) },
        sunDir:       { value: new THREE.Vector3(0, 1, 0) },
        sunColor:     { value: new THREE.Color(0xffcc77) },
        sunIntensity: { value: 1.0 },
    };
    skyMaterial = new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        vertexShader: skyVertexShader,
        fragmentShader: skyFragmentShader,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
        depthTest: false,
    });
    skyMesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_DIST, 32, 16), skyMaterial);
    skyMesh.renderOrder = -1000;
    skyMesh.frustumCulled = false;
    scene.add(skyMesh);

    // ---------- Солнце ----------
    const sunTex = new THREE.CanvasTexture(createSunTexture(128));
    sunTex.colorSpace = THREE.SRGBColorSpace;
    const sunMat = new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, depthWrite: false });
    sunMat.fog = false;
    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), sunMat);
    sunMesh.renderOrder = -900;
    scene.add(sunMesh);

    const sunGlowMat = new THREE.MeshBasicMaterial({
        color: 0xffcc66, transparent: true, opacity: 0.10,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    sunGlowMat.fog = false;
    sunMesh.add(new THREE.Mesh(new THREE.SphereGeometry(30, 24, 12), sunGlowMat));

    // ---------- Луна ----------
    const moonTex = new THREE.CanvasTexture(createMoonTexture(128));
    moonTex.colorSpace = THREE.SRGBColorSpace;
    const moonMat = new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false });
    moonMat.fog = false;
    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 12), moonMat);
    moonMesh.renderOrder = -900;
    scene.add(moonMesh);

    const moonGlowMat = new THREE.MeshBasicMaterial({
        color: 0xaabbff, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false,
    });
    moonGlowMat.fog = false;
    moonMesh.add(new THREE.Mesh(new THREE.SphereGeometry(20, 24, 12), moonGlowMat));

    // ---------- Атлас ----------
    atlasCanvas = await createTextureAtlas();
    const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.NearestFilter;
    atlasTexture.flipY = false;
    atlasTexture.colorSpace = THREE.SRGBColorSpace;

    // ---------- Материалы ----------
    materials = {
        solid: new THREE.MeshStandardMaterial({
            map: atlasTexture, roughness: 0.75, metalness: 0.05,
            envMapIntensity: 0.4, side: THREE.FrontSide,
        }),
        water: new THREE.MeshStandardMaterial({
            map: atlasTexture, roughness: 0.15, metalness: 0.55,
            envMapIntensity: 1.0, side: THREE.FrontSide,
            transparent: true, opacity: 0.7, depthWrite: false,
        }),
        leaves: new THREE.MeshStandardMaterial({
            map: atlasTexture, roughness: 0.85, metalness: 0.0,
            envMapIntensity: 0.3, side: THREE.FrontSide, alphaTest: 0.1,
        }),
        grass: new THREE.MeshStandardMaterial({
            map: atlasTexture, roughness: 0.8, metalness: 0.0,
            envMapIntensity: 0.3, side: THREE.DoubleSide, alphaTest: 0.5,
        }),

        // ==== Факелы (воксельная геометрия внутри чанка) ====
        // torchTrunk: new THREE.MeshStandardMaterial({
        //     vertexColors: true,
        //     roughness: 0.9,
        //     metalness: 0.0,
        //     fog: true,
        //     side: THREE.DoubleSide, // <--- ИСПРАВЛЯЕТ ВЫВЕРНУТЫЕ ГРАНИ
        // }),
        // torchFlame: createTorchFlameMaterial(),
    };

    // Ветер на траве и листве
    patchGrassWind(materials.grass);
    patchLeavesWind(materials.leaves);

    // ---------- Отражения из неба ----------
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileCubemapShader();
    envScene = new THREE.Scene();
    envSkyMesh = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMaterial);
    envScene.add(envSkyMesh);
    updateEnvironmentMap(0);

    // ---------- Пост-обработка ----------
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight),
        0.35, 0.5, 0.9
    );
    composer.addPass(bloomPass);

    godRaysPass = new ShaderPass(GodRaysShader);
    composer.addPass(godRaysPass);

    composer.addPass(new OutputPass());

    smaaPass = new SMAAPass(
        innerWidth * renderer.getPixelRatio(),
        innerHeight * renderer.getPixelRatio()
    );
    composer.addPass(smaaPass);

    // Прокси renderer.render → composer.render (main.js не трогаем)
    let inComposer = false;
    const originalRender = renderer.render.bind(renderer);
    renderer.render = function (s, c) {
        if (inComposer) return originalRender(s, c);
        inComposer = true;
        try { composer.render(); } finally { inComposer = false; }
    };

    initLensFlares();

    // ---------- Resize ----------
    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
        if (composer) composer.setSize(innerWidth, innerHeight);
        if (smaaPass) smaaPass.setSize(
            innerWidth * renderer.getPixelRatio(),
            innerHeight * renderer.getPixelRatio()
        );
    });
}

// ---------- День/ночь + время ветра ----------
export function updateDayNightCycle(progress, cameraPos) {
    // --- ВРЕМЯ ДЛЯ ВЕТРА / ФАКЕЛОВ ---
    const now = performance.now() * 0.001;
    if (windLastPerf === 0) windLastPerf = now;
    let dtw = now - windLastPerf;
    windLastPerf = now;
    if (dtw < 0) dtw = 0;
    if (dtw > 0.1) dtw = 0.1;
    windElapsed += dtw;
    if (windElapsed > 1000) windElapsed -= 1000;
    windUniforms.uTime.value = windElapsed;
    // -----------------------------------

    const sunAngle = (progress - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle);

    const dayFactor    = THREE.MathUtils.smoothstep(sunHeight, -0.1, 0.25);
    const nightFactor  = 1.0 - dayFactor;
    const sunsetFactor = Math.exp(-Math.pow((sunHeight - 0.05) / 0.12, 2));

    sunDirection.set(-Math.cos(sunAngle), -sunHeight, 0).normalize();

    // Свет
    sunLight.intensity = 0.1 + dayFactor * 5.5;
    sunLight.color.setHSL(0.09 + sunsetFactor * 0.03, 0.85, 0.55 + dayFactor * 0.35);

    moonLight.intensity = 0.05 + nightFactor * 0.35;
    moonLight.color.setHSL(0.6, 0.35, 0.55 + nightFactor * 0.25);

    const ambientColor = new THREE.Color(0x8899bb).lerp(new THREE.Color(0x112244), nightFactor);
    ambientColor.lerp(new THREE.Color(0x885533), sunsetFactor * 0.7);
    ambientLight.color.copy(ambientColor);
    ambientLight.intensity = 0.2 + dayFactor * 0.55;
    hemiLight.color.copy(ambientColor);
    hemiLight.intensity = 0.15 + dayFactor * 0.25;

    // Небо
    const dayTop      = new THREE.Color(0x3d7bca);
    const dayHorizon  = new THREE.Color(0xbfd8f0);
    const dayBottom   = new THREE.Color(0x4a5a70);
    const nightTop    = new THREE.Color(0x000814);
    const nightHoriz  = new THREE.Color(0x1a2540);
    const nightBottom = new THREE.Color(0x0a0f1a);
    const sunsetTop   = new THREE.Color(0x663377);
    const sunsetHoriz = new THREE.Color(0xff9955);

    const topColor     = dayTop.clone().lerp(nightTop, nightFactor).lerp(sunsetTop, sunsetFactor * 0.7);
    const horizonColor = dayHorizon.clone().lerp(nightHoriz, nightFactor).lerp(sunsetHoriz, sunsetFactor * 0.9);
    const bottomColor  = dayBottom.clone().lerp(nightBottom, nightFactor);

    skyUniforms.topColor.value.copy(topColor);
    skyUniforms.horizonColor.value.copy(horizonColor);
    skyUniforms.bottomColor.value.copy(bottomColor);
    skyUniforms.sunDir.value.copy(sunDirection).negate();
    skyUniforms.sunColor.value.setHSL(0.08, 0.9, 0.65);
    skyUniforms.sunIntensity.value = dayFactor;

    // Туман
    scene.fog.color.copy(horizonColor);
    scene.fog.near = 50 - nightFactor * 20;
    scene.fog.far  = 160 - nightFactor * 40;

    sunMesh.visible  = sunHeight > -0.2;
    moonMesh.visible = sunHeight < 0.2;

    // Пост-обработка
    if (bloomPass) {
        bloomPass.strength = 0.22 + dayFactor * 0.18 + sunsetFactor * 0.12;
        bloomPass.radius   = 0.4 + sunsetFactor * 0.25;
    }
    if (godRaysPass) {
        godRaysPass.uniforms.rayStrength.value = 0.35 + sunsetFactor * 0.45;
        godRaysPass.uniforms.sunColor.value.setHSL(0.08, 0.85, 0.65);
    }

    // Отражения
    updateEnvironmentMap(performance.now() / 1000);
}

// ---------- Небесные тела ----------
export function updateSkyObjects(cameraPos) {
    sunMesh.position.copy(cameraPos).addScaledVector(sunDirection.clone().negate(), SKY_DIST);
    moonMesh.position.copy(cameraPos).addScaledVector(sunDirection, SKY_DIST);
    if (skyMesh) skyMesh.position.copy(cameraPos);
}

// ---------- Теневая камера ----------
export function updateShadowCamera(targetPos) {
    if (!sunLight) return;
    const sourcePos = targetPos.clone().addScaledVector(sunDirection.clone().negate(), SHADOW_DIST);
    sunLight.position.copy(sourcePos);
    sunLight.target.position.copy(targetPos);
    sunLight.target.updateMatrixWorld();

    if (moonLight) {
        const moonSourcePos = targetPos.clone().addScaledVector(sunDirection, SHADOW_DIST);
        moonLight.position.copy(moonSourcePos);
        moonLight.target.position.copy(targetPos);
        moonLight.target.updateMatrixWorld();
    }
}

// ---------- God rays + lens flares ----------
export function updateLensFlares(camera, sunWorldPos) {
    // --- God rays ---
    if (godRaysPass && sunMesh) {
        const sunScreen = sunWorldPos.clone().project(camera);
        const visible =
            sunScreen.z < 1.0 && sunScreen.z > 0.0 &&
            Math.abs(sunScreen.x) < 1.3 && Math.abs(sunScreen.y) < 1.3 &&
            sunMesh.visible && sunDirection.y > -0.15;

        if (visible) {
            const uvX = (sunScreen.x + 1) * 0.5;
            const uvY = (sunScreen.y + 1) * 0.5;
            godRaysPass.uniforms.sunScreenPos.value.set(uvX, uvY);

            const edgeFade = 1.0 - Math.max(0,
                Math.max(Math.abs(sunScreen.x), Math.abs(sunScreen.y)) - 0.75) * 4.0;
            const horizonFade = THREE.MathUtils.smoothstep(sunDirection.y, -0.15, 0.1);
            godRaysPass.uniforms.sunOnScreen.value =
                Math.max(0, Math.min(1, edgeFade)) * horizonFade;
        } else {
            godRaysPass.uniforms.sunOnScreen.value = 0;
        }
    }

    // --- Lens flares ---
    if (!lensFlareGroup) return;

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const toSun = sunWorldPos.clone().sub(camera.position).normalize();
    const aimDot = camDir.dot(toSun);
    const aimFactor = THREE.MathUtils.smoothstep(aimDot, 0.95, 0.995);

    if (aimFactor <= 0.001 || !sunMesh.visible) {
        lensFlareGroup.visible = false;
        return;
    }

    const s = sunWorldPos.clone().project(camera);
    if (s.z > 1 || s.z < 0 || Math.abs(s.x) > 1.3 || Math.abs(s.y) > 1.3) {
        lensFlareGroup.visible = false;
        return;
    }

    lensFlareGroup.visible = true;
    lensFlareGroup.children.forEach(sp => {
        sp.material.opacity = 0.4 * aimFactor;
    });

    const center = new THREE.Vector2(0, 0);
    const pos2D  = new THREE.Vector2(s.x, s.y);
    const dir    = center.clone().sub(pos2D).normalize();
    const dist   = pos2D.distanceTo(center);

    lensFlareSprites.forEach(sp => {
        const p = pos2D.clone().add(dir.clone().multiplyScalar(dist * sp.userData.offset));
        const v = new THREE.Vector3(p.x, p.y, 0.5).unproject(camera);
        sp.position.copy(v);
        const screenH = camera.position.distanceTo(sp.position)
                      * Math.tan(camera.fov * Math.PI / 360) * 2;
        const scale = screenH * sp.userData.baseScale * 30;
        sp.scale.set(scale, scale, 1);
    });
}