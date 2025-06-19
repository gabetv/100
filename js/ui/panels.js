// js/ui/panels.js
import { ITEM_TYPES } from '../config.js';
import { getTotalResources } from '../player.js';
import DOM from './dom.js';

function drawSquaresBar(container, value, maxValue) {
    if (!container) return;
    container.innerHTML = '';
    const numSquares = 10; // Nombre de carrés dans la barre
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
    const { quickSlotWeapon, quickSlotArmor, quickSlotBag, quickSlotFeet } = DOM; 
    const slots = {
        weapon: quickSlotWeapon,
        body: quickSlotArmor, // Assuming 'body' is for armor slot as per previous definition
        bag: quickSlotBag,
        feet: quickSlotFeet,
        // head: quickSlotHead, // If you add a quick slot for head
    };

    for (const slotType in slots) {
        const slotEl = slots[slotType];
        if (!slotEl) continue; 

        const equippedItem = player.equipment[slotType];
        const placeholder = slotEl.querySelector('.slot-placeholder-text');
        
        const iconSpan = slotEl.querySelector('span:not(.slot-placeholder-text)');
        if (iconSpan) iconSpan.remove();
        
        slotEl.classList.toggle('has-item', !!equippedItem);

        if (equippedItem) {
            if (placeholder) placeholder.style.display = 'none';
            // Utiliser directement les infos de l'objet équipé, qui devraient inclure l'icône
            const icon = equippedItem.icon || ITEM_TYPES[equippedItem.name]?.icon || '❓';
            const iconEl = document.createElement('span');
            iconEl.textContent = icon;
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

    const categories = { 
        consumable: [], 
        tool: [], 
        weapon: [], 
        armor: [], 
        body: [], // Pour Vêtements etc. non-armure
        head: [], // Pour Chapeaux etc.
        feet: [], 
        bag: [], 
        resource: [], 
        usable: [],
        key: [], // NOUVELLE CATÉGORIE
    };
    
    for (const itemName in player.inventory) {
        if (player.inventory[itemName] > 0) {
            const itemDef = ITEM_TYPES[itemName] || { type: 'resource', icon: '❓' };
            let type = itemDef.type; 

            // Logique de classification améliorée
            if (itemDef.slot) { // Si l'objet a un slot d'équipement défini
                if (categories[itemDef.slot]) { // Si le slot correspond à une catégorie (weapon, body, head, feet, bag)
                    type = itemDef.slot;
                } else if (itemDef.type === 'armor' && itemDef.slot === 'body') { // Cas spécifique armure corporelle
                    type = 'armor';
                }
                // Les outils peuvent aussi avoir un slot 'weapon', mais on veut les garder dans 'tool' si leur type est 'tool'
                // Sauf si c'est explicitement une arme.
                if (itemDef.type === 'tool' && categories.tool) {
                    type = 'tool';
                }
            }


            if (categories[type]) { 
                categories[type].push(itemName);
            } else if (categories.resource) { 
                console.warn(`Type d'item '${type}' pour '${itemName}' n'a pas de catégorie dédiée, classé comme ressource.`);
                categories.resource.push(itemName);
            } else {
                console.error(`Catégorie de ressource par défaut manquante et type inconnu pour l'item ${itemName}`);
            }
        }
    }

    const categoryOrder = [
        { key: 'consumable', name: 'Consommables' }, 
        { key: 'tool', name: 'Outils' },
        { key: 'weapon', name: 'Armes' }, 
        { key: 'armor', name: 'Armures' },  
        { key: 'body', name: 'Habits' },    
        { key: 'head', name: 'Chapeaux' },    
        { key: 'feet', name: 'Chaussures' }, 
        { key: 'bag', name: 'Sacs' },       
        { key: 'resource', name: 'Ressources' }, 
        { key: 'usable', name: 'Objets Spéciaux' },
        { key: 'key', name: 'Clés & Uniques' }, // NOUVELLE LIGNE
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
            // Ouvrir par défaut certaines catégories
            if (['resource', 'consumable', 'tool', 'key'].includes(cat.key)) header.classList.add('open');


            header.innerHTML = `<span>${cat.name}</span><span class="category-toggle">▶</span>`;
            const content = document.createElement('ul');
            content.className = 'category-content';
            if (header.classList.contains('open')) content.classList.add('visible');

            itemsInCategory.sort().forEach(itemName => {
                const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
                const li = document.createElement('li');
                li.className = 'inventory-item';
                // Rendre cliquable les consommables et les parchemins
                if (itemDef.type === 'consumable' || itemName.startsWith('Parchemin Atelier')) {
                    li.classList.add('clickable');
                }
                li.dataset.itemName = itemName;
                li.setAttribute('draggable', 'true'); 
                li.dataset.itemCount = player.inventory[itemName]; 
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
    if (!tile || !DOM.tileNameEl || !DOM.tileDescriptionEl || !DOM.tileHarvestsInfoEl) return;

    // Si la tuile a des bâtiments, afficher le nom du premier bâtiment prioritaire, sinon le terrain.
    let mainDisplayName = tile.type.name; // Terrain de base
    let mainDisplayDescription = "";
    let mainHarvestsInfo = "";
    let mainDurabilityInfo = "";

    if (tile.buildings && tile.buildings.length > 0) {
        // Priorité d'affichage (ex: un Atelier est plus "actif" qu'un simple mur)
        // Pour l'instant, on prend le premier de la liste s'il y en a.
        const mainBuildingInstance = tile.buildings[0]; 
        const mainBuildingDef = TILE_TYPES[mainBuildingInstance.key];
        if (mainBuildingDef) {
            mainDisplayName = mainBuildingDef.name;
            // Descriptions spécifiques aux bâtiments pourraient être ajoutées ici
            // mainDisplayDescription = mainBuildingDef.description || "Une structure construite.";
            mainDurabilityInfo = `Durabilité: ${mainBuildingInstance.durability}/${mainBuildingInstance.maxDurability}`;
        }
    }


    DOM.tileNameEl.textContent = mainDisplayName;
    const descriptions = { 
        'Forêt': "L'air est lourd et humide...", 'Plaine': "Une plaine herbeuse...", 
        'Sable Doré': "Le sable chaud vous brûle les pieds...", 'Lagon': "L'eau turquoise vous invite...", 
        'Friche': "Le sol est nu...", 'Gisement de Pierre': "Des rochers affleurent...", 
        'Feu de Camp': "La chaleur des flammes danse...", 
        'Abri Individuel': "Un abri précaire...", 'Abri Collectif': "Un campement bien établi...", 
        'Mine': "L'entrée sombre de la mine...", 'Trésor Caché': "Un coffre mystérieux scellé...",
        'Atelier': "Un établi robuste pour l'artisanat.",
        'Petit Puit': "Un trou peu profond, l'eau y semble trouble.",
        'Puit Profond': "Un puit bien construit, l'eau y est plus claire.",
        'Bibliothèque': "Des étagères remplies de savoirs anciens.",
        'Forteresse': "Une imposante structure défensive.",
        'Laboratoire': "Fioles et alambics bouillonnent doucement.",
        'Forge': "La chaleur du métal en fusion emplit l'air.",
        'Bananeraie': "Des bananiers chargés de fruits.",
        'Sucrerie': "Des cannes à sucre prêtes à être transformées.",
        'Cocoteraie': "Des cocotiers se balancent doucement.",
        'Poulailler': "Des caquètements se font entendre.",
        'Enclos à Cochons': "Grognements et bruits de fouissage.",
        'Observatoire': "Une vue imprenable sur les environs."
    };
    DOM.tileDescriptionEl.textContent = mainDurabilityInfo ? `${mainDurabilityInfo}. ${descriptions[mainDisplayName] || "Un lieu étrange..."}` : descriptions[mainDisplayName] || "Un lieu étrange...";
    
    // Info de récolte pour le terrain de base (si pas de bâtiment prioritaire affiché ou si le bâtiment ne masque pas cette info)
    if (tile.type.resource && tile.harvestsLeft > 0 && tile.type.harvests !== Infinity && tile.buildings.length === 0) { // N'afficher que si pas de bâtiments
        mainHarvestsInfo = `Récoltes (terrain): ${tile.harvestsLeft}`;
    }
    
    if (mainHarvestsInfo) {
        DOM.tileHarvestsInfoEl.textContent = mainHarvestsInfo;
        DOM.tileHarvestsInfoEl.style.display = 'block';
    } else {
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
    content += spanMessage.outerHTML;
    msgDiv.innerHTML = content; 
    chatMessagesEl.appendChild(msgDiv);
    
    if (DOM.bottomBarEl && !DOM.bottomBarEl.classList.contains('chat-enlarged')) {
        while (chatMessagesEl.children.length > 3) {
            chatMessagesEl.removeChild(chatMessagesEl.firstChild);
        }
    }
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight; 
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
        if ((player.inventory['Kit de Secours'] > 0) || 
            (player.inventory['Bandage'] > 0) || 
            (player.inventory['Médicaments'] > 0 && (player.status === 'Malade' || player.status === 'Empoisonné'))) {
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
            (player.inventory['Oeuf cuit'] > 0) || // Ajout oeuf cuit
            (player.inventory['Barre Énergétique'] > 0) || 
            (player.inventory['Banane'] > 0)) {
            canEat = true;
        }
        DOM.consumeHungerBtn.disabled = isPlayerBusy || !canEat;
    }
    
    if (DOM.quickChatButton) DOM.quickChatButton.disabled = isPlayerBusy;

    if (DOM.actionsEl) {
        DOM.actionsEl.querySelectorAll('button').forEach(b => {
            if (isPlayerBusy && !b.classList.contains('action-always-enabled')) { // Permettre certains boutons même si occupé
                b.disabled = true;
            }
        });
    }
}