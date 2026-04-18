package com.example.dsa.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {

    Optional<EmailVerification> findByEmail(String email);

    void deleteByEmail(String email);

    /** Cleanup helper — deletes every row that has already expired. */
    long deleteByExpiresAtBefore(Instant cutoff);
}
