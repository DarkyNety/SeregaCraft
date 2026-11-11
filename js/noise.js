// js/noise.js

import * as THREE from 'three';

export class SimpleNoise {
    constructor(seed = 42) {
        this.perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        let s = seed;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807) % 2147483647;
            const j = s % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    grad3d(h, x, y, z) {
        const hh = h & 15;
        const u = hh < 8 ? x : y;
        const v = hh < 4 ? y : (hh === 12 || hh === 14 ? x : z);
        return ((hh & 1) ? -u : u) + ((hh & 2) ? -v : v);
    }

    noise3D(x, y, z) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const Z = Math.floor(z) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const zf = z - Math.floor(z);
        const u = this.fade(xf);
        const v = this.fade(yf);
        const w = this.fade(zf);
        const p = this.perm;
        const aaa = p[p[p[X] + Y] + Z];
        const aba = p[p[p[X] + Y + 1] + Z];
        const aab = p[p[p[X] + Y] + Z + 1];
        const abb = p[p[p[X] + Y + 1] + Z + 1];
        const baa = p[p[p[X + 1] + Y] + Z];
        const bba = p[p[p[X + 1] + Y + 1] + Z];
        const bab = p[p[p[X + 1] + Y] + Z + 1];
        const bbb = p[p[p[X + 1] + Y + 1] + Z + 1];
        return this.lerp(
            w,
            this.lerp(
                v,
                this.lerp(u, this.grad3d(aaa, xf, yf, zf), this.grad3d(baa, xf - 1, yf, zf)),
                this.lerp(u, this.grad3d(aba, xf, yf - 1, zf), this.grad3d(bba, xf - 1, yf - 1, zf))
            ),
            this.lerp(
                v,
                this.lerp(u, this.grad3d(aab, xf, yf, zf - 1), this.grad3d(bab, xf - 1, yf, zf - 1)),
                this.lerp(u, this.grad3d(abb, xf, yf - 1, zf - 1), this.grad3d(bbb, xf - 1, yf - 1, zf - 1))
            )
        );
    }

    noise2D(x, y) {
        return this.noise3D(x, y, 0);
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    fractal2D(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let value = 0;
    let amp = 1;
    let freq = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
        value += amp * this.noise2D(x * freq, y * freq);
        maxAmp += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return value / maxAmp;
}}

const cloudVertexShader = `
  varying vec3 vWorldPos;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = `
  uniform float time;
  uniform vec3 cameraPos;
  varying vec3 vWorldPos;
  
  // Простейшая реализация 3D-шума на GLSL (здесь можно использовать ваш SimpleNoise)
  float hash(vec3 p) { /* ... */ }
  float noise3D(vec3 p) { /* фрактальный шум */ }
  
  float fbm(vec3 p) {
    float value = 0.0, amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise3D(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  void main() {
    vec3 direction = normalize(vWorldPos - cameraPos);
    float cloud = 0.0;
    // Рей‑маршинг в слое от 200 до 500 единиц от камеры
    float t = 200.0;
    for (int i = 0; i < 50; i++) {
      vec3 pos = cameraPos + direction * t;
      float density = fbm(pos * 0.002 + time * 0.01);
      cloud += density * 0.1;
      t += 10.0;
      if (cloud > 1.0) break;
    }
    cloud = clamp(cloud, 0.0, 1.0);
    // Альфа-канал для прозрачности
    gl_FragColor = vec4(1.0, 1.0, 1.0, cloud * 0.6);
  }
`;

// const cloudSphere = new THREE.Mesh(
//   new THREE.SphereGeometry(800, 32, 32),
//   new THREE.ShaderMaterial({
//     vertexShader: cloudVertexShader,
//     fragmentShader: cloudFragmentShader,
//     uniforms: {
//       time: { value: 0 },
//       cameraPos: { value: camera.position }
//     },
//     transparent: true,
//     depthWrite: false,
//     side: THREE.FrontSide
//   })
// );
// scene.add(cloudSphere);

// Экспортируем готовый экземпляр с фиксированным seed (как в оригинале)
export function createNoise(seed) {
    return new SimpleNoise(seed);
}