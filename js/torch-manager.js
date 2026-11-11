// js/torch-manager.js
import * as THREE from 'three';
import {
    CHUNK_SIZE, CHUNK_HEIGHT,
    isTorchBlock, isTorchLit,
    getTorchOrientation, getTorchBlockType,
    getTorchSupportOffset, getTorchAttachmentNormal,
    BLOCK_TORCH_OFF, AIR,
} from './constants.js';

export class TorchManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;

        // --- Пул PointLight ---
        this.maxLights = 12;
        this.lights = [];
        for (let i = 0; i < this.maxLights; i++) {
            const light = new THREE.PointLight(0xffa64d, 0, 12, 2);
            light.castShadow = false;
            this.scene.add(light);
            this.lights.push(light);
        }

        // --- Частицы (искры) ---
        this.emberCount = 150;
        this.emberGeo = new THREE.BufferGeometry();
        this.emberPos = new Float32Array(this.emberCount * 3);
        this.emberCol = new Float32Array(this.emberCount * 3);
        this.emberGeo.setAttribute('position', new THREE.BufferAttribute(this.emberPos, 3));
        this.emberGeo.setAttribute('color',    new THREE.BufferAttribute(this.emberCol, 3));

        const emberTex = this._radialGlowTexture(64, [
            [0.0, 'rgba(255,255,255,1)'],
            [0.5, 'rgba(255,170,55,0.5)'],
            [1.0, 'rgba(255,120,0,0)'],
        ]);

        this.emberMat = new THREE.PointsMaterial({
            size: 0.06, map: emberTex, vertexColors: true,
            transparent: true, blending: THREE.AdditiveBlending,
            depthWrite: false, sizeAttenuation: true, fog: false,
        });
        this.emberPoints = new THREE.Points(this.emberGeo, this.emberMat);
        this.emberPoints.frustumCulled = false;
        this.scene.add(this.emberPoints);
        this.emberData = [];
        for (let i = 0; i < this.emberCount; i++) this.emberData.push({ life: 0, maxLife: 0 });

        // --- Частицы (дым) ---
        this.smokeCount = 42;
        this.smokeGeo = new THREE.BufferGeometry();
        this.smokePos = new Float32Array(this.smokeCount * 3);
        this.smokeCol = new Float32Array(this.smokeCount * 3);
        this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePos, 3));
        this.smokeGeo.setAttribute('color',    new THREE.BufferAttribute(this.smokeCol, 3));

        const smokeTex = this._radialGlowTexture(64, [
            [0.0, 'rgba(255,255,255,0.95)'],
            [0.5, 'rgba(255,255,255,0.35)'],
            [1.0, 'rgba(255,255,255,0)'],
        ]);
        this.smokeMat = new THREE.PointsMaterial({
            size: 0.2, map: smokeTex, vertexColors: true,
            transparent: true, opacity: 0.5, depthWrite: false,
            sizeAttenuation: true, fog: false,
        });
        this.smokePoints = new THREE.Points(this.smokeGeo, this.smokeMat);
        this.smokePoints.frustumCulled = false;
        this.scene.add(this.smokePoints);
        this.smokeData = [];
        for (let i = 0; i < this.smokeCount; i++) this.smokeData.push({ life: 0, maxLife: 0 });

        this.time = 0;
        this.litTorches = []; // {x, y, z}
    }

    _radialGlowTexture(size, stops) {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        for (const [pos, col] of stops) g.addColorStop(pos, col);
        ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }

    /** Обновление каждый кадр. */
    update(dt, playerPos) {
        this.time += dt;

        // 1. Собираем зажжённые факелы в радиусе 60 блоков
        this.litTorches.length = 0;
        const px = Math.floor(playerPos.x);
        const pz = Math.floor(playerPos.z);
        const RADIUS = 60;

        // Проходим по чанкам вокруг игрока (упрощённо: перебираем все чанки в памяти)
        for (const [key, chunk] of this.world.chunks) {
            const dx = chunk.wx + CHUNK_SIZE/2 - playerPos.x;
            const dz = chunk.wz + CHUNK_SIZE/2 - playerPos.z;
            if (dx*dx + dz*dz > (RADIUS + CHUNK_SIZE*2)*(RADIUS + CHUNK_SIZE*2)) continue;

            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
                        const b = chunk.get(lx, ly, lz);
                        if (isTorchLit(b)) {
                            const wx = chunk.wx + lx;
                            const wz = chunk.wz + lz;
                            const ddx = wx + 0.5 - playerPos.x;
                            const ddz = wz + 0.5 - playerPos.z;
                            const d2 = ddx*ddx + ddz*ddz;
                            if (d2 < RADIUS * RADIUS) {
                                this.litTorches.push({ x: wx, y: ly, z: wz, d2 });
                            }
                        }
                    }
                }
            }
        }

        // Сортируем по дистанции
        this.litTorches.sort((a, b) => a.d2 - b.d2);

        // 2. Раздаём свет ближайшим 12 факелам
        for (let i = 0; i < this.maxLights; i++) {
            const light = this.lights[i];
            if (i < this.litTorches.length) {
                const t = this.litTorches[i];
                const flicker = 1 + 0.1 * Math.sin(this.time * 15 + t.x * 7.1) * Math.cos(this.time * 7 + t.z * 3.3);
                light.position.set(t.x + 0.5, t.y + 0.55, t.z + 0.5);
                light.intensity = 1.15 * flicker;
            } else {
                light.intensity = 0;
            }
        }

        // 3. Частицы (распределяем эмиттеры по ближайшим факелам)
        this._updateEmbers(dt);
        this._updateSmoke(dt);
    }

    _updateEmbers(dt) {
        const activeTorches = this.litTorches.slice(0, 20); // не более 20 источников частиц
        for (let i = 0; i < this.emberCount; i++) {
            const d = this.emberData[i];
            d.life -= dt;
            if (d.life <= 0) {
                if (activeTorches.length > 0) {
                    // Спавн над случайным факелом
                    const t = activeTorches[(Math.random() * activeTorches.length) | 0];
                    d.maxLife = 0.6 + Math.random() * 1.2;
                    d.life = d.maxLife;
                    d.x = t.x + 0.5 + (Math.random() - 0.5) * 0.06;
                    d.y = t.y + 0.62 + Math.random() * 0.06;
                    d.z = t.z + 0.5 + (Math.random() - 0.5) * 0.06;
                    d.vx = (Math.random() - 0.5) * 0.15;
                    d.vz = (Math.random() - 0.5) * 0.15;
                    d.vy = 0.2 + Math.random() * 0.4;
                } else {
                    this.emberPos[i*3] = 0; this.emberPos[i*3+1] = -1000; this.emberPos[i*3+2] = 0;
                    continue;
                }
            }
            // Движение
            d.x += (d.vx + Math.sin(this.time * 2.4 + i) * 0.01) * dt;
            d.y += d.vy * dt;
            d.z += (d.vz + Math.cos(this.time * 2.1 + i) * 0.01) * dt;
            d.vy *= (1 - 0.4 * dt);
            
            const k = Math.max(0, d.life / d.maxLife);
            const age = 1 - k;
            // Цвет: от белого к оранжевому и красному
            let r = 1.0, g = 1.0, b = 0.5;
            if (age < 0.4) { const t = age / 0.4; r = 1.0; g = 1.0 - t * 0.5; b = 0.5 - t * 0.5; }
            else { const t = (age - 0.4) / 0.6; r = 1.0 - t * 0.7; g = 0.5 - t * 0.45; b = 0.0; }

            const fade = Math.min(1, k * 4) * Math.min(1, age * 8 + 0.2);
            this.emberPos[i*3]   = d.x;
            this.emberPos[i*3+1] = d.y;
            this.emberPos[i*3+2] = d.z;
            this.emberCol[i*3]   = r * fade;
            this.emberCol[i*3+1] = g * fade;
            this.emberCol[i*3+2] = b * fade;
        }
        this.emberGeo.attributes.position.needsUpdate = true;
        this.emberGeo.attributes.color.needsUpdate = true;
    }

    _updateSmoke(dt) {
        const activeTorches = this.litTorches.slice(0, 12); // дым от 12 ближайших
        for (let i = 0; i < this.smokeCount; i++) {
            const d = this.smokeData[i];
            d.life -= dt;
            if (d.life <= 0) {
                if (activeTorches.length > 0) {
                    const t = activeTorches[(Math.random() * activeTorches.length) | 0];
                    d.maxLife = 2.0 + Math.random() * 2.0;
                    d.life = d.maxLife;
                    d.x = t.x + 0.5 + (Math.random() - 0.5) * 0.05;
                    d.y = t.y + 0.75 + Math.random() * 0.05;
                    d.z = t.z + 0.5 + (Math.random() - 0.5) * 0.05;
                    d.vx = (Math.random() - 0.5) * 0.04;
                    d.vz = (Math.random() - 0.5) * 0.04;
                    d.vy = 0.1 + Math.random() * 0.15;
                } else {
                    this.smokePos[i*3] = 0; this.smokePos[i*3+1] = -1000; this.smokePos[i*3+2] = 0;
                    continue;
                }
            }
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.z += d.vz * dt;

            const k = Math.max(0, d.life / d.maxLife);
            const age = 1 - k;
            const alpha = Math.min(1, k * 2.5) * Math.min(1, age * 10);
            // Цвет дыма: от серого к тёмному
            const c = 0.3 - age * 0.2;

            this.smokePos[i*3]   = d.x;
            this.smokePos[i*3+1] = d.y;
            this.smokePos[i*3+2] = d.z;
            this.smokeCol[i*3]   = c;
            this.smokeCol[i*3+1] = c;
            this.smokeCol[i*3+2] = c;
            // Альфа через размер / цвет (vertexColors не поддерживает альфу в PointsMaterial)
            // Упрощённо: умножаем на alpha для яркости
            this.smokeCol[i*3]   *= alpha;
            this.smokeCol[i*3+1] *= alpha;
            this.smokeCol[i*3+2] *= alpha;
        }
        this.smokeGeo.attributes.position.needsUpdate = true;
        this.smokeGeo.attributes.color.needsUpdate = true;
    }

    dispose() {
        for (const light of this.lights) this.scene.remove(light);
        this.scene.remove(this.emberPoints);
        this.scene.remove(this.smokePoints);
        this.emberGeo.dispose();
        this.emberMat.dispose();
        this.smokeGeo.dispose();
        this.smokeMat.dispose();
    }
}