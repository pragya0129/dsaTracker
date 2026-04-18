package com.example.dsa.notifications;

/**
 * Pluggable mail transport. The active implementation is chosen at startup
 * based on the {@code app.mail.provider} property. Swap providers (SendGrid,
 * Mailgun, SES, SMTP, …) by adding a new {@code MailSender} bean and flipping
 * the property — no caller code changes.
 */
public interface MailSender {

    /**
     * Best-effort send. Implementations should log-and-swallow transport
     * failures so the scheduler never crashes because of a flaky provider.
     *
     * @return true if the provider accepted the message, false otherwise.
     */
    boolean send(String toEmail, String subject, String htmlBody);
}
