package com.example.dsa.social;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Set;

@Repository
public interface SavedPostRepository extends JpaRepository<SavedPost, Long> {

    boolean existsByUserEmailAndPostId(String userEmail, Long postId);

    void deleteByUserEmailAndPostId(String userEmail, Long postId);

    List<SavedPost> findByUserEmailOrderBySavedAtDesc(String userEmail);

    /** Single-query "which of these posts has the user saved?" — used to
     *  populate isSaved on a feed page in O(1) DB calls instead of N. */
    @Query("SELECT s.postId FROM SavedPost s WHERE s.userEmail = :email AND s.postId IN :ids")
    Set<Long> findSavedPostIdsForUser(@Param("email") String userEmail,
                                      @Param("ids") List<Long> postIds);
}
