// js/textures.js
import {
    ATLAS_WIDTH, ATLAS_HEIGHT, TEX_CELL, TEX_COLS,
    TEX_GRASS_TOP, TEX_GRASS_SIDE, TEX_DIRT, TEX_STONE,
    TEX_LOG_TOP, TEX_LOG_SIDE, TEX_LEAVES, TEX_SAND,
    TEX_PLANKS, TEX_COBBLESTONE, TEX_WATER, TEX_BEDROCK,
    TEX_DIAMOND_ORE, TEX_CRAFTING_TABLE_TOP, TEX_STICK, TEX_COAL_ORE,
    TEX_CRAFTING_TABLE_SIDE, BLOCK_GRAVEL,
    TEX_WOODEN_PICKAXE, TEX_WOODEN_AXE, TEX_WOODEN_SHOVEL,
    TEX_WOODEN_SWORD, TEX_COAL, TEX_TORCH, TEX_DIAMOND, TEX_CAR, TEX_GRAVEL, TEX_GRASS_PLANT,
    TEX_DIAMOND_BLOCK, TEX_DIAMOND_SWORD, TEX_APPLE, TEX_SHOTGUN, TEX_FLESH_BLOCK,
} from './constants.js';

// Запасные прорисовщики на случай отсутствия файлов
const fallbackDraw = {
    [TEX_GRASS_TOP]: (c, s) => { c.fillStyle = '#5a9e3a'; c.fillRect(0, 0, s, s); },
    [TEX_GRASS_SIDE]: (c, s) => { c.fillStyle = '#8B6914'; c.fillRect(0, 0, s, s); c.fillStyle = '#6b9e2f'; c.fillRect(0, 0, s, s * 0.4); },
    [TEX_STONE]: (c, s) => { c.fillStyle = '#7a7a7a'; c.fillRect(0, 0, s, s); },
    [TEX_COBBLESTONE]: (c, s) => { c.fillStyle = '#6b6b6b'; c.fillRect(0, 0, s, s); },
    [TEX_WATER]: (c, s) => { c.fillStyle = '#3388cc'; c.fillRect(0, 0, s, s); },
    [TEX_DIAMOND_ORE]: (c, s) => { c.fillStyle = '#7a7a7a'; c.fillRect(0, 0, s, s); c.fillStyle = '#4fc3f7'; c.fillRect(4, 4, 8, 8); },
    [TEX_COAL_ORE]: (c, s) => { c.fillStyle = '#5a5a5a'; c.fillRect(0, 0, s, s); c.fillStyle = '#222'; c.fillRect(4, 4, 8, 8); },
    [TEX_LEAVES]: (c, s) => { c.fillStyle = '#3d7a28'; c.fillRect(0, 0, s, s); },
    [TEX_CRAFTING_TABLE_TOP]: (c, s) => { c.fillStyle = '#c49a5c'; c.fillRect(0, 0, s, s); },
    [TEX_CRAFTING_TABLE_SIDE]: (c, s) => { c.fillStyle = '#8c6a3a'; c.fillRect(0, 0, s, s); },
    [TEX_STICK]: (c, s) => { c.fillStyle = '#8B5A2B'; c.fillRect(6, 0, 4, s); },
    [TEX_WOODEN_PICKAXE]: (c, s) => { c.fillStyle = '#8B5A2B'; c.fillRect(6, 0, 4, 10); c.fillStyle = '#c49a5c'; c.fillRect(2, 8, 12, 4); },
    [TEX_WOODEN_AXE]: (c, s) => { c.fillStyle = '#8B5A2B'; c.fillRect(6, 0, 4, 10); c.fillStyle = '#c49a5c'; c.fillRect(0, 8, 16, 4); },
    [TEX_WOODEN_SHOVEL]: (c, s) => { c.fillStyle = '#8B5A2B'; c.fillRect(6, 0, 4, 12); c.fillStyle = '#c49a5c'; c.fillRect(4, 12, 8, 4); },
    [TEX_WOODEN_SWORD]: (c, s) => { c.fillStyle = '#8B5A2B'; c.fillRect(6, 0, 4, 12); c.fillStyle = '#c49a5c'; c.fillRect(4, 4, 8, 4); },
    [TEX_COAL]: (c, s) => { c.fillStyle = '#3a3a3a'; c.fillRect(4, 4, 8, 8); },
    [TEX_TORCH]: (c, s) => { c.fillStyle = '#8B5A2B'; c.fillRect(7, 10, 2, 6); c.fillStyle = '#ffaa00'; c.fillRect(5, 2, 6, 8); },
    [TEX_DIAMOND]: (c, s) => { c.fillStyle = '#4fc3f7'; c.fillRect(2, 2, 12, 12); c.fillStyle = '#e0f7fa'; c.fillRect(4, 4, 8, 8); },
    [TEX_CAR]: (c, s) => { c.fillStyle = '#e53935'; c.fillRect(2, 4, 12, 8); c.fillStyle = '#212121'; c.fillRect(2, 12, 4, 4); c.fillRect(10, 12, 4, 4); },
    [TEX_LOG_TOP]: (c, s) => { c.fillStyle = '#c4945a'; c.fillRect(0, 0, s, s); },
    [TEX_LOG_SIDE]: (c, s) => { c.fillStyle = '#9e7a4a'; c.fillRect(0, 0, s, s); },
    [TEX_SAND]: (c, s) => { c.fillStyle = '#cabf8f'; c.fillRect(0, 0, s, s); },
    [TEX_DIRT]: (c, s) => { c.fillStyle = '#412e0d'; c.fillRect(0, 0, s, s); },
    [TEX_GRASS_PLANT]: (c, s) => { c.fillStyle = '#4a8c2a'; c.fillRect(4,0,8,16); c.fillStyle = '#2d5a1c'; c.fillRect(6,0,4,12); },
    [TEX_DIAMOND_BLOCK]: (c, s) => { c.fillStyle = '#00a2ff'; c.fillRect(0, 0, s, s); },
    [TEX_APPLE]:(c, s) => { c.fillStyle = '#f74f4f'; c.fillRect(2, 2, 12, 12); c.fillStyle = '#e0f7fa'; c.fillRect(4, 4, 8, 8); },
    [TEX_DIAMOND_SWORD]: (c, s) => { c.fillStyle = '#0099ff'; c.fillRect(6, 0, 4, 12); c.fillStyle = '#adfcff'; c.fillRect(4, 4, 8, 4); },
    [TEX_SHOTGUN]: (c, s) => { c.fillStyle = '#333'; c.fillRect(2, 2, s-4, s-4); c.fillStyle = '#555'; c.fillRect(4, 6, 8, 4); c.fillStyle = '#8B4513'; c.fillRect(5, 4, 2, 8); },
    [TEX_FLESH_BLOCK]: (c, s) => { c.fillStyle = '#410d0d'; c.fillRect(0, 0, s, s); },
};

// Рисует текстуру по индексу в атласе
function drawTex(ctx, idx, drawFn) {
    const col = idx % TEX_COLS;
    const row = Math.floor(idx / TEX_COLS);
    const x = col * TEX_CELL;
    const y = row * TEX_CELL;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, TEX_CELL, TEX_CELL);
    ctx.clip();
    drawFn(ctx, TEX_CELL);
    ctx.restore();
}

// Пытается загрузить текстуру из файла, иначе рисует fallback
async function loadTexSafe(ctx, idx, filename, fallback) {
    try {
        const img = new Image();
        img.src = 'textures/' + filename;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('404'));
        });
        const col = idx % TEX_COLS;
        const row = Math.floor(idx / TEX_COLS);
        ctx.drawImage(img, col * TEX_CELL, row * TEX_CELL, TEX_CELL, TEX_CELL);
        console.log(`✅ Загружена текстура: ${filename}`);
    } catch (e) {
        console.warn(`⚠️ Файл ${filename} не найден, использую заглушку`);
        drawTex(ctx, idx, fallback);
    }
}

export async function createTextureAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_WIDTH;
    canvas.height = ATLAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawTex(ctx, TEX_GRASS_PLANT, (c, s) => {
    c.clearRect(0, 0, s, s); // полностью прозрачный фон
    // // Рисуем несколько травинок
    // c.fillStyle = '#3a7728';
    // c.fillRect(7, 0, 2, 16);  // центральный стебель
    // c.fillStyle = '#2d5a1c';
    // c.fillRect(6, 0, 1, 12);  // тень
    // c.fillStyle = '#4c9a2a';
    // c.fillRect(8, 0, 1, 14);
    // // Боковые травинки
    // c.fillStyle = '#3a7728';
    // c.fillRect(3, 4, 2, 8);
    // c.fillRect(11, 5, 2, 7);
    // c.fillStyle = '#2d5a1c';
    // c.fillRect(4, 4, 1, 6);
    // c.fillRect(12, 5, 1, 5);
});

    // Загружаем текстуры, которые могут быть в файлах
    await loadTexSafe(ctx, TEX_GRASS_TOP, 'grass_block_top.png', fallbackDraw[TEX_GRASS_TOP]);
    await loadTexSafe(ctx, TEX_GRASS_SIDE, 'grass_block_side.png', fallbackDraw[TEX_GRASS_SIDE]);
    await loadTexSafe(ctx, TEX_STONE, 'stone.png', fallbackDraw[TEX_STONE]);
    await loadTexSafe(ctx, TEX_COBBLESTONE, 'cobblestone.png', fallbackDraw[TEX_COBBLESTONE]);
    await loadTexSafe(ctx, TEX_WATER, 'lake_water.png', fallbackDraw[TEX_WATER]);
    await loadTexSafe(ctx, TEX_DIAMOND_ORE, 'diamond_ore.png', fallbackDraw[TEX_DIAMOND_ORE]);
    await loadTexSafe(ctx, TEX_COAL_ORE, 'coal_ore.png', fallbackDraw[TEX_COAL_ORE]);
    await loadTexSafe(ctx, TEX_LEAVES, 'leaves_okak.png', fallbackDraw[TEX_LEAVES]);
    await loadTexSafe(ctx, TEX_CRAFTING_TABLE_TOP, 'crafting_table_top.png', fallbackDraw[TEX_CRAFTING_TABLE_TOP]);
    await loadTexSafe(ctx, TEX_CRAFTING_TABLE_SIDE, 'crafting_table_side.png', fallbackDraw[TEX_CRAFTING_TABLE_SIDE]);
    await loadTexSafe(ctx, TEX_LOG_TOP, 'okak_log_top.png', fallbackDraw[TEX_LOG_TOP]);
    await loadTexSafe(ctx, TEX_LOG_SIDE, 'okak_log_side.png', fallbackDraw[TEX_LOG_SIDE]);
    await loadTexSafe(ctx, TEX_STICK, 'stick.png', fallbackDraw[TEX_STICK]);
    await loadTexSafe(ctx, TEX_COAL, 'coal.png', fallbackDraw[TEX_COAL]);
    await loadTexSafe(ctx, TEX_TORCH, 'torch.png', fallbackDraw[TEX_TORCH]);
    await loadTexSafe(ctx, TEX_DIAMOND, 'diamond.png', fallbackDraw[TEX_DIAMOND]);
    await loadTexSafe(ctx, TEX_CAR, 'car.png', fallbackDraw[TEX_CAR]);
    await loadTexSafe(ctx, TEX_PLANKS, 'planks.png', fallbackDraw[TEX_PLANKS]);
    await loadTexSafe(ctx, TEX_WOODEN_AXE, 'wooden_axe.png', fallbackDraw[TEX_WOODEN_AXE]);
    await loadTexSafe(ctx, TEX_GRAVEL, 'gravel.png', fallbackDraw[TEX_GRAVEL]);
    await loadTexSafe(ctx, TEX_SAND, 'sand.png', fallbackDraw[TEX_SAND]);
    await loadTexSafe(ctx, TEX_DIRT, 'dirt.png', fallbackDraw[TEX_DIRT]);
    await loadTexSafe(ctx, TEX_WOODEN_PICKAXE, 'wooden_pickaxe.png', fallbackDraw[TEX_WOODEN_PICKAXE]);
    await loadTexSafe(ctx, TEX_DIAMOND_BLOCK, 'diamond_block.png', fallbackDraw[TEX_DIAMOND_BLOCK]);
    await loadTexSafe(ctx, TEX_APPLE, 'apple.png', fallbackDraw[TEX_APPLE]);
    await loadTexSafe(ctx, TEX_DIAMOND_SWORD, 'diamond_sword.png', fallbackDraw[TEX_DIAMOND_SWORD]);
    await loadTexSafe(ctx, TEX_FLESH_BLOCK, 'flesh_block.png', fallbackDraw[TEX_FLESH_BLOCK]);

    await loadTexSafe(ctx, TEX_GRASS_PLANT, 'grass.png', fallbackDraw[TEX_GRASS_PLANT]);

    // Программные текстуры (всегда рисуем)
    // drawTex(ctx, TEX_DIRT, (c, s) => {
    //     c.fillStyle = '#8B6914';
    //     c.fillRect(0, 0, s, s);
    //     for (let i = 0; i < 45; i++) {
    //         c.fillStyle = `rgba(100,65,20,0.5)`;
    //         c.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    //     }
    // });
    // drawTex(ctx, TEX_SAND, (c, s) => { c.fillStyle = '#e8d5a3'; c.fillRect(0, 0, s, s); });
    // drawTex(ctx, TEX_PLANKS, (c, s) => { c.fillStyle = '#c49a5c'; c.fillRect(0, 0, s, s); });
    drawTex(ctx, TEX_BEDROCK, (c, s) => { c.fillStyle = '#2a2a2a'; c.fillRect(0, 0, s, s); });

    // Инструменты без файлов уже имеют fallback, но на всякий случай добавим их принудительно,
    // если они не были загружены (например, если файл не указан в loadTexSafe).
    // Однако мы уже добавили их в loadTexSafe, так что они либо загружены, либо нарисованы.
    // Дополнительно можно ничего не делать.

    return canvas;
}