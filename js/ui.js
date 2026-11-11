// js/ui.js
import { inventory, craftingGridSize, setCraftingGridSize } from './inventory.js';
import { atlasCanvas } from './rendering.js';
import { getBlockTextures, TEX_COLS, TEX_CELL, ITEM_SHOTGUN } from './constants.js';
import { getBlockIcon } from './utils.js';
import { soundEngine } from './sounds.js';

// DOM-элементы GUI
const gui = document.getElementById('inventory-gui');
const craftGrid = document.getElementById('crafting-grid');
const resultSlot = document.getElementById('result-slot');
const storageGrid = document.getElementById('storage-grid');
const guiHotbar = document.getElementById('gui-hotbar');
const cursorDiv = document.getElementById('cursor-item');
const closeGuiBtn = document.getElementById('close-gui-btn');
const hotbarContainer = document.getElementById('inventory-hotbar');

// Массивы для хранения ссылок на слоты и их функции обновления
let craftSlots = [];
let resultSlotObj;
let storageSlots = [];
let guiHotbarSlots = [];

// Кэш иконок
// const iconCache = {};

/**
 * Возвращает Data URL иконки предмета/блока по его типу.
 * Рисуется из атласа, который должен быть готов (atlasCanvas).
 */
// function getBlockIcon(type) {
//     if (iconCache[type]) return iconCache[type];
//     const texIdx = getBlockTextures(type)[0] || 0;
//     const col = texIdx % TEX_COLS;
//     const row = Math.floor(texIdx / TEX_COLS);
//     const c = document.createElement('canvas');
//     c.width = c.height = TEX_CELL;
//     const ctx = c.getContext('2d');
//     ctx.imageSmoothingEnabled = false;
//     ctx.drawImage(atlasCanvas, col * TEX_CELL, row * TEX_CELL, TEX_CELL, TEX_CELL, 0, 0, TEX_CELL, TEX_CELL);
//     const dataUrl = c.toDataURL();
//     iconCache[type] = dataUrl;
//     return dataUrl;
// }

/**
 * Создаёт DOM-элемент слота, привязывает обработчики кликов.
 */
function createSlotDiv(parent, slotData, onClick, onRightClick) {
    const div = document.createElement('div');
    div.className = 'slot';
    const img = document.createElement('img');
    const countSpan = document.createElement('span');
    countSpan.className = 'count';
    div.appendChild(img);
    div.appendChild(countSpan);
    parent.appendChild(div);

    const update = () => {
        if (slotData.type !== null && slotData.count > 0) {
            img.src = getBlockIcon(slotData.type);
            img.style.display = 'block';
            countSpan.textContent = slotData.count;
        } else {
            img.style.display = 'none';
            countSpan.textContent = '';
        }
    };

    div.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (e.button === 0) onClick(slotData);
        else if (e.button === 2) onRightClick(slotData);
        update();
        renderAllSlots();
    });
    div.addEventListener('contextmenu', (e) => e.preventDefault());
    return { div, update };
}

function rebuildCraftSlots() {
    craftGrid.innerHTML = '';
    craftSlots = [];
    const size = craftingGridSize;
    for (let i = 0; i < size; i++) {
        const slotData = inventory.crafting[i];
        const { div, update } = createSlotDiv(
            craftGrid,
            slotData,
            () => handleSlotClick(slotData, inventory.cursor, 'craft'),
            () => handleSlotRightClick(slotData, inventory.cursor, 'craft')
        );
        craftSlots.push({ div, update });
    }
}

function buildStorageSlots() {
    storageGrid.innerHTML = '';
    storageSlots = [];
    for (let i = 0; i < inventory.storage.length; i++) {
        const slotData = inventory.storage[i];
        const { div, update } = createSlotDiv(
            storageGrid,
            slotData,
            () => handleSlotClick(slotData, inventory.cursor, 'storage'),
            () => handleSlotRightClick(slotData, inventory.cursor, 'storage')
        );
        storageSlots.push({ div, update });
    }
}

function buildGuiHotbarSlots() {
    guiHotbar.innerHTML = '';
    guiHotbarSlots = [];
    for (let i = 0; i < inventory.hotbar.length; i++) {
        const slotData = inventory.hotbar[i];
        const { div, update } = createSlotDiv(
            guiHotbar,
            slotData,
            () => handleSlotClick(slotData, inventory.cursor, 'hotbar'),
            () => handleSlotRightClick(slotData, inventory.cursor, 'hotbar')
        );
        guiHotbarSlots.push({ div, update });
    }
}

function buildResultSlot() {
    const slotData = inventory.result;
    const { div, update } = createSlotDiv(
        resultSlot,
        slotData,
        () => {
            inventory.craftResult();
            renderAllSlots();
        },
        () => {}
    );
    () => {
    const before = inventory.result.type;
    inventory.craftResult();
    if (before !== null) soundEngine.craft();   // ← добавить
    renderAllSlots();
}
    resultSlotObj = { div, update };
}

function createHotbarUI() {
    hotbarContainer.innerHTML = '';
    for (let i = 0; i < inventory.hotbar.length; i++) {
        const div = document.createElement('div');
        div.className = 'slot';
        if (i === inventory.selected) div.classList.add('selected');
        const img = document.createElement('img');
        const cnt = document.createElement('span');
        cnt.className = 'count';
        div.appendChild(img);
        div.appendChild(cnt);
        hotbarContainer.appendChild(div);
    }
}

// --- логика перемещения предметов ---
function handleSlotClick(slot, cursor, source) {
    soundEngine.uiClick();
    if (cursor.type === null) {
        if (slot.type !== null) {
            cursor.type = slot.type;
            cursor.count = slot.count;
            slot.type = null;
            slot.count = 0;
        }
    } else {
        if (slot.type === null || slot.type === cursor.type) {
            const canAdd = 64 - (slot.type === cursor.type ? slot.count : 0);
            const toMove = Math.min(cursor.count, canAdd);
            if (slot.type === null) slot.type = cursor.type;
            slot.count += toMove;
            cursor.count -= toMove;
            if (cursor.count <= 0) {
                cursor.type = null;
                cursor.count = 0;
            }
        } else {
            const tempType = slot.type;
            const tempCount = slot.count;
            slot.type = cursor.type;
            slot.count = cursor.count;
            cursor.type = tempType;
            cursor.count = tempCount;
        }
    }
    if (source === 'craft') inventory.updateCraftingResult();
    renderAllSlots();
}

function handleSlotRightClick(slot, cursor, source) {
    soundEngine.uiClick();
    if (cursor.type === null) {
        if (slot.type !== null) {
            const take = Math.ceil(slot.count / 2);
            cursor.type = slot.type;
            cursor.count = take;
            slot.count -= take;
            if (slot.count <= 0) {
                slot.type = null;
                slot.count = 0;
            }
        }
    } else {
        if (slot.type === null || slot.type === cursor.type) {
            if (slot.count < 64) {
                if (slot.type === null) slot.type = cursor.type;
                slot.count++;
                cursor.count--;
                if (cursor.count <= 0) {
                    cursor.type = null;
                    cursor.count = 0;
                }
            }
        } else {
            const tempType = slot.type;
            const tempCount = slot.count;
            slot.type = cursor.type;
            slot.count = cursor.count;
            cursor.type = tempType;
            cursor.count = tempCount;
        }
    }
    if (source === 'craft') inventory.updateCraftingResult();
    renderAllSlots();
}

// -------------------------------------------
// Экспортируемые функции
// -------------------------------------------

export function renderAllSlots() {
    craftSlots.forEach(s => s.update());
    if (resultSlotObj) resultSlotObj.update();
    storageSlots.forEach(s => s.update());
    guiHotbarSlots.forEach(s => s.update());
    updateHotbarSelection();

    if (inventory.cursor.type !== null && inventory.cursor.count > 0) {
    cursorDiv.style.display = 'flex';
    cursorDiv.innerHTML = `<img src="${getBlockIcon(inventory.cursor.type)}"><span style="position:absolute;bottom:2px;right:5px;color:#fff;font-size:11px;text-shadow:1px 1px 0 #000;">${inventory.cursor.count}</span>`;
    // ⚠️ Сразу ставим на актуальную позицию мыши — без ожидания mousemove
    applyCursorPosition();
} else {
    cursorDiv.style.display = 'none';
    cursorDiv.innerHTML = '';
}
}

let lastSelected = null;

export function updateHotbarSelection() {
    
    const slots = document.querySelectorAll('#inventory-hotbar .slot');
    slots.forEach((s, i) => {
        s.classList.toggle('selected', i === inventory.selected);
        const slotData = inventory.hotbar[i];
        const img = s.querySelector('img');
        const cnt = s.querySelector('.count');
        if (slotData.type !== null && slotData.count > 0) {
            img.src = getBlockIcon(slotData.type);
            img.style.display = 'block';
            cnt.textContent = slotData.count;
        } else {
            img.style.display = 'none';
            cnt.textContent = '';
        }
    });
    if (typeof lastSelected === 'undefined') lastSelected = inventory.selected;
    if (lastSelected !== inventory.selected) {
        const prevType = inventory.hotbar[lastSelected]?.type;
        const newType = inventory.hotbar[inventory.selected]?.type;
        if (prevType === ITEM_SHOTGUN) window.currentShotgun?.unequip();
        if (newType === ITEM_SHOTGUN) window.currentShotgun?.equip();
        lastSelected = inventory.selected;
    }
}

// Состояние инвентаря (открыт/закрыт)
let inventoryOpen = false;

export function isInventoryOpen() {
    return inventoryOpen;
}

export function openInventoryGrid(size = 4) {
    if (inventoryOpen && craftingGridSize === size) return;
    soundEngine.uiOpen(); 
    setCraftingGridSize(size);
    craftGrid.className = size === 9 ? 'grid-3x3' : 'grid-2x2';
    rebuildCraftSlots();
    inventory.updateCraftingResult();
    renderAllSlots();

    if (!inventoryOpen) {
        document.exitPointerLock();
        inventoryOpen = true;
        gui.style.display = 'flex';
        closeGuiBtn.style.display = 'flex';
        document.getElementById('crosshair').style.display = 'none';
    }
}

export function closeInventory() {
    if (!inventoryOpen) return;

    // 1) Предмет на курсоре → в инвентарь
    if (inventory.cursor.type !== null) {
    inventory.add(inventory.cursor.type, inventory.cursor.count);
    inventory.cursor.type  = null;
    inventory.cursor.count = 0;
}

    // 2) Всё из сетки крафта → в инвентарь (фикс «пропажи»)
    const returned = inventory.returnCraftingToInventory();
    if (returned > 0) {
        console.log(`↩️ Возвращено из верстака: ${returned}`);
    }

    // 3) Перестроить слоты — чтобы UI отразил новое состояние
    rebuildCraftSlots();
    renderAllSlots();
    updateHotbarSelection();

    inventoryOpen = false;
    gui.style.display = 'none';
    closeGuiBtn.style.display = 'none';
    document.getElementById('crosshair').style.display = 'block';
    document.body.requestPointerLock?.();
}

// Отслеживание мыши для курсора с предметом
let latestMouseX = window.innerWidth / 2;
let latestMouseY = window.innerHeight / 2;

function applyCursorPosition() {
    cursorDiv.style.left = latestMouseX + 'px';
    cursorDiv.style.top  = latestMouseY + 'px';
}

document.addEventListener('mousemove', (e) => {
    latestMouseX = e.clientX;
    latestMouseY = e.clientY;
    if (cursorDiv.style.display !== 'none') {
        applyCursorPosition();
    }
});

// Базовые стили курсора (страховка, если в CSS их нет)
cursorDiv.style.position = 'fixed';
cursorDiv.style.pointerEvents = 'none';
cursorDiv.style.zIndex = '99999';
cursorDiv.style.transform = 'translate(-50%, -50%)';
cursorDiv.style.willChange = 'left, top';

closeGuiBtn.addEventListener('click', closeInventory);

// Инициализация интерфейса
export function initUI() {
    createHotbarUI();
    buildResultSlot();
    buildStorageSlots();
    buildGuiHotbarSlots();
    rebuildCraftSlots();
    updateHotbarSelection();
    renderAllSlots();
}