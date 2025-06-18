// js/player.js
import { CONFIG, ITEM_TYPES } from './config.js';

export function getTotalResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initPlayer(config) {
    return {
        x: Math.floor(config.MAP_WIDTH / 2) + 1, y: Math.floor(config.MAP_HEIGHT / 2),
        // Stats de base
        health: 10, thirst: 10, hunger: 10, sleep: 10,
        status: 'Normal', // Normal, Blessé, Malade, Empoisonné
        // Stats max (peuvent être modifiées par l'équipement)
        maxHealth: 10, maxThirst: 10, maxHunger: 10, maxSleep: 10, maxInventory: CONFIG.PLAYER_BASE_MAX_RESOURCES,
        
        inventory: { 
            'Hache': 1,
            'Canne à pêche': 1,
            'Kit de Secours': 1,
            'Barre Énergétique': 2,
            'Eau pure': 1,
        },
        equipment: {
            head: null, body: null, feet: null, weapon: null, bag: null,
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
    let stormEffect = activeEvent.type === 'Tempête';

    let messages = [];

    // Les effets des états (malus passifs)
    switch (player.status) {
        case 'Malade':
            player.hunger = Math.max(0, player.hunger - 1);
            player.thirst = Math.max(0, player.thirst - 1);
            messages.push("Vous vous sentez fiévreux (-1 faim, -1 soif).");
            break;
        case 'Empoisonné':
            player.health = Math.max(0, player.health - 1);
            messages.push("Le poison vous ronge ! (-1 Santé).");
            break;
        case 'Blessé':
            player.sleep = Math.max(0, player.sleep - 1);
            messages.push("Votre blessure vous fatigue (-1 sommeil).");
            break;
    }
    
    // Le malus de la tempête reste, mais il agit directement
    if (stormEffect) {
        player.sleep = Math.max(0, player.sleep - 2);
        messages.push("La tempête vous épuise (-2 sommeil).");
    }
    
    // Sanction si la faim ou la soif sont à zéro
    if (player.thirst <= 0) {
        player.health = Math.max(0, player.health - 1);
        messages.push("La déshydratation vous affaiblit ! (-1 Santé).");
    }
    if (player.hunger <= 0) {
        player.health = Math.max(0, player.health - 1);
        messages.push("La faim vous tiraille ! (-1 Santé).");
    }
    
    if (messages.length === 0) return null;
    
    return { message: messages.join(' ') };
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

export function consumeItem(itemName, player) {
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef || itemDef.type !== 'consumable') {
        return { success: false, message: `Vous ne pouvez pas consommer "${itemName}".` };
    }
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
        return { success: false, message: "Vous n'en avez plus." };
    }

    let floatingTexts = [];

    // Appliquer les effets
    for (const effect in itemDef.effects) {
        const value = itemDef.effects[effect];
        
        if (effect === 'status') {
            const statusEffect = value; // Simplifié pour cet exemple
            const condition = statusEffect.ifStatus;
            const canApply = !condition || (Array.isArray(condition) ? condition.includes(player.status) : player.status === condition);

            if (canApply && (!statusEffect.chance || Math.random() < statusEffect.chance)) {
                player.status = statusEffect.name;
                floatingTexts.push(`Statut: ${player.status}`);
            }
        } else {
            const maxStatName = `max${effect.charAt(0).toUpperCase() + effect.slice(1)}`;
            if(player.hasOwnProperty(effect) && player.hasOwnProperty(maxStatName)) {
                player[effect] = Math.min(player[maxStatName], player[effect] + value);
                const sign = value > 0 ? '+' : '';
                floatingTexts.push(`${sign}${value} ${effect}`);
            }
        }
    }

    player.inventory[itemName]--;
    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];

    return { success: true, message: `Vous utilisez: ${itemName}.`, floatingTexts };
}