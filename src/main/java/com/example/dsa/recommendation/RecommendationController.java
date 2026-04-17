package com.example.dsa.recommendation;

import com.example.dsa.user.UserInfoService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/recommendations")
public class RecommendationController {

    private final RecommendationService service;
    private final UserInfoService userInfoService;

    public RecommendationController(RecommendationService service, UserInfoService userInfoService) {
        this.service = service;
        this.userInfoService = userInfoService;
    }

    /** Converts authenticated email → numeric userId String (e.g. "1", "42") */
    private String numericId(Authentication auth) {
        return userInfoService.findIdByEmail(auth.getName());
    }

    /**
     * GET /recommendations/daily
     * Returns personalised problems, skill snapshot, weak topics, and difficulty level.
     */
    @GetMapping("/daily")
    public ResponseEntity<?> daily(Authentication auth,
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(service.dailyRecommendations(numericId(auth), Math.min(limit, 10)));
    }

    /**
     * GET /recommendations/weak-topics
     * Returns the 5 weakest topics for this user.
     */
    @GetMapping("/weak-topics")
    public ResponseEntity<?> weakTopics(Authentication auth) {
        return ResponseEntity.ok(service.weakTopics(numericId(auth)));
    }

    /**
     * GET /recommendations/difficulty-progress
     * Returns difficulty progression suggestion with reason and next milestone.
     */
    @GetMapping("/difficulty-progress")
    public ResponseEntity<?> difficultyProgress(Authentication auth) {
        return ResponseEntity.ok(service.difficultyProgress(numericId(auth)));
    }

    /**
     * POST /recommendations/daily-mission/complete
     * Marks today's active mission as done and returns the next mission immediately.
     */
    @PostMapping("/daily-mission/complete")
    public ResponseEntity<?> completeMission(Authentication auth) {
        return ResponseEntity.ok(service.completeMission(numericId(auth)));
    }
}
