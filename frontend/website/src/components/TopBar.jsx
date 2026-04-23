import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    getUserName, getUserEmail, fetchDashboardData,
    fetchNotifications, fetchUnreadNotifCount, markAllNotificationsRead,
} from '../services/api'
import { useProfilePic } from '../utils/profilePic'

/* ── helpers ──────────────────────────────────────────────────────────── */

function timeAgo(iso) {
    if (!iso) return ''
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 30)     return 'just now'
    if (diff < 60)     return `${Math.floor(diff)}s ago`
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(iso).toLocaleDateString()
}

// Visual per-type accent so users can tell notification kinds apart
// from a 200ms glance at the dropdown.
const TYPE_META = {
    LIKE:               { icon: '❤️',  color: '#EF4444', label: 'Like' },
    FOLLOW:             { icon: '👤',  color: '#9F8FE3', label: 'Follow' },
    POST_FROM_FOLLOWED: { icon: '✍️',  color: '#E5A653', label: 'New post' },
    CHALLENGE_INVITE:   { icon: '⚔️',  color: '#F59E0B', label: 'Challenge' },
    SYSTEM:             { icon: '📣',  color: '#38BDF8', label: 'Announcement' },
}
function metaFor(type) { return TYPE_META[type] || { icon: '🔔', color: '#94A3B8', label: 'Update' } }

/* ── component ────────────────────────────────────────────────────────── */

export default function Topbar({ title, subtitle }) {
    const navigate = useNavigate()
    const [streak, setStreak] = useState(null)
    const profilePic = useProfilePic()
    const name = getUserName() || getUserEmail() || ''
    const initial = name ? name[0].toUpperCase() : '?'
    const displayName = name.includes('@') ? name.split('@')[0] : name

    /* Notifications state */
    const [unread, setUnread] = useState(0)
    const [open, setOpen]     = useState(false)
    const [items, setItems]   = useState([])     // fetched when the dropdown opens
    const [loadingN, setLoadingN] = useState(false)
    const popRef = useRef(null)

    useEffect(() => {
        fetchDashboardData()
            .then(r => { if (r.success) setStreak(r.data?.currentStreak ?? 0) })
            .catch(() => setStreak(0))
    }, [])

    // Poll the unread count every 60s. Cheap round-trip (just a number)
    // so keeping the badge honest without hammering the backend.
    useEffect(() => {
        let cancelled = false
        async function refresh() {
            try {
                const r = await fetchUnreadNotifCount()
                if (!cancelled && r.ok) setUnread(r.data?.unreadCount ?? 0)
            } catch { /* ignore */ }
        }
        refresh()
        const id = setInterval(refresh, 60_000)
        return () => { cancelled = true; clearInterval(id) }
    }, [])

    // Load the list every time the dropdown opens. Also marks everything
    // read server-side and zeros the badge locally.
    async function openDropdown() {
        setOpen(true)
        setLoadingN(true)
        try {
            const r = await fetchNotifications(0, 20)
            if (r.ok) {
                setItems(r.data?.items || [])
                setUnread(r.data?.unreadCount ?? 0)
            }
        } catch { /* ignore */ }
        setLoadingN(false)

        // Fire-and-forget: mark everything read.
        try { await markAllNotificationsRead(); setUnread(0) }
        catch { /* ignore */ }
    }
    function closeDropdown() { setOpen(false) }

    // Click-outside + Escape to close
    useEffect(() => {
        if (!open) return
        function onClick(e) {
            if (popRef.current && !popRef.current.contains(e.target)) closeDropdown()
        }
        function onKey(e) { if (e.key === 'Escape') closeDropdown() }
        document.addEventListener('mousedown', onClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    function openItem(n) {
        closeDropdown()
        if (n?.link) navigate(n.link)
    }

    const badge = unread > 99 ? '99+' : unread > 0 ? String(unread) : ''

    return (
        <header className="topbar">
            <style>{BELL_CSS}</style>
            <div className="topbar-left">
                <span className="topbar-title">{title}</span>
                {subtitle && (
                    <span className="topbar-sub accent-hand" style={{ fontSize: 16 }}>
                        {subtitle}
                    </span>
                )}
            </div>
            <div className="topbar-right">
                {/* Streak Badge — always visible once loaded */}
                {streak !== null && (
                    <div
                        className="topbar-streak"
                        style={{
                            color: streak > 14 ? '#F59E0B'
                                 : streak > 6  ? '#FB923C'
                                 : streak > 0  ? '#FCD34D'
                                 : '#9CA3AF',
                        }}
                    >
                        {streak > 0 ? `🔥 ${streak} day${streak === 1 ? '' : 's'}` : '⚡ No streak'}
                    </div>
                )}

                {/* Notification bell + dropdown */}
                <div className="bell-wrap" ref={popRef}>
                    <button
                        className="notif-btn"
                        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
                        aria-expanded={open}
                        onClick={() => (open ? closeDropdown() : openDropdown())}
                    >
                        <span className={`bell-icon ${unread > 0 ? 'bell-has-unread' : ''}`}>🔔</span>
                        {badge && <span className="bell-badge">{badge}</span>}
                    </button>

                    {open && (
                        <div className="bell-pop" role="dialog" aria-label="Notifications">
                            <div className="bell-head">
                                <span className="bell-head-title">Notifications</span>
                                {items.length > 0 && (
                                    <span className="bell-head-sub">
                                        {items.length} recent
                                    </span>
                                )}
                            </div>

                            {loadingN && items.length === 0 && (
                                <div className="bell-empty">
                                    <div className="bell-empty-emoji">⏳</div>
                                    Loading…
                                </div>
                            )}

                            {!loadingN && items.length === 0 && (
                                <div className="bell-empty">
                                    <div className="bell-empty-emoji">🌙</div>
                                    <div className="bell-empty-title">Nothing yet</div>
                                    <div className="bell-empty-sub">
                                        Likes, follows, contest invites and announcements
                                        will land here.
                                    </div>
                                </div>
                            )}

                            {items.length > 0 && (
                                <ul className="bell-list">
                                    {items.map(n => {
                                        const meta = metaFor(n.type)
                                        return (
                                            <li
                                                key={n.id}
                                                className={`bell-item ${n.read ? '' : 'bell-item-unread'}`}
                                                onClick={() => openItem(n)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={e => { if (e.key === 'Enter') openItem(n) }}
                                            >
                                                <span
                                                    className="bell-item-icon"
                                                    style={{
                                                        background: `${meta.color}1f`,
                                                        color: meta.color,
                                                        border: `1px solid ${meta.color}3a`,
                                                    }}
                                                >
                                                    {meta.icon}
                                                </span>
                                                <div className="bell-item-body">
                                                    <div className="bell-item-title">{n.title}</div>
                                                    {n.message && (
                                                        <div className="bell-item-msg">{n.message}</div>
                                                    )}
                                                    <div className="bell-item-foot">
                                                        <span
                                                            className="bell-item-type"
                                                            style={{ color: meta.color }}
                                                        >
                                                            {meta.label}
                                                        </span>
                                                        <span className="bell-item-sep">·</span>
                                                        <span>{timeAgo(n.createdAt)}</span>
                                                    </div>
                                                </div>
                                                {!n.read && <span className="bell-item-dot" aria-hidden />}
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                {/* Avatar */}
                <div
                    className="topbar-avatar"
                    title={displayName}
                    onClick={() => navigate('/profile')}
                    style={{
                        cursor: 'pointer',
                        ...(profilePic
                            ? {
                                backgroundImage: `url(${profilePic})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                color: 'transparent',
                            }
                            : {}),
                    }}
                >
                    {profilePic ? '' : initial}
                </div>
            </div>
        </header>
    )
}

/* ── styles for the bell + dropdown (scoped to .bell-*) ───────────────── */
const BELL_CSS = `
.bell-wrap { position: relative; }
.notif-btn {
    position: relative;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.08);
    color: #CBD5E1;
    width: 38px; height: 38px;
    border-radius: 10px;
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.notif-btn:hover { background: rgba(229,166,83,0.08); border-color: rgba(229,166,83,0.25); }
.notif-btn:active { transform: translateY(1px); }
.bell-icon { font-size: 16px; line-height: 1; }
.bell-has-unread { animation: bell-swing 2s ease-in-out 1; transform-origin: 50% 10%; }
@keyframes bell-swing {
    0%, 20%, 100% { transform: rotate(0); }
    25% { transform: rotate(-14deg); }
    35% { transform: rotate(12deg); }
    45% { transform: rotate(-8deg); }
    55% { transform: rotate(6deg); }
    65% { transform: rotate(-3deg); }
    75% { transform: rotate(0); }
}
.bell-badge {
    position: absolute;
    top: -4px; right: -4px;
    min-width: 17px; height: 17px;
    padding: 0 4px;
    border-radius: 9px;
    background: linear-gradient(135deg,#EF4444,#F97316);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    display: inline-flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(239,68,68,0.5);
    border: 1.5px solid #0B0F1A;
    letter-spacing: 0.02em;
}

.bell-pop {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 360px;
    max-height: 480px;
    overflow: auto;
    background: rgba(11, 15, 26, 0.96);
    border: 1px solid rgba(229,166,83,0.22);
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02) inset;
    backdrop-filter: blur(14px);
    z-index: 50;
    animation: bell-pop-in 0.18s ease-out;
}
@keyframes bell-pop-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
}
.bell-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    position: sticky; top: 0;
    background: rgba(11,15,26,0.96);
    z-index: 2;
}
.bell-head-title {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800; font-size: 14px;
    color: #F1F5F9;
    letter-spacing: -0.01em;
}
.bell-head-sub { font-size: 11px; color: #64748B; letter-spacing: 0.02em; }

.bell-empty {
    padding: 46px 22px;
    text-align: center;
    color: #64748B;
}
.bell-empty-emoji { font-size: 32px; margin-bottom: 10px; opacity: 0.8; }
.bell-empty-title {
    font-size: 14px; font-weight: 700; color: #CBD5E1; margin-bottom: 4px;
}
.bell-empty-sub { font-size: 12px; line-height: 1.55; max-width: 240px; margin: 0 auto; }

.bell-list { list-style: none; margin: 0; padding: 4px 0 8px; }
.bell-item {
    position: relative;
    display: flex; align-items: flex-start; gap: 12px;
    padding: 11px 16px;
    cursor: pointer;
    transition: background 0.15s;
}
.bell-item:hover { background: rgba(255,255,255,0.03); }
.bell-item-unread { background: rgba(229,166,83,0.06); }
.bell-item-unread:hover { background: rgba(229,166,83,0.09); }

.bell-item-icon {
    flex-shrink: 0;
    width: 34px; height: 34px;
    border-radius: 10px;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 16px;
    line-height: 1;
}
.bell-item-body { flex: 1; min-width: 0; }
.bell-item-title {
    font-size: 13.5px; font-weight: 700;
    color: #F1F5F9;
    line-height: 1.35;
    overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.bell-item-msg {
    margin-top: 3px;
    font-size: 12px;
    color: #94A3B8;
    line-height: 1.45;
    overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.bell-item-foot {
    margin-top: 6px;
    font-size: 10.5px;
    color: #64748B;
    display: flex; align-items: center; gap: 6px;
    letter-spacing: 0.02em;
}
.bell-item-type { font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
.bell-item-sep  { opacity: 0.6; }
.bell-item-dot {
    position: absolute; top: 14px; right: 14px;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #E5A653;
    box-shadow: 0 0 6px rgba(229,166,83,0.65);
}
`
