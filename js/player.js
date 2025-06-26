// js/player.js
import { CONFIG, ITEM_TYPES } from './config.js';
import * as State from './state.js';
import { triggerActionFlash } from './ui/effects.js';

// CORRIGÉ : Simplification, la logique principale est maintenant dans State.countItemsInInventory
export function getTotalResources(inventory) {
    return State.countItemsInInventory(inventory);
}

export function initPlayer(config, playerId = 'player1') {
    const inventory = {};
    const initialItems = {
        'Hache': 1,
        'Pelle en bois': 1,
        'Briquet': 1,
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
        'Alcool': 2,
        'Huile de coco':1,
        'Noix de coco': 2,
        'Breuvage étrange': 3,
        'Seau': 1,
        'Guitare déchargé': 1,
        'Cadenas': 1,
        'Radio déchargée': 1,
        'Batterie chargée': 1,
        'Petit Sac': 1,
    };

    const playerState = {
        id: playerId,
        x: 0, y: 0, // Initial position, will be updated
        health: 10, thirst: 10, hunger: 10, sleep: 10,
        status: ['normale'], // 'normale', 'Blessé', 'Malade', 'Empoisonné', 'Accro', 'Drogué', 'Alcoolisé'
        maxHealth: 10, maxThirst: 10, maxHunger: 10, maxSleep: 10, maxInventory: CONFIG.PLAYER_BASE_MAX_RESOURCES,
        inventory: inventory,
        equipment: {
            head: null, body: null, feet: null, weapon: null, shield: null, bag: null,
        },
        color: '#ffd700', isBusy: false, animationState: null,
        visitedTiles: new Set(),
    };

    for (const itemName in initialItems) {
        State.addResource(playerState.inventory, itemName, initialItems[itemName]);
    }
    
    // Équiper le sac de départ
    const sacKey = Object.keys(playerState.inventory).find(key => key.startsWith('Petit Sac'));
    if (sacKey) {
        const sacInstance = playerState.inventory[sacKey];
        playerState.equipment.bag = sacInstance;
        delete playerState.inventory[sacKey];
        if (sacInstance.stats?.maxInventory) {
            playerState.maxInventory += sacInstance.stats.maxInventory;
        }
    }


    return playerState;
}


export function movePlayer(direction, currentPlayerPos) {
    let newX = currentPlayerPos.x, newY = currentPlayerPos.y;
    switch (direction) {
        case 'north': newY--; break;
        case 'south': newY++; break;
        case 'west': newX--; break;
        case 'east': newX++; break;
        case 'northeast': newY--; newX++; break;
        case 'northwest': newY--; newX--; break;
        case 'southeast': newY++; newX++; break;
        case 'southwest': newY++; newX--; break;
        default: return null; // Unknown direction
    }
    return { newX, newY };
}

export function decayStats(gameState) {
    const { player, activeEvent } = gameState;
    let messages = [];

    if (player.isBusy || player.animationState) return null;

    if (player.health > 0) {
        player.health = Math.max(0, player.health - 1);
        messages.push("Vous sentez le poids du temps... (-1 Santé)");
    }

    if (player.status.includes('Malade')) {
        messages.push("Vous vous sentez toujours fiévreux.");
    }
    if (player.status.includes('Empoisonné')) {
        if (player.health > 0) player.health = Math.max(0, player.health - 1);
        messages.push("Le poison continue de vous ronger ! (-1 Santé supplémentaire).");
    }
    if (player.status.includes('Blessé')) {
        if (player.sleep > 0) player.sleep = Math.max(0, player.sleep - 1);
        messages.push("Votre blessure vous fatigue davantage (-1 sommeil).");
    }
    if (player.status.includes('Drogué')) {
        if (player.hunger > 0) player.hunger = Math.max(0, player.hunger - 1);
        if (player.sleep > 0) player.sleep = Math.max(0, player.sleep - 1);
        messages.push("Les effets de la drogue se font sentir... (-1 faim, -1 sommeil).");
    }
    if (player.status.includes('Alcoolisé')) {
        messages.push("Les effets de l'alcool persistent.");
    }

    const activeNonNormalStatuses = player.status.filter(s => s !== 'normale');
    if (activeNonNormalStatuses.length >= 4) {
        player.health = 0; // Trigger game over
    }

    if (messages.length === 0) return null;
    return { message: messages.join(' ') };
}

// CORRIGÉ ET DÉPLACÉ DANS STATE.JS
// La fonction transferItems est maintenant gérée par State.transferItem pour plus de robustesse.

// CORRIGÉ : Logique de consommation améliorée et centralisée
export function consumeItem(itemName, player) {
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe && itemDef.type !== 'usable' && itemDef.type !== 'key') ) {
        return { success: false, message: `Vous ne pouvez pas utiliser "${itemName}" ainsi.` };
    }
    
    const { found, key } = State.findItemsInInventory(player.inventory, itemName, 1);
    if (!found) {
        return { success: false, message: "Vous n'en avez plus." };
    }

    // Vérifications pré-consommation
    if (itemDef.effects) {
        if ((itemName === 'Eau pure' || itemName === 'Eau salée' || itemName === 'Eau croupie' || itemName === 'Noix de coco') && player.thirst >= player.maxThirst) {
             return { success: false, message: "Vous n'avez pas soif." };
        }
        if (itemName === 'Banane' && player.hunger >= player.maxHunger - ITEM_TYPES['Banane'].effects.hunger) {
            return { success: false, message: "Vous n'avez pas assez faim pour une banane." };
        }
        if (itemName === 'Canne à sucre' && player.hunger >= player.maxHunger - ITEM_TYPES['Canne à sucre'].effects.hunger) {
            return { success: false, message: "Vous n'avez pas assez faim pour de la canne à sucre." };
        }
        if (itemName === 'Oeuf cru' && player.hunger >= player.maxHunger - ITEM_TYPES['Oeuf cru'].effects.hunger) {
             return { success: false, message: "Vous n'avez pas assez faim pour un oeuf cru." };
        }
        if (itemName === 'Poisson cru' && player.hunger >= player.maxHunger - ITEM_TYPES['Poisson cru'].effects.hunger) {
             return { success: false, message: "Vous n'avez pas assez faim pour du poisson cru." };
        }
        const onlyHungerEffect = itemDef.effects && Object.keys(itemDef.effects).length === 1 && itemDef.effects.hunger && itemDef.effects.hunger > 0;
        if (onlyHungerEffect && player.hunger >= player.maxHunger) {
            return { success: false, message: "Vous n'avez pas faim pour l'instant." };
        }
        if ((itemName === 'Savon' || itemName === 'Bandage' || itemName === 'Huile de coco') && player.health >= player.maxHealth) {
            return { success: false, message: "Votre santé est au maximum." };
        }
        if (itemName === 'Alcool' && player.thirst >= player.maxThirst - 1 ) {
            return { success: false, message: "Vous n'avez pas assez soif pour boire de l'alcool." };
        }
        if (itemName === 'Sel' && player.hunger >= player.maxHunger - (ITEM_TYPES['Sel'].effects.hunger || 0)) {
             return { success: false, message: "Vous n'avez pas assez faim pour manger du sel." };
        }
    }


    let floatingTexts = [];

    if (itemName === 'Carte' && itemDef.uses) {
        // La logique est gérée dans State.consumeItem
    } else if (itemDef.teachesRecipe) {
        // La logique est gérée dans State.consumeItem
    } else {
        for (const effect in itemDef.effects) {
            const value = itemDef.effects[effect];

            if (effect === 'status') {
                const statusEffect = value;
                const newStatusName = statusEffect.name || (Array.isArray(statusEffect) ? statusEffect[0].name : null);
                const chance = statusEffect.chance || (Array.isArray(statusEffect) ? statusEffect[0].chance : 1.0);
                const ifCurrentStatus = statusEffect.ifStatus || (Array.isArray(statusEffect) ? statusEffect[0].ifStatus : null);

                const conditionMet = !ifCurrentStatus || player.status.includes(ifCurrentStatus) || (Array.isArray(ifCurrentStatus) && ifCurrentStatus.some(s => player.status.includes(s)));

                if (conditionMet && (!chance || Math.random() < chance)) {
                    if (newStatusName === 'normale') {
                        player.status = ['normale'];
                    } else if (!player.status.includes(newStatusName)) {
                        player.status = player.status.filter(s => s !== 'normale');
                        player.status.push(newStatusName);
                    }
                    floatingTexts.push({text: `Statut: ${player.status.join(', ')}`, type: 'info'});
                }
            } else if (effect === 'custom') {
                // La logique custom est gérée dans State.consumeItem
            } else if (player.hasOwnProperty(effect)) {
                const maxStatName = `max${effect.charAt(0).toUpperCase() + effect.slice(1)}`;
                if(player.hasOwnProperty(maxStatName)) {
                    const oldValue = player[effect];
                    player[effect] = Math.min(player[maxStatName], player[effect] + value);
                    const actualChange = player[effect] - oldValue;
                    if (actualChange !== 0) {
                        const sign = actualChange >= 0 ? '+' : '';
                        let icon = '';
                        if(effect === 'health') icon = '❤️';
                        else if(effect === 'thirst') icon = '💧';
                        else if(effect === 'hunger') icon = '🍗';
                        else if(effect === 'sleep') icon = '🌙';
                        floatingTexts.push({text: `${sign}${actualChange}${icon}`, type: actualChange > 0 ? 'gain' : 'cost'});
                        // Déclencher le flash visuel
                        triggerActionFlash(actualChange > 0 ? 'gain' : 'cost');
                    }
                }
            }
        }
    }

    // On utilise la clé trouvée pour décrémenter/supprimer l'objet
    const itemToRemove = player.inventory[key];
    if (typeof itemToRemove === 'number') {
        player.inventory[key]--;
        if (player.inventory[key] <= 0) {
            delete player.inventory[key];
        }
    } else if (typeof itemToRemove === 'object' && (itemToRemove.uses || itemToRemove.hasOwnProperty('currentDurability'))) {
        // Pour les objets avec 'uses' (comme la carte), la logique est dans State.consumeItem.
        // Pour les autres, on supprime juste l'instance.
        if (itemName !== 'Carte') {
             delete player.inventory[key];
        }
    } else {
        // Fallback pour les objets uniques sans 'uses'
         delete player.inventory[key];
    }


    const messageAction = itemDef.teachesRecipe ? "apprenez la recette de" : "utilisez";
    return { success: true, message: `Vous ${messageAction}: ${itemName}.`, floatingTexts, itemKeyUsed: key };
}