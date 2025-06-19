// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG } from '../config.js';
import { getTotalResources } from '../player.js';
import { addChatMessage } from './panels.js';

let quantityConfirmCallback = null;

function populateInventoryList(inventory, listElement, owner) {
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
    const { player, map } = gameState;
    const tile = map[player.y][player.x];
    if (!tile.inventory) {
        addChatMessage("Ce lieu n'a pas de stockage.", "system");
        return;
    }
    const { modalPlayerInventoryEl, modalSharedInventoryEl, modalPlayerCapacityEl, inventoryModal } = window.DOM;
    populateInventoryList(player.inventory, modalPlayerInventoryEl, 'player-inventory');
    populateInventoryList(tile.inventory, modalSharedInventoryEl, 'shared');
    const totalPlayerResources = getTotalResources(player.inventory);
    modalPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    inventoryModal.classList.remove('hidden');
}

export function hideInventoryModal() {
    window.DOM.inventoryModal.classList.add('hidden');
}

// --- MODALE D'ÉQUIPEMENT ---
export function showEquipmentModal(gameState) {
    updateEquipmentModal(gameState);
    window.DOM.equipmentModal.classList.remove('hidden');
}

export function hideEquipmentModal() {
    window.DOM.equipmentModal.classList.add('hidden');
}

export function updateEquipmentModal(gameState) {
    const { player } = gameState;
    const { equipmentPlayerInventoryEl, equipmentPlayerCapacityEl, playerStatAttackEl, playerStatDefenseEl } = window.DOM;

    populateInventoryList(player.inventory, equipmentPlayerInventoryEl, 'player-inventory');
    const totalPlayerResources = getTotalResources(player.inventory);
    equipmentPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    
    document.querySelectorAll('#equipment-slots .equipment-slot').forEach(slotEl => {
        const slotType = slotEl.dataset.slotType;
        const equippedItem = player.equipment[slotType];
        slotEl.innerHTML = '';
        if (equippedItem) {
            const li = document.createElement('div');
            li.className = 'inventory-item';
            li.setAttribute('draggable', 'true');
            li.dataset.itemName = equippedItem.name;
            li.dataset.owner = 'equipment';
            li.dataset.slotType = slotType;
            li.innerHTML = `<span class="inventory-icon">${equippedItem.icon}</span><span class="inventory-name">${equippedItem.name}</span>`;
            if (equippedItem.hasOwnProperty('currentDurability')) li.innerHTML += `<span class="item-durability">${equippedItem.currentDurability}/${equippedItem.durability}</span>`;
            slotEl.appendChild(li);
        }
    });

    const attack = (player.equipment.weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE);
    const defense = (player.equipment.body?.stats?.defense || 0);
    playerStatAttackEl.textContent = attack;
    playerStatDefenseEl.textContent = defense;
}

// --- MODALE DE COMBAT ---
export function showCombatModal(combatState) {
    if (!combatState) return;
    updateCombatUI(combatState);
    window.DOM.combatModal.classList.remove('hidden');
}

export function hideCombatModal() {
    window.DOM.combatModal.classList.add('hidden');
}

export function updateCombatUI(combatState) {
    if (!combatState || !window.DOM.combatModal) return;
    const { combatEnemyName, combatEnemyHealthBar, combatEnemyHealthText, combatPlayerHealthBar, combatPlayerHealthText, combatLogEl, combatActionsEl } = window.DOM;
    const { enemy, isPlayerTurn, log } = combatState;
    const player = window.gameState.player;

    combatEnemyName.textContent = enemy.name;
    combatEnemyHealthBar.style.width = `${(enemy.currentHealth / enemy.health) * 100}%`;
    combatEnemyHealthText.textContent = `${enemy.currentHealth} / ${enemy.health}`;

    combatPlayerHealthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
    combatPlayerHealthText.textContent = `${player.health} / ${player.maxHealth}`;
    combatLogEl.innerHTML = log.map(msg => `<p>${msg}</p>`).join('');
    combatActionsEl.innerHTML = `<button id="combat-attack-btn" ${!isPlayerTurn ? 'disabled' : ''}>⚔️ Attaquer</button><button id="combat-flee-btn" ${!isPlayerTurn ? 'disabled' : ''}>🏃‍♂️ Fuir</button>`;
    if (isPlayerTurn) {
        document.getElementById('combat-attack-btn').onclick = () => window.handleCombatAction('attack');
        document.getElementById('combat-flee-btn').onclick = () => window.handleCombatAction('flee');
    }
}

// --- MODALE DE QUANTITÉ ---
export function showQuantityModal(itemName, maxAmount, callback) {
    const { quantityModalTitle, quantitySlider, quantityInput, quantityModal } = window.DOM;
    quantityModalTitle.textContent = `Transférer ${itemName}`;
    quantitySlider.max = maxAmount;
    quantitySlider.value = 1;
    quantityInput.max = maxAmount;
    quantityInput.value = 1;
    quantityConfirmCallback = callback;
    quantityModal.classList.remove('hidden');
}

export function hideQuantityModal() {
    window.DOM.quantityModal.classList.add('hidden');
    quantityConfirmCallback = null;
}

export function setupQuantityModalListeners() {
    const { quantitySlider, quantityInput, quantityConfirmBtn, quantityCancelBtn, quantityMaxBtn, quantityShortcuts } = window.DOM;
    quantitySlider.addEventListener('input', () => { quantityInput.value = quantitySlider.value; });
    quantityInput.addEventListener('input', () => {
        const val = parseInt(quantityInput.value, 10);
        const max = parseInt(quantityInput.max, 10);
        if (isNaN(val) || val < 1) quantityInput.value = 1; 
        else if (val > max) quantityInput.value = max;
        quantitySlider.value = quantityInput.value;
    });
    quantityConfirmBtn.addEventListener('click', () => { if (quantityConfirmCallback) quantityConfirmCallback(parseInt(quantityInput.value, 10)); hideQuantityModal(); });
    quantityCancelBtn.addEventListener('click', hideQuantityModal);
    quantityMaxBtn.addEventListener('click', () => { quantityInput.value = quantityInput.max; quantitySlider.value = quantitySlider.max; });
    quantityShortcuts.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && e.target.dataset.amount) { const amount = Math.min(parseInt(e.target.dataset.amount, 10), quantityInput.max); quantityInput.value = amount; quantitySlider.value = amount; } });
}