// js/block-effects.js
import * as THREE from 'three';
import { atlasCanvas } from './rendering.js';
import { getBlockTextures, TEX_COLS, TEX_CELL, AIR, BLOCK_WATER } from './constants.js';

// Кэш текстур и материалов по типу блока — каждая создаётся один раз.
const textureCache = {};
const materialCache = {};

function getBlockParticleTexture(blockType) {
    if (textureCache[blockType]) return textureCache[blockType];
    const texIdx = getBlockTextures(blockType)[0] || 0; // верхняя грань
    const col = texIdx % TEX_COLS;
    const row = Math.floor(texIdx / TEX_COLS);
    const sx = col * TEX_CELL;
    const sy = row * TEX_CELL;

    const canvas = document.createElement('canvas');
    canvas.width = TEX_CELL;
    canvas.height = TEX_CELL;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlasCanvas, sx, sy, TEX_CELL, TEX_CELL, 0, 0, TEX_CELL, TEX_CELL);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    textureCache[blockType] = tex;
    return tex;
}

function getBlockParticleMaterial(blockType) {
    if (materialCache[blockType]) return materialCache[blockType];
    const mat = new THREE.MeshStandardMaterial({
        map: getBlockParticleTexture(blockType),
        roughness: 0.85,
        metalness: 0.0,
    });
    materialCache[blockType] = mat;
    return mat;
}

const MAX_PARTICLES = 500;

export class BlockEffects {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.particles = [];
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
        this._tmpBlockQueryCache = 0; // не нужен, но для будущего
    }

    /** При разрушении блока — разлёт обломков из центра блока. */
    spawnBreak(cx, cy, cz, blockType) {
        if (!blockType || blockType === AIR || blockType === BLOCK_WATER) return;
        const mat = getBlockParticleMaterial(blockType);

        const count = 14 + Math.floor(Math.random() * 6);
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= MAX_PARTICLES) return;

            const mesh = new THREE.Mesh(this.geometry, mat);
            const px = cx + 0.15 + Math.random() * 0.7;
            const py = cy + 0.15 + Math.random() * 0.7;
            const pz = cz + 0.15 + Math.random() * 0.7;
            mesh.position.set(px, py, pz);

            const size = 0.09 + Math.random() * 0.08;
            mesh.scale.setScalar(size);
            mesh.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );

            // Скорость: наружу от центра + вверх + небольшая случайность
            const vx = (px - cx - 0.5) * 3.2 + (Math.random() - 0.5) * 1.6;
            const vy = 2.8 + Math.random() * 2.2;
            const vz = (pz - cz - 0.5) * 3.2 + (Math.random() - 0.5) * 1.6;

            this.scene.add(mesh);
            this.particles.push({
                mesh,
                velocity: new THREE.Vector3(vx, vy, vz),
                angular: new THREE.Vector3(
                    (Math.random() - 0.5) * 14,
                    (Math.random() - 0.5) * 14,
                    (Math.random() - 0.5) * 14
                ),
                life: 0,
                maxLife: 0.7 + Math.random() * 0.5,
                initialScale: size,
            });
        }
    }

    /** При установке блока — мягкое облачко «пыли» из-под низа. */
    spawnPlace(cx, cy, cz, blockType) {
        if (!blockType || blockType === AIR) return;
        const mat = getBlockParticleMaterial(blockType);

        const count = 6 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= MAX_PARTICLES) return;

            const mesh = new THREE.Mesh(this.geometry, mat);
            const px = cx + 0.2 + Math.random() * 0.6;
            const py = cy + 0.2 + Math.random() * 0.5;
            const pz = cz + 0.2 + Math.random() * 0.6;
            mesh.position.set(px, py, pz);

            const size = 0.06 + Math.random() * 0.05;
            mesh.scale.setScalar(size);
            mesh.rotation.set(0, Math.random() * Math.PI * 2, 0);

            // Лёгкий разлёт наружу, преимущественно вверх
            const vx = (px - cx - 0.5) * 2.4 + (Math.random() - 0.5) * 0.6;
            const vy = 0.9 + Math.random() * 0.9;
            const vz = (pz - cz - 0.5) * 2.4 + (Math.random() - 0.5) * 0.6;

            this.scene.add(mesh);
            this.particles.push({
                mesh,
                velocity: new THREE.Vector3(vx, vy, vz),
                angular: new THREE.Vector3(
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5,
                    (Math.random() - 0.5) * 5
                ),
                life: 0,
                maxLife: 0.45 + Math.random() * 0.3,
                initialScale: size,
            });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += dt;
            const t = p.life / p.maxLife;

            if (t >= 0.98) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
                continue;
            }

            // Гравитация
            p.velocity.y -= 18 * dt;

            // Движение
            p.mesh.position.x += p.velocity.x * dt;
            p.mesh.position.y += p.velocity.y * dt;
            p.mesh.position.z += p.velocity.z * dt;

            // Столкновение с землёй (только с твёрдыми блоками, не с водой)
            const bx = Math.floor(p.mesh.position.x);
            const by = Math.floor(p.mesh.position.y);
            const bz = Math.floor(p.mesh.position.z);
            const block = this.world.getBlock(bx, by, bz);
            if (block !== AIR && block !== BLOCK_WATER) {
                p.mesh.position.y = by + 1 + 0.001;
                p.velocity.y = 0;
                p.velocity.x *= 0.35;
                p.velocity.z *= 0.35;
                p.angular.multiplyScalar(0.5);
            }

            // Вращение
            p.mesh.rotation.x += p.angular.x * dt;
            p.mesh.rotation.y += p.angular.y * dt;
            p.mesh.rotation.z += p.angular.z * dt;

            // Плавное исчезновение через масштаб (дешевле, чем менять material.opacity)
            const scale = p.initialScale * Math.pow(1 - t, 1.3);
            p.mesh.scale.setScalar(Math.max(0.001, scale));
        }
    }
}