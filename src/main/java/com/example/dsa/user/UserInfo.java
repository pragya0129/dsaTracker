package com.example.dsa.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;

import java.time.LocalDate;

@Entity
public class UserInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int id;
    private String name;
    @Column(unique = true, nullable = false)
    private String email;
    private String password;
    private String roles;

    /**
     * Public-facing handle, like an Instagram username.
     * Lowercased, [a-z0-9_]{3,30}, unique across all users. Used in URLs,
     * contest invites, @mentions in community posts, and follow links.
     * Nullable so legacy users (created before this column existed) can
     * keep working until they pick one.
     */
    @Column(unique = true, length = 30)
    private String username;

    /**
     * Base64 data URL of the user's profile picture (nullable).
     *
     * Stored in a plain Postgres TEXT column (unlimited up to ~1 GB) —
     * {@code columnDefinition = "TEXT"} on its own is enough.
     *
     * NB: do NOT add @Lob here. On Hibernate 6 / Spring Boot 3, @Lob on a
     * String forces the JDBC driver to use a streamed CLOB read that needs
     * an active session, which clashes with the plain TEXT column type.
     * The result was "Unable to access lob stream" errors during login
     * (when the session is closed before the user is serialised).
     */
    @Column(name = "profile_pic", columnDefinition = "TEXT")
    private String profilePic;

    // ── Email reminder preferences ─────────────────────────────────────────
    /**
     * If true, the user has opted in to reminder emails.
     * columnDefinition carries a DEFAULT so existing rows survive the
     * ALTER TABLE Hibernate issues when the column is first added.
     */
    @Column(name = "notification_enabled", nullable = false,
            columnDefinition = "BOOLEAN NOT NULL DEFAULT FALSE")
    private boolean notificationEnabled = false;

    /** Local time of day (HH:mm) the user wants to receive reminders. */
    @Column(name = "reminder_time", length = 5)
    private String reminderTime = "19:00";

    /** IANA timezone ID for interpreting reminderTime (e.g. "America/Los_Angeles"). */
    @Column(name = "reminder_timezone", length = 64)
    private String reminderTimezone = "UTC";

    /** Calendar date (user's local TZ) a reminder was last sent — prevents dupes. */
    @Column(name = "last_reminder_sent_on")
    private LocalDate lastReminderSentOn;

    public UserInfo() {
    }

    public UserInfo(int id, String name, String email, String password, String roles) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.password = password;
        this.roles = roles;
    }

    public int getId() {
        return id;
    }

    public void setId(int id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRoles() {
        return roles;
    }

    public void setRoles(String roles) {
        this.roles = roles;
    }

    public String getProfilePic() {
        return profilePic;
    }

    public void setProfilePic(String profilePic) {
        this.profilePic = profilePic;
    }

    public boolean isNotificationEnabled() {
        return notificationEnabled;
    }

    public void setNotificationEnabled(boolean notificationEnabled) {
        this.notificationEnabled = notificationEnabled;
    }

    public String getReminderTime() {
        return reminderTime;
    }

    public void setReminderTime(String reminderTime) {
        this.reminderTime = reminderTime;
    }

    public String getReminderTimezone() {
        return reminderTimezone;
    }

    public void setReminderTimezone(String reminderTimezone) {
        this.reminderTimezone = reminderTimezone;
    }

    public LocalDate getLastReminderSentOn() {
        return lastReminderSentOn;
    }

    public void setLastReminderSentOn(LocalDate lastReminderSentOn) {
        this.lastReminderSentOn = lastReminderSentOn;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
