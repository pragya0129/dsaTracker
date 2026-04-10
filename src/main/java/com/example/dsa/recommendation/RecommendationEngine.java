package com.example.dsa.recommendation;

import com.example.dsa.challenge.Problem;
import com.example.dsa.platform.TopicStats;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Pure computation class — no Spring repos injected.
 * All data passed in; only does math, scoring, and ranking.
 */
@Component
public class RecommendationEngine {

    // Mastery target weights per topic
    private static final Map<String, Integer> TOPIC_TARGETS = Map.ofEntries(
            Map.entry("arrays", 40),
            Map.entry("strings", 30),
            Map.entry("linked list", 25),
            Map.entry("trees", 35),
            Map.entry("graphs", 30),
            Map.entry("dynamic programming", 40),
            Map.entry("backtracking", 20),
            Map.entry("sorting", 20),
            Map.entry("binary search", 20),
            Map.entry("stack", 20),
            Map.entry("queue", 15),
            Map.entry("heap", 20),
            Map.entry("greedy", 25),
            Map.entry("math", 20),
            Map.entry("bit manipulation", 15));
    public static final int DEFAULT_TARGET = 25;

    // Weighted mastery target (easy problems count less toward mastery)
    private static final Map<String, Integer> WEIGHTED_TARGETS = Map.ofEntries(
            Map.entry("arrays", 80), // 40×2
            Map.entry("strings", 60),
            Map.entry("linked list", 50),
            Map.entry("trees", 70),
            Map.entry("graphs", 60),
            Map.entry("dynamic programming", 80),
            Map.entry("backtracking", 40),
            Map.entry("sorting", 40),
            Map.entry("binary search", 40),
            Map.entry("stack", 40),
            Map.entry("queue", 30),
            Map.entry("heap", 40),
            Map.entry("greedy", 50),
            Map.entry("math", 40),
            Map.entry("bit manipulation", 30));

    // ── Learning stage constants ──
    public enum LearningStage {
        BEGINNER, INTERMEDIATE, ADVANCED
    }

    /** Compute BEGINNER / INTERMEDIATE / ADVANCED from global solve distribution */
    public LearningStage learningStage(int easy, int medium, int hard) {
        if (easy < 30)
            return LearningStage.BEGINNER;
        if (easy >= 30 && medium < 50)
            return LearningStage.INTERMEDIATE;
        return LearningStage.ADVANCED;
    }

    /**
     * Weighted skill score (0.0–1.0):
     * score = (easy×1 + medium×2 + hard×3) / weighted_target
     * Requires per-difficulty breakdown — falls back to simple ratio if not
     * available.
     */
    public double weightedSkillScore(String topic, int easySolved, int mediumSolved, int hardSolved) {
        int target = WEIGHTED_TARGETS.getOrDefault(topic.toLowerCase(), DEFAULT_TARGET * 2);
        double raw = (easySolved * 1.0) + (mediumSolved * 2.0) + (hardSolved * 3.0);
        return Math.min(1.0, raw / target);
    }

    /** Simple skill score (fallback — uses total solved count only) */
    public double skillScore(String topic, int solvedCount) {
        int target = TOPIC_TARGETS.getOrDefault(topic.toLowerCase(), DEFAULT_TARGET);
        return Math.min(1.0, (double) solvedCount / target);
    }

    /** Recommended difficulty for a given learning stage + topic skill */
    public String difficultyForStageAndSkill(LearningStage stage, double topicSkill) {
        return switch (stage) {
            case BEGINNER -> topicSkill < 0.5 ? "Easy" : "Medium";
            case INTERMEDIATE -> topicSkill < 0.3 ? "Easy" : topicSkill < 0.7 ? "Medium" : "Hard";
            case ADVANCED -> topicSkill < 0.5 ? "Medium" : "Hard";
        };
    }

    /** Global difficulty recommendation (used for fallback candidates) */
    public String recommendedDifficulty(int easy, int medium, int hard) {
        if (easy < 30)
            return "Easy";
        if (medium < 50)
            return "Medium";
        if (hard < 20)
            return "Hard";
        return "Medium";
    }

    /**
     * Score and rank problems with improved weights:
     * topicWeakness × 6, difficultyMatch × 4, platformDiversity × 2, novelty × 1,
     * random 0–1
     */
    public List<ScoredProblem> rankProblems(
            List<Problem> candidates,
            List<TopicStats> userTopics,
            LearningStage stage,
            Set<String> usedPlatforms,
            Set<Long> recommendedBefore) {

        // Build skill map (topic → skill 0.0–1.0)
        Map<String, Double> skillMap = new HashMap<>();
        for (TopicStats ts : userTopics) {
            skillMap.put(ts.getTopic().toLowerCase(), skillScore(ts.getTopic(), ts.getSolvedCount()));
        }

        List<ScoredProblem> scored = new ArrayList<>();
        Random rng = new Random();

        for (Problem p : candidates) {
            double score = 0;
            String topic = p.getTopic() != null ? p.getTopic().toLowerCase() : "";
            double topicSkill = skillMap.getOrDefault(topic, 0.0);
            double priority = 1.0 - topicSkill; // higher priority = weaker topic

            // +6 for weak topic (scaled by how weak it is)
            score += priority * 6.0;

            // +4 for correct difficulty match for this stage + skill
            String expectedDiff = difficultyForStageAndSkill(stage, topicSkill);
            if (p.getDifficulty() != null && p.getDifficulty().equalsIgnoreCase(expectedDiff))
                score += 4;

            // +2 for platform diversity
            String plat = p.getPlatform() != null ? p.getPlatform().toLowerCase() : "";
            if (!usedPlatforms.contains(plat))
                score += 2;

            // +1 novelty — prefer problems not previously recommended
            if (!recommendedBefore.contains(p.getId()))
                score += 1;

            // 0–1 random factor
            score += rng.nextDouble();

            scored.add(new ScoredProblem(p, score, buildReason(p, topicSkill, stage)));
        }

        scored.sort((a, b) -> Double.compare(b.score(), a.score()));
        return scored;
    }

    /** Identify weakest topics sorted by skill score ascending */
    public List<WeakTopicResult> weakTopics(List<TopicStats> userTopics, int limit) {
        return userTopics.stream()
                .map(ts -> {
                    double skill = skillScore(ts.getTopic(), ts.getSolvedCount());
                    int target = TOPIC_TARGETS.getOrDefault(ts.getTopic().toLowerCase(), DEFAULT_TARGET);
                    return new WeakTopicResult(ts.getTopic(), ts.getSolvedCount(), target, skill);
                })
                .sorted(Comparator.comparingDouble(WeakTopicResult::skillScore))
                .limit(limit)
                .collect(Collectors.toList());
    }

    /**
     * Build balanced set of 4 recommendations (weak, progression, stretch,
     * exploration)
     */
    public List<ScoredProblem> buildBalancedSet(
            List<ScoredProblem> ranked,
            List<TopicStats> userTopics,
            LearningStage stage) {

        List<ScoredProblem> result = new ArrayList<>();
        Set<String> usedTopics = new HashSet<>();
        Set<String> usedDiffs = new HashSet<>();

        // Slot 1 — Weak topic problem
        ranked.stream()
                .filter(sp -> !usedTopics.contains(topicOf(sp)))
                .findFirst().ifPresent(sp -> {
                    result.add(sp);
                    usedTopics.add(topicOf(sp));
                    usedDiffs.add(diffOf(sp));
                });

        // Slot 2 — Different topic (progression)
        ranked.stream()
                .filter(sp -> !usedTopics.contains(topicOf(sp)))
                .findFirst().ifPresent(sp -> {
                    result.add(sp);
                    usedTopics.add(topicOf(sp));
                    usedDiffs.add(diffOf(sp));
                });

        // Slot 3 — Stretch problem (one difficulty higher or Hard)
        String stretchDiff = stage == LearningStage.BEGINNER ? "Medium"
                : stage == LearningStage.INTERMEDIATE ? "Hard" : "Hard";
        ranked.stream()
                .filter(sp -> !usedTopics.contains(topicOf(sp))
                        && diffOf(sp).equalsIgnoreCase(stretchDiff))
                .findFirst().ifPresent(sp -> {
                    result.add(sp);
                    usedTopics.add(topicOf(sp));
                });

        // Slot 4 — Exploration (random topic not yet covered)
        ranked.stream()
                .filter(sp -> !result.contains(sp))
                .skip(3)
                .findFirst()
                .ifPresent(result::add);

        // Pad to 5 if needed
        for (ScoredProblem sp : ranked) {
            if (result.size() >= 5)
                break;
            if (!result.contains(sp))
                result.add(sp);
        }

        return result;
    }

    private String topicOf(ScoredProblem sp) {
        return sp.problem().getTopic() != null ? sp.problem().getTopic().toLowerCase() : "";
    }

    private String diffOf(ScoredProblem sp) {
        return sp.problem().getDifficulty() != null ? sp.problem().getDifficulty() : "";
    }

    private String buildReason(Problem p, double skillScore, LearningStage stage) {
        String topic = p.getTopic() != null ? p.getTopic() : "this topic";
        String pct = (int) (skillScore * 100) + "%";
        return switch (stage) {
            case BEGINNER -> skillScore < 0.30
                    ? topic + " is your weakest area (" + pct + " mastery) — build the foundation"
                    : "Solid start in " + topic + " — keep the momentum going";
            case INTERMEDIATE -> skillScore < 0.40
                    ? topic + " skill is low (" + pct + ") — this " + p.getDifficulty() + " will help"
                    : "You're transitioning from Easy → Medium in " + topic + " (" + pct + " mastery)";
            case ADVANCED -> skillScore < 0.60
                    ? "Push your " + topic + " skills to the next level (" + pct + " current mastery)"
                    : "This Hard " + topic + " problem will stretch your current ability";
        };
    }

    // ── Result types ──
    public record ScoredProblem(Problem problem, double score, String reason) {
    }

    public record WeakTopicResult(String topic, int solved, int target, double skillScore) {
        public String reason() {
            if (skillScore < 0.20)
                return "Critical gap — only " + solved + "/" + target + " solved";
            if (skillScore < 0.50)
                return "Needs work — " + solved + "/" + target + " solved";
            return "Developing — " + solved + "/" + target + " solved";
        }

        public int pct() {
            return (int) (skillScore * 100);
        }
    }
}
