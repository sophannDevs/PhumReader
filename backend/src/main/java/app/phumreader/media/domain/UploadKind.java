package app.phumreader.media.domain;

/**
 * What an image is for, with the smallest size the website shows it at (A19: 800 px width for comic
 * panels and banners).
 */
public enum UploadKind {
    COVER(600, false),
    BANNER(800, false),
    THUMBNAIL(300, true),
    PANEL(800, false),
    /** A profile picture: square, shown at up to 96 px (so 200 px is plenty on any screen). */
    AVATAR(200, true);

    private final int minWidth;
    private final boolean square;

    UploadKind(int minWidth, boolean square) {
        this.minWidth = minWidth;
        this.square = square;
    }

    public int minWidth() {
        return minWidth;
    }

    /** Episode thumbnails and profile pictures are square. */
    public boolean square() {
        return square;
    }
}
