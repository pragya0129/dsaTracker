/**
 * API Service Layer — Integrated with Spring Boot Backend (port 8080)
 * Platform sync (LeetCode stats) is done server-side → stored in DB → served via /api/platforms/dashboard
 */

// Read from Vite's build-time env (`VITE_API_BASE`) on the deployed frontend;
// fall through to localhost:8080 for local dev with `npm run dev`.
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080'

/* ── Auth state — JWT lives in an HttpOnly cookie now ──
 *
 * SECURITY NOTE
 * The JWT is no longer stored in localStorage. JavaScript on this page
 * literally cannot read it, so a successful XSS attack can't steal the
 * token and DevTools' Storage tab won't show it either. The browser
 * sends the auth cookie automatically on every request thanks to
 * `credentials: 'include'` below; we don't have to attach a Bearer
 * header at all.
 *
 * The kept-in-localStorage values (email, name, username) are NOT
 * credentials — they're just UI hints (the avatar's initial letter,
 * routing decisions, etc.). Even if leaked, an attacker can't auth
 * with them. The session itself lives entirely in the HttpOnly cookie.
 */

// Backwards-compat shims — kept as no-ops so older code that imported
// these functions doesn't crash. Don't actually read or write tokens.
export function getJWTToken() { return null }
export function setJWTToken() { /* no-op: cookie is set by the server */ }

export function setUserEmail(email) { localStorage.setItem('jwt_email', email) }
export function getUserEmail() { return localStorage.getItem('jwt_email') }
export function setUserName(name) { localStorage.setItem('jwt_name', name) }
export function getUserName() { return localStorage.getItem('jwt_name') || '' }
export function setUsername(u) { if (u) localStorage.setItem('jwt_username', u); else localStorage.removeItem('jwt_username') }
export function getUsername() { return localStorage.getItem('jwt_username') || '' }

export function clearAuth() {
    // Wipe dashboard cache FIRST — clearAllCache builds its prefix from
    // the email, so we need the email still in storage at this point.
    try { clearAllCache() } catch { /* ignore */ }
    // Best-effort: ask the server to clear the auth cookie. We don't await
    // it — even if it fails (offline, server down), local UI state still
    // gets cleared so the user sees themselves as logged out.
    try {
        fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
            .catch(() => {})
    } catch { /* ignore */ }
    // Strip any legacy JWT some older build may have left behind.
    localStorage.removeItem('jwt_token')
    localStorage.removeItem('jwt_email')
    localStorage.removeItem('jwt_name')
    localStorage.removeItem('jwt_username')
    localStorage.removeItem('algoledger_platforms')
    // Profile pic cache — cleared via the shared helper so avatars update live.
    try {
        import('../utils/profilePic').then(m => m.clearProfilePic()).catch(() => {})
    } catch { /* ignore */ }
}

export function isAuthenticated() {
    // We can't read the HttpOnly cookie, so we use the email as a UI hint:
    // if the user has logged in this browser, their email is in localStorage.
    // Any actually-stale session gets caught by the 401 handler in
    // authFetchJson, which clears local state and redirects to /login.
    return !!getUserEmail()
}

/** Authenticated fetch wrapper — sends the HttpOnly auth cookie automatically. */
async function authFetch(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    }
    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include', // send the auth cookie cross-origin
    })
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
            credentials: 'include', // accept the auth cookie if backend skips OTP
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
            // Verification-disabled fast-path: server already created the
            // account and dropped the auth cookie. Mirror the non-secret UI
            // bits into localStorage; no token here on purpose.
            if (data.verificationSkipped) {
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
            credentials: 'include', // accept the auth cookie on success
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.email) {
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

/** Login: exchange email + password for an HttpOnly auth cookie. */
export async function login(email, password) {
    try {
        const res = await fetch(`${API_BASE}/auth/generateToken`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: email, password }),
            credentials: 'include', // accept the auth cookie
        })
        if (!res.ok) {
            const errBody = await res.text().catch(() => '')
            return { success: false, error: errBody || 'Invalid email or password' }
        }
        // Server set the auth cookie; we just persist UI hints.
        setUserEmail(email)
        // Fetch the user's name + profile pic — the cookie auto-authenticates.
        try {
            const meRes = await fetch(`${API_BASE}/auth/me`, {
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            })
            if (meRes.ok) {
                const me = await meRes.json()
                if (me.name) setUserName(me.name)
                setUsername(me.username || '')
                try {
                    const mod = await import('../utils/profilePic')
                    mod.setProfilePic(me.profilePic || null)
                } catch { /* ignore */ }
            }
        } catch { /* best-effort, login still succeeded */ }
        return { success: true, email }
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

/*
 * ─── Persistent client-side cache ─────────────────────────────────────────
 *
 * Dashboard data (stats, calendar heatmap, recent submissions) is expensive
 * on the backend — a cold-started free-tier instance plus live-sync against
 * LeetCode / Codeforces APIs can take several seconds per call. Re-paying
 * that cost on every page load (or every tab-switch) is what was making the
 * post-onboarding "welcome to your dashboard" moment feel slow.
 *
 * The contract now:
 *   - First read after login  → fetch from server, store in localStorage.
 *   - Every subsequent read   → served instantly from localStorage.
 *   - User clicks "Sync"      → invalidate cache + force a fresh fetch.
 *   - User logs out           → cache wiped (see clearAuth).
 *
 * In-memory `inflight` Map still dedupes concurrent callers in the same
 * tick so Sidebar + TopBar + page don't each hit the same endpoint thrice.
 *
 * Cache keys are scoped per-user (via the JWT email) so switching accounts
 * can't leak another user's numbers onto the page.
 */
const _inflight = new Map() // key -> Promise (dedup concurrent callers)

function _cacheKey(key) {
    const email = getUserEmail() || 'anon'
    return `algoledger:cache:${email}:${key}`
}
function _readPersisted(key) {
    try {
        const raw = localStorage.getItem(_cacheKey(key))
        if (!raw) return null
        return JSON.parse(raw) // { fetchedAt, value }
    } catch { return null }
}
function _writePersisted(key, value) {
    try {
        localStorage.setItem(
            _cacheKey(key),
            JSON.stringify({ fetchedAt: Date.now(), value })
        )
    } catch { /* quota exceeded — degrade gracefully */ }
}
function _removePersisted(key) {
    try { localStorage.removeItem(_cacheKey(key)) } catch { /* ignore */ }
}

/**
 * Persistent cached fetch.
 *   - forceRefresh=true → always hit the network, refresh the cache.
 *   - otherwise        → return cached value if present; else fetch once.
 */
function cachedFetch(key, fetcher, { forceRefresh = false } = {}) {
    if (!forceRefresh) {
        const persisted = _readPersisted(key)
        if (persisted) return Promise.resolve(persisted.value)
        const pending = _inflight.get(key)
        if (pending) return pending
    }
    const p = fetcher()
        .then(value => {
            _writePersisted(key, value)
            _inflight.delete(key)
            return value
        })
        .catch(err => {
            // Don't poison the cache with errors — next caller retries.
            _inflight.delete(key)
            throw err
        })
    _inflight.set(key, p)
    return p
}

/** Timestamp (ms since epoch) of the cached entry, or null if not cached. */
export function getCacheTimestamp(key) {
    const entry = _readPersisted(key)
    return entry?.fetchedAt ?? null
}

/** Most recent sync time across dashboard + calendar + submissions, or null. */
export function getLastSyncedAt() {
    const stamps = [
        getCacheTimestamp('dashboard'),
        getCacheTimestamp('calendar'),
        getCacheTimestamp('submissions'),
    ].filter(Boolean)
    return stamps.length ? Math.min(...stamps) : null
}

/** Invalidate cached dashboard data — call on sync/logout so the next read is fresh. */
export function invalidateDashboardCache() {
    _removePersisted('dashboard')
    _removePersisted('calendar')
    _removePersisted('submissions')
    _inflight.delete('dashboard')
    _inflight.delete('calendar')
    _inflight.delete('submissions')
}

/**
 * Nuke every cache key for the current user. Called from clearAuth() so
 * logging out doesn't leave stale numbers in storage.
 */
export function clearAllCache() {
    try {
        const email = getUserEmail() || 'anon'
        const prefix = `algoledger:cache:${email}:`
        const doomed = []
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.startsWith(prefix)) doomed.push(k)
        }
        doomed.forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
    _inflight.clear()
}

/**
 * Fetch dashboard stats for the logged-in user.
 * Returns: { totalSolved, easySolved, mediumSolved, hardSolved,
 *            currentStreak, longestStreak, platforms[], topics[], linkedPlatforms[] }
 */
export function fetchDashboardData(opts) {
    return cachedFetch('dashboard', async () => {
        const res = await authFetch('/api/platforms/dashboard')
        if (res.ok) return { success: true, data: await res.json() }
        return { success: false, error: `HTTP ${res.status}` }
    }, opts)
}

export function fetchCalendarData(opts) {
    return cachedFetch('calendar', async () => {
        const res = await authFetch('/api/platforms/calendar')
        if (res.ok) return { success: true, data: await res.json() }
        return { success: false, error: `HTTP ${res.status}` }
    }, opts)
}

/**
 * Force-sync all linked platforms from their live APIs → update DB → return fresh stats.
 * Invalidates the client cache so the next read fetches the freshly-synced data.
 */
export async function syncAllPlatforms() {
    const res = await authFetch('/api/platforms/sync', { method: 'POST' })
    invalidateDashboardCache()
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


export function fetchLeetCodeSubmissions(username, opts) {
    return cachedFetch('submissions', async () => {
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
    }, opts)
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

/* ── In-app notifications ──
 *
 * The bell in the TopBar polls fetchUnreadCount every minute (cheap, just
 * a number) and fires fetchNotifications when the user actually opens the
 * dropdown. We deliberately DON'T cache these — notifications need to feel
 * live, and the payloads are small. */
export async function fetchNotifications(page = 0, size = 20) {
    return authFetchJson(`/api/notifications?page=${page}&size=${size}`)
}
export async function fetchUnreadNotifCount() {
    return authFetchJson('/api/notifications/unread-count')
}
export async function markAllNotificationsRead() {
    return authFetchJson('/api/notifications/mark-all-read', { method: 'POST' })
}
/** Admin only — broadcast a SYSTEM notification to every registered user.
 *  Returns 403 unless the caller's email is in `app.admin.emails` server-side. */
export async function broadcastNotification({ title, message, link }) {
    return authFetchJson('/api/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title, message, link }),
    })
}

// ── Recommendations ────────────────────────────────────────────────────────────
export async function completeDailyMission() {
    return authFetchJson('/recommendations/daily-mission/complete', { method: 'POST' })
}
