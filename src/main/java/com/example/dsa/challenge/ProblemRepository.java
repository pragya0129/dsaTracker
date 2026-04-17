package com.example.dsa.challenge;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ProblemRepository extends JpaRepository<Problem, Long> {

    List<Problem> findByDifficultyIgnoreCase(String difficulty);

    Optional<Problem> findByTitleSlug(String titleSlug);

    List<Problem> findByTopicIgnoreCaseAndDifficultyIgnoreCase(String topic, String difficulty);

    List<Problem> findByTopicIgnoreCase(String topic);

    @Query("SELECT p FROM Problem p WHERE LOWER(p.difficulty) = LOWER(:diff) ORDER BY RAND()")
    List<Problem> findRandomByDifficulty(@Param("diff") String difficulty);

    /** Random problems for a specific platform and difficulty */
    @Query("SELECT p FROM Problem p WHERE LOWER(p.platform) = LOWER(:platform) AND LOWER(p.difficulty) = LOWER(:diff) ORDER BY RAND()")
    List<Problem> findRandomByPlatformAndDifficulty(@Param("platform") String platform, @Param("diff") String difficulty);

    /** Random problems for a specific platform, topic, and difficulty */
    @Query("SELECT p FROM Problem p WHERE LOWER(p.platform) = LOWER(:platform) AND LOWER(p.topic) = LOWER(:topic) AND LOWER(p.difficulty) = LOWER(:diff) ORDER BY RAND()")
    List<Problem> findRandomByPlatformAndTopicAndDifficulty(@Param("platform") String platform, @Param("topic") String topic, @Param("diff") String diff);

    /** Random problems for a set of platforms and difficulty (for shared-platform contests) */
    @Query("SELECT p FROM Problem p WHERE LOWER(p.platform) IN :platforms AND LOWER(p.difficulty) = LOWER(:diff) ORDER BY RAND()")
    List<Problem> findRandomByPlatformsAndDifficulty(@Param("platforms") List<String> platforms, @Param("diff") String difficulty);

    /** Random problems for a set of platforms, topic, and difficulty */
    @Query("SELECT p FROM Problem p WHERE LOWER(p.platform) IN :platforms AND LOWER(p.topic) = LOWER(:topic) AND LOWER(p.difficulty) = LOWER(:diff) ORDER BY RAND()")
    List<Problem> findRandomByPlatformsAndTopicAndDifficulty(@Param("platforms") List<String> platforms, @Param("topic") String topic, @Param("diff") String diff);

    boolean existsByTitleSlug(String titleSlug);
}
