package com.example.dsa.platform;

import jakarta.persistence.*;

@Entity
@Table(name = "topic_stats", uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "topic" }))
public class TopicStats {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(nullable = false, length = 100)
    private String topic;

    @Column(name = "solved_count")
    private Integer solvedCount = 0;

    public TopicStats() {
    }

    public Long getId() { return id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public Integer getSolvedCount() { return solvedCount; }
    public void setSolvedCount(Integer solvedCount) { this.solvedCount = solvedCount; }
}
