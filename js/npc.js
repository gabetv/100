// js/npc.js
import { addChatMessage } from './ui.js'; // UI est bien importé
import { TILE_TYPES, CONFIG, ITEM_TYPES } from './config.js';
import * as State from './state.js'; // Pour accéder au gameState

function getTotalNpcResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initNpcs(config, map) {
    const npcs = [];
    const npcColors = ['#ff6347', '#4682b4', '#32cd32', '#ee82ee']; // Tomate, Bleu Acier, Vert Citron, Orchidée
    const npcNames = ["Bob", "Alice", "Charlie", "Diana", "Evan", "Fiona"]; // Noms plus distincts

    for (let i = 0; i < config.NUM_NPCS; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * config.MAP_WIDTH);
            y = Math.floor(Math.random() * config.MAP_HEIGHT);
        } while (!map[y][x].type.accessible || (map[y][x].x === State.state.player.x && map[y][x].y === State.state.player.y)); // Éviter la case de départ du joueur

        const npcData = {
            id: `npc_${Date.now()}_${i}`,
            x, y,
            color: npcColors[i % npcColors.length],
            name: npcNames[i % npcNames.length] || `Survivant ${i + 1}`,
            timeSinceLastMove: 0,
            inventory: {},
            capacity: 15,
            goal: 'harvesting',
            targetResource: null,
            health: CONFIG.NPC_BASE_HEALTH,
            maxHealth: CONFIG.NPC_BASE_HEALTH,
            damage: CONFIG.NPC_BASE_DAMAGE,
            targetEnemyId: null,
            // Ajout pour quêtes simples
            availableQuest: null,
            activeQuest: null,
            dialogueLines: [
                "J'espère qu'on va s'en sortir...",
                "Il faut rester vigilant.",
                "Travaillons ensemble pour survivre !",
                "Chaque jour est un nouveau défi.",
                "Gardons espoir."
            ]
        };

        // Donner une quête simple à un PNJ sur deux par exemple
        if (i % 2 === 0) {
            npcData.availableQuest = {
                id: `quest_wood_${i}`,
                title: "Besoin de Bois",
                description: "Nous manquons de bois pour le feu. Pourrais-tu m'apporter 10 Bois ?",
                requirement: { item: 'Bois', amount: 10 },
                reward: { item: 'Viande cuite', amount: 2 },
                isCompleted: false // Marqueur pour savoir si la quête a déjà été faite une fois (pourrait être réinitialisé)
            };
        } else {
             npcData.availableQuest = {
                id: `quest_food_${i}`,
                title: "Chasseur Affamé",
                description: "J'ai grand faim. 3 Viandes crues seraient un festin !",
                requirement: { item: 'Viande crue', amount: 3 },
                reward: { item: 'Pierre', amount: 15 },
                isCompleted: false
            };
        }
        npcs.push(npcData);
    }
    return npcs;
}

// Fonction pour vérifier si une ressource est faible à l'abri
function isResourceLowAtShelter(shelterInventory, resourceName, threshold = 10) {
    return (!shelterInventory || !shelterInventory[resourceName] || shelterInventory[resourceName] < threshold);
}


export function updateNpcs(gameState, deltaTime) {
    const { npcs, map, shelterLocation, enemies } = gameState;
    const shelterTile = shelterLocation ? map[shelterLocation.y][shelterLocation.x] : null;
    const shelterInventory = shelterTile && shelterTile.buildings.some(b => b.key === 'SHELTER_COLLECTIVE') ? shelterTile.inventory : null;


    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];

        npc.timeSinceLastMove += deltaTime;
        if (npc.timeSinceLastMove < CONFIG.NPC_ACTION_INTERVAL_MS) continue;
        npc.timeSinceLastMove = 0;

        if (npc.health <= 0) {
            addChatMessage(`${npc.name} a été vaincu...`, 'system_warning');
            npcs.splice(i, 1);
            continue;
        }

        const currentTile = map[npc.y][npc.x];
        const totalResourcesInNpcInventory = getTotalNpcResources(npc.inventory);

        let closestEnemy = null;
        let minDistanceToEnemy = Infinity;
        enemies.forEach(enemy => {
            const dist = Math.hypot(npc.x - enemy.x, npc.y - enemy.y);
            if (dist < minDistanceToEnemy && dist <= CONFIG.NPC_AGGRO_RADIUS) {
                minDistanceToEnemy = dist;
                closestEnemy = enemy;
            }
        });

        if (closestEnemy) {
            npc.goal = 'fighting';
            npc.targetEnemyId = closestEnemy.id;
        } else {
            if(npc.goal === 'fighting') npc.targetEnemyId = null;

            if (totalResourcesInNpcInventory >= npc.capacity) {
                npc.goal = 'depositing';
                npc.targetResource = null;
            } else if (shelterInventory) {
                if (isResourceLowAtShelter(shelterInventory, 'Bois', 50)) {
                    npc.goal = 'gathering_build_materials';
                    npc.targetResource = 'Bois';
                } else if (isResourceLowAtShelter(shelterInventory, 'Pierre', 30)) {
                    npc.goal = 'gathering_build_materials';
                    npc.targetResource = 'Pierre';
                } else {
                    npc.goal = 'harvesting';
                    npc.targetResource = null;
                }
            } else {
                npc.goal = 'harvesting';
                npc.targetResource = null;
            }
        }

        if (npc.goal === 'fighting') {
            const target = enemies.find(e => e.id === npc.targetEnemyId);
            if (!target || target.currentHealth <= 0) {
                npc.goal = 'harvesting';
                npc.targetEnemyId = null;
                continue;
            }

            if (npc.x === target.x && npc.y === target.y) {
                target.currentHealth -= npc.damage;
                // Les PNJ ne prennent pas de dégâts en retour pour l'instant pour simplifier
                // Si on veut qu'ils prennent des dégâts: npc.health -= target.damage;
                // addChatMessage(`${npc.name} attaque ${target.name} ! (${target.currentHealth}/${target.health} PV de l'ennemi)`, 'npc_combat');

                if (target.currentHealth <= 0) {
                    addChatMessage(`${npc.name} a vaincu ${target.name} !`, 'gain');
                    gameState.enemies = gameState.enemies.filter(e => e.id !== target.id);
                }
                // if (npc.health <= 0) continue; // Si les PNJ prennent des dégâts

            } else {
                let moveX = Math.sign(target.x - npc.x);
                let moveY = Math.sign(target.y - npc.y);
                if (moveX !== 0 && moveY !== 0) {
                    if (Math.random() < 0.5) moveX = 0; else moveY = 0;
                }
                const newX = npc.x + moveX;
                const newY = npc.y + moveY;
                if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                    npc.x = newX; npc.y = newY;
                }
            }

        } else if (npc.goal === 'depositing') {
            if (!shelterLocation || !shelterInventory) {
                npc.goal = 'harvesting';
                continue;
            }
            if (npc.x === shelterLocation.x && npc.y === shelterLocation.y) {
                let depositedCount = 0;
                for (const itemName in npc.inventory) {
                    const count = npc.inventory[itemName];
                    shelterInventory[itemName] = (shelterInventory[itemName] || 0) + count;
                    depositedCount += count;
                }
                if (depositedCount > 0) {
                     addChatMessage(`${npc.name} a déposé ${depositedCount} ressource(s) à la base.`, 'npc');
                }
                npc.inventory = {};

            } else {
                let moveX = Math.sign(shelterLocation.x - npc.x);
                let moveY = Math.sign(shelterLocation.y - npc.y);
                if (moveX !== 0 && moveY !== 0) {
                    if (Math.random() < 0.5) moveX = 0; else moveY = 0;
                }
                const newX = npc.x + moveX;
                const newY = npc.y + moveY;
                if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                    npc.x = newX; npc.y = newY;
                }
            }
        } else if (npc.goal === 'harvesting' || npc.goal === 'gathering_build_materials') {
            let canHarvestHere = false;
            if (currentTile.type.resource && currentTile.harvestsLeft > 0) {
                if (npc.goal === 'harvesting' || (npc.goal === 'gathering_build_materials' && currentTile.type.resource.type === npc.targetResource)) {
                    canHarvestHere = true;
                }
            }

            if (canHarvestHere) {
                const resourceType = currentTile.type.resource.type;
                const yieldAmount = currentTile.type.resource.yield || 1;

                npc.inventory[resourceType] = (npc.inventory[resourceType] || 0) + yieldAmount;
                if(currentTile.harvestsLeft !== Infinity) currentTile.harvestsLeft--;

            } else {
                let bestTile = null;
                let minPathDistance = Infinity;

                for (let y_scan = 0; y_scan < CONFIG.MAP_HEIGHT; y_scan++) {
                    for (let x_scan = 0; x_scan < CONFIG.MAP_WIDTH; x_scan++) {
                        const scanTile = map[y_scan][x_scan];
                        if (scanTile.type.accessible && scanTile.type.resource && scanTile.harvestsLeft > 0) {
                            if (npc.goal === 'harvesting' || (npc.goal === 'gathering_build_materials' && scanTile.type.resource.type === npc.targetResource)) {
                                const pathDist = Math.abs(npc.x - x_scan) + Math.abs(npc.y - y_scan);
                                if (pathDist < minPathDistance) {
                                    minPathDistance = pathDist;
                                    bestTile = { x: x_scan, y: y_scan };
                                }
                            }
                        }
                    }
                }

                if (bestTile) {
                    let moveX = Math.sign(bestTile.x - npc.x);
                    let moveY = Math.sign(bestTile.y - npc.y);
                    if (moveX !== 0 && moveY !== 0) {
                        if (Math.random() < 0.5) moveX = 0; else moveY = 0;
                    }
                    const newX = npc.x + moveX;
                    const newY = npc.y + moveY;
                    if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                        npc.x = newX; npc.y = newY;
                    }
                } else {
                    const moveX = Math.floor(Math.random() * 3) - 1;
                    const moveY = Math.floor(Math.random() * 3) - 1;
                    const newX = Math.max(0, Math.min(CONFIG.MAP_WIDTH - 1, npc.x + moveX));
                    const newY = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - 1, npc.y + moveY));

                    if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                        npc.x = newX; npc.y = newY;
                    }
                }
            }
        }
    }
}

export function handleNpcInteraction(npcId) {
    const npc = State.state.npcs.find(n => n.id === npcId);
    if (!npc) return;

    let interactionHTML = `<p>${npc.name} dit : "${npc.dialogueLines[Math.floor(Math.random() * npc.dialogueLines.length)]}"</p>`;

    if (npc.activeQuest && !npc.activeQuest.isCompleted) {
        interactionHTML += `<p><strong>Quête en cours : ${npc.activeQuest.title}</strong></p>`;
        interactionHTML += `<p>${npc.activeQuest.description}</p>`;
        if (State.state.player.inventory[npc.activeQuest.requirement.item] >= npc.activeQuest.requirement.amount) {
            interactionHTML += `<button class="npc-quest-btn" data-npc-id="${npc.id}" data-quest-action="complete">Donner ${npc.activeQuest.requirement.amount} ${npc.activeQuest.requirement.item}</button>`;
        } else {
            interactionHTML += `<p>(Il vous manque des ${npc.activeQuest.requirement.item} pour terminer.)</p>`;
        }
    } else if (npc.availableQuest && !npc.availableQuest.isCompleted) { // Ne proposer que si pas déjà complétée (ou réinitialisée)
        interactionHTML += `<p><strong>${npc.availableQuest.title}</strong></p>`;
        interactionHTML += `<p>${npc.availableQuest.description}</p>`;
        interactionHTML += `<button class="npc-quest-btn" data-npc-id="${npc.id}" data-quest-action="accept">Accepter la quête</button>`;
    } else if (npc.activeQuest && npc.activeQuest.isCompleted) {
        interactionHTML += `<p>Merci encore pour ton aide !</p>`;
    }


    // Afficher dans le chat (temporaire, idéalement une modale)
    // Pour que les boutons HTML fonctionnent dans le chat, il faut que le message soit ajouté avec innerHTML.
    // Attention : Ceci n'est pas idéal pour la sécurité si le contenu venait d'une source non sûre.
    // Pour ce cas interne, c'est acceptable pour prototyper.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = interactionHTML;
    const chatMessageElement = addChatMessage('', 'npc-dialogue', npc.name); // Crée le conteneur de message
    chatMessageElement.innerHTML = tempDiv.innerHTML; // Injecte le HTML

    // Attacher les écouteurs aux boutons nouvellement ajoutés dans le DOM du chat
    chatMessageElement.querySelectorAll('.npc-quest-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const action = e.target.dataset.questAction;
            const clickedNpcId = e.target.dataset.npcId;
            const questNpc = State.state.npcs.find(n => n.id === clickedNpcId);
            if (!questNpc) return;

            if (action === 'accept' && questNpc.availableQuest) {
                questNpc.activeQuest = { ...questNpc.availableQuest }; // Copier la quête
                questNpc.availableQuest = null; // La quête n'est plus "disponible" en attente
                addChatMessage(`Vous avez accepté la quête : "${questNpc.activeQuest.title}" de ${questNpc.name}.`, 'system_event');
                // Optionnel: réafficher le dialogue pour montrer que la quête est active
                // handleNpcInteraction(questNpc.id);
            } else if (action === 'complete' && questNpc.activeQuest) {
                if (State.hasResources({ [questNpc.activeQuest.requirement.item]: questNpc.activeQuest.requirement.amount }).success) {
                    State.applyResourceDeduction({ [questNpc.activeQuest.requirement.item]: questNpc.activeQuest.requirement.amount });
                    State.addResourceToPlayer(questNpc.activeQuest.reward.item, questNpc.activeQuest.reward.amount);
                    addChatMessage(`Quête "${questNpc.activeQuest.title}" terminée ! ${questNpc.name} vous donne ${questNpc.activeQuest.reward.amount} ${questNpc.activeQuest.reward.item}.`, 'gain');
                    questNpc.activeQuest.isCompleted = true;
                    // Pour l'instant, la quête complétée reste dans activeQuest avec isCompleted=true
                    // Vous pourriez la déplacer vers un tableau `completedQuests` ou la remettre dans `availableQuest`
                    // si elle est répétable après un certain temps.
                } else {
                    addChatMessage("Vous n'avez pas les objets requis !", "system_error");
                }
            }
            if (window.fullUIUpdate) window.fullUIUpdate();
        });
    });
}


export function npcChatter(npcs) {
    if (npcs.length === 0 || !window.gameState) return; // gameState global pour l'accès
    const npc = npcs[Math.floor(Math.random() * npcs.length)];
    let messages = [
        "Quelqu'un a vu de la nourriture ?",
        "Je rapporte du bois à la base.",
        "Faites attention, les ressources s'épuisent vite.",
        "On tiendra le coup, tous ensemble.",
        "Je vais chercher de quoi construire."
    ];

    if (npc.goal === 'depositing') {
        messages.push("Je vais déposer ces trouvailles à l'abri.");
    } else if (npc.goal === 'fighting' && npc.targetEnemyId) {
        messages.push("Un ennemi en vue ! À l'attaque !");
    } else if (npc.goal === 'gathering_build_materials' && npc.targetResource) {
        messages.push(`L'abri a besoin de ${npc.targetResource.toLowerCase()}, j'en cherche.`);
    } else if (npc.goal === 'harvesting') {
        const currentTile = window.gameState.map[npc.y][npc.x];
        if (currentTile && currentTile.type.resource) {
             messages.push(`Je crois qu'il y a du ${currentTile.type.resource.type.toLowerCase()} par ici.`);
        } else {
            messages.push("En quête de ressources utiles...");
        }
    }

    if (window.gameState.shelterLocation && window.gameState.map[window.gameState.shelterLocation.y][window.gameState.shelterLocation.x].inventory) {
        const shelterInv = window.gameState.map[window.gameState.shelterLocation.y][window.gameState.shelterLocation.x].inventory;
        if (isResourceLowAtShelter(shelterInv, 'Bois', 50)) {
            messages.push("Il nous faudrait plus de bois pour les constructions !");
        }
        if (isResourceLowAtShelter(shelterInv, 'Pierre', 30)) {
            messages.push("Quelqu'un a vu des pierres ? On en a besoin.");
        }
    } else if (!window.gameState.shelterLocation) {
         messages.push("On devrait vraiment construire un abri collectif solide !");
    }

    addChatMessage(messages[Math.floor(Math.random() * messages.length)], 'npc', npc.name);
}