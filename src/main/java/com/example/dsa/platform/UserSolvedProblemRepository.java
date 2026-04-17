package com.example.dsa.platform;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Set;

@Repository
public interface UserSolvedProblemRepository extends JpaRepository<UserSolvedProblem, Long> {

    boolean existsByUserIdAndPlatformAndTitleSlug(String userId, String platform, String titleSlug);

    /** All solved slugs for this user across all platforms */
    @Query("SELECT u.titleSlug FROM UserSolvedProblem u WHERE u.userId = :userId")
    Set<String> findAllSlugsByUserId(@Param("userId") String userId);

    /** All solved slugs for this user on a specific platform */
    @Query("SELECT u.titleSlug FROM UserSolvedProblem u WHERE u.userId = :userId AND LOWER(u.platform) = LOWER(:platform)")
    Set<String> findSlugsByUserIdAndPlatform(@Param("userId") String userId, @Param("platform") String platform);

    void deleteByUserId(String userId);
}
