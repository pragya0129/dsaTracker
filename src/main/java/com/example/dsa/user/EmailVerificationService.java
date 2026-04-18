package com.example.dsa.user;

import com.example.dsa.notifications.MailSender;
import com.example.dsa.notifications.ReminderEmailBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Orchestrates the two-step email-verified signup.
 *
 * <ol>
 *   <li>{@link #requestVerification(String, String, String)}: validate the
 *       email is free, hash password, generate a 6-digit OTP, upsert a
 *       pending row, send the email.</li>
 *   <li>{@link #verifyAndCreate(String, String)}: check the OTP matches and
 *       hasn't expired / been wrong-guessed too many times, then create the
 *       real {@link UserInfo} and clean up the pending row.</li>
 * </ol>
 *
 * <p>Security choices worth flagging: OTP is stored as a SHA-256 hex digest
 * so a DB snapshot doesn't hand an attacker live codes. Password is stored
 * already-BCrypt-hashed so the pending row never holds plaintext. A 60-second
 * cooldown between requests prevents email-bombing a user; 5 wrong attempts
 * invalidates the code.
 */
@Service
public class EmailVerificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailVerificationService.class);

    private static final Duration CODE_TTL         = Duration.ofMinutes(10);
    private static final Duration RESEND_COOLDOWN  = Duration.ofSeconds(60);
    private static final int      MAX_ATTEMPTS     = 5;

    private final EmailVerificationRepository pendingRepo;
    private final UserInfoRepository userInfoRepo;
    private final PasswordEncoder encoder;
    private final MailSender mailSender;
    private final ReminderEmailBuilder emailBuilder;
    private final SecureRandom random = new SecureRandom();

    /**
     * Gate for the whole OTP flow. When false, signup bypasses email
     * verification — useful during development / before a sending domain
     * is verified with the mail provider. Default true so production
     * deploys don't accidentally ship an unverified-signup endpoint.
     */
    private final boolean verificationEnabled;

    public EmailVerificationService(EmailVerificationRepository pendingRepo,
                                    UserInfoRepository userInfoRepo,
                                    PasswordEncoder encoder,
                                    MailSender mailSender,
                                    ReminderEmailBuilder emailBuilder,
                                    @Value("${app.signup.verification-enabled:true}") boolean verificationEnabled) {
        this.pendingRepo = pendingRepo;
        this.userInfoRepo = userInfoRepo;
        this.encoder = encoder;
        this.mailSender = mailSender;
        this.emailBuilder = emailBuilder;
        this.verificationEnabled = verificationEnabled;
        if (!verificationEnabled) {
            log.warn("Signup email verification is DISABLED — /auth/signup/request " +
                    "will create accounts directly without OTP. Flip " +
                    "app.signup.verification-enabled=true before public launch.");
        }
    }

    /**
     * Result of a request/resend.
     * <ul>
     *   <li>{@code sent=true, autoCreatedUser=null} — OTP went out, user
     *       should now be shown the OTP step.</li>
     *   <li>{@code sent=true, autoCreatedUser=<user>} — verification is
     *       disabled; the caller should log the user in immediately.</li>
     *   <li>{@code sent=false, error=...} — nothing happened.</li>
     * </ul>
     */
    public record RequestOutcome(boolean sent, String error, UserInfo autoCreatedUser) {
        public static RequestOutcome ok() { return new RequestOutcome(true, null, null); }
        public static RequestOutcome fail(String msg) { return new RequestOutcome(false, msg, null); }
        public static RequestOutcome autoCreated(UserInfo u) { return new RequestOutcome(true, null, u); }
    }

    /**
     * Generate and email an OTP for a fresh signup.
     * If a pending row already exists for this email we overwrite it, subject
     * to the resend cooldown.
     */
    @Transactional
    public RequestOutcome requestVerification(String rawName, String rawUsername,
                                              String rawEmail, String password) {
        String name = rawName == null ? "" : rawName.trim();
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();

        if (name.isEmpty())                       return RequestOutcome.fail("Name is required");
        if (!isLikelyEmail(email))                return RequestOutcome.fail("Please enter a valid email address");
        if (password == null || password.length() < 8)
                                                  return RequestOutcome.fail("Password must be at least 8 characters");

        String usernameErr = UsernameValidator.validate(rawUsername);
        if (usernameErr != null) return RequestOutcome.fail(usernameErr);
        String username = UsernameValidator.normalise(rawUsername);
        if (userInfoRepo.existsByUsername(username))
                                                  return RequestOutcome.fail("That username is taken");

        if (userInfoRepo.findByEmail(email).isPresent())
                                                  return RequestOutcome.fail("This email is already registered. Try signing in.");

        // ── Feature flag: when OTP verification is off, just create the
        //    account directly and tell the caller so it can log the user in. ──
        if (!verificationEnabled) {
            UserInfo u = new UserInfo();
            u.setEmail(email);
            u.setName(name);
            u.setUsername(username);
            u.setPassword(encoder.encode(password));
            u.setRoles("ROLE_USER");
            userInfoRepo.save(u);
            return RequestOutcome.autoCreated(u);
        }

        Optional<EmailVerification> existing = pendingRepo.findByEmail(email);
        Instant now = Instant.now();
        if (existing.isPresent()) {
            Instant prevCreated = existing.get().getCreatedAt();
            if (prevCreated != null && prevCreated.plus(RESEND_COOLDOWN).isAfter(now)) {
                long secsLeft = Duration.between(now, prevCreated.plus(RESEND_COOLDOWN)).getSeconds();
                return RequestOutcome.fail("Please wait " + secsLeft + " seconds before requesting a new code");
            }
        }

        String otp = generateOtp();
        EmailVerification pending = existing.orElseGet(EmailVerification::new);
        pending.setEmail(email);
        pending.setName(name);
        pending.setUsername(username);
        pending.setPasswordHash(encoder.encode(password));
        pending.setOtpHash(sha256(otp));
        pending.setCreatedAt(now);
        pending.setExpiresAt(now.plus(CODE_TTL));
        pending.setAttempts(0);
        pendingRepo.save(pending);

        ReminderEmailBuilder.Email msg = emailBuilder.signupOtp(name, otp);
        boolean dispatched = mailSender.send(email, msg.subject(), msg.html());
        if (!dispatched) {
            // Log but don't leak provider failure details to the client —
            // just show a generic try-again.
            log.warn("Mail provider rejected OTP send to {}", email);
            return RequestOutcome.fail("Couldn't send the code right now. Please try again in a minute.");
        }

        return RequestOutcome.ok();
    }

    /**
     * Resend an OTP for an in-flight signup using the name/password-hash
     * already stored in the pending row. Same cooldown applies as a fresh
     * request. Returns a generic message either way so we don't leak whether
     * a pending row exists for the given email.
     */
    @Transactional
    public RequestOutcome resendForPending(String rawEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        if (email.isEmpty()) {
            return RequestOutcome.fail("Please enter a valid email address");
        }
        Optional<EmailVerification> maybe = pendingRepo.findByEmail(email);
        if (maybe.isEmpty()) {
            // Look like success to avoid email enumeration.
            return RequestOutcome.ok();
        }
        EmailVerification pending = maybe.get();
        Instant now = Instant.now();
        Instant prev = pending.getCreatedAt();
        if (prev != null && prev.plus(RESEND_COOLDOWN).isAfter(now)) {
            long secsLeft = Duration.between(now, prev.plus(RESEND_COOLDOWN)).getSeconds();
            return RequestOutcome.fail("Please wait " + secsLeft + " seconds before requesting another code");
        }

        String otp = generateOtp();
        pending.setOtpHash(sha256(otp));
        pending.setCreatedAt(now);
        pending.setExpiresAt(now.plus(CODE_TTL));
        pending.setAttempts(0);
        pendingRepo.save(pending);

        ReminderEmailBuilder.Email msg = emailBuilder.signupOtp(pending.getName(), otp);
        if (!mailSender.send(email, msg.subject(), msg.html())) {
            log.warn("Mail provider rejected resent OTP to {}", email);
            return RequestOutcome.fail("Couldn't send the code right now. Please try again in a minute.");
        }
        return RequestOutcome.ok();
    }

    /** Result of a verify — carries the created user on success. */
    public record VerifyOutcome(UserInfo user, String error) {
        public static VerifyOutcome ok(UserInfo u) { return new VerifyOutcome(u, null); }
        public static VerifyOutcome fail(String msg) { return new VerifyOutcome(null, msg); }
    }

    /** Verify the OTP and, on success, create the real account. */
    @Transactional
    public VerifyOutcome verifyAndCreate(String rawEmail, String otp) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        if (email.isEmpty() || otp == null || otp.isBlank()) {
            return VerifyOutcome.fail("Email and code are required");
        }

        Optional<EmailVerification> maybe = pendingRepo.findByEmail(email);
        if (maybe.isEmpty()) {
            return VerifyOutcome.fail("No pending verification for this email — please request a new code");
        }
        EmailVerification pending = maybe.get();

        if (pending.getExpiresAt() != null && pending.getExpiresAt().isBefore(Instant.now())) {
            pendingRepo.delete(pending);
            return VerifyOutcome.fail("This code has expired. Please request a new one.");
        }

        if (pending.getAttempts() >= MAX_ATTEMPTS) {
            pendingRepo.delete(pending);
            return VerifyOutcome.fail("Too many wrong attempts. Please request a new code.");
        }

        // Race-safe: unrelated to whether the string comparison is itself
        // constant-time; we already hashed and the row is unique per email.
        String submittedHash = sha256(otp.trim());
        if (!submittedHash.equals(pending.getOtpHash())) {
            pending.setAttempts(pending.getAttempts() + 1);
            pendingRepo.save(pending);
            int remaining = MAX_ATTEMPTS - pending.getAttempts();
            if (remaining <= 0) {
                pendingRepo.delete(pending);
                return VerifyOutcome.fail("Too many wrong attempts. Please request a new code.");
            }
            return VerifyOutcome.fail("Incorrect code. " + remaining + " attempt" + (remaining == 1 ? "" : "s") + " left.");
        }

        // Final defence: re-check email wasn't claimed in a race between
        // request and verify.
        if (userInfoRepo.findByEmail(email).isPresent()) {
            pendingRepo.delete(pending);
            return VerifyOutcome.fail("This email is already registered.");
        }

        // Race-check the username too — it could have been grabbed in the
        // interim between request and verify.
        String pendingUsername = pending.getUsername();
        if (pendingUsername != null && userInfoRepo.existsByUsername(pendingUsername)) {
            pendingRepo.delete(pending);
            return VerifyOutcome.fail("Your chosen username was just taken. Please sign up again with a different one.");
        }

        UserInfo user = new UserInfo();
        user.setEmail(email);
        user.setName(pending.getName());
        user.setUsername(pendingUsername);
        user.setPassword(pending.getPasswordHash()); // already hashed
        user.setRoles("ROLE_USER");
        userInfoRepo.save(user);

        pendingRepo.delete(pending);
        return VerifyOutcome.ok(user);
    }

    /**
     * Nightly sweep of rows whose expiry has passed. Without this the
     * {@code email_verification} table grows without bound when users
     * abandon the flow halfway. Runs at 03:15 server time by default —
     * outside peak hours regardless of your deploy region.
     */
    @Scheduled(cron = "0 15 3 * * *")
    @Transactional
    public void pruneExpired() {
        long removed = pendingRepo.deleteByExpiresAtBefore(Instant.now());
        if (removed > 0) log.info("Pruned {} expired pending signup(s)", removed);
    }

    // ── helpers ───────────────────────────────────────────────────────────

    /** Six-digit zero-padded code, SecureRandom-sourced. */
    private String generateOtp() {
        int n = random.nextInt(1_000_000);
        return String.format("%06d", n);
    }

    /** Hex-encoded SHA-256 — small, fast, fine for a 6-digit-code hash. */
    private String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] out = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(out.length * 2);
            for (byte b : out) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is required to be available per the JVM spec.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** Light email sanity check; the real check is the delivery itself. */
    private boolean isLikelyEmail(String s) {
        if (s == null) return false;
        int at = s.indexOf('@');
        return at > 0 && at < s.length() - 3 && s.indexOf('.', at) > 0 && !s.contains(" ");
    }
}
