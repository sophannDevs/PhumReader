package app.phumreader.media.service;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Keeps objects in memory: tests, and development without MinIO (nothing survives a restart). */
public class InMemoryObjectStore implements ObjectStore {

    private final Map<String, byte[]> objects = new ConcurrentHashMap<>();

    @Override
    public PresignedPut presignPut(String key, String contentType, long size, Duration ttl) {
        return new PresignedPut("memory://" + key, Map.of("Content-Type", contentType));
    }

    @Override
    public Optional<Long> size(String key) {
        byte[] data = objects.get(key);
        return data == null ? Optional.empty() : Optional.of((long) data.length);
    }

    @Override
    public byte[] get(String key) {
        byte[] data = objects.get(key);
        if (data == null) {
            throw new IllegalStateException("No such object: " + key);
        }
        return data;
    }

    @Override
    public void put(String key, byte[] data, String contentType) {
        objects.put(key, data.clone());
    }

    @Override
    public void delete(String key) {
        objects.remove(key);
    }

    @Override
    public String publicUrl(String key) {
        return "memory://" + key;
    }

    public boolean contains(String key) {
        return objects.containsKey(key);
    }
}
