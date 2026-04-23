package com.example.dsa.notifications;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * REST surface for in-app notifications.
 *
 *   GET  /api/notifications?page=0&size=20   paginated list + unread count
 *   GET  /api/notifications/unread-count     small response for the badge poll
 *   POST /api/notifications/mark-all-read    flips every unread to read
 *   POST /api/notifications/broadcast        admin-only SYSTEM announcement
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    /** Paginated feed for the bell dropdown. Also returns unreadCount so
     *  the client can update the badge in the same round-trip. */
    @GetMapping
    public Map<String, Object> list(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication auth
    ) {
        String email = auth.getName();
        Page<UserNotification> p = service.list(email, page, size);

        List<Map<String, Object>> items = new ArrayList<>(p.getNumberOfElements());
        for (UserNotification n : p.getContent()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",         n.getId());
            m.put("type",       n.getType());
            m.put("actorEmail", n.getActorEmail());
            m.put("actorName",  n.getActorName());
            m.put("entityId",   n.getEntityId());
            m.put("title",      n.getTitle());
            m.put("message",    n.getMessage());
            m.put("link",       n.getLink());
            m.put("read",       n.isRead());
            m.put("createdAt",  n.getCreatedAt());
            items.add(m);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("items",       items);
        resp.put("page",        p.getNumber());
        resp.put("size",        p.getSize());
        resp.put("totalPages",  p.getTotalPages());
        resp.put("totalItems",  p.getTotalElements());
        resp.put("unreadCount", service.unreadCount(email));
        return resp;
    }

    /** Lightweight endpoint the TopBar polls every ~60s. */
    @GetMapping("/unread-count")
    public Map<String, Object> unreadCount(Authentication auth) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("unreadCount", service.unreadCount(auth.getName()));
        return m;
    }

    @PostMapping("/mark-all-read")
    public Map<String, Object> markAllRead(Authentication auth) {
        int updated = service.markAllRead(auth.getName());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("updated", updated);
        return m;
    }

    /** Admin-only broadcast. Gate: caller's email must appear in the
     *  {@code app.admin.emails} property (comma-separated). */
    @PostMapping("/broadcast")
    public ResponseEntity<?> broadcast(@RequestBody BroadcastRequest req, Authentication auth) {
        if (!service.isAdmin(auth.getName())) {
            return ResponseEntity.status(403).body(Map.of("error", "Admins only"));
        }
        try {
            int sent = service.broadcastSystem(req.getTitle(), req.getMessage(), req.getLink());
            return ResponseEntity.ok(Map.of("sent", sent));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /* ── request body ── */
    public static class BroadcastRequest {
        private String title;
        private String message;
        private String link;
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public String getLink() { return link; }
        public void setLink(String link) { this.link = link; }
    }
}
