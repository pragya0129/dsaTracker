package com.example.dsa.platform;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.*;

@Service
public class LeetCodeClient {

  private final WebClient webClient;
  private final ObjectMapper mapper = new ObjectMapper();

  public LeetCodeClient() {
    this.webClient = WebClient.builder()
        .baseUrl("https://leetcode.com/graphql")
        .defaultHeader("Content-Type", "application/json")
        .defaultHeader("Referer", "https://leetcode.com")
        .build();
  }

  /** Fetch recent submissions (used for verification) */
  public List<Submission> fetchRecentSubmissions(String username) {
    String query = """
        query recentSubmissions($username: String!) {
          recentSubmissionList(username: $username) {
            titleSlug
            timestamp
            statusDisplay
          }
        }
        """;

    Map<String, Object> body = Map.of(
        "query", query,
        "variables", Map.of("username", username));

    try {
      String raw = webClient.post()
          .contentType(MediaType.APPLICATION_JSON)
          .bodyValue(body)
          .retrieve()
          .bodyToMono(String.class)
          .block();

      JsonNode root = mapper.readTree(raw);
      JsonNode list = root.path("data").path("recentSubmissionList");
      if (list.isMissingNode() || !list.isArray())
        return List.of();

      List<Submission> result = new ArrayList<>();
      for (JsonNode node : list) {
        Submission s = new Submission();
        s.setTitleSlug(node.path("titleSlug").asText());
        s.setTimestamp(node.path("timestamp").asText());
        s.setStatusDisplay(node.path("statusDisplay").asText());
        result.add(s);
      }
      return result;
    } catch (Exception e) {
      return List.of();
    }
  }

  /**
   * Fetch up to `limit` recently accepted submission slugs for a user.
   * Uses the recentAcSubmissionList GraphQL query (AC-only, no failed submissions).
   * Limit is capped by LeetCode at ~500 in practice.
   */
  public Set<String> fetchAcSlugs(String username) {
    String query = """
        query recentAcSubmissions($username: String!, $limit: Int!) {
          recentAcSubmissionList(username: $username, limit: $limit) {
            titleSlug
          }
        }
        """;

    Map<String, Object> body = Map.of(
        "query", query,
        "variables", Map.of("username", username, "limit", 500));

    try {
      String raw = webClient.post()
          .contentType(MediaType.APPLICATION_JSON)
          .bodyValue(body)
          .retrieve()
          .bodyToMono(String.class)
          .block();

      JsonNode root = mapper.readTree(raw);
      JsonNode list = root.path("data").path("recentAcSubmissionList");
      if (list.isMissingNode() || !list.isArray())
        return Set.of();

      Set<String> slugs = new LinkedHashSet<>();
      for (JsonNode node : list) {
        String slug = node.path("titleSlug").asText("");
        if (!slug.isBlank()) slugs.add(slug);
      }
      return slugs;
    } catch (Exception e) {
      return Set.of();
    }
  }

  /**
   * Fetch full profile stats: total/easy/medium/hard solved, streak, topics.
   * Returns a map with keys: totalSolved, easySolved, mediumSolved, hardSolved,
   * currentStreak, longestStreak, topics (Map<String,Integer>)
   */
  public Map<String, Object> fetchProfileStats(String username) {
    String query = """
        query userStats($username: String!) {
          matchedUser(username: $username) {
            submitStats: submitStatsGlobal {
              acSubmissionNum {
                difficulty
                count
              }
            }
            tagProblemCounts {
              advanced { tagName problemsSolved }
              intermediate { tagName problemsSolved }
              fundamental { tagName problemsSolved }
            }
            userCalendar {
              streak
              totalActiveDays
              submissionCalendar
            }
          }
        }
        """;

    Map<String, Object> body = Map.of(
        "query", query,
        "variables", Map.of("username", username));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("totalSolved", 0);
    result.put("easySolved", 0);
    result.put("mediumSolved", 0);
    result.put("hardSolved", 0);
    result.put("currentStreak", 0);
    result.put("longestStreak", 0);
    result.put("topics", new LinkedHashMap<String, Integer>());
    result.put("calendar", new LinkedHashMap<String, Integer>());

    try {
      String raw = webClient.post()
          .contentType(MediaType.APPLICATION_JSON)
          .bodyValue(body)
          .retrieve()
          .bodyToMono(String.class)
          .block();

      JsonNode root = mapper.readTree(raw);
      JsonNode user = root.path("data").path("matchedUser");
      if (user.isMissingNode())
        return result;

      // --- Solved counts ---
      JsonNode acList = user.path("submitStats").path("acSubmissionNum");
      for (JsonNode item : acList) {
        String diff = item.path("difficulty").asText();
        int count = item.path("count").asInt();
        switch (diff) {
          case "All" -> result.put("totalSolved", count);
          case "Easy" -> result.put("easySolved", count);
          case "Medium" -> result.put("mediumSolved", count);
          case "Hard" -> result.put("hardSolved", count);
        }
      }

      // --- Streak and Calendar ---
      JsonNode cal = user.path("userCalendar");
      if (!cal.isMissingNode()) {
        result.put("currentStreak", cal.path("streak").asInt(0));
        result.put("longestStreak", cal.path("totalActiveDays").asInt(0));

        String calendarStr = cal.path("submissionCalendar").asText("{}");
        try {
          JsonNode calNode = mapper.readTree(calendarStr);
          Map<String, Integer> calendarMap = new LinkedHashMap<>();
          calNode.fields().forEachRemaining(entry -> {
            calendarMap.put(entry.getKey(), entry.getValue().asInt());
          });
          result.put("calendar", calendarMap);
        } catch (Exception e) {
        }
      }

      // --- Topics ---
      Map<String, Integer> topics = new LinkedHashMap<>();
      JsonNode tagCounts = user.path("tagProblemCounts");
      for (String category : List.of("fundamental", "intermediate", "advanced")) {
        JsonNode arr = tagCounts.path(category);
        for (JsonNode t : arr) {
          String tag = t.path("tagName").asText();
          int solved = t.path("problemsSolved").asInt();
          if (solved > 0)
            topics.merge(tag, solved, Integer::sum);
        }
      }
      result.put("topics", topics);

    } catch (Exception e) {
      // Return defaults on error
    }
    return result;
  }
}
