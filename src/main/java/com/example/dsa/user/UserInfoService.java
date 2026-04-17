package com.example.dsa.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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
}
