package com.example.dsa;

import com.example.dsa.platform.Submission;
import com.example.dsa.platform.LeetCodeClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class LeetCodeIntegrationTest {

    @Autowired
    private LeetCodeClient leetCodeClient;

    @Test
    public void testFetchSubmissions() {
        // Test with a real LeetCode username (replace with a test account)
        String testUsername = "testuser123";
        
        List<Submission> submissions = leetCodeClient.fetchRecentSubmissions(testUsername);
        
        assertNotNull(submissions, "Submissions list should not be null");
        System.out.println("✅ Fetched " + submissions.size() + " submissions");
        
        // Print submission details
        for (Submission s : submissions) {
            System.out.println("  - " + s.getTitleSlug() + " (" + s.getStatusDisplay() + ")");
        }
    }

    @Test
    public void testEmptyUsername() {
        // Test with invalid username
        List<Submission> submissions = leetCodeClient.fetchRecentSubmissions("nonexistentuser987654");
        
        // Should return empty list, not throw exception
        assertNotNull(submissions);
        System.out.println("✅ Handled invalid username gracefully");
    }
}
