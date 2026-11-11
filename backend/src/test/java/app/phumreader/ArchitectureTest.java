package app.phumreader;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.domain.Dependency;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import jakarta.persistence.Entity;
import org.springframework.web.bind.annotation.RestController;

/**
 * Layering rules (docs/BACKEND.md): inside a feature, {@code web} calls {@code service}, which uses
 * {@code repository} and {@code domain}; features never reach into each other's repositories.
 */
@AnalyzeClasses(packages = "app.phumreader", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String ROOT = "app.phumreader";

    @ArchTest
    static final ArchRule controllersDoNotUseRepositories =
            noClasses()
                    .that()
                    .areAnnotatedWith(RestController.class)
                    .should()
                    .dependOnClassesThat()
                    .resideInAPackage("..repository..")
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule webLayerNeverSeesEntities =
            noClasses()
                    .that()
                    .resideInAPackage("..web..")
                    .should()
                    .dependOnClassesThat()
                    .areAnnotatedWith(Entity.class)
                    .because("controllers return request/response records, never entities")
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule servicesDoNotDependOnTheWebLayer =
            noClasses()
                    .that()
                    .resideInAPackage("..service..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("..web..", "jakarta.servlet..")
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule repositoriesAndDomainDoNotCallUpwards =
            noClasses()
                    .that()
                    .resideInAnyPackage("..repository..", "..domain..")
                    .should()
                    .dependOnClassesThat()
                    .resideInAnyPackage("..service..", "..web..")
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule repositoriesStayInsideTheirFeature =
            classes()
                    .that()
                    .resideInAPackage("..repository..")
                    .should(onlyBeUsedInsideTheirOwnFeature())
                    .allowEmptyShould(true);

    @ArchTest
    static final ArchRule webClassesAreNotUsedByOtherFeaturesServices =
            classes()
                    .that()
                    .resideInAPackage("..web..")
                    .and()
                    .resideOutsideOfPackage(ROOT + ".common..")
                    .should(onlyBeUsedByOwnFeatureOrOtherWebLayers())
                    .because(
                            "other features call a feature through its service and domain; only"
                                    + " another web layer may reuse its response records, and"
                                    + " config wires the security filters")
                    .allowEmptyShould(true);

    private static ArchCondition<JavaClass> onlyBeUsedByOwnFeatureOrOtherWebLayers() {
        return new ArchCondition<>("only be used by their own feature or by other web layers") {
            @Override
            public void check(JavaClass webClass, ConditionEvents events) {
                String feature = featureOf(webClass);
                for (Dependency dependency : webClass.getDirectDependenciesToSelf()) {
                    JavaClass origin = dependency.getOriginClass();
                    String originFeature = featureOf(origin);
                    boolean allowed =
                            feature.equals(originFeature)
                                    || originFeature.equals("config")
                                    || origin.getPackageName().contains(".web");
                    if (!allowed) {
                        events.add(
                                SimpleConditionEvent.violated(
                                        dependency, dependency.getDescription()));
                    }
                }
            }
        };
    }

    private static ArchCondition<JavaClass> onlyBeUsedInsideTheirOwnFeature() {
        return new ArchCondition<>("only be used inside their own feature") {
            @Override
            public void check(JavaClass repository, ConditionEvents events) {
                String feature = featureOf(repository);
                for (Dependency dependency : repository.getDirectDependenciesToSelf()) {
                    if (!feature.equals(featureOf(dependency.getOriginClass()))) {
                        events.add(
                                SimpleConditionEvent.violated(
                                        dependency, dependency.getDescription()));
                    }
                }
            }
        };
    }

    /** {@code app.phumreader.series.repository} → {@code series}. */
    private static String featureOf(JavaClass javaClass) {
        String name = javaClass.getPackageName();
        if (!name.startsWith(ROOT + ".")) {
            return "";
        }
        String rest = name.substring(ROOT.length() + 1);
        int dot = rest.indexOf('.');
        return dot < 0 ? rest : rest.substring(0, dot);
    }
}
