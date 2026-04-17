package com.example.dsa.platform;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_stats", uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "platform" }))
public class UserStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(nullable = false, length = 50)
    private String platform;

    @Column(name = "total_solved")
    private Integer totalSolved = 0;

    @Column(name = "easy_count")
    private Integer easyCount = 0;

    @Column(name = "medium_count")
    private Integer mediumCount = 0;

    @Column(name = "hard_count")
    private Integer hardCount = 0;

    @Column(name = "current_streak")
    private Integer currentStreak = 0;

    @Column(name = "longest_streak")
    private Integer longestStreak = 0;

    @Column(name = "last_solved_date")
    private LocalDate lastSolvedDate;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /**
     * JSON snapshot of this platform's submission calendar: { "epochSeconds": count, ... }
     * Used to compute a cross-platform streak in getDashboardData().
     */
    @Column(name = "calendar_json", columnDefinition = "TEXT")
    private String calendarJson;

    public UserStats() {
    }

    public Long getId() { return id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public Integer getTotalSolved() { return totalSolved; }
    public void setTotalSolved(Integer totalSolved) { this.totalSolved = totalSolved; }

    public Integer getEasyCount() { return easyCount; }
    public void setEasyCount(Integer easyCount) { this.easyCount = easyCount; }

    public Integer getMediumCount() { return mediumCount; }
    public void setMediumCount(Integer mediumCount) { this.mediumCount = mediumCount; }

    public Integer getHardCount() { return hardCount; }
    public void setHardCount(Integer hardCount) { this.hardCount = hardCount; }

    public Integer getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(Integer currentStreak) { this.currentStreak = currentStreak; }

    public Integer getLongestStreak() { return longestStreak; }
    public void setLongestStreak(Integer longestStreak) { this.longestStreak = longestStreak; }

    public LocalDate getLastSolvedDate() { return lastSolvedDate; }
    public void setLastSolvedDate(LocalDate lastSolvedDate) { this.lastSolvedDate = lastSolvedDate; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getCalendarJson() { return calendarJson; }
    public void setCalendarJson(String calendarJson) { this.calendarJson = calendarJson; }
}
