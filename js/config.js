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
    MAX_BUILDINGS_PER_TILE: 2, // Nouvelle constante
};

export const COMBAT_CONFIG = {
    PLAYER_UNARMED_DAMAGE: 1,
    FLEE_CHANCE: 0.5,
};

export const ACTION_DURATIONS = {
    HARVEST: 1000, CRAFT: 1500, SLEEP: 3000, MOVE_TRANSITION: 400,
    DIG: 5000,
    SEARCH: 2000, 
    OPEN_TREASURE: 2500,
    BUILD: 3000, // Durée générique pour construire
    USE_BUILDING_ACTION: 1000, // Durée pour actions spécifiques des bâtiments
};

export const ENEMY_TYPES = {
    WOLF: { name: 'Loup Agressif', icon: '🐺', health: 10, damage: 2, color: '#dc2626', aggroRadius: 4, loot: { 'Peau de bête': 1, 'Os': 2, 'Viande crue': 1 } },
    SNAKE: { name: 'Serpent Venimeux', icon: '🐍', health: 6, damage: 3, color: '#16a34a', aggroRadius: 3, loot: { 'Viande crue': 1, 'Venin': 1 } }, // Ajout Venin
    RAT: { name: 'Rat Furtif', icon: '🐀', health: 1, damage: 1, color: '#6b7280', aggroRadius: 1, loot: {} } 
};

export const ORE_TYPES = ['Charbon', 'Cuivre', 'Fer', 'Argent', 'Or', 'Souffre']; // Ajout Souffre

export const ALL_SEARCHABLE_ITEMS = [
    'Feuilles', 'Liane', 'Pierre', 'Sable', 'Insectes', 'Écorce',
    'Os', 'Résine', 'Poisson cru', 'Viande crue', 'Oeuf cru',
    'Banane', 'Noix de coco', 'Sel',
    'Bandage', 'Charbon', 'Sucre', 
    'Composants électroniques', 'Batterie déchargée', 'Médicaments', 'Antiseptiques', 'Allumettes',
    'Clé du Trésor', 
    // Parchemins (seront ajoutés avec leur rareté spécifique plus bas)
];

export const SEARCH_ZONE_CONFIG = {
    FOREST: {
        combatChance: 0.35, 
        noLootChance: 0.15, 
        lootTiers: { common: 0.60, uncommon: 0.25, rare: 0.10, veryRare: 0.08, offTable: 0.01 }, // Ajustement pour veryRare
        enemyType: 'RAT',
        specificLoot: {
            common: ['Feuilles', 'Liane', 'Écorce', 'Insectes', 'Parchemin Atelier Bois_PelleBois', 'Parchemin Atelier Bois_Gourdain', 'Parchemin Atelier BoisFer_Hache'],
            uncommon: ['Os', 'Résine', 'Viande crue', 'Banane', 'Oeuf cru', 'Parchemin Atelier BoisFer_Scie', 'Parchemin Atelier Bois_EpeeBois', 'Parchemin Atelier BoisHamecon_CannePeche'],
            rare: ['Bandage', 'Allumettes', 'Parchemin Atelier Bois_LanceBois', 'Parchemin Atelier Planches_SceauVide'],
            veryRare: ['Médicaments', 'Plan d\'ingénieur', 'Recette médicinale'], // Ajout plans et recettes
            offTable: ['Parchemin Atelier Cuir_Sandalette'] // Exemple de parchemin offtable
        }
    },
    SAND_GOLDEN: {
        combatChance: 0.10,
        noLootChance: 0.25, 
        lootTiers: { common: 0.50, uncommon: 0.30, rare: 0.15, veryRare: 0.08, offTable: 0.01 },
        enemyType: 'RAT', 
        specificLoot: {
            common: ['Sable', 'Pierre', 'Insectes', 'Sel'],
            uncommon: ['Poisson cru', 'Noix de coco', 'Liane', 'Oeuf cru'], 
            rare: ['Composants électroniques', 'Parchemin Atelier Lianes_Ficelle'], 
            veryRare: ['Batterie déchargée', 'Plan d\'ingénieur', 'Recette médicinale'],
            offTable: ['Parchemin Atelier VerreElec_Ecran']
        }
    },
    PLAINS: {
        combatChance: 0.25,
        noLootChance: 0.30, 
        lootTiers: { common: 0.60, uncommon: 0.25, rare: 0.10, veryRare: 0.08, offTable: 0.01 },
        enemyType: 'RAT',
        specificLoot: {
            common: ['Feuilles', 'Pierre', 'Insectes', 'Oeuf cru'],
            uncommon: ['Os', 'Banane', 'Viande crue', 'Parchemin Atelier BoisFer_PelleFer', 'Parchemin Atelier BoisFer_EpeeFer'],
            rare: ['Bandage', 'Parchemin Atelier BoisBriquet_Torche', 'Parchemin Atelier BoisAllumette_Torche', 'Parchemin Atelier BoisLoupe_Torches'],
            veryRare: ['Plan d\'ingénieur', 'Recette médicinale'] ,
            offTable: ['Parchemin Atelier ElecEcran_BatterieDechargee']
        }
    },
    MINE: { 
        combatChance: 0.40,
        noLootChance: 0.10, 
        lootTiers: { common: 0.40, uncommon: 0.30, rare: 0.20, veryRare: 0.08, offTable: 0.02 },
        enemyType: 'SNAKE', 
        specificLoot: {
            common: ['Pierre', 'Os', 'Charbon'],
            uncommon: ['Résine', 'Parchemin Atelier Ficelles_Corde', 'Parchemin Atelier Pierre_BlocTaille'], 
            rare: ['Composants électroniques', 'Batterie déchargée', 'Antiseptiques', 'Parchemin Atelier Feuilles_FeuilleTressee', 'Parchemin Atelier FeuilleTressee_Chapeau'],
            veryRare: ['Clé du Trésor', 'Plan d\'ingénieur', 'Recette médicinale', 'Parchemin Atelier FeuilleTressee_Pagne', 'Parchemin Atelier Sables_Verre'],
            offTable: ['Parchemin Atelier FerOr_PistoletDetresse']
        }
    },
    WASTELAND: { 
        combatChance: 0.15,
        noLootChance: 0.50, 
        lootTiers: { common: 0.70, uncommon: 0.20, rare: 0.05, veryRare: 0.01, offTable: 0.04 }, // offTable plus élevé ici
        enemyType: 'RAT',
        specificLoot: {
            common: ['Pierre', 'Insectes'],
            uncommon: ['Os', 'Sable'],
            rare: ['Parchemin Atelier Verre_Loupe'],
            veryRare: [],
            offTable: ['Parchemin Atelier PlanPlanche_PorteBois', 'Parchemin Atelier PlanOr_Boussole', 'Parchemin Atelier PlanArgent_Sifflet', 'Parchemin Atelier PlanOr_PorteBonheur', 
                       'Parchemin Atelier PlanFer_KitReparation', 'Parchemin Atelier PlanCorde_FiletPeche', 'Parchemin Atelier ElecEcran_PanneauSolaireFixe', 
                       'Parchemin Atelier ElecEcran_PanneauSolairePortable', 'Parchemin Atelier ElecEcran_TelephoneDecharge', 'Parchemin Atelier ElecEcran_RadioDechargee', 'Parchemin Atelier PlanCharbon_FiltreEau']
        }
    }
};


export const ITEM_TYPES = {
    // === RESSOURCES ===
    'Bois': { type: 'resource', icon: '🪵' }, 'Pierre': { type: 'resource', icon: '🪨' },
    'Feuilles': { type: 'resource', icon: '🍃' }, 'Liane': { type: 'resource', icon: '🌿' },
    'Écorce': { type: 'resource', icon: '🟫' }, 'Résine': { type: 'resource', icon: '💧' }, 
    'Sable': { type: 'resource', icon: '⏳' }, 'Peau de bête': { type: 'resource', icon: 'ቆዳ' },
    'Os': { type: 'resource', icon: '🦴' },
    'Poisson cru': { type: 'resource', icon: '🐟' }, 'Sel': { type: 'resource', icon: '🧂' },
    'Sucre': { type: 'resource', icon: '🍬' }, 'Composants électroniques': {type: 'resource', icon: '⚙️'},
    'Charbon': {type: 'resource', icon: '⚫'},
    'Venin': { type: 'resource', icon: '🧪' }, // Ressource drop par serpent
    'Planche': { type: 'resource', icon: '🟧' },
    'Ficelle': { type: 'resource', icon: '〰️' },
    'Corde': { type: 'resource', icon: '🪢' },
    'Bloc taillé': { type: 'resource', icon: '🧱' },
    'Feuille tressée': { type: 'resource', icon: '📜' },
    'Verre': { type: 'resource', icon: '🍸' }, // Ou 🥛
    'Minerai de fer': { type: 'resource', icon: '🔩' },
    'Minerai d\'or': { type: 'resource', icon: '💰' },
    'Minerai d\'argent': { type: 'resource', icon: '🥈' },
    'Souffre': { type: 'resource', icon: '💨' },
    'Fer': { type: 'resource', icon: '쇠' }, // Résultat de forge
    'Or': { type: 'resource', icon: '🥇' }, // Résultat de forge
    'Argent': { type: 'resource', icon: '💍' }, // Résultat de forge
    'Explosif': { type: 'resource', icon: '💥' },
    'Huile de coco': { type: 'resource', icon: '🥥' }, // pour savon
    'Savon': { type: 'resource', icon: '🧼' },
    'Eau croupie': { type: 'resource', icon: '🚱' }, // Depuis puit
    'Hameçon': { type: 'resource', icon: '🪝' }, // Pour canne à pêche
    'Plan d\'ingénieur': { type: 'resource', icon: '📐', rarity: 'veryRare' }, // lootable & craftable
    'Recette médicinale': { type: 'resource', icon: '℞', rarity: 'veryRare' }, // lootable
    'Sceau vide': { type: 'resource', icon: '🪣' },

    // === CONSOMMABLES ===
    'Eau pure': { type: 'consumable', icon: '💧', effects: { thirst: 3 } },
    'Eau salée': { type: 'consumable', icon: '🚱', effects: { thirst: 1, status: { name: 'Malade', chance: 0.5 } } },
    'Insectes': { type: 'consumable', icon: '🦗', effects: { hunger: 1 } },
    'Viande crue': { type: 'consumable', icon: '🥩', effects: { hunger: 1, status: { name: 'Malade', chance: 0.3 } } },
    'Viande cuite': { type: 'consumable', icon: '🍖', effects: { hunger: 3 } },
    'Poisson cuit': { type: 'consumable', icon: '🔥', effects: { hunger: 2 } },
    'Oeuf cru': { type: 'consumable', icon: '🥚', effects: { hunger: 2, status: { name: 'Malade', chance: 0.5 } } },
    'Oeuf cuit': { type: 'consumable', icon: '🍳', effects: { hunger: 3 } },
    'Banane': { type: 'consumable', icon: '🍌', effects: { hunger: 2, thirst: 1 } },
    'Noix de coco': { type: 'consumable', icon: '🥥', effects: { thirst: 3 } },
    'Canne à sucre': { type: 'consumable', icon: '🎋', effects: { hunger: 3, thirst: -1 } },
    'Barre Énergétique': { type: 'consumable', icon: '🍫', effects: { hunger: 6, sleep: 4 } },
    'Médicaments': { type: 'consumable', icon: '💊', effects: { ifStatus: 'Malade', status: 'Normal', health: 5 } },
    'Antiseptiques': { type: 'consumable', icon: '🧴', effects: { ifStatus: 'Empoisonné', status: 'Normal', health: 3 } },
    'Bandage': { type: 'consumable', icon: '🩹', effects: { ifStatus: 'Blessé', status: 'Normal', health: 4 } },
    'Kit de Secours': { type: 'consumable', icon: '✚', effects: { ifStatus: ['Blessé', 'Malade'], status: 'Normal' } },
    'Batterie déchargée': {type: 'consumable', icon: '🔋', effects: {}},
    'Fiole empoisonnée': { type: 'consumable', icon: '☠️', effects: { health: -1000 } }, // Mort instantanée
    'Fiole anti-poison': { type: 'consumable', icon: '🧪', effects: { ifStatus: 'Empoisonné', status: 'Normal', health: 10 } },
    'Drogue': { type: 'consumable', icon: '😵', effects: { health: 10, sleep: 10, hunger: 5, thirst: 5, status: { name: 'Accro', chance: 0.2 } } }, // Status Accro à définir
    'Porte bonheur': { type: 'consumable', icon: '🍀', effects: { custom: 'porteBonheur' } }, // Effet spécial
    
    // Parchemins (considérés comme consommables pour apprendre une recette)
    // Common
    'Parchemin Atelier Bois_PelleBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Pelle en bois', rarity: 'common', description: "Transformer 10 bois = 1 pelle en bois" },
    'Parchemin Atelier Bois_Gourdain': { type: 'consumable', icon: '📜', teachesRecipe: 'Gourdain', rarity: 'common', description: "Transformer 15 bois = 1 gourdain" },
    'Parchemin Atelier BoisFer_Hache': { type: 'consumable', icon: '📜', teachesRecipe: 'Hache', rarity: 'common', description: "Transformer 10 bois et 5 fer = 1 hache" },
    'Parchemin Atelier BoisFer_Scie': { type: 'consumable', icon: '📜', teachesRecipe: 'Scie', rarity: 'common', description: "Transformer 10 bois et 10 fer = 1 scie" },
    'Parchemin Atelier Bois_EpeeBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Épée en bois', rarity: 'common', description: "Transformer 20 bois = 1 épée en bois" },
    'Parchemin Atelier BoisHamecon_CannePeche': { type: 'consumable', icon: '📜', teachesRecipe: 'Canne à pêche', rarity: 'common', description: "Transformer 25 bois + 1 hameçon = 1 canne à pêche" },
    'Parchemin Atelier Bois_LanceBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Lance en bois', rarity: 'common', description: "Transformer 25 bois = 1 lance en bois" },
    'Parchemin Atelier Planches_SceauVide': { type: 'consumable', icon: '📜', teachesRecipe: 'Sceau vide', rarity: 'common', description: "Transformer 5 planches = 1 sceau vide" },
    // Uncommon
    'Parchemin Atelier BoisFer_PelleFer': { type: 'consumable', icon: '📜', teachesRecipe: 'Pelle en fer', rarity: 'uncommon', description: "Transformer 10 bois et 5 fer = 1 pelle en fer" },
    'Parchemin Atelier BoisFer_EpeeFer': { type: 'consumable', icon: '📜', teachesRecipe: 'Épée en fer', rarity: 'uncommon', description: "Transformer 15 bois et 5 fer = 1 épée en fer" },
    'Parchemin Atelier BoisBriquet_Torche': { type: 'consumable', icon: '📜', teachesRecipe: 'Torche (Briquet)', rarity: 'uncommon', description: "Transformer 15 bois et 1 briquet = 1 torche" },
    'Parchemin Atelier BoisAllumette_Torche': { type: 'consumable', icon: '📜', teachesRecipe: 'Torche (Allumette)', rarity: 'uncommon', description: "Transformer 15 bois et 1 allumette = 1 torche" },
    'Parchemin Atelier BoisLoupe_Torches': { type: 'consumable', icon: '📜', teachesRecipe: '5 Torches (Loupe)', rarity: 'uncommon', description: "Transformer 15 bois et 1 loupe = 5 torche" },
    // Rare
    'Parchemin Atelier Lianes_Ficelle': { type: 'consumable', icon: '📜', teachesRecipe: 'Ficelle', rarity: 'rare', description: "Transformer 10 lianes = 1 ficelle" },
    'Parchemin Atelier Ficelles_Corde': { type: 'consumable', icon: '📜', teachesRecipe: 'Corde', rarity: 'rare', description: "Transformer 10 ficelles = 1 Corde" },
    'Parchemin Atelier Pierre_BlocTaille': { type: 'consumable', icon: '📜', teachesRecipe: 'Bloc taillé', rarity: 'rare', description: "Transformer 10 pierre = 1 bloc taillé" },
    'Parchemin Atelier Feuilles_FeuilleTressee': { type: 'consumable', icon: '📜', teachesRecipe: 'Feuille tressée', rarity: 'rare', description: "Transformer 10 feuilles = 1 feuille tressé" },
    'Parchemin Atelier FeuilleTressee_Chapeau': { type: 'consumable', icon: '📜', teachesRecipe: 'Chapeau feuillu', rarity: 'rare', description: "Transformer 10 feuille tressé = 1 Chapeau feuillu" },
    'Parchemin Atelier FeuilleTressee_Pagne': { type: 'consumable', icon: '📜', teachesRecipe: 'Pagne feuillu', rarity: 'rare', description: "Transformer 20 feuille tressé = 1 pagne feuillu" },
    'Parchemin Atelier Cuir_Sandalette': { type: 'consumable', icon: '📜', teachesRecipe: 'Sandalette', rarity: 'rare', description: "Transformer 10 Peau de bête = 1 paire de sandalette" }, // Cuir -> Peau de bête
    'Parchemin Atelier Sables_Verre': { type: 'consumable', icon: '📜', teachesRecipe: 'Verre', rarity: 'rare', description: "Transformer 10 sables = 1 verre" },
    'Parchemin Atelier Verre_Loupe': { type: 'consumable', icon: '📜', teachesRecipe: 'Loupe', rarity: 'rare', description: "Transformer 10 verre = 1 loupe" },
    // Very Rare
    'Parchemin Atelier PlanPlanche_PorteBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Porte en bois', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 10 planche = 1 Porte en bois" },
    'Parchemin Atelier PlanOr_Boussole': { type: 'consumable', icon: '📜', teachesRecipe: 'Boussole', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 or = 1 boussole" },
    'Parchemin Atelier PlanArgent_Sifflet': { type: 'consumable', icon: '📜', teachesRecipe: 'Sifflet', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 argent = 1 sifflet" },
    'Parchemin Atelier PlanOr_PorteBonheur': { type: 'consumable', icon: '📜', teachesRecipe: 'Porte bonheur (craft)', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 or = Porte bonheur" },
    'Parchemin Atelier PlanFer_KitReparation': { type: 'consumable', icon: '📜', teachesRecipe: 'Kit de réparation', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 30 fer = 1 kit de réparation" },
    'Parchemin Atelier PlanCorde_FiletPeche': { type: 'consumable', icon: '📜', teachesRecipe: 'Filet de pêche', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 10 corde = 1 Filet de pêche" },
    'Parchemin Atelier VerreElec_Ecran': { type: 'consumable', icon: '📜', teachesRecipe: 'Écran électronique', rarity: 'veryRare', description: "Transformer 10 verre et 10 composant électronique = 1 écran electronique" },
    // Offtable
    'Parchemin Atelier ElecEcran_BatterieDechargee': { type: 'consumable', icon: '📜', teachesRecipe: 'Batterie déchargée (craft)', rarity: 'offtable', description: "Transformer 20 composants electronique et 1 écran éléctronique = 1 batterie déchargé" },
    'Parchemin Atelier FerOr_PistoletDetresse': { type: 'consumable', icon: '📜', teachesRecipe: 'Pistolet de détresse (craft)', rarity: 'offtable', description: "Transformer 45 fer 5 or = pistolet de détresse" },
    'Parchemin Atelier ElecEcran_PanneauSolaireFixe': { type: 'consumable', icon: '📜', teachesRecipe: 'Panneau solaire fixe', rarity: 'offtable', description: "Transformer 40 composants electronique et 1 écran éléctronique = 1 panneau solaire fixe" },
    'Parchemin Atelier ElecEcran_PanneauSolairePortable': { type: 'consumable', icon: '📜', teachesRecipe: 'Panneau solaire portable', rarity: 'offtable', description: "Transformer 20 composants electronique et 1 écran éléctronique = 1 panneau solaire portable" },
    'Parchemin Atelier ElecEcran_TelephoneDecharge': { type: 'consumable', icon: '📜', teachesRecipe: 'Téléphone déchargé', rarity: 'offtable', description: "Transformer 5 composants electronique et 1 écran éléctronique = 1 téléphone déchargé" },
    'Parchemin Atelier ElecEcran_RadioDechargee': { type: 'consumable', icon: '📜', teachesRecipe: 'Radio déchargée', rarity: 'offtable', description: "Transformer 15 composants electronique et 5 écran éléctronique = 1 radio déchargé" },
    'Parchemin Atelier PlanCharbon_FiltreEau': { type: 'consumable', icon: '📜', teachesRecipe: 'Filtre à eau (craft)', rarity: 'offtable', description: "Transformer 1 plan d'ingénieur et 50 charbon = 1 filtre à eau" },


    // === OUTILS & ARMES ===
    'Hache': { type: 'tool', slot: 'weapon', icon: '🪓', durability: 10, power: 5, action: 'harvest_wood' },
    'Scie': { type: 'tool', slot: 'weapon', icon: '🪚', durability: 10, power: 10, action: 'harvest_wood' },
    'Pelle en bois': { type: 'tool', slot: 'weapon', icon: '🦯', durability: 3, power: 1, action: 'dig' }, // Action 'dig' à définir
    'Pelle en fer': { type: 'tool', slot: 'weapon', icon: '⛏️', durability: 10, power: 3, action: 'dig' }, // Action 'dig' à définir
    'Canne à pêche': { type: 'tool', slot: 'weapon', icon: '🎣', durability: 10, power: 1, action: 'fish' },
    'Filtre à eau': { type: 'tool', icon: '⚗️', durability: 10, action: 'purify_water' }, // Peut-être slot: 'tool_belt' ?
    'Gourdain': { type: 'weapon', slot: 'weapon', icon: '🏏', durability: 5, stats: { damage: 2 } },
    'Lance en bois': { type: 'weapon', slot: 'weapon', icon: '🍢', durability: 8, stats: { damage: 4 } },
    'Épée en bois': { type: 'weapon', slot: 'weapon', icon: '🗡️', durability: 3, stats: { damage: 3 }, pvpEffects: [{ name: 'Blessé', chance: 0.5 }, { name: 'Mort', chance: 0.05 }] },
    'Épée en fer': { type: 'weapon', slot: 'weapon', icon: '⚔️', durability: 10, stats: { damage: 6 }, pvpEffects: [{ name: 'Blessé', chance: 0.5 }, { name: 'Mort', chance: 0.05 }] },
    'Bouclier en bois': {type: 'armor', slot: 'body', icon: '🛡️', durability: 10, stats: {defense: 2}},
    'Bouclier en fer': {type: 'armor', slot: 'body', icon: '🛡️', durability: 20, stats: {defense: 4}},
    'Kit de réparation': { type: 'tool', icon: '🛠️', action: 'repair_building', durability: 1 }, // Action à définir
    'Filet de pêche': { type: 'tool', icon: '🥅', action: 'net_fish', durability: 15 }, // Action à définir
    
    // === ÉQUIPEMENT ===
    'Vêtements': { type: 'body', slot: 'body', icon: '👕', stats: { maxHealth: 2 } },
    'Chaussures': { type: 'feet', slot: 'feet', icon: '👟', stats: { maxSleep: 2 } },
    'Chapeau': { type: 'head', slot: 'head', icon: '👒', stats: { maxThirst: 2 } },
    'Chapeau feuillu': { type: 'head', slot: 'head', icon: '🌿', stats: { maxThirst: 1, defense: 1 }, durability: 10 },
    'Pagne feuillu': { type: 'body', slot: 'body', icon: '🌿', stats: { defense: 2 }, durability: 15 },
    'Sandalette': { type: 'feet', slot: 'feet', icon: '👣', stats: { maxSleep: 1 }, durability: 10 },
    'Petit Sac': { type: 'bag', slot: 'bag', icon: '🎒', stats: { maxInventory: 50 } },
    'Grand Sac': { type: 'bag', slot: 'bag', icon: '🛍️', stats: { maxInventory: 150 } },
    'Loupe': { type: 'tool', slot: 'tool_belt', icon: '🔍', action: 'start_fire_loupe', durability: 5 }, // Emplacement à définir si besoin (tool_belt?)

    // === DIVERS (utilisables non-consommables directs) ===
    'Boussole': {type: 'usable', icon: '🧭', action: 'find_mine'}, // Action reste générique
    'Sifflet': { type: 'usable', icon: '😗', action: 'attract_npc_attention' }, // Action à définir
    'Carte': {type: 'usable', icon: '🗺️', action: 'reveal_map'},
    'Allumettes': {type: 'usable', icon: '🔥', durability: 1, isFireStarter: true },
    'Briquet': { type: 'usable', icon: '🔥', durability: 5, isFireStarter: true },
    'Torche': { type: 'usable', icon: '🔦', durability: 10, isFireStarter: true, slot: 'weapon', stats: { damage: 1 } }, // Peut aussi être une arme
    'Pistolet de détresse': { type: 'usable', icon: '🔫', durability: 2, action: 'fire_distress_gun' }, // Action à définir
    'Fusée de détresse': { type: 'usable', icon: '🧨', durability: 1, action: 'fire_distress_flare' }, // Action à définir
    'Clé du Trésor': { type: 'key', icon: '🔑', unique: true },
    'Porte en bois': { type: 'component', icon: '🚪' }, // Composant pour bâtiments
    'Panneau solaire fixe': { type: 'usable_placeable', icon: '☀️', action: 'place_solar_panel_fixed' }, // Type pour objets à placer
    'Panneau solaire portable': { type: 'tool', icon: '🌞', action: 'charge_battery_portable_solar' },
    'Téléphone déchargé': { type: 'usable', icon: '📱', action: 'attempt_call_if_charged' },
    'Radio déchargée': { type: 'usable', icon: '📻', action: 'listen_radio_if_charged' },
    'Piège': { type: 'usable_placeable', icon: '🪤', action: 'place_trap' },
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
    bg_treasure_chest: 'assets/bg_treasure_chest.png', 
    // Ajouter les backgrounds pour les nouveaux bâtiments ici si nécessaire
    // bg_atelier: 'assets/bg_atelier.png',
    // bg_petit_puit: 'assets/bg_petit_puit.png', etc.
};

export const TILE_TYPES = {
    // Terrains Naturels
    WATER_LAGOON: { name: 'Lagon', accessible: false, color: '#48cae4', background: ['bg_sand_1'], resource: { type: 'Eau salée', yield: 1 }, harvests: Infinity },
    SAND_GOLDEN: { name: 'Sable Doré', accessible: true, color: '#f4d35e', background: ['bg_sand_2'], resource: { type: 'Sable', yield: 5 }, harvests: 20 },
    FOREST: { name: 'Forêt', resource: { type: 'Bois', yield: 5, thirstCost: 1, hungerCost: 1, sleepCost: 1 }, harvests: 10, accessible: true, color: '#2d6a4f', background: ['bg_forest_1'] },
    WASTELAND: { name: 'Friche', accessible: true, color: '#9c6644', background: ['bg_wasteland_1'], regeneration: { cost: { 'Eau pure': 5 }, target: 'FOREST' } },
    PLAINS: { name: 'Plaine', accessible: true, color: '#80b918', background: ['bg_plains_1'], buildable: true }, // Plaine est constructible
    STONE_DEPOSIT: { name: 'Gisement de Pierre', accessible: true, color: '#8d99ae', background: ['bg_stone_1'], resource: { type: 'Pierre', yield: 3 }, harvests: 15 },
    
    // Structures de base (déjà existantes, modifiées)
    CAMPFIRE: { name: 'Feu de Camp', accessible: true, color: '#e76f51', background: ['bg_campfire'], isBuilding: true, durability: 10 }, // Ajout durabilité
    SHELTER_INDIVIDUAL: { 
        name: 'Abri Individuel', accessible: true, color: '#fefae0', 
        background: ['bg_shelter_individual'], 
        sleepEffect: { sleep: 8, health: 3 }, 
        inventory: {}, maxInventory: 50, durability: 20, isBuilding: true,
        cost: { 'Bois': 20 }
    },
    SHELTER_COLLECTIVE: { 
        name: 'Abri Collectif', accessible: true, color: '#ffffff', 
        background: ['bg_shelter_collective'], 
        inventory: {}, maxInventory: 500, durability: 100,
        sleepEffect: { sleep: 8, health: 5 }, isBuilding: true,
        cost: { 'Bois': 600, 'Pierre': 150 }
    },
    MINE: { // Mine devient un bâtiment constructible
        name: 'Mine', accessible: true, color: '#5e503f', background: ['bg_mine'], 
        isBuilding: true, durability: 20,
        cost: { 'Bois': 20, 'toolRequired': ['Pelle en fer', 'Pelle en bois'] }, // Outil requis pour construire
        action: { id: 'search_ore', name: 'Chercher du Minerai', results: [
            { item: 'Minerai d\'or', chance: 0.001 },   // 0.1%
            { item: 'Minerai d\'argent', chance: 0.01 }, // 1%
            { item: 'Souffre', chance: 0.05 },           // 5%
            { item: 'Minerai de fer', chance: 0.20 },    // 20%
            { item: 'Charbon', chance: 0.50 },           // 50%
            // Le reste (23.9%) est "Rien"
        ]}
    },
    TREASURE_CHEST: { 
        name: 'Trésor Caché', accessible: true, color: '#DAA520', 
        background: ['bg_treasure_chest'], icon: '💎', 
        requiresKey: 'Clé du Trésor'
    },

    // Nouveaux Bâtiments
    ATELIER: {
        name: 'Atelier', accessible: true, color: '#a0522d', background: ['bg_plains_2'], // Placeholder background
        isBuilding: true, durability: 200,
        cost: { 'Bois': 30, 'Plan d\'ingénieur': 1 },
        action: { id: 'use_atelier', name: 'Utiliser Atelier' } // Logique d'UI complexe non implémentée ici
    },
    PETIT_PUIT: {
        name: 'Petit Puit', accessible: true, color: '#add8e6', background: ['bg_plains_3'], // Placeholder
        isBuilding: true, durability: 5,
        cost: { 'Pierre': 50, 'toolRequired': ['Pelle en bois', 'Pelle en fer'] },
        action: { id: 'draw_water_shallow_well', name: 'Puiser Eau (croupie)', result: { 'Eau croupie': 2 } }
    },
    PUIT_PROFOND: {
        name: 'Puit Profond', accessible: true, color: '#87ceeb', background: ['bg_plains_4'], // Placeholder
        isBuilding: true, durability: 20,
        cost: { 'Bloc taillé': 20, 'Sceau vide': 1, 'toolRequired': ['Pelle en fer'] },
        action: { id: 'draw_water_deep_well', name: 'Puiser Eau (croupie)', result: { 'Eau croupie': 4 } }
    },
    BIBLIOTHEQUE: {
        name: 'Bibliothèque', accessible: true, color: '#deb887', background: ['bg_plains_1'], // Placeholder
        isBuilding: true, durability: 100,
        cost: { 'Bloc taillé': 40, 'Porte en bois': 2 }, // Assumant Porte en bois
        action: { id: 'generate_plan', name: 'Rechercher Plan (5h)', result: { 'Plan d\'ingénieur': 1 }, intervalHours: 5 }
    },
    FORTERESSE: {
        name: 'Forteresse', accessible: true, color: '#696969', background: ['bg_shelter_collective'], // Placeholder
        isBuilding: true, durability: 500,
        cost: { 'Bloc taillé': 96, 'Porte en bois': 4 }, // Assumant Porte en bois, Pierre non défini
        sleepEffect: { sleep: 16, health: 10 }, // +2 par heure sur 8h
        inventory: {}, maxInventory: 1000,
    },
    LABORATOIRE: {
        name: 'Laboratoire', accessible: true, color: '#e0ffff', background: ['bg_plains_2'], // Placeholder
        isBuilding: true, durability: 200,
        cost: { 'Bloc taillé': 65, 'Kit de Secours': 5 },
        action: { id: 'use_laboratoire', name: 'Utiliser Laboratoire' } // UI complexe
    },
    FORGE: {
        name: 'Forge', accessible: true, color: '#d2691e', background: ['bg_plains_3'], // Placeholder
        isBuilding: true, durability: 200,
        cost: { 'Fer': 50, 'Porte en bois': 2 },
        action: { id: 'use_forge', name: 'Utiliser Forge' } // UI complexe
    },
    BANANERAIE: {
        name: 'Bananeraie', accessible: true, color: '#ffffe0', background: ['bg_plains_4'], // Placeholder
        isBuilding: true, durability: 80,
        cost: { 'Planche': 50, 'Eau pure': 20 },
        actions: [ // Peut avoir plusieurs actions
            { id: 'water_bananeraie', name: 'Arroser (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 },
            { id: 'harvest_bananeraie', name: 'Récolter Bananes', result: { 'Banane': 3 } }
        ]
    },
    SUCRERIE: { // Canne à sucre
        name: 'Sucrerie', accessible: true, color: '#fafad2', background: ['bg_plains_1'], // Placeholder
        isBuilding: true, durability: 80,
        cost: { 'Planche': 50, 'Eau pure': 20 },
        actions: [
            { id: 'water_sucrerie', name: 'Arroser (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 },
            { id: 'harvest_sucrerie', name: 'Récolter Cannes', result: { 'Canne à sucre': 3 } }
        ]
    },
    COCOTERAIE: {
        name: 'Cocoteraie', accessible: true, color: '#fff8dc', background: ['bg_plains_2'], // Placeholder
        isBuilding: true, durability: 80,
        cost: { 'Planche': 50, 'Eau pure': 20 },
        actions: [
            { id: 'water_cocoteraie', name: 'Arroser (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 },
            { id: 'harvest_cocoteraie', name: 'Récolter Noix de Coco', result: { 'Noix de coco': 3 } }
        ]
    },
    POULAILLER: {
        name: 'Poulailler', accessible: true, color: '#fffacd', background: ['bg_plains_3'], // Placeholder
        isBuilding: true, durability: 80,
        cost: { 'Planche': 50, 'Eau pure': 20 }, // Assumant eau pure pour abreuver
        actions: [
            { id: 'water_poulailler', name: 'Abreuver (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 },
            { id: 'harvest_poulailler', name: 'Récolter Oeufs', result: { 'Oeuf cru': 3 } }
        ]
    },
    ENCLOS_COCHONS: {
        name: 'Enclos à Cochons', accessible: true, color: '#ffebcd', background: ['bg_plains_4'], // Placeholder
        isBuilding: true, durability: 80,
        cost: { 'Planche': 50, 'Eau pure': 20 },
        actions: [
            { id: 'water_enclos_cochons', name: 'Abreuver (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 },
            { id: 'harvest_enclos_cochons', name: 'Récolter Viande', result: { 'Viande crue': 3 } }
        ]
    },
    OBSERVATOIRE: { // Anciennement Tour de Guet
        name: 'Observatoire', accessible: true, color: '#f5f5dc', background: ['bg_plains_1'], // Placeholder
        isBuilding: true, durability: 20,
        cost: { 'Planche': 50, 'Porte en bois': 1 },
        action: { id: 'observe_weather', name: 'Observer (Prochaine catastrophe)' } // Logique spécifique
    },
};

// Ajouter tous les parchemins à ALL_SEARCHABLE_ITEMS
for (const itemName in ITEM_TYPES) {
    if (itemName.startsWith('Parchemin Atelier')) {
        ALL_SEARCHABLE_ITEMS.push(itemName);
    }
}