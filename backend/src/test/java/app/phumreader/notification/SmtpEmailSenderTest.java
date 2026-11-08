package app.phumreader.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import app.phumreader.notification.service.EmailSender;
import java.lang.reflect.Constructor;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class SmtpEmailSenderTest {

    @Test
    void sendsOnePlainTextMessageFromTheConfiguredAddress() throws Exception {
        JavaMailSender mailer = mock(JavaMailSender.class);
        Class<?> type = Class.forName("app.phumreader.notification.service.SmtpEmailSender");
        Constructor<?> ctor = type.getDeclaredConstructor(JavaMailSender.class, String.class);
        ctor.setAccessible(true);
        EmailSender sender = (EmailSender) ctor.newInstance(mailer, "PhumReader <no-reply@x.test>");

        sender.send("reader@example.com", "Your code", "123456");

        ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailer).send(sent.capture());
        assertThat(sent.getValue().getTo()).containsExactly("reader@example.com");
        assertThat(sent.getValue().getFrom()).isEqualTo("PhumReader <no-reply@x.test>");
        assertThat(sent.getValue().getSubject()).isEqualTo("Your code");
        assertThat(sent.getValue().getText()).isEqualTo("123456");
    }
}
