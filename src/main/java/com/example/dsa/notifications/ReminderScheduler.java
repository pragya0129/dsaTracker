package com.example.dsa.notifications;

import com.example.dsa.user.UserInfo;
import com.example.dsa.user.UserInfoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Fires every 15 minutes and picks off users whose local reminder time is
 * within the current window. Designed to be crash-safe and idempotent:
 * <ul>
 *   <li>{@code lastReminderSentOn} is keyed to the user's local date, so we
 *       never double-send within one day even if the scheduler fires twice.</li>
 *   <li>Any per-user exception is logged and swallowed so one bad row doesn't
 *       stop the rest of the run.</li>
 * </ul>
 */
@Component
public class ReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReminderScheduler.class);

    /** Run cadence — must match the +/- half of {@link #WINDOW_MINUTES}. */
    private static final long CADENCE_MS = 15 * 60 * 1000L;

    /**
     * How wide a window around the user's reminder time counts as "now".
     * Slightly larger than the cadence so there's no off-by-a-minute gap
     * if the scheduler drifts.
     */
    private static final int WINDOW_MINUTES = 16;

    private final UserInfoRepository userInfoRepository;
    private final ReminderDecisionService decisionService;
    private final ReminderEmailBuilder emailBuilder;
    private final MailSender mailSender;

    public ReminderScheduler(UserInfoRepository userInfoRepository,
                             ReminderDecisionService decisionService,
                             ReminderEmailBuilder emailBuilder,
                             MailSender mailSender) {
        this.userInfoRepository = userInfoRepository;
        this.decisionService = decisionService;
        this.emailBuilder = emailBuilder;
        this.mailSender = mailSender;
    }

    /**
     * Kick off ~1 minute after boot so we don't collide with app startup,
     * then every 15 minutes thereafter.
     */
    @Scheduled(initialDelay = 60_000, fixedDelay = CADENCE_MS)
    public void tick() {
        List<UserInfo> users = userInfoRepository.findByNotificationEnabledTrue();
        if (users.isEmpty()) return;

        int sent = 0;
        for (UserInfo user : users) {
            try {
                if (processUser(user)) sent++;
            } catch (Exception e) {
                log.warn("Reminder check failed for user {}: {}", user.getEmail(), e.toString());
            }
        }
        if (sent > 0) {
            log.info("Reminder scheduler: sent {} email(s) out of {} opted-in users", sent, users.size());
        }
    }

    /** @return true if an email was dispatched for this user. */
    private boolean processUser(UserInfo user) {
        ZoneId zone = resolveZone(user.getReminderTimezone());
        ZonedDateTime nowLocal = ZonedDateTime.now(zone);
        LocalDate todayLocal = nowLocal.toLocalDate();

        // Already sent today? (keyed to the user's local date)
        if (todayLocal.equals(user.getLastReminderSentOn())) return false;

        LocalTime target = parseTimeOrDefault(user.getReminderTime());
        if (!withinWindow(nowLocal.toLocalTime(), target)) return false;

        // Pass the zone (not just the date) so the decision service can
        // re-bucket live platform calendars into the user's local days.
        ReminderDecisionService.Decision decision = decisionService.decide(user, zone);
        if (!decision.shouldSend()) return false;

        ReminderEmailBuilder.Email email = switch (decision.kind()) {
            case INACTIVE_TODAY -> emailBuilder.inactiveToday(user.getName(), decision.totalSolved());
            case STREAK_AT_RISK -> emailBuilder.streakAtRisk(user.getName(), decision.currentStreak());
            case NONE -> null; // unreachable given shouldSend() check
        };
        if (email == null) return false;

        boolean accepted = mailSender.send(user.getEmail(), email.subject(), email.html());
        if (accepted) {
            // Persist regardless of whether the downstream provider really delivered —
            // we only want one *attempt* per day to avoid spamming on transient blips.
            user.setLastReminderSentOn(todayLocal);
            userInfoRepository.save(user);
            log.debug("Sent {} reminder to {}", decision.kind(), user.getEmail());
            return true;
        }
        return false;
    }

    /** True if {@code now} is within ±WINDOW_MINUTES/2 of {@code target} on the clock face. */
    private boolean withinWindow(LocalTime now, LocalTime target) {
        int diff = Math.abs(minutesSinceMidnight(now) - minutesSinceMidnight(target));
        // Handle wrap-around (e.g. reminder at 23:55, now 00:05).
        diff = Math.min(diff, 24 * 60 - diff);
        return diff <= WINDOW_MINUTES / 2;
    }

    private int minutesSinceMidnight(LocalTime t) {
        return t.getHour() * 60 + t.getMinute();
    }

    private ZoneId resolveZone(String tz) {
        if (tz == null || tz.isBlank()) return ZoneId.of("UTC");
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            return ZoneId.of("UTC");
        }
    }

    private LocalTime parseTimeOrDefault(String hhmm) {
        if (hhmm == null || hhmm.isBlank()) return LocalTime.of(19, 0);
        try {
            return LocalTime.parse(hhmm);
        } catch (DateTimeParseException e) {
            return LocalTime.of(19, 0);
        }
    }
}
