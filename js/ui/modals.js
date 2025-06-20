// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG, TILE_TYPES } from '../config.js'; // Ajout de TILE_TYPES
import { getTotalResources } from '../player.js';
import DOM from './dom.js';
import * as Draw from './draw.js';
import { handleCombatAction } from '../interactions.js';

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

    if (!tile) {
        console.warn("showInventoryModal: Tuile invalide.");
        return;
    }

    // Chercher un bâtiment avec inventaire sur la tuile actuelle
    const buildingWithInventoryInstance = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory);
    let tileInventorySourceDef = null;
    let currentTileInventory = null;
    let currentTileMaxInventory = Infinity;


    if (buildingWithInventoryInstance) {
        tileInventorySourceDef = TILE_TYPES[buildingWithInventoryInstance.key];
        // S'assurer que tile.inventory est initialisé pour ce bâtiment si ce n'est pas déjà fait
        // Normalement, addBuildingToTile devrait le faire.
        // Mais pour être sûr, et si un bâtiment est généré avec la carte :
        if (!tile.inventory) { // Si la tuile elle-même n'a pas d'inventaire global
             // Et si le bâtiment est censé en avoir un
            if (tileInventorySourceDef && tileInventorySourceDef.inventory) {
                tile.inventory = JSON.parse(JSON.stringify(tileInventorySourceDef.inventory));
            }
        }
        currentTileInventory = tile.inventory; // On utilise l'inventaire de la tuile, qui est partagé pour les bâtiments dessus.
        currentTileMaxInventory = tileInventorySourceDef.maxInventory || Infinity;

    } else if (tile.type.inventory) { // Cas d'un trésor ou autre type de tuile avec inventaire direct
        tileInventorySourceDef = tile.type;
        if (!tile.inventory) { // Initialiser si nécessaire (ex: trésor non ouvert)
            tile.inventory = JSON.parse(JSON.stringify(tileInventorySourceDef.inventory));
        }
        currentTileInventory = tile.inventory;
        currentTileMaxInventory = tileInventorySourceDef.maxInventory || Infinity;
    }


    if (!currentTileInventory) {
        // UI.addChatMessage("Ce lieu n'a pas de stockage.", "system");
        console.warn("Tentative d'ouverture de l'inventaire sur une tuile sans stockage ou bâtiment avec stockage.");
        return;
    }


    const { modalPlayerInventoryEl, modalSharedInventoryEl, modalPlayerCapacityEl, inventoryModal } = DOM;
    populateInventoryList(player.inventory, modalPlayerInventoryEl, 'player-inventory');
    populateInventoryList(currentTileInventory, modalSharedInventoryEl, 'shared');

    if(modalPlayerCapacityEl) {
        const totalPlayerResources = getTotalResources(player.inventory);
        modalPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    }
    // Afficher la capacité du stockage partagé si disponible
    const modalSharedCapacityEl = document.getElementById('modal-shared-capacity'); // Supposons qu'un tel élément existe
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

    // Modifié pour gérer tous les slots définis dans l'HTML (head, weapon, shield, body, feet, bag)
    if (equipmentSlotsEl) {
        equipmentSlotsEl.querySelectorAll('.equipment-slot').forEach(slotEl => {
            const slotType = slotEl.dataset.slotType;
            if (!slotType) return; // Si un slot n'a pas de data-slot-type

            const equippedItem = player.equipment[slotType];
            slotEl.innerHTML = '';
            if (equippedItem) {
                const itemDiv = document.createElement('div'); // Utiliser un div pour l'item
                itemDiv.className = 'inventory-item'; // Style comme un item d'inventaire
                itemDiv.setAttribute('draggable', 'true');
                itemDiv.dataset.itemName = equippedItem.name;
                itemDiv.dataset.owner = 'equipment'; // Marqueur pour le drag & drop
                itemDiv.dataset.slotType = slotType; // Important pour le déséquipement

                const itemDef = ITEM_TYPES[equippedItem.name] || { icon: equippedItem.icon || '❓' };
                itemDiv.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${equippedItem.name}</span>`;
                if (equippedItem.hasOwnProperty('currentDurability') && equippedItem.hasOwnProperty('durability')) { // Vérifier les deux pour éviter erreur si durability est juste le max mais pas current
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
                        (player.equipment.shield?.stats?.defense || 0); // Ajout défense bouclier
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

    if (!window.gameState || !window.gameState.player) {
        console.error("gameState.player non accessible dans updateCombatUI");
        return;
    }
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
    if(quantitySlider) {
        quantitySlider.max = maxAmount;
        quantitySlider.value = 1;
    }
    if(quantityInput) {
        quantityInput.max = maxAmount;
        quantityInput.value = 1;
    }
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
    if (!DOM.largeMapModal) {
        console.error("[showLargeMap] DOM.largeMapModal non trouvé !");
        return;
    }
    DOM.largeMapModal.classList.remove('hidden');

    if (gameState && gameState.config) {
        Draw.drawLargeMap(gameState, gameState.config);
        Draw.populateLargeMapLegend();
    } else {
        console.error("[showLargeMap] gameState ou gameState.config manquant pour dessiner la carte.");
    }
}

export function hideLargeMap() {
    if (!DOM.largeMapModal) return;
    DOM.largeMapModal.classList.add('hidden');
}