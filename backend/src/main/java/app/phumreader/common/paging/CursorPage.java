package app.phumreader.common.paging;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * One page of a list. Lists use cursor paging: pass {@code nextCursor} back as {@code ?cursor=} to
 * get the next page; it is {@code null} on the last page.
 *
 * @param items the items on this page
 * @param nextCursor opaque cursor for the next page, or {@code null} when there is none
 */
public record CursorPage<T>(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<T> items,
        @Nullable String nextCursor) {

    public CursorPage {
        items = List.copyOf(items);
    }
}
