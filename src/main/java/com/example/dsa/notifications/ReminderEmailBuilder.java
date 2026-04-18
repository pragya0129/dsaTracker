package com.example.dsa.notifications;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Builds the subject and HTML body for reminder emails.
 * Kept separate from the scheduler so copy tweaks don't require touching
 * scheduling logic (and so the templates are easy to unit-test later).
 */
@Component
public class ReminderEmailBuilder {

    /**
     * Public URL of the web app — links in emails (e.g. "Open today's
     * practice") point here. Set via {@code app.web.base-url}
     * (env: {@code APP_WEB_BASE_URL}). Defaults to the Vite dev server
     * so emails fired from a local run link somewhere you can actually open.
     */
    private final String webBaseUrl;

    public ReminderEmailBuilder(@Value("${app.web.base-url:http://localhost:5173}") String webBaseUrl) {
        // Trim any trailing slash so we can always concatenate "/path".
        this.webBaseUrl = webBaseUrl == null ? "" :
                (webBaseUrl.endsWith("/") ? webBaseUrl.substring(0, webBaseUrl.length() - 1) : webBaseUrl);
    }

    public Email inactiveToday(String displayName, int totalSolved) {
        String name = safeName(displayName);
        String subject = "🧠 Don't break the habit — squeeze in one problem?";
        String body = ""
                + "<div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827\">"
                + "<h2 style=\"color:#6366F1;margin:0 0 12px\">Hey " + escape(name) + " 👋</h2>"
                + "<p style=\"line-height:1.55;margin:0 0 14px\">"
                + "Quick nudge: you haven't logged a submission on any of your linked platforms today. "
                + "Even <b>one</b> easy problem keeps the muscle warm and your daily streak alive."
                + "</p>"
                + "<p style=\"line-height:1.55;margin:0 0 20px\">"
                + "You're at <b>" + Math.max(0, totalSolved) + "</b> problems solved. Let's make it one more."
                + "</p>"
                + "<a href=\"" + webBaseUrl + "/problems\" "
                +     "style=\"display:inline-block;background:#6366F1;color:#fff;text-decoration:none;"
                +     "padding:10px 18px;border-radius:8px;font-weight:600\">"
                + "Open today's practice"
                + "</a>"
                + footer()
                + "</div>";
        return new Email(subject, body);
    }

    public Email streakAtRisk(String displayName, int currentStreak) {
        String name = safeName(displayName);
        String subject = "🔥 " + currentStreak + "-day streak at risk — save it?";
        String body = ""
                + "<div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827\">"
                + "<h2 style=\"color:#F59E0B;margin:0 0 12px\">" + escape(name) + ", your streak is on the line</h2>"
                + "<p style=\"line-height:1.55;margin:0 0 14px\">"
                + "You're <b>" + currentStreak + " day" + (currentStreak == 1 ? "" : "s") + "</b> into your streak "
                + "and haven't practiced yet today. One problem is all it takes to keep it going."
                + "</p>"
                + "<p style=\"line-height:1.55;margin:0 0 20px\">"
                + "Pick the shortest one you can find — the streak rewards consistency, not heroics."
                + "</p>"
                + "<a href=\"" + webBaseUrl + "/problems\" "
                +     "style=\"display:inline-block;background:#F59E0B;color:#111;text-decoration:none;"
                +     "padding:10px 18px;border-radius:8px;font-weight:700\">"
                + "Save my streak"
                + "</a>"
                + footer()
                + "</div>";
        return new Email(subject, body);
    }

    private String footer() {
        return "<p style=\"margin-top:28px;padding-top:16px;border-top:1px solid #E5E7EB;"
                + "font-size:12px;color:#6B7280;line-height:1.5\">"
                + "You're receiving this because you opted in to practice reminders on AlgoLedger. "
                + "You can turn these off anytime in <i>Profile → Notifications</i>."
                + "</p>";
    }

    /**
     * Signup OTP email. The 6-digit code is displayed as a monospace block
     * big enough to copy off mobile at a glance. No CTA buttons — all the
     * verification happens back in the app where they already were.
     */
    public Email signupOtp(String displayName, String otp) {
        String name = safeName(displayName);
        String subject = otp + " — your AlgoLedger verification code";
        String body = ""
                + "<div style=\"font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827\">"
                + "<h2 style=\"color:#E5A653;margin:0 0 12px\">Welcome aboard, " + escape(name) + " 👋</h2>"
                + "<p style=\"line-height:1.55;margin:0 0 20px\">"
                + "Drop this code back in the AlgoLedger signup page to finish creating your account:"
                + "</p>"
                + "<div style=\"background:#F8F3E8;border:2px dashed #E5A653;border-radius:12px;"
                +     "padding:22px 16px;text-align:center;margin:0 0 22px\">"
                + "<div style=\"font-family:'SF Mono',Menlo,Consolas,monospace;"
                +     "font-size:34px;font-weight:700;letter-spacing:0.35em;color:#1C1608\">"
                + escape(otp) + "</div>"
                + "<div style=\"font-size:11px;color:#8B6F3F;margin-top:8px;letter-spacing:0.08em;"
                +     "text-transform:uppercase\">valid for 10 minutes</div>"
                + "</div>"
                + "<p style=\"line-height:1.55;margin:0 0 14px;font-size:13px;color:#4B5563\">"
                + "Didn't request this? No worries — just ignore the email. Whoever typed your address "
                + "will eventually give up, and your account won't be created."
                + "</p>"
                + otpFooter()
                + "</div>";
        return new Email(subject, body);
    }

    private String otpFooter() {
        return "<p style=\"margin-top:24px;padding-top:14px;border-top:1px solid #E5E7EB;"
                + "font-size:11px;color:#9CA3AF;line-height:1.5\">"
                + "Never share this code. AlgoLedger will never ask you for it."
                + "</p>";
    }

    private String safeName(String n) {
        if (n == null || n.isBlank()) return "there";
        return n.trim();
    }

    /** Minimal HTML escape — names are user-controlled so don't inject raw. */
    private String escape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    /** Simple value holder for a rendered email. */
    public record Email(String subject, String html) {}
}
