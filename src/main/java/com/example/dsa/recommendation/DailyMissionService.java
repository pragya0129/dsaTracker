package com.example.dsa.recommendation;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Isolated persistence for daily missions.
 * Lives in its own Spring bean so @Transactional commits the save
 * immediately — independent of the outer recommendation-building flow,
 * which makes external HTTP calls that must NOT be inside a DB transaction.
 */
@Service
public class DailyMissionService {

    private final DailyMissionRepository repo;

    public DailyMissionService(DailyMissionRepository repo) {
        this.repo = repo;
    }

    /**
     * Returns today's active mission for userId, or persists and returns the
     * supplied newMission if none exists yet.
     * The @Transactional here is entirely separate from any caller transaction.
     */
    @Transactional
    public DailyMission findOrCreate(String userId, LocalDate today, DailyMission newMission) {
        Optional<DailyMission> existing =
                repo.findTopByUserIdAndMissionDateAndCompletedFalseOrderByIdDesc(userId, today);
        if (existing.isPresent()) return existing.get();
        return repo.save(newMission);
    }

    /** Slugs that have already been used as missions today (to avoid repeats). */
    @Transactional(readOnly = true)
    public List<String> todaysSlugs(String userId, LocalDate today) {
        return repo.findSlugsByUserIdAndDate(userId, today);
    }

    /** Count of missions created for this user today (used for sequenceNumber). */
    @Transactional(readOnly = true)
    public long countToday(String userId, LocalDate today) {
        return repo.countByUserIdAndMissionDate(userId, today);
    }

    /** Marks the current active mission complete and flushes immediately. */
    @Transactional
    public void markComplete(String userId, LocalDate today) {
        repo.findTopByUserIdAndMissionDateAndCompletedFalseOrderByIdDesc(userId, today)
                .ifPresent(m -> {
                    m.setCompleted(true);
                    m.setCompletedAt(LocalDateTime.now(ZoneOffset.UTC));
                    repo.save(m);
                });
    }

    /**
     * Auto-marks the mission complete when PlatformSyncService detects
     * the problem has been solved on the external platform.
     */
    @Transactional
    public void autoComplete(String userId, Set<String> solvedSlugs) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        repo.findTopByUserIdAndMissionDateAndCompletedFalseOrderByIdDesc(userId, today)
                .ifPresent(m -> {
                    if (solvedSlugs.contains(m.getTitleSlug())) {
                        m.setCompleted(true);
                        m.setCompletedAt(LocalDateTime.now(ZoneOffset.UTC));
                        repo.save(m);
                    }
                });
    }
}
