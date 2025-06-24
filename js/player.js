// js/player.js
import { CONFIG, ITEM_TYPES } from './config.js';
import * as State from './state.js';

export function getTotalResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initPlayer(config, playerId = 'player1') {
    return {
        id: playerId,
        x: 0, y: 0, // Initial position, will be updated
        health: 10, thirst: 10, hunger: 10, sleep: 10, // #39 Alcool condition handled in consumption logic
        status: ['normale'], // 'normale', 'Blessé', 'Malade', 'Empoisonné', 'Accro', /*'Gravement malade',*/ 'Drogué', 'Alcoolisé' // #36
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
            'Alcool': 2, // #37
            'Huile de coco':1,
            'Noix de coco': 2,
            'Breuvage étrange': 3,
            // 'Seau': 1,
            // 'Guitare déchargé': 1,
            // 'Cadenas': 1,
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

    // #46: Dégradation normale santé toutes les 180s
    if (player.health > 0) {
        player.health = Math.max(0, player.health - 1);
        messages.push("Vous sentez le poids du temps... (-1 Santé)");
    }

    // La logique de decay pour soif, faim, sommeil est retirée de ce cycle de 180s.
    // Ces stats sont maintenant principalement affectées par les actions et les statuts.
    // Les statuts continuent d'avoir leurs effets passifs à chaque cycle de decayStats (180s).

    if (player.status.includes('Malade')) {
        // L'effet direct de "Malade" sur faim/soif est supprimé de la dégradation passive.
        // Il est appliqué par la source de la maladie (ex: consommer item).
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
    if (player.status.includes('Drogué')) { // Point 35
        if (player.hunger > 0) player.hunger = Math.max(0, player.hunger - 1);
        if (player.sleep > 0) player.sleep = Math.max(0, player.sleep - 1);
        messages.push("Les effets de la drogue se font sentir... (-1 faim, -1 sommeil).");
    }
    if (player.status.includes('Alcoolisé')) { // #37
        // L'effet de déplacement est géré dans interactions.js.
        // Ici, on pourrait ajouter un effet passif si besoin, ex: "Vous avez la gueule de bois."
        // Pour l'instant, pas d'effet passif direct en plus de la stat de déplacement.
        messages.push("Les effets de l'alcool persistent.");
    }

    // Check for death by multiple statuses
    const activeNonNormalStatuses = player.status.filter(s => s !== 'normale');
    if (activeNonNormalStatuses.length >= 4) {
        player.health = 0; // Trigger game over
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
             return { success: false, message: "Vous n'avez pas soif." };
        }
        if (itemName === 'Banane' && player.hunger > player.maxHunger - 2) {
            return { success: false, message: "Vous n'avez pas assez faim pour une banane." };
        }
        if (itemName === 'Canne à sucre' && player.hunger > player.maxHunger - 3) {
            return { success: false, message: "Vous n'avez pas assez faim pour de la canne à sucre." };
        }
        if (itemName === 'Oeuf cru' && player.hunger > player.maxHunger - 2) {
             return { success: false, message: "Vous n'avez pas assez faim pour un oeuf cru." };
        }
        if (itemName === 'Poisson cru' && player.hunger > player.maxHunger - 3) {
             return { success: false, message: "Vous n'avez pas assez faim pour du poisson cru." };
        }
        const onlyHungerEffect = itemDef.effects && Object.keys(itemDef.effects).length === 1 && itemDef.effects.hunger && itemDef.effects.hunger > 0;
        if (onlyHungerEffect && player.hunger >= player.maxHunger) {
            return { success: false, message: "Vous n'avez pas faim pour l'instant." };
        }
        if ((itemName === 'Savon' || itemName === 'Bandage' || itemName === 'Huile de coco') && player.health >= player.maxHealth) {
            return { success: false, message: "Votre santé est au maximum." };
        }
        if (itemName === 'Alcool' && player.thirst >= player.maxThirst -1 ) { // #39
            return { success: false, message: "Vous n'avez pas assez soif pour boire de l'alcool." };
        }
        if (itemName === 'Sel' && player.hunger > player.maxHunger - (ITEM_TYPES['Sel'].effects.hunger || 0)) {
             return { success: false, message: "Vous n'avez pas assez faim pour manger du sel." };
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
                const newStatusName = statusEffect.name || (Array.isArray(statusEffect) ? statusEffect[0].name : null); // Assuming first status in array if it's an array
                const chance = statusEffect.chance || (Array.isArray(statusEffect) ? statusEffect[0].chance : 1.0);
                const ifCurrentStatus = statusEffect.ifStatus || (Array.isArray(statusEffect) ? statusEffect[0].ifStatus : null);

                const conditionMet = !ifCurrentStatus || player.status.includes(ifCurrentStatus) || (Array.isArray(ifCurrentStatus) && ifCurrentStatus.some(s => player.status.includes(s)));

                if (conditionMet && (!chance || Math.random() < chance)) {
                    if (newStatusName === 'normale') {
                        player.status = ['normale'];
                    } else if (!player.status.includes(newStatusName)) {
                        player.status = player.status.filter(s => s !== 'normale'); // Remove 'normale'
                        player.status.push(newStatusName);
                    }
                    floatingTexts.push(`Statut: ${player.status.join(', ')}`);
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