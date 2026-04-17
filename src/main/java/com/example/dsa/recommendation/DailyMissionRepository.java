package com.example.dsa.recommendation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyMissionRepository extends JpaRepository<DailyMission, Long> {

    /** Latest active (not completed) mission for today — the one to show. */
    Optional<DailyMission> findTopByUserIdAndMissionDateAndCompletedFalseOrderByIdDesc(
            String userId, LocalDate missionDate);

    /** Count of all missions created today — used for sequenceNumber. */
    long countByUserIdAndMissionDate(String userId, LocalDate missionDate);

    /** All slugs used today so we never repeat a problem. */
    @Query("SELECT d.titleSlug FROM DailyMission d WHERE d.userId = :userId AND d.missionDate = :date")
    List<String> findSlugsByUserIdAndDate(@Param("userId") String userId, @Param("date") LocalDate date);

    /** Find a specific active mission by slug (used during auto-detect from sync). */
    Optional<DailyMission> findByUserIdAndMissionDateAndTitleSlugAndCompletedFalse(
            String userId, LocalDate missionDate, String titleSlug);
}
