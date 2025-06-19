// js/config.js

export const CONFIG = {
    MAP_WIDTH: 20, MAP_HEIGHT: 20, TILE_SIZE: 192, MINIMAP_DOT_SIZE: 8,
    NUM_NPCS: 4, 
    NPC_BASE_HEALTH: 8,
    NPC_BASE_DAMAGE: 1,
    NPC_AGGRO_RADIUS: 3, 
    INITIAL_ENEMIES: 1, MAX_ENEMIES: 6, ENEMY_SPAWN_CHECK_DAYS: 3,
    DAY_DURATION_MS: 120000, STAT_DECAY_INTERVAL_MS: 5000,
    NPC_ACTION_INTERVAL_MS: 3000, CHAT_MESSAGE_INTERVAL_MS: 25000,
    PLAYER_BASE_MAX_RESOURCES: 50, 
};

export const COMBAT_CONFIG = {
    PLAYER_UNARMED_DAMAGE: 1,
    FLEE_CHANCE: 0.5,
};

export const ACTION_DURATIONS = {
    HARVEST: 1000, CRAFT: 1500, SLEEP: 3000, MOVE_TRANSITION: 400,
    DIG: 5000,
    SEARCH: 2000, 
    OPEN_TREASURE: 2500, // Ajout d'une durée spécifique pour ouvrir le trésor
};

export const ENEMY_TYPES = {
    WOLF: { name: 'Loup Agressif', icon: '🐺', health: 10, damage: 2, color: '#dc2626', aggroRadius: 4, loot: { 'Peau de bête': 1, 'Os': 2, 'Viande crue': 1 } },
    SNAKE: { name: 'Serpent Venimeux', icon: '🐍', health: 6, damage: 3, color: '#16a34a', aggroRadius: 3, loot: { 'Viande crue': 1 } },
    RAT: { name: 'Rat Furtif', icon: '🐀', health: 1, damage: 1, color: '#6b7280', aggroRadius: 1, loot: {} } 
};

export const ORE_TYPES = ['Charbon', 'Cuivre', 'Fer', 'Argent', 'Or'];

export const SEARCHABLE_ITEMS = [
    'Feuilles', 'Liane', 'Écorce', 'Résine', 'Pierre', 
    'Insectes', 
    'Os', 
    'Banane', 'Noix de coco', 
    'Bandage', 
    'Composants électroniques', 'Pile'
    // Vous pourriez ajouter 'Clé du Trésor' ici avec une très faible probabilité si vous voulez qu'elle soit trouvable en fouillant en plus.
];

export const SEARCH_ZONE_CONFIG = {
    FOREST: { 
        combatChance: 0.40, 
        itemChance: 0.50,   
        enemyType: 'RAT',   
        possibleLoot: ['Feuilles', 'Liane', 'Écorce', 'Insectes', 'Os', 'Banane'] 
    },
    SAND_GOLDEN: { 
        combatChance: 0.10,
        itemChance: 0.60,   
        enemyType: 'RAT',
        possibleLoot: ['Sable', 'Pierre', 'Noix de coco', 'Insectes', 'Sel']
    },
    PLAINS: { 
        combatChance: 0.30,
        itemChance: 0.40,   
        enemyType: 'RAT',
        possibleLoot: ['Feuilles', 'Pierre', 'Insectes', 'Os', 'Banane']
    },
    MINE: { 
        combatChance: 0.30,
        itemChance: 0.50,   
        enemyType: 'RAT', 
        possibleLoot: ['Pierre', 'Os', 'Charbon', 'Composants électroniques', 'Pile'] 
    },
};


export const ITEM_TYPES = {
    // === RESSOURCES ===
    'Bois': { type: 'resource', icon: '🪵' }, 'Pierre': { type: 'resource', icon: '🪨' },
    'Feuilles': { type: 'resource', icon: '🍃' }, 'Liane': { type: 'resource', icon: '🌿' },
    'Écorce': { type: 'resource', icon: '🟫' }, 'Résine': { type: 'resource', icon: '💧' }, 
    'Sable': { type: 'resource', icon: '⏳' }, 'Peau de bête': { type: 'resource', icon: '🟤' },
    'Os': { type: 'resource', icon: '🦴' }, 'Viande crue': { type: 'resource', icon: '🥩' },
    'Poisson cru': { type: 'resource', icon: '🐟' }, 'Sel': { type: 'resource', icon: '🧂' },
    'Sucre': { type: 'resource', icon: '🍬' }, 'Composants électroniques': {type: 'resource', icon: '⚙️'},
    'Charbon': {type: 'resource', icon: '⚫'}, 

    // === CONSOMMABLES ===
    'Eau pure': { type: 'consumable', icon: '💧', effects: { thirst: 3 } },
    'Eau salée': { type: 'consumable', icon: '🚱', effects: { thirst: 1, status: { name: 'Malade', chance: 0.5 } } },
    'Insectes': { type: 'consumable', icon: '🦗', effects: { hunger: 1 } },
    'Viande cuite': { type: 'consumable', icon: '🍖', effects: { hunger: 3 } },
    'Poisson cuit': { type: 'consumable', icon: '🔥', effects: { hunger: 2 } },
    'Banane': { type: 'consumable', icon: '🍌', effects: { hunger: 2, thirst: 1 } },
    'Noix de coco': { type: 'consumable', icon: '🥥', effects: { thirst: 3 } },
    'Canne à sucre': { type: 'consumable', icon: '🎋', effects: { hunger: 3, thirst: -1 } },
    'Barre Énergétique': { type: 'consumable', icon: '🍫', effects: { hunger: 6, sleep: 4 } },
    'Médicaments': { type: 'consumable', icon: '💊', effects: { ifStatus: 'Malade', status: 'Normal', health: 5 } },
    'Antiseptiques': { type: 'consumable', icon: '🧴', effects: { ifStatus: 'Empoisonné', status: 'Normal', health: 3 } },
    'Bandage': { type: 'consumable', icon: '🩹', effects: { ifStatus: 'Blessé', status: 'Normal', health: 4 } },
    'Kit de Secours': { type: 'consumable', icon: '✚', effects: { ifStatus: ['Blessé', 'Malade'], status: 'Normal' } },
    'Pile': {type: 'consumable', icon: '🔋', effects: {}}, 

    // === OUTILS & ARMES ===
    'Hache': { type: 'tool', slot: 'weapon', icon: '🪓', durability: 10, power: 5, action: 'harvest_wood' },
    'Scie': { type: 'tool', slot: 'weapon', icon: '🪚', durability: 10, power: 10, action: 'harvest_wood' },
    'Canne à pêche': { type: 'tool', slot: 'weapon', icon: '🎣', durability: 10, power: 1, action: 'fish' },
    'Filtre à eau': { type: 'tool', icon: '⚗️', durability: 10, action: 'purify_water' },
    'Épée en bois': { type: 'weapon', slot: 'weapon', icon: '🗡️', durability: 3, stats: { damage: 3 }, pvpEffects: [{ name: 'Blessé', chance: 0.5 }, { name: 'Mort', chance: 0.05 }] },
    'Épée en fer': { type: 'weapon', slot: 'weapon', icon: '⚔️', durability: 10, stats: { damage: 6 }, pvpEffects: [{ name: 'Blessé', chance: 0.5 }, { name: 'Mort', chance: 0.05 }] },
    'Bouclier en bois': {type: 'armor', slot: 'body', icon: '🛡️', durability: 10, stats: {defense: 2}},
    'Bouclier en fer': {type: 'armor', slot: 'body', icon: '🛡️', durability: 20, stats: {defense: 4}},
    
    // === ÉQUIPEMENT ===
    'Vêtements': { type: 'body', slot: 'body', icon: '👕', stats: { maxHealth: 2 } },
    'Chaussures': { type: 'feet', slot: 'feet', icon: '👟', stats: { maxSleep: 2 } },
    'Chapeau': { type: 'head', slot: 'head', icon: '👒', stats: { maxThirst: 2 } },
    'Petit Sac': { type: 'bag', slot: 'bag', icon: '🎒', stats: { maxInventory: 50 } },
    'Grand Sac': { type: 'bag', slot: 'bag', icon: '🛍️', stats: { maxInventory: 150 } },

    // === DIVERS ===
    'Boussole': {type: 'usable', icon: '🧭', action: 'find_mine'},
    'Carte': {type: 'usable', icon: '🗺️', action: 'reveal_map'},
    'Allumettes': {type: 'usable', icon: '🔥', durability: 5, action: 'build_campfire'},
    'Clé du Trésor': { type: 'key', icon: '🔑', unique: true } 
};

export const TREASURE_COMBAT_KIT = {
    'Épée en fer': 1,
    'Bouclier en fer': 1,
    'Kit de Secours': 3,
    'Barre Énergétique': 5
};

export const SPRITESHEET_PATHS = {
    bg_forest_1: 'assets/bg_forest_1.png', bg_forest_2: 'assets/bg_forest_2.png', bg_forest_3: 'assets/bg_forest_3.png', bg_forest_4: 'assets/bg_forest_4.png',
    bg_plains_1: 'assets/bg_plains_1.png', bg_plains_2: 'assets/bg_plains_2.png', bg_plains_3: 'assets/bg_plains_3.png', bg_plains_4: 'assets/bg_plains_4.png',
    bg_sand_1: 'assets/bg_sand_1.png', bg_sand_2: 'assets/bg_sand_2.png', bg_sand_3: 'assets/bg_sand_3.png', bg_sand_4: 'assets/bg_sand_4.png',
    bg_wasteland_1: 'assets/bg_wasteland_1.png', bg_wasteland_2: 'assets/bg_wasteland_2.png', bg_wasteland_3: 'assets/bg_wasteland_3.png', bg_wasteland_4: 'assets/bg_wasteland_4.png',
    bg_stone_1: 'assets/bg_stone_1.png',
    bg_stone_2: 'assets/bg_stone_2.png',
    bg_shelter_individual: 'assets/bg_shelter_individual.png',
    bg_shelter_collective: 'assets/bg_shelter_collective.png',
    bg_campfire: 'assets/bg_campfire.png',
    bg_mine: 'assets/bg_mine.png',
    // Ajoutez une image pour le trésor si vous en avez une, sinon il utilisera un fond de sable
    // bg_treasure_chest: 'assets/bg_treasure_chest.png', 
};

export const TILE_TYPES = {
    WATER_LAGOON: { name: 'Lagon', accessible: false, color: '#48cae4', background: ['bg_sand_1', 'bg_sand_2', 'bg_sand_3', 'bg_sand_4'], resource: { type: 'Eau salée', yield: 1 }, harvests: Infinity },
    SAND_GOLDEN: { name: 'Sable Doré', accessible: true, color: '#f4d35e', background: ['bg_sand_1', 'bg_sand_2', 'bg_sand_3', 'bg_sand_4'], resource: { type: 'Sable', yield: 5 }, harvests: 20 },
    FOREST: { name: 'Forêt', resource: { type: 'Bois', yield: 5, thirstCost: 1, hungerCost: 1, sleepCost: 1 }, harvests: 10, accessible: true, color: '#2d6a4f', background: ['bg_forest_1', 'bg_forest_2', 'bg_forest_3', 'bg_forest_4'] },
    WASTELAND: { name: 'Friche', accessible: true, color: '#9c6644', background: ['bg_wasteland_1', 'bg_wasteland_2', 'bg_wasteland_3', 'bg_wasteland_4'], regeneration: { cost: { 'Eau pure': 5 }, target: 'FOREST' } },
    PLAINS: { name: 'Plaine', accessible: true, color: '#80b918', background: ['bg_plains_1', 'bg_plains_2', 'bg_plains_3', 'bg_plains_4'] },
    STONE_DEPOSIT: { name: 'Gisement de Pierre', accessible: true, color: '#8d99ae', background: ['bg_stone_1', 'bg_stone_2'], resource: { type: 'Pierre', yield: 3 }, harvests: 15 },
    CAMPFIRE: { name: 'Feu de Camp', accessible: true, color: '#e76f51', background: ['bg_campfire'] },
    SHELTER_INDIVIDUAL: { name: 'Abri Individuel', accessible: true, color: '#fefae0', background: ['bg_shelter_individual'], sleepEffect: { sleep: 5, health: 3 } },
    SHELTER_COLLECTIVE: { name: 'Abri Collectif', accessible: true, color: '#ffffff', background: ['bg_shelter_collective'], inventory: {}, sleepEffect: { sleep: 3, health: 5 } },
    MINE: { name: 'Mine', accessible: true, color: '#5e503f', background: ['bg_mine'], resource: { type: 'Minerai', yield: 1, thirstCost: 1, hungerCost: 1, sleepCost: 2 } },
    TREASURE_CHEST: { 
        name: 'Trésor Caché', 
        accessible: true, 
        color: '#DAA520', 
        background: ['bg_sand_1'], // Fallback, idéalement sa propre image de fond
        icon: '💎', 
        // isOpened: false, // Sera géré par l'instance de la tuile sur la carte
        requiresKey: 'Clé du Trésor'
    }
};