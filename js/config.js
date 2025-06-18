// js/config.js

export const CONFIG = {
    MAP_WIDTH: 20, MAP_HEIGHT: 20, TILE_SIZE: 192, MINIMAP_DOT_SIZE: 8,
    NUM_NPCS: 4, 
    
    // MODIFIÉ: Remplacement de NUM_ENEMIES
    INITIAL_ENEMIES: 1,      // On commence avec 1 seul ennemi
    MAX_ENEMIES: 6,          // Il n'y aura jamais plus de 6 ennemis en même temps
    ENEMY_SPAWN_CHECK_DAYS: 3, // On essaie de faire apparaître un ennemi tous les 3 jours
    
    DAY_DURATION_MS: 120000, STAT_DECAY_INTERVAL_MS: 5000,
    NPC_ACTION_INTERVAL_MS: 3000, CHAT_MESSAGE_INTERVAL_MS: 25000,
    PLAYER_MAX_RESOURCES: 100 
};

// NOUVEAU: Constantes pour le combat
export const COMBAT_CONFIG = {
    PLAYER_BASE_DAMAGE: 2,
    FLEE_CHANCE: 0.5, // 50% de chance de fuir
};

export const ACTION_DURATIONS = {
    HARVEST: 1000, CRAFT: 1500, SLEEP: 3000, MOVE_TRANSITION: 400,
    DIG: 5000, // Nouvelle durée pour creuser
};

// NOUVEAU: Types d'ennemis
export const ENEMY_TYPES = {
    WOLF: {
        name: 'Loup Agressif',
        icon: '🐺',
        health: 10,
        damage: 2,
        color: '#dc2626',
        aggroRadius: 4, // Se dirige vers le joueur s'il est à 4 cases ou moins
        loot: { 'Poisson': 1 }
    },
    SNAKE: {
        name: 'Serpent Venimeux',
        icon: '🐍',
        health: 6,
        damage: 3,
        color: '#16a34a',
        aggroRadius: 3,
        loot: {}
    }
};

// NOUVEAU: Liste des minerais possibles
export const ORE_TYPES = ['Charbon', 'Cuivre', 'Fer', 'Argent', 'Or'];

export const SPRITESHEET_PATHS = {
    // Biomes
    bg_forest_1: 'assets/bg_forest_1.png', bg_forest_2: 'assets/bg_forest_2.png', bg_forest_3: 'assets/bg_forest_3.png', bg_forest_4: 'assets/bg_forest_4.png',
    bg_plains_1: 'assets/bg_plains_1.png', bg_plains_2: 'assets/bg_plains_2.png', bg_plains_3: 'assets/bg_plains_3.png', bg_plains_4: 'assets/bg_plains_4.png',
    bg_sand_1: 'assets/bg_sand_1.png', bg_sand_2: 'assets/bg_sand_2.png', bg_sand_3: 'assets/bg_sand_3.png', bg_sand_4: 'assets/bg_sand_4.png',
    bg_wasteland_1: 'assets/bg_wasteland_1.png', bg_wasteland_2: 'assets/bg_wasteland_2.png', bg_wasteland_3: 'assets/bg_wasteland_3.png', bg_wasteland_4: 'assets/bg_wasteland_4.png',
    bg_stone_1: 'assets/bg_stone_1.png',
    bg_stone_2: 'assets/bg_stone_2.png',

    // Structures
    bg_shelter_individual: 'assets/bg_shelter_individual.png',
    bg_shelter_collective: 'assets/bg_shelter_collective.png',
    bg_campfire: 'assets/bg_campfire.png',
    bg_mine: 'assets/bg_mine.png',
};

export const TILE_TYPES = {
    WATER_LAGOON: { name: 'Lagon', accessible: false, color: '#48cae4', background: ['bg_sand_1', 'bg_sand_2', 'bg_sand_3', 'bg_sand_4'], resource: { type: 'Eau', yield: 1 }, harvests: Infinity },
    SAND_GOLDEN: { name: 'Sable Doré', accessible: true, color: '#f4d35e', background: ['bg_sand_1', 'bg_sand_2', 'bg_sand_3', 'bg_sand_4'], resource: { type: 'Poisson', yield: 1 }, harvests: 20 },
    
    FOREST: { 
        name: 'Forêt', 
        resource: { type: 'Bois', yield: 5, thirstCost: 2, hungerCost: 3 }, 
        harvests: 10, 
        accessible: true, 
        color: '#2d6a4f', 
        background: ['bg_forest_1', 'bg_forest_2', 'bg_forest_3', 'bg_forest_4'] 
    },
    
    WASTELAND: { 
        name: 'Friche', 
        accessible: true, 
        color: '#9c6644', 
        background: ['bg_wasteland_1', 'bg_wasteland_2', 'bg_wasteland_3', 'bg_wasteland_4'],
        regeneration: { cost: { 'Eau': 5 }, target: 'FOREST' }
    },

    PLAINS: { name: 'Plaine', accessible: true, color: '#80b918', background: ['bg_plains_1', 'bg_plains_2', 'bg_plains_3', 'bg_plains_4'] },
    STONE_DEPOSIT: { name: 'Gisement de Pierre', accessible: true, color: '#8d99ae', background: ['bg_stone_1', 'bg_stone_2'], resource: { type: 'Pierre', yield: 3 }, harvests: 15 },
    
    CAMPFIRE: { name: 'Feu de Camp', accessible: true, color: '#e76f51', background: ['bg_campfire'] },
    
    SHELTER_INDIVIDUAL: { 
        name: 'Abri Individuel', 
        accessible: true, 
        color: '#fefae0', 
        background: ['bg_shelter_individual'],
        sleepEffect: { sleep: 5, health: 3 }
    },
    
    SHELTER_COLLECTIVE: { 
        name: 'Abri Collectif', 
        accessible: true, 
        color: '#ffffff', 
        background: ['bg_shelter_collective'],
        inventory: {},
        sleepEffect: { sleep: 3, health: 5 }
    },

    MINE: { 
        name: 'Mine', 
        accessible: true,
        color: '#5e503f', 
        background: ['bg_mine'],
        resource: { type: 'Minerai', yield: 1, thirstCost: 1, hungerCost: 3 }
    }
};