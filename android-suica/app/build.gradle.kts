plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.smartkeiri.suica"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.smartkeiri.suica"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // SITE_URL は gradle.properties（設定）で管理する。build ロジックには
        // URL をハードコードしない。ローカル検証時は -PSITE_URL=http://10.0.2.2:3000 で上書き。
        val siteUrl = (project.findProperty("SITE_URL") as String?)?.trim().orEmpty()
        require(siteUrl.isNotEmpty()) {
            "SITE_URL が未設定です。gradle.properties に SITE_URL を設定するか -PSITE_URL=... を指定してください。"
        }
        buildConfigField("String", "SITE_URL", "\"$siteUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.browser:browser:1.8.0")
    testImplementation("junit:junit:4.13.2")
}
