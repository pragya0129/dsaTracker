package com.example.dsa.platform;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Tracks every uniquely-solved problem per user per platform.
 * titleSlug is the canonical problem identifier:
 *   - LeetCode  : "two-sum", "add-two-numbers", etc.
 *   - Codeforces: "4a" (contestId + index, lowercase), e.g. "4a", "1000b"
 */
@Entity
@Table(name = "user_solved_problems",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "platform", "title_slug"}))
public class UserSolvedProblem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Numeric DB id of the user (same format as PlatformAccount.userId) */
    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(nullable = false, length = 50)
    private String platform; // "leetcode" | "codeforces"

    @Column(name = "title_slug", nullable = false, length = 300)
    private String titleSlug;

    @Column(name = "solved_at")
    private LocalDateTime solvedAt;

    public UserSolvedProblem() {}

    public UserSolvedProblem(String userId, String platform, String titleSlug, LocalDateTime solvedAt) {
        this.userId = userId;
        this.platform = platform;
        this.titleSlug = titleSlug;
        this.solvedAt = solvedAt;
    }

    public Long getId() { return id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getTitleSlug() { return titleSlug; }
    public void setTitleSlug(String titleSlug) { this.titleSlug = titleSlug; }

    public LocalDateTime getSolvedAt() { return solvedAt; }
    public void setSolvedAt(LocalDateTime solvedAt) { this.solvedAt = solvedAt; }
}
