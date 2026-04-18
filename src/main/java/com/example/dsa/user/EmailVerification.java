package com.example.dsa.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * Pending signup awaiting email OTP verification.
 *
 * <p>Row lifecycle: created when a user requests OTP, then either
 * (a) promoted to a real {@link UserInfo} and deleted when verified, or
 * (b) pruned by expiry when the user abandons the flow.
 *
 * <p>We store the already-BCrypt-hashed password so the user only types it
 * once, but we hash the OTP itself (SHA-256) so a DB snapshot doesn't
 * hand an attacker a live 6-digit code they could immediately use.
 */
@Entity
@Table(
    name = "email_verification",
    uniqueConstraints = @UniqueConstraint(columnNames = "email")
)
public class EmailVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String email;

    /** Chosen display name; carried through to UserInfo on verification. */
    @Column(nullable = false, length = 255)
    private String name;

    /** Chosen @handle, carried through on verification. */
    @Column(length = 30)
    private String username;

    /** BCrypt hash, set up-front so the user doesn't re-enter the password. */
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    /** SHA-256 hex digest of the OTP. Never store the raw code. */
    @Column(name = "otp_hash", nullable = false, length = 64)
    private String otpHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    /** How many wrong codes the user has submitted. Lock after N. */
    @Column(nullable = false)
    private int attempts = 0;

    public EmailVerification() {}

    // ── getters / setters ─────────────────────────────────────────────────
    public Long getId() { return id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getOtpHash() { return otpHash; }
    public void setOtpHash(String otpHash) { this.otpHash = otpHash; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
}
