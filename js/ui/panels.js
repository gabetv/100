// js/ui/panels.js
import { ITEM_TYPES, CONFIG } from '../config.js';
import { getTotalResources } from '../player.js';
import * as DOM from './dom.js';

function drawSquaresBar(container, value, maxValue, baseMaxValue = 100) {
    container.innerHTML = '';
    const numSquares = maxValue > baseMaxValue ? 12 : 10;
    const filledCount = Math.ceil((value / maxValue) * numSquares);

    for (let i = 0; i < numSquares; i++) {
        const square = document.createElement('div');
        square.classList.add('stat-square');
        if (i >= 10) square.classList.add('bonus');
        square.classList.toggle('filled', i < filledCount);
        container.appendChild(square);
    }
}

function updateConsumeButtons(player) {
    const inv = player.inventory;
    const canDrink = inv['Eau pure'] > 0 || inv['Eau salée'] > 0;
    const canEat = inv['Viande cuite'] > 0 || inv['Poisson cuit'] > 0 || inv['Banane'] > 0;
    const canHeal = inv['Médicaments'] > 0 || inv['Bandage'] > 0 || inv['Kit de Secours'] > 0 || player.status !== 'Normal';
    
    document.getElementById('consume-thirst-btn').disabled = !canDrink;
    document.getElementById('consume-hunger-btn').disabled = !canEat;
    document.getElementById('consume-health-btn').disabled = !canHeal;
}

export function updateStatsPanel(player) {
    drawSquaresBar(DOM.healthBarSquaresEl, player.health, player.maxHealth, 10);
    drawSquaresBar(DOM.thirstBarSquaresEl, player.thirst, player.maxThirst, 100);
    drawSquaresBar(DOM.hungerBarSquaresEl, player.hunger, player.maxHunger, 100);
    drawSquaresBar(DOM.sleepBarSquaresEl, player.sleep, player.maxSleep, 100);
    
    DOM.healthStatusEl.textContent = player.status;

    DOM.healthBarSquaresEl.classList.toggle('pulsing', player.health <= (player.maxHealth * 0.3));
    DOM.thirstBarSquaresEl.classList.toggle('pulsing', player.thirst <= (player.maxThirst * 0.2));
    DOM.hungerBarSquaresEl.classList.toggle('pulsing', player.hunger <= (player.maxHunger * 0.2));
    DOM.sleepBarSquaresEl.classList.toggle('pulsing', player.sleep <= (player.maxSleep * 0.2));
    
    document.getElementById('survival-vignette').classList.toggle('active', player.health <= (player.maxHealth * 0.3));
    
    updateConsumeButtons(player);
}

export function updateInventory(player) {
    const inventoryListEl = document.getElementById('inventory-list');
    inventoryListEl.innerHTML = ''; 
    const inventory = player.inventory; 
    const total = getTotalResources(inventory); 
    DOM.inventoryCapacityEl.textContent = `(${total} / ${player.maxInventory})`;

    if (Object.keys(inventory).length === 0) { 
        inventoryListEl.innerHTML = '<li class="inventory-empty">(Vide)</li>'; 
    } else { 
        for (const item in inventory) { 
            const li = document.createElement('li'); 
            const itemDef = ITEM_TYPES[item] || { icon: '❓' };
            li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${item}</span><span class="inventory-count">${inventory[item]}</span>`; 
            li.classList.add('inventory-item'); 
            li.dataset.itemName = item; 
            inventoryListEl.appendChild(li); 
        } 
    }
}

export function updateDayCounter(day) { 
    DOM.dayCounterEl.textContent = day; 
}

export function updateTileInfoPanel(tile) {
    DOM.tileNameEl.textContent = tile.type.name;
    const descriptions = { 'Forêt': "L'air est lourd et humide...", 'Plaine': "Une plaine herbeuse...", 'Sable Doré': "Le sable chaud vous brûle les pieds...", 'Lagon': "L'eau turquoise vous invite...", 'Friche': "Le sol est nu...", 'Gisement de Pierre': "Des rochers affleurent...", 'Feu de Camp': "La chaleur des flammes danse...", 'Abri Individuel': "Un abri précaire...", 'Abri Collectif': "Un campement bien établi...", 'Mine': "L'entrée sombre de la mine..." };
    DOM.tileDescriptionEl.textContent = descriptions[tile.type.name] || "Un lieu étrange...";
    
    if (tile.type.resource && tile.harvestsLeft > 0 && tile.type.harvests !== Infinity) {
        DOM.tileHarvestsInfoEl.textContent = `Récoltes restantes: ${tile.harvestsLeft}`;
        DOM.tileHarvestsInfoEl.style.display = 'block';
    } else {
        DOM.tileHarvestsInfoEl.style.display = 'none';
    }
}

// LA CORRECTION EST ICI
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
    DOM.actionsEl.querySelectorAll('button').forEach(b => {
        if (isPlayerBusy) b.disabled = true;
    });
}