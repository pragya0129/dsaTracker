package com.example.dsa.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserInfoRepository extends JpaRepository<UserInfo, Integer> {
    Optional<UserInfo> findByEmail(String email);

    /** Lookup by public @handle (lowercase stored). */
    Optional<UserInfo> findByUsername(String username);

    boolean existsByUsername(String username);

    /** All users who have opted in to reminder emails — used by the scheduler. */
    List<UserInfo> findByNotificationEnabledTrue();
}
