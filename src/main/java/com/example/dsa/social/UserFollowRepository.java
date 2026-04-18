package com.example.dsa.social;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserFollowRepository extends JpaRepository<UserFollow, Long> {

    boolean existsByFollowerEmailAndFollowingEmail(String follower, String following);

    void deleteByFollowerEmailAndFollowingEmail(String follower, String following);

    /** Profile lookups. */
    List<UserFollow> findByFollowingEmailOrderByCreatedAtDesc(String followingEmail);
    List<UserFollow> findByFollowerEmailOrderByCreatedAtDesc(String followerEmail);

    long countByFollowingEmail(String followingEmail);  // followers of X
    long countByFollowerEmail(String followerEmail);    // X is following N people
}
