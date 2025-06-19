// js/ui/panels.js
import { ITEM_TYPES } from '../config.js';
import { getTotalResources } from '../player.js';
// On retire l'import de DOM

function drawSquaresBar(container, value, maxValue) {
    container.innerHTML = '';
    const numSquares = 10;
    const filledCount = Math.ceil((value / maxValue) * numSquares);

    for (let i = 0; i < numSquares; i++) {
        const square = document.createElement('div');
        square.classList.add('stat-square');
        square.classList.toggle('filled', i < filledCount);
        container.appendChild(square);
    }
}

export function updateStatsPanel(player) {
    const { healthBarSquaresEl, thirstBarSquaresEl, hungerBarSquaresEl, sleepBarSquaresEl, healthStatusEl } = window.DOM;
    drawSquaresBar(healthBarSquaresEl, player.health, player.maxHealth);
    drawSquaresBar(thirstBarSquaresEl, player.thirst, player.maxThirst);
    drawSquaresBar(hungerBarSquaresEl, player.hunger, player.maxHunger);
    drawSquaresBar(sleepBarSquaresEl, player.sleep, player.maxSleep);
    
    healthStatusEl.textContent = player.status;

    healthBarSquaresEl.classList.toggle('pulsing', player.health <= (player.maxHealth * 0.3));
    thirstBarSquaresEl.classList.toggle('pulsing', player.thirst <= (player.maxThirst * 0.2));
    hungerBarSquaresEl.classList.toggle('pulsing', player.hunger <= (player.maxHunger * 0.2));
    sleepBarSquaresEl.classList.toggle('pulsing', player.sleep <= (player.maxSleep * 0.2));
    
    document.getElementById('survival-vignette').classList.toggle('active', player.health <= (player.maxHealth * 0.3));
}

export function updateQuickSlots(player) {
    const { quickSlotWeapon, quickSlotArmor, quickSlotBag } = window.DOM;
    const slots = {
        weapon: quickSlotWeapon,
        body: quickSlotArmor,
        bag: quickSlotBag,
    };

    for (const slotType in slots) {
        const slotEl = slots[slotType];
        const equippedItem = player.equipment[slotType];
        const placeholder = slotEl.querySelector('.slot-placeholder-text');
        
        const icon = slotEl.querySelector('span:not(.slot-placeholder-text)');
        if (icon) icon.remove();
        
        slotEl.classList.toggle('has-item', !!equippedItem);

        if (equippedItem) {
            placeholder.style.display = 'none';
            const iconEl = document.createElement('span');
            iconEl.textContent = equippedItem.icon;
            slotEl.prepend(iconEl);
            slotEl.dataset.itemName = equippedItem.name;
        } else {
            placeholder.style.display = 'block';
            slotEl.removeAttribute('data-item-name');
        }
    }
}

export function updateInventory(player) {
    const { inventoryCategoriesEl, inventoryCapacityEl } = window.DOM;
    inventoryCategoriesEl.innerHTML = ''; 
    const total = getTotalResources(player.inventory); 
    inventoryCapacityEl.textContent = `(${total} / ${player.maxInventory})`;

    const categories = { consumable: [], tool: [], weapon: [], armor: [], body: [], bag: [], resource: [], usable: [] };
    for (const itemName in player.inventory) {
        if (player.inventory[itemName] > 0) {
            const itemDef = ITEM_TYPES[itemName] || { type: 'resource' };
            let type = itemDef.type;
            if (itemDef.slot && categories[itemDef.slot]) type = itemDef.slot;
            if (categories[type]) categories[type].push(itemName);
        }
    }

    const categoryOrder = [
        { key: 'consumable', name: 'Consommables' }, { key: 'tool', name: 'Outils' },
        { key: 'weapon', name: 'Armes' }, { key: 'body', name: 'Habits & Armures' },
        { key: 'bag', name: 'Sacs' }, { key: 'resource', name: 'Ressources' },
        { key: 'usable', name: 'Objets Spéciaux' },
    ];
    
    let hasItems = false;
    categoryOrder.forEach(cat => {
        const itemsInCategory = cat.key === 'body' ? 
            [...new Set([...(categories.body || []), ...(categories.armor || [])])] : 
            categories[cat.key];

        if (itemsInCategory && itemsInCategory.length > 0) {
            hasItems = true;
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'inventory-category';
            const header = document.createElement('div');
            header.className = 'category-header open';
            header.innerHTML = `<span>${cat.name}</span><span class="category-toggle">▶</span>`;
            const content = document.createElement('ul');
            content.className = 'category-content visible';
            itemsInCategory.sort().forEach(itemName => {
                const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
                const li = document.createElement('li');
                li.className = 'inventory-item';
                if (itemDef.type === 'consumable') li.classList.add('clickable');
                li.dataset.itemName = itemName;
                li.setAttribute('draggable', 'true');
                li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${itemName}</span><span class="inventory-count">${player.inventory[itemName]}</span>`;
                content.appendChild(li);
            });
            categoryDiv.appendChild(header);
            categoryDiv.appendChild(content);
            inventoryCategoriesEl.appendChild(categoryDiv);
        }
    });
    if (!hasItems) inventoryCategoriesEl.innerHTML = '<li class="inventory-empty">(Vide)</li>'; 
}

export function updateDayCounter(day) { 
    window.DOM.dayCounterEl.textContent = day; 
}

export function updateTileInfoPanel(tile) {
    const { tileNameEl, tileDescriptionEl, tileHarvestsInfoEl } = window.DOM;
    tileNameEl.textContent = tile.type.name;
    const descriptions = { 'Forêt': "L'air est lourd et humide...", 'Plaine': "Une plaine herbeuse...", 'Sable Doré': "Le sable chaud vous brûle les pieds...", 'Lagon': "L'eau turquoise vous invite...", 'Friche': "Le sol est nu...", 'Gisement de Pierre': "Des rochers affleurent...", 'Feu de Camp': "La chaleur des flammes danse...", 'Abri Individuel': "Un abri précaire...", 'Abri Collectif': "Un campement bien établi...", 'Mine': "L'entrée sombre de la mine..." };
    tileDescriptionEl.textContent = descriptions[tile.type.name] || "Un lieu étrange...";
    
    if (tile.type.resource && tile.harvestsLeft > 0 && tile.type.harvests !== Infinity) {
        tileHarvestsInfoEl.textContent = `Récoltes restantes: ${tile.harvestsLeft}`;
        tileHarvestsInfoEl.style.display = 'block';
    } else {
        tileHarvestsInfoEl.style.display = 'none';
    }
}

export function addChatMessage(message, type, author) {
    const chatMessagesEl = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', type);
    let content = author ? `<strong>${author}: </strong>` : '';
    content += `<span>${message}</span>`;
    msgDiv.innerHTML = content;
    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

export function updateAllButtonsState(gameState) {
    const isPlayerBusy = gameState.player.isBusy || gameState.player.animationState;
    document.querySelectorAll('.nav-button-overlay, .consume-btn, #quick-chat-button').forEach(b => b.disabled = isPlayerBusy);
    window.DOM.actionsEl.querySelectorAll('button').forEach(b => {
        if (isPlayerBusy) b.disabled = true;
    });
}