package com.example.dsa.platform;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserStatsRepository extends JpaRepository<UserStats, Long> {
    List<UserStats> findByUserId(String userId);
    Optional<UserStats> findByUserIdAndPlatform(String userId, String platform);
}
