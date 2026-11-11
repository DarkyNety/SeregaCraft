import * as THREE from 'three';
import { BLOCK_FLESH } from './constants.js';

// --- Программные текстуры для Башни ---
function createFleshTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#8B4513'; ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 500; i++) {
        const x = Math.floor(Math.random() * 64);
        const y = Math.floor(Math.random() * 64);
        const size = Math.floor(Math.random() * 3) + 1;
        ctx.fillStyle = `rgba(${139 + Math.random() * 50}, ${69 + Math.random() * 30}, ${19 + Math.random() * 20}, 0.5)`;
        ctx.fillRect(x, y, size, size);
    }
    for (let i = 0; i < 100; i++) {
        const x = Math.floor(Math.random() * 64);
        const y = Math.floor(Math.random() * 64);
        const size = Math.floor(Math.random() * 4) + 2;
        ctx.fillStyle = `rgba(${139 + Math.random() * 50}, 0, 0, ${Math.random() * 0.8})`;
        ctx.fillRect(x, y, size, size);
    }
    return new THREE.CanvasTexture(canvas);
}

function createDarkFleshTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const colors = ['#1a0a0a', '#2a0f0f', '#0f0505', '#1f0808'];
    for (let i = 0; i < 64; i++) {
        for (let j = 0; j < 64; j++) {
            ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
            ctx.fillRect(i, j, 1, 1);
        }
    }
    for (let i = 0; i < 200; i++) {
        const x = Math.floor(Math.random() * 64);
        const y = Math.floor(Math.random() * 64);
        ctx.fillStyle = `rgba(139, 0, 0, ${Math.random() * 0.5})`;
        ctx.fillRect(x, y, 2, 2);
    }
    return new THREE.CanvasTexture(canvas);
}

function createEyeTexture(irisColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e8e4d9'; ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 30; i++) {
        const x = Math.random() * 64; const y = Math.random() * 64;
        ctx.strokeStyle = `rgba(180, 0, 0, ${Math.random() * 0.6})`;
        ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(32, 32); ctx.lineTo(x, y); ctx.stroke();
    }
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 20);
    gradient.addColorStop(0, '#000'); gradient.addColorStop(0.3, irisColor);
    gradient.addColorStop(0.7, irisColor); gradient.addColorStop(1, '#3d1f1f');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(32, 32, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.beginPath(); ctx.arc(28, 28, 4, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

export class TowerEntity {
    constructor(position) {
        this.position = position.clone();
        this.group = new THREE.Group();
        this.group.position.copy(position);
        
        this.speed = 1.5; // Медленное движение (блоков в секунду)
        this.lastTrailTime = 0;
        this.trailInterval = 0.5; // Оставлять блок плоти каждые 0.5 секунды
        this.time = 0;
        
        this.buildModel();
    }

    buildModel() {
        // Красное свечение
        this.redLight = new THREE.PointLight(0xff0000, 2, 20);
        this.redLight.position.set(0, 14, 0);
        this.redLight.castShadow = true;
        this.group.add(this.redLight);

        // ГОЛОВА
        const headGeometry = new THREE.BoxGeometry(2, 2, 2);
        const headMaterial = new THREE.MeshStandardMaterial({
            map: createFleshTexture(), roughness: 0.9, metalness: 0.1
        });
        this.head = new THREE.Mesh(headGeometry, headMaterial);
        this.head.position.y = 16;
        this.head.castShadow = true;
        this.head.receiveShadow = true;
        this.group.add(this.head);

        // ГЛАЗА
        const eyeColors = ['#8B9DC3', '#A8B5C0', '#9AADBF'];
        const eyePositions = [
            { x: 0.5, y: 16.1, z: 1.01 },
            { x: -0.5, y: 16.1, z: 1.01 },
            { x: 0, y: 15.4, z: 1.01 }
        ];
        this.eyes = [];
        eyePositions.forEach((pos, index) => {
            const eyeGeometry = new THREE.BoxGeometry(0.6, 0.5, 0.3);
            const eyeMaterial = new THREE.MeshStandardMaterial({
                map: createEyeTexture(eyeColors[index]), roughness: 0.2, metalness: 0.5,
                emissive: new THREE.Color(eyeColors[index]), emissiveIntensity: 0.3
            });
            const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye.position.set(pos.x, pos.y, pos.z);
            eye.castShadow = true;
            this.group.add(eye);
            this.eyes.push(eye);
        });

        // ТЕЛО БАШНИ
        this.towerBlocks = [];
        const towerHeight = 16;
        const darkTexture = createDarkFleshTexture();
        const darkMaterial = new THREE.MeshStandardMaterial({
            map: darkTexture, color: 0x888888, roughness: 0.95, metalness: 0.05,
            emissive: 0x110000, emissiveIntensity: 0.2
        });

        for (let y = 0; y < towerHeight; y++) {
            const layerBlocks = [];
            const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
            const offsetX = (Math.random() - 0.5) * 0.3;
            const offsetZ = (Math.random() - 0.5) * 0.3;
            const block = new THREE.Mesh(blockGeometry, darkMaterial.clone());
            block.position.set(offsetX, y + 0.5, offsetZ);
            block.castShadow = true;
            block.receiveShadow = true;
            block.userData = { originalX: offsetX, originalZ: offsetZ, phase: Math.random() * Math.PI * 2 };
            this.group.add(block);
            layerBlocks.push(block);

            // Выступы
            if (y % 2 === 0 && y > 2) {
                const protrusionCount = Math.floor(Math.random() * 3) + 1;
                for (let p = 0; p < protrusionCount; p++) {
                    const side = Math.floor(Math.random() * 4);
                    const protrusion = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), darkMaterial.clone());
                    let px = offsetX, pz = offsetZ;
                    if (side === 0) px += 0.75;
                    else if (side === 1) px -= 0.75;
                    else if (side === 2) pz += 0.75;
                    else if (side === 3) pz -= 0.75;
                    protrusion.position.set(px, y + 0.5, pz);
                    protrusion.castShadow = true;
                    protrusion.userData = { phase: Math.random() * Math.PI * 2 };
                    this.group.add(protrusion);
                    layerBlocks.push(protrusion);
                }
            }
            this.towerBlocks.push(layerBlocks);
        }

        // КАПЛИ КРОВИ
        this.bloodDrips = [];
        for (let i = 0; i < 30; i++) {
            const dripSize = 0.2 + Math.random() * 0.3;
            const dripMaterial = new THREE.MeshStandardMaterial({
                color: 0x8b0000, roughness: 0.4, metalness: 0.6,
                emissive: 0x330000, emissiveIntensity: 0.4
            });
            const drip = new THREE.Mesh(new THREE.BoxGeometry(dripSize, dripSize * 2, dripSize), dripMaterial);
            const angle = Math.random() * Math.PI * 2;
            const dist = 0.3 + Math.random() * 0.5;
            drip.position.set(Math.cos(angle) * dist, Math.random() * 14 + 1, Math.sin(angle) * dist);
            drip.userData = { speed: 0.02 + Math.random() * 0.03, originalY: drip.position.y };
            this.group.add(drip);
            this.bloodDrips.push(drip);
        }

        // НАРОСТЫ
        for (let i = 0; i < 10; i++) {
            const bumpSize = 0.2 + Math.random() * 0.2;
            const bumpMaterial = new THREE.MeshStandardMaterial({
                color: 0x4a0000, roughness: 1, emissive: 0x220000, emissiveIntensity: 0.4
            });
            const bump = new THREE.Mesh(new THREE.BoxGeometry(bumpSize, bumpSize, bumpSize), bumpMaterial);
            bump.position.set((Math.random() - 0.5) * 2, 15 + Math.random() * 2, (Math.random() - 0.5) * 2);
            bump.castShadow = true;
            this.group.add(bump);
        }
    }

    update(dt, world, playerPos) {
        this.time += dt;
        
        // Движение к игроку
        const dir = new THREE.Vector3().subVectors(playerPos, this.position);
        dir.y = 0;
        const dist = dir.length();
        if (dist > 1.0) {
            dir.normalize();
            const step = this.speed * dt;
            const nextPos = this.position.clone().add(dir.clone().multiplyScalar(step));
            
            // Разрушаем блоки на пути
            this.destroyBlocksInPath(world);
            
            this.position.copy(nextPos);
            this.group.position.copy(this.position);
            
            // Поворот к игроку
            this.group.lookAt(playerPos.x, this.position.y, playerPos.z);
        }

        // Оставляем след из плоти
        this.lastTrailTime += dt;
        if (this.lastTrailTime >= this.trailInterval) {
            this.lastTrailTime = 0;
            this.leaveFleshTrail(world);
        }
        
        // Анимация модели
        this.animateModel();
    }

    destroyBlocksInPath(world) {
        const radius = 1; // Радиус разрушения (2x2 блока)
        const baseY = Math.floor(this.position.y);
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const bx = Math.floor(this.position.x + dx);
                const bz = Math.floor(this.position.z + dz);
                // Разрушаем блоки по высоте башни
                for (let by = baseY; by < baseY + 16; by++) {
                    const block = world.getBlock(bx, by, bz);
                    // 0 - AIR, 9 - WATER, 10 - BEDROCK. Не разрушаем их и уже оставленную плоть.
                    if (block !== 0 && block !== 9 && block !== 10 && block !== BLOCK_FLESH) {
                        world.setBlock(bx, by, bz, 0);
                    }
                }
            }
        }
    }

    leaveFleshTrail(world) {
        const bx = Math.floor(this.position.x);
        const bz = Math.floor(this.position.z);
        const by = Math.floor(this.position.y) - 1;
        // Ставим блок плоти под собой, если там воздух
        if (world.getBlock(bx, by, bz) === 0) {
            world.setBlock(bx, by, bz, BLOCK_FLESH);
        }
    }
    
    animateModel() {
        const time = this.time;
        
        // Покачивание головы
        this.head.rotation.x = Math.sin(time * 0.3) * 0.03;
        this.head.rotation.z = Math.sin(time * 0.4) * 0.02;

        // Пульсация глаз
        this.eyes.forEach((eye, index) => {
            const offset = index * 0.7;
            eye.material.emissiveIntensity = 0.3 + Math.sin(time * 2 + offset) * 0.2;
        });

        // Движение блоков башни
        this.towerBlocks.forEach((layer, layerIndex) => {
            layer.forEach((block) => {
                if (block.userData.phase) {
                    const wave = Math.sin(time * 1.5 + block.userData.phase) * 0.05;
                    block.rotation.y = wave;
                    if (block.userData.originalX !== undefined) {
                        block.position.x = block.userData.originalX + Math.sin(time + layerIndex) * 0.05;
                        block.position.z = block.userData.originalZ + Math.cos(time * 0.8 + layerIndex) * 0.05;
                    }
                }
            });
        });

        // Падение капель крови
        this.bloodDrips.forEach((drip) => {
            drip.position.y -= drip.userData.speed;
            if (drip.position.y < 0.5) {
                drip.position.y = drip.userData.originalY;
            }
            drip.rotation.y += 0.02;
        });

        // Пульсация света
        this.redLight.intensity = 2 + Math.sin(time * 1.5) * 0.8;
        this.redLight.position.x = Math.sin(time * 0.3) * 4;
        this.redLight.position.z = Math.cos(time * 0.4) * 4;
    }
}