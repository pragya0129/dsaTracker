/**
 * API Service Layer — Integrated with Spring Boot Backend (port 8080)
 * Platform sync (LeetCode stats) is done server-side → stored in DB → served via /api/platforms/dashboard
 */

// Read from Vite's build-time env (`VITE_API_BASE`) on the deployed frontend;
// fall through to localhost:8080 for local dev with `npm run dev`.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

/* ── JWT Token Management ── */

export function getJWTToken() { return localStorage.getItem('jwt_token') }
export function setJWTToken(token) { localStorage.setItem('jwt_token', token) }
export function setUserEmail(email) { localStorage.setItem('jwt_email', email) }
export function getUserEmail() { return localStorage.getItem('jwt_email') }
export function setUserName(name) { localStorage.setItem('jwt_name', name) }
export function getUserName() { return localStorage.getItem('jwt_name') || '' }
export function setUsername(u) { if (u) localStorage.setItem('jwt_username', u); else localStorage.removeItem('jwt_username') }
export function getUsername() { return localStorage.getItem('jwt_username') || '' }

export function clearAuth() {
    localStorage.removeItem('jwt_token')
    localStorage.removeItem('jwt_email')
    localStorage.removeItem('jwt_name')
    localStorage.removeItem('jwt_username')
    localStorage.removeItem('algoledger_platforms')
    // Profile pic cache — cleared via the shared helper so avatars update live.
    try {
        // Dynamic import avoids a circular dep at module-load time.
        import('../utils/profilePic').then(m => m.clearProfilePic()).catch(() => {})
    } catch { /* ignore */ }
}

export function isAuthenticated() {
    return !!getJWTToken() && !!getUserEmail()
}

/** Authenticated fetch wrapper — auto-attaches Bearer token */
async function authFetch(path, options = {}) {
    const token = getJWTToken()
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers })
}

/** Convenience: authenticated fetch that parses JSON and returns {ok, data, error} */
export async function authFetchJson(path, options = {}) {
    try {
        const res = await authFetch(path, options)

        // If token expired / invalid, backend now returns JSON 401 — clear session and redirect
        if (res.status === 401) {
            const body = await res.text()
            let errMsg = 'Session expired. Please log in again.'
            try { errMsg = JSON.parse(body)?.error || errMsg } catch (_) { /* ignore */ }
            clearAuth()
            window.location.href = '/login'
            return { ok: false, error: errMsg }
        }

        // For non-2xx that still have a body, try to parse JSON
        const text = await res.text()
        if (!text) return { ok: false, error: `HTTP ${res.status} (empty response)` }
        let data
        try { data = JSON.parse(text) } catch (_) {
            return { ok: false, error: `HTTP ${res.status}: unexpected response format` }
        }
        if (res.ok) return { ok: true, data }
        return { ok: false, error: data?.error || data?.message || `HTTP ${res.status}` }
    } catch (e) {
        return { ok: false, error: e.message }
    }
}

/* ── localStorage helpers (for UI state only) ── */

const STORAGE_KEY = 'algoledger_platforms'

export function getLinkedPlatforms() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch { return {} }
}

export function savePlatforms(platforms) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(platforms))
}

export function hasLinkedPlatforms() {
    return Object.keys(getLinkedPlatforms()).length > 0
}

/** Save a single platform with verification status */
export function savePlatformVerified(platform, username, verified, verifiedAt) {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    data[platform] = { username, verified, verifiedAt }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

/**
 * Get full platform data including verification status.
 * Returns { leetcode: { username, verified, verifiedAt }, ... }
 */
export function getLinkedPlatformsFull() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        const result = {}
        for (const [k, v] of Object.entries(data)) {
            if (typeof v === 'string' && v.trim()) {
                result[k] = { username: v.trim(), verified: false, verifiedAt: null }
            } else if (typeof v === 'object' && v?.username) {
                result[k] = { username: v.username, verified: !!v.verified, verifiedAt: v.verifiedAt || null }
            }
        }
        return result
    } catch { return {} }
}

/* ── Platform ownership verification (main backend) ──
 *
 * Two-step proof: (1) start — get target problem + startTime,
 * (2) check — after the user submits on the real platform, we scan their
 * recent submissions for an Accepted submission to the target problem
 * with timestamp >= startTime. Endpoints are authenticated (onboarding
 * happens post-login anyway).
 */

/** Step 1 — confirm handle exists and receive the target problem. */
export async function verifyStart(platform, handle) {
    const r = await authFetchJson('/api/verify/start', {
        method: 'POST',
        body: JSON.stringify({ platform, handle }),
    })
    if (r.ok) {
        return {
            success: true,
            data: {
                problemSlug: r.data.problemSlug,
                problemName: r.data.problemName,
                problemUrl:  r.data.problemUrl,
                startTime:   r.data.startTime,
            },
        }
    }
    return { success: false, message: r.error || 'Verification failed to start' }
}

/** Step 2 — confirm the user submitted the target problem after startTime. */
export async function verifyCheck(platform, handle, problemSlug, startTime) {
    const r = await authFetchJson('/api/verify/check', {
        method: 'POST',
        body: JSON.stringify({ platform, handle, problemSlug, startTime }),
    })
    if (r.ok && r.data.verified) return { success: true }
    return {
        success: false,
        message: (r.data && r.data.message) || r.error ||
                 "Couldn't find your submission yet. Try again after you submit.",
    }
}

/* ── Legacy shims for older callers.
 * The demo-backend-on-port-4000 flow is gone; these forward to the
 * main-backend verifyStart/verifyCheck with the same call signatures
 * the old onboarding code expected. Safe to delete any time. */
export async function initiateLeetCodeVerification(username) {
    return verifyStart('leetcode', username)
}
export async function checkLeetCodeSubmission(username, startTime) {
    return verifyCheck('leetcode', username, 'two-sum', startTime)
}
export async function initiateCodeforcesVerification(handle) {
    return verifyStart('codeforces', handle)
}
export async function checkCodeforcesSubmission(handle, startTime) {
    return verifyCheck('codeforces', handle, '4-A', startTime)
}

/* ── Demo Backend — LeetCode Data API calls ── */

export async function deleteLeetCode(username) {
    const res = await fetch(`${DEMO_API_BASE}/leetcode/delete-leetcode/${username}`, { method: 'DELETE' })
    return res.json()
}

export async function fetchLeetCode(username) {
    const res = await fetch(`${DEMO_API_BASE}/leetcode/fetch/${username}`)
    return res.json()
}

/* ── Demo Backend — Codeforces Data API calls ── */

export async function deleteCodeforces(handle) {
    const res = await fetch(`${DEMO_API_BASE}/codeforces/delete/${handle}`, { method: 'DELETE' })
    return res.json()
}

export async function fetchCodeforces(handle) {
    const res = await fetch(`${DEMO_API_BASE}/codeforces/fetch/${handle}`)
    return res.json()
}

/* ── Authentication API calls ── */

/** Register a new user — legacy direct path, kept for backward-compat. */
export async function register(name, email, password) {
    const res = await fetch(`${API_BASE}/auth/addNewUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, roles: 'ROLE_USER' }),
    })
    const data = await res.text()
    if (res.ok && name) setUserName(name)
    return { success: res.ok, data, status: res.status }
}

/* ── Email-verified signup (two-step) ── */

/**
 * Step 1 — send an OTP to the user's email (name + @username + email + password).
 *
 * If the backend has verification disabled (feature flag off for dev /
 * pre-domain-verification), the response will include a JWT directly and
 * the frontend should skip the OTP step. We detect that here and stash
 * the auth tokens immediately, mirroring what signupVerify does.
 */
export async function signupRequest(name, username, email, password) {
    try {
        const res = await fetch(`${API_BASE}/auth/signup/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, email, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
            // Verification-disabled fast-path: backend already created the
            // account and handed us a token. Log in locally.
            if (data.token) {
                setJWTToken(data.token)
                setUserEmail(data.email || email)
                if (data.name)     setUserName(data.name)
                if (data.username) setUsername(data.username)
            }
            return { ok: true, data }
        }
        return { ok: false, error: data.error || 'Could not send verification code' }
    } catch (e) {
        return { ok: false, error: 'Cannot connect to server. Please try again.' }
    }
}

/** Live check: is this @username free to grab? (public, no auth required) */
export async function checkUsernameAvailable(u) {
    try {
        const res = await fetch(`${API_BASE}/auth/username/check?u=${encodeURIComponent(u)}`)
        if (res.ok) return res.json()
        return { available: false, reason: 'Couldn\'t check right now' }
    } catch (e) {
        return { available: false, reason: 'Couldn\'t check right now' }
    }
}

/** Change the logged-in user's @username. */
export async function updateMyUsername(username) {
    return authFetchJson('/auth/me/username', {
        method: 'PUT',
        body: JSON.stringify({ username }),
    })
}

/** Resend the OTP for an in-flight signup (respects server-side cooldown). */
export async function signupResend(email) {
    try {
        const res = await fetch(`${API_BASE}/auth/signup/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) return { ok: true, data }
        return { ok: false, error: data.error || 'Could not resend code' }
    } catch (e) {
        return { ok: false, error: 'Cannot connect to server. Please try again.' }
    }
}

/**
 * Step 2 — verify the OTP. On success, the backend creates the account and
 * returns a JWT so we can drop the user straight into the app.
 */
export async function signupVerify(email, otp) {
    try {
        const res = await fetch(`${API_BASE}/auth/signup/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.token) {
            setJWTToken(data.token)
            setUserEmail(data.email || email)
            if (data.name) setUserName(data.name)
            if (data.username) setUsername(data.username)
            return { ok: true, data }
        }
        return { ok: false, error: data.error || 'Verification failed' }
    } catch (e) {
        return { ok: false, error: 'Cannot connect to server. Please try again.' }
    }
}

/** Login user and get JWT token */
export async function login(email, password) {
    try {
        const res = await fetch(`${API_BASE}/auth/generateToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: email, password }),
        })
        if (res.ok) {
            const token = await res.text()
            setJWTToken(token)
            setUserEmail(email)
            // Fetch user's name + profile pic from backend
            try {
                const meRes = await fetch(`${API_BASE}/auth/me`, {
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                })
                if (meRes.ok) {
                    const me = await meRes.json()
                    if (me.name) setUserName(me.name)
                    setUsername(me.username || '')
                    // Mirror backend pic into local cache (or clear if null)
                    try {
                        const mod = await import('../utils/profilePic')
                        mod.setProfilePic(me.profilePic || null)
                    } catch { /* ignore */ }
                }
            } catch (_) { /* name+pic fetch is best-effort */ }
            return { success: true, token, email }
        } else {
            const error = await res.text()
            return { success: false, error: error || 'Invalid email or password' }
        }
    } catch (err) {
        return { success: false, error: 'Cannot connect to server. Please ensure the backend is running.' }
    }
}

/** Logout user */
export function logout() { clearAuth() }

/** Fetch current user's profile from backend */
export async function fetchMe() {
    return authFetchJson('/auth/me')
}

/** Update the authenticated user's display name */
export async function updateProfile(name) {
    return authFetchJson('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ name }),
    })
}

/** Change the authenticated user's password */
export async function changePassword(currentPassword, newPassword) {
    return authFetchJson('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
    })
}

/** Permanently delete the authenticated user's account */
export async function deleteAccount() {
    return authFetchJson('/auth/me', { method: 'DELETE' })
}

/** Upload a new profile picture (base64 data URL). */
export async function updateProfilePicture(dataUrl) {
    return authFetchJson('/auth/me/picture', {
        method: 'PUT',
        body: JSON.stringify({ profilePic: dataUrl }),
    })
}

/** Remove the authenticated user's profile picture. */
export async function removeProfilePicture() {
    return authFetchJson('/auth/me/picture', { method: 'DELETE' })
}

/* ── Notification preferences ── */

/** Fetch the user's reminder email preferences. */
export async function fetchNotificationPrefs() {
    return authFetchJson('/auth/me/notifications')
}

/** Save { enabled, reminderTime 'HH:mm', reminderTimezone 'Area/City' }. */
export async function updateNotificationPrefs(prefs) {
    return authFetchJson('/auth/me/notifications', {
        method: 'PUT',
        body: JSON.stringify(prefs),
    })
}

/* ── Platform linking (stored in DB via backend) ── */

/**
 * Link a platform account. Triggers an immediate sync from the platform API.
 * platform: 'leetcode' | 'codeforces'
 */
export async function linkPlatform(platform, username) {
    const res = await authFetch('/api/platforms/link', {
        method: 'POST',
        body: JSON.stringify({ platform, username }),
    })
    const data = await res.json()
    if (res.ok) {
        // Mirror in localStorage for instant UI feedback
        const platforms = getLinkedPlatforms()
        platforms[platform] = username
        savePlatforms(platforms)
        return { success: true, data }
    }
    // 409 = this coding account is already owned by another user
    if (res.status === 409) {
        return { success: false, conflict: true, error: data.error || 'This account is already linked to another user.' }
    }
    return { success: false, error: data.error || 'Failed to link platform' }
}

/** Verify a LeetCode username exists (public endpoint) */
export async function verifyLeetCodeUsername(username) {
    try {
        const res = await fetch(`${API_BASE}/api/leetcode/submissions/${encodeURIComponent(username)}`)
        if (res.ok) {
            const data = await res.json()
            return { valid: true, data }
        }
        return { valid: false, error: 'Username not found' }
    } catch (e) {
        return { valid: false, error: e.message }
    }
}

/** Verify a Codeforces handle exists (public endpoint) */
export async function verifyCodeforcesHandle(handle) {
    try {
        const res = await fetch(`${API_BASE}/api/codeforces/user/${encodeURIComponent(handle)}`)
        if (res.ok) {
            const data = await res.json()
            return { valid: data.exists, data }
        }
        return { valid: false, error: 'Handle not found' }
    } catch (e) {
        return { valid: false, error: e.message }
    }
}

/* ── Dashboard data (served from DB, synced from real platform APIs) ── */

/**
 * Fetch dashboard stats for the logged-in user.
 * Returns: { totalSolved, easySolved, mediumSolved, hardSolved,
 *            currentStreak, longestStreak, platforms[], topics[], linkedPlatforms[] }
 */
export async function fetchDashboardData() {
    const res = await authFetch('/api/platforms/dashboard')
    if (res.ok) {
        return { success: true, data: await res.json() }
    }
    return { success: false, error: `HTTP ${res.status}` }
}

export async function fetchCalendarData() {
    const res = await authFetch('/api/platforms/calendar')
    if (res.ok) {
        return { success: true, data: await res.json() }
    }
    return { success: false, error: `HTTP ${res.status}` }
}

/**
 * Force-sync all linked platforms from their live APIs → update DB → return fresh stats.
 */
export async function syncAllPlatforms() {
    const res = await authFetch('/api/platforms/sync', { method: 'POST' })
    if (res.ok) {
        return { success: true, data: await res.json() }
    }
    return { success: false, error: `HTTP ${res.status}` }
}

/* ── Legacy helpers (kept for backward compat with OnboardingPage) ── */

export async function addLeetCode(username) {
    return linkPlatform('leetcode', username)
}

export async function addCodeforces(handle) {
    return linkPlatform('codeforces', handle)
}

/** @deprecated Use fetchDashboardData() instead */
export async function fetchAllPlatformData() {
    return fetchDashboardData()
}


export async function fetchLeetCodeSubmissions(username) {
    try {
        const res = await fetch(`${API_BASE}/api/leetcode/submissions/${encodeURIComponent(username)}`)
        if (res.ok) {
            const data = await res.json()
            return { success: true, data: data.submissions || [] }
        }
        return { success: false, error: 'Failed to fetch' }
    } catch (e) {
        return { success: false, error: e.message }
    }
}

/* ─────────────────────────────────────────────
   CHALLENGE / CONTEST APIs
───────────────────────────────────────────── */

/**
 * Create a challenge. First arg accepts either:
 *   - a string (legacy: opponent's email address), or
 *   - an object (preferred): { opponentUsername } or { opponentEmail }
 */
export async function createChallenge(opponent, contestType, customCounts = {}) {
    try {
        const ref = typeof opponent === 'string'
            ? { opponentEmail: opponent }
            : (opponent || {})
        const body = { ...ref, contestType, ...customCounts }
        const res = await authFetch('/challenges', {
            method: 'POST',
            body: JSON.stringify(body),
        })
        const data = await res.json()
        if (res.ok) return { success: true, data }
        return { success: false, error: data.error || 'Failed to create challenge' }
    } catch (e) { return { success: false, error: e.message } }
}

export async function getChallenge(id) {
    try {
        const res = await authFetch(`/challenges/${id}`)
        if (res.ok) return { success: true, data: await res.json() }
        return { success: false, error: 'Not found' }
    } catch (e) { return { success: false, error: e.message } }
}

export async function acceptChallenge(id) {
    try {
        const res = await authFetch(`/challenges/${id}/accept`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) return { success: true, data }
        return { success: false, error: data.error || 'Failed' }
    } catch (e) { return { success: false, error: e.message } }
}

export async function declineChallenge(id) {
    try {
        const res = await authFetch(`/challenges/${id}/decline`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) return { success: true, data }
        return { success: false, error: data.error || 'Failed' }
    } catch (e) { return { success: false, error: e.message } }
}

export async function fetchMyChallenges() {
    try {
        const res = await authFetch('/challenges/mine')
        if (res.ok) return { success: true, data: await res.json() }
        return { success: false, error: 'Failed' }
    } catch (e) { return { success: false, error: e.message } }
}

export async function fetchInvitations() {
    try {
        const res = await authFetch('/challenges/invitations')
        if (res.ok) return { success: true, data: await res.json() }
        return { success: false, error: 'Failed' }
    } catch (e) { return { success: false, error: e.message } }
}

export async function fetchLeaderboard(id) {
    try {
        const res = await authFetch(`/challenges/${id}/leaderboard`)
        if (res.ok) return { success: true, data: await res.json() }
        return { success: false, error: 'Failed' }
    } catch (e) { return { success: false, error: e.message } }
}

export async function finishChallenge(id) {
    try {
        const res = await authFetch(`/challenges/${id}/finish`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) return { success: true, data }
        return { success: false, error: data.error || 'Failed' }
    } catch (e) { return { success: false, error: e.message } }
}

/* ─────────────────────────────────────────────
   COMMUNITY / POSTS APIs
───────────────────────────────────────────── */

export async function fetchFeed(page = 0, size = 10) {
    return authFetchJson(`/api/posts?page=${page}&size=${size}`)
}

export async function fetchFeedByTopic(topic, page = 0, size = 10) {
    return authFetchJson(`/api/posts/topic/${encodeURIComponent(topic)}?page=${page}&size=${size}`)
}

export async function fetchPost(id) {
    return authFetchJson(`/api/posts/${id}`)
}

export async function createPost(title, topic, content) {
    return authFetchJson('/api/posts', {
        method: 'POST',
        body: JSON.stringify({ title, topic, content }),
    })
}

export async function toggleLike(id) {
    return authFetchJson(`/api/posts/${id}/like`, { method: 'POST' })
}

export async function deletePost(id) {
    return authFetchJson(`/api/posts/${id}`, { method: 'DELETE' })
}

export async function fetchMyPosts() {
    return authFetchJson('/api/posts/mine')
}

/* ── Save posts ── */
export async function savePost(id)    { return authFetchJson(`/api/posts/${id}/save`, { method: 'POST' }) }
export async function unsavePost(id)  { return authFetchJson(`/api/posts/${id}/save`, { method: 'DELETE' }) }
export async function fetchSavedPosts() { return authFetchJson('/api/posts/saved') }

/* ── Follow graph ── */
export async function followUser(username)   { return authFetchJson(`/api/follow/${encodeURIComponent(username)}`, { method: 'POST' }) }
export async function unfollowUser(username) { return authFetchJson(`/api/follow/${encodeURIComponent(username)}`, { method: 'DELETE' }) }
export async function fetchFollowStatus(username) { return authFetchJson(`/api/follow/status/${encodeURIComponent(username)}`) }
export async function fetchFollowers(username)    { return authFetchJson(`/api/follow/${encodeURIComponent(username)}/followers`) }
export async function fetchFollowing(username)    { return authFetchJson(`/api/follow/${encodeURIComponent(username)}/following`) }

// ── Recommendations ────────────────────────────────────────────────────────────
export async function completeDailyMission() {
    return authFetchJson('/recommendations/daily-mission/complete', { method: 'POST' })
}
