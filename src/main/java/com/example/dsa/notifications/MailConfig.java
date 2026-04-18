package com.example.dsa.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Chooses the active {@link MailSender} at startup.
 *
 * <ul>
 *   <li><b>app.mail.provider=resend</b> (and a non-empty API key) → {@link ResendMailSender}</li>
 *   <li>anything else, or missing key → {@link LoggingMailSender} (dev-friendly no-op)</li>
 * </ul>
 *
 * This kept the decision in one place so the scheduler stays dumb — it just
 * depends on a {@code MailSender} bean and doesn't care what's behind it.
 */
@Configuration
public class MailConfig {

    private static final Logger log = LoggerFactory.getLogger(MailConfig.class);

    @Bean
    public MailSender mailSender(
            @Value("${app.mail.provider:logging}") String provider,
            @Value("${app.mail.from:reminders@localhost}") String from,
            @Value("${app.mail.resend.api-key:}") String resendApiKey) {

        String normalized = provider == null ? "logging" : provider.trim().toLowerCase();

        if ("resend".equals(normalized)) {
            if (resendApiKey == null || resendApiKey.isBlank()) {
                log.warn("app.mail.provider=resend but app.mail.resend.api-key is empty — " +
                        "falling back to LoggingMailSender so startup doesn't fail.");
                return new LoggingMailSender();
            }
            log.info("MailSender: Resend (from={})", from);
            return new ResendMailSender(resendApiKey, from);
        }

        log.info("MailSender: logging (emails will be written to logs, not delivered)");
        return new LoggingMailSender();
    }
}
