// js/ui/panels.js
import { ITEM_TYPES } from '../config.js';
import { getTotalResources } from '../player.js';
import DOM from './dom.js';

function drawSquaresBar(container, value, maxValue) {
    if (!container) return; // Garde-fou
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
    if (!player) return;
    const { healthBarSquaresEl, thirstBarSquaresEl, hungerBarSquaresEl, sleepBarSquaresEl, healthStatusEl } = DOM;
    
    drawSquaresBar(healthBarSquaresEl, player.health, player.maxHealth);
    drawSquaresBar(thirstBarSquaresEl, player.thirst, player.maxThirst);
    drawSquaresBar(hungerBarSquaresEl, player.hunger, player.maxHunger);
    drawSquaresBar(sleepBarSquaresEl, player.sleep, player.maxSleep);
    
    if (healthStatusEl) healthStatusEl.textContent = player.status;

    if (healthBarSquaresEl) healthBarSquaresEl.classList.toggle('pulsing', player.health <= (player.maxHealth * 0.3));
    if (thirstBarSquaresEl) thirstBarSquaresEl.classList.toggle('pulsing', player.thirst <= (player.maxThirst * 0.2));
    if (hungerBarSquaresEl) hungerBarSquaresEl.classList.toggle('pulsing', player.hunger <= (player.maxHunger * 0.2));
    if (sleepBarSquaresEl) sleepBarSquaresEl.classList.toggle('pulsing', player.sleep <= (player.maxSleep * 0.2));
    
    const survivalVignette = document.getElementById('survival-vignette');
    if (survivalVignette) survivalVignette.classList.toggle('active', player.health <= (player.maxHealth * 0.3));
}

export function updateQuickSlots(player) {
    if (!player || !player.equipment) return;
    const { quickSlotWeapon, quickSlotArmor, quickSlotBag } = DOM;
    const slots = {
        weapon: quickSlotWeapon,
        body: quickSlotArmor,
        bag: quickSlotBag,
    };

    for (const slotType in slots) {
        const slotEl = slots[slotType];
        if (!slotEl) continue; // Si l'élément DOM n'existe pas

        const equippedItem = player.equipment[slotType];
        const placeholder = slotEl.querySelector('.slot-placeholder-text');
        
        const iconSpan = slotEl.querySelector('span:not(.slot-placeholder-text)');
        if (iconSpan) iconSpan.remove();
        
        slotEl.classList.toggle('has-item', !!equippedItem);

        if (equippedItem) {
            if (placeholder) placeholder.style.display = 'none';
            const itemDef = ITEM_TYPES[equippedItem.name] || { icon: equippedItem.icon || '❓' };
            const iconEl = document.createElement('span');
            iconEl.textContent = itemDef.icon;
            slotEl.prepend(iconEl);
            slotEl.dataset.itemName = equippedItem.name;
        } else {
            if (placeholder) placeholder.style.display = 'block';
            slotEl.removeAttribute('data-item-name');
        }
    }
}

export function updateInventory(player) {
    if (!player || !player.inventory || !DOM.inventoryCategoriesEl || !DOM.inventoryCapacityEl) return;
    
    DOM.inventoryCategoriesEl.innerHTML = ''; 
    const total = getTotalResources(player.inventory); 
    DOM.inventoryCapacityEl.textContent = `(${total} / ${player.maxInventory})`;

    const categories = { consumable: [], tool: [], weapon: [], armor: [], body: [], bag: [], resource: [], usable: [] };
    for (const itemName in player.inventory) {
        if (player.inventory[itemName] > 0) {
            const itemDef = ITEM_TYPES[itemName] || { type: 'resource', icon: '❓' }; // Valeur par défaut plus complète
            let type = itemDef.type;
            // Gestion plus robuste pour classer les objets équipables
            if (itemDef.slot && (itemDef.type === 'tool' || itemDef.type === 'weapon' || itemDef.type === 'body' || itemDef.type === 'bag' || itemDef.type === 'armor')) {
                type = itemDef.slot === 'body' && itemDef.type === 'armor' ? 'armor' : itemDef.slot; // Catégorie 'armor' si c'est une armure pour 'body'
            }
            if (categories[type]) {
                 categories[type].push(itemName);
            } else if (categories.resource) { // Catégorie par défaut si type inconnu
                categories.resource.push(itemName);
            }
        }
    }

    const categoryOrder = [
        { key: 'consumable', name: 'Consommables' }, { key: 'tool', name: 'Outils' },
        { key: 'weapon', name: 'Armes' }, { key: 'armor', name: 'Armures' }, // 'armor' au lieu de 'body' seulement
        { key: 'body', name: 'Habits' }, // 'body' pour les vêtements non-armures
        { key: 'bag', name: 'Sacs' }, { key: 'resource', name: 'Ressources' },
        { key: 'usable', name: 'Objets Spéciaux' },
    ];
    
    let hasItems = false;
    categoryOrder.forEach(cat => {
        const itemsInCategory = categories[cat.key];

        if (itemsInCategory && itemsInCategory.length > 0) {
            hasItems = true;
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'inventory-category';
            const header = document.createElement('div');
            // Par défaut, les catégories sont fermées, sauf si elles ont un contenu important
            header.className = 'category-header'; // Retrait de 'open' par défaut
            if (cat.key === 'resource' || cat.key === 'consumable') header.classList.add('open'); // Ouvrir ressources et consommables par défaut

            header.innerHTML = `<span>${cat.name}</span><span class="category-toggle">▶</span>`;
            const content = document.createElement('ul');
            content.className = 'category-content';
            if (header.classList.contains('open')) content.classList.add('visible'); // Rendre visible si 'open'

            itemsInCategory.sort().forEach(itemName => {
                const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
                const li = document.createElement('li');
                li.className = 'inventory-item';
                if (itemDef.type === 'consumable') li.classList.add('clickable');
                li.dataset.itemName = itemName;
                li.setAttribute('draggable', 'true'); // Tous les objets sont déplaçables
                li.dataset.itemCount = player.inventory[itemName]; // Ajouter le compte pour le D&D
                li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${itemName}</span><span class="inventory-count">${player.inventory[itemName]}</span>`;
                content.appendChild(li);
            });
            categoryDiv.appendChild(header);
            categoryDiv.appendChild(content);
            DOM.inventoryCategoriesEl.appendChild(categoryDiv);
        }
    });
    if (!hasItems) DOM.inventoryCategoriesEl.innerHTML = '<li class="inventory-empty">(Vide)</li>'; 
}

export function updateDayCounter(day) { 
    if (DOM.dayCounterEl) DOM.dayCounterEl.textContent = day; 
}

export function updateTileInfoPanel(tile) {
    if (!tile || !tile.type || !DOM.tileNameEl || !DOM.tileDescriptionEl || !DOM.tileHarvestsInfoEl) return;

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

export function addChatMessage(message, type, author) {
    const chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) return;

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', type || 'system'); // 'system' par défaut si type non fourni
    let content = author ? `<strong>${author}: </strong>` : '';
    content += `<span>${message}</span>`; // Utiliser textContent pour éviter injection HTML si message vient de l'utilisateur
    msgDiv.innerHTML = content; // OK si le contenu est contrôlé ou échappé
    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight; // Auto-scroll
}

export function updateAllButtonsState(gameState) {
    if (!gameState || !gameState.player) return;
    const isPlayerBusy = gameState.player.isBusy || !!gameState.player.animationState;
    console.log("[updateAllButtonsState] Appelée. player.isBusy =", gameState.player.isBusy, "player.animationState =", !!gameState.player.animationState, "=> isPlayerBusy (calculé) =", isPlayerBusy);

    document.querySelectorAll('.nav-button-overlay').forEach(b => {
        b.disabled = isPlayerBusy;
    });
    document.querySelectorAll('.consume-btn').forEach(b => {
        b.disabled = isPlayerBusy;
    });
    
    // Si vous avez une référence au bouton quickChat dans DOM :
    // if (DOM.quickChatButton) DOM.quickChatButton.disabled = isPlayerBusy;

    // Les boutons dans DOM.actionsEl sont gérés par updatePossibleActions.
    // Mais on peut s'assurer qu'ils sont désactivés si le joueur est occupé au cas où.
    if (DOM.actionsEl) {
        DOM.actionsEl.querySelectorAll('button').forEach(b => {
            if (isPlayerBusy) {
                b.disabled = true;
            }
            // Ne pas faire b.disabled = false ici, car updatePossibleActions
            // gère quelles actions spécifiques sont disponibles.
        });
    }
}