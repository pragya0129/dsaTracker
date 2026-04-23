package com.example.dsa.notifications;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserNotificationRepository extends JpaRepository<UserNotification, Long> {

    /** Most recent first, paginated. Used by the bell dropdown. */
    Page<UserNotification> findByRecipientEmailOrderByCreatedAtDesc(String recipientEmail, Pageable pageable);

    /** Cheap unread-count for the badge next to the bell. */
    long countByRecipientEmailAndReadFalse(String recipientEmail);

    /** Bulk mark as read — called when the user opens the dropdown. */
    @Modifying
    @Query("UPDATE UserNotification n SET n.read = true " +
           "WHERE n.recipientEmail = :email AND n.read = false")
    int markAllRead(@Param("email") String email);
}
