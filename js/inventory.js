// js/inventory.js
import {
    BLOCK_PLANKS, ITEM_STICK, ITEM_COAL, ITEM_DIAMOND,
    RECIPES_2X2, RECIPES_3X3,
    ITEM_CAR, AIR, BLOCK_WATER,
    BLOCK_BEDROCK,
    ITEM_TORCH,
    BLOCK_NAMES,
    BLOCK_STONE,
    BLOCK_DIAMOND_ORE,
    BLOCK_COAL_ORE,
    BLOCK_GRASS,
    ITEM_WOODEN_AXE,
    ITEM_WOODEN_PICKAXE,
    ITEM_WOODEN_SHOVEL,     // ← добавили
    ITEM_WOODEN_SWORD,      // ← добавили
    ITEM_APPLE,
    ITEM_DIAMOND_SWORD,
    ITEM_SHOTGUN,
    BLOCK_FLESH,
    BLOCK_LOG,              // ← добавили
    BLOCK_JUNGLE_LOG,       // ← добавили
    DIAMOND_BLOCK,          // ← добавили (фикс!)
} from './constants.js';

// Размер сетки крафта (меняется при открытии верстака)
export let craftingGridSize = 4; // 4 (2x2) или 9 (3x3)

export function setCraftingGridSize(newSize) {
    craftingGridSize = newSize;
}

export class Inventory {
    constructor() {
        this.hotbar   = new Array(9).fill(null).map(() => ({ type: null, count: 0 }));
        this.storage  = new Array(27).fill(null).map(() => ({ type: null, count: 0 }));
        this.crafting = new Array(9).fill(null).map(() => ({ type: null, count: 0 }));
        this.result   = { type: null, count: 0 };
        this.cursor   = { type: null, count: 0 };
        this.selected = 0;
        this.guiOpen  = false;

        // Стартовые предметы
        this.add(BLOCK_PLANKS, 64);
        this.add(ITEM_STICK, 64);
        this.add(ITEM_DIAMOND, 64);
        this.add(ITEM_COAL, 65);
        this.add(ITEM_CAR, 64);
        this.add(BLOCK_WATER, 64);
        this.add(AIR, 64);
        this.add(BLOCK_BEDROCK, 64);
        this.add(ITEM_TORCH, 64);
        this.add(BLOCK_STONE, 64);
        this.add(BLOCK_DIAMOND_ORE, 64);
        this.add(BLOCK_COAL_ORE, 64);
        this.add(BLOCK_GRASS, 64);
        this.add(ITEM_WOODEN_PICKAXE, 2);
        this.add(ITEM_WOODEN_AXE, 2);
        this.add(ITEM_APPLE, 64);
        this.add(ITEM_DIAMOND_SWORD, Math.PI);
        this.add(ITEM_SHOTGUN, 1);
        this.add(BLOCK_FLESH, 64);
    }

    dump() {
        const names = (type) => BLOCK_NAMES[type] || type;
        console.group('=== INVENTORY ===');
        console.log('Hotbar (0-8):');
        this.hotbar.forEach((slot, i) => {
            if (slot.type !== null) console.log(`  ${i}: ${names(slot.type)} x${slot.count}`);
            else console.log(`  ${i}: пусто`);
        });
        console.log('Storage (0-26):');
        this.storage.forEach((slot, i) => {
            if (slot.type !== null) console.log(`  ${i}: ${names(slot.type)} x${slot.count}`);
        });
        console.log(`Crafting (${craftingGridSize} slots):`);
        this.crafting.slice(0, craftingGridSize).forEach((slot, i) => {
            if (slot.type !== null) console.log(`  ${i}: ${names(slot.type)} x${slot.count}`);
            else console.log(`  ${i}: пусто`);
        });
        console.log('Result:', this.result.type !== null ? `${names(this.result.type)} x${this.result.count}` : 'пусто');
        console.log('Cursor:', this.cursor.type !== null ? `${names(this.cursor.type)} x${this.cursor.count}` : 'пусто');
        console.groupEnd();
    }

    add(type, count = 1) {
        if (type === null || count <= 0) return true;
        let remaining = count;
        for (const arr of [this.storage, this.hotbar]) {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].type === type && arr[i].count < 64) {
                    const space = 64 - arr[i].count;
                    const add = Math.min(remaining, space);
                    arr[i].count += add;
                    remaining -= add;
                    if (remaining <= 0) return true;
                }
            }
        }
        for (const arr of [this.storage, this.hotbar]) {
            for (let i = 0; i < arr.length; i++) {
                if (arr[i].type === null) {
                    const add = Math.min(remaining, 64);
                    arr[i].type = type;
                    arr[i].count = add;
                    remaining -= add;
                    if (remaining <= 0) return true;
                }
            }
        }
        return remaining === 0;
    }

    getSelectedSlot()   { return this.hotbar[this.selected]; }
    getSelectedType()   { return this.hotbar[this.selected].type; }

    removeSelectedAmount(amount = 1) {
        const slot = this.getSelectedSlot();
        if (!slot.type || slot.count <= 0) return false;
        if (slot.count >= amount) {
            slot.count -= amount;
            if (slot.count === 0) slot.type = null;
            return true;
        }
        return false;
    }

    // ==================== ТОКЕНИЗАЦИЯ ====================
    _tokenizeSlotType(type) {
        if (!type) return null;                     // null или 0 (AIR)
        switch (type) {
            case BLOCK_PLANKS:      return 'PLANKS';
            case ITEM_STICK:        return 'STICK';
            case ITEM_COAL:         return 'COAL';
            case ITEM_DIAMOND:      return 'DIAMOND';
            case BLOCK_LOG:
            case BLOCK_JUNGLE_LOG:  return 'LOG';
            case DIAMOND_BLOCK:     return 'DIAMOND_BLOCK';
            default:                return type;    // числовой тип как есть
        }
    }

    // ==================== НОРМАЛИЗАЦИЯ ====================
    /** Обрезает пустые строки/столбцы вокруг заполненных ячеек. */
    _normalizePattern(tokens, size) {
        const dim = Math.round(Math.sqrt(size));
        let minR = dim, maxR = -1, minC = dim, maxC = -1;
        for (let r = 0; r < dim; r++) {
            for (let c = 0; c < dim; c++) {
                if (tokens[r * dim + c] !== null) {
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                }
            }
        }
        if (maxR === -1) return null;
        const h = maxR - minR + 1;
        const w = maxC - minC + 1;
        const out = [];
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                out.push(tokens[(minR + r) * dim + (minC + c)]);
            }
        }
        return { data: out, w, h };
    }

    _rotatePattern(p) {
        const { data, w, h } = p;
        const flat = [];
        // Поворот 90° по часовой: new[r][c] = old[h-1-c][r]
        // новый размер: w' = h, h' = w
        for (let c = 0; c < w; c++) {
            for (let r = h - 1; r >= 0; r--) {
                flat.push(data[r * w + c]);
            }
        }
        return { data: flat, w: h, h: w };
    }

    _mirrorPattern(p) {
        const { data, w, h } = p;
        const flat = [];
        for (let r = 0; r < h; r++) {
            for (let c = w - 1; c >= 0; c--) {
                flat.push(data[r * w + c]);
            }
        }
        return { data: flat, w, h };
    }

    _patternsEqual(a, b) {
        if (!a || !b) return false;
        if (a.w !== b.w || a.h !== b.h) return false;
        for (let i = 0; i < a.data.length; i++) {
            if (a.data[i] !== b.data[i]) return false;
        }
        return true;
    }

    /** Проверяет совпадение с учётом 4 поворотов × 2 зеркала. */
    _matchRecipe(currentNorm, recipeNorm) {
        let p = recipeNorm;
        for (let rot = 0; rot < 4; rot++) {
            if (this._patternsEqual(currentNorm, p)) return true;
            if (this._patternsEqual(currentNorm, this._mirrorPattern(p))) return true;
            p = this._rotatePattern(p);
        }
        return false;
    }

    // ==================== КРАФТ ====================
    updateCraftingResult() {
        // ⚠️ МУТИРУЕМ существующий объект — UI держит на него ссылку
        this.result.type = null;
        this.result.count = 0;

        const recipes = craftingGridSize === 9 ? RECIPES_3X3 : RECIPES_2X2;

        // Текущий паттерн в токенах
        const currentTokens = this.crafting
            .slice(0, craftingGridSize)
            .map(slot => this._tokenizeSlotType(slot.type));
        const currentNorm = this._normalizePattern(currentTokens, craftingGridSize);
        if (!currentNorm) return;

        for (const recipe of recipes) {
            const recipeTokens = recipe.pattern.map(t => (t === undefined ? null : t));
            const recipeNorm = this._normalizePattern(recipeTokens, craftingGridSize);
            if (!recipeNorm) continue;

            if (this._matchRecipe(currentNorm, recipeNorm)) {
                this.result.type  = recipe.result.type;
                this.result.count = recipe.result.count;
                return;
            }
        }
    }

    craftResult() {
        if (this.result.type === null || this.result.count === 0) return;
        if (this.add(this.result.type, this.result.count)) {
            for (let i = 0; i < craftingGridSize; i++) {
                const slot = this.crafting[i];
                if (slot.count > 0) {
                    slot.count--;
                    if (slot.count <= 0) {
                        slot.type = null;
                        slot.count = 0;
                    }
                }
            }
            this.updateCraftingResult();
        }
    }

    /** Возвращает всё из сетки крафта обратно в инвентарь и обнуляет результат. */
    returnCraftingToInventory() {
        let returned = 0;
        for (let i = 0; i < this.crafting.length; i++) {
            const slot = this.crafting[i];
            if (slot.type !== null && slot.count > 0) {
                this.add(slot.type, slot.count);
                returned += slot.count;
                slot.type = null;
                slot.count = 0;
            }
        }
        // Результат сбрасываем — ингредиенты вернулись, рецепт больше недействителен
        this.result.type = null;
        this.result.count = 0;
        return returned;
    }
}

export const inventory = new Inventory();