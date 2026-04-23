package com.example.dsa.notifications;

import com.example.dsa.social.UserFollow;
import com.example.dsa.social.UserFollowRepository;
import com.example.dsa.user.UserInfo;
import com.example.dsa.user.UserInfoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * In-app notifications.
 *
 * Every notification-generating action (likes, follows, new posts by a
 * user you follow, challenge invites, system broadcasts) funnels through
 * the {@code notify*} helpers here. The helpers are safe to call from any
 * write path — all exceptions are swallowed with a warning so a broken
 * notification can never break the primary action.
 *
 * Self-notifications (actor == recipient) are silently skipped.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    public static final String TYPE_LIKE               = "LIKE";
    public static final String TYPE_FOLLOW             = "FOLLOW";
    public static final String TYPE_POST_FROM_FOLLOWED = "POST_FROM_FOLLOWED";
    public static final String TYPE_CHALLENGE_INVITE   = "CHALLENGE_INVITE";
    public static final String TYPE_SYSTEM             = "SYSTEM";

    private final UserNotificationRepository repo;
    private final UserFollowRepository followRepo;
    private final UserInfoRepository userRepo;

    /** Comma-separated list of admin emails that can broadcast SYSTEM notifications. */
    @Value("${app.admin.emails:}")
    private String adminEmailsProp;

    public NotificationService(UserNotificationRepository repo,
                               UserFollowRepository followRepo,
                               UserInfoRepository userRepo) {
        this.repo = repo;
        this.followRepo = followRepo;
        this.userRepo = userRepo;
    }

    /* ══════════════════ EMIT helpers ══════════════════ */

    /** Someone liked a post. Notifies the post author. */
    public void notifyLike(String authorEmail, String likerEmail, Long postId, String postTitle) {
        if (authorEmail == null || likerEmail == null) return;
        if (authorEmail.equalsIgnoreCase(likerEmail)) return; // don't notify yourself
        try {
            String likerName = displayName(likerEmail);
            UserNotification n = build(
                authorEmail, TYPE_LIKE, likerEmail, likerName, postId,
                likerName + " liked your post",
                truncate(postTitle, 140),
                "/community?post=" + postId
            );
            repo.save(n);
        } catch (Exception e) {
            log.warn("notifyLike failed: {}", e.getMessage());
        }
    }

    /** Someone started following you. */
    public void notifyFollow(String followedEmail, String followerEmail) {
        if (followedEmail == null || followerEmail == null) return;
        if (followedEmail.equalsIgnoreCase(followerEmail)) return;
        try {
            String name = displayName(followerEmail);
            UserNotification n = build(
                followedEmail, TYPE_FOLLOW, followerEmail, name, null,
                name + " started following you",
                "Say hi or check out their profile.",
                "/u/" + safeUsernameOrEmail(followerEmail)
            );
            repo.save(n);
        } catch (Exception e) {
            log.warn("notifyFollow failed: {}", e.getMessage());
        }
    }

    /**
     * A user you follow published a new post. Fans out to every follower
     * of the author — still cheap at the scale we're working with, and
     * we swallow any individual save error so one bad row doesn't abort
     * the rest.
     */
    public void notifyFollowersOfPost(String authorEmail, Long postId, String postTitle) {
        if (authorEmail == null || postId == null) return;
        try {
            String authorName = displayName(authorEmail);
            List<UserFollow> followers = followRepo.findByFollowingEmailOrderByCreatedAtDesc(authorEmail);
            if (followers.isEmpty()) return;
            List<UserNotification> batch = new ArrayList<>(followers.size());
            for (UserFollow f : followers) {
                String recipient = f.getFollowerEmail();
                if (recipient == null || recipient.equalsIgnoreCase(authorEmail)) continue;
                batch.add(build(
                    recipient, TYPE_POST_FROM_FOLLOWED, authorEmail, authorName, postId,
                    authorName + " published a new post",
                    truncate(postTitle, 140),
                    "/community?post=" + postId
                ));
            }
            if (!batch.isEmpty()) repo.saveAll(batch);
        } catch (Exception e) {
            log.warn("notifyFollowersOfPost failed: {}", e.getMessage());
        }
    }

    /** Someone invited you to a challenge / contest. */
    public void notifyChallengeInvite(String opponentEmail, String challengerEmail,
                                      Long challengeId, String contestType) {
        if (opponentEmail == null || challengerEmail == null) return;
        if (opponentEmail.equalsIgnoreCase(challengerEmail)) return;
        try {
            String name = displayName(challengerEmail);
            UserNotification n = build(
                opponentEmail, TYPE_CHALLENGE_INVITE, challengerEmail, name, challengeId,
                name + " challenged you",
                "Contest: " + (contestType == null ? "custom" : contestType) + " — tap to accept or decline.",
                "/challenge/" + challengeId
            );
            repo.save(n);
        } catch (Exception e) {
            log.warn("notifyChallengeInvite failed: {}", e.getMessage());
        }
    }

    /**
     * Admin-only: send the same SYSTEM notification to every registered user.
     * Caller is responsible for the authorization check (see NotificationController).
     */
    @Transactional
    public int broadcastSystem(String title, String message, String link) {
        if (title == null || title.isBlank()) throw new IllegalArgumentException("title required");
        if (message == null || message.isBlank()) throw new IllegalArgumentException("message required");
        List<String> emails = userRepo.findAll().stream()
                .map(UserInfo::getEmail)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        List<UserNotification> batch = new ArrayList<>(emails.size());
        for (String e : emails) {
            batch.add(build(e, TYPE_SYSTEM, null, "AlgoLedger", null,
                    truncate(title, 180), message, link));
        }
        repo.saveAll(batch);
        return batch.size();
    }

    /* ══════════════════ READ helpers ══════════════════ */

    public Page<UserNotification> list(String email, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 50));
        return repo.findByRecipientEmailOrderByCreatedAtDesc(email, PageRequest.of(page, safeSize));
    }

    public long unreadCount(String email) {
        return repo.countByRecipientEmailAndReadFalse(email);
    }

    @Transactional
    public int markAllRead(String email) {
        return repo.markAllRead(email);
    }

    /* ══════════════════ ADMIN gate ══════════════════ */

    public boolean isAdmin(String email) {
        if (email == null || adminEmailsProp == null || adminEmailsProp.isBlank()) return false;
        String needle = email.trim().toLowerCase();
        for (String a : adminEmailsProp.split(",")) {
            if (a.trim().toLowerCase().equals(needle)) return true;
        }
        return false;
    }

    /* ══════════════════ internal ══════════════════ */

    private UserNotification build(String recipient, String type,
                                   String actorEmail, String actorName, Long entityId,
                                   String title, String message, String link) {
        UserNotification n = new UserNotification();
        n.setRecipientEmail(recipient);
        n.setType(type);
        n.setActorEmail(actorEmail);
        n.setActorName(actorName);
        n.setEntityId(entityId);
        n.setTitle(title);
        n.setMessage(message == null ? "" : message);
        n.setLink(link);
        return n;
    }

    private String displayName(String email) {
        if (email == null) return "Someone";
        try {
            return userRepo.findByEmail(email)
                    .map(u -> u.getName() != null && !u.getName().isBlank() ? u.getName() : email)
                    .orElse(email);
        } catch (Exception e) {
            return email;
        }
    }

    private String safeUsernameOrEmail(String email) {
        try {
            Optional<UserInfo> u = userRepo.findByEmail(email);
            if (u.isPresent() && u.get().getUsername() != null && !u.get().getUsername().isBlank()) {
                return u.get().getUsername();
            }
        } catch (Exception ignored) { /* fall through */ }
        return email == null ? "" : email;
    }

    private static String truncate(String s, int n) {
        if (s == null) return "";
        return s.length() <= n ? s : s.substring(0, n - 1) + "…";
    }
}
