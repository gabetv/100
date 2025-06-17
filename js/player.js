// js/player.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS } from './config.js';

export function getTotalResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initPlayer(config) {
    return {
        x: Math.floor(config.MAP_WIDTH / 2) + 1, y: Math.floor(config.MAP_HEIGHT / 2),
        // MODIFIÉ: Santé sur 10 et ajout du statut
        health: 10,
        status: 'Normal', // 'Normal', 'Blessé', 'Empoisonné', 'Malade', etc.
        thirst: 100, 
        hunger: 100, 
        sleep: 100,
        inventory: { 'Bois': 20, 'Poisson': 10, 'Eau': 10 },
        color: '#ffd700', isBusy: false, animationState: null,
    };
}

export function movePlayer(direction, player) {
    let newX = player.x, newY = player.y;
    switch (direction) {
        case 'north': newY--; break; case 'south': newY++; break;
        case 'west': newX--; break; case 'east': newX++; break;
        default: return false;
    }
    player.x = newX; player.y = newY;
    return true;
}

export function decayStats(gameState) {
    const { player, activeEvent } = gameState;
    if (player.isBusy || player.animationState) return null;
    let decayMultiplier = 1;
    if (activeEvent.type === 'Tempête') { decayMultiplier = 1.5; }
    player.thirst = Math.max(0, player.thirst - (2 * decayMultiplier));
    player.hunger = Math.max(0, player.hunger - (1 * decayMultiplier));
    player.sleep = Math.max(0, player.sleep - (0.5 * decayMultiplier));
    
    // MODIFIÉ: La perte de vie est maintenant gérée en points entiers (sur 10)
    if (player.thirst <= 0 || player.hunger <= 0) {
        player.health = Math.max(0, player.health - 1);
        return { message: "Votre santé se dégrade !" };
    }
    return null;
}

export function transferItems(itemName, amount, from, to, toCapacity = Infinity) {
    if (!itemName || !from[itemName] || from[itemName] < amount || amount <= 0) {
        return false;
    }
    const totalInTo = getTotalResources(to);
    if (totalInTo + amount > toCapacity) {
        return false;
    }
    from[itemName] -= amount;
    to[itemName] = (to[itemName] || 0) + amount;
    if (from[itemName] <= 0) {
        delete from[itemName];
    }
    return true;
}


export function hasResources(player, costs) {
    for (const resource in costs) {
        if (!player.inventory[resource] || player.inventory[resource] < costs[resource]) {
            return { success: false, missing: resource };
        }
    }
    return { success: true };
}

export function deductResources(player, costs) {
    for (const resource in costs) {
        player.inventory[resource] -= costs[resource];
        if (player.inventory[resource] <= 0) {
            delete player.inventory[resource];
        }
    }
}

export function consumeItem(itemOrNeed, player) {
    let itemName = itemOrNeed;
    if (itemOrNeed === 'hunger') {
        if (player.inventory['Poisson Cuit'] > 0) itemName = 'Poisson Cuit';
        else if (player.inventory['Poisson'] > 0) itemName = 'Poisson';
        else return { success: false, message: "Vous n'avez rien à manger." };
    } else if (itemOrNeed === 'thirst') {
        if (player.inventory['Eau'] > 0) itemName = 'Eau';
        else return { success: false, message: "Vous n'avez rien à boire." };
    } else if (itemOrNeed === 'health') {
        if (player.inventory['Poisson Cuit'] > 0) itemName = 'Poisson Cuit';
        else return { success: false, message: "Vous n'avez rien pour vous soigner." };
    }
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
        return { success: false, message: `Vous n'avez plus de "${itemName}".` };
    }
    let result = { success: false };
    switch (itemName) {
        case 'Eau':
            player.thirst = Math.min(100, player.thirst + 30);
            result = { success: true, message: "Vous buvez de l'eau fraîche.", floatingTexts: ["+30 Soif"] };
            break;
        case 'Poisson':
            player.hunger = Math.min(100, player.hunger + 15);
            player.health = Math.max(0, player.health - 1); // -1 point de vie
            result = { success: true, message: "Manger du poisson cru n'est pas une bonne idée... (-1 Santé)", floatingTexts: ["+15 Faim", "-1 Santé"] };
            break;
        case 'Poisson Cuit':
            player.hunger = Math.min(100, player.hunger + 40);
            if(player.health < 10) { // On ne peut pas soigner au-delà du max
                player.health = Math.min(10, player.health + 1); // +1 point de vie
                result = { success: true, message: "Vous mangez un délicieux poisson cuit. (+1 Santé)", floatingTexts: ["+40 Faim", "+1 Santé"] };
            } else {
                result = { success: true, message: "Vous mangez un délicieux poisson cuit.", floatingTexts: ["+40 Faim"] };
            }
            break;
    }
    if (result.success) {
        player.inventory[itemName]--;
        if (player.inventory[itemName] <= 0) { delete player.inventory[itemName]; }
    }
    return result;
}