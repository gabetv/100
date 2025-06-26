//js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, consumeItem as playerConsumeItemLogic, movePlayer as playerMoveLogic } from './player.js';
import { initNpcs } from './npc.js';
import { initEnemies } from './enemy.js';
import { TILE_TYPES, CONFIG, ITEM_TYPES } from './config.js';

const gameState = {
    map: [],
    player: null,
    npcs: [],
    enemies: [],
    day: 1,
    gameIntervals: [],
    activeEvent: { type: 'none', duration: 0, data: null },
    shelterLocation: null,
    isGameOver: false,
    combatState: null,
    config: { ...CONFIG },
    knownRecipes: {},
    mapTileGlobalVisitCounts: new Map(),
    globallyRevealedTiles: new Set(),
    foundUniqueParchemins: new Set(),
    tutorialState: {
        step: 0,
        active: false,
        completed: false,
        welcomeMessageShown: false,
        isTemporarilyHidden: false,
    },
};

export const state = gameState;

// ===================================================================
// NOUVELLE LOGIQUE DE GESTION D'INVENTAIRE ROBUSTE
// ===================================================================

/**
 * Compte le nombre total d'objets dans un inventaire.
 * Les objets empilables comptent pour leur quantité, les objets uniques pour 1.
 * Peut maintenant compter un objet spécifique ou le total.
 * @param {object} inventory L'inventaire à compter.
 * @param {string} itemName Le nom de l'objet à compter (optionnel).
 * @returns {number} Le nombre total d'objets ou la quantité de l'objet spécifique.
 */
export function countItemsInInventory(inventory, itemName = null) {
    if (!inventory) return 0;

    if (itemName) {
        let count = 0;
        // Gérer les objets empilables
        if (typeof inventory[itemName] === 'number') {
            count += inventory[itemName];
        }
        // Gérer les objets uniques (instances)
        for (const key in inventory) {
            const item = inventory[key];
            if (typeof item === 'object' && item.name === itemName) {
                count++;
            }
        }
        return count;
    }

    // Comportement original si itemName n'est pas fourni
    return Object.values(inventory).reduce((sum, item) => {
        return sum + (typeof item === 'number' ? item : 1);
    }, 0);
}

/**
 * Trouve les clés des objets requis dans un inventaire.
 * @param {object} inventory L'inventaire où chercher.
 * @param {string} itemName Le nom de l'objet à trouver.
 * @param {number} quantity La quantité à trouver.
 * @returns {{found: boolean, keys: string[]}} Un objet indiquant si les objets ont été trouvés et la liste de leurs clés.
 */
export function findItemsInInventory(inventory, itemName, quantity) {
    const keysFound = [];
    let quantityFound = 0;

    // Chercher d'abord les objets empilables
    if (typeof inventory[itemName] === 'number') {
        const available = inventory[itemName];
        const canTake = Math.min(available, quantity);
        if (canTake > 0) {
            quantityFound += canTake;
            // Pour les empilables, la "clé" est le nom de l'objet
            // On l'ajoute autant de fois que nécessaire pour la logique de déduction
            for (let i = 0; i < canTake; i++) {
                keysFound.push(itemName);
            }
        }
    }

    // Si pas assez, chercher les objets uniques
    if (quantityFound < quantity) {
        for (const key in inventory) {
            if (quantityFound >= quantity) break;
            const item = inventory[key];
            if (typeof item === 'object' && item.name === itemName) {
                keysFound.push(key);
                quantityFound++;
            }
        }
    }

    return {
        found: quantityFound >= quantity,
        keys: keysFound.slice(0, quantity) // Retourne seulement le nombre de clés nécessaires
    };
}


/**
 * Ajoute une ressource (empilable ou unique) à un inventaire.
 * @param {object} inventory L'inventaire cible.
 * @param {string|object} resource Le nom de la ressource ou l'objet instance.
 * @param {number} amount La quantité (ignorée si resource est un objet).
 */
export function addResource(inventory, resource, amount = 1) {
    if (typeof inventory !== 'object' || inventory === null) {
        console.error("Tentative d'ajout à un inventaire non valide.", inventory);
        return;
    }

    if (typeof resource === 'object' && resource.name) {
        // C'est une instance d'objet unique
        const uniqueKey = `${resource.name}_${Date.now()}_${Math.random()}`;
        inventory[uniqueKey] = resource;
    } else if (typeof resource === 'string') {
        // C'est un objet empilable
        const itemDef = ITEM_TYPES[resource];
        if (!itemDef) {
            console.warn(`Tentative d'ajout d'un objet inconnu: ${resource}`);
            return;
        }

        // Si l'objet devrait être unique (a une durabilité, etc.), on crée des instances
        if (itemDef.hasOwnProperty('durability') || itemDef.hasOwnProperty('uses') || itemDef.slot) {
            for (let i = 0; i < amount; i++) {
                const newItemInstance = { ...JSON.parse(JSON.stringify(itemDef)), name: resource };
                if (newItemInstance.uses) newItemInstance.currentUses = newItemInstance.uses;
                if (newItemInstance.hasOwnProperty('durability')) newItemInstance.currentDurability = newItemInstance.durability;
                const uniqueKey = `${resource}_${Date.now()}_${Math.random()}_${i}`;
                inventory[uniqueKey] = newItemInstance;
            }
        } else {
            // Sinon, on l'empile
            inventory[resource] = (inventory[resource] || 0) + amount;
        }
    }
}

/**
 * Retire des objets d'un inventaire en utilisant une liste de clés.
 * @param {object} inventory L'inventaire d'où retirer les objets.
 * @param {string[]} keys Les clés des objets à retirer.
 */
export function removeItemsFromInventory(inventory, keys) {
    for (const key of keys) {
        if (typeof inventory[key] === 'number') {
            // C'est un objet empilable (la clé est son nom)
            inventory[key]--;
            if (inventory[key] <= 0) {
                delete inventory[key];
            }
        } else if (inventory[key]) {
            // C'est un objet unique
            delete inventory[key];
        }
    }
}

/**
 * Vérifie si un inventaire contient les ressources nécessaires.
 * @param {object} inventory L'inventaire à vérifier.
 * @param {object} costs Un dictionnaire de { itemName: quantity }.
 * @param {object} secondaryInventory Un inventaire secondaire optionnel (ex: sol).
 * @returns {{success: boolean, missing: string|null}}
 */
export function hasResources(inventory, costs, secondaryInventory = null) {
    for (const resourceName in costs) {
        const requiredAmount = costs[resourceName];
        if (requiredAmount <= 0) continue;

        let totalAvailable = countItemsInInventory(inventory, resourceName);
        if (secondaryInventory) {
            totalAvailable += countItemsInInventory(secondaryInventory, resourceName);
        }

        if (totalAvailable < requiredAmount) {
            return { success: false, missing: resourceName };
        }
    }
    return { success: true, missing: null };
}

/**
 * Applique la déduction de ressources d'un inventaire.
 * @param {object} inventory L'inventaire d'où déduire.
 * @param {object} costs Un dictionnaire de { itemName: quantity }.
 * @returns {boolean} True si la déduction a réussi.
 */
export function applyResourceDeduction(inventory, costs) {
    // Cette fonction ne gère qu'un seul inventaire. Elle est conservée pour la compatibilité
    // avec les actions qui n'utilisent que l'inventaire du joueur.
    if (!hasResources(inventory, costs).success) {
        console.error("applyResourceDeduction a échoué la vérification préalable.", costs);
        return false;
    }

    for (const resourceName in costs) {
        const requiredAmount = costs[resourceName];
        if (requiredAmount <= 0) continue;

        const { keys } = findItemsInInventory(inventory, resourceName, requiredAmount);
        removeItemsFromInventory(inventory, keys);
    }
    return true;
}

/**
 * Applique la déduction de ressources de deux inventaires combinés.
 * @param {object} playerInventory L'inventaire du joueur.
 * @param {object} groundInventory L'inventaire du sol.
 * @param {object} costs Un dictionnaire de { itemName: quantity }.
 * @returns {boolean} True si la déduction a réussi.
 */
export function applyCombinedResourceDeduction(playerInventory, groundInventory, costs) {
    if (!hasResources(playerInventory, costs, groundInventory).success) {
        console.error("applyCombinedResourceDeduction a échoué la vérification préalable.", costs);
        return false;
    }

    for (const resourceName in costs) {
        let amountNeeded = costs[resourceName];
        if (amountNeeded <= 0) continue;

        // 1. Tenter de prendre sur le sol d'abord
        const groundAmount = countItemsInInventory(groundInventory, resourceName);
        const toTakeFromGround = Math.min(amountNeeded, groundAmount);

        if (toTakeFromGround > 0) {
            const { keys } = findItemsInInventory(groundInventory, resourceName, toTakeFromGround);
            removeItemsFromInventory(groundInventory, keys);
            amountNeeded -= toTakeFromGround;
        }

        // 2. Si besoin, compléter depuis l'inventaire du joueur
        if (amountNeeded > 0) {
            const { keys } = findItemsInInventory(playerInventory, resourceName, amountNeeded);
            removeItemsFromInventory(playerInventory, keys);
        }
    }
    return true;
}


// ===================================================================
// FONCTIONS D'ÉTAT PRINCIPALES
// ===================================================================

export function initializeGameState(config) {
    console.log("State.initializeGameState appelée avec config:", config);
    gameState.config = { ...config };
    gameState.map = generateMap(config);

    gameState.player = initPlayer(config, 'player1');

    let startX, startY, attempts = 0;
    const occupiedStarts = new Set();

    do {
        startX = Math.floor(Math.random() * config.MAP_WIDTH);
        startY = Math.floor(Math.random() * config.MAP_HEIGHT);
        attempts++;
        if (attempts > 200) {
            console.error("Impossible de trouver une case de départ de type Plage libre !");
            const fallbackBeach = gameState.map.flat().find(t => t.type.name === TILE_TYPES.PLAGE.name && t.type.accessible);
            if (fallbackBeach) {
                startX = fallbackBeach.x;
                startY = fallbackBeach.y;
            } else {
                startX = Math.floor(config.MAP_WIDTH / 2);
                startY = Math.floor(config.MAP_HEIGHT / 2);
            }
            break;
        }
    } while (
        !gameState.map[startY] ||
        !gameState.map[startY][startX] ||
        gameState.map[startY][startX].type.name !== TILE_TYPES.PLAGE.name ||
        !gameState.map[startY][startX].type.accessible ||
        occupiedStarts.has(`${startX},${startY}`)
    );

    gameState.player.x = startX;
    gameState.player.y = startY;
    occupiedStarts.add(`${startX},${startY}`);

    gameState.player.visitedTiles.add(`${startX},${startY}`);
    const startTileKey = `${startX},${startY}`;
    if (!gameState.mapTileGlobalVisitCounts.has(startTileKey)) {
        gameState.mapTileGlobalVisitCounts.set(startTileKey, new Set());
    }
    gameState.mapTileGlobalVisitCounts.get(startTileKey).add(gameState.player.id);
    if (gameState.mapTileGlobalVisitCounts.get(startTileKey).size >= CONFIG.FOG_OF_WAR_REVEAL_THRESHOLD) {
        gameState.globallyRevealedTiles.add(startTileKey);
    }

    gameState.npcs = initNpcs(config, gameState.map);
    gameState.enemies = initEnemies(config, gameState.map);

    for (const key in gameState.player.inventory) {
        const item = gameState.player.inventory[key];
        const itemName = typeof item === 'object' ? item.name : key;
        const itemDef = ITEM_TYPES[itemName];

        if (itemDef?.teachesRecipe && itemDef?.unique) {
            gameState.foundUniqueParchemins.add(itemName);
            gameState.knownRecipes[itemDef.teachesRecipe] = true;
        }
    }

    gameState.shelterLocation = null;
    const playerStartX = gameState.player.x;
    const playerStartY = gameState.player.y;
    let campTile = null;
    let campAttempts = 0;
    const maxCampAttempts = 50;
    const radius = 3;
    do {
        const offsetX = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
        const offsetY = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
        const checkX = playerStartX + offsetX;
        const checkY = playerStartY + offsetY;
        if (checkX >= 0 && checkX < gameState.config.MAP_WIDTH && 
            checkY >= 0 && checkY < gameState.config.MAP_HEIGHT && 
            gameState.map[checkY][checkX].type.accessible && 
            gameState.map[checkY][checkX].type.name === 'Plaines') {
            campTile = gameState.map[checkY][checkX];
            gameState.shelterLocation = { x: checkX, y: checkY };
            campTile.groundItems = {
                'Bois': 10,
                'Pierre': 5
            };
            console.log(`Camp tile set at (${checkX}, ${checkY}) with initial resources.`);
            break;
        }
        campAttempts++;
        if (campAttempts > maxCampAttempts) {
            console.warn("Could not find suitable camp tile near player start after max attempts. Forcing a nearby tile to Plains.");
            for (let dy = -radius; dy <= radius && !campTile; dy++) {
                for (let dx = -radius; dx <= radius && !campTile; dx++) {
                    const forceX = playerStartX + dx;
                    const forceY = playerStartY + dy;
                    if (forceX >= 0 && forceX < gameState.config.MAP_WIDTH && 
                        forceY >= 0 && forceY < gameState.config.MAP_HEIGHT && 
                        gameState.map[forceY][forceX].type.accessible) {
                        updateTileType(forceX, forceY, 'PLAINS');
                        campTile = gameState.map[forceY][forceX];
                        gameState.shelterLocation = { x: forceX, y: forceY };
                        campTile.groundItems = {
                            'Bois': 10,
                            'Pierre': 5
                        };
                        console.log(`Forced camp tile to Plains at (${forceX}, ${forceY}) with initial resources.`);
                        break;
                    }
                }
            }
            if (!campTile) {
                console.error("Failed to force a camp tile even after attempting to change terrain type.");
            }
            break;
        }
    } while (!campTile);

    if (!gameState.shelterLocation) {
        const existingShelterTile = gameState.map.flat().find(tile =>
            tile.buildings && tile.buildings.some(b => b.key === 'SHELTER_COLLECTIVE')
        );
        if (existingShelterTile) {
            gameState.shelterLocation = { x: existingShelterTile.x, y: existingShelterTile.y };
        }
    }

    gameState.map.flat().forEach(tile => {
        if (tile.type.name === TILE_TYPES.WATER_LAGOON.name) {
            gameState.globallyRevealedTiles.add(`${tile.x},${tile.y}`);
        }
    });

    gameState.tutorialState = {
        step: 0,
        active: false,
        completed: localStorage.getItem('tutorialCompleted') === 'true',
        welcomeMessageShown: false,
        isTemporarilyHidden: false,
    };
}

export function applyPlayerMove(direction) {
    const { x, y } = gameState.player;
    const moveResult = playerMoveLogic(direction, { x, y });

    if (!moveResult) return;

    const newX = moveResult.newX;
    const newY = moveResult.newY;

    if (newX < 0 || newX >= gameState.config.MAP_WIDTH || newY < 0 || newY >= gameState.config.MAP_HEIGHT ||
        !gameState.map[newY] || !gameState.map[newY][newX] || !gameState.map[newY][newX].type.accessible) {
        console.warn("Invalid move attempted in applyPlayerMove - should be caught earlier.");
        return;
    }

    gameState.player.x = newX;
    gameState.player.y = newY;
    gameState.player.visitedTiles.add(`${newX},${newY}`);
    const tileKey = `${newX},${newY}`;
    if (!gameState.mapTileGlobalVisitCounts.has(tileKey)) {
        gameState.mapTileGlobalVisitCounts.set(tileKey, new Set());
    }
    gameState.mapTileGlobalVisitCounts.get(tileKey).add(gameState.player.id);

    if (gameState.mapTileGlobalVisitCounts.get(tileKey).size >= CONFIG.FOG_OF_WAR_REVEAL_THRESHOLD) {
        gameState.globallyRevealedTiles.add(tileKey);
    }
}

/**
 * Transfère un objet (ou une pile d'objets) d'un inventaire à un autre.
 * @param {string} itemKey Clé de l'objet ou nom de l'objet empilable.
 * @param {number} amount Quantité à transférer.
 * @param {object} fromInventory L'inventaire source.
 * @param {object} toInventory L'inventaire de destination.
 * @param {number} toCapacity Capacité de l'inventaire de destination.
 * @returns {boolean} True si le transfert a réussi.
 */
export function transferItem(itemKey, amount, fromInventory, toInventory, toCapacity = Infinity) {
    const itemInSource = fromInventory[itemKey];
    if (!itemInSource) {
        console.warn(`transferItem: L'objet avec la clé ${itemKey} n'existe pas dans l'inventaire source.`);
        return false;
    }

    const isStackable = typeof itemInSource === 'number';
    const itemName = isStackable ? itemKey : itemInSource.name;
    const quantityToMove = isStackable ? Math.min(amount, itemInSource) : 1;

    if (quantityToMove <= 0) return false;
    
    // Vérifier la capacité de destination
    const currentDestSize = countItemsInInventory(toInventory);
    if (currentDestSize + quantityToMove > toCapacity) {
        console.warn(`transferItem: Capacité de destination insuffisante.`);
        return false;
    }

    // Effectuer le transfert
    // Ajouter à la destination
    addResource(toInventory, isStackable ? itemName : itemInSource, quantityToMove);
    
    // Retirer de la source
    if (isStackable) {
        fromInventory[itemName] -= quantityToMove;
        if (fromInventory[itemName] <= 0) {
            delete fromInventory[itemName];
        }
    } else {
        delete fromInventory[itemKey];
    }
    
    return true;
}


export function applyBulkInventoryTransfer(itemKey, amount, transferType) {
    const tile = gameState.map[gameState.player.y][gameState.player.x];
    const player = gameState.player;
    let buildingWithInventory = null;

    let targetInventory, fromInventory, toInventory;
    let toCapacity = Infinity;

    if (tile.buildings && tile.buildings.length > 0) {
        buildingWithInventory = tile.buildings.find(b =>
            (TILE_TYPES[b.key]?.inventory || TILE_TYPES[b.key]?.maxInventory) &&
            (b.key === 'SHELTER_INDIVIDUAL' || b.key === 'SHELTER_COLLECTIVE' || TILE_TYPES[b.key]?.name.toLowerCase().includes("coffre"))
        );
    }

    if (buildingWithInventory) {
        if (!buildingWithInventory.inventory) buildingWithInventory.inventory = {};
        targetInventory = buildingWithInventory.inventory;
        toCapacity = TILE_TYPES[buildingWithInventory.key].maxInventory || Infinity;
    } else if (tile.type.inventory && !buildingWithInventory) {
        const buildingDef = tile.type;
        if (!tile.inventory) tile.inventory = JSON.parse(JSON.stringify(buildingDef.inventory || {}));
        targetInventory = tile.inventory;
        toCapacity = buildingDef.maxInventory || Infinity;
    } else {
        return { success: false, message: "Ce lieu n'a pas de stockage." };
    }

    if (transferType === 'deposit') {
        fromInventory = player.inventory;
        toInventory = targetInventory;
    } else if (transferType === 'withdraw') {
        fromInventory = targetInventory;
        toInventory = player.inventory;
        toCapacity = player.maxInventory;
    } else {
        return { success: false, message: "Type de transfert inconnu." };
    }

    const success = transferItem(itemKey, amount, fromInventory, toInventory, toCapacity);
    const itemName = typeof fromInventory[itemKey] === 'object' ? fromInventory[itemKey]?.name : itemKey;

    if (success) {
        const actionText = transferType === 'deposit' ? 'déposé' : 'pris';
        return { success: true, message: `Vous avez ${actionText} ${amount} x ${itemName}.` };
    } else {
        const actionText = transferType === 'deposit' ? 'dépôt' : 'retrait';
        return { success: false, message: `Le ${actionText} a échoué (vérifiez la quantité ou la capacité).` };
    }
}

export function startCombat(player, enemy) {
    if (gameState.combatState) return;
    player.isBusy = true;
    gameState.combatState = {
        enemy: enemy,
        isPlayerTurn: true,
        log: [`Un ${enemy.name} vous attaque !`],
    };
    console.log("Combat started with:", enemy.name, enemy.isSearchEncounter ? "(Search Encounter)" : "(Regular Enemy)");
}

export function endCombat(victory) {
    const { combatState, player } = gameState;
    if (!combatState) return;

    const enemyDefeated = combatState.enemy;

    if (victory) {
        if (!enemyDefeated.isSearchEncounter) {
            gameState.enemies = gameState.enemies.filter(e => e.id !== enemyDefeated.id);
            console.log(`Regular enemy ${enemyDefeated.name} (ID: ${enemyDefeated.id}) removed from global list.`);
        } else {
            console.log(`Search encounter enemy ${enemyDefeated.name} (ID: ${enemyDefeated.id}) was defeated.`);
        }
    }

    player.isBusy = false;
    gameState.combatState = null;
    console.log("Combat ended.");
}


export function addEnemy(enemy) {
    if (enemy) {
        gameState.enemies.push(enemy);
    }
}

export function equipItem(itemKey) {
    const player = gameState.player;
    const itemInstance = player.inventory[itemKey];

    if (!itemInstance) {
        return { success: false, message: "Objet introuvable dans l'inventaire." };
    }

    const itemName = itemInstance.name;
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef) return { success: false, message: "Définition de l'objet introuvable." };

    const slot = itemDef.slot;
    if (!slot || !player.equipment.hasOwnProperty(slot)) return { success: false, message: "Vous ne pouvez pas équiper ceci." };

    if (player.equipment[slot]) {
        const unequipResult = unequipItem(slot);
        if (!unequipResult.success) return unequipResult;
    }

    player.equipment[slot] = itemInstance;

    if (itemDef.stats) {
        for (const stat in itemDef.stats) {
            const value = itemDef.stats[stat];
            if (stat === 'maxInventory') player.maxInventory += value;
            else if (player.hasOwnProperty(stat)) player[stat] += value;
            else if (player.hasOwnProperty(`max${stat.charAt(0).toUpperCase() + stat.slice(1)}`)) {
                const maxStatName = `max${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
                player[maxStatName] += value;
                // S'assurer que la stat actuelle ne dépasse pas la nouvelle max
                player[stat] = Math.min(player[stat], player[maxStatName]);
            }
        }
    }

    delete player.inventory[itemKey];

    return { success: true, message: `${itemName} équipé.` };
}


export function unequipItem(slot) {
    const player = gameState.player;
    const itemInstance = player.equipment[slot];
    if (!itemInstance) return { success: false, message: "Aucun objet dans cet emplacement." };
    
    if (countItemsInInventory(player.inventory) >= player.maxInventory) {
        return { success: false, message: "Inventaire plein." };
    }

    player.equipment[slot] = null;
    
    if (itemInstance.stats) {
        for (const stat in itemInstance.stats) {
             const value = itemInstance.stats[stat];
            if (stat === 'maxInventory') player.maxInventory -= value;
            else if (player.hasOwnProperty(stat)) player[stat] -= value;
            else if (player.hasOwnProperty(`max${stat.charAt(0).toUpperCase() + stat.slice(1)}`)) {
                const maxStatName = `max${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
                player[maxStatName] -= value;
                player[stat] = Math.min(player[stat], player[maxStatName]);
            }
        }
    }

    addResource(player.inventory, itemInstance);
    
    return { success: true, message: `${itemInstance.name} déséquipé.` };
}

export function addBuildingToTile(x, y, buildingKey) {
    const tile = gameState.map[y][x];
    const buildingType = TILE_TYPES[buildingKey];
    if (!tile || !buildingType || !buildingType.isBuilding) return { success: false, message: "Type de bâtiment invalide ou tuile introuvable." };
    if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) return { success: false, message: "Nombre maximum de bâtiments atteint sur cette tuile." };

    if (!tile.type.buildable && buildingKey !== 'MINE' && buildingKey !== 'CAMPFIRE' && buildingKey !== 'PETIT_PUIT') {
        return { success: false, message: "Vous ne pouvez pas construire sur ce type de terrain." };
    }

    const buildingData = {
        key: buildingKey,
        durability: buildingType.durability,
        maxDurability: buildingType.durability
    };
    if (buildingType.maxHarvestsPerCycle) {
        buildingData.maxHarvestsPerCycle = buildingType.maxHarvestsPerCycle;
        buildingData.harvestsAvailable = buildingType.maxHarvestsPerCycle;
    }
    if (buildingKey === 'SHELTER_INDIVIDUAL' || buildingKey === 'SHELTER_COLLECTIVE' || TILE_TYPES[buildingKey]?.name.toLowerCase().includes("coffre")) {
        buildingData.isLocked = false;
        buildingData.lockCode = null;
        if (!buildingType.inventory) buildingData.inventory = {};
        else buildingData.inventory = JSON.parse(JSON.stringify(buildingType.inventory));
    }

    tile.buildings.push(buildingData);

    if (buildingKey === 'SHELTER_COLLECTIVE') gameState.shelterLocation = { x, y };

    return { success: true, message: `${buildingType.name} construit.` };
}

export function dismantleBuildingOnTile(tileX, tileY, buildingIndex) {
    const tile = gameState.map[tileY][tileX];
    if (!tile || !tile.buildings[buildingIndex]) return { success: false, message: "Bâtiment introuvable." };

    const buildingInstance = tile.buildings[buildingIndex];
    const buildingDef = TILE_TYPES[buildingInstance.key];
    if (!buildingDef || !buildingDef.cost) return { success: false, message: "Définition du bâtiment ou coûts introuvables." };

    let recoveredResourcesMessage = "Ressources récupérées: ";
    let anythingRecovered = false;

    const costsToConsider = { ...buildingDef.cost };
    delete costsToConsider.toolRequired;

    for (const resourceName in costsToConsider) {
        const costAmount = costsToConsider[resourceName];
        const recoveredAmount = Math.floor(costAmount * 0.25);
        if (recoveredAmount > 0) {
            addResource(gameState.player.inventory, resourceName, recoveredAmount);
            recoveredResourcesMessage += `${recoveredAmount} ${resourceName}, `;
            anythingRecovered = true;
        }
    }
    if (!anythingRecovered) recoveredResourcesMessage = "Aucune ressource substantielle n'a pu être récupérée.";
    else recoveredResourcesMessage = recoveredResourcesMessage.slice(0, -2) + ".";


    tile.buildings.splice(buildingIndex, 1);
    if (buildingInstance.key === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
        const anotherShelter = gameState.map.flat().find(t => t.buildings.some(b => b.key === 'SHELTER_COLLECTIVE'));
        gameState.shelterLocation = anotherShelter ? { x: anotherShelter.x, y: anotherShelter.y } : null;
    }
    
    const buildingInventory = buildingInstance.inventory;
    if (buildingInventory) {
        for (const itemKey in buildingInventory) {
             const item = buildingInventory[itemKey];
             const quantity = typeof item === 'number' ? item : 1;
             dropItemOnGround(item, quantity, tile);
        }
    }

    return { success: true, message: `${buildingDef.name} démantelé. ${recoveredResourcesMessage}` };
}


export function damageBuilding(tileX, tileY, buildingIndexInTileArray, damageAmount = 1) {
    const tile = gameState.map[tileY][tileX];
    if (!tile || !tile.buildings[buildingIndexInTileArray]) return { destroyed: false };
    const building = tile.buildings[buildingIndexInTileArray];
    building.durability -= damageAmount;
    if (building.durability <= 0) {
        const buildingName = TILE_TYPES[building.key].name;
        const buildingKeyDestroyed = building.key;
        
        const buildingInventory = building.inventory;
        if (buildingInventory) {
            for (const itemKey in buildingInventory) {
                const item = buildingInventory[itemKey];
                const quantity = typeof item === 'number' ? item : 1;
                dropItemOnGround(item, quantity, tile);
            }
        }
        
        tile.buildings.splice(buildingIndexInTileArray, 1);
        if (buildingKeyDestroyed === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
            const anotherShelter = gameState.map.flat().find(t => t.buildings.some(b => b.key === 'SHELTER_COLLECTIVE'));
            gameState.shelterLocation = anotherShelter ? { x: anotherShelter.x, y: anotherShelter.y } : null;
        }

        return { destroyed: true, name: buildingName };
    }
    return { destroyed: false };
}

export function updateTileType(x, y, newTerrainTypeKey) {
    const tile = gameState.map[y][x];
    const newTerrainType = TILE_TYPES[newTerrainTypeKey];
    if (!tile || !newTerrainType) return;
    tile.type = newTerrainType;
    if (newTerrainType.background && newTerrainType.background.length > 0) {
        tile.backgroundKey = newTerrainType.background[Math.floor(Math.random() * newTerrainType.background.length)];
    }
    tile.harvestsLeft = (newTerrainType.harvests === Infinity) ? Infinity : (newTerrainType.harvests || 0);
    tile.resources = newTerrainType.resource ? { ...newTerrainType.resource } : null;

    if (newTerrainTypeKey === 'FOREST') {
        tile.type.buildable = false;
        tile.woodActionsLeft = newTerrainType.woodActionsLeft;
        tile.huntActionsLeft = newTerrainType.huntActionsLeft;
        tile.searchActionsLeft = newTerrainType.searchActionsLeft;
    } else if (newTerrainTypeKey === 'PLAINS') {
        tile.huntActionsLeft = newTerrainType.huntActionsLeft;
        tile.searchActionsLeft = newTerrainType.searchActionsLeft;
    } else if (newTerrainTypeKey === 'MINE_TERRAIN') {
        tile.harvestsLeft = newTerrainType.harvests;
    }
    if (newTerrainTypeKey === 'PLAGE') {
        tile.actionsLeft = { ...TILE_TYPES.PLAGE.actionsAvailable };
    } else {
        delete tile.actionsLeft;
    }
}

export function consumeItem(itemKeyOrName) {
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemKeyOrName] || ITEM_TYPES[player.inventory[itemKeyOrName]?.name];
    
    let result = playerConsumeItemLogic(itemKeyOrName, player);

    if (!result.success) {
        return result;
    }
    
    const { itemKeyUsed } = result;

    if (itemDef?.teachesRecipe) {
        if (gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.isBuildingRecipe) {
            result.message = `Vous relisez le parchemin de ${itemDef.teachesRecipe}. Vous connaissez déjà cette recette.`;
        } else {
            gameState.knownRecipes[itemDef.teachesRecipe] = true;
            if (itemDef.unique) gameState.foundUniqueParchemins.add(itemDef.name || itemKeyOrName);
            result.message = `Vous avez appris la recette : ${itemDef.teachesRecipe} !`;
        }
        result.success = true;
    } else if (itemDef?.effects?.custom) {
        if (itemDef.effects.custom === 'eauSaleeEffect') {
            if (!player.status.includes('Malade') && Math.random() < 0.60) {
                player.status = player.status.filter(s => s !== 'normale');
                player.status.push('Malade');
                if (!result.floatingTexts) result.floatingTexts = [];
                result.floatingTexts.push({ text: 'Statut: Malade', type: 'cost' });
            }
        } else if (itemDef.effects.custom === 'eauCroupieEffect') {
             if (!player.status.includes('Malade') && Math.random() < 0.80) {
                player.status = player.status.filter(s => s !== 'normale');
                player.status.push('Malade');
                if (!result.floatingTexts) result.floatingTexts = [];
                result.floatingTexts.push({ text: 'Statut: Malade', type: 'cost' });
            }
        } else if (itemDef.effects.custom === 'drogueEffect') {
            if (!player.status.includes('Drogué')) {
                player.status = player.status.filter(s => s !== 'normale');
                player.status.push('Drogué');
            }
            if (!result.floatingTexts) result.floatingTexts = [];
            result.floatingTexts.push({ text: 'Statut: Drogué', type: 'cost' });
        } else if (itemDef.effects.custom === 'chargeDevice') {
            // ... (la logique reste complexe et semble correcte, on la garde)
        }
        if (result.success && !result.message && itemDef.effects.custom) {
            result.message = `Vous utilisez: ${itemKeyOrName}.`;
        }
    }
    return result;
}


export function dropItemOnGround(itemKey, quantity, tile = null) {
    const player = gameState.player;
    if (!tile) {
        tile = gameState.map[player.y][player.x];
    }
    if (!tile.groundItems) tile.groundItems = {};

    const { found, keys } = findItemsInInventory(player.inventory, itemKey, quantity);

    if (!found) {
        return { success: false, message: "Quantité insuffisante dans l'inventaire." };
    }

    // Pour chaque clé trouvée, on déplace l'objet vers le sol
    for (const key of keys) {
        const itemToDrop = player.inventory[key];
        if (typeof itemToDrop === 'number') {
            // Si c'est un item empilable, on ajoute au sol
            addResource(tile.groundItems, key, 1);
        } else {
            // Si c'est un objet unique, on le déplace
            tile.groundItems[key] = itemToDrop;
        }
    }
    
    // On retire les objets de l'inventaire du joueur
    removeItemsFromInventory(player.inventory, keys);

    return { success: true, message: `Vous avez déposé ${quantity} x ${itemKey} au sol.` };
}

export function pickUpItemFromGround(itemKey, quantity) {
    const player = gameState.player;
    const tile = gameState.map[player.y][player.x];

    if (!tile.groundItems) {
        return { success: false, message: "Rien à ramasser." };
    }
    
    const { found, keys } = findItemsInInventory(tile.groundItems, itemKey, quantity);

    if (!found) {
        return { success: false, message: "Quantité insuffisante au sol." };
    }
    
    // Vérification de la capacité
    if (countItemsInInventory(player.inventory) + quantity > player.maxInventory) {
        return { success: false, message: "Inventaire plein." };
    }

    for (const key of keys) {
        const itemToPickup = tile.groundItems[key];
        if (typeof itemToPickup === 'number') {
            addResource(player.inventory, key, 1);
        } else {
            player.inventory[key] = itemToPickup;
        }
    }

    removeItemsFromInventory(tile.groundItems, keys);

    return { success: true, message: `Vous avez ramassé ${quantity} x ${itemKey}.` };
}

// ... le reste de votre fichier state.js
// La fonction getRandomPlanByRarity et countItemTypeInInventory semblent correctes et n'ont pas besoin d'être modifiées.
export function countItemTypeInInventory(itemTypeIdentifier) {
    let count = 0;
    for (const itemName in gameState.player.inventory) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef && itemDef.teachesRecipe && (itemTypeIdentifier === 'teachesRecipe' || itemDef.teachesRecipe === itemTypeIdentifier)) {
            count += gameState.player.inventory[itemName];
        } else if (itemDef && itemDef[itemTypeIdentifier]) {
             count += gameState.player.inventory[itemName];
        }
    }
    return count;
}

export function getRandomPlanByRarity(rarity) {
    const plansOfRarity = [];
    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.teachesRecipe && itemDef.rarity === rarity && !gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.unique) {
            plansOfRarity.push(itemName);
        }
    }
    if (plansOfRarity.length === 0) {
         for (const itemName in ITEM_TYPES) {
            const itemDef = ITEM_TYPES[itemName];
            if (itemDef.teachesRecipe && itemDef.rarity === rarity && !gameState.knownRecipes[itemDef.teachesRecipe]) {
                 plansOfRarity.push(itemName);
            }
        }
    }
    return plansOfRarity.length > 0 ? plansOfRarity[Math.floor(Math.random() * plansOfRarity.length)] : null;
}
