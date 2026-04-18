import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/TopBar'
import * as api from '../services/api'

// ─── Preset definitions (compact) ────────────────────────────────────────────
const PRESETS = {
    BEGINNER: { label: 'Beginner', color: '#22C55E', easy: 2, medium: 1, hard: 0, mins: 30 },
    MEDIUM:   { label: 'Balanced', color: '#F59E0B', easy: 1, medium: 3, hard: 1, mins: 45 },
    HARD:     { label: 'Hard',     color: '#EF4444', easy: 0, medium: 2, hard: 3, mins: 60 },
    CUSTOM:   { label: 'Custom',   color: '#9F8FE3', easy: 0, medium: 0, hard: 0, mins: 0  },
}

function calcMins(e, m, h) { return Math.max(10, e * 10 + m * 15 + h * 20) }

function problemsLabel(preset, custom) {
    const { easy: e, medium: m, hard: h } = preset === 'CUSTOM' ? custom : PRESETS[preset]
    const parts = []
    if (e > 0) parts.push(`${e}E`)
    if (m > 0) parts.push(`${m}M`)
    if (h > 0) parts.push(`${h}H`)
    return parts.length ? parts.join(' + ') : '—'
}

function durationLabel(preset, custom) {
    if (preset !== 'CUSTOM') return `${PRESETS[preset].mins} min`
    const { easy: e, medium: m, hard: h } = custom
    return `~${calcMins(e, m, h)} min`
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function timeAgo(iso) {
    if (!iso) return ''
    const s = (Date.now() - new Date(iso)) / 1000
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
}

const STATUS_META = {
    PENDING:   { color: '#F59E0B', label: 'Pending',  dot: '⏳' },
    ACTIVE:    { color: '#22C55E', label: 'Live',     dot: '🟢' },
    COMPLETED: { color: '#E5A653', label: 'Done',     dot: '✅' },
    EXPIRED:   { color: '#64748B', label: 'Expired',  dot: '💤' },
    DECLINED:  { color: '#EF4444', label: 'Declined', dot: '❌' },
}

// ─── Compact preset picker (shared between Duel and Contest) ──────────────────
function PresetPicker({ value, onChange }) {
    return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(PRESETS).map(([k, v]) => {
                const sel = value === k
                return (
                    <button key={k} type="button" onClick={() => onChange(k)} style={{
                        padding: '7px 16px', borderRadius: 20, fontSize: 12.5, fontWeight: 700,
                        cursor: 'pointer', border: `1.5px solid ${sel ? v.color : 'rgba(255,255,255,.1)'}`,
                        background: sel ? `${v.color}18` : 'rgba(255,255,255,.03)',
                        color: sel ? v.color : '#64748B', transition: 'all .18s',
                    }}>
                        {v.label}
                        {k !== 'CUSTOM' && <span style={{ fontWeight: 400, fontSize: 10.5, marginLeft: 6, opacity: .75 }}>
                            {v.easy > 0 ? `${v.easy}E ` : ''}{v.medium > 0 ? `${v.medium}M ` : ''}{v.hard > 0 ? `${v.hard}H` : ''}
                        </span>}
                    </button>
                )
            })}
        </div>
    )
}

// ─── Custom question count inputs ──────────────────────────────────────────────
function CustomInputs({ value, onChange }) {
    const fields = [
        { key: 'easy',   label: 'Easy',   color: '#22C55E' },
        { key: 'medium', label: 'Medium', color: '#F59E0B' },
        { key: 'hard',   label: 'Hard',   color: '#EF4444' },
    ]
    return (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
            {fields.map(({ key, label, color }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 10.5, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>
                    <input
                        type="number" min={0} max={10}
                        value={value[key]}
                        onChange={e => onChange({ ...value, [key]: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })}
                        style={{ width: 58, padding: '8px 10px', borderRadius: 9, border: `1.5px solid ${color}40`, background: `${color}0a`, color, fontSize: 16, fontWeight: 800, textAlign: 'center', outline: 'none' }}
                    />
                </div>
            ))}
            <div style={{ fontSize: 11, color: '#475569', paddingBottom: 10 }}>
                {calcMins(value.easy, value.medium, value.hard)} min est.
            </div>
        </div>
    )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ n, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(229,166,83,.2)', border: '1px solid rgba(229,166,83,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#9F8FE3', flexShrink: 0 }}>{n}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.07em' }}>{children}</span>
        </div>
    )
}

// ─── Back button ──────────────────────────────────────────────────────────────
function BackBtn({ onBack }) {
    return (
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', color: '#64748B', padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 28 }}>
            ← Back
        </button>
    )
}

// ─── Duel setup ───────────────────────────────────────────────────────────────
function DuelSetup({ onBack, onSuccess, myEmail }) {
    const navigate = useNavigate()
    const [opponent, setOpponent] = useState('')
    const [preset, setPreset] = useState('BEGINNER')
    const [custom, setCustom] = useState({ easy: 1, medium: 2, hard: 1 })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(null)

    async function handleSubmit(e) {
        e.preventDefault()
        const handle = opponent.trim().toLowerCase().replace(/^@/, '')
        if (!handle) { setError("Enter your opponent's @username"); return }
        if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
            setError('Invalid username — 3–30 chars, letters/digits/underscore only')
            return
        }
        if (preset === 'CUSTOM' && custom.easy + custom.medium + custom.hard === 0) {
            setError('Add at least one problem'); return
        }
        setLoading(true); setError('')
        const counts = preset === 'CUSTOM' ? { easyCount: custom.easy, mediumCount: custom.medium, hardCount: custom.hard } : {}
        // Call createChallenge by @username (second positional arg is the
        // preset, which api.js forwards as contestType).
        const r = await api.createChallenge({ opponentUsername: handle }, preset, counts)
        setLoading(false)
        if (r.success) { setSuccess(r.data) }
        else { setError(r.error) }
    }

    if (success) {
        return (
            <div style={{ maxWidth: 540 }}>
                <BackBtn onBack={() => { setSuccess(null); onBack() }} />
                <div style={{ background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 18, padding: '32px 36px', textAlign: 'center' }}>
                    <div style={{ fontSize: 44, marginBottom: 14 }}>⚔️</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#22C55E', marginBottom: 8 }}>Challenge Sent!</div>
                    <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 22, lineHeight: 1.6 }}>
                        Duel <strong style={{ color: '#F1F5F9' }}>#{success.id}</strong> sent to <strong style={{ color: '#F1F5F9' }}>{success.opponentName || success.opponentId}</strong>.<br />Waiting for them to accept.
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => navigate(`/contest/${success.id}`)} style={{ background: 'rgba(229,166,83,.15)', border: '1px solid rgba(229,166,83,.3)', color: '#9F8FE3', padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>View Duel →</button>
                        <button onClick={() => { setSuccess(null); onBack() }} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#64748B', padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Back to Challenges</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 560 }}>
            <BackBtn onBack={onBack} />
            <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>⚔️ Get Ready for Duel</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>Pick your opponent, set your challenge, start the fight.</div>
            </div>

            {error && (
                <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#EF4444', padding: '10px 14px', borderRadius: 11, fontSize: 13, marginBottom: 20 }}>{error}</div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* Step 1 — opponent */}
                <div>
                    <SectionLabel n={1}>Who are you challenging?</SectionLabel>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none', color: 'var(--amber)', fontWeight: 700 }}>@</span>
                        <input
                            type="text"
                            required
                            value={opponent}
                            onChange={e => {
                                // Strip @ prefix + illegal chars + force lowercase as they type —
                                // mirrors the signup field so wrong input can't even get typed in.
                                const v = e.target.value.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '')
                                setOpponent(v)
                            }}
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            maxLength={30}
                            placeholder="their_handle"
                            style={{ width: '100%', padding: '12px 14px 12px 36px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(255,255,255,.1)', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s' }}
                            onFocus={e => e.target.style.borderColor = 'rgba(229,166,83,.5)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'}
                        />
                    </div>
                    <div className="accent-hand" style={{ marginTop: 6, fontSize: 14, color: 'var(--text-muted)' }}>
                        their AlgoLedger username — not their email
                    </div>
                </div>

                {/* Step 2 — format */}
                <div>
                    <SectionLabel n={2}>Choose your format</SectionLabel>
                    <PresetPicker value={preset} onChange={setPreset} />
                    {preset === 'CUSTOM' && <CustomInputs value={custom} onChange={setCustom} />}
                    {preset !== 'CUSTOM' && (
                        <div style={{ marginTop: 10, fontSize: 11.5, color: '#475569' }}>
                            {problemsLabel(preset, custom)} · {durationLabel(preset, custom)}
                        </div>
                    )}
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading} style={{ background: loading ? 'rgba(229,166,83,.35)' : 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: '#fff', border: 'none', padding: '13px 28px', borderRadius: 12, fontWeight: 800, fontSize: 14.5, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 6px 22px rgba(229,166,83,.45)', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {loading ? <><Spin /> Sending…</> : '⚔️ Send Duel Invite'}
                </button>
            </form>
        </div>
    )
}

// ─── Contest setup ────────────────────────────────────────────────────────────
function ContestSetup({ onBack }) {
    const [name, setName] = useState('')
    const [emails, setEmails] = useState([''])
    const [maxPeople, setMaxPeople] = useState(8)
    const [preset, setPreset] = useState('MEDIUM')
    const [custom, setCustom] = useState({ easy: 2, medium: 3, hard: 2 })
    const [inviteLink, setInviteLink] = useState('')
    const [copied, setCopied] = useState(false)

    function addEmail() { setEmails(prev => [...prev, '']) }
    function removeEmail(i) { setEmails(prev => prev.filter((_, idx) => idx !== i)) }
    function updateEmail(i, v) { setEmails(prev => prev.map((e, idx) => idx === i ? v : e)) }

    function generateLink() {
        const token = Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
        const link = `${window.location.origin}/contest/join/${token}`
        setInviteLink(link)
    }

    function copyLink() {
        navigator.clipboard.writeText(inviteLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    }

    function handleCreate(e) {
        e.preventDefault()
        generateLink()
    }

    return (
        <div style={{ maxWidth: 600 }}>
            <BackBtn onBack={onBack} />
            <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🏆 Organize a Contest</div>
                <div style={{ fontSize: 13, color: '#64748B' }}>Set up a group coding contest, invite participants via link.</div>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                {/* Step 1 — name */}
                <div>
                    <SectionLabel n={1}>Contest name</SectionLabel>
                    <input
                        value={name} onChange={e => setName(e.target.value)}
                        placeholder="e.g. Friday Night Grind, Team Qualifier…"
                        style={{ width: '100%', padding: '11px 14px', borderRadius: 11, background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(255,255,255,.1)', color: '#F1F5F9', fontSize: 13.5, outline: 'none', boxSizing: 'border-box', transition: 'border-color .2s' }}
                        onFocus={e => e.target.style.borderColor = 'rgba(229,166,83,.5)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'}
                    />
                </div>

                {/* Step 2 — participants */}
                <div>
                    <SectionLabel n={2}>Invite participants</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {emails.map((em, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                    type="email" value={em}
                                    onChange={e => updateEmail(i, e.target.value)}
                                    placeholder={`Participant ${i + 1} email`}
                                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1.5px solid rgba(255,255,255,.08)', color: '#F1F5F9', fontSize: 13, outline: 'none', transition: 'border-color .2s' }}
                                    onFocus={e => e.target.style.borderColor = 'rgba(229,166,83,.4)'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.08)'}
                                />
                                {emails.length > 1 && (
                                    <button type="button" onClick={() => removeEmail(i)} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#EF4444', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addEmail} style={{ alignSelf: 'flex-start', padding: '7px 16px', borderRadius: 9, background: 'rgba(229,166,83,.08)', border: '1px solid rgba(229,166,83,.2)', color: '#9F8FE3', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            + Add participant
                        </button>
                    </div>

                    {/* Max participants */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'rgba(255,255,255,.03)', borderRadius: 11, border: '1px solid rgba(255,255,255,.07)' }}>
                        <span style={{ fontSize: 12.5, color: '#94A3B8', fontWeight: 600 }}>Max participants</span>
                        <input
                            type="number" min={2} max={50} value={maxPeople}
                            onChange={e => setMaxPeople(Math.min(50, Math.max(2, Number(e.target.value) || 2)))}
                            style={{ width: 64, padding: '6px 10px', borderRadius: 8, border: '1.5px solid rgba(229,166,83,.3)', background: 'rgba(229,166,83,.08)', color: '#9F8FE3', fontSize: 15, fontWeight: 800, textAlign: 'center', outline: 'none' }}
                        />
                        <span style={{ fontSize: 11, color: '#475569' }}>people can join via link</span>
                    </div>
                </div>

                {/* Step 3 — format */}
                <div>
                    <SectionLabel n={3}>Set the question format</SectionLabel>
                    <PresetPicker value={preset} onChange={setPreset} />
                    {preset === 'CUSTOM' && <CustomInputs value={custom} onChange={setCustom} />}
                    {preset !== 'CUSTOM' && (
                        <div style={{ marginTop: 10, fontSize: 11.5, color: '#475569' }}>
                            {problemsLabel(preset, custom)} · {durationLabel(preset, custom)}
                        </div>
                    )}
                </div>

                {/* Invite link display */}
                {inviteLink && (
                    <div style={{ background: 'rgba(229,166,83,.06)', border: '1px solid rgba(229,166,83,.2)', borderRadius: 14, padding: '18px 20px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9F8FE3', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>🔗 Invite Link</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <div style={{ flex: 1, padding: '9px 14px', borderRadius: 9, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', fontSize: 12, color: '#94A3B8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {inviteLink}
                            </div>
                            <button type="button" onClick={copyLink} style={{ padding: '9px 16px', borderRadius: 9, background: copied ? 'rgba(34,197,94,.15)' : 'rgba(229,166,83,.15)', border: `1px solid ${copied ? 'rgba(34,197,94,.3)' : 'rgba(229,166,83,.3)'}`, color: copied ? '#22C55E' : '#9F8FE3', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Share this link with anyone — up to {maxPeople} people can join.</div>
                    </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" onClick={generateLink} style={{ padding: '11px 22px', borderRadius: 11, background: 'rgba(229,166,83,.12)', border: '1px solid rgba(229,166,83,.25)', color: '#9F8FE3', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        🔗 {inviteLink ? 'Regenerate Link' : 'Generate Invite Link'}
                    </button>
                    <button type="submit" style={{ padding: '11px 26px', borderRadius: 11, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', border: 'none', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 6px 20px rgba(245,158,11,.35)' }}>
                        🏆 Create Contest
                    </button>
                </div>
            </form>
        </div>
    )
}

// ─── Challenge row (compact) ──────────────────────────────────────────────────
function ChallengeRow({ c, myEmail, onNavigate }) {
    const sm = STATUS_META[c.status] || { color: '#94A3B8', label: c.status, dot: '•' }
    const preset = PRESETS[c.contestType] || PRESETS.MEDIUM
    const isChallenger = c.challengerId === myEmail
    const opponent = isChallenger ? (c.opponentName || c.opponentId) : (c.challengerName || c.challengerId)
    const iWon = c.winnerId === myEmail
    const isActive = c.status === 'ACTIVE'

    return (
        <div onClick={() => onNavigate(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderRadius: 13, background: 'rgba(255,255,255,.025)', border: `1px solid ${isActive ? 'rgba(34,197,94,.18)' : 'rgba(255,255,255,.06)'}`, cursor: 'pointer', transition: 'all .18s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.025)'; e.currentTarget.style.transform = 'translateY(0)' }}>

            {/* Type icon */}
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${preset.color}12`, border: `1px solid ${preset.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {c.contestType === 'BEGINNER' ? '⚡' : c.contestType === 'HARD' ? '💀' : c.contestType === 'CUSTOM' ? '🎨' : '🔥'}
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>vs {opponent}</span>
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 20, background: `${sm.color}15`, color: sm.color, fontWeight: 700 }}>{sm.dot} {sm.label}</span>
                    {!isChallenger && <span style={{ fontSize: 9, color: '#475569', background: 'rgba(255,255,255,.05)', padding: '2px 7px', borderRadius: 20 }}>Invited</span>}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>#{c.id} · {preset.label} · {timeAgo(c.createdAt)}</div>
            </div>

            {/* Result / action */}
            <div style={{ flexShrink: 0 }}>
                {c.winnerId ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: iWon ? '#22C55E' : '#EF4444' }}>{iWon ? '🏆 Won' : '😔 Lost'}</span>
                ) : isActive ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#22C55E' }}>▶ Join</span>
                ) : (
                    <span style={{ fontSize: 11, color: '#475569' }}>View →</span>
                )}
            </div>
        </div>
    )
}

// ─── Invitation card (compact) ────────────────────────────────────────────────
function InvitationRow({ c, onAccept, onDecline, actionLoading }) {
    const preset = PRESETS[c.contestType] || PRESETS.MEDIUM
    const acc = actionLoading === c.id + '-accept'
    const dec = actionLoading === c.id + '-decline'
    return (
        <div style={{ padding: '16px 20px', borderRadius: 14, background: `${preset.color}06`, border: `1px solid ${preset.color}20` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 3 }}>
                        <span style={{ color: preset.color }}>{c.challengerName || c.challengerId}</span>
                        <span style={{ color: '#64748B', fontWeight: 400 }}> challenged you to a </span>
                        <span style={{ color: '#E2E8F0' }}>{preset.label} Duel</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#475569' }}>
                        {PRESETS[c.contestType]?.easy > 0 ? `${PRESETS[c.contestType].easy}E ` : ''}
                        {PRESETS[c.contestType]?.medium > 0 ? `${PRESETS[c.contestType].medium}M ` : ''}
                        {PRESETS[c.contestType]?.hard > 0 ? `${PRESETS[c.contestType].hard}H` : ''}
                        {c.contestType === 'CUSTOM' ? 'Custom mix' : ''}
                        {' · '}{timeAgo(c.createdAt)}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onDecline(c.id)} disabled={dec || acc} style={{ padding: '8px 16px', borderRadius: 9, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (dec || acc) ? .5 : 1 }}>
                        {dec ? '…' : 'Decline'}
                    </button>
                    <button onClick={() => onAccept(c.id)} disabled={acc || dec} style={{ padding: '8px 20px', borderRadius: 9, background: `linear-gradient(135deg,${preset.color},${preset.color}cc)`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: (acc || dec) ? .7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {acc ? <><Spin /> Starting…</> : '⚔️ Accept'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function Spin() {
    return <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ChallengePage() {
    const navigate = useNavigate()
    const [view, setView] = useState('home')     // 'home' | 'duel' | 'contest'
    const [histTab, setHistTab] = useState('mine') // 'mine' | 'invitations'
    const [myChallenges, setMyChallenges] = useState([])
    const [invitations, setInvitations] = useState([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(null)
    const [stats, setStats] = useState({ wins: 0, losses: 0, pending: 0, total: 0 })
    const myEmail = api.getUserEmail()

    useEffect(() => {
        if (!api.isAuthenticated()) { navigate('/login'); return }
        loadAll()
    }, [])

    async function loadAll() {
        setLoading(true)
        const [mc, inv] = await Promise.all([api.fetchMyChallenges(), api.fetchInvitations()])
        if (mc.success) { setMyChallenges(mc.data); computeStats(mc.data) }
        if (inv.success) setInvitations(inv.data)
        setLoading(false)
    }

    function computeStats(list) {
        setStats({
            wins:    list.filter(c => c.winnerId === myEmail).length,
            losses:  list.filter(c => c.winnerId && c.winnerId !== myEmail && c.status === 'COMPLETED').length,
            pending: list.filter(c => c.status === 'PENDING' || c.status === 'ACTIVE').length,
            total:   list.length,
        })
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
        await loadAll()
        setActionLoading(null)
    }

    const pendingCount = invitations.length

    // ── Duel / Contest views ──
    if (view === 'duel') {
        return (
            <Shell title="1v1 Duel" subtitle="Challenge a friend to a coding duel">
                <DuelSetup onBack={() => setView('home')} myEmail={myEmail} />
            </Shell>
        )
    }
    if (view === 'contest') {
        return (
            <Shell title="Organize Contest" subtitle="Set up a group coding contest">
                <ContestSetup onBack={() => setView('home')} />
            </Shell>
        )
    }

    // ── Home view ──
    return (
        <Shell title="Challenges" subtitle="Compete, improve, dominate">

            {/* ── Stats strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 28 }}>
                {[
                    { label: 'Wins',   value: stats.wins,    color: '#22C55E', icon: '🏆' },
                    { label: 'Losses', value: stats.losses,  color: '#EF4444', icon: '😔' },
                    { label: 'Active', value: stats.pending, color: '#F59E0B', icon: '⚔️' },
                    { label: 'Total',  value: stats.total,   color: '#E5A653', icon: '📊' },
                ].map(s => (
                    <div key={s.label} style={{ background: `${s.color}08`, border: `1px solid ${s.color}20`, borderRadius: 13, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{s.icon}</div>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                            <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Action cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>

                {/* Duel card */}
                <div onClick={() => setView('duel')} style={{ borderRadius: 18, padding: '28px 28px', background: 'linear-gradient(135deg,rgba(229,166,83,.12),rgba(159,143,227,.08))', border: '1px solid rgba(229,166,83,.25)', cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(229,166,83,.2)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'radial-gradient(circle,rgba(229,166,83,.15),transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                    <div style={{ fontSize: 36, marginBottom: 14 }}>⚔️</div>
                    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6, color: '#E2E8F0' }}>1v1 Duel</div>
                    <div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.6, marginBottom: 18 }}>Challenge a friend head-to-head. Choose your format, pick your problems, fight.</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: '#fff', padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
                        Get Ready for Duel →
                    </div>
                </div>

                {/* Contest card */}
                <div onClick={() => setView('contest')} style={{ borderRadius: 18, padding: '28px 28px', background: 'linear-gradient(135deg,rgba(245,158,11,.1),rgba(239,68,68,.07))', border: '1px solid rgba(245,158,11,.2)', cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(245,158,11,.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                    <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: 'radial-gradient(circle,rgba(245,158,11,.12),transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                    <div style={{ fontSize: 36, marginBottom: 14 }}>🏆</div>
                    <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6, color: '#E2E8F0' }}>Group Contest</div>
                    <div style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.6, marginBottom: 18 }}>Organize a coding contest for your team. Set questions, cap participants, share an invite link.</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#F59E0B,#EF4444)', color: '#fff', padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13 }}>
                        Organize Contest →
                    </div>
                </div>
            </div>

            {/* ── History tabs ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.03)', padding: 3, borderRadius: 10, border: '1px solid rgba(255,255,255,.06)' }}>
                    {[
                        ['mine', '📋 My Challenges'],
                        ['invitations', `📬 Invitations${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
                    ].map(([k, l]) => (
                        <button key={k} onClick={() => setHistTab(k)} style={{ padding: '6px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none', transition: 'all .18s', background: histTab === k ? 'linear-gradient(135deg,#E5A653,#9F8FE3)' : 'transparent', color: histTab === k ? '#fff' : '#64748B', boxShadow: histTab === k ? '0 3px 10px rgba(229,166,83,.35)' : 'none' }}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── My Challenges ── */}
            {histTab === 'mine' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {loading && <div style={{ textAlign: 'center', padding: 40, color: '#475569', fontSize: 13 }}>Loading…</div>}
                    {!loading && myChallenges.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>⚔️</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 6 }}>No challenges yet</div>
                            <div style={{ fontSize: 12 }}>Start a duel to see your history here.</div>
                        </div>
                    )}
                    {myChallenges.map(c => (
                        <ChallengeRow key={c.id} c={c} myEmail={myEmail} onNavigate={id => navigate(`/contest/${id}`)} />
                    ))}
                </div>
            )}

            {/* ── Invitations ── */}
            {histTab === 'invitations' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {loading && <div style={{ textAlign: 'center', padding: 40, color: '#475569', fontSize: 13 }}>Loading…</div>}
                    {!loading && invitations.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#475569' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 6 }}>No pending invitations</div>
                            <div style={{ fontSize: 12 }}>When someone challenges you, it'll show here.</div>
                        </div>
                    )}
                    {invitations.map(c => (
                        <InvitationRow key={c.id} c={c} onAccept={handleAccept} onDecline={handleDecline} actionLoading={actionLoading} />
                    ))}
                </div>
            )}

        </Shell>
    )
}

// ─── Shell wrapper (keeps sidebar + topbar consistent across views) ────────────
function Shell({ title, subtitle, children }) {
    return (
        <div className="app-shell" style={{ background: 'linear-gradient(135deg,#0B0F1A,#121727 50%,#06091a)' }}>
            <div style={{ position: 'fixed', top: -200, right: -100, width: 600, height: 600, background: 'radial-gradient(circle,rgba(229,166,83,.07),transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
            <Sidebar />
            <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
                <Topbar title={title} subtitle={subtitle} />
                <main className="page-content">{children}</main>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )
}
