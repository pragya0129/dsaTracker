package com.example.dsa.recommendation;

import com.example.dsa.challenge.Problem;
import com.example.dsa.challenge.ProblemRepository;
import com.example.dsa.platform.*;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private final RecommendationEngine          engine;
    private final ProblemFetchService           fetchService;
    private final ProblemRepository             problemRepo;
    private final TopicStatsRepository          topicStatsRepo;
    private final UserStatsRepository           userStatsRepo;
    private final PlatformAccountRepository     platformAccountRepo;
    private final UserSolvedProblemRepository   solvedProblemRepo;
    private final DailyMissionService           missionService;   // ← dedicated bean

    public RecommendationService(
            RecommendationEngine engine,
            ProblemFetchService fetchService,
            ProblemRepository problemRepo,
            TopicStatsRepository topicStatsRepo,
            UserStatsRepository userStatsRepo,
            PlatformAccountRepository platformAccountRepo,
            UserSolvedProblemRepository solvedProblemRepo,
            DailyMissionService missionService) {
        this.engine              = engine;
        this.fetchService        = fetchService;
        this.problemRepo         = problemRepo;
        this.topicStatsRepo      = topicStatsRepo;
        this.userStatsRepo       = userStatsRepo;
        this.platformAccountRepo = platformAccountRepo;
        this.solvedProblemRepo   = solvedProblemRepo;
        this.missionService      = missionService;
    }

    // ── Main recommendations endpoint ──────────────────────────────────────────

    /**
     * Returns:
     *  - dailyMission  : stable throughout the day, refreshed only when completed
     *  - recommendations: up to (limit-1) problems that re-shuffle on each request,
     *                     spanning Easy/Medium/Hard across ALL the user's weak topics
     *                     from ALL linked platforms (LeetCode + Codeforces, etc.)
     *
     * NOT @Transactional — this method calls external HTTP APIs (LeetCode, CF).
     * Mission persistence is handled by DailyMissionService in its own transaction.
     */
    public Map<String, Object> dailyRecommendations(String userId, int limit) {

        // 1. User's linked platforms (e.g. ["leetcode","codeforces"])
        List<String> platforms = linkedPlatforms(userId);

        // 2. Problems already solved — used to exclude from suggestions
        Set<String> solvedSlugs = solvedProblemRepo.findAllSlugsByUserId(userId);

        // 3. Aggregate solve counts across all platforms
        List<UserStats> allStats = userStatsRepo.findByUserId(userId);
        int easy   = sum(allStats, UserStats::getEasyCount);
        int medium = sum(allStats, UserStats::getMediumCount);
        int hard   = sum(allStats, UserStats::getHardCount);

        RecommendationEngine.LearningStage stage = engine.learningStage(easy, medium, hard);
        List<TopicStats> userTopics = topicStatsRepo.findByUserId(userId);

        // 4. Stable daily mission — same all day, new one when completed
        DailyMission mission = getOrCreateMission(userId, platforms, solvedSlugs, userTopics, stage);

        // Exclude the mission slug from the regular recs
        Set<String> excludedSlugs = new HashSet<>(solvedSlugs);
        excludedSlugs.add(mission.getTitleSlug());

        // 5. Top-5 weak topics (reduced from 8 to cut external API calls by ~37%)
        List<RecommendationEngine.WeakTopicResult> weak = engine.weakTopics(userTopics, 5);

        // 6. ── PARALLEL PREFETCH ──────────────────────────────────────────────
        //    Fire all topic × difficulty × platform HTTP requests in parallel.
        //    After this returns, every mergedForPlatforms call below hits only
        //    the in-memory cache — no blocking network I/O in the loops.
        List<String> topicNames = weak.stream()
                .map(RecommendationEngine.WeakTopicResult::topic)
                .collect(Collectors.toList());
        // Include empty string for the global fallback bucket
        List<String> allTopicsToFetch = new ArrayList<>(topicNames);
        if (!allTopicsToFetch.contains("")) allTopicsToFetch.add("");
        fetchService.prefetch(allTopicsToFetch, platforms);

        // 7. Build candidates — all weak topics, all difficulties, all platforms
        List<Problem> candidates = new ArrayList<>();
        for (RecommendationEngine.WeakTopicResult w : weak) {
            String topic = w.topic();
            for (String diff : List.of("Easy", "Medium", "Hard")) {
                List<Problem> db = problemRepo.findByTopicIgnoreCaseAndDifficultyIgnoreCase(topic, diff);
                fetchService.mergedForPlatforms(topic, diff, db, platforms).stream()
                        .filter(p -> !excludedSlugs.contains(p.getTitleSlug()))
                        .forEach(candidates::add);
            }
        }

        // 8. Fallback: global-difficulty problems (covers users with no topic stats yet)
        //    Only the user's recommended difficulty — not all 3 — to keep it lean
        String globalDiff = engine.recommendedDifficulty(easy, medium, hard);
        List<Problem> fallbackDb = problemRepo.findRandomByDifficulty(globalDiff);
        fetchService.mergedForPlatforms("", globalDiff, fallbackDb, platforms).stream()
                .filter(p -> !excludedSlugs.contains(p.getTitleSlug()))
                .forEach(candidates::add);

        // 9. Deduplicate, rank, balance
        Map<String, Problem> unique = new LinkedHashMap<>();
        candidates.forEach(p -> unique.putIfAbsent(p.getTitleSlug(), p));

        List<RecommendationEngine.ScoredProblem> ranked = engine.rankProblems(
                new ArrayList<>(unique.values()), userTopics, stage,
                new HashSet<>(), new HashSet<>());

        List<RecommendationEngine.ScoredProblem> balanced = engine.buildBalancedSet(ranked, userTopics, stage);
        int recLimit = Math.max(0, limit - 1); // one slot reserved for daily mission
        balanced = balanced.subList(0, Math.min(recLimit, balanced.size()));

        List<RecommendationDto> recommendations = balanced.stream()
                .map(this::toDto).collect(Collectors.toList());

        // 9. Skill snapshot (sorted weakest first)
        List<Map<String, Object>> skillSnapshot = userTopics.stream().map(ts -> {
            double sk = engine.skillScore(ts.getTopic(), ts.getSolvedCount());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("topic", ts.getTopic());
            m.put("solved", ts.getSolvedCount());
            m.put("target", RecommendationEngine.DEFAULT_TARGET);
            m.put("skillScore", Math.round(sk * 100.0) / 100.0);
            m.put("pct", (int) (sk * 100));
            return m;
        }).sorted(Comparator.comparingDouble(m -> (double) m.get("skillScore")))
                .collect(Collectors.toList());

        // 10. Assemble response
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dailyMission", missionToMap(mission));
        result.put("recommendations", recommendations);
        result.put("easyCount", easy);
        result.put("mediumCount", medium);
        result.put("hardCount", hard);
        result.put("learningStage", stage.name());
        result.put("globalRecommendedDifficulty", globalDiff);
        result.put("linkedPlatforms", platforms);
        result.put("weakTopics", weak.stream().map(w -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("topic", w.topic());
            m.put("solved", w.solved());
            m.put("target", w.target());
            m.put("skillScore", Math.round(w.skillScore() * 100.0) / 100.0);
            m.put("pct", w.pct());
            m.put("reason", w.reason());
            return m;
        }).collect(Collectors.toList()));
        result.put("skillSnapshot", skillSnapshot);
        return result;
    }

    // ── Complete mission endpoint ───────────────────────────────────────────────

    /**
     * Marks today's active mission as complete and immediately creates the next
     * one. Returns a map with "nextMission" so the frontend can update in place.
     */
    public Map<String, Object> completeMission(String userId) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        // Mark current active mission as complete (handled in its own transaction)
        missionService.markComplete(userId, today);

        // Build next mission
        List<String> platforms = linkedPlatforms(userId);
        Set<String> solvedSlugs = solvedProblemRepo.findAllSlugsByUserId(userId);
        List<TopicStats> userTopics = topicStatsRepo.findByUserId(userId);
        List<UserStats> allStats = userStatsRepo.findByUserId(userId);
        int easy   = sum(allStats, UserStats::getEasyCount);
        int medium = sum(allStats, UserStats::getMediumCount);
        int hard   = sum(allStats, UserStats::getHardCount);
        RecommendationEngine.LearningStage stage = engine.learningStage(easy, medium, hard);

        DailyMission next = getOrCreateMission(userId, platforms, solvedSlugs, userTopics, stage);
        return Map.of("nextMission", missionToMap(next), "message", "Well done! Here's your next challenge.");
    }

    /**
     * Called by PlatformSyncService after a sync — if one of the newly solved
     * slugs matches today's active daily mission, auto-marks it complete.
     */
    public void autoCompleteMissionIfSolved(String userId, Set<String> newlySolvedSlugs) {
        missionService.autoComplete(userId, newlySolvedSlugs);
    }

    // ── Weak topics & difficulty progress (unchanged) ──────────────────────────

    public Map<String, Object> weakTopics(String userId) {
        List<TopicStats> userTopics = topicStatsRepo.findByUserId(userId);
        List<RecommendationEngine.WeakTopicResult> weak = engine.weakTopics(userTopics, 5);
        return Map.of("weakTopics", weak.stream().map(w -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("topic", w.topic()); m.put("solved", w.solved());
            m.put("target", w.target());
            m.put("skillScore", Math.round(w.skillScore() * 100.0) / 100.0);
            m.put("pct", w.pct()); m.put("reason", w.reason());
            return m;
        }).collect(Collectors.toList()));
    }

    public Map<String, Object> difficultyProgress(String userId) {
        List<UserStats> all = userStatsRepo.findByUserId(userId);
        int easy   = sum(all, UserStats::getEasyCount);
        int medium = sum(all, UserStats::getMediumCount);
        int hard   = sum(all, UserStats::getHardCount);
        String rec   = engine.recommendedDifficulty(easy, medium, hard);
        String stage = engine.learningStage(easy, medium, hard).name();
        return Map.of(
                "recommendedDifficulty", rec,
                "learningStage", stage,
                "reason", buildDiffReason(easy, medium, hard, rec),
                "easyCount", easy, "mediumCount", medium, "hardCount", hard,
                "nextMilestone", nextMilestone(easy, medium, hard));
    }

    // ── Daily mission helpers ──────────────────────────────────────────────────

    private DailyMission getOrCreateMission(String userId, List<String> platforms,
                                             Set<String> solvedSlugs,
                                             List<TopicStats> userTopics,
                                             RecommendationEngine.LearningStage stage) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        // Pick a new problem — exclude already solved + already used today as missions
        List<String> usedToday = missionService.todaysSlugs(userId, today);
        Set<String> excluded = new HashSet<>(solvedSlugs);
        excluded.addAll(usedToday);

        Problem picked = pickMissionProblem(platforms, excluded, userTopics, stage);

        DailyMission m = new DailyMission();
        m.setUserId(userId);
        m.setMissionDate(today);
        long count = missionService.countToday(userId, today);
        m.setSequenceNumber((int) count + 1);
        m.setTitleSlug(picked.getTitleSlug());
        m.setTitle(picked.getTitle());
        m.setPlatform(picked.getPlatform() != null ? picked.getPlatform() : "LeetCode");
        m.setDifficulty(picked.getDifficulty() != null ? picked.getDifficulty() : "Medium");
        m.setTopic(picked.getTopic());
        m.setProblemUrl(picked.getProblemUrl());

        // findOrCreate handles the "already exists" check atomically in its own transaction
        return missionService.findOrCreate(userId, today, m);
    }

    /**
     * Picks the best mission problem:
     *  1. Medium problem on a weak topic from a linked platform
     *  2. Easy/Hard problem on a weak topic
     *  3. Any medium from a linked platform
     *  4. Absolute fallback to a hardcoded LC problem
     */
    private Problem pickMissionProblem(List<String> platforms, Set<String> excluded,
                                       List<TopicStats> userTopics,
                                       RecommendationEngine.LearningStage stage) {
        List<RecommendationEngine.WeakTopicResult> weak = engine.weakTopics(userTopics, 5);

        // Preferred difficulty: Medium (best learning ROI)
        String preferredDiff = stage == RecommendationEngine.LearningStage.BEGINNER ? "Easy" : "Medium";

        // Pass 1 — weak topic + preferred difficulty
        for (RecommendationEngine.WeakTopicResult w : weak) {
            List<Problem> db = problemRepo.findByTopicIgnoreCaseAndDifficultyIgnoreCase(w.topic(), preferredDiff);
            Optional<Problem> p = fetchService.mergedForPlatforms(w.topic(), preferredDiff, db, platforms)
                    .stream().filter(pr -> !excluded.contains(pr.getTitleSlug())).findFirst();
            if (p.isPresent()) return p.get();
        }

        // Pass 2 — weak topic + any difficulty
        for (RecommendationEngine.WeakTopicResult w : weak) {
            for (String diff : List.of("Easy", "Medium", "Hard")) {
                List<Problem> db = problemRepo.findByTopicIgnoreCaseAndDifficultyIgnoreCase(w.topic(), diff);
                Optional<Problem> p = fetchService.mergedForPlatforms(w.topic(), diff, db, platforms)
                        .stream().filter(pr -> !excluded.contains(pr.getTitleSlug())).findFirst();
                if (p.isPresent()) return p.get();
            }
        }

        // Pass 3 — any medium from linked platforms
        List<Problem> anyMedium = problemRepo.findRandomByDifficulty("Medium");
        Optional<Problem> p = fetchService.mergedForPlatforms("", "Medium", anyMedium, platforms)
                .stream().filter(pr -> !excluded.contains(pr.getTitleSlug())).findFirst();
        if (p.isPresent()) return p.get();

        // Absolute fallback
        Problem fallback = new Problem();
        fallback.setTitle("Two Sum");
        fallback.setTitleSlug("two-sum");
        fallback.setDifficulty("Easy");
        fallback.setPlatform("LeetCode");
        fallback.setTopic("arrays");
        fallback.setProblemUrl("https://leetcode.com/problems/two-sum/");
        return fallback;
    }

    private Map<String, Object> missionToMap(DailyMission m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("titleSlug",  m.getTitleSlug());
        map.put("title",      m.getTitle());
        map.put("platform",   m.getPlatform());
        map.put("difficulty", m.getDifficulty());
        map.put("topic",      m.getTopic());
        map.put("problemUrl", m.getProblemUrl());
        map.put("completed",  m.isCompleted());
        map.put("date",       m.getMissionDate().toString());
        map.put("sequence",   m.getSequenceNumber());
        return map;
    }

    // ── Shared helpers ─────────────────────────────────────────────────────────

    private List<String> linkedPlatforms(String userId) {
        return platformAccountRepo.findByUserId(userId).stream()
                .map(a -> a.getPlatformName().toLowerCase())
                .collect(Collectors.toList());
    }

    private int sum(List<UserStats> stats,
                    java.util.function.Function<UserStats, Integer> getter) {
        return stats.stream().mapToInt(s -> {
            Integer v = getter.apply(s);
            return v != null ? v : 0;
        }).sum();
    }

    private String buildDiffReason(int easy, int medium, int hard, String rec) {
        return switch (rec) {
            case "Easy"   -> "You've solved " + easy + " easy problems. Build your foundation first.";
            case "Medium" -> "With " + easy + " easy problems solved, it's time to push into Medium.";
            default       -> easy + " easy + " + medium + " medium solved. You're ready for Hard.";
        };
    }

    private String nextMilestone(int easy, int medium, int hard) {
        if (easy   < 30) return "Solve " + (30 - easy)   + " more Easy problems to unlock Medium focus";
        if (medium < 50) return "Solve " + (50 - medium) + " more Medium problems to unlock Hard focus";
        if (hard   < 20) return "Solve " + (20 - hard)   + " more Hard problems to reach Expert level";
        return "You're at Expert level — keep grinding! 🔥";
    }

    private RecommendationDto toDto(RecommendationEngine.ScoredProblem sp) {
        RecommendationDto d = new RecommendationDto();
        Problem p = sp.problem();
        if (p.getId() != null) d.setProblemId(p.getId());
        d.setTitleSlug(p.getTitleSlug());
        d.setTitle(p.getTitle());
        d.setPlatform(p.getPlatform());
        d.setDifficulty(p.getDifficulty());
        d.setTopic(p.getTopic());
        d.setProblemUrl(p.getProblemUrl());
        d.setReason(sp.reason());
        d.setScore(Math.round(sp.score() * 100.0) / 100.0);
        return d;
    }
}
