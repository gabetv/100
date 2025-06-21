// js/player.js
import { CONFIG, ITEM_TYPES } from './config.js';
import * as State from './state.js'; 

export function getTotalResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initPlayer(config, playerId = 'player1') { 
    return {
        id: playerId, 
        x: 0, y: 0, 
        health: 10, thirst: 10, hunger: 10, sleep: 10,
        status: 'Normal', // MODIFIÉ (Point 13)
        maxHealth: 10, maxThirst: 10, maxHunger: 10, maxSleep: 10, maxInventory: CONFIG.PLAYER_BASE_MAX_RESOURCES,

        inventory: {
            'Hache': 1,
            'Canne à pêche': 1,
            'Kit de Secours': 1,
            'Barre Énergétique': 22, 
            'Eau pure': 21,          
            'Clé du Trésor': 1,
            'Allumettes': 5,
            'Carte': 1, 
        },
        equipment: {
            head: null, body: null, feet: null, weapon: null, shield: null, bag: null, 
        },
        color: '#ffd700', isBusy: false, animationState: null,
        visitedTiles: new Set(), 
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

    switch (player.status) {
        case 'Malade':
            if (player.hunger > 0) player.hunger = Math.max(0, player.hunger - 1);
            if (player.thirst > 0) player.thirst = Math.max(0, player.thirst - 1);
            messages.push("Vous vous sentez fiévreux (-1 faim, -1 soif).");
            break;
        case 'Empoisonné':
            if (player.health > 0) player.health = Math.max(0, player.health - 1);
            messages.push("Le poison vous ronge ! (-1 Santé).");
            break;
        case 'Blessé':
            if (player.sleep > 0) player.sleep = Math.max(0, player.sleep - 1);
            messages.push("Votre blessure vous fatigue (-1 sommeil).");
            break;
    }

    if (stormEffect) {
        if (player.sleep > 0) player.sleep = Math.max(0, player.sleep - 2); else if (player.sleep === 0 && player.health > 0) player.health--; 
        messages.push("La tempête vous épuise (-2 sommeil).");
    }

    if (player.thirst <= 0) {
        if (player.health > 0) player.health = Math.max(0, player.health - 1);
        messages.push("La déshydratation vous affaiblit ! (-1 Santé).");
    }
    if (player.hunger <= 0) {
        if (player.health > 0) player.health = Math.max(0, player.health - 1);
        messages.push("La faim vous tiraille ! (-1 Santé).");
    }
     if (player.sleep <= 0) { 
        if (player.health > 0) player.health = Math.max(0, player.health - 1);
        messages.push("L'épuisement vous ronge ! (-1 Santé).");
    }


    if (messages.length === 0) return null;
    return { message: messages.join(' ') };
}

export function transferItems(itemName, amount, from, to, toCapacity = Infinity) {
    if (!itemName || !from[itemName] || from[itemName] < amount || amount <= 0 ) {
        return false;
    }
    const totalInTo = getTotalResources(to);
    if (totalInTo + amount > toCapacity) { return false; }

    from[itemName] -= amount;
    to[itemName] = (to[itemName] || 0) + amount;
    if (from[itemName] <= 0) {
        delete from[itemName];
    }
    return true;
}

export function consumeItem(itemName, player) {
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe && itemDef.type !== 'usable' && itemDef.type !== 'key') ) { 
        return { success: false, message: `Vous ne pouvez pas utiliser "${itemName}" ainsi.` };
    }
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
        return { success: false, message: "Vous n'en avez plus." };
    }

    let floatingTexts = [];

    if (itemName === 'Carte' && itemDef.uses) {
        // Logique dans main.js
    } else if (itemDef.teachesRecipe) {
        // Logique dans State.consumeItem
    } else { 
        for (const effect in itemDef.effects) {
            const value = itemDef.effects[effect];

            if (effect === 'status') {
                const statusEffect = value;
                const conditionMet = !statusEffect.ifStatus ||
                                     (Array.isArray(statusEffect.ifStatus) ? statusEffect.ifStatus.includes(player.status) : player.status === statusEffect.ifStatus);

                if (conditionMet && (!statusEffect.chance || Math.random() < statusEffect.chance)) {
                    player.status = statusEffect.name;
                    floatingTexts.push(`Statut: ${player.status}`);
                }
            } else if (effect === 'custom') {
                // Logique custom gérée dans State.consumeItem
            } else if (player.hasOwnProperty(effect)) { 
                const maxStatName = `max${effect.charAt(0).toUpperCase() + effect.slice(1)}`;
                if(player.hasOwnProperty(maxStatName)) {
                    player[effect] = Math.min(player[maxStatName], player[effect] + value);
                    // const sign = value >= 0 ? '+' : ''; // MODIFIÉ (Point 23)
                    // let icon = ''; // MODIFIÉ (Point 23)
                    // if(effect === 'health') icon = '❤️'; // MODIFIÉ (Point 23)
                    // else if(effect === 'thirst') icon = '💧'; // MODIFIÉ (Point 23)
                    // else if(effect === 'hunger') icon = '🍗'; // MODIFIÉ (Point 23)
                    // else if(effect === 'sleep') icon = '🌙'; // MODIFIÉ (Point 23)
                    // floatingTexts.push(`${sign}${value}${icon}`); // MODIFIÉ (Point 23)
                }
            }
        }
    }

    if (itemName !== 'Carte' || !itemDef.uses) { 
        player.inventory[itemName]--;
        if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
    }

    const messageAction = itemDef.teachesRecipe ? "apprenez la recette de" : "utilisez";
    return { success: true, message: `Vous ${messageAction}: ${itemName}.`, floatingTexts };
}