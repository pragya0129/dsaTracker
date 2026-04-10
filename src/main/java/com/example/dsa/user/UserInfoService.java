package com.example.dsa.user;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Optional;

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

    /** Returns the DB id of the user with the given email, as a String. */
    public String findIdByEmail(String email) {
        return repository.findByEmail(email)
                .map(u -> String.valueOf(u.getId()))
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}
