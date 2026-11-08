package app.phumreader.admin.service;

import app.phumreader.admin.repository.AdminQueries;
import app.phumreader.common.web.RequestIdFilter;
import java.time.Clock;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * The audit log (plan P3-18): who did what to what, and when. Every admin action writes one row in
 * the same transaction as the change, so an action without a row cannot happen.
 */
@Service
public class AuditService {

    private final AdminQueries queries;
    private final JsonMapper json;
    private final Clock clock;

    public AuditService(AdminQueries queries, JsonMapper json, Clock clock) {
        this.queries = queries;
        this.json = json;
        this.clock = clock;
    }

    /**
     * @param action {@code <area>.<verb>}, e.g. {@code user.ban}
     * @param details what the admin entered and what changed
     */
    public void record(
            UUID actor,
            String action,
            String targetType,
            @Nullable String targetId,
            Map<String, Object> details) {
        String detailsJson;
        try {
            detailsJson = json.writeValueAsString(details);
        } catch (JacksonException e) {
            throw new IllegalStateException("Audit details cannot be written", e);
        }
        queries.audit(
                actor,
                action,
                targetType,
                targetId,
                detailsJson,
                MDC.get(RequestIdFilter.MDC_KEY),
                clock.instant().atOffset(ZoneOffset.UTC));
    }
}
