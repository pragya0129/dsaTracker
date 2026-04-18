package com.example.dsa.notifications;

import com.example.dsa.platform.PlatformAccount;
import com.example.dsa.platform.PlatformAccountRepository;
import com.example.dsa.platform.PlatformSyncService;
import com.example.dsa.user.UserInfo;
import com.example.dsa.user.UserInfoService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Decides what reminder (if any) a given user should receive right now.
 *
 * <p>Uses <b>live</b> platform data — not the DB snapshot — because users who
 * don't log into the app for a while would otherwise have stale
 * {@code UserStats.lastSolvedDate} values, which caused the scheduler to
 * over-eagerly send "inactive today" emails to people who'd actually been
 * grinding on LeetCode directly. Fetching the calendar live fixes that at the
 * cost of one HTTP call per opted-in user per day (bounded by the send window).
 *
 * <p>Rules (in order):
 * <ol>
 *   <li>No linked platforms → NONE (nothing meaningful to say).</li>
 *   <li>Live fetch failed or produced no calendar data → NONE (safer to skip
 *       than send a wrong reminder).</li>
 *   <li>Any platform shows activity today (in user's TZ) → NONE.</li>
 *   <li>Current streak ≥ 1 → STREAK_AT_RISK.</li>
 *   <li>Otherwise → INACTIVE_TODAY.</li>
 * </ol>
 */
@Service
public class ReminderDecisionService {

    private static final Logger log = LoggerFactory.getLogger(ReminderDecisionService.class);

    private final UserInfoService userInfoService;
    private final PlatformAccountRepository platformAccountRepo;
    private final PlatformSyncService platformSyncService;

    public ReminderDecisionService(UserInfoService userInfoService,
                                   PlatformAccountRepository platformAccountRepo,
                                   PlatformSyncService platformSyncService) {
        this.userInfoService = userInfoService;
        this.platformAccountRepo = platformAccountRepo;
        this.platformSyncService = platformSyncService;
    }

    /**
     * @param user  the user we're evaluating
     * @param zone  user's timezone — used to bucket "today" correctly
     * @return a decision; {@link Decision#shouldSend()} is the only thing
     *         callers need to inspect before choosing a template.
     */
    public Decision decide(UserInfo user, ZoneId zone) {
        String userId = userInfoService.findIdByEmail(user.getEmail());

        // Cheap DB check first — avoid paying for a live HTTP fetch if the
        // user has nothing linked.
        List<PlatformAccount> accounts = platformAccountRepo.findByUserId(userId);
        if (accounts.isEmpty()) {
            return new Decision(ReminderKind.NONE, 0, 0);
        }

        // Live pull from LeetCode / Codeforces (the method swallows per-platform
        // errors and just returns a merged epoch→count map).
        Map<String, Integer> liveCalendar;
        try {
            liveCalendar = platformSyncService.getLiveCalendar(userId);
        } catch (Exception e) {
            log.warn("Live calendar fetch failed for {}: {}", user.getEmail(), e.toString());
            return new Decision(ReminderKind.NONE, 0, 0);
        }

        if (liveCalendar == null || liveCalendar.isEmpty()) {
            // Either every platform's fetch failed, or the user hasn't ever
            // submitted anything. Either way, bail — we don't want to ping
            // someone we can't actually observe.
            return new Decision(ReminderKind.NONE, 0, 0);
        }

        // Collapse the epoch-keyed calendar into the set of days the user was
        // active, bucketed by the user's local timezone.
        Set<LocalDate> activeDaysLocal = toLocalActiveDays(liveCalendar, zone);
        LocalDate todayLocal = LocalDate.now(zone);

        if (activeDaysLocal.contains(todayLocal)) {
            // They've already practiced today — nothing to remind.
            int streak = currentStreak(activeDaysLocal, todayLocal);
            return new Decision(ReminderKind.NONE, streak, liveCalendar.values().stream()
                    .mapToInt(Integer::intValue).sum());
        }

        int streak = currentStreak(activeDaysLocal, todayLocal);
        int totalDays = activeDaysLocal.size();

        if (streak >= 1) {
            return new Decision(ReminderKind.STREAK_AT_RISK, streak, totalDays);
        }
        return new Decision(ReminderKind.INACTIVE_TODAY, 0, totalDays);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /**
     * Platforms return their calendar as {@code epochSeconds → submissionCount}
     * (UTC-bucketed). Re-bucket into the user's local date so "today" means
     * what they think it means, especially around midnight.
     */
    private Set<LocalDate> toLocalActiveDays(Map<String, Integer> calendar, ZoneId zone) {
        Set<LocalDate> result = new TreeSet<>();
        for (Map.Entry<String, Integer> e : calendar.entrySet()) {
            if (e.getValue() == null || e.getValue() <= 0) continue;
            try {
                long epoch = Long.parseLong(e.getKey());
                LocalDate local = Instant.ofEpochSecond(epoch).atZone(zone).toLocalDate();
                result.add(local);
            } catch (NumberFormatException ignored) {
                // Non-numeric key → skip rather than blow up the whole decision.
            }
        }
        return result;
    }

    /**
     * Same definition used by {@code PlatformSyncService.computeStreaks}:
     * current streak is alive if the user was active today or yesterday, then
     * count backwards through consecutive active days.
     */
    private int currentStreak(Set<LocalDate> active, LocalDate today) {
        LocalDate cursor = active.contains(today)
                ? today
                : active.contains(today.minusDays(1)) ? today.minusDays(1) : null;
        if (cursor == null) return 0;
        int n = 0;
        while (active.contains(cursor)) {
            n++;
            cursor = cursor.minusDays(1);
        }
        return n;
    }

    /** Decision payload — kind + enough context for the email body. */
    public record Decision(ReminderKind kind, int currentStreak, int totalSolved) {
        public boolean shouldSend() {
            return kind != ReminderKind.NONE;
        }
    }
}
