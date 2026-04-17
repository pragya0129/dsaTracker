package com.example.dsa.challenge;

import java.time.LocalDateTime;
import java.util.List;

public class ChallengeResponse {

    private Long id;
    private String challengerId;
    private String challengerName;
    private String opponentId;
    private String opponentName;
    private String contestType;
    private String status;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private LocalDateTime createdAt;
    private String winnerId;
    private int durationMinutes;
    private List<ChallengeProblem> problems;
    private LeaderboardEntry challengerProgress;
    private LeaderboardEntry opponentProgress;
    private long secondsRemaining;

    public static class LeaderboardEntry {
        private String userId;
        private String name;
        private long solved;
        private LocalDateTime lastSolvedAt;
        /** Title slugs of problems this participant has solved in this contest */
        private List<String> solvedTitles;

        public LeaderboardEntry(String userId, String name, long solved,
                LocalDateTime lastSolvedAt, List<String> solvedTitles) {
            this.userId = userId;
            this.name = name;
            this.solved = solved;
            this.lastSolvedAt = lastSolvedAt;
            this.solvedTitles = solvedTitles != null ? solvedTitles : List.of();
        }

        public String getUserId() { return userId; }
        public String getName() { return name; }
        public long getSolved() { return solved; }
        public LocalDateTime getLastSolvedAt() { return lastSolvedAt; }
        public List<String> getSolvedTitles() { return solvedTitles; }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getChallengerId() {
        return challengerId;
    }

    public void setChallengerId(String challengerId) {
        this.challengerId = challengerId;
    }

    public String getChallengerName() {
        return challengerName;
    }

    public void setChallengerName(String challengerName) {
        this.challengerName = challengerName;
    }

    public String getOpponentId() {
        return opponentId;
    }

    public void setOpponentId(String opponentId) {
        this.opponentId = opponentId;
    }

    public String getOpponentName() {
        return opponentName;
    }

    public void setOpponentName(String opponentName) {
        this.opponentName = opponentName;
    }

    public String getContestType() {
        return contestType;
    }

    public void setContestType(String contestType) {
        this.contestType = contestType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getWinnerId() {
        return winnerId;
    }

    public void setWinnerId(String winnerId) {
        this.winnerId = winnerId;
    }

    public int getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(int durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public List<ChallengeProblem> getProblems() {
        return problems;
    }

    public void setProblems(List<ChallengeProblem> problems) {
        this.problems = problems;
    }

    public LeaderboardEntry getChallengerProgress() {
        return challengerProgress;
    }

    public void setChallengerProgress(LeaderboardEntry challengerProgress) {
        this.challengerProgress = challengerProgress;
    }

    public LeaderboardEntry getOpponentProgress() {
        return opponentProgress;
    }

    public void setOpponentProgress(LeaderboardEntry opponentProgress) {
        this.opponentProgress = opponentProgress;
    }

    public long getSecondsRemaining() {
        return secondsRemaining;
    }

    public void setSecondsRemaining(long secondsRemaining) {
        this.secondsRemaining = secondsRemaining;
    }
}
