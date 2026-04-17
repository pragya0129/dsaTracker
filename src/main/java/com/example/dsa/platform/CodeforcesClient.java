package com.example.dsa.platform;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.*;

/**
 * Codeforces REST API client.
 * Endpoints used:
 * - user.info?handles=USERNAME → rating, rank, maxRating, maxRank
 * - user.status?handle=USERNAME&count=N → submissions (verdict, problem tags, rating)
 */
@Service
public class CodeforcesClient {

    private static final Logger log = LoggerFactory.getLogger(CodeforcesClient.class);
    private final WebClient webClient;
    private final ObjectMapper mapper = new ObjectMapper();

    public CodeforcesClient() {
        this.webClient = WebClient.builder()
                .baseUrl("https://codeforces.com/api")
                .build();
    }

    /** Fetch user info: rating, maxRating, rank, maxRank, contribution */
    public Map<String, Object> fetchUserInfo(String handle) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rating", 0);
        result.put("maxRating", 0);
        result.put("rank", "unrated");
        result.put("maxRank", "unrated");

        try {
            String raw = webClient.get()
                    .uri("/user.info?handles={handle}", handle)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = mapper.readTree(raw);
            if (!"OK".equals(root.path("status").asText()))
                return result;

            JsonNode user = root.path("result").get(0);
            if (user == null)
                return result;

            result.put("rating", user.path("rating").asInt(0));
            result.put("maxRating", user.path("maxRating").asInt(0));
            result.put("rank", user.path("rank").asText("unrated"));
            result.put("maxRank", user.path("maxRank").asText("unrated"));
            result.put("contribution", user.path("contribution").asInt(0));
            result.put("friendOfCount", user.path("friendOfCount").asInt(0));
        } catch (Exception e) {
            // Return defaults
        }
        return result;
    }

    /**
     * Fetch all submissions and compute:
     * - totalSolved (unique accepted problems)
     * - easySolved / mediumSolved / hardSolved (based on problem rating)
     * - topics map (tag -> count)
     */
    public Map<String, Object> fetchStats(String handle) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalSolved", 0);
        result.put("easySolved", 0);
        result.put("mediumSolved", 0);
        result.put("hardSolved", 0);
        result.put("topics", new LinkedHashMap<String, Integer>());
        result.put("calendar", new LinkedHashMap<String, Integer>());

        try {
            String raw = webClient.get()
                    .uri("/user.status?handle={handle}", handle)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = mapper.readTree(raw);
            if (!"OK".equals(root.path("status").asText()))
                return result;

            JsonNode submissions = root.path("result");
            if (!submissions.isArray())
                return result;

            Set<String> solvedProblems = new HashSet<>();
            Map<String, Integer> topics = new LinkedHashMap<>();
            Map<String, Integer> calendar = new LinkedHashMap<>();
            int easy = 0, medium = 0, hard = 0;

            int totalSubmissions = 0;
            for (JsonNode sub : submissions) {
                totalSubmissions++;
                long timeSec = sub.path("creationTimeSeconds").asLong();
                calendar.merge(String.valueOf(timeSec), 1, Integer::sum);

                if (!"OK".equals(sub.path("verdict").asText()))
                    continue;

                JsonNode problem = sub.path("problem");
                // Include problem name to prevent false collisions when contestId is 0
                String contestId = problem.path("contestId").isMissingNode()
                        ? "X" : String.valueOf(problem.path("contestId").asInt());
                String problemKey = contestId + "-" + problem.path("index").asText()
                        + "-" + problem.path("name").asText("");

                boolean added = solvedProblems.add(problemKey);
                if (!added) {
                    log.debug("[CF] Duplicate skipped: {}", problemKey);
                }
                if (!added) continue;

                int rating = problem.path("rating").asInt(0);
                if (rating > 0) {
                    if (rating <= 1200)
                        easy++;
                    else if (rating <= 1800)
                        medium++;
                    else
                        hard++;
                }

                JsonNode tags = problem.path("tags");
                if (tags.isArray()) {
                    for (JsonNode tag : tags) {
                        String tagName = tag.asText();
                        topics.merge(tagName, 1, Integer::sum);
                    }
                }
            }

            log.info("[CF] handle={} totalSubmissions={} uniqueSolved={} easy={} medium={} hard={}",
                    handle, totalSubmissions, solvedProblems.size(), easy, medium, hard);

            result.put("totalSolved", solvedProblems.size());
            result.put("easySolved", easy);
            result.put("mediumSolved", medium);
            result.put("hardSolved", hard);
            result.put("topics", topics);
            result.put("calendar", calendar);

        } catch (Exception e) {
            // Return defaults on error
        }
        return result;
    }

    /**
     * Fetch all uniquely accepted Codeforces problem slugs for a user.
     * Slug format: lowercase "{contestId}{index}" — e.g. "4a", "1000b".
     * This matches the titleSlug convention used when seeding CF problems into our Problems table.
     */
    public Set<String> fetchAcSlugs(String handle) {
        Set<String> slugs = new LinkedHashSet<>();
        try {
            String raw = webClient.get()
                    .uri("/user.status?handle={handle}", handle)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = mapper.readTree(raw);
            if (!"OK".equals(root.path("status").asText()))
                return slugs;

            JsonNode submissions = root.path("result");
            if (!submissions.isArray())
                return slugs;

            Set<String> seen = new HashSet<>();
            for (JsonNode sub : submissions) {
                if (!"OK".equals(sub.path("verdict").asText()))
                    continue;
                JsonNode problem = sub.path("problem");
                String contestId = problem.path("contestId").isMissingNode()
                        ? "X" : String.valueOf(problem.path("contestId").asInt());
                String index = problem.path("index").asText("").toLowerCase();
                String slug = (contestId + index).toLowerCase();
                if (seen.add(slug))
                    slugs.add(slug);
            }
        } catch (Exception e) {
            // Return what we have so far
        }
        return slugs;
    }

    /**
     * Debug: returns a list of every uniquely solved problem with full details,
     * plus the raw totalSubmissions count before dedup.
     * Hit GET /api/codeforces/debug/{handle} to inspect.
     */
    public Map<String, Object> fetchDebugSolved(String handle) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("handle", handle);
        out.put("error", "fetch failed");

        try {
            String raw = webClient.get()
                    .uri("/user.status?handle={handle}", handle)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            JsonNode root = mapper.readTree(raw);
            if (!"OK".equals(root.path("status").asText())) {
                out.put("cfStatus", root.path("status").asText());
                return out;
            }

            JsonNode submissions = root.path("result");
            int totalSubmissions = submissions.size();

            Set<String> seenKeys = new LinkedHashSet<>();
            List<Map<String, Object>> solvedList = new ArrayList<>();
            List<Map<String, Object>> skippedDups = new ArrayList<>();

            for (JsonNode sub : submissions) {
                String verdict = sub.path("verdict").asText("null");
                if (!"OK".equals(verdict)) continue;

                JsonNode problem = sub.path("problem");
                String contestId = problem.path("contestId").isMissingNode()
                        ? "X" : String.valueOf(problem.path("contestId").asInt());
                String index = problem.path("index").asText("");
                String name  = problem.path("name").asText("");
                String key   = contestId + "-" + index + "-" + name;

                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("key", key);
                entry.put("contestId", contestId);
                entry.put("index", index);
                entry.put("name", name);
                entry.put("rating", problem.path("rating").asInt(0));
                entry.put("submissionId", sub.path("id").asLong());

                if (!seenKeys.add(key)) {
                    skippedDups.add(entry);
                } else {
                    solvedList.add(entry);
                }
            }

            out.remove("error");
            out.put("totalSubmissions", totalSubmissions);
            out.put("uniquelySolved", solvedList.size());
            out.put("solvedProblems", solvedList);
            out.put("duplicatesSkipped", skippedDups.size());
            out.put("duplicateEntries", skippedDups);

        } catch (Exception e) {
            out.put("error", e.getMessage());
        }
        return out;
    }
}
