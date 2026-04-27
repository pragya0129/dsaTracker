package com.example.dsa.user;

import com.example.dsa.auth.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/auth")
public class UserController {

    private final UserInfoService service;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final EmailVerificationService emailVerificationService;

    public UserController(UserInfoService service, JwtService jwtService,
            AuthenticationManager authenticationManager,
            EmailVerificationService emailVerificationService) {
        this.service = service;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
        this.emailVerificationService = emailVerificationService;
    }

    /* ───────────── Auth-cookie helpers ─────────────
     *
     * The JWT lives in an HttpOnly, SameSite=Lax cookie now — JavaScript
     * on the page literally cannot read it, so an XSS attack can't steal
     * the token, and DevTools' Storage tab won't show it either.
     *
     * Secure flag is conditional on the request being served over HTTPS
     * (directly or behind an X-Forwarded-Proto reverse proxy). Local HTTP
     * dev still works without HTTPS; production uses HTTPS, so the cookie
     * gets the Secure flag automatically.
     */
    private static final String JWT_COOKIE_NAME = "jwt";
    private static final long   JWT_COOKIE_MAX_AGE_SECONDS = 7L * 24 * 60 * 60; // 7 days

    private static boolean isSecureRequest(HttpServletRequest request) {
        if (request.isSecure()) return true;
        String fwd = request.getHeader("X-Forwarded-Proto");
        return fwd != null && fwd.equalsIgnoreCase("https");
    }

    private static void setAuthCookie(HttpServletRequest request, HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from(JWT_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(isSecureRequest(request))
                .sameSite("Lax")
                .path("/")
                .maxAge(JWT_COOKIE_MAX_AGE_SECONDS)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private static void clearAuthCookie(HttpServletRequest request, HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(JWT_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(isSecureRequest(request))
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    @GetMapping("/welcome")
    public String welcome() {
        return "Welcome this endpoint is not secure";
    }

    @PostMapping("/addNewUser")
    public ResponseEntity<String> addNewUser(@RequestBody UserInfo userInfo) {
        String result = service.addUser(userInfo);
        if (result.equals("Email already registered")) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * Step 1 of email-verified signup: validate input, send OTP to the email.
     * Body: {@code { name, email, password }}.
     */
    @PostMapping("/signup/request")
    public ResponseEntity<?> signupRequest(@RequestBody Map<String, String> body,
                                           HttpServletRequest request,
                                           HttpServletResponse response) {
        EmailVerificationService.RequestOutcome r = emailVerificationService.requestVerification(
                body.get("name"), body.get("username"), body.get("email"), body.get("password"));
        if (!r.sent()) {
            return ResponseEntity.badRequest().body(Map.of("error", r.error()));
        }
        // Feature-flag branch: when OTP is off, the account is already
        // created — issue the auth cookie so the frontend is logged in.
        if (r.autoCreatedUser() != null) {
            UserInfo user = r.autoCreatedUser();
            String token = jwtService.generateToken(user.getEmail());
            setAuthCookie(request, response, token);
            // NB: token is intentionally NOT echoed in the body — it lives
            // only in the HttpOnly cookie now, where JS can't see it.
            Map<String, Object> resp = new HashMap<>();
            resp.put("email",    user.getEmail());
            resp.put("name",     user.getName() != null ? user.getName() : "");
            resp.put("username", user.getUsername());
            resp.put("verificationSkipped", true);
            return ResponseEntity.ok(resp);
        }
        return ResponseEntity.ok(Map.of("message", "Verification code sent to your email"));
    }

    /**
     * Resend the OTP for an in-flight signup (respects cooldown).
     * Body: {@code { email }}. We don't leak whether the email has a pending
     * row or not — the response is shaped the same either way so an attacker
     * can't enumerate addresses.
     */
    @PostMapping("/signup/resend")
    public ResponseEntity<?> signupResend(@RequestBody Map<String, String> body) {
        // Resend is "request again with the same credentials" — but we don't
        // have the password here. So resend re-reads the pending row's stored
        // name + password hash and just regenerates the OTP. Implemented
        // inline to avoid leaking the stored hash back through the service.
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
        }
        // Shortcut: just do a requestVerification with a sentinel that tells
        // the service "reuse existing pending row if present" — but the
        // simpler approach is to require the client to re-send name+password.
        // For now we accept only the email and expect a valid pending row,
        // re-generating the OTP off the existing record.
        EmailVerificationService.RequestOutcome r =
                emailVerificationService.resendForPending(email);
        if (!r.sent()) {
            return ResponseEntity.badRequest().body(Map.of("error", r.error()));
        }
        return ResponseEntity.ok(Map.of("message", "A new verification code has been sent"));
    }

    /**
     * Step 2 of email-verified signup: check the OTP and, on success, create
     * the user + return a JWT so the frontend can log them in immediately.
     * Body: {@code { email, otp }}.
     */
    @PostMapping("/signup/verify")
    public ResponseEntity<?> signupVerify(@RequestBody Map<String, String> body,
                                          HttpServletRequest request,
                                          HttpServletResponse response) {
        EmailVerificationService.VerifyOutcome r = emailVerificationService.verifyAndCreate(
                body.get("email"), body.get("otp"));
        if (r.user() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", r.error()));
        }
        UserInfo user = r.user();
        String token = jwtService.generateToken(user.getEmail());
        setAuthCookie(request, response, token);
        // Token NOT in body — HttpOnly cookie only.
        Map<String, Object> resp = new HashMap<>();
        resp.put("email", user.getEmail());
        resp.put("name", user.getName() != null ? user.getName() : "");
        resp.put("username", user.getUsername());
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/generateToken")
    public ResponseEntity<?> authenticateAndGetToken(@RequestBody AuthRequest authRequest,
                                                     HttpServletRequest request,
                                                     HttpServletResponse response) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(authRequest.getUsername(), authRequest.getPassword()));
        if (!authentication.isAuthenticated()) {
            throw new UsernameNotFoundException("Invalid user request!");
        }
        String token = jwtService.generateToken(authRequest.getUsername());
        setAuthCookie(request, response, token);
        // No token in body — the HttpOnly cookie is the only place it lives.
        Map<String, Object> resp = new HashMap<>();
        resp.put("ok", true);
        resp.put("email", authRequest.getUsername());
        return ResponseEntity.ok(resp);
    }

    /** Clears the auth cookie. JS-callable from the frontend's Logout button. */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        clearAuthCookie(request, response);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    /** Returns the authenticated user's profile: name, email, profilePic */
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal UserDetails userDetails) {
        String email = userDetails.getUsername();
        UserInfo user = service.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
        // Use HashMap so we can carry a null profilePic/username value.
        Map<String, Object> body = new HashMap<>();
        body.put("name", user.getName() != null ? user.getName() : "");
        body.put("email", user.getEmail());
        body.put("username", user.getUsername());
        body.put("profilePic", user.getProfilePic());
        return ResponseEntity.ok(body);
    }

    /**
     * Public availability check for username at signup time — no auth
     * required (the user doesn't have an account yet). We don't expose
     * any user data beyond "taken or free".
     */
    @GetMapping("/username/check")
    public ResponseEntity<?> checkUsernameAvailable(@RequestParam("u") String u) {
        String err = UsernameValidator.validate(u);
        if (err != null) {
            return ResponseEntity.ok(Map.of("available", false, "reason", err));
        }
        boolean free = service.isUsernameAvailable(u);
        return ResponseEntity.ok(free
                ? Map.of("available", true)
                : Map.of("available", false, "reason", "That username is taken"));
    }

    /** Update the authenticated user's @username. */
    @PutMapping("/me/username")
    public ResponseEntity<?> updateUsername(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String error = service.setUsername(userDetails.getUsername(), body.get("username"));
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("error", error));
        }
        UserInfo user = service.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return ResponseEntity.ok(Map.of("username", user.getUsername()));
    }

    /** Update the authenticated user's display name. */
    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String newName = body.get("name");
        if (newName == null || newName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name cannot be empty"));
        }
        service.updateName(userDetails.getUsername(), newName.trim());
        return ResponseEntity.ok(Map.of("name", newName.trim()));
    }

    /** Change the authenticated user's password. */
    @PutMapping("/password")
    public ResponseEntity<?> changePassword(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        String error = service.changePassword(userDetails.getUsername(), currentPassword, newPassword);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("error", error));
        }
        return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
    }

    /** Permanently delete the authenticated user's account. */
    @DeleteMapping("/me")
    public ResponseEntity<?> deleteAccount(@AuthenticationPrincipal UserDetails userDetails) {
        service.deleteAccount(userDetails.getUsername());
        return ResponseEntity.ok(Map.of("message", "Account deleted"));
    }

    /** Update the authenticated user's profile picture (base64 data URL). */
    @PutMapping("/me/picture")
    public ResponseEntity<?> updateProfilePicture(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        String dataUrl = body.get("profilePic");
        String error = service.updateProfilePic(userDetails.getUsername(), dataUrl);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("error", error));
        }
        Map<String, Object> resp = new HashMap<>();
        resp.put("profilePic", dataUrl);
        return ResponseEntity.ok(resp);
    }

    /** Remove the authenticated user's profile picture. */
    @DeleteMapping("/me/picture")
    public ResponseEntity<?> deleteProfilePicture(@AuthenticationPrincipal UserDetails userDetails) {
        service.updateProfilePic(userDetails.getUsername(), null);
        Map<String, Object> resp = new HashMap<>();
        resp.put("profilePic", null);
        return ResponseEntity.ok(resp);
    }

    /** Return the authenticated user's notification preferences. */
    @GetMapping("/me/notifications")
    public ResponseEntity<?> getNotificationPrefs(@AuthenticationPrincipal UserDetails userDetails) {
        UserInfo user = service.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return ResponseEntity.ok(Map.of(
                "enabled", user.isNotificationEnabled(),
                "reminderTime", user.getReminderTime() != null ? user.getReminderTime() : "19:00",
                "reminderTimezone", user.getReminderTimezone() != null ? user.getReminderTimezone() : "UTC"));
    }

    /** Update the authenticated user's notification preferences. */
    @PutMapping("/me/notifications")
    public ResponseEntity<?> updateNotificationPrefs(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        String time = body.get("reminderTime") == null ? null : body.get("reminderTime").toString();
        String tz = body.get("reminderTimezone") == null ? null : body.get("reminderTimezone").toString();

        String error = service.updateNotificationPrefs(userDetails.getUsername(), enabled, time, tz);
        if (error != null) {
            return ResponseEntity.badRequest().body(Map.of("error", error));
        }
        // Echo the stored state back so the UI stays in sync.
        UserInfo user = service.findByEmail(userDetails.getUsername())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return ResponseEntity.ok(Map.of(
                "enabled", user.isNotificationEnabled(),
                "reminderTime", user.getReminderTime() != null ? user.getReminderTime() : "19:00",
                "reminderTimezone", user.getReminderTimezone() != null ? user.getReminderTimezone() : "UTC"));
    }

    @GetMapping("/user/userProfile")
    public String userProfile() {
        return "Welcome to User Profile";
    }

    @GetMapping("/admin/adminProfile")
    public String adminProfile() {
        return "Welcome to Admin Profile";
    }
}
