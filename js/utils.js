import * as THREE from 'three';
import { atlasCanvas } from './rendering.js';
import {
    REACH_DIST, AIR, BLOCK_WATER, TEX_COLS, TEX_CELL, getBlockTextures, BLOCK_TYPES, BLOCK_LEAVES, BLOCK_JUNGLE_LEAVES, BLOCK_GRASS_PLANT
} from './constants.js';
// import { scene, camera } from './rendering.js';


let scene;
let offscreenRenderer = null;
let offscreenScene = null;
let offscreenCamera = null;
let offscreenLight = null;
let offscreenAmbient = null;

export function setUtilsScene(s) { scene = s; }

const iconCache = {};

// Вспомогательная функция: извлечение ImageData текстуры из атласа
function getTextureImageData(texIdx) {
    const col = texIdx % TEX_COLS;
    const row = Math.floor(texIdx / TEX_COLS);
    const offX = col * TEX_CELL;
    const offY = row * TEX_CELL;

    // Создаём временный холст, чтобы скопировать кусок атласа
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = TEX_CELL;
    tempCanvas.height = TEX_CELL;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(atlasCanvas, offX, offY, TEX_CELL, TEX_CELL, 0, 0, TEX_CELL, TEX_CELL);
    return tempCtx.getImageData(0, 0, TEX_CELL, TEX_CELL);
}

// Рисование искажённой грани (как в моём деревянном блоке)
function drawIsometricFace(ctx, vertices, imgData, brightness = 1.0) {
    // vertices – массив из 4 точек [{x, y}, ...] по часовой стрелке или против
    const data = imgData.data;
    const size = TEX_CELL; // 16
    const step = 1 / size;

    for (let ty = 0; ty < size; ty++) {
        for (let tx = 0; tx < size; tx++) {
            // Нормированные координаты текстуры (центр пикселя)
            const u = (tx + 0.5) / size;
            const v = (ty + 0.5) / size;

            // Билинейная интерполяция по четырёхугольнику
            const ax = vertices[0].x + (vertices[1].x - vertices[0].x) * u;
            const ay = vertices[0].y + (vertices[1].y - vertices[0].y) * u;
            const bx = vertices[3].x + (vertices[2].x - vertices[3].x) * u;
            const by = vertices[3].y + (vertices[2].y - vertices[3].y) * u;
            const px = ax + (bx - ax) * v;
            const py = ay + (by - ay) * v;

            // Получаем цвет пикселя из ImageData
            const idx = (ty * size + tx) * 4;
            let r = data[idx];
            let g = data[idx + 1];
            let b = data[idx + 2];

            // Применяем яркость (освещение)
            r = Math.min(255, r * brightness);
            g = Math.min(255, g * brightness);
            b = Math.min(255, b * brightness);

            // Рисуем мини-квадратик (пиксель)
            const pixelSize = (size / 16) * 0.9; // чуть меньше шага для зазоров
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(px - pixelSize/2, py - pixelSize/2, pixelSize, pixelSize);
        }
    }
}

export function getBlockIcon(type) {
    if (iconCache[type]) return iconCache[type];

    // 3D‑иконка для блоков
    if (BLOCK_TYPES.has(type)) {
        const dataUrl = renderBlockIcon3D(type);
        iconCache[type] = dataUrl;
        return dataUrl;
    }

    // Плоская иконка для предметов (без изменений)
    const texIdx = getBlockTextures(type)[0] || 0;
    const col = texIdx % TEX_COLS;
    const row = Math.floor(texIdx / TEX_COLS);
    const canvas = document.createElement('canvas');
    canvas.width = TEX_CELL;
    canvas.height = TEX_CELL;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlasCanvas, col * TEX_CELL, row * TEX_CELL, TEX_CELL, TEX_CELL, 0, 0, TEX_CELL, TEX_CELL);
    const dataUrl = canvas.toDataURL();
    iconCache[type] = dataUrl;
    return dataUrl;
}

export function createDroppedItemSprite(type) {
    const iconUrl = getBlockIcon(type);
    const map = new THREE.TextureLoader().load(iconUrl);
    const material = new THREE.SpriteMaterial({ map, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.35, 0.35, 1);
    return sprite;
}

export function dropItem(type, count, position, world) {
    const sprite = createDroppedItemSprite(type);
    sprite.position.copy(position);
    sprite.userData = { type, count, time: performance.now() };
    if (scene) scene.add(sprite);
    world.droppedItems.push(sprite);
}

/**
 * DDA-луч, игнорирующий блоки воды.
 * Увеличен лимит итераций для прохождения сквозь толщу воды.
 */
export function raycast(world, origin, dir, maxDist = REACH_DIST) {
    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);
    const tDeltaX = Math.abs(1 / (dir.x || 0.0001));
    const tDeltaY = Math.abs(1 / (dir.y || 0.0001));
    const tDeltaZ = Math.abs(1 / (dir.z || 0.0001));

    let cx = Math.floor(origin.x);
    let cy = Math.floor(origin.y);
    let cz = Math.floor(origin.z);

    let tMaxX = (stepX > 0 ? (cx + 1 - origin.x) : (origin.x - cx)) * tDeltaX;
    let tMaxY = (stepY > 0 ? (cy + 1 - origin.y) : (origin.y - cy)) * tDeltaY;
    let tMaxZ = (stepZ > 0 ? (cz + 1 - origin.z) : (origin.z - cz)) * tDeltaZ;

    let prevX = cx, prevY = cy, prevZ = cz;

    // Увеличиваем запас итераций – теперь 3 * maxDist (24 для REACH_DIST=8)
    const maxIterations = Math.ceil(maxDist * 3);

    for (let i = 0; i < maxIterations; i++) {
        const block = world.getBlock(cx, cy, cz);

        // Пропускаем воздух и воду
        if (block !== AIR && block !== BLOCK_WATER) {
            return {
                hit: true,
                pos: { x: cx, y: cy, z: cz },
                prev: { x: prevX, y: prevY, z: prevZ },
                type: block
            };
        }

        prevX = cx;
        prevY = cy;
        prevZ = cz;

        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
            if (tMaxX > maxDist) break;
            cx += stepX;
            tMaxX += tDeltaX;
        } else if (tMaxY < tMaxZ) {
            if (tMaxY > maxDist) break;
            cy += stepY;
            tMaxY += tDeltaY;
        } else {
            if (tMaxZ > maxDist) break;
            cz += stepZ;
            tMaxZ += tDeltaZ;
        }
    }

    return { hit: false };
}

function initOffscreenIconRenderer() {
    if (offscreenRenderer) return;
    
    // Рендерер (не привязан к DOM, рисуем в скрытый canvas)
    offscreenRenderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true,
        preserveDrawingBuffer: true 
    });
    offscreenRenderer.setSize(60, 60);
    offscreenRenderer.setPixelRatio(1);  // иконки 64x64
    // offscreenRenderer.setClearColor(0x000000, 0);
    
    // Сцена
    offscreenScene = new THREE.Scene();
    
    // // Освещение
    // offscreenAmbient = new THREE.AmbientLight(0x444444);
    // offscreenScene.add(offscreenAmbient);
    
    // offscreenLight = new THREE.DirectionalLight(0xffffff, 1.5);
    // offscreenLight.position.set(1, 2, 1);
    // offscreenScene.add(offscreenLight);
    
    // Камера (перспектива для объёма)
    offscreenCamera = new THREE.PerspectiveCamera(30, 1, 2, 15);
    offscreenCamera.position.set(1.85, 2, 1.85);
    offscreenCamera.lookAt(0, 0, 0);
}

function renderBlockIcon3D(type) {
    initOffscreenIconRenderer();
    
    const texIndices = getBlockTextures(type);
    
    const faceTextures = texIndices.map(idx => {
        const col = idx % TEX_COLS;
        const row = Math.floor(idx / TEX_COLS);
        const sx = col * TEX_CELL;
        const sy = row * TEX_CELL;
        
        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = TEX_CELL;
        faceCanvas.height = TEX_CELL;
        const ctx = faceCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(atlasCanvas, sx, sy, TEX_CELL, TEX_CELL, 0, 0, TEX_CELL, TEX_CELL);
        
        const texture = new THREE.CanvasTexture(faceCanvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    });
    
    const isWaterBlock = type === BLOCK_WATER;
    const isLeavesBlock = type === BLOCK_LEAVES || type === BLOCK_JUNGLE_LEAVES;
    const isGrassPlantBlock = type === BLOCK_GRASS_PLANT;
    
    let geometry;
    let materials;
    
    if (isWaterBlock) {
        geometry = new THREE.BoxGeometry(1, 1, 1);
        materials = faceTextures.map(tex => new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0.65,
            depthWrite: false
        }));
    } else if (isLeavesBlock) {
        geometry = new THREE.BoxGeometry(1, 1, 1);
        materials = faceTextures.map(tex => new THREE.MeshBasicMaterial({
            map: tex,
            alphaTest: 0.5
        }));
    } else if (isGrassPlantBlock) {
        geometry = new THREE.BoxGeometry(1, 1, 0.1);
        const transparentMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false
        });
        const matFront = new THREE.MeshBasicMaterial({
            map: faceTextures[2],
            alphaTest: 0.5
        });
        const matBack = new THREE.MeshBasicMaterial({
            map: faceTextures[3],
            alphaTest: 0.5
        });
        materials = [
            transparentMat, transparentMat, transparentMat, transparentMat,
            matFront, matBack
        ];
    } else {
        // Обычный блок
        geometry = new THREE.BoxGeometry(1, 1, 1);
        materials = [
            new THREE.MeshBasicMaterial({ map: faceTextures[4] }),
            new THREE.MeshBasicMaterial({ map: faceTextures[5] }),
            new THREE.MeshBasicMaterial({ map: faceTextures[0] }),
            new THREE.MeshBasicMaterial({ map: faceTextures[1] }),
            new THREE.MeshBasicMaterial({ map: faceTextures[2] }),
            new THREE.MeshBasicMaterial({ map: faceTextures[3] })
        ];
    }
    
    const cube = new THREE.Mesh(geometry, materials);
    offscreenScene.add(cube);
    offscreenRenderer.render(offscreenScene, offscreenCamera);
    const dataUrl = offscreenRenderer.domElement.toDataURL();
    offscreenScene.remove(cube);
    
    geometry.dispose();
    materials.forEach(m => m.dispose());
    faceTextures.forEach(t => t.dispose());
    
    return dataUrl;
}

export function createBlockMesh(type) {
    const texIndices = getBlockTextures(type); // [top, bottom, front, back, right, left]

    // Сначала создаём все канвасы для граней
    const faceCanvases = texIndices.map(idx => {
        const col = idx % TEX_COLS;
        const row = Math.floor(idx / TEX_COLS);
        const sx = col * TEX_CELL;
        const sy = row * TEX_CELL;

        const faceCanvas = document.createElement('canvas');
        faceCanvas.width = TEX_CELL;
        faceCanvas.height = TEX_CELL;
        const ctx = faceCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(atlasCanvas, sx, sy, TEX_CELL, TEX_CELL, 0, 0, TEX_CELL, TEX_CELL);
        return faceCanvas;
    });

    // Затем текстуры из канвасов
    const faceTextures = faceCanvases.map(canvas => {
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    });

    const isItem = !BLOCK_TYPES.has(type);
    const isWaterBlock = type === BLOCK_WATER;
    const isLeavesBlock = type === BLOCK_LEAVES || type === BLOCK_JUNGLE_LEAVES;
    const isGrassPlantBlock = type === BLOCK_GRASS_PLANT;

    let geometry;
    let materials;

    if (isWaterBlock) {
        geometry = new THREE.BoxGeometry(1, 1, 1);
        materials = faceTextures.map(tex => new THREE.MeshStandardMaterial({
            map: tex,
            transparent: true,
            opacity: 0.65,
            depthWrite: false,
            roughness: 0.2,
            metalness: 0.3
        }));
    } else if (isLeavesBlock) {
        geometry = new THREE.BoxGeometry(1, 1, 1);
        materials = faceTextures.map(tex => new THREE.MeshStandardMaterial({
            map: tex,
            alphaTest: 0.5,
            transparent: false,
            roughness: 0.8,
            metalness: 0.0
        }));
    } else if (isItem || isGrassPlantBlock) {
        const thickness = isGrassPlantBlock ? 0.1 : 1/16;
        geometry = new THREE.BoxGeometry(1, 1, thickness);

        // Создаём цветные текстуры для боковых граней
        const edgeIndex = { top: 0, bottom: 1, right: 4, left: 5 };

const createEdgeMaterial = (edge) => {
    const color = getEdgeColor(faceCanvases[edgeIndex[edge]], edge);
    if (!color) {
        return new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            roughness: 0.8
        });
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    ctx.fillRect(0, 0, 1, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8
    });
};

const topMat = createEdgeMaterial('top');
const bottomMat = createEdgeMaterial('bottom');
const leftMat = createEdgeMaterial('left');
const rightMat = createEdgeMaterial('right');

materials = [
    rightMat, leftMat, topMat, bottomMat,
    new THREE.MeshStandardMaterial({
        map: faceTextures[2],
        alphaTest: isGrassPlantBlock ? 0.5 : 0.1,
        roughness: 0.8
    }),
    new THREE.MeshStandardMaterial({
        map: faceTextures[3],
        alphaTest: isGrassPlantBlock ? 0.5 : 0.1,
        roughness: 0.8
    })
];
    } else {
        // Обычный блок
        geometry = new THREE.BoxGeometry(1, 1, 1);
        materials = [
            new THREE.MeshStandardMaterial({ map: faceTextures[4], roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ map: faceTextures[5], roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ map: faceTextures[0], roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ map: faceTextures[1], roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ map: faceTextures[2], roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ map: faceTextures[3], roughness: 0.6 })
        ];
    }

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
}

function getEdgeColor(sourceCanvas, edge) {
    const ctx = sourceCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, TEX_CELL, TEX_CELL);
    const data = imageData.data;
    let r = 0, g = 0, b = 0, count = 0;
    const size = TEX_CELL;

    const processPixel = (x, y) => {
        const idx = (y * size + x) * 4;
        if (data[idx + 3] > 0) {
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            count++;
        }
    };

    if (edge === 'top') {
        for (let x = 0; x < size; x++) processPixel(x, 0);
    } else if (edge === 'bottom') {
        for (let x = 0; x < size; x++) processPixel(x, size - 1);
    } else if (edge === 'left') {
        for (let y = 0; y < size; y++) processPixel(0, y);
    } else if (edge === 'right') {
        for (let y = 0; y < size; y++) processPixel(size - 1, y);
    }

    if (count === 0) return null;
    return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

export function createPixelatedItemMesh(type) {
    const texIndices = getBlockTextures(type); // [top, bottom, front, back, right, left]
    // Берём канвас для передней грани (для предметов он же используется на задней)
    const frontIdx = 2;
    const idx = texIndices[frontIdx];
    const col = idx % TEX_COLS;
    const row = Math.floor(idx / TEX_COLS);
    const sx = col * TEX_CELL;
    const sy = row * TEX_CELL;

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = TEX_CELL;
    sourceCanvas.height = TEX_CELL;
    const sctx = sourceCanvas.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(atlasCanvas, sx, sy, TEX_CELL, TEX_CELL, 0, 0, TEX_CELL, TEX_CELL);
    const imageData = sctx.getImageData(0, 0, TEX_CELL, TEX_CELL);
    const data = imageData.data;

    const thickness = type === BLOCK_GRASS_PLANT ? 0.1 : 1/16; // трава чуть толще
    const size = TEX_CELL;
    const half = 0.5;
    const unit = 1 / size;

    const group = new THREE.Group();

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const p = (y * size + x) * 4;
            if (data[p + 3] === 0) continue; // прозрачный пиксель пропускаем

            const r = data[p];
            const g = data[p + 1];
            const b = data[p + 2];

            // Создаём мини‑канвас 1×1 с цветом пикселя (для лицевой/тыльной грани)
            const pixelCanvas = document.createElement('canvas');
            pixelCanvas.width = 1;
            pixelCanvas.height = 1;
            const pctx = pixelCanvas.getContext('2d');
            pctx.fillStyle = `rgb(${r},${g},${b})`;
            pctx.fillRect(0, 0, 1, 1);

            const pixelTex = new THREE.CanvasTexture(pixelCanvas);
            pixelTex.magFilter = THREE.NearestFilter;
            pixelTex.minFilter = THREE.NearestFilter;
            pixelTex.colorSpace = THREE.SRGBColorSpace;

            // Материалы для 6 граней микро‑куба
            const faceMat = new THREE.MeshStandardMaterial({
                map: pixelTex,
                roughness: 0.8,
                alphaTest: 0.1       // чтобы обрезать прозрачность (если вдруг альфа не 255)
            });
            const sideMat = new THREE.MeshStandardMaterial({
                color: `rgb(${r},${g},${b})`,
                roughness: 0.8
            });

            const materials = [
                sideMat,  // +X (право)
                sideMat,  // -X (лево)
                sideMat,  // +Y (верх)
                sideMat,  // -Y (низ)
                faceMat,  // +Z (перед)
                faceMat   // -Z (зад)
            ];

            const geo = new THREE.BoxGeometry(unit, unit, thickness);
            const cube = new THREE.Mesh(geo, materials);
            // Позиционируем: x от 0 до 15, центр пикселя
            cube.position.set(
                (x / size) - half + unit/2,
                (y / size) - half + unit/2,
                0
            );
            group.add(cube);
        }
    }

    return group;
}