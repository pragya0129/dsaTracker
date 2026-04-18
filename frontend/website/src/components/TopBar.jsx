import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserName, getUserEmail, fetchDashboardData } from '../services/api'
import { useProfilePic } from '../utils/profilePic'

export default function Topbar({ title, subtitle }) {
    const navigate = useNavigate()
    const [streak, setStreak] = useState(null)   // null = loading
    const profilePic = useProfilePic()
    const name = getUserName() || getUserEmail() || ''
    const initial = name ? name[0].toUpperCase() : '?'
    const displayName = name.includes('@') ? name.split('@')[0] : name

    useEffect(() => {
        fetchDashboardData()
            .then(r => { if (r.success) setStreak(r.data?.currentStreak ?? 0) })
            .catch(() => setStreak(0))
    }, [])

    return (
        <header className="topbar">
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
                {/* Notification */}
                <button className="notif-btn" aria-label="Notifications">
                    🔔
                    <span className="notif-dot" />
                </button>
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
