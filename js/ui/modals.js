// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG } from '../config.js';
import { getTotalResources } from '../player.js';
// Note: addChatMessage est exporté par panels.js, qui est ensuite ré-exporté par ui.js.
// Si modals.js a besoin de addChatMessage directement, il faudrait l'importer
// depuis '../ui.js' (si ui.js l'exporte) ou directement depuis './panels.js' (si ui.js ne le ré-exporte pas)
// Pour l'instant, je suppose qu'il n'est pas directement utilisé ici ou qu'il est géré via des appels à UI depuis d'autres modules.
// Si vous l'utilisez ici, assurez-vous de l'import correct, par exemple:
// import { addChatMessage } from '../ui.js'; // ou import { addChatMessage } from './panels.js';
import DOM from './dom.js';
import * as Draw from './draw.js';

// NOUVEL IMPORT pour handleCombatAction
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
    
    if (!tile || !tile.inventory) {
        // UI.addChatMessage("Ce lieu n'a pas de stockage.", "system"); // Nécessiterait UI importé ou addChatMessage direct
        console.warn("Tentative d'ouverture de l'inventaire sur une tuile sans stockage ou tuile invalide.");
        return;
    }
    const { modalPlayerInventoryEl, modalSharedInventoryEl, modalPlayerCapacityEl, inventoryModal } = DOM;
    populateInventoryList(player.inventory, modalPlayerInventoryEl, 'player-inventory');
    populateInventoryList(tile.inventory, modalSharedInventoryEl, 'shared');
    
    if(modalPlayerCapacityEl) {
        const totalPlayerResources = getTotalResources(player.inventory);
        modalPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
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
            const equippedItem = player.equipment[slotType];
            slotEl.innerHTML = ''; // Vider le slot
            if (equippedItem) {
                const li = document.createElement('div'); 
                li.className = 'inventory-item'; 
                li.setAttribute('draggable', 'true');
                li.dataset.itemName = equippedItem.name;
                li.dataset.owner = 'equipment';
                li.dataset.slotType = slotType; 
                const itemDef = ITEM_TYPES[equippedItem.name] || { icon: equippedItem.icon || '❓' };
                li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${equippedItem.name}</span>`;
                if (equippedItem.hasOwnProperty('currentDurability') && equippedItem.hasOwnProperty('durability')) {
                     li.innerHTML += `<span class="item-durability" style="font-size: 0.7em; color: var(--text-secondary); display: block; text-align: center;">${equippedItem.currentDurability}/${equippedItem.durability}</span>`;
                }
                slotEl.appendChild(li);
            }
        });
    }

    if (playerStatAttackEl) {
        const attack = (player.equipment.weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE);
        playerStatAttackEl.textContent = attack;
    }
    if (playerStatDefenseEl) {
        const defense = (player.equipment.body?.stats?.defense || 0) + (player.equipment.head?.stats?.defense || 0) + (player.equipment.feet?.stats?.defense || 0) ; // Exemple si d'autres pièces donnent défense
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
    
    // Assurez-vous que State est importé si vous voulez l'utiliser comme ça:
    // import * as State from '../state.js'; puis State.state.player
    // Sinon, on continue avec window.gameState pour l'instant.
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
            // MODIFICATION ICI: utiliser la fonction importée directement
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