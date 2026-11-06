package app.phumreader.support;

import app.phumreader.notification.service.EmailSender;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;

/** Keeps sent emails so tests can read codes and reset links. */
public class RecordingEmailSender implements EmailSender {

    public record Email(String to, String subject, String body) {}

    private final List<Email> sent = new CopyOnWriteArrayList<>();

    @Override
    public void send(String to, String subject, String body) {
        sent.add(new Email(to, subject, body));
    }

    public List<Email> to(String address) {
        return sent.stream().filter(e -> e.to().equals(address)).toList();
    }

    public Optional<Email> lastTo(String address) {
        List<Email> emails = to(address);
        return emails.isEmpty() ? Optional.empty() : Optional.of(emails.getLast());
    }

    public void clear() {
        sent.clear();
    }
}
