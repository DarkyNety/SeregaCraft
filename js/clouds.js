// js/clouds.js
import * as THREE from 'three';
import { SimpleNoise } from './noise.js';
const cloudNoise = new SimpleNoise(137);

let cloudPlane;
const PLANE_SIZE = 6000;
const PLANE_HEIGHT = 300;

// Генерируем текстуру облаков через CPU‑шум (один раз)
function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(512, 512);
    const centerX = 256, centerY = 256;
    const maxDist = 256 * 0.8; // начинаем затухать на 80% радиуса

    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const wx = (x / 512 - 0.5) * 10;
            const wy = (y / 512 - 0.5) * 10;
            // FBM‑шум
            let v = 0, amp = 0.5, freq = 1;
            for (let i = 0; i < 4; i++) {
                v += amp * this.noise.noise3D(wx * freq, wy * freq, 0);
                freq *= 2;
                amp *= 0.5;
            }
            let cloudAlpha = (v * 0.5 + 0.5); // 0..1

            // Радиальное затухание: чем дальше от центра, тем прозрачнее
            const dx = x - centerX, dy = y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const fade = 1.0 - Math.min(1.0, Math.max(0.0, (dist / maxDist) - 0.5));
            const alpha = cloudAlpha * fade * 255;

            const idx = (y * 512 + x) * 4;
            imageData.data[idx]     = 255; // R
            imageData.data[idx + 1] = 255; // G
            imageData.data[idx + 2] = 255; // B
            imageData.data[idx + 3] = Math.max(0, Math.min(255, alpha));
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

export function initClouds(scene) {
    const canvas = createCloudTexture();
    const texture = new THREE.CanvasTexture(createCloudTexture());
    texture.format = THREE.RGBAFormat;
    const material = new THREE.MeshBasicMaterial({
        fog: false,
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
    });
    cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE), material);
    cloudPlane.rotation.x = -Math.PI / 2;
    cloudPlane.renderOrder = 999;
    scene.add(cloudPlane);
}

export function updateClouds(time, cameraPos) {
    if (!cloudPlane) return;
    // Плоскость всегда над камерой
    cloudPlane.position.set(cameraPos.x, cameraPos.y + PLANE_HEIGHT, cameraPos.z);
    // Лёгкое движение текстуры (не обязательно, но можно добавить смещение UV)
    // cloudPlane.material.map.offset.x = time * 0.003;
    // cloudPlane.material.map.offset.y = time * 0.001;
}

// Затенение земли на основе облачности (оставляем как было)
export function getCloudCoverAt(point, sunDir) {
    const samplePos = point.clone().addScaledVector(sunDir.clone().negate(), 350);
    const density = fbmCPU(samplePos.x * 0.0008, samplePos.y * 0.0008, samplePos.z * 0.0008);
    return Math.max(0.0, Math.min(1.0, density + 0.25));
}

function fbmCPU(x, y, z) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < 4; i++) {
        value += amplitude * noise.noise3D(x * frequency, y * frequency, z * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}