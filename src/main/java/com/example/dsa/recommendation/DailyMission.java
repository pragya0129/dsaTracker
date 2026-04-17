package com.example.dsa.recommendation;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Persists a user's daily mission so it stays the same throughout the day.
 * When the user marks one as complete, a new row is created (sequenceNumber
 * increments) giving them the next problem immediately.
 */
@Entity
@Table(name = "daily_missions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "mission_date", "sequence_number"}))
public class DailyMission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "mission_date", nullable = false)
    private LocalDate missionDate;

    /** Increments every time the user completes a mission on the same day. */
    @Column(name = "sequence_number", nullable = false)
    private int sequenceNumber = 1;

    @Column(name = "title_slug", nullable = false, length = 300)
    private String titleSlug;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(nullable = false, length = 50)
    private String platform;

    @Column(nullable = false, length = 20)
    private String difficulty;

    @Column(length = 100)
    private String topic;

    @Column(name = "problem_url", length = 500)
    private String problemUrl;

    @Column(nullable = false)
    private boolean completed = false;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    public DailyMission() {}

    // ── getters / setters ───────────────────────────────────────────────────────
    public Long getId() { return id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public LocalDate getMissionDate() { return missionDate; }
    public void setMissionDate(LocalDate missionDate) { this.missionDate = missionDate; }

    public int getSequenceNumber() { return sequenceNumber; }
    public void setSequenceNumber(int sequenceNumber) { this.sequenceNumber = sequenceNumber; }

    public String getTitleSlug() { return titleSlug; }
    public void setTitleSlug(String titleSlug) { this.titleSlug = titleSlug; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getProblemUrl() { return problemUrl; }
    public void setProblemUrl(String problemUrl) { this.problemUrl = problemUrl; }

    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
