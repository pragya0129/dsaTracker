package com.example.dsa.recommendation;

import com.example.dsa.challenge.Problem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * Fetches problems from LeetCode GraphQL API and Codeforces REST API.
 *
 * Results are stored in a manual ConcurrentHashMap cache (bypasses Spring AOP
 * proxy limitations that break @Cacheable when called from the same class or
 * from async lambdas).
 *
 * Call {@link #prefetch(List, List)} at the start of any method that needs many
 * topic/difficulty/platform combinations — it fires all HTTP requests in parallel
 * and populates the cache before the sequential loops run.
 */
@Service
public class ProblemFetchService {

    private static final String LEETCODE_GQL = "https://leetcode.com/graphql";
    private static final String CF_API       = "https://codeforces.com/api/problemset.problems";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Shared HTTP client with a 6-second per-request timeout. */
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .build();

    /**
     * Thread pool for parallel prefetch — bounded at 12 so we don't flood the
     * external APIs with too many simultaneous connections.
     */
    private static final Executor FETCH_POOL =
            Executors.newFixedThreadPool(12, r -> {
                Thread t = new Thread(r, "problem-fetch");
                t.setDaemon(true);
                return t;
            });

    /** Manual in-memory cache: cacheKey → problem list. Thread-safe. */
    private final ConcurrentHashMap<String, List<Problem>> cache = new ConcurrentHashMap<>();

    // ── LeetCode topic → tag slug ──────────────────────────────────────────────
    private static final Map<String, String> LC_TAGS = Map.ofEntries(
            Map.entry("arrays",              "array"),
            Map.entry("strings",             "string"),
            Map.entry("linked list",         "linked-list"),
            Map.entry("trees",               "tree"),
            Map.entry("graphs",              "graph"),
            Map.entry("dynamic programming", "dynamic-programming"),
            Map.entry("backtracking",        "backtracking"),
            Map.entry("sorting",             "sorting"),
            Map.entry("binary search",       "binary-search"),
            Map.entry("stack",               "stack"),
            Map.entry("queue",               "queue"),
            Map.entry("heap",                "heap-priority-queue"),
            Map.entry("greedy",              "greedy"),
            Map.entry("math",                "math"),
            Map.entry("bit manipulation",    "bit-manipulation"));

    // ── Codeforces topic → tag ─────────────────────────────────────────────────
    private static final Map<String, String> CF_TAGS = Map.ofEntries(
            Map.entry("arrays",              "arrays"),
            Map.entry("strings",             "strings"),
            Map.entry("linked list",         "data structures"),
            Map.entry("trees",               "trees"),
            Map.entry("graphs",              "graphs"),
            Map.entry("dynamic programming", "dp"),
            Map.entry("backtracking",        "brute force"),
            Map.entry("sorting",             "sortings"),
            Map.entry("binary search",       "binary search"),
            Map.entry("stack",               "data structures"),
            Map.entry("queue",               "data structures"),
            Map.entry("heap",                "data structures"),
            Map.entry("greedy",              "greedy"),
            Map.entry("math",                "math"),
            Map.entry("bit manipulation",    "bitmasks"));

    // Codeforces rating bands per difficulty
    private static final Map<String, int[]> CF_RANGE = Map.of(
            "Easy",   new int[]{800,  1300},
            "Medium", new int[]{1300, 1900},
            "Hard",   new int[]{1900, 3500});

    private static final List<String> ALL_DIFFS = List.of("Easy", "Medium", "Hard");

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Pre-warms the cache for every (topic × difficulty × platform) combination
     * in parallel. Blocks until all fetches complete or 10 seconds elapse.
     * Call this once at the start of a request before any sequential loops.
     *
     * @param topics    topic names to fetch (empty string = "any topic / no filter")
     * @param platforms lowercase platform names, e.g. ["leetcode", "codeforces"]
     */
    public void prefetch(List<String> topics, List<String> platforms) {
        List<CompletableFuture<Void>> futures = new ArrayList<>();

        for (String topic : topics) {
            for (String platform : platforms) {
                for (String diff : ALL_DIFFS) {
                    String key = cacheKey(platform, topic, diff);
                    if (!cache.containsKey(key)) {
                        // capture for lambda
                        String t = topic, p = platform, d = diff;
                        futures.add(CompletableFuture.runAsync(() -> {
                            List<Problem> result = doFetch(t, d, p);
                            cache.put(key, result);
                        }, FETCH_POOL));
                    }
                }
            }
        }

        if (!futures.isEmpty()) {
            try {
                CompletableFuture
                        .allOf(futures.toArray(new CompletableFuture[0]))
                        .get(10, TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                // partial results are fine — whatever completed is in the cache
            } catch (Exception ignored) {
                // individual fetch errors are already handled inside doFetch
            }
        }
    }

    /**
     * Returns merged problems for a topic + difficulty from every linked platform.
     * DB problems come first (they have real IDs & URLs); live-fetched ones fill gaps.
     * After calling {@link #prefetch}, this method only touches the in-memory cache.
     */
    public List<Problem> mergedForPlatforms(String topic, String difficulty,
                                            List<Problem> dbProblems,
                                            List<String> linkedPlatforms) {
        Map<String, Problem> merged = new LinkedHashMap<>();
        dbProblems.forEach(p -> merged.put(p.getTitleSlug(), p));

        for (String plat : linkedPlatforms) {
            List<Problem> live = fetchCached(topic, difficulty, plat);
            live.stream()
                    .filter(p -> !merged.containsKey(p.getTitleSlug()))
                    .forEach(p -> merged.put(p.getTitleSlug(), p));
        }
        return new ArrayList<>(merged.values());
    }

    /** Backwards-compatible wrapper — LeetCode only (used by old call-sites). */
    public List<Problem> mergedProblems(String topic, String difficulty, List<Problem> dbProblems) {
        return mergedForPlatforms(topic, difficulty, dbProblems, List.of("leetcode"));
    }

    // ── Cache helpers ──────────────────────────────────────────────────────────

    private String cacheKey(String platform, String topic, String difficulty) {
        return platform.toLowerCase() + "::" + topic.toLowerCase() + "::" + difficulty.toLowerCase();
    }

    /**
     * Returns cached results, fetching synchronously on a cache miss.
     * After prefetch() has run, this should always hit the cache.
     */
    private List<Problem> fetchCached(String topic, String difficulty, String platform) {
        String key = cacheKey(platform, topic, difficulty);
        return cache.computeIfAbsent(key, k -> doFetch(topic, difficulty, platform));
    }

    private List<Problem> doFetch(String topic, String difficulty, String platform) {
        if ("leetcode".equalsIgnoreCase(platform))   return doFetchLeetCode(topic, difficulty);
        if ("codeforces".equalsIgnoreCase(platform)) return doFetchCodeforces(topic, difficulty);
        return List.of();
    }

    // ── LeetCode fetcher ───────────────────────────────────────────────────────

    private List<Problem> doFetchLeetCode(String topic, String difficulty) {
        String tagSlug = LC_TAGS.getOrDefault(
                topic.toLowerCase(), topic.toLowerCase().replace(" ", "-"));
        String lcDiff = difficulty.toUpperCase();

        String body = """
                {
                  "query": "query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) { problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) { questions: data { title titleSlug difficulty } } }",
                  "variables": {
                    "categorySlug": "",
                    "skip": 0,
                    "limit": 20,
                    "filters": { "difficulty": "%s", "tags": ["%s"] }
                  }
                }
                """.formatted(lcDiff, tagSlug);
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(LEETCODE_GQL))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .header("Content-Type", "application/json")
                    .header("Referer", "https://leetcode.com")
                    .timeout(Duration.ofSeconds(6))
                    .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return List.of();

            JsonNode root = MAPPER.readTree(resp.body());
            JsonNode qs = root.path("data").path("problemsetQuestionList").path("questions");
            if (!qs.isArray()) return List.of();

            List<Problem> result = new ArrayList<>();
            for (JsonNode q : qs) {
                Problem p = new Problem();
                p.setTitle(q.path("title").asText());
                p.setTitleSlug(q.path("titleSlug").asText());
                p.setDifficulty(capitalize(q.path("difficulty").asText()));
                p.setPlatform("LeetCode");
                p.setTopic(topic.isEmpty() ? null : topic);
                p.setProblemUrl("https://leetcode.com/problems/" + q.path("titleSlug").asText() + "/");
                result.add(p);
            }
            return result;
        } catch (Exception e) {
            return List.of();
        }
    }

    // ── Codeforces fetcher ─────────────────────────────────────────────────────

    private List<Problem> doFetchCodeforces(String topic, String difficulty) {
        String tag = CF_TAGS.getOrDefault(topic.toLowerCase(), topic.toLowerCase());
        int[] range = CF_RANGE.getOrDefault(difficulty, new int[]{800, 1300});

        try {
            String url = CF_API + "?tags=" + tag.replace(" ", "+");
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(6))
                    .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return List.of();

            JsonNode root = MAPPER.readTree(resp.body());
            if (!"OK".equals(root.path("status").asText())) return List.of();

            JsonNode problems = root.path("result").path("problems");
            if (!problems.isArray()) return List.of();

            List<Problem> candidates = new ArrayList<>();
            for (JsonNode node : problems) {
                int rating    = node.path("rating").asInt(0);
                int contestId = node.path("contestId").asInt(0);
                String index  = node.path("index").asText("");
                if (rating < range[0] || rating >= range[1]) continue;
                if (contestId <= 0 || index.isEmpty()) continue;

                String slug = contestId + index.toLowerCase();
                Problem p = new Problem();
                p.setTitle(node.path("name").asText());
                p.setTitleSlug(slug);
                p.setDifficulty(difficulty);
                p.setPlatform("Codeforces");
                p.setTopic(topic.isEmpty() ? null : topic);
                p.setProblemUrl("https://codeforces.com/problemset/problem/" + contestId + "/" + index);
                candidates.add(p);
            }
            Collections.shuffle(candidates);
            return candidates.subList(0, Math.min(20, candidates.size()));
        } catch (Exception e) {
            return List.of();
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────────

    private String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase();
    }
}
