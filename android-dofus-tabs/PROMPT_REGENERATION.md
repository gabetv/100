# 🧠 PROMPT À DONNER À UNE IA — Régénérer l'application « Onglets DT »

> Copie tout le texte sous la ligne ci-dessous et colle-le à l'IA de ton choix.

---

## Rôle et mission

Tu es un développeur Android senior expert Kotlin. Génère **l'intégralité** d'un projet **Android Studio** fonctionnel, nommé **« Onglets DT »** (package `fr.gabetv.dofustabs`). C'est une application pour **Xiaomi (MIUI / HyperOS)** destinée aux joueurs de **Dofus Touch** qui pratiquent le **multicompte** : une **barre d'onglets flottante** s'affiche par-dessus le jeu et permet de **basculer instantanément d'une instance du jeu à une autre**, plus un **mode diffusion** qui **propage un clic simultanément sur toutes les fenêtres du jeu visibles** (déplacements groupés en multibox).

Produis tous les fichiers du projet (code + ressources + Gradle), chacun dans un bloc de code séparé précédé de son chemin exact. Aucun placeholder : le code doit être complet et compilable tel quel.

## Contexte produit (important — rester honnête)

- Android interdit à une app ordinaire d'afficher l'écran d'une autre app : l'app ne « fusionne » pas littéralement les fenêtres, elle permet la **bascule rapide** (comme Alt+Tab) et la **diffusion de taps** sur les fenêtres visibles. L'UI et le README doivent l'expliquer clairement et orienter l'utilisateur vers les fonctions natives Xiaomi (fenêtre flottante, écran partagé) pour voir plusieurs comptes à la fois.
- Chaque instance du jeu (installation principale, **application jumelle MIUI**, **second espace**) apparaît dans l'écran *Applications récentes* comme une carte distincte nommée « Dofus Touch ». Package du jeu : **`com.ankama.dofustouch`**.
- App non officielle, sans lien avec Ankama ; ajouter une mention légale et un rappel de respecter les règles des serveurs (multicompte interdit sur serveur mono-compte).

## Contraintes techniques STRICTES

1. **Langage : 100 % Kotlin.** Aucune bibliothèque externe, **aucun androidx** — uniquement le framework Android + Kotlin stdlib. `dependencies {}` doit rester vide.
2. **Gradle Kotlin DSL** : `com.android.application` version **8.7.3**, `kotlin("android")` version **2.0.21**, `compileSdk 34`, `minSdk 26`, `targetSdk 34`, `jvmToolchain(17)`, `viewBinding = true`, `android.useAndroidX=false` dans `gradle.properties`. Ne pas inclure le wrapper Gradle (pas de `gradlew`/jar).
3. **Aucun asset binaire** : icônes, boutons et fonds exclusivement en **XML vectoriel / shapes** (icône adaptive anydpi-v26 autorisée).
4. **UI 100 % en français** (strings.xml français avec apostrophes typographiques ’), thème `android:Theme.Material.Light.NoActionBar` (framework, pas d'AppCompat).
5. Namespace/applicationId : `fr.gabetv.dofustabs`. Structure : `MainActivity`, `overlay/OverlayService`, `access/DofusAccessService`, `boot/BootReceiver`, `prefs/Prefs`, `miui/Miui`.

## Fonctionnalité 1 — Écran de configuration (MainActivity)

Interface claire en **3 étapes guidées** :

1. **Autorisations** avec pastille verte « ✓ Accordée » / rouge « ✗ À accorder » actualisées au retour sur l'écran, et bouton ouvrant le bon réglage :
   - « Affichage par-dessus les autres applications » → `Settings.ACTION_MANAGE_OVERLAY_PERMISSION` (vérification `Settings.canDrawOverlays`)
   - « Service d'accessibilité » → `ACTION_ACCESSIBILITY_SETTINGS` (vérification en parsant `Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES` par package)
   - « Notifications » → `requestPermissions(POST_NOTIFICATIONS)` si API ≥ 33
2. **Réglages Xiaomi** : deux boutons ouvrant les écrans MIUI (avec `try/catch` sur plusieurs intents connus, repli vers `ACTION_APPLICATION_DETAILS_SETTINGS`) :
   - Démarrage automatique : `com.miui.securitycenter/.permcenter.autostart.AutoStartManagementActivity` puis action `miui.intent.action.OP_AUTO_START`
   - Fenêtres contextuelles : action `miui.intent.action.APP_PERM_EDITOR` (extra `extra_pkgname`), component `com.miui.securitycenter/.permcenter.permissions.PermissionsEditorActivity`
   - Détection MIUI via `SystemProperties.get("ro.miui.ui.version.name")` par réflexion (try/catch)
3. **Onglets** : spinner du **nombre d'onglets (2 à 4)** + un éditeur par onglet : **nom** (EditText, max 12 car., sauvegardé à la perte de focus ET dans `onPause`), **mode** (Spinner) et **couleur** (RadioGroup de 4 couleurs #F59E0B/#3B82F6/#8B5CF6/#10B981). Persistance `SharedPreferences`, rafraîchissement en direct de la barre via `startService(action=REFRESH)`.
4. Boutons : **« ▶ Afficher la barre flottante »** (`startForegroundService`, garde si overlay non accordé), **« ■ Masquer la barre »**, **« ⇄ Tester la bascule maintenant »** (appelle le service d'accessibilité s'il est actif, sinon toast + réglages).
5. Sections d'aide intégrées : « Créer tes instances » (Applications jumelles MIUI, Second espace) et « Voir plusieurs comptes en même temps » (fenêtre flottante, écran partagé), + footer légal.

## Fonctionnalité 2 — Barre flottante (OverlayService, Service de premier plan)

- **Foreground service** : canal de notification `IMPORTANCE_MIN`, notification persistante (ouvre MainActivity), `foregroundServiceType="specialUse"` + `<property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" …/>` dans le manifest.
- **Deux états persistés** : barre ou bulle.
- **Barre** : fenêtre `TYPE_APPLICATION_OVERLAY`, `FLAG_NOT_FOCUSABLE`, fond XML arrondi sombre translucide (#EB111318, coins 22dp), contenant : une **poignée ≡**, les **onglets** (TextView pastilles : fond `GradientDrawable` couleur de l'onglet, coins 20dp, texte blanc gras 13sp, hauteur 40dp, créés dynamiquement depuis les préférences), un bouton **📡** (état ON = pastille orange / OFF = contour discret), un bouton **– (replier en bulle)**, un bouton **✕ (fermer + stopSelf)**.
- **Bulle** : cercle 54dp en dégradé orange (#F59E0B→#D97706) avec icône vectorielle de flèches de bascule ; **tap = redéplier**, **drag = déplacer avec aimantation au bord le plus proche**, **appui long = ouvrir les réglages**.
- **Déplacement au doigt** : gestionnaire de touch commun (barre et bulle) avec `ViewConfiguration.scaledTouchSlop`, distinction tap/drag/long-press (long-pressvia `Handler.postDelayed(getLongPressTimeout())`), `wm.updateViewLayout` à chaque mouvement, **position persistée** (sauf pour le pavé, voir plus bas) — le gestionnaire doit accepter son propre `WindowManager.LayoutParams` en paramètre.
- **Clic sur un onglet** selon son mode :
  - `DIRECT_MAIN` : `packageManager.getLaunchIntentForPackage("com.ankama.dofustouch")` + flags `NEW_TASK | REORDER_TO_FRONT` (toujours fiable)
  - `NEXT_INSTANCE` : appelle `DofusAccessService.instance?.switchNext()` (companion `@Volatile`)
  - `RECENT_CARD_2/3/4` : `switchToCard(1/2/3)`
  - Si le service d'accessibilité est inactif → toast + ouverture des réglages.

## Fonctionnalité 3 — Bascule via les Applications récentes (DofusAccessService)

Service d'accessibilité (manifest : `BIND_ACCESSIBILITY_SERVICE`, `exported="true"`, meta-data `@xml/accessibility_service_config` ; config XML : `canRetrieveWindowContent="true"`, **`canPerformGestures="true"`**, `flagRetrieveInteractiveWindows|flagIncludeNotImportantViews`, événements window state/content changed) :

- `switchNext()` / `switchToCard(n)` → **throttle 800 ms**, `performGlobalAction(GLOBAL_ACTION_RECENTS)`, puis après 450 ms :
  - Parcourir `rootInActiveWindow`, collecter les nœuds dont texte/description contient **« dofus »** (insensible à la casse), remonter jusqu'à **8 niveaux** pour trouver l'ancêtre **cliquable** (la carte), **dédoublonner par zone d'écran** (centres à moins de 60 px), **trier par (top, left)**.
  - Mode auto : viser l'index **1** si ≥ 2 cartes (la 1ʳᵉ est l'instance active), sinon 0. Mode carte précise : index borné.
  - `ACTION_CLICK`, puis vérification après 700 ms grâce à un flag positionné dans `onAccessibilityEvent` (TYPE_WINDOW_STATE_CHANGED avec package contenant « ankama »).
  - **Mode auto seulement**, si pas de confirmation : **rouvrir les récents** et essayer la **carte suivante** (rotation, max 4 essais) ; en échec final : `GLOBAL_ACTION_BACK` + toasts d'aide. Mode carte précise : l'absence de changement = l'instance était déjà au premier plan → silence.
- Si aucune carte : 1 re-essai après 350 ms (animation), sinon retour + toast « aucune instance ».

## Fonctionnalité 4 — Mode diffusion (multibox) 📡

- Le bouton 📡 de la barre active un **pavé tactile** : fenêtre overlay séparée (~280×182dp de zone tactile, fond sombre translucide, poignée ≡ propre, bouton ✕, repères en croix centraux, texte d'explication) positionnée sous la barre. État du bouton mis à jour (pastille orange ON), désactivation automatique si la barre est repliée/fermée.
- Tap sur le pavé → coordonnées **relatives** `rx, ry ∈ [0,1]²` → `DofusAccessService.dispatchToVisible(rx, ry)` + feedback haptique + **marqueur blanc** qui s'estompe (View ovale ajoutée au pavé, animée alpha→0, 450 ms, puis retirée).
- `dispatchToVisible` : lire `windows` (fenêtres accessibles), filtrer `TYPE_APPLICATION` et `packageName == "com.ankama.dofustouch"` (max 4, ignorer celles < 100 dp de large/haut), avec `rx/ry` bornés à 2–98 % construire UN SEUL `GestureDescription` contenant **un StrokeDescription par fenêtre** (tap de 50 ms, coordonnées absolues = `bounds + relatif×taille`) → `dispatchGesture(...)`. Toasts : nombre de fenêtres touchées / aucune fenêtre visible / geste refusé (callback `onCancelled`).

## Fonctionnalité 5 — BootReceiver

Sur `BOOT_COMPLETED` (receiver `exported="true"`) : si la barre était activée ET overlay accordé → `startForegroundService` dans un `try/catch` (échec silencieux si MIUI bloque).

## Manifest (permissions)

`SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED` ; bloc `<queries><package android:name="com.ankama.dofustouch"/></queries>` ; les 2 services + receiver + activité LAUNCHER (`exported` explicites partout).

## Livrables attendus

1. Arborescence complète du projet puis **tous les fichiers** : `settings.gradle.kts`, `build.gradle.kts` (racine + `app/`), `gradle.properties`, `AndroidManifest.xml`, `xml/accessibility_service_config.xml`, `values/strings.xml` + `arrays.xml` + `colors.xml` + `styles.xml` + `themes.xml`, layouts (`activity_main.xml`, `overlay_bar.xml`, `overlay_bubble.xml`, `overlay_pad.xml`), drawables vectoriels (fond barre, bulle dégradée, flèches swap, fond de carte, `ic_launcher_foreground`), `mipmap-anydpi-v26/ic_launcher(.xml|_round.xml)`, et les 6 fichiers Kotlin.
2. Un `README.md` en français : objectif, limites honnêtes, création des instances MIUI, **compilation pas-à-pas avec Android Studio** (le wrapper Gradle est généré par Android Studio à l'ouverture ; préciser la matrice AGP 8.7.3 / Kotlin 2.0.21 / Gradle 8.9 / JDK 17), configuration du téléphone, tableau des gestes, dépannage MIUI.
3. **Critères d'acceptation** : le projet compile avec `./gradlew :app:assembleDebug` une fois JDK 17 + SDK Android 34 installés ; aucune dépendance externe résolue ; aucun fichier binaire.

Commence par restituer l'arborescence, puis génère chaque fichier complet, sans abréger.
