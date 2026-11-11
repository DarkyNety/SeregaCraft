// js/world.js
import * as THREE from 'three';
import {
    CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL,
    RENDER_RADIUS, UNLOAD_RADIUS,
    AIR, BLOCK_GRASS, BLOCK_DIRT, BLOCK_STONE, BLOCK_LOG,
    BLOCK_LEAVES, BLOCK_SAND, BLOCK_PLANKS, BLOCK_COBBLESTONE,
    BLOCK_WATER, BLOCK_BEDROCK, BLOCK_DIAMOND_ORE, BLOCK_COAL_ORE,
    getBlockTextures, BLOCK_GRAVEL, TEX_GRASS_PLANT, BLOCK_GRASS_PLANT, TEX_COLS,
    BLOCK_TORCH_FLOOR, BLOCK_TORCH_N, BLOCK_TORCH_S, BLOCK_TORCH_E, BLOCK_TORCH_W, BLOCK_TORCH_OFF,
    isTorchBlock, isTorchLit, getTorchOrientation
} from './constants.js';
import { createNoise } from './noise.js';
import { scene } from './rendering.js';
import { CarEntity } from './car-entity.js';
import { RegionManager } from './region-manager.js';
import { createTorch } from './torch.js'; 

const SEA_LEVEL = WATER_LEVEL;
const BEACH_LEVEL = SEA_LEVEL + 1;
const MOUNTAIN_BASE = 180;
const MOUNTAIN_MAX = 200;
const MOUNTAIN_NOISE_SCALE = 0.0005;
const MOUNTAIN_THRESHOLD = 0.15;
const GRAVEL_DEPTH = SEA_LEVEL - 35;
const OCEAN_SHORE_THRESHOLD = -0.18;
const OCEAN_SHORE_WIDTH = 0.1;

const BIOME = {
    OCEAN: 'ocean', PLAINS: 'plains', DESERT: 'desert', FOREST: 'forest',
    TAIGA: 'taiga', JUNGLE: 'jungle', MOUNTAINS: 'mountains',
    SWAMP: 'swamp', RIVER: 'river', LAKE: 'lake', BEACH: 'beach',
};

function getBiomeFromClimate(wx, wz, noise) {
    const temp = noise.noise2D(wx * 0.0005, wz * 0.0005);
    const humid = noise.noise2D(wx * 0.0005 + 1000, wz * 0.0005 + 1000);
    const weird = noise.noise2D(wx * 0.0003 + 2000, wz * 0.0003 + 2000);

    if (temp > 0.35 && humid > 0.5) return BIOME.JUNGLE;
    if (temp > 0.15 && humid < 0.15) return BIOME.DESERT;
    if (temp < -0.25) return BIOME.TAIGA;
    if (humid > 0.2 && weird < -0.2) return BIOME.SWAMP;
    if (humid > 0.15 && temp > -0.1 && temp < 0.3) return BIOME.FOREST;
    return BIOME.PLAINS;
}

export function getTerrainData(wx, wz, noise) {
    const temp = noise.noise2D(wx * 0.0005, wz * 0.0005);
    const humid = noise.noise2D(wx * 0.0005 + 1000, wz * 0.0005 + 1000);
    const continent = noise.noise2D(wx * 0.0012, wz * 0.0012);

    const base = noise.fractal2D(wx * 0.0025, wz * 0.0025, 6, 2.1, 0.5);
    const detail = noise.noise2D(wx * 0.03, wz * 0.03) * 3;
    let baseHeight = SEA_LEVEL + base * 55 + detail;

    let _biomePre = getBiomeFromClimate(wx, wz, noise);
    if (_biomePre === BIOME.PLAINS || _biomePre === BIOME.DESERT || _biomePre === BIOME.SWAMP) {
        baseHeight = SEA_LEVEL + (baseHeight - SEA_LEVEL) * 0.35;
    }

    const mn = noise.noise2D(wx * MOUNTAIN_NOISE_SCALE + 700, wz * MOUNTAIN_NOISE_SCALE + 700);
    let mountainFactor = Math.max(0, (mn - MOUNTAIN_THRESHOLD) / (1 - MOUNTAIN_THRESHOLD));
    const shoreFactor = Math.max(0, (continent - OCEAN_SHORE_THRESHOLD) / OCEAN_SHORE_WIDTH);
    mountainFactor *= Math.min(1, shoreFactor);

    const peakNoise = noise.noise2D(wx * 0.008 + 1200, wz * 0.008 + 1200);
    const targetMountainHeight = MOUNTAIN_BASE + (peakNoise + 1) * 0.5 * (MOUNTAIN_MAX - MOUNTAIN_BASE);
    let height = baseHeight + (targetMountainHeight - baseHeight) * mountainFactor;

    let oceanFactor = Math.max(0, (OCEAN_SHORE_THRESHOLD - continent) / OCEAN_SHORE_WIDTH);
    oceanFactor = Math.min(1, oceanFactor);
    if (oceanFactor > 0) {
        const depth = -oceanFactor * 70;
        height = height * (1 - oceanFactor) + (SEA_LEVEL + depth) * oceanFactor;
    }

    let biome = getBiomeFromClimate(wx, wz, noise);
    if (mountainFactor > 0.2) biome = BIOME.MOUNTAINS;
    if (oceanFactor > 0.5) biome = BIOME.OCEAN;

    if (mountainFactor <= 0.2 && oceanFactor <= 0.5) {
        if (biome === BIOME.JUNGLE) height += 8;
        else if (biome === BIOME.DESERT) height += 4;
        else if (biome === BIOME.TAIGA) height -= 4;
        else if (biome === BIOME.SWAMP) height -= 4;
    }

    const humidBoundary = Math.abs(humid - 0.15) < 0.025;
    const tempWarm = temp > 0.1;
    const continentCheck = continent > OCEAN_SHORE_THRESHOLD + 0.1;
    if (humidBoundary && tempWarm && continentCheck && height > SEA_LEVEL && height < SEA_LEVEL + 12) {
        height = SEA_LEVEL - 1 - Math.floor(Math.random() * 2);
        return { height: Math.floor(height), biome: BIOME.RIVER };
    }

    const riverNoise1 = noise.noise2D(wx * 0.008, wz * 0.008);
    const riverNoise2 = noise.noise2D(wx * 0.016 + 500, wz * 0.016 + 500);
    const isRiver = Math.abs(riverNoise1) < 0.06 && Math.abs(riverNoise2) < 0.08;
    if (isRiver && height > SEA_LEVEL && height < SEA_LEVEL + 10 &&
        biome !== BIOME.DESERT && biome !== BIOME.MOUNTAINS && biome !== BIOME.OCEAN) {
        height = SEA_LEVEL - 1 - Math.floor(Math.random() * 2);
        return { height: Math.floor(height), biome: BIOME.RIVER };
    }

    const lakeNoise = noise.noise2D(wx * 0.05, wz * 0.05);
    if (lakeNoise > 0.55 && height <= SEA_LEVEL + 5 && height >= SEA_LEVEL - 6 &&
        biome !== BIOME.DESERT && biome !== BIOME.MOUNTAINS && biome !== BIOME.OCEAN) {
        const lakeDepth = Math.floor((lakeNoise - 0.55) * 10) + 2;
        height = SEA_LEVEL - lakeDepth;
        return { height: Math.floor(height), biome: BIOME.LAKE };
    }

    if (height >= SEA_LEVEL - 1 && height <= BEACH_LEVEL &&
        biome !== BIOME.OCEAN && biome !== BIOME.RIVER && biome !== BIOME.LAKE) {
        biome = BIOME.BEACH;
    }

    height = Math.min(CHUNK_HEIGHT - 5, Math.floor(Math.max(1, height)));
    return { height, biome };
}

export class Chunk {
    constructor(cx, cz) {
        this.cx = cx; this.cz = cz;
        this.wx = cx * CHUNK_SIZE; this.wz = cz * CHUNK_SIZE;
        this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.solidMesh = null;
        this.waterMesh = null;
        this.leavesMesh = null;
        this.leavesShadowMesh = null;
        this.grassMesh = null;
        this.torches = new Map(); // Теперь храним Map для кэширования!
        this.dirty = true;
    }
    idx(lx, ly, lz) { return lx + lz * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE; }
    get(lx, ly, lz) {
        if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return AIR;
        return this.blocks[this.idx(lx, ly, lz)];
    }
    set(lx, ly, lz, type) {
        if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return;
        this.blocks[this.idx(lx, ly, lz)] = type;
        this.dirty = true;
    }
}

export class World {
    constructor(materials, seed, regionManager) {
        this.seed = seed;
        this.noise = createNoise(seed);
        this.chunks = new Map();
        this.materials = materials;
        this.group = new THREE.Group();
        scene.add(this.group);
        
        this.droppedItems = [];
        this.carEntities = [];
        this.towerEntities = [];
        this.towersGroup = new THREE.Group();
        scene.add(this.towersGroup);
        this.carsGroup = new THREE.Group();
        scene.add(this.carsGroup);
        
        this.torchesGroup = new THREE.Group();
        scene.add(this.torchesGroup);

        // 🔥 ПУЛ СВЕТА ДЛЯ ФАКЕЛОВ (8 штук на весь мир)
        this.lightPool = [];
        for (let i = 0; i < 8; i++) {
            const light = new THREE.PointLight(0xffa64d, 0, 10, 2);
            light.castShadow = false;
            scene.add(light);
            this.lightPool.push(light);
        }

        this._spreadingWater = false;
        this.originOffset = new THREE.Vector3(0, 0, 0);
        this.regionManager = regionManager;
    }

    addTowerEntity(tower) {
        this.towersGroup.add(tower.group);
        this.towerEntities.push(tower);
    }
    removeTowerEntity(tower) {
        this.towersGroup.remove(tower.group);
        const index = this.towerEntities.indexOf(tower);
        if (index !== -1) this.towerEntities.splice(index, 1);
    }
    updateTowers(dt, playerPos) {
        for (const tower of this.towerEntities) tower.update(dt, this, playerPos);
    }

    key(cx, cz) { return `${cx},${cz}`; }
    getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)) || null; }

    getBlock(wx, wy, wz) {
        if (wy < 0 || wy >= CHUNK_HEIGHT) return wy < 0 ? BLOCK_BEDROCK : AIR;
        const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
        const c = this.getChunk(cx, cz);
        if (!c) return AIR;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return c.get(lx, wy, lz);
    }

    setBlock(wx, wy, wz, type) {
        if (wy < 0 || wy >= CHUNK_HEIGHT) return;
        const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
        const c = this.getChunk(cx, cz);
        if (!c) return;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        c.set(lx, wy, lz, type);

        if (lx === 0) { const n = this.getChunk(cx - 1, cz); if (n) n.dirty = true; }
        if (lx === CHUNK_SIZE - 1) { const n = this.getChunk(cx + 1, cz); if (n) n.dirty = true; }
        if (lz === 0) { const n = this.getChunk(cx, cz - 1); if (n) n.dirty = true; }
        if (lz === CHUNK_SIZE - 1) { const n = this.getChunk(cx, cz + 1); if (n) n.dirty = true; }
    }

    toggleTorchAt(wx, wy, wz) {
        const block = this.getBlock(wx, wy, wz);
        if (!isTorchBlock(block)) return false;

        if (isTorchLit(block)) {
            this.setBlock(wx, wy, wz, BLOCK_TORCH_OFF);
            return false;
        } else {
            this.setBlock(wx, wy, wz, BLOCK_TORCH_FLOOR);
            return true;
        }
    }

    getTerrainHeightAt(wx, wz) {
        return getTerrainData(wx, wz, this.noise).height;
    }

    recenter(newOrigin) {
        const delta = newOrigin.clone().negate();
        this.group.position.copy(delta);
        this.carsGroup.position.copy(delta);
        this.torchesGroup.position.copy(delta);
        this.originOffset.add(delta);
        for (const sprite of this.droppedItems) sprite.position.add(delta);
    }

    addCarEntity(car) {
        this.carsGroup.add(car.model);
        this.carEntities.push(car);
    }

    updateCars(dt, world, inputProvider) {
        for (const car of this.carEntities) {
            const input = (car.driver && inputProvider) ? inputProvider() : {};
            car.update(dt, world, input);
        }
    }

    // 🔥 ГЛОБАЛЬНОЕ ОБНОВЛЕНИЕ СВЕТА
    updateTorchLights(playerPos) {
        const litTorches = [];
        // Ищем все зажженные факелы вокруг игрока
        for (const [_, chunk] of this.chunks) {
            const dx = chunk.wx + CHUNK_SIZE/2 - playerPos.x;
            const dz = chunk.wz + CHUNK_SIZE/2 - playerPos.z;
            if (dx*dx + dz*dz > 60*60) continue; // Только в радиусе 60 блоков

            for (const [key, data] of chunk.torches) {
                if (data.lit) {
                    const [lx, ly, lz] = key.split(',').map(Number);
                    const wx = chunk.wx + lx + 0.5;
                    const wy = ly + 0.5;
                    const wz = chunk.wz + lz + 0.5;
                    const d2 = (wx - playerPos.x)**2 + (wy - playerPos.y)**2 + (wz - playerPos.z)**2;
                    litTorches.push({ wx, wy, wz, d2 });
                }
            }
        }
        
        // Сортируем ближайшие и раздаем пулу
        litTorches.sort((a, b) => a.d2 - b.d2);
        for (let i = 0; i < this.lightPool.length; i++) {
            const light = this.lightPool[i];
            if (i < litTorches.length) {
                const t = litTorches[i];
                light.position.set(t.wx, t.wy, t.wz);
                light.intensity = 1.5;
            } else {
                light.intensity = 0;
            }
        }
    }

    placeTree(chunk, lx, groundY, lz, biome) {
        const trunkHeight = (biome === BIOME.TAIGA) ? 6 + Math.floor(Math.random() * 3) : 4 + Math.floor(Math.random() * 2);
        const crownBase = groundY + trunkHeight;
        if (crownBase + 3 >= CHUNK_HEIGHT) return;

        for (let y = 0; y < trunkHeight; y++) {
            const ty = groundY + 1 + y;
            if (ty < CHUNK_HEIGHT) chunk.blocks[chunk.idx(lx, ty, lz)] = BLOCK_LOG;
        }

        if (biome === BIOME.TAIGA) {
            for (let dy = -2; dy <= 1; dy++) {
                const radius = dy === -2 ? 1 : 2;
                for (let dx = -radius; dx <= radius; dx++)
                    for (let dz = -radius; dz <= radius; dz++) {
                        if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() < 0.5) continue;
                        const bx = lx + dx, bz = lz + dz, by = crownBase + dy;
                        if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by > 0 && by < CHUNK_HEIGHT)
                            if (chunk.get(bx, by, bz) === AIR) chunk.blocks[chunk.idx(bx, by, bz)] = BLOCK_LEAVES;
                    }
            }
        } else {
            for (let dy = -1; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++)
                    for (let dz = -2; dz <= 2; dz++) {
                        if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && Math.random() < 0.5) continue;
                        if (Math.sqrt(dx*dx + dy*dy + dz*dz) > 3.2) continue;
                        const bx = lx + dx, bz = lz + dz, by = crownBase + dy;
                        if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by > 0 && by < CHUNK_HEIGHT)
                            if (chunk.get(bx, by, bz) === AIR) chunk.blocks[chunk.idx(bx, by, bz)] = BLOCK_LEAVES;
                    }
            }
            if (crownBase + 2 < CHUNK_HEIGHT) chunk.blocks[chunk.idx(lx, crownBase + 2, lz)] = BLOCK_LEAVES;
            if (Math.random() < 0.5 && crownBase + 3 < CHUNK_HEIGHT) chunk.blocks[chunk.idx(lx, crownBase + 3, lz)] = BLOCK_LEAVES;
        }
    }

    placeJungleTree(chunk, lx, groundY, lz, isLarge) {
        const logBlock = BLOCK_LOG;
        const leafBlock = BLOCK_LEAVES;
        if (isLarge) {
            const trunkHeight = 10 + Math.floor(Math.random() * 8);
            if (lx + 1 >= CHUNK_SIZE || lz + 1 >= CHUNK_SIZE) return;
            for (let y = 0; y < trunkHeight; y++) {
                const ty = groundY + 1 + y;
                if (ty < CHUNK_HEIGHT) {
                    chunk.blocks[chunk.idx(lx, ty, lz)]     = logBlock;
                    chunk.blocks[chunk.idx(lx+1, ty, lz)]   = logBlock;
                    chunk.blocks[chunk.idx(lx, ty, lz+1)]   = logBlock;
                    chunk.blocks[chunk.idx(lx+1, ty, lz+1)] = logBlock;
                }
            }
            const crownBase = groundY + trunkHeight - 2;
            for (let dy = -1; dy <= 3; dy++) {
                const r = dy <= 0 ? 3 : 2;
                for (let dx = -r; dx <= r; dx++)
                    for (let dz = -r; dz <= r; dz++) {
                        if (Math.abs(dx) == r && Math.abs(dz) == r && Math.random() < 0.6) continue;
                        const bx = lx + dx, bz = lz + dz, by = crownBase + dy;
                        if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by > 0 && by < CHUNK_HEIGHT)
                            if (chunk.get(bx, by, bz) === AIR) chunk.blocks[chunk.idx(bx, by, bz)] = leafBlock;
                    }
            }
            if (crownBase + 3 < CHUNK_HEIGHT) {
                chunk.blocks[chunk.idx(lx,   crownBase+3, lz)]   = leafBlock;
                chunk.blocks[chunk.idx(lx+1, crownBase+3, lz)]   = leafBlock;
                chunk.blocks[chunk.idx(lx,   crownBase+3, lz+1)] = leafBlock;
                chunk.blocks[chunk.idx(lx+1, crownBase+3, lz+1)] = leafBlock;
            }
        } else {
            const trunkHeight = 7 + Math.floor(Math.random() * 5);
            const crownBase = groundY + trunkHeight - 1;
            for (let y = 0; y < trunkHeight; y++) {
                const ty = groundY + 1 + y;
                if (ty < CHUNK_HEIGHT) chunk.blocks[chunk.idx(lx, ty, lz)] = logBlock;
            }
            for (let dy = -1; dy <= 2; dy++) {
                const r = dy <= 0 ? 2 : 1;
                for (let dx = -r; dx <= r; dx++)
                    for (let dz = -r; dz <= r; dz++) {
                        if (Math.abs(dx) == r && Math.abs(dz) == r && Math.random() < 0.5) continue;
                        const bx = lx + dx, bz = lz + dz, by = crownBase + dy;
                        if (bx >= 0 && bx < CHUNK_SIZE && bz >= 0 && bz < CHUNK_SIZE && by > 0 && by < CHUNK_HEIGHT)
                            if (chunk.get(bx, by, bz) === AIR) chunk.blocks[chunk.idx(bx, by, bz)] = leafBlock;
                    }
            }
        }
    }

    generateChunk(cx, cz) {
        const c = new Chunk(cx, cz);
        const wx0 = c.wx, wz0 = c.wz;
        const heightMap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
        const biomeMap = new Array(CHUNK_SIZE * CHUNK_SIZE);

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = wx0 + lx, wz = wz0 + lz;
                const data = getTerrainData(wx, wz, this.noise);
                const h = data.height;
                const biome = data.biome;
                heightMap[lx + lz * CHUNK_SIZE] = h;
                biomeMap[lx + lz * CHUNK_SIZE] = biome;

                for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
                    let block = AIR;
                    if (ly === 0) block = BLOCK_BEDROCK;
                    else if (ly <= 4) block = Math.random() < 0.7 ? BLOCK_STONE : BLOCK_BEDROCK;
                    else if (ly < h - 3) block = BLOCK_STONE;
                    else if (ly < h) block = BLOCK_DIRT;
                    else if (ly === h) {
                        if (h < SEA_LEVEL) {
                            block = BLOCK_SAND;
                            if (SEA_LEVEL - h > 30) block = BLOCK_GRAVEL;
                        } else if (biome === BIOME.DESERT || biome === BIOME.BEACH) {
                            block = BLOCK_SAND;
                        } else {
                            block = BLOCK_GRASS;
                        }
                    } else if (ly <= SEA_LEVEL && h < SEA_LEVEL) {
                        block = BLOCK_WATER;
                    }
                    if (block !== AIR) c.blocks[c.idx(lx, ly, lz)] = block;
                }
            }
        }

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const h = heightMap[lx + lz * CHUNK_SIZE];
                const biome = biomeMap[lx + lz * CHUNK_SIZE];
                if (h >= CHUNK_HEIGHT - 1) continue;
                const surfaceBlock = c.get(lx, h, lz);
                if (surfaceBlock !== BLOCK_GRASS) continue;
                if (biome === BIOME.DESERT || biome === BIOME.BEACH || biome === BIOME.OCEAN) continue;
                if (Math.random() < 0.15) {
                    const above = c.get(lx, h + 1, lz);
                    if (above === AIR) c.blocks[c.idx(lx, h + 1, lz)] = BLOCK_GRASS_PLANT;
                }
            }
        }

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const h = heightMap[lx + lz * CHUNK_SIZE];
                const biome = biomeMap[lx + lz * CHUNK_SIZE];
                if (biome !== BIOME.MOUNTAINS || h < 140) continue;
                let maxDiff = 0;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        if (dx === 0 && dz === 0) continue;
                        const nx = lx + dx, nz = lz + dz;
                        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                            const diff = Math.abs(h - heightMap[nx + nz * CHUNK_SIZE]);
                            if (diff > maxDiff) maxDiff = diff;
                        }
                    }
                }
                const stoneDepth = h >= 170 ? 5 : 4;
                for (let dy = 1; dy <= stoneDepth; dy++) {
                    const ty = h - dy;
                    if (ty >= 0 && c.get(lx, ty, lz) === BLOCK_DIRT) {
                        c.blocks[c.idx(lx, ty, lz)] = BLOCK_STONE;
                    }
                }
                if (maxDiff > 1 || h >= 170) {
                    const top = c.get(lx, h, lz);
                    if (top === BLOCK_GRASS || top === BLOCK_DIRT) {
                        c.blocks[c.idx(lx, h, lz)] = BLOCK_STONE;
                    }
                }
            }
        }

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const h = heightMap[lx + lz * CHUNK_SIZE];
                if (h < SEA_LEVEL) continue;
                let nearWater = false;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const nx = lx + dx, nz = lz + dz;
                        if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
                            if (heightMap[nx + nz * CHUNK_SIZE] < SEA_LEVEL) { nearWater = true; break; }
                        }
                    }
                    if (nearWater) break;
                }
                if (nearWater && h <= BEACH_LEVEL + 2) {
                    for (let dy = 0; dy <= 2; dy++) {
                        const ty = h - dy;
                        if (ty >= 0) {
                            const block = c.get(lx, ty, lz);
                            if (block === BLOCK_GRASS || block === BLOCK_DIRT) {
                                c.blocks[c.idx(lx, ty, lz)] = BLOCK_SAND;
                            }
                        }
                    }
                }
            }
        }

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const h = heightMap[lx + lz * CHUNK_SIZE];
                const wx = wx0 + lx, wz = wz0 + lz;
                for (let ly = 6; ly < Math.min(h - 3, CHUNK_HEIGHT - 1); ly++) {
                    const cave1 = this.noise.noise3D(wx * 0.06, ly * 0.06, wz * 0.06);
                    const cave2 = this.noise.noise3D(wx * 0.12, ly * 0.12, wz * 0.12);
                    const worm = Math.abs(this.noise.noise3D(wx * 0.08, ly * 0.08, wz * 0.08));
                    if ((cave1 > 0.3 && cave2 > -0.2) || worm < 0.08) {
                        if (c.get(lx, ly, lz) === BLOCK_STONE) c.blocks[c.idx(lx, ly, lz)] = AIR;
                    }
                }
            }
        }

        for (let lx = 0; lx < CHUNK_SIZE; lx++)
            for (let lz = 0; lz < CHUNK_SIZE; lz++)
                for (let ly = 5; ly <= 20; ly++) {
                    if (c.get(lx, ly, lz) === BLOCK_STONE &&
                        this.noise.noise3D((wx0+lx)*0.15, ly*0.15, (wz0+lz)*0.15) > 0.65)
                        c.blocks[c.idx(lx, ly, lz)] = BLOCK_DIAMOND_ORE;
                }
        for (let lx = 0; lx < CHUNK_SIZE; lx++)
            for (let lz = 0; lz < CHUNK_SIZE; lz++)
                for (let ly = 5; ly < 60; ly++) {
                    if (c.get(lx, ly, lz) === BLOCK_STONE &&
                        this.noise.noise3D((wx0+lx)*0.1, ly*0.12, (wz0+lz)*0.1) > 0.55)
                        c.blocks[c.idx(lx, ly, lz)] = BLOCK_COAL_ORE;
                }

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const h = heightMap[lx + lz * CHUNK_SIZE];
                const biome = biomeMap[lx + lz * CHUNK_SIZE];
                const surfaceBlock = c.get(lx, h, lz);
                if (surfaceBlock !== BLOCK_GRASS || h >= CHUNK_HEIGHT - 1) continue;
                if (biome === BIOME.DESERT) continue;
                if (biome === BIOME.MOUNTAINS) {
                    if (Math.random() < 0.08) this.placeTree(c, lx, h, lz, BIOME.TAIGA);
                    continue;
                }
                if (biome === BIOME.JUNGLE) {
                    if (Math.random() < 0.5) {
                        if (Math.random() < 0.45) this.placeJungleTree(c, lx, h, lz, true);
                        else this.placeJungleTree(c, lx, h, lz, false);
                    }
                    continue;
                }
                let treeChance = 0;
                if (biome === BIOME.FOREST) treeChance = 0.25;
                else if (biome === BIOME.PLAINS) treeChance = 0.03;
                else if (biome === BIOME.TAIGA) treeChance = 0.2;
                else if (biome === BIOME.SWAMP) treeChance = 0.1;
                if (Math.random() < treeChance) this.placeTree(c, lx, h, lz, biome);
            }
        }

        return c;
    }

    buildChunkGeometry(chunk) {
        const solidPos = [], solidNorm = [], solidUv = [];
        const waterPos = [], waterNorm = [], waterUv = [];
        const leavesPosFull = [], leavesNormFull = [], leavesUvFull = [];
        const leavesPosShell = [], leavesNormShell = [], leavesUvShell = [];
        const grassPos = [], grassNorm = [], grassUv = [];

        function isOpaqueBlock(type) {
            return type !== AIR
                && type !== BLOCK_WATER
                && type !== BLOCK_LEAVES
                && type !== BLOCK_GRASS_PLANT
                && !isTorchBlock(type);
        }

        const getSafe = (lx, ly, lz) => {
            if (lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE)
                return chunk.blocks[chunk.idx(lx, ly, lz)];
            const wx = chunk.wx + lx, wy = ly, wz = chunk.wz + lz;
            if (wy < 0 || wy >= CHUNK_HEIGHT) return wy < 0 ? BLOCK_BEDROCK : AIR;
            const ncx = Math.floor(wx / CHUNK_SIZE), ncz = Math.floor(wz / CHUNK_SIZE);
            const nchunk = this.getChunk(ncx, ncz);
            if (!nchunk) return AIR;
            return nchunk.get(((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, wy, ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE);
        };

        const faces = [
            { dir: [0, 1, 0], corners: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]], fi: 0 },
            { dir: [0,-1, 0], corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], fi: 1 },
            { dir: [0, 0,-1], corners: [[0,1,0],[1,1,0],[1,0,0],[0,0,0]], fi: 2 },
            { dir: [0, 0, 1], corners: [[0,1,1],[0,0,1],[1,0,1],[1,1,1]], fi: 3 },
            { dir: [1, 0, 0], corners: [[1,1,1],[1,0,1],[1,0,0],[1,1,0]], fi: 4 },
            { dir: [-1,0, 0], corners: [[0,1,0],[0,0,0],[0,0,1],[0,1,1]], fi: 5 },
        ];

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
                for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    const type = chunk.get(lx, ly, lz);
                    if (type === AIR) continue;
                    if (isTorchBlock(type)) continue; 

                    if (type === BLOCK_GRASS_PLANT) {
                        const texs = getBlockTextures(type);
                        const ti = texs[0];
                        const col = ti % TEX_COLS;
                        const row = Math.floor(ti / TEX_COLS);
                        const uMin = col / TEX_COLS;
                        const uMax = (col + 1) / TEX_COLS;
                        const vMin = row / 16;
                        const vMax = (row + 1) / 16;

                        const addQuad = (x1,y1,z1, x2,y2,z2, x3,y3,z3, x4,y4,z4) => {
                            grassPos.push(x1,y1,z1, x2,y2,z2, x3,y3,z3);
                            grassNorm.push(0,1,0, 0,1,0, 0,1,0);
                            grassUv.push(uMin, vMax, uMax, vMax, uMax, vMin);
                            grassPos.push(x1,y1,z1, x3,y3,z3, x4,y4,z4);
                            grassNorm.push(0,1,0, 0,1,0, 0,1,0);
                            grassUv.push(uMin, vMax, uMax, vMin, uMin, vMin);
                        };

                        addQuad(lx, ly, lz, lx+1, ly, lz+1, lx+1, ly+1, lz+1, lx, ly+1, lz);
                        addQuad(lx+1, ly, lz, lx, ly, lz+1, lx, ly+1, lz+1, lx+1, ly+1, lz);
                        continue;
                    }

                    const isWater = type === BLOCK_WATER;
                    const isLeaves = type === BLOCK_LEAVES;
                    const texs = getBlockTextures(type);

                    for (const f of faces) {
                        const nlx = lx + f.dir[0];
                        const nly = ly + f.dir[1];
                        const nlz = lz + f.dir[2];
                        const nb = getSafe(nlx, nly, nlz);

                        const renderFace =
                            (!isWater && !isLeaves && !isOpaqueBlock(nb)) ||
                            (isWater && nb !== BLOCK_WATER && !isOpaqueBlock(nb)) ||
                            (isLeaves && nb !== type);
                        if (!renderFace) continue;

                        const ti = texs[f.fi];
                        const col = ti % 32;
                        const row = Math.floor(ti / 32);
                        const uMin = col / 32, uMax = (col + 1) / 32;
                        const vMin = row / 16, vMax = (row + 1) / 16;

                        const corners = f.corners;
                        let useZforU = false, invertU = false;
                        if (f.dir[1] !== 0) { useZforU = false; if (f.dir[1] < 0) invertU = true; }
                        else if (f.dir[0] !== 0) { useZforU = true; if (f.dir[0] < 0) invertU = true; }
                        else { useZforU = false; if (f.dir[2] < 0) invertU = true; }

                        const uvs = [];
                        for (const corner of corners) {
                            let u, v;
                            if (f.dir[1] !== 0) { u = corner[0]; v = corner[2]; }
                            else { u = useZforU ? corner[2] : corner[0]; v = corner[1]; }
                            if (invertU) u = 1 - u;
                            uvs.push([uMin + u * (uMax - uMin), vMax - v * (vMax - vMin)]);
                        }

                        const tris = [[0,1,2],[0,2,3]];

                        if (isLeaves) {
                            for (const tri of tris) for (const vi of tri) {
                                leavesPosFull.push(lx + corners[vi][0], ly + corners[vi][1], lz + corners[vi][2]);
                                leavesNormFull.push(f.dir[0], f.dir[1], f.dir[2]);
                                leavesUvFull.push(uvs[vi][0], uvs[vi][1]);
                            }
                            if (nb !== type) {
                                for (const tri of tris) for (const vi of tri) {
                                    leavesPosShell.push(lx + corners[vi][0], ly + corners[vi][1], lz + corners[vi][2]);
                                    leavesNormShell.push(f.dir[0], f.dir[1], f.dir[2]);
                                    leavesUvShell.push(uvs[vi][0], uvs[vi][1]);
                                }
                            }
                            continue;
                        }

                        const targetPos = isWater ? waterPos : solidPos;
                        const targetNorm = isWater ? waterNorm : solidNorm;
                        const targetUv = isWater ? waterUv : solidUv;

                        for (const tri of tris) for (const vi of tri) {
                            targetPos.push(lx + corners[vi][0], ly + corners[vi][1], lz + corners[vi][2]);
                            targetNorm.push(f.dir[0], f.dir[1], f.dir[2]);
                            targetUv.push(uvs[vi][0], uvs[vi][1]);
                        }
                    }
                }
            }
        }

        const createGeo = (pos, norm, uv) => {
            if (pos.length === 0) return null;
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            return g;
        };

        return {
            solidGeo: createGeo(solidPos, solidNorm, solidUv),
            waterGeo: createGeo(waterPos, waterNorm, waterUv),
            leavesGeoFull: createGeo(leavesPosFull, leavesNormFull, leavesUvFull),
            leavesGeoShell: createGeo(leavesPosShell, leavesNormShell, leavesUvShell),
            grassGeo: createGeo(grassPos, grassNorm, grassUv),
        };
    }

    updateChunkMesh(chunk) {
        if (!chunk.dirty) return;
        chunk.dirty = false;

        if (chunk.solidMesh) { chunk.solidMesh.geometry.dispose(); this.group.remove(chunk.solidMesh); chunk.solidMesh = null; }
        if (chunk.waterMesh) { chunk.waterMesh.geometry.dispose(); this.group.remove(chunk.waterMesh); chunk.waterMesh = null; }
        if (chunk.leavesMesh) { chunk.leavesMesh.geometry.dispose(); this.group.remove(chunk.leavesMesh); chunk.leavesMesh = null; }
        if (chunk.leavesShadowMesh) { chunk.leavesShadowMesh.geometry.dispose(); this.group.remove(chunk.leavesShadowMesh); chunk.leavesShadowMesh = null; }
        if (chunk.grassMesh) { chunk.grassMesh.geometry.dispose(); this.group.remove(chunk.grassMesh); chunk.grassMesh = null; }

        // Строим новый ландшафт
        const { solidGeo, waterGeo, leavesGeoFull, leavesGeoShell, grassGeo } = this.buildChunkGeometry(chunk);

        if (solidGeo) {
            chunk.solidMesh = new THREE.Mesh(solidGeo, this.materials.solid);
            chunk.solidMesh.position.set(chunk.wx, 0, chunk.wz);
            chunk.solidMesh.castShadow = true;
            chunk.solidMesh.receiveShadow = true;
            this.group.add(chunk.solidMesh);
        }
        if (waterGeo) {
            chunk.waterMesh = new THREE.Mesh(waterGeo, this.materials.water);
            chunk.waterMesh.position.set(chunk.wx, 0, chunk.wz);
            chunk.waterMesh.renderOrder = 1;
            chunk.waterMesh.castShadow = false;
            chunk.waterMesh.receiveShadow = true;
            this.group.add(chunk.waterMesh);
        }
        if (leavesGeoFull) {
            chunk.leavesMesh = new THREE.Mesh(leavesGeoFull, this.materials.leaves);
            chunk.leavesMesh.position.set(chunk.wx, 0, chunk.wz);
            chunk.leavesMesh.castShadow = true;
            chunk.leavesMesh.receiveShadow = true;
            this.group.add(chunk.leavesMesh);
        }
        if (leavesGeoShell) {
            chunk.leavesShadowMesh = new THREE.Mesh(leavesGeoShell, this.materials.leaves);
            chunk.leavesShadowMesh.position.set(chunk.wx, 0, chunk.wz);
            chunk.leavesShadowMesh.castShadow = true;
            chunk.leavesShadowMesh.receiveShadow = false;
            chunk.leavesShadowMesh.visible = false;
            this.group.add(chunk.leavesShadowMesh);
        }
        if (grassGeo) {
            chunk.grassMesh = new THREE.Mesh(grassGeo, this.materials.grass);
            chunk.grassMesh.position.set(chunk.wx, 0, chunk.wz);
            chunk.grassMesh.castShadow = true;
            chunk.grassMesh.receiveShadow = true;
            this.group.add(chunk.grassMesh);
        }

        // 🔥 ОПТИМИЗИРОВАННЫЙ СПАВН ФАКЕЛОВ С КЭШИРОВАНИЕМ
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
                for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    const b = chunk.get(lx, ly, lz);
                    const posKey = `${lx},${ly},${lz}`;
                    
                    if (isTorchBlock(b)) {
                        const orient = getTorchOrientation(b);
                        const lit = isTorchLit(b);
                        
                        // Если факел уже есть и его состояние не изменилось - пропускаем
                        if (chunk.torches.has(posKey)) {
                            const existing = chunk.torches.get(posKey);
                            if (existing.orient === orient && existing.lit === lit) continue;
                            // Если состояние изменилось - удаляем старый
                            this.torchesGroup.remove(existing.obj.root);
                            if (existing.obj.dispose) existing.obj.dispose();
                            chunk.torches.delete(posKey);
                        }

                        // Создаем новый факел (ОТКЛЮЧАЕМ ЧАСТИЦЫ ДЛЯ ФПС!)
                        const torch = createTorch({
                            initialState: lit ? 'ground' : 'extinguished',
                            showPool: false, 
                            shadows: false,
                            emberCount: 0,  // Убираем искры
                            smokeCount: 0   // Убираем дым
                        });

                        torch.root.position.set(chunk.wx + lx + 0.5, ly, chunk.wz + lz + 0.5);

                        if (lit && orient !== 'floor') {
                            const tilt = Math.PI / 4; 
                            torch.root.position.y = ly + 0.25; 

                            if (orient === 'north') {
                                torch.root.position.z = chunk.wz + lz + 0.9;
                                torch.root.rotation.x = -tilt;
                            } else if (orient === 'south') {
                                torch.root.position.z = chunk.wz + lz + 0.1;
                                torch.root.rotation.x = tilt;
                            } else if (orient === 'east') {
                                torch.root.position.x = chunk.wx + lx + 0.1;
                                torch.root.rotation.z = -tilt;
                            } else if (orient === 'west') {
                                torch.root.position.x = chunk.wx + lx + 0.9;
                                torch.root.rotation.z = tilt;
                            }
                        }

                        // Убираем свет из самих факелов (у нас есть пул света!)
                        torch.root.traverse(child => {
                            if (child.isSprite) child.material.opacity *= 0.15;
                            if (child.isPointLight) child.intensity = 0; // ГЛУШИМ СВЕТ ВНУТРИ
                        });
                        
                        this.torchesGroup.add(torch.root);
                        chunk.torches.set(posKey, { obj: torch, orient, lit });
                    } else {
                        // Блок не факел, но в кэше есть - удаляем
                        if (chunk.torches.has(posKey)) {
                            const existing = chunk.torches.get(posKey);
                            this.torchesGroup.remove(existing.obj.root);
                            if (existing.obj.dispose) existing.obj.dispose();
                            chunk.torches.delete(posKey);
                        }
                    }
                }
            }
        }
    }

    loadQueue(cx, cz) {
        const arr = [];
        for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++)
            for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++)
                if (!this.chunks.has(this.key(cx + dx, cz + dz))) arr.push([cx + dx, cz + dz]);
        return arr;
    }

    async unloadFar(cx, cz) {
        const toRemove = [];
        const savePromises = [];

        for (const [key, chunk] of this.chunks) {
            if (Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz)) > UNLOAD_RADIUS) {
                this.removeChunkMeshes(chunk);
                if (chunk.dirty) {
                    savePromises.push(
                        this.regionManager.saveChunk(chunk.cx, chunk.cz, chunk.blocks)
                            .then(() => { chunk.dirty = false; })
                            .catch(err => console.error('Save chunk failed', err))
                    );
                }
                toRemove.push(key);
            }
        }

        if (savePromises.length) await Promise.all(savePromises);
        for (const key of toRemove) this.chunks.delete(key);
    }

    removeChunkMeshes(chunk) {
        if (chunk.solidMesh) { chunk.solidMesh.geometry.dispose(); this.group.remove(chunk.solidMesh); chunk.solidMesh = null; }
        if (chunk.waterMesh) { chunk.waterMesh.geometry.dispose(); this.group.remove(chunk.waterMesh); chunk.waterMesh = null; }
        if (chunk.leavesMesh) { chunk.leavesMesh.geometry.dispose(); this.group.remove(chunk.leavesMesh); chunk.leavesMesh = null; }
        if (chunk.leavesShadowMesh) { chunk.leavesShadowMesh.geometry.dispose(); this.group.remove(chunk.leavesShadowMesh); chunk.leavesShadowMesh = null; }
        if (chunk.grassMesh) { chunk.grassMesh.geometry.dispose(); this.group.remove(chunk.grassMesh); chunk.grassMesh = null; }
        
        if (chunk.torches) {
            for (const [_, data] of chunk.torches) {
                this.torchesGroup.remove(data.obj.root);
                if (data.obj.dispose) data.obj.dispose();
            }
            chunk.torches.clear();
        }
    }

    async loadChunkAsync(cx, cz) {
        if (this.chunks.has(this.key(cx, cz))) return;
        const c = new Chunk(cx, cz);
        const loadedBlocks = await this.regionManager.loadChunk(cx, cz);
        if (loadedBlocks && loadedBlocks.length === CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE) {
            c.blocks.set(loadedBlocks);
            c.dirty = false;
        } else {
            const generated = this.generateChunk(cx, cz);
            c.blocks = generated.blocks;
        }
        this.chunks.set(this.key(cx, cz), c);
        this.updateChunkMesh(c);
    }

    async saveAllDirty() {
        const promises = [];
        for (const [, chunk] of this.chunks) {
            if (chunk.dirty) {
                promises.push(this.regionManager.saveChunk(chunk.cx, chunk.cz, chunk.blocks));
            }
        }
        await Promise.all(promises);
    }
}