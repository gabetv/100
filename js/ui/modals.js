// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG, TILE_TYPES } from '../config.js';
import { getTotalResources } from '../player.js';
import * as State from '../state.js';
import DOM from './dom.js';
import * as Draw from './draw.js';
import { handleCombatAction, handlePlayerAction } from '../interactions.js'; // Assurez-vous que UI est importé si vous l'utilisez ici, ou passez les fonctions UI nécessaires

let quantityConfirmCallback = null;

function populateInventoryList(inventory, listElement, owner) {
    if (!listElement) return;
    listElement.innerHTML = '';
    let itemCountInList = 0;

    if (Object.keys(inventory).length === 0) {
        const li = document.createElement('li');
        li.className = 'inventory-empty';
        li.textContent = '(Vide)';
        listElement.appendChild(li);
    } else {
        for (const itemName in inventory) {
            const count = inventory[itemName];
            if (count <= 0) continue;

            if (owner === 'shared' && (listElement.id === 'modal-shared-inventory')) {
                const tile = State.state.map[State.state.player.y][State.state.player.x];
                const building = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory && (b.key === 'SHELTER_INDIVIDUAL' || b.key === 'SHELTER_COLLECTIVE'));
                if (building && itemCountInList >= 13) {
                    if (itemCountInList === 13) {
                        const liMore = document.createElement('li');
                        liMore.className = 'inventory-empty';
                        liMore.textContent = `(...et plus. Faites défiler pour voir tout.)`;
                        listElement.appendChild(liMore);
                    }
                    itemCountInList++;
                }
            }

            const li = document.createElement('li');
            li.className = 'inventory-item';
            li.setAttribute('draggable', 'true');
            li.dataset.itemName = itemName;
            li.dataset.itemCount = count;
            li.dataset.owner = owner;
            const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
            li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${itemName}</span><span class="inventory-count">${count}</span>`;
            listElement.appendChild(li);
            if (owner === 'shared' && listElement.id === 'modal-shared-inventory') itemCountInList++;
        }
    }
}

// --- MODALE D'INVENTAIRE PARTAGÉ ---
export function showInventoryModal(gameState) {
    if (!gameState || !gameState.player || !gameState.map) return;
    const { player, map } = gameState;
    const tile = map[player.y] && map[player.y][player.x] ? map[player.y][player.x] : null;
    if (!tile) { console.warn("showInventoryModal: Tuile invalide."); return; }

    const buildingWithInventoryInstance = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory);
    let tileInventorySourceDef = null;
    let currentTileInventory = null;
    let currentTileMaxInventory = Infinity;

    if (buildingWithInventoryInstance) {
        tileInventorySourceDef = TILE_TYPES[buildingWithInventoryInstance.key];
        if (!tile.inventory) {
            if (tileInventorySourceDef && tileInventorySourceDef.inventory) {
                tile.inventory = JSON.parse(JSON.stringify(tileInventorySourceDef.inventory));
            }
        }
        currentTileInventory = tile.inventory;
        currentTileMaxInventory = tileInventorySourceDef.maxInventory || Infinity;
    } else if (tile.type.inventory) {
        tileInventorySourceDef = tile.type;
        if (!tile.inventory) {
            tile.inventory = JSON.parse(JSON.stringify(tileInventorySourceDef.inventory));
        }
        currentTileInventory = tile.inventory;
        currentTileMaxInventory = tileInventorySourceDef.maxInventory || Infinity;
    }

    if (!currentTileInventory) { console.warn("Tentative d'ouverture de l'inventaire sur une tuile sans stockage."); return; }

    const { modalPlayerInventoryEl, modalSharedInventoryEl, modalPlayerCapacityEl, inventoryModal, modalSharedCapacityEl } = DOM;
    populateInventoryList(player.inventory, modalPlayerInventoryEl, 'player-inventory');
    populateInventoryList(currentTileInventory, modalSharedInventoryEl, 'shared');

    if(modalPlayerCapacityEl) {
        const totalPlayerResources = getTotalResources(player.inventory);
        modalPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    }
    if (modalSharedCapacityEl) {
        const totalSharedResources = getTotalResources(currentTileInventory);
        const maxSharedText = currentTileMaxInventory === Infinity ? "∞" : currentTileMaxInventory;
        modalSharedCapacityEl.textContent = `${totalSharedResources} / ${maxSharedText}`;
    }

    if(inventoryModal) inventoryModal.classList.remove('hidden');
}

export function hideInventoryModal() {
    if(DOM.inventoryModal) DOM.inventoryModal.classList.add('hidden');
}

// --- MODALE D'ÉQUIPEMENT ---
export function showEquipmentModal(gameState) {
    if (!DOM.equipmentModal) return;
    updateEquipmentModal(gameState);
    DOM.equipmentModal.classList.remove('hidden');
}
export function hideEquipmentModal() {
    if(DOM.equipmentModal) DOM.equipmentModal.classList.add('hidden');
}
export function updateEquipmentModal(gameState) {
    if (!gameState || !gameState.player) return;
    const { player } = gameState;
    const { equipmentPlayerInventoryEl, equipmentPlayerCapacityEl, playerStatAttackEl, playerStatDefenseEl, equipmentSlotsEl } = DOM;

    if (equipmentPlayerInventoryEl) populateInventoryList(player.inventory, equipmentPlayerInventoryEl, 'player-inventory');
    if (equipmentPlayerCapacityEl) {
        const totalPlayerResources = getTotalResources(player.inventory);
        equipmentPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    }
    if (equipmentSlotsEl) {
        equipmentSlotsEl.querySelectorAll('.equipment-slot').forEach(slotEl => {
            const slotType = slotEl.dataset.slotType;
            if (!slotType) return;
            const equippedItem = player.equipment[slotType];
            slotEl.innerHTML = '';
            if (equippedItem) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'inventory-item';
                itemDiv.setAttribute('draggable', 'true');
                itemDiv.dataset.itemName = equippedItem.name;
                itemDiv.dataset.owner = 'equipment';
                itemDiv.dataset.slotType = slotType;

                const itemDef = ITEM_TYPES[equippedItem.name] || { icon: equippedItem.icon || '❓' };
                itemDiv.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${equippedItem.name}</span>`;

                if (equippedItem.hasOwnProperty('currentDurability') && equippedItem.hasOwnProperty('durability')) {
                     itemDiv.innerHTML += `<span class="item-durability">${equippedItem.currentDurability}/${equippedItem.durability}</span>`;
                }
                slotEl.appendChild(itemDiv);
            }
        });
    }
    if (playerStatAttackEl) {
        const attack = (player.equipment.weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE);
        playerStatAttackEl.textContent = attack;
    }
    if (playerStatDefenseEl) {
        const defense = (player.equipment.body?.stats?.defense || 0) +
                        (player.equipment.head?.stats?.defense || 0) +
                        (player.equipment.feet?.stats?.defense || 0) +
                        (player.equipment.shield?.stats?.defense || 0);
        playerStatDefenseEl.textContent = defense;
    }
}

// --- MODALE DE COMBAT ---
export function showCombatModal(combatState) {
    if (!combatState || !DOM.combatModal) return;
    updateCombatUI(combatState);
    DOM.combatModal.classList.remove('hidden');
}
export function hideCombatModal() {
    if(DOM.combatModal) DOM.combatModal.classList.add('hidden');
}
export function updateCombatUI(combatState) {
    if (!combatState || !DOM.combatModal) return;
    const { combatEnemyName, combatEnemyHealthBar, combatEnemyHealthText, combatPlayerHealthBar, combatPlayerHealthText, combatLogEl, combatActionsEl } = DOM;
    if (!window.gameState || !window.gameState.player) { console.error("gameState.player non accessible dans updateCombatUI"); return; }
    const player = window.gameState.player;
    const { enemy, isPlayerTurn, log } = combatState;

    if(combatEnemyName) combatEnemyName.textContent = enemy.name;
    if(combatEnemyHealthBar) combatEnemyHealthBar.style.width = `${(enemy.currentHealth / enemy.health) * 100}%`;
    if(combatEnemyHealthText) combatEnemyHealthText.textContent = `${enemy.currentHealth} / ${enemy.health}`;
    if(combatPlayerHealthBar) combatPlayerHealthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
    if(combatPlayerHealthText) combatPlayerHealthText.textContent = `${player.health} / ${player.maxHealth}`;
    if(combatLogEl) combatLogEl.innerHTML = log.map(msg => `<p>${msg}</p>`).join('');
    if (combatActionsEl) {
        combatActionsEl.innerHTML = `<button id="combat-attack-btn" ${!isPlayerTurn ? 'disabled' : ''}>⚔️ Attaquer</button><button id="combat-flee-btn" ${!isPlayerTurn ? 'disabled' : ''}>🏃‍♂️ Fuir</button>`;
        if (isPlayerTurn) {
            const attackBtn = document.getElementById('combat-attack-btn');
            const fleeBtn = document.getElementById('combat-flee-btn');
            if (attackBtn) attackBtn.onclick = () => handleCombatAction('attack');
            if (fleeBtn) fleeBtn.onclick = () => handleCombatAction('flee');
        }
    }
}

// --- MODALE DE QUANTITÉ ---
export function showQuantityModal(itemName, maxAmount, callback) {
    if (!DOM.quantityModal) return;
    const { quantityModalTitle, quantitySlider, quantityInput, quantityModal } = DOM;
    if(quantityModalTitle) quantityModalTitle.textContent = `Transférer ${itemName}`;
    if(quantitySlider) { quantitySlider.max = maxAmount; quantitySlider.value = 1; }
    if(quantityInput) { quantityInput.max = maxAmount; quantityInput.value = 1; }
    quantityConfirmCallback = callback;
    quantityModal.classList.remove('hidden');
}
export function hideQuantityModal() {
    if(DOM.quantityModal) DOM.quantityModal.classList.add('hidden');
    quantityConfirmCallback = null;
}
export function setupQuantityModalListeners() {
    const { quantitySlider, quantityInput, quantityConfirmBtn, quantityCancelBtn, quantityMaxBtn, quantityShortcuts } = DOM;
    if(!quantitySlider || !quantityInput || !quantityConfirmBtn || !quantityCancelBtn || !quantityMaxBtn || !quantityShortcuts) return;
    quantitySlider.addEventListener('input', () => { if(quantityInput) quantityInput.value = quantitySlider.value; });
    quantityInput.addEventListener('input', () => {
        let val = parseInt(quantityInput.value, 10);
        const max = parseInt(quantityInput.max, 10);
        if (isNaN(val) || val < 1) val = 1;
        else if (val > max) val = max;
        quantityInput.value = val;
        if(quantitySlider) quantitySlider.value = quantityInput.value;
    });
    quantityConfirmBtn.addEventListener('click', () => { if (quantityConfirmCallback) quantityConfirmCallback(parseInt(quantityInput.value, 10)); hideQuantityModal(); });
    quantityCancelBtn.addEventListener('click', hideQuantityModal);
    quantityMaxBtn.addEventListener('click', () => { if(quantityInput) quantityInput.value = quantityInput.max; if(quantitySlider) quantitySlider.value = quantitySlider.max; });
    quantityShortcuts.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && e.target.dataset.amount) {
            const amount = Math.min(parseInt(e.target.dataset.amount, 10), parseInt(quantityInput.max, 10));
            if(quantityInput) quantityInput.value = amount;
            if(quantitySlider) quantitySlider.value = amount;
        }
    });
}

// --- GRANDE CARTE ---
export function showLargeMap(gameState) {
    if (!DOM.largeMapModal) { console.error("[showLargeMap] DOM.largeMapModal non trouvé !"); return; }
    DOM.largeMapModal.classList.remove('hidden');
    if (gameState && gameState.config) {
        Draw.drawLargeMap(gameState, gameState.config);
        Draw.populateLargeMapLegend();
    } else { console.error("[showLargeMap] gameState ou gameState.config manquant pour dessiner la carte."); }
}
export function hideLargeMap() {
    if (!DOM.largeMapModal) return;
    DOM.largeMapModal.classList.add('hidden');
}


// --- MODALE DE CONSTRUCTION ---
export function showBuildModal(gameState) {
    if (!DOM.buildModal || !DOM.buildModalGridEl) return;
    populateBuildModal(gameState);
    DOM.buildModal.classList.remove('hidden');
}

export function hideBuildModal() {
    if (DOM.buildModal) DOM.buildModal.classList.add('hidden');
}

export function populateBuildModal(gameState) { // Rendre exportable si besoin
    if (!DOM.buildModalGridEl || !gameState || !gameState.player || !gameState.map || !gameState.knownRecipes) return;
    const { player, map, knownRecipes, config } = gameState;
    const tile = map[player.y][player.x];
    DOM.buildModalGridEl.innerHTML = '';

    const constructibleBuildings = Object.keys(TILE_TYPES).filter(key => {
        const bt = TILE_TYPES[key];
        if (!bt.isBuilding || !bt.cost) return false;

        const buildingRecipeParchemin = Object.values(ITEM_TYPES).find(item => item.teachesRecipe === bt.name && item.isBuildingRecipe);
        if (buildingRecipeParchemin && !knownRecipes[bt.name]) {
            return false;
        }

        if (key === 'PETIT_PUIT' && bt.cost.toolRequired && bt.cost.toolRequired.length > 0) {
            const hasRequiredToolForWell = bt.cost.toolRequired.some(toolName =>
                player.equipment.weapon && player.equipment.weapon.name === toolName
            );
            if (!hasRequiredToolForWell) return false;
        }
        return true;
    });

    if (constructibleBuildings.length === 0) {
        DOM.buildModalGridEl.innerHTML = '<p class="inventory-empty">Aucune construction disponible ici ou apprise (ou outil requis manquant).</p>';
        return;
    }

    constructibleBuildings.sort().forEach(bKey => {
        const buildingType = TILE_TYPES[bKey];
        const card = document.createElement('div');
        card.className = 'build-item-card';

        const header = document.createElement('div');
        header.className = 'build-item-header';
        const icon = document.createElement('span');
        icon.className = 'build-item-icon';
        icon.textContent = buildingType.icon || ITEM_TYPES[buildingType.name]?.icon || '🏛️';
        const name = document.createElement('span');
        name.className = 'build-item-name';
        name.textContent = buildingType.name;
        header.appendChild(icon);
        header.appendChild(name);

        const description = document.createElement('p');
        description.className = 'build-item-description';
        description.textContent = buildingType.description || "Aucune description disponible.";

        const costsDiv = document.createElement('div');
        costsDiv.className = 'build-item-costs';
        costsDiv.innerHTML = '<h4>Coûts :</h4>';
        const costsList = document.createElement('ul');
        const costs = { ...buildingType.cost };
        const toolReqArray = costs.toolRequired;
        delete costs.toolRequired;

        if (Object.keys(costs).length > 0) {
            for (const item in costs) {
                const li = document.createElement('li');
                li.textContent = `${costs[item]} ${item}`;
                costsList.appendChild(li);
            }
        } else {
            const li = document.createElement('li');
            li.textContent = "Aucun coût en ressource";
            costsList.appendChild(li);
        }
        costsDiv.appendChild(costsList);

        const toolsDiv = document.createElement('div');
        toolsDiv.className = 'build-item-tools';
        toolsDiv.innerHTML = '<h4>Outils requis :</h4>';
        const toolsList = document.createElement('ul');
        let hasRequiredToolForThisBuilding = true;
        if (toolReqArray && toolReqArray.length > 0) {
            toolReqArray.forEach(toolName => {
                const li = document.createElement('li');
                li.textContent = toolName;
                toolsList.appendChild(li);
            });
            hasRequiredToolForThisBuilding = toolReqArray.some(toolName =>
                player.equipment.weapon && player.equipment.weapon.name === toolName
            );
        } else {
            const li = document.createElement('li');
            li.textContent = "Aucun outil spécifique";
            toolsList.appendChild(li);
        }
        toolsDiv.appendChild(toolsList);

        const actionDiv = document.createElement('div');
        actionDiv.className = 'build-item-action';
        const buildButton = document.createElement('button');
        buildButton.textContent = "Construire";

        const hasEnoughResources = State.hasResources(costs).success;
        const canBuildHere = tile.type.buildable || (bKey === 'MINE' || bKey === 'CAMPFIRE' || bKey === 'PETIT_PUIT');
        
        let isDisabledByStatus = false; // #41
        if (player.status === 'Drogué') {
            isDisabledByStatus = true;
        }
        const canBuild = hasEnoughResources && hasRequiredToolForThisBuilding && tile.buildings.length < config.MAX_BUILDINGS_PER_TILE && canBuildHere && !isDisabledByStatus;


        buildButton.disabled = !canBuild || player.isBusy;
        if (!canBuild) {
            if (tile.buildings.length >= config.MAX_BUILDINGS_PER_TILE) buildButton.title = "Max bâtiments sur tuile";
            else if (!canBuildHere) buildButton.title = "Ne peut pas être construit sur ce type de terrain.";
            else if (!hasEnoughResources) buildButton.title = "Ressources manquantes";
            else if (!hasRequiredToolForThisBuilding) buildButton.title = "Outil requis manquant";
            else if (isDisabledByStatus) buildButton.title = "Impossible de construire sous l'effet de la drogue."; // #41
        }

        buildButton.onclick = () => {
            if (window.handleGlobalPlayerAction) {
                window.handleGlobalPlayerAction('build_structure', { structureKey: bKey });
            } else {
                 handlePlayerAction('build_structure', { structureKey: bKey }, { updateAllUI: window.fullUIUpdate, updatePossibleActions: window.updatePossibleActions, updateAllButtonsState: () => window.UI.updateAllButtonsState(State.state) });
            }
            hideBuildModal();
        };
        actionDiv.appendChild(buildButton);

        card.appendChild(header);
        card.appendChild(description);
        card.appendChild(costsDiv);
        card.appendChild(toolsDiv);
        card.appendChild(actionDiv);
        DOM.buildModalGridEl.appendChild(card);
    });
}

// --- MODALE D'ATELIER ---
let currentWorkshopRecipes = [];
let selectedRecipeQuantities = {};

export function showWorkshopModal(gameState) {
    if (!DOM.workshopModal || !DOM.workshopRecipesContainerEl) return;
    populateWorkshopModal(gameState);
    DOM.workshopModal.classList.remove('hidden');
    selectedRecipeQuantities = {};
}

export function hideWorkshopModal() {
    if (DOM.workshopModal) DOM.workshopModal.classList.add('hidden');
}

function getRecipeCategory(itemName) {
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef) return 'other';
    if (itemDef.type === 'tool') return 'tool';
    if (itemDef.type === 'weapon') return 'weapon';
    if (itemDef.type === 'resource') return 'resource';
    return 'other';
}

export function populateWorkshopModal(gameState) { // Changé pour être exportable
    if (!DOM.workshopRecipesContainerEl || !gameState || !gameState.player || !gameState.knownRecipes) return;
    const { player, knownRecipes } = gameState;
    DOM.workshopRecipesContainerEl.innerHTML = '';
    currentWorkshopRecipes = [];

    let craftableRecipes = [];

    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.teachesRecipe && knownRecipes[itemDef.teachesRecipe]) {
            if (itemDef.isBuildingRecipe) continue;

            const costs = {};
            let yieldAmount = 1;
            const description = itemDef.description || "";
            const match = description.match(/Transformer\s+(.+?)\s*=\s*(?:(\d+)\s+)?(.+)/i);

            if (match) {
                const ingredientsString = match[1];
                const outputAmountString = match[2];
                if (outputAmountString) yieldAmount = parseInt(outputAmountString, 10) || 1;

                const ingredientParts = ingredientsString.split(/\s+(?:et|\+)\s+/i);
                ingredientParts.forEach(part => {
                    const partMatch = part.trim().match(/(\d+)\s+(.+)/);
                    if (partMatch) {
                        const amount = parseInt(partMatch[1], 10);
                        const name = partMatch[2].trim();
                        if (ITEM_TYPES[name]) {
                           costs[name] = amount;
                        } else {
                            console.warn(`Ingrédient inconnu "${name}" dans la recette de ${itemDef.teachesRecipe} via ${itemName}`);
                        }
                    }
                });
            } else {
                console.warn(`Impossible de parser les coûts pour la recette de ${itemDef.teachesRecipe} (via ${itemName}) à partir de la description: "${description}"`);
                continue;
            }

            if (Object.keys(costs).length > 0) {
                 craftableRecipes.push({
                    name: itemDef.teachesRecipe,
                    icon: ITEM_TYPES[itemDef.teachesRecipe]?.icon || '🛠️',
                    costs: costs,
                    yield: yieldAmount,
                    category: getRecipeCategory(itemDef.teachesRecipe),
                    sourceParchemin: itemName
                });
            }
        }
    }

    currentWorkshopRecipes = craftableRecipes.sort((a,b) => a.name.localeCompare(b.name));
    renderWorkshopRecipes(player);
}

function renderWorkshopRecipes(player) {
    if (!DOM.workshopRecipesContainerEl) return;
    DOM.workshopRecipesContainerEl.innerHTML = '';

    const searchTerm = DOM.workshopSearchInputEl ? DOM.workshopSearchInputEl.value.toLowerCase() : '';
    const categoryFilter = DOM.workshopCategoryFilterEl ? DOM.workshopCategoryFilterEl.value : 'all';

    const filteredRecipes = currentWorkshopRecipes.filter(recipe => {
        const nameMatch = recipe.name.toLowerCase().includes(searchTerm);
        const categoryMatch = categoryFilter === 'all' || recipe.category === categoryFilter;
        return nameMatch && categoryMatch;
    });

    if (filteredRecipes.length === 0) {
        DOM.workshopRecipesContainerEl.innerHTML = '<p class="inventory-empty">Aucune recette ne correspond à vos critères ou apprise pour l\'atelier.</p>';
        return;
    }

    filteredRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'workshop-recipe-card';
        card.dataset.recipeName = recipe.name;

        const header = document.createElement('div');
        header.className = 'workshop-recipe-header';
        const iconEl = document.createElement('span');
        iconEl.className = 'workshop-recipe-icon';
        iconEl.textContent = recipe.icon;
        const nameEl = document.createElement('span');
        nameEl.className = 'workshop-recipe-name';
        nameEl.textContent = recipe.name;
        header.appendChild(iconEl);
        header.appendChild(nameEl);

        const yieldEl = document.createElement('div');
        yieldEl.className = 'workshop-recipe-yield';
        yieldEl.innerHTML = `Produit: <strong>${recipe.yield}</strong>`;

        const costsDiv = document.createElement('div');
        costsDiv.className = 'workshop-recipe-costs';
        const costsTitle = document.createElement('h5');
        costsTitle.textContent = 'Coûts (par unité fabriquée):';
        const costsList = document.createElement('ul');

        for (const itemName in recipe.costs) {
            const requiredAmount = recipe.costs[itemName];
            const playerAmount = player.inventory[itemName] || 0;
            const itemIcon = ITEM_TYPES[itemName]?.icon || '';

            const li = document.createElement('li');
            const costNameSpan = document.createElement('span');
            costNameSpan.className = 'cost-name';
            costNameSpan.innerHTML = `<span class="item-icon">${itemIcon}</span>${itemName}`;
            
            const costAmountSpan = document.createElement('span');
            costAmountSpan.className = 'cost-amount';
            // Initial display for 1 unit craft
            costAmountSpan.textContent = `${playerAmount} / ${requiredAmount}`;
            if (playerAmount < requiredAmount) {
                costAmountSpan.classList.add('insufficient');
            }
            li.appendChild(costNameSpan);
            li.appendChild(costAmountSpan);
            costsList.appendChild(li);
        }
        costsDiv.appendChild(costsTitle);
        costsDiv.appendChild(costsList);

        const quantityInputWrapper = document.createElement('div');
        quantityInputWrapper.className = 'quantity-input-wrapper';
        const quantityLabel = document.createElement('label');
        quantityLabel.textContent = 'Quantité à fabriquer:';
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '1';
        quantityInput.value = '1';
        quantityInput.dataset.recipeName = recipe.name;
        quantityInput.oninput = (e) => handleWorkshopQuantityChange(e, player, recipe);
        
        quantityInputWrapper.appendChild(quantityLabel);
        quantityInputWrapper.appendChild(quantityInput);

        const actionDiv = document.createElement('div');
        actionDiv.className = 'workshop-recipe-action';
        const transformButton = document.createElement('button');
        transformButton.textContent = "Transformer";
        
        transformButton.onclick = () => {
            const currentQuantityToCraft = parseInt(quantityInput.value, 10);
            if (isNaN(currentQuantityToCraft) || currentQuantityToCraft <= 0) {
                if (window.UI && window.UI.addChatMessage) window.UI.addChatMessage("Quantité invalide.", "system_error");
                else console.error("UI.addChatMessage non disponible");
                return;
            }

            let hasEnoughForQuantity = true;
            for (const itemName in recipe.costs) {
                if ((player.inventory[itemName] || 0) < recipe.costs[itemName] * currentQuantityToCraft) {
                    hasEnoughForQuantity = false;
                    break;
                }
            }

            if (!hasEnoughForQuantity) {
                 if (window.UI && window.UI.addChatMessage) {
                    window.UI.addChatMessage("Ressources insuffisantes pour la quantité demandée.", "system_error");
                    if (DOM.inventoryCategoriesEl) window.UI.triggerShake(DOM.inventoryCategoriesEl);
                 } else console.error("UI.addChatMessage non disponible");
                 return;
            }
            
            if (window.handleGlobalPlayerAction) {
                window.handleGlobalPlayerAction('craft_item_workshop', {
                    recipeName: recipe.name,
                    costs: recipe.costs,
                    yields: { [recipe.name]: recipe.yield },
                    quantity: currentQuantityToCraft,
                    sourceParchemin: recipe.sourceParchemin // Pourrait être utile pour logique future
                });
            }
            // Re-peupler pour mettre à jour l'état après le craft
            populateWorkshopModal(State.state); // Doit être ModalsModule.populateWorkshopModal
            if (window.UI && window.UI.updateInventory) window.UI.updateInventory(player);
            if (window.UI && window.UI.updateAllButtonsState) window.UI.updateAllButtonsState(State.state);
        };
        actionDiv.appendChild(transformButton);

        card.appendChild(header);
        card.appendChild(yieldEl);
        card.appendChild(costsDiv);
        card.appendChild(quantityInputWrapper);
        card.appendChild(actionDiv);
        DOM.workshopRecipesContainerEl.appendChild(card);
        
        // Appeler handleWorkshopQuantityChange pour définir l'état initial du bouton
        handleWorkshopQuantityChange({ target: quantityInput }, player, recipe);
    });
}

function handleWorkshopQuantityChange(event, player, recipe) {
    const inputElement = event.target;
    const quantityToCraft = parseInt(inputElement.value, 10);
    const recipeCard = inputElement.closest('.workshop-recipe-card');
    const transformButton = recipeCard.querySelector('.workshop-recipe-action button');

    if (isNaN(quantityToCraft) || quantityToCraft <= 0) {
        if (transformButton) transformButton.disabled = true;
        // Mettre à jour l'affichage des coûts pour refléter "pas assez" si qté = 0 ou invalide
        recipeCard.querySelectorAll('.workshop-recipe-costs li .cost-amount').forEach(costAmountEl => {
            const costItemName = costAmountEl.previousElementSibling.textContent.replace(ITEM_TYPES[costItemName]?.icon || '', '').trim();
            const requiredForOne = recipe.costs[costItemName];
            const playerHas = player.inventory[costItemName] || 0;
            costAmountEl.textContent = `${playerHas} / ${requiredForOne}`; // Affiche pour 1 si qté invalide
            costAmountEl.classList.add('insufficient');
        });
        return;
    }

    let canCraftThisQuantity = true;
    recipeCard.querySelectorAll('.workshop-recipe-costs li .cost-amount').forEach(costAmountEl => {
        // Pour extraire le nom de l'item du span qui contient aussi l'icône
        let costItemName = '';
        const costNameSpan = costAmountEl.previousElementSibling;
        if (costNameSpan) {
            // Le nom de l'item est le dernier nœud texte du span .cost-name
            for (let i = costNameSpan.childNodes.length - 1; i >= 0; i--) {
                if (costNameSpan.childNodes[i].nodeType === Node.TEXT_NODE) {
                    costItemName = costNameSpan.childNodes[i].textContent.trim();
                    break;
                }
            }
        }
        
        if (!recipe.costs[costItemName]) { // Sécurité si le nom n'est pas trouvé
            console.warn("Nom d'item de coût non trouvé pour :", costAmountEl.previousElementSibling.innerHTML);
            return;
        }

        const requiredForOne = recipe.costs[costItemName];
        const playerHas = player.inventory[costItemName] || 0;
        
        costAmountEl.textContent = `${playerHas} / ${requiredForOne * quantityToCraft}`;
        if (playerHas < requiredForOne * quantityToCraft) {
            costAmountEl.classList.add('insufficient');
            canCraftThisQuantity = false;
        } else {
            costAmountEl.classList.remove('insufficient');
        }
    });

    if (transformButton) transformButton.disabled = !canCraftThisQuantity || player.isBusy;
}


export function setupWorkshopModalListeners(gameState) {
    if (DOM.closeWorkshopModalBtn) {
        DOM.closeWorkshopModalBtn.addEventListener('click', hideWorkshopModal);
    }
    if (DOM.workshopSearchInputEl) {
        // Utiliser gameState.player au lieu de player directement car player peut changer
        DOM.workshopSearchInputEl.addEventListener('input', () => renderWorkshopRecipes(gameState.player));
    }
    if (DOM.workshopCategoryFilterEl) {
        DOM.workshopCategoryFilterEl.addEventListener('change', () => renderWorkshopRecipes(gameState.player));
    }
}