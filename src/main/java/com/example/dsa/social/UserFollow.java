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
 * A follow edge: {@code follower} follows {@code following}.
 * We key edges off email (which is UserInfo's stable unique key) rather than
 * username — usernames can change, but an email is tied to the row for life.
 *
 * <p>Both (follower, following) together form a unique constraint, so
 * "follow twice" is a DB-level no-op. Separate indexes on each column keep
 * follower-list / following-list lookups fast.
 */
@Entity
@Table(
    name = "user_follow",
    uniqueConstraints = @UniqueConstraint(columnNames = { "follower_email", "following_email" }),
    indexes = {
        @Index(name = "idx_follow_follower",  columnList = "follower_email"),
        @Index(name = "idx_follow_following", columnList = "following_email"),
    }
)
public class UserFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "follower_email", nullable = false, length = 255)
    private String followerEmail;

    @Column(name = "following_email", nullable = false, length = 255)
    private String followingEmail;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UserFollow() {}
    public UserFollow(String follower, String following) {
        this.followerEmail = follower;
        this.followingEmail = following;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getFollowerEmail() { return followerEmail; }
    public void setFollowerEmail(String v) { this.followerEmail = v; }
    public String getFollowingEmail() { return followingEmail; }
    public void setFollowingEmail(String v) { this.followingEmail = v; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant v) { this.createdAt = v; }
}
