// js/config.js

export const CONFIG = { MAP_WIDTH: 20, MAP_HEIGHT: 20, TILE_SIZE: 192, MINIMAP_DOT_SIZE: 8, NUM_NPCS: 4, DAY_DURATION_MS: 120000, STAT_DECAY_INTERVAL_MS: 5000, NPC_ACTION_INTERVAL_MS: 3000, CHAT_MESSAGE_INTERVAL_MS: 25000 };

export const SPRITESHEET_PATHS = {
    base: 'assets/spritesheet_base.png',
    tiles: 'assets/spritesheet_tiles.png',
    grout: 'assets/grout_texture.png',

    bg_forest_1: 'assets/bg_forest_1.png', bg_forest_2: 'assets/bg_forest_2.png', bg_forest_3: 'assets/bg_forest_3.png', bg_forest_4: 'assets/bg_forest_4.png',
    bg_plains_1: 'assets/bg_plains_1.png', bg_plains_2: 'assets/bg_plains_2.png', bg_plains_3: 'assets/bg_plains_3.png', bg_plains_4: 'assets/bg_plains_4.png',
    bg_sand_1: 'assets/bg_sand_1.png', bg_sand_2: 'assets/bg_sand_2.png', bg_sand_3: 'assets/bg_sand_3.png', bg_sand_4: 'assets/bg_sand_4.png',
    bg_wasteland_1: 'assets/bg_wasteland_1.png', bg_wasteland_2: 'assets/bg_wasteland_2.png', bg_wasteland_3: 'assets/bg_wasteland_3.png', bg_wasteland_4: 'assets/bg_wasteland_4.png'
};

export const SPRITESHEET_DATA = { "water_calm": { "x": 44, "y": 44, "w": 410, "h": 414 }, "water_moving": { "x": 553, "y": 44, "w": 411, "h": 415 }, "sand_fine": { "x": 44, "y": 562, "w": 410, "h": 400 }, "sand_coarse": { "x": 560, "y": 562, "w": 409, "h": 402 }, "wasteland": { "x": 7, "y": 8, "w": 292, "h": 276 }, "plains": { "x": 352, "y": 11, "w": 295, "h": 272 }, "forest": { "x": 699, "y": 10, "w": 300, "h": 273 }, "shelter_individual": { "x": 21, "y": 673, "w": 280, "h": 312 }, "mine": { "x": 353, "y": 659, "w": 295, "h": 326 }, "shelter_collective": { "x": 695, "y": 655, "w": 308, "h": 331 }, "stone_deposit": { "x": 353, "y": 659, "w": 295, "h": 326 }, "campfire": {"x": 21, "y": 673, "w": 280, "h": 312} };

export const TILE_TYPES = {
    WATER_LAGOON: { name: 'Lagon', accessible: false, sprite: 'water_calm', sheet: 'base', color: '#48cae4', background: ['bg_sand_1', 'bg_sand_2', 'bg_sand_3', 'bg_sand_4'], resource: { type: 'Eau', yield: 1 }, harvests: Infinity },
    SAND_GOLDEN: { name: 'Sable Doré', accessible: true, sprite: 'sand_fine', sheet: 'base', color: '#f4d35e', background: ['bg_sand_1', 'bg_sand_2', 'bg_sand_3', 'bg_sand_4'], resource: { type: 'Poisson', yield: 1 }, harvests: 20 },
    FOREST: { name: 'Forêt', resource: { type: 'Bois', yield: 5 }, harvests: 10, accessible: true, sprite: 'forest', sheet: 'tiles', color: '#2d6a4f', background: ['bg_forest_1', 'bg_forest_2', 'bg_forest_3', 'bg_forest_4'] },
    WASTELAND: { name: 'Friche', accessible: true, sprite: 'wasteland', sheet: 'tiles', color: '#9c6644', background: ['bg_wasteland_1', 'bg_wasteland_2', 'bg_wasteland_3', 'bg_wasteland_4'] },
    PLAINS: { name: 'Plaine', accessible: true, sprite: 'plains', sheet: 'tiles', color: '#80b918', background: ['bg_plains_1', 'bg_plains_2', 'bg_plains_3', 'bg_plains_4'] },
    STONE_DEPOSIT: { name: 'Gisement de Pierre', accessible: true, sprite: 'stone_deposit', sheet: 'tiles', color: '#8d99ae', background: ['bg_wasteland_2', 'bg_wasteland_4'], resource: { type: 'Pierre', yield: 3 }, harvests: 15 },
    CAMPFIRE: { name: 'Feu de Camp', accessible: false, sprite: 'campfire', sheet: 'tiles', color: '#e76f51', background: ['bg_plains_4'] },
    SHELTER_INDIVIDUAL: { name: 'Abri Individuel', accessible: false, sprite: 'shelter_individual', sheet: 'tiles', color: '#fefae0', background: ['bg_plains_1'] },
    SHELTER_COLLECTIVE: { name: 'Abri Collectif', accessible: false, sprite: 'shelter_collective', sheet: 'tiles', color: '#ffffff', background: ['bg_plains_1'] },
    MINE: { name: 'Mine', accessible: false, sprite: 'mine', sheet: 'tiles', color: '#5e503f', background: ['bg_wasteland_1'] }
};