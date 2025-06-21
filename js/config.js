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
    MAX_BUILDINGS_PER_TILE: 1, // MODIFIÉ (Point 21)
    FOG_OF_WAR_REVEAL_THRESHOLD: 5,
};

export const COMBAT_CONFIG = {
    PLAYER_UNARMED_DAMAGE: 1,
    FLEE_CHANCE: 0.5,
};

export const ACTION_DURATIONS = {
    HARVEST: 1000, CRAFT: 1000, SLEEP: 1000, MOVE_TRANSITION: 200,
    DIG: 1000,
    SEARCH: 1000,
    OPEN_TREASURE: 1000,
    BUILD: 1000, 
    USE_BUILDING_ACTION: 1000, 
    PLANT_TREE: 2500, // MODIFIÉ (Point 8)
    USE_MAP: 500,
};

export const ENEMY_TYPES = {
    WOLF: { name: 'Loup Agressif', icon: '🐺', health: 10, damage: 2, color: '#dc2626', aggroRadius: 4, loot: { 'Peau de bête': 1, 'Os': 2, 'Viande crue': 1 } },
    SNAKE: { name: 'Serpent Venimeux', icon: '🐍', health: 6, damage: 3, color: '#16a34a', aggroRadius: 3, loot: { 'Viande crue': 1, 'Venin': 1 } },
    RAT: { name: 'Rat Furtif', icon: '🐀', health: 1, damage: 1, color: '#6b7280', aggroRadius: 1, loot: {} }
};

export const ORE_TYPES = ['Charbon', 'Cuivre', 'Fer', 'Argent', 'Or', 'Souffre'];

export const ALL_SEARCHABLE_ITEMS = [
    'Feuilles', 'Liane', 'Pierre', 'Sable', 'Insectes', 'Écorce',
    'Os', 'Résine', 'Poisson cru', 'Viande crue', 'Oeuf cru',
    'Banane', 'Noix de coco', 'Sel',
    'Bandage', 'Charbon', 'Sucre',
    'Composants électroniques', 'Batterie déchargée', 'Médicaments', 'Antiseptiques', 'Allumettes',
    'Clé du Trésor', 'Graine d\'arbre', 'Carte',
];

export const SEARCH_ZONE_CONFIG = {
    FOREST: {
        combatChance: 0.20, 
        noLootChance: 0.15,
        lootTiers: { common: 0.60, uncommon: 0.25, rare: 0.10, veryRare: 0.08, offTable: 0.01 },
        enemyType: 'RAT',
        specificLoot: {
            common: ['Feuilles', 'Liane', 'Écorce', 'Insectes', 'Parchemin Atelier Bois_PelleBois', 'Parchemin Atelier Bois_Gourdain', 'Parchemin Atelier BoisFer_Hache', 'Parchemin Atelier Bois_Etabli'],
            uncommon: ['Os', 'Résine', 'Viande crue', 'Banane', 'Oeuf cru', 'Parchemin Atelier BoisFer_Scie', 'Parchemin Atelier Bois_EpeeBois', 'Parchemin Atelier BoisHamecon_CannePeche', 'Graine d\'arbre'],
            rare: ['Bandage', 'Allumettes', 'Parchemin Atelier Bois_LanceBois', 'Parchemin Atelier Planches_SceauVide'],
            veryRare: ['Médicaments', 'Plan d\'ingénieur', 'Recette médicinale'],
            offTable: ['Parchemin Atelier Cuir_Sandalette']
        }
    },
    PLAGE: { 
        combatChance: 0.10,
        noLootChance: 0.25,
        lootTiers: { common: 0.50, uncommon: 0.30, rare: 0.15, veryRare: 0.08, offTable: 0.01 },
        enemyType: 'RAT',
        specificLoot: {
            common: ['Sable', 'Pierre', 'Insectes', 'Sel'],
            uncommon: ['Poisson cru', 'Noix de coco', 'Liane', 'Oeuf cru', 'Carte'],
            rare: ['Composants électroniques', 'Parchemin Atelier Lianes_Ficelle'],
            veryRare: ['Batterie déchargée', 'Plan d\'ingénieur', 'Recette médicinale'],
            offTable: ['Parchemin Atelier VerreElec_Ecran']
        }
    },
    PLAINS: {
        combatChance: 0.15,
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
        combatChance: 0.20,
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
        noLootChance: 0.30,
        lootTiers: { common: 0.70, uncommon: 0.20, rare: 0.05, veryRare: 0.01, offTable: 0.04 },
        enemyType: 'RAT',
        specificLoot: {
            common: ['Pierre', 'Insectes'],
            uncommon: ['Os', 'Sable'],
            rare: ['Parchemin Atelier Verre_Loupe', 'Carte'],
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
    'Sel': { type: 'consumable', icon: '🧂', effects: { hunger: 5, thirst: -2 } }, // MODIFIÉ (Point 17)
    'Composants électroniques': {type: 'resource', icon: '⚙️'},
    'Charbon': {type: 'resource', icon: '⚫'},
    'Planche': { type: 'resource', icon: '🟧' },
    'Ficelle': { type: 'resource', icon: '〰️' },
    'Corde': { type: 'resource', icon: '🪢' },
    'Bloc taillé': { type: 'resource', icon: '🧱' },
    'Feuille tressée': { type: 'resource', icon: '📜' },
    'Verre': { type: 'resource', icon: '🍸' },
    'Minerai de fer': { type: 'resource', icon: '🔩' },
    'Minerai d\'or': { type: 'resource', icon: '💰' },
    'Minerai d\'argent': { type: 'resource', icon: '🥈' },
    'Souffre': { type: 'resource', icon: '💨' },
    'Fer': { type: 'resource', icon: '쇠' },
    'Or': { type: 'resource', icon: '🥇' },
    'Argent': { type: 'resource', icon: '💍' },
    'Explosif': { type: 'resource', icon: '💥' },
    'Huile de coco': { type: 'resource', icon: '🥥' },
    'Savon': { type: 'resource', icon: '🧼' },
    'Eau croupie': { type: 'resource', icon: '🚱' },
    'Hameçon': { type: 'resource', icon: '🪝' },
    'Plan d\'ingénieur': { type: 'resource', icon: '📐', rarity: 'veryRare' },
    'Recette médicinale': { type: 'resource', icon: '℞', rarity: 'veryRare' },
    'Sceau vide': { type: 'resource', icon: '🪣' },
    'Graine d\'arbre': { type: 'resource', icon: '🌱' },
    'Allumettes': {type: 'resource', icon: '🔥', durability: 1, isFireStarter: true }, // MODIFIÉ (Point 19)

    // === CONSOMMABLES ===
    'Eau pure': { type: 'consumable', icon: '💧', effects: { thirst: 10 } },
    'Eau salée': { type: 'consumable', icon: '🚱', effects: { thirst: 1, custom: 'eauSaleeEffect' } }, // MODIFIÉ (Point 6)
    'Insectes': { type: 'consumable', icon: '🦗', effects: { hunger: 1 } },
    'Viande crue': { type: 'consumable', icon: '🥩', effects: { hunger: 1, status: { name: 'Malade', chance: 0.3 } } }, // Sera réévalué avec poisson cru
    'Viande cuite': { type: 'consumable', icon: '🍖', effects: { hunger: 3 } },
    'Poisson cru': { type: 'consumable', icon: '🐟', effects: { hunger: 3, custom: 'poissonCruEffect' } }, // MODIFIÉ (Point 18)
    'Poisson cuit': { type: 'consumable', icon: '🔥', effects: { hunger: 2 } },
    'Oeuf cru': { type: 'consumable', icon: '🥚', effects: { hunger: 2, status: { name: 'Malade', chance: 0.5 } } },
    'Oeuf cuit': { type: 'consumable', icon: '🍳', effects: { hunger: 3 } },
    'Banane': { type: 'consumable', icon: '🍌', effects: { hunger: 2, thirst: 1 } },
    'Noix de coco': { type: 'consumable', icon: '🥥', effects: { thirst: 3 } },
    'Canne à sucre': { type: 'consumable', icon: '🎋', effects: { hunger: 3, thirst: -1 } },
    'Sucre': { type: 'consumable', icon: '🍬', effects: { hunger: 4, thirst: -1 } }, // MODIFIÉ (Point 16)
    'Barre Énergétique': { type: 'consumable', icon: '🍫', effects: { hunger: 6, sleep: 4 } },
    'Médicaments': { type: 'consumable', icon: '💊', effects: { ifStatus: 'Malade', status: 'Normal', health: 5 } },
    'Antiseptiques': { type: 'consumable', icon: '🧴', effects: { ifStatus: 'Empoisonné', status: 'Normal', health: 3 } },
    'Bandage': { type: 'consumable', icon: '🩹', effects: { ifStatus: 'Blessé', status: 'Normal', health: 4 } },
    'Kit de Secours': { type: 'consumable', icon: '✚', effects: { ifStatus: ['Blessé', 'Malade'], status: 'Normal', health: 10 } }, // MODIFIÉ (Point 11)
    'Batterie déchargée': {type: 'consumable', icon: '🔋', effects: {}},
    'Venin': { type: 'consumable', icon: '🧪', effects: { status: { name: 'Empoisonné', chance: 1.0 } } }, // MODIFIÉ (Point 14)
    'Fiole empoisonnée': { type: 'consumable', icon: '☠️', effects: { health: -1000 } },
    'Fiole anti-poison': { type: 'consumable', icon: '🧪', effects: { ifStatus: 'Empoisonné', status: 'Normal', health: 10 } },
    'Drogue': { type: 'consumable', icon: '😵', effects: { health: 10, sleep: 10, hunger: 5, thirst: 5, status: { name: 'Accro', chance: 0.2 } } },
    'Porte bonheur': { type: 'consumable', icon: '🍀', effects: { custom: 'porteBonheur' } },
    'Carte': {type: 'consumable', icon: '🗺️', uses: 30 }, // MODIFIÉ (Point 20)
    'Briquet': { type: 'consumable', icon: '🔥', durability: 5, isFireStarter: true }, // MODIFIÉ (Point 20)

    // Parchemins (restent consumables pour l'effet d'apprentissage)
    'Parchemin Atelier Bois_PelleBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Pelle en bois', rarity: 'common', description: "Transformer 10 bois = 1 pelle en bois" },
    'Parchemin Atelier Bois_Gourdain': { type: 'consumable', icon: '📜', teachesRecipe: 'Gourdain', rarity: 'common', description: "Transformer 15 bois = 1 gourdain" },
    'Parchemin Atelier BoisFer_Hache': { type: 'consumable', icon: '📜', teachesRecipe: 'Hache', rarity: 'common', description: "Transformer 10 bois et 5 fer = 1 hache" },
    'Parchemin Atelier BoisFer_Scie': { type: 'consumable', icon: '📜', teachesRecipe: 'Scie', rarity: 'common', description: "Transformer 10 bois et 10 fer = 1 scie" },
    'Parchemin Atelier Bois_EpeeBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Épée en bois', rarity: 'common', description: "Transformer 20 bois = 1 épée en bois" },
    'Parchemin Atelier BoisHamecon_CannePeche': { type: 'consumable', icon: '📜', teachesRecipe: 'Canne à pêche', rarity: 'common', description: "Transformer 25 bois + 1 hameçon = 1 canne à pêche" },
    'Parchemin Atelier Bois_LanceBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Lance en bois', rarity: 'common', description: "Transformer 25 bois = 1 lance en bois" },
    'Parchemin Atelier Planches_SceauVide': { type: 'consumable', icon: '📜', teachesRecipe: 'Sceau vide', rarity: 'common', description: "Transformer 5 planches = 1 sceau vide" },
    'Parchemin Atelier Bois_Etabli': { type: 'consumable', icon: '📜', teachesRecipe: 'Établi', rarity: 'common', description: "Construire un établi simple pour l'artisanat de base.", isBuildingRecipe: true },
    'Parchemin Atelier BoisFer_PelleFer': { type: 'consumable', icon: '📜', teachesRecipe: 'Pelle en fer', rarity: 'uncommon', description: "Transformer 10 bois et 5 fer = 1 pelle en fer" },
    'Parchemin Atelier BoisFer_EpeeFer': { type: 'consumable', icon: '📜', teachesRecipe: 'Épée en fer', rarity: 'uncommon', description: "Transformer 15 bois et 5 fer = 1 épée en fer" },
    'Parchemin Atelier BoisBriquet_Torche': { type: 'consumable', icon: '📜', teachesRecipe: 'Torche (Briquet)', rarity: 'uncommon', description: "Transformer 15 bois et 1 briquet = 1 torche" },
    'Parchemin Atelier BoisAllumette_Torche': { type: 'consumable', icon: '📜', teachesRecipe: 'Torche (Allumette)', rarity: 'uncommon', description: "Transformer 15 bois et 1 allumette = 1 torche" },
    'Parchemin Atelier BoisLoupe_Torches': { type: 'consumable', icon: '📜', teachesRecipe: '5 Torches (Loupe)', rarity: 'uncommon', description: "Transformer 15 bois et 1 loupe = 5 torche" },
    'Parchemin Atelier Lianes_Ficelle': { type: 'consumable', icon: '📜', teachesRecipe: 'Ficelle', rarity: 'rare', description: "Transformer 10 lianes = 1 ficelle" },
    'Parchemin Atelier Ficelles_Corde': { type: 'consumable', icon: '📜', teachesRecipe: 'Corde', rarity: 'rare', description: "Transformer 10 ficelles = 1 Corde" },
    'Parchemin Atelier Pierre_BlocTaille': { type: 'consumable', icon: '📜', teachesRecipe: 'Bloc taillé', rarity: 'rare', description: "Transformer 10 pierre = 1 bloc taillé" },
    'Parchemin Atelier Feuilles_FeuilleTressee': { type: 'consumable', icon: '📜', teachesRecipe: 'Feuille tressée', rarity: 'rare', description: "Transformer 10 feuilles = 1 feuille tressé" },
    'Parchemin Atelier FeuilleTressee_Chapeau': { type: 'consumable', icon: '📜', teachesRecipe: 'Chapeau feuillu', rarity: 'rare', description: "Transformer 10 feuille tressé = 1 Chapeau feuillu" },
    'Parchemin Atelier FeuilleTressee_Pagne': { type: 'consumable', icon: '📜', teachesRecipe: 'Pagne feuillu', rarity: 'rare', description: "Transformer 20 feuille tressé = 1 pagne feuillu" },
    'Parchemin Atelier Cuir_Sandalette': { type: 'consumable', icon: '📜', teachesRecipe: 'Sandalette', rarity: 'rare', description: "Transformer 10 Peau de bête = 1 paire de sandalette" },
    'Parchemin Atelier Sables_Verre': { type: 'consumable', icon: '📜', teachesRecipe: 'Verre', rarity: 'rare', description: "Transformer 10 sables = 1 verre" },
    'Parchemin Atelier Verre_Loupe': { type: 'consumable', icon: '📜', teachesRecipe: 'Loupe', rarity: 'rare', description: "Transformer 10 verre = 1 loupe" },
    'Parchemin Atelier PlanPlanche_PorteBois': { type: 'consumable', icon: '📜', teachesRecipe: 'Porte en bois', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 10 planche = 1 Porte en bois" },
    'Parchemin Atelier PlanOr_Boussole': { type: 'consumable', icon: '📜', teachesRecipe: 'Boussole', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 or = 1 boussole" },
    'Parchemin Atelier PlanArgent_Sifflet': { type: 'consumable', icon: '📜', teachesRecipe: 'Sifflet', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 argent = 1 sifflet" },
    'Parchemin Atelier PlanOr_PorteBonheur': { type: 'consumable', icon: '📜', teachesRecipe: 'Porte bonheur (craft)', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 1 or = Porte bonheur" },
    'Parchemin Atelier PlanFer_KitReparation': { type: 'consumable', icon: '📜', teachesRecipe: 'Kit de réparation', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 30 fer = 1 kit de réparation" },
    'Parchemin Atelier PlanCorde_FiletPeche': { type: 'consumable', icon: '📜', teachesRecipe: 'Filet de pêche', rarity: 'veryRare', description: "Transformer 1 Plan d'ingénieur + 10 corde = 1 Filet de pêche" },
    'Parchemin Atelier VerreElec_Ecran': { type: 'consumable', icon: '📜', teachesRecipe: 'Écran électronique', rarity: 'veryRare', description: "Transformer 10 verre et 10 composant électronique = 1 écran electronique" },
    'Parchemin Atelier ElecEcran_BatterieDechargee': { type: 'consumable', icon: '📜', teachesRecipe: 'Batterie déchargée (craft)', rarity: 'offtable', description: "Transformer 20 composants electronique et 1 écran éléctronique = 1 batterie déchargé" },
    'Parchemin Atelier FerOr_PistoletDetresse': { type: 'consumable', icon: '📜', teachesRecipe: 'Pistolet de détresse (craft)', rarity: 'offtable', description: "Transformer 45 fer 5 or = pistolet de détresse" },
    'Parchemin Atelier ElecEcran_PanneauSolaireFixe': { type: 'consumable', icon: '📜', teachesRecipe: 'Panneau solaire fixe', rarity: 'offtable', description: "Transformer 40 composants electronique et 1 écran éléctronique = 1 panneau solaire fixe" },
    'Parchemin Atelier ElecEcran_PanneauSolairePortable': { type: 'consumable', icon: '📜', teachesRecipe: 'Panneau solaire portable', rarity: 'offtable', description: "Transformer 20 composants electronique et 1 écran éléctronique = 1 panneau solaire portable" },
    'Parchemin Atelier ElecEcran_TelephoneDecharge': { type: 'consumable', icon: '📜', teachesRecipe: 'Téléphone déchargé', rarity: 'offtable', description: "Transformer 5 composants electronique et 1 écran éléctronique = 1 téléphone déchargé" },
    'Parchemin Atelier ElecEcran_RadioDechargee': { type: 'consumable', icon: '📜', teachesRecipe: 'Radio déchargée', rarity: 'offtable', description: "Transformer 15 composants electronique et 5 écran éléctronique = 1 radio déchargé" },
    'Parchemin Atelier PlanCharbon_FiltreEau': { type: 'consumable', icon: '📜', teachesRecipe: 'Filtre à eau (craft)', rarity: 'offtable', description: "Transformer 1 plan d'ingénieur et 50 charbon = 1 filtre à eau" },

    // === OUTILS & ARMES === (Point 26)
    'Hache': { type: 'tool', slot: 'weapon', icon: '🪓', durability: 10, power: 5, action: 'harvest_wood', stats: { damage: 3 } }, // damage ajouté
    'Scie': { type: 'tool', slot: 'weapon', icon: '🪚', durability: 10, power: 10, action: 'harvest_wood', stats: { damage: 2 } }, // damage ajouté
    'Pelle en bois': { type: 'tool', slot: 'weapon', icon: '🦯', durability: 3, power: 1, action: 'dig', stats: { damage: 1 } },
    'Pelle en fer': { type: 'tool', slot: 'weapon', icon: '⛏️', durability: 10, power: 3, action: 'dig', stats: { damage: 2 } },
    'Canne à pêche': { type: 'tool', slot: 'weapon', icon: '🎣', durability: 10, power: 1, action: 'fish', stats: { damage: 1 } },
    'Filtre à eau': { type: 'tool', icon: '⚗️', durability: 10, action: 'purify_water' }, // Reste tool, pas une arme
    'Gourdain': { type: 'weapon', slot: 'weapon', icon: '🏏', durability: 5, stats: { damage: 2 } },
    'Lance en bois': { type: 'weapon', slot: 'weapon', icon: '🍢', durability: 8, stats: { damage: 4 } },
    'Épée en bois': { type: 'weapon', slot: 'weapon', icon: '🗡️', durability: 3, stats: { damage: 3 }, pvpEffects: [{ name: 'Blessé', chance: 0.5 }, { name: 'Mort', chance: 0.05 }] },
    'Épée en fer': { type: 'weapon', slot: 'weapon', icon: '⚔️', durability: 10, stats: { damage: 6 }, pvpEffects: [{ name: 'Blessé', chance: 0.5 }, { name: 'Mort', chance: 0.05 }] },
    'Bouclier en bois': {type: 'shield', slot: 'shield', icon: '🛡️', durability: 10, stats: {defense: 2}},
    'Bouclier en fer': {type: 'shield', slot: 'shield', icon: '🛡️', durability: 20, stats: {defense: 4}},
    'Kit de réparation': { type: 'tool', icon: '🛠️', action: 'repair_building', durability: 1 }, // Reste tool
    'Filet de pêche': { type: 'tool', icon: '🥅', action: 'net_fish', durability: 15 }, // Reste tool
    'Torche': { type: 'usable', icon: '🔦', durability: 10, isFireStarter: true, slot: 'weapon', stats: { damage: 1 } }, // Déjà OK

    // === ÉQUIPEMENT ===
    'Vêtements': { type: 'body', slot: 'body', icon: '👕', stats: { maxHealth: 2 } },
    'Chaussures': { type: 'feet', slot: 'feet', icon: '👟', stats: { maxSleep: 2 } },
    'Chapeau': { type: 'head', slot: 'head', icon: '👒', stats: { maxThirst: 2 } },
    'Chapeau feuillu': { type: 'head', slot: 'head', icon: '🌿', stats: { maxThirst: 1, defense: 1 }, durability: 10 },
    'Pagne feuillu': { type: 'body', slot: 'body', icon: '🌿', stats: { defense: 2 }, durability: 15 },
    'Sandalette': { type: 'feet', slot: 'feet', icon: '👣', stats: { maxSleep: 1 }, durability: 10 },
    'Petit Sac': { type: 'bag', slot: 'bag', icon: '🎒', stats: { maxInventory: 50 } },
    'Grand Sac': { type: 'bag', slot: 'bag', icon: '🛍️', stats: { maxInventory: 150 } },
    'Loupe': { type: 'consumable', slot: 'tool_belt', icon: '🔍', action: 'start_fire_loupe', durability: 5 }, // MODIFIÉ (Point 20)

    // === DIVERS (utilisables non-consommables directs) ===
    'Boussole': {type: 'consumable', icon: '🧭', action: 'find_mine'}, // MODIFIÉ (Point 20)
    'Sifflet': { type: 'consumable', icon: '😗', action: 'attract_npc_attention' }, // MODIFIÉ (Point 20)
    'Pistolet de détresse': { type: 'consumable', icon: '🔫', durability: 2, action: 'fire_distress_gun' }, // MODIFIÉ (Point 20)
    'Fusée de détresse': { type: 'consumable', icon: '🧨', durability: 1, action: 'fire_distress_flare' }, // MODIFIÉ (Point 20)
    'Clé du Trésor': { type: 'key', icon: '🔑', unique: true },
    'Porte en bois': { type: 'component', icon: '🚪' }, // Reste component, pas consommable
    'Panneau solaire fixe': { type: 'consumable', icon: '☀️', action: 'place_solar_panel_fixed' }, // MODIFIÉ (Point 20)
    'Panneau solaire portable': { type: 'consumable', icon: '🌞', action: 'charge_battery_portable_solar' }, // MODIFIÉ (Point 20)
    'Téléphone déchargé': { type: 'consumable', icon: '📱', action: 'attempt_call_if_charged' }, // MODIFIÉ (Point 20)
    'Radio déchargée': { type: 'consumable', icon: '📻', action: 'listen_radio_if_charged' }, // MODIFIÉ (Point 20)
    'Piège': { type: 'consumable', icon: '🪤', action: 'place_trap' }, // MODIFIÉ (Point 20)
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
};

export const TILE_TYPES = {
    // Terrains Naturels
    WATER_LAGOON: { name: 'Lagon', accessible: false, color: '#48cae4', background: ['bg_sand_1'], resource: { type: 'Eau salée', yield: 1 }, harvests: Infinity, description: "Une étendue d'eau salée infranchissable." },
    PLAGE: { name: 'Plage', accessible: true, color: '#f4d35e', background: ['bg_sand_2'], resource: { type: 'Sable', yield: 5 }, harvests: 20, description: "Du sable fin à perte de vue. On y trouve parfois des choses utiles." },
    FOREST: { name: 'Forêt', resource: { type: 'Bois', yield: 5, thirstCost: 1, hungerCost: 1, sleepCost: 1 }, harvests: 10, accessible: true, color: '#2d6a4f', background: ['bg_forest_1'], description: "Une forêt dense. Source principale de bois, mais attention aux créatures." },
    WASTELAND: { name: 'Friche', accessible: true, color: '#9c6644', background: ['bg_wasteland_1'], regeneration: { cost: { 'Eau pure': 5 }, target: 'FOREST' }, description: "Une terre aride et désolée. Peut être reboisée avec de l'eau." },
    PLAINS: { name: 'Plaine', accessible: true, color: '#80b918', background: ['bg_plains_1'], buildable: true, description: "Une vaste étendue herbeuse, idéale pour construire." },
    STONE_DEPOSIT: { name: 'Gisement de Pierre', accessible: true, color: '#8d99ae', background: ['bg_stone_1'], resource: { type: 'Pierre', yield: 3 }, harvests: 15, description: "Un affleurement rocheux riche en pierre." },

    // Structures de base
    CAMPFIRE: { name: 'Feu de Camp', accessible: true, color: '#e76f51', background: ['bg_campfire'], icon: '🔥', isBuilding: true, durability: 10, cost: { 'Bois': 5, 'Pierre': 2}, description: "Permet de cuisiner de la nourriture et de se réchauffer. Perd de la durabilité à chaque utilisation." },
    SHELTER_INDIVIDUAL: {
        name: 'Abri Individuel', accessible: true, color: '#fefae0', icon: '⛺',
        background: ['bg_shelter_individual'],
        sleepEffect: { sleep: 8, health: 3 },
        inventory: {}, maxInventory: 50, durability: 20, isBuilding: true,
        cost: { 'Bois': 20 },
        description: "Un petit abri pour une personne. Offre un repos modéré et un petit espace de stockage."
    },
    SHELTER_COLLECTIVE: {
        name: 'Abri Collectif', accessible: true, color: '#ffffff', icon: '🏠',
        background: ['bg_shelter_collective'],
        inventory: {}, maxInventory: 500, durability: 100,
        sleepEffect: { sleep: 8, health: 5 }, isBuilding: true,
        cost: { 'Bois': 60, 'Pierre': 15 },
        description: "Un grand abri pour plusieurs survivants. Offre un bon repos et un grand espace de stockage partagé."
    },
    MINE: {
        name: 'Mine', accessible: true, color: '#5e503f', background: ['bg_mine'], icon: '⛏️',
        isBuilding: true, durability: 20,
        cost: { 'Bois': 20, 'toolRequired': ['Pelle en fer', 'Pelle en bois'] },
        action: { id: 'search_ore', name: 'Chercher du Minerai', results: [
            { item: 'Minerai d\'or', chance: 0.001 }, { item: 'Minerai d\'argent', chance: 0.01 },
            { item: 'Souffre', chance: 0.05 }, { item: 'Minerai de fer', chance: 0.20 },
            { item: 'Charbon', chance: 0.50 },
        ]},
        description: "Permet d'extraire des minerais précieux du sol. Nécessite une pelle."
    },
    TREASURE_CHEST: {
        name: 'Trésor Caché', accessible: true, color: '#DAA520', icon: '💎',
        background: ['bg_treasure_chest'],
        requiresKey: 'Clé du Trésor',
        description: "Un coffre mystérieux. Que peut-il bien contenir ?"
    },

    // Nouveaux Bâtiments
    ATELIER: { name: 'Atelier', accessible: true, color: '#a0522d', background: ['bg_plains_2'], icon: '🛠️', isBuilding: true, durability: 200, cost: { 'Bois': 30, 'Pierre': 15 }, action: { id: 'use_atelier', name: 'Utiliser Atelier' }, description: "Permet de fabriquer des outils et objets avancés." },
    PETIT_PUIT: { name: 'Petit Puit', accessible: true, color: '#add8e6', background: ['bg_plains_3'], icon: '💧', isBuilding: true, durability: 5, 
        cost: { 'Pierre': 20, 'Bois': 20, 'toolRequired': ['Pelle en bois', 'Pelle en fer'] }, // MODIFIÉ (Point 3)
        action: { id: 'draw_water_shallow_well', name: 'Puiser Eau (croupie)', result: { 'Eau croupie': 2 } }, 
        description: "Source d'eau croupie basique. Faible durabilité. Nécessite une pelle." // MODIFIÉ (Point 3)
    },
    PUIT_PROFOND: { name: 'Puit Profond', accessible: true, color: '#87ceeb', background: ['bg_plains_4'], icon: '💦', isBuilding: true, durability: 20, cost: { 'Bloc taillé': 20, 'Sceau vide': 1, 'toolRequired': ['Pelle en fer'] }, action: { id: 'draw_water_deep_well', name: 'Puiser Eau (croupie)', result: { 'Eau croupie': 4 } }, description: "Source d'eau croupie plus fiable et abondante." },
    BIBLIOTHEQUE: { name: 'Bibliothèque', accessible: true, color: '#deb887', background: ['bg_plains_1'], icon: '📚', isBuilding: true, durability: 100, cost: { 'Bloc taillé': 40, 'Porte en bois': 2 }, action: { id: 'generate_plan', name: 'Rechercher Plan (5h)', result: { 'Plan d\'ingénieur': 1 }, intervalHours: 5 }, description: "Permet de rechercher des plans d'ingénieur pour des constructions complexes." },
    FORTERESSE: { name: 'Forteresse', accessible: true, color: '#696969', background: ['bg_shelter_collective'], icon: '🏰', isBuilding: true, durability: 500, cost: { 'Bloc taillé': 96, 'Porte en bois': 4 }, sleepEffect: { sleep: 16, health: 10 }, inventory: {}, maxInventory: 1000, description: "Un bastion de survie offrant un excellent repos et un stockage massif." },
    LABORATOIRE: { name: 'Laboratoire', accessible: true, color: '#e0ffff', background: ['bg_plains_2'], icon: '🔬', isBuilding: true, durability: 200, cost: { 'Bloc taillé': 65, 'Kit de Secours': 5 }, action: { id: 'use_laboratoire', name: 'Utiliser Laboratoire' }, description: "Permet de créer des potions, médicaments et autres composés chimiques." },
    FORGE: { name: 'Forge', accessible: true, color: '#d2691e', background: ['bg_plains_3'], icon: '🔥', isBuilding: true, durability: 200, cost: { 'Fer': 50, 'Porte en bois': 2 }, action: { id: 'use_forge', name: 'Utiliser Forge' }, description: "Permet de travailler les métaux pour créer des armes et outils robustes." },
    BANANERAIE: { name: 'Bananeraie', accessible: true, color: '#ffffe0', background: ['bg_plains_4'], icon: '🍌', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'water_bananeraie', name: 'Arroser (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 }, { id: 'harvest_bananeraie', name: 'Récolter Bananes', result: { 'Banane': 3 } } ], description: "Cultive des bananes. Nécessite un arrosage régulier." },
    SUCRERIE: { name: 'Sucrerie', accessible: true, color: '#fafad2', background: ['bg_plains_1'], icon: '🍬', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'water_sucrerie', name: 'Arroser (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 }, { id: 'harvest_sucrerie', name: 'Récolter Cannes', result: { 'Canne à sucre': 3 } } ], description: "Cultive de la canne à sucre. Nécessite un arrosage régulier." },
    COCOTERAIE: { name: 'Cocoteraie', accessible: true, color: '#fff8dc', background: ['bg_plains_2'], icon: '🥥', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'water_cocoteraie', name: 'Arroser (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 }, { id: 'harvest_cocoteraie', name: 'Récolter Noix de Coco', result: { 'Noix de coco': 3 } } ], description: "Cultive des noix de coco. Nécessite un arrosage régulier." },
    POULAILLER: { name: 'Poulailler', accessible: true, color: '#fffacd', background: ['bg_plains_3'], icon: '🐔', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'water_poulailler', name: 'Abreuver (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 }, { id: 'harvest_poulailler', name: 'Récolter Oeufs', result: { 'Oeuf cru': 3 } } ], description: "Élève des poules pour obtenir des oeufs. Nécessite un abreuvement régulier." },
    ENCLOS_COCHONS: { name: 'Enclos à Cochons', accessible: true, color: '#ffebcd', background: ['bg_plains_4'], icon: '🐖', isBuilding: true, durability: 80, cost: { 'Planche': 50, 'Eau pure': 20 }, actions: [ { id: 'water_enclos_cochons', name: 'Abreuver (-1 Eau, +5 Dura)', costItem: 'Eau pure', durabilityGain: 5 }, { id: 'harvest_enclos_cochons', name: 'Récolter Viande', result: { 'Viande crue': 3 } } ], description: "Élève des cochons pour obtenir de la viande. Nécessite un abreuvement régulier." },
    OBSERVATOIRE: { name: 'Observatoire', accessible: true, color: '#f5f5dc', background: ['bg_plains_1'], icon: '🔭', isBuilding: true, durability: 20, cost: { 'Planche': 50, 'Porte en bois': 1 }, action: { id: 'observe_weather', name: 'Observer (Prochaine catastrophe)' }, description: "Permet d'observer le ciel pour anticiper les événements météorologiques." },
    ETABLI: { name: 'Établi', accessible: true, color: '#D2B48C', background: ['bg_plains_2'], icon: '🪚', isBuilding: true, durability: 50, cost: { 'Bois': 25 }, action: {id: 'use_etabli', name: 'Utiliser Établi'}, description: "Un plan de travail simple pour l'artisanat de base. Nécessaire pour certaines recettes de parchemins." },
};

for (const itemName in ITEM_TYPES) {
    if (itemName.startsWith('Parchemin Atelier') && !ALL_SEARCHABLE_ITEMS.includes(itemName)) {
        ALL_SEARCHABLE_ITEMS.push(itemName);
    }
}