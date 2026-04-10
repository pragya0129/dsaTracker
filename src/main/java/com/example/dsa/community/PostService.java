package com.example.dsa.community;

import com.example.dsa.user.UserInfo;
import com.example.dsa.user.UserInfoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PostService {

    private final PostRepository postRepo;
    private final PostLikeRepository likeRepo;
    private final UserInfoRepository userRepo;

    public PostService(PostRepository postRepo, PostLikeRepository likeRepo,
            UserInfoRepository userRepo) {
        this.postRepo = postRepo;
        this.likeRepo = likeRepo;
        this.userRepo = userRepo;
    }

    /** Create a post for the authenticated user */
    @Transactional
    public PostDto create(String userEmail, CreatePostRequest req) {
        if (req.getTitle() == null || req.getTitle().isBlank())
            throw new IllegalArgumentException("Title is required");
        if (req.getContent() == null || req.getContent().isBlank())
            throw new IllegalArgumentException("Content is required");
        if (req.getContent().length() > 1200)
            throw new IllegalArgumentException("Content must be under 1200 characters");

        UserInfo user = userRepo.findByEmail(userEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Post post = new Post();
        post.setUserId(userEmail);
        post.setAuthorName(user.getName() != null ? user.getName() : userEmail);
        post.setTitle(req.getTitle().trim());
        post.setTopic(req.getTopic() != null ? req.getTopic().trim().toLowerCase() : "general");
        post.setContent(req.getContent().trim());
        return PostDto.from(postRepo.save(post), false);
    }

    /** Paginated feed — newest first */
    public Map<String, Object> feed(String userEmail, int page, int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 20));
        Page<Post> paged = postRepo.findAllByOrderByCreatedAtDesc(pageable);
        return buildPageResponse(paged, userEmail);
    }

    /** Feed filtered by topic */
    public Map<String, Object> feedByTopic(String topic, String userEmail, int page, int size) {
        Pageable pageable = PageRequest.of(page, Math.min(size, 20));
        Page<Post> paged = postRepo.findByTopicIgnoreCaseOrderByCreatedAtDesc(topic, pageable);
        return buildPageResponse(paged, userEmail);
    }

    /** Single post */
    public PostDto getById(Long id, String userEmail) {
        Post post = postRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Post not found: " + id));
        boolean liked = likeRepo.existsByPostIdAndUserId(id, userEmail);
        return PostDto.from(post, liked);
    }

    /** My posts */
    public List<PostDto> myPosts(String userEmail) {
        return postRepo.findByUserIdOrderByCreatedAtDesc(userEmail)
                .stream().map(p -> PostDto.from(p, likeRepo.existsByPostIdAndUserId(p.getId(), userEmail)))
                .collect(Collectors.toList());
    }

    /** Toggle like — returns new like count + liked state */
    @Transactional
    public Map<String, Object> toggleLike(Long postId, String userEmail) {
        Post post = postRepo.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));
        boolean liked;
        if (likeRepo.existsByPostIdAndUserId(postId, userEmail)) {
            likeRepo.findByPostIdAndUserId(postId, userEmail)
                    .ifPresent(likeRepo::delete);
            post.setLikeCount(Math.max(0, post.getLikeCount() - 1));
            liked = false;
        } else {
            PostLike like = new PostLike();
            like.setPostId(postId);
            like.setUserId(userEmail);
            likeRepo.save(like);
            post.setLikeCount(post.getLikeCount() + 1);
            liked = true;
        }
        postRepo.save(post);
        return Map.of("likeCount", post.getLikeCount(), "liked", liked);
    }

    /** Delete a post — only owner can delete */
    @Transactional
    public void delete(Long postId, String userEmail) {
        Post post = postRepo.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found"));
        if (!post.getUserId().equalsIgnoreCase(userEmail))
            throw new IllegalArgumentException("You can only delete your own posts");
        postRepo.delete(post);
    }

    /* ── helpers ── */
    private Map<String, Object> buildPageResponse(Page<Post> paged, String userEmail) {
        List<PostDto> posts = paged.getContent().stream()
                .map(p -> PostDto.from(p, likeRepo.existsByPostIdAndUserId(p.getId(), userEmail)))
                .collect(Collectors.toList());
        return Map.of(
                "posts", posts,
                "page", paged.getNumber(),
                "totalPages", paged.getTotalPages(),
                "totalPosts", paged.getTotalElements(),
                "hasNext", paged.hasNext());
    }
}
