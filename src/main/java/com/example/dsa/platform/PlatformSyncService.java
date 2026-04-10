package com.example.dsa.platform;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class PlatformSyncService {

    private final PlatformAccountRepository platformAccountRepo;
    private final UserStatsRepository userStatsRepo;
    private final TopicStatsRepository topicStatsRepo;
    private final LeetCodeClient leetCodeClient;
    private final CodeforcesClient codeforcesClient;

    public PlatformSyncService(PlatformAccountRepository platformAccountRepo,
            UserStatsRepository userStatsRepo,
            TopicStatsRepository topicStatsRepo,
            LeetCodeClient leetCodeClient,
            CodeforcesClient codeforcesClient) {
        this.platformAccountRepo = platformAccountRepo;
        this.userStatsRepo = userStatsRepo;
        this.topicStatsRepo = topicStatsRepo;
        this.leetCodeClient = leetCodeClient;
        this.codeforcesClient = codeforcesClient;
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

        // Immediately sync stats after linking
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

    /** Live fetch calendar data from all platforms without waiting for DB sync */
    public Map<String, Integer> getLiveCalendar(String userId) {
        List<PlatformAccount> accounts = platformAccountRepo.findByUserId(userId);
        Map<String, Integer> mergedCalendar = new LinkedHashMap<>();

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
                    if (cal != null) {
                        cal.forEach((k, v) -> mergedCalendar.merge(k, v, Integer::sum));
                    }
                }
            } catch (Exception e) {
            }
        }
        return mergedCalendar;
    }

    /** Get dashboard data for a user from DB */
    public Map<String, Object> getDashboardData(String userId) {
        List<PlatformAccount> accounts = platformAccountRepo.findByUserId(userId);
        List<UserStats> statsList = userStatsRepo.findByUserId(userId);
        List<TopicStats> topics = topicStatsRepo.findByUserId(userId);

        int totalSolved = 0, easy = 0, medium = 0, hard = 0;
        int currentStreak = 0, longestStreak = 0;
        List<Map<String, Object>> platformData = new ArrayList<>();

        for (UserStats s : statsList) {
            totalSolved += s.getTotalSolved();
            easy += s.getEasyCount();
            medium += s.getMediumCount();
            hard += s.getHardCount();
            if (s.getCurrentStreak() > currentStreak)
                currentStreak = s.getCurrentStreak();
            if (s.getLongestStreak() > longestStreak)
                longestStreak = s.getLongestStreak();

            Map<String, Object> plat = new LinkedHashMap<>();
            plat.put("platform", s.getPlatform());
            plat.put("totalSolved", s.getTotalSolved());
            plat.put("easySolved", s.getEasyCount());
            plat.put("mediumSolved", s.getMediumCount());
            plat.put("hardSolved", s.getHardCount());
            plat.put("currentStreak", s.getCurrentStreak());
            plat.put("longestStreak", s.getLongestStreak());
            plat.put("updatedAt", s.getUpdatedAt());

            accounts.stream()
                    .filter(a -> a.getPlatformName().equalsIgnoreCase(s.getPlatform()))
                    .findFirst()
                    .ifPresent(a -> plat.put("username", a.getUsername()));

            platformData.add(plat);
        }

        List<Map<String, Object>> topicList = topics.stream()
                .sorted(Comparator.comparingInt(TopicStats::getSolvedCount).reversed())
                .map(t -> Map.of("topic", (Object) t.getTopic(), "count", (Object) t.getSolvedCount()))
                .toList();

        List<Map<String, Object>> linkedPlatforms = accounts.stream()
                .map(a -> Map.of(
                        "platform", (Object) a.getPlatformName(),
                        "username", (Object) a.getUsername(),
                        "lastSynced", (Object) (a.getLastSynced() != null ? a.getLastSynced().toString() : "Never")))
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
        markSynced(userId, "codeforces");

        Map<String, Object> response = new LinkedHashMap<>(stats);
        response.put("syncedAt", LocalDateTime.now().toString());
        response.remove("topics");
        return response;
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
        us.setCurrentStreak((Integer) stats.getOrDefault("currentStreak", 0));
        us.setLongestStreak((Integer) stats.getOrDefault("longestStreak", 0));
        us.setUpdatedAt(LocalDateTime.now());
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
                existing.setSolvedCount(e.getValue() + (existing.getId() != null ? 0 : 0));
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
}
