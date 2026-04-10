package com.example.dsa.recommendation;

import com.example.dsa.challenge.Problem;
import com.example.dsa.challenge.ProblemRepository;
import com.example.dsa.platform.TopicStats;
import com.example.dsa.platform.UserStats;
import com.example.dsa.platform.TopicStatsRepository;
import com.example.dsa.platform.UserStatsRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private final RecommendationEngine engine;
    private final ProblemFetchService fetchService;
    private final ProblemRepository problemRepo;
    private final TopicStatsRepository topicStatsRepo;
    private final UserStatsRepository userStatsRepo;

    public RecommendationService(RecommendationEngine engine,
            ProblemFetchService fetchService,
            ProblemRepository problemRepo,
            TopicStatsRepository topicStatsRepo,
            UserStatsRepository userStatsRepo) {
        this.engine = engine;
        this.fetchService = fetchService;
        this.problemRepo = problemRepo;
        this.topicStatsRepo = topicStatsRepo;
        this.userStatsRepo = userStatsRepo;
    }

    /** Daily recommendations — skill-scored, stage-aware, balanced */
    public Map<String, Object> dailyRecommendations(String userId, int limit) {
        List<TopicStats> userTopics = topicStatsRepo.findByUserId(userId);
        List<UserStats> allStats = userStatsRepo.findByUserId(userId);

        // Aggregate difficulty counts across all platforms
        int easy = allStats.stream().mapToInt(s -> s.getEasyCount() != null ? s.getEasyCount() : 0).sum();
        int medium = allStats.stream().mapToInt(s -> s.getMediumCount() != null ? s.getMediumCount() : 0).sum();
        int hard = allStats.stream().mapToInt(s -> s.getHardCount() != null ? s.getHardCount() : 0).sum();

        RecommendationEngine.LearningStage stage = engine.learningStage(easy, medium, hard);
        String globalDiff = engine.recommendedDifficulty(easy, medium, hard);

        // Identify weak topics (bottom 3)
        List<RecommendationEngine.WeakTopicResult> weak = engine.weakTopics(userTopics, 3);
        Set<String> weakTopicNames = weak.stream()
                .map(w -> w.topic().toLowerCase()).collect(Collectors.toSet());

        // Build candidate pool: DB + live problems from LeetCode (cached 6h)
        List<Problem> candidates = new ArrayList<>();
        for (String topic : weakTopicNames) {
            double skill = engine.skillScore(topic,
                    userTopics.stream().filter(t -> t.getTopic().equalsIgnoreCase(topic))
                            .mapToInt(TopicStats::getSolvedCount).sum());
            String diff = engine.difficultyForStageAndSkill(stage, skill);

            // DB problems
            List<Problem> dbProblems = problemRepo.findByTopicIgnoreCaseAndDifficultyIgnoreCase(topic, diff);
            // Merge with live-fetched (cached) problems
            candidates.addAll(fetchService.mergedProblems(topic, diff, dbProblems));
        }
        // Add global-difficulty fallback candidates
        List<Problem> globalDb = problemRepo.findRandomByDifficulty(globalDiff);
        candidates.addAll(fetchService.mergedProblems("", globalDiff, globalDb));

        // Deduplicate by titleSlug
        Map<String, Problem> unique = new LinkedHashMap<>();
        candidates.forEach(p -> unique.putIfAbsent(p.getTitleSlug(), p));

        // Score all candidates
        Set<String> usedPlatforms = new HashSet<>();
        Set<Long> recommendedBefore = new HashSet<>(); // future: load from cache
        List<RecommendationEngine.ScoredProblem> ranked = engine.rankProblems(new ArrayList<>(unique.values()),
                userTopics, stage,
                usedPlatforms, recommendedBefore);

        // Build balanced set (weak + progression + stretch + exploration)
        List<RecommendationEngine.ScoredProblem> balanced = engine.buildBalancedSet(ranked, userTopics, stage);
        balanced = balanced.subList(0, Math.min(limit, balanced.size()));

        // Convert to DTOs
        List<RecommendationDto> recommendations = balanced.stream()
                .map(this::toDto).collect(Collectors.toList());

        // Skill snapshot sorted by weakness
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

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recommendations", recommendations);
        result.put("easyCount", easy);
        result.put("mediumCount", medium);
        result.put("hardCount", hard);
        result.put("learningStage", stage.name());
        result.put("globalRecommendedDifficulty", globalDiff);
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

    /** Weakness analysis */
    public Map<String, Object> weakTopics(String userId) {
        List<TopicStats> userTopics = topicStatsRepo.findByUserId(userId);
        List<RecommendationEngine.WeakTopicResult> weak = engine.weakTopics(userTopics, 5);
        return Map.of("weakTopics", weak.stream().map(w -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("topic", w.topic());
            m.put("solved", w.solved());
            m.put("target", w.target());
            m.put("skillScore", Math.round(w.skillScore() * 100.0) / 100.0);
            m.put("pct", w.pct());
            m.put("reason", w.reason());
            return m;
        }).collect(Collectors.toList()));
    }

    /** Difficulty progression */
    public Map<String, Object> difficultyProgress(String userId) {
        List<UserStats> all = userStatsRepo.findByUserId(userId);
        int easy = all.stream().mapToInt(s -> s.getEasyCount() != null ? s.getEasyCount() : 0).sum();
        int medium = all.stream().mapToInt(s -> s.getMediumCount() != null ? s.getMediumCount() : 0).sum();
        int hard = all.stream().mapToInt(s -> s.getHardCount() != null ? s.getHardCount() : 0).sum();
        String rec = engine.recommendedDifficulty(easy, medium, hard);
        String stage = engine.learningStage(easy, medium, hard).name();
        return Map.of(
                "recommendedDifficulty", rec,
                "learningStage", stage,
                "reason", buildDiffReason(easy, medium, hard, rec),
                "easyCount", easy,
                "mediumCount", medium,
                "hardCount", hard,
                "nextMilestone", nextMilestone(easy, medium, hard));
    }

    private String buildDiffReason(int easy, int medium, int hard, String rec) {
        return switch (rec) {
            case "Easy" -> "You've solved " + easy + " easy problems. Build your foundation first.";
            case "Medium" -> "With " + easy + " easy problems solved, it's time to push into Medium.";
            default -> easy + " easy + " + medium + " medium problems solved. You're ready for Hard.";
        };
    }

    private String nextMilestone(int easy, int medium, int hard) {
        if (easy < 30)
            return "Solve " + (30 - easy) + " more Easy problems to unlock Medium focus";
        if (medium < 50)
            return "Solve " + (50 - medium) + " more Medium problems to unlock Hard focus";
        if (hard < 20)
            return "Solve " + (20 - hard) + " more Hard problems to reach Expert level";
        return "You're at Expert level — keep grinding! 🔥";
    }

    private RecommendationDto toDto(RecommendationEngine.ScoredProblem sp) {
        RecommendationDto d = new RecommendationDto();
        Problem p = sp.problem();
        if (p.getId() != null)
            d.setProblemId(p.getId());
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
