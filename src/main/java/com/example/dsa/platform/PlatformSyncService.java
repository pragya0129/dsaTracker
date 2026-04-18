package com.example.dsa.platform;

import com.example.dsa.challenge.ChallengeService;
import com.example.dsa.user.UserInfoRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;

@Service
public class PlatformSyncService {

    private final PlatformAccountRepository platformAccountRepo;
    private final UserStatsRepository userStatsRepo;
    private final TopicStatsRepository topicStatsRepo;
    private final UserSolvedProblemRepository solvedProblemRepo;
    private final LeetCodeClient leetCodeClient;
    private final CodeforcesClient codeforcesClient;
    private final UserInfoRepository userInfoRepo;
    // @Lazy to avoid potential circular-dependency at startup
    private final ChallengeService challengeService;

    private final ObjectMapper mapper = new ObjectMapper();

    public PlatformSyncService(PlatformAccountRepository platformAccountRepo,
            UserStatsRepository userStatsRepo,
            TopicStatsRepository topicStatsRepo,
            UserSolvedProblemRepository solvedProblemRepo,
            LeetCodeClient leetCodeClient,
            CodeforcesClient codeforcesClient,
            UserInfoRepository userInfoRepo,
            @Lazy ChallengeService challengeService) {
        this.platformAccountRepo = platformAccountRepo;
        this.userStatsRepo = userStatsRepo;
        this.topicStatsRepo = topicStatsRepo;
        this.solvedProblemRepo = solvedProblemRepo;
        this.leetCodeClient = leetCodeClient;
        this.codeforcesClient = codeforcesClient;
        this.userInfoRepo = userInfoRepo;
        this.challengeService = challengeService;
    }

    /** Link a platform account (or update username if already linked) */
    @Transactional
    public PlatformAccount linkPlatform(String userId, String platform, String username) {
        PlatformAccount account = platformAccountRepo
                .findByUserIdAndPlatformName(userId, platform)
                .orElse(new PlatformAccount());

        account.setUserId(userId);
        account.setPlatformName(platform);
        account.setUsername(username);
        if (account.getAddedOn() == null)
            account.setAddedOn(LocalDateTime.now());

        PlatformAccount saved = platformAccountRepo.save(account);
        syncPlatformStats(userId, platform, username);
        return saved;
    }

    /** Sync stats from a given platform into DB */
    @Transactional
    public Map<String, Object> syncPlatformStats(String userId, String platform, String username) {
        if ("leetcode".equalsIgnoreCase(platform)) {
            return syncLeetCode(userId, username);
        } else if ("codeforces".equalsIgnoreCase(platform)) {
            return syncCodeforces(userId, username);
        }
        return Map.of("error", "Unsupported platform: " + platform);
    }

    /** Sync all linked platforms for a user */
    @Transactional
    public List<Map<String, Object>> syncAllPlatforms(String userId) {
        List<PlatformAccount> accounts = platformAccountRepo.findByUserId(userId);
        List<Map<String, Object>> results = new ArrayList<>();
        for (PlatformAccount acc : accounts) {
            results.add(syncPlatformStats(userId, acc.getPlatformName(), acc.getUsername()));
        }
        accounts.forEach(a -> a.setLastSynced(LocalDateTime.now()));
        platformAccountRepo.saveAll(accounts);
        return results;
    }

    /**
     * Live fetch calendar data from all platforms WITHOUT touching the DB.
     * Used for the heatmap endpoint (always fresh).
     */
    public Map<String, Integer> getLiveCalendar(String userId) {
        List<PlatformAccount> accounts = platformAccountRepo.findByUserId(userId);
        Map<String, Integer> merged = new LinkedHashMap<>();

        for (PlatformAccount acc : accounts) {
            Map<String, Object> stats = new HashMap<>();
            try {
                if ("leetcode".equalsIgnoreCase(acc.getPlatformName())) {
                    stats = leetCodeClient.fetchProfileStats(acc.getUsername());
                } else if ("codeforces".equalsIgnoreCase(acc.getPlatformName())) {
                    stats = codeforcesClient.fetchStats(acc.getUsername());
                }
                if (stats.containsKey("calendar")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Integer> cal = (Map<String, Integer>) stats.get("calendar");
                    if (cal != null)
                        cal.forEach((k, v) -> merged.merge(k, v, Integer::sum));
                }
            } catch (Exception e) {
                // skip failed platform
            }
        }
        return merged;
    }

    /** Get dashboard data from DB (fast — no live API calls). */
    public Map<String, Object> getDashboardData(String userId) {
        List<PlatformAccount> accounts = platformAccountRepo.findByUserId(userId);
        List<UserStats> statsList = userStatsRepo.findByUserId(userId);
        List<TopicStats> topics = topicStatsRepo.findByUserId(userId);

        int totalSolved = 0, easy = 0, medium = 0, hard = 0;
        List<Map<String, Object>> platformData = new ArrayList<>();

        // ── Merge per-platform calendars stored in DB ──
        // We compute the cross-platform streak from combined daily activity,
        // so a day counts as active if the user solved anything on ANY platform.
        Map<LocalDate, Integer> mergedDailyActivity = new LinkedHashMap<>();

        for (UserStats s : statsList) {
            totalSolved += s.getTotalSolved();
            easy += s.getEasyCount();
            medium += s.getMediumCount();
            hard += s.getHardCount();

            // Merge this platform's stored calendar into the combined map
            if (s.getCalendarJson() != null && !s.getCalendarJson().isBlank()) {
                try {
                    Map<String, Integer> cal = mapper.readValue(s.getCalendarJson(),
                            new TypeReference<Map<String, Integer>>() {});
                    for (Map.Entry<String, Integer> entry : cal.entrySet()) {
                        LocalDate date = epochToDate(entry.getKey());
                        if (date != null)
                            mergedDailyActivity.merge(date, entry.getValue(), Integer::sum);
                    }
                } catch (Exception ignored) {
                }
            }

            Map<String, Object> plat = new LinkedHashMap<>();
            plat.put("platform", s.getPlatform());
            plat.put("totalSolved", s.getTotalSolved());
            plat.put("easySolved", s.getEasyCount());
            plat.put("mediumSolved", s.getMediumCount());
            plat.put("hardSolved", s.getHardCount());
            plat.put("updatedAt", s.getUpdatedAt());

            accounts.stream()
                    .filter(a -> a.getPlatformName().equalsIgnoreCase(s.getPlatform()))
                    .findFirst()
                    .ifPresent(a -> plat.put("username", a.getUsername()));

            platformData.add(plat);
        }

        // ── Compute streaks from merged cross-platform activity ──
        int[] streaks = computeStreaks(mergedDailyActivity);
        int currentStreak = streaks[0];
        int longestStreak = streaks[1];

        List<Map<String, Object>> topicList = topics.stream()
                .sorted(Comparator.comparingInt(TopicStats::getSolvedCount).reversed())
                .map(t -> Map.of("topic", (Object) t.getTopic(), "count", (Object) t.getSolvedCount()))
                .toList();

        List<Map<String, Object>> linkedPlatforms = accounts.stream()
                .map(a -> Map.of(
                        "platform", (Object) a.getPlatformName(),
                        "username", (Object) a.getUsername(),
                        "lastSynced",
                        (Object) (a.getLastSynced() != null ? a.getLastSynced().toString() : "Never")))
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalSolved", totalSolved);
        result.put("easySolved", easy);
        result.put("mediumSolved", medium);
        result.put("hardSolved", hard);
        result.put("currentStreak", currentStreak);
        result.put("longestStreak", longestStreak);
        result.put("platforms", platformData);
        result.put("topics", topicList);
        result.put("linkedPlatforms", linkedPlatforms);
        return result;
    }

    /* ── Private: LeetCode sync ── */
    private Map<String, Object> syncLeetCode(String userId, String username) {
        Map<String, Object> stats = leetCodeClient.fetchProfileStats(username);
        upsertStats(userId, "leetcode", stats);
        upsertTopics(userId, stats);

        Set<String> acSlugs = leetCodeClient.fetchAcSlugs(username);
        Set<String> newSlugs = persistSolvedSlugs(userId, "leetcode", acSlugs);
        if (!newSlugs.isEmpty())
            notifyChallengeSolves(userId, newSlugs);

        markSynced(userId, "leetcode");

        Map<String, Object> response = new LinkedHashMap<>(stats);
        response.put("syncedAt", LocalDateTime.now().toString());
        response.remove("topics");
        return response;
    }

    /* ── Private: Codeforces sync ── */
    private Map<String, Object> syncCodeforces(String userId, String username) {
        Map<String, Object> stats = codeforcesClient.fetchStats(username);
        Map<String, Object> info = codeforcesClient.fetchUserInfo(username);
        stats.putAll(info);

        upsertStats(userId, "codeforces", stats);
        upsertTopics(userId, stats);

        Set<String> acSlugs = codeforcesClient.fetchAcSlugs(username);
        Set<String> newSlugs = persistSolvedSlugs(userId, "codeforces", acSlugs);
        if (!newSlugs.isEmpty())
            notifyChallengeSolves(userId, newSlugs);

        markSynced(userId, "codeforces");

        Map<String, Object> response = new LinkedHashMap<>(stats);
        response.put("syncedAt", LocalDateTime.now().toString());
        response.remove("topics");
        return response;
    }

    /**
     * Persist newly-seen AC slugs. Returns only the brand-new ones so we
     * only notify the challenge service for genuinely new solves.
     *
     * <p>Previously did N SELECTs (one {@code existsByUserIdAndPlatformAndTitleSlug}
     * per slug) which at LeetCode's 500-submission profiles turned a single
     * sync into a 500-query storm. Now one SELECT fetches every known slug
     * for this {@code (user, platform)}, we do the diff in-memory, and
     * {@code saveAll} batches the INSERTs.
     */
    private Set<String> persistSolvedSlugs(String userId, String platform, Set<String> slugs) {
        if (slugs == null || slugs.isEmpty()) return Set.of();

        Set<String> existing = solvedProblemRepo.findSlugsByUserIdAndPlatform(userId, platform);

        Set<String> newSlugs = new LinkedHashSet<>();
        List<UserSolvedProblem> toInsert = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        for (String slug : slugs) {
            if (slug == null || slug.isBlank()) continue;
            if (existing.contains(slug)) continue;
            newSlugs.add(slug);
            toInsert.add(new UserSolvedProblem(userId, platform, slug, now));
        }
        if (!toInsert.isEmpty()) {
            solvedProblemRepo.saveAll(toInsert);
        }
        return newSlugs;
    }

    /**
     * Notify ChallengeService of newly-solved slugs so active contest
     * scoreboards update automatically on sync.
     */
    private void notifyChallengeSolves(String numericUserId, Set<String> newSlugs) {
        try {
            String email = userInfoRepo.findById(Integer.parseInt(numericUserId))
                    .map(u -> u.getEmail())
                    .orElse(null);
            if (email == null) return;
            for (String slug : newSlugs) {
                challengeService.detectAndRecordSolve(email, slug);
            }
        } catch (Exception e) {
            // Non-fatal: sync still succeeded
        }
    }

    /* ── Shared helpers ── */
    private void upsertStats(String userId, String platform, Map<String, Object> stats) {
        UserStats us = userStatsRepo.findByUserIdAndPlatform(userId, platform)
                .orElse(new UserStats());
        us.setUserId(userId);
        us.setPlatform(platform);
        us.setTotalSolved((Integer) stats.getOrDefault("totalSolved", 0));
        us.setEasyCount((Integer) stats.getOrDefault("easySolved", 0));
        us.setMediumCount((Integer) stats.getOrDefault("mediumSolved", 0));
        us.setHardCount((Integer) stats.getOrDefault("hardSolved", 0));
        // Don't store per-platform streak here — we compute it cross-platform in getDashboardData()
        us.setCurrentStreak(0);
        us.setLongestStreak(0);
        us.setUpdatedAt(LocalDateTime.now());

        // ── Persist this platform's calendar JSON for cross-platform streak ──
        @SuppressWarnings("unchecked")
        Map<String, Integer> calendar = (Map<String, Integer>) stats.getOrDefault("calendar", Map.of());
        if (!calendar.isEmpty()) {
            try {
                us.setCalendarJson(mapper.writeValueAsString(calendar));
            } catch (Exception ignored) {
            }
        }

        userStatsRepo.save(us);
    }

    private void upsertTopics(String userId, Map<String, Object> stats) {
        @SuppressWarnings("unchecked")
        Map<String, Integer> topics = (Map<String, Integer>) stats.getOrDefault("topics", Map.of());
        for (Map.Entry<String, Integer> e : topics.entrySet()) {
            if (e.getValue() > 0) {
                TopicStats existing = topicStatsRepo.findByUserIdAndTopic(userId, e.getKey())
                        .orElse(new TopicStats());
                existing.setUserId(userId);
                existing.setTopic(e.getKey());
                existing.setSolvedCount(e.getValue());
                topicStatsRepo.save(existing);
            }
        }
    }

    private void markSynced(String userId, String platform) {
        platformAccountRepo.findByUserIdAndPlatformName(userId, platform)
                .ifPresent(acc -> {
                    acc.setLastSynced(LocalDateTime.now());
                    platformAccountRepo.save(acc);
                });
    }

    // ═══════════════════════════════════════════════════════════
    // Streak computation helpers (delegated to StreakCalculator)
    // ═══════════════════════════════════════════════════════════

    /**
     * Convert a Unix epoch string (seconds) to a UTC LocalDate.
     * Returns null if unparseable. Kept for the
     * {@link #getDashboardData(String)} path which currently reads each
     * platform's stored calendar_json one entry at a time.
     */
    private LocalDate epochToDate(String epochStr) {
        try {
            long epoch = Long.parseLong(epochStr);
            return Instant.ofEpochSecond(epoch).atOffset(ZoneOffset.UTC).toLocalDate();
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Compute [current, longest] streaks from a merged daily-activity map.
     * Thin wrapper so callers don't have to reach for the util class; the
     * actual math lives in {@link StreakCalculator} and is shared with
     * {@link LeetCodeClient}'s per-platform longestStreak computation.
     */
    private int[] computeStreaks(Map<LocalDate, Integer> dailyActivity) {
        return StreakCalculator.compute(dailyActivity);
    }
}
