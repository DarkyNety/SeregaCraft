// js/controls.js
import * as THREE from 'three';
import {
    CHUNK_SIZE, BLOCK_BEDROCK, BLOCK_WATER, BLOCK_CRAFTING_TABLE,
    BLOCK_DROPS, AIR, ITEM_CAR, BLOCK_GRASS_PLANT, ITEM_SHOTGUN, ITEM_TORCH,
    BLOCK_TORCH_FLOOR, BLOCK_TORCH_N, BLOCK_TORCH_S, BLOCK_TORCH_E, BLOCK_TORCH_W,
    isTorchBlock,
} from './constants.js';
import { raycast, dropItem } from './utils.js';
import { CarEntity } from './car-entity.js';
import { soundEngine, materialFromBlock } from './sounds.js';

// ---------- Модульные переменные ----------
let inventory, ui, player, world, blockEffects;
let locked = false;
const keys = {};

export let isNoclipActive = false;
export let currentVehicle = null;
export let thirdPersonMode = 0;
let flySpeed = 15;
let gameStarted = false;

export let currentShotgun = null;
let isChargingThrow = false;
let chargeThrowStart = 0;

// ---------- DOM ----------
const noclipPanel        = document.getElementById('noclip-panel');
const flySpeedInput      = document.getElementById('flySpeedInput');
const applyFlyBtn        = document.getElementById('applyFlyBtn');
const pauseMenu          = document.getElementById('pause-menu');
const resumeBtn          = document.getElementById('resume-btn');
const pauseFlySpeedInput = document.getElementById('pause-fly-speed');
const saveQuitBtn        = document.getElementById('save-quit-btn');

export function setGameStarted(val) {
    gameStarted = val;
    if (val && pauseMenu) pauseMenu.style.display = 'none';
}

// ---------- Инициализация ----------
export function initControls(deps) {
    inventory      = deps.inventory;
    ui             = deps.ui;
    player         = deps.player;
    world          = deps.world;
    blockEffects   = deps.blockEffects;
    currentShotgun = deps.shotgun || null;

    document.getElementById('overlay').addEventListener('click', () => {
        if (!document.pointerLockElement) document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', onContextMenu);

    flySpeedInput.addEventListener('input', () => flySpeed = parseFloat(flySpeedInput.value) || 15);
    applyFlyBtn.addEventListener('click', () => {
        flySpeed = parseFloat(flySpeedInput.value) || 15;
        noclipPanel.style.display = 'none';
        document.body.requestPointerLock();
    });

    if (resumeBtn) resumeBtn.addEventListener('click', resumeGame);
    if (saveQuitBtn) saveQuitBtn.addEventListener('click', saveAndQuit);
    if (pauseFlySpeedInput) pauseFlySpeedInput.addEventListener('input', () => {
        flySpeed = parseFloat(pauseFlySpeedInput.value) || 15;
        if (flySpeedInput) flySpeedInput.value = flySpeed;
    });
}

// ---------- Синхронизация экипировки ----------
function syncShotgunEquip(prevType, newType) {
    if (!window.currentShotgun) return;
    if (prevType === ITEM_SHOTGUN && newType !== ITEM_SHOTGUN) window.currentShotgun.unequip();
    if (newType === ITEM_SHOTGUN && prevType !== ITEM_SHOTGUN) window.currentShotgun.equip();
}

// ---------- Pointer lock ----------
function onPointerLockChange() {
    locked = document.pointerLockElement === document.body;
    if (!locked) {
        if (gameStarted && pauseMenu) {
            pauseMenu.style.display = 'flex';
            if (pauseFlySpeedInput) pauseFlySpeedInput.value = flySpeed;
        }
    } else {
        if (pauseMenu) pauseMenu.style.display = 'none';
    }
}

function resumeGame() {
    if (pauseMenu) pauseMenu.style.display = 'none';
    document.body.requestPointerLock();
}

function saveAndQuit() {
    if (confirm('Сохранить мир перед выходом?')) {
        document.getElementById('save-btn')?.click();
    }
    location.reload();
}

// ---------- Мышь: обзор ----------
function onMouseMove(e) {
    if (!locked || ui.isInventoryOpen()) return;
    if (currentVehicle) {
        currentVehicle.camYaw   -= e.movementX * 0.002;
        currentVehicle.camPitch -= e.movementY * 0.002;
        currentVehicle.camPitch = Math.max(-0.5, Math.min(0.6, currentVehicle.camPitch));
        return;
    }
    const invert = (thirdPersonMode === 2) ? -1 : 1;
    player.yaw   -= e.movementX * 0.002 * invert;
    player.pitch -= e.movementY * 0.002;
    player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch));
}

// ---------- Клавиатура ----------
function onKeyDown(e) {
    const selType = inventory.getSelectedType();
    keys[e.code] = true;

    if (e.code === 'Escape') {
        e.preventDefault();
        if (locked) document.exitPointerLock();
        else if (pauseMenu && pauseMenu.style.display === 'flex') resumeGame();
        return;
    }

    if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        e.preventDefault();
        const prevType = inventory.getSelectedType();
        inventory.selected = parseInt(e.code.slice(-1)) - 1;
        const newType = inventory.getSelectedType();
        syncShotgunEquip(prevType, newType);
        ui.updateHotbarSelection();
        return;
    }

    if (e.code === 'KeyR' && selType === ITEM_SHOTGUN) {
        window.currentShotgun?.startReload();
        return;
    }

    if (e.code === 'KeyG' && selType === ITEM_SHOTGUN && currentShotgun) {
        currentShotgun.drop();
        inventory.removeSelectedAmount(1);
        ui.renderAllSlots();
        return;
    }

    if (e.code === 'KeyE') {
        e.preventDefault();
        if (currentVehicle) {
            currentVehicle.exit();
            currentVehicle = null;
            return;
        }
        if (!ui.isInventoryOpen()) {
            const nearCar = findNearbyCar();
            if (nearCar && nearCar.enter(player)) currentVehicle = nearCar;
            else ui.openInventoryGrid(4);
        }
        return;
    }

    if (e.code === 'KeyJ') {
        e.preventDefault();
        if (!currentVehicle) toggleNoclip();
        return;
    }

    if (e.code === 'KeyI') {
        e.preventDefault();
        inventory.dump();
        return;
    }

    if (e.code === 'Space') {
        e.preventDefault();
        if (!ui.isInventoryOpen() && locked && !currentVehicle) {
            const hadGround = player.onGround || player.inWater;
            player.jump();
            if (hadGround) soundEngine.jump();
        }
        return;
    }

    if (e.code === 'F5') {
        e.preventDefault();
        thirdPersonMode = (thirdPersonMode + 1) % 3;
        return;
    }

    if (e.code === 'KeyM') {
        e.preventDefault();
        const muted = soundEngine.toggleMute();
        console.log(muted ? '🔇 Звук выключен' : '🔊 Звук включён');
        return;
    }

    if (e.code === 'F6') {
        e.preventDefault();
        if (window.currentShotgun) {
            window.currentShotgun.debugLine.visible = !window.currentShotgun.debugLine.visible;
        }
        return;
    }

    if (e.code === 'KeyQ' && locked && !ui.isInventoryOpen() && !currentVehicle) {
        e.preventDefault();
        const slot = inventory.getSelectedSlot();
        if (slot.type && slot.count > 0 && inventory.removeSelectedAmount(1)) {
            const eye = player.eyePos();
            const dir = getLookDir();
            dropItem(slot.type, 1, eye.clone().add(dir.clone().multiplyScalar(1.8)), world);
            ui.renderAllSlots();
        }
        return;
    }
}

function onKeyUp(e) { keys[e.code] = false; }

// ---------- Колесо мыши ----------
function onWheel(e) {
    if (!locked || ui.isInventoryOpen() || currentVehicle) return;
    e.preventDefault();
    const prevType = inventory.getSelectedType();
    inventory.selected = ((inventory.selected + (e.deltaY > 0 ? 1 : -1)) + 9) % 9;
    const newType = inventory.getSelectedType();
    syncShotgunEquip(prevType, newType);
    ui.updateHotbarSelection();
}

// ---------- Ввод для машины ----------
export function getCarInput() {
    return {
        forward:  keys['KeyW'],
        backward: keys['KeyS'],
        left:     keys['KeyA'],
        right:    keys['KeyD'],
        brake:    keys['Space'],
    };
}

// ============ TORCH HELPERS ============

/** Перестроить меш чанка, содержащего (wx, wz). */
function rebuildChunkAt(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const c = world.getChunk(cx, cz);
    if (c) world.updateChunkMesh(c);
}

/** Переключить факел зажжён ↔ потушен. */
function toggleTorch(wx, wy, wz, currentType) {
    const newType = isTorchLit(currentType)
        ? getTorchUnlitVariant(currentType)
        : getTorchLitVariant(currentType);

    world.setBlock(wx, wy, wz, newType);
    rebuildChunkAt(wx, wz);

    // Звук: зажигаем — стук дерева, тушим — глухой удар
    if (isTorchLit(newType)) {
        soundEngine.blockPlace('wood');
    } else {
        soundEngine.blockBreak('wood');
    }

    // Эффект «пыли»
    if (blockEffects) {
        blockEffects.spawnPlace(wx, wy, wz, newType);
    }
}

/** Поставить факел с учётом грани, в которую попали. */
function tryPlaceTorch(res, player, world) {
    const hit = res.pos, prev = res.prev;
    if (!prev) return false;
    const dx = prev.x - hit.x, dy = prev.y - hit.y, dz = prev.z - hit.z;

    let blockType = null;
    if (dy === 1) blockType = BLOCK_TORCH_FLOOR;
    else if (dz === -1) blockType = BLOCK_TORCH_N;
    else if (dz === 1) blockType = BLOCK_TORCH_S;
    else if (dx === 1) blockType = BLOCK_TORCH_E;
    else if (dx === -1) blockType = BLOCK_TORCH_W;
    else return false;

    const existing = world.getBlock(prev.x, prev.y, prev.z);
    if (existing !== AIR && existing !== BLOCK_GRASS_PLANT) return false;

    if (blockType === BLOCK_TORCH_FLOOR) {
        const below = world.getBlock(prev.x, prev.y - 1, prev.z);
        if (below === AIR || below === BLOCK_WATER) return false;
        const aabb = player.aabb(player.pos.x, player.pos.y, player.pos.z);
        const cell = {
            minX: prev.x, maxX: prev.x + 1, minY: prev.y, maxY: prev.y + 1, minZ: prev.z, maxZ: prev.z + 1,
        };
        if (aabb.maxX > cell.minX && aabb.minX < cell.maxX &&
            aabb.maxY > cell.minY && aabb.minY < cell.maxY &&
            aabb.maxZ > cell.minZ && aabb.minZ < cell.maxZ) return false;
    }

    world.setBlock(prev.x, prev.y, prev.z, blockType);
    const cx = Math.floor(prev.x / CHUNK_SIZE), cz = Math.floor(prev.z / CHUNK_SIZE);
    const c = world.getChunk(cx, cz);
    if (c) world.updateChunkMesh(c);

    soundEngine.blockPlace('wood');
    if (window.blockEffects) {
        window.blockEffects.spawnPlace(prev.x, prev.y, prev.z, blockType);
    }
    return true;
}

// ============ MOUSE DOWN ============

function onMouseDown(e) {
    const selType = inventory.getSelectedType();
    if (!locked || ui.isInventoryOpen() || currentVehicle) return;

    // --- Дробовик ---
    if (selType === ITEM_SHOTGUN && currentShotgun) {
        if (e.button === 0) { currentShotgun.shoot(); return; }
        if (e.button === 2) {
            isChargingThrow = true;
            chargeThrowStart = performance.now();
            return;
        }
    }

    const eye = player.eyePos();
    const dir = getLookDir();
    const res = raycast(world, eye, dir);

    // ============ ЛОМАНИЕ ============
    if (e.button === 0 && res.hit) {
        if (res.type !== BLOCK_BEDROCK && res.type !== BLOCK_WATER) {
            const brokenType = res.type;

            world.setBlock(res.pos.x, res.pos.y, res.pos.z, AIR);
            rebuildChunkAt(res.pos.x, res.pos.z);

            soundEngine.blockBreak(materialFromBlock(brokenType));
            if (blockEffects) blockEffects.spawnBreak(res.pos.x, res.pos.y, res.pos.z, brokenType);

            const drop = BLOCK_DROPS[brokenType];
            if (drop !== undefined) {
                inventory.add(drop, 1);
                ui.renderAllSlots();
            }
        }
        return;
    }

    // ============ ПКМ ============
    if (e.button === 2 && res.hit) {
        // 1) Тоггл существующего факела
            if (isTorchBlock(res.type)) {
        world.toggleTorchAt(res.pos.x, res.pos.y, res.pos.z);
        return;
    }

        // 2) Установка машины
        if (inventory.getSelectedType() === ITEM_CAR) {
            const pp = res.prev;
            if (pp) {
                const pos = new THREE.Vector3(pp.x + 0.5, pp.y + 1.0, pp.z + 0.5);
                const car = new CarEntity(pos, player.yaw);
                car.placeOnGround(world);
                world.addCarEntity(car);
                inventory.removeSelectedAmount(1);
                ui.renderAllSlots();
            }
            return;
        }

        // 3) Верстак → расширенный крафт
        if (res.type === BLOCK_CRAFTING_TABLE && res.prev) {
            ui.openInventoryGrid(9);
            return;
        }

        // 4) Установка факела (из инвентаря)
            if (inventory.getSelectedType() === ITEM_TORCH) {
        if (tryPlaceTorch(res, player, world)) {
            inventory.removeSelectedAmount(1);
            ui.renderAllSlots();
        }
        return;
    }

        // 5) Обычная установка блока
        const pp  = res.prev;
        const sel = inventory.getSelectedType();
        if (sel === null || !pp) return;

        if (sel === BLOCK_GRASS_PLANT) {
            const belowBlock = world.getBlock(pp.x, pp.y - 1, pp.z);
            if (belowBlock === AIR || belowBlock === BLOCK_WATER) return;
        }

        // Не ставим в клетку, где уже стоит факел
        const targetExisting = world.getBlock(pp.x, pp.y, pp.z);
        if (isTorchBlock(targetExisting)) return;

        // Не ставим внутрь игрока
        const aabb = player.aabb(player.pos.x, player.pos.y, player.pos.z);
        const block = {
            minX: pp.x, maxX: pp.x + 1,
            minY: pp.y, maxY: pp.y + 1,
            minZ: pp.z, maxZ: pp.z + 1,
        };
        const overlap =
            aabb.maxX > block.minX && aabb.minX < block.maxX &&
            aabb.maxY > block.minY && aabb.minY < block.maxY &&
            aabb.maxZ > block.minZ && aabb.minZ < block.maxZ;
        if (overlap) return;

        world.setBlock(pp.x, pp.y, pp.z, sel);
        rebuildChunkAt(pp.x, pp.z);

        soundEngine.blockPlace(materialFromBlock(sel));
        if (blockEffects) blockEffects.spawnPlace(pp.x, pp.y, pp.z, sel);

        inventory.removeSelectedAmount(1);
        ui.renderAllSlots();
    }
}

// ---------- Mouse UP: заряжаемый бросок дробовика ----------
function onMouseUp(e) {
    if (e.button === 2 && isChargingThrow && currentShotgun) {
        isChargingThrow = false;
        const dur   = performance.now() - chargeThrowStart;
        const power = Math.min(dur / 1200, 1.0);
        currentShotgun.throwWeapon(power);
        inventory.removeSelectedAmount(1);
        ui.renderAllSlots();
    }
}

function onContextMenu(e) {
    if (locked && !ui.isInventoryOpen() && !currentVehicle) e.preventDefault();
}

// ---------- Поиск ближайшей машины ----------
function findNearbyCar() {
    let best = null, min = 2.8;
    const eye = player.eyePos();
    for (const car of world.carEntities) {
        const d = eye.distanceTo(car.position);
        if (d < min) { min = d; best = car; }
    }
    return best;
}

// ---------- Направление взгляда ----------
function getLookDir() {
    return new THREE.Vector3(
        -Math.sin(player.yaw) * Math.cos(player.pitch),
        Math.sin(player.pitch),
        -Math.cos(player.yaw) * Math.cos(player.pitch)
    ).normalize();
}

// ---------- Noclip ----------
function toggleNoclip() {
    isNoclipActive = !isNoclipActive;
    if (isNoclipActive) {
        document.exitPointerLock();
        noclipPanel.style.display = 'flex';
    } else {
        noclipPanel.style.display = 'none';
        document.body.requestPointerLock();
    }
}

// ---------- Движение ----------
export function applyMovement(dt) {
    if (!player || !locked || ui.isInventoryOpen() || currentVehicle) return;
    if (isNoclipActive) applyNoclipMovement(dt);
    else applyNormalMovement(dt);
}

function applyNormalMovement(dt) {
    const yaw   = player.yaw;
    const fwd   = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    const right = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    let mx = 0, mz = 0;
    if (keys['KeyW']) { mx += fwd.x;   mz += fwd.z;   }
    if (keys['KeyS']) { mx -= fwd.x;   mz -= fwd.z;   }
    if (keys['KeyA']) { mx -= right.x; mz -= right.z; }
    if (keys['KeyD']) { mx += right.x; mz += right.z; }
    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 1) { mx /= len; mz /= len; }
    player.vel.x += mx * 6 * dt * 6;
    player.vel.z += mz * 6 * dt * 6;
    player.update(dt);
}

function applyNoclipMovement(dt) {
    const yaw   = player.yaw;
    const fwd   = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    const right = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    let mx = 0, my = 0, mz = 0;
    if (keys['KeyW']) { mx += fwd.x;   mz += fwd.z;   }
    if (keys['KeyS']) { mx -= fwd.x;   mz -= fwd.z;   }
    if (keys['KeyA']) { mx -= right.x; mz -= right.z; }
    if (keys['KeyD']) { mx += right.x; mz += right.z; }
    if (keys['Space']) my += 1;
    if (keys['ShiftLeft'] || keys['ShiftRight']) my -= 1;
    const len = Math.sqrt(mx * mx + mz * mz + my * my);
    if (len > 1) { mx /= len; mz /= len; my /= len; }
    player.pos.x += mx * flySpeed * dt;
    player.pos.y += my * flySpeed * dt;
    player.pos.z += mz * flySpeed * dt;
    player.vel.set(0, 0, 0);
}