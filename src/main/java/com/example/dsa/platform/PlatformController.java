package com.example.dsa.platform;

import com.example.dsa.user.UserInfoService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platforms")
public class PlatformController {

    private final PlatformSyncService syncService;
    private final UserInfoService userInfoService;

    public PlatformController(PlatformSyncService syncService, UserInfoService userInfoService) {
        this.syncService = syncService;
        this.userInfoService = userInfoService;
    }

    /** Link or update a platform account. POST /api/platforms/link */
    @PostMapping("/link")
    public ResponseEntity<?> linkPlatform(@AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String userId = getUserId(userDetails.getUsername());
        String platform = body.get("platform");
        String username = body.get("username");

        if (platform == null || username == null || platform.isBlank() || username.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "platform and username are required"));
        }

        PlatformAccount acc = syncService.linkPlatform(userId, platform.toLowerCase(), username);
        return ResponseEntity.ok(Map.of(
                "message", "Platform linked and synced successfully",
                "platform", acc.getPlatformName(),
                "username", acc.getUsername()));
    }

    /** Get dashboard stats. GET /api/platforms/dashboard */
    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboard(@AuthenticationPrincipal UserDetails userDetails) {
        String userId = getUserId(userDetails.getUsername());
        Map<String, Object> data = syncService.getDashboardData(userId);
        return ResponseEntity.ok(data);
    }

    /** Get live calendar/heatmap data. GET /api/platforms/calendar */
    @GetMapping("/calendar")
    public ResponseEntity<?> getCalendar(@AuthenticationPrincipal UserDetails userDetails) {
        String userId = getUserId(userDetails.getUsername());
        Map<String, Integer> data = syncService.getLiveCalendar(userId);
        return ResponseEntity.ok(data);
    }

    /** Force-sync all linked platforms. POST /api/platforms/sync */
    @PostMapping("/sync")
    public ResponseEntity<?> syncAll(@AuthenticationPrincipal UserDetails userDetails) {
        String userId = getUserId(userDetails.getUsername());
        List<Map<String, Object>> results = syncService.syncAllPlatforms(userId);
        return ResponseEntity.ok(Map.of("synced", results));
    }

    private String getUserId(String email) {
        return userInfoService.findIdByEmail(email);
    }
}
