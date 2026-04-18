package com.example.dsa.community;

import java.time.LocalDateTime;

public class PostDto {
    private Long id;
    private String userId;
    private String authorName;
    private String authorUsername;
    private String title;
    private String topic;
    private String content;
    private String preview; // first 160 chars for feed cards
    private int likeCount;
    private boolean likedByMe;
    private boolean savedByMe;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** Legacy 2-arg form for callers that don't need the new flags yet. */
    public static PostDto from(Post p, boolean likedByMe) {
        return from(p, likedByMe, false, null);
    }

    public static PostDto from(Post p, boolean likedByMe, boolean savedByMe, String authorUsername) {
        PostDto d = new PostDto();
        d.id = p.getId();
        d.userId = p.getUserId();
        d.authorName = p.getAuthorName();
        d.authorUsername = authorUsername;
        d.title = p.getTitle();
        d.topic = p.getTopic();
        d.content = p.getContent();
        d.preview = p.getContent() != null && p.getContent().length() > 160
                ? p.getContent().substring(0, 160).trim() + "…"
                : p.getContent();
        d.likeCount = p.getLikeCount();
        d.likedByMe = likedByMe;
        d.savedByMe = savedByMe;
        d.createdAt = p.getCreatedAt();
        d.updatedAt = p.getUpdatedAt();
        return d;
    }

    /* ── getters ── */
    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public String getAuthorUsername() {
        return authorUsername;
    }

    public String getTitle() {
        return title;
    }

    public String getTopic() {
        return topic;
    }

    public String getContent() {
        return content;
    }

    public String getPreview() {
        return preview;
    }

    public int getLikeCount() {
        return likeCount;
    }

    public boolean isLikedByMe() {
        return likedByMe;
    }

    public boolean isSavedByMe() {
        return savedByMe;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
