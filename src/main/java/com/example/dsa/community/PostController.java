package com.example.dsa.community;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService service;

    public PostController(PostService service) {
        this.service = service;
    }

    /** POST /api/posts — create a new post */
    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreatePostRequest req, Authentication auth) {
        try {
            return ResponseEntity.ok(service.create(auth.getName(), req));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** GET /api/posts?page=0&size=10 — paginated feed */
    @GetMapping
    public ResponseEntity<?> feed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication auth) {
        return ResponseEntity.ok(service.feed(auth.getName(), page, size));
    }

    /** GET /api/posts/{id} — single post */
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(service.getById(id, auth.getName()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** GET /api/posts/topic/{topic} — filtered feed */
    @GetMapping("/topic/{topic}")
    public ResponseEntity<?> byTopic(
            @PathVariable String topic,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication auth) {
        return ResponseEntity.ok(service.feedByTopic(topic, auth.getName(), page, size));
    }

    /** GET /api/posts/mine — current user's posts */
    @GetMapping("/mine")
    public ResponseEntity<?> mine(Authentication auth) {
        return ResponseEntity.ok(service.myPosts(auth.getName()));
    }

    /** POST /api/posts/{id}/like — toggle like */
    @PostMapping("/{id}/like")
    public ResponseEntity<?> like(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(service.toggleLike(id, auth.getName()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** POST /api/posts/{id}/save — bookmark a post for later. */
    @PostMapping("/{id}/save")
    public ResponseEntity<?> save(@PathVariable Long id, Authentication auth) {
        try {
            return ResponseEntity.ok(service.savePost(id, auth.getName()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** DELETE /api/posts/{id}/save — remove bookmark. */
    @DeleteMapping("/{id}/save")
    public ResponseEntity<?> unsave(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(service.unsavePost(id, auth.getName()));
    }

    /** GET /api/posts/saved — everything the current user has saved. */
    @GetMapping("/saved")
    public ResponseEntity<?> saved(Authentication auth) {
        return ResponseEntity.ok(service.savedPosts(auth.getName()));
    }

    /** DELETE /api/posts/{id} — owner-only delete */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id, Authentication auth) {
        try {
            service.delete(id, auth.getName());
            return ResponseEntity.ok(Map.of("message", "Deleted"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
