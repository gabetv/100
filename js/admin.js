// js/admin.js
import { ITEM_TYPES } from './config.js';
import * as State from './state.js';
import * as UI from './ui.js'; // Pour addChatMessage

let adminModalEl = null;
let adminTriggerEl = null;
let clickCount = 0;
let clickTimer = null;
const REQUIRED_CLICKS = 5; // Nombre de clics pour activer

function showAdminModal() {
    if (adminModalEl) adminModalEl.classList.remove('hidden');
}

function hideAdminModal() {
    if (adminModalEl) adminModalEl.classList.add('hidden');
}

function handleGiveAllResources() {
    const player = State.state.player;
    if (!player) {
        console.warn("Admin: Player not found.");
        UI.addChatMessage("Erreur Admin: Joueur non trouvé.", "system_error");
        return;
    }

    // Augmenter la capacité de l'inventaire pour tout contenir
    player.maxInventory = 50000; // Capacité très élevée
    UI.addChatMessage(`Admin: Capacité d'inventaire augmentée à ${player.maxInventory}.`, "system_event");

    let itemsGivenCount = 0;
    const itemsGivenDetails = {}; // Pour le log console et le message UI

    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        let quantity = 0;

        // Déterminer la quantité à donner en fonction du type d'objet
        if (itemDef.type === 'resource') {
            quantity = 500; // Grande quantité pour les ressources
        } else if (itemDef.type === 'consumable') {
            if (itemDef.uses || itemDef.hasOwnProperty('durability')) {
                quantity = 10; // Plusieurs exemplaires pour les consommables à usages/durabilité
            } else if (itemDef.teachesRecipe) {
                 // Donner 1 parchemin uniquement si la recette n'est pas encore connue
                if (!State.state.knownRecipes[itemDef.teachesRecipe]) {
                    quantity = 1;
                } else {
                    quantity = 0; // Ne pas redonner si déjà connu
                }
            }
            else {
                quantity = 20; // Bonne quantité pour les consommables simples
            }
        } else if (itemDef.type === 'key' || itemDef.unique) {
            quantity = 1; // Un seul exemplaire pour les clés et objets uniques (sauf parchemins gérés au-dessus)
        } else if (itemDef.type === 'tool' || itemDef.type === 'weapon' || itemDef.type === 'shield' || itemDef.slot ) {
            // Donner quelques outils/armes/équipements de base pour tester
            // Vous pouvez affiner cette liste
            const basicGear = ['Hache', 'Pelle en bois', 'Scie', 'Gourdain', 'Épée en bois', 'Bouclier en bois', 'Vêtements', 'Petit Sac'];
            if (basicGear.includes(itemName)) {
                quantity = 1;
            } else if (itemDef.isFireStarter) { // Donne plusieurs allume-feu
                 quantity = 3;
            }
            else {
                quantity = 0; // Ne pas donner les autres équipements en masse par défaut
            }
        } else if (itemDef.type === 'component') {
            quantity = 10; // Pour les composants comme 'Porte en bois'
        }


        if (quantity > 0) {
            // Cas spécial pour les parchemins : marquer la recette comme apprise
            if (itemDef.teachesRecipe) {
                State.state.knownRecipes[itemDef.teachesRecipe] = true;
                if(itemDef.unique) State.state.foundUniqueParchemins.add(itemName);
                console.log(`Admin: Recette ${itemDef.teachesRecipe} marquée comme apprise.`);
            }

            State.addResource(State.state.player.inventory, itemName, quantity);
            itemsGivenCount++;
            itemsGivenDetails[itemName] = (itemsGivenDetails[itemName] || 0) + quantity;
        }
    }

    // Assurer que tous les parchemins sont donnés et recettes apprises s'ils ne l'étaient pas
    // (redondant si la logique ci-dessus est correcte, mais pour être sûr)
    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.teachesRecipe && !State.state.knownRecipes[itemDef.teachesRecipe]) {
            if (!itemsGivenDetails[itemName]) { // Si pas déjà donné dans la boucle précédente
                 State.addResource(State.state.player.inventory, itemName, 1);
                 itemsGivenCount++;
                 itemsGivenDetails[itemName] = (itemsGivenDetails[itemName] || 0) + 1;
            }
            State.state.knownRecipes[itemDef.teachesRecipe] = true;
            if(itemDef.unique) State.state.foundUniqueParchemins.add(itemName);
            console.log(`Admin (vérif): Recette ${itemDef.teachesRecipe} marquée comme apprise.`);
        }
    }


    if (itemsGivenCount > 0) {
        UI.addChatMessage(`Admin: ${itemsGivenCount} types d'objets (total ${Object.values(itemsGivenDetails).reduce((a,b)=>a+b,0)} unités) ajoutés à l'inventaire. Toutes les recettes ont été apprises.`, "system_event");
        console.log("Admin: Items donnés et quantités:", itemsGivenDetails);
    } else {
        UI.addChatMessage("Admin: Aucun objet pertinent à ajouter (ou déjà tous connus/ajoutés).", "system");
    }

    if (window.fullUIUpdate) {
        window.fullUIUpdate(); // Mettre à jour toute l'interface
    }
    hideAdminModal();
}

function adminTriggerClickHandler() {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);

    if (clickCount >= REQUIRED_CLICKS) {
        clickCount = 0;
        showAdminModal();
    } else {
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 700);
    }
}

export function initAdminControls() {
    console.log("admin.js: initAdminControls() a été appelée.");
    adminModalEl = document.getElementById('admin-modal');
    const giveAllBtn = document.getElementById('admin-give-all-resources-btn');
    const closeAdminBtn = document.getElementById('admin-close-modal-btn');

    if (!adminModalEl || !giveAllBtn || !closeAdminBtn) {
        console.error("Admin: Modal elements not found in DOM. (#admin-modal, #admin-give-all-resources-btn, #admin-close-modal-btn)");
        return;
    }
    console.log("Admin: Modal elements trouvés.");

    giveAllBtn.addEventListener('click', handleGiveAllResources);
    closeAdminBtn.addEventListener('click', hideAdminModal);

    adminTriggerEl = document.createElement('div');
    adminTriggerEl.id = 'admin-trigger-dot';
    adminTriggerEl.style.cssText = `
        position: fixed;
        bottom: 3px;
        left: 3px;
        width: 8px;
        height: 8px;
        background-color: rgba(128,0,0,0.4);
        z-index: 10000;
        cursor: pointer;
        border-radius: 50%;
        opacity: 0.3;
        transition: opacity 0.3s, background-color 0.3s;
    `;
    adminTriggerEl.title = `Admin Panel (${REQUIRED_CLICKS} clicks)`;
    adminTriggerEl.addEventListener('mouseenter', () => {
        adminTriggerEl.style.opacity = '0.8';
        adminTriggerEl.style.backgroundColor = 'rgba(255,0,0,0.6)';
    });
    adminTriggerEl.addEventListener('mouseleave', () => {
        adminTriggerEl.style.opacity = '0.3';
        adminTriggerEl.style.backgroundColor = 'rgba(128,0,0,0.4)';
    });

    document.body.appendChild(adminTriggerEl);
    console.log("Admin: Trigger dot ajouté au body.");
    adminTriggerEl.addEventListener('click', adminTriggerClickHandler);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            if (adminModalEl.classList.contains('hidden')) {
                showAdminModal();
            } else {
                hideAdminModal();
            }
        } else if (e.key === 'Escape' && adminModalEl && !adminModalEl.classList.contains('hidden')) {
            hideAdminModal();
        }
    });

    console.log(`Admin controls initialized. Click the bottom-left dot ${REQUIRED_CLICKS} times, or press Ctrl+Alt+M.`);
}
