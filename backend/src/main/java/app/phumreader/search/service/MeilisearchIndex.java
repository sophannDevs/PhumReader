package app.phumreader.search.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * {@link SearchIndex} on Meilisearch's HTTP API. Writes wait for Meilisearch's task to finish, so
 * what was written can be searched when the call returns.
 */
public class MeilisearchIndex implements SearchIndex {

    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(5);
    private static final Duration TASK_TIMEOUT = Duration.ofSeconds(30);
    private static final int BATCH = 1000;

    private final HttpClient http =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final JsonMapper json = JsonMapper.builder().build();
    private final String base;
    private final String key;
    private final String uid;
    private volatile boolean ready;

    public MeilisearchIndex(String url, String masterKey, String indexUid) {
        this.base = url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
        this.key = masterKey;
        this.uid = indexUid;
    }

    @Override
    public List<UUID> search(String query, int limit) {
        ensureReady();
        JsonNode result =
                call(
                        "POST",
                        "/indexes/" + uid + "/search",
                        Map.of("q", query, "limit", limit, "attributesToRetrieve", List.of("id")));
        return result.get("hits")
                .valueStream()
                .map(h -> UUID.fromString(h.get("id").asString()))
                .toList();
    }

    @Override
    public void upsert(Collection<SearchDoc> docs) {
        ensureReady();
        List<SearchDoc> all = List.copyOf(docs);
        for (int from = 0; from < all.size(); from += BATCH) {
            List<Map<String, Object>> batch =
                    all.subList(from, Math.min(all.size(), from + BATCH)).stream()
                            .map(MeilisearchIndex::document)
                            .toList();
            waitFor(call("POST", "/indexes/" + uid + "/documents?primaryKey=id", batch));
        }
    }

    @Override
    public void delete(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return;
        }
        ensureReady();
        waitFor(
                call(
                        "POST",
                        "/indexes/" + uid + "/documents/delete-batch",
                        ids.stream().map(UUID::toString).toList()));
    }

    @Override
    public void replaceAll(Collection<SearchDoc> docs) {
        upsert(docs);
        Set<String> keep = new HashSet<>();
        docs.forEach(d -> keep.add(d.id().toString()));
        Set<UUID> stale = new HashSet<>();
        int offset = 0;
        while (true) {
            JsonNode page =
                    call(
                            "GET",
                            "/indexes/" + uid + "/documents?fields=id&limit=1000&offset=" + offset,
                            null);
            JsonNode results = page.get("results");
            results.forEach(r -> {
                String id = r.get("id").asString();
                if (!keep.contains(id)) {
                    stale.add(UUID.fromString(id));
                }
            });
            if (results.size() < 1000) {
                break;
            }
            offset += 1000;
        }
        delete(stale);
    }

    @Override
    public long count() {
        ensureReady();
        return call("GET", "/indexes/" + uid + "/stats", null).get("numberOfDocuments").asLong();
    }

    /** Creates the index and sets what is searched and how ties are ranked (once per start). */
    private synchronized void ensureReady() {
        if (ready) {
            return;
        }
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("searchableAttributes", List.of("title", "creator", "genre"));
        settings.put("sortableAttributes", List.of("views"));
        settings.put(
                "rankingRules",
                List.of(
                        "words",
                        "typo",
                        "proximity",
                        "attribute",
                        "sort",
                        "exactness",
                        "views:desc"));
        settings.put("filterableAttributes", List.of("type"));
        waitFor(call("PATCH", "/indexes/" + uid + "/settings", settings));
        ready = true;
    }

    private static Map<String, Object> document(SearchDoc d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.id().toString());
        m.put("title", d.title());
        m.put("creator", d.creator());
        m.put("genre", d.genre());
        m.put("type", d.type());
        m.put("views", d.views());
        return m;
    }

    private void waitFor(JsonNode task) {
        long taskUid = task.get("taskUid").asLong();
        long deadline = System.nanoTime() + TASK_TIMEOUT.toNanos();
        while (System.nanoTime() < deadline) {
            JsonNode t = call("GET", "/tasks/" + taskUid, null);
            String status = t.get("status").asString();
            if (status.equals("succeeded")) {
                return;
            }
            if (status.equals("failed") || status.equals("canceled")) {
                throw new SearchIndexException(
                        "Meilisearch task " + taskUid + " " + status + ": " + t.path("error"));
            }
            try {
                Thread.sleep(25);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new SearchIndexException("Interrupted while waiting for Meilisearch", e);
            }
        }
        throw new SearchIndexException("Meilisearch task " + taskUid + " did not finish in time");
    }

    private JsonNode call(String method, String path, Object body) {
        try {
            HttpRequest.Builder request =
                    HttpRequest.newBuilder(URI.create(base + path))
                            .timeout(REQUEST_TIMEOUT)
                            .header("Authorization", "Bearer " + key)
                            .header("Content-Type", "application/json");
            HttpRequest.BodyPublisher publisher =
                    body == null
                            ? HttpRequest.BodyPublishers.noBody()
                            : HttpRequest.BodyPublishers.ofString(
                                    json.writeValueAsString(body), StandardCharsets.UTF_8);
            HttpResponse<String> response =
                    http.send(
                            request.method(method, publisher).build(),
                            HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new SearchIndexException(
                        "Meilisearch "
                                + method
                                + " "
                                + path
                                + " answered "
                                + response.statusCode());
            }
            return json.readTree(response.body());
        } catch (IOException e) {
            throw new SearchIndexException("Meilisearch " + method + " " + path + " failed", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new SearchIndexException("Interrupted while calling Meilisearch", e);
        }
    }
}
