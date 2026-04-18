package com.example.dsa.social;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

/**
 * A bookmark: user X saved post Y.
 * Same (user, post) tuple uniqueness as follows — "save twice" is a no-op.
 */
@Entity
@Table(
    name = "saved_post",
    uniqueConstraints = @UniqueConstraint(columnNames = { "user_email", "post_id" }),
    indexes = {
        @Index(name = "idx_saved_user", columnList = "user_email"),
        @Index(name = "idx_saved_post", columnList = "post_id"),
    }
)
public class SavedPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_email", nullable = false, length = 255)
    private String userEmail;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(name = "saved_at", nullable = false)
    private Instant savedAt;

    public SavedPost() {}
    public SavedPost(String userEmail, Long postId) {
        this.userEmail = userEmail;
        this.postId = postId;
        this.savedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getUserEmail() { return userEmail; }
    public void setUserEmail(String v) { this.userEmail = v; }
    public Long getPostId() { return postId; }
    public void setPostId(Long v) { this.postId = v; }
    public Instant getSavedAt() { return savedAt; }
    public void setSavedAt(Instant v) { this.savedAt = v; }
}
