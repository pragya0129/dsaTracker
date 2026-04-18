package com.example.dsa.community;

import com.example.dsa.social.SavedPost;
import com.example.dsa.social.SavedPostRepository;
import com.example.dsa.user.UserInfo;
import com.example.dsa.user.UserInfoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class PostService {

    private final PostRepository postRepo;
    private final PostLikeRepository likeRepo;
    private final UserInfoRepository userRepo;
    private final SavedPostRepository savedRepo;

    public PostService(PostRepository postRepo, PostLikeRepository likeRepo,
            UserInfoRepository userRepo, SavedPostRepository savedRepo) {
        this.postRepo = postRepo;
        this.likeRepo = likeRepo;
        this.userRepo = userRepo;
        this.savedRepo = savedRepo;
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
        boolean saved = savedRepo.existsByUserEmailAndPostId(userEmail, id);
        return PostDto.from(post, liked, saved, authorUsernameFor(post));
    }

    /** My posts */
    public List<PostDto> myPosts(String userEmail) {
        List<Post> posts = postRepo.findByUserIdOrderByCreatedAtDesc(userEmail);
        return hydrate(posts, userEmail);
    }

    /** Everything the authenticated user has saved, newest save first. */
    public List<PostDto> savedPosts(String userEmail) {
        List<SavedPost> rows = savedRepo.findByUserEmailOrderBySavedAtDesc(userEmail);
        if (rows.isEmpty()) return List.of();
        // Keep save-order by iterating rows and joining against Post by id.
        Map<Long, Post> byId = postRepo.findAllById(
                rows.stream().map(SavedPost::getPostId).collect(Collectors.toList())
        ).stream().collect(Collectors.toMap(Post::getId, p -> p));
        List<Post> ordered = rows.stream()
                .map(r -> byId.get(r.getPostId()))
                .filter(p -> p != null)
                .collect(Collectors.toList());
        return hydrate(ordered, userEmail);
    }

    /** Bookmark a post. Idempotent. */
    @Transactional
    public Map<String, Object> savePost(Long postId, String userEmail) {
        if (!postRepo.existsById(postId)) {
            throw new IllegalArgumentException("Post not found");
        }
        if (!savedRepo.existsByUserEmailAndPostId(userEmail, postId)) {
            savedRepo.save(new SavedPost(userEmail, postId));
        }
        return Map.of("saved", true);
    }

    /** Remove a bookmark. Idempotent. */
    @Transactional
    public Map<String, Object> unsavePost(Long postId, String userEmail) {
        savedRepo.deleteByUserEmailAndPostId(userEmail, postId);
        return Map.of("saved", false);
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
        List<PostDto> posts = hydrate(paged.getContent(), userEmail);
        Map<String, Object> resp = new HashMap<>();
        resp.put("posts", posts);
        resp.put("page", paged.getNumber());
        resp.put("totalPages", paged.getTotalPages());
        resp.put("totalPosts", paged.getTotalElements());
        resp.put("hasNext", paged.hasNext());
        return resp;
    }

    /**
     * Turn a list of Posts into a list of PostDtos, resolving each post's
     * likedByMe / savedByMe / authorUsername. Batches the "is each post
     * saved?" lookup so we don't N+1 the DB.
     */
    private List<PostDto> hydrate(List<Post> posts, String userEmail) {
        if (posts.isEmpty()) return List.of();
        List<Long> ids = posts.stream().map(Post::getId).collect(Collectors.toList());
        Set<Long> savedIds = savedRepo.findSavedPostIdsForUser(userEmail, ids);
        // Likes are cheap to check per-post and the existing schema's indexed
        // on (post_id, user_id), so leave as-is rather than invent a new query.
        return posts.stream().map(p -> PostDto.from(
                p,
                likeRepo.existsByPostIdAndUserId(p.getId(), userEmail),
                savedIds.contains(p.getId()),
                authorUsernameFor(p)
        )).collect(Collectors.toList());
    }

    /** Per-post author @handle lookup — cheap thanks to the email index. */
    private String authorUsernameFor(Post p) {
        if (p.getUserId() == null) return null;
        return userRepo.findByEmail(p.getUserId())
                .map(UserInfo::getUsername)
                .orElse(null);
    }
}
