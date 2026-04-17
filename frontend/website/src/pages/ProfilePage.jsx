import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import {
    fetchDashboardData, syncAllPlatforms,
    getUserEmail, getUserName, fetchMe,
    updateProfile, changePassword, deleteAccount,
    setUserName, logout,
} from '../services/api'


export default function ProfilePage() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('overview')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [dashData, setDashData] = useState(null)
    const [syncing, setSyncing] = useState(false)
    const [userName, setUserNameState] = useState(getUserName())
    const email = getUserEmail() || ''

    // ── Edit name state ──
    const [editingName, setEditingName] = useState(false)
    const [nameInput, setNameInput] = useState('')
    const [nameSaving, setNameSaving] = useState(false)
    const [nameMsg, setNameMsg] = useState(null) // { type: 'success'|'error', text }
    const nameInputRef = useRef(null)

    // ── Change password state ──
    const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
    const [pwSaving, setPwSaving] = useState(false)
    const [pwMsg, setPwMsg] = useState(null) // { type, text }

    // ── Delete account state ──
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        fetchDashboardData().then(r => {
            if (r.success) setDashData(r.data)
        }).catch(() => { })
        fetchMe().then(r => {
            if (r.ok && r.data?.name) {
                setUserNameState(r.data.name)
                setUserName(r.data.name)
            }
        }).catch(() => { })
    }, [])

    // Focus name input when editing starts
    useEffect(() => {
        if (editingName && nameInputRef.current) nameInputRef.current.focus()
    }, [editingName])

    const handleSync = useCallback(async () => {
        setSyncing(true)
        try {
            await syncAllPlatforms()
            const r = await fetchDashboardData()
            if (r.success) setDashData(r.data)
        } catch (e) { console.error('Sync failed:', e) }
        setSyncing(false)
    }, [])

    // ── Save display name ──
    const handleSaveName = async () => {
        if (!nameInput.trim()) return
        setNameSaving(true)
        setNameMsg(null)
        const r = await updateProfile(nameInput.trim())
        if (r.ok) {
            setUserNameState(r.data.name)
            setUserName(r.data.name)
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
        setEditingName(true)
        setNameMsg(null)
    }

    // ── Change password ──
    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPwMsg(null)
        if (pwForm.next !== pwForm.confirm) {
            setPwMsg({ type: 'error', text: 'New passwords do not match' })
            return
        }
        if (pwForm.next.length < 8) {
            setPwMsg({ type: 'error', text: 'New password must be at least 8 characters' })
            return
        }
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

    // ── Delete account ──
    const handleDeleteAccount = async () => {
        setDeleting(true)
        const r = await deleteAccount()
        if (r.ok) {
            logout()
            navigate('/login')
        } else {
            alert(r.error || 'Failed to delete account. Please try again.')
            setDeleting(false)
        }
    }

    // ── Derived stats ──
    const totalSolved = dashData?.totalSolved || 0
    const streak = dashData?.currentStreak || 0
    const hardSolved = dashData?.hardSolved || 0
    const platforms = dashData?.platforms || []
    const linkedPlats = dashData?.linkedPlatforms || []
    const platformCount = linkedPlats.length

    const skillLevel = totalSolved >= 300 ? 'Expert'
        : totalSolved >= 150 ? 'Advanced'
        : totalSolved >= 50 ? 'Intermediate'
        : 'Beginner'
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

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <Topbar title="Profile" subtitle="Manage your account and platforms" />
                <main className="page-content">

                    {/* Profile Header */}
                    <div className="profile-header" style={{ marginBottom: 20 }}>
                        <div className="profile-avatar-lg">{(displayName || '?')[0].toUpperCase()}</div>
                        <div style={{ flex: 1 }}>
                            {/* Inline name editor */}
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
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={handleSaveName}
                                        disabled={nameSaving || !nameInput.trim()}
                                    >
                                        {nameSaving ? '…' : '✓ Save'}
                                    </button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setEditingName(false)}
                                    >✕</button>
                                </div>
                            ) : (
                                <div className="profile-name">{displayName}</div>
                            )}
                            {nameMsg && (
                                <div style={{
                                    fontSize: 12, marginBottom: 4,
                                    color: nameMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                                }}>
                                    {nameMsg.text}
                                </div>
                            )}
                            <div className="profile-email">{email}</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                                <span style={{
                                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                    background: 'var(--success-light)', color: 'var(--success)',
                                    fontSize: 12, fontWeight: 600,
                                }}>{skillEmoji} {skillLevel}</span>
                                <span style={{
                                    padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                    background: 'var(--accent-light)', color: 'var(--text-accent)',
                                    fontSize: 12, fontWeight: 600,
                                }}>🔗 {platformCount} platform{platformCount !== 1 ? 's' : ''} linked</span>
                                {streak > 0 && (
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 'var(--radius-full)',
                                        background: 'var(--warning-light)', color: 'var(--warning)',
                                        fontSize: 12, fontWeight: 600,
                                    }}>🔥 {streak}-day streak</span>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
                            <button className="btn btn-secondary btn-sm" onClick={startEditName}>
                                ✏️ Edit Profile
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div style={{
                        display: 'flex', gap: 4, marginBottom: 20,
                        background: 'var(--bg-card)', padding: 4,
                        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                        width: 'fit-content',
                    }}>
                        {['overview', 'platforms', 'security'].map(t => (
                            <button
                                key={t}
                                onClick={() => setActiveTab(t)}
                                style={{
                                    padding: '8px 18px', borderRadius: 'var(--radius-md)',
                                    fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
                                    background: activeTab === t ? 'var(--accent)' : 'transparent',
                                    color: activeTab === t ? '#fff' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                }}
                            >
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="grid-2">
                            {/* Stats */}
                            <div className="card">
                                <div className="section-title" style={{ marginBottom: 20 }}>📊 Activity Summary</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {activityStats.map(s => (
                                        <div key={s.label} style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)',
                                        }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.label}</span>
                                            <span style={{ fontSize: 14, fontWeight: 700 }}>{s.value}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <span style={{
                                        fontSize: 10, fontWeight: 600, padding: '2px 6px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(99,102,241,0.12)', color: '#6366F1',
                                    }}>↻ Fetched from All Linked Platforms</span>
                                </div>
                            </div>

                            {/* Account info */}
                            <div className="card">
                                <div className="section-title" style={{ marginBottom: 20 }}>👤 Account Info</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {[
                                        { label: 'Full Name', val: displayName },
                                        { label: 'Email', val: email },
                                        { label: 'Skill Level', val: `${skillEmoji} ${skillLevel}` },
                                        { label: 'Plan', val: 'Free' },
                                    ].map(r => (
                                        <div key={r.label} style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)',
                                        }}>
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.label}</span>
                                            <span style={{ fontSize: 14, fontWeight: 600 }}>{r.val}</span>
                                        </div>
                                    ))}
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        style={{ alignSelf: 'flex-start' }}
                                        onClick={startEditName}
                                    >
                                        ✏️ Edit Name
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Platforms Tab */}
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
                                            <div style={{
                                                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                                background: `${p.color}18`, border: `1px solid ${p.color}30`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 13, fontWeight: 800, color: p.color,
                                            }}>
                                                {p.abbr}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 15, fontWeight: 700 }}>{p.label}</div>
                                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    @{p.username} · {p.hasData ? `${p.problems} problems solved` : 'Click Sync to fetch data'}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                padding: '4px 10px', borderRadius: 'var(--radius-full)',
                                                background: 'var(--success-light)', color: 'var(--success)',
                                                fontSize: 12, fontWeight: 600,
                                            }}>● Connected</span>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={handleSync}
                                                disabled={syncing}
                                            >
                                                {syncing ? '⏳ Syncing...' : 'Sync ↻'}
                                            </button>
                                        </div>
                                    </div>

                                    {p.hasData && (
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
                                            marginTop: 14, padding: 14, background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                                        }}>
                                            <PStat label="Total" value={p.problems} />
                                            <PStat label="Easy" value={p.easySolved} color="#22C55E" />
                                            <PStat label="Medium" value={p.mediumSolved} color="#F59E0B" />
                                            <PStat label="Hard" value={p.hardSolved} color="#EF4444" />
                                            {p.currentStreak > 0 && <PStat label="Streak" value={`${p.currentStreak}d`} color="#F59E0B" />}
                                        </div>
                                    )}
                                    {p.updatedAt && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                                            Last synced: {new Date(p.updatedAt).toLocaleString()}
                                        </div>
                                    )}
                                    {p.hasData && (
                                        <div style={{ marginTop: 8 }}>
                                            <span style={{
                                                fontSize: 10, fontWeight: 600, padding: '2px 6px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: `${p.color}15`, color: p.color,
                                            }}>↻ Fetched from {p.label} API</span>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Add platform */}
                            <div className="card" style={{
                                padding: '20px 24px', border: '1px dashed var(--border)',
                                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                            }}>
                                <div style={{ fontSize: 24, marginBottom: 8 }}>+</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    Add Another Platform
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Go to <a href="/onboarding" style={{ color: 'var(--accent)' }}>onboarding</a> to link more accounts
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
                            {/* Change password */}
                            <div className="card">
                                <div className="section-title" style={{ marginBottom: 16 }}>🔒 Change Password</div>
                                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div className="input-group">
                                        <label className="input-label">Current Password</label>
                                        <input
                                            id="current-password"
                                            type="password"
                                            className="input-field"
                                            placeholder="••••••••"
                                            value={pwForm.current}
                                            onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">New Password</label>
                                        <input
                                            id="new-password"
                                            type="password"
                                            className="input-field"
                                            placeholder="Min. 8 characters"
                                            value={pwForm.next}
                                            onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Confirm New Password</label>
                                        <input
                                            id="confirm-new-password"
                                            type="password"
                                            className="input-field"
                                            placeholder="Repeat new password"
                                            value={pwForm.confirm}
                                            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    {pwMsg && (
                                        <div style={{
                                            fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                            background: pwMsg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                                            color: pwMsg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                                        }}>
                                            {pwMsg.type === 'success' ? '✓ ' : '✕ '}{pwMsg.text}
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                        style={{ alignSelf: 'flex-start' }}
                                        disabled={pwSaving}
                                    >
                                        {pwSaving ? 'Updating…' : 'Update Password'}
                                    </button>
                                </form>
                            </div>

                            {/* Danger Zone */}
                            <div className="card" style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>
                                    ⚠️ Danger Zone
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                                    Deleting your account is permanent and cannot be undone. All your problem history,
                                    streaks, and analytics will be lost forever.
                                </p>
                                {!showDeleteConfirm ? (
                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => setShowDeleteConfirm(true)}
                                    >
                                        Delete Account
                                    </button>
                                ) : (
                                    <div style={{
                                        background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.25)',
                                        borderRadius: 'var(--radius-md)', padding: '14px 16px',
                                    }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                                            Are you absolutely sure? This cannot be undone.
                                        </p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={handleDeleteAccount}
                                                disabled={deleting}
                                            >
                                                {deleting ? 'Deleting…' : 'Yes, delete everything'}
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => setShowDeleteConfirm(false)}
                                                disabled={deleting}
                                            >Cancel</button>
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

/** Small stat display for platform cards */
function PStat({ label, value, color }) {
    return (
        <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
        </div>
    )
}
