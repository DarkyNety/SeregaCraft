// ==================== Игровые константы ====================
export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 500;
export const WATER_LEVEL = 45;
export const BEACH_LEVEL = 36;
export const RENDER_RADIUS = 16;
export const UNLOAD_RADIUS = 16;
export const GRAVITY = 20;
export const JUMP_VEL = 8.5;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.75;
export const PLAYER_EYE_HEIGHT = 1.6;
export const REACH_DIST = 8;
export const ATLAS_WIDTH = 512;
export const ATLAS_HEIGHT = 256;
export const TEX_CELL = 16;
export const TEX_COLS = 32;

export const ITEM_SHOTGUN = 40;
export const TEX_SHOTGUN = 99;

// Индексы текстур в атласе (все в одном изображении 512x256)
export const TEX_GRASS_TOP = 0;
export const TEX_GRASS_SIDE = 1;
export const TEX_DIRT = 2;
export const TEX_STONE = 3;
export const TEX_LOG_TOP = 4;
export const TEX_LOG_SIDE = 5;
export const TEX_LEAVES = 6;
export const TEX_SAND = 7;
export const TEX_PLANKS = 8;
export const TEX_COBBLESTONE = 9;
export const TEX_WATER = 10;
export const TEX_BEDROCK = 11;
export const TEX_DIAMOND_ORE = 12;
export const TEX_CRAFTING_TABLE_TOP = 13;
export const TEX_STICK = 14;
export const TEX_COAL_ORE = 15;
export const TEX_CRAFTING_TABLE_SIDE = 16;
export const TEX_GRAVEL = 17;
export const TEX_JUNGLE_LOG_TOP = 18;
export const TEX_JUNGLE_LOG_SIDE = 19;
export const TEX_JUNGLE_LEAVES = 20;
export const TEX_GRASS_PLANT = 21;
export const TEX_DIAMOND_BLOCK = 22;
export const TEX_DIAMOND_SWORD = 35;
export const TEX_APPLE = 36;
export const TEX_FLESH_BLOCK = 60;

// Текстуры инструментов и предметов (загружаются или программно)
export const TEX_WOODEN_PICKAXE = 27;
export const TEX_WOODEN_AXE = 28;
export const TEX_WOODEN_SHOVEL = 29;
export const TEX_WOODEN_SWORD = 30;
export const TEX_COAL = 31;
export const TEX_TORCH = 32;
export const TEX_DIAMOND = 33;
export const TEX_CAR = 34;

// ==================== Типы блоков и предметов ====================
export const AIR = 0;
export const BLOCK_GRASS = 1;
export const BLOCK_DIRT = 2;
export const BLOCK_STONE = 3;
export const BLOCK_LOG = 4;
export const BLOCK_LEAVES = 5;
export const BLOCK_SAND = 6;
export const BLOCK_PLANKS = 7;
export const BLOCK_COBBLESTONE = 8;
export const BLOCK_WATER = 9;
export const BLOCK_BEDROCK = 10;
export const BLOCK_DIAMOND_ORE = 11;
export const BLOCK_CRAFTING_TABLE = 12;
export const BLOCK_COAL_ORE = 27;
export const BLOCK_GRASS_PLANT = 16;

// Новые блоки
export const BLOCK_GRAVEL = 64;
export const BLOCK_JUNGLE_LOG = 14;
export const BLOCK_JUNGLE_LEAVES = 15;
export const DIAMOND_BLOCK = 35;
export const BLOCK_FLESH = 60;

// ===== Факелы (специальные блоки) =====
export const BLOCK_TORCH_FLOOR = 70;   // зажжённый, на полу
export const BLOCK_TORCH_N     = 71;   // зажжённый на стене (наконечник на север, -Z)
export const BLOCK_TORCH_S     = 72;
export const BLOCK_TORCH_E     = 73;
export const BLOCK_TORCH_W     = 74;
export const BLOCK_TORCH_OFF   = 75;   // потушенный (без ориентации)

/** Любой факел (включая потушенный). */
export function isTorchBlock(type) {
    return type === BLOCK_TORCH_FLOOR
        || type === BLOCK_TORCH_N
        || type === BLOCK_TORCH_S
        || type === BLOCK_TORCH_E
        || type === BLOCK_TORCH_W
        || type === BLOCK_TORCH_OFF;
}

/** Факел горит (есть пламя, свет, дым). */
export function isTorchLit(type) {
    return type === BLOCK_TORCH_FLOOR
        || type === BLOCK_TORCH_N
        || type === BLOCK_TORCH_S
        || type === BLOCK_TORCH_E
        || type === BLOCK_TORCH_W;
}

/**
 * Ориентация факела.
 *   'floor' | 'north' | 'south' | 'east' | 'west'
 * Для потушенного — 'floor' (рисуем как стоящий ствол без пламени).
 * null, если это не факел.
 */
export function getTorchOrientation(type) {
    switch (type) {
        case BLOCK_TORCH_FLOOR: return 'floor';
        case BLOCK_TORCH_N:     return 'north';
        case BLOCK_TORCH_S:     return 'south';
        case BLOCK_TORCH_E:     return 'east';
        case BLOCK_TORCH_W:     return 'west';
        case BLOCK_TORCH_OFF:   return 'floor';
        default:                return null;
    }
}

/**
 * Обратная функция: по ориентации возвращает зажжённый тип блока.
 *   'floor' | 'north' | 'south' | 'east' | 'west'
 */
export function getTorchBlockType(orientation) {
    switch (orientation) {
        case 'floor': return BLOCK_TORCH_FLOOR;
        case 'north': return BLOCK_TORCH_N;
        case 'south': return BLOCK_TORCH_S;
        case 'east':  return BLOCK_TORCH_E;
        case 'west':  return BLOCK_TORCH_W;
        default:      return null;
    }
}

/**
 * Нормаль грани, к которой "прилипает" факел.
 * Для напольного — [0, -1, 0] (стоит на блоке снизу).
 * Для потушенного — null (привязка не сохраняется).
 */
export function getTorchAttachmentNormal(type) {
    switch (type) {
        case BLOCK_TORCH_FLOOR: return [0, -1, 0];
        case BLOCK_TORCH_N:     return [0, 0, 1];
        case BLOCK_TORCH_S:     return [0, 0, -1];
        case BLOCK_TORCH_E:     return [-1, 0, 0];
        case BLOCK_TORCH_W:     return [1, 0, 0];
        default:                return null;
    }
}

/**
 * Смещение блока-опоры от клетки факела.
 * Для напольного — [0, -1, 0].
 * Для настенных — стена за ним (обратная нормали).
 * Для потушенного — null.
 */
export function getTorchSupportOffset(type) {
    const n = getTorchAttachmentNormal(type);
    if (!n) return null;
    return [-n[0], -n[1], -n[2]];
}

// ==================== Предметы и инструменты ====================
export const ITEM_STICK = 20;
export const ITEM_WOODEN_PICKAXE = 21;
export const ITEM_WOODEN_AXE = 22;
export const ITEM_WOODEN_SHOVEL = 23;
export const ITEM_WOODEN_SWORD = 24;
export const ITEM_COAL = 25;
export const ITEM_TORCH = 26;
export const ITEM_DIAMOND = 28;
export const ITEM_CAR = 29;
export const ITEM_DIAMOND_SWORD = 36;
export const ITEM_APPLE = 37;

// ==================== Названия блоков и предметов ====================
export const BLOCK_NAMES = {
    [BLOCK_GRASS]: 'Трава',
    [BLOCK_DIRT]: 'Земля',
    [BLOCK_STONE]: 'Камень',
    [BLOCK_LOG]: 'Бревно',
    [BLOCK_LEAVES]: 'Листья',
    [BLOCK_SAND]: 'Песок',
    [BLOCK_PLANKS]: 'Доски',
    [BLOCK_COBBLESTONE]: 'Булыжник',
    [BLOCK_WATER]: 'Вода',
    [BLOCK_BEDROCK]: 'Бедрок',
    [BLOCK_DIAMOND_ORE]: 'Алмазная руда',
    [BLOCK_CRAFTING_TABLE]: 'Верстак',
    [BLOCK_COAL_ORE]: 'Угольная руда',
    [BLOCK_GRAVEL]: 'Гравий',
    [BLOCK_JUNGLE_LOG]: 'Джунглевое бревно',
    [BLOCK_JUNGLE_LEAVES]: 'Джунглевые листья',
    [ITEM_STICK]: 'Палка',
    [ITEM_WOODEN_PICKAXE]: 'Дер. кирка',
    [ITEM_WOODEN_AXE]: 'Дер. топор',
    [ITEM_WOODEN_SHOVEL]: 'Дер. лопата',
    [ITEM_WOODEN_SWORD]: 'Дер. меч',
    [ITEM_COAL]: 'Уголь',
    [ITEM_TORCH]: 'Факел',
    [ITEM_DIAMOND]: 'Алмаз',
    [ITEM_CAR]: 'Машина',
    [BLOCK_GRASS_PLANT]: 'Трава',
    [DIAMOND_BLOCK]: 'Алмазный блок',
    [ITEM_DIAMOND_SWORD]: 'Алмазный меч',
    [ITEM_APPLE]: 'Яблоко',
    [ITEM_SHOTGUN]: 'Дробовик',
    [BLOCK_FLESH]: 'Блок плоти',
    [BLOCK_TORCH_FLOOR]: 'Факел',
    [BLOCK_TORCH_N]: 'Факел',
    [BLOCK_TORCH_S]: 'Факел',
    [BLOCK_TORCH_E]: 'Факел',
    [BLOCK_TORCH_W]: 'Факел',
    [BLOCK_TORCH_OFF]: 'Потухший факел',
};

// ==================== Таблица дропа ====================
export const BLOCK_DROPS = {
    [BLOCK_GRASS]: BLOCK_DIRT,
    [BLOCK_DIRT]: BLOCK_DIRT,
    [BLOCK_STONE]: BLOCK_COBBLESTONE,
    [BLOCK_LOG]: BLOCK_LOG,
    [BLOCK_LEAVES]: BLOCK_LEAVES,
    [BLOCK_SAND]: BLOCK_SAND,
    [BLOCK_PLANKS]: BLOCK_PLANKS,
    [BLOCK_COBBLESTONE]: BLOCK_COBBLESTONE,
    [BLOCK_WATER]: BLOCK_WATER,
    [BLOCK_BEDROCK]: BLOCK_BEDROCK,
    [BLOCK_DIAMOND_ORE]: ITEM_DIAMOND,
    [BLOCK_CRAFTING_TABLE]: BLOCK_CRAFTING_TABLE,
    [BLOCK_COAL_ORE]: ITEM_COAL,
    [BLOCK_GRAVEL]: BLOCK_GRAVEL,
    [BLOCK_JUNGLE_LOG]: BLOCK_LOG,
    [BLOCK_JUNGLE_LEAVES]: BLOCK_LEAVES,
    [BLOCK_GRASS_PLANT]: BLOCK_GRASS_PLANT,
    [DIAMOND_BLOCK]: DIAMOND_BLOCK,
    [BLOCK_TORCH_FLOOR]: ITEM_TORCH,
    [BLOCK_TORCH_N]: ITEM_TORCH,
    [BLOCK_TORCH_S]: ITEM_TORCH,
    [BLOCK_TORCH_E]: ITEM_TORCH,
    [BLOCK_TORCH_W]: ITEM_TORCH,
    [BLOCK_TORCH_OFF]: ITEM_TORCH,
};

export const BLOCK_TYPES = new Set([
    BLOCK_GRASS,
    BLOCK_DIRT,
    BLOCK_STONE,
    BLOCK_LOG,
    BLOCK_LEAVES,
    BLOCK_SAND,
    BLOCK_PLANKS,
    BLOCK_COBBLESTONE,
    BLOCK_WATER,
    BLOCK_BEDROCK,
    BLOCK_DIAMOND_ORE,
    BLOCK_CRAFTING_TABLE,
    BLOCK_COAL_ORE,
    BLOCK_GRAVEL,
    BLOCK_JUNGLE_LOG,
    BLOCK_JUNGLE_LEAVES,
    DIAMOND_BLOCK,
    BLOCK_FLESH,
    BLOCK_TORCH_FLOOR,
    BLOCK_TORCH_N,
    BLOCK_TORCH_S,
    BLOCK_TORCH_E,
    BLOCK_TORCH_W,
    BLOCK_TORCH_OFF,
]);

// ==================== Рецепты крафта ====================
export const RECIPES_2X2 = [
    { pattern: ['LOG',    null,
                null,     null],
      result: { type: BLOCK_PLANKS, count: 4 } },

    { pattern: ['PLANKS', null,
                'PLANKS', null],
      result: { type: ITEM_STICK, count: 4 } },

    { pattern: ['PLANKS', 'PLANKS',
                'PLANKS', 'PLANKS'],
      result: { type: BLOCK_CRAFTING_TABLE, count: 1 } },
];

export const RECIPES_3X3 = [
    { pattern: ['LOG',    null, null,
                null,     null, null,
                null,     null, null],
      result: { type: BLOCK_PLANKS, count: 4 } },

    { pattern: [null,     'PLANKS', null,
                null,     'PLANKS', null,
                null,     null,     null],
      result: { type: ITEM_STICK, count: 4 } },

    { pattern: ['PLANKS', 'PLANKS', null,
                'PLANKS', 'PLANKS', null,
                null,     null,     null],
      result: { type: BLOCK_CRAFTING_TABLE, count: 1 } },

    { pattern: ['PLANKS', 'PLANKS', 'PLANKS',
                null,     'STICK',  null,
                null,     'STICK',  null],
      result: { type: ITEM_WOODEN_PICKAXE, count: 1 } },

    { pattern: ['PLANKS', 'PLANKS', null,
                'PLANKS', 'STICK',  null,
                null,     'STICK',  null],
      result: { type: ITEM_WOODEN_AXE, count: 1 } },

    { pattern: [null,     'PLANKS', null,
                null,     'STICK',  null,
                null,     'STICK',  null],
      result: { type: ITEM_WOODEN_SHOVEL, count: 1 } },

    { pattern: [null,     'PLANKS', null,
                null,     'PLANKS', null,
                null,     'STICK',  null],
      result: { type: ITEM_WOODEN_SWORD, count: 1 } },

    { pattern: [null,     'COAL',   null,
                null,     'STICK',  null,
                null,     null,     null],
      result: { type: ITEM_TORCH, count: 4 } },

    { pattern: ['DIAMOND', 'DIAMOND', 'DIAMOND',
                'DIAMOND', 'DIAMOND', 'DIAMOND',
                'DIAMOND', 'DIAMOND', 'DIAMOND'],
      result: { type: DIAMOND_BLOCK, count: 1 } },

    { pattern: ['DIAMOND_BLOCK', null, null,
                null, null, null,
                null, null, null],
      result: { type: ITEM_DIAMOND, count: 9 } },

    { pattern: [null,     'DIAMOND', null,
                null,     'DIAMOND', null,
                null,     'STICK',   null],
      result: { type: ITEM_DIAMOND_SWORD, count: 1 } },

    { pattern: ['PLANKS',  'PLANKS',  'PLANKS',
                'DIAMOND', 'DIAMOND', 'DIAMOND',
                'PLANKS',  'COAL',    'PLANKS'],
      result: { type: ITEM_CAR, count: 1 } },
];

// ==================== Функция получения текстур граней ====================
export function getBlockTextures(type) {
    switch (type) {
        case BLOCK_GRASS: return [TEX_GRASS_TOP, TEX_DIRT, TEX_GRASS_SIDE, TEX_GRASS_SIDE, TEX_GRASS_SIDE, TEX_GRASS_SIDE];
        case BLOCK_LOG:   return [TEX_LOG_TOP, TEX_LOG_TOP, TEX_LOG_SIDE, TEX_LOG_SIDE, TEX_LOG_SIDE, TEX_LOG_SIDE];
        case BLOCK_DIRT:  return [TEX_DIRT, TEX_DIRT, TEX_DIRT, TEX_DIRT, TEX_DIRT, TEX_DIRT];
        case BLOCK_STONE: return [TEX_STONE, TEX_STONE, TEX_STONE, TEX_STONE, TEX_STONE, TEX_STONE];
        case BLOCK_LEAVES: return [TEX_LEAVES, TEX_LEAVES, TEX_LEAVES, TEX_LEAVES, TEX_LEAVES, TEX_LEAVES];
        case BLOCK_SAND:  return [TEX_SAND, TEX_SAND, TEX_SAND, TEX_SAND, TEX_SAND, TEX_SAND];
        case BLOCK_PLANKS: return [TEX_PLANKS, TEX_PLANKS, TEX_PLANKS, TEX_PLANKS, TEX_PLANKS, TEX_PLANKS];
        case BLOCK_COBBLESTONE: return [TEX_COBBLESTONE, TEX_COBBLESTONE, TEX_COBBLESTONE, TEX_COBBLESTONE, TEX_COBBLESTONE, TEX_COBBLESTONE];
        case BLOCK_WATER: return [TEX_WATER, TEX_WATER, TEX_WATER, TEX_WATER, TEX_WATER, TEX_WATER];
        case BLOCK_BEDROCK: return [TEX_BEDROCK, TEX_BEDROCK, TEX_BEDROCK, TEX_BEDROCK, TEX_BEDROCK, TEX_BEDROCK];
        case BLOCK_DIAMOND_ORE: return [TEX_DIAMOND_ORE, TEX_DIAMOND_ORE, TEX_DIAMOND_ORE, TEX_DIAMOND_ORE, TEX_DIAMOND_ORE, TEX_DIAMOND_ORE];
        case BLOCK_CRAFTING_TABLE: return [TEX_CRAFTING_TABLE_TOP, TEX_CRAFTING_TABLE_TOP, TEX_CRAFTING_TABLE_SIDE, TEX_CRAFTING_TABLE_SIDE, TEX_CRAFTING_TABLE_SIDE, TEX_CRAFTING_TABLE_SIDE];
        case BLOCK_COAL_ORE: return [TEX_COAL_ORE, TEX_COAL_ORE, TEX_COAL_ORE, TEX_COAL_ORE, TEX_COAL_ORE, TEX_COAL_ORE];
        case BLOCK_GRAVEL: return [TEX_GRAVEL, TEX_GRAVEL, TEX_GRAVEL, TEX_GRAVEL, TEX_GRAVEL, TEX_GRAVEL];
        case BLOCK_JUNGLE_LOG: return [TEX_JUNGLE_LOG_TOP, TEX_JUNGLE_LOG_TOP, TEX_JUNGLE_LOG_SIDE, TEX_JUNGLE_LOG_SIDE, TEX_JUNGLE_LOG_SIDE, TEX_JUNGLE_LOG_SIDE];
        case BLOCK_JUNGLE_LEAVES: return [TEX_JUNGLE_LEAVES, TEX_JUNGLE_LEAVES, TEX_JUNGLE_LEAVES, TEX_JUNGLE_LEAVES, TEX_JUNGLE_LEAVES, TEX_JUNGLE_LEAVES];
        case BLOCK_GRASS_PLANT: return [TEX_GRASS_PLANT, TEX_GRASS_PLANT, TEX_GRASS_PLANT, TEX_GRASS_PLANT, TEX_GRASS_PLANT, TEX_GRASS_PLANT];
        case DIAMOND_BLOCK: return [TEX_DIAMOND_BLOCK, TEX_DIAMOND_BLOCK, TEX_DIAMOND_BLOCK, TEX_DIAMOND_BLOCK, TEX_DIAMOND_BLOCK, TEX_DIAMOND_BLOCK];
        case BLOCK_FLESH: return [TEX_FLESH_BLOCK, TEX_FLESH_BLOCK, TEX_FLESH_BLOCK, TEX_FLESH_BLOCK, TEX_FLESH_BLOCK, TEX_FLESH_BLOCK];
        case BLOCK_TORCH_FLOOR:
        case BLOCK_TORCH_N:
        case BLOCK_TORCH_S:
        case BLOCK_TORCH_E:
        case BLOCK_TORCH_W:
        case BLOCK_TORCH_OFF:
            return [TEX_TORCH, TEX_TORCH, TEX_TORCH, TEX_TORCH, TEX_TORCH, TEX_TORCH];
        // Предметы
        case ITEM_STICK: return [TEX_STICK, TEX_STICK, TEX_STICK, TEX_STICK, TEX_STICK, TEX_STICK];
        case ITEM_WOODEN_PICKAXE: return [TEX_WOODEN_PICKAXE, TEX_WOODEN_PICKAXE, TEX_WOODEN_PICKAXE, TEX_WOODEN_PICKAXE, TEX_WOODEN_PICKAXE, TEX_WOODEN_PICKAXE];
        case ITEM_WOODEN_AXE: return [TEX_WOODEN_AXE, TEX_WOODEN_AXE, TEX_WOODEN_AXE, TEX_WOODEN_AXE, TEX_WOODEN_AXE, TEX_WOODEN_AXE];
        case ITEM_WOODEN_SHOVEL: return [TEX_WOODEN_SHOVEL, TEX_WOODEN_SHOVEL, TEX_WOODEN_SHOVEL, TEX_WOODEN_SHOVEL, TEX_WOODEN_SHOVEL, TEX_WOODEN_SHOVEL];
        case ITEM_WOODEN_SWORD: return [TEX_WOODEN_SWORD, TEX_WOODEN_SWORD, TEX_WOODEN_SWORD, TEX_WOODEN_SWORD, TEX_WOODEN_SWORD, TEX_WOODEN_SWORD];
        case ITEM_COAL: return [TEX_COAL, TEX_COAL, TEX_COAL, TEX_COAL, TEX_COAL, TEX_COAL];
        case ITEM_TORCH: return [TEX_TORCH, TEX_TORCH, TEX_TORCH, TEX_TORCH, TEX_TORCH, TEX_TORCH];
        case ITEM_DIAMOND: return [TEX_DIAMOND, TEX_DIAMOND, TEX_DIAMOND, TEX_DIAMOND, TEX_DIAMOND, TEX_DIAMOND];
        case ITEM_CAR: return [TEX_CAR, TEX_CAR, TEX_CAR, TEX_CAR, TEX_CAR, TEX_CAR];
        case ITEM_DIAMOND_SWORD: return [TEX_DIAMOND_SWORD, TEX_DIAMOND_SWORD, TEX_DIAMOND_SWORD, TEX_DIAMOND_SWORD, TEX_DIAMOND_SWORD, TEX_DIAMOND_SWORD];
        case ITEM_APPLE: return [TEX_APPLE, TEX_APPLE, TEX_APPLE, TEX_APPLE, TEX_APPLE, TEX_APPLE];
        case ITEM_SHOTGUN: return [TEX_SHOTGUN, TEX_SHOTGUN, TEX_SHOTGUN, TEX_SHOTGUN, TEX_SHOTGUN, TEX_SHOTGUN];
        default: return [TEX_STONE, TEX_STONE, TEX_STONE, TEX_STONE, TEX_STONE, TEX_STONE];
    }
}