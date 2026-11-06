package app.phumreader.media.domain;

public enum UploadStatus {
    /** The presigned URL was handed out; the original may not be uploaded yet. */
    PENDING,
    /** Checked and processed: the variants are in storage. */
    READY,
    /** Failed a check; the reason is stored. */
    REJECTED
}
