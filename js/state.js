// js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, hasResources as playerHasResources, deductResources, consumeItem as playerConsumeItem, transferItems } from './player.js';
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
    config: null,
    knownRecipes: { // Pour stocker les recettes apprises par le joueur
        // Initial recipes (example, or could be empty)
        'Planche': true, // 10 Bois -> 1 Planche (exemple de recette de base de l'atelier)
    },
};

export const state = gameState;

export function initializeGameState(config) {
    gameState.map = generateMap(config);
    gameState.player = initPlayer(config);
    gameState.npcs = initNpcs(config, gameState.map);
    gameState.enemies = initEnemies(config, gameState.map);
    
    gameState.shelterLocation = null; 
    
    const existingShelterTile = gameState.map.flat().find(tile => 
        tile.buildings && tile.buildings.some(b => b.key === 'SHELTER_COLLECTIVE')
    );
    if (existingShelterTile) {
        gameState.shelterLocation = { x: existingShelterTile.x, y: existingShelterTile.y };
    }
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
}

export function applyBulkInventoryTransfer(itemName, amount, transferType) {
    const tile = gameState.map[gameState.player.y][gameState.player.x];
    const player = gameState.player;

    // L'inventaire est maintenant lié au bâtiment principal sur la tuile, s'il en a un.
    // Ou directement à la tuile si c'est un SHELTER_COLLECTIVE (géré par shelterLocation).
    // Pour l'instant, on garde la logique simple: si la tuile *peut* avoir un inventaire.
    let targetInventory;
    let targetCapacity = Infinity;

    // Chercher un bâtiment avec inventaire sur la tuile actuelle
    const buildingWithInventory = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory);
    
    if (buildingWithInventory) {
        // Si tile.inventory n'existe pas pour ce bâtiment, il faut l'initialiser
        if (!tile.inventory) tile.inventory = JSON.parse(JSON.stringify(TILE_TYPES[buildingWithInventory.key].inventory));
        targetInventory = tile.inventory;
        targetCapacity = TILE_TYPES[buildingWithInventory.key].maxInventory || Infinity;
    } else if (tile.type.inventory) { // Fallback pour les structures comme le trésor qui ne sont pas dans `buildings`
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
    if (gameState.combatState) return;
    player.isBusy = true;
    gameState.combatState = {
        enemy: enemy,
        isPlayerTurn: true,
        log: [`Un ${enemy.name} vous attaque !`],
    };
    console.log("Combat started with:", enemy.name);
}

export function endCombat(victory) {
    const { combatState, player } = gameState;
    if (!combatState) return;
    
    if (victory) {
        const enemy = combatState.enemy;
        Object.keys(enemy.loot).forEach(resource => {
            addResourceToPlayer(resource, enemy.loot[resource]);
        });
        
        gameState.enemies = gameState.enemies.filter(e => e.id !== enemy.id);
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

export function equipItem(itemName) {
    console.log(`[State.equipItem] Appelée avec l'objet : '${itemName}'`);
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];
    
    if (!itemDef || !player.inventory[itemName]) {
        console.error(`[State.equipItem] ÉCHEC : L'objet '${itemName}' est introuvable ou n'est plus dans l'inventaire.`);
        return { success: false, message: "Objet introuvable." };
    }
    
    const slot = itemDef.slot;
    console.log(`[State.equipItem] L'objet a le slot : '${slot}'.`);

    if (!slot || !player.equipment.hasOwnProperty(slot)) {
        console.error(`[State.equipItem] ÉCHEC : L'objet n'a pas de slot valide ou le joueur n'a pas cet emplacement d'équipement. Slot de l'objet : ${slot}`);
        return { success: false, message: "Vous ne pouvez pas équiper ceci." };
    }

    if (player.equipment[slot]) {
        console.log(`[State.equipItem] Le slot '${slot}' est déjà occupé par '${player.equipment[slot].name}'. Tentative de déséquipement.`);
        const unequipResult = unequipItem(slot);
        if (!unequipResult.success) {
            console.error(`[State.equipItem] ÉCHEC : Le déséquipement de l'objet précédent a échoué. Message: ${unequipResult.message}`);
            return unequipResult;
        }
    }

    player.inventory[itemName]--;
    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
    
    const newEquip = { name: itemName, ...itemDef };
    if(newEquip.durability) newEquip.currentDurability = newEquip.durability;
    player.equipment[slot] = newEquip;

    if (itemDef.stats) {
        for (const stat in itemDef.stats) {
            if (player.hasOwnProperty(stat)) {
                player[stat] += itemDef.stats[stat];
            }
        }
    }
    
    console.log(`[State.equipItem] SUCCÈS : '${itemName}' a été équipé dans le slot '${slot}'.`);
    return { success: true, message: `${itemName} équipé.` };
}

export function unequipItem(slot) {
    const player = gameState.player;
    const item = player.equipment[slot];
    if (!item) return { success: false, message: "Aucun objet dans cet emplacement." };
    
    if (getTotalResources(player.inventory) >= player.maxInventory) {
        return { success: false, message: "Inventaire plein." };
    }

    addResourceToPlayer(item.name, 1); // Remet l'objet avec sa durabilité actuelle si gérée ainsi, sinon 1 item.
    player.equipment[slot] = null;
    
    if (item.stats) {
        for (const stat in item.stats) {
            if (player.hasOwnProperty(stat)) {
                player[stat] -= item.stats[stat];
                const currentStat = stat.replace('max', '').toLowerCase();
                if(player.hasOwnProperty(currentStat)) {
                    player[currentStat] = Math.min(player[currentStat], player[stat]);
                }
            }
        }
    }
    
    return { success: true, message: `${item.name} déséquipé.` };
}

export function addResourceToPlayer(resourceType, amount) {
    const player = gameState.player;
    player.inventory[resourceType] = (player.inventory[resourceType] || 0) + amount;
}

// Modifié pour gérer les bâtiments sur une tuile
export function addBuildingToTile(x, y, buildingKey) {
    const tile = gameState.map[y][x];
    const buildingType = TILE_TYPES[buildingKey];

    if (!tile || !buildingType || !buildingType.isBuilding) {
        return { success: false, message: "Type de bâtiment invalide ou tuile introuvable." };
    }
    if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) {
        return { success: false, message: "Nombre maximum de bâtiments atteint sur cette tuile." };
    }
    if (!tile.type.buildable) { // Vérifier si le terrain de base est constructible
         return { success: false, message: "Vous ne pouvez pas construire ici." };
    }
     if (tile.type.name !== TILE_TYPES.PLAINS.name && buildingKey !== 'MINE' && buildingKey !== 'CAMPFIRE') { // MINE et CAMPFIRE peuvent avoir des règles différentes
        // Cas spécifique pour la plupart des bâtiments sur Plaine
        if (Object.values(TILE_TYPES).find(t => t === tile.type)?.name !== TILE_TYPES.PLAINS.name) {
             return { success: false, message: "Ce bâtiment ne peut être construit que sur une Plaine."};
        }
    }


    tile.buildings.push({
        key: buildingKey,
        durability: buildingType.durability,
        maxDurability: buildingType.durability,
    });

    // Si le bâtiment a un inventaire et que la tuile n'en a pas encore, initialiser.
    // (Gestion d'inventaires multiples par tuile serait plus complexe)
    if (buildingType.inventory && !tile.inventory) {
        tile.inventory = JSON.parse(JSON.stringify(buildingType.inventory));
    }
    
    // Si un SHELTER_COLLECTIVE est construit, mettre à jour shelterLocation
    if (buildingKey === 'SHELTER_COLLECTIVE') {
        gameState.shelterLocation = { x, y };
    }

    return { success: true, message: `${buildingType.name} construit.` };
}

// Fonction pour gérer la diminution de durabilité
export function damageBuilding(tileX, tileY, buildingIndexInTileArray, damageAmount = 1) {
    const tile = gameState.map[tileY][tileX];
    if (!tile || !tile.buildings[buildingIndexInTileArray]) return;

    const building = tile.buildings[buildingIndexInTileArray];
    building.durability -= damageAmount;

    if (building.durability <= 0) {
        const buildingName = TILE_TYPES[building.key].name;
        // Supprimer le bâtiment de la liste
        tile.buildings.splice(buildingIndexInTileArray, 1);
        // Si c'était un SHELTER_COLLECTIVE et le seul, réinitialiser shelterLocation
        if (building.key === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
            const anotherShelter = gameState.map.flat().find(t => t.buildings.some(b => b.key === 'SHELTER_COLLECTIVE'));
            gameState.shelterLocation = anotherShelter ? { x: anotherShelter.x, y: anotherShelter.y } : null;
        }
        // Si le bâtiment détruit avait l'inventaire principal de la tuile, on pourrait le vider ou le laisser tomber au sol (logique à ajouter)
        // Pour l'instant, on ne le gère pas.
        return { destroyed: true, name: buildingName };
    }
    return { destroyed: false };
}


// Remplacer l'ancien updateTileType
export function updateTileType(x, y, newTerrainTypeKey) { // newTerrainTypeKey est la clé du type de terrain (ex: WASTELAND)
    const tile = gameState.map[y][x];
    const newTerrainType = TILE_TYPES[newTerrainTypeKey];

    if (!tile || !newTerrainType) return;

    tile.type = newTerrainType; // Change le type de terrain de base
    if (newTerrainType.background && newTerrainType.background.length > 0) {
        tile.backgroundKey = newTerrainType.background[Math.floor(Math.random() * newTerrainType.background.length)];
    }
    tile.harvestsLeft = (newTerrainType.harvests === Infinity) ? Infinity : (newTerrainType.harvests || 0);
    tile.resources = newTerrainType.resource ? { ...newTerrainType.resource } : null;
    
    // Si on change le terrain en quelque chose qui n'est pas constructible, on pourrait détruire les bâtiments ?
    // Pour l'instant, on ne le fait pas. La vérification de constructibilité se fait à la construction.
}


export function consumeItem(itemName) {
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];
    let result = { success: false, message: "Erreur de consommation." };

    if (itemDef && itemDef.type === 'consumable' && itemDef.teachesRecipe) {
        if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
            return { success: false, message: "Vous n'en avez plus." };
        }
        gameState.knownRecipes[itemDef.teachesRecipe] = true;
        player.inventory[itemName]--;
        if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
        // TODO: Envoyer un message à tous les joueurs si multijoueur. Pour l'instant, message local.
        // UI.addChatMessage(`${player.name} a débloqué la recette : ${itemDef.teachesRecipe} !`, "system_event", "Tous");
        return { success: true, message: `Vous avez appris la recette : ${itemDef.teachesRecipe} !` };
    } else {
        // Logique de consommation standard
        result = playerConsumeItem(itemName, player);

        // Effet spécial pour Porte bonheur
        if (result.success && itemName === 'Porte bonheur' && itemDef.effects.custom === 'porteBonheur') {
            if (Math.random() < 0.5) { // 50% chance de restaurer stats
                player.health = player.maxHealth;
                player.thirst = player.maxThirst;
                player.hunger = player.maxHunger;
                player.sleep = player.maxSleep;
                if(result.floatingTexts) { // S'assurer que floatingTexts existe
                    result.floatingTexts.push("Stats restaurées !");
                } else {
                    result.floatingTexts = ["Stats restaurées !"];
                }
            }
            if (Math.random() < 0.5) { // 50% chance de trouver parchemin
                const parcheminOfftableKey = Object.keys(ITEM_TYPES).find(key => 
                    key.startsWith('Parchemin Atelier') && ITEM_TYPES[key].rarity === 'offtable'
                ); // Prend le premier offtable, pourrait être aléatoire
                if (parcheminOfftableKey) {
                    addResourceToPlayer(parcheminOfftableKey, 1);
                     if(result.floatingTexts) {
                        result.floatingTexts.push(`+1 ${parcheminOfftableKey}`);
                    } else {
                        result.floatingTexts = [`+1 ${parcheminOfftableKey}`];
                    }
                }
            }
        }
    }
    return result;
}

export function hasResources(costs) {
    return playerHasResources(gameState.player, costs);
}

export function applyResourceDeduction(costs) {
    deductResources(gameState.player, costs);
}