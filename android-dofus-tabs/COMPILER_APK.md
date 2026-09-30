# 🤖 Instructions de compilation — « Onglets DT » → APK

> **Destinataire : un agent IA chargé de compiler ce projet en APK installable.**
> Suivez ces étapes à la lettre. Le projet est standard, sans dépendances externes
> (framework Android + Kotlin stdlib uniquement) : aucune résolution de dépendances
> tierces n'est nécessaire, seuls les SDK outils Android sont à télécharger.

## 0. Contexte

- Projet Gradle Kotlin DSL, module unique `:app`, **`android-dofus-tabs/`** = racine du projet.
- `applicationId` : `fr.gabetv.dofustabs` — `minSdk 26`, `targetSdk 34`, `compileSdk 34`.
- Plugins déclarés (dans les `build.gradle.kts`) : **AGP 8.7.3** + **Kotlin Android 2.0.21**.
- ⚠️ **Le wrapper Gradle (`gradlew` + `gradle-wrapper.jar`) N'EST PAS inclus** : il faut le générer (étape 3).

## 1. Prérequis à installer

| Outil | Version requise | Remarque |
|---|---|---|
| JDK | **17** (obligatoire pour AGP 8) | ex. `apt install openjdk-17-jdk` |
| Android SDK command line tools | latest | <https://developer.android.com/studio#command-tools> |
| Gradle | **8.9** (minimum 8.9 pour AGP 8.7, max 8.x) | binaire `gradle` sur le PATH, ou Android Studio |

Réseau nécessaire : `dl.google.com`, `services.gradle.org`, `repo.maven.apache.org`, `plugins.gradle.org`
(une seule fois, pour télécharger SDK + Gradle + AGP/KGP).

## 2. Installer les composants SDK

```bash
export ANDROID_HOME=/chemin/vers/android-sdk   # dossier SDK
sdkmanager --sdk_root="$ANDROID_HOME" --licenses   # répondre « y » à tout
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

Créer à la racine du projet un fichier **`local.properties`** :

```properties
sdk.dir=/chemin/vers/android-sdk
```

## 3. Générer le wrapper Gradle

Dans la racine du projet (`android-dofus-tabs/`) :

```bash
gradle wrapper --gradle-version 8.9 --distribution-type bin
```

Cela produit `gradlew`, `gradlew.bat` et `gradle/wrapper/gradle-wrapper.jar`.
(`/gradle/wrapper/gradle-wrapper.properties` doit pointer sur
`https\://services.gradle.org/distributions/gradle-8.9-bin.zip`.)

> Alternative sans Gradle installé : ouvrir le dossier dans **Android Studio** (Hedgehog+),
> qui détecte l'absence de wrapper et initialise le projet avec sa distribution interne.

## 4. Compiler l'APK

```bash
./gradlew :app:assembleDebug
```

**Sortie : `app/build/outputs/apk/debug/app-debug.apk`**

Cet APK est **automatiquement signé avec la clé de débogage** : il s'installe
directement sur un téléphone (autoriser « sources inconnues » / activer le
débogage USB / accepter *Installer via USB* sur MIUI).

- Build release (non signée) si besoin : `./gradlew :app:assembleRelease`
  (`app-release-unsigned.apk` — à signer avec `keytool` + `apksigner` pour l'installer).

## 5. Vérification rapide

```bash
aapt dump badging app/build/outputs/apk/debug/app-debug.apk | head -5
# Attendu : package: name='fr.gabetv.dofustabs' ... uses-permission SYSTEM_ALERT_WINDOW etc.
```

## 6. Pièges connus (ne pas se faire avoir)

- ❌ Ne pas ajouter `androidx.*` ou d'autres dépendances : le projet n'en utilise aucune.
- ❌ Ne pas changer les versions AGP/Kotlin/sans raison : la matrice validée est AGP 8.7.3 / Kotlin 2.0.21 / Gradle 8.9 / JDK 17.
- Le `kotlin.jvmToolchain(17)` est déclaré : avec un JDK 17 par défaut, rien d'autre à configurer.
- Les ressources sont 100 % XML/vectorielles ; aucune étape d'assets n'est requise.
- Premier build : Gradle télécharge AGP/KGP (~150 Mo) — normal.

## 7. Rappeler à l'utilisateur final

Après installation sur son Xiaomi : ouvrir l'app et suivre les étapes intégrées
(autoriser l'affichage par-dessus les applications, activer le service
d'accessibilité « Onglets DT », et dans MIUI : démarrage automatique +
fenêtres contextuelles). Détails dans `README.md`.
