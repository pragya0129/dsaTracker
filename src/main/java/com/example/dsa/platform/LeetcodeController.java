package com.example.dsa.platform;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/leetcode")
public class LeetcodeController {

    @Autowired
    LeetCodeClient leetCodeClient;

    /** Public endpoint — verifies a LeetCode username exists by fetching recent submissions */
    @GetMapping("/submissions/{username}")
    public Map<String, Object> getSubmissions(@PathVariable String username) {
        java.util.List<Submission> submissions = leetCodeClient.fetchRecentSubmissions(username);
        return Map.of(
                "username", username,
                "submissionCount", submissions.size(),
                "submissions", submissions
        );
    }
}
