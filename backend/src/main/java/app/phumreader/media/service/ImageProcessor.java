package app.phumreader.media.service;

import app.phumreader.media.domain.UploadKind;
import com.sksamuel.scrimage.ImmutableImage;
import com.sksamuel.scrimage.webp.WebpWriter;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.stereotype.Component;

/**
 * Checks an uploaded original and makes its WebP variants. The checks look at the file's own bytes,
 * not at the name or the type the browser claimed.
 */
@Component
public class ImageProcessor {

    /** A JPG or PNG may not have more pixels than this (a decompression-bomb guard). */
    static final long MAX_PIXELS = 50_000_000L;

    /** Variant widths; a variant is never wider than the original. */
    static final int[] WIDTHS = {320, 800, 1200};

    private static final WebpWriter WEBP = WebpWriter.DEFAULT.withQ(80);

    /** The image failed a check. {@code code} is a stable snake_case reason. */
    public static class Rejected extends Exception {
        private final String code;

        Rejected(String code, String message) {
            super(message);
            this.code = code;
        }

        public String code() {
            return code;
        }
    }

    public record Inspected(int width, int height) {}

    public record Variant(int width, byte[] webp) {}

    /**
     * Throws {@link Rejected} unless the bytes are a JPG or PNG that is big enough for the kind.
     */
    public Inspected inspect(byte[] data, UploadKind kind) throws Rejected {
        int width;
        int height;
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) {
                throw new Rejected("unsupported_type", "The file is not a JPG or PNG image.");
            }
            ImageReader reader = readers.next();
            String format = reader.getFormatName().toLowerCase(Locale.ROOT);
            if (!format.equals("jpeg") && !format.equals("png")) {
                throw new Rejected("unsupported_type", "Only JPG and PNG images are accepted.");
            }
            reader.setInput(in);
            width = reader.getWidth(0);
            height = reader.getHeight(0);
            reader.dispose();
        } catch (IOException | RuntimeException e) {
            throw new Rejected("corrupt_image", "The image could not be read.");
        }
        if ((long) width * height > MAX_PIXELS) {
            throw new Rejected(
                    "too_many_pixels",
                    "The image is %d x %d px; the maximum is 50 million pixels."
                            .formatted(width, height));
        }
        if (width < kind.minWidth()) {
            throw new Rejected(
                    "image_too_small",
                    "The image is %d px wide; the minimum is %d px."
                            .formatted(width, kind.minWidth()));
        }
        if (kind.square() && width != height) {
            throw new Rejected(
                    "not_square",
                    "The image is %d x %d px; it must be square.".formatted(width, height));
        }
        return new Inspected(width, height);
    }

    /** WebP copies at 320, 800 and 1200 px wide (smaller originals get fewer). */
    public List<Variant> variants(byte[] data, Inspected size) throws Rejected {
        try {
            ImmutableImage image = ImmutableImage.loader().fromBytes(data);
            List<Variant> out = new ArrayList<>();
            int last = -1;
            for (int target : WIDTHS) {
                int width = Math.min(target, size.width());
                if (width == last) {
                    continue;
                }
                last = width;
                ImmutableImage scaled = width == size.width() ? image : image.scaleToWidth(width);
                out.add(new Variant(width, scaled.bytes(WEBP)));
            }
            return out;
        } catch (IOException | RuntimeException e) {
            throw new Rejected("corrupt_image", "The image could not be processed.");
        }
    }
}
