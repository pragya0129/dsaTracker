package com.example.dsa.challenge;

public class CreateChallengeRequest {
    private String opponentEmail;
    private String contestType; // BEGINNER / MEDIUM / HARD / CUSTOM

    /** Custom mode: how many Easy problems (0-5, used only when contestType=CUSTOM) */
    private int easyCount  = 0;
    /** Custom mode: how many Medium problems (0-5, used only when contestType=CUSTOM) */
    private int mediumCount = 0;
    /** Custom mode: how many Hard problems (0-5, used only when contestType=CUSTOM) */
    private int hardCount  = 0;

    public String getOpponentEmail() { return opponentEmail; }
    public void setOpponentEmail(String opponentEmail) { this.opponentEmail = opponentEmail; }

    public String getContestType() { return contestType; }
    public void setContestType(String contestType) { this.contestType = contestType; }

    public int getEasyCount()   { return easyCount; }
    public void setEasyCount(int easyCount)     { this.easyCount = easyCount; }

    public int getMediumCount() { return mediumCount; }
    public void setMediumCount(int mediumCount) { this.mediumCount = mediumCount; }

    public int getHardCount()   { return hardCount; }
    public void setHardCount(int hardCount)     { this.hardCount = hardCount; }
}
