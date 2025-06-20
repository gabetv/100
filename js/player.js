// js/player.js
import { CONFIG, ITEM_TYPES } from './config.js';
import * as State from './state.js'; // Import State to avoid circular dependency with transferItems

export function getTotalResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initPlayer(config, playerId = 'player1') { // Ajout playerId
    return {
        id: playerId, // Ajout de l'ID du joueur
        x: 0, y: 0, // Sera défini dans State.initializeGameState
        health: 10, thirst: 10, hunger: 10, sleep: 10,
        status: 'Normal',
        maxHealth: 10, maxThirst: 10, maxHunger: 10, maxSleep: 10, maxInventory: CONFIG.PLAYER_BASE_MAX_RESOURCES,

        inventory: {
            'Hache': 1,
            'Canne à pêche': 1,
            'Kit de Secours': 1,
            'Barre Énergétique': 22, // Modifié: 2 + 20
            'Eau pure': 21,          // Modifié: 1 + 20
            'Clé du Trésor': 1,
            'Allumettes': 5,
            'Carte': 1, // Le joueur commence avec une carte (pour 30 utilisations)
        },
        equipment: {
            head: null, body: null, feet: null, weapon: null, shield: null, bag: null, // Ajout shield
        },
        color: '#ffd700', isBusy: false, animationState: null,
        visitedTiles: new Set(), // Pour le brouillard de guerre personnel
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
        if (player.sleep > 0) player.sleep = Math.max(0, player.sleep - 2); else if (player.sleep === 0 && player.health > 0) player.health--; // Fatigue extrême
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
     if (player.sleep <= 0) { // Si le joueur n'a plus de sommeil, il perd de la vie
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
    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe && itemDef.type !== 'usable') ) { // Modifié pour inclure teachesRecipe et usable (pour la carte)
        return { success: false, message: `Vous ne pouvez pas utiliser "${itemName}" ainsi.` };
    }
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
        return { success: false, message: "Vous n'en avez plus." };
    }

    let floatingTexts = [];

    // Spécifique pour la carte si elle a des "uses"
    if (itemName === 'Carte' && itemDef.uses) {
        // La "consommation" de la carte pour ouvrir la carte est gérée dans main.js
        // Ici, on ne fait rien de spécial, la fonction sera appelée par main.js pour décrémenter
    } else if (itemDef.teachesRecipe) { // Gérer l'apprentissage de recette
        // La logique d'apprentissage est gérée dans State.consumeItem
        // Ici, on décrémente juste l'objet.
    } else { // Gérer les effets de consommation standards
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
                // Logique custom gérée dans State.consumeItem après cet appel
            } else if (player.hasOwnProperty(effect)) { // Check for health, thirst, hunger, sleep
                const maxStatName = `max${effect.charAt(0).toUpperCase() + effect.slice(1)}`;
                if(player.hasOwnProperty(maxStatName)) {
                    player[effect] = Math.min(player[maxStatName], player[effect] + value);
                    const sign = value >= 0 ? '+' : '';
                    let icon = '';
                    if(effect === 'health') icon = '❤️';
                    else if(effect === 'thirst') icon = '💧';
                    else if(effect === 'hunger') icon = '🍗';
                    else if(effect === 'sleep') icon = '🌙';
                    floatingTexts.push(`${sign}${value}${icon}`);
                }
            }
        }
    }

    // Décrémenter l'objet pour tous sauf les cas où la durabilité/uses est gérée ailleurs (non applicable ici pour l'instant)
    if (itemName !== 'Carte' || !itemDef.uses) { // Ne pas décrémenter la carte ici si elle a des 'uses' gérés par l'action d'ouverture
        player.inventory[itemName]--;
        if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
    }


    const messageAction = itemDef.teachesRecipe ? "apprenez la recette de" : "utilisez";
    return { success: true, message: `Vous ${messageAction}: ${itemName}.`, floatingTexts };
}