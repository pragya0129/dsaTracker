package com.example.dsa.challenge;

import com.example.dsa.platform.PlatformAccountRepository;
import com.example.dsa.platform.TopicStats;
import com.example.dsa.platform.TopicStatsRepository;
import com.example.dsa.platform.UserSolvedProblemRepository;
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

    /* ── Contest configuration ── */
    private static final Map<ContestType, int[]> PROBLEM_COUNTS = Map.of(
            ContestType.BEGINNER, new int[] { 2, 1, 0 }, // easy, medium, hard
            ContestType.MEDIUM,   new int[] { 1, 3, 1 },
            ContestType.HARD,     new int[] { 0, 2, 3 });
    // CUSTOM: counts are provided at runtime via CreateChallengeRequest

    private static final Map<ContestType, Integer> DURATION_MINUTES = Map.of(
            ContestType.BEGINNER, 30,
            ContestType.MEDIUM,   45,
            ContestType.HARD,     60);
    // CUSTOM duration computed dynamically: 10 min per Easy, 15 per Medium, 20 per Hard (min 15)

    private final ChallengeRepository challengeRepo;
    private final ChallengeProblemRepository cpRepo;
    private final ChallengeAttemptRepository caRepo;
    private final ProblemRepository problemRepo;
    private final UserInfoRepository userInfoRepo;
    private final PlatformAccountRepository platformAccountRepo;
    private final TopicStatsRepository topicStatsRepo;
    private final UserSolvedProblemRepository solvedProblemRepo;

    public ChallengeService(ChallengeRepository challengeRepo,
            ChallengeProblemRepository cpRepo,
            ChallengeAttemptRepository caRepo,
            ProblemRepository problemRepo,
            UserInfoRepository userInfoRepo,
            PlatformAccountRepository platformAccountRepo,
            TopicStatsRepository topicStatsRepo,
            UserSolvedProblemRepository solvedProblemRepo) {
        this.challengeRepo = challengeRepo;
        this.cpRepo = cpRepo;
        this.caRepo = caRepo;
        this.problemRepo = problemRepo;
        this.userInfoRepo = userInfoRepo;
        this.platformAccountRepo = platformAccountRepo;
        this.topicStatsRepo = topicStatsRepo;
        this.solvedProblemRepo = solvedProblemRepo;
    }

    /* ── 1. Create challenge ── */
    @Transactional
    public ChallengeResponse createChallenge(String challengerEmail, CreateChallengeRequest req) {
        // Prefer @username when provided; fall back to email for legacy clients.
        String opponentEmail;
        if (req.getOpponentUsername() != null && !req.getOpponentUsername().isBlank()) {
            String handle = req.getOpponentUsername().trim().toLowerCase();
            UserInfo u = userInfoRepo.findByUsername(handle)
                    .orElseThrow(() -> new IllegalArgumentException("No user with @" + handle));
            opponentEmail = u.getEmail();
        } else if (req.getOpponentEmail() != null && !req.getOpponentEmail().isBlank()) {
            opponentEmail = req.getOpponentEmail().trim().toLowerCase();
        } else {
            throw new IllegalArgumentException("Specify an opponent by username or email");
        }
        if (challengerEmail.equalsIgnoreCase(opponentEmail))
            throw new IllegalArgumentException("You cannot challenge yourself");

        // Anti-spam: only 1 pending challenge between same pair
        if (challengeRepo.existsByChallengerIdAndOpponentIdAndStatus(
                challengerEmail, opponentEmail, ChallengeStatus.PENDING))
            throw new IllegalArgumentException("You already have a pending challenge with this user");

        UserInfo opponent = userInfoRepo.findByEmail(opponentEmail)
                .orElseThrow(() -> new IllegalArgumentException("No user found with email: " + opponentEmail));
        UserInfo challenger = userInfoRepo.findByEmail(challengerEmail)
                .orElseThrow(() -> new IllegalArgumentException("Challenger not found"));

        // ── Platform compatibility check ──
        String challengerNumId = String.valueOf(challenger.getId());
        String opponentNumId   = String.valueOf(opponent.getId());

        Set<String> challengerPlatforms = platformsFor(challengerNumId);
        Set<String> opponentPlatforms   = platformsFor(opponentNumId);

        Set<String> commonPlatforms = new LinkedHashSet<>(challengerPlatforms);
        commonPlatforms.retainAll(opponentPlatforms);

        if (commonPlatforms.isEmpty()) {
            String cp = challengerPlatforms.isEmpty() ? "none" : String.join(", ", challengerPlatforms);
            String op = opponentPlatforms.isEmpty()   ? "none" : String.join(", ", opponentPlatforms);
            throw new IllegalArgumentException(
                    "You and your opponent don't share a coding platform. " +
                    "Your platforms: [" + cp + "]. Opponent's platforms: [" + op + "]. " +
                    "Both users must have at least one platform in common (e.g. LeetCode or Codeforces).");
        }

        ContestType type = ContestType.valueOf(req.getContestType().toUpperCase());

        // For CUSTOM type, clamp each count to [0, 5] and ensure total > 0
        int[] customCounts = null;
        if (type == ContestType.CUSTOM) {
            int e = Math.min(5, Math.max(0, req.getEasyCount()));
            int m = Math.min(5, Math.max(0, req.getMediumCount()));
            int h = Math.min(5, Math.max(0, req.getHardCount()));
            if (e + m + h == 0)
                throw new IllegalArgumentException("Custom contest must have at least one problem");
            customCounts = new int[]{ e, m, h };
        }

        Challenge c = new Challenge();
        c.setChallengerId(challengerEmail);
        c.setOpponentId(opponentEmail);
        c.setChallengerName(challenger.getName());
        c.setOpponentName(opponent.getName());
        c.setContestType(type);
        c.setStatus(ChallengeStatus.PENDING);
        Challenge saved = challengeRepo.save(c);

        // ── Dynamic problem selection ──
        // Collect all slugs both users have already solved (to skip them)
        Set<String> challengerSolved = solvedProblemRepo.findAllSlugsByUserId(challengerNumId);
        Set<String> opponentSolved   = solvedProblemRepo.findAllSlugsByUserId(opponentNumId);
        Set<String> excludedSlugs = new HashSet<>(challengerSolved);
        excludedSlugs.addAll(opponentSolved);

        // Find shared weak topics (both users have stats; sort by combined solved count asc)
        List<String> sharedWeakTopics = findSharedWeakTopics(challengerNumId, opponentNumId);

        // Platform list for DB query (lowercase)
        List<String> platformList = commonPlatforms.stream()
                .map(String::toLowerCase)
                .collect(Collectors.toList());

        selectAndSaveProblems(saved.getId(), type, customCounts, excludedSlugs, sharedWeakTopics, platformList);

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

        int duration = c.getContestType() == ContestType.CUSTOM
                ? customDuration(cpRepo.findByChallengeIdOrderByProblemOrder(challengeId))
                : DURATION_MINUTES.get(c.getContestType());
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

    /* ── 8. Record a solve (called directly or by PlatformSyncService) ── */
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

        finishIfAllSolved(c);
    }

    /**
     * Called by PlatformSyncService when new AC slugs are detected.
     * Finds all ACTIVE challenges for this user and records the solve on any matching problem.
     */
    @Transactional
    public void detectAndRecordSolve(String email, String titleSlug) {
        List<Challenge> activeChallenges = challengeRepo.findAllInvolving(email).stream()
                .filter(ch -> ch.getStatus() == ChallengeStatus.ACTIVE)
                .collect(Collectors.toList());
        for (Challenge ch : activeChallenges) {
            recordSolve(ch.getId(), email, titleSlug);
        }
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
        LocalDateTime now = LocalDateTime.now();

        // Previously: findAll() + in-memory filter — scanned the entire table
        // every 30 seconds. Now the DB only returns rows that actually need
        // expiring (use a compound index on (status, end_time) in MySQL).
        List<Challenge> toFinish = challengeRepo.findByStatusAndEndTimeBefore(ChallengeStatus.ACTIVE, now);
        for (Challenge c : toFinish) {
            resolveWinner(c);
            challengeRepo.save(c);
        }

        // Expire PENDING invites older than 48 hours (same indexed-query pattern).
        List<Challenge> stalePending = challengeRepo.findByStatusAndCreatedAtBefore(
                ChallengeStatus.PENDING, now.minusHours(48));
        for (Challenge c : stalePending) {
            c.setStatus(ChallengeStatus.EXPIRED);
            challengeRepo.save(c);
        }
    }

    /* ═══════ private helpers ═══════ */

    /** Linked platforms (lowercase names) for a given numeric userId */
    private Set<String> platformsFor(String numericUserId) {
        return platformAccountRepo.findByUserId(numericUserId).stream()
                .map(a -> a.getPlatformName().toLowerCase())
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    /**
     * Finds topics both users have data for, sorted by their *combined* solved count
     * ascending — so we pick the topics where both are weakest first.
     * Returns topic names (empty list if no overlap).
     */
    private List<String> findSharedWeakTopics(String userAId, String userBId) {
        Map<String, Integer> aTopics = topicStatsRepo.findByUserId(userAId).stream()
                .collect(Collectors.toMap(TopicStats::getTopic, TopicStats::getSolvedCount));
        Map<String, Integer> bTopics = topicStatsRepo.findByUserId(userBId).stream()
                .collect(Collectors.toMap(TopicStats::getTopic, TopicStats::getSolvedCount));

        // Intersection: topics both users have appeared in
        Set<String> shared = new HashSet<>(aTopics.keySet());
        shared.retainAll(bTopics.keySet());

        if (shared.isEmpty()) {
            // Fall back to union — pick topics at least one user has seen
            shared.addAll(aTopics.keySet());
            shared.addAll(bTopics.keySet());
        }

        // Sort by combined solved count ascending (weakest first)
        return shared.stream()
                .sorted(Comparator.comparingInt(t ->
                        aTopics.getOrDefault(t, 0) + bTopics.getOrDefault(t, 0)))
                .collect(Collectors.toList());
    }

    /**
     * Selects and persists problems for a challenge.
     * Priority order for each difficulty slot:
     *   1. Problems in a shared weak topic, not solved by either user, on common platforms
     *   2. Problems on common platforms, not solved by either user (any topic)
     *   3. Problems on common platforms (may have been solved — last resort)
     *
     * @param customCounts non-null for CUSTOM type: [easyCount, mediumCount, hardCount]
     */
    private void selectAndSaveProblems(Long challengeId, ContestType type, int[] customCounts,
            Set<String> excludedSlugs, List<String> weakTopics, List<String> platforms) {
        int[] counts = (type == ContestType.CUSTOM) ? customCounts : PROBLEM_COUNTS.get(type);
        String[] diffs = { "easy", "medium", "hard" };
        int order = 1;

        for (int i = 0; i < diffs.length; i++) {
            int needed = counts[i];
            if (needed == 0) continue;
            String diff = diffs[i];

            List<Problem> chosen = pickProblems(needed, diff, excludedSlugs, weakTopics, platforms);

            for (Problem p : chosen) {
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

    private List<Problem> pickProblems(int needed, String diff, Set<String> excluded,
            List<String> weakTopics, List<String> platforms) {
        Set<Long> pickedIds = new HashSet<>();
        List<Problem> result = new ArrayList<>();

        // Pass 1: topic-aware, platform-filtered, excluding solved
        for (String topic : weakTopics) {
            if (result.size() >= needed) break;
            List<Problem> pool = platforms.isEmpty()
                    ? problemRepo.findRandomByDifficulty(diff)
                    : problemRepo.findRandomByPlatformsAndTopicAndDifficulty(platforms, topic, diff);
            for (Problem p : pool) {
                if (result.size() >= needed) break;
                if (!excluded.contains(p.getTitleSlug()) && pickedIds.add(p.getId())) {
                    result.add(p);
                }
            }
        }

        // Pass 2: any topic, platform-filtered, excluding solved
        if (result.size() < needed) {
            List<Problem> pool = platforms.isEmpty()
                    ? problemRepo.findRandomByDifficulty(diff)
                    : problemRepo.findRandomByPlatformsAndDifficulty(platforms, diff);
            for (Problem p : pool) {
                if (result.size() >= needed) break;
                if (!excluded.contains(p.getTitleSlug()) && pickedIds.add(p.getId())) {
                    result.add(p);
                }
            }
        }

        // Pass 3: last resort — any problem on common platforms (may be previously solved)
        if (result.size() < needed) {
            List<Problem> pool = platforms.isEmpty()
                    ? problemRepo.findRandomByDifficulty(diff)
                    : problemRepo.findRandomByPlatformsAndDifficulty(platforms, diff);
            for (Problem p : pool) {
                if (result.size() >= needed) break;
                if (pickedIds.add(p.getId())) {
                    result.add(p);
                }
            }
        }

        return result;
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
        if (cSolved + oSolved >= total * 2L) {
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
        List<ChallengeProblem> problems = cpRepo.findByChallengeIdOrderByProblemOrder(c.getId());
        int durationMins = c.getContestType() == ContestType.CUSTOM
                ? customDuration(problems)
                : DURATION_MINUTES.get(c.getContestType());
        r.setDurationMinutes(durationMins);

        // Problems (already fetched above for duration calculation)
        r.setProblems(problems);

        // Leaderboard: include per-user solved problem titles for frontend tick indicators
        long cSolved = caRepo.countByChallengeIdAndUserIdAndSolvedTrue(c.getId(), c.getChallengerId());
        long oSolved = caRepo.countByChallengeIdAndUserIdAndSolvedTrue(c.getId(), c.getOpponentId());

        List<String> challengerSolvedTitles = solvedTitlesFor(c.getId(), c.getChallengerId());
        List<String> opponentSolvedTitles   = solvedTitlesFor(c.getId(), c.getOpponentId());

        r.setChallengerProgress(new ChallengeResponse.LeaderboardEntry(
                c.getChallengerId(), c.getChallengerName(), cSolved,
                lastSolveTime(c.getId(), c.getChallengerId()), challengerSolvedTitles));
        r.setOpponentProgress(new ChallengeResponse.LeaderboardEntry(
                c.getOpponentId(), c.getOpponentName(), oSolved,
                lastSolveTime(c.getId(), c.getOpponentId()), opponentSolvedTitles));

        // Timer
        if (c.getEndTime() != null) {
            long secs = ChronoUnit.SECONDS.between(LocalDateTime.now(), c.getEndTime());
            r.setSecondsRemaining(Math.max(0, secs));
        }
        return r;
    }

    private List<String> solvedTitlesFor(Long challengeId, String userId) {
        return caRepo.findByChallengeIdAndUserId(challengeId, userId).stream()
                .filter(ChallengeAttempt::isSolved)
                .map(ChallengeAttempt::getTitleSlug)
                .collect(Collectors.toList());
    }

    private Challenge getOrThrow(Long id) {
        return challengeRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Challenge not found: " + id));
    }

    /** Computes contest duration for CUSTOM mode: 10 min/Easy, 15 min/Medium, 20 min/Hard, min 15. */
    private int customDuration(List<ChallengeProblem> problems) {
        long easy   = problems.stream().filter(p -> "easy".equalsIgnoreCase(p.getDifficulty())).count();
        long medium = problems.stream().filter(p -> "medium".equalsIgnoreCase(p.getDifficulty())).count();
        long hard   = problems.stream().filter(p -> "hard".equalsIgnoreCase(p.getDifficulty())).count();
        return (int) Math.max(15, easy * 10 + medium * 15 + hard * 20);
    }
}
