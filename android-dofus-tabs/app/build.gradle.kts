plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "fr.gabetv.dofustabs"
    compileSdk = 34

    defaultConfig {
        applicationId = "fr.gabetv.dofustabs"
        minSdk = 26                    // Android 8.0+ (Xiaomi Redmi 5 et + récents, MIUI 9 → HyperOS)
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    // Aucun androidx, aucune bibliothèque externe : compilation rapide et fiable.
    buildFeatures {
        viewBinding = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    // Volontairement vide : 100 % framework Android + Kotlin stdlib (inclus automatiquement).
}
