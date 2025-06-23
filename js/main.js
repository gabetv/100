// js/main.js
import * as UI from './ui.js';
import { initDOM } from './ui/dom.js';
import DOM from './ui/dom.js';
import { CONFIG, ACTION_DURATIONS, SPRITESHEET_PATHS, TILE_TYPES, ITEM_TYPES, SEARCH_ZONE_CONFIG } from './config.js';
import * as State from './state.js';
import { decayStats, getTotalResources } from './player.js';
import { updateNpcs, npcChatter } from './npc.js';
import { updateEnemies, findEnemyOnTile, spawnSingleEnemy } from './enemy.js';
import * as Interactions from './interactions.js';
import { initAdminControls } from './admin.js';

let lastFrameTimestamp = 0;
let lastStatDecayTimestamp = 0;
let draggedItemInfo = null;

function updatePossibleActions() {
    if (!DOM.actionsEl) return;
    const oldScrollTop = DOM.actionsEl.scrollTop;
    DOM.actionsEl.innerHTML = '';

    if (!State.state || !State.state.player) return;
    const { player, map, combatState, enemies, knownRecipes } = State.state;

    if (!map || !map[player.y] || !map[player.y][player.x]) return;

    const tile = map[player.y][player.x];
    const tileType = tile.type;
    const enemyOnTile = findEnemyOnTile(player.x, player.y, enemies);

    const createButton = (text, actionId, data = {}, disabled = false, title = '', parent = DOM.actionsEl) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = disabled;
        button.title = title;
        button.onclick = (e) => {
            handleGlobalPlayerAction(actionId, data);
        };
        parent.appendChild(button);
        return button;
    };


    if (combatState || player.isBusy || player.animationState) {
        const statusDiv = document.createElement('div');
        statusDiv.style.textAlign = 'center';
        statusDiv.style.padding = '12px';
        if (combatState) {
            statusDiv.textContent = "EN COMBAT !";
            statusDiv.style.color = 'var(--accent-color)';
            statusDiv.style.fontWeight = 'bold';
        } else {
            statusDiv.textContent = player.animationState ? "Déplacement..." : "Action en cours...";
        }
        DOM.actionsEl.appendChild(statusDiv);
        DOM.actionsEl.scrollTop = oldScrollTop;
        return;
    }

    if (enemyOnTile) {
        const enemyStatus = document.createElement('div');
        enemyStatus.style.textAlign = 'center';
        enemyStatus.style.padding = '12px';
        enemyStatus.style.color = 'var(--accent-color)';
        enemyStatus.innerHTML = `<strong>DANGER !</strong><br>Un ${enemyOnTile.name} vous bloque le passage.`;
        DOM.actionsEl.appendChild(enemyStatus);
        createButton(`⚔️ Attaquer ${enemyOnTile.name}`, 'initiate_combat');
        DOM.actionsEl.scrollTop = oldScrollTop;
        return;
    }

    let tileKeyForSearch = null;
    for (const key in TILE_TYPES) {
        if (TILE_TYPES[key].name === tileType.name) {
            tileKeyForSearch = key;
            break;
        }
    }

    const hasBuilding = tile.buildings && tile.buildings.length > 0;

    if (!hasBuilding) {
        if (tileType.name === TILE_TYPES.PLAGE.name) { // Point 1: Actions Plage
            const canSearchPlage = tile.actionsLeft && tile.actionsLeft.search_zone > 0;
            const isInvFullForSearch = getTotalResources(player.inventory) >= player.maxInventory;
            createButton(`🔎 Fouiller la plage (${tile.actionsLeft?.search_zone || 0})`, 'search_zone', {}, !canSearchPlage || isInvFullForSearch,
                !canSearchPlage ? "Plus d'actions de fouille ici" : (isInvFullForSearch ? "Inventaire plein" : "Chercher des objets"));

            const canHarvestSand = tile.actionsLeft && tile.actionsLeft.harvest_sand > 0;
            const isInvFullForSand = getTotalResources(player.inventory) >= player.maxInventory;
            createButton(`⏳ Récolter Sable (${tile.actionsLeft?.harvest_sand || 0})`, 'harvest_sand', {}, !canHarvestSand || isInvFullForSand,
                !canHarvestSand ? "Plus d'actions de récolte de sable" : (isInvFullForSand ? "Inventaire plein" : "Récolter du sable"));

            const canFishPlage = tile.actionsLeft && tile.actionsLeft.fish > 0;
            const hasCaneEquipped = player.equipment.weapon && player.equipment.weapon.name === 'Canne à pêche'; // #25
            if (hasCaneEquipped) {
                 createButton(`🎣 Pêcher (${tile.actionsLeft?.fish || 0})`, 'fish', {}, !canFishPlage,
                    !canFishPlage ? "Plus d'actions de pêche" : "Pêcher du poisson");
            }


            const canHarvestSaltWater = tile.actionsLeft && tile.actionsLeft.harvest_salt_water > 0;
            createButton(`💧 Récolter Eau Salée (${tile.actionsLeft?.harvest_salt_water || 0})`, 'harvest_salt_water', {}, !canHarvestSaltWater,
                !canHarvestSaltWater ? "Plus d'actions de récolte d'eau salée" : "Récolter de l'eau salée");

        } else if (tileType.name === TILE_TYPES.FOREST.name || tileType.name === TILE_TYPES.PLAINS.name) { // #23 Fouille pour Forêt et Plaine
            const canSearchHere = tile.searchActionsLeft > 0;
            const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory;
            createButton(`🔎 Fouiller la zone (${tile.searchActionsLeft || 0})`, 'search_zone', {}, !canSearchHere || isInventoryFull,
                !canSearchHere ? "Zone déjà fouillée" : (isInventoryFull ? "Inventaire plein" : "Chercher des objets..."));
        }


        if (tileType.name === TILE_TYPES.FOREST.name || tileType.name === TILE_TYPES.PLAINS.name) {
            const equippedWeaponForActionsHunt = player.equipment.weapon;
            const canHunt = equippedWeaponForActionsHunt && (equippedWeaponForActionsHunt.type === 'weapon' || (equippedWeaponForActionsHunt.type === 'tool' && equippedWeaponForActionsHunt.stats && equippedWeaponForActionsHunt.stats.damage > 0));
            const huntActionsAvailable = tile.huntActionsLeft > 0; // #21
            let huntDisabledReason = "";
            if (!huntActionsAvailable) huntDisabledReason = "Plus de chasse possible ici.";
            else if (!canHunt) huntDisabledReason = "Nécessite une arme équipée.";
            else if (player.status === 'Drogué') huntDisabledReason = "Impossible de chasser sous l'effet de la drogue."; // #41

            createButton(`🏹 Chasser (${tile.huntActionsLeft || 0})`, 'hunt', {}, !huntActionsAvailable || !canHunt || player.status === 'Drogué', huntDisabledReason); // #20, #21
        }

        if (tileType.name === TILE_TYPES.PLAINS.name) {
            const canPlant = State.hasResources({ 'Graine d\'arbre': 5, 'Eau pure': 1 }).success;
            createButton("🌱 Planter Arbre", 'plant_tree', {}, !canPlant, !canPlant ? "Nécessite 5 graines, 1 eau pure" : "Transformer cette plaine en forêt");
        }
    }


    if (tile.type === TILE_TYPES.TREASURE_CHEST) {
        if (!tile.isOpened) {
            const hasKey = player.inventory[TILE_TYPES.TREASURE_CHEST.requiresKey] > 0;
            createButton("💎 Ouvrir le Trésor", 'open_treasure', {}, !hasKey, !hasKey ? `Nécessite : ${TILE_TYPES.TREASURE_CHEST.requiresKey}` : "Utiliser la clé pour ouvrir");
        } else {
            const p = document.createElement('p');
            p.textContent = "Ce trésor a déjà été vidé.";
            p.style.textAlign = 'center';
            DOM.actionsEl.appendChild(p);
        }
    }

    if (tile.hiddenItem) {
        const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory && !player.inventory[tile.hiddenItem];
        createButton(`🔑 Prendre ${tile.hiddenItem}`, 'take_hidden_item', {}, isInventoryFull, isInventoryFull ? "Inventaire plein" : `Ramasser ${tile.hiddenItem}`);
    }

    // Récolte générique (Pierre, Bois sur Forêt si pas d'outil spécifique)
    if (tileType.resource && (tile.harvestsLeft > 0 || tile.harvestsLeft === Infinity) && !hasBuilding) {
        const isInventoryFullHarvest = getTotalResources(player.inventory) >= player.maxInventory;
        if (tileType.name === TILE_TYPES.FOREST.name) { // #22, #24
            const canHarvestWood = tile.woodActionsLeft > 0;
            const equippedWeapon = player.equipment.weapon;
            if (equippedWeapon && equippedWeapon.name === 'Hache') {
                createButton(`🪓 Couper Bois (Hache) (${tile.woodActionsLeft || 0})`, 'harvest_wood_hache', {}, isInventoryFullHarvest || !canHarvestWood, isInventoryFullHarvest ? "Inventaire plein" : (!canHarvestWood ? "Plus de bois ici" : ""));
            } else if (equippedWeapon && equippedWeapon.name === 'Scie') {
                createButton(`🪚 Scier Bois (Scie) (${tile.woodActionsLeft || 0})`, 'harvest_wood_scie', {}, isInventoryFullHarvest || !canHarvestWood, isInventoryFullHarvest ? "Inventaire plein" : (!canHarvestWood ? "Plus de bois ici" : ""));
            } else { // #22 Ramasser Bois (mains nues)
                createButton(`✋ Ramasser Bois (${tile.woodActionsLeft || 0})`, 'harvest_wood_mains', {}, isInventoryFullHarvest || !canHarvestWood, isInventoryFullHarvest ? "Inventaire plein" : (!canHarvestWood ? "Plus de bois ici" : ""));
            }
        } else if (tileType.name === TILE_TYPES.MINE_TERRAIN.name) { // #26, #29
            const canHarvestStone = tile.harvestsLeft > 0;
             const resourceIcon = ITEM_TYPES[tileType.resource.type]?.icon || '';
            createButton(`${resourceIcon} Récolter Pierre (${tile.harvestsLeft || 0})`, 'harvest', {}, isInventoryFullHarvest || !canHarvestStone, isInventoryFullHarvest ? "Inventaire plein" : (!canHarvestStone ? "Plus de pierre ici" : ""));
        } else if (tileType.name !== TILE_TYPES.PLAGE.name) { // Plage gérée plus haut pour actions spécifiques
            // Pour les autres ressources
            if (!tile.buildings.some(b => TILE_TYPES[b.key]?.action?.id === 'harvest' || TILE_TYPES[b.key]?.actions?.some(a => a.id === 'harvest'))) {
                 const resourceIcon = ITEM_TYPES[tileType.resource.type]?.icon || '';
                createButton(`${resourceIcon} Récolter ${tileType.resource.type} (Terrain)`, 'harvest', {}, isInventoryFullHarvest, isInventoryFullHarvest ? "Inventaire plein" : "");
            }
        }
    }

    // #28 Chercher minerai sur MINE_TERRAIN avec Pioche
    if (tileType.name === TILE_TYPES.MINE_TERRAIN.name && player.equipment.weapon && player.equipment.weapon.name === 'Pioche') {
        createButton("⛏️ Chercher des Minerais (Terrain)", 'use_building_action', { buildingKey: null, specificActionId: 'search_ore_tile' }); // buildingKey null car c'est une action de terrain
    }


    // Point 2: Boire Eau Salée (condition de lieu et soif gérée dans handlePlayerAction)
    if (player.inventory['Eau salée'] > 0 && tileType.name === TILE_TYPES.PLAGE.name && player.thirst <= player.maxThirst - ITEM_TYPES['Eau salée'].effects.thirst) {
        createButton("🚱 Boire Eau Salée", 'consume_eau_salee', {itemName: 'Eau salée'});
    }

    // #6: Ouvrir tous les parchemins
    const parcheminCount = State.countItemTypeInInventory('teachesRecipe'); // Vérifie les items avec teachesRecipe
    if (parcheminCount >= 2) {
        createButton("📜 Ouvrir tous les Parchemins", 'open_all_parchemins');
    }


    if (!combatState) {
        const npcsOnTile = State.state.npcs.filter(npc => npc.x === player.x && npc.y === player.y);
        npcsOnTile.forEach(npc => {
            const talkButton = createButton(`💬 Parler à ${npc.name}`, 'talk_to_npc', { npcId: npc.id });
        });
    }

    if (tile.type.buildable && !hasBuilding) {
        const mainBuildButton = document.createElement('button');
        mainBuildButton.id = 'main-build-btn';
        mainBuildButton.textContent = "🏗️ Construire...";
        mainBuildButton.onclick = () => {
            UI.showBuildModal(State.state);
        };
        DOM.actionsEl.appendChild(mainBuildButton);
    }

    if (tile.buildings && tile.buildings.length > 0) {
        const buildingsHeader = document.createElement('h4');
        buildingsHeader.textContent = "Actions des Bâtiments";
        DOM.actionsEl.appendChild(buildingsHeader);

        tile.buildings.forEach((buildingInstance, index) => {
            const buildingDef = TILE_TYPES[buildingInstance.key];
            if (!buildingDef) return;

            const buildingNameDisplay = document.createElement('p');
            buildingNameDisplay.innerHTML = `<strong>${buildingDef.name}</strong> (Durabilité: ${buildingInstance.durability}/${buildingInstance.maxDurability})`;
            if (buildingDef.maxHarvestsPerCycle) { // #18
                buildingNameDisplay.innerHTML += ` (Récoltes: ${buildingInstance.harvestsAvailable || 0}/${buildingInstance.maxHarvestsPerCycle || 0})`;
            }
            buildingNameDisplay.style.marginBottom = '5px';
            buildingNameDisplay.style.borderTop = '1px solid #ccc';
            buildingNameDisplay.style.paddingTop = '5px';
            DOM.actionsEl.appendChild(buildingNameDisplay);

            if (buildingDef.sleepEffect) {
                 createButton("😴 Dormir (8h)", 'sleep', { buildingKeyForDamage: buildingInstance.key });
            }

            // Point 14: Démanteler bâtiment
            if (player.hunger >= 5 && player.thirst >= 5 && player.sleep >= 5) {
                createButton(`🔩 Démanteler ${buildingDef.name}`, 'dismantle_building', { buildingKey: buildingInstance.key, buildingIndex: index }, false, "Récupérer une partie des matériaux (-5 Faim/Soif/Sommeil)");
            } else {
                 createButton(`🔩 Démanteler ${buildingDef.name}`, 'dismantle_building', { buildingKey: buildingInstance.key, buildingIndex: index }, true, "Trop fatigué pour démanteler (5 Faim/Soif/Sommeil requis)");
            }


            if (buildingInstance.key === 'CAMPFIRE' && buildingInstance.durability > 0) {
                // Point 18: Dormir près du feu
                createButton("🔥 Dormir près du feu (1h)", 'sleep_by_campfire', { buildingKey: 'CAMPFIRE'}, player.sleep >= player.maxSleep, player.sleep >= player.maxSleep ? "Sommeil au max" : "");

                // Point 29, 30, 31 & cuisson existante
                if (player.inventory['Poisson cru'] > 0 && State.hasResources({'Bois':1}).success) createButton("🍳 Cuisiner Poisson", 'cook', {raw: 'Poisson cru', buildingKeyForDamage: 'CAMPFIRE'});
                if (player.inventory['Viande crue'] > 0 && State.hasResources({'Bois':1}).success) createButton("🍖 Cuisiner Viande", 'cook', {raw: 'Viande crue', buildingKeyForDamage: 'CAMPFIRE'});
                if (player.inventory['Oeuf cru'] > 0 && State.hasResources({'Bois':1}).success) createButton("🍳 Cuisiner Oeuf", 'cook', {raw: 'Oeuf cru', buildingKeyForDamage: 'CAMPFIRE'});

                // Point 7: Faire bouillir Eau Croupie
                if (player.inventory['Eau croupie'] > 0 && State.hasResources({'Bois':1}).success) {
                    createButton("💧 Faire bouillir Eau Croupie", 'use_building_action', { buildingKey: 'CAMPFIRE', specificActionId: 'boil_stagnant_water_campfire' });
                }
                // Point 8: Faire bouillir Eau Salée
                if (player.inventory['Eau salée'] > 0 && State.hasResources({'Bois':1}).success) {
                    createButton("🧂 Faire bouillir Eau Salée", 'use_building_action', { buildingKey: 'CAMPFIRE', specificActionId: 'boil_salt_water_campfire' });
                }
            }

            // Point 9, 16: Fabriquer Antiseptique au Laboratoire
            if (buildingInstance.key === 'LABORATOIRE' && buildingInstance.durability > 0) {
                const canCraftAntiseptic = State.hasResources({ 'Kit de Secours': 2, 'Recette médicinale': 1 }).success;
                createButton("🧪 Fabriquer Antiseptique", 'use_building_action',
                             { buildingKey: 'LABORATOIRE', specificActionId: 'use_laboratoire', craftItem: 'Antiseptique' },
                             !canCraftAntiseptic,
                             !canCraftAntiseptic ? "Nécessite 2 Kits de Secours, 1 Recette Médicinale" : "");
            }

            // Pour l'Atelier, l'action 'use_atelier' ouvrira la modale
            if (buildingInstance.key === 'ATELIER' && buildingInstance.durability > 0) {
                createButton("🛠️ Utiliser l'Atelier", 'use_building_action', { buildingKey: 'ATELIER', specificActionId: 'use_atelier'});
            }
            // Pour la Mine (Bâtiment), l'action 'search_ore_building'
            if (buildingInstance.key === 'MINE' && buildingInstance.durability > 0 && player.equipment.weapon && player.equipment.weapon.name === 'Pioche') { // #28
                createButton("⛏️ Chercher Minerais (Bât.)", 'use_building_action', { buildingKey: 'MINE', specificActionId: 'search_ore_building' });
            }


            const actionsToShow = buildingDef.actions || (buildingDef.action ? [buildingDef.action] : []);
            actionsToShow.forEach(actionInfo => {
                 let disabledAction = false;
                 let titleAction = actionInfo.name;
                 if (actionInfo.costItem && (!player.inventory[actionInfo.costItem] || player.inventory[actionInfo.costItem] < 1)) {
                     disabledAction = true;
                     titleAction += ` (Nécessite 1 ${actionInfo.costItem})`;
                 }
                 // #18 Harvest from building (Bananeraie etc.)
                 if (['harvest_bananeraie', 'harvest_sucrerie', 'harvest_cocoteraie', 'harvest_poulailler', 'harvest_enclos_cochons'].includes(actionInfo.id)) {
                     if (!buildingInstance.harvestsAvailable || buildingInstance.harvestsAvailable <= 0) {
                         disabledAction = true;
                         titleAction = "Rien à récolter (arrosez/abreuvez)";
                     }
                 }

                 // Éviter de dupliquer les actions déjà gérées (Atelier, puits spécifiques, actions spécifiques du labo/feu de camp)
                 if (actionInfo.id !== 'use_atelier' && // Atelier géré spécifiquement ci-dessus
                     actionInfo.id !== 'draw_water_shallow_well' &&
                     actionInfo.id !== 'draw_water_deep_well' &&
                     !(buildingInstance.key === 'LABORATOIRE' && actionInfo.id === 'use_laboratoire') &&
                     !(buildingInstance.key === 'CAMPFIRE' && (actionInfo.id === 'boil_stagnant_water_campfire' || actionInfo.id === 'boil_salt_water_campfire')) &&
                     !(buildingInstance.key === 'MINE' && actionInfo.id === 'search_ore_building') // Mine building action
                    ) {
                    createButton( actionInfo.name, 'use_building_action', { buildingKey: buildingInstance.key, specificActionId: actionInfo.id }, disabledAction, titleAction );
                 }
            });

            if (buildingDef.inventory) {
                const openChestButton = createButton( `🧰 Ouvrir Stockage (${buildingDef.name})`, 'open_building_inventory', { buildingKey: buildingInstance.key });
                openChestButton.onclick = () => UI.showInventoryModal(State.state);
            }
        });
    }
    DOM.actionsEl.scrollTop = oldScrollTop;
}

function handleEvents() {
    if (!State.state || !State.state.activeEvent) return;
    const { activeEvent } = State.state;
    if (activeEvent.duration > 0) {
        activeEvent.duration--;
        if (activeEvent.duration === 0) {
            UI.addChatMessage(`L'événement "${activeEvent.type}" est terminé.`, "system");
            activeEvent.type = 'none';
            activeEvent.data = null;
        }
        return;
    }
    if (Math.random() > 0.85) {
        const eventType = Math.random() < 0.5 ? 'Tempête' : 'Abondance';
        if (eventType === 'Tempête') {
            activeEvent.type = 'Tempête';
            activeEvent.duration = 1;
            UI.addChatMessage("Une tempête approche ! Il sera plus difficile de survivre.", "system_event");
        } else {
            const abundantResourceList = ['Bois', 'Poisson cru', 'Pierre', 'Feuilles'];
            const abundantResource = abundantResourceList[Math.floor(Math.random() * abundantResourceList.length)];
            activeEvent.type = 'Abondance';
            activeEvent.duration = 2;
            activeEvent.data = { resource: abundantResource };
            UI.addChatMessage(`Les ${abundantResource.toLowerCase()}s sont étrangement abondants !`, "system_event");
        }
    }
}

function gameLoop(currentTime) {
    if (!State.state || !State.state.player) {
        requestAnimationFrame(gameLoop);
        return;
    }
    const { player, isGameOver, combatState } = State.state;
    if (isGameOver) return;
    if (player.health <= 0) {
        if(!isGameOver) endGame(false);
        return;
    }
    if (lastFrameTimestamp === 0) lastFrameTimestamp = currentTime;
    const deltaTime = currentTime - lastFrameTimestamp;
    lastFrameTimestamp = currentTime;

    if (!combatState) {
        if (currentTime - lastStatDecayTimestamp > CONFIG.STAT_DECAY_INTERVAL_MS) {
            const decayResult = decayStats(State.state);
            if(decayResult && decayResult.message) UI.addChatMessage(decayResult.message, 'system');
            lastStatDecayTimestamp = currentTime;
        }
        if (!player.animationState && !player.isBusy) {
            updateNpcs(State.state, deltaTime);
        }
    }

    if (player.animationState) {
        const anim = player.animationState;
        const safeDeltaTime = Math.min(deltaTime, 50);
        anim.progress += safeDeltaTime / ACTION_DURATIONS.MOVE_TRANSITION;

        if (anim.progress >= 1) {
            if (anim.type === 'out') {
                State.applyPlayerMove(anim.direction);
                UI.renderScene(State.state);
                anim.type = 'in';
                anim.progress = 0;
            } else {
                player.animationState = null;
                player.isBusy = false;
                fullUIUpdate();
            }
        }
    }

    UI.renderScene(State.state);
    requestAnimationFrame(gameLoop);
}

function handleNavigation(direction) {
    if (!State.state || !State.state.player) return;
    const { player, map, enemies, combatState } = State.state;
    if (player.isBusy || player.animationState || combatState) {
        return;
    }

    const currentEnemyOnTile = findEnemyOnTile(player.x, player.y, enemies);
    if (currentEnemyOnTile) {
        UI.addChatMessage("Vous ne pouvez pas fuir, vous devez combattre !", "system");
        State.startCombat(player, currentEnemyOnTile);
        UI.showCombatModal(State.state.combatState);
        updatePossibleActions();
        return;
    }

    let newX = player.x, newY = player.y;
    if (direction === 'north') newY--;
    else if (direction === 'south') newY++;
    else if (direction === 'west') newX--;
    else if (direction === 'east') newX++;

    if (newX < 0 || newX >= CONFIG.MAP_WIDTH || newY < 0 || newY >= CONFIG.MAP_HEIGHT || !map[newY][newX].type.accessible) {
        UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system");
        if(DOM[`nav${direction.charAt(0).toUpperCase() + direction.slice(1)}`]) {
            UI.triggerShake(DOM[`nav${direction.charAt(0).toUpperCase() + direction.slice(1)}`]);
        }
        return;
    }

    if (!Interactions.applyRandomStatCost(player, 1, "déplacement")) {
        // Géré dans applyRandomStatCost
    }

    player.isBusy = true;
    player.animationState = { type: 'out', direction: direction, progress: 0 };

    updatePossibleActions();
    UI.updateAllButtonsState(State.state);
}

function handleSpecificConsume(statType) {
    if (!State.state || !State.state.player) return;
    const { player } = State.state;

    if (player.isBusy || player.animationState) {
        UI.addChatMessage("Vous êtes occupé.", "system");
        return;
    }

    let itemToConsume = null;
    const inventory = player.inventory;
    switch (statType) {
        case 'health':
            if (inventory['Kit de Secours'] > 0 && player.status === 'Malade') itemToConsume = 'Kit de Secours';
            else if (inventory['Médicaments'] > 0 && (player.status === 'Malade' || player.status === 'Gravement malade' || player.status === 'Drogué')) itemToConsume = 'Médicaments';
            else if (inventory['Antiseptique'] > 0 && (player.status === 'Blessé' || player.status === 'Malade' /*|| player.status === 'Gravement malade'*/) && player.health < player.maxHealth) itemToConsume = 'Antiseptique'; // #49
            else if (inventory['Bandage'] > 0 && player.health < player.maxHealth) itemToConsume = 'Bandage';
            else if (inventory['Savon'] > 0 && player.health < player.maxHealth) itemToConsume = 'Savon';
            else if (inventory['Huile de coco'] > 0 && player.health < player.maxHealth) itemToConsume = 'Huile de coco';
            break;
        case 'thirst':
            if (inventory['Eau pure'] > 0 && player.thirst < player.maxThirst) itemToConsume = 'Eau pure';
            else if (inventory['Noix de coco'] > 0 && player.thirst < player.maxThirst) itemToConsume = 'Noix de coco';
            else if (inventory['Alcool'] > 0 && player.thirst < player.maxThirst -1 ) itemToConsume = 'Alcool'; // #39
            break;
        case 'hunger':
            const foodItems = ['Viande cuite', 'Poisson cuit', 'Oeuf cuit', 'Barre Énergétique', 'Banane', 'Sucre', 'Sel'];
            for (const food of foodItems) {
                if (inventory[food] > 0 && player.hunger < player.maxHunger) {
                    itemToConsume = food;
                    break;
                }
            }
            break;
        default: UI.addChatMessage("Type de consommation inconnu via bouton rapide.", "system"); return;
    }

    if (!itemToConsume) {
        let message = "Vous n'avez rien pour ";
        let targetButton = null;
        if (statType === 'health' && DOM.consumeHealthBtn) { message += "vous soigner (ou vous n'êtes pas dans l'état requis / santé max)."; targetButton = DOM.consumeHealthBtn; }
        else if (statType === 'thirst' && DOM.consumeThirstBtn) { message += "étancher votre soif (ou soif max)."; targetButton = DOM.consumeThirstBtn; }
        else if (statType === 'hunger' && DOM.consumeHungerBtn) { message += "calmer votre faim (ou faim max)."; targetButton = DOM.consumeHungerBtn; }
        UI.addChatMessage(message, "system");
        if (targetButton) UI.triggerShake(targetButton);
        return;
    }
    const result = State.consumeItem(itemToConsume);
    UI.addChatMessage(result.message, result.success ? (itemToConsume === 'Porte bonheur' ? 'system_event' : 'system') : 'system_error');
    if (result.success) {
        UI.triggerActionFlash('gain');
        if (result.floatingTexts && result.floatingTexts.length > 0) {
            result.floatingTexts.forEach(text => {
                const type = text.startsWith('+') ? 'gain' : (text.startsWith('-') ? 'cost' : 'info');
                if (text.toLowerCase().includes('statut:')) UI.showFloatingText(text, type);
                else if (itemToConsume === 'Porte bonheur' && text.includes('+1')) UI.showFloatingText(text, type);
            });
        }
        fullUIUpdate();
    } else { if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); }
}


function handleConsumeClick(itemName) {
    if (!State.state || !State.state.player) return;
    const { player } = State.state;
    if (player.isBusy || player.animationState) { UI.addChatMessage("Vous êtes occupé.", "system"); return; }

    const itemDef = ITEM_TYPES[itemName];

    if (itemDef && itemDef.effects) {
        if ((itemName === 'Eau pure' || itemName === 'Eau salée' || itemName === 'Eau croupie' || itemName === 'Noix de coco') && player.thirst >= player.maxThirst) {
            const msg = itemName === 'Noix de coco' || itemName === 'Eau pure' ? "Vous n'avez pas soif." : "Vous n'avez pas soif, vous devriez économiser cette eau précieuse.";
            UI.addChatMessage(msg, "system"); return;
        }
        const onlyHungerEffect = Object.keys(itemDef.effects).length === 1 && itemDef.effects.hunger && itemDef.effects.hunger > 0;
        if (onlyHungerEffect && player.hunger >= player.maxHunger) {
            UI.addChatMessage("Vous n'avez pas faim pour l'instant.", "system"); return;
        }
        if ((itemName === 'Savon' || itemName === 'Bandage' || itemName === 'Huile de coco') && player.health >= player.maxHealth) {
            UI.addChatMessage("Votre santé est au maximum.", "system"); return;
        }
        if (itemName === 'Alcool' && player.thirst >= player.maxThirst -1) { // #39
            UI.addChatMessage("Vous n'avez pas assez soif pour boire de l'alcool.", "system"); return;
        }
        if (itemName === 'Antiseptique' && player.health >= player.maxHealth) { // #49
            UI.addChatMessage("Votre santé est au maximum, l'antiseptique ne sera pas utilisé.", "system"); return;
        }
    }

    if (itemName === 'Eau salée') {
         handleGlobalPlayerAction('consume_eau_salee', {itemName: 'Eau salée'});
         return;
    }
    if (itemDef && itemDef.slot && ['weapon', 'shield', 'body', 'head', 'feet', 'bag'].includes(itemDef.slot)) {
        const equipResult = State.equipItem(itemName);
        UI.addChatMessage(equipResult.message, equipResult.success ? 'system' : 'system_error');
        if (equipResult.success) fullUIUpdate();
        return;
    }
    if (itemName === 'Batterie chargée' && player.equipment.weapon && (player.equipment.weapon.name === 'Radio déchargée' || player.equipment.weapon.name === 'Téléphone déchargé')) {
        const result = State.consumeItem(itemName);
        UI.addChatMessage(result.message, result.success ? 'system_event' : 'system_error');
        if (result.success) fullUIUpdate();
        return;
    }

    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe && itemDef.type !== 'usable' && itemDef.type !== 'key') ) {
        if (itemDef && !itemDef.teachesRecipe) {
            UI.addChatMessage(`"${itemName}" n'est pas consommable directement depuis l'inventaire de cette manière.`, "system");
        }
        return;
    }
    if (itemName === 'Carte') {
        handleGlobalPlayerAction('open_large_map', {});
        return;
    }
    const result = State.consumeItem(itemName);
    UI.addChatMessage(result.message, result.success ? (itemName.startsWith('Parchemin') || itemName === 'Porte bonheur' || itemName === 'Batterie chargée' ? 'system_event' : 'system') : 'system_error');
    if(result.success) {
        UI.triggerActionFlash('gain');
        if (result.floatingTexts && result.floatingTexts.length > 0) {
            result.floatingTexts.forEach(text => {
                 const type = text.startsWith('+') ? 'gain' : (text.startsWith('-') ? 'cost' : 'info');
                if (text.toLowerCase().includes('statut:')) UI.showFloatingText(text, type);
                else if (itemName === 'Porte bonheur' && text.includes('+1')) UI.showFloatingText(text, type);
            });
        }
        fullUIUpdate();
    } else { if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); }
}

window.fullUIUpdate = function() {
    if (!State.state || !State.state.player) return;
    UI.updateAllUI(State.state);
    updatePossibleActions();
    UI.updateAllButtonsState(State.state);

    if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.updateEquipmentModal(State.state);
    if (DOM.inventoryModal && !DOM.inventoryModal.classList.contains('hidden')) UI.showInventoryModal(State.state);
    if (DOM.largeMapModal && !DOM.largeMapModal.classList.contains('hidden')) {
        if (State.state && State.state.config) {
            UI.drawLargeMap(State.state, State.state.config);
            UI.populateLargeMapLegend();
        }
    }
    if (DOM.buildModal && !DOM.buildModal.classList.contains('hidden')) {
        UI.populateBuildModal(State.state);
    }
    if (DOM.workshopModal && !DOM.workshopModal.classList.contains('hidden')) { // AJOUT
        UI.populateWorkshopModal(State.state);
    }
    if (DOM.bottomBarEl) {
        UI.updateGroundItemsPanel(State.state.map[State.state.player.y][State.state.player.x]);
    }
};
window.updatePossibleActions = updatePossibleActions;
window.UI = UI; // Rendre UI globalement accessible (peut-être déjà fait par l'import, mais pour être sûr)

window.handleGlobalPlayerAction = (actionId, data) => {
    Interactions.handlePlayerAction(actionId, data, {
        updateAllUI: window.fullUIUpdate,
        updatePossibleActions: window.updatePossibleActions,
        updateAllButtonsState: () => window.UI.updateAllButtonsState(State.state)
    });
};


function dailyUpdate() {
    if (!State.state || State.state.isGameOver) return;
    if (State.state.day >= CONFIG.VICTORY_DAY) { endGame(true); return; } // #43
    State.state.day++;
    handleEvents();
    if (State.state.day % CONFIG.ENEMY_SPAWN_CHECK_DAYS === 0) {
        if (State.state.enemies.length < CONFIG.MAX_ENEMIES) {
            const newEnemy = spawnSingleEnemy(State.state.map);
            if (newEnemy) {
                State.addEnemy(newEnemy);
                UI.addChatMessage("Vous sentez une présence hostile non loin...", "system");
            }
        }
    }
    window.fullUIUpdate();
}

function handleDragStart(e) {
    const itemEl = e.target instanceof Element ? e.target.closest('.inventory-item[draggable="true"]') : null;
    if (!itemEl) return;
    const ownerEl = itemEl.closest('[data-owner], .equipment-slot[data-owner], .equipment-slot-small[data-owner]');
    if (!ownerEl) { console.warn("Drag Start: Owner element not found for", itemEl); return; }

    draggedItemInfo = {
        element: itemEl,
        itemName: itemEl.dataset.itemName,
        itemCount: parseInt(itemEl.dataset.itemCount || '1', 10),
        sourceOwner: ownerEl.dataset.owner,
        sourceSlotType: itemEl.dataset.slotType
    };
    setTimeout(() => itemEl.classList.add('dragging'), 0);
}
function handleDragOver(e) {
    e.preventDefault();
    const dropZone = e.target.closest('.droppable');
    if (dropZone) dropZone.classList.add('drag-over');
}
function handleDragLeave(e) {
    const dropZone = e.target.closest('.droppable');
    if (dropZone) dropZone.classList.remove('drag-over');
}
function handleDragEnd() {
    if (draggedItemInfo && draggedItemInfo.element) draggedItemInfo.element.classList.remove('dragging');
    draggedItemInfo = null;
    document.querySelectorAll('.droppable.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDrop(e) {
    e.preventDefault();
    const dropZone = e.target.closest('.droppable');
    if (!draggedItemInfo || !dropZone) return;

    const destOwner = dropZone.dataset.owner;
    const destSlotType = dropZone.dataset.slotType;

    let transferProcessed = false;

    if (destOwner === 'equipment') {
        const itemDef = ITEM_TYPES[draggedItemInfo.itemName];
        if (draggedItemInfo.sourceOwner === 'player-inventory') {
            if (itemDef && itemDef.slot === destSlotType) {
                State.equipItem(draggedItemInfo.itemName);
                transferProcessed = true;
            } else { UI.addChatMessage("Cet objet ne va pas dans cet emplacement.", "system"); }
        }
    } else if (destOwner === 'player-inventory') {
        if (draggedItemInfo.sourceOwner === 'equipment' && draggedItemInfo.sourceSlotType) {
            State.unequipItem(draggedItemInfo.sourceSlotType);
            transferProcessed = true;
        } else if (draggedItemInfo.sourceOwner === 'ground') {
            const itemName = draggedItemInfo.itemName;
            const maxAmount = draggedItemInfo.itemCount;
            if (maxAmount > 1) {
                UI.showQuantityModal(`Ramasser ${itemName}`, maxAmount, (amount) => {
                    if (amount > 0) {
                        const result = State.pickUpItemFromGround(itemName, amount);
                        UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                    }
                    window.fullUIUpdate();
                });
            } else {
                const result = State.pickUpItemFromGround(itemName, 1);
                UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
            }
            transferProcessed = true;
        }
    } else if (dropZone.closest('#inventory-modal')) {
        let transferType = '';
        if (draggedItemInfo.sourceOwner === 'player-inventory' && destOwner === 'shared') transferType = 'deposit';
        else if (draggedItemInfo.sourceOwner === 'shared' && destOwner === 'player-inventory') transferType = 'withdraw';

        if (transferType) {
            if (draggedItemInfo.itemCount > 1) {
                UI.showQuantityModal(draggedItemInfo.itemName, draggedItemInfo.itemCount, amount => {
                    if (amount > 0) State.applyBulkInventoryTransfer(draggedItemInfo.itemName, amount, transferType);
                    window.fullUIUpdate();
                });
            } else { State.applyBulkInventoryTransfer(draggedItemInfo.itemName, 1, transferType); }
            transferProcessed = true;
        }
    } else if (destOwner === 'ground' && draggedItemInfo.sourceOwner === 'player-inventory') {
        const itemName = draggedItemInfo.itemName;
        const maxAmount = draggedItemInfo.itemCount;
        if (maxAmount > 1) {
            UI.showQuantityModal(`Déposer ${itemName}`, maxAmount, (amount) => {
                if (amount > 0) {
                    const result = State.dropItemOnGround(itemName, amount);
                    UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                }
                window.fullUIUpdate();
            });
        } else {
            const result = State.dropItemOnGround(itemName, 1);
            UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
        }
        transferProcessed = true;
    }

    if (transferProcessed) window.fullUIUpdate();
    if (dropZone) dropZone.classList.remove('drag-over');
}


function setupDragAndDropForContainer(containerElement) {
    if (!containerElement) return;
    containerElement.addEventListener('dragstart', handleDragStart);
    containerElement.addEventListener('dragover', handleDragOver);
    containerElement.addEventListener('dragleave', handleDragLeave);
    containerElement.addEventListener('dragend', handleDragEnd);
    containerElement.addEventListener('drop', handleDrop);
}

function handleEquipmentSlotClick(slotType) {
    if (!State.state || !State.state.player) return;
    const { player } = State.state;
    if (player.isBusy || player.animationState) { UI.addChatMessage("Vous êtes occupé.", "system"); return; }
    if (player.equipment[slotType]) {
        const unequipResult = State.unequipItem(slotType);
        UI.addChatMessage(unequipResult.message, unequipResult.success ? 'system' : 'system_error');
        if (unequipResult.success) window.fullUIUpdate();
    }
}

function setupEventListeners() {
    if (!DOM.navNorth) { console.error("DOM non initialisé avant setupEventListeners"); return; }

    DOM.navNorth.addEventListener('click', () => handleNavigation('north'));
    DOM.navSouth.addEventListener('click', () => handleNavigation('south'));
    DOM.navEast.addEventListener('click', () => handleNavigation('east'));
    DOM.navWest.addEventListener('click', () => handleNavigation('west'));

    if (DOM.consumeHealthBtn) DOM.consumeHealthBtn.addEventListener('click', () => handleSpecificConsume('health'));
    if (DOM.consumeThirstBtn) DOM.consumeThirstBtn.addEventListener('click', () => handleSpecificConsume('thirst'));
    if (DOM.consumeHungerBtn) DOM.consumeHungerBtn.addEventListener('click', () => handleSpecificConsume('hunger'));

    if (DOM.closeEquipmentModalBtn) DOM.closeEquipmentModalBtn.addEventListener('click', UI.hideEquipmentModal);
    if (DOM.closeBuildModalBtn) DOM.closeBuildModalBtn.addEventListener('click', UI.hideBuildModal);
    if (DOM.closeWorkshopModalBtn) DOM.closeWorkshopModalBtn.addEventListener('click', UI.hideWorkshopModal); // Corrigé

    if (DOM.enlargeMapBtn) DOM.enlargeMapBtn.addEventListener('click', () => handleGlobalPlayerAction('open_large_map', {}));
    if (DOM.closeLargeMapBtn) DOM.closeLargeMapBtn.addEventListener('click', UI.hideLargeMap);

    if (DOM.toggleChatSizeBtn && DOM.bottomBarChatPanelEl) {
        DOM.toggleChatSizeBtn.addEventListener('click', () => {
            DOM.bottomBarChatPanelEl.classList.toggle('chat-enlarged');
            if (DOM.bottomBarEl) DOM.bottomBarEl.classList.toggle('chat-enlarged');
            if (DOM.toggleChatSizeBtn) DOM.toggleChatSizeBtn.textContent = DOM.bottomBarChatPanelEl.classList.contains('chat-enlarged') ? '⌄' : '⌃';
            if (DOM.chatMessagesEl) DOM.chatMessagesEl.scrollTop = DOM.chatMessagesEl.scrollHeight;
        });
    }

    if (DOM.closeInventoryModalBtn) DOM.closeInventoryModalBtn.addEventListener('click', UI.hideInventoryModal);

    if (DOM.inventoryCategoriesEl) {
        DOM.inventoryCategoriesEl.addEventListener('click', e => {
            const itemEl = e.target.closest('.inventory-item');
            if (itemEl && itemEl.dataset.itemName) {
                handleConsumeClick(itemEl.dataset.itemName);
            } else {
                const header = e.target.closest('.category-header');
                if (header) {
                    header.classList.toggle('open');
                    if (header.nextElementSibling) header.nextElementSibling.classList.toggle('visible');
                }
            }
        });
        setupDragAndDropForContainer(DOM.inventoryCategoriesEl);
    }

    if (DOM.bottomBarGroundItemsEl) {
        DOM.bottomBarGroundItemsEl.addEventListener('click', e => {
            const itemEl = e.target.closest('.inventory-item');
            if (itemEl && itemEl.dataset.itemName) {
                const itemName = itemEl.dataset.itemName;
                const maxAmount = parseInt(itemEl.dataset.itemCount, 10);
                UI.showQuantityModal(`Ramasser ${itemName}`, maxAmount, (amount) => {
                    if (amount > 0) {
                        const result = State.pickUpItemFromGround(itemName, amount);
                        UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                        window.fullUIUpdate();
                    }
                });
            }
        });
         setupDragAndDropForContainer(DOM.bottomBarGroundItemsEl);
    }

    if (DOM.equipmentModal) setupDragAndDropForContainer(DOM.equipmentModal);
    if (DOM.inventoryModal) setupDragAndDropForContainer(DOM.inventoryModal);
    if (DOM.buildModal) setupDragAndDropForContainer(DOM.buildModal);
    if (DOM.workshopModal) setupDragAndDropForContainer(DOM.workshopModal);

    if (DOM.bottomBarEquipmentSlotsEl) {
        setupDragAndDropForContainer(DOM.bottomBarEquipmentSlotsEl);
        DOM.bottomBarEquipmentSlotsEl.addEventListener('click', e => {
            const slotEl = e.target.closest('.equipment-slot-small.droppable, .equipment-slot-container-small.droppable'); // #13, #15
            if (slotEl && slotEl.dataset.slotType) {
                const itemContent = slotEl.querySelector('.inventory-item'); // Check if an item is actually in the slot part
                if (itemContent && itemContent.closest('.equipment-slot-small')) { // Ensure click was on item in slot
                     handleEquipmentSlotClick(slotEl.dataset.slotType);
                }
            }
        });
    }
    if (DOM.equipmentSlotsEl) {
        DOM.equipmentSlotsEl.addEventListener('click', e => {
            const slotEl = e.target.closest('.equipment-slot.droppable');
            if (slotEl && slotEl.dataset.slotType) {
                const itemContent = slotEl.querySelector('.inventory-item');
                if (itemContent) handleEquipmentSlotClick(slotEl.dataset.slotType);
            }
        });
    }

    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (DOM.workshopModal && !DOM.workshopModal.classList.contains('hidden')) UI.hideWorkshopModal();
            else if (DOM.buildModal && !DOM.buildModal.classList.contains('hidden')) UI.hideBuildModal();
            else if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.hideEquipmentModal();
            else if (DOM.inventoryModal && !DOM.inventoryModal.classList.contains('hidden')) UI.hideInventoryModal();
            else if (DOM.largeMapModal && !DOM.largeMapModal.classList.contains('hidden')) UI.hideLargeMap();
            else if (DOM.combatModal && !DOM.combatModal.classList.contains('hidden')) UI.hideCombatModal();
            else if (DOM.quantityModal && !DOM.quantityModal.classList.contains('hidden')) UI.hideQuantityModal();
            return;
        }

        if (e.key === 'Enter') {
            if (document.activeElement === DOM.chatInputEl) {
                if (DOM.chatInputEl.value.trim() !== '') {
                    UI.addChatMessage(DOM.chatInputEl.value.trim(), 'player', State.state.player.name || "Aventurier");
                    DOM.chatInputEl.value = '';
                }
                DOM.chatInputEl.blur();
            } else {
                DOM.chatInputEl.focus();
            }
            e.preventDefault();
            return;
        }

        if (document.activeElement === DOM.chatInputEl ||
            (DOM.quantityModal && !DOM.quantityModal.classList.contains('hidden')) ||
            (DOM.workshopSearchInputEl && document.activeElement === DOM.workshopSearchInputEl) || 
            (DOM.workshopRecipesContainerEl && DOM.workshopRecipesContainerEl.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') 
           ) {
            return;
        }

        if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'z') handleNavigation('north');
        else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') handleNavigation('south');
        else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'q') handleNavigation('west');
        else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') handleNavigation('east');
        else if (e.key.toLowerCase() === 'e') UI.showEquipmentModal(State.state);
        else if (e.key.toLowerCase() === 'm') handleGlobalPlayerAction('open_large_map', {});
        else if (e.key.toLowerCase() === 'c') UI.showBuildModal(State.state);
        else if (e.key.toLowerCase() === 't') { 
            const tile = State.state.map[State.state.player.y][State.state.player.x];
            const atelierBuilding = tile.buildings.find(b => b.key === 'ATELIER' && b.durability > 0);
            if (atelierBuilding) {
                if (DOM.workshopModal && DOM.workshopModal.classList.contains('hidden')) {
                     UI.showWorkshopModal(State.state);
                } else if (DOM.workshopModal) {
                    UI.hideWorkshopModal();
                }
            }
        }
        else if (e.key.toLowerCase() === 'i') {
            if (DOM.inventoryModal && DOM.inventoryModal.classList.contains('hidden')) {
                const tile = State.state.map[State.state.player.y][State.state.player.x];
                const buildingWithInv = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory || TILE_TYPES[b.key]?.maxInventory);
                const tileHasInv = tile.type.inventory || tile.type.maxInventory;
                if(buildingWithInv || tileHasInv) UI.showInventoryModal(State.state);
            } else if (DOM.inventoryModal) {
                UI.hideInventoryModal();
            }
        }
    });
    window.gameState = State.state;
    UI.setupQuantityModalListeners();
    UI.setupWorkshopModalListeners(State.state); // Assurez-vous de passer gameState
}

function endGame(isVictory) {
    if (!State.state || State.state.isGameOver) return;
    State.state.isGameOver = true;
    if(State.state.gameIntervals) State.state.gameIntervals.forEach(clearInterval);
    if(State.state.combatState) UI.hideCombatModal();
    const finalMessage = isVictory ? `Félicitations ! Vous avez survécu ${CONFIG.VICTORY_DAY} jours !` : "Vous n'avez pas survécu..."; // #43
    UI.addChatMessage(finalMessage, 'system');

    const endModal = document.createElement('div');
    endModal.id = 'end-game-modal';
    endModal.style.cssText = `position: fixed; inset: 0; background-color: rgba(0,0,0,0.8); z-index: 10000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-size: 2em; text-align: center; padding: 20px; backdrop-filter: blur(5px);`;
    const messageEl = document.createElement('p');
    messageEl.textContent = finalMessage;
    const reloadButton = document.createElement('button');
    reloadButton.textContent = "Recommencer";
    reloadButton.style.cssText = `padding: 15px 30px; font-size: 0.8em; margin-top: 30px; background-color: var(--action-color); color: var(--text-light); border: none; border-radius: 8px; cursor: pointer;`;
    reloadButton.onclick = () => window.location.reload();

    endModal.appendChild(messageEl);
    endModal.appendChild(reloadButton);
    document.body.appendChild(endModal);

    document.querySelectorAll('button').forEach(b => { if (b !== reloadButton) b.disabled = true; });
    if (DOM.chatInputEl) DOM.chatInputEl.disabled = true;
}

function fullResizeAndRedraw() {
    UI.resizeGameView();
    if (State.state && State.state.player) {
        UI.renderScene(State.state);
    }
}

async function init() {
    try {
        initDOM();
        console.log("DOM initialisé.");
        await UI.loadAssets(SPRITESHEET_PATHS);
        console.log("Assets chargés.");
        fullResizeAndRedraw();
        window.addEventListener('resize', fullResizeAndRedraw);

        State.initializeGameState(CONFIG);
        console.log("État du jeu initialisé.");
        UI.addChatMessage("Bienvenue aventurier, trouve vite d'autres aventuriers pour s'organiser ensemble!", "system_event", "Ancien");

        if (State.state && !State.state.config) {
            State.state.config = CONFIG;
            console.warn("State.state.config a été redéfini dans init de main.js, vérifier initializeGameState.");
        } else if (State.state && !State.state.config.VICTORY_DAY) { // #43 Ensure VICTORY_DAY is set in config
             State.state.config.VICTORY_DAY = CONFIG.VICTORY_DAY || 200;
        }


        setupEventListeners();
        console.log("Écouteurs d'événements configurés.");

        initAdminControls();

        UI.updateBottomBarEquipmentPanel(State.state.player);
        window.fullUIUpdate();
        requestAnimationFrame(gameLoop);

        if (State.state) {
            State.state.gameIntervals.push(setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS));
            State.state.gameIntervals.push(setInterval(() => {
                if (State.state.npcs && State.state.npcs.length > 0 && !State.state.combatState && (!State.state.player.isBusy && !State.state.player.animationState) ) {
                    npcChatter(State.state.npcs);
                }
            }, CONFIG.CHAT_MESSAGE_INTERVAL_MS));
        }
        console.log("Jeu initialisé et boucles démarrées.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        if (document.body) {
            document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}<br>Vérifiez la console pour plus de détails. Pile d'appel : <pre>${error.stack}</pre></div>`;
        }
    }
}

window.addEventListener('load', init);