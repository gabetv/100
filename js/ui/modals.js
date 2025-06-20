// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG, TILE_TYPES } from '../config.js';
import { getTotalResources } from '../player.js';
import * as State from '../state.js'; // Pour State.hasResources et State.applyResourceDeduction
import DOM from './dom.js';
import * as Draw from './draw.js';
import { handleCombatAction, handlePlayerAction } from '../interactions.js'; // handlePlayerAction pour construire

let quantityConfirmCallback = null;

function populateInventoryList(inventory, listElement, owner) {
    if (!listElement) return;
    listElement.innerHTML = '';
    if (Object.keys(inventory).length === 0) {
        const li = document.createElement('li');
        li.className = 'inventory-empty';
        li.textContent = '(Vide)';
        listElement.appendChild(li);
    } else {
        for (const itemName in inventory) {
            const count = inventory[itemName];
            if (count <= 0) continue;
            const li = document.createElement('li');
            li.className = 'inventory-item';
            li.setAttribute('draggable', 'true');
            li.dataset.itemName = itemName;
            li.dataset.itemCount = count;
            li.dataset.owner = owner;
            const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
            li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${itemName}</span><span class="inventory-count">${count}</span>`;
            listElement.appendChild(li);
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

function populateBuildModal(gameState) {
    if (!DOM.buildModalGridEl || !gameState || !gameState.player || !gameState.map || !gameState.knownRecipes) return;
    const { player, map, knownRecipes, config } = gameState;
    const tile = map[player.y][player.x];
    DOM.buildModalGridEl.innerHTML = '';

    const constructibleBuildings = Object.keys(TILE_TYPES).filter(key => {
        const bt = TILE_TYPES[key];
        if (!bt.isBuilding || !bt.cost) return false;
        
        // Vérifier si le bâtiment peut être construit sur le type de terrain actuel
        if (tile.type.name !== TILE_TYPES.PLAINS.name && key !== 'MINE' && key !== 'CAMPFIRE') {
            return false;
        }
        
        // Vérifier si une recette est nécessaire et connue (pour les bâtiments appris par parchemin)
        const buildingRecipeParchemin = Object.values(ITEM_TYPES).find(item => item.teachesRecipe === bt.name && item.isBuildingRecipe);
        if (buildingRecipeParchemin && !knownRecipes[bt.name]) {
            return false; // Recette requise mais non connue
        }
        return true;
    });

    if (constructibleBuildings.length === 0) {
        DOM.buildModalGridEl.innerHTML = '<p class="inventory-empty">Aucune construction disponible ici ou apprise.</p>';
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
        const toolReqArray = costs.toolRequired; // Séparer les outils
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
        if (toolReqArray && toolReqArray.length > 0) {
            toolReqArray.forEach(toolName => {
                const li = document.createElement('li');
                li.textContent = toolName;
                toolsList.appendChild(li);
            });
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
        let hasRequiredTool = true;
        if (toolReqArray) {
            hasRequiredTool = toolReqArray.some(toolName =>
                player.equipment.weapon && player.equipment.weapon.name === toolName
            );
        }
        const canBuild = hasEnoughResources && hasRequiredTool && tile.buildings.length < config.MAX_BUILDINGS_PER_TILE;
        
        buildButton.disabled = !canBuild || player.isBusy;
        if (!canBuild) {
            if (tile.buildings.length >= config.MAX_BUILDINGS_PER_TILE) buildButton.title = "Max bâtiments sur tuile";
            else if (!hasEnoughResources) buildButton.title = "Ressources manquantes";
            else if (!hasRequiredTool) buildButton.title = "Outil requis manquant";
        }


        buildButton.onclick = () => {
            // Utiliser la fonction globale qui gère les UI updates
            if (window.handleGlobalPlayerAction) {
                window.handleGlobalPlayerAction('build_structure', { structureKey: bKey });
            } else { // Fallback si la fonction globale n'est pas encore définie (devrait l'être)
                 handlePlayerAction('build_structure', { structureKey: bKey }, { updateAllUI: window.fullUIUpdate, updatePossibleActions: window.updatePossibleActions, updateAllButtonsState: () => window.UI.updateAllButtonsState(State.state) });
            }
            hideBuildModal(); // Fermer la modale après avoir cliqué
        };
        actionDiv.appendChild(buildButton);

        card.appendChild(header);
        card.appendChild(description);
        card.appendChild(costsDiv);
        card.appendChild(toolsDiv);
        card.appendChild(actionDiv);
        DOM.buildModalGridEl.appendChild(card);
    });}