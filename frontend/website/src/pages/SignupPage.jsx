import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../services/api'

/*
 * Two-step email-verified signup.
 *   Step 1 — name/email/password form → request OTP
 *   Step 2 — 6-digit OTP box → verify → log the user in
 *
 * The whole flow lives in this one file since the two steps share `form`
 * state. The OTP input is six separate <input> boxes wired together so
 * mobile users get a native numeric keypad and paste-of-the-whole-code
 * just works.
 */
export default function SignupPage() {
    const navigate = useNavigate()

    const [step, setStep]       = useState(1)     // 1 = form, 2 = OTP
    const [form, setForm]       = useState({ name: '', username: '', email: '', password: '', confirm: '' })
    const [unameStatus, setUnameStatus] = useState({ state: 'idle', msg: '' })  // idle | checking | ok | bad
    const [otp, setOtp]         = useState(['', '', '', '', '', ''])
    const [loading, setLoading] = useState(false)
    const [error, setError]     = useState('')
    const [info, setInfo]       = useState('')
    const [cooldown, setCooldown] = useState(0)   // seconds left before resend is allowed

    const set = field => e => setForm({ ...form, [field]: e.target.value })
    const otpRefs = useRef([])

    // Resend cooldown tick-down. 60s default — matches the backend's cooldown.
    useEffect(() => {
        if (cooldown <= 0) return
        const t = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000)
        return () => clearInterval(t)
    }, [cooldown])

    // Focus the first OTP box when we land on step 2.
    useEffect(() => {
        if (step === 2) setTimeout(() => otpRefs.current[0]?.focus(), 120)
    }, [step])

    // Debounced username availability check — fires ~400ms after the user stops
    // typing, so we don't hammer the endpoint on every keystroke.
    useEffect(() => {
        const u = form.username.trim()
        if (!u) { setUnameStatus({ state: 'idle', msg: '' }); return }
        // Basic client-side shape check first — server revalidates anyway.
        if (!/^[a-z0-9_]{3,30}$/.test(u)) {
            setUnameStatus({ state: 'bad', msg: 'Lowercase letters, digits, underscores. 3–30 chars.' })
            return
        }
        setUnameStatus({ state: 'checking', msg: 'Checking…' })
        const timer = setTimeout(async () => {
            const r = await api.checkUsernameAvailable(u)
            if (r.available) setUnameStatus({ state: 'ok', msg: '@' + u + ' is available ✓' })
            else setUnameStatus({ state: 'bad', msg: r.reason || 'Not available' })
        }, 400)
        return () => clearTimeout(timer)
    }, [form.username])

    /** Step 1 → 2: client-side validate, then ask backend to email a code. */
    const handleRequestOtp = async (e) => {
        e.preventDefault()
        setError(''); setInfo('')
        if (form.password !== form.confirm) { setError('Passwords do not match'); return }
        if (form.password.length < 8)       { setError('Password must be at least 8 characters'); return }
        if (unameStatus.state !== 'ok')     { setError('Please pick an available username first'); return }
        setLoading(true)
        const r = await api.signupRequest(
            form.name.trim(),
            form.username.trim().toLowerCase(),
            form.email.trim(),
            form.password,
        )
        setLoading(false)
        if (!r.ok) { setError(r.error || 'Could not send verification code'); return }

        // Backend with verification-disabled flag returns a JWT on step 1 —
        // skip OTP entirely and drop straight into onboarding.
        if (r.data?.token) {
            api.syncAllPlatforms().catch(() => {})
            navigate('/onboarding')
            return
        }

        setStep(2)
        setCooldown(60)
        setInfo('Check your inbox for a 6-digit code.')
    }

    /** Type into an OTP box — auto-advance, only accept digits. */
    const handleOtpChange = (idx, val) => {
        const digit = val.replace(/\D/g, '').slice(-1) // last digit only
        const next = [...otp]
        next[idx] = digit
        setOtp(next)
        if (digit && idx < 5) otpRefs.current[idx + 1]?.focus()
    }

    /** Backspace on empty box → jump back one. */
    const handleOtpKey = (idx, e) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
            otpRefs.current[idx - 1]?.focus()
        }
        if (e.key === 'Enter' && otp.every(d => d !== '')) {
            handleVerifyOtp()
        }
    }

    /** Paste "123456" anywhere → fills all six boxes. */
    const handleOtpPaste = (e) => {
        const txt = (e.clipboardData || window.clipboardData).getData('text') || ''
        const digits = txt.replace(/\D/g, '').slice(0, 6)
        if (digits.length === 0) return
        e.preventDefault()
        const next = ['', '', '', '', '', '']
        for (let i = 0; i < digits.length; i++) next[i] = digits[i]
        setOtp(next)
        const focusIdx = Math.min(digits.length, 5)
        otpRefs.current[focusIdx]?.focus()
    }

    const handleVerifyOtp = async () => {
        const code = otp.join('')
        if (code.length !== 6) { setError('Enter all 6 digits'); return }
        setError(''); setLoading(true)
        const r = await api.signupVerify(form.email.trim(), code)
        setLoading(false)
        if (!r.ok) {
            setError(r.error || 'Verification failed')
            // Soft-reset boxes so user can retype without backspacing six times.
            setOtp(['', '', '', '', '', ''])
            setTimeout(() => otpRefs.current[0]?.focus(), 60)
            return
        }
        // Post-signup sync is non-blocking — same pattern as the login flow.
        api.syncAllPlatforms().catch(() => {})
        navigate('/onboarding')
    }

    const handleResend = async () => {
        if (cooldown > 0) return
        setError(''); setInfo('')
        setLoading(true)
        const r = await api.signupResend(form.email.trim())
        setLoading(false)
        if (!r.ok) { setError(r.error || 'Could not resend code'); return }
        setInfo('A new code is on the way.')
        setCooldown(60)
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="sidebar-logo-icon">A</div>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>
                        Algo<span className="accent-italic" style={{ fontWeight: 600 }}>Ledger</span>
                    </span>
                </div>

                {step === 1 ? (
                    <>
                        <div className="accent-hand" style={{ color: 'var(--amber)', fontSize: 18, marginBottom: 4, transform: 'rotate(-2deg)', display: 'inline-block' }}>
                            let's get you started ✨
                        </div>
                        <h1 className="auth-title">
                            One profile. <span className="accent-italic">Every</span> platform.
                        </h1>
                        <p className="auth-sub">
                            We'll email a 6-digit code to make sure the address is really yours.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="accent-hand" style={{ color: 'var(--amber)', fontSize: 18, marginBottom: 4, transform: 'rotate(-2deg)', display: 'inline-block' }}>
                            check your inbox 📬
                        </div>
                        <h1 className="auth-title">
                            Enter the <span className="accent-italic">6-digit</span> code.
                        </h1>
                        <p className="auth-sub">
                            Sent to <b style={{ color: 'var(--text-primary)' }}>{form.email}</b>.
                            It expires in 10 minutes.
                        </p>
                    </>
                )}

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
                {info && !error && (
                    <div style={{
                        background: 'var(--success-light)',
                        color: 'var(--sage)',
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '16px',
                        fontSize: '14px',
                        border: '1px dashed rgba(136,192,163,0.35)',
                    }}>
                        ✓ {info}
                    </div>
                )}

                {step === 1 && (
                    <>
                        <button className="google-btn" style={{ marginBottom: 16 }} type="button"
                                onClick={() => alert("Google SSO is coming soon!")}>
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
                                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.101-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                            </svg>
                            Sign up with Google
                        </button>

                        <div className="auth-divider">or</div>

                        <form className="auth-form" onSubmit={handleRequestOtp}>
                            <div className="input-group">
                                <label className="input-label">Full Name</label>
                                <div className="input-with-icon">
                                    <span className="input-icon">👤</span>
                                    <input id="name" type="text" className="input-field"
                                           placeholder="Rahul Sharma" value={form.name}
                                           onChange={set('name')} required />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">
                                    Username
                                    <span className="accent-hand" style={{ marginLeft: 6, fontSize: 14, color: 'var(--text-muted)' }}>
                                        (this is how friends will find you)
                                    </span>
                                </label>
                                <div className="input-with-icon">
                                    <span className="input-icon">@</span>
                                    <input
                                        id="signup-username"
                                        type="text"
                                        className="input-field"
                                        placeholder="your_handle"
                                        value={form.username}
                                        onChange={e => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                                        required
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        maxLength={30}
                                    />
                                </div>
                                {form.username && (
                                    <div style={{
                                        fontSize: 12,
                                        marginTop: 4,
                                        color:
                                            unameStatus.state === 'ok'      ? 'var(--sage)' :
                                            unameStatus.state === 'bad'     ? 'var(--rose)' :
                                            unameStatus.state === 'checking' ? 'var(--text-muted)' :
                                            'var(--text-muted)',
                                    }}>
                                        {unameStatus.msg}
                                    </div>
                                )}
                            </div>

                            <div className="input-group">
                                <label className="input-label">Email address</label>
                                <div className="input-with-icon">
                                    <span className="input-icon">✉</span>
                                    <input id="signup-email" type="email" className="input-field"
                                           placeholder="you@example.com" value={form.email}
                                           onChange={set('email')} required />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Password</label>
                                <div className="input-with-icon">
                                    <span className="input-icon">🔒</span>
                                    <input id="signup-password" type="password" className="input-field"
                                           placeholder="Min. 8 characters" value={form.password}
                                           onChange={set('password')} required minLength={8} />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Confirm Password</label>
                                <div className="input-with-icon">
                                    <span className="input-icon">🔒</span>
                                    <input id="confirm-password" type="password" className="input-field"
                                           placeholder="Repeat your password" value={form.confirm}
                                           onChange={set('confirm')} required />
                                </div>
                            </div>

                            <button
                                type="submit"
                                id="signup-submit"
                                className="btn btn-primary w-full"
                                style={{ padding: '12px', fontSize: 15, marginTop: 4 }}
                                disabled={loading}
                            >
                                {loading ? '⏳ Sending code…' : 'Send verification code →'}
                            </button>
                        </form>

                        <p className="auth-switch" style={{ marginTop: 20 }}>
                            Already have an account?{' '}
                            <a href="#" onClick={e => { e.preventDefault(); navigate('/login') }}>
                                Sign in
                            </a>
                        </p>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '8px 0 20px' }}>
                            {otp.map((d, i) => (
                                <input
                                    key={i}
                                    ref={el => (otpRefs.current[i] = el)}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoComplete="one-time-code"
                                    maxLength={1}
                                    value={d}
                                    onChange={e => handleOtpChange(i, e.target.value)}
                                    onKeyDown={e => handleOtpKey(i, e)}
                                    onPaste={handleOtpPaste}
                                    style={{
                                        width: 46, height: 56,
                                        textAlign: 'center',
                                        fontSize: 24, fontWeight: 700,
                                        fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                                        color: 'var(--text-primary)',
                                        background: 'var(--bg-tertiary)',
                                        border: d ? '1.5px solid var(--amber)' : '1.5px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        outline: 'none',
                                        transition: 'border-color .2s, box-shadow .2s',
                                        boxShadow: d ? '0 0 0 3px var(--amber-light)' : 'none',
                                    }}
                                />
                            ))}
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary w-full"
                            style={{ padding: '12px', fontSize: 15 }}
                            disabled={loading || otp.some(d => !d)}
                            onClick={handleVerifyOtp}
                        >
                            {loading ? '⏳ Verifying…' : 'Verify & create account →'}
                        </button>

                        <div style={{
                            marginTop: 18,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            fontSize: 13, color: 'var(--text-muted)',
                        }}>
                            <a
                                href="#"
                                onClick={e => { e.preventDefault(); setStep(1); setError(''); setInfo('') }}
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                ← Change email
                            </a>
                            {cooldown > 0 ? (
                                <span className="accent-hand" style={{ fontSize: 15, color: 'var(--text-muted)' }}>
                                    resend in {cooldown}s
                                </span>
                            ) : (
                                <a
                                    href="#"
                                    onClick={e => { e.preventDefault(); handleResend() }}
                                    className="accent-hand"
                                    style={{ fontSize: 15, color: 'var(--amber)' }}
                                >
                                    resend code ↻
                                </a>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
