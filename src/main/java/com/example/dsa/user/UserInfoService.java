package com.example.dsa.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.Optional;
import java.util.Map;

@Service
public class UserInfoService implements org.springframework.security.core.userdetails.UserDetailsService {

    private final UserInfoRepository repository;
    private final PasswordEncoder encoder;

    @Autowired
    public UserInfoService(UserInfoRepository repository, PasswordEncoder encoder) {
        this.repository = repository;
        this.encoder = encoder;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Optional<UserInfo> userInfoOpt = repository.findByEmail(username);
        if (userInfoOpt.isEmpty()) {
            throw new UsernameNotFoundException("User not found with email: " + username);
        }
        UserInfo user = userInfoOpt.get();
        return new UserInfoDetails(user);
    }

    public String addUser(UserInfo userInfo) {
        if (repository.findByEmail(userInfo.getEmail()).isPresent()) {
            return "Email already registered";
        }
        if (userInfo.getRoles() == null || userInfo.getRoles().isBlank()) {
            userInfo.setRoles("ROLE_USER");
        }
        userInfo.setPassword(encoder.encode(userInfo.getPassword()));
        repository.save(userInfo);
        return "User added successfully!";
    }

    /** Returns the UserInfo for a given email, wrapped in Optional. */
    public Optional<UserInfo> findByEmail(String email) {
        return repository.findByEmail(email);
    }

    /** Returns the DB id of the user with the given email, as a String. */
    public String findIdByEmail(String email) {
        return repository.findByEmail(email)
                .map(u -> String.valueOf(u.getId()))
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }

    /**
     * Is a username free to grab right now? Pure read; we use it from the
     * public availability-check endpoint during signup.
     */
    public boolean isUsernameAvailable(String raw) {
        if (UsernameValidator.validate(raw) != null) return false;
        return !repository.existsByUsername(UsernameValidator.normalise(raw));
    }

    /**
     * Set or change a user's username. Returns an error message or null on
     * success. Uniqueness check is race-window-small; the DB's unique index
     * is the actual guarantee.
     */
    public String setUsername(String email, String rawUsername) {
        String err = UsernameValidator.validate(rawUsername);
        if (err != null) return err;
        String u = UsernameValidator.normalise(rawUsername);

        UserInfo user = repository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        // Allow idempotent no-op.
        if (u.equals(user.getUsername())) return null;

        if (repository.existsByUsername(u)) {
            return "That username is taken";
        }
        user.setUsername(u);
        repository.save(user);
        return null;
    }

    /** Update a user's display name. */
    public void updateName(String email, String newName) {
        UserInfo user = repository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        user.setName(newName);
        repository.save(user);
    }

    /**
     * Change a user's password after verifying the current password.
     * Returns an error message or null on success.
     */
    public String changePassword(String email, String currentPassword, String newPassword) {
        UserInfo user = repository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        if (!encoder.matches(currentPassword, user.getPassword())) {
            return "Current password is incorrect";
        }
        if (newPassword == null || newPassword.length() < 8) {
            return "New password must be at least 8 characters";
        }
        user.setPassword(encoder.encode(newPassword));
        repository.save(user);
        return null;
    }

    /** Permanently delete a user account. */
    public void deleteAccount(String email) {
        UserInfo user = repository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        repository.delete(user);
    }

    /** Max accepted size (in characters) for a base64 data URL — ~2.5 MB encoded. */
    private static final int MAX_PIC_LENGTH = 2_700_000;

    /**
     * Persist a base64 data URL as the user's profile picture. Pass null to clear.
     * Returns an error message, or null on success.
     */
    /**
     * Update notification preferences. Returns an error message or null on success.
     * Validates time as HH:mm and timezone as a real java.time.ZoneId so the
     * scheduler never has to cope with garbage input.
     */
    public String updateNotificationPrefs(String email, boolean enabled, String time, String timezone) {
        UserInfo user = repository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        String normalizedTime = time == null ? "" : time.trim();
        if (!normalizedTime.isEmpty()) {
            try {
                LocalTime parsed = LocalTime.parse(normalizedTime);
                // Reformat so we always store exactly HH:mm.
                normalizedTime = String.format("%02d:%02d", parsed.getHour(), parsed.getMinute());
            } catch (DateTimeParseException e) {
                return "Reminder time must be in HH:mm format (e.g. 19:00)";
            }
        }

        String normalizedZone = timezone == null ? "" : timezone.trim();
        if (!normalizedZone.isEmpty()) {
            try {
                ZoneId.of(normalizedZone);
            } catch (Exception e) {
                return "Unrecognised timezone: " + normalizedZone;
            }
        }

        user.setNotificationEnabled(enabled);
        if (!normalizedTime.isEmpty()) user.setReminderTime(normalizedTime);
        if (!normalizedZone.isEmpty()) user.setReminderTimezone(normalizedZone);
        repository.save(user);
        return null;
    }

    public String updateProfilePic(String email, String dataUrl) {
        UserInfo user = repository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        if (dataUrl == null || dataUrl.isBlank()) {
            user.setProfilePic(null);
            repository.save(user);
            return null;
        }
        if (!dataUrl.startsWith("data:image/")) {
            return "Profile picture must be a data:image/... URL";
        }
        if (dataUrl.length() > MAX_PIC_LENGTH) {
            return "Profile picture is too large (max ~2 MB)";
        }
        user.setProfilePic(dataUrl);
        repository.save(user);
        return null;
    }
}
