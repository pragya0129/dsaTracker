package com.example.dsa.notifications;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * One row per in-app notification.
 *
 * The fields are deliberately flexible so the same table can back every
 * notification type we emit (like, follow, post-from-followed, challenge
 * invite, system announcement). The frontend chooses how to render based
 * on {@link #type}.
 *
 *  type    — short enum-ish string:
 *              LIKE · FOLLOW · POST_FROM_FOLLOWED · CHALLENGE_INVITE · SYSTEM
 *  actor…  — the user who caused the notification (null for SYSTEM).
 *  entityId — id of the thing the notification is about (post id, challenge
 *             id, etc.). May be null.
 *  link    — relative frontend route to open when the row is clicked.
 */
@Entity
@Table(
    name = "user_notifications",
    indexes = {
        @Index(name = "idx_notif_recipient",      columnList = "recipient_email"),
        @Index(name = "idx_notif_recipient_read", columnList = "recipient_email, read_flag"),
        @Index(name = "idx_notif_created_at",     columnList = "created_at")
    }
)
public class UserNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_email", nullable = false, length = 200)
    private String recipientEmail;

    @Column(nullable = false, length = 40)
    private String type;

    @Column(name = "actor_email", length = 200)
    private String actorEmail;

    @Column(name = "actor_name", length = 200)
    private String actorName;

    @Column(name = "entity_id")
    private Long entityId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(length = 500)
    private String link;

    // "read" is a reserved word in some DB dialects, so the column is
    // explicitly named read_flag while the Java field stays idiomatic.
    @Column(name = "read_flag", nullable = false)
    private boolean read = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    /* ── getters / setters ── */
    public Long getId() { return id; }
    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String v) { this.recipientEmail = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public String getActorEmail() { return actorEmail; }
    public void setActorEmail(String v) { this.actorEmail = v; }
    public String getActorName() { return actorName; }
    public void setActorName(String v) { this.actorName = v; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long v) { this.entityId = v; }
    public String getTitle() { return title; }
    public void setTitle(String v) { this.title = v; }
    public String getMessage() { return message; }
    public void setMessage(String v) { this.message = v; }
    public String getLink() { return link; }
    public void setLink(String v) { this.link = v; }
    public boolean isRead() { return read; }
    public void setRead(boolean v) { this.read = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime v) { this.createdAt = v; }
}
