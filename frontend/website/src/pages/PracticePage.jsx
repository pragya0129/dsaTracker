import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import * as api from '../services/api'

/* ─── meta tables ────────────────────────────────────────── */
const DIFF_META = {
  Easy:   { color: '#22C55E', bg: 'rgba(34,197,94,.10)',  glow: 'rgba(34,197,94,.30)',  icon: '🟢' },
  Medium: { color: '#F59E0B', bg: 'rgba(245,158,11,.10)', glow: 'rgba(245,158,11,.30)', icon: '🟡' },
  Hard:   { color: '#EF4444', bg: 'rgba(239,68,68,.10)',  glow: 'rgba(239,68,68,.30)',  icon: '🔴' },
}
const PLAT_META = {
  leetcode:   { color: '#FFA116', label: 'LeetCode',   short: 'LC',  icon: '🟠' },
  codeforces: { color: '#1890FF', label: 'Codeforces', short: 'CF',  icon: '🔵' },
  geeksforgeeks: { color: '#308D46', label: 'GFG',     short: 'GFG', icon: '🟢' },
}
const CAT_META = {
  mission:  { label: '🎯 Daily Mission',  color: '#9F8FE3', bg: 'rgba(159,143,227,.12)', glow: 'rgba(159,143,227,.35)', desc: 'Personalised for you today' },
  weakness: { label: '⚠️ Fix Weakness',  color: '#EF4444', bg: 'rgba(239,68,68,.10)',  glow: 'rgba(239,68,68,.30)', desc: 'Your critical gaps' },
  levelup:  { label: '📈 Level Up',       color: '#F59E0B', bg: 'rgba(245,158,11,.10)', glow: 'rgba(245,158,11,.30)', desc: 'Push past your comfort zone' },
  explore:  { label: '🔭 Explore',        color: '#38BDF8', bg: 'rgba(56,189,248,.10)', glow: 'rgba(56,189,248,.30)', desc: 'New territory for you' },
  stretch:  { label: '💪 Stretch Goal',   color: '#E5A653', bg: 'rgba(229,166,83,.12)', glow: 'rgba(229,166,83,.35)', desc: 'One Hard problem per session' },
}
const STAGE_META = {
  BEGINNER:     { label: 'Beginner',     color: '#22C55E', icon: '🌱' },
  INTERMEDIATE: { label: 'Intermediate', color: '#F59E0B', icon: '⚡' },
  ADVANCED:     { label: 'Advanced',     color: '#EF4444', icon: '🔥' },
  EXPERT:       { label: 'Expert',       color: '#9F8FE3', icon: '🏆' },
}

/* ─── small atoms ────────────────────────────────────────── */
function Chip({ children, color, bg, style = {} }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: bg || `${color}18`, color, border: `1px solid ${color}30`,
      whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  )
}

function SkillRing({ pct, color, size = 44 }) {
  const r = (size - 6) / 2, circ = 2 * Math.PI * r, dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s ease' }} />
    </svg>
  )
}

function MiniBar({ pct, color }) {
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 10, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 10, background: color, transition: 'width 1.2s ease', boxShadow: `0 0 6px ${color}55` }} />
    </div>
  )
}

/* ─── Daily Mission Card ─────────────────────────────────── */
function MissionCard({ mission, onComplete, completing }) {
  const [hovered, setHovered] = useState(false)
  if (!mission) return null

  const diff  = DIFF_META[mission.difficulty]  || DIFF_META.Medium
  const platKey = (mission.platform || '').toLowerCase()
  const plat  = PLAT_META[platKey] || { color: '#E5A653', label: mission.platform || 'Unknown', short: '?', icon: '⬡' }
  const done  = mission.completed

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', borderRadius: 20,
      background: done ? 'rgba(34,197,94,.06)' : hovered ? 'rgba(159,143,227,.12)' : 'rgba(159,143,227,.06)',
      border: `1px solid ${done ? '#22C55E44' : hovered ? '#9F8FE399' : '#9F8FE333'}`,
      padding: 24, marginBottom: 20,
      transition: 'all .22s ease',
      boxShadow: done ? '0 0 24px rgba(34,197,94,.12)' : hovered ? '0 8px 40px rgba(159,143,227,.30)' : '0 2px 16px rgba(0,0,0,.25)',
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: done ? 'linear-gradient(90deg,#22C55E,#16A34A)' : 'linear-gradient(90deg,#9F8FE3,#E5A653,#38BDF8)',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: done ? 'linear-gradient(135deg,#22C55E,#16A34A)' : 'linear-gradient(135deg,#9F8FE3,#E5A653)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            {done ? '✅' : '🎯'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: done ? '#22C55E' : '#9F8FE3', textTransform: 'uppercase', letterSpacing: 1 }}>
                {done ? '✓ Completed' : '🎯 Daily Mission'}
              </span>
              {mission.sequence > 1 && (
                <span style={{ fontSize: 9, color: '#64748B', background: 'rgba(255,255,255,.06)', borderRadius: 20, padding: '1px 6px' }}>
                  #{mission.sequence} today
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#64748B' }}>
              {done ? 'Great job! Come back tomorrow for a new mission' : 'Locked in for today — complete it to unlock the next'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <Chip color={plat.color} bg={`${plat.color}15`}>{plat.icon} {plat.short}</Chip>
          <Chip color={diff.color} bg={diff.bg}>{diff.icon} {mission.difficulty}</Chip>
        </div>
      </div>

      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8, lineHeight: 1.3, letterSpacing: -.3 }}>
        {mission.title}
      </div>

      {mission.topic && (
        <div style={{ marginBottom: 14 }}>
          <Chip color="#9F8FE3" bg="rgba(229,166,83,.12)">{mission.topic}</Chip>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {mission.problemUrl && (
          <button
            onClick={() => window.open(mission.problemUrl, '_blank')}
            style={{
              padding: '10px 22px', borderRadius: 11, fontWeight: 800, fontSize: 13,
              background: done ? 'rgba(34,197,94,.15)' : 'linear-gradient(135deg,#9F8FE3,#E5A653)',
              color: done ? '#22C55E' : '#fff',
              border: done ? '1px solid #22C55E44' : 'none',
              cursor: 'pointer',
            }}>
            {done ? 'Review Problem →' : 'Solve Now →'}
          </button>
        )}
        {!done && (
          <button
            onClick={onComplete}
            disabled={completing}
            style={{
              padding: '10px 18px', borderRadius: 11, fontWeight: 700, fontSize: 12,
              background: 'rgba(34,197,94,.12)', color: '#22C55E',
              border: '1px solid rgba(34,197,94,.3)', cursor: completing ? 'wait' : 'pointer',
              opacity: completing ? 0.6 : 1,
            }}>
            {completing ? '…' : '✓ Mark Done'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── Problem Card ───────────────────────────────────────── */
function ProblemCard({ problem, category, featured = false }) {
  const [hovered, setHovered] = useState(false)
  const diff = DIFF_META[problem.difficulty] || DIFF_META.Medium
  const platKey = (problem.platform || '').toLowerCase()
  const plat = PLAT_META[platKey] || { color: '#E5A653', label: problem.platform || 'Unknown', short: '?', icon: '⬡' }
  const cat  = CAT_META[category] || CAT_META.levelup

  return (
    <div
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: featured ? 18 : 14,
        border: `1px solid ${hovered ? cat.color + '55' : 'rgba(255,255,255,.07)'}`,
        background: hovered ? cat.bg : 'rgba(255,255,255,.025)',
        backdropFilter: 'blur(18px)',
        padding: featured ? 24 : 18,
        transition: 'all .22s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? `0 8px 32px ${cat.glow}` : '0 2px 12px rgba(0,0,0,.2)',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => problem.problemUrl && window.open(problem.problemUrl, '_blank')}>

      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: `linear-gradient(180deg,${diff.color},${diff.color}55)` }} />
      <div style={{ position: 'absolute', top: 0, left: 3, right: 0, height: 3, background: `linear-gradient(90deg,${cat.color},transparent)` }} />
      {hovered && (
        <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: `radial-gradient(circle,${cat.glow},transparent 70%)`, borderRadius: '50%', pointerEvents: 'none' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 9, flexWrap: 'wrap', paddingLeft: 6 }}>
        <Chip color={cat.color} bg={cat.bg}>{cat.label}</Chip>
        <Chip color={diff.color} bg={diff.bg}>{diff.icon} {problem.difficulty}</Chip>
        <Chip color={plat.color} bg={`${plat.color}15`}>{plat.icon} {plat.short}</Chip>
        {problem.topic && <Chip color="#9F8FE3" bg="rgba(229,166,83,.12)">{problem.topic}</Chip>}
      </div>

      <div style={{ fontSize: featured ? 16 : 13, fontWeight: 800, marginBottom: 8, lineHeight: 1.35, paddingLeft: 6 }}>
        {problem.title}
      </div>

      {problem.reason && (
        <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.55, background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '6px 10px', marginBottom: 10, marginLeft: 6, border: '1px solid rgba(255,255,255,.05)' }}>
          💡 {problem.reason}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 6 }}>
        <span style={{ fontSize: 10, color: '#475569' }}>{plat.label}</span>
        {problem.problemUrl && (
          <div
            style={{ background: `linear-gradient(135deg,${diff.color},${diff.color}bb)`, color: '#fff', padding: featured ? '8px 18px' : '5px 12px', borderRadius: 8, fontWeight: 700, fontSize: 11, boxShadow: hovered ? `0 4px 14px ${diff.glow}` : 'none', transition: 'box-shadow .2s' }}
            onClick={e => { e.stopPropagation(); window.open(problem.problemUrl, '_blank') }}>
            Solve →
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Skill Panel ────────────────────────────────────────── */
function SkillPanel({ topics, diffStats, platforms }) {
  const sorted = [...(topics || [])].sort((a, b) => a.pct - b.pct).slice(0, 5)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 16 }}>

      {platforms?.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Linked</span>
          {platforms.map(p => {
            const meta = PLAT_META[p.toLowerCase()] || { color: '#E5A653', short: p, icon: '⬡' }
            return <Chip key={p} color={meta.color} bg={`${meta.color}15`}>{meta.icon} {meta.short}</Chip>
          })}
        </div>
      )}

      {diffStats && (
        <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 14, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>Progress</div>
          {[['Easy', diffStats.easyCount, 30, '#22C55E'], ['Medium', diffStats.mediumCount, 50, '#F59E0B'], ['Hard', diffStats.hardCount, 20, '#EF4444']].map(([label, val, target, color]) => {
            const pct = Math.min(Math.round(((val || 0) / target) * 100), 100)
            return (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <SkillRing pct={pct} color={color} size={34} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 12, color, fontWeight: 800 }}>{val || 0}<span style={{ color: '#475569', fontWeight: 400 }}>/{target}</span></span>
                </div>
                <MiniBar pct={pct} color={color} />
              </div>
            )
          })}
          {diffStats.nextMilestone && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(229,166,83,.08)', border: '1px solid rgba(229,166,83,.2)', borderRadius: 9, fontSize: 11, color: '#9F8FE3', lineHeight: 1.55 }}>
              {diffStats.nextMilestone}
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 14, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>Weakest Topics</div>
        {sorted.length === 0
          ? <div style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '16px 0' }}>Sync your platforms first</div>
          : sorted.map((t, i) => {
              const color = t.pct < 30 ? '#EF4444' : t.pct < 60 ? '#F59E0B' : '#22C55E'
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{t.topic}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color }}>{t.pct}%</span>
                  </div>
                  <MiniBar pct={t.pct} color={color} />
                </div>
              )
            })
        }
      </div>

      <div style={{ background: 'rgba(229,166,83,.05)', border: '1px solid rgba(229,166,83,.12)', borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9F8FE3', marginBottom: 10 }}>How problems are chosen</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(CAT_META).filter(([k]) => k !== 'mission').map(([k, m]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: m.color, marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.label}</div>
                <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>{m.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function PracticePage() {
  const navigate = useNavigate()
  const [loading,    setLoading]    = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error,      setError]      = useState(null)
  const [mission,    setMission]    = useState(null)
  const [recs,       setRecs]       = useState([])
  const [diff,       setDiff]       = useState(null)
  const [topics,     setTopics]     = useState([])
  const [stage,      setStage]      = useState(null)
  const [platforms,  setPlatforms]  = useState([])
  const [filter,     setFilter]     = useState('all')
  const [search,     setSearch]     = useState('')

  useEffect(() => {
    if (!api.isAuthenticated()) { navigate('/login'); return }
    load()
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [recRes, diffRes] = await Promise.all([
      api.authFetchJson('/recommendations/daily?limit=10'),
      api.authFetchJson('/recommendations/difficulty-progress'),
    ])

    if (recRes.ok && recRes.data) {
      const d = recRes.data
      setStage(d.learningStage || null)
      setTopics(d.skillSnapshot || [])
      setPlatforms(d.linkedPlatforms || [])
      setMission(d.dailyMission || null)

      const weakTopicNames = new Set((d.weakTopics || []).map(w => (w.topic || '').toLowerCase()))
      const raw = d.recommendations || []
      const categorised = raw.map(r => {
        const isWeak = weakTopicNames.has((r.topic || '').toLowerCase())
        let category
        if (r.difficulty === 'Hard') category = 'stretch'
        else if (isWeak && r.difficulty !== 'Easy') category = 'weakness'
        else if (isWeak) category = 'explore'
        else category = 'levelup'
        return { ...r, category, reason: r.reason || buildReason(category, r.topic, r.difficulty) }
      })
      setRecs(categorised)
    } else {
      setError(recRes.error || 'Could not load recommendations')
    }
    if (diffRes.ok && diffRes.data) setDiff(diffRes.data)
    setLoading(false)
  }, [])

  const handleComplete = useCallback(async () => {
    setCompleting(true)
    const res = await api.completeDailyMission()
    if (res.ok && res.data?.nextMission) {
      setMission(res.data.nextMission)
    } else if (mission) {
      setMission(prev => ({ ...prev, completed: true }))
    }
    setCompleting(false)
  }, [mission])

  function buildReason(cat, topic, difficulty) {
    if (cat === 'weakness') return `${topic} is a weak area. This ${difficulty} builds real strength there`
    if (cat === 'levelup')  return `You're progressing in ${topic}. This ${difficulty} stretches you further`
    if (cat === 'explore')  return `You haven't tackled ${topic} much — a great area to open up`
    if (cat === 'stretch')  return `One Hard problem per session compounds growth dramatically`
    return `Recommended based on your current skill profile`
  }

  const stageMeta = STAGE_META[stage] || STAGE_META.BEGINNER
  const today     = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })
  const catOrder  = ['all', 'weakness', 'stretch', 'levelup', 'explore']
  const catCounts = {}
  recs.forEach(r => { catCounts[r.category] = (catCounts[r.category] || 0) + 1 })
  const weakCount = recs.filter(r => r.category === 'weakness').length

  const displayed = recs.filter(r => {
    const matchCat    = filter === 'all' || r.category === filter
    const matchSearch = !search || r.title?.toLowerCase().includes(search.toLowerCase()) || r.topic?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })
  const featured = displayed[0]
  const rest     = displayed.slice(1)

  return (
    <div className="app-shell" style={{ background: 'linear-gradient(145deg,#060918,#0c1228 55%,#070b1a)' }}>
      <div style={{ position:'fixed', top:-180, right:-180, width:500, height:500, background:'radial-gradient(circle,rgba(229,166,83,.08),transparent 65%)', borderRadius:'50%', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:-120, left:80, width:380, height:380, background:'radial-gradient(circle,rgba(239,68,68,.06),transparent 65%)', borderRadius:'50%', pointerEvents:'none', zIndex:0 }} />

      <Sidebar />
      <div className="main-content" style={{ position:'relative', zIndex:1 }}>
        <Topbar title="Training Ground" subtitle={`Personalised · ${today}`} />
        <main className="page-content">

          <div style={{
            background: 'linear-gradient(135deg,rgba(229,166,83,.14),rgba(159,143,227,.07))',
            border: '1px solid rgba(229,166,83,.22)', borderRadius: 18,
            padding: '18px 22px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:48, height:48, borderRadius:12, flexShrink:0, background:'linear-gradient(135deg,#E5A653,#9F8FE3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>
                {stageMeta.icon}
              </div>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span style={{ fontSize:15, fontWeight:800 }}>Training Ground</span>
                  {stage && <Chip color={stageMeta.color}>{stageMeta.label}</Chip>}
                  {platforms.map(p => {
                    const meta = PLAT_META[p.toLowerCase()] || { color:'#E5A653', short:p, icon:'⬡' }
                    return <Chip key={p} color={meta.color} bg={`${meta.color}12`}>{meta.icon} {meta.short}</Chip>
                  })}
                </div>
                <div style={{ fontSize:12, color:'#64748B' }}>
                  {weakCount > 0
                    ? `${weakCount} weak spot${weakCount > 1 ? 's' : ''} detected · Easy, Medium and Hard problems ranked by impact`
                    : 'All topics strong · here are your next progression problems'}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:10, padding:'7px 12px' }}>
                <span style={{ fontSize:12 }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search problems…"
                  style={{ background:'transparent', border:'none', outline:'none', color:'#E2E8F0', fontSize:12, width:150 }} />
              </div>
              <button onClick={load} style={{ padding:'8px 14px', borderRadius:10, border:'1px solid rgba(255,255,255,.1)', background:'rgba(255,255,255,.05)', color:'#64748B', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                ⟳ Refresh
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.25)', borderRadius:12, padding:'10px 16px', marginBottom:14, color:'#EF4444', fontSize:13 }}>
              ⚠️ {error} — <button onClick={load} style={{ color:'#EF4444', background:'transparent', border:'none', cursor:'pointer', fontWeight:700 }}>Retry</button>
            </div>
          )}

          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:100, gap:14 }}>
              <div style={{ width:44, height:44, border:'3px solid rgba(229,166,83,.2)', borderTop:'3px solid #E5A653', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
              <div style={{ fontSize:13, color:'#64748B' }}>Analysing your skill profile…</div>
              <div style={{ fontSize:11, color:'rgba(148,163,184,.4)' }}>Fetching problems from all your linked platforms</div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20, alignItems:'start' }}>
              <div>
                <MissionCard mission={mission} onComplete={handleComplete} completing={completing} />

                <div style={{ display:'flex', gap:7, marginBottom:16, flexWrap:'wrap' }}>
                  {catOrder.map(k => {
                    const meta  = k === 'all' ? { label:'All Recs', color:'#94A3B8' } : CAT_META[k]
                    const count = k === 'all' ? recs.length : (catCounts[k] || 0)
                    const active = filter === k
                    return (
                      <button key={k} onClick={() => setFilter(k)} style={{
                        padding:'6px 13px', borderRadius:20, fontWeight:700, fontSize:11, cursor:'pointer',
                        border:`1px solid ${active ? meta.color : 'rgba(255,255,255,.08)'}`,
                        background: active ? `${meta.color}20` : 'rgba(255,255,255,.03)',
                        color: active ? meta.color : '#64748B',
                        transition:'all .18s', display:'flex', alignItems:'center', gap:5,
                      }}>
                        {meta.label}
                        {count > 0 && (
                          <span style={{ fontSize:9, fontWeight:800, background: active ? meta.color : 'rgba(255,255,255,.1)', color: active ? '#fff' : '#64748B', borderRadius:20, padding:'1px 5px' }}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {displayed.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'48px 32px', background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.06)', borderRadius:18 }}>
                    <div style={{ fontSize:42, marginBottom:12 }}>🎉</div>
                    <div style={{ fontSize:16, fontWeight:800, marginBottom:6 }}>All caught up!</div>
                    <div style={{ fontSize:12, color:'#64748B', marginBottom:16 }}>No problems match this filter. Try "All Recs" or sync your platforms.</div>
                    <button onClick={() => { setFilter('all'); setSearch('') }}
                      style={{ padding:'9px 22px', borderRadius:11, background:'linear-gradient(135deg,#E5A653,#9F8FE3)', color:'#fff', fontWeight:700, fontSize:13, border:'none', cursor:'pointer' }}>
                      Show All
                    </button>
                  </div>
                ) : (
                  <>
                    {featured && <div style={{ marginBottom:14 }}><ProblemCard problem={featured} category={featured.category} featured /></div>}
                    {rest.length > 0 && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
                        {rest.map((p, i) => <ProblemCard key={p.titleSlug || i} problem={p} category={p.category} />)}
                      </div>
                    )}
                  </>
                )}
              </div>

              <SkillPanel topics={topics} diffStats={diff} platforms={platforms} />
            </div>
          )}
        </main>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
