package com.example.dsa.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    /**
     * Hardcoded default for local dev only. If this string is still the
     * signing key when the app is deployed, any visitor to a public
     * instance could mint admin tokens — so we explicitly warn on every
     * startup, and production deploys MUST override via app.jwt.secret.
     */
    public static final String DEFAULT_DEV_SECRET =
            "5367566859703373367639792F423F452848284D6251655468576D5A71347437";

    private final String secret;

    /**
     * Token lifetime in milliseconds. Defaults to 24 hours so a user can't get
     * kicked out of a 60-minute contest by their token expiring mid-round.
     * Tune via {@code app.jwt.expiration-ms} in application.properties.
     *
     * <p>Longer-term, the right move is a refresh-token flow — but extending
     * the access-token lifetime is a safe short-term fix given contests are
     * the binding constraint and there's no refresh mechanism today.
     */
    private final long expirationMs;

    public JwtService(
            @Value("${app.jwt.secret:}") String configuredSecret,
            @Value("${app.jwt.expiration-ms:86400000}") long expirationMs) {
        this.expirationMs = expirationMs;
        if (configuredSecret == null || configuredSecret.isBlank()) {
            log.warn("⚠️  app.jwt.secret is empty — using the dev default. Set APP_JWT_SECRET " +
                    "(or app.jwt.secret) to a 32+ byte base64 string BEFORE deploying. " +
                    "Generate one with: openssl rand -base64 48");
            this.secret = DEFAULT_DEV_SECRET;
        } else if (DEFAULT_DEV_SECRET.equals(configuredSecret)) {
            log.warn("⚠️  app.jwt.secret is still the committed dev default — rotate it " +
                    "before shipping to real users.");
            this.secret = configuredSecret;
        } else {
            this.secret = configuredSecret;
        }
    }

    public String generateToken(String email) {
        Map<String, Object> claims = new HashMap<>();
        return createToken(claims, email);
    }

    private String createToken(Map<String, Object> claims, String email) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(email)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + expirationMs))
                .signWith(getSignKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    private Key getSignKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secret);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSignKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public Boolean validateToken(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }
}
