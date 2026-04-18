package com.example.dsa.notifications;

/**
 * Which type of reminder a user should receive (if any) at send time.
 * Kept tiny and serialisable so logs stay greppable.
 */
public enum ReminderKind {
    /** User has no activity today but isn't on a streak worth protecting. */
    INACTIVE_TODAY,
    /** User has a current streak and hasn't practiced today — protect it. */
    STREAK_AT_RISK,
    /** Nothing to send (either they already practiced or have nothing to lose). */
    NONE
}
