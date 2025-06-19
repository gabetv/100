// js/ui/modals.js
import { ITEM_TYPES, COMBAT_CONFIG } from '../config.js';
import { getTotalResources } from '../player.js';
import { addChatMessage } from './panels.js';
import DOM from './dom.js';
// ### AJOUT IMPORTANT : Importer les fonctions de dessin pour la carte ###
import * as Draw from './draw.js';

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
    const { modalPlayerInventoryEl, modalSharedInventoryEl, modalPlayerCapacityEl, inventoryModal } = DOM;
    populateInventoryList(player.inventory, modalPlayerInventoryEl, 'player-inventory');
    populateInventoryList(tile.inventory, modalSharedInventoryEl, 'shared');
    const totalPlayerResources = getTotalResources(player.inventory);
    modalPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    inventoryModal.classList.remove('hidden');
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
    const { equipmentPlayerInventoryEl, equipmentPlayerCapacityEl, playerStatAttackEl, playerStatDefenseEl } = DOM;

    populateInventoryList(player.inventory, equipmentPlayerInventoryEl, 'player-inventory');
    const totalPlayerResources = getTotalResources(player.inventory);
    equipmentPlayerCapacityEl.textContent = `${totalPlayerResources} / ${player.maxInventory}`;
    
    // Assurez-vous que DOM.equipmentSlotsEl est bien l'élément parent des slots individuels.
    // S'il est null, la boucle ne s'exécutera pas.
    if (DOM.equipmentSlotsEl) {
        DOM.equipmentSlotsEl.querySelectorAll('.equipment-slot').forEach(slotEl => {
            const slotType = slotEl.dataset.slotType;
            const equippedItem = player.equipment[slotType];
            slotEl.innerHTML = '';
            if (equippedItem) {
                const li = document.createElement('div'); // Doit être un div ou li selon votre CSS
                li.className = 'inventory-item'; // Assurez-vous que le style s'applique
                li.setAttribute('draggable', 'true');
                li.dataset.itemName = equippedItem.name;
                li.dataset.owner = 'equipment';
                li.dataset.slotType = slotType; // Important pour le drag & drop
                const itemDef = ITEM_TYPES[equippedItem.name] || { icon: equippedItem.icon || '❓' };
                li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${equippedItem.name}</span>`;
                if (equippedItem.hasOwnProperty('currentDurability')) {
                     li.innerHTML += `<span class="item-durability" style="font-size: 0.7em; color: var(--text-secondary); display: block; text-align: center;">${equippedItem.currentDurability}/${equippedItem.durability}</span>`;
                }
                slotEl.appendChild(li);
            }
        });
    }


    const attack = (player.equipment.weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE);
    const defense = (player.equipment.body?.stats?.defense || 0);
    playerStatAttackEl.textContent = attack;
    playerStatDefenseEl.textContent = defense;
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
    if (!combatState || !DOM.combatModal) return; // S'assurer que DOM.combatModal existe
    const { combatEnemyName, combatEnemyHealthBar, combatEnemyHealthText, combatPlayerHealthBar, combatPlayerHealthText, combatLogEl, combatActionsEl } = DOM;
    const { enemy, isPlayerTurn, log } = combatState;
    // gameState est global dans main.js, mais ici on le passe ou on y accède via State
    const player = window.gameState.player; // Ou importez State et faites State.state.player

    combatEnemyName.textContent = enemy.name;
    combatEnemyHealthBar.style.width = `${(enemy.currentHealth / enemy.health) * 100}%`;
    combatEnemyHealthText.textContent = `${enemy.currentHealth} / ${enemy.health}`;

    combatPlayerHealthBar.style.width = `${(player.health / player.maxHealth) * 100}%`;
    combatPlayerHealthText.textContent = `${player.health} / ${player.maxHealth}`;
    combatLogEl.innerHTML = log.map(msg => `<p>${msg}</p>`).join('');
    
    if (combatActionsEl) { // S'assurer que combatActionsEl existe
        combatActionsEl.innerHTML = `<button id="combat-attack-btn" ${!isPlayerTurn ? 'disabled' : ''}>⚔️ Attaquer</button><button id="combat-flee-btn" ${!isPlayerTurn ? 'disabled' : ''}>🏃‍♂️ Fuir</button>`;
        if (isPlayerTurn) {
            const attackBtn = document.getElementById('combat-attack-btn');
            const fleeBtn = document.getElementById('combat-flee-btn');
            if (attackBtn) attackBtn.onclick = () => window.handleCombatAction('attack');
            if (fleeBtn) fleeBtn.onclick = () => window.handleCombatAction('flee');
        }
    }
}

// --- MODALE DE QUANTITÉ ---
export function showQuantityModal(itemName, maxAmount, callback) {
    const { quantityModalTitle, quantitySlider, quantityInput, quantityModal } = DOM;
    quantityModalTitle.textContent = `Transférer ${itemName}`;
    quantitySlider.max = maxAmount;
    quantitySlider.value = 1;
    quantityInput.max = maxAmount;
    quantityInput.value = 1;
    quantityConfirmCallback = callback;
    quantityModal.classList.remove('hidden');
}

export function hideQuantityModal() {
    DOM.quantityModal.classList.add('hidden');
    quantityConfirmCallback = null;
}

export function setupQuantityModalListeners() {
    const { quantitySlider, quantityInput, quantityConfirmBtn, quantityCancelBtn, quantityMaxBtn, quantityShortcuts } = DOM;
    if(!quantitySlider) return; // Garde-fou si les éléments ne sont pas là
    
    quantitySlider.addEventListener('input', () => { quantityInput.value = quantitySlider.value; });
    quantityInput.addEventListener('input', () => {
        let val = parseInt(quantityInput.value, 10);
        const max = parseInt(quantityInput.max, 10);
        if (isNaN(val) || val < 1) val = 1; 
        else if (val > max) val = max;
        quantityInput.value = val; // Mettre à jour la valeur après la validation
        quantitySlider.value = quantityInput.value;
    });
    quantityConfirmBtn.addEventListener('click', () => { if (quantityConfirmCallback) quantityConfirmCallback(parseInt(quantityInput.value, 10)); hideQuantityModal(); });
    quantityCancelBtn.addEventListener('click', hideQuantityModal);
    quantityMaxBtn.addEventListener('click', () => { quantityInput.value = quantityInput.max; quantitySlider.value = quantitySlider.max; });
    quantityShortcuts.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && e.target.dataset.amount) { const amount = Math.min(parseInt(e.target.dataset.amount, 10), parseInt(quantityInput.max, 10)); quantityInput.value = amount; quantitySlider.value = amount; } });
}

// ### FONCTIONS POUR LA GRANDE CARTE AJOUTÉES/VÉRIFIÉES ###
export function showLargeMap(gameState) {
    if (!DOM.largeMapModal) {
        console.error("[showLargeMap] DOM.largeMapModal non trouvé !");
        return;
    }
    console.log("[modals.js] showLargeMap appelée. Modal avant:", DOM.largeMapModal.classList);
    DOM.largeMapModal.classList.remove('hidden');
    
    if (gameState && gameState.config) {
        Draw.drawLargeMap(gameState, gameState.config);
        Draw.populateLargeMapLegend();
    } else {
        console.error("[showLargeMap] gameState ou gameState.config manquant pour dessiner la carte.");
    }
    console.log("[modals.js] showLargeMap. Modal après:", DOM.largeMapModal.classList);
}

export function hideLargeMap() {
    if (!DOM.largeMapModal) return;
    console.log("[modals.js] hideLargeMap appelée.");
    DOM.largeMapModal.classList.add('hidden');
}