package app.phumreader.media.service;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.BucketAlreadyOwnedByYouException;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/** The S3 API: MinIO on development machines, Cloudflare R2 in staging and production. */
public class S3ObjectStore implements ObjectStore {

    private final S3Client client;
    private final S3Presigner presigner;
    private final String bucket;
    private final String publicBaseUrl;

    public S3ObjectStore(
            String endpoint,
            String region,
            String bucket,
            String accessKey,
            String secretKey,
            String publicBaseUrl) {
        StaticCredentialsProvider credentials =
                StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
        // Path-style addresses (endpoint/bucket/key) work on MinIO and R2 alike.
        S3Configuration pathStyle = S3Configuration.builder().pathStyleAccessEnabled(true).build();
        this.client =
                S3Client.builder()
                        .endpointOverride(URI.create(endpoint))
                        .region(Region.of(region))
                        .credentialsProvider(credentials)
                        .serviceConfiguration(pathStyle)
                        .build();
        this.presigner =
                S3Presigner.builder()
                        .endpointOverride(URI.create(endpoint))
                        .region(Region.of(region))
                        .credentialsProvider(credentials)
                        .serviceConfiguration(pathStyle)
                        .build();
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    /** Development: makes the bucket when it is missing and lets anyone read its images. */
    public void createBucketForDevelopment() {
        try {
            client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
        } catch (BucketAlreadyOwnedByYouException exists) {
            // Fine: made by an earlier run.
        }
        String policy =
                """
                {"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},\
                "Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}\
                """
                        .formatted(bucket);
        client.putBucketPolicy(b -> b.bucket(bucket).policy(policy));
    }

    @Override
    public PresignedPut presignPut(String key, String contentType, long size, Duration ttl) {
        PutObjectRequest put =
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .contentLength(size)
                        .build();
        var signed =
                presigner.presignPutObject(
                        PutObjectPresignRequest.builder()
                                .signatureDuration(ttl)
                                .putObjectRequest(put)
                                .build());
        return new PresignedPut(signed.url().toString(), Map.of("Content-Type", contentType));
    }

    @Override
    public Optional<Long> size(String key) {
        try {
            return Optional.of(
                    client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build())
                            .contentLength());
        } catch (NoSuchKeyException missing) {
            return Optional.empty();
        }
    }

    @Override
    public byte[] get(String key) {
        return client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build())
                .asByteArray();
    }

    @Override
    public void put(String key, byte[] data, String contentType) {
        client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        // Variants never change under the same key.
                        .cacheControl("public, max-age=31536000, immutable")
                        .build(),
                RequestBody.fromBytes(data));
    }

    @Override
    public void delete(String key) {
        client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    @Override
    public String publicUrl(String key) {
        return publicBaseUrl + "/" + key;
    }
}
