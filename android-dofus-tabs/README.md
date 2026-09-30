# Onglets DT 🗂️

**Application Android pour Xiaomi (MIUI / HyperOS) qui ajoute une barre d’onglets flottante au-dessus de Dofus Touch, pour passer instantanément d’un compte à l’autre en jeu.**

Pensée pour les joueurs multicompte : tu touches un onglet → la fenêtre du compte choisi revient au premier plan. Fini les va-et-vient laborieux dans l’écran des applications récentes en plein combat.

---

## ⚠️ À savoir avant tout (honnêteté technique)

Android interdit à une application ordinaire d’**afficher l’écran d’une autre application à l’intérieur d’elle-même**. « Fusionner » littéralement les fenêtres du jeu dans une seule interface n’est donc pas possible sans root. En revanche :

1. **La bascule instantanée entre les fenêtres, elle, est tout à fait possible** — c’est ce que fait cette application (comme un `Alt`+`Tab` spécial Dofus Touch).
2. **Ta Xiaomi peut déjà afficher plusieurs fenêtres de jeu à l’écran en même temps**, grâce aux fonctions natives *Fenêtre flottante* et *Écran partagé* de MIUI/HyperOS. La barre d’onglets fonctionne au-dessus de ces modes : tu obtiens concrètement « deux comptes visibles + un changement de focus en un tap ».

Chaque instance du jeu (installation principale, **application jumelle**, **second espace**) apparaît comme une fenêtre/carte distincte : l’application les fait défiler pour toi.

Comment ça marche : pour l’instance principale, l’onglet la ramène directement au premier plan. Pour les instances dupliquées, un petit **service d’accessibilité** ouvre l’écran *Applications récentes* et touche la bonne carte *Dofus Touch* automatiquement — exactement ce que tu fais à la main, mais en une fraction de seconde et depuis un bouton toujours visible.

---

## ✨ Fonctionnalités

- 🎛️ **Barre flottante** au-dessus du jeu : déplaçable au doigt (poignée `≡`), repliable en **bulle** discrète qui se colle au bord de l’écran, fermeture d’un tap.
- 🗂️ **2 à 4 onglets** configurables : nom du compte (ex. *Iop*, *Eni*), couleur, et comportement :
  - **Instance principale (lancement direct)** — fiable à 100 % ;
  - **Compte suivant (cycle automatique)** — idéal avec 2 instances : à chaque tap, tu passes sur l’autre compte. C’est le mode recommandé pour le duo ;
  - **Carte récente n°2 / 3 / 4** — cible précisément la N-ième instance dans l’écran des récents.
- ♻️ **Redémarrage automatique** de la barre après un reboot du téléphone.
- 🧭 **Assistant intégré** : l’appli vérifie chaque autorisation et t’emmène directement sur le bon écran de réglages, y compris les menus spécifiques à MIUI.
- 🔒 **Aucune donnée collectée**, aucune connexion Internet, aucune publicité. Le code est entièrement lisible dans ce dépôt.

---

## 📱 Ce qu’il te faut

| Élément | Détail |
|---|---|
| Téléphone | Xiaomi / Redmi / POCO sous MIUI 11+ ou HyperOS (Android 8.0 minimum) — fonctionne aussi sur d’autres marques |
| Jeu | Dofus Touch installé + **une installation par compte** (voir ci-dessous) |
| Pour compiler | Un PC avec **Android Studio** (gratuit) — aucun compte Google requis pour compiler |

### Créer tes instances (1 installation = 1 compte)

- **2ᵉ compte — Application jumelle** : Réglages ▸ Applications ▸ **Applications jumelles** ▸ active *Dofus Touch* → une seconde icône (badge jaune) apparaît.
- **3ᵉ compte — Second espace** : Réglages ▸ Fonctionnalités spéciales ▸ **Second espace** ▸ crée l’espace, installes-y Dofus Touch, puis reviens dans l’espace principal.
- Connecte ensuite un compte Ankama différent dans chaque installation.

---

## 🛠️ Compiler et installer (10 minutes, sans coder)

1. **Installe Android Studio** sur ton PC : <https://developer.android.com/studio> (téléchargement gratuit).
2. **Copie ce dossier `android-dofus-tabs`** sur le PC, puis dans Android Studio : *Open* ▸ sélectionne le dossier.
   - À la première ouverture, Android Studio télécharge automatiquement les outils de compilation (Gradle, SDK Android 34) et **génère le « wrapper » Gradle** tout seul — accepte simplement ce qu’il propose.
3. **Sur le téléphone**, active le débogage :
   - Réglages ▸ À propos du téléphone ▸ tape 7 fois sur *Version MIUI* (ou *Version du système*) → *Options pour les développeurs* débloquées.
   - Réglages ▸ Paramètres supplémentaires ▸ Options pour les développeurs ▸ active **Débogage USB** (et *Installer via USB* si proposé — HyperOS peut demander une carte SIM).
4. Branche le téléphone, accepte la question sur l’écran du téléphone, puis clique **▶ Run** dans Android Studio → l’application s’installe directement.
   - *(Alternative sans câble :* menu **Build ▸ Build APK(s)**, puis envoie le fichier `app-release.apk` / `app-debug.apk` sur le téléphone et ouvre-le pour l’installer*).

---

## 🚀 Configuration (2 minutes, guidée par l’appli)

Ou **Onglets DT** et suis les étapes affichées :

**Étape 1 — Autorisations Android**
- *Affichage par-dessus les autres applications* → indispensable pour la barre.
- *Service d’accessibilité « Onglets DT »* → indispensable pour la bascule automatique (dans l’écran qui s’ouvre : *Services installés ▸ Onglets DT ▸ Activer*).
- *Notifications* → simple confort (statut discret).

**Étape 2 — Réglages Xiaomi** *(fortement recommandé, sinon MIUI tue la barre)*
- Bouton 1 : **Démarrage automatique** → active *Onglets DT* dans la liste.
- Bouton 2 : **Afficher les fenêtres contextuelles en arrière-plan** → autorise.
- Astuce en plus : Réglages ▸ Batterie ▸ sélectionne *Onglets DT* ▸ **Aucune restriction**.

**Étape 3 — Tes onglets**
- Choisis le nombre d’onglets, renomme-les (noms de tes persos), choisis couleur et mode.
- Bouton **▶ Afficher la barre flottante** → la barre apparaît. Ouvre Dofus Touch : elle reste par-dessus.

---

## 🎮 Utilisation en jeu

| Geste | Effet |
|---|---|
| Tap sur un **onglet** | Bascule vers l’instance configurée |
| Tap sur **Compte suivant** (mode cycle) | Passe à l’autre compte instantanément — le mode stars du multicompte |
| Maintien sur la **poignée ≡** | Déplace la barre où tu veux |
| Tap sur **–** | Replie la barre en bulle orange |
| Tap sur la **bulle** | Redéplie la barre |
| Maintien sur la **bulle** | Ouvre les réglages |
| Tap sur **✕** | Ferme la barre (rallumable depuis l’appli) |

### Voir deux comptes à l’écran en même temps (« fusion » native) 🔥

1. Lance les **deux instances** de Dofus Touch.
2. Ouvre *Applications récentes* → **maintiens la carte** de l’une → icône **fenêtre flottante** : le jeu passe dans une mini-fenêtre redimensionnable au-dessus de l’autre instance.
3. (Ou icône **écran partagé** : une instance en haut, l’autre en bas.)
4. La **barre d’onglets reste au-dessus de tout ça** : tu choisis en un tap quelle fenêtre a le focus, et tu passes d’un mode à l’autre à volonté.

---

## 🧰 Dépannage

| Problème | Solution |
|---|---|
| La barre disparaît au bout d’un moment | Autorise *Démarrage automatique* (Étape 2) + batterie *Aucune restriction* |
| L’onglet « cycle » n’arrive pas à sélectionner | Sur certaines versions de MIUI la sélection automatique des cartes échoue : l’écran des récents reste ouvert, touche simplement la fenêtre voulue. Sélectionne aussi *Carte récente n°2* plutôt que le cycle, ou inversement |
| Le service d’accessibilité s’est désactivé | MIUI le coupe parfois après mise à jour : ouvre *Onglets DT* ▸ Étape 1 ▸ réactive-le |
| « Accorde d’abord l’autorisation d’affichage » | Fais aussi l’Étape 2 ▸ bouton 2 (fenêtres contextuelles), MIUI a deux réglages distincts |
| L’instance du Second espace ne répond pas | La barre ne voit que l’espace où elle tourne. Utilise les modes *cycle* / *carte n°2* depuis l’espace principal : le second espace y apparaît comme une carte séparée |
| L’appli ne voit pas Dofus Touch | Vérifie que le jeu vient du Play Store (package `com.ankama.dofustouch`). Les APK re-signés avec un autre package ne sont pas reconnus |

---

## 🗞️ Notes

- **Projet sans aucune dépendance externe** : 100 % Kotlin + framework Android. Compilation sûre et rapide.
- `minSdk 26` (Android 8.0) · `targetSdk 34` · AGP 8.7 + Kotlin 2.0.
- *Application non officielle, sans lien avec Ankama.* Dofus Touch est une marque d’Ankama. Respecte les règles de ton serveur : le multicompte est autorisé sur la plupart des serveurs mais **interdit sur les serveurs mono-compte**.
