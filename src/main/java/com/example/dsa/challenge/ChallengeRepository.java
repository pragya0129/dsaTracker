package com.example.dsa.challenge;

import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {
    List<Challenge> findByOpponentIdOrderByCreatedAtDesc(String opponentId);

    List<Challenge> findByChallengerIdOrderByCreatedAtDesc(String challengerId);

    default List<Challenge> findAllInvolving(String userId) {
        List<Challenge> list = new java.util.ArrayList<>(findByChallengerIdOrderByCreatedAtDesc(userId));
        list.addAll(findByOpponentIdOrderByCreatedAtDesc(userId));
        list.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return list;
    }

    // Pending challenges sent TO this user
    List<Challenge> findByOpponentIdAndStatus(String opponentId, ChallengeStatus status);

    // Check for existing pending challenge between same two users
    boolean existsByChallengerIdAndOpponentIdAndStatus(String challengerId, String opponentId, ChallengeStatus status);

    /**
     * Scheduler support: find challenges in the given status whose endTime has
     * already passed. Previously the scheduler did {@code findAll()} + a Java
     * filter — that scans the whole table every 30s. With a compound index on
     * (status, end_time) this hits only the rows that actually need expiring.
     */
    List<Challenge> findByStatusAndEndTimeBefore(ChallengeStatus status, LocalDateTime cutoff);

    /**
     * Scheduler support: find challenges in the given status that were created
     * before the cutoff (used to expire stale PENDING invites >48h old).
     */
    List<Challenge> findByStatusAndCreatedAtBefore(ChallengeStatus status, LocalDateTime cutoff);
}
