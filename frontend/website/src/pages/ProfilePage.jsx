import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import {
    fetchDashboardData, syncAllPlatforms,
    getUserEmail, getUserName, fetchMe,
    updateProfile, changePassword, deleteAccount,
    setUserName, logout,
    updateProfilePicture, removeProfilePicture,
    fetchNotificationPrefs, updateNotificationPrefs,
    fetchFollowStatus, getUsername,
    fetchSavedPosts, unsavePost,
} from '../services/api'
import { useProfilePic, setProfilePic as savePic, clearProfilePic } from '../utils/profilePic'

export default function ProfilePage() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('overview')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [dashData, setDashData] = useState(null)
    const [syncing, setSyncing] = useState(false)
    const [userName, setUserNameState] = useState(getUserName())
    const email = getUserEmail() || ''

    // ── Profile picture ──
    const profilePic = useProfilePic()
    const [picHover, setPicHover] = useState(false)
    const [picSaving, setPicSaving] = useState(false)
    const [picMsg, setPicMsg] = useState(null)
    const fileInputRef = useRef(null)

    // ── Edit name state ──
    const [editingName, setEditingName] = useState(false)
    const [nameInput, setNameInput] = useState('')
    const [nameSaving, setNameSaving] = useState(false)
    const [nameMsg, setNameMsg] = useState(null)
    const nameInputRef = useRef(null)

    // ── Change password state ──
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
    const [pwSaving, setPwSaving] = useState(false)
    const [pwMsg, setPwMsg] = useState(null)

    // ── Delete account state ──
    const [deleting, setDeleting] = useState(false)

    // ── Social counts ──
    const [myUsername, setMyUsername] = useState(getUsername())
    const [socialCounts, setSocialCounts] = useState({ followers: 0, followingCount: 0 })
    useEffect(() => {
        if (!myUsername) return
        fetchFollowStatus(myUsername).then(r => {
            if (r.ok) setSocialCounts({
                followers: r.data.followers || 0,
                followingCount: r.data.followingCount || 0,
            })
        })
    }, [myUsername])

    // ── Saved posts ──
    const [savedPosts, setSavedPostsState] = useState(null) // null = not loaded yet
    const [savedLoading, setSavedLoading] = useState(false)
    async function loadSavedPosts() {
        setSavedLoading(true)
        const r = await fetchSavedPosts()
        setSavedPostsState(r.ok && Array.isArray(r.data) ? r.data : [])
        setSavedLoading(false)
    }
    async function handleUnsave(postId) {
        // Optimistic: drop it from the list, roll back if the API fails.
        const prev = savedPosts
        setSavedPostsState(list => (list || []).filter(p => p.id !== postId))
        const r = await unsavePost(postId)
        if (!r.ok) setSavedPostsState(prev)
    }
    useEffect(() => {
        if (activeTab === 'saved' && savedPosts === null && !savedLoading) loadSavedPosts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab])

    // ── Notification prefs ──
    const browserTz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC'
    const [notifPrefs, setNotifPrefs] = useState({
        enabled: false,
        reminderTime: '19:00',
        reminderTimezone: browserTz,
    })
    const [notifLoading, setNotifLoading] = useState(false)
    const [notifSaving, setNotifSaving] = useState(false)
    const [notifMsg, setNotifMsg] = useState(null)

    useEffect(() => {
        fetchDashboardData().then(r => {
            if (r.success) setDashData(r.data)
        }).catch(() => {})
        fetchMe().then(r => {
            if (r.ok) {
                if (r.data?.name) {
                    setUserNameState(r.data.name)
                    setUserName(r.data.name)
                }
                if (r.data?.username) setMyUsername(r.data.username)
                // Sync backend pic into local cache (or clear if backend has none)
                savePic(r.data?.profilePic || null)
            }
        }).catch(() => {})
    }, [])

    useEffect(() => {
        if (editingName && nameInputRef.current) nameInputRef.current.focus()
    }, [editingName])

    // Load notification prefs once on mount — the payload is tiny and the
    // user almost never has them changed from under them in another tab.
    useEffect(() => {
        let cancelled = false
        setNotifLoading(true)
        fetchNotificationPrefs().then(r => {
            if (cancelled) return
            if (r.ok && r.data) {
                setNotifPrefs({
                    enabled: !!r.data.enabled,
                    reminderTime: r.data.reminderTime || '19:00',
                    reminderTimezone: r.data.reminderTimezone || browserTz,
                })
            }
            setNotifLoading(false)
        }).catch(() => { if (!cancelled) setNotifLoading(false) })
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Profile picture upload ──
    function handlePicClick() { if (!picSaving) fileInputRef.current?.click() }

    function handlePicChange(e) {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        if (!file.type.startsWith('image/')) {
            setPicMsg({ type: 'error', text: 'Please choose an image file.' })
            return
        }
        // Hard cap at ~2MB raw — base64 is ~1.33x larger, so reject above this.
        if (file.size > 2 * 1024 * 1024) {
            setPicMsg({ type: 'error', text: 'Image is too large (max 2 MB).' })
            return
        }
        const reader = new FileReader()
        reader.onload = async ev => {
            const b64 = ev.target.result
            setPicSaving(true); setPicMsg(null)
            // Optimistic local update — topbar/sidebar avatars switch instantly
            savePic(b64)
            const r = await updateProfilePicture(b64)
            if (r.ok) {
                setPicMsg({ type: 'success', text: 'Profile picture updated!' })
                setTimeout(() => setPicMsg(null), 3000)
            } else {
                // Roll back on failure
                savePic(null)
                setPicMsg({ type: 'error', text: r.error || 'Failed to save picture' })
            }
            setPicSaving(false)
        }
        reader.onerror = () => setPicMsg({ type: 'error', text: 'Could not read the selected file.' })
        reader.readAsDataURL(file)
    }

    async function handleRemovePic(e) {
        e.stopPropagation()
        if (picSaving) return
        const previous = profilePic
        setPicSaving(true); setPicMsg(null)
        clearProfilePic() // optimistic
        const r = await removeProfilePicture()
        if (!r.ok) {
            savePic(previous || null) // restore
            setPicMsg({ type: 'error', text: r.error || 'Failed to remove picture' })
        }
        setPicSaving(false)
    }

    const handleSync = useCallback(async () => {
        setSyncing(true)
        try {
            await syncAllPlatforms()
            const r = await fetchDashboardData()
            if (r.success) setDashData(r.data)
        } catch (e) { console.error('Sync failed:', e) }
        setSyncing(false)
    }, [])

    const handleSaveName = async () => {
        if (!nameInput.trim()) return
        setNameSaving(true); setNameMsg(null)
        const r = await updateProfile(nameInput.trim())
        if (r.ok) {
            setUserNameState(r.data.name); setUserName(r.data.name)
            setEditingName(false)
            setNameMsg({ type: 'success', text: 'Name updated!' })
            setTimeout(() => setNameMsg(null), 3000)
        } else {
            setNameMsg({ type: 'error', text: r.error || 'Failed to update name' })
        }
        setNameSaving(false)
    }

    const startEditName = () => {
        setNameInput(userName || email.split('@')[0])
        setEditingName(true); setNameMsg(null)
    }

    const handleChangePassword = async (e) => {
        e.preventDefault(); setPwMsg(null)
        if (pwForm.next !== pwForm.confirm) { setPwMsg({ type: 'error', text: 'New passwords do not match' }); return }
        if (pwForm.next.length < 8) { setPwMsg({ type: 'error', text: 'New password must be at least 8 characters' }); return }
        setPwSaving(true)
        const r = await changePassword(pwForm.current, pwForm.next)
        if (r.ok) {
            setPwMsg({ type: 'success', text: 'Password updated successfully!' })
            setPwForm({ current: '', next: '', confirm: '' })
        } else {
            setPwMsg({ type: 'error', text: r.error || 'Failed to update password' })
        }
        setPwSaving(false)
    }

    const handleSaveNotifications = async () => {
        setNotifSaving(true); setNotifMsg(null)
        const r = await updateNotificationPrefs(notifPrefs)
        if (r.ok && r.data) {
            setNotifPrefs({
                enabled: !!r.data.enabled,
                reminderTime: r.data.reminderTime || notifPrefs.reminderTime,
                reminderTimezone: r.data.reminderTimezone || notifPrefs.reminderTimezone,
            })
            setNotifMsg({
                type: 'success',
                text: r.data.enabled ? 'Saved! You\u2019ll get reminder emails.' : 'Reminder emails turned off.',
            })
            setTimeout(() => setNotifMsg(null), 3500)
        } else {
            setNotifMsg({ type: 'error', text: r.error || 'Failed to save preferences' })
        }
        setNotifSaving(false)
    }

    const handleDeleteAccount = async () => {
        setDeleting(true)
        const r = await deleteAccount()
        if (r.ok) { logout(); navigate('/login') }
        else { alert(r.error || 'Failed to delete account. Please try again.'); setDeleting(false) }
    }

    // ── Derived stats ──
    const totalSolved = dashData?.totalSolved || 0
    const streak = dashData?.currentStreak || 0
    const hardSolved = dashData?.hardSolved || 0
    const platforms = dashData?.platforms || []
    const linkedPlats = dashData?.linkedPlatforms || []
    const platformCount = linkedPlats.length

    const skillLevel = totalSolved >= 300 ? 'Expert' : totalSolved >= 150 ? 'Advanced' : totalSolved >= 50 ? 'Intermediate' : 'Beginner'
    const skillEmoji = totalSolved >= 300 ? '🏆' : totalSolved >= 150 ? '🚀' : totalSolved >= 50 ? '⚡' : '🌱'

    const activityStats = [
        { label: 'Total Solved', value: totalSolved || '—' },
        { label: 'Current Streak', value: streak > 0 ? `${streak} days` : '—' },
        { label: 'Hard Problems', value: hardSolved || '—' },
        { label: 'Platforms Linked', value: platformCount || '—' },
    ]

    const connectedPlatforms = platforms.map(p => ({
        key: p.platform,
        label: p.platform === 'leetcode' ? 'LeetCode' : 'Codeforces',
        color: p.platform === 'leetcode' ? '#FFA116' : '#1890FF',
        abbr: p.platform === 'leetcode' ? 'LC' : 'CF',
        username: p.username,
        problems: p.totalSolved,
        easySolved: p.easySolved,
        mediumSolved: p.mediumSolved,
        hardSolved: p.hardSolved,
        currentStreak: p.currentStreak,
        updatedAt: p.updatedAt,
        hasData: p.totalSolved > 0,
    }))

    const displayName = userName || email.split('@')[0]
    const avatarInitial = (displayName || '?')[0].toUpperCase()

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <Topbar title="Profile" subtitle="Manage your account and platforms" />
                <main className="page-content">

                    {/* ── Profile Header ── */}
                    <div className="profile-header" style={{ marginBottom: 24, alignItems: 'center' }}>

                        {/* Avatar with upload overlay */}
                        <div
                            style={{ position: 'relative', flexShrink: 0, cursor: picSaving ? 'progress' : 'pointer' }}
                            onClick={handlePicClick}
                            onMouseEnter={() => setPicHover(true)}
                            onMouseLeave={() => setPicHover(false)}
                        >
                            {profilePic ? (
                                <img
                                    src={profilePic}
                                    alt="Profile"
                                    style={{
                                        width: 80, height: 80, borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '3px solid rgba(229,166,83,.4)',
                                        boxShadow: '0 0 0 4px rgba(229,166,83,.1)',
                                        transition: 'all .2s',
                                        filter: picHover ? 'brightness(.55)' : 'none',
                                    }}
                                />
                            ) : (
                                <div className="profile-avatar-lg" style={{
                                    filter: picHover ? 'brightness(.55)' : 'none',
                                    transition: 'all .2s',
                                }}>
                                    {avatarInitial}
                                </div>
                            )}

                            {/* Camera overlay */}
                            <div style={{
                                position: 'absolute', inset: 0, borderRadius: '50%',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                opacity: (picHover || picSaving) ? 1 : 0, transition: 'opacity .2s', gap: 2,
                            }}>
                                <span style={{ fontSize: 20 }}>{picSaving ? '⏳' : '📷'}</span>
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
                                    {picSaving ? 'Saving…' : profilePic ? 'Change' : 'Upload'}
                                </span>
                            </div>

                            {/* Remove button — only when pic exists */}
                            {profilePic && (
                                <button
                                    onClick={handleRemovePic}
                                    title="Remove photo"
                                    style={{
                                        position: 'absolute', top: -4, right: -4,
                                        width: 20, height: 20, borderRadius: '50%',
                                        background: '#EF4444', border: '2px solid #0B0F1A',
                                        color: '#fff', fontSize: 10, fontWeight: 800,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        lineHeight: 1, padding: 0,
                                    }}
                                >✕</button>
                            )}

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handlePicChange}
                            />
                        </div>

                        {/* Name + badges */}
                        <div style={{ flex: 1 }}>
                            {editingName ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <input
                                        ref={nameInputRef}
                                        value={nameInput}
                                        onChange={e => setNameInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                                        className="input-field"
                                        style={{ fontSize: 18, fontWeight: 700, padding: '4px 10px', maxWidth: 260 }}
                                        placeholder="Your name"
                                    />
                                    <button className="btn btn-primary btn-sm" onClick={handleSaveName} disabled={nameSaving || !nameInput.trim()}>
                                        {nameSaving ? '…' : '✓ Save'}
                                    </button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingName(false)}>✕</button>
                                </div>
                            ) : (
                                <div className="profile-name">{displayName}</div>
                            )}
                            {nameMsg && (
                                <div style={{ fontSize: 12, marginBottom: 4, color: nameMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                                    {nameMsg.text}
                                </div>
                            )}
                            {picMsg && (
                                <div style={{ fontSize: 12, marginBottom: 4, color: picMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                                    {picMsg.text}
                                </div>
                            )}
                            <div className="profile-email">{email}</div>
                            {myUsername && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                                    <span className="accent-hand" style={{ fontSize: 16, color: 'var(--amber)' }}>
                                        @{myUsername}
                                    </span>
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                        <b style={{ color: 'var(--text-primary)' }}>{socialCounts.followers}</b> follower{socialCounts.followers === 1 ? '' : 's'}
                                    </span>
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                        <b style={{ color: 'var(--text-primary)' }}>{socialCounts.followingCount}</b> following
                                    </span>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--success-light)', color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>{skillEmoji} {skillLevel}</span>
                                <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--accent-light)', color: 'var(--text-accent)', fontSize: 12, fontWeight: 600 }}>🔗 {platformCount} platform{platformCount !== 1 ? 's' : ''} linked</span>
                                {streak > 0 && <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--warning-light)', color: 'var(--warning)', fontSize: 12, fontWeight: 600 }}>🔥 {streak}-day streak</span>}
                            </div>
                        </div>

                        <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={startEditName}>
                            ✏️ Edit Name
                        </button>
                    </div>

                    {/* ── Tabs ── */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', padding: 4, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
                        {['overview', 'platforms', 'notifications', 'saved', 'security'].map(t => (
                            <button key={t} onClick={() => setActiveTab(t)} style={{
                                padding: '8px 18px', borderRadius: 'var(--radius-md)',
                                fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                                background: activeTab === t ? 'var(--accent)' : 'transparent',
                                color: activeTab === t ? '#fff' : 'var(--text-muted)', cursor: 'pointer',
                            }}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* ── Overview ── */}
                    {activeTab === 'overview' && (
                        <div className="grid-2">
                            <div className="card">
                                <div className="section-title" style={{ marginBottom: 20 }}>📊 Activity Summary</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {activityStats.map(s => (
                                        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.label}</span>
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'rgba(229,166,83,0.12)', color: '#E5A653' }}>↻ Fetched from All Linked Platforms</span>
                                </div>
                            </div>

                            <div className="card">
                                <div className="section-title" style={{ marginBottom: 20 }}>👤 Account Info</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {[
                                        { label: 'Full Name', val: displayName },
                                        { label: 'Email', val: email },
                                        { label: 'Skill Level', val: `${skillEmoji} ${skillLevel}` },
                                        { label: 'Plan', val: 'Free' },
                                    ].map(r => (
                                        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.label}</span>
                                            <span style={{ fontSize: 14, fontWeight: 600 }}>{r.val}</span>
                                        </div>
                                    ))}
                                    <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={startEditName}>
                                        ✏️ Edit Name
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Platforms ── */}
                    {activeTab === 'platforms' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {connectedPlatforms.length === 0 && (
                                <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                                        No platforms linked. <a href="/onboarding" style={{ color: 'var(--accent)' }}>Complete onboarding</a> to add your accounts.
                                    </div>
                                </div>
                            )}
                            {connectedPlatforms.map(p => (
                                <div key={p.key} className="card" style={{ padding: '20px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: `${p.color}18`, border: `1px solid ${p.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: p.color }}>
                                                {p.abbr}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 15, fontWeight: 700 }}>{p.label}</div>
                                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>@{p.username} · {p.hasData ? `${p.problems} problems solved` : 'Click Sync to fetch data'}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', background: 'var(--success-light)', color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>● Connected</span>
                                            <button className="btn btn-ghost btn-sm" onClick={handleSync} disabled={syncing}>{syncing ? '⏳ Syncing...' : 'Sync ↻'}</button>
                                        </div>
                                    </div>
                                    {p.hasData && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 14, padding: 14, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                                            <PStat label="Total" value={p.problems} />
                                            <PStat label="Easy" value={p.easySolved} color="#22C55E" />
                                            <PStat label="Medium" value={p.mediumSolved} color="#F59E0B" />
                                            <PStat label="Hard" value={p.hardSolved} color="#EF4444" />
                                            {p.currentStreak > 0 && <PStat label="Streak" value={`${p.currentStreak}d`} color="#F59E0B" />}
                                        </div>
                                    )}
                                    {p.updatedAt && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Last synced: {new Date(p.updatedAt).toLocaleString()}</div>}
                                    {p.hasData && <div style={{ marginTop: 8 }}><span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: `${p.color}15`, color: p.color }}>↻ Fetched from {p.label} API</span></div>}
                                </div>
                            ))}
                            <div className="card" style={{ padding: '20px 24px', border: '1px dashed var(--border)', textAlign: 'center', cursor: 'pointer' }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>+</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Add Another Platform</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Go to <a href="/onboarding" style={{ color: 'var(--accent)' }}>onboarding</a> to link more accounts</div>
                            </div>
                        </div>
                    )}

                    {/* ── Notifications ── */}
                    {activeTab === 'notifications' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
                            <div className="card">
                                <div className="section-title" style={{ marginBottom: 8 }}>📬 Practice Reminders</div>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.55 }}>
                                    Get a gentle nudge on days you haven't practiced, and a louder one when your streak is at risk.
                                    Off by default — you're in control.
                                </p>

                                {notifLoading ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading preferences…</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                        {/* Toggle */}
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={notifPrefs.enabled}
                                                onChange={e => setNotifPrefs(p => ({ ...p, enabled: e.target.checked }))}
                                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: 14, fontWeight: 600 }}>
                                                Send me reminder emails
                                            </span>
                                        </label>

                                        {/* Time + timezone (disabled when off) */}
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                                            opacity: notifPrefs.enabled ? 1 : 0.5,
                                            pointerEvents: notifPrefs.enabled ? 'auto' : 'none',
                                            transition: 'opacity .2s',
                                        }}>
                                            <div className="input-group">
                                                <label className="input-label">Reminder time</label>
                                                <input
                                                    type="time"
                                                    className="input-field"
                                                    value={notifPrefs.reminderTime}
                                                    onChange={e => setNotifPrefs(p => ({ ...p, reminderTime: e.target.value }))}
                                                />
                                            </div>
                                            <div className="input-group">
                                                <label className="input-label">Timezone</label>
                                                <select
                                                    className="input-field"
                                                    value={notifPrefs.reminderTimezone}
                                                    onChange={e => setNotifPrefs(p => ({ ...p, reminderTimezone: e.target.value }))}
                                                >
                                                    {getTimezoneOptions(notifPrefs.reminderTimezone).map(tz => (
                                                        <option key={tz} value={tz}>{tz}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {notifMsg && (
                                            <div style={{
                                                fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                background: notifMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                                                color: notifMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                                            }}>
                                                {notifMsg.type === 'success' ? '✓ ' : '✕ '}{notifMsg.text}
                                            </div>
                                        )}

                                        <button
                                            className="btn btn-primary"
                                            onClick={handleSaveNotifications}
                                            disabled={notifSaving}
                                            style={{ alignSelf: 'flex-start' }}
                                        >
                                            {notifSaving ? 'Saving…' : 'Save preferences'}
                                        </button>

                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                            Reminders are sent at most once per day to the email on your account
                                            ({email}). You won't get one on days you've already solved a problem.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Saved posts ── */}
                    {activeTab === 'saved' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
                            <div className="card">
                                <div className="section-title" style={{ marginBottom: 6 }}>🔖 Saved Posts</div>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.55 }}>
                                    Blog posts you bookmarked for later. Click to jump into Community, or unsave any time.
                                </p>

                                {savedLoading && savedPosts === null && (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 24, textAlign: 'center' }}>
                                        Loading your saved posts…
                                    </div>
                                )}

                                {!savedLoading && savedPosts !== null && savedPosts.length === 0 && (
                                    <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                                        <div style={{ fontSize: 34, marginBottom: 10 }}>📚</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>
                                            Nothing saved yet.
                                        </div>
                                        <div className="accent-hand" style={{ fontSize: 16, color: 'var(--text-muted)' }}>
                                            tap the 🔖 bookmark on any post to keep it here
                                        </div>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ marginTop: 16 }}
                                            onClick={() => navigate('/community')}
                                        >
                                            Browse Community →
                                        </button>
                                    </div>
                                )}

                                {savedPosts && savedPosts.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {savedPosts.map(post => (
                                            <SavedPostRow
                                                key={post.id}
                                                post={post}
                                                onOpen={() => navigate('/community')}
                                                onUnsave={() => handleUnsave(post.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Security ── */}
                    {activeTab === 'security' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
                            <div className="card">
                                <div className="section-title" style={{ marginBottom: 16 }}>🔒 Change Password</div>
                                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[
                                        { id: 'current-password', key: 'current', label: 'Current Password', ph: '••••••••' },
                                        { id: 'new-password', key: 'next', label: 'New Password', ph: 'Min. 8 characters' },
                                        { id: 'confirm-new-password', key: 'confirm', label: 'Confirm New Password', ph: 'Repeat new password' },
                                    ].map(({ id, key, label, ph }) => (
                                        <div key={key} className="input-group">
                                            <label className="input-label">{label}</label>
                                            <input id={id} type="password" className="input-field" placeholder={ph} value={pwForm[key]} onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} required />
                                        </div>
                                    ))}
                                    {pwMsg && (
                                        <div style={{ fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: pwMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)', color: pwMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>
                                            {pwMsg.type === 'success' ? '✓ ' : '✕ '}{pwMsg.text}
                                        </div>
                                    )}
                                    <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={pwSaving}>{pwSaving ? 'Updating…' : 'Update Password'}</button>
                                </form>
                            </div>

                            <div className="card" style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>⚠️ Danger Zone</div>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Deleting your account is permanent and cannot be undone. All your problem history, streaks, and analytics will be lost forever.</p>
                                {!showDeleteConfirm ? (
                                    <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteConfirm(true)}>Delete Account</button>
                                ) : (
                                    <div style={{ background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Are you absolutely sure? This cannot be undone.</p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-danger btn-sm" onClick={handleDeleteAccount} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, delete everything'}</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </div>
    )
}

function PStat({ label, value, color }) {
    return (
        <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
        </div>
    )
}

/**
 * Compact row for one saved post — enough info to decide "yes, that one"
 * without duplicating the full Community post card. Clicking the row drops
 * you into Community; the unsave button is isolated so misclicks can't
 * accidentally unsave.
 */
function SavedPostRow({ post, onOpen, onUnsave }) {
    const topicColor = {
        arrays: '#9F8FE3', graphs: '#88C0A3', dp: '#D88BA8', trees: '#E5A653',
    }[String(post.topic || '').toLowerCase()] || 'var(--lavender)'
    return (
        <div
            onClick={onOpen}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 16px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderLeft: `3px solid ${topicColor}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'border-color 0.2s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
        >
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {post.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    {post.authorUsername
                        ? <span style={{ color: 'var(--amber)', fontWeight: 600 }}>@{post.authorUsername}</span>
                        : (post.authorName || 'anonymous')}
                    {' · '}
                    <span style={{ textTransform: 'capitalize' }}>{post.topic}</span>
                </div>
                <div style={{
                    fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                }}>
                    {post.preview || post.content}
                </div>
            </div>
            <button
                onClick={e => { e.stopPropagation(); onUnsave() }}
                title="Remove from saved"
                style={{
                    background: 'var(--amber-light)',
                    border: '1px solid var(--border)',
                    color: 'var(--amber)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                }}
            >
                🔖 Unsave
            </button>
        </div>
    )
}

/**
 * Build the timezone <select> options. Uses the browser-provided IANA list when
 * available (modern Chrome/Safari/Firefox), otherwise falls back to a compact
 * hand-picked list covering the most common regions. Always ensures `current`
 * is included so a saved value can't silently disappear from the dropdown.
 */
const TZ_FALLBACK = [
    'UTC',
    'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
    'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo',
    'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris',
    'Europe/Berlin', 'Europe/Madrid', 'Europe/Rome', 'Europe/Athens',
    'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok',
    'Asia/Singapore', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
    'Australia/Sydney', 'Pacific/Auckland',
]

function getTimezoneOptions(current) {
    let zones
    try {
        zones = (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function')
            ? Intl.supportedValuesOf('timeZone')
            : TZ_FALLBACK
    } catch {
        zones = TZ_FALLBACK
    }
    if (current && !zones.includes(current)) zones = [current, ...zones]
    return zones
}
