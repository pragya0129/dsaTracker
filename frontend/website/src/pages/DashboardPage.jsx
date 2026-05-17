import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
    RadarChart, PolarGrid, PolarAngleAxis, Radar,
    ReferenceLine, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/TopBar'
import * as api from '../services/api'
import {
    computeTopicStats, detectWeakTopics, computeSkillRadar,
    computeEfficiency, computeConsistency, computeWeeklyGrowth,
    computeDailyTrend, computeContestReadiness,
    computeRecommendations, computePrediction, computePerformanceScore,
    computeDifficultyPace, computeMomentum,
    scoreLabel,
} from '../utils/analytics'

/* ─────────────────────────────── helpers ─────────────────────────────── */
function buildHeatmap(calMap) {
    const counts = {}
    if (calMap) {
        Object.entries(calMap).forEach(([ts, n]) => {
            const d = new Date(parseInt(ts) * 1000)
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            counts[k] = (counts[k] || 0) + n
        })
    }
    const today = new Date()
    const days = []
    for (let i = 111; i >= 0; i--) {
        const d = new Date()
        d.setDate(today.getDate() - i)
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        days.push({ date: d, count: counts[k] || 0 })
    }
    return days
}

/* ── tooltip ── */
const TT = ({ active, payload, label }) =>
    active && payload?.length ? (
        <div style={{ background: 'rgba(8,12,30,.98)', border: '1px solid rgba(229,166,83,.3)', borderRadius: 10, padding: '9px 14px', backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9' }}>
                {payload[0].value}
                <span style={{ fontSize: 10, color: '#64748B', marginLeft: 5, fontWeight: 500 }}>{payload[0].name}</span>
            </div>
        </div>
    ) : null

/* ── shared card style ── */
const CARD = {
    background: 'rgba(255,255,255,0.026)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.068)',
    boxShadow: '0 4px 32px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.04)',
    borderRadius: 18,
    padding: 22,
}

const HM_COLORS = ['rgba(255,255,255,0.04)', 'rgba(229,166,83,0.22)', 'rgba(229,166,83,0.48)', 'rgba(229,166,83,0.76)', '#E5A653']
const P_COLOR = { high: '#EF4444', medium: '#F59E0B', low: '#22C55E' }
const PMETA = {
    leetcode: { label: 'LeetCode', color: '#FFA116', icon: '🟡' },
    codeforces: { label: 'Codeforces', color: '#1890FF', icon: '🔵' },
}

/* ── reusable UI components ── */
function Section({ title, sub, right, accent, children }) {
    return (
        <div style={{ ...CARD, borderColor: accent ? `${accent}22` : 'rgba(255,255,255,0.068)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</div>
                    {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
                </div>
                {right}
            </div>
            {children}
        </div>
    )
}

function Pill({ label, color, size = 11 }) {
    return (
        <span style={{ fontSize: size, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${color}1e`, color, border: `1px solid ${color}35`, whiteSpace: 'nowrap' }}>
            {label}
        </span>
    )
}

function Ring({ value, max = 100, size = 120, stroke = 9, color = '#E5A653', sublabel }) {
    const r = (size - stroke * 2) / 2
    const circ = 2 * Math.PI * r
    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - value / max)}
                    style={{ filter: `drop-shadow(0 0 8px ${color}70)`, transition: 'stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: size * 0.22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
                {sublabel && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div>}
            </div>
        </div>
    )
}

function StatRow({ label, value, color }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: `${color}0b`, borderRadius: 9, border: `1px solid ${color}1f` }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color }}>{value}</span>
        </div>
    )
}

function MiniBar({ pct, color }) {
    return (
        <div style={{ height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 4, overflow: 'hidden', marginTop: 8 }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width 1.3s cubic-bezier(.4,0,.2,1)', boxShadow: `0 0 8px ${color}55` }} />
        </div>
    )
}

function Trend({ val }) {
    if (val === undefined || val === null) return null
    const up = val >= 0
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: up ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: up ? '#22C55E' : '#EF4444' }}>
            {up ? '▲' : '▼'} {Math.abs(val)}
        </span>
    )
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
export default function DashboardPage() {
    const navigate = useNavigate()
    const [dash, setDash] = useState(null)
    // Start loading=false when the cache already has a dashboard entry —
    // we can hydrate from localStorage in the first paint and skip the spinner.
    const [loading, setLoading] = useState(() => api.getCacheTimestamp('dashboard') == null)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState(null)
    const [hm, setHm] = useState([])
    const [subs, setSubs] = useState([])
    const [fade, setFade] = useState(false)
    const [lastSynced, setLastSynced] = useState(api.getLastSyncedAt())

    useEffect(() => {
        if (!api.isAuthenticated()) { navigate('/login'); return }
        // Load from cache (or network if cache is empty). We no longer auto-
        // refresh on an interval — data only re-fetches when the user clicks
        // Sync, which is the explicit contract we want.
        load({ force: false })
    }, [])

    /**
     * Load dashboard data.
     *   force=false → cache-first (instant if data is already stored)
     *   force=true  → bypass cache, hit the network, refresh cache
     * Only shows the loading spinner when there is literally nothing to show.
     */
    async function load({ force = false } = {}) {
        const hadCache = api.getCacheTimestamp('dashboard') != null
        if (!hadCache) setLoading(true)
        setError(null)

        const opts = force ? { forceRefresh: true } : undefined
        const r = await api.fetchDashboardData(opts)
        if (r.success) {
            setDash(r.data)
            const cal = await api.fetchCalendarData(opts)
            setHm(buildHeatmap(cal.success ? cal.data : {}))
            const lc = r.data.linkedPlatforms?.find(p => p.platform === 'leetcode')
            if (lc) {
                const rec = await api.fetchLeetCodeSubmissions(lc.username, opts)
                if (rec.success) setSubs(rec.data)
            } else {
                setSubs([])
            }
        } else {
            setError(r.error)
        }
        setLoading(false)
        setLastSynced(api.getLastSyncedAt())
        setTimeout(() => setFade(true), 60)
    }

    async function handleSync() {
        setSyncing(true)
        try {
            await api.syncAllPlatforms()   // hits server + invalidates local cache
            await load({ force: true })    // refills cache with fresh data
        } finally {
            setSyncing(false)
        }
    }

    // "2m ago" / "just now" helper for the Sync chip.
    function syncedLabel(ts) {
        if (!ts) return 'never synced'
        const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
        if (s < 30)     return 'just now'
        if (s < 60)     return `${s}s ago`
        if (s < 3600)   return `${Math.floor(s / 60)}m ago`
        if (s < 86400)  return `${Math.floor(s / 3600)}h ago`
        return `${Math.floor(s / 86400)}d ago`
    }

    // Re-render the "X ago" label every 30 seconds so it stays honest while the
    // user is looking at the dashboard — still without firing any network calls.
    useEffect(() => {
        const id = setInterval(() => setLastSynced(api.getLastSyncedAt()), 30_000)
        return () => clearInterval(id)
    }, [])

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

    /* ── derive all analytics ── */
    const totalSolved = dash?.totalSolved || 0
    const easySolved = dash?.easySolved || 0
    const mediumSolved = dash?.mediumSolved || 0
    const hardSolved = dash?.hardSolved || 0
    const linked = dash?.linkedPlatforms || []
    const platforms = dash?.platforms || []
    const rawTopics = dash?.topics || []

    // Build topic stats from real API data — count = accepted problems per tag
    const topicStats = computeTopicStats(rawTopics, totalSolved)

    // All analytics computed from actual available data
    const weakTopics = detectWeakTopics(topicStats, totalSolved)
    const radarData = computeSkillRadar(topicStats, totalSolved)
    const efficiency = computeEfficiency(subs)
    const consistency = computeConsistency(hm)
    const weekly = computeWeeklyGrowth(hm, 16)
    const dailyTrend = computeDailyTrend(hm, 30)
    const momentum = computeMomentum(hm)
    const pace = computeDifficultyPace(easySolved, mediumSolved, hardSolved, hm)

    // Submission-derived metrics (only titleSlug + statusDisplay + timestamp available)
    const accepted = subs.filter(s => s.statusDisplay === 'Accepted').length
    const accRate = subs.length ? Math.round((accepted / subs.length) * 100) : 0
    const activeWeeks = weekly.filter(w => w.solved > 0).length
    const bestWeek = Math.max(...weekly.map(w => w.solved), 0)
    const avgPerWeek = activeWeeks ? (totalSolved / activeWeeks).toFixed(1) : '0'
    const avgWeekSolved = weekly.length
        ? +(weekly.reduce((a, w) => a + w.solved, 0) / weekly.length).toFixed(1)
        : 0

    const recommendation = computeRecommendations({ weakTopics, topicStats, totalSolved, mediumSolved, hardSolved, easySolved })
    const contest = computeContestReadiness({
        totalSolved, mediumSolved, hardSolved, easySolved,
        effiScore: efficiency.score,
        consistencyScore: consistency.score,
        topicStats,
    })
    const prediction = computePrediction({ heatmapData: hm, totalSolved })
    const perfScore = computePerformanceScore({
        totalSolved,
        longestStreak: consistency.longestStreak,
        acceptanceRate: accRate,
        activeWeeks,
        hardSolved,
        effiScore: efficiency.score,
    })
    const { label: rankLabel, color: rankColor } = scoreLabel(perfScore)

    const diffData = [
        { name: 'Easy', value: easySolved, color: '#22C55E' },
        { name: 'Medium', value: mediumSolved, color: '#F59E0B' },
        { name: 'Hard', value: hardSolved, color: '#EF4444' },
    ]

    /* ── empty state ── */
    if (!loading && linked.length === 0) return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <Topbar title="Dashboard" subtitle={today} />
                <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', maxWidth: 460, padding: 48, background: 'linear-gradient(135deg,rgba(229,166,83,.1),rgba(159,143,227,.04))', border: '1px solid rgba(229,166,83,.2)', borderRadius: 24 }}>
                        <div style={{ fontSize: 60, marginBottom: 16 }}>🚀</div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Welcome to AlgoSprint</h2>
                        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>Link your coding platforms to unlock your performance intelligence dashboard.</p>
                        <button
                            onClick={() => navigate('/onboarding')}
                            style={{ display: 'inline-block', background: 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: '#fff', padding: '12px 28px', borderRadius: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 15 }}
                        >
                            Get Started →
                        </button>
                    </div>
                </main>
            </div>
        </div>
    )

    return (
        <div className="app-shell" style={{ background: 'linear-gradient(140deg, #0B0F1A 0%, #121727 50%, #0B0F1A 100%)' }}>
            <div style={{ position: 'fixed', top: -220, right: -180, width: 560, height: 560, background: `radial-gradient(circle, ${rankColor}0d, transparent 65%)`, borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
            <div style={{ position: 'fixed', bottom: -180, left: -60, width: 480, height: 480, background: 'radial-gradient(circle, rgba(229,166,83,0.06), transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />

            <Sidebar />
            <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
                <Topbar title="Dashboard" subtitle={today} />
                <main className="page-content" style={{ opacity: fade ? 1 : 0, transition: 'opacity .5s' }}>

                    {error && (
                        <div style={{ background: 'var(--danger-light)', border: '1px dashed rgba(216,139,168,0.35)', borderRadius: 'var(--radius-md)', padding: '11px 16px', marginBottom: 16, color: 'var(--rose)', fontSize: 13, fontWeight: 600 }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {loading && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 120, gap: 14 }}>
                            <div style={{ width: 42, height: 42, border: '3px solid rgba(229,166,83,0.18)', borderTop: '3px solid var(--amber)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                            <div className="accent-hand" style={{ color: 'var(--amber)', fontSize: 16 }}>computing your analytics…</div>
                        </div>
                    )}

                    {!loading && dash && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

                            {/* ══ HERO ══ */}
                            <div style={{ ...CARD, background: 'linear-gradient(135deg, rgba(229,166,83,0.08), rgba(216,139,168,0.05))', position: 'relative', overflow: 'hidden', borderColor: `${rankColor}1f` }}>
                                <div style={{ position: 'absolute', top: -100, right: -100, width: 280, height: 280, background: `radial-gradient(circle,${rankColor}12,transparent 70%)`, borderRadius: '50%', pointerEvents: 'none' }} />
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
                                    <div style={{ flex: 1, minWidth: 260 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                                            <h2 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>
                                                {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'} 👋
                                            </h2>
                                            <Pill label={`${rankLabel} · ${perfScore}/100`} color={rankColor} size={11} />
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
                                            {consistency.currentStreak > 0
                                                ? <><strong style={{ color: '#F59E0B' }}>{consistency.currentStreak}-day streak</strong> 🔥 · Best: <strong style={{ color: '#9F8FE3' }}>{consistency.longestStreak}d</strong> · {totalSolved} problems solved</>
                                                : `${totalSolved} problems solved. ${recommendation[0]?.action || 'Keep grinding!'}`}
                                        </p>
                                        {/* rank progress bar */}
                                        {(() => {
                                            const tiers = [{ min: 0, max: 30, next: 'Beginner', c: '#F59E0B' }, { min: 30, max: 50, next: 'Intermediate', c: '#22C55E' }, { min: 50, max: 70, next: 'Advanced', c: '#38BDF8' }, { min: 70, max: 85, next: 'Elite', c: '#A855F7' }]
                                            const tier = tiers.find(t => perfScore >= t.min && perfScore < t.max)
                                            if (!tier) return null
                                            const pct = ((perfScore - tier.min) / (tier.max - tier.min)) * 100
                                            return (
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Progress to <span style={{ color: tier.c, fontWeight: 700 }}>{tier.next}</span></span>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{perfScore}/{tier.max}</span>
                                                    </div>
                                                    <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 6, overflow: 'hidden', maxWidth: 320 }}>
                                                        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${rankColor},${tier.c})`, borderRadius: 6, transition: 'width 1.3s ease', boxShadow: `0 0 10px ${tier.c}50` }} />
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        {linked.map(p => { const m = PMETA[p.platform] || {}; return (<span key={p.platform} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, fontWeight: 600, background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}2e` }}>{m.icon} @{p.username}</span>) })}
                                        <span
                                            title={lastSynced ? new Date(lastSynced).toLocaleString() : 'Not synced yet'}
                                            style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', opacity: 0.85, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(15,23,42,.5)', border: '1px dashed rgba(229,166,83,.22)', borderRadius: 10, letterSpacing: '.02em' }}>
                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: lastSynced ? '#22C55E' : '#64748B', boxShadow: lastSynced ? '0 0 6px rgba(34,197,94,.55)' : 'none' }} />
                                            synced&nbsp;<span style={{ color: 'var(--text)' }}>{syncedLabel(lastSynced)}</span>
                                        </span>
                                        <button
                                            onClick={handleSync}
                                            disabled={syncing}
                                            style={{ background: syncing ? 'rgba(229,166,83,.12)' : 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: syncing ? '#9F8FE3' : '#fff', border: '1px solid rgba(229,166,83,.28)', padding: '9px 18px', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .25s' }}>
                                            {syncing ? '⏳ Syncing…' : '↻ Sync'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ══ KPI CARDS ══ */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 13 }}>
                                {[
                                    { icon: '✅', val: totalSolved, lbl: 'Total Solved', sub: `${easySolved}E · ${mediumSolved}M · ${hardSolved}H`, color: '#E5A653', pct: Math.min((totalSolved / 300) * 100, 100), trend: momentum.delta },
                                    { icon: '🎯', val: `${accRate}%`, lbl: 'Acceptance Rate', sub: `${accepted} accepted of ${subs.length} recent`, color: '#22C55E', pct: accRate },
                                    { icon: '⚡', val: efficiency.score, lbl: 'Efficiency Score', sub: `${efficiency.firstAttemptRate}% first-try (${efficiency.sampleSize} recent)`, color: '#38BDF8', pct: efficiency.score },
                                    { icon: '📅', val: consistency.score, lbl: 'Consistency', sub: `${consistency.activeDays} active / last 30 days`, color: '#9F8FE3', pct: consistency.score },
                                    { icon: '📈', val: avgPerWeek, lbl: 'Avg / Week', sub: `Best: ${bestWeek} · This week: ${momentum.thisWeek}`, color: '#F59E0B', pct: bestWeek ? (momentum.thisWeek / bestWeek) * 100 : 0, trend: momentum.delta },
                                ].map((s, i) => (
                                    <div key={i}
                                        style={{ ...CARD, padding: '18px 18px 16px', cursor: 'default', border: `1px solid ${s.color}1f`, transition: 'all .25s', position: 'relative', overflow: 'hidden' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.color}50`; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,.35), 0 0 0 1px ${s.color}20` }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = `${s.color}1f`; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = CARD.boxShadow }}>
                                        <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, borderRadius: '50%', background: s.color, opacity: .06, filter: 'blur(20px)', pointerEvents: 'none' }} />
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <div style={{ fontSize: 18 }}>{s.icon}</div>
                                            {s.trend !== undefined && <Trend val={s.trend} />}
                                        </div>
                                        <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.val}</div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(148,163,184,.7)', marginTop: 5 }}>{s.lbl}</div>
                                        <div style={{ fontSize: 10, color: 'rgba(100,116,139,.65)', marginTop: 3 }}>{s.sub}</div>
                                        <MiniBar pct={s.pct} color={s.color} />
                                    </div>
                                ))}
                            </div>

                            {/* ══ DIFFICULTY PACE (replaces "avg solve time" which had no real data) ══ */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13 }}>
                                {[
                                    { d: 'Easy', c: '#22C55E', perWeek: pace.easyPerWeek, pct: pace.easyPct, icon: '🟢', hint: 'problems solved per active week' },
                                    { d: 'Medium', c: '#F59E0B', perWeek: pace.medPerWeek, pct: pace.medPct, icon: '🟡', hint: 'problems solved per active week' },
                                    { d: 'Hard', c: '#EF4444', perWeek: pace.hardPerWeek, pct: pace.hardPct, icon: '🔴', hint: 'problems solved per active week' },
                                ].map(({ d, c, perWeek, pct, icon, hint }) => {
                                    const quality = d === 'Hard' && perWeek >= 1 ? { label: 'Strong', color: '#22C55E' }
                                        : d === 'Medium' && perWeek >= 2 ? { label: 'On track', color: '#22C55E' }
                                            : perWeek === 0 ? { label: 'None', color: '#64748B' }
                                                : null
                                    return (
                                        <div key={d} style={{ ...CARD, padding: '16px 20px', border: `1px solid ${c}1f` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{d} Pace</div>
                                                    <div style={{ fontSize: 24, fontWeight: 900, color: c, letterSpacing: '-0.02em' }}>{perWeek}<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 4 }}>/wk</span></div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                                    <div style={{ fontSize: 20 }}>{icon}</div>
                                                    {quality && <Pill label={quality.label} color={quality.color} size={9} />}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{pct}% of your total solved</div>
                                            <MiniBar pct={pct} color={c} />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* ══ WEAK TOPIC DETECTION ══ */}
                            <Section
                                title="⚠️ Weak Topic Detection"
                                sub="Topics where your coverage is critically low, below your own average, or underrepresented for interview prep"
                                right={weakTopics.length > 0 && <Pill label={`${weakTopics.length} flagged`} color="#EF4444" size={10} />}>
                                {weakTopics.length === 0
                                    ? <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: 13 }}>🎉 Solid coverage across all your topics!</div>
                                    : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                                        {weakTopics.map((t, i) => (
                                            <div key={i} style={{ background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.16)', borderRadius: 14, padding: 18 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(239,68,68,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#EF4444' }}>#{i + 1}</div>
                                                        <span style={{ fontSize: 13, fontWeight: 700 }}>{t.topic}</span>
                                                        {t.isHighPriority && <Pill label="Core" color="#F59E0B" size={9} />}
                                                    </div>
                                                    <span style={{ fontSize: 18, fontWeight: 900, color: '#EF4444' }}>{t.count}</span>
                                                </div>
                                                {/* Why it's flagged */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                                                    {t.reasons.slice(0, 2).map((r, j) => (
                                                        <div key={j} style={{ fontSize: 11, color: '#F87171', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                                                            <span style={{ flexShrink: 0 }}>·</span>{r}
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* Progress to target */}
                                                <div style={{ marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.count} solved</span>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>target: {t.target}</span>
                                                    </div>
                                                    <div style={{ height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 4, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${Math.min((t.count / t.target) * 100, 100)}%`, background: '#EF4444', borderRadius: 4, transition: 'width 1.2s ease' }} />
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 11, color: '#F87171', fontWeight: 600 }}>
                                                    💡 Solve {t.needed} more to reach target coverage
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                }
                            </Section>

                            {/* ══ SKILL RADAR + EFFICIENCY ══ */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                                <Section
                                    title="Skill Radar"
                                    sub="Depth score per topic: 0–60 pts for volume (20+ problems = cap), 0–40 pts relative to your strongest topic">
                                    <ResponsiveContainer width="100%" height={240}>
                                        <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                                            <PolarGrid stroke="rgba(229,166,83,.1)" />
                                            <PolarAngleAxis dataKey="topic" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                                            <Radar name="Score" dataKey="score" stroke="#E5A653" fill="#E5A653" fillOpacity={0.4} />
                                            <Tooltip content={<TT />} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginTop: 8 }}>
                                        {radarData.slice(0, 5).map(d => (
                                            <div key={d.topic} style={{ textAlign: 'center', background: 'rgba(229,166,83,.06)', borderRadius: 8, padding: '7px 4px', border: '1px solid rgba(229,166,83,.1)' }}>
                                                <div style={{ fontSize: 14, fontWeight: 900, color: d.score >= 60 ? '#E5A653' : d.score >= 30 ? '#F59E0B' : '#64748B' }}>{d.score}</div>
                                                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{d.topic.split(' ').map(w => w[0]).join('')}</div>
                                                <div style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.7 }}>{d.count} solved</div>
                                            </div>
                                        ))}
                                    </div>
                                </Section>

                                <Section
                                    title="Problem Solving Efficiency"
                                    sub={`Based on ${efficiency.sampleSize} recent submissions — first-try success, retry rate, wrong submission ratio`}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                        <Ring value={efficiency.score} size={130} stroke={9} color="#38BDF8" sublabel="/ 100" />
                                        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            {[
                                                ['First-Try Rate', `${efficiency.firstAttemptRate}%`, '#22C55E'],
                                                ['Avg Retries', `${efficiency.avgRetries}x`, '#F59E0B'],
                                                ['Wrong Ratio', `${efficiency.wrongRatio}%`, '#EF4444'],
                                                ['Unique Problems', `${efficiency.totalUnique}`, '#E5A653'],
                                            ].map(([l, v, c]) => (
                                                <div key={l} style={{ background: `${c}0d`, border: `1px solid ${c}22`, borderRadius: 10, padding: '10px 12px' }}>
                                                    <div style={{ fontSize: 18, fontWeight: 900, color: c, letterSpacing: '-0.02em' }}>{v}</div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Section>
                            </div>

                            {/* ══ CONSISTENCY + HEATMAP ══ */}
                            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16 }}>
                                <Section title="Consistency" sub="Computed from active days, inactivity gaps, and current streak">
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                        <Ring value={consistency.score} size={120} stroke={9} color="#9F8FE3" sublabel="/ 100" />
                                        {[
                                            ['Active / 30 Days', `${consistency.activeDays}`, '#22C55E'],
                                            ['Current Streak', `${consistency.currentStreak}d`, '#F59E0B'],
                                            ['Longest Streak', `${consistency.longestStreak}d`, '#38BDF8'],
                                            ['Max Inactivity', `${consistency.inactivityGap}d`, '#EF4444'],
                                        ].map(([l, v, c]) => <StatRow key={l} label={l} value={v} color={c} />)}
                                    </div>
                                </Section>

                                <Section
                                    title="Activity Heatmap"
                                    sub={`16 weeks — ${consistency.activeDays} active days in last 30`}
                                    right={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Less</span>
                                            {HM_COLORS.map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />)}
                                            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>More</span>
                                        </div>
                                    }>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16,1fr)', gridTemplateRows: 'repeat(7,1fr)', gap: 3, gridAutoFlow: 'column', minHeight: 100 }}>
                                        {hm.map((d, i) => {
                                            const lv = Math.min(d.count, 4)
                                            return (
                                                <div key={i}
                                                    title={`${d.date.toLocaleDateString()}: ${d.count} submission${d.count !== 1 ? 's' : ''}`}
                                                    style={{ background: HM_COLORS[lv], borderRadius: 3, minWidth: 10, minHeight: 10, transition: 'transform .15s', boxShadow: lv >= 3 ? `0 0 5px ${HM_COLORS[lv]}` : 'none', cursor: 'default' }}
                                                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.5)'; e.currentTarget.style.zIndex = 9 }}
                                                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 'auto' }} />
                                            )
                                        })}
                                    </div>
                                </Section>
                            </div>

                            {/* ══ GROWTH CHARTS ══ */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
                                <Section
                                    title="Weekly Growth"
                                    sub="Problems solved per week · last 16 weeks · dashed line = weekly average"
                                    right={
                                        <div style={{ display: 'flex', gap: 18 }}>
                                            {[['Best', bestWeek, '#E5A653'], ['Avg', avgWeekSolved, '#38BDF8'], ['This wk', momentum.thisWeek, momentum.delta >= 0 ? '#22C55E' : '#EF4444']].map(([l, v, c]) => (
                                                <div key={l} style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
                                                    <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{v}</div>
                                                </div>
                                            ))}
                                        </div>
                                    }>
                                    <ResponsiveContainer width="100%" height={160}>
                                        <BarChart data={weekly} barCategoryGap="28%">
                                            <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={3} />
                                            <YAxis hide />
                                            <Tooltip content={<TT />} />
                                            <ReferenceLine y={avgWeekSolved} stroke="rgba(229,166,83,.35)" strokeDasharray="4 3" />
                                            <Bar dataKey="solved" name="solved" radius={[5, 5, 0, 0]}>
                                                {weekly.map((w, i) => (
                                                    <Cell key={i} fill={
                                                        w.solved === bestWeek ? '#E5A653'
                                                            : w.solved >= avgWeekSolved ? 'rgba(229,166,83,.55)'
                                                                : 'rgba(229,166,83,.28)'
                                                    } />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Section>

                                <Section title="30-Day Activity" sub="Daily submission count">
                                    <ResponsiveContainer width="100%" height={160}>
                                        <AreaChart data={dailyTrend}>
                                            <defs>
                                                <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.28} />
                                                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="day" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} interval={7} />
                                            <YAxis hide />
                                            <Tooltip content={<TT />} />
                                            <Area type="monotone" dataKey="count" name="submissions" stroke="#38BDF8" strokeWidth={2} fill="url(#ag)" dot={false} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Section>
                            </div>

                            {/* ══ RECOMMENDATIONS ══ */}
                            <Section
                                title="🧠 Smart Recommendations"
                                sub="Based on your topic gaps, difficulty mix, and practice patterns"
                                right={<Pill label={`${recommendation.length} actions`} color="#E5A653" size={10} />}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {recommendation.map((r, i) => (
                                        <div key={i}
                                            style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 18px', background: `${P_COLOR[r.priority]}07`, border: `1px solid ${P_COLOR[r.priority]}25`, borderRadius: 13, transition: 'transform .2s' }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>
                                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${P_COLOR[r.priority]}16`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{r.icon}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
                                                    <span style={{ fontSize: 13, fontWeight: 700 }}>{r.topic}</span>
                                                    <Pill label={r.priority.toUpperCase()} color={P_COLOR[r.priority]} size={9} />
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.reason}</div>
                                            </div>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: P_COLOR[r.priority], textAlign: 'right', maxWidth: 200 }}>{r.action}</div>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* ══ CONTEST READINESS ══ */}
                            <Section title="🏆 Contest Readiness" sub="Based on M+H ratio, Hard exposure, recent efficiency, and consistency">
                                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                        {(() => {
                                            const c = contest.score >= 60 ? '#22C55E' : contest.score >= 40 ? '#F59E0B' : '#EF4444'
                                            return <Ring value={contest.score} size={140} stroke={10} color={c} sublabel="/ 100" />
                                        })()}
                                        <Pill label={contest.score >= 70 ? '✓ Contest Ready' : contest.score >= 45 ? '~ Getting There' : '✗ Needs Work'} color={contest.score >= 70 ? '#22C55E' : contest.score >= 45 ? '#F59E0B' : '#EF4444'} />
                                        {/* Score breakdown */}
                                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {[
                                                ['M+H Ratio', contest.breakdown.mhScore, 35, '#38BDF8'],
                                                ['Hard Exp.', contest.breakdown.hardScore, 20, '#EF4444'],
                                                ['Efficiency', contest.breakdown.effScore, 20, '#E5A653'],
                                                ['Consistency', contest.breakdown.conScore, 15, '#9F8FE3'],
                                            ].map(([l, v, max, c]) => (
                                                <div key={l}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</span>
                                                        <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{v}/{max}</span>
                                                    </div>
                                                    <MiniBar pct={(v / max) * 100} color={c} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                        <div style={{ background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.14)', borderRadius: 12, padding: 14 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', marginBottom: 10 }}>✓ Strengths</div>
                                            {contest.strengths.length
                                                ? contest.strengths.map((s, i) => <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', gap: 8 }}><span style={{ color: '#22C55E', flexShrink: 0 }}>•</span>{s}</div>)
                                                : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keep solving to build strengths</div>}
                                        </div>
                                        <div style={{ background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.14)', borderRadius: 12, padding: 14 }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginBottom: 10 }}>✗ To Improve</div>
                                            {contest.weaknesses.length
                                                ? contest.weaknesses.map((w, i) => <div key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', gap: 8 }}><span style={{ color: '#EF4444', flexShrink: 0 }}>•</span>{w}</div>)
                                                : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No major gaps found!</div>}
                                        </div>
                                    </div>
                                </div>
                            </Section>

                            {/* ══ PREDICTIVE PROGRESS ══ */}
                            <Section title="📊 Predictive Progress" sub={`At your current pace of ${prediction.avgPerDay} problems/day (based on last 21 days)`}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
                                    {[['In 30 Days', prediction.in30, '#38BDF8'], ['In 90 Days', prediction.in90, '#E5A653'], ['In 180 Days', prediction.in180, '#9F8FE3']].map(([l, v, c]) => (
                                        <div key={l} style={{ background: `${c}0d`, border: `1px solid ${c}22`, borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                                            <div style={{ fontSize: 30, fontWeight: 900, color: c, letterSpacing: '-0.02em' }}>{v}</div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: c, marginTop: 4 }}>+{v - totalSolved} from now</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Milestone Projections</div>
                                    {prediction.milestones.map((m, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', background: m.reached ? 'rgba(34,197,94,.06)' : 'rgba(255,255,255,.02)', border: `1px solid ${m.reached ? 'rgba(34,197,94,.18)' : 'rgba(255,255,255,.05)'}`, borderRadius: 10 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: m.reached ? '#22C55E' : 'var(--text-muted)', width: 50 }}>{m.target}</div>
                                            <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.05)', borderRadius: 5, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${Math.min((totalSolved / m.target) * 100, 100)}%`, background: m.reached ? '#22C55E' : 'linear-gradient(90deg,#E5A653,#9F8FE3)', borderRadius: 5, transition: 'width 1.3s ease', boxShadow: m.reached ? '0 0 6px #22C55E60' : undefined }} />
                                            </div>
                                            <div style={{ fontSize: 11, color: m.reached ? '#22C55E' : 'var(--text-muted)', width: 100, textAlign: 'right' }}>
                                                {m.reached ? '✓ Reached' : m.eta ? `~${m.eta}` : 'Need more data'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Section>

                            {/* ══ PLATFORM + TOPIC MASTERY ══ */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <Section title="Platform Breakdown" sub="Per-platform difficulty distribution">
                                    {linked.map(lp => {
                                        const m = PMETA[lp.platform] || { label: lp.platform, color: '#E5A653', icon: '🔷' }
                                        const ps = platforms.find(p => p.platform === lp.platform) || {}
                                        const sv = ps.totalSolved || 0
                                        const e = ps.easySolved || 0
                                        const md = ps.mediumSolved || 0
                                        const h = ps.hardSolved || 0
                                        const tot = Math.max(e + md + h, sv, 1)
                                        return (
                                            <div key={lp.platform} style={{ background: `${m.color}09`, border: `1px solid ${m.color}20`, borderRadius: 14, padding: 16, marginBottom: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <span style={{ fontSize: 22 }}>{m.icon}</span>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>@{lp.username}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 26, fontWeight: 900, color: m.color, letterSpacing: '-0.02em' }}>{sv}</div>
                                                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>solved</div>
                                                    </div>
                                                </div>
                                                {[['Easy', e, '#22C55E'], ['Medium', md, '#F59E0B'], ['Hard', h, '#EF4444']].map(([l, v, c]) => (
                                                    <div key={l} style={{ marginBottom: 10 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</span>
                                                            <span style={{ fontSize: 10, fontWeight: 700, color: c }}>{v} ({tot ? Math.round(v / tot * 100) : 0}%)</span>
                                                        </div>
                                                        <div style={{ height: 5, background: 'rgba(255,255,255,.04)', borderRadius: 6, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${(v / tot) * 100}%`, background: c, borderRadius: 6, transition: 'width 1.3s ease' }} />
                                                        </div>
                                                    </div>
                                                ))}
                                                {ps.rating && (
                                                    <div style={{ marginTop: 10, padding: '8px 12px', background: `${m.color}10`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Rating</span>
                                                        <span style={{ fontSize: 17, fontWeight: 900, color: m.color }}>{ps.rating}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </Section>

                                <Section
                                    title="Topic Mastery"
                                    sub="Ranked by problems solved — rank tier based on depth (problems count in that tag)">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {topicStats.slice(0, 8).map((t, i) => {
                                            // Rank tiers based on absolute count
                                            const rankTiers = [
                                                { min: 0, label: 'Novice', c: '#64748B' },
                                                { min: 5, label: 'Beginner', c: '#F59E0B' },
                                                { min: 10, label: 'Intermediate', c: '#22C55E' },
                                                { min: 20, label: 'Advanced', c: '#E5A653' },
                                                { min: 35, label: 'Expert', c: '#38BDF8' },
                                                { min: 60, label: 'Master', c: '#A855F7' },
                                            ]
                                            const rank = [...rankTiers].reverse().find(r => t.count >= r.min) || rankTiers[0]
                                            const nextTier = rankTiers.find(r => r.min > t.count)
                                            const pct = nextTier
                                                ? ((t.count - (rank.min)) / (nextTier.min - rank.min)) * 100
                                                : 100
                                            return (
                                                <div key={i}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: rank.c, boxShadow: `0 0 5px ${rank.c}` }} />
                                                            <span style={{ fontSize: 12, fontWeight: 600 }}>{t.topic}</span>
                                                            {t.isHighPriority && <span style={{ fontSize: 9, color: '#F59E0B', fontWeight: 700 }}>★</span>}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.count} solved</span>
                                                            <Pill label={rank.label} color={rank.c} size={9} />
                                                        </div>
                                                    </div>
                                                    <div style={{ height: 5, background: 'rgba(255,255,255,.04)', borderRadius: 8, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg,${rank.c},${rank.c}80)`, borderRadius: 8, transition: 'width 1.3s ease', boxShadow: `0 0 6px ${rank.c}40` }} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </Section>
                            </div>

                            {/* ══ DIFFICULTY SPLIT + SUBMISSION TIMELINE ══ */}
                            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
                                <Section title="Difficulty Split" sub="Solved distribution by difficulty">
                                    {totalSolved > 0 ? (
                                        <>
                                            <div style={{ position: 'relative', width: '100%', height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <ResponsiveContainer width={170} height={170}>
                                                    <PieChart>
                                                        <Pie data={diffData} cx="50%" cy="50%" innerRadius={54} outerRadius={78} dataKey="value" startAngle={90} endAngle={-270} paddingAngle={5} strokeWidth={0}>
                                                            {diffData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                                        </Pie>
                                                        <Tooltip content={<TT />} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div style={{ position: 'absolute', textAlign: 'center' }}>
                                                    <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em' }}>{totalSolved}</div>
                                                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>total</div>
                                                </div>
                                            </div>
                                            {diffData.map(d => (
                                                <div key={d.name} style={{ marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                                                            <span style={{ fontSize: 12 }}>{d.name}</span>
                                                        </div>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: d.color }}>
                                                            {d.value} <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>({totalSolved ? Math.round(d.value / totalSolved * 100) : 0}%)</span>
                                                        </span>
                                                    </div>
                                                    <MiniBar pct={totalSolved ? (d.value / totalSolved) * 100 : 0} color={d.color} />
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>No data yet</div>
                                    )}
                                </Section>

                                <Section
                                    title="Submission Timeline"
                                    sub="Recent submissions — status from LeetCode API (titleSlug + status)"
                                    right={
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(34,197,94,.1)', color: '#22C55E', fontSize: 11, fontWeight: 700 }}>{accepted} AC</span>
                                            <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(239,68,68,.1)', color: '#EF4444', fontSize: 11, fontWeight: 700 }}>{subs.length - accepted} non-AC</span>
                                            <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(229,166,83,.1)', color: '#E5A653', fontSize: 11, fontWeight: 700 }}>{accRate}%</span>
                                        </div>
                                    }>
                                    <div style={{ position: 'relative', paddingLeft: 20 }}>
                                        <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'linear-gradient(180deg,rgba(229,166,83,.45),transparent)', borderRadius: 2 }} />
                                        {subs.length === 0
                                            ? <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 13 }}>No recent submissions found.</div>
                                            : subs.slice(0, 8).map((s, i) => {
                                                const ok = s.statusDisplay === 'Accepted'
                                                const ts = s.timestamp ? new Date(parseInt(s.timestamp) * 1000) : null
                                                const tsStr = ts
                                                    ? ts.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' · ' + ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                                    : 'Recent'
                                                return (
                                                    <div key={i} style={{ position: 'relative', marginBottom: 10, paddingLeft: 14 }}>
                                                        <div style={{ position: 'absolute', left: -13, top: 11, width: 9, height: 9, borderRadius: '50%', background: ok ? '#22C55E' : '#EF4444', border: '2px solid rgba(10,15,38,.9)', boxShadow: `0 0 6px ${ok ? '#22C55E' : '#EF4444'}55` }} />
                                                        <div
                                                            style={{ background: 'rgba(255,255,255,0.022)', border: `1px solid ${ok ? 'rgba(34,197,94,.13)' : 'rgba(239,68,68,.1)'}`, borderRadius: 11, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all .2s', cursor: 'default' }}
                                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.transform = 'translateX(3px)' }}
                                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.022)'; e.currentTarget.style.transform = 'translateX(0)' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                <div style={{ width: 28, height: 28, borderRadius: 7, background: ok ? 'rgba(34,197,94,.13)' : 'rgba(239,68,68,.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: ok ? '#22C55E' : '#EF4444', flexShrink: 0 }}>
                                                                    {ok ? '✓' : '✗'}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.titleSlug?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{tsStr}</div>
                                                                </div>
                                                            </div>
                                                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 16, background: ok ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)', color: ok ? '#22C55E' : '#EF4444', whiteSpace: 'nowrap' }}>
                                                                {s.statusDisplay}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                </Section>
                            </div>

                            {/* ══ MILESTONE TRACKER ══ */}
                            <Section
                                title="🏅 Milestone Tracker"
                                sub="Achievements unlocked from your real data"
                                right={(() => {
                                    const ms = [
                                        { cur: totalSolved, tgt: 1 }, { cur: totalSolved, tgt: 10 }, { cur: totalSolved, tgt: 50 },
                                        { cur: totalSolved, tgt: 100 }, { cur: totalSolved, tgt: 200 },
                                        { cur: consistency.longestStreak, tgt: 14 },
                                        { cur: efficiency.score, tgt: 70 }, { cur: contest.score, tgt: 60 },
                                        { cur: topicStats.length, tgt: 8 },
                                    ]
                                    const done = ms.filter(m => m.cur >= m.tgt).length
                                    return <Pill label={`${done}/9 unlocked`} color="#E879F9" size={10} />
                                })()}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                                    {[
                                        { title: 'First Blood', desc: 'Solve 1 problem', cur: totalSolved, tgt: 1, icon: '🩸', color: '#EF4444' },
                                        { title: 'Warm Up', desc: 'Solve 10 problems', cur: totalSolved, tgt: 10, icon: '🔥', color: '#F59E0B' },
                                        { title: 'Half Century', desc: 'Solve 50 problems', cur: totalSolved, tgt: 50, icon: '🌟', color: '#9F8FE3' },
                                        { title: 'Century', desc: 'Solve 100 problems', cur: totalSolved, tgt: 100, icon: '👑', color: '#38BDF8' },
                                        { title: 'Grinder', desc: 'Solve 200 problems', cur: totalSolved, tgt: 200, icon: '⚡', color: '#E5A653' },
                                        { title: 'Streak Master', desc: '14-day streak', cur: consistency.longestStreak, tgt: 14, icon: '🔥', color: '#10B981' },
                                        { title: 'Efficiency Pro', desc: 'Efficiency ≥ 70', cur: efficiency.score, tgt: 70, icon: '🎯', color: '#F59E0B' },
                                        { title: 'Contest Ready', desc: 'Contest score ≥ 60', cur: contest.score, tgt: 60, icon: '🏆', color: '#22C55E' },
                                        { title: 'Topic Explorer', desc: '8+ topics practised', cur: topicStats.length, tgt: 8, icon: '🗺️', color: '#E879F9' },
                                    ].map((m, i) => {
                                        const pct = Math.min((m.cur / m.tgt) * 100, 100)
                                        const done = pct >= 100
                                        return (
                                            <div key={i}
                                                style={{ padding: '14px 15px', background: done ? `${m.color}0e` : 'rgba(255,255,255,.018)', border: `1px solid ${done ? m.color + '35' : 'rgba(255,255,255,.04)'}`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 13, opacity: done ? 1 : 0.62, transition: 'all .2s', cursor: 'default' }}
                                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.opacity = '1' }}
                                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = done ? '1' : '0.62' }}>
                                                <div style={{ fontSize: 22, filter: done ? 'none' : 'grayscale(1) opacity(.4)', flexShrink: 0 }}>{m.icon}</div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: done ? m.color : 'var(--text-primary)' }}>{m.title}</span>
                                                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{Math.min(m.cur, m.tgt)}/{m.tgt}</span>
                                                    </div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>{m.desc}</div>
                                                    <div style={{ height: 3, background: 'rgba(255,255,255,.05)', borderRadius: 5, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${pct}%`, background: done ? m.color : `${m.color}60`, borderRadius: 5, transition: 'width 1.3s ease', boxShadow: done ? `0 0 6px ${m.color}60` : undefined }} />
                                                    </div>
                                                </div>
                                                {done && <div style={{ fontSize: 11, fontWeight: 700, color: m.color, background: `${m.color}15`, padding: '3px 7px', borderRadius: 6, flexShrink: 0 }}>✓</div>}
                                            </div>
                                        )
                                    })}
                                </div>
                            </Section>

                        </div>
                    )}
                </main>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}
