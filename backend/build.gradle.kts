plugins {
    java
    id("org.springframework.boot") version "4.1.2"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.diffplug.spotless") version "8.11.0"
}

group = "app.phumreader"
version = "0.0.1-SNAPSHOT"
description = "PhumReader API"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencyManagement {
    imports {
        // PostgreSQL 17 binaries for the embedded test database, the same major version as Supabase.
        mavenBom("io.zonky.test.postgres:embedded-postgres-binaries-bom:17.11.0")
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:3.2.0")
    runtimeOnly("org.postgresql:postgresql")
    annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")

    testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
    testImplementation("org.springframework.boot:spring-boot-starter-data-jpa-test")
    testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
    testImplementation("org.springframework.boot:spring-boot-starter-security-test")
    testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    // Embedded PostgreSQL started from real binaries by the tests: no Docker, no network.
    testImplementation("io.zonky.test:embedded-database-spring-test:2.8.0")
    testImplementation("io.zonky.test:embedded-postgres:2.2.2")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.5.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
    options.compilerArgs.addAll(listOf("-parameters", "-Xlint:deprecation"))
}

tasks.withType<Test> {
    useJUnitPlatform()
    systemProperty("openapi.file", layout.projectDirectory.file("openapi/openapi.json").asFile.absolutePath)
}

// Rewrites openapi/openapi.json from the running code. `check` fails while the committed file is out of date.
tasks.register<Test>("exportOpenApi") {
    description = "Writes the OpenAPI contract to openapi/openapi.json."
    group = "documentation"
    testClassesDirs = sourceSets.test.get().output.classesDirs
    classpath = sourceSets.test.get().runtimeClasspath
    filter { includeTestsMatching("app.phumreader.OpenApiContractTest") }
    systemProperty("openapi.write", "true")
    outputs.upToDateWhen { false }
}

spotless {
    lineEndings = com.diffplug.spotless.LineEnding.UNIX
    java {
        googleJavaFormat().aosp()
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
    }
}
