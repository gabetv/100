// js/ui/panels.js
import { ITEM_TYPES, TILE_TYPES } from '../config.js'; 
import { getTotalResources } from '../player.js';
import DOM from './dom.js';

function drawSquaresBar(container, value, maxValue) {
    if (!container) return;
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
    // console.log("updateQuickSlots est appelée mais les quick slots sont supprimés de l'UI.");
}

export function updateInventory(player) {
    if (!player || !player.inventory || !DOM.inventoryCategoriesEl || !DOM.inventoryCapacityEl) return;
    
    DOM.inventoryCategoriesEl.innerHTML = ''; 
    const total = getTotalResources(player.inventory); 
    DOM.inventoryCapacityEl.textContent = `(${total} / ${player.maxInventory})`;

    const categories = { 
        consumable: [], tool: [], weapon: [], shield: [], armor: [], 
        body: [], head: [], feet: [], bag: [], 
        resource: [], usable: [], key: [], 
    };
    
    for (const itemName in player.inventory) {
        if (player.inventory[itemName] > 0) {
            const itemDef = ITEM_TYPES[itemName] || { type: 'resource', icon: '❓' };
            let type = itemDef.type; 

            if (itemDef.slot) { 
                if (categories[itemDef.slot]) { type = itemDef.slot; }
                else if (itemDef.type === 'armor' && itemDef.slot === 'body') { type = 'armor'; }
                else if (itemDef.type === 'shield' && itemDef.slot === 'shield') { type = 'shield'; }
                if (itemDef.type === 'tool' && categories.tool) { type = 'tool'; }
            }

            if (categories[type]) { categories[type].push(itemName); }
            else if (categories.resource) { 
                console.warn(`Type d'item '${type}' pour '${itemName}' n'a pas de catégorie dédiée, classé comme ressource.`);
                categories.resource.push(itemName);
            } else { console.error(`Catégorie de ressource par défaut manquante et type inconnu pour l'item ${itemName}`); }
        }
    }

    const categoryOrder = [
        { key: 'consumable', name: 'Consommables' }, { key: 'tool', name: 'Outils' },
        { key: 'weapon', name: 'Armes' }, { key: 'shield', name: 'Boucliers' },
        { key: 'armor', name: 'Armures (Corps)' },{ key: 'body', name: 'Habits (Corps)' },   
        { key: 'head', name: 'Chapeaux' }, { key: 'feet', name: 'Chaussures' }, 
        { key: 'bag', name: 'Sacs' }, { key: 'resource', name: 'Ressources' }, 
        { key: 'usable', name: 'Objets Spéciaux' }, { key: 'key', name: 'Clés & Uniques' }, 
    ];
    
    let hasItems = false;
    categoryOrder.forEach(cat => {
        const itemsInCategory = categories[cat.key];
        if (itemsInCategory && itemsInCategory.length > 0) {
            hasItems = true;
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'inventory-category';
            const header = document.createElement('div');
            header.className = 'category-header'; 
            if (['resource', 'consumable', 'tool', 'key'].includes(cat.key)) header.classList.add('open');
            header.innerHTML = `<span>${cat.name}</span><span class="category-toggle">▶</span>`;
            const content = document.createElement('ul');
            content.className = 'category-content';
            if (header.classList.contains('open')) content.classList.add('visible');

            itemsInCategory.sort().forEach(itemName => {
                const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
                const li = document.createElement('li');
                li.className = 'inventory-item';
                if (itemDef.type === 'consumable' || itemName.startsWith('Parchemin Atelier') || itemName === 'Eau salée' || itemDef.slot || itemName === 'Carte') {
                    li.classList.add('clickable'); // Clickable pour consommer, équiper, utiliser (carte)
                }
                li.dataset.itemName = itemName;
                li.setAttribute('draggable', 'true'); 
                li.dataset.itemCount = player.inventory[itemName]; 
                li.dataset.owner = 'player-inventory';
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
    if (!tile || !DOM.tileNameEl || !DOM.tileHarvestsInfoEl) return;

    let mainDisplayName = tile.type.name; 
    let mainHarvestsInfo = "";
    let mainDurabilityInfo = "";

    if (tile.buildings && tile.buildings.length > 0) {
        const mainBuildingInstance = tile.buildings[0]; 
        const mainBuildingDef = TILE_TYPES[mainBuildingInstance.key]; 
        if (mainBuildingDef) {
            mainDisplayName = mainBuildingDef.name;
            mainDurabilityInfo = `Durabilité: ${mainBuildingInstance.durability}/${mainBuildingInstance.maxDurability}`;
        }
    }

    DOM.tileNameEl.textContent = mainDisplayName;

    if (mainDurabilityInfo && DOM.tileHarvestsInfoEl) { 
        DOM.tileHarvestsInfoEl.textContent = mainDurabilityInfo;
        DOM.tileHarvestsInfoEl.style.display = 'block';
    } else if (tile.type.resource && tile.harvestsLeft > 0 && tile.type.harvests !== Infinity && (!tile.buildings || tile.buildings.length === 0) && DOM.tileHarvestsInfoEl) {
        mainHarvestsInfo = `Récoltes (terrain): ${tile.harvestsLeft}`;
        DOM.tileHarvestsInfoEl.textContent = mainHarvestsInfo;
        DOM.tileHarvestsInfoEl.style.display = 'block';
    } else if (DOM.tileHarvestsInfoEl) {
        DOM.tileHarvestsInfoEl.style.display = 'none';
    }
}

export function addChatMessage(message, type, author) {
    const chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) return;

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', type || 'system'); 
    let content = author ? `<strong>${author}: </strong>` : '';
    const spanMessage = document.createElement('span'); 
    spanMessage.textContent = message;
    if (type === 'npc-dialogue') {
        msgDiv.innerHTML = author ? `<strong>${author}: </strong>${message}` : message;
    } else {
        msgDiv.innerHTML = content + spanMessage.outerHTML; 
    }
    chatMessagesEl.appendChild(msgDiv);
    
    if (DOM.bottomBarChatPanelEl && !DOM.bottomBarChatPanelEl.classList.contains('chat-enlarged')) {
        while (chatMessagesEl.children.length > 3) {
            chatMessagesEl.removeChild(chatMessagesEl.firstChild);
        }
    }
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight; 
    return msgDiv;
}

export function updateAllButtonsState(gameState) {
    if (!gameState || !gameState.player) return;
    const { player } = gameState;
    const isPlayerBusy = player.isBusy || !!player.animationState;

    document.querySelectorAll('.nav-button-overlay').forEach(b => {
        b.disabled = isPlayerBusy;
    });
    
    if (DOM.consumeHealthBtn) {
        let canHeal = false;
        if ((player.inventory['Kit de Secours'] > 0 && (player.status === 'Blessé' || player.status === 'Malade')) || 
            (player.inventory['Bandage'] > 0 && player.status === 'Blessé') || 
            (player.inventory['Médicaments'] > 0 && player.status === 'Malade')) {
            canHeal = true;
        }
        DOM.consumeHealthBtn.disabled = isPlayerBusy || !canHeal;
    }
    if (DOM.consumeThirstBtn) {
        let canDrink = false;
        if ((player.inventory['Eau pure'] > 0) || (player.inventory['Noix de coco'] > 0)) {
            canDrink = true;
        }
        DOM.consumeThirstBtn.disabled = isPlayerBusy || !canDrink;
    }
    if (DOM.consumeHungerBtn) {
        let canEat = false;
        if ((player.inventory['Viande cuite'] > 0) || 
            (player.inventory['Poisson cuit'] > 0) || 
            (player.inventory['Oeuf cuit'] > 0) || 
            (player.inventory['Barre Énergétique'] > 0) || 
            (player.inventory['Banane'] > 0)) {
            canEat = true;
        }
        DOM.consumeHungerBtn.disabled = isPlayerBusy || !canEat;
    }
    
    if (DOM.quickChatButton) DOM.quickChatButton.disabled = isPlayerBusy;

    if (DOM.actionsEl) {
        DOM.actionsEl.querySelectorAll('button').forEach(b => {
            if (isPlayerBusy && !b.classList.contains('action-always-enabled')) { 
                b.disabled = true;
            }
        });
    }
     // Désactiver les boutons dans la modale de construction si le joueur est occupé
    if (DOM.buildModalGridEl) {
        DOM.buildModalGridEl.querySelectorAll('button').forEach(b => {
             if (isPlayerBusy && !b.classList.contains('action-always-enabled')) { 
                b.disabled = true;
            }
        });
    }
}

export function updateGroundItemsPanel(tile) {
    if (!DOM.bottomBarGroundItemsEl || !tile) return;

    const groundItems = tile.groundItems || {};
    const list = DOM.bottomBarGroundItemsEl.querySelector('.ground-items-list');
    if (list) {
        list.innerHTML = ''; 
    } else {
        console.error("Élément .ground-items-list non trouvé dans #bottom-bar-ground-items");
        return;
    }

    if (Object.keys(groundItems).length === 0) {
        const li = document.createElement('li');
        li.className = 'inventory-empty';
        li.textContent = '(Rien au sol)';
        list.appendChild(li);
    } else {
        for (const itemName in groundItems) {
            if (groundItems[itemName] > 0) {
                const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
                const li = document.createElement('li');
                li.className = 'inventory-item clickable'; // Clickable pour ramasser
                li.dataset.itemName = itemName;
                li.dataset.itemCount = groundItems[itemName];
                li.setAttribute('draggable', 'true'); // Draggable pour ramasser
                li.dataset.owner = 'ground';

                li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${itemName}</span><span class="inventory-count">${groundItems[itemName]}</span>`;
                list.appendChild(li);
            }
        }
    }
}

export function updateBottomBarEquipmentPanel(player) {
    if (!DOM.bottomBarEquipmentPanelEl || !player || !DOM.bottomBarEquipmentSlotsEl) return;

    const slotsContainer = DOM.bottomBarEquipmentSlotsEl;
    slotsContainer.innerHTML = '';

    const slotTypesAndLabels = [
        { type: 'head', label: 'Chapeau' }, { type: 'weapon', label: 'Arme' },
        { type: 'shield', label: 'Bouclier' }, { type: 'body', label: 'Habit' },
        { type: 'feet', label: 'Pieds' }, { type: 'bag', label: 'Sac' }
    ];

    slotTypesAndLabels.forEach(slotInfo => {
        const slotContainer = document.createElement('div');
        slotContainer.className = 'equipment-slot-container-small';
        const label = document.createElement('label');
        label.textContent = slotInfo.label;
        slotContainer.appendChild(label);

        const slotEl = document.createElement('div');
        slotEl.className = 'equipment-slot-small droppable'; // Droppable pour équiper
        slotEl.dataset.slotType = slotInfo.type;
        slotEl.dataset.owner = 'equipment';

        const equippedItem = player.equipment[slotInfo.type];
        if (equippedItem) {
            const itemDef = ITEM_TYPES[equippedItem.name] || { icon: equippedItem.icon || '❓' };
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item'; 
            itemDiv.setAttribute('draggable', 'true'); // Draggable pour déséquiper vers inventaire
            itemDiv.dataset.itemName = equippedItem.name;
            itemDiv.dataset.owner = 'equipment'; // L'item appartient à l'équipement
            itemDiv.dataset.slotType = slotInfo.type; // Le slot d'origine de l'item

            const iconEl = document.createElement('span');
            iconEl.className = 'inventory-icon';
            iconEl.textContent = itemDef.icon;
            itemDiv.appendChild(iconEl);
            slotEl.appendChild(itemDiv); 
        }
        slotContainer.appendChild(slotEl);
        slotsContainer.appendChild(slotContainer);
    });
}