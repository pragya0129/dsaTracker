import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

/*
 * Landing page — "midnight library" studygram.
 *
 * Palette (pulled into CSS vars below):
 *   --bg         #0B0F1A   deep navy-charcoal, not blue-black, not purple
 *   --bg-soft    #121727   card base
 *   --bg-glass   rgba(18,23,39,0.72)
 *   --ink        #EDE4CE   parchment-warm primary text (not sterile white)
 *   --ink-mute   #9DA3B5   muted body
 *   --ink-faint  #5B6378   quiet labels
 *   --amber      #E5A653   warm accent, handwritten/highlights
 *   --sage       #88C0A3   success/checkmarks
 *   --rose       #D88BA8   playful/hearts
 *   --lavender   #9F8FE3   secondary accent
 *   --edge       rgba(229,166,83,0.18)   dashed dividers (warm amber tint)
 *
 * The whole file stays self-contained — CSS lives in a `<style>` block
 * scoped under .ml-root (ml = midnight library) so nothing leaks.
 */

const FEATURES = [
    {
        sticker: '🔗',
        title: 'All platforms, one profile',
        tag: 'LeetCode + Codeforces + GFG, merged',
        desc: 'Solve anywhere — we pull every submission into one unified profile. No more tab-hopping, no more three different dashboards lying to each other.',
        color: '#9F8FE3',
        tape: '#9F8FE3',
    },
    {
        sticker: '🔥',
        title: 'Cross-platform streaks',
        tag: 'a day counts no matter where you solved',
        desc: 'Solved on LeetCode Monday, Codeforces Tuesday, GFG Wednesday? That\'s a 3-day streak. Timezone-aware, reminder-backed, impossible to fake.',
        color: '#E5A653',
        tape: '#E5A653',
    },
    {
        sticker: '📊',
        title: 'Merged analytics',
        tag: 'not vanity metrics',
        desc: 'Topic coverage and difficulty splits rolled up across every linked platform. The stuff an interviewer actually asks — in one place, honest.',
        color: '#88C0A3',
        tape: '#88C0A3',
    },
    {
        sticker: '⚔️',
        title: 'Contest mode',
        tag: 'race your friends, not a leaderboard',
        desc: 'Challenge a friend to a timed 3-problem sprint on real LeetCode / Codeforces problems. Fullscreen lock, live scoreboard, bragging rights on the line.',
        color: '#D88BA8',
        tape: '#D88BA8',
    },
    {
        sticker: '🤖',
        title: 'Smart recs',
        tag: 'pointed at your weakest platform',
        desc: "Daily pick based on what you keep avoiding — on whichever platform your coverage is worst. Fix graphs on LeetCode, lift your Codeforces rating, close the gap.",
        color: '#9F8FE3',
        tape: '#9F8FE3',
    },
    {
        sticker: '📧',
        title: 'Honest nudges',
        tag: 'only when you actually slipped',
        desc: "Reminder emails that check your live submissions on every linked platform first. If you solved anything today, anywhere, we shut up. Most tools don't bother.",
        color: '#E5A653',
        tape: '#E5A653',
    },
]

const HOW_STEPS = [
    {
        n: '01',
        title: 'Link your handles',
        desc: "Drop your LeetCode username and/or Codeforces handle. Takes a minute. We verify you own them with a tiny challenge problem — no passwords, ever.",
        accent: '#9F8FE3',
    },
    {
        n: '02',
        title: 'Keep solving like you already do',
        desc: "Submit on the real sites. We watch the fresh submissions feed and pull them in — you don't have to log anything twice.",
        accent: '#88C0A3',
    },
    {
        n: '03',
        title: 'Actually improve',
        desc: "Daily recs target your weak topics. Contest mode rounds up friends. Reminders catch you when you slip. Offer letter eventually drops.",
        accent: '#E5A653',
    },
]



// Three reasons cross-platform practice actually builds a stronger coder —
// no outcome numbers, no fake claims, just the mechanism.
const GROWTH_PILLARS = [
    {
        sticker: '🌐',
        title: 'Breadth',
        tag: 'every platform, one view',
        desc: "Most grinders sandbag on one site and neglect the other two. A unified profile forces honest practice across LeetCode, Codeforces, and GFG.",
        accent: '#9F8FE3',
    },
    {
        sticker: '🔬',
        title: 'Depth',
        tag: "see what you've been avoiding",
        desc: "Topic-level analytics expose the subjects you've been skipping. You can't fix a weak spot you can't see — we make it impossible to hide from.",
        accent: '#88C0A3',
    },
    {
        sticker: '♾️',
        title: 'Consistency',
        tag: 'streaks that hold you accountable',
        desc: "Cross-platform streaks, honest reminders when you've actually slipped, and friend contests that make daily practice social instead of lonely.",
        accent: '#E5A653',
    },
]

// Founders — drop matching portrait files into /public/team/ and the section
// below picks them up automatically. Keep images portrait-oriented; the card
// grayscales + crops at display time so raw colour photos are fine.
const FOUNDERS = [
    {
        slug: 'ashish',
        name: 'Ashish Karanam',
        role: 'FOUNDER & DEVELOPER',
        tags: ['Architecture', 'Full-stack'],
        image: '/team/ashish.jpg',
    },
    {
        slug: 'sreehith',
        name: 'Sreehith Varma Kankipati',
        role: 'FOUNDER & DEVELOPER',
        tags: ['Development', 'AI'],
        image: '/team/sreehith.jpg',
    },
]

const FAQS = [
    {
        q: "Wait, so you don't need my LeetCode password?",
        a: "Never. We verify ownership with a tiny proof-of-handle challenge (solve one specific easy problem, we see it on the public submissions feed, done). After that we only read public data. Your credentials stay with LeetCode.",
    },
    {
        q: 'How often does my data sync?',
        a: "On-demand when you open the dashboard, and automatically every time you visit. The reminder system checks live submissions right before sending — so if you just solved something, it won't yell at you for being 'inactive'.",
    },
    {
        q: 'Does it work with platforms other than LeetCode and Codeforces?',
        a: "GeeksforGeeks is on the way. HackerRank, AtCoder, and CSES are further out on the roadmap — if you need one of them sooner, ping us and it'll probably jump the queue.",
    },
    {
        q: 'What happens to my streak if I travel across timezones?',
        a: "Your streak follows the timezone you picked in Profile → Notifications. Pick one, forget about it. We do the math so a red-eye flight doesn't accidentally nuke 40 days of progress.",
    },
    {
        q: "I'm a placement aspirant with literally no money. Is it really free?",
        a: "Yes — AlgoSprint is completely free to use. All features are available at no cost. No tiers, no paywalls, no hidden charges.",
    },
]

// ── Tiny doodles (inline SVG, all stroke-based) ────────────────────────────
function Sparkle({ size = 18, color = '#E5A653', style }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden>
            <path d="M12 2 L13.5 9.5 L21 11 L13.5 12.5 L12 20 L10.5 12.5 L3 11 L10.5 9.5 Z"
                fill={color} opacity="0.9" />
        </svg>
    )
}
function Star({ size = 14, color = '#D88BA8', style }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden>
            <path d="M12 2 L14.5 8.5 L21 9.3 L16 14 L17.5 20.8 L12 17 L6.5 20.8 L8 14 L3 9.3 L9.5 8.5 Z" />
        </svg>
    )
}
function Squiggle({ width = 80, color = '#9F8FE3', style }) {
    return (
        <svg width={width} height="14" viewBox="0 0 80 14" fill="none" style={style} aria-hidden>
            <path d="M2 10 Q 10 2, 20 7 T 40 7 T 60 7 T 78 7"
                stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
    )
}
function Heart({ size = 14, color = '#D88BA8', style }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style} aria-hidden>
            <path d="M12 21s-7-4.5-9.5-9.5C.5 7 4 3 8 4.5c1.5.5 3 2 4 3.5 1-1.5 2.5-3 4-3.5 4-1.5 7.5 2.5 5.5 7C19 16.5 12 21 12 21z" />
        </svg>
    )
}
function CurvyArrow({ style, color = '#E5A653' }) {
    return (
        <svg width="110" height="80" viewBox="0 0 110 80" fill="none" style={style} aria-hidden>
            <path d="M5 10 Q 50 5, 80 40 T 95 68" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M85 62 L95 68 L89 78" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
    )
}

// Cute mascot — warm-toned for the new palette
function BookMascot({ size = 120, style }) {
    return (
        <svg width={size} height={size * 0.85} viewBox="0 0 140 120" fill="none" style={style} aria-hidden>
            <defs>
                <linearGradient id="mlPage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F5EBD6" />
                    <stop offset="100%" stopColor="#E5A653" />
                </linearGradient>
                <linearGradient id="mlSpine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#B87333" />
                    <stop offset="100%" stopColor="#7A4D1F" />
                </linearGradient>
                <filter id="mlGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="5" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>
            <ellipse cx="70" cy="108" rx="44" ry="5" fill="#E5A653" opacity="0.25" />
            <g filter="url(#mlGlow)">
                <path d="M10 30 Q 10 22, 18 22 L68 22 Q 70 24, 70 30 L70 100 Q 68 102, 60 102 L18 102 Q 10 102, 10 94 Z" fill="url(#mlPage)" stroke="#B87333" strokeWidth="2" />
                <path d="M130 30 Q 130 22, 122 22 L72 22 Q 70 24, 70 30 L70 100 Q 72 102, 80 102 L122 102 Q 130 102, 130 94 Z" fill="url(#mlPage)" stroke="#B87333" strokeWidth="2" />
                <rect x="68" y="22" width="4" height="80" fill="url(#mlSpine)" />
                <line x1="20" y1="42" x2="60" y2="42" stroke="#B87333" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
                <line x1="20" y1="52" x2="55" y2="52" stroke="#B87333" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
                <line x1="80" y1="42" x2="120" y2="42" stroke="#B87333" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
                <line x1="80" y1="52" x2="115" y2="52" stroke="#B87333" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
                <circle cx="36" cy="72" r="4" fill="#1C1608" />
                <circle cx="104" cy="72" r="4" fill="#1C1608" />
                <circle cx="37" cy="71" r="1.3" fill="#fff" />
                <circle cx="105" cy="71" r="1.3" fill="#fff" />
                <path d="M48 82 Q 70 92, 92 82" stroke="#1C1608" strokeWidth="2" strokeLinecap="round" fill="none" />
                <circle cx="30" cy="82" r="3.5" fill="#D88BA8" opacity="0.55" />
                <circle cx="110" cy="82" r="3.5" fill="#D88BA8" opacity="0.55" />
            </g>
            <path d="M123 18 L125 12 L127 18 L133 20 L127 22 L125 28 L123 22 L117 20 Z" fill="#E5A653" opacity="0.95" />
        </svg>
    )
}

// Corner "peel" accent applied to feature cards — a folded sticker edge.
function CornerPeel({ color = '#E5A653', style }) {
    return (
        <svg width="32" height="32" viewBox="0 0 32 32" style={style} aria-hidden>
            <path d="M0 0 L32 0 L32 18 Q 24 20, 16 24 Q 8 28, 0 32 Z"
                fill="transparent" />
            <path d="M32 18 Q 24 20, 16 24 Q 8 28, 0 32 L0 22 Q 8 22, 16 18 Q 24 14, 32 14 Z"
                fill={color} opacity="0.18" />
            <path d="M32 18 Q 24 20, 16 24 Q 8 28, 0 32"
                stroke={color} strokeWidth="1" fill="none" opacity="0.45" />
        </svg>
    )
}

// ── IntersectionObserver-based reveal hook ─────────────────────────────────
// Uses a data-attribute (not a className) so React's className updates on
// unrelated state changes — e.g. the FAQ item's `ml-faq-open` toggle — can't
// accidentally wipe out the revealed state. React doesn't manage attributes
// it doesn't know about, so data-revealed survives re-renders.
function useReveal() {
    useEffect(() => {
        const els = document.querySelectorAll('.ml-reveal')
        const mark = (el) => el.setAttribute('data-revealed', 'true')
        if (!('IntersectionObserver' in window) || els.length === 0) {
            els.forEach(mark)
            return
        }
        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) {
                    mark(e.target)
                    io.unobserve(e.target)
                }
            }
        }, { rootMargin: '-8% 0px', threshold: 0.05 })
        els.forEach(el => io.observe(el))
        return () => io.disconnect()
    }, [])
}

// ── Tiny syntax highlighter for the code-terminal lines ──────────────────
// Not a full parser — just enough regex tokenization to colour the JS-ish
// snippets we're typing: keywords, strings, numbers, comments, class
// identifiers (PascalCase), and the arrow/check/pop symbols.
const HL_RE = new RegExp(
    [
        '("[^"]*"|\'[^\']*\'|`[^`]*`)',                                 // strings
        '(\\/\\/.*)',                                                   // comments
        '(\\b(?:import|from|const|let|var|function|return|while|for|of|in|class|new|if|else|break|continue|try|catch|async|await|this)\\b)', // keywords
        '(\\b[A-Z][A-Za-z0-9_]*\\b)',                                   // Types / constants (PascalCase + ALL_CAPS)
        '(\\b\\d+(?:\\.\\d+)?\\b)',                                     // numbers
        '(→|✓|↪|⚡)',                                                   // symbols we emit
    ].join('|'),
    'g',
)
function hl(line) {
    if (!line) return null
    const out = []
    let last = 0
    let m
    let k = 0
    HL_RE.lastIndex = 0
    while ((m = HL_RE.exec(line)) !== null) {
        if (m.index > last) {
            out.push(line.slice(last, m.index))
        }
        const cls =
            m[1] ? 'ml-tk-s' :
                m[2] ? 'ml-tk-c' :
                    m[3] ? 'ml-tk-k' :
                        m[4] ? 'ml-tk-t' :
                            m[5] ? 'ml-tk-n' :
                                m[6] ? 'ml-tk-sym' : ''
        out.push(<span key={k++} className={cls}>{m[0]}</span>)
        last = HL_RE.lastIndex
    }
    if (last < line.length) out.push(line.slice(last))
    return out
}

// ── Feature sequence: drives the terminal typewriter AND the stack popping
// When the section enters the viewport we play a sequence:
//   1. type a small JS program into the terminal (imports, Stack setup, loop)
//   2. for each feature: type a `stack.pop() → "title"` line, then fire the
//      matching stack element up and out of the cylinder's mouth
//   3. finish with a summary line + switch the badge from "running" → "ready"
// All state drives React re-renders so the terminal + stack stay in sync.
function useFeatureSequence(sectionRef, features) {
    const [lines, setLines] = useState([])   // finalised lines in the terminal
    const [active, setActive] = useState('')   // line currently being typed
    const [popped, setPopped] = useState(0)    // how many feature cards have popped out
    const [done, setDone] = useState(false)

    useEffect(() => {
        const section = sectionRef.current
        if (!section) return
        let cancelled = false
        let triggered = false

        // No IntersectionObserver → just show everything immediately
        if (!('IntersectionObserver' in window)) {
            const t = setTimeout(() => {
                if (cancelled) return
                setLines(['$ node loadFeatures.js', '> all ' + features.length + ' features running ⚡'])
                setPopped(features.length)
                setDone(true)
            }, 0)
            return () => { cancelled = true; clearTimeout(t) }
        }

        const wait = (ms) => new Promise(res => setTimeout(res, ms))

        // Type `text` character by character into `active`, then commit to `lines`.
        // Batches several characters per frame so long lines don't drag.
        async function type(text, speed = 6, step = 2) {
            for (let i = step; i <= text.length; i += step) {
                if (cancelled) return
                setActive(text.slice(0, i))
                const ch = text[i - 1]
                await wait(/[,.;:]/.test(ch) ? speed * 2 : speed)
            }
            if (cancelled) return
            setLines(prev => [...prev, text])
            setActive('')
        }

        async function run() {
            await wait(140)
            await type('$ node features.js', 7, 1)
            await wait(180)
            await type("import { Stack } from './ds/Stack'", 6, 2)
            await wait(90)
            await type('const stack = Stack.from(FEATURES)', 6, 2)
            await wait(120)
            await type('while (!stack.isEmpty()) {', 6, 2)
            await wait(60)
            await type('  mount(stack.pop())', 6, 2)
            await wait(60)
            await type('}', 10, 1)
            await wait(200)

            for (let i = 0; i < features.length; i++) {
                if (cancelled) return
                const n = i + 1
                await type(
                    '  → "' + features[i].title + '"   [' + n + '/' + features.length + ']',
                    6, 2
                )
                // fire the card out of the stack's top
                setPopped(n)
                await wait(180)
            }

            await wait(160)
            await type('✓ stack drained — ' + features.length + ' features running ⚡', 7, 2)
            if (!cancelled) setDone(true)
        }

        const io = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting && !triggered) {
                    triggered = true
                    run()
                    io.disconnect()
                }
            }
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.18 })
        io.observe(section)

        return () => {
            cancelled = true
            io.disconnect()
        }
    }, [sectionRef, features])

    return { lines, active, popped, done }
}

// ── Sticky nav shadow on scroll ───────────────────────────────────────────
function useScrolled(threshold = 12) {
    const [scrolled, setScrolled] = useState(false)
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > threshold)
        onScroll()
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [threshold])
    return scrolled
}

export default function LandingPage() {
    const navigate = useNavigate()
    const heroRef = useRef(null)
    const featuresRef = useRef(null)
    const scrolled = useScrolled()
    useReveal()
    const { lines: termLines, active: termActive, popped: poppedCount, done: seqDone } =
        useFeatureSequence(featuresRef, FEATURES)

    // FAQ accordion state — single-open behaviour
    const [openFaq, setOpenFaq] = useState(0)

    // Gentle parallax tilt on the dashboard mock
    useEffect(() => {
        const hero = heroRef.current
        if (!hero) return
        const handle = (e) => {
            const r = hero.getBoundingClientRect()
            const x = ((e.clientX - r.left) / r.width - 0.5) * 10
            const y = ((e.clientY - r.top) / r.height - 0.5) * 8
            hero.style.setProperty('--rx', `${-y}deg`)
            hero.style.setProperty('--ry', `${x}deg`)
        }
        hero.addEventListener('mousemove', handle)
        return () => hero.removeEventListener('mousemove', handle)
    }, [])



    return (
        <div className="ml-root">
            <style>{ML_CSS}</style>

            {/* ── Background ── */}
            <div className="ml-orb ml-orb-1" />
            <div className="ml-orb ml-orb-2" />
            <div className="ml-orb ml-orb-3" />
            <div className="ml-grid-overlay" />
            <div className="ml-vignette" />

            <Navbar scrolled={scrolled} />

            {/* ── HERO ── */}
            <section className="ml-hero" ref={heroRef}>
                <Sparkle size={22} color="#E5A653" style={{ position: 'absolute', top: 70, left: '5%' }} />
                <Star size={14} color="#D88BA8" style={{ position: 'absolute', top: 160, right: '8%' }} />
                <Sparkle size={14} color="#88C0A3" style={{ position: 'absolute', top: 280, left: '10%', opacity: 0.75 }} />
                <Star size={10} color="#E5A653" style={{ position: 'absolute', top: 210, right: '22%' }} />
                <Heart size={12} color="#D88BA8" style={{ position: 'absolute', top: 420, left: '4%', opacity: 0.7 }} />

                <div className="ml-hero-left ml-reveal">
                    <div className="ml-eyebrow">
                        <span className="ml-eyebrow-dot" />
                        grow across every platform 🚀
                    </div>

                    <h1 className="ml-hero-title">
                        Level up on <span className="ml-italic">every</span> platform.<br />
                        Not just the one<br />
                        you're comfy on.
                        <Squiggle width={240} color="#E5A653" style={{ display: 'block', marginTop: 10 }} />
                    </h1>

                    <p className="ml-hero-sub">
                        AlgoSprint turns LeetCode, Codeforces (and GFG soon)
                        into one <span className="ml-underline-amber">honest</span>
                        {' '}practice system. Cross-platform streaks, merged
                        topic coverage, daily recs pointed at your weakest
                        area, and contest mode to keep your friends on it too.
                    </p>

                    <div className="ml-hero-ctas">
                        <div className="ml-cta-wrap">
                            <button className="ml-cta-primary" onClick={() => navigate('/signup')}>
                                <span>Start for free</span>
                                <span className="ml-cta-arrow">→</span>
                                <div className="ml-cta-shine" />
                            </button>
                            <div className="ml-cta-annotation">
                                <CurvyArrow style={{ position: 'absolute', top: -50, left: -84, transform: 'rotate(-8deg)' }} />
                                <span style={{ position: 'absolute', top: -72, left: -140, transform: 'rotate(-6deg)' }}>
                                    start here ✨
                                </span>
                            </div>
                        </div>
                        <button className="ml-cta-secondary" onClick={() => navigate('/login')}>
                            I have an account
                        </button>
                    </div>

                    <div className="ml-trust">
                        <span className="ml-trust-chip">🔒 no passwords needed</span>
                        <span className="ml-trust-chip">✨ free while you learn</span>
                        <span className="ml-trust-chip">🛠 built by students</span>
                    </div>
                </div>

                <div className="ml-hero-right ml-reveal" style={{ transitionDelay: '0.12s' }}>
                    <BookMascot size={90} style={{
                        position: 'absolute', top: -26, right: 30, zIndex: 5,
                        filter: 'drop-shadow(0 14px 40px rgba(229,166,83,0.35))',
                    }} />

                    <div className="ml-mock">
                        <div className="ml-mock-header">
                            <div className="ml-mock-dots">
                                <span style={{ background: '#FF5F57' }} />
                                <span style={{ background: '#FEBC2E' }} />
                                <span style={{ background: '#28C840' }} />
                            </div>
                            <span className="ml-mock-url">algosprint.app/dashboard</span>
                        </div>
                        <div className="ml-mock-body">
                            <div className="ml-mock-stats">
                                {[
                                    { val: '342', label: 'solved', color: '#9F8FE3' },
                                    { val: '🔥 14', label: 'day streak', color: '#E5A653' },
                                    { val: '48', label: 'hard', color: '#D88BA8' },
                                    { val: '87%', label: 'ready', color: '#88C0A3' },
                                ].map(s => (
                                    <div className="ml-mock-stat" key={s.label}>
                                        <div className="ml-mock-stat-val" style={{ color: s.color }}>{s.val}</div>
                                        <div className="ml-mock-stat-label">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="ml-mock-bars">
                                {[
                                    { label: 'Arrays', pct: 78, color: '#9F8FE3' },
                                    { label: 'Graphs', pct: 52, color: '#88C0A3' },
                                    { label: 'DP', pct: 41, color: '#D88BA8' },
                                    { label: 'Trees', pct: 65, color: '#E5A653' },
                                ].map(b => (
                                    <div className="ml-mock-bar-row" key={b.label}>
                                        <span className="ml-mock-bar-label">{b.label}</span>
                                        <div className="ml-mock-bar-track">
                                            <div className="ml-mock-bar-fill" style={{ width: `${b.pct}%`, background: b.color }} />
                                        </div>
                                        <span className="ml-mock-bar-pct">{b.pct}%</span>
                                    </div>
                                ))}
                            </div>
                            <div className="ml-mock-heat">
                                {Array.from({ length: 35 }).map((_, i) => {
                                    const seed = (i * 37) % 5
                                    return <div key={i} className={`ml-heatcell ml-heat-${seed}`} />
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="ml-sticky ml-sticky-1">
                        <span>real streak — not faked 🔥</span>
                    </div>
                    <div className="ml-sticky ml-sticky-2">
                        <span>see your weak topic 👀</span>
                    </div>
                </div>
            </section>

            {/* ── INTEGRATIONS ── */}
            <section className="ml-integrations ml-reveal">
                <span className="ml-integrations-label">works with</span>
                <div className="ml-integrations-row">
                    <div className="ml-brand"><span className="ml-brand-dot" style={{ background: '#FFA116' }} /> LeetCode</div>
                    <span className="ml-dot-sep" />
                    <div className="ml-brand"><span className="ml-brand-dot" style={{ background: '#1F8ACB' }} /> Codeforces</div>
                    <span className="ml-dot-sep" />
                    <div className="ml-brand ml-brand-soon"><span className="ml-brand-dot" style={{ background: '#2F8D46' }} /> GeeksforGeeks <em>soon</em></div>
                    <span className="ml-dot-sep" />
                    <div className="ml-brand ml-brand-soon"><span className="ml-brand-dot" style={{ background: '#5B6378' }} /> HackerRank <em>soon</em></div>
                </div>
            </section>

            {/* ── PRODUCT FACTS STRIP ── */}
            {/* These are concrete product truths, not user-count flexes. */}
            <div className="ml-stats-strip ml-reveal">
                <div className="ml-stat">
                    <div className="ml-stat-val" style={{ color: '#9F8FE3' }}>3</div>
                    <div className="ml-stat-label">
                        platforms, one profile
                        <Squiggle width={70} color="#9F8FE3" style={{ marginTop: 2, opacity: 0.7 }} />
                    </div>
                </div>
                <div className="ml-stat">
                    <div className="ml-stat-val" style={{ color: '#E5A653' }}>0</div>
                    <div className="ml-stat-label">
                        manual copy-paste, ever
                        <Squiggle width={70} color="#E5A653" style={{ marginTop: 2, opacity: 0.7 }} />
                    </div>
                </div>
                <div className="ml-stat">
                    <div className="ml-stat-val" style={{ color: '#88C0A3' }}>1</div>
                    <div className="ml-stat-label">
                        honest dashboard
                        <Squiggle width={70} color="#88C0A3" style={{ marginTop: 2, opacity: 0.7 }} />
                    </div>
                </div>
            </div>

            {/* ── WHY IT WORKS ── */}
            <section className="ml-placement" id="why">
                <div className="ml-section-eyebrow ml-reveal">why it works</div>
                <h2 className="ml-section-title ml-reveal">
                    Three things that <span className="ml-italic">actually</span> grow a coder.
                </h2>
                <p className="ml-section-sub ml-reveal">
                    No magic. No bootcamp energy. Just the mechanisms that separate
                    the people who keep improving from the people who plateau at 80 solved.
                </p>

                <div className="ml-placement-grid">
                    {GROWTH_PILLARS.map((p, i) => (
                        <div
                            key={p.title}
                            className="ml-placement-card ml-reveal"
                            style={{ '--p-accent': p.accent, transitionDelay: `${i * 0.1}s` }}
                        >
                            <div className="ml-placement-sticker">{p.sticker}</div>
                            <div className="ml-placement-label">{p.title}</div>
                            <div className="ml-placement-note">{p.tag}</div>
                            <div className="ml-placement-desc">{p.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FEATURES (Terminal + Card Stack) ── */}
            <section className="ml-features" id="features" ref={featuresRef}>
                <div className="ml-section-eyebrow ml-reveal">what's inside</div>
                <h2 className="ml-section-title ml-reveal">
                    Stuff you'll <span className="ml-italic">actually</span> use.
                </h2>
                <p className="ml-section-sub ml-reveal">
                    Watch it write itself. Each feature pops out of the stack as the
                    script runs — no gimmicks, no "AI-powered synergy," just the handful
                    of things that genuinely move the needle on placement prep.
                </p>

                <div className="ml-feat-split">

                    {/* ── LEFT: a tiny terminal that writes + runs live ── */}
                    <div className="ml-term-wrap ml-reveal">
                        <div className="ml-term-window">
                            <div className="ml-term-bar">
                                <span className="ml-term-dot ml-term-dot-r" />
                                <span className="ml-term-dot ml-term-dot-y" />
                                <span className="ml-term-dot ml-term-dot-g" />
                                <span className="ml-term-title">~/algosprint — loadFeatures.js</span>
                                <span className={`ml-term-run ${seqDone ? 'ml-term-run-done' : ''}`}>
                                    <span className="ml-term-run-dot" />
                                    {seqDone ? 'ready' : 'running'}
                                </span>
                            </div>
                            <pre className="ml-term-body">
                                {termLines.map((l, i) => {
                                    const t = l.trimStart()
                                    // Prompt + output lines get a single flat colour;
                                    // actual code lines get full token highlighting.
                                    const isPrompt = t.startsWith('$')
                                    const isOk = t.startsWith('✓')
                                    const isPop = t.startsWith('→') || t.startsWith('↪')
                                    const cls =
                                        'ml-term-line' +
                                        (isPrompt ? ' ml-term-prompt' : '') +
                                        (isOk ? ' ml-term-ok' : '') +
                                        (isPop ? ' ml-term-pop' : '')
                                    return (
                                        <div key={i} className={cls}>
                                            {hl(l)}
                                        </div>
                                    )
                                })}
                                {(!seqDone || termActive) && (
                                    <div className="ml-term-line ml-term-line-active">
                                        {hl(termActive)}
                                        <span className="ml-term-caret">▍</span>
                                    </div>
                                )}
                            </pre>
                        </div>

                        <div className="ml-term-cap">
                            <span className="ml-term-cap-k">
                                <span className="ml-term-cap-dot" />
                                features.loaded
                            </span>
                            <span className="ml-term-cap-v">
                                {poppedCount}
                                <span className="ml-term-cap-d">/{FEATURES.length}</span>
                            </span>
                        </div>

                        {/* ── Feature stack — proper DSA stack visual inside a cylinder.
                               Elements sit bottom-up (FEATURES[N-1] at the bottom, FEATURES[0]
                               at the top = next-to-pop). As poppedCount grows, top items rise
                               up out of the cylinder mouth and disappear. */}
                        <div className="ml-fstack" aria-hidden="true">
                            <div className="ml-fstack-heading">
                                <Squiggle width={54} color="#E5A653" />
                                <span>feature stack</span>
                            </div>

                            <div className="ml-fstack-tube">
                                {/* TOP → arrow pointing at the current top of the stack */}
                                <div
                                    className="ml-fstack-top-arrow"
                                    data-empty={poppedCount >= FEATURES.length ? 'true' : 'false'}
                                >
                                    top&nbsp;<span className="ml-fstack-top-arrow-tip">→</span>
                                </div>

                                {/* Mouth (top ellipse / opening) */}
                                <div className="ml-fstack-mouth">
                                    <div className="ml-fstack-mouth-inner" />
                                    <div className="ml-fstack-mouth-glare" />
                                </div>

                                {/* Body — the cylinder walls */}
                                <div className="ml-fstack-body">
                                    <div className="ml-fstack-shine" />
                                    <div className="ml-fstack-shine ml-fstack-shine-r" />

                                    {/* Stack elements anchored to the bottom */}
                                    <div className="ml-fstack-items">
                                        {FEATURES.map((f, i) => {
                                            // depth-from-bottom: FEATURES[N-1] → 0 (bottom),
                                            // FEATURES[0] → N-1 (top of stack).
                                            const depth = FEATURES.length - 1 - i
                                            const taken = i < poppedCount
                                            return (
                                                <div
                                                    key={f.title}
                                                    className="ml-fstack-item"
                                                    data-taken={taken ? 'true' : 'false'}
                                                    style={{
                                                        '--s-accent': f.color,
                                                        '--s-depth': depth,
                                                        '--s-index': i,
                                                    }}
                                                >
                                                    <span className="ml-fstack-item-num">{FEATURES.length - i}</span>
                                                    <span className="ml-fstack-item-emoji">{f.sticker}</span>
                                                    <span className="ml-fstack-item-bar" />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Base (closed bottom) */}
                                <div className="ml-fstack-base" />

                                {/* Ambient glow underneath */}
                                <div className="ml-fstack-glow" />
                            </div>

                            {/* Caption under the cylinder */}
                            <div className="ml-fstack-caption">
                                <span className="ml-fstack-caption-k">size</span>
                                <span className="ml-fstack-caption-v">
                                    {FEATURES.length - poppedCount}
                                    <span className="ml-fstack-caption-d">/{FEATURES.length}</span>
                                </span>
                                <span className="ml-fstack-caption-bar" />
                                <span className="ml-fstack-caption-k">
                                    {poppedCount >= FEATURES.length ? 'empty' : 'LIFO'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT: popped cards land here, one after the other ── */}
                    <div className="ml-feat-stage">
                        <div className="ml-pop-list">
                            {FEATURES.map((f, i) => (
                                <div
                                    key={f.title}
                                    className="ml-stack-card"
                                    data-stack-in={i < poppedCount ? 'true' : 'false'}
                                    style={{
                                        '--accent': f.color,
                                        '--tape': f.tape,
                                        '--card-index': i,
                                        '--card-rot': `${([-1.4, 0.9, -0.6, 1.1, -1.0, 0.7])[i] ?? 0}deg`,
                                    }}
                                >
                                    <div className="ml-fcard-tape" />
                                    <CornerPeel color={f.color} style={{ position: 'absolute', top: 0, right: 0, opacity: 0.9 }} />
                                    <div className="ml-fcard-sticker">{f.sticker}</div>
                                    <div className="ml-fcard-title">{f.title}</div>
                                    <div className="ml-fcard-tag">{f.tag}</div>
                                    <div className="ml-fcard-desc">{f.desc}</div>
                                    <div className="ml-fcard-glow" />
                                    <div className="ml-stack-badge">
                                        {i + 1}&thinsp;/&thinsp;{FEATURES.length}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section className="ml-how" id="how">
                <div className="ml-section-eyebrow ml-reveal">how it works</div>
                <h2 className="ml-section-title ml-reveal">
                    Three steps. Then <span className="ml-italic">stop</span> worrying.
                </h2>

                <div className="ml-how-grid">
                    {HOW_STEPS.map((s, i) => (
                        <div key={s.n} className="ml-step ml-reveal" style={{ transitionDelay: `${i * 0.1}s`, '--step-accent': s.accent }}>
                            <div className="ml-step-num-wrap">
                                <div className="ml-step-num-tape" />
                                <span className="ml-step-num">{s.n}</span>
                            </div>
                            <div className="ml-step-title">{s.title}</div>
                            <div className="ml-step-desc">{s.desc}</div>
                            {i < HOW_STEPS.length - 1 && (
                                <div className="ml-step-connector" aria-hidden>
                                    <svg width="60" height="18" viewBox="0 0 60 18" fill="none">
                                        <path d="M2 9 Q 15 2, 30 9 T 56 9"
                                            stroke="#E5A653" strokeWidth="2" strokeLinecap="round"
                                            strokeDasharray="4 4" fill="none" opacity="0.55" />
                                        <path d="M50 5 L58 9 L50 13" stroke="#E5A653" strokeWidth="2"
                                            strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.75" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── BUILT BY STUDENTS ── */}
            <section className="ml-team" id="team">
                <h2 className="ml-team-headline ml-reveal">
                    Built by<span className="ml-team-dot">.</span><br />
                    <span className="ml-team-ghost">Students.</span>
                </h2>

                <div className="ml-team-grid">
                    {FOUNDERS.map((f, i) => (
                        <div
                            key={f.slug}
                            className="ml-team-card ml-reveal"
                            style={{ transitionDelay: `${i * 0.12}s` }}
                        >
                            {/* Orange L-bracket accents */}
                            <span className="ml-team-bracket ml-team-bracket-tl" aria-hidden />
                            <span className="ml-team-bracket ml-team-bracket-br" aria-hidden />
                            <div
                                className="ml-team-photo"
                                style={{ backgroundImage: `url(${f.image})` }}
                                role="img"
                                aria-label={f.name}
                            >
                                <div className="ml-team-photo-fallback">{f.name[0]}</div>
                                <div className="ml-team-role">{f.role}</div>
                            </div>
                            <div className="ml-team-name">{f.name}</div>
                            <div className="ml-team-tags">
                                {f.tags.map((t, idx) => (
                                    <span key={t}>
                                        {t}
                                        {idx < f.tags.length - 1 && <span className="ml-team-tag-dot">·</span>}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>



            {/* ── FAQ ── */}
            <section className="ml-faq" id="faq">
                <div className="ml-section-eyebrow ml-reveal">questions you asked</div>
                <h2 className="ml-section-title ml-reveal">
                    Frequently <span className="ml-italic">actually</span> asked.
                </h2>

                <div className="ml-faq-list">
                    {FAQS.map((f, i) => {
                        const open = openFaq === i
                        return (
                            <div
                                key={i}
                                className={`ml-faq-item ml-reveal ${open ? 'ml-faq-open' : ''}`}
                                style={{ transitionDelay: `${i * 0.05}s` }}
                            >
                                <button
                                    className="ml-faq-q"
                                    onClick={() => setOpenFaq(open ? -1 : i)}
                                    aria-expanded={open}
                                >
                                    <span className="ml-faq-marker">Q:</span>
                                    <span className="ml-faq-qtext">{f.q}</span>
                                    <span className="ml-faq-chevron" aria-hidden>›</span>
                                </button>
                                <div className="ml-faq-a">
                                    <div className="ml-faq-a-inner">
                                        <span className="ml-faq-marker-a">A:</span>
                                        <span>{f.a}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* ── CONTACT ── */}
            <section className="ml-contact" id="contact">

                <div className="ml-section-eyebrow ml-reveal ml-contact-eyebrow">
                    contact us
                </div>



                <div className="ml-contact-wrapper ml-reveal">

                    {/* LEFT */}
                    <div className="ml-contact-left">

                        <h2 className="ml-section-title ml-reveal">
                            We'd love to <span className="ml-italic">hear</span> from you.
                        </h2>

                        <p className="ml-section-sub ml-reveal">
                            Questions, feature requests, bug reports, or collaboration ideas —
                            send us a message and the AlgoSprint team will get back to you.
                        </p>

                    </div>

                    {/* RIGHT */}
                    <form
                        className="ml-contact-form"
                        onSubmit={(e) => {
                            e.preventDefault();

                            const formData = new FormData(e.target);

                            const name = formData.get("name");
                            const email = formData.get("email");
                            const message = formData.get("message");

                            if (
                                !name.trim() ||
                                !email.trim() ||
                                !message.trim()
                            ) {
                                toast.error("Please fill all fields.");
                                return;
                            }

                            toast.success("Message submitted successfully!");

                            e.target.reset();
                        }}
                    >

                        <div className="ml-contact-group">
                            <label>Name</label>

                            <input
                                type="text"
                                name="name"
                                placeholder="Enter your name"
                            />
                        </div>

                        <div className="ml-contact-group">
                            <label>Email</label>

                            <input
                                type="email"
                                name="email"
                                placeholder="Enter your email"
                            />
                        </div>

                        <div className="ml-contact-group">
                            <label>Message</label>

                            <textarea
                                name="message"
                                placeholder="Write your message..."
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            className="ml-cta-primary ml-contact-btn"
                        >
                            Send Message →
                        </button>

                    </form>

                </div>

            </section>

            {/* ── BIG CTA ── */}
            <section className="ml-big-cta">
                <Sparkle size={22} color="#E5A653" style={{ position: 'absolute', top: 40, left: '10%' }} />
                <Star size={16} color="#D88BA8" style={{ position: 'absolute', bottom: 50, right: '12%' }} />
                <Sparkle size={14} color="#88C0A3" style={{ position: 'absolute', top: 80, right: '20%' }} />
                <Heart size={14} color="#D88BA8" style={{ position: 'absolute', bottom: 30, left: '14%', opacity: 0.75 }} />
                <div className="ml-big-cta-inner ml-reveal">
                    <h2 className="ml-big-cta-title">
                        One place. <span className="ml-italic">Every</span> platform.
                    </h2>
                    <p className="ml-big-cta-sub">
                        Stop jumping between three tabs pretending the other two don't exist.
                        Link your handles, keep solving, watch yourself actually improve.
                    </p>
                    <button className="ml-cta-primary ml-cta-big" onClick={() => navigate('/signup')}>
                        <span>Get started — it's free</span>
                        <span className="ml-cta-arrow">→</span>
                        <div className="ml-cta-shine" />
                    </button>

                </div>
            </section>

            <Footer />
        </div>
    )
}

// ──────────────────────────────────────────────────────────────────────────
// Scoped styles — everything prefixed with .ml-
// ──────────────────────────────────────────────────────────────────────────
const ML_CSS = `
.ml-root {
    --bg:         #0B0F1A;
    --bg-soft:    #121727;
    --bg-card:    #151B2D;
    --bg-glass:   rgba(18, 23, 39, 0.72);
    --ink:        #EDE4CE;
    --ink-mute:   #9DA3B5;
    --ink-faint:  #5B6378;
    --amber:      #E5A653;
    --amber-soft: rgba(229, 166, 83, 0.14);
    --sage:       #88C0A3;
    --rose:       #D88BA8;
    --lavender:   #9F8FE3;
    --edge:       rgba(229, 166, 83, 0.18);
    --edge-soft:  rgba(237, 228, 206, 0.08);

    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
    font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
    position: relative;
    overflow-x: hidden;
}
.ml-root * { box-sizing: border-box; }

/* ── Background glows + paper grid ── */
.ml-orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(110px);
    pointer-events: none;
    z-index: 0;
    animation: ml-float 22s ease-in-out infinite;
}
.ml-orb-1 {
    width: 560px; height: 560px; top: -180px; left: -140px;
    background: radial-gradient(circle, rgba(159,143,227,0.28), transparent 70%);
}
.ml-orb-2 {
    width: 500px; height: 500px; bottom: -100px; right: -90px;
    background: radial-gradient(circle, rgba(229,166,83,0.20), transparent 70%);
    animation-delay: -8s; animation-duration: 26s;
}
.ml-orb-3 {
    width: 380px; height: 380px; top: 48%; left: 56%;
    background: radial-gradient(circle, rgba(136,192,163,0.14), transparent 70%);
    animation-delay: -14s; animation-duration: 30s;
}
@keyframes ml-float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(40px, -30px) scale(1.08); }
}
.ml-grid-overlay {
    position: fixed; inset: 0; pointer-events: none; z-index: 1;
    background-image:
        linear-gradient(rgba(237,228,206,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(237,228,206,0.025) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 78%);
}
.ml-vignette {
    position: fixed; inset: 0; pointer-events: none; z-index: 1;
    background: radial-gradient(ellipse at top, transparent 0%, transparent 40%, rgba(0,0,0,0.4) 100%);
}

/* ── Reveal animation ── */
.ml-reveal {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 0.7s cubic-bezier(.2,.8,.2,1), transform 0.7s cubic-bezier(.2,.8,.2,1);
    will-change: opacity, transform;
}
.ml-reveal[data-revealed="true"] { opacity: 1; transform: translateY(0); }

/* ── Type accents ── */
.ml-italic {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 500;
    background: linear-gradient(135deg, var(--amber), var(--rose));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
.ml-handwritten {
    font-family: 'Caveat', cursive;
    font-weight: 600;
    letter-spacing: 0.02em;
    font-size: 16px;
}
.ml-underline-amber {
    background-image: linear-gradient(120deg, transparent 50%, rgba(229,166,83,0.35) 50%);
    background-repeat: no-repeat;
    background-size: 100% 60%;
    background-position: 0 88%;
    padding: 0 2px;
}

/* ── NAV ── */
.ml-nav {
    position: fixed; top: 14px; z-index: 50;
    margin: 14px auto 0; max-width: 1180px; width: calc(100% - 28px);
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 18px;
    background: var(--bg-glass);
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
    border: 1px solid var(--edge);
    border-radius: 18px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(237,228,206,0.04);
    transition: box-shadow 0.3s, border-color 0.3s;
}
.ml-nav-scrolled {
    box-shadow: 0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(237,228,206,0.05);
    border-color: rgba(229,166,83,0.35);
}
.ml-logo { display: flex; align-items: center; gap: 10px; }
.ml-logo-icon {
    width: 32px; height: 32px; border-radius: 9px;
    background: linear-gradient(135deg, var(--amber), var(--rose));
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 18px rgba(229,166,83,0.35);
}
.ml-logo-text {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800; font-size: 18px;
    color: var(--ink);
}
.ml-logo-text span {
    font-family: 'Fraunces', serif; font-style: italic; font-weight: 600;
    color: var(--amber);
}
.ml-tape-sticker {
    margin-left: 6px;
    font-family: 'Caveat', cursive;
    font-size: 15px; font-weight: 700;
    background: var(--amber-soft);
    color: var(--amber);
    padding: 3px 10px; border-radius: 6px;
    transform: rotate(-4deg);
    border: 1px dashed rgba(229,166,83,0.45);
}
.ml-nav-links { display: flex; gap: 24px; }
.ml-nav-link {
    font-size: 13.5px; font-weight: 500;
    color: var(--ink-mute); text-decoration: none;
    transition: color 0.2s;
    position: relative;
}
.ml-nav-link::after {
    content: ''; position: absolute; left: 0; bottom: -3px;
    width: 100%; height: 2px;
    background: linear-gradient(90deg, var(--amber), var(--rose));
    transform: scaleX(0); transform-origin: left;
    transition: transform 0.25s cubic-bezier(.2,.8,.2,1);
}
.ml-nav-link:hover { color: var(--ink); }
.ml-nav-link:hover::after { transform: scaleX(1); }
.ml-nav-actions { display: flex; gap: 10px; }

/* ── Buttons ── */
.ml-btn-ghost, .ml-btn-primary,
.ml-cta-primary, .ml-cta-secondary, .ml-cta-outline {
    font-family: inherit; font-weight: 600;
    border: none; cursor: pointer;
    transition: all 0.22s cubic-bezier(.2,.8,.2,1);
    position: relative; overflow: hidden;
    display: inline-flex; align-items: center; justify-content: center;
    gap: 8px;
}
.ml-btn-ghost {
    background: transparent; color: var(--ink);
    padding: 8px 14px; border-radius: 10px;
    font-size: 13.5px;
}
.ml-btn-ghost:hover { background: var(--edge-soft); }
.ml-btn-primary {
    background: linear-gradient(135deg, var(--amber), var(--rose));
    color: #1C1608;
    padding: 9px 16px; border-radius: 10px;
    font-size: 13.5px; font-weight: 700;
    box-shadow: 0 6px 20px rgba(229,166,83,0.35);
}
.ml-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(229,166,83,0.5); }
.ml-arrow { display: inline-block; transition: transform 0.2s; }
.ml-btn-primary:hover .ml-arrow { transform: translateX(3px); }

.ml-cta-primary {
    background: linear-gradient(135deg, var(--amber), var(--rose));
    color: #1C1608;
    padding: 14px 24px; border-radius: 14px;
    font-size: 15px; font-weight: 800;
    box-shadow: 0 14px 40px rgba(229,166,83,0.38);
}
.ml-cta-primary:hover { transform: translateY(-2px); box-shadow: 0 18px 50px rgba(229,166,83,0.55); }
.ml-cta-arrow { transition: transform 0.2s; }
.ml-cta-primary:hover .ml-cta-arrow { transform: translateX(4px); }
.ml-cta-shine {
    position: absolute; inset: 0;
    background: linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.38) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.7s;
    pointer-events: none;
}
.ml-cta-primary:hover .ml-cta-shine { transform: translateX(100%); }
.ml-cta-secondary {
    background: var(--edge-soft); color: var(--ink);
    border: 1px solid var(--edge);
    padding: 13px 22px; border-radius: 14px; font-size: 15px;
}
.ml-cta-secondary:hover { background: var(--amber-soft); border-color: rgba(229,166,83,0.4); }
.ml-cta-outline {
    background: transparent; color: var(--ink);
    border: 1.5px solid var(--edge);
    padding: 12px 22px; border-radius: 14px; font-size: 15px; font-weight: 700;
}
.ml-cta-outline:hover { border-color: var(--amber); background: var(--amber-soft); }
.ml-full { width: 100%; }
.ml-cta-big { padding: 16px 32px; font-size: 17px; }

/* ── HERO ── */
.ml-hero {
    position: relative; z-index: 2;
    max-width: 1180px; margin: 72px auto 0;
    padding: 0 24px;
    display: grid; grid-template-columns: 1.05fr 1fr;
    gap: 56px; align-items: center;
    min-height: 560px;
}
@media (max-width: 980px) {
    .ml-hero { grid-template-columns: 1fr; gap: 80px; margin-top: 40px; }
}
.ml-hero-left { position: relative; z-index: 2; }
.ml-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px;
    background: var(--amber-soft);
    border: 1px dashed rgba(229,166,83,0.45);
    border-radius: 999px;
    font-family: 'Caveat', cursive;
    font-size: 17px; font-weight: 600;
    color: var(--amber);
    margin-bottom: 22px;
    transform: rotate(-1.5deg);
}
.ml-eyebrow-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--sage);
    box-shadow: 0 0 0 4px rgba(136,192,163,0.25);
    animation: ml-pulse 2s infinite;
}
@keyframes ml-pulse {
    0%, 100% { transform: scale(1); }
    50%      { transform: scale(1.4); }
}
.ml-hero-title {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800;
    font-size: clamp(38px, 5.5vw, 64px);
    line-height: 1.03;
    letter-spacing: -0.028em;
    color: var(--ink);
    margin: 0 0 22px;
}
.ml-hero-sub {
    font-size: 17px; line-height: 1.65;
    color: var(--ink-mute);
    max-width: 520px;
    margin: 0 0 28px;
}
.ml-hero-ctas {
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    margin-bottom: 40px;
}
.ml-cta-wrap { position: relative; }
.ml-cta-annotation {
    position: absolute; top: 0; left: 0;
    font-family: 'Caveat', cursive;
    font-size: 18px; color: var(--amber);
    pointer-events: none; white-space: nowrap;
}
.ml-trust {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    font-size: 13px; color: var(--ink-mute);
}
.ml-trust-chip {
    padding: 6px 12px;
    background: var(--edge-soft);
    border: 1px solid var(--edge);
    border-radius: 999px;
    font-size: 12.5px; font-weight: 500;
    color: var(--ink);
    transition: all 0.22s;
}
.ml-trust-chip:hover {
    border-color: var(--amber);
    color: var(--amber);
    transform: translateY(-1px);
}

/* ── Dashboard mock ── */
.ml-hero-right { position: relative; z-index: 2; perspective: 1400px; }
.ml-mock {
    position: relative;
    background: linear-gradient(135deg, rgba(21,27,45,0.95), rgba(14,18,30,0.95));
    border: 1px solid var(--edge);
    border-radius: 18px;
    box-shadow:
        0 30px 80px rgba(0,0,0,0.55),
        0 0 0 1px rgba(237,228,206,0.03) inset,
        0 60px 120px -30px rgba(229,166,83,0.22);
    transform-style: preserve-3d;
    transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
    transition: transform 0.15s ease-out;
}
.ml-mock-header {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--edge-soft);
    background: rgba(0,0,0,0.25);
    border-radius: 18px 18px 0 0;
}
.ml-mock-dots { display: flex; gap: 6px; }
.ml-mock-dots span { width: 10px; height: 10px; border-radius: 50%; }
.ml-mock-url {
    flex: 1; text-align: center;
    font-size: 11px; color: var(--ink-faint);
    font-family: 'DM Sans', monospace;
}
.ml-mock-body { padding: 20px; }
.ml-mock-stats {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
    margin-bottom: 20px;
}
.ml-mock-stat {
    background: var(--edge-soft);
    border: 1px solid var(--edge-soft);
    border-radius: 10px;
    padding: 12px 10px;
    text-align: center;
}
.ml-mock-stat-val { font-size: 22px; font-weight: 800; font-family: 'Space Grotesk', sans-serif; }
.ml-mock-stat-label { font-size: 10px; color: var(--ink-mute); margin-top: 2px; text-transform: lowercase; }
.ml-mock-bars { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.ml-mock-bar-row { display: flex; align-items: center; gap: 10px; }
.ml-mock-bar-label { font-size: 12px; color: var(--ink-mute); width: 60px; }
.ml-mock-bar-track {
    flex: 1; height: 8px; border-radius: 4px;
    background: var(--edge-soft);
    overflow: hidden;
}
.ml-mock-bar-fill {
    height: 100%; border-radius: 4px;
    box-shadow: 0 0 12px currentColor;
    animation: ml-bar-grow 1.2s ease-out both;
}
@keyframes ml-bar-grow { from { width: 0 !important; } }
.ml-mock-bar-pct { font-size: 11px; color: var(--ink); width: 34px; text-align: right; }
.ml-mock-heat {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(18px, 1fr));
    gap: 4px;
}
.ml-heatcell { aspect-ratio: 1; border-radius: 3px; background: var(--edge-soft); }
.ml-heat-1 { background: rgba(229,166,83,0.22); }
.ml-heat-2 { background: rgba(229,166,83,0.45); }
.ml-heat-3 { background: rgba(229,166,83,0.72); }
.ml-heat-4 { background: var(--amber); box-shadow: 0 0 6px rgba(229,166,83,0.5); }

/* Sticky-note callouts */
.ml-sticky {
    position: absolute; z-index: 4;
    padding: 8px 12px;
    background: rgba(229, 166, 83, 0.14);
    border: 1px dashed rgba(229, 166, 83, 0.55);
    border-radius: 8px;
    font-family: 'Caveat', cursive;
    font-size: 17px; font-weight: 600;
    color: var(--amber);
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    animation: ml-wobble 6s ease-in-out infinite;
}
@keyframes ml-wobble {
    0%, 100% { transform: rotate(var(--r, -4deg)); }
    50%      { transform: rotate(calc(var(--r, -4deg) + 2deg)); }
}
.ml-sticky-1 { top: 150px; left: -30px; --r: -6deg; }
.ml-sticky-2 {
    bottom: 40px; right: -20px; --r: 4deg;
    background: rgba(216, 139, 168, 0.14);
    border-color: rgba(216, 139, 168, 0.55);
    color: var(--rose);
}

/* ── Integrations strip ── */
.ml-integrations {
    position: relative; z-index: 2;
    max-width: 1000px; margin: 80px auto 0;
    padding: 18px 24px;
    display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    justify-content: center;
    border-top: 1px dashed var(--edge);
    border-bottom: 1px dashed var(--edge);
    font-size: 14px; color: var(--ink-mute);
}
.ml-integrations-label {
    font-family: 'Caveat', cursive;
    font-size: 18px; color: var(--amber);
    margin-right: 12px;
}
.ml-integrations-row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
.ml-brand {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px;
    background: var(--bg-soft);
    border: 1px solid var(--edge-soft);
    border-radius: 999px;
    color: var(--ink); font-weight: 600;
    transition: all 0.25s;
}
.ml-brand:hover { border-color: var(--amber); transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,0.35); }
.ml-brand-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
.ml-brand-soon { color: var(--ink-faint); font-weight: 500; }
.ml-brand-soon em { font-style: italic; font-size: 12px; opacity: 0.8; margin-left: 4px; }
.ml-dot-sep { width: 4px; height: 4px; border-radius: 50%; background: var(--ink-faint); opacity: 0.5; }
@media (max-width: 720px) { .ml-dot-sep { display: none; } }

/* ── Stats strip ── */
.ml-stats-strip {
    position: relative; z-index: 2;
    max-width: 1100px; margin: 40px auto 0;
    padding: 42px 24px;
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 20px; align-items: center;
}
@media (max-width: 720px) { .ml-stats-strip { grid-template-columns: 1fr; gap: 28px; } }
.ml-stat { text-align: center; }
.ml-stat-val {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 48px; font-weight: 800; line-height: 1;
}
.ml-stat-label {
    font-family: 'Caveat', cursive;
    font-size: 20px; font-weight: 600;
    color: var(--ink-mute);
    display: inline-flex; flex-direction: column; align-items: center;
    margin-top: 8px;
}

/* ── Section headers ── */
.ml-features, .ml-pricing, .ml-how, .ml-faq, .ml-placement {
    position: relative; z-index: 2;
    max-width: 1180px; margin: 110px auto 0;
    padding: 0 24px;
    text-align: center;
}

/* ── Placement prep ── */
.ml-placement-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 22px; max-width: 980px; margin: 8px auto 40px;
    text-align: left;
}
@media (max-width: 860px) { .ml-placement-grid { grid-template-columns: 1fr; } }
.ml-placement-card {
    position: relative;
    background: linear-gradient(180deg, rgba(21,27,45,0.82), rgba(13,17,28,0.9));
    border: 1px solid var(--edge-soft);
    border-left: 4px solid var(--p-accent);
    border-radius: 16px;
    padding: 26px 24px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.32);
    transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
}
.ml-placement-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 22px 60px rgba(0,0,0,0.5);
    border-color: var(--p-accent);
}
.ml-placement-sticker {
    font-size: 34px;
    display: inline-block;
    transform: rotate(-6deg);
    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.45));
    margin-bottom: 12px;
}
.ml-placement-label {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700; font-size: 20px;
    color: var(--ink); margin-bottom: 4px;
}
.ml-placement-note {
    font-family: 'Caveat', cursive;
    font-size: 17px; font-weight: 600;
    color: var(--p-accent);
    line-height: 1.3;
    margin-bottom: 12px;
}
.ml-placement-desc {
    font-size: 14.5px; line-height: 1.6;
    color: var(--ink-mute);
}
.ml-section-eyebrow {
    font-family: 'Caveat', cursive;
    font-size: 22px; font-weight: 700;
    color: var(--rose);
    margin-bottom: 10px;
    transform: rotate(-2deg);
    display: inline-block;
}
.ml-section-title {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800;
    font-size: clamp(30px, 4vw, 46px);
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--ink);
    margin: 0 0 14px;
}
.ml-section-sub {
    font-size: 16px; line-height: 1.65;
    color: var(--ink-mute);
    max-width: 560px; margin: 0 auto 48px;
}

/* ══════════════════════════════════════════════════════════════════════════
   FEATURES — Terminal (writing + running) on left, physical Card Stack on right
   ══════════════════════════════════════════════════════════════════════════
   Layout:
     .ml-feat-split
       .ml-term-wrap                ← left column
         .ml-term-window            ← macOS-style code-editor window
         .ml-term-cap               ← "features.loaded N/M" chip
         .ml-fstack                 ← DSA-style cylindrical stack (feature stack)
       .ml-feat-stage               ← right column
         .ml-pop-list               ← grid of popped-out feature cards
   ══════════════════════════════════════════════════════════════════════════ */

.ml-feat-split {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    gap: 40px;
    text-align: left;
    align-items: start;
    margin-top: 28px;
}
@media (max-width: 980px) {
    .ml-feat-split { grid-template-columns: 1fr; gap: 48px; }
}

/* ════════ Terminal (left column) ════════ */
.ml-term-wrap {
    position: sticky;
    top: 92px;
    align-self: start;
}
@media (max-width: 980px) {
    .ml-term-wrap { position: static; top: auto; }
}
.ml-term-window {
    background:
        radial-gradient(circle at 20% -10%, rgba(229,166,83,0.08), transparent 60%),
        linear-gradient(180deg, #0e1322 0%, #070a14 100%);
    border: 1px solid rgba(229, 166, 83, 0.22);
    border-radius: 16px;
    overflow: hidden;
    box-shadow:
        0 40px 90px rgba(0,0,0,0.6),
        0 0 0 1px rgba(255,255,255,0.02) inset,
        0 0 80px rgba(229,166,83,0.08);
    backdrop-filter: blur(8px);
}
.ml-term-bar {
    display: flex; align-items: center; gap: 7px;
    padding: 11px 14px;
    background: linear-gradient(180deg, rgba(28,36,58,0.9), rgba(20,26,42,0.95));
    border-bottom: 1px solid rgba(229,166,83,0.14);
}
.ml-term-dot {
    width: 11px; height: 11px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.25) inset;
}
.ml-term-dot-r { background: #ff5f56; }
.ml-term-dot-y { background: #ffbd2e; }
.ml-term-dot-g { background: #27c93f; }
.ml-term-title {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 11.5px;
    color: var(--ink-mute);
    opacity: 0.72;
    margin-left: 10px;
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
}
.ml-term-run {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 10.5px;
    color: var(--amber);
    background: rgba(229,166,83,0.12);
    padding: 3px 10px;
    border-radius: 10px;
    border: 1px solid rgba(229,166,83,0.26);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-weight: 700;
}
.ml-term-run-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--amber);
    box-shadow: 0 0 8px rgba(229,166,83,0.7);
    animation: ml-term-pulse 1s ease-in-out infinite;
}
.ml-term-run-done {
    color: var(--sage);
    background: rgba(136,192,163,0.12);
    border-color: rgba(136,192,163,0.32);
}
.ml-term-run-done .ml-term-run-dot {
    background: var(--sage);
    box-shadow: 0 0 8px rgba(136,192,163,0.7);
    animation: none;
}
@keyframes ml-term-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.35; transform: scale(0.8); }
}

.ml-term-body {
    margin: 0;
    padding: 20px 20px 24px;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 13px;
    line-height: 1.75;
    color: #b2bfd8;
    white-space: pre-wrap;
    min-height: 260px;
    max-height: 360px;
    overflow: hidden;
    background:
        repeating-linear-gradient(
            180deg,
            rgba(255,255,255,0.008) 0,
            rgba(255,255,255,0.008) 22px,
            transparent 22px,
            transparent 44px
        ),
        linear-gradient(180deg, rgba(7,10,20,0.4), rgba(4,6,12,0.55));
}
.ml-term-line {
    display: block;
    color: #9eaecb;
    opacity: 0;
    transform: translateY(4px);
    animation: ml-term-line-in 0.25s ease-out forwards;
}
@keyframes ml-term-line-in {
    to { opacity: 1; transform: translateY(0); }
}
.ml-term-prompt { color: var(--amber); font-weight: 700; }
.ml-term-info   { color: #89c0ff; }
.ml-term-pop    { color: #f0d9b4; }
.ml-term-ok     { color: var(--sage); }
.ml-term-line-active {
    color: var(--ink);
    opacity: 1;
    animation: none;
}

/* ── Token colours (syntax highlighter spans) ── */
.ml-tk-s   { color: #E5B67A;  }                       /* strings       — warm amber */
.ml-tk-c   { color: #6c7794;  font-style: italic; }   /* comments      — muted slate */
.ml-tk-k   { color: #D88BA8;  font-weight: 600;  }    /* keywords      — rose */
.ml-tk-t   { color: #89C0FF;  }                       /* Types / ALLCAPS — blue */
.ml-tk-n   { color: #B9E5C4;  }                       /* numbers       — mint */
.ml-tk-sym { color: var(--amber); font-weight: 800; } /* → ✓ ↪ ⚡       — amber */

/* Inside prompt/pop/ok lines we want the line's single colour to win — */
/* the token spans inherit from the line instead of overriding it.       */
.ml-term-prompt .ml-tk-s,
.ml-term-prompt .ml-tk-c,
.ml-term-prompt .ml-tk-k,
.ml-term-prompt .ml-tk-t,
.ml-term-prompt .ml-tk-n,
.ml-term-pop    .ml-tk-k,
.ml-term-pop    .ml-tk-n,
.ml-term-pop    .ml-tk-t,
.ml-term-ok     .ml-tk-k,
.ml-term-ok     .ml-tk-t { color: inherit; }
/* …but keep the string + symbol colours even on those lines so
   the title quotes and the → ✓ glyphs still pop out. */
.ml-term-caret {
    display: inline-block;
    color: var(--amber);
    animation: ml-term-caret 1.05s steps(1) infinite;
    margin-left: 1px;
    font-weight: 800;
}
@keyframes ml-term-caret {
    0%, 49%  { opacity: 1; }
    50%,100% { opacity: 0; }
}

/* Tiny status chip below the terminal */
.ml-term-cap {
    margin-top: 14px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 14px;
    padding: 11px 16px;
    background: rgba(18, 23, 39, 0.72);
    border: 1px dashed rgba(229,166,83,0.28);
    border-radius: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 12px;
    color: var(--ink-mute);
}
.ml-term-cap-k { display: inline-flex; align-items: center; gap: 8px; letter-spacing: 0.04em; opacity: 0.85; }
.ml-term-cap-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--sage);
    box-shadow: 0 0 8px rgba(136,192,163,0.7);
}
.ml-term-cap-v { color: var(--amber); font-weight: 800; font-size: 14px; }
.ml-term-cap-d { color: var(--ink-faint); margin-left: 1px; font-weight: 500; }

/* ════════ Feature stack — DSA-style cylindrical stack under the terminal ════════
   Visual: a tube (ellipse top + cylinder body + ellipse base) with feature
   elements stacked inside, bottom-up. Top element pops first (LIFO).
   Elements rise up and out through the mouth as poppedCount grows.        */

.ml-fstack {
    position: relative;
    margin-top: 26px;
    padding: 18px 6px 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.ml-fstack-heading {
    align-self: flex-start;
    display: inline-flex; align-items: center; gap: 7px;
    font-family: 'Caveat', cursive;
    font-size: 20px; font-weight: 700;
    color: var(--amber);
    transform: rotate(-3deg);
    margin-bottom: 8px;
    margin-left: 10px;
    white-space: nowrap;
}
.ml-fstack-heading svg { transform: translateY(2px); opacity: 0.85; }

.ml-fstack-tube {
    position: relative;
    width: 210px;
    margin: 22px auto 10px;
}

/* "top →" annotation pointing at the opening */
.ml-fstack-top-arrow {
    position: absolute;
    top: 2px;
    left: -74px;
    font-family: 'Caveat', cursive;
    font-size: 18px; font-weight: 700;
    color: var(--amber);
    opacity: 0.9;
    transform: rotate(-6deg);
    letter-spacing: 0.02em;
    white-space: nowrap;
    z-index: 6;
    transition: opacity 0.4s ease;
}
.ml-fstack-top-arrow[data-empty="true"] { opacity: 0.35; }
.ml-fstack-top-arrow-tip { font-size: 22px; font-weight: 800; }

/* Mouth — top ellipse, the opening */
.ml-fstack-mouth {
    position: relative;
    width: 100%;
    height: 44px;
    border-radius: 50%;
    background: radial-gradient(
        ellipse at 42% 35%,
        rgba(46,60,95,0.96) 0%,
        rgba(18,24,42,0.98) 65%
    );
    border: 2px solid rgba(229,166,83,0.65);
    box-shadow:
        0 -6px 22px rgba(229,166,83,0.18),
        inset 0 5px 16px rgba(0,0,0,0.6),
        inset 0 -2px 8px rgba(229,166,83,0.1);
    z-index: 5;
    overflow: hidden;
    animation: ml-fstack-pulse 2.6s ease-in-out infinite;
}
.ml-fstack-mouth-inner {
    position: absolute;
    inset: 7px 14px;
    border-radius: 50%;
    background: radial-gradient(
        ellipse at center,
        rgba(5,7,14,0.96) 0%,
        rgba(13,17,30,0.88) 70%
    );
    box-shadow: inset 0 4px 14px rgba(0,0,0,0.92);
}
.ml-fstack-mouth-glare {
    position: absolute;
    top: 6px; left: 20%; width: 28%; height: 7px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    filter: blur(2.5px);
    z-index: 2;
}
@keyframes ml-fstack-pulse {
    0%, 100% {
        box-shadow:
            0 -6px 22px rgba(229,166,83,0.18),
            inset 0 5px 16px rgba(0,0,0,0.6),
            inset 0 -2px 8px rgba(229,166,83,0.1);
    }
    50% {
        box-shadow:
            0 -10px 32px rgba(229,166,83,0.4),
            inset 0 5px 16px rgba(0,0,0,0.6),
            inset 0 -2px 8px rgba(229,166,83,0.2),
            0 0 0 2px rgba(229,166,83,0.22);
    }
}
/* Stop pulsing once stack is empty */
.ml-fstack-tube:has(.ml-fstack-top-arrow[data-empty="true"]) .ml-fstack-mouth {
    animation: none;
}

/* Cylinder body — tube walls */
.ml-fstack-body {
    position: relative;
    width: 100%;
    height: 236px;
    margin-top: -2px;
    background: linear-gradient(
        90deg,
        rgba(10,14,26,0.97)  0%,
        rgba(22,30,52,0.88) 16%,
        rgba(34,46,76,0.72) 42%,
        rgba(38,52,85,0.68) 50%,
        rgba(34,46,76,0.72) 58%,
        rgba(22,30,52,0.88) 84%,
        rgba(10,14,26,0.97) 100%
    );
    border-left:  2px solid rgba(229,166,83,0.42);
    border-right: 2px solid rgba(229,166,83,0.42);
    overflow: hidden;
    z-index: 3;
}

.ml-fstack-shine {
    position: absolute;
    top: 0; left: 14%; width: 9%; height: 100%;
    background: linear-gradient(
        180deg,
        rgba(255,255,255,0.08) 0%,
        rgba(255,255,255,0.03) 60%,
        transparent 100%
    );
    pointer-events: none;
}
.ml-fstack-shine-r {
    left: auto; right: 14%;
    background: linear-gradient(
        180deg,
        rgba(255,255,255,0.04) 0%,
        transparent 100%
    );
}

/* Items container — inside the cylinder, items positioned absolutely */
.ml-fstack-items {
    position: absolute;
    inset: 12px 14px 14px;
}

/* Each stacked element — a horizontal bar-ish block */
.ml-fstack-item {
    position: absolute;
    left: 0; right: 0;
    /* bottom-up: --s-depth 0 = bottom. 32px per row. */
    bottom: calc(var(--s-depth, 0) * 32px);
    height: 28px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 10px;
    border-radius: 7px;
    background:
        linear-gradient(
            90deg,
            color-mix(in srgb, var(--s-accent) 32%, rgba(10,14,26,0.9)) 0%,
            color-mix(in srgb, var(--s-accent) 14%, rgba(10,14,26,0.9)) 60%,
            color-mix(in srgb, var(--s-accent) 32%, rgba(10,14,26,0.9)) 100%
        );
    border: 1px solid color-mix(in srgb, var(--s-accent) 55%, transparent);
    box-shadow:
        0 2px 6px rgba(0,0,0,0.45),
        0 0 0 1px rgba(255,255,255,0.03) inset,
        0 -1px 0 color-mix(in srgb, var(--s-accent) 22%, transparent) inset;
    transition:
        opacity 0.45s ease,
        transform 0.8s cubic-bezier(.22, 1.45, .38, 1);
    will-change: transform, opacity;
}
/* top element gets a little extra glow */
.ml-fstack-item:not([data-taken="true"]) + .ml-fstack-item:not([data-taken="true"]),
.ml-fstack-items .ml-fstack-item:not([data-taken="true"]):last-of-type {
    /* handled below */
}
.ml-fstack-items .ml-fstack-item:not([data-taken="true"]):first-of-type {
    box-shadow:
        0 2px 10px rgba(0,0,0,0.5),
        0 0 0 1px rgba(255,255,255,0.05) inset,
        0 0 18px color-mix(in srgb, var(--s-accent) 35%, transparent);
}

.ml-fstack-item-num {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 10px; font-weight: 700;
    color: color-mix(in srgb, var(--s-accent) 70%, var(--ink));
    background: rgba(0,0,0,0.35);
    padding: 1px 6px;
    border-radius: 5px;
    min-width: 16px; text-align: center;
    letter-spacing: 0.03em;
}
.ml-fstack-item-emoji {
    font-size: 14px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));
}
.ml-fstack-item-bar {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--s-accent) 60%, transparent),
        color-mix(in srgb, var(--s-accent) 20%, transparent)
    );
    opacity: 0.75;
}

/* When an item is popped → rise up + out of the cylinder mouth */
.ml-fstack-item[data-taken="true"] {
    opacity: 0;
    transform:
        translateY(calc(-42px - var(--s-depth, 0) * 32px))
        scale(0.85)
        rotate(-4deg);
}

/* Base — closed bottom ellipse */
.ml-fstack-base {
    width: 100%;
    height: 30px;
    margin-top: -1px;
    border-radius: 50%;
    background: linear-gradient(
        180deg,
        rgba(18,24,42,0.98) 0%,
        rgba(10,14,26,0.99) 100%
    );
    border: 2px solid rgba(229,166,83,0.3);
    box-shadow:
        0 14px 38px rgba(0,0,0,0.6),
        inset 0 -3px 10px rgba(0,0,0,0.55);
    z-index: 2;
    position: relative;
}

/* Ambient glow pool under the tube */
.ml-fstack-glow {
    position: absolute;
    bottom: -24px; left: 50%;
    transform: translateX(-50%);
    width: 80%; height: 36px;
    border-radius: 50%;
    background: radial-gradient(
        ellipse at center,
        rgba(229,166,83,0.3) 0%,
        transparent 72%
    );
    filter: blur(12px);
    pointer-events: none;
}

/* Monospace caption under the cylinder */
.ml-fstack-caption {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-top: 28px;
    padding: 8px 14px;
    background: rgba(18, 23, 39, 0.7);
    border: 1px dashed rgba(229,166,83,0.24);
    border-radius: 10px;
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 11.5px;
    color: var(--ink-mute);
    letter-spacing: 0.04em;
}
.ml-fstack-caption-k { opacity: 0.75; }
.ml-fstack-caption-v { color: var(--amber); font-weight: 800; font-size: 13px; }
.ml-fstack-caption-d { color: var(--ink-faint); font-weight: 500; }
.ml-fstack-caption-bar {
    width: 1px; height: 12px;
    background: rgba(229,166,83,0.26);
}

/* Mobile tweaks */
@media (max-width: 980px) {
    .ml-fstack { margin-top: 18px; }
    .ml-fstack-tube { width: 190px; }
    .ml-fstack-body { height: 220px; }
    .ml-fstack-top-arrow { left: -66px; font-size: 16px; }
}

/* ════════ Stage (right column: only the popped-cards grid now) ════════ */
.ml-feat-stage {
    position: relative;
    display: flex;
    flex-direction: column;
}

/* ── List of cards that have popped out of the stack ── */
.ml-pop-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* equal-height rows so every card lines up regardless of copy length */
    grid-auto-rows: 1fr;
    gap: 18px 16px;
    perspective: 1200px;
    perspective-origin: 10% -20%;
}
@media (max-width: 620px) { .ml-pop-list { grid-template-columns: 1fr; } }

/* ── Individual feature card ── */
.ml-stack-card {
    position: relative;
    background: linear-gradient(180deg, rgba(21,27,45,0.93), rgba(13,17,28,0.96));
    border: 1px solid var(--edge-soft);
    border-radius: 20px;
    padding: 28px 22px 26px;
    min-height: 262px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    text-align: left;

    /* ── PRE-ANIMATION: tiny, rotated, sitting where the pile is (top-left) ── */
    opacity: 0;
    transform-origin: top left;
    transform:
        translate3d(-220px, -180px, 0)
        scale(0.38)
        rotate(calc(-18deg + var(--card-rot, 0deg)));

    box-shadow: 0 4px 10px rgba(0,0,0,0.6);
    transition:
        opacity   0.45s ease,
        transform 0.9s  cubic-bezier(.22, 1.5, .38, 1),
        box-shadow 0.4s ease,
        border-color 0.3s;
    will-change: opacity, transform;
    z-index: calc(10 - var(--card-index, 0));
}

/* ── POST-ANIMATION: card has popped out and sits in the grid ── */
.ml-stack-card[data-stack-in="true"] {
    opacity: 1;
    transform:
        translate3d(0, 0, 0)
        scale(1)
        rotate(var(--card-rot, 0deg));
    box-shadow:
        0 18px 50px rgba(0,0,0,0.42),
        0 0 0 1px rgba(237,228,206,0.04) inset;
}

/* Hover: straighten + lift + accent glow */
.ml-stack-card[data-stack-in="true"]:hover {
    transform: translate3d(0, -8px, 0) scale(1.015) rotate(0deg);
    border-color: var(--accent);
    box-shadow:
        0 28px 72px rgba(0,0,0,0.55),
        0 0 0 1.5px var(--accent) inset,
        0 0 60px color-mix(in srgb, var(--accent) 22%, transparent);
    z-index: 30;
}
.ml-stack-card[data-stack-in="true"]:hover .ml-fcard-glow { opacity: 1; }
.ml-stack-card[data-stack-in="true"]:hover .ml-fcard-sticker {
    transform: rotate(-2deg) scale(1.18);
}

/* ── Card sub-elements ── */
.ml-fcard-tape {
    position: absolute;
    top: -10px; left: 50%;
    transform: translateX(-50%) rotate(-3deg);
    width: 82px; height: 20px;
    background-image: repeating-linear-gradient(
        135deg, transparent 0 6px, rgba(255,255,255,0.12) 6px 12px
    );
    background-color: var(--tape);
    opacity: 0.38;
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.ml-fcard-sticker {
    font-size: 32px;
    display: inline-block;
    transform: rotate(-6deg);
    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.45));
    margin-bottom: 12px;
    line-height: 1;
    transition: transform 0.3s cubic-bezier(.2,.8,.2,1);
}
.ml-fcard-title {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700; font-size: 19px;
    line-height: 1.2;
    color: var(--ink); margin-bottom: 3px;
}
.ml-fcard-tag {
    font-family: 'Caveat', cursive;
    font-size: 16px; font-weight: 600;
    color: var(--accent);
    line-height: 1.3;
    margin-bottom: 10px;
}
.ml-fcard-desc {
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-mute);
    flex: 1;
}
.ml-fcard-glow {
    position: absolute; inset: 0; border-radius: 20px;
    background: radial-gradient(
        circle at bottom right,
        color-mix(in srgb, var(--accent) 20%, transparent),
        transparent 65%
    );
    opacity: 0; transition: opacity 0.3s; pointer-events: none;
}
.ml-stack-badge {
    position: absolute; bottom: 11px; right: 14px;
    font-family: 'Caveat', cursive;
    font-size: 13px; font-weight: 700;
    color: var(--accent); opacity: 0.55;
    letter-spacing: 0.05em;
}

/* ── How it works ── */
.ml-how-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 20px; max-width: 1040px; margin: 0 auto;
    text-align: left;
    position: relative;
}
@media (max-width: 860px) { .ml-how-grid { grid-template-columns: 1fr; } }
.ml-step {
    position: relative;
    background: linear-gradient(180deg, rgba(21,27,45,0.85), rgba(13,17,28,0.9));
    border: 1px solid var(--edge-soft);
    border-radius: 20px;
    padding: 26px 24px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.35);
}
.ml-step-num-wrap {
    position: relative;
    display: inline-block;
    margin-bottom: 14px;
    padding: 8px 16px;
}
.ml-step-num-tape {
    position: absolute; inset: 0;
    transform: rotate(-3deg);
    background: var(--step-accent);
    opacity: 0.25;
    border-radius: 6px;
    background-image: repeating-linear-gradient(135deg, transparent 0 6px, rgba(255,255,255,0.12) 6px 12px);
}
.ml-step-num {
    position: relative;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800; font-size: 22px;
    color: var(--step-accent);
    letter-spacing: 0.02em;
}
.ml-step-title {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700; font-size: 19px;
    color: var(--ink); margin-bottom: 6px;
}
.ml-step-desc { font-size: 14.5px; line-height: 1.6; color: var(--ink-mute); }
.ml-step-connector {
    position: absolute; top: 40px; right: -40px;
    display: flex; align-items: center;
    pointer-events: none;
}
@media (max-width: 860px) { .ml-step-connector { display: none; } }

/* ── Pricing ── */
.ml-price-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px; max-width: 760px; margin: 20px auto 0;
    text-align: left;
}
.ml-pcard {
    position: relative;
    background: linear-gradient(180deg, rgba(21,27,45,0.85), rgba(13,17,28,0.92));
    border: 1px solid var(--edge-soft);
    border-radius: 20px;
    padding: 28px 26px;
    transition: transform 0.25s, box-shadow 0.25s;
}
.ml-pcard:hover { transform: translateY(-4px); }
.ml-pcard-featured {
    border-color: rgba(229,166,83,0.45);
    box-shadow: 0 24px 60px rgba(229,166,83,0.22);
    transform: scale(1.02);
}
.ml-pcard-featured:hover { transform: scale(1.02) translateY(-6px); }
.ml-pcard-badge {
    position: absolute; top: -14px; right: 20px;
    padding: 6px 12px;
    background: linear-gradient(135deg, var(--amber), var(--rose));
    color: #1C1608;
    font-family: 'Caveat', cursive;
    font-size: 16px; font-weight: 700;
    border-radius: 8px;
    transform: rotate(5deg);
    box-shadow: 0 6px 18px rgba(229,166,83,0.5);
}
.ml-pcard-name {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 700; font-size: 18px;
    color: var(--amber); margin-bottom: 6px;
}
.ml-pcard-price {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800; font-size: 44px;
    color: var(--ink); line-height: 1;
}
.ml-pcard-cycle {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; font-weight: 500;
    color: var(--ink-mute); margin-left: 4px;
}
.ml-pcard-divider { margin: 20px 0; border-top: 1px dashed var(--edge); }
.ml-pcard-list {
    list-style: none; padding: 0; margin: 0 0 22px;
    display: flex; flex-direction: column; gap: 11px;
}
.ml-pcard-list li {
    font-size: 14.5px; color: var(--ink);
    display: flex; align-items: center; gap: 10px;
}
.ml-check {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: rgba(136,192,163,0.2);
    color: var(--sage); font-weight: 800; font-size: 11px;
    flex-shrink: 0;
}

/* ── Built by Students ── */
.ml-team {
    position: relative; z-index: 2;
    max-width: 1180px; margin: 110px auto 0;
    padding: 0 24px;
    text-align: center;
}
.ml-team-headline {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800;
    font-size: clamp(52px, 9vw, 112px);
    line-height: 0.95;
    letter-spacing: -0.035em;
    color: var(--ink);
    margin: 0 0 56px;
}
.ml-team-dot {
    color: var(--amber);
    font-size: 0.85em;
    text-shadow: 0 0 40px rgba(229,166,83,0.6);
}
.ml-team-ghost {
    /* Lightly-ghosted treatment on "Students." — matches studygram's
       layered duotone effect against the warm dark background. */
    color: rgba(237,228,206,0.18);
    -webkit-text-stroke: 1px rgba(237,228,206,0.28);
}
.ml-team-grid {
    display: grid; grid-template-columns: repeat(2, 1fr);
    gap: 44px; max-width: 920px; margin: 0 auto;
}
@media (max-width: 720px) {
    .ml-team-grid { grid-template-columns: 1fr; gap: 36px; }
}
.ml-team-card {
    position: relative;
    text-align: left;
    padding: 18px;
}
/* L-bracket accents at opposite corners — done in CSS so the photo
   underneath can sit flush without SVG overlap math. */
.ml-team-bracket {
    position: absolute;
    width: 26px; height: 26px;
    border: 2px solid var(--amber);
    pointer-events: none;
}
.ml-team-bracket-tl {
    top: 0; left: 0;
    border-right: none; border-bottom: none;
}
.ml-team-bracket-br {
    bottom: 0; right: 0;
    border-left: none; border-top: none;
}
.ml-team-photo {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background-color: var(--bg-soft);
    background-size: cover;
    background-position: center;
    border-radius: 8px;
    overflow: hidden;
    filter: grayscale(100%) contrast(1.05);
    margin-bottom: 18px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.45);
    transition: filter .35s, transform .35s;
}
.ml-team-card:hover .ml-team-photo {
    filter: grayscale(40%) contrast(1.08);
    transform: translateY(-4px);
}
/* Shown only when the background-image fails to load (no /team/*.jpg
   dropped in yet) — a giant monogram so the layout doesn't collapse. */
.ml-team-photo-fallback {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Fraunces', serif;
    font-size: 96px; font-weight: 600;
    color: rgba(229,166,83,0.18);
    background: linear-gradient(135deg, rgba(229,166,83,0.06), rgba(216,139,168,0.04));
    z-index: 0;
}
.ml-team-role {
    position: absolute;
    bottom: 18px; left: 18px;
    padding: 6px 10px;
    border: 1.5px solid var(--amber);
    color: var(--amber);
    background: rgba(11,15,26,0.6);
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.12em;
    border-radius: 2px;
    z-index: 2;
}
.ml-team-name {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800;
    font-size: clamp(22px, 2.8vw, 30px);
    letter-spacing: -0.015em;
    color: var(--ink);
    margin-bottom: 6px;
}
.ml-team-tags {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 500;
    font-size: 13.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-mute);
}
.ml-team-tag-dot {
    color: var(--amber);
    padding: 0 10px;
    font-weight: 700;
}

/* ── FAQ ── */
.ml-faq-list {
    max-width: 760px; margin: 10px auto 0;
    text-align: left;
    display: flex; flex-direction: column; gap: 10px;
}
.ml-faq-item {
    background: var(--bg-soft);
    border: 1px solid var(--edge-soft);
    border-radius: 16px;
    overflow: hidden;
    transition: border-color 0.25s;
}
.ml-faq-item:hover { border-color: var(--edge); }
.ml-faq-open { border-color: rgba(229,166,83,0.35); background: linear-gradient(180deg, rgba(21,27,45,0.9), rgba(16,21,35,0.95)); }
.ml-faq-q {
    width: 100%;
    background: transparent; border: none; cursor: pointer;
    display: flex; align-items: flex-start; gap: 12px;
    padding: 18px 22px;
    font-family: inherit; text-align: left;
    color: var(--ink); font-size: 15.5px; font-weight: 600;
    transition: background 0.2s;
}
.ml-faq-q:hover { background: rgba(229,166,83,0.04); }
.ml-faq-marker {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 700;
    font-size: 18px;
    color: var(--amber);
    flex-shrink: 0;
    line-height: 1.2;
}
.ml-faq-qtext { flex: 1; line-height: 1.4; }
.ml-faq-chevron {
    font-family: 'Fraunces', serif;
    font-size: 24px; line-height: 1;
    color: var(--ink-mute);
    transform: rotate(90deg);
    transition: transform 0.3s cubic-bezier(.2,.8,.2,1);
    flex-shrink: 0;
}
.ml-faq-open .ml-faq-chevron { transform: rotate(-90deg); color: var(--amber); }
.ml-faq-a {
    max-height: 0; overflow: hidden;
    transition: max-height 0.35s cubic-bezier(.2,.8,.2,1);
}
.ml-faq-open .ml-faq-a { max-height: 360px; }
.ml-faq-a-inner {
    padding: 0 22px 20px 22px;
    display: flex; gap: 12px;
    color: var(--ink-mute);
    font-size: 14.5px; line-height: 1.65;
    border-top: 1px dashed var(--edge-soft);
    padding-top: 16px;
}
.ml-faq-marker-a {
    font-family: 'Fraunces', serif;
    font-style: italic;
    font-weight: 700;
    font-size: 18px;
    color: var(--sage);
    flex-shrink: 0;
    line-height: 1.2;
}

/* ── BIG CTA ── */
.ml-big-cta {
    position: relative; z-index: 2;
    margin: 120px auto 70px;
    padding: 70px 24px;
    max-width: 900px;
    text-align: center;
}
.ml-big-cta-inner {
    position: relative;
    background: linear-gradient(135deg, rgba(229,166,83,0.18), rgba(216,139,168,0.14));
    border: 1px solid rgba(229,166,83,0.3);
    border-radius: 28px;
    padding: 64px 40px;
    backdrop-filter: blur(10px);
    overflow: hidden;
}
.ml-big-cta-inner::before {
    content: '';
    position: absolute; inset: -1px;
    background:
        radial-gradient(circle at top left, rgba(229,166,83,0.35), transparent 60%),
        radial-gradient(circle at bottom right, rgba(216,139,168,0.28), transparent 60%);
    border-radius: 28px;
    pointer-events: none;
}
.ml-big-cta-title {
    position: relative;
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 800;
    font-size: clamp(30px, 4.5vw, 48px);
    line-height: 1.08;
    color: var(--ink);
    margin: 0 0 14px;
    letter-spacing: -0.022em;
}
.ml-big-cta-sub {
    position: relative;
    font-size: 16px; color: var(--ink);
    opacity: 0.85;
    max-width: 520px; margin: 0 auto 30px;
    line-height: 1.6;
}
.ml-big-cta .ml-cta-primary { position: relative; }

/* ── FOOTER ── */
.ml-footer {
    position: relative; z-index: 2;
    max-width: 1180px; margin: 0 auto;
    padding: 40px 24px 40px;
    border-top: 1px dashed var(--edge);
}
.ml-footer-top {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 18px;
    margin-bottom: 22px;
}
.ml-footer-links { display: flex; gap: 22px; flex-wrap: wrap; }
.ml-footer-link {
    font-size: 13px; color: var(--ink-mute); text-decoration: none;
    transition: color 0.2s;
}
.ml-footer-link:hover { color: var(--ink); }
.ml-footer-bottom {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 10px;
    font-size: 13px; color: var(--ink-faint);
}

/* ── Responsive tweaks ── */
@media (max-width: 720px) {
    .ml-nav { padding: 8px 14px; }
    .ml-nav-links { display: none; }
    .ml-hero-ctas { flex-direction: column; align-items: stretch; }
    .ml-sticky-1 { left: auto; right: 10px; top: -28px; }
    .ml-sticky-2 { right: 10px; bottom: -20px; }
    .ml-cta-annotation { display: none; }
    .ml-features, .ml-pricing, .ml-how, .ml-faq, .ml-placement, .ml-team { margin-top: 80px; }
}
@media (prefers-reduced-motion: reduce) {
    .ml-reveal { opacity: 1; transform: none; transition: none; }
    .ml-orb { animation: none; }
    .ml-sticky { animation: none; }
    .ml-eyebrow-dot { animation: none; }
    .ml-mock-bar-fill { animation: none; }
}
`
