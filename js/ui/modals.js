// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG, TILE_TYPES } from '../config.js';
import * as State from '../state.js';
import DOM from './dom.js';
import * as Draw from './draw.js';
import { handleCombatAction, handlePlayerAction } from '../interactions.js';

let quantityConfirmCallback = null;

function populateInventoryList(inventory, listElement, owner, searchTerm = '') {
    if (!listElement) return;
    listElement.innerHTML = '';

    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();
    
    // Regrouper les objets uniques par nom pour l'affichage
    const groupedItems = {};
    for (const key in inventory) {
        const item = inventory[key];
        const isInstance = typeof item === 'object' && item.name;
        const itemName = isInstance ? item.name : key;

        if (lowerCaseSearchTerm && !itemName.toLowerCase().includes(lowerCaseSearchTerm)) {
            continue;
        }

        if (!groupedItems[itemName]) {
            groupedItems[itemName] = [];
        }
        groupedItems[itemName].push({ key, value: item });
    }

    if (Object.keys(groupedItems).length === 0) {
        const li = document.createElement('li');
        li.className = 'inventory-empty';
        li.textContent = searchTerm.trim() !== '' ? '(Aucun résultat)' : '(Vide)';
        listElement.appendChild(li);
        return;
    }
    
    Object.keys(groupedItems).sort().forEach(itemName => {
        const items = groupedItems[itemName];
        const firstItem = items[0].value;

        if (typeof firstItem === 'number') { // Objet empilable
            const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
            const li = document.createElement('li');
            li.className = 'inventory-item';
            li.setAttribute('draggable', 'true');
            li.dataset.itemName = itemName;
            li.dataset.itemKey = itemName; // Pour les empilables, la clé EST le nom
            li.dataset.itemCount = firstItem;
            li.dataset.owner = owner;
            li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${itemName}</span><span class="inventory-count">${firstItem}</span>`;
            listElement.appendChild(li);
        } else { // Objets uniques
            items.forEach(itemData => {
                const { key, value: instanceData } = itemData;
                const itemDef = ITEM_TYPES[instanceData.name] || { icon: '❓' };
                const li = document.createElement('li');
                li.className = 'inventory-item';
                li.setAttribute('draggable', 'true');
                li.dataset.itemName = instanceData.name;
                li.dataset.itemKey = key; // Utilise la clé unique de l'instance
                li.dataset.itemCount = 1;
                li.dataset.owner = owner;

                let displayName = instanceData.name;
                if (instanceData.hasOwnProperty('currentDurability')) {
                    displayName += ` (${instanceData.currentDurability}/${instanceData.durability})`;
                }

                li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${displayName}</span><span class="inventory-count">1</span>`;
                listElement.appendChild(li);
            });
        }
    });
}


export function showInventoryModal(gameState) {
    if (!gameState || !gameState.player || !gameState.map) return;
    const { player, map } = gameState;
    const tile = map[player.y] && map[player.y][player.x] ? map[player.y][player.x] : null;
    if (!tile) { console.warn("showInventoryModal: Tuile invalide."); return; }    

    let buildingWithInventory = null;
    if (tile.buildings && tile.buildings.length > 0) {
        buildingWithInventory = tile.buildings.find(b => 
            (TILE_TYPES[b.key]?.inventory || TILE_TYPES[b.key]?.maxInventory) &&
            (b.key === 'SHELTER_INDIVIDUAL' || b.key === 'SHELTER_COLLECTIVE' || TILE_TYPES[b.key]?.name.toLowerCase().includes("coffre"))
        );
    }

    let currentTileInventory = null;
    let currentTileMaxInventory = Infinity;
    let buildingDef = null;

    if (buildingWithInventory) {
        buildingDef = TILE_TYPES[buildingWithInventory.key];
        if (!buildingWithInventory.inventory) buildingWithInventory.inventory = {}; 
        currentTileInventory = buildingWithInventory.inventory;
        currentTileMaxInventory = buildingDef.maxInventory || Infinity;
    } else if (tile.type.inventory && !buildingWithInventory) { 
        buildingDef = tile.type; 
        if (!tile.inventory) tile.inventory = JSON.parse(JSON.stringify(buildingDef.inventory || {}));
        currentTileInventory = tile.inventory;
        currentTileMaxInventory = buildingDef.maxInventory || Infinity;
    }
    
    if (!currentTileInventory) { console.warn("Tentative d'ouverture de l'inventaire sur une tuile sans stockage."); return; }

    const { modalPlayerInventoryEl, modalSharedInventoryEl, modalPlayerCapacityEl, inventoryModal, modalSharedCapacityEl } = DOM;
    
    populateInventoryList(player.inventory, modalPlayerInventoryEl, 'player-inventory');
    populateInventoryList(currentTileInventory, modalSharedInventoryEl, 'shared');

    if(modalPlayerCapacityEl) {
        modalPlayerCapacityEl.textContent = `${State.countItemsInInventory(player.inventory)} / ${player.maxInventory}`;
    }
    if (modalSharedCapacityEl) {
        const maxSharedText = currentTileMaxInventory === Infinity ? "∞" : currentTileMaxInventory;
        modalSharedCapacityEl.textContent = `${State.countItemsInInventory(currentTileInventory)} / ${maxSharedText}`;
    }

    const sharedInventorySearchInput = document.getElementById('shared-inventory-search');
    if (sharedInventorySearchInput) {
        sharedInventorySearchInput.value = '';
        sharedInventorySearchInput.oninput = function() {
            populateInventoryList(currentTileInventory, modalSharedInventoryEl, 'shared', this.value);
        };
    }
    
    if(inventoryModal) inventoryModal.classList.remove('hidden');
}

export function hideInventoryModal() {
    if(DOM.inventoryModal) DOM.inventoryModal.classList.add('hidden');
    const sharedInventorySearchInput = document.getElementById('shared-inventory-search');
    if (sharedInventorySearchInput) {
        sharedInventorySearchInput.value = '';
    }
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
        equipmentPlayerCapacityEl.textContent = `${State.countItemsInInventory(player.inventory)} / ${player.maxInventory}`;
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
                itemDiv.dataset.itemKey = `${equippedItem.name}_equipped`;
                itemDiv.dataset.owner = 'equipment';
                itemDiv.dataset.slotType = slotType;

                const itemDef = ITEM_TYPES[equippedItem.name] || { icon: '❓' };
                let displayName = equippedItem.name;
                 if (equippedItem.hasOwnProperty('currentDurability') && equippedItem.hasOwnProperty('durability')) {
                     displayName += ` (${equippedItem.currentDurability}/${equippedItem.durability})`;
                }
                itemDiv.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${displayName}</span>`;
                
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
    const playerCurrentHealth = player.health;
    const playerMaxHealth = player.maxHealth;
    const { enemy, isPlayerTurn, log } = combatState;

    if(combatEnemyName) combatEnemyName.textContent = enemy.name;
    if(combatEnemyHealthBar) combatEnemyHealthBar.style.width = `${(enemy.currentHealth / enemy.health) * 100}%`;
    if(combatEnemyHealthText) combatEnemyHealthText.textContent = `${enemy.currentHealth} / ${enemy.health}`;
    if(combatPlayerHealthBar) combatPlayerHealthBar.style.width = `${(playerCurrentHealth / playerMaxHealth) * 100}%`;
    if(combatPlayerHealthText) combatPlayerHealthText.textContent = `${playerCurrentHealth} / ${playerMaxHealth}`;
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
    if(quantityModalTitle) quantityModalTitle.textContent = `Choisir la quantité pour ${itemName}`;
    
    const adjustedMax = Math.max(1, maxAmount);
    if(quantitySlider) { quantitySlider.max = adjustedMax; quantitySlider.value = 1; }
    if(quantityInput) { quantityInput.max = adjustedMax; quantityInput.value = 1; }
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
    quantityConfirmBtn.addEventListener('click', () => { 
        if (quantityConfirmCallback) {
            const valueToConfirm = parseInt(quantityInput.value, 10);
            quantityConfirmCallback(valueToConfirm);
        }
        hideQuantityModal(); 
    });
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

export function populateBuildModal(gameState) { 
    if (!DOM.buildModalGridEl || !gameState || !gameState.player || !gameState.map || !gameState.knownRecipes) return;
    const { player, map, knownRecipes, config } = gameState;
    const tile = map[player.y][player.x];
    DOM.buildModalGridEl.innerHTML = '';
    
    const filterContainer = document.createElement('div');
    filterContainer.className = 'build-filter';
    const filterCheckbox = document.createElement('input');
    filterCheckbox.type = 'checkbox';
    filterCheckbox.id = 'hide-non-buildable';
    filterCheckbox.checked = false;
    filterCheckbox.onchange = () => populateBuildModal(gameState);
    const filterLabel = document.createElement('label');
    filterLabel.htmlFor = 'hide-non-buildable';
    filterLabel.textContent = 'Masquer les constructions impossibles';
    filterContainer.appendChild(filterCheckbox);
    filterContainer.appendChild(filterLabel);
    DOM.buildModalGridEl.appendChild(filterContainer);

    const hideNonBuildable = document.getElementById('hide-non-buildable') ? document.getElementById('hide-non-buildable').checked : false;

    const constructibleBuildings = Object.keys(TILE_TYPES).filter(key => {
        const bt = TILE_TYPES[key];
        return bt.isBuilding && bt.cost;
    });

    if (constructibleBuildings.length === 0) {
        DOM.buildModalGridEl.innerHTML = '<p class="inventory-empty">Aucune construction disponible.</p>';
        return;
    }

    constructibleBuildings.sort().forEach(bKey => {
        const buildingType = TILE_TYPES[bKey];
        const costs = { ...buildingType.cost };
        const toolReqArray = costs.toolRequired;
        delete costs.toolRequired;

        const hasEnoughResources = State.hasResources(player.inventory, costs).success;
        const canBuildHere = tile.type.buildable || (['MINE', 'CAMPFIRE', 'PETIT_PUIT'].includes(bKey));
        let hasRequiredTool = !toolReqArray || toolReqArray.some(toolName => player.equipment.weapon?.name === toolName);
        let isDisabledByStatus = player.status.includes('Drogué');
        const canBuild = hasEnoughResources && hasRequiredTool && tile.buildings.length < config.MAX_BUILDINGS_PER_TILE && canBuildHere && !isDisabledByStatus;

        if (hideNonBuildable && !canBuild) return;

        const card = document.createElement('div');
        card.className = 'build-item-card';

        const header = document.createElement('div');
        header.className = 'build-item-header';
        header.innerHTML = `<span class="build-item-icon">${buildingType.icon || '🏛️'}</span><span class="build-item-name">${buildingType.name}</span>`;

        const description = document.createElement('p');
        description.className = 'build-item-description';
        description.textContent = buildingType.description || "Aucune description.";

        const costsDiv = document.createElement('div');
        costsDiv.className = 'build-item-costs';
        costsDiv.innerHTML = '<h4>Coûts :</h4>';
        const costsList = document.createElement('ul');
        for (const item in costs) {
            const li = document.createElement('li');
            const playerAmount = State.countItemsInInventory({[item]: player.inventory[item]});
            li.textContent = `${costs[item]} ${item}`;
            if (playerAmount < costs[item]) li.style.color = '#ff6b6b';
            costsList.appendChild(li);
        }
        costsDiv.appendChild(costsList);

        const toolsDiv = document.createElement('div');
        toolsDiv.className = 'build-item-tools';
        toolsDiv.innerHTML = '<h4>Outils requis :</h4>';
        const toolsList = document.createElement('ul');
        if (toolReqArray?.length > 0) {
            toolReqArray.forEach(toolName => toolsList.innerHTML += `<li>${toolName}</li>`);
        } else {
            toolsList.innerHTML = '<li>Aucun</li>';
        }
        toolsDiv.appendChild(toolsList);

        const actionDiv = document.createElement('div');
        actionDiv.className = 'build-item-action';
        const buildButton = document.createElement('button');
        buildButton.textContent = "Construire";
        buildButton.disabled = !canBuild || player.isBusy;
        let title = "";
        if (!canBuild) {
            if (tile.buildings.length >= config.MAX_BUILDINGS_PER_TILE) title = "Max bâtiments sur tuile";
            else if (!canBuildHere) title = "Ne peut être construit ici.";
            else if (!hasEnoughResources) title = "Ressources manquantes";
            else if (!hasRequiredTool) title = "Outil requis manquant";
            else if (isDisabledByStatus) title = "Impossible sous l'effet de la drogue."; 
        }
        buildButton.title = title;
        buildButton.onclick = () => {
            if (window.handleGlobalPlayerAction) {
                window.handleGlobalPlayerAction('build_structure', { structureKey: bKey });
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

export function showWorkshopModal(gameState) {
    if (!DOM.workshopModal || !DOM.workshopRecipesContainerEl) return;
    populateWorkshopModal(gameState);
    DOM.workshopModal.classList.remove('hidden');
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

export function populateWorkshopModal(gameState) { 
    if (!DOM.workshopRecipesContainerEl || !gameState || !gameState.player || !gameState.knownRecipes) return;
    
    currentWorkshopRecipes = [];
    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.teachesRecipe && gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.isBuildingRecipe) {
            const costs = {};
            let yieldAmount = 1;
            const description = itemDef.description || "";
            const match = description.match(/Transformer\s+(.+?)\s*=\s*(?:(\d+)\s+)?(.+)/i);

            if (match) {
                const ingredientsString = match[1];
                if (match[2]) yieldAmount = parseInt(match[2], 10) || 1;
                
                ingredientsString.split(/\s+(?:et|\+)\s+/i).forEach(part => {
                    const partMatch = part.trim().match(/(\d+)\s+(.+)/);
                    if (partMatch) {
                        costs[partMatch[2].trim()] = parseInt(partMatch[1], 10);
                    }
                });
            } else {
                continue;
            }

            if (Object.keys(costs).length > 0) {
                 currentWorkshopRecipes.push({
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

    currentWorkshopRecipes.sort((a,b) => a.name.localeCompare(b.name));
    renderWorkshopRecipes(gameState.player);
}

function renderWorkshopRecipes(player) {
    if (!DOM.workshopRecipesContainerEl) return;
    DOM.workshopRecipesContainerEl.innerHTML = '';

    const searchTerm = DOM.workshopSearchInputEl ? DOM.workshopSearchInputEl.value.toLowerCase() : '';
    const categoryFilter = DOM.workshopCategoryFilterEl ? DOM.workshopCategoryFilterEl.value : 'all';

    const filteredRecipes = currentWorkshopRecipes.filter(recipe => 
        recipe.name.toLowerCase().includes(searchTerm) && (categoryFilter === 'all' || recipe.category === categoryFilter)
    );

    if (filteredRecipes.length === 0) {
        DOM.workshopRecipesContainerEl.innerHTML = '<p class="inventory-empty">Aucune recette ne correspond à vos critères.</p>';
        return;
    }

    filteredRecipes.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'workshop-recipe-card';
        card.dataset.recipeName = recipe.name;

        const header = document.createElement('div');
        header.className = 'workshop-recipe-header';
        header.innerHTML = `<span class="workshop-recipe-icon">${recipe.icon}</span><span class="workshop-recipe-name">${recipe.name}</span>`;
        
        const yieldEl = document.createElement('div');
        yieldEl.className = 'workshop-recipe-yield';
        yieldEl.innerHTML = `Produit: <strong>${recipe.yield}</strong>`;

        const costsDiv = document.createElement('div');
        costsDiv.className = 'workshop-recipe-costs';
        costsDiv.innerHTML = '<h5>Coûts (par unité):</h5>';
        const costsList = document.createElement('ul');
        for (const itemName in recipe.costs) {
            const requiredAmount = recipe.costs[itemName];
            const playerAmount = State.countItemsInInventory(player.inventory, itemName);
            const itemIcon = ITEM_TYPES[itemName]?.icon || '';
            costsList.innerHTML += `<li data-item-name="${itemName}">
                <span class="cost-name"><span class="item-icon">${itemIcon}</span>${itemName}</span>
                <span class="cost-amount">${playerAmount} / ${requiredAmount}</span>
            </li>`;
        }
        costsDiv.appendChild(costsList);

        const quantityInputWrapper = document.createElement('div');
        quantityInputWrapper.className = 'quantity-input-wrapper';
        quantityInputWrapper.innerHTML = `<label>Quantité:</label><input type="number" min="1" value="1" data-recipe-name="${recipe.name}">`;
        quantityInputWrapper.querySelector('input').oninput = (e) => handleWorkshopQuantityChange(e, player, recipe);
        
        const actionDiv = document.createElement('div');
        actionDiv.className = 'workshop-recipe-action';
        const transformButton = document.createElement('button');
        transformButton.textContent = "Transformer";
        transformButton.onclick = () => {
            const quantityInput = card.querySelector('.quantity-input-wrapper input');
            const currentQuantityToCraft = parseInt(quantityInput.value, 10);
            if (isNaN(currentQuantityToCraft) || currentQuantityToCraft <= 0) return;
            
            const totalCosts = {};
            for (const itemName in recipe.costs) {
                totalCosts[itemName] = recipe.costs[itemName] * currentQuantityToCraft;
            }

            if (!State.hasResources(player.inventory, totalCosts).success) {
                if (window.UI?.addChatMessage) window.UI.addChatMessage("Ressources insuffisantes.", "system_error");
                return;
            }
            
            if (window.handleGlobalPlayerAction) {
                window.handleGlobalPlayerAction('craft_item_workshop', {
                    recipeName: recipe.name,
                    costs: recipe.costs,
                    yields: { [recipe.name]: recipe.yield },
                    quantity: currentQuantityToCraft,
                    sourceParchemin: recipe.sourceParchemin 
                });
            }
            populateWorkshopModal(State.state); 
            if (window.UI?.updateInventory) window.UI.updateInventory(player);
            if (window.UI?.updateAllButtonsState) window.UI.updateAllButtonsState(State.state);
        };
        actionDiv.appendChild(transformButton);

        card.appendChild(header); card.appendChild(yieldEl); card.appendChild(costsDiv);
        card.appendChild(quantityInputWrapper); card.appendChild(actionDiv);
        DOM.workshopRecipesContainerEl.appendChild(card);
        
        handleWorkshopQuantityChange({ target: card.querySelector('input[type="number"]') }, player, recipe);
    });
}

function handleWorkshopQuantityChange(event, player, recipe) {
    const inputElement = event.target;
    const quantityToCraft = parseInt(inputElement.value, 10);
    const recipeCard = inputElement.closest('.workshop-recipe-card');
    const transformButton = recipeCard.querySelector('.workshop-recipe-action button');

    if (isNaN(quantityToCraft) || quantityToCraft <= 0) {
        if (transformButton) transformButton.disabled = true;
        return;
    }

    let canCraftThisQuantity = true;
    recipeCard.querySelectorAll('.workshop-recipe-costs li').forEach(li => {
        const itemName = li.dataset.itemName;
        const costAmountEl = li.querySelector('.cost-amount');
        const requiredForOne = recipe.costs[itemName];
        const totalRequired = requiredForOne * quantityToCraft;
        const playerHas = State.countItemsInInventory(player.inventory, itemName);
        
        costAmountEl.textContent = `${playerHas} / ${totalRequired}`;
        if (playerHas < totalRequired) {
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
        DOM.workshopSearchInputEl.addEventListener('input', () => renderWorkshopRecipes(gameState.player));
    }
    if (DOM.workshopCategoryFilterEl) {
        DOM.workshopCategoryFilterEl.addEventListener('change', () => renderWorkshopRecipes(gameState.player));
    }
}

// --- MODALE DE CODE DE CADENAS ---
let lockConfirmCallback = null;
let isSettingNewCode = false;

export function showLockModal(callback, isSetting) {
    if (!DOM.lockModal) return;
    isSettingNewCode = isSetting;
    lockConfirmCallback = callback;

    DOM.lockModalTitle.textContent = isSetting ? "Définir le code du cadenas" : "Entrer le code du cadenas";
    DOM.lockUnlockButton.textContent = isSetting ? "Définir" : "Déverrouiller";
    DOM.lockCodeInput1.value = ''; DOM.lockCodeInput2.value = ''; DOM.lockCodeInput3.value = '';
    DOM.lockModal.classList.remove('hidden');
    DOM.lockCodeInput1.focus();
}

export function hideLockModal() {
    if (DOM.lockModal) DOM.lockModal.classList.add('hidden');
    lockConfirmCallback = null;
}

export function setupLockModalListeners() {
    const { lockModal, lockCodeInput1, lockCodeInput2, lockCodeInput3, lockUnlockButton, lockCancelButton } = DOM;
    if (!lockModal || !lockUnlockButton || !lockCancelButton) return;

    const inputs = [lockCodeInput1, lockCodeInput2, lockCodeInput3];
    inputs.forEach((input, idx) => {
        input.addEventListener('input', () => {
            if (input.value.length >= 1 && idx < inputs.length - 1) {
                inputs[idx+1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && input.value.length === 0 && idx > 0) {
                inputs[idx-1].focus();
            }
        });
    });

    lockUnlockButton.addEventListener('click', () => {
        const code = `${lockCodeInput1.value}${lockCodeInput2.value}${lockCodeInput3.value}`;
        if (code.length === 3 && /^\d{3}$/.test(code)) {
            if (lockConfirmCallback) lockConfirmCallback(code);
        } else {
            if (window.UI) window.UI.addChatMessage("Le code doit être composé de 3 chiffres.", "system_error");
        }
    });
    lockCancelButton.addEventListener('click', hideLockModal);
}