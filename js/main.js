// js/main.js
import * as THREE from 'three';
import { raycast, createBlockMesh, createPixelatedItemMesh } from './utils.js';
import {
    initRendering, scene, camera, renderer, materials,
    updateDayNightCycle, updateSkyObjects, updateLensFlares, updateShadowCamera,
    sunMesh
} from './rendering.js';
import { setUtilsScene } from './utils.js';
import { inventory } from './inventory.js';
import { World } from './world.js';
import { Player } from './player.js';
import * as ui from './ui.js';
import {
    initControls, isNoclipActive, applyMovement, currentVehicle,
    getCarInput, thirdPersonMode, setGameStarted,
} from './controls.js';
import {
    CHUNK_SIZE, RENDER_RADIUS, BLOCK_TYPES, BLOCK_GRASS_PLANT, BLOCK_WATER, ITEM_SHOTGUN, ITEM_TORCH,
} from './constants.js';
import { createPlayerModel, animatePlayerModel, setSkin } from './player-model.js';
import { initMenu } from './menu.js';
import { RegionManager } from './region-manager.js';
import { Shotgun } from './shotgun.js';
import { TowerEntity } from './tower-entity.js';
import { soundEngine, materialFromBlock } from './sounds.js';
import { BlockEffects } from './block-effects.js';
import { TorchManager } from './torch-manager.js';

let world;
let player;
let playerModel;
let handItemGroup;
let currentHandItemType = null;
let cameraTargetPos = new THREE.Vector3();
let cameraCurrentPos = new THREE.Vector3();
let cameraSmoothInitialized = false;

let blockEffects = null;
let torchManager = null;

const DAY_LENGTH = 24000;
let gameTime = DAY_LENGTH;

let lastTime = performance.now();
let chunkQueue = [];
let frameSkip = 0;

let footstepDistance = 0;
let wasOnGround = false;
let wasInWater = false;
let prevFallSpeed = 0;

// ---------------- Главная точка входа ----------------
async function main() {
    initMenu(onWorldSelected);
}

function onWorldSelected(worldData, worldName, seed = null) {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('world-select').style.display = 'none';
    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('overlay').style.display = 'flex';

    const onStartClick = async () => {
        document.getElementById('overlay').removeEventListener('click', onStartClick);
        document.getElementById('overlay').style.display = 'none';
        document.getElementById('pause-menu').style.display = 'none';

        document.body.requestPointerLock();

        // Инициализация звука (требуется user gesture)
        soundEngine.init();
        soundEngine.startAmbient();

        await initRendering();
        setUtilsScene(scene);

        const regionManager = new RegionManager(worldName || 'default');
        await regionManager.init();

        const actualSeed = (seed !== null) ? seed : Math.floor(Math.random() * 2147483647);
        world = new World(materials, actualSeed, regionManager);

        player = new Player(world);

        const startHeight = world.getTerrainHeightAt(0, 0);
        console.log('Spawn height:', startHeight);
        player.pos.set(0, startHeight + 2, 0);

        await generateInitialChunks();

        ui.initUI();

        // Создаём дробовик и передаём в controls
        const shotgun = new Shotgun(scene, camera, world, player, inventory);
        window.currentShotgun = shotgun;

        // Эффекты разрушения/установки блоков
        blockEffects = new BlockEffects(scene, world);
        window.blockEffects = blockEffects;

        // Менеджер факелов (свет + частицы)
        torchManager = new TorchManager(scene, world);

        initControls({ inventory, ui, player, world, shotgun, blockEffects });

        // Если дробовик уже выбран в хотбаре — сразу экипировать
        if (inventory.getSelectedType() === ITEM_SHOTGUN) {
            shotgun.equip();
        }

        setupSaveLoad(worldName);

        playerModel = createPlayerModel();
        playerModel.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Сброс старого input для загрузки файла
        const oldLoadInput = document.getElementById('load-file-input');
        const newLoadInput = oldLoadInput.cloneNode(true);
        oldLoadInput.parentNode.replaceChild(newLoadInput, oldLoadInput);

        // Кнопка скина
        document.getElementById('skin-btn').addEventListener('click', () => {
            document.getElementById('skin-file-input').click();
        });
        document.getElementById('skin-file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => setSkin(playerModel, img);
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        playerModel.visible = false;
        scene.add(playerModel);
        handItemGroup = new THREE.Group();
        scene.add(handItemGroup);

        setGameStarted(true);
        requestAnimationFrame(loop);
    };

    document.getElementById('overlay').addEventListener('click', onStartClick);
}

async function generateInitialChunks() {
    const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
    const pcz = Math.floor(player.pos.z / CHUNK_SIZE);
    const queue = world.loadQueue(pcx, pcz);
    for (const [cx, cz] of queue) {
        await world.loadChunkAsync(cx, cz);
    }

    window.world = world;
    window.player = player;
    window.inventory = inventory;
    window.ui = ui;
    window.scene = scene;
    window.camera = camera;
    window.renderer = renderer;
    window.THREE = THREE;
    window.gameTime = gameTime;
    window.DAY_LENGTH = 33 * 60;
}

function updateHandItemType() {
    if (!handItemGroup) return;
    const selectedType = inventory.getSelectedType();
    if (selectedType === currentHandItemType) return;

    while (handItemGroup.children.length > 0) {
        handItemGroup.remove(handItemGroup.children[0]);
    }

    if (selectedType === ITEM_SHOTGUN) {
        currentHandItemType = selectedType;
        return;
    }

    if (selectedType !== null) {
        const isItem = !BLOCK_TYPES.has(selectedType);
        const isGrassPlant = selectedType === BLOCK_GRASS_PLANT;
        const isWater = selectedType === BLOCK_WATER;

        let handObject;
        if (isItem || isGrassPlant) {
            handObject = createPixelatedItemMesh(selectedType);
            handObject.scale.set(0.8, 0.8, 0.8);
            handObject.position.set(0.3, -0.75, -0.5);
            handObject.rotation.set(0.3, -4.65, 1.75);
            
            // --- СВЕТ ДЛЯ ФАКЕЛА В РУКЕ ---
            function updateHandItemType() {
    if (!handItemGroup) return;
    const selectedType = inventory.getSelectedType();
    if (selectedType === currentHandItemType) return;

    while (handItemGroup.children.length > 0) {
        handItemGroup.remove(handItemGroup.children[0]);
    }

    if (selectedType === ITEM_SHOTGUN) {
        currentHandItemType = selectedType;
        return;
    }

    if (selectedType !== null) {
        const isItem = !BLOCK_TYPES.has(selectedType);
        const isGrassPlant = selectedType === BLOCK_GRASS_PLANT;
        const isWater = selectedType === BLOCK_WATER;

        let handObject;
        
        if (isItem || isGrassPlant) {
            handObject = createPixelatedItemMesh(selectedType);
            handObject.scale.set(0.8, 0.8, 0.8);
            handObject.position.set(0.3, -0.75, -0.5);
            handObject.rotation.set(0.3, -4.65, 1.75);
            
            // --- СВЕТ ДЛЯ ФАКЕЛА В РУКЕ ---
            if (selectedType === ITEM_TORCH) {
                const light = new THREE.PointLight(0xffa64d, 2.0, 8, 2);
                light.position.set(0, 0.5, 0); // Сдвиг к кончику
                handObject.add(light);
                
                // Подсвечиваем саму модель (с учетом массивов материалов)
                handObject.traverse(child => {
                    if (child.isMesh && child.material) {
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(mat => {
                                const m = mat.clone();
                                if (m.emissive) {
                                    m.emissive = new THREE.Color(0xffaa55);
                                    m.emissiveIntensity = 0.6;
                                }
                                return m;
                            });
                        } else {
                            child.material = child.material.clone();
                            if (child.material.emissive) {
                                child.material.emissive = new THREE.Color(0xffaa55);
                                child.material.emissiveIntensity = 0.6;
                            }
                        }
                    }
                });
            }
        } else if (isWater) {
            handObject = createBlockMesh(selectedType);
            handObject.scale.set(0.4, 0.4, 0.4);
            handObject.position.set(-0.0, -0.6, -0.3);
            handObject.rotation.set(-0.0, 0.5, -0.0);
        } else {
            handObject = createBlockMesh(selectedType);
            handObject.scale.set(0.4, 0.4, 0.4);
            handObject.position.set(-0.0, -0.6, -0.3);
            handObject.rotation.set(-0.0, 0.5, -0.0);
        }
        
        handItemGroup.add(handObject);
    }
    currentHandItemType = selectedType;
}}}}
function setupSaveLoad(worldName) {
    document.getElementById('save-btn').addEventListener('click', async () => {
        try {
            await world.saveAllDirty();
            alert('Мир сохранён');
        } catch (err) {
            console.error('Ошибка сохранения мира:', err);
            alert('Не удалось сохранить мир');
        }
    });

    const loadInput = document.getElementById('load-file-input');
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => loadInput.click());
        loadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            alert('Загрузка из файла отключена. Все сохранения находятся в браузере (OPFS).');
            loadInput.value = '';
        });
    }
}

// Главный цикл обновления
function loop(time) {
    requestAnimationFrame(loop);

    let dt = (time - lastTime) / 1000;
    if (dt <= 0) dt = 0.016;
    if (dt > 0.1) dt = 0.1;
    lastTime = time;

    gameTime += dt;
    const progress = (gameTime % DAY_LENGTH) / DAY_LENGTH;
    const totalGameMinutes = progress * 24 * 60;
    const hours = Math.floor(totalGameMinutes / 60) % 24;
    const minutes = Math.floor(totalGameMinutes % 60);
    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const isDaytime = hours >= 6 && hours < 18;
    const clockTimeEl = document.getElementById('clock-time');
    const clockIconEl = document.getElementById('clock-icon');
    if (clockTimeEl) clockTimeEl.textContent = timeString;
    if (clockIconEl) {
        clockIconEl.textContent = isDaytime ? '☀️' : '🌙';
        clockIconEl.style.transform = isDaytime ? 'scale(1.2)' : 'scale(0.9)';
    }
    if (!isDaytime && world.towerEntities.length === 0) {
        const angle = Math.random() * Math.PI * 2;
        const spawnX = player.pos.x + Math.cos(angle) * 20;
        const spawnZ = player.pos.z + Math.sin(angle) * 20;
        const spawnY = world.getTerrainHeightAt(spawnX, spawnZ) + 1;

        const tower = new TowerEntity(new THREE.Vector3(spawnX, spawnY, spawnZ));
        world.addTowerEntity(tower);
    }
    // Удаление башен днём
    else if (isDaytime && world.towerEntities.length > 0) {
        for (const tower of world.towerEntities) {
            world.removeTowerEntity(tower);
        }
    }

    updateDayNightCycle(progress, camera.position);

    applyMovement(dt);
    world.updateCars(dt, world, () => currentVehicle ? getCarInput() : {});
    world.updateTowers(dt, player.pos);

    // Факелы (свет + частицы)
    if (torchManager) torchManager.update(dt, player.pos);

    if (currentVehicle) player.pos.copy(currentVehicle.position);

    // ========== ПРЕДМЕТ В РУКЕ (только вид от первого лица) ==========
    if (handItemGroup && !currentVehicle && thirdPersonMode === 0 && !ui.isInventoryOpen()) {
        const selected = inventory.getSelectedType();
        if (selected !== ITEM_SHOTGUN) {
            updateHandItemType();

            const cameraPos = camera.position;
            const cameraQuat = camera.quaternion;
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuat);
            const down = new THREE.Vector3(0, -1, 0).applyQuaternion(cameraQuat);
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuat);

            const offsetRight = 0.45;
            const offsetDown = -0.35;
            const offsetForward = 0.5;

            let targetPos = cameraPos.clone()
                .add(right.clone().multiplyScalar(offsetRight))
                .add(down.clone().multiplyScalar(offsetDown))
                .add(forward.clone().multiplyScalar(offsetForward));

            const speed = player.vel.length();
            if (player.onGround && speed > 0.3) {
                const vb = Math.sin(player.bobTimer * 2) * 0.03;
                const hb = Math.cos(player.bobTimer) * 0.015;
                targetPos.y += vb;
                targetPos.add(right.clone().multiplyScalar(hb));
            }

            handItemGroup.position.copy(targetPos);
            handItemGroup.quaternion.copy(cameraQuat);
            handItemGroup.rotateX(-0.1);
            handItemGroup.rotateY(0.05);
        } else {
            handItemGroup.position.set(0, -1000, 0);
        }
    } else {
        if (handItemGroup) handItemGroup.position.set(0, -1000, 0);
    }

    // ========== АНИМАЦИЯ ИГРОКА ==========
    if (playerModel) {
        const realHSpeed = Math.sqrt(player.vel.x ** 2 + player.vel.z ** 2);
        animatePlayerModel(playerModel, realHSpeed, time * 0.001);
        playerModel.position.set(player.pos.x, player.pos.y + 0.01, player.pos.z);
        playerModel.rotation.y = player.yaw + Math.PI;
        playerModel.visible = (thirdPersonMode > 0) && !currentVehicle;
    }

    // ========== КАМЕРА ==========
    if (currentVehicle) {
        camera.position.copy(currentVehicle.getCameraPosition());
        const lookAt = currentVehicle.position.clone();
        lookAt.y += 0.8;
        camera.lookAt(lookAt);
        cameraSmoothInitialized = false;
    } else if (thirdPersonMode === 1 || thirdPersonMode === 2) {
        const dist = 5;
        const height = 2;
        const factor = (thirdPersonMode === 1) ? -1 : 1;
        const camDir = new THREE.Vector3(
            Math.sin(player.yaw) * Math.cos(player.pitch) * factor,
            Math.sin(player.pitch),
            Math.cos(player.yaw) * Math.cos(player.pitch) * factor
        ).normalize();
        const eye = player.eyePos();
        const idealPos = eye.clone().add(camDir.clone().multiplyScalar(-dist));
        idealPos.y += height;

        const rayOrigin = eye.clone();
        const rayDir = idealPos.clone().sub(rayOrigin).normalize();
        const maxDist = idealPos.distanceTo(rayOrigin);
        const result = raycast(world, rayOrigin, rayDir, maxDist);
        if (result.hit) {
            const hitPoint = new THREE.Vector3(result.prev.x + 0.5, result.prev.y + 0.5, result.prev.z + 0.5);
            const collisionDist = rayOrigin.distanceTo(hitPoint);
            const safeDist = Math.max(0.1, collisionDist - 0.3);
            cameraTargetPos.copy(rayOrigin.clone().add(rayDir.clone().multiplyScalar(safeDist)));
        } else {
            cameraTargetPos.copy(idealPos);
        }

        if (!cameraSmoothInitialized) {
            cameraCurrentPos.copy(cameraTargetPos);
            cameraSmoothInitialized = true;
        }
        const lerpFactor = Math.min(1.0, 12.0 * dt);
        cameraCurrentPos.lerp(cameraTargetPos, lerpFactor);
        camera.position.copy(cameraCurrentPos);

        const speed = player.vel.length();
        if (player.onGround && speed > 0.3 && !currentVehicle) {
            const bobSpeed = 7.0;
            const vertAmp = 0.03;
            const horzAmp = 0.015;
            player.bobTimer += dt * bobSpeed;
            const vb = Math.sin(player.bobTimer * 2) * vertAmp;
            const hb = Math.cos(player.bobTimer) * horzAmp;
            const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const camRgt = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const fw = new THREE.Vector3(camFwd.x, 0, camFwd.z).normalize();
            const ri = new THREE.Vector3(camRgt.x, 0, camRgt.z).normalize();
            camera.position.x += ri.x * hb + fw.x * hb * 0.1;
            camera.position.y += vb;
            camera.position.z += ri.z * hb + fw.z * hb * 0.1;
        } else {
            player.bobTimer = 0;
        }
        camera.lookAt(eye.x, eye.y - 0.5, eye.z);
    } else {
        camera.position.copy(player.eyePos());
        const speed = player.vel.length();
        if (player.onGround && speed > 0.3) {
            const bobSpeed = 7.0;
            const vertAmp = 0.09;
            const horzAmp = 0.025;
            player.bobTimer += dt * bobSpeed;
            const vb = Math.sin(player.bobTimer * 2) * vertAmp;
            const hb = Math.cos(player.bobTimer) * horzAmp;
            const camFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const camRgt = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const fw = new THREE.Vector3(camFwd.x, 0, camFwd.z).normalize();
            const ri = new THREE.Vector3(camRgt.x, 0, camRgt.z).normalize();
            camera.position.x += ri.x * hb + fw.x * hb * 0.1;
            camera.position.y += vb;
            camera.position.z += ri.z * hb + fw.z * hb * 0.1;
        } else {
            player.bobTimer = 0;
        }
        camera.rotation.order = 'YXZ';
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;
        cameraSmoothInitialized = false;
    }

    // ========== ОКРУЖЕНИЕ И ЧАНКИ ==========
    updateSkyObjects(camera.position);
    updateLensFlares(camera, sunMesh.position);
    const shadowTarget = currentVehicle ? currentVehicle.position.clone() : player.eyePos();
    updateShadowCamera(shadowTarget);

    frameSkip++;
    if (frameSkip >= 15) {
        frameSkip = 0;
        const centerX = currentVehicle ? currentVehicle.position.x : player.pos.x;
        const centerZ = currentVehicle ? currentVehicle.position.z : player.pos.z;
        const pcx = Math.floor(centerX / CHUNK_SIZE);
        const pcz = Math.floor(centerZ / CHUNK_SIZE);
        world.unloadFar(pcx, pcz).catch(err => console.error('unloadFar error', err));
        chunkQueue = world.loadQueue(pcx, pcz);
    }
    let loaded = 0;
    if (chunkQueue.length && loaded < 2) {
        const [cx, cz] = chunkQueue.shift();
        if (!world.getChunk(cx, cz)) {
            world.loadChunkAsync(cx, cz).then(() => {});
            loaded++;
        }
    }

    for (const [, chunk] of world.chunks) {
        if (chunk.dirty) {
            const centerX = currentVehicle ? currentVehicle.position.x : player.pos.x;
            const centerZ = currentVehicle ? currentVehicle.position.z : player.pos.z;
            const dist = Math.max(
                Math.abs(chunk.cx - Math.floor(centerX / CHUNK_SIZE)),
                Math.abs(chunk.cz - Math.floor(centerZ / CHUNK_SIZE))
            );
            if (dist <= RENDER_RADIUS + 1) world.updateChunkMesh(chunk);
        }
    }

    // ========== ПАДАЮЩИЕ ПРЕДМЕТЫ ==========
    const now = performance.now();
    for (let i = world.droppedItems.length - 1; i >= 0; i--) {
        const s = world.droppedItems[i];
        if ((now - s.userData.time) > 300000) {
            scene.remove(s);
            world.droppedItems.splice(i, 1);
            continue;
        }
        if (player.eyePos().distanceTo(s.position) < 1.8) {
            if (inventory.add(s.userData.type, s.userData.count)) {
                scene.remove(s);
                world.droppedItems.splice(i, 1);
                ui.renderAllSlots();
                ui.updateHotbarSelection();
                soundEngine.pickup();
            }
        }
        s.material.rotation += 0.02;
    }

    // ========== ОБНОВЛЕНИЕ ДРОБОВИКА ==========
    if (window.currentShotgun) {
        window.currentShotgun.update(dt);
        if (window.currentShotgun.updateDebugLine) {
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            window.currentShotgun.updateDebugLine(camDir);
        }
    }

    // ========== ЗВУКИ ==========
    if (soundEngine.ctx) {
        soundEngine.updateAmbient(dt, progress);

        if (!currentVehicle && player.onGround && !ui.isInventoryOpen()) {
            const hSpeed = Math.hypot(player.vel.x, player.vel.z);
            if (hSpeed > 0.4) {
                footstepDistance += hSpeed * dt;
                const STEP_LENGTH = 2.0;
                while (footstepDistance >= STEP_LENGTH) {
                    footstepDistance -= STEP_LENGTH;
                    const underX = Math.floor(player.pos.x);
                    const underY = Math.floor(player.pos.y - 0.1);
                    const underZ = Math.floor(player.pos.z);
                    let blockUnder = world.getBlock(underX, underY, underZ);
                    if (blockUnder === BLOCK_GRASS_PLANT) {
                        blockUnder = world.getBlock(underX, underY - 1, underZ);
                    }
                    soundEngine.footstep(materialFromBlock(blockUnder));
                }
            } else {
                footstepDistance = 0;
            }
        } else {
            footstepDistance = 0;
        }

        if (wasOnGround && !player.onGround && player.vel.y > 0.5) {
            soundEngine.jump();
        }

        if (!wasOnGround && player.onGround) {
            const force = Math.min(3, prevFallSpeed / 6);
            if (force > 0.15) soundEngine.land(force);
        }
        wasOnGround = player.onGround;
        prevFallSpeed = Math.abs(player.vel.y);

        if (player.inWater && !wasInWater) soundEngine.splash();
        wasInWater = player.inWater;
    }

    // ========== ЭФФЕКТЫ БЛОКОВ ==========
    if (blockEffects) blockEffects.update(dt);

    // ========== ИНФОРМАЦИЯ НА ЭКРАНЕ ==========
    const info = document.getElementById('info');
    if (info) {
        const riding = currentVehicle ? '🚗' : '';
        const view = thirdPersonMode ? '👤' : '';
        info.textContent = `XYZ ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)} ${player.inWater ? '💧' : ''} ${isNoclipActive ? '🕊️' : ''} ${riding} ${view}`;
    }

    // ========== ФИНАЛЬНЫЙ РЕНДЕР ==========
    renderer.render(scene, camera);
}

// Запуск приложения
main().catch(console.error);