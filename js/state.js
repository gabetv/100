// js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, consumeItem as playerConsumeItemLogic, transferItems } from './player.js';
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
    config: { ...CONFIG, VICTORY_DAY: 200 }, // #43
    knownRecipes: {}, // Recettes apprises par le joueur
    mapTileGlobalVisitCounts: new Map(),
    globallyRevealedTiles: new Set(),
    foundUniqueParchemins: new Set(), // Point 23: Pour suivre les parchemins uniques déjà trouvés
};

export const state = gameState;

export function initializeGameState(config) {
    console.log("State.initializeGameState appelée avec config:", config);
    gameState.config = { ...config, VICTORY_DAY: 200 }; // #43 ensure victory day is set
    gameState.map = generateMap(config); // map.js génère la carte avec les actionsLeft pour les plages

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
            } else { // Fallback si aucune plage n'est trouvée (ne devrait pas arriver)
                startX = Math.floor(config.MAP_WIDTH / 2);
                startY = Math.floor(config.MAP_HEIGHT / 2);
            }
            break;
        }
    } while (
        !gameState.map[startY] ||
        !gameState.map[startY][startX] ||
        gameState.map[startY][startX].type.name !== TILE_TYPES.PLAGE.name || // Assurez-vous que PLAGE est accessible
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

    // Initialiser foundUniqueParchemins si des parchemins sont donnés au départ
    for (const itemName in gameState.player.inventory) {
        if (ITEM_TYPES[itemName]?.teachesRecipe && ITEM_TYPES[itemName]?.unique) {
            gameState.foundUniqueParchemins.add(itemName);
            gameState.knownRecipes[ITEM_TYPES[itemName].teachesRecipe] = true; // Marquer comme connu si donné au départ
        }
    }


    gameState.shelterLocation = null; // Sera défini si un abri collectif est construit
    const existingShelterTile = gameState.map.flat().find(tile =>
        tile.buildings && tile.buildings.some(b => b.key === 'SHELTER_COLLECTIVE')
    );
    if (existingShelterTile) {
        gameState.shelterLocation = { x: existingShelterTile.x, y: existingShelterTile.y };
    }

    // #42: Reveal all WATER_LAGOON tiles globally
    gameState.map.flat().forEach(tile => {
        if (tile.type.name === TILE_TYPES.WATER_LAGOON.name) {
            gameState.globallyRevealedTiles.add(`${tile.x},${tile.y}`);
        }
    });
    console.log("GameState initialisé:", gameState);
}

export function applyPlayerMove(direction) {
    const { x, y } = gameState.player;
    let newX = x, newY = y;
    if (direction === 'north') newY--;
    else if (direction === 'south') newY++;
    else if (direction === 'west') newX--;
    else if (direction === 'east') newX++;

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

export function applyBulkInventoryTransfer(itemName, amount, transferType) {
    const tile = gameState.map[gameState.player.y][gameState.player.x];
    const player = gameState.player;

    let targetInventory;
    let targetCapacity = Infinity;

    const buildingWithInventory = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory);

    if (buildingWithInventory) {
        if (!tile.inventory) tile.inventory = JSON.parse(JSON.stringify(TILE_TYPES[buildingWithInventory.key].inventory));
        targetInventory = tile.inventory;
        targetCapacity = TILE_TYPES[buildingWithInventory.key].maxInventory || Infinity;
    } else if (tile.type.inventory) { // Pour les tuiles qui ont un inventaire (ex: ancien trésor)
        if (!tile.inventory) tile.inventory = JSON.parse(JSON.stringify(tile.type.inventory));
        targetInventory = tile.inventory;
        targetCapacity = tile.type.maxInventory || Infinity;
    } else {
        return { success: false, message: "Ce lieu n'a pas de stockage." };
    }

    let from, to, success;

    if (transferType === 'deposit') {
        from = player.inventory;
        to = targetInventory;
        success = transferItems(itemName, amount, from, to, targetCapacity);
        if (success) return { success: true, message: `Vous avez déposé ${amount} ${itemName}.` };
        return { success: false, message: "Le dépôt a échoué. Quantité invalide ou stockage plein ?" };
    }

    if (transferType === 'withdraw') {
        from = targetInventory;
        to = player.inventory;
        const playerCapacity = player.maxInventory;
        success = transferItems(itemName, amount, from, to, playerCapacity);
        if (success) return { success: true, message: `Vous avez pris ${amount} ${itemName}.` };
        return { success: false, message: "Le retrait a échoué. Inventaire plein ou stock insuffisant ?" };
    }

    return { success: false, message: "Type de transfert inconnu." };
}

export function startCombat(player, enemy) {
    if (gameState.combatState) return; // Ne pas démarrer un nouveau combat si déjà en cours
    player.isBusy = true;
    gameState.combatState = {
        enemy: enemy, // L'objet ennemi complet
        isPlayerTurn: true,
        log: [`Un ${enemy.name} vous attaque !`],
    };
    console.log("Combat started with:", enemy.name, enemy.isSearchEncounter ? "(Search Encounter)" : "(Regular Enemy)");
}

export function endCombat(victory) {
    const { combatState, player } = gameState;
    if (!combatState) return;

    const enemyDefeated = combatState.enemy; // Récupérer l'ennemi du combatState

    if (victory) {
        // Si l'ennemi n'est pas une rencontre de fouille (isSearchEncounter), le retirer de la liste globale
        if (!enemyDefeated.isSearchEncounter) {
            gameState.enemies = gameState.enemies.filter(e => e.id !== enemyDefeated.id);
            console.log(`Regular enemy ${enemyDefeated.name} (ID: ${enemyDefeated.id}) removed from global list.`);
        } else {
            console.log(`Search encounter enemy ${enemyDefeated.name} (ID: ${enemyDefeated.id}) was defeated.`);
            // Les ennemis de fouille ne sont pas dans gameState.enemies, donc pas besoin de les retirer.
        }
    }

    player.isBusy = false; // Le joueur n'est plus occupé par le combat
    gameState.combatState = null; // Réinitialiser l'état du combat
    console.log("Combat ended.");
}


export function addEnemy(enemy) {
    if (enemy) {
        gameState.enemies.push(enemy);
    }
}

export function equipItem(itemName) {
    const player = gameState.player;
    const itemDef = JSON.parse(JSON.stringify(ITEM_TYPES[itemName])); // Get a clean copy of the item definition

    if (!itemDef || !player.inventory[itemName]) return { success: false, message: "Objet introuvable." };
    const slot = itemDef.slot;
    if (!slot || !player.equipment.hasOwnProperty(slot)) return { success: false, message: "Vous ne pouvez pas équiper ceci." };

    if (player.equipment[slot]) { // Si un objet est déjà équipé dans ce slot
        const unequipResult = unequipItem(slot); // Déséquiper d'abord
        if (!unequipResult.success) return unequipResult; // Si le déséquipement échoue (ex: inventaire plein)
    }

    player.inventory[itemName]--;
    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
    
    // Create a new instance for equipment, setting currentDurability to max from definition
    const newEquipInstance = { name: itemName, ...itemDef };
    if (newEquipInstance.hasOwnProperty('durability') && typeof newEquipInstance.currentDurability === 'undefined') {
        newEquipInstance.currentDurability = newEquipInstance.durability;
    }
    player.equipment[slot] = newEquipInstance;

    // Appliquer les stats de l'équipement
    if (itemDef.stats) {
        for (const stat in itemDef.stats) {
            if (stat.startsWith('max') && player.hasOwnProperty(stat)) {
                 player[stat] += itemDef.stats[stat];
                 // Si maxHealth augmente, la santé actuelle ne doit pas dépasser la nouvelle maxHealth
                 const currentStatName = stat.substring(3).toLowerCase(); // ex: maxHealth -> health
                 if (player.hasOwnProperty(currentStatName)) {
                     player[currentStatName] = Math.min(player[currentStatName], player[stat]);
                 }
            } else if (player.hasOwnProperty(stat)) { // Pour les stats non-max (rare mais possible)
                player[stat] += itemDef.stats[stat];
            }
        }
    }
    return { success: true, message: `${itemName} équipé.` };
}

export function unequipItem(slot) {
    const player = gameState.player;
    const item = player.equipment[slot];
    if (!item) return { success: false, message: "Aucun objet dans cet emplacement." };
    if (getTotalResources(player.inventory) >= player.maxInventory) return { success: false, message: "Inventaire plein." };

    addResourceToPlayer(item.name, 1); // Remettre l'objet dans l'inventaire
    player.equipment[slot] = null;

    // Retirer les stats de l'équipement
    if (item.stats) {
        for (const stat in item.stats) {
            if (stat.startsWith('max') && player.hasOwnProperty(stat)) {
                player[stat] -= item.stats[stat];
                // Ajuster la stat actuelle si elle dépasse la nouvelle max
                const currentStatName = stat.substring(3).toLowerCase(); // ex: maxHealth -> health
                if (player.hasOwnProperty(currentStatName)) {
                    player[currentStatName] = Math.min(player[currentStatName], player[stat]);
                }
            } else if (player.hasOwnProperty(stat)) {
                player[stat] -= item.stats[stat];
            }
        }
    }
    return { success: true, message: `${item.name} déséquipé.` };
}

export function addResourceToPlayer(resourceType, amount) {
    const player = gameState.player;
    player.inventory[resourceType] = (player.inventory[resourceType] || 0) + amount;
}

export function addBuildingToTile(x, y, buildingKey) {
    const tile = gameState.map[y][x];
    const buildingType = TILE_TYPES[buildingKey];
    if (!tile || !buildingType || !buildingType.isBuilding) return { success: false, message: "Type de bâtiment invalide ou tuile introuvable." };
    if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) return { success: false, message: "Nombre maximum de bâtiments atteint sur cette tuile." };

    // La condition de construction sur Plaine (sauf exceptions)
    if (tile.type.name !== TILE_TYPES.PLAINS.name &&
        buildingKey !== 'MINE' &&
        buildingKey !== 'CAMPFIRE' &&
        buildingKey !== 'PETIT_PUIT' // PETIT_PUIT est une exception ici
    ) {
         return { success: false, message: "Ce bâtiment ne peut être construit que sur une Plaine."};
    }
    // Pour les bâtiments qui ne sont PAS des exceptions, s'assurer que la tuile est buildable
    if (!tile.type.buildable && buildingKey !== 'MINE' && buildingKey !== 'CAMPFIRE' && buildingKey !== 'PETIT_PUIT') {
        return { success: false, message: "Vous ne pouvez pas construire sur ce type de terrain." };
    }

    // For plantation/animal buildings, initialize harvestsAvailable and maxHarvestsPerCycle
    const buildingData = { key: buildingKey, durability: buildingType.durability, maxDurability: buildingType.durability };
    if (buildingType.maxHarvestsPerCycle) { // #18
        buildingData.harvestsAvailable = 0; // Start with 0, requires watering/feeding
        buildingData.maxHarvestsPerCycle = buildingType.maxHarvestsPerCycle;
    }


    tile.buildings.push(buildingData);
    if (buildingType.inventory && !tile.inventory) tile.inventory = JSON.parse(JSON.stringify(buildingType.inventory));
    if (buildingKey === 'SHELTER_COLLECTIVE') gameState.shelterLocation = { x, y };

    return { success: true, message: `${buildingType.name} construit.` };
}

// Point 14: Nouvelle fonction pour démanteler
export function dismantleBuildingOnTile(tileX, tileY, buildingIndex) {
    const tile = gameState.map[tileY][tileX];
    if (!tile || !tile.buildings[buildingIndex]) return { success: false, message: "Bâtiment introuvable." };

    const buildingInstance = tile.buildings[buildingIndex];
    const buildingDef = TILE_TYPES[buildingInstance.key];
    if (!buildingDef || !buildingDef.cost) return { success: false, message: "Définition du bâtiment ou coûts introuvables." };

    let recoveredResourcesMessage = "Ressources récupérées: ";
    let anythingRecovered = false;

    const costsToConsider = { ...buildingDef.cost };
    delete costsToConsider.toolRequired; // Ne pas récupérer les outils requis pour la construction

    for (const resourceName in costsToConsider) {
        const costAmount = costsToConsider[resourceName];
        const recoveredAmount = Math.floor(costAmount * 0.25); // 25% arrondi à l'inférieur
        if (recoveredAmount > 0) {
            addResourceToPlayer(resourceName, recoveredAmount);
            recoveredResourcesMessage += `${recoveredAmount} ${resourceName}, `;
            anythingRecovered = true;
        }
    }
    if (!anythingRecovered) recoveredResourcesMessage = "Aucune ressource substantielle n'a pu être récupérée.";
    else recoveredResourcesMessage = recoveredResourcesMessage.slice(0, -2) + "."; // Enlever la dernière virgule et espace


    tile.buildings.splice(buildingIndex, 1); // Supprimer le bâtiment du tableau
    // Gérer la perte du shelterLocation si c'était un abri collectif
    if (buildingInstance.key === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
        const anotherShelter = gameState.map.flat().find(t => t.buildings.some(b => b.key === 'SHELTER_COLLECTIVE'));
        gameState.shelterLocation = anotherShelter ? { x: anotherShelter.x, y: anotherShelter.y } : null;
    }
    // Optionnel: Gérer l'inventaire du bâtiment détruit (par ex, le déposer au sol)
     if (buildingDef.inventory && tile.inventory) { // Si le bâtiment avait un inventaire ET la tuile en avait un
        for (const item in tile.inventory) {
            if (tile.inventory[item] > 0) {
                dropItemOnGround(item, tile.inventory[item]); // Dépose les objets au sol
            }
        }
        delete tile.inventory; // Supprime l'inventaire de la tuile
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
        tile.buildings.splice(buildingIndexInTileArray, 1);
        // Gérer la perte du shelterLocation si c'était un abri collectif
        if (buildingKeyDestroyed === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
            const anotherShelter = gameState.map.flat().find(t => t.buildings.some(b => b.key === 'SHELTER_COLLECTIVE'));
            gameState.shelterLocation = anotherShelter ? { x: anotherShelter.x, y: anotherShelter.y } : null;
        }
         // Gérer l'inventaire du bâtiment détruit
        if (TILE_TYPES[buildingKeyDestroyed]?.inventory && tile.inventory && !tile.buildings.some(b => TILE_TYPES[b.key]?.inventory)) {
            for (const item in tile.inventory) {
                if (tile.inventory[item] > 0) dropItemOnGround(item, tile.inventory[item]);
            }
            delete tile.inventory;
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
        tile.woodActionsLeft = newTerrainType.woodActionsLeft; // Re-initialize action counts
        tile.huntActionsLeft = newTerrainType.huntActionsLeft;
        tile.searchActionsLeft = newTerrainType.searchActionsLeft;
    } else if (newTerrainTypeKey === 'PLAINS') {
        tile.huntActionsLeft = newTerrainType.huntActionsLeft;
        tile.searchActionsLeft = newTerrainType.searchActionsLeft;
    } else if (newTerrainTypeKey === 'MINE_TERRAIN') {
        tile.harvestsLeft = newTerrainType.harvests; // For stone
    }
    // Point 1: Si la tuile devient Plage, initialiser les actions disponibles
    if (newTerrainTypeKey === 'PLAGE') {
        tile.actionsLeft = { ...TILE_TYPES.PLAGE.actionsAvailable }; // Copie profonde
    } else {
        delete tile.actionsLeft; // Supprimer si ce n'est plus une plage
    }
}

export function hasResources(costs) { // Vérifie uniquement l'inventaire du joueur
    const player = gameState.player;
    for (const resource in costs) {
        const playerAmount = player.inventory[resource] || 0;
        if (playerAmount < costs[resource]) return { success: false, missing: resource };
    }
    return { success: true };
}

export function applyResourceDeduction(costs) { // Déduit uniquement de l'inventaire du joueur
    const player = gameState.player;
    for (const resource in costs) {
        let needed = costs[resource];
        if (player.inventory[resource] > 0) {
            const takeFromPlayer = Math.min(needed, player.inventory[resource]);
            player.inventory[resource] -= takeFromPlayer;
            if (player.inventory[resource] <= 0) delete player.inventory[resource];
            needed -= takeFromPlayer;
        }
        if (needed > 0) console.warn(`[applyResourceDeduction] Manque de ${resource} après tentative de déduction de l'inventaire joueur.`);
    }
}

export function consumeItem(itemName) {
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];
    let result = playerConsumeItemLogic(itemName, player); // Appelle la logique de base de player.js

    // Si la logique de base a échoué (ex: pas d'item, conditions de stats non remplies), retourner ce résultat
    if (!result.success && !itemDef?.teachesRecipe && !(itemName === 'Carte' && itemDef?.uses) && !(itemName === 'Batterie chargée')) {
        return result;
    }

    // Cas spécial pour la carte qui a des "uses"
    if (itemName === 'Carte' && itemDef?.uses) {
        // La logique d'ouverture de la carte est dans interactions.js
        // Décrémenter les "uses" ici
        if (player.inventory[itemName] > 0) {
            const carteItem = ITEM_TYPES[itemName]; // Accéder à la définition pour les uses
            if (!player.inventoryUses) player.inventoryUses = {};
            if (!player.inventoryUses[itemName]) player.inventoryUses[itemName] = carteItem.uses;

            player.inventoryUses[itemName]--;
            result.message = `Vous consultez la carte (${player.inventoryUses[itemName]} utilisations restantes).`;
            if (player.inventoryUses[itemName] <= 0) {
                delete player.inventory[itemName]; // Supprimer de l'inventaire principal
                delete player.inventoryUses[itemName]; // Supprimer le compteur d'usages
                result.message = "La carte s'est désintégrée après sa dernière utilisation.";
            }
        }
        return { success: true, message: result.message, floatingTexts: result.floatingTexts || [] };
    }

    if (itemDef?.teachesRecipe) {
        if (gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.isBuildingRecipe) {
            result.message = `Vous relisez le parchemin de ${itemDef.teachesRecipe}. Vous connaissez déjà cette recette.`;
            // Ne pas consommer le parchemin s'il est déjà connu et n'est pas une recette de bâtiment (pourrait être réutilisable pour rappel)
        } else {
            gameState.knownRecipes[itemDef.teachesRecipe] = true;
            gameState.foundUniqueParchemins.add(itemName); // Marquer comme trouvé si unique
            result.message = `Vous avez appris la recette : ${itemDef.teachesRecipe} !`;
            // Consommer le parchemin
            if (player.inventory[itemName] > 0) {
                player.inventory[itemName]--;
                if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
            } else { return { success: false, message: "Erreur: Parchemin non trouvé pour apprendre la recette."}; }
        }
        result.success = true; // Assurer que success est true
    } else if (itemDef?.effects?.custom) {
        // Logiques custom spécifiques
        if (itemDef.effects.custom === 'porteBonheur') { /* ... */ }
        else if (itemDef.effects.custom === 'eauSaleeEffect') { // #35
            if (player.status === 'Malade') {
                // Déjà géré par l'effet health: -1 dans config
            } else {
                if (Math.random() < 0.60) { // 60% chance de tomber malade
                    player.status = 'Malade';
                    if (!result.floatingTexts) result.floatingTexts = [];
                    result.floatingTexts.push('Statut: Malade');
                }
            }
        } else if (itemDef.effects.custom === 'eauCroupieEffect') { // #34
            if (Math.random() < 0.80) { // 80% Malade
                player.status = 'Malade';
                if (!result.floatingTexts) result.floatingTexts = [];
                result.floatingTexts.push('Statut: Malade');
            }
        } else if (itemDef.effects.custom === 'drogueEffect') { // Point 35
            player.status = 'Drogué';
            if (!result.floatingTexts) result.floatingTexts = [];
            result.floatingTexts.push('Statut: Drogué');
        } else if (itemDef.effects.custom === 'chargeDevice') { // Point 15
            if (player.equipment.weapon) {
                const equippedWeaponName = player.equipment.weapon.name;
                let chargedItemName = null;
                if (equippedWeaponName === 'Radio déchargée') chargedItemName = 'Radio chargée';
                else if (equippedWeaponName === 'Téléphone déchargé') chargedItemName = 'Téléphone chargé';

                if (chargedItemName) {
                    const unequipSuccess = unequipItem('weapon'); // Déséquipe la version déchargée
                    if (unequipSuccess.success) {
                        addResourceToPlayer(chargedItemName, 1); // Ajoute la version chargée à l'inventaire
                        // Retirer la batterie chargée de l'inventaire
                        if (player.inventory['Batterie chargée'] > 0) {
                            player.inventory['Batterie chargée']--;
                            if (player.inventory['Batterie chargée'] <= 0) delete player.inventory['Batterie chargée'];
                        }
                        result.message = `${ITEM_TYPES[chargedItemName]?.name || chargedItemName} obtenue et ajoutée à l'inventaire ! Équipez-la pour l'utiliser.`;
                        result.success = true;
                    } else {
                        result.success = false;
                        result.message = "Impossible de déséquiper l'appareil actuel.";
                    }
                } else {
                    result.success = false;
                    result.message = "Vous devez équiper une radio ou un téléphone déchargé pour utiliser la batterie.";
                }
            } else {
                 result.success = false;
                 result.message = "Vous devez équiper un appareil pour le charger.";
            }
        }
        if (result.success && !result.message && itemDef.effects.custom) {
            result.message = `Vous utilisez: ${itemName}.`;
        }
    }
    return result;
}


export function dropItemOnGround(itemName, quantity) {
    const player = gameState.player;
    if (!player.inventory[itemName] || player.inventory[itemName] < quantity) {
        return { success: false, message: "Quantité insuffisante dans l'inventaire." };
    }
    const tile = gameState.map[player.y][player.x];
    if (!tile.groundItems) tile.groundItems = {};

    player.inventory[itemName] -= quantity;
    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];

    tile.groundItems[itemName] = (tile.groundItems[itemName] || 0) + quantity;
    return { success: true, message: `Vous avez déposé ${quantity} ${itemName} au sol.` };
}

export function pickUpItemFromGround(itemName, quantity) {
    const player = gameState.player;
    const tile = gameState.map[player.y][player.x];
    if (!tile.groundItems || !tile.groundItems[itemName] || tile.groundItems[itemName] < quantity) {
        return { success: false, message: "Quantité insuffisante au sol." };
    }

    const currentTotalResources = getTotalResources(player.inventory);
    if (currentTotalResources + quantity > player.maxInventory) {
        return { success: false, message: "Inventaire plein." };
    }

    tile.groundItems[itemName] -= quantity;
    if (tile.groundItems[itemName] <= 0) delete tile.groundItems[itemName];

    player.inventory[itemName] = (player.inventory[itemName] || 0) + quantity;
    return { success: true, message: `Vous avez ramassé ${quantity} ${itemName}.` };
}

export function countItemTypeInInventory(itemTypeIdentifier) {
    let count = 0;
    for (const itemName in gameState.player.inventory) {
        const itemDef = ITEM_TYPES[itemName];
        // Check for 'teachesRecipe' specifically or other identifiers if needed
        if (itemDef && itemDef.teachesRecipe && (itemTypeIdentifier === 'teachesRecipe' || itemDef.teachesRecipe === itemTypeIdentifier)) {
            count += gameState.player.inventory[itemName];
        } else if (itemDef && itemDef[itemTypeIdentifier]) { // Generic identifier check
             count += gameState.player.inventory[itemName];
        }
    }
    return count;
}