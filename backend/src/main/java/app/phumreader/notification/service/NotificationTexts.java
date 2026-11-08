package app.phumreader.notification.service;

import org.jspecify.annotations.Nullable;

/**
 * The words of a new-episode notice, in the subscriber's language. Plain text only; the Khmer
 * wording is a first draft for a native speaker to review (A12).
 */
final class NotificationTexts {

    /** Subject / push title, and the longer text for email and push. */
    record Notice(String title, String body, String emailBody) {}

    private NotificationTexts() {}

    static Notice newEpisode(
            String language,
            String seriesTitle,
            boolean novel,
            int number,
            @Nullable String episodeTitle,
            String link,
            String settingsLink) {
        String name =
                episodeTitle == null || episodeTitle.isBlank() ? "" : " – " + episodeTitle.strip();
        if ("km".equals(language)) {
            String unit = novel ? "ជំពូកទី " : "ភាគទី ";
            String title = "ភាគថ្មី៖ " + seriesTitle;
            String body = unit + number + name + " ត្រូវបានចេញផ្សាយ";
            return new Notice(
                    title,
                    body,
                    body
                            + "\n\nអានឥឡូវនេះ៖ "
                            + link
                            + "\n\nអ្នកទទួលបានសារនេះព្រោះអ្នកបានជាវ "
                            + seriesTitle
                            + "។ បិទវាបានក្នុងការកំណត់ > ការជូនដំណឹង៖ "
                            + settingsLink);
        }
        String unit = novel ? "Chapter " : "Episode ";
        String title = "New episode: " + seriesTitle;
        String body = unit + number + name + " is out";
        return new Notice(
                title,
                body,
                body
                        + ".\n\nRead it now: "
                        + link
                        + "\n\nYou get this because you subscribed to "
                        + seriesTitle
                        + ". Turn it off in Settings > Notifications: "
                        + settingsLink);
    }
}
