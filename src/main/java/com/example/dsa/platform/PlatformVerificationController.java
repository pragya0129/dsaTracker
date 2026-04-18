package com.example.dsa.platform;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Two-step proof-of-ownership verification for LeetCode / Codeforces handles.
 *
 * <p>Flow:
 * <ol>
 *   <li>{@code POST /api/verify/start} — client sends {@code {platform, handle}}.
 *       We confirm the handle exists and return a target problem + a server
 *       {@code startTime} (epoch seconds). Client shows: "Solve this problem,
 *       then come back and click Check."</li>
 *   <li>{@code POST /api/verify/check} — client sends {@code {platform, handle,
 *       problemSlug, startTime}} after the user submits. We fetch their recent
 *       submissions from the real platform and confirm a submission to
 *       {@code problemSlug} exists with timestamp {@code >= startTime}.
 *       Any verdict counts — the goal is to prove the user has login access
 *       to the account, not that they can solve the problem. Even a wrong
 *       answer requires logging in, which is all the proof we need.</li>
 * </ol>
 *
 * <p>Target problems are fixed to easy "always available" ones so the check is
 * cheap and reliable: LeetCode "Two Sum", Codeforces "4A — Watermelon".
 *
 * <p>Security note: the client round-trips {@code startTime}, which a
 * determined attacker could theoretically forge to point at an older
 * submission they didn't make. In practice the threat is low — they'd still
 * need a matching Accepted submission on the target account — but if this
 * matters for you, the stricter version is to persist a server-side challenge
 * row keyed by (userEmail, platform, handle) and not trust client-sent
 * startTime at all. Easy upgrade when needed.
 */
@RestController
@RequestMapping("/api/verify")
public class PlatformVerificationController {

    private static final Logger log = LoggerFactory.getLogger(PlatformVerificationController.class);

    /** Target problem config per platform — fixed for simplicity. */
    private static final Map<String, TargetProblem> TARGETS = Map.of(
        "leetcode", new TargetProblem(
            "two-sum", "Two Sum", "https://leetcode.com/problems/two-sum/"),
        "codeforces", new TargetProblem(
            "4-A", "4A — Watermelon", "https://codeforces.com/problemset/problem/4/A")
    );

    private final LeetCodeClient leetCodeClient;
    private final CodeforcesClient codeforcesClient;

    public PlatformVerificationController(LeetCodeClient lc, CodeforcesClient cf) {
        this.leetCodeClient = lc;
        this.codeforcesClient = cf;
    }

    /**
     * Step 1: confirm handle exists + hand the client a target problem to solve.
     * Body: {@code {platform, handle}}.
     */
    @PostMapping("/start")
    public ResponseEntity<?> start(@RequestBody Map<String, String> body) {
        String platform = norm(body.get("platform"));
        String handle   = body.getOrDefault("handle", "").trim();
        if (platform.isEmpty() || handle.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "platform and handle are required"));
        }
        TargetProblem target = TARGETS.get(platform);
        if (target == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Unsupported platform: " + platform));
        }

        boolean exists = switch (platform) {
            case "leetcode"   -> leetCodeClient.userExists(handle);
            case "codeforces" -> codeforcesClient.userExists(handle);
            default            -> false;
        };
        if (!exists) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "No " + platform + " account with that handle. Check the spelling."));
        }

        long startTime = Instant.now().getEpochSecond();
        Map<String, Object> resp = new HashMap<>();
        resp.put("platform", platform);
        resp.put("handle", handle);
        resp.put("problemSlug", target.slug());
        resp.put("problemName", target.name());
        resp.put("problemUrl", target.url());
        resp.put("startTime", startTime);
        return ResponseEntity.ok(resp);
    }

    /**
     * Step 2: confirm the user actually submitted the target problem after
     * {@code startTime} by scanning their recent submissions.
     * Body: {@code {platform, handle, problemSlug, startTime}}.
     */
    @PostMapping("/check")
    public ResponseEntity<?> check(@RequestBody Map<String, Object> body) {
        String platform = norm((String) body.get("platform"));
        String handle   = ((String) body.getOrDefault("handle", "")).trim();
        String slug     = ((String) body.getOrDefault("problemSlug", "")).trim();
        long startTime  = toLong(body.get("startTime"));

        if (platform.isEmpty() || handle.isEmpty() || slug.isEmpty() || startTime <= 0) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "platform, handle, problemSlug, and startTime are required"));
        }

        boolean verified;
        try {
            verified = switch (platform) {
                case "leetcode" ->
                        leetCodeClient.hasSubmissionAfter(handle, slug, startTime);
                case "codeforces" -> {
                    // slug format here is "<contestId>-<index>", e.g. "4-A"
                    int dash = slug.indexOf('-');
                    if (dash < 0) yield false;
                    int contestId = Integer.parseInt(slug.substring(0, dash));
                    String index  = slug.substring(dash + 1);
                    yield codeforcesClient.hasSubmissionAfter(handle, contestId, index, startTime);
                }
                default -> false;
            };
        } catch (NumberFormatException nfe) {
            log.warn("verify/check: bad slug {}", slug);
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid problem reference"));
        }

        if (verified) {
            return ResponseEntity.ok(Map.of("verified", true));
        }
        return ResponseEntity.ok(Map.of(
                "verified", false,
                "message", "We didn't see a submission from your account yet. " +
                           "Make sure you submitted the problem (any verdict is fine) " +
                           "after you clicked Link, then try again in a few seconds."));
    }

    private String norm(String s) { return s == null ? "" : s.trim().toLowerCase(); }
    private long toLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o instanceof String s) { try { return Long.parseLong(s); } catch (Exception e) { return 0; } }
        return 0;
    }

    /** Immutable target-problem tuple. Kept private to this controller. */
    private record TargetProblem(String slug, String name, String url) {}
}
