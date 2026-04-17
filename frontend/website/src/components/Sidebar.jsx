import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getUserName, getUserEmail, fetchDashboardData } from '../services/api'

const NAV_ITEMS = [
    {
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
            </svg>
        ),
        label: 'Dashboard',
        path: '/dashboard',
        color: '#6366F1',
    },
    {
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
        ),
        label: 'Training',
        path: '/problems',
        color: '#22D3EE',
    },
    {
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" /><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" /><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" /><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" /><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" /><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z" /><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z" />
            </svg>
        ),
        label: 'Challenges',
        path: '/challenges',
        color: '#F59E0B',
    },
    {
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
        ),
        label: 'Community',
        path: '/community',
        color: '#34D399',
    },
    {
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
        ),
        label: 'Profile',
        path: '/profile',
        color: '#F472B6',
    },
]

export default function Sidebar() {
    const navigate = useNavigate()
    const { pathname } = useLocation()

    // ── Real user data ──
    const rawName   = getUserName() || getUserEmail() || ''
    const initial   = rawName ? rawName[0].toUpperCase() : '?'
    const shortName = rawName.includes('@')
        ? rawName.split('@')[0]
        : (rawName.split(' ')[0] || 'User')

    const [streak, setStreak] = useState(null)   // null = still loading

    useEffect(() => {
        fetchDashboardData()
            .then(r => setStreak(r?.data?.currentStreak ?? 0))
            .catch(() => setStreak(0))
    }, [])

    const streakColor =
        streak === null  ? '#6B7280' :
        streak > 14      ? '#F59E0B' :
        streak > 6       ? '#FB923C' :
        streak > 0       ? '#FCD34D' :
                           '#6B7280'

    const streakText =
        streak === null ? '…'           :
        streak === 0    ? 'No streak yet' :
        streak === 1    ? '🔥 1 day'    :
                          `🔥 ${streak} days`

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                <span className="sidebar-logo-text">Algo<span>Ledger</span></span>
            </div>

            {/* User mini-profile */}
            <div className="sidebar-user">
                <div className="sidebar-user-avatar">{initial}</div>
                <div className="sidebar-user-info">
                    <div className="sidebar-user-name">{shortName}</div>
                    <div className="sidebar-user-rank" style={{ color: streakColor }}>
                        {streakText}
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                <span className="sidebar-section-label">Navigation</span>
                {NAV_ITEMS.map(item => {
                    const isActive = pathname === item.path
                    return (
                        <button
                            key={item.path}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}
                            style={isActive ? { '--nav-color': item.color } : {}}
                        >
                            <span className="nav-icon" style={isActive ? { color: item.color } : {}}>
                                {item.icon}
                            </span>
                            <span className="nav-label">{item.label}</span>
                            {isActive && <span className="nav-active-indicator" style={{ background: item.color }} />}
                        </button>
                    )
                })}
            </nav>

            {/* Bottom */}
            <div className="sidebar-bottom">
                <div className="sidebar-xp-bar">
                    <div className="sidebar-xp-header">
                        <span className="sidebar-xp-label">Streak</span>
                        <span className="sidebar-xp-count" style={{ color: streakColor }}>
                            {streak === null ? '…' : streak > 0 ? `${streak}d` : '0d'}
                        </span>
                    </div>
                    <div className="sidebar-xp-track">
                        {/* fill grows toward 30-day milestone */}
                        <div
                            className="sidebar-xp-fill"
                            style={{
                                width: `${Math.min(100, ((streak || 0) / 30) * 100)}%`,
                                background: streakColor,
                                transition: 'width 0.6s ease',
                            }}
                        />
                    </div>
                </div>
                <button
                    className="nav-item nav-item-logout"
                    onClick={() => navigate('/')}
                >
                    <span className="nav-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </span>
                    <span className="nav-label">Logout</span>
                </button>
            </div>
        </aside>
    )
}
