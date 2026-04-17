import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as api from '../services/api'

const DIFF_COLOR = { easy: '#22C55E', medium: '#F59E0B', hard: '#EF4444' }
const DIFF_BG    = { easy: 'rgba(34,197,94,.1)', medium: 'rgba(245,158,11,.1)', hard: 'rgba(239,68,68,.1)' }

const MODES = {
    BEGINNER: { label: 'Beginner', color: '#22C55E', glow: 'rgba(34,197,94,.4)', icon: '⚡' },
    MEDIUM:   { label: 'Medium',   color: '#F59E0B', glow: 'rgba(245,158,11,.4)', icon: '🔥' },
    HARD:     { label: 'Hard',     color: '#EF4444', glow: 'rgba(239,68,68,.4)',  icon: '💀' },
}

function fmtTime(secs) {
    const s = Math.max(0, Math.floor(secs))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function Avatar({ name, size = 40, color = '#6366F1' }) {
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg,${color},${color}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.4, fontWeight: 800, color: '#fff',
            boxShadow: `0 0 0 3px rgba(0,0,0,.5), 0 0 20px ${color}50`,
        }}>
            {(name || '?')[0].toUpperCase()}
        </div>
    )
}

export default function ContestPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [challenge, setChallenge] = useState(null)
    const [loading, setLoading]     = useState(true)
    const [error, setError]         = useState(null)
    const [secsLeft, setSecsLeft]   = useState(0)
    const [finishing, setFinishing] = useState(false)
    const [syncing, setSyncing]     = useState(false)
    const [syncMsg, setSyncMsg]     = useState('')
    const [fsWarning, setFsWarning] = useState(false)
    const containerRef = useRef(null)
    const pollRef      = useRef(null)
    const timerRef     = useRef(null)
    const myEmail = api.getUserEmail()

    const load = useCallback(async () => {
        const r = await api.fetchLeaderboard(id)
        if (r.success) {
            setChallenge(r.data)
            setSecsLeft(r.data.secondsRemaining || 0)
            setError(null)
        } else setError(r.error)
        setLoading(false)
    }, [id])

    useEffect(() => {
        if (!api.isAuthenticated()) { navigate('/login'); return }
        load()
        pollRef.current = setInterval(load, 10_000)
        return () => { clearInterval(pollRef.current); clearInterval(timerRef.current) }
    }, [load])

    useEffect(() => {
        clearInterval(timerRef.current)
        if (secsLeft <= 0 || challenge?.status !== 'ACTIVE') return
        timerRef.current = setInterval(() => setSecsLeft(s => Math.max(0, s - 1)), 1_000)
        return () => clearInterval(timerRef.current)
    }, [secsLeft, challenge?.status])

    useEffect(() => {
        function onFsChange() {
            if (!document.fullscreenElement && challenge?.status === 'ACTIVE') setFsWarning(true)
        }
        document.addEventListener('fullscreenchange', onFsChange)
        return () => document.removeEventListener('fullscreenchange', onFsChange)
    }, [challenge?.status])

    function enterFullscreen() {
        containerRef.current?.requestFullscreen?.().catch(() => {})
    }

    async function handleFinish() {
        setFinishing(true)
        await api.finishChallenge(id)
        await load()
        setFinishing(false)
    }

    async function handleSync() {
        setSyncing(true); setSyncMsg('')
        try {
            await api.syncAllPlatforms()
            setSyncMsg('Synced! Refreshing scores…')
            await load()
            setTimeout(() => setSyncMsg(''), 3000)
        } catch { setSyncMsg('Sync failed') }
        setSyncing(false)
    }

    /* ── loading / error ── */
    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060818' }}>
            <div style={{ textAlign: 'center', color: '#64748B' }}>
                <div style={{ width: 48, height: 48, border: '3px solid rgba(99,102,241,.2)', borderTop: '3px solid #6366F1', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 16px' }} />
                <div style={{ fontSize: 13 }}>Loading contest…</div>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )

    if (error || !challenge) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060818', color: '#EF4444', gap: 16 }}>
            <div style={{ fontSize: 48 }}>⚠️</div>
            <div style={{ fontSize: 15 }}>{error || 'Challenge not found'}</div>
            <button onClick={() => navigate('/challenges')} style={{ background: 'rgba(99,102,241,.2)', border: '1px solid rgba(99,102,241,.4)', color: '#818CF8', padding: '10px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>← Back to Challenges</button>
        </div>
    )

    const cfg = MODES[challenge.contestType] || MODES.BEGINNER
    const isActive    = challenge.status === 'ACTIVE'
    const isCompleted = challenge.status === 'COMPLETED'
    const isPending   = challenge.status === 'PENDING'
    const isMyChallenge = challenge.challengerId === myEmail
    const isOpponent    = challenge.opponentId === myEmail

    const cp = challenge.challengerProgress || {}
    const op = challenge.opponentProgress   || {}
    const myProgress    = isMyChallenge ? cp : op
    const theirProgress = isMyChallenge ? op : cp

    const totalProblems = challenge.problems?.length || 0
    const urgentColor = secsLeft < 120 ? '#EF4444' : secsLeft < 300 ? '#F59E0B' : cfg.color
    const timerPct = challenge.contestType === 'BEGINNER' ? (secsLeft / 1800 * 100)
                   : challenge.contestType === 'MEDIUM'   ? (secsLeft / 2700 * 100)
                   : (secsLeft / 3600 * 100)

    const iWon  = challenge.winnerId === myEmail
    const isDraw = isCompleted && !challenge.winnerId

    return (
        <div ref={containerRef} style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#060818 0%,#0b1029 55%,#060818 100%)', fontFamily: 'Inter,system-ui,sans-serif', color: '#F1F5F9', position: 'relative' }}>
            {/* ambient */}
            <div style={{ position: 'fixed', top: -200, right: -200, width: 600, height: 600, background: `radial-gradient(circle,${cfg.color}10 0%,transparent 65%)`, borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: -200, left: -100, width: 500, height: 500, background: 'radial-gradient(circle,rgba(139,92,246,.07) 0%,transparent 65%)', borderRadius: '50%', pointerEvents: 'none' }} />

            {/* Fullscreen warning overlay */}
            {fsWarning && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
                    <div style={{ fontSize: 56 }}>⚠️</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#F59E0B' }}>Exited Fullscreen!</div>
                    <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 8, textAlign: 'center', maxWidth: 340 }}>Stay in fullscreen during the contest. Your timer is still running.</div>
                    <button onClick={() => { enterFullscreen(); setFsWarning(false) }} style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 13, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 6px 24px rgba(99,102,241,.5)' }}>↩ Return to Contest</button>
                </div>
            )}

            <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 20px 40px', position: 'relative', zIndex: 1 }}>

                {/* ── HEADER ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <button onClick={() => navigate('/challenges')} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#94A3B8', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>← Back</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{cfg.icon}</div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 16, fontWeight: 800 }}>{cfg.label} Challenge <span style={{ color: '#475569' }}>#{challenge.id}</span></span>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                                        background: isActive ? 'rgba(34,197,94,.15)' : isCompleted ? 'rgba(99,102,241,.15)' : 'rgba(245,158,11,.15)',
                                        color: isActive ? '#22C55E' : isCompleted ? '#6366F1' : '#F59E0B',
                                        border: `1px solid ${isActive ? 'rgba(34,197,94,.3)' : isCompleted ? 'rgba(99,102,241,.3)' : 'rgba(245,158,11,.3)'}`,
                                    }}>
                                        {isActive ? '🟢 LIVE' : isCompleted ? '✅ DONE' : '⏳ PENDING'}
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{challenge.challengerName} vs {challenge.opponentName}</div>
                            </div>
                        </div>
                    </div>

                    {/* Right controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {isActive && (
                            <button onClick={handleSync} disabled={syncing} style={{ background: syncing ? 'rgba(56,189,248,.1)' : 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.25)', color: '#38BDF8', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {syncing ? <span style={{ width: 12, height: 12, border: '2px solid rgba(56,189,248,.3)', borderTop: '2px solid #38BDF8', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> : '↻'} Sync Now
                            </button>
                        )}
                        {isActive && !document.fullscreenElement && (
                            <button onClick={enterFullscreen} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', color: '#94A3B8', padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 12 }}>⛶ Fullscreen</button>
                        )}
                        {isPending && isOpponent && (
                            <button onClick={async () => { const r = await api.acceptChallenge(id); if (r.success) load() }} style={{ background: `linear-gradient(135deg,${cfg.color},${cfg.color}cc)`, color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 11, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 16px ${cfg.glow}` }}>⚔️ Accept Challenge</button>
                        )}
                        {isPending && isMyChallenge && (
                            <div style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: 12, color: '#F59E0B' }}>⏳ Waiting for opponent…</div>
                        )}
                        {isActive && (
                            <button onClick={handleFinish} disabled={finishing} style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#EF4444', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>{finishing ? 'Finishing…' : '🏁 Finish Early'}</button>
                        )}
                    </div>
                </div>

                {syncMsg && (
                    <div style={{ background: 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 10, padding: '9px 16px', fontSize: 12, color: '#38BDF8', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        ✓ {syncMsg}
                    </div>
                )}

                {/* ── TIMER BAR (only when active) ── */}
                {isActive && (
                    <div style={{ background: 'rgba(255,255,255,.025)', border: `1px solid ${urgentColor}30`, borderRadius: 16, padding: '16px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ textAlign: 'center', minWidth: 90 }}>
                            <div style={{ fontSize: 36, fontWeight: 900, color: urgentColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.03em', lineHeight: 1, textShadow: `0 0 20px ${urgentColor}60` }}>{fmtTime(secsLeft)}</div>
                            <div style={{ fontSize: 10, color: '#475569', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Remaining</div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: '#64748B' }}>Time elapsed</span>
                                <span style={{ fontSize: 11, color: urgentColor, fontWeight: 600 }}>{secsLeft < 120 ? '⚠️ Almost out!' : secsLeft < 300 ? 'Hurry up!' : 'On track'}</span>
                            </div>
                            <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 8, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, timerPct))}%`, background: `linear-gradient(90deg,${urgentColor},${urgentColor}99)`, borderRadius: 8, transition: 'width 1s linear', boxShadow: `0 0 8px ${urgentColor}60` }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── RESULT BANNER ── */}
                {isCompleted && (
                    <div style={{
                        background: isDraw ? 'rgba(99,102,241,.08)' : iWon ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
                        border: `1px solid ${isDraw ? 'rgba(99,102,241,.3)' : iWon ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
                        borderRadius: 20, padding: '28px 32px', marginBottom: 22, textAlign: 'center',
                        boxShadow: isDraw ? 'none' : iWon ? '0 0 40px rgba(34,197,94,.12)' : '0 0 40px rgba(239,68,68,.08)',
                    }}>
                        <div style={{ fontSize: 52, marginBottom: 10 }}>{isDraw ? '🤝' : iWon ? '🏆' : '😔'}</div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: isDraw ? '#818CF8' : iWon ? '#22C55E' : '#EF4444', marginBottom: 8 }}>
                            {isDraw ? "It's a Draw!" : iWon ? 'You Won!' : 'You Lost'}
                        </div>
                        <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 18 }}>
                            {isDraw ? 'Both players tied on problems solved.' : `${challenge.winnerId === challenge.challengerId ? challenge.challengerName : challenge.opponentName} wins this contest.`}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 28, fontWeight: 900, color: iWon ? '#22C55E' : '#F1F5F9' }}>{myProgress.solved || 0}</div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>Your solves</div>
                            </div>
                            <div style={{ width: 1, background: 'rgba(255,255,255,.06)' }} />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 28, fontWeight: 900, color: '#F1F5F9' }}>{theirProgress.solved || 0}</div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>Opponent solves</div>
                            </div>
                            <div style={{ width: 1, background: 'rgba(255,255,255,.06)' }} />
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 28, fontWeight: 900, color: '#64748B' }}>{totalProblems}</div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>Total problems</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── SCOREBOARD ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 14, marginBottom: 20, alignItems: 'center' }}>
                    {[
                        { prog: challenge.challengerProgress, isMe: challenge.challengerId === myEmail },
                        null,
                        { prog: challenge.opponentProgress, isMe: challenge.opponentId === myEmail },
                    ].map((item, i) => {
                        if (item === null) return (
                            <div key="vs" style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 14, fontWeight: 900, color: '#334155', marginBottom: 4 }}>VS</div>
                                {isActive && <div style={{ width: 2, height: 40, background: 'rgba(255,255,255,.06)', margin: '0 auto' }} />}
                            </div>
                        )
                        const { prog, isMe } = item
                        const pct = totalProblems > 0 ? ((prog?.solved || 0) / totalProblems * 100) : 0
                        const isWinner = isCompleted && challenge.winnerId && prog?.userId === challenge.winnerId
                        const barColor = isWinner ? '#22C55E' : isMe ? '#6366F1' : '#475569'
                        return (
                            <div key={i} style={{
                                background: isWinner ? 'rgba(34,197,94,.06)' : isMe ? 'rgba(99,102,241,.05)' : 'rgba(255,255,255,.025)',
                                border: `1px solid ${isWinner ? 'rgba(34,197,94,.3)' : isMe ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.06)'}`,
                                borderRadius: 18, padding: '20px 22px', backdropFilter: 'blur(20px)',
                                boxShadow: isWinner ? '0 0 30px rgba(34,197,94,.12)' : 'none',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                    <Avatar name={prog?.name || '?'} size={44} color={isMe ? '#6366F1' : '#475569'} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                            <span style={{ fontSize: 14, fontWeight: 800 }}>{prog?.name || '—'}</span>
                                            {isMe && <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(99,102,241,.2)', color: '#818CF8', padding: '1px 7px', borderRadius: 20 }}>You</span>}
                                            {isWinner && <span style={{ fontSize: 14 }}>🏆</span>}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace, monospace' }}>{prog?.userId}</div>
                                    </div>
                                </div>

                                {/* Score */}
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                                        <span style={{ fontSize: 44, fontWeight: 900, color: isWinner ? '#22C55E' : isMe ? '#6366F1' : '#F1F5F9', lineHeight: 1, textShadow: isWinner ? '0 0 20px rgba(34,197,94,.4)' : 'none' }}>{prog?.solved || 0}</span>
                                        <span style={{ fontSize: 16, color: '#334155', fontWeight: 500 }}>/ {totalProblems}</span>
                                        <span style={{ fontSize: 11, color: '#475569', marginLeft: 4 }}>solved</span>
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ height: 8, background: 'rgba(255,255,255,.06)', borderRadius: 8, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${barColor},${barColor}bb)`, borderRadius: 8, transition: 'width .8s ease', boxShadow: pct > 0 ? `0 0 8px ${barColor}60` : 'none' }} />
                                    </div>
                                </div>

                                {prog?.lastSolvedAt && (
                                    <div style={{ fontSize: 10.5, color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <span>🕐</span> Last solve: {new Date(prog.lastSolvedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* ── PROBLEMS ── */}
                <div style={{ background: 'rgba(255,255,255,.022)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,.065)', borderRadius: 20, padding: '22px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>Contest Problems</div>
                            <div style={{ fontSize: 11.5, color: '#64748B' }}>
                                {isActive ? 'Solve on LeetCode · Solves detected automatically after syncing' : isPending ? 'Problems are revealed when the contest starts' : 'Final problem set for this contest'}
                            </div>
                        </div>
                        {isActive && (
                            <button onClick={handleSync} disabled={syncing} style={{ background: syncing ? 'rgba(56,189,248,.1)' : 'rgba(56,189,248,.08)', border: '1px solid rgba(56,189,248,.2)', color: '#38BDF8', padding: '7px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                                {syncing ? <span style={{ width: 10, height: 10, border: '2px solid rgba(56,189,248,.3)', borderTop: '2px solid #38BDF8', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> : '↻'} Sync Solves
                            </button>
                        )}
                    </div>

                    {!challenge.problems?.length ? (
                        <div style={{ textAlign: 'center', padding: '36px 0', color: '#64748B' }}>
                            {isPending ? '🔒 Problems are locked until the contest starts.' : 'No problems assigned.'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {challenge.problems.map((p, i) => {
                                const diff = p.difficulty?.toLowerCase()
                                const dc = DIFF_COLOR[diff] || '#94A3B8'
                                const dbg = DIFF_BG[diff] || 'rgba(148,163,184,.06)'
                                const title = p.title || p.titleSlug?.replace(/-/g,' ').replace(/\b\w/g, l => l.toUpperCase()) || `Problem ${i+1}`
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '14px 18px', background: 'rgba(255,255,255,.02)',
                                        border: '1px solid rgba(255,255,255,.05)', borderRadius: 14,
                                        transition: 'all .2s', gap: 16,
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,.2)' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.05)' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                                            {/* Number badge */}
                                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#818CF8', flexShrink: 0 }}>#{i + 1}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 5 }}>{title}</div>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <span style={{ fontSize: 10.5, fontWeight: 700, color: dc, background: dbg, padding: '2px 10px', borderRadius: 20, border: `1px solid ${dc}30` }}>{p.difficulty}</span>
                                                    {p.platform && <span style={{ fontSize: 10, color: '#64748B', background: 'rgba(255,255,255,.04)', padding: '2px 9px', borderRadius: 20 }}>{p.platform}</span>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Who solved it */}
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                                            {[
                                                { prog: myProgress,    label: 'You', color: '#6366F1' },
                                                { prog: theirProgress, label: 'Opp', color: '#F59E0B' },
                                            ].map(({ prog, label, color }) => {
                                                const solved = prog?.solvedTitles?.includes(p.titleSlug) || prog?.solvedTitles?.includes(title)
                                                return (
                                                    <div key={label} title={`${label}: ${solved ? 'Solved' : 'Pending'}`} style={{ width: 24, height: 24, borderRadius: 6, background: solved ? `${color}20` : 'rgba(255,255,255,.04)', border: `1px solid ${solved ? color + '40' : 'rgba(255,255,255,.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, transition: 'all .2s' }}>
                                                        {solved ? '✓' : '·'}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {p.problemUrl && (
                                            <a href={p.problemUrl} target="_blank" rel="noopener noreferrer"
                                                style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 3px 12px rgba(99,102,241,.4)', transition: 'opacity .2s', flexShrink: 0 }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '.8'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                            >Solve →</a>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {isActive && (
                        <div style={{ marginTop: 18, padding: '13px 18px', background: 'rgba(56,189,248,.04)', border: '1px solid rgba(56,189,248,.15)', borderRadius: 12 }}>
                            <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.8 }}>
                                <strong style={{ color: '#38BDF8' }}>💡 Scoring:</strong> Solve problems on LeetCode directly. Click <em>Sync Solves</em> above or visit the Dashboard and hit Sync to record your progress. Leaderboard auto-refreshes every 10 seconds.
                            </div>
                        </div>
                    )}
                </div>

            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                * { font-family: Inter, system-ui, sans-serif; box-sizing: border-box; }
            `}</style>
        </div>
    )
}
