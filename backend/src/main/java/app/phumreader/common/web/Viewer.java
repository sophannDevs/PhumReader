package app.phumreader.common.web;

import app.phumreader.common.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import org.jspecify.annotations.Nullable;

/** Who is looking, for view counts: the signed-in user, otherwise the client address. */
public final class Viewer {

    private Viewer() {}

    public static String of(@Nullable CurrentUser user, HttpServletRequest request) {
        return user != null ? "u:" + user.id() : "ip:" + request.getRemoteAddr();
    }
}
