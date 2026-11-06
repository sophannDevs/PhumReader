package app.phumreader.config;

import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverter;
import io.swagger.v3.core.converter.ModelConverterContext;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.media.Schema;
import java.lang.reflect.RecordComponent;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/**
 * Makes the OpenAPI schemas of our request/response records exact: every record component is
 * required, unless it is annotated {@code @Nullable}, which makes it nullable instead. The
 * website's generated TypeScript types then say {@code name: string} and {@code avatarUrl: string |
 * null}.
 */
class RecordFieldsRequiredConverter implements ModelConverter {

    private static final String OUR_PACKAGE = "app.phumreader";

    @Override
    public Schema<?> resolve(
            AnnotatedType type, ModelConverterContext context, Iterator<ModelConverter> chain) {
        Schema<?> schema = chain.hasNext() ? chain.next().resolve(type, context, chain) : null;
        if (schema == null) {
            return null;
        }
        Class<?> raw = Json.mapper().constructType(type.getType()).getRawClass();
        if (!raw.isRecord() || !raw.getPackageName().startsWith(OUR_PACKAGE)) {
            return schema;
        }
        Schema<?> model = schema;
        if (schema.get$ref() != null) {
            String ref = schema.get$ref();
            model = context.getDefinedModels().get(ref.substring(ref.lastIndexOf('/') + 1));
        }
        if (model == null || model.getProperties() == null) {
            return schema;
        }
        for (RecordComponent component : raw.getRecordComponents()) {
            Schema<?> property = model.getProperties().get(component.getName());
            if (property == null) {
                continue;
            }
            if (component.getAnnotatedType().isAnnotationPresent(Nullable.class)) {
                makeNullable(property);
            } else if (model.getRequired() == null
                    || !model.getRequired().contains(component.getName())) {
                model.addRequiredItem(component.getName());
            }
        }
        return schema;
    }

    private static void makeNullable(Schema<?> property) {
        if (property.getTypes() != null && !property.getTypes().isEmpty()) {
            Set<String> types = new LinkedHashSet<>(property.getTypes());
            types.add("null");
            property.setTypes(types);
        } else if (property.get$ref() == null) {
            property.setNullable(true);
        }
    }
}
