package com.example.dsa.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.Map;

/**
 * Sends mail via the <a href="https://resend.com/docs/api-reference/emails/send-email">Resend REST API</a>.
 * Picked chiefly because the API is one POST with a bearer token — no SMTP
 * plumbing, no TLS fiddling, and the free tier (3k/month) covers this app
 * comfortably. Swap for SendGrid/Mailgun by adding another {@link MailSender}
 * bean and flipping {@code app.mail.provider}.
 */
public class ResendMailSender implements MailSender {

    private static final Logger log = LoggerFactory.getLogger(ResendMailSender.class);
    private static final String API_URL = "https://api.resend.com/emails";

    private final WebClient webClient;
    private final String fromAddress;

    public ResendMailSender(String apiKey, String fromAddress) {
        this.fromAddress = fromAddress;
        this.webClient = WebClient.builder()
                .baseUrl(API_URL)
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public boolean send(String toEmail, String subject, String htmlBody) {
        if (toEmail == null || toEmail.isBlank()) return false;
        Map<String, Object> payload = Map.of(
                "from", fromAddress,
                "to", new String[] { toEmail },
                "subject", subject == null ? "" : subject,
                "html", htmlBody == null ? "" : htmlBody);
        try {
            webClient.post()
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(String.class)
                    // Block — we're already inside a background @Scheduled thread,
                    // and Resend responds within a few hundred ms in practice.
                    .block(Duration.ofSeconds(15));
            return true;
        } catch (WebClientResponseException e) {
            log.warn("Resend rejected email to {}: status={} body={}",
                    toEmail, e.getStatusCode(), e.getResponseBodyAsString());
            return false;
        } catch (Exception e) {
            log.warn("Resend transport failure for {}: {}", toEmail, e.toString());
            return false;
        }
    }
}
