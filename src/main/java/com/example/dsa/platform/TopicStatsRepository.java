package com.example.dsa.platform;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TopicStatsRepository extends JpaRepository<TopicStats, Long> {
    List<TopicStats> findByUserId(String userId);
    Optional<TopicStats> findByUserIdAndTopic(String userId, String topic);
    void deleteByUserId(String userId);
}
