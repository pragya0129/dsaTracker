package com.example.dsa.platform;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Shared streak math. Pulled out of {@code PlatformSyncService} so
 * {@link LeetCodeClient} can also compute a correct per-platform longest
 * streak from its own calendar — previously it was wrongly mapped to
 * {@code totalActiveDays} which is "days with any submission ever", not
 * the longest consecutive-day run.
 */
public final class StreakCalculator {

    private StreakCalculator() {}

    /**
     * Compute {@code [currentStreak, longestStreak]} from a map of
     * {@code date → submission count}. A day counts as active when its count
     * is positive. The current streak is alive if there's activity today or
     * yesterday (same convention used everywhere else in the app).
     */
    public static int[] compute(Map<LocalDate, Integer> dailyActivity) {
        if (dailyActivity == null || dailyActivity.isEmpty()) {
            return new int[]{0, 0};
        }

        Set<LocalDate> activeDays = dailyActivity.entrySet().stream()
                .filter(e -> e.getValue() != null && e.getValue() > 0)
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());

        if (activeDays.isEmpty()) return new int[]{0, 0};

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate yesterday = today.minusDays(1);

        // ── Current streak ──
        int current = 0;
        LocalDate cursor = activeDays.contains(today) ? today
                : activeDays.contains(yesterday) ? yesterday
                : null;
        if (cursor != null) {
            while (activeDays.contains(cursor)) {
                current++;
                cursor = cursor.minusDays(1);
            }
        }

        // ── Longest streak ──
        List<LocalDate> sorted = new ArrayList<>(activeDays);
        Collections.sort(sorted);
        int longest = 1, run = 1;
        for (int i = 1; i < sorted.size(); i++) {
            if (sorted.get(i).equals(sorted.get(i - 1).plusDays(1))) {
                run++;
                longest = Math.max(longest, run);
            } else {
                run = 1;
            }
        }

        return new int[]{current, longest};
    }

    /**
     * Convenience: platforms hand us calendars keyed by {@code epochSeconds}
     * (as string). Re-bucket into {@link LocalDate} in the given zone so
     * callers can hand it to {@link #compute}. UTC is the safe default for
     * data returned from the raw platform APIs.
     */
    public static Map<LocalDate, Integer> epochMapToDailyMap(
            Map<String, Integer> epochCalendar, ZoneId zone) {
        Map<LocalDate, Integer> out = new LinkedHashMap<>();
        if (epochCalendar == null) return out;
        for (Map.Entry<String, Integer> e : epochCalendar.entrySet()) {
            if (e.getValue() == null || e.getValue() <= 0) continue;
            try {
                long epoch = Long.parseLong(e.getKey());
                LocalDate d = Instant.ofEpochSecond(epoch).atZone(zone).toLocalDate();
                out.merge(d, e.getValue(), Integer::sum);
            } catch (NumberFormatException ignored) {
                // Non-numeric key — skip rather than taint the result.
            }
        }
        return out;
    }
}
