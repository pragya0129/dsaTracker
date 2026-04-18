package com.example.dsa.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * No-network fallback used in dev and when no provider API key is configured.
 * Writes the email to the application log so you can verify the scheduler,
 * templates, and opt-in plumbing without actually sending mail.
 */
public class LoggingMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(LoggingMailSender.class);

    @Override
    public boolean send(String toEmail, String subject, String htmlBody) {
        log.info("[mail:stub] to={} subject={} bodyLen={}", toEmail, subject,
                htmlBody == null ? 0 : htmlBody.length());

        // If this looks like a signup OTP, surface the 6-digit code on its
        // own line so you can copy it out of the terminal without hunting.
        // Subject line format from ReminderEmailBuilder.signupOtp is:
        //   "123456 — your AlgoLedger verification code"
        if (subject != null) {
            java.util.regex.Matcher m =
                java.util.regex.Pattern.compile("^(\\d{6}) ").matcher(subject);
            if (m.find()) {
                log.info("[mail:stub] >>> OTP for {}: {} <<<", toEmail, m.group(1));
            }
        }

        // Keep the full body at debug level so INFO logs stay readable.
        log.debug("[mail:stub] body=\n{}", htmlBody);
        return true;
    }
}
