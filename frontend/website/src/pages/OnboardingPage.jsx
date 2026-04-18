/**
 * OnboardingPage.jsx
 * ──────────────────
 * Multi-step onboarding with proof-of-ownership verification.
 *
 * The "prove you own the account" challenge is back: the user types their
 * handle, clicks Link, the backend picks a target problem (LeetCode: Two Sum,
 * Codeforces: 4A Watermelon) and records startTime. The user submits that
 * problem on the real platform, clicks Check, and the backend scans their
 * recent submissions for an Accepted entry after startTime. Verified only
 * then. All of this now runs against the main backend (port 8080) — the
 * old separate-service-on-port-4000 dependency is gone.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../services/api'

const STEPS = ['Skill Level', 'Platforms', 'Companies']

const SKILLS = [
    { id: 'beginner', icon: '🌱', name: 'Beginner', desc: '0–100 problems' },
    { id: 'intermediate', icon: '⚡', name: 'Intermediate', desc: '100–400 problems' },
    { id: 'advanced', icon: '🔥', name: 'Advanced', desc: '400+ problems' },
]

const COMPANIES = [
    'Google', 'Amazon', 'Microsoft', 'Meta', 'Adobe',
    'Flipkart', 'Infosys', 'TCS', 'Wipro', 'Uber',
    'Goldman Sachs', 'DE Shaw',
]

const PLATFORM_CONFIG = [
    { key: 'leetcode', label: 'LeetCode', color: '#FFA116', placeholder: 'e.g. rahul_codes' },
    { key: 'codeforces', label: 'Codeforces', color: '#1890FF', placeholder: 'e.g. rahul_cf' },
]

export default function OnboardingPage() {
    const navigate = useNavigate()
    const [step, setStep] = useState(0)
    const [skill, setSkill] = useState(null)
    const [selectedCompanies, setSelectedCompanies] = useState([])

    // Platform verification state.
    //   status = 'idle'      → user is typing a handle
    //            'pending'   → server picked a problem; waiting on the user
    //                          to submit it on the real platform
    //            'checking'  → we're polling the platform's recent submissions
    //            'verified'  → proof accepted
    const [platformState, setPlatformState] = useState({
        leetcode: {
            username: '', status: 'idle', problemUrl: null, problemName: null,
            problemSlug: null, startTime: null, message: '', loading: false,
        },
        codeforces: {
            username: '', status: 'idle', problemUrl: null, problemName: null,
            problemSlug: null, startTime: null, message: '', loading: false,
        },
    })

    useEffect(() => {
        if (!api.isAuthenticated()) { navigate('/login') }
    }, [navigate])

    const updatePlatform = (key, updates) => {
        setPlatformState(prev => ({ ...prev, [key]: { ...prev[key], ...updates } }))
    }

    const toggleCompany = c => {
        setSelectedCompanies(prev =>
            prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
        )
    }

    const hasVerified = Object.values(platformState).some(p => p.status === 'verified')

    const canProceed = () => {
        if (step === 0) return !!skill
        if (step === 1) return hasVerified
        return selectedCompanies.length > 0
    }

    // ── Step 1: tell the backend which handle we want to verify; it confirms
    //           the account exists, picks a problem, and hands us a startTime. ──
    const handleStart = async (platformKey) => {
        const ps = platformState[platformKey]
        const handle = ps.username.trim()
        if (!handle) {
            updatePlatform(platformKey, { message: 'Please enter a username first.' })
            return
        }
        updatePlatform(platformKey, { loading: true, message: '' })
        try {
            const r = await api.verifyStart(platformKey, handle)
            if (r.success) {
                updatePlatform(platformKey, {
                    status: 'pending',
                    problemSlug: r.data.problemSlug,
                    problemName: r.data.problemName,
                    problemUrl:  r.data.problemUrl,
                    startTime:   r.data.startTime,
                    loading: false,
                    message: '',
                })
            } else {
                updatePlatform(platformKey, {
                    loading: false,
                    message: r.message || "Couldn't find that account. Check the spelling.",
                })
            }
        } catch (e) {
            updatePlatform(platformKey, {
                loading: false,
                message: "Couldn't reach the verification service. Please try again in a moment.",
            })
        }
    }

    // ── Step 2: check the platform's recent submissions for proof of ownership. ──
    const handleCheck = async (platformKey) => {
        const ps = platformState[platformKey]
        if (!ps.problemSlug || !ps.startTime) return
        updatePlatform(platformKey, { loading: true, message: '', status: 'checking' })
        try {
            const r = await api.verifyCheck(platformKey, ps.username.trim(), ps.problemSlug, ps.startTime)
            if (r.success) {
                updatePlatform(platformKey, {
                    status: 'verified',
                    loading: false,
                    message: '✅ Ownership confirmed!',
                })
                api.savePlatformVerified(platformKey, ps.username.trim(), true, new Date().toISOString())
            } else {
                // Not found yet — stay in 'pending' so the Check button and
                // problem link remain visible and the user can retry.
                updatePlatform(platformKey, {
                    status: 'pending',
                    loading: false,
                    message: r.message || "Submission not found yet. Try again after you submit.",
                })
            }
        } catch (e) {
            updatePlatform(platformKey, {
                status: 'pending',
                loading: false,
                message: 'Network error during check. Try again.',
            })
        }
    }

    // ── Reset a platform back to idle (lets the user try a different handle). ──
    const handleReset = (platformKey) => {
        updatePlatform(platformKey, {
            status: 'idle', problemUrl: null, problemName: null, problemSlug: null,
            startTime: null, message: '', loading: false,
        })
    }

    const handleFinish = async () => {
        for (const [key, ps] of Object.entries(platformState)) {
            if (ps.status === 'verified' && ps.username.trim()) {
                try { await api.linkPlatform(key, ps.username.trim()) }
                catch (err) { console.error(`Failed to link ${key}:`, err) }
            }
        }
        navigate('/dashboard')
    }

    return (
        <div className="onboarding-page">
            <div className="onboarding-card">
                {/* Step indicator */}
                <div className="progress-bar-wrap">
                    <div className="progress-steps">
                        {STEPS.map((label, i) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                <div className="progress-step">
                                    <div className={`step-circle ${i < step ? 'done' : i === step ? 'active' : 'pending'}`}>
                                        {i < step ? '✓' : i + 1}
                                    </div>
                                    <span className="step-label">{label}</span>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className={`step-connector ${i < step ? 'done' : ''}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step 0 — Skill Level */}
                {step === 0 && (
                    <>
                        <h2 className="onb-title">What's your current level?</h2>
                        <p className="onb-sub">We'll personalize your experience based on where you are now.</p>
                        <div className="skill-options">
                            {SKILLS.map(s => (
                                <div
                                    key={s.id}
                                    className={`skill-option ${skill === s.id ? 'selected' : ''}`}
                                    onClick={() => setSkill(s.id)}
                                    id={`skill-${s.id}`}
                                >
                                    <div className="skill-icon">{s.icon}</div>
                                    <div className="skill-name">{s.name}</div>
                                    <div className="skill-desc">{s.desc}</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Step 1 — Platforms with Submission-based Verification */}
                {step === 1 && (
                    <>
                        <h2 className="onb-title">Verify your platforms</h2>
                        <p className="onb-sub">Prove account ownership by solving a quick problem. We'll check your recent submissions.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                            {PLATFORM_CONFIG.map(p => {
                                const ps = platformState[p.key]
                                return (
                                    <div key={p.key} style={{
                                        padding: 16, borderRadius: 12,
                                        border: ps.status === 'verified' ? '2px solid #22C55E' : '1px solid var(--border)',
                                        background: ps.status === 'verified' ? 'rgba(34,197,94,0.05)' : 'var(--bg-card)',
                                    }}>
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <span style={{ fontWeight: 700, color: p.color, fontSize: 15 }}>{p.label}</span>
                                            {ps.status === 'verified' && (
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                                                    background: 'rgba(136,192,163,0.15)', color: 'var(--sage)',
                                                }}>✓ Verified</span>
                                            )}
                                            {(ps.status === 'pending' || ps.status === 'checking') && (
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700,
                                                    background: 'rgba(229,166,83,0.15)', color: 'var(--amber)',
                                                }}>⏳ Awaiting submission</span>
                                            )}
                                        </div>

                                        {/* Idle: username input + Link button */}
                                        {ps.status === 'idle' && (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input
                                                    id={`platform-${p.key}`}
                                                    type="text"
                                                    className="input-field"
                                                    placeholder={p.placeholder}
                                                    value={ps.username}
                                                    onChange={e => updatePlatform(p.key, { username: e.target.value })}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleStart(p.key) }}
                                                    style={{ flex: 1 }}
                                                    disabled={ps.loading}
                                                    autoComplete="off"
                                                    autoCapitalize="off"
                                                    spellCheck={false}
                                                />
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => handleStart(p.key)}
                                                    disabled={ps.loading || !ps.username.trim()}
                                                    style={{ whiteSpace: 'nowrap' }}
                                                >
                                                    {ps.loading ? '⏳…' : '🔗 Link'}
                                                </button>
                                            </div>
                                        )}

                                        {/* Pending/checking: show the target problem + the Check button */}
                                        {(ps.status === 'pending' || ps.status === 'checking') && ps.problemUrl && (
                                            <div style={{ marginTop: 4 }}>
                                                <div style={{
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px dashed var(--border)',
                                                    borderRadius: 10,
                                                    padding: 12,
                                                    marginBottom: 10,
                                                }}>
                                                    <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)', fontSize: 13 }}>
                                                        Prove you own <b>@{ps.username}</b>:
                                                    </div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginBottom: 4 }}>
                                                        1. Open the problem below and submit <i>anything</i> — even a wrong answer is fine
                                                    </div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginBottom: 10 }}>
                                                        2. Come back and hit <b>Check Submission</b>
                                                    </div>
                                                    <a
                                                        href={ps.problemUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            display: 'inline-block',
                                                            padding: '7px 14px', borderRadius: 7,
                                                            background: 'var(--amber-light)',
                                                            color: 'var(--amber)', fontWeight: 700,
                                                            fontSize: 13, textDecoration: 'none',
                                                        }}
                                                    >
                                                        🔗 {ps.problemName || 'Open Problem'}
                                                    </a>
                                                    <div className="accent-hand" style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 10 }}>
                                                        only submissions after you clicked Link count — we record the timestamp server-side
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        onClick={() => handleCheck(p.key)}
                                                        disabled={ps.loading}
                                                        style={{ flex: 1 }}
                                                    >
                                                        {ps.loading ? '⏳ Checking…' : '✓ Check Submission'}
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => handleReset(p.key)}
                                                        disabled={ps.loading}
                                                    >
                                                        ↩ Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Verified */}
                                        {ps.status === 'verified' && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                    Verified as <b style={{ color: 'var(--text-primary)' }}>@{ps.username}</b>
                                                </div>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleReset(p.key)}
                                                    style={{ fontSize: 12 }}
                                                >
                                                    Change
                                                </button>
                                            </div>
                                        )}

                                        {/* Error / info messages */}
                                        {ps.message && (
                                            <div style={{
                                                marginTop: 8, fontSize: 12, fontWeight: 600,
                                                color: ps.status === 'verified' ? 'var(--sage)' : 'var(--rose)',
                                            }}>
                                                {ps.message}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                            ✓ Verify at least one platform to continue
                        </p>
                    </>
                )}

                {/* Step 2 — Companies */}
                {step === 2 && (
                    <>
                        <h2 className="onb-title">Target companies</h2>
                        <p className="onb-sub">Select companies you're targeting. We'll tailor problem recommendations accordingly.</p>
                        <div className="companies-grid">
                            {COMPANIES.map(c => (
                                <div
                                    key={c}
                                    id={`company-${c.replace(/\s/g, '-').toLowerCase()}`}
                                    className={`company-chip ${selectedCompanies.includes(c) ? 'selected' : ''}`}
                                    onClick={() => toggleCompany(c)}
                                >
                                    {c}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, gap: 12 }}>
                    {step > 0 ? (
                        <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>
                            ← Back
                        </button>
                    ) : <div />}

                    {step < STEPS.length - 1 ? (
                        <button
                            id="onb-next"
                            className="btn btn-primary"
                            disabled={!canProceed()}
                            onClick={() => setStep(s => s + 1)}
                            style={{ opacity: canProceed() ? 1 : 0.5 }}
                        >
                            Continue →
                        </button>
                    ) : (
                        <button
                            id="onb-finish"
                            className="btn btn-primary"
                            disabled={!canProceed()}
                            onClick={handleFinish}
                            style={{ opacity: canProceed() ? 1 : 0.5 }}
                        >
                            🚀 Finish Setup
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
