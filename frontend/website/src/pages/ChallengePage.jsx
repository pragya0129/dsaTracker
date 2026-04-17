import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import * as api from '../services/api'

const MODES = {
    BEGINNER: {
        label: 'Beginner', color: '#22C55E', glow: 'rgba(34,197,94,.35)',
        bg: 'rgba(34,197,94,.06)', border: 'rgba(34,197,94,.25)',
        icon: '⚡', problems: '2 Easy + 1 Medium', time: '30 min',
        desc: 'Warm up your brain. Light problems, quick timer.',
        badge: 'Starter',
    },
    MEDIUM: {
        label: 'Medium', color: '#F59E0B', glow: 'rgba(245,158,11,.35)',
        bg: 'rgba(245,158,11,.06)', border: 'rgba(245,158,11,.25)',
        icon: '🔥', problems: '1 Easy + 3 Medium + 1 Hard', time: '45 min',
        desc: 'A well-balanced fight. Strategy meets skill.',
        badge: 'Balanced',
    },
    HARD: {
        label: 'Hard', color: '#EF4444', glow: 'rgba(239,68,68,.35)',
        bg: 'rgba(239,68,68,.06)', border: 'rgba(239,68,68,.25)',
        icon: '💀', problems: '2 Medium + 3 Hard', time: '60 min',
        desc: 'No mercy. Only the top coders survive.',
        badge: 'Elite',
    },
}

const STATUS_META = {
    PENDING:   { color: '#F59E0B', bg: 'rgba(245,158,11,.12)',  label: 'Pending',  dot: '⏳' },
    ACTIVE:    { color: '#22C55E', bg: 'rgba(34,197,94,.12)',   label: 'Live',     dot: '🟢' },
    COMPLETED: { color: '#6366F1', bg: 'rgba(99,102,241,.12)',  label: 'Done',     dot: '✅' },
    EXPIRED:   { color: '#64748B', bg: 'rgba(100,116,139,.12)', label: 'Expired',  dot: '💤' },
    DECLINED:  { color: '#EF4444', bg: 'rgba(239,68,68,.12)',   label: 'Declined', dot: '❌' },
}

function StatusPill({ status }) {
    const m = STATUS_META[status] || { color: '#94A3B8', bg: 'rgba(148,163,184,.1)', label: status, dot: '•' }
    return (
        <span style={{
            fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: m.bg, color: m.color, border: `1px solid ${m.color}40`,
            display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
            {m.dot} {m.label}
        </span>
    )
}

function Avatar({ name, size = 36, color = '#6366F1' }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${color}, ${color}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.38, fontWeight: 800, color: '#fff',
            boxShadow: `0 0 0 2px rgba(0,0,0,.4), 0 0 12px ${color}40`,
        }}>
            {(name || '?')[0].toUpperCase()}
        </div>
    )
}

export default function ChallengePage() {
    const navigate = useNavigate()
    const [tab, setTab] = useState('create')
    const [mode, setMode] = useState('BEGINNER')
    const [opponentEmail, setOpponentEmail] = useState('')
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')
    const [createSuccess, setCreateSuccess] = useState(null)
    const [myChallenges, setMyChallenges] = useState([])
    const [invitations, setInvitations] = useState([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(null)
    const [stats, setStats] = useState({ wins: 0, losses: 0, pending: 0, total: 0 })
    const myEmail = api.getUserEmail()

    useEffect(() => {
        if (!api.isAuthenticated()) { navigate('/login'); return }
        loadData()
    }, [tab])

    useEffect(() => {
        if (!api.isAuthenticated()) return
        api.fetchMyChallenges().then(r => { if (r.success) computeStats(r.data) })
    }, [])

    function computeStats(challenges) {
        const wins = challenges.filter(c => c.winnerId === myEmail).length
        const losses = challenges.filter(c => c.winnerId && c.winnerId !== myEmail && c.status === 'COMPLETED').length
        const pending = challenges.filter(c => c.status === 'PENDING' || c.status === 'ACTIVE').length
        setStats({ wins, losses, pending, total: challenges.length })
    }

    async function loadData() {
        setLoading(true)
        if (tab === 'mine') {
            const r = await api.fetchMyChallenges()
            if (r.success) { setMyChallenges(r.data); computeStats(r.data) }
        } else if (tab === 'invitations') {
            const r = await api.fetchInvitations()
            if (r.success) setInvitations(r.data)
        }
        setLoading(false)
    }

    async function handleCreate(e) {
        e.preventDefault()
        if (!opponentEmail.trim()) return
        setCreating(true); setCreateError(''); setCreateSuccess(null)
        const r = await api.createChallenge(opponentEmail.trim(), mode)
        if (r.success) { setCreateSuccess(r.data); setOpponentEmail('') }
        else setCreateError(r.error)
        setCreating(false)
    }

    async function handleAccept(id) {
        setActionLoading(id + '-accept')
        const r = await api.acceptChallenge(id)
        if (r.success) navigate(`/contest/${id}`)
        setActionLoading(null)
    }

    async function handleDecline(id) {
        setActionLoading(id + '-decline')
        await api.declineChallenge(id)
        await loadData()
        setActionLoading(null)
    }

    const pendingInvites = invitations.length

    return (
        <div className="app-shell" style={{ background: 'linear-gradient(135deg,#060818 0%,#0b1029 50%,#06091a 100%)' }}>
            <div style={{ position: 'fixed', top: -200, right: -100, width: 600, height: 600, background: 'radial-gradient(circle,rgba(99,102,241,.08) 0%,transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: -200, left: 200, width: 500, height: 500, background: 'radial-gradient(circle,rgba(139,92,246,.06) 0%,transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
            <Sidebar />
            <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
                <Topbar title="Challenges" subtitle="1v1 coding duels" />
                <main className="page-content">

                    {/* ── STAT STRIP ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
                        {[
                            { label: 'Wins', value: stats.wins, color: '#22C55E', icon: '🏆' },
                            { label: 'Losses', value: stats.losses, color: '#EF4444', icon: '😔' },
                            { label: 'Active', value: stats.pending, color: '#F59E0B', icon: '⚔️' },
                            { label: 'Total', value: stats.total, color: '#6366F1', icon: '📊' },
                        ].map(s => (
                            <div key={s.label} style={{
                                background: `${s.color}08`, border: `1px solid ${s.color}20`,
                                borderRadius: 14, padding: '14px 18px',
                                display: 'flex', alignItems: 'center', gap: 14,
                                backdropFilter: 'blur(20px)',
                            }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, border: `1px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{s.icon}</div>
                                <div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── TAB BAR ── */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 22, background: 'rgba(255,255,255,.03)', padding: 5, borderRadius: 14, border: '1px solid rgba(255,255,255,.06)', width: 'fit-content' }}>
                        {[
                            { k: 'create', label: '⚔️ New Challenge' },
                            { k: 'mine', label: '📋 My Challenges' },
                            { k: 'invitations', label: `📬 Invitations${pendingInvites > 0 ? ` (${pendingInvites})` : ''}` },
                        ].map(({ k, label }) => (
                            <button key={k} onClick={() => setTab(k)} style={{
                                padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: 12.5,
                                cursor: 'pointer', border: 'none', transition: 'all .2s',
                                background: tab === k ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'transparent',
                                color: tab === k ? '#fff' : '#64748B',
                                boxShadow: tab === k ? '0 4px 14px rgba(99,102,241,.4)' : 'none',
                            }}>{label}</button>
                        ))}
                    </div>

                    {/* ══ CREATE TAB ══ */}
                    {tab === 'create' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: 20, alignItems: 'start' }}>
                            {/* Left: Form */}
                            <div style={{ background: 'rgba(255,255,255,.026)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 22 }}>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Challenge Someone</div>
                                    <div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.6 }}>Pick a mode, enter your opponent's email, and fire away. They'll get an invitation instantly.</div>
                                </div>

                                {createError && (
                                    <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 16 }}>⚠️</span>
                                        <span style={{ fontSize: 12.5, color: '#EF4444' }}>{createError}</span>
                                    </div>
                                )}

                                {createSuccess && (
                                    <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 14, padding: '16px 18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                            <span style={{ fontSize: 20 }}>✅</span>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#22C55E' }}>Challenge Sent!</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 12 }}>
                                            Challenge <strong style={{ color: '#F1F5F9' }}>#{createSuccess.id}</strong> sent to <strong style={{ color: '#F1F5F9' }}>{createSuccess.opponentName}</strong>. Waiting for them to accept.
                                        </div>
                                        <button onClick={() => navigate(`/contest/${createSuccess.id}`)} style={{ background: 'rgba(99,102,241,.2)', border: '1px solid rgba(99,102,241,.4)', color: '#818CF8', padding: '7px 16px', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                            View Challenge →
                                        </button>
                                    </div>
                                )}

                                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Opponent's Email</label>
                                        <div style={{ position: 'relative' }}>
                                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>✉️</span>
                                            <input
                                                value={opponentEmail}
                                                onChange={e => setOpponentEmail(e.target.value)}
                                                placeholder="friend@example.com"
                                                type="email" required
                                                style={{ width: '100%', padding: '12px 14px 12px 42px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#F1F5F9', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s' }}
                                                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,.6)'}
                                                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contest Mode</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {Object.entries(MODES).map(([k, v]) => {
                                                const sel = mode === k
                                                return (
                                                    <div key={k} onClick={() => setMode(k)} style={{
                                                        borderRadius: 13, padding: '14px 16px', cursor: 'pointer',
                                                        border: `1px solid ${sel ? v.border : 'rgba(255,255,255,.06)'}`,
                                                        background: sel ? v.bg : 'rgba(255,255,255,.02)',
                                                        transition: 'all .2s',
                                                        boxShadow: sel ? `0 0 20px ${v.glow}` : 'none',
                                                        display: 'flex', alignItems: 'center', gap: 14,
                                                    }}>
                                                        <div style={{ width: 38, height: 38, borderRadius: 9, background: sel ? `${v.color}20` : 'rgba(255,255,255,.04)', border: `1px solid ${sel ? v.border : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all .2s' }}>
                                                            {v.icon}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                                <span style={{ fontSize: 13.5, fontWeight: 700, color: sel ? v.color : '#F1F5F9' }}>{v.label}</span>
                                                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: `${v.color}15`, color: v.color, border: `1px solid ${v.color}30` }}>{v.badge}</span>
                                                            </div>
                                                            <div style={{ fontSize: 11, color: '#64748B' }}>{v.problems} · {v.time}</div>
                                                        </div>
                                                        <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${sel ? v.color : 'rgba(255,255,255,.15)'}`, background: sel ? v.color : 'transparent', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {sel && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <button type="submit" disabled={creating} style={{
                                        background: creating ? 'rgba(99,102,241,.3)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                                        color: '#fff', border: 'none', padding: '14px', borderRadius: 13,
                                        fontWeight: 800, fontSize: 14, cursor: creating ? 'not-allowed' : 'pointer',
                                        boxShadow: creating ? 'none' : '0 6px 20px rgba(99,102,241,.5)',
                                        transition: 'all .25s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    }}>
                                        {creating ? (
                                            <>
                                                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
                                                Sending…
                                            </>
                                        ) : '⚔️ Send Challenge'}
                                    </button>
                                </form>
                            </div>

                            {/* Right: Mode cards + How it works */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {Object.entries(MODES).map(([k, v]) => (
                                    <div key={k} onClick={() => setMode(k)} style={{
                                        background: v.bg, border: `1px solid ${v.border}`,
                                        borderRadius: 16, padding: '18px 20px', cursor: 'pointer',
                                        transition: 'all .2s', backdropFilter: 'blur(16px)',
                                        boxShadow: mode === k ? `0 0 30px ${v.glow}` : 'none',
                                        transform: mode === k ? 'scale(1.01)' : 'scale(1)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 11, background: `${v.color}15`, border: `1px solid ${v.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{v.icon}</div>
                                            <div>
                                                <div style={{ fontSize: 15, fontWeight: 800, color: v.color }}>{v.label} Mode</div>
                                                <div style={{ fontSize: 11, color: '#64748B' }}>{v.time} · {v.badge}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12.5, color: '#94A3B8', lineHeight: 1.6, marginBottom: 10 }}>{v.desc}</div>
                                        <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,.2)', borderRadius: 8, fontSize: 11.5, color: '#64748B', fontFamily: 'monospace, monospace' }}>{v.problems}</div>
                                    </div>
                                ))}
                                <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: '18px 20px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 12 }}>ℹ️ How challenges work</div>
                                    {[
                                        ['1', 'Send a challenge to any registered user by email'],
                                        ['2', 'Opponent accepts → contest clock starts immediately'],
                                        ['3', 'Solve problems directly on LeetCode during the timer'],
                                        ['4', 'Most problems solved wins · Tiebreak: fastest total time'],
                                        ['5', 'Backend enforces all rules — no frontend cheats possible'],
                                    ].map(([n, t]) => (
                                        <div key={n} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
                                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(99,102,241,.2)', border: '1px solid rgba(99,102,241,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#818CF8', flexShrink: 0, marginTop: 1 }}>{n}</div>
                                            <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>{t}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══ MY CHALLENGES TAB ══ */}
                    {tab === 'mine' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {loading && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 14, color: '#64748B' }}>
                                    <div style={{ width: 36, height: 36, border: '3px solid rgba(99,102,241,.2)', borderTop: '3px solid #6366F1', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                                    Loading challenges…
                                </div>
                            )}
                            {!loading && myChallenges.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '70px 20px' }}>
                                    <div style={{ fontSize: 56, marginBottom: 16 }}>⚔️</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No challenges yet</div>
                                    <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>Challenge a friend to see your history here.</div>
                                    <button onClick={() => setTab('create')} style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 11, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,.4)' }}>Create Challenge</button>
                                </div>
                            )}
                            {myChallenges.map(c => {
                                const cfg = MODES[c.contestType] || MODES.BEGINNER
                                const isChallenger = c.challengerId === myEmail
                                const opponent = isChallenger ? (c.opponentName || c.opponentId) : (c.challengerName || c.challengerId)
                                const role = isChallenger ? 'Challenger' : 'Opponent'
                                const iWon = c.winnerId === myEmail
                                const isActive = c.status === 'ACTIVE'
                                return (
                                    <div key={c.id} style={{
                                        background: 'rgba(255,255,255,.025)', backdropFilter: 'blur(20px)',
                                        border: `1px solid ${isActive ? 'rgba(34,197,94,.2)' : iWon ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.06)'}`,
                                        borderRadius: 16, padding: '18px 22px',
                                        display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap',
                                        transition: 'all .2s', cursor: 'pointer',
                                        boxShadow: isActive ? '0 0 20px rgba(34,197,94,.08)' : 'none',
                                    }}
                                        onClick={() => navigate(`/contest/${c.id}`)}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = `${cfg.color}40` }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = isActive ? 'rgba(34,197,94,.2)' : iWon ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.06)' }}
                                    >
                                        <div style={{ width: 46, height: 46, borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{cfg.icon}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 14, fontWeight: 800 }}>#{c.id} · {cfg.label} Mode</span>
                                                <StatusPill status={c.status} />
                                                <span style={{ fontSize: 10, color: '#64748B', background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 20 }}>{role}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Avatar name={opponent} size={22} color={cfg.color} />
                                                <span style={{ fontSize: 12.5, color: '#94A3B8' }}>vs <strong style={{ color: '#F1F5F9' }}>{opponent}</strong></span>
                                                <span style={{ fontSize: 11, color: '#475569' }}>· {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                                            {c.winnerId && (
                                                <div style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: iWon ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: iWon ? '#22C55E' : '#EF4444', border: `1px solid ${iWon ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}` }}>
                                                    {iWon ? '🏆 Won' : '😔 Lost'}
                                                </div>
                                            )}
                                            <div style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', color: '#818CF8', padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 12 }}>
                                                {isActive ? '▶ Join Live' : 'View →'}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* ══ INVITATIONS TAB ══ */}
                    {tab === 'invitations' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {loading && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 14, color: '#64748B' }}>
                                    <div style={{ width: 36, height: 36, border: '3px solid rgba(99,102,241,.2)', borderTop: '3px solid #6366F1', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                                </div>
                            )}
                            {!loading && invitations.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '70px 20px' }}>
                                    <div style={{ fontSize: 56, marginBottom: 16 }}>📬</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No pending invitations</div>
                                    <div style={{ fontSize: 13, color: '#64748B' }}>When someone challenges you, it will appear here.</div>
                                </div>
                            )}
                            {invitations.map(c => {
                                const cfg = MODES[c.contestType] || MODES.BEGINNER
                                const acc = actionLoading === c.id + '-accept'
                                const dec = actionLoading === c.id + '-decline'
                                return (
                                    <div key={c.id} style={{ background: cfg.bg, backdropFilter: 'blur(24px)', border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '22px 24px', boxShadow: `0 0 40px ${cfg.glow}` }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                <Avatar name={c.challengerName || c.challengerId} size={50} color={cfg.color} />
                                                <div>
                                                    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
                                                        <span style={{ color: cfg.color }}>{c.challengerName || c.challengerId}</span>
                                                        <span style={{ color: '#94A3B8', fontWeight: 400 }}> challenged you!</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                                        <div style={{ fontSize: 13, background: `${cfg.color}15`, color: cfg.color, padding: '3px 12px', borderRadius: 20, fontWeight: 700, border: `1px solid ${cfg.border}` }}>{cfg.icon} {cfg.label} Mode</div>
                                                        <span style={{ fontSize: 11, color: '#64748B' }}>{cfg.time}</span>
                                                    </div>
                                                    <div style={{ fontSize: 11.5, color: '#64748B', fontFamily: 'monospace, monospace' }}>{cfg.problems}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 11, color: '#475569' }}>
                                                Sent {new Date(c.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, marginTop: 18, borderTop: `1px solid ${cfg.border}`, paddingTop: 16 }}>
                                            <button onClick={() => handleDecline(c.id)} disabled={dec || acc} style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#EF4444', padding: '10px 20px', borderRadius: 11, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', opacity: (dec || acc) ? 0.5 : 1 }}>
                                                {dec ? '…' : '✕ Decline'}
                                            </button>
                                            <button onClick={() => handleAccept(c.id)} disabled={acc || dec} style={{ flex: 1, background: `linear-gradient(135deg,${cfg.color},${cfg.color}cc)`, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 11, fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: `0 4px 18px ${cfg.glow}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (acc || dec) ? 0.7 : 1 }}>
                                                {acc ? (<><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />Starting…</>) : '⚔️ Accept & Start Contest'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </main>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )
}
