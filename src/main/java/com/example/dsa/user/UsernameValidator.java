package com.example.dsa.user;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Central rules for what counts as a valid username. Keep this one class
 * as the single source of truth so the signup flow, profile-edit flow,
 * and any future @mention parser all agree.
 *
 * <ul>
 *   <li>Lowercase letters, digits, and underscore only.</li>
 *   <li>3 to 30 characters.</li>
 *   <li>Stored lowercase — we accept mixed case from the client and lower
 *       it before comparing, so "Shubam" and "shubam" can't both exist.</li>
 *   <li>A small reserved list blocks names that would shadow routes
 *       ("admin", "api", "auth", etc.) or confuse UX ("me", "profile").</li>
 * </ul>
 */
public final class UsernameValidator {

    private static final Pattern ALLOWED = Pattern.compile("^[a-z0-9_]{3,30}$");

    /** Routes & UI concepts that must never be a username. */
    private static final Set<String> RESERVED = Set.of(
        "admin", "administrator", "root", "system", "support", "help",
        "api", "auth", "login", "signup", "register", "logout",
        "me", "self", "you", "user", "users", "profile", "account",
        "dashboard", "home", "about", "contact", "privacy", "terms",
        "community", "posts", "challenges", "contest", "problems",
        "onboarding", "settings", "notifications",
        "algoledger", "null", "undefined"
    );

    private UsernameValidator() {}

    /**
     * @return error message if invalid, or {@code null} if the username is
     * syntactically OK (uniqueness is checked separately against the DB).
     */
    public static String validate(String raw) {
        if (raw == null) return "Username is required";
        String u = raw.trim().toLowerCase();
        if (u.isEmpty()) return "Username is required";
        if (u.length() < 3) return "Username must be at least 3 characters";
        if (u.length() > 30) return "Username must be 30 characters or fewer";
        if (!ALLOWED.matcher(u).matches()) {
            return "Only lowercase letters, digits, and underscores are allowed";
        }
        if (RESERVED.contains(u)) {
            return "That username is reserved — pick something else";
        }
        return null;
    }

    /** Canonicalise for storage + comparison. Call after {@link #validate}. */
    public static String normalise(String raw) {
        return raw == null ? null : raw.trim().toLowerCase();
    }
}
