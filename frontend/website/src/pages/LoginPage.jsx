import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../services/api'

export default function LoginPage() {
    const navigate = useNavigate()
    const [form, setForm] = useState({ email: '', password: '' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async e => {
        e.preventDefault()
        setError('')
        setLoading(true)
        
        try {
            const result = await api.login(form.email, form.password)
            if (result.success) {
                // Bug Fix #4: Trigger sync immediately on login so the dashboard
                // always shows fresh data rather than whatever was last cached in DB.
                // We fire-and-forget (no await) so the user isn't blocked if sync is slow.
                api.syncAllPlatforms().catch(err =>
                    console.warn('[LoginPage] Post-login sync failed (non-blocking):', err)
                )
                setLoading(false)
                navigate('/dashboard')
            } else {
                setError(result.error || 'Login failed. Please try again.')
                setLoading(false)
            }
        } catch (err) {
            setError('An unexpected error occurred. Please try again.')
            setLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                {/* Logo */}
                <div className="auth-logo">
                    <div className="sidebar-logo-icon">A</div>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                        Algo<span className="accent-italic" style={{ fontWeight: 600 }}>Sprint</span>
                    </span>
                </div>

                <div className="accent-hand" style={{ color: 'var(--amber)', fontSize: 18, marginBottom: 4, transform: 'rotate(-2deg)', display: 'inline-block' }}>
                    welcome back 👋
                </div>
                <h1 className="auth-title">
                    Pick up where <span className="accent-italic">you</span> left off.
                </h1>
                <p className="auth-sub">
                    Sign in to keep the streak alive and the grind honest.
                </p>

                {/* Free-tier cold-start disclaimer */}
                <div style={{
                    background: 'rgba(229,166,83,0.10)',
                    border: '1px dashed rgba(229,166,83,0.45)',
                    borderRadius: '10px',
                    padding: '11px 14px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    color: '#c8943a',
                    display: 'flex',
                    gap: 9,
                    alignItems: 'flex-start',
                }}>
                    <span style={{ fontSize: 16, marginTop: 1 }}>⏳</span>
                    <span>
                        <strong style={{ color: '#E5A653' }}>Heads up!</strong> Our backend runs on a free tier and may be
                        sleeping. The first request can take <strong style={{ color: '#E5A653' }}>10–30 seconds</strong> to
                        wake up — please be patient. Once it's up, everything runs smoothly. ☕
                    </span>
                </div>

                {error && (
                    <div style={{
                        background: 'var(--danger-light)',
                        color: 'var(--rose)',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '16px',
                        fontSize: '14px',
                        border: '1px dashed rgba(216,139,168,0.35)',
                    }}>
                        ✕ {error}
                    </div>
                )}

                {/* Google SSO */}
                <button 
                    type="button" 
                    className="google-btn" 
                    style={{ marginBottom: 16 }}
                    onClick={() => alert("Google SSO is coming soon!")}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
                        <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.101-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>

                <div className="auth-divider">or</div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Email address</label>
                        <div className="input-with-icon">
                            <span className="input-icon">✉</span>
                            <input
                                id="email"
                                type="email"
                                className="input-field"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={e => setForm({ ...form, email: e.target.value })}
                                required
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">
                            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                                Password
                                <a href="#" style={{ color: 'var(--text-accent)', fontWeight: 600 }}>Forgot?</a>
                            </span>
                        </label>
                        <div className="input-with-icon">
                            <span className="input-icon">🔒</span>
                            <input
                                id="password"
                                type="password"
                                className="input-field"
                                placeholder="••••••••"
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                required
                                autoComplete="current-password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        id="login-submit"
                        className="btn btn-primary w-full"
                        style={{ padding: '12px', fontSize: 15, marginTop: 4 }}
                        disabled={loading}
                    >
                        {loading ? '⏳ Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="auth-switch" style={{ marginTop: 20 }}>
                    Don't have an account?{' '}
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/signup') }}>
                        Sign up free
                    </a>
                </p>
            </div>
        </div>
    )
}
