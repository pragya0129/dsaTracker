package com.example.dsa.platform;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "platform_accounts", uniqueConstraints = @UniqueConstraint(columnNames = { "user_id", "platform_name" }))
public class PlatformAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, length = 36)
    private String userId;

    @Column(name = "platform_name", nullable = false, length = 50)
    private String platformName;

    @Column(nullable = false, length = 100)
    private String username;

    @Column(name = "added_on")
    private LocalDateTime addedOn;

    @Column(name = "last_synced")
    private LocalDateTime lastSynced;

    public PlatformAccount() {
    }

    public Long getId() { return id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPlatformName() { return platformName; }
    public void setPlatformName(String platformName) { this.platformName = platformName; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public LocalDateTime getAddedOn() { return addedOn; }
    public void setAddedOn(LocalDateTime addedOn) { this.addedOn = addedOn; }

    public LocalDateTime getLastSynced() { return lastSynced; }
    public void setLastSynced(LocalDateTime lastSynced) { this.lastSynced = lastSynced; }
}
