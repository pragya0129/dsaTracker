package com.example.dsa.platform;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

            for (JsonNode sub : submissions) {
                long timeSec = sub.path("creationTimeSeconds").asLong();
                calendar.merge(String.valueOf(timeSec), 1, Integer::sum);

                if (!"OK".equals(sub.path("verdict").asText()))
                    continue;

                JsonNode problem = sub.path("problem");
                String problemKey = problem.path("contestId").asInt() + "-" + problem.path("index").asText();

                if (!solvedProblems.add(problemKey))
                    continue;

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
}
