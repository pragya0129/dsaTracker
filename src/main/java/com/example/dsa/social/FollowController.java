package com.example.dsa.social;

import com.example.dsa.notifications.NotificationService;
import com.example.dsa.user.UserInfo;
import com.example.dsa.user.UserInfoRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Everything /follow-related. All endpoints take the target user by
 * {@code username} (URL-friendly, shareable) but internally we resolve to
 * the user's email, which is the stable key.
 */
@RestController
@RequestMapping("/api/follow")
public class FollowController {

    private final UserFollowRepository followRepo;
    private final UserInfoRepository userRepo;
    private final NotificationService notifications;

    public FollowController(UserFollowRepository followRepo, UserInfoRepository userRepo,
                            NotificationService notifications) {
        this.followRepo = followRepo;
        this.userRepo = userRepo;
        this.notifications = notifications;
    }

    /** Follow the user with this username. Idempotent: no-op if already followed. */
    @PostMapping("/{username}")
    @Transactional
    public ResponseEntity<?> follow(@AuthenticationPrincipal UserDetails me,
                                    @PathVariable String username) {
        Optional<UserInfo> target = userRepo.findByUsername(username.toLowerCase());
        if (target.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No user with that username"));
        }
        String myEmail = me.getUsername();
        String theirEmail = target.get().getEmail();
        if (myEmail.equalsIgnoreCase(theirEmail)) {
            return ResponseEntity.badRequest().body(Map.of("error", "You can't follow yourself"));
        }
        boolean newFollow = false;
        if (!followRepo.existsByFollowerEmailAndFollowingEmail(myEmail, theirEmail)) {
            followRepo.save(new UserFollow(myEmail, theirEmail));
            newFollow = true;
        }
        // Only emit on the transition idle→following to avoid spamming the target.
        if (newFollow) {
            notifications.notifyFollow(theirEmail, myEmail);
        }
        return ResponseEntity.ok(Map.of(
                "following", true,
                "followers", followRepo.countByFollowingEmail(theirEmail)));
    }

    /** Unfollow. Idempotent. */
    @DeleteMapping("/{username}")
    @Transactional
    public ResponseEntity<?> unfollow(@AuthenticationPrincipal UserDetails me,
                                      @PathVariable String username) {
        Optional<UserInfo> target = userRepo.findByUsername(username.toLowerCase());
        if (target.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No user with that username"));
        }
        String myEmail = me.getUsername();
        String theirEmail = target.get().getEmail();
        followRepo.deleteByFollowerEmailAndFollowingEmail(myEmail, theirEmail);
        return ResponseEntity.ok(Map.of(
                "following", false,
                "followers", followRepo.countByFollowingEmail(theirEmail)));
    }

    /** Am I following this user? + counts for their profile header. */
    @GetMapping("/status/{username}")
    public ResponseEntity<?> status(@AuthenticationPrincipal UserDetails me,
                                    @PathVariable String username) {
        Optional<UserInfo> target = userRepo.findByUsername(username.toLowerCase());
        if (target.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No user with that username"));
        }
        String theirEmail = target.get().getEmail();
        boolean following = followRepo.existsByFollowerEmailAndFollowingEmail(
                me.getUsername(), theirEmail);
        return ResponseEntity.ok(Map.of(
                "following", following,
                "followers", followRepo.countByFollowingEmail(theirEmail),
                "followingCount", followRepo.countByFollowerEmail(theirEmail)));
    }

    /** List followers of a given user (most recent first). */
    @GetMapping("/{username}/followers")
    public ResponseEntity<?> followers(@PathVariable String username) {
        Optional<UserInfo> target = userRepo.findByUsername(username.toLowerCase());
        if (target.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No user with that username"));
        }
        List<UserFollow> edges = followRepo.findByFollowingEmailOrderByCreatedAtDesc(target.get().getEmail());
        return ResponseEntity.ok(toProfileList(edges, true));
    }

    /** List accounts a given user is following. */
    @GetMapping("/{username}/following")
    public ResponseEntity<?> following(@PathVariable String username) {
        Optional<UserInfo> target = userRepo.findByUsername(username.toLowerCase());
        if (target.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No user with that username"));
        }
        List<UserFollow> edges = followRepo.findByFollowerEmailOrderByCreatedAtDesc(target.get().getEmail());
        return ResponseEntity.ok(toProfileList(edges, false));
    }

    /** Shape each edge into a thin user-card for the frontend. */
    private List<Map<String, Object>> toProfileList(List<UserFollow> edges, boolean fromFollower) {
        return edges.stream().map(e -> {
            String email = fromFollower ? e.getFollowerEmail() : e.getFollowingEmail();
            Optional<UserInfo> u = userRepo.findByEmail(email);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("email",    email);
            row.put("username", u.map(UserInfo::getUsername).orElse(null));
            row.put("name",     u.map(UserInfo::getName).orElse(null));
            row.put("profilePic", u.map(UserInfo::getProfilePic).orElse(null));
            return row;
        }).toList();
    }
}
