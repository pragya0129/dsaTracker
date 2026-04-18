import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/TopBar'
import * as api from '../services/api'

const DIFF_COLOR = { Easy: '#22C55E', Medium: '#F59E0B', Hard: '#EF4444' }
const PLAT_MAP = { leetcode: ['#FFA116', 'LeetCode'], codeforces: ['#1890FF', 'Codeforces'], geeksforgeeks: ['#308D46', 'GFG'] }

const CARD = { background: 'rgba(255,255,255,0.025)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 22 }

function DiffBadge({ d }) {
    const c = DIFF_COLOR[d] || '#94A3B8'
    return <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: `${c}18`, color: c, border: `1px solid ${c}30` }}>{d}</span>
}
function PlatBadge({ p }) {
    const [c, l] = PLAT_MAP[(p || '').toLowerCase()] || ['#E5A653', 'Unknown']
    return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: `${c}15`, color: c, border: `1px solid ${c}25` }}>{l}</span>
}
function TopicBadge({ t }) {
    return <span style={{ fontSize: 10, padding: '2px 9px', borderRadius: 20, background: 'rgba(229,166,83,.14)', color: '#9F8FE3', border: '1px solid rgba(229,166,83,.2)' }}>{t}</span>
}

function SkillBar({ topic, pct, solved, target, color }) {
    return (
        <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{topic}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{solved}/{target} · {pct}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.05)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct < 30 ? '#EF4444' : pct < 60 ? '#F59E0B' : '#22C55E', borderRadius: 10, transition: 'width 1s ease', boxShadow: `0 0 6px ${pct < 30 ? '#EF444450' : pct < 60 ? '#F59E0B50' : '#22C55E50'}` }} />
            </div>
        </div>
    )
}

export default function RecommendationsPage() {
    const navigate = useNavigate()
    const [data, setData] = useState(null)
    const [diff, setDiff] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [tab, setTab] = useState('daily')

    useEffect(() => {
        if (!api.isAuthenticated()) { navigate('/login'); return }
        load()
    }, [])

    async function load() {
        setLoading(true); setError(null)
        const [recRes, diffRes] = await Promise.all([
            api.authFetchJson('/recommendations/daily?limit=5'),
            api.authFetchJson('/recommendations/difficulty-progress'),
        ])
        if (recRes.ok) { setData(recRes.data) } else { setError(recRes.error) }
        if (diffRes.ok) { setDiff(diffRes.data) }

        setLoading(false)
    }

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })
    const recs = data?.recommendations || []
    const weak = data?.weakTopics || []
    const skill = data?.skillSnapshot || []
    const featured = recs[0]
    const rest = recs.slice(1)

    return (
        <div className="app-shell" style={{ background: 'linear-gradient(140deg,#0B0F1A,#121727 50%,#0B0F1A)' }}>
            <div style={{ position: 'fixed', top: -200, right: -200, width: 500, height: 500, background: 'radial-gradient(circle,rgba(229,166,83,.07),transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
            <Sidebar />
            <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
                <Topbar title="Recommendations" subtitle={`Personalised for you · ${today}`} />
                <main className="page-content">

                    {error && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 12, padding: '11px 16px', marginBottom: 16, color: '#EF4444', fontSize: 13 }}>⚠️ {error}</div>}

                    {loading && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 100, gap: 14 }}>
                        <div style={{ width: 40, height: 40, border: '3px solid rgba(229,166,83,.2)', borderTop: '3px solid #E5A653', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Analysing your skill profile…</div>
                    </div>}

                    {!loading && data && (<>

                        {/* ── Difficulty Progress Banner ── */}
                        {diff && (
                            <div style={{ ...CARD, background: 'linear-gradient(135deg,rgba(229,166,83,.12),rgba(159,143,227,.06))', border: '1px solid rgba(229,166,83,.2)', marginBottom: 18 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#E5A653,#9F8FE3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎯</div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                                <span style={{ fontSize: 14, fontWeight: 700 }}>Difficulty Target</span>
                                                <DiffBadge d={diff.recommendedDifficulty} />
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{diff.reason}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9F8FE3', maxWidth: 280, textAlign: 'right' }}>{diff.nextMilestone}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 24, marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                                    {[['Easy', diff.easyCount, '#22C55E'], ['Medium', diff.mediumCount, '#F59E0B'], ['Hard', diff.hardCount, '#EF4444']].map(([l, v, c]) => (
                                        <div key={l} style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── Tabs ── */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
                            {[['daily', '🎯 Daily Picks'], ['weak', '⚠️ Weak Topics'], ['skill', '📊 Skill Map']].map(([k, l]) => (
                                <button key={k} onClick={() => setTab(k)} style={{ padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: '1px solid', transition: 'all .2s', background: tab === k ? 'linear-gradient(135deg,#E5A653,#9F8FE3)' : 'rgba(255,255,255,.03)', color: tab === k ? '#fff' : 'var(--text-muted)', borderColor: tab === k ? 'transparent' : 'rgba(255,255,255,.08)' }}>{l}</button>
                            ))}
                            <button onClick={load} style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>⟳ Refresh</button>
                        </div>

                        {/* ══ DAILY TAB ══ */}
                        {tab === 'daily' && (<>
                            {recs.length === 0 ? (
                                <div style={{ ...CARD, textAlign: 'center', padding: '48px 32px' }}>
                                    <div style={{ fontSize: 48, marginBottom: 14 }}>🎉</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>All caught up!</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No unsolved problems found matching your profile. Add more topics to your problem pool.</div>
                                </div>
                            ) : (<>
                                {/* Featured */}
                                {featured && (
                                    <div style={{ ...CARD, background: 'linear-gradient(135deg,rgba(229,166,83,.1),rgba(159,143,227,.05))', border: '1px solid rgba(229,166,83,.22)', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, background: 'radial-gradient(circle,rgba(229,166,83,.15),transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, position: 'relative', zIndex: 1 }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 10, background: 'rgba(229,166,83,.2)', color: '#9F8FE3', border: '1px solid rgba(229,166,83,.35)' }}>⭐ TOP PICK</span>
                                                    <DiffBadge d={featured.difficulty} />
                                                    {featured.platform && <PlatBadge p={featured.platform} />}
                                                    {featured.topic && <TopicBadge t={featured.topic} />}
                                                </div>
                                                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>{featured.title}</h3>
                                                <div style={{ background: 'rgba(229,166,83,.1)', border: '1px solid rgba(229,166,83,.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                                                    💡 {featured.reason}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                                                {featured.problemUrl ? (
                                                    <a href={featured.problemUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: '#fff', padding: '11px 24px', borderRadius: 11, fontWeight: 700, fontSize: 13, textDecoration: 'none', boxShadow: '0 4px 16px rgba(229,166,83,.4)', textAlign: 'center' }}>Solve Now →</a>
                                                ) : null}
                                                <button onClick={load} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'var(--text-muted)', padding: '9px 18px', borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>↻ New suggestion</button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Rest of recommendations */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {rest.map((rec, i) => (
                                        <div key={i} style={{ ...CARD, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', transition: 'all .2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
                                                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${DIFF_COLOR[rec.difficulty] || '#E5A653'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, color: DIFF_COLOR[rec.difficulty] || '#E5A653', flexShrink: 0 }}>#{i + 2}</div>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700 }}>{rec.title}</span>
                                                        <DiffBadge d={rec.difficulty} />
                                                        {rec.platform && <PlatBadge p={rec.platform} />}
                                                        {rec.topic && <TopicBadge t={rec.topic} />}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>💡 {rec.reason}</div>
                                                </div>
                                            </div>
                                            {rec.problemUrl && <a href={rec.problemUrl} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(229,166,83,.15)', border: '1px solid rgba(229,166,83,.3)', color: '#9F8FE3', padding: '7px 16px', borderRadius: 9, fontWeight: 700, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all .2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(229,166,83,.25)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(229,166,83,.15)'}>Solve →</a>}
                                        </div>
                                    ))}
                                </div>
                            </>)}
                        </>)}

                        {/* ══ WEAK TOPICS TAB ══ */}
                        {tab === 'weak' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                                {weak.length === 0 ? (
                                    <div style={{ ...CARD, textAlign: 'center', padding: '48px 32px', gridColumn: '1/-1' }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div><div style={{ fontSize: 14, fontWeight: 700 }}>No weak topics detected!</div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Keep solving to populate your skill profile.</div></div>
                                ) : weak.map((w, i) => (
                                    <div key={i} style={{ ...CARD, border: `1px solid ${w.pct < 30 ? 'rgba(239,68,68,.25)' : w.pct < 60 ? 'rgba(245,158,11,.2)' : 'rgba(34,197,94,.15)'}`, background: `${w.pct < 30 ? 'rgba(239,68,68,.05)' : w.pct < 60 ? 'rgba(245,158,11,.04)' : 'rgba(34,197,94,.04)'}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{w.topic}</span>
                                            <span style={{ fontSize: 22, fontWeight: 900, color: w.pct < 30 ? '#EF4444' : w.pct < 60 ? '#F59E0B' : '#22C55E' }}>{w.pct}%</span>
                                        </div>
                                        <div style={{ height: 7, background: 'rgba(255,255,255,.05)', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
                                            <div style={{ height: '100%', width: `${w.pct}%`, background: w.pct < 30 ? '#EF4444' : w.pct < 60 ? '#F59E0B' : '#22C55E', borderRadius: 10, transition: 'width 1s ease' }} />
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>{w.solved} / {w.target} problems · {w.reason}</div>
                                        <button onClick={() => setTab('daily')} style={{ width: '100%', background: 'rgba(229,166,83,.15)', border: '1px solid rgba(229,166,83,.3)', color: '#9F8FE3', padding: '8px', borderRadius: 9, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Get {w.topic} problems →</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ══ SKILL MAP TAB ══ */}
                        {tab === 'skill' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
                                <div style={CARD}>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Topic Skill Map</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 18 }}>Based on your topic_stats — sorted by mastery</div>
                                    {skill.length === 0 ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No topic data yet. Sync your platforms first.</div>
                                    ) : skill.map((s, i) => (
                                        <SkillBar key={i} topic={s.topic} pct={s.pct} solved={s.solved} target={s.target} />
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {diff && (
                                        <div style={CARD}>
                                            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Difficulty Progression</div>
                                            {[['Easy', diff.easyCount, 30, '#22C55E'], ['Medium', diff.mediumCount, 60, '#F59E0B'], ['Hard', diff.hardCount, 20, '#EF4444']].map(([l, v, t, c]) => (
                                                <div key={l} style={{ marginBottom: 12 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 12, fontWeight: 600 }}>{l}</span><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}/{t}</span></div>
                                                    <div style={{ height: 6, background: 'rgba(255,255,255,.05)', borderRadius: 10, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${Math.min((v / t) * 100, 100)}%`, background: c, borderRadius: 10, transition: 'width 1s ease' }} />
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(229,166,83,.08)', border: '1px solid rgba(229,166,83,.2)', borderRadius: 10, fontSize: 11, color: '#9F8FE3', lineHeight: 1.6 }}>{diff.nextMilestone}</div>
                                        </div>
                                    )}
                                    <div style={CARD}>
                                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Legend</div>
                                        {[['< 30%', 'Critical — urgent practice needed', '#EF4444'], ['30–60%', 'Developing — keep going', '#F59E0B'], ['60–80%', 'Solid — approaching mastery', '#22C55E'], ['> 80%', 'Expert — challenge yourself', '#E5A653']].map(([r, l, c]) => (
                                            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0 }} />
                                                <span style={{ fontSize: 11, fontWeight: 700, color: c, minWidth: 50 }}>{r}</span>
                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </>)}
                </main>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )
}
