package app.phumreader.common.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public health check, reachable from the website at {@code /api/v1/health}. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "health")
class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);
    private static final int DATABASE_TIMEOUT_SECONDS = 2;

    private final DataSource dataSource;

    HealthController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/health")
    @Operation(
            summary = "Is the API running and can it reach the database?",
            description = "200 when everything is UP, 503 when the database is DOWN.")
    ResponseEntity<HealthResponse> health() {
        Status database = databaseStatus();
        HttpStatus httpStatus =
                database == Status.UP ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
        return ResponseEntity.status(httpStatus).body(new HealthResponse(database, database));
    }

    private Status databaseStatus() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(DATABASE_TIMEOUT_SECONDS) ? Status.UP : Status.DOWN;
        } catch (SQLException ex) {
            log.warn("Database health check failed: {}", ex.getMessage());
            return Status.DOWN;
        }
    }

    enum Status {
        UP,
        DOWN
    }

    /**
     * @param status overall status
     * @param database database status
     */
    record HealthResponse(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Status status,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Status database) {}
}
