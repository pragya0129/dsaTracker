package com.example.dsa.challenge;

import com.example.dsa.user.UserInfo;
import com.example.dsa.user.UserInfoRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChallengeService {

    /* ── Contest configuration (all rules in backend) ── */
    private static final Map<ContestType, int[]> PROBLEM_COUNTS = Map.of(
            ContestType.BEGINNER, new int[] { 2, 1, 0 }, // easy, medium, hard
            ContestType.MEDIUM, new int[] { 1, 3, 1 },
            ContestType.HARD, new int[] { 0, 2, 3 });
    private static final Map<ContestType, Integer> DURATION_MINUTES = Map.of(
            ContestType.BEGINNER, 30,
            ContestType.MEDIUM, 45,
            ContestType.HARD, 60);

    private final ChallengeRepository challengeRepo;
    private final ChallengeProblemRepository cpRepo;
    private final ChallengeAttemptRepository caRepo;
    private final ProblemRepository problemRepo;
    private final UserInfoRepository userInfoRepo;

    public ChallengeService(ChallengeRepository challengeRepo,
            ChallengeProblemRepository cpRepo,
            ChallengeAttemptRepository caRepo,
            ProblemRepository problemRepo,
            UserInfoRepository userInfoRepo) {
        this.challengeRepo = challengeRepo;
        this.cpRepo = cpRepo;
        this.caRepo = caRepo;
        this.problemRepo = problemRepo;
        this.userInfoRepo = userInfoRepo;
    }

    /* ── 1. Create challenge ── */
    @Transactional
    public ChallengeResponse createChallenge(String challengerEmail, CreateChallengeRequest req) {
        String opponentEmail = req.getOpponentEmail().trim().toLowerCase();
        if (challengerEmail.equalsIgnoreCase(opponentEmail))
            throw new IllegalArgumentException("You cannot challenge yourself");

        // Anti-spam: only 1 pending challenge between same pair allowed
        if (challengeRepo.existsByChallengerIdAndOpponentIdAndStatus(
                challengerEmail, opponentEmail, ChallengeStatus.PENDING))
            throw new IllegalArgumentException("You already have a pending challenge with this user");

        UserInfo opponent = userInfoRepo.findByEmail(opponentEmail)
                .orElseThrow(() -> new IllegalArgumentException("No user found with email: " + opponentEmail));
        UserInfo challenger = userInfoRepo.findByEmail(challengerEmail)
                .orElseThrow(() -> new IllegalArgumentException("Challenger not found"));

        ContestType type = ContestType.valueOf(req.getContestType().toUpperCase());

        Challenge c = new Challenge();
        c.setChallengerId(challengerEmail);
        c.setOpponentId(opponentEmail);
        c.setChallengerName(challenger.getName());
        c.setOpponentName(opponent.getName());
        c.setContestType(type);
        c.setStatus(ChallengeStatus.PENDING);
        Challenge saved = challengeRepo.save(c);

        // Select problems
        selectAndSaveProblems(saved.getId(), type,
                new HashSet<>() /* in future: pass solved slugs of both users to exclude */);

        return buildResponse(saved);
    }

    /* ── 2. Accept challenge ── */
    @Transactional
    public ChallengeResponse acceptChallenge(Long challengeId, String opponentEmail) {
        Challenge c = getOrThrow(challengeId);
        if (!c.getOpponentId().equalsIgnoreCase(opponentEmail))
            throw new IllegalArgumentException("You are not the opponent of this challenge");
        if (c.getStatus() != ChallengeStatus.PENDING)
            throw new IllegalArgumentException("Challenge is not in PENDING state");

        int duration = DURATION_MINUTES.get(c.getContestType());
        c.setStatus(ChallengeStatus.ACTIVE);
        c.setStartTime(LocalDateTime.now());
        c.setEndTime(LocalDateTime.now().plusMinutes(duration));
        return buildResponse(challengeRepo.save(c));
    }

    /* ── 3. Decline challenge ── */
    @Transactional
    public void declineChallenge(Long challengeId, String opponentEmail) {
        Challenge c = getOrThrow(challengeId);
        if (!c.getOpponentId().equalsIgnoreCase(opponentEmail))
            throw new IllegalArgumentException("You are not the opponent of this challenge");
        c.setStatus(ChallengeStatus.DECLINED);
        challengeRepo.save(c);
    }

    /* ── 4. Get challenge ── */
    public ChallengeResponse getChallenge(Long id) {
        return buildResponse(getOrThrow(id));
    }

    /* ── 5. My challenges ── */
    public List<ChallengeResponse> myChallenges(String email) {
        return challengeRepo.findAllInvolving(email).stream()
                .map(this::buildResponse).collect(Collectors.toList());
    }

    /* ── 6. Incoming invitations ── */
    public List<ChallengeResponse> pendingInvitations(String email) {
        return challengeRepo.findByOpponentIdAndStatus(email, ChallengeStatus.PENDING).stream()
                .map(this::buildResponse).collect(Collectors.toList());
    }

    /* ── 7. Leaderboard (live progress) ── */
    public ChallengeResponse leaderboard(Long challengeId) {
        return buildResponse(getOrThrow(challengeId));
    }

    /* ── 8. Record a solve (called by platform sync) ── */
    @Transactional
    public void recordSolve(Long challengeId, String userId, String titleSlug) {
        Challenge c = getOrThrow(challengeId);
        if (c.getStatus() != ChallengeStatus.ACTIVE)
            return;
        expireIfNeeded(c);
        if (c.getStatus() != ChallengeStatus.ACTIVE)
            return;

        List<ChallengeProblem> cps = cpRepo.findByChallengeIdOrderByProblemOrder(challengeId);
        ChallengeProblem matched = cps.stream()
                .filter(p -> p.getTitleSlug().equalsIgnoreCase(titleSlug))
                .findFirst().orElse(null);
        if (matched == null)
            return;

        Optional<ChallengeAttempt> existing = caRepo
                .findByChallengeIdAndUserIdAndProblemId(challengeId, userId, matched.getProblemId());
        if (existing.isPresent() && existing.get().isSolved())
            return; // already recorded

        ChallengeAttempt attempt = existing.orElse(new ChallengeAttempt());
        attempt.setChallengeId(challengeId);
        attempt.setUserId(userId);
        attempt.setProblemId(matched.getProblemId());
        attempt.setTitleSlug(titleSlug);
        attempt.setSolved(true);
        attempt.setSolvedAt(LocalDateTime.now());
        caRepo.save(attempt);

        // After each solve, check if we should finish
        finishIfAllSolved(c);
    }

    /* ── 9. Manually finish ── */
    @Transactional
    public ChallengeResponse finish(Long challengeId, String requestingUser) {
        Challenge c = getOrThrow(challengeId);
        if (!c.getChallengerId().equals(requestingUser) && !c.getOpponentId().equals(requestingUser))
            throw new IllegalArgumentException("Not a participant");
        if (c.getStatus() == ChallengeStatus.ACTIVE || c.getStatus() == ChallengeStatus.PENDING) {
            resolveWinner(c);
            challengeRepo.save(c);
        }
        return buildResponse(c);
    }

    /* ── Scheduled: auto-expire active contests ── */
    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void autoExpire() {
        List<Challenge> active = challengeRepo.findAll().stream()
                .filter(c -> c.getStatus() == ChallengeStatus.ACTIVE
                        && c.getEndTime() != null
                        && LocalDateTime.now().isAfter(c.getEndTime()))
                .collect(Collectors.toList());
        for (Challenge c : active) {
            resolveWinner(c);
            challengeRepo.save(c);
        }
        // Expire old PENDING challenges (> 48 hours)
        challengeRepo.findAll().stream()
                .filter(c -> c.getStatus() == ChallengeStatus.PENDING
                        && c.getCreatedAt().plusHours(48).isBefore(LocalDateTime.now()))
                .forEach(c -> {
                    c.setStatus(ChallengeStatus.EXPIRED);
                    challengeRepo.save(c);
                });
    }

    /* ═══════ private helpers ═══════ */

    private void selectAndSaveProblems(Long challengeId, ContestType type, Set<String> excludedSlugs) {
        int[] counts = PROBLEM_COUNTS.get(type);
        String[] diffs = { "easy", "medium", "hard" };
        int order = 1;
        for (int i = 0; i < diffs.length; i++) {
            int needed = counts[i];
            if (needed == 0)
                continue;
            List<Problem> pool = problemRepo.findRandomByDifficulty(diffs[i]);
            // Prefer unsolved by both players
            List<Problem> preferred = pool.stream()
                    .filter(p -> !excludedSlugs.contains(p.getTitleSlug()))
                    .collect(Collectors.toList());
            List<Problem> source = preferred.size() >= needed ? preferred : pool;
            for (int j = 0; j < Math.min(needed, source.size()); j++) {
                Problem p = source.get(j);
                ChallengeProblem cp = new ChallengeProblem();
                cp.setChallengeId(challengeId);
                cp.setProblemId(p.getId());
                cp.setTitleSlug(p.getTitleSlug());
                cp.setTitle(p.getTitle());
                cp.setDifficulty(p.getDifficulty());
                cp.setPlatform(p.getPlatform());
                cp.setProblemUrl(p.getProblemUrl());
                cp.setProblemOrder(order++);
                cpRepo.save(cp);
            }
        }
    }

    private void expireIfNeeded(Challenge c) {
        if (c.getEndTime() != null && LocalDateTime.now().isAfter(c.getEndTime())) {
            resolveWinner(c);
            challengeRepo.save(c);
        }
    }

    private void finishIfAllSolved(Challenge c) {
        List<ChallengeProblem> problems = cpRepo.findByChallengeIdOrderByProblemOrder(c.getId());
        int total = problems.size();
        long cSolved = caRepo.countByChallengeIdAndUserIdAndSolvedTrue(c.getId(), c.getChallengerId());
        long oSolved = caRepo.countByChallengeIdAndUserIdAndSolvedTrue(c.getId(), c.getOpponentId());
        if (cSolved + oSolved >= total * 2L) { // both finished all
            resolveWinner(c);
            challengeRepo.save(c);
        }
    }

    private void resolveWinner(Challenge c) {
        long cSolved = caRepo.countByChallengeIdAndUserIdAndSolvedTrue(c.getId(), c.getChallengerId());
        long oSolved = caRepo.countByChallengeIdAndUserIdAndSolvedTrue(c.getId(), c.getOpponentId());

        if (cSolved > oSolved) {
            c.setWinnerId(c.getChallengerId());
        } else if (oSolved > cSolved) {
            c.setWinnerId(c.getOpponentId());
        } else {
            // Tie → earliest last solve time wins
            LocalDateTime cLast = lastSolveTime(c.getId(), c.getChallengerId());
            LocalDateTime oLast = lastSolveTime(c.getId(), c.getOpponentId());
            if (cLast != null && oLast != null) {
                c.setWinnerId(cLast.isBefore(oLast) ? c.getChallengerId() : c.getOpponentId());
            } else if (cLast != null) {
                c.setWinnerId(c.getChallengerId());
            } else {
                c.setWinnerId(null); // true draw with no solves
            }
        }
        c.setStatus(ChallengeStatus.COMPLETED);
    }

    private LocalDateTime lastSolveTime(Long challengeId, String userId) {
        return caRepo.findByChallengeIdAndUserId(challengeId, userId).stream()
                .filter(ChallengeAttempt::isSolved)
                .map(ChallengeAttempt::getSolvedAt)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);
    }

    private ChallengeResponse buildResponse(Challenge c) {
        ChallengeResponse r = new ChallengeResponse();
        r.setId(c.getId());
        r.setChallengerId(c.getChallengerId());
        r.setChallengerName(c.getChallengerName());
        r.setOpponentId(c.getOpponentId());
        r.setOpponentName(c.getOpponentName());
        r.setContestType(c.getContestType().name());
        r.setStatus(c.getStatus().name());
        r.setStartTime(c.getStartTime());
        r.setEndTime(c.getEndTime());
        r.setCreatedAt(c.getCreatedAt());
        r.setWinnerId(c.getWinnerId());
        r.setDurationMinutes(DURATION_MINUTES.get(c.getContestType()));

        // Problems
        r.setProblems(cpRepo.findByChallengeIdOrderByProblemOrder(c.getId()));

        // Leaderboard
        long cSolved = caRepo.countByChallengeIdAndUserIdAndSolvedTrue(c.getId(), c.getChallengerId());
        long oSolved = caRepo.countByChallengeIdAndUserIdAndSolvedTrue(c.getId(), c.getOpponentId());
        r.setChallengerProgress(new ChallengeResponse.LeaderboardEntry(
                c.getChallengerId(), c.getChallengerName(), cSolved, lastSolveTime(c.getId(), c.getChallengerId())));
        r.setOpponentProgress(new ChallengeResponse.LeaderboardEntry(
                c.getOpponentId(), c.getOpponentName(), oSolved, lastSolveTime(c.getId(), c.getOpponentId())));

        // Timer
        if (c.getEndTime() != null) {
            long secs = ChronoUnit.SECONDS.between(LocalDateTime.now(), c.getEndTime());
            r.setSecondsRemaining(Math.max(0, secs));
        }
        return r;
    }

    private Challenge getOrThrow(Long id) {
        return challengeRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Challenge not found: " + id));
    }
}
