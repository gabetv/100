// js/ui/modals.js
import { CONFIG, ITEM_TYPES, COMBAT_CONFIG } from '../config.js';
import * as DOM from './dom.js';
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
            li.innerHTML = `
                <span class="inventory-icon">${itemDef.icon}</span>
                <span class="inventory-name">${itemName}</span>
                <span class="inventory-count">${count}</span>
            `;
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
    // LA CORRECTION EST ICI : on passe 'player-inventory' pour être cohérent avec la modale d'équipement.
    populateInventoryList(player.inventory, DOM.modalPlayerInventoryEl, 'player-inventory');
    populateInventoryList(tile.inventory, DOM.modalSharedInventoryEl, 'shared');
    const totalPlayerResources = getTotalResources(player.inventory);
    DOM.modalPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    DOM.inventoryModal.classList.remove('hidden');
}

export function hideInventoryModal() {
    DOM.inventoryModal.classList.add('hidden');
}

// --- MODALE D'ÉQUIPEMENT ---
export function showEquipmentModal(gameState) {
    updateEquipmentModal(gameState);
    DOM.equipmentModal.classList.remove('hidden');
}

export function hideEquipmentModal() {
    DOM.equipmentModal.classList.add('hidden');
}

export function updateEquipmentModal(gameState) {
    const { player } = gameState;
    
    populateInventoryList(player.inventory, DOM.equipmentPlayerInventoryEl, 'player-inventory');
    const totalPlayerResources = getTotalResources(player.inventory);
    DOM.equipmentPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    
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
            li.innerHTML = `
                <span class="inventory-icon">${equippedItem.icon}</span>
                <span class="inventory-name">${equippedItem.name}</span>
            `;
            if (equippedItem.hasOwnProperty('currentDurability')) {
                li.innerHTML += `<span class="item-durability">${equippedItem.currentDurability}/${equippedItem.durability}</span>`;
            }
            slotEl.appendChild(li);
        }
    });

    const attack = (player.equipment.weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE);
    const defense = (player.equipment.body?.stats?.defense || 0); // Armor is on body slot
    DOM.playerStatAttackEl.textContent = attack;
    DOM.playerStatDefenseEl.textContent = defense;
}

// --- MODALE DE COMBAT ---
export function showCombatModal(combatState) {
    if (!combatState) return;
    updateCombatUI(combatState);
    DOM.combatModal.classList.remove('hidden');
}

export function hideCombatModal() {
    DOM.combatModal.classList.add('hidden');
}

export function updateCombatUI(combatState) {
    if (!combatState || !DOM.combatModal) return;
    const { enemy, isPlayerTurn, log } = combatState;
    const player = window.gameState.player;

    DOM.combatEnemyName.textContent = enemy.name;
    DOM.combatEnemyHealthBar.style.width = `${(enemy.currentHealth / enemy.health) * 100}%`;
    DOM.combatEnemyHealthText.textContent = `${enemy.currentHealth} / ${enemy.health}`;

    DOM.combatPlayerHealthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
    DOM.combatPlayerHealthText.textContent = `${player.health} / ${player.maxHealth}`;

    DOM.combatLogEl.innerHTML = log.map(msg => `<p>${msg}</p>`).join('');

    DOM.combatActionsEl.innerHTML = `
        <button id="combat-attack-btn" ${!isPlayerTurn ? 'disabled' : ''}>⚔️ Attaquer</button>
        <button id="combat-flee-btn" ${!isPlayerTurn ? 'disabled' : ''}>🏃‍♂️ Fuir</button>
    `;

    if (isPlayerTurn) {
        document.getElementById('combat-attack-btn').onclick = () => window.handleCombatAction('attack');
        document.getElementById('combat-flee-btn').onclick = () => window.handleCombatAction('flee');
    }
}

// --- MODALE DE QUANTITÉ ---
export function showQuantityModal(itemName, maxAmount, callback) {
    DOM.quantityModalTitle.textContent = `Transférer ${itemName}`;
    DOM.quantitySlider.max = maxAmount;
    DOM.quantitySlider.value = 1;
    DOM.quantityInput.max = maxAmount;
    DOM.quantityInput.value = 1;
    quantityConfirmCallback = callback;
    DOM.quantityModal.classList.remove('hidden');
}

export function hideQuantityModal() {
    DOM.quantityModal.classList.add('hidden');
    quantityConfirmCallback = null;
}

export function setupQuantityModalListeners() {
    DOM.quantitySlider.addEventListener('input', () => { DOM.quantityInput.value = DOM.quantitySlider.value; });
    DOM.quantityInput.addEventListener('input', () => {
        const val = parseInt(DOM.quantityInput.value, 10);
        const max = parseInt(DOM.quantityInput.max, 10);
        if (isNaN(val) || val < 1) { DOM.quantityInput.value = 1; } 
        else if (val > max) { DOM.quantityInput.value = max; }
        DOM.quantitySlider.value = DOM.quantityInput.value;
    });
    DOM.quantityConfirmBtn.addEventListener('click', () => { if (quantityConfirmCallback) { quantityConfirmCallback(parseInt(DOM.quantityInput.value, 10)); } hideQuantityModal(); });
    DOM.quantityCancelBtn.addEventListener('click', hideQuantityModal);
    DOM.quantityMaxBtn.addEventListener('click', () => { DOM.quantityInput.value = DOM.quantityInput.max; DOM.quantitySlider.value = DOM.quantitySlider.max; });
    DOM.quantityShortcuts.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && e.target.dataset.amount) { const amount = Math.min(parseInt(e.target.dataset.amount, 10), DOM.quantityInput.max); DOM.quantityInput.value = amount; DOM.quantitySlider.value = amount; } });
}