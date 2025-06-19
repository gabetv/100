// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES } from './config.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js'; // getTotalResources est dans player.js
import { findEnemyOnTile } from './enemy.js';
// ### AJOUT DE L'IMPORT DE DOM ###
import DOM from './ui/dom.js';

function applyActionCosts(player, costs) {
    let floatingTextParts = [];
    if (costs.thirst) {
        player.thirst = Math.max(0, player.thirst - costs.thirst);
        floatingTextParts.push(`-${costs.thirst}💧`);
    }
    if (costs.hunger) {
        player.hunger = Math.max(0, player.hunger - costs.hunger);
        floatingTextParts.push(`-${costs.hunger}🍗`);
    }
    if (costs.sleep) {
        player.sleep = Math.max(0, player.sleep - costs.sleep);
        floatingTextParts.push(`-${costs.sleep}🌙`);
    }
    if(floatingTextParts.length > 0){
        UI.showFloatingText(floatingTextParts.join(' '), 'cost');
    }
}

function performTimedAction(player, duration, onStart, onComplete, updateUICallbacks) {
    if (player.isBusy || player.animationState) return;

    player.isBusy = true;
    onStart();
    if (updateUICallbacks && updateUICallbacks.updatePossibleActions) {
        updateUICallbacks.updatePossibleActions();
    }
    if (updateUICallbacks && updateUICallbacks.updateAllButtonsState) {
        UI.updateAllButtonsState(State.state); // Assurez-vous que State.state est passé si nécessaire
    }


    setTimeout(() => {
        onComplete();
        player.isBusy = false;
        if (updateUICallbacks && updateUICallbacks.updateAllUI) {
            updateUICallbacks.updateAllUI(); // Ceci devrait être fullUIUpdate de main.js
        }
        if (updateUICallbacks && updateUICallbacks.updatePossibleActions) {
            updateUICallbacks.updatePossibleActions();
        }
        if (updateUICallbacks && updateUICallbacks.updateAllButtonsState) {
            UI.updateAllButtonsState(State.state);
        }
    }, duration);
}

function performToolAction(player, toolSlot, actionType, onComplete, updateUICallbacks) {
    const tool = player.equipment[toolSlot];
    if (!tool || tool.action !== actionType) {
        UI.addChatMessage(`Vous n'avez pas le bon outil équipé pour cette action.`, 'system');
        // ### MODIFICATION ICI pour utiliser DOM et l'ID correct ###
        if (DOM.equipmentSlotsEl) { // equipmentSlotsEl est le conteneur des slots dans la modale
            UI.triggerShake(DOM.equipmentSlotsEl);
        } else if (DOM.quickSlotsPanel) { // Ou le panneau des quickslots si l'erreur est liée à ça
            UI.triggerShake(DOM.quickSlotsPanel); // Assurez-vous que quickSlotsPanel est dans DOM.js
        }
        return;
    }

    performTimedAction(player, ACTION_DURATIONS.HARVEST, // Ou une autre durée selon l'action
        () => UI.addChatMessage(`Utilisation de ${tool.name}...`, 'system'),
        () => {
            onComplete(tool.power); // Passe la puissance de l'outil

            if (tool.hasOwnProperty('currentDurability')) { // Vérifier si l'outil a une durabilité
                tool.currentDurability--;
                if (tool.currentDurability <= 0) {
                    UI.addChatMessage(`${tool.name} s'est cassé !`, 'system');
                    State.state.player.equipment[toolSlot] = null; // Déséquipe l'outil
                }
            }
            // ### MODIFICATION ICI pour utiliser DOM ###
            // Vérifier si la modale d'équipement est ouverte avant de la mettre à jour
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
                UI.updateEquipmentModal(State.state);
            }
        },
        updateUICallbacks
    );
}

export function handleCombatAction(action) {
    const { combatState, player } = State.state;
    if (!combatState || !combatState.isPlayerTurn) return;

    combatState.isPlayerTurn = false;
    UI.updateCombatUI(combatState); // Met à jour l'UI pour montrer que ce n'est plus le tour du joueur

    setTimeout(() => {
        if (action === 'attack') {
            playerAttack();
        } else if (action === 'flee') {
            playerFlee();
        }

        // Si le combat n'est pas terminé (le joueur ou l'ennemi n'est pas mort, ou le joueur n'a pas fui)
        if (State.state.combatState && State.state.combatState.enemy.currentHealth > 0 && player.health > 0) {
            setTimeout(() => {
                enemyAttack();
                if (State.state.combatState) { // Revérifier si le combat est toujours en cours (le joueur pourrait mourir)
                    State.state.combatState.isPlayerTurn = true;
                    UI.updateCombatUI(State.state.combatState); // Met à jour l'UI pour le tour du joueur
                }
            }, 1000); // Délai pour l'attaque de l'ennemi
        }
    }, 500); // Délai pour l'action du joueur
}

function playerAttack() {
    const { combatState, player } = State.state;
    if (!combatState) return; // Sécurité
    
    const weapon = player.equipment.weapon;
    const damage = weapon && weapon.stats?.damage ? weapon.stats.damage : COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE;
    
    combatState.enemy.currentHealth = Math.max(0, combatState.enemy.currentHealth - damage);
    combatState.log.unshift(`Vous infligez ${damage} dégâts avec ${weapon ? weapon.name : 'vos poings'}.`);
    
    if (weapon && weapon.hasOwnProperty('currentDurability')) {
        weapon.currentDurability--;
        if (weapon.currentDurability <= 0) {
            combatState.log.unshift(`${weapon.name} s'est cassé !`);
            player.equipment.weapon = null; // Déséquipe l'arme
            // Mettre à jour l'UI de l'équipement si la modale est ouverte
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
                UI.updateEquipmentModal(State.state);
            }
        }
    }

    if (combatState.enemy.currentHealth <= 0) {
        combatState.log.unshift(`Vous avez vaincu ${combatState.enemy.name} !`);
        UI.addChatMessage(`Vous avez vaincu ${combatState.enemy.name} !`, 'gain');
        // Distribuer le loot
        Object.keys(combatState.enemy.loot).forEach(item => {
            const amount = combatState.enemy.loot[item];
            if (amount > 0) {
                State.addResourceToPlayer(item, amount); // Utiliser la fonction de state.js
                UI.showFloatingText(`+${amount} ${item}`, 'gain');
            }
        });
        State.endCombat(true); // Termine le combat, true pour victoire
        UI.hideCombatModal();
        // Après le combat, mettre à jour l'UI complète et les actions possibles
        if (State.state.player) { // S'assurer que player existe toujours
             // Note: updateUICallbacks n'est pas défini ici. Utiliser des appels directs.
            UI.updateAllUI(State.state); // Ceci vient de ui.js
            window.updatePossibleActions(); // Si updatePossibleActions est global (dans main.js)
                                            // Sinon, il faut une meilleure manière de le gérer.
                                            // Pour l'instant, on suppose qu'il est accessible via window
                                            // ou qu'il faut le passer en paramètre.
                                            // Le mieux serait d'avoir fullUIUpdate de main.js
        }
    } else {
        UI.updateCombatUI(combatState); // Met à jour juste l'UI de combat
    }
}

function playerFlee() {
    const { combatState } = State.state;
    if (!combatState) return;

    if (Math.random() < COMBAT_CONFIG.FLEE_CHANCE) {
        combatState.log.unshift("Vous avez réussi à fuir !");
        UI.addChatMessage("Vous avez pris la fuite.", "system");
        State.endCombat(false); // false car pas de victoire/loot
        UI.hideCombatModal();
        // Mettre à jour les actions possibles après la fuite
        if (window.updatePossibleActions) window.updatePossibleActions();
    } else {
        combatState.log.unshift("Votre tentative de fuite a échoué !");
        UI.updateCombatUI(combatState);
    }
}

function enemyAttack() {
    const { combatState, player } = State.state;
    if (!combatState) return; // Si le combat s'est terminé entre-temps
    
    const defense = player.equipment.body?.stats?.defense || 0;
    const damageTaken = Math.max(0, combatState.enemy.damage - defense);

    player.health = Math.max(0, player.health - damageTaken);
    combatState.log.unshift(`${combatState.enemy.name} vous inflige ${damageTaken} dégâts.`);

    if (player.health <= 0) {
        combatState.log.unshift("Vous avez été vaincu...");
        // La gestion de la fin du jeu (game over) devrait être ailleurs,
        // par exemple dans la gameLoop qui vérifie player.health
    }
    
    UI.updateCombatUI(combatState); // Mettre à jour l'UI de combat
    // Mettre à jour l'UI globale car la santé du joueur a changé
    // (cela se fera naturellement via la gameLoop et updateAllUI)
    // Mais si on veut un refresh immédiat des barres de vie en dehors du combat modal :
    if (window.fullUIUpdate) window.fullUIUpdate(); else UI.updateAllUI(State.state);

}

export function handlePlayerAction(actionId, data, updateUICallbacks) {
    const { player, map, activeEvent, combatState, enemies } = State.state;
    if (combatState) {
        UI.addChatMessage("Impossible d'agir, vous êtes en combat !", 'system');
        return;
    }
    const tile = map[player.y][player.x];

    switch(actionId) {
        case 'initiate_combat': {
            const enemy = findEnemyOnTile(player.x, player.y, enemies);
            if (enemy) {
                State.startCombat(player, enemy);
                UI.showCombatModal(State.state.combatState);
                if (updateUICallbacks && updateUICallbacks.updatePossibleActions) {
                    updateUICallbacks.updatePossibleActions();
                }
            } else {
                UI.addChatMessage("Il n'y a plus rien à attaquer ici.", "system");
            }
            break;
        }

        case 'harvest': {
            const resource = tile.type.resource;
            if (!resource) return;
            
            const costs = {
                thirst: resource.thirstCost || 0,
                hunger: resource.hungerCost || 0,
                sleep: resource.sleepCost || 0,
            };
            // Vérifier si le joueur a assez de stats AVANT de les déduire pour l'action elle-même
            if (player.thirst < costs.thirst || player.hunger < costs.hunger || player.sleep < costs.sleep) {
                UI.addChatMessage("Vous êtes trop épuisé pour cette action.", "system");
                return;
            }
            applyActionCosts(player, costs);

            performTimedAction(player, ACTION_DURATIONS.HARVEST, 
                () => UI.addChatMessage("Récolte...", "system"), 
                () => {
                    let finalYield = (activeEvent && activeEvent.type === 'Abondance' && activeEvent.data && activeEvent.data.resource === resource.type) ? resource.yield * 2 : resource.yield;
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(finalYield, availableSpace);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer(resource.type, amountToHarvest);
                        tile.harvestsLeft--;
                        UI.showFloatingText(`+${amountToHarvest} ${resource.type}`, 'gain');
                        UI.triggerActionFlash('gain');
                        if (amountToHarvest < finalYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");
                        else if (amountToHarvest < finalYield) UI.addChatMessage("Récolte partielle due à la limite de la zone ou de l'inventaire.", "system");

                        if (tile.harvestsLeft <= 0 && tile.type.harvests !== Infinity) {
                            State.updateTileType(player.x, player.y, TILE_TYPES.WASTELAND);
                            UI.addChatMessage("Les ressources de cette zone sont épuisées.", "system");
                        }
                    } else { 
                        UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : "Impossible de récolter.", "system"); 
                        if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, 
                updateUICallbacks
            );
            break;
        }
        
        case 'harvest_wood': {
            const costs = { thirst: 2, hunger: 1, sleep: 2 };
             if (player.thirst < costs.thirst || player.hunger < costs.hunger || player.sleep < costs.sleep) {
                UI.addChatMessage("Vous êtes trop épuisé pour couper du bois.", "system");
                return;
            }
            applyActionCosts(player, costs);
            performToolAction(player, 'weapon', 'harvest_wood', (power) => {
                State.addResourceToPlayer('Bois', power);
                UI.showFloatingText(`+${power} Bois`, 'gain');
                UI.triggerActionFlash('gain');
            }, updateUICallbacks);
            break;
        }

        case 'fish': {
            const costs = { thirst: 1, hunger: 1, sleep: 1 };
            if (player.thirst < costs.thirst || player.hunger < costs.hunger || player.sleep < costs.sleep) {
                UI.addChatMessage("Vous êtes trop fatigué pour pêcher.", "system");
                return;
            }
            applyActionCosts(player, costs);
            performToolAction(player, 'weapon', 'fish', (power) => {
                const fishCaught = Math.ceil(Math.random() * power); // Un peu d'aléatoire
                if (fishCaught > 0) {
                    State.addResourceToPlayer('Poisson cru', fishCaught);
                    UI.showFloatingText(`+${fishCaught} Poisson cru`, 'gain');
                    UI.triggerActionFlash('gain');
                } else {
                    UI.addChatMessage("Ça ne mord pas aujourd'hui...", "system");
                }
            }, updateUICallbacks);
            break;
        }

        case 'hunt': {
             const weapon = player.equipment.weapon;
             if (!weapon) {
                 UI.addChatMessage("Vous ne pouvez pas chasser sans arme.", "system");
                 return;
             }
             const costs = { thirst: 2, hunger: 2, sleep: 2 };
             if (player.thirst < costs.thirst || player.hunger < costs.hunger || player.sleep < costs.sleep) {
                UI.addChatMessage("Vous êtes trop affaibli pour chasser.", "system");
                return;
            }
             applyActionCosts(player, costs);
             performTimedAction(player, ACTION_DURATIONS.CRAFT, // CHASSE a besoin d'une durée spécifique ou utiliser CRAFT
                () => UI.addChatMessage(`Vous chassez avec ${weapon.name}...`, "system"),
                () => {
                    if (Math.random() < 0.6) { // Chance de succès
                        const amount = (weapon.stats?.damage || weapon.power || 1) * (Math.floor(Math.random() * 2) + 1); // un peu d'aléatoire
                        State.addResourceToPlayer('Viande crue', amount);
                        UI.showFloatingText(`+${amount} Viande crue`, "gain");
                        UI.triggerActionFlash('gain');
                    } else {
                        UI.addChatMessage("La chasse n'a rien donné.", "system");
                    }
                    if (weapon.hasOwnProperty('currentDurability')) {
                        weapon.currentDurability--;
                        if (weapon.currentDurability <= 0) {
                            UI.addChatMessage(`${weapon.name} s'est cassé !`, 'system');
                            player.equipment.weapon = null;
                            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
                                UI.updateEquipmentModal(State.state);
                            }
                        }
                    }
                },
                updateUICallbacks
            );
            break;
        }

        case 'build': {
            const structureType = data.structure; // 'shelter_individual' ou 'shelter_collective'
            const buildCosts = structureType === 'shelter_individual' 
                ? { 'Bois': 20 } 
                : { 'Bois': 600, 'Pierre': 150 }; // Exemple pour abri collectif

            if (!State.hasResources(buildCosts).success) {
                UI.addChatMessage("Ressources insuffisantes pour construire cet abri.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            const actionCosts = { thirst: 4, hunger: 2, sleep: 3 };
            if (player.thirst < actionCosts.thirst || player.hunger < actionCosts.hunger || player.sleep < actionCosts.sleep) {
                UI.addChatMessage("Vous êtes trop fatigué pour construire.", "system");
                return;
            }
            applyActionCosts(player, actionCosts);

            performTimedAction(player, ACTION_DURATIONS.CRAFT * (structureType === 'shelter_individual' ? 1 : 3), // Durée plus longue pour gros abri
                () => UI.addChatMessage(`Construction de ${structureType === 'shelter_individual' ? 'l\'abri individuel' : 'l\'abri collectif'}...`, "system"), 
                () => {
                    State.applyResourceDeduction(buildCosts);
                    // Afficher les coûts flottants
                    for(const item in buildCosts) {
                        UI.showFloatingText(`-${buildCosts[item]} ${item}`, 'cost');
                    }
                    const newStructure = structureType === 'shelter_individual' ? TILE_TYPES.SHELTER_INDIVIDUAL : TILE_TYPES.SHELTER_COLLECTIVE;
                    State.updateTileType(player.x, player.y, newStructure);
                    UI.addChatMessage(`${structureType === 'shelter_individual' ? 'Abri individuel' : 'Abri collectif'} construit !`, "system");
                },
                updateUICallbacks
            );
            break;
        }
        
        case 'dig_mine': {
            const costs = { 'Bois': 100, 'Pierre': 50 }; // Exemple de coûts
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Pas assez de matériaux pour étayer la mine.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            const actionCosts = { thirst: 5, hunger: 5, sleep: 7 };
            if (player.thirst < actionCosts.thirst || player.hunger < actionCosts.hunger || player.sleep < actionCosts.sleep) {
                UI.addChatMessage("Creuser une mine est trop éprouvant pour le moment.", "system");
                return;
            }
            applyActionCosts(player, actionCosts);

            performTimedAction(player, ACTION_DURATIONS.DIG,
                () => UI.addChatMessage("Vous creusez une entrée de mine...", "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText("-100 Bois, -50 Pierre", 'cost'); // Adapter si les coûts changent
                    State.updateTileType(player.x, player.y, TILE_TYPES.MINE);
                    UI.addChatMessage("La mine est prête !", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'regenerate_forest': {
            const costs = TILE_TYPES.WASTELAND.regeneration.cost;
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Vous n'avez pas assez d'eau pour fertiliser cette terre.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            const actionCosts = { thirst: 1, hunger: 1, sleep: 1 };
            if (player.thirst < actionCosts.thirst || player.hunger < actionCosts.hunger || player.sleep < actionCosts.sleep) {
                UI.addChatMessage("Vous manquez d'énergie pour cette tâche.", "system");
                return;
            }
            applyActionCosts(player, actionCosts);

            performTimedAction(player, ACTION_DURATIONS.CRAFT,
                () => UI.addChatMessage("Vous travaillez la terre...", "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText(`-${Object.values(costs)[0]} ${Object.keys(costs)[0]}`, "cost");
                    State.updateTileType(player.x, player.y, TILE_TYPES.FOREST);
                    UI.addChatMessage("La terre redevient fertile et une jeune forêt pousse.", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'sleep': {
            const sleepEffect = tile.type.sleepEffect;
            if (!sleepEffect) return;

            performTimedAction(player, ACTION_DURATIONS.SLEEP, 
                () => UI.addChatMessage("Vous vous endormez pour environ 8 heures...", "system"), // Durée indicative
                () => {
                    player.sleep = Math.min(player.maxSleep, player.sleep + (sleepEffect.sleep || 0)); 
                    player.health = Math.min(player.maxHealth, player.health + (sleepEffect.health || 0));
                    // Passer du temps dans le jeu (par exemple, 1/3 de journée)
                    // Cela pourrait être géré par un système de temps plus global si besoin
                    UI.addChatMessage("Vous vous réveillez, un peu reposé.", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'cook': {
            // Exemple : Cuisiner du poisson ou de la viande
            // On pourrait avoir des boutons différents ou une sélection
            const cookable = { 'Poisson cru': 'Poisson cuit', 'Viande crue': 'Viande cuite' };
            let toCook = null;
            let cookedItem = null;

            for (const raw in cookable) {
                if (State.hasResources({ [raw]: 1, 'Bois': 1 }).success) {
                    toCook = raw;
                    cookedItem = cookable[raw];
                    break;
                }
            }

            if (!toCook) {
                UI.addChatMessage("Ressources insuffisantes pour cuisiner (poisson/viande crue et bois).", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            const actionCosts = { thirst: 1, sleep: 1 }; // Coût de l'action de cuisiner
             if (player.thirst < actionCosts.thirst || player.sleep < actionCosts.sleep) {
                UI.addChatMessage("Vous êtes trop fatigué pour cuisiner.", "system");
                return;
            }
            applyActionCosts(player, actionCosts);

            performTimedAction(player, ACTION_DURATIONS.CRAFT, 
                () => UI.addChatMessage(`Cuisson de ${toCook}...`, "system"), 
                () => {
                    State.applyResourceDeduction({ [toCook]: 1, 'Bois': 1 });
                    State.addResourceToPlayer(cookedItem, 1);
                    UI.showFloatingText(`+1 ${cookedItem}`, "gain"); 
                    UI.triggerActionFlash('gain');
                },
                updateUICallbacks
            );
            break;
        }
        // Ajouter d'autres cas pour 'purify_water', 'build_campfire', etc.
    }
}