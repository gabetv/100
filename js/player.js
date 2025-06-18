// js/player.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ITEM_TYPES } from './config.js';

export function getTotalResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initPlayer(config) {
    return {
        x: Math.floor(config.MAP_WIDTH / 2) + 1, y: Math.floor(config.MAP_HEIGHT / 2),
        health: 10,
        status: 'Normal',
        thirst: 100, 
        hunger: 100, 
        sleep: 100,
        inventory: { 
            'Bois': 10,
            'Kit de Secours': 1,
            'Barre Énergétique': 2,
            'Ration d\'eau pure': 1
        },
        equipment: {
            weapon: null,
            armor: null,
        },
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
    let itemDef = ITEM_TYPES[itemName];
    let floatingTexts = [];

    if (itemOrNeed === 'hunger') {
        itemName = player.inventory['Barre Énergétique'] > 0 ? 'Barre Énergétique' : 
                   player.inventory['Poisson Cuit'] > 0 ? 'Poisson Cuit' : 
                   player.inventory['Poisson'] > 0 ? 'Poisson' : null;
        if (!itemName) return { success: false, message: "Vous n'avez rien à manger." };
    } else if (itemOrNeed === 'thirst') {
        itemName = player.inventory['Ration d\'eau pure'] > 0 ? 'Ration d\'eau pure' :
                   player.inventory['Eau'] > 0 ? 'Eau' : null;
        if (!itemName) return { success: false, message: "Vous n'avez rien à boire." };
    } else if (itemOrNeed === 'health') {
        itemName = player.inventory['Kit de Secours'] > 0 ? 'Kit de Secours' :
                   player.inventory['Poisson Cuit'] > 0 ? 'Poisson Cuit' : null;
        if (!itemName) return { success: false, message: "Vous n'avez rien pour vous soigner." };
    }
    
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
        return { success: false, message: `Vous n'avez plus de "${itemName}".` };
    }
    
    itemDef = ITEM_TYPES[itemName];

    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.effects)) {
        if (itemName === 'Poisson') {
            player.hunger = Math.min(100, player.hunger + 15);
            player.health = Math.max(0, player.health - 1);
            floatingTexts.push("+15 Faim", "-1 Santé");
        } else if(itemName === 'Eau') {
            player.thirst = Math.min(100, player.thirst + 30);
            floatingTexts.push("+30 Soif");
        } else {
            return { success: false, message: `Vous ne pouvez pas consommer "${itemName}".` };
        }
    } else {
        for (const effect in itemDef.effects) {
            const value = itemDef.effects[effect];
            switch (effect) {
                case 'health':
                    if (player.health < 10) {
                        player.health = Math.min(10, player.health + value);
                        floatingTexts.push(`+${value} Santé`);
                    }
                    break;
                case 'thirst':
                    player.thirst = Math.min(100, player.thirst + value);
                    floatingTexts.push(`+${value} Soif`);
                    break;
                case 'hunger':
                    player.hunger = Math.min(100, player.hunger + value);
                    floatingTexts.push(`+${value} Faim`);
                    break;
                case 'sleep':
                    player.sleep = Math.min(100, player.sleep + value);
                    floatingTexts.push(`+${value} Sommeil`);
                    break;
                case 'status':
                    player.status = value;
                    floatingTexts.push(`Statut: ${value}`);
                    break;
            }
        }
    }

    player.inventory[itemName]--;
    if (player.inventory[itemName] <= 0) {
        delete player.inventory[itemName];
    }
    
    return { success: true, message: `Vous utilisez: ${itemName}.`, floatingTexts };
}