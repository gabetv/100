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
        status: 'Normal', // 'Normal', 'Blessé', 'Malade', 'Empoisonné', 'Accro', 'Gravement malade', 'Drogué'
        maxHealth: 10, maxThirst: 10, maxHunger: 10, maxSleep: 10, maxInventory: CONFIG.PLAYER_BASE_MAX_RESOURCES,

        inventory: { // Inventaire de départ pour tests
            'Hache': 1,
            'Pelle en bois': 1,
            'Briquet': 1, // Pour tester construction Feu de camp
            'Eau pure': 5,
            'Viande crue': 2,
            'Poisson cru': 2,
            'Oeuf cru': 2,
            'Eau croupie': 3,
            'Eau salée': 3,
            'Kit de Secours': 2,
            'Bandage': 2,
            'Médicaments':1,
            'Antiseptique': 1,
            'Savon':1,
            'Huile de coco':1,
            'Noix de coco': 2,
            // 'Seau': 1,
            // 'Radio déchargée': 1,
            // 'Batterie chargée': 1,
            // 'Petit Sac': 1, // Pour tester l'équipement
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
        case 'Gravement malade': // Point 26
            if (player.health > 0) player.health = Math.max(0, player.health - 1);
            if (player.hunger > 0) player.hunger = Math.max(0, player.hunger - 2);
            if (player.thirst > 0) player.thirst = Math.max(0, player.thirst - 2);
            messages.push("Vous êtes gravement malade! (-1 Santé, -2 faim, -2 soif).");
            break;
        case 'Empoisonné':
            if (player.health > 0) player.health = Math.max(0, player.health - 1);
            messages.push("Le poison vous ronge ! (-1 Santé).");
            break;
        case 'Blessé':
            if (player.sleep > 0) player.sleep = Math.max(0, player.sleep - 1);
            messages.push("Votre blessure vous fatigue (-1 sommeil).");
            break;
        case 'Drogué': // Point 35
            if (player.hunger > 0) player.hunger = Math.max(0, player.hunger - 1);
            if (player.sleep > 0) player.sleep = Math.max(0, player.sleep - 1);
            messages.push("Les effets de la drogue se font sentir... (-1 faim, -1 sommeil).");
            break;
        case 'Accro': // Statut non utilisé activement dans la logique actuelle, mais gardé pour exemple
            messages.push("Vous ressentez le manque...");
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

// playerConsumeItemLogic est la fonction de base, State.consumeItem l'appelle et gère les cas spéciaux
export function consumeItem(itemName, player) {
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe && itemDef.type !== 'usable' && itemDef.type !== 'key') ) {
        return { success: false, message: `Vous ne pouvez pas utiliser "${itemName}" ainsi.` };
    }
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) {
        return { success: false, message: "Vous n'en avez plus." };
    }

    // Point 25, 40, 41, 42: Vérifications avant consommation
    if (itemDef.effects || itemName === 'Eau pure' || itemName === 'Eau salée' || itemName === 'Eau croupie' || itemName === 'Noix de coco' || itemName === 'Savon' || itemName === 'Bandage' || itemName === 'Huile de coco') {
        if ((itemName === 'Eau pure' || itemName === 'Eau salée' || itemName === 'Eau croupie' || itemName === 'Noix de coco') && player.thirst >= player.maxThirst) {
             const msg = itemName === 'Noix de coco' ? "Vous n'avez pas soif." : "Vous n'avez pas soif, vous devriez économiser cette eau précieuse.";
            return { success: false, message: msg };
        }

        const onlyHungerEffect = itemDef.effects && Object.keys(itemDef.effects).length === 1 && itemDef.effects.hunger && itemDef.effects.hunger > 0;
        if (onlyHungerEffect && player.hunger >= player.maxHunger) {
            return { success: false, message: "Vous n'avez pas faim pour l'instant." };
        }
        if ((itemName === 'Savon' || itemName === 'Bandage' || itemName === 'Huile de coco') && player.health >= player.maxHealth) {
            return { success: false, message: "Vous n'avez pas besoin d'augmenter votre santé, vous devriez partager ou échanger cet objet." };
        }
    }


    let floatingTexts = [];

    if (itemName === 'Carte' && itemDef.uses) {
        // La logique d'utilisation de la carte (ouvrir la modale) est gérée dans interactions.js / main.js
        // Ici, on ne fait que décrémenter les utilisations si nécessaire (déjà géré dans State.consumeItem pour la carte)
    } else if (itemDef.teachesRecipe) {
        // La logique d'apprentissage de la recette est gérée dans State.consumeItem
    } else { // Pour les consommables avec effets directs
        for (const effect in itemDef.effects) {
            const value = itemDef.effects[effect];

            if (effect === 'status') {
                const statusEffect = value;
                // Vérifier si une condition ifStatus est présente et si elle est remplie
                const conditionMet = !statusEffect.ifStatus || // Pas de condition
                                     (Array.isArray(statusEffect.ifStatus) ? statusEffect.ifStatus.includes(player.status) : player.status === statusEffect.ifStatus); // Condition simple ou multiple

                if (conditionMet && (!statusEffect.chance || Math.random() < statusEffect.chance)) {
                    player.status = statusEffect.name; // Appliquer le nouveau statut
                    floatingTexts.push(`Statut: ${player.status}`);
                }
            } else if (effect === 'custom') {
                // La logique custom est gérée dans State.consumeItem (ex: eauSaleeEffect, eauCroupieEffect, drogueEffect, chargeDevice)
            } else if (player.hasOwnProperty(effect)) { // Gérer les stats directes comme health, thirst, hunger, sleep
                const maxStatName = `max${effect.charAt(0).toUpperCase() + effect.slice(1)}`;
                if(player.hasOwnProperty(maxStatName)) {
                    const oldValue = player[effect];
                    player[effect] = Math.min(player[maxStatName], player[effect] + value);
                    const actualChange = player[effect] - oldValue; // Calculer le changement réel
                    if (actualChange !== 0) { // N'afficher le texte flottant que s'il y a eu un changement
                        const sign = actualChange >= 0 ? '+' : '';
                        let icon = '';
                        if(effect === 'health') icon = '❤️';
                        else if(effect === 'thirst') icon = '💧';
                        else if(effect === 'hunger') icon = '🍗';
                        else if(effect === 'sleep') icon = '🌙';
                        floatingTexts.push(`${sign}${actualChange}${icon}`);
                    }
                }
            }
        }
    }

    // Décrémenter l'inventaire (sauf pour la carte si elle a des "uses" et que sa logique est ailleurs)
    if (itemName !== 'Carte' || !itemDef.uses) {
        if (player.inventory[itemName] > 0) { // Vérifier avant de décrémenter
            player.inventory[itemName]--;
            if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
        } else {
            // Ce cas ne devrait pas arriver si la vérification initiale (player.inventory[itemName] > 0) est faite
            return { success: false, message: "Erreur interne: tentative de consommer un objet non possédé." };
        }
    }

    const messageAction = itemDef.teachesRecipe ? "apprenez la recette de" : "utilisez";
    return { success: true, message: `Vous ${messageAction}: ${itemName}.`, floatingTexts };
}