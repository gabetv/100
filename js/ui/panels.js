// js/ui/panels.js
import { ITEM_TYPES, TILE_TYPES } from '../config.js';
import { getTotalResources } from '../player.js';
import DOM from './dom.js';

function updateBar(barElement, value, maxValue) {
    if (!barElement) return;
    const percentage = (value / maxValue) * 100;
    barElement.style.width = `${percentage}%`;
}

export function updateStatsPanel(player) {
    if (!player) return;
    const { healthBarEl, thirstBarEl, hungerBarEl, sleepBarEl, healthStatusEl } = DOM;

    updateBar(healthBarEl, player.health, player.maxHealth);
    updateBar(thirstBarEl, player.thirst, player.maxThirst);
    updateBar(hungerBarEl, player.hunger, player.maxHunger);
    updateBar(sleepBarEl, player.sleep, player.maxSleep);

    if (healthStatusEl) healthStatusEl.textContent = player.status.join(', ') || 'normale';

    if (healthBarEl) healthBarEl.parentElement.classList.toggle('pulsing', player.health <= (player.maxHealth * 0.3));
    if (thirstBarEl) thirstBarEl.parentElement.classList.toggle('pulsing', player.thirst <= (player.maxThirst * 0.2));
    if (hungerBarEl) hungerBarEl.parentElement.classList.toggle('pulsing', player.hunger <= (player.maxHunger * 0.2));
    if (sleepBarEl) sleepBarEl.parentElement.classList.toggle('pulsing', player.sleep <= (player.maxSleep * 0.2));

    const survivalVignette = document.getElementById('survival-vignette');
    if (survivalVignette) survivalVignette.classList.toggle('active', player.health <= (player.maxHealth * 0.3));
}

export function updateQuickSlots(player) {
    // Quick slots are not used in this version.
}

export function updateInventory(player) {
    if (!player || !player.inventory || !DOM.inventoryCategoriesEl || !DOM.inventoryCapacityEl) return;

    DOM.inventoryCategoriesEl.innerHTML = '';
    const total = getTotalResources(player.inventory);
    DOM.inventoryCapacityEl.textContent = `(${total} / ${player.maxInventory})`;

    const categories = {
        consumableAndUtility: {},
        toolAndWeapon: {},
        shield: {},
        body: {},
        head: {},
        feet: {},
        bag: {},
        resource: {},
        key: {},
    };

    // Classify items
    for (const itemName in player.inventory) {
        const itemValue = player.inventory[itemName];
        // This handles cases where items with durability are stored as objects/instances
        const baseItemName = typeof itemValue === 'object' && itemValue.name ? itemValue.name : itemName;
        const baseItemDef = ITEM_TYPES[baseItemName] || { type: 'resource', icon: '❓' };
        
        let type = baseItemDef.type;

        if (baseItemDef.type === 'tool' || baseItemDef.type === 'weapon' || (baseItemDef.type === 'usable' && baseItemDef.slot === 'weapon')) {
            type = 'toolAndWeapon';
        } else if (baseItemDef.type === 'consumable' || baseItemDef.type === 'usable') {
            type = 'consumableAndUtility';
        } else if (baseItemDef.slot) {
            if (categories[baseItemDef.slot]) type = baseItemDef.slot;
        }
        
        const targetCategory = categories[type] || categories.resource;
        
        // Group all instances under the same base name, this is a complex part
        // The original code was not fully handling instance-based items vs stackable
        // Let's simplify for now to match the provided logic
        targetCategory[itemName] = itemValue;
    }

    const categoryOrder = [
        { key: 'toolAndWeapon', name: 'Outils et Armes' },
        { key: 'consumableAndUtility', name: 'Consommables et Utilitaires' },
        { key: 'shield', name: 'Boucliers' },
        { key: 'body', name: 'Habits' },
        { key: 'head', name: 'Chapeaux & Casques' }, 
        { key: 'feet', name: 'Chaussures' },
        { key: 'bag', name: 'Sacs' }, 
        { key: 'resource', name: 'Ressources' },
        { key: 'key', name: 'Clés & Uniques' },
    ];
    
    let hasItems = false;
    categoryOrder.forEach(cat => {
        const itemsInCategory = categories[cat.key];
        if (Object.keys(itemsInCategory).length > 0) {
            hasItems = true;
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'inventory-category';
            const header = document.createElement('div');
            header.className = 'category-header open';
            header.innerHTML = `<span>${cat.name}</span><span class="category-toggle">▶</span>`;
            const content = document.createElement('ul');
            content.className = 'category-content visible';
            
            Object.keys(itemsInCategory).sort().forEach(itemName => {
                const itemValue = itemsInCategory[itemName];
                const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
                let baseItemName = itemName;
                let instanceData = null;

                // Handle instance objects (like equipped items returned to inventory)
                if (typeof itemValue === 'object' && itemValue.name) {
                    baseItemName = itemValue.name;
                    instanceData = itemValue;
                }
                
                const baseItemDef = ITEM_TYPES[baseItemName] || { icon: '❓', rarity: 'common' };

                const li = document.createElement('li');
                li.className = 'inventory-item';
                li.classList.add(`rarity-${baseItemDef.rarity}`);
                 if (baseItemDef.type === 'consumable' || baseItemDef.teachesRecipe || baseItemDef.slot || baseItemDef.type === 'usable' || baseItemDef.type === 'key') {
                    li.classList.add('clickable');
                }
                li.dataset.itemKey = itemName; // Use the unique key for interactions
                li.dataset.itemName = baseItemName;
                li.setAttribute('draggable', 'true');
                li.dataset.owner = 'player-inventory';

                let displayName = baseItemName;
                let count = (typeof itemValue === 'number') ? itemValue : 1;
                
                if (instanceData && instanceData.hasOwnProperty('currentDurability')) {
                    displayName += ` (${instanceData.currentDurability}/${instanceData.durability})`;
                }

                li.dataset.itemCount = count;
                li.innerHTML = `<span class="inventory-icon">${baseItemDef.icon}</span><span class="inventory-name">${displayName}</span><span class="inventory-count">${count}</span>`;
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
    if (DOM.dayCounterTileInfoEl) {
        const span = DOM.dayCounterTileInfoEl; // This is the span itself based on new HTML
        if (span) span.textContent = day;
    }
}

export function updateTileInfoPanel(tile) {
    if (!tile || !DOM.tileNameEl || !DOM.tileHarvestsInfoEl) return;

    let mainDisplayName = tile.type.name;
    let mainDurabilityInfo = "";

    if (tile.buildings && tile.buildings.length > 0) {
        const mainBuildingInstance = tile.buildings[0];
        const mainBuildingDef = TILE_TYPES[mainBuildingInstance.key];
        if (mainBuildingDef) {
            mainDisplayName = mainBuildingDef.name;
            if (mainBuildingInstance.hasOwnProperty('durability') && mainBuildingInstance.hasOwnProperty('maxDurability')) {
                 mainDurabilityInfo = `Durabilité: ${mainBuildingInstance.durability}/${mainBuildingInstance.maxDurability}`;
            }
        }
    }

    DOM.tileNameEl.textContent = mainDisplayName;

    let actionCountInfo = "";
    if (tile.type.name === TILE_TYPES.FOREST.name) actionCountInfo = `Actions Bois: ${tile.woodActionsLeft || 0}, Chasse: ${tile.huntActionsLeft || 0}, Fouille: ${tile.searchActionsLeft || 0}`;
    else if (tile.type.name === TILE_TYPES.PLAINS.name) actionCountInfo = `Chasse: ${tile.huntActionsLeft || 0}, Fouille: ${tile.searchActionsLeft || 0}`;
    else if (tile.type.name === TILE_TYPES.MINE_TERRAIN.name) actionCountInfo = `Pierre: ${tile.harvestsLeft || 0}`;
    else if (tile.buildings && tile.buildings.length > 0 && TILE_TYPES[tile.buildings[0].key]?.maxHarvestsPerCycle) {
        const building = tile.buildings[0];
        actionCountInfo = `Récoltes dispo: ${building.harvestsAvailable || 0}/${building.maxHarvestsPerCycle || 0}`;
    } else if (tile.type.name === TILE_TYPES.PLAGE.name && tile.actionsLeft) {
        actionCountInfo = `Fouilles: ${tile.actionsLeft.search_zone}, Sable: ${tile.actionsLeft.harvest_sand}, Pêche: ${tile.actionsLeft.fish}, Eau salée: ${tile.actionsLeft.harvest_salt_water}`;
    }

    if (mainDurabilityInfo && DOM.tileHarvestsInfoEl) {
        DOM.tileHarvestsInfoEl.textContent = mainDurabilityInfo;
        DOM.tileHarvestsInfoEl.style.display = 'block';
    } else if (actionCountInfo && DOM.tileHarvestsInfoEl) {
        DOM.tileHarvestsInfoEl.textContent = actionCountInfo;
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
        if ((player.inventory['Kit de Secours'] > 0 && player.status.includes('Malade')) ||
            (player.inventory['Médicaments'] > 0 && (player.status.includes('Malade') || player.status.includes('Drogué'))) ||
            (player.inventory['Antiseptique'] > 0 && (player.status.includes('Blessé') || player.status.includes('Malade')) && player.health < player.maxHealth) ||
            (player.inventory['Bandage'] > 0 && player.health < player.maxHealth) ||
            (player.inventory['Savon'] > 0 && player.health < player.maxHealth) ||
            (player.inventory['Huile de coco'] > 0 && player.health < player.maxHealth)
        ) {
            canHeal = true;
        }
        DOM.consumeHealthBtn.disabled = isPlayerBusy || !canHeal || player.health >= player.maxHealth;
        DOM.consumeHealthBtn.style.visibility = (!canHeal) ? 'hidden' : 'visible';
    }
    if (DOM.consumeThirstBtn) {
        let canDrink = false;
        if ((player.inventory['Eau pure'] > 0 && player.thirst < player.maxThirst) ||
            (player.inventory['Noix de coco'] > 0 && player.thirst < player.maxThirst) ||
            (player.inventory['Alcool'] > 0 && player.thirst < player.maxThirst - 1)
        ) {
            canDrink = true;
        }
        DOM.consumeThirstBtn.disabled = isPlayerBusy || !canDrink;
        DOM.consumeThirstBtn.style.visibility = !canDrink ? 'hidden' : 'visible';
    }
    if (DOM.consumeHungerBtn) {
        let canEat = false;
        const foodItems = ['Viande cuite', 'Poisson cuit', 'Oeuf cuit', 'Barre Énergétique', 'Banane', 'Sucre', 'Sel'];
        for (const food of foodItems) {
            if (player.inventory[food] > 0 && player.hunger < player.maxHunger) {
                canEat = true;
                break;
            }
        }
        DOM.consumeHungerBtn.disabled = isPlayerBusy || !canEat;
        DOM.consumeHungerBtn.style.visibility = !canEat ? 'hidden' : 'visible';

    }

    if (DOM.quickChatButton) DOM.quickChatButton.disabled = isPlayerBusy;

    if (DOM.actionsEl) {
        DOM.actionsEl.querySelectorAll('button').forEach(b => {
            if (isPlayerBusy && !b.classList.contains('action-always-enabled')) {
                b.disabled = true;
            }
        });
    }
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
                li.className = 'inventory-item clickable';
                li.dataset.itemKey = itemName; // La clé unique de l'inventaire
                li.dataset.itemName = itemName; // Le nom de base pour la définition de l'objet
                li.dataset.itemCount = groundItems[itemName];
                li.setAttribute('draggable', 'true');
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
        { type: 'head', label: 'Tête' }, { type: 'weapon', label: 'Arme/Outil' },
        { type: 'shield', label: 'Bouclier' }, { type: 'body', label: 'Habits' },
        { type: 'feet', label: 'Chaussures' },
        { type: 'bag', label: 'Sac' }
    ];

    slotTypesAndLabels.forEach(slotInfo => {
        const slotContainer = document.createElement('div');
        slotContainer.className = 'equipment-slot-container-small droppable';
        const label = document.createElement('label');
        label.textContent = slotInfo.label;
        slotContainer.appendChild(label);

        const slotEl = document.createElement('div');
        slotEl.className = 'equipment-slot-small droppable';
        slotEl.dataset.slotType = slotInfo.type;
        slotEl.dataset.owner = 'equipment';

        const equippedItem = player.equipment[slotInfo.type];
        if (equippedItem) {
            const itemName = equippedItem.name || Object.keys(ITEM_TYPES).find(key => ITEM_TYPES[key] === equippedItem);
            const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            itemDiv.setAttribute('draggable', 'true');
            itemDiv.dataset.itemName = itemName;
            itemDiv.dataset.owner = 'equipment';
            itemDiv.dataset.slotType = slotInfo.type;

            const iconEl = document.createElement('span');
            iconEl.className = 'inventory-icon';
            iconEl.textContent = itemDef.icon;
            itemDiv.appendChild(iconEl);

            if (equippedItem.hasOwnProperty('currentDurability') && equippedItem.hasOwnProperty('durability')) {
                const durabilityEl = document.createElement('span');
                durabilityEl.className = 'item-durability-overlay';
                durabilityEl.textContent = `${equippedItem.currentDurability}/${equippedItem.durability}`;
                itemDiv.appendChild(durabilityEl);
            }
            slotEl.appendChild(itemDiv);
        }
        slotContainer.appendChild(slotEl);
        slotsContainer.appendChild(slotContainer);
    });
}