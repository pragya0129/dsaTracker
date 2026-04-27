import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/TopBar'
import * as api from '../services/api'

const TOPICS = ['all', 'arrays', 'graphs', 'dynamic-programming', 'trees', 'binary-search', 'system-design', 'interview-tips', 'strings', 'backtracking']

const TOPIC_COLORS = {
    'arrays':              ['#E5A653', '#9F8FE3'],
    'graphs':              ['#10B981', '#34D399'],
    'dynamic-programming': ['#F59E0B', '#FCD34D'],
    'trees':               ['#9F8FE3', '#9F8FE3'],
    'binary-search':       ['#3B82F6', '#60A5FA'],
    'system-design':       ['#EC4899', '#F472B6'],
    'interview-tips':      ['#14B8A6', '#2DD4BF'],
    'strings':             ['#F97316', '#FB923C'],
    'backtracking':        ['#EF4444', '#F87171'],
    'general':             ['#94A3B8', '#CBD5E1'],
}

function topicColor(t) { return TOPIC_COLORS[t?.toLowerCase()] || TOPIC_COLORS.general }

function timeAgo(isoStr) {
    if (!isoStr) return ''
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000
    if (diff < 60) return `${Math.floor(diff)}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

function readTime(content) {
    const words = (content || '').trim().split(/\s+/).length
    return Math.max(1, Math.ceil(words / 200))
}

function TopicTag({ t, small }) {
    const [bg] = topicColor(t)
    return (
        <span style={{
            fontSize: small ? 10 : 11, fontWeight: 700,
            padding: small ? '2px 8px' : '3px 12px',
            borderRadius: 20, background: `${bg}18`, color: bg,
            border: `1px solid ${bg}30`,
        }}>{t}</span>
    )
}

// ─── Post card (in the feed grid) ────────────────────────────────────────────
function PostCard({ post, onLike, onDelete, myEmail, onOpen }) {
    const [liking, setLiking] = useState(false)
    const [liked, setLiked] = useState(post.likedByMe)
    const [likes, setLikes] = useState(post.likeCount)
    const [saved, setSaved] = useState(post.savedByMe)
    const [savingPost, setSavingPost] = useState(false)
    const [c1, c2] = topicColor(post.topic)
    const isOwner = myEmail && post.userId === myEmail

    async function handleLike(e) {
        e.stopPropagation()
        setLiking(true)
        const r = await onLike(post.id)
        if (r.ok) { setLiked(r.data.liked); setLikes(r.data.likeCount) }
        setLiking(false)
    }

    async function handleSave(e) {
        e.stopPropagation()
        if (savingPost) return
        setSavingPost(true)
        // optimistic
        const next = !saved
        setSaved(next)
        const r = next ? await api.savePost(post.id) : await api.unsavePost(post.id)
        if (!r.ok) setSaved(!next) // roll back
        setSavingPost(false)
    }

    return (
        <article
            onClick={() => onOpen(post)}
            style={{
                background: 'rgba(255,255,255,.028)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,.07)', borderRadius: 18,
                overflow: 'hidden', cursor: 'pointer', transition: 'all .2s',
                display: 'flex', flexDirection: 'column',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = `${c1}35` ; e.currentTarget.style.boxShadow = `0 12px 40px rgba(0,0,0,.25)` }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.07)'; e.currentTarget.style.boxShadow = 'none' }}
        >
            {/* Coloured accent bar */}
            <div style={{ height: 3, background: `linear-gradient(90deg,${c1},${c2})` }} />

            <div style={{ padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Author row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                            {(post.authorName || '?')[0].toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>{post.authorName || post.userId}</div>
                            <div style={{ fontSize: 10, color: '#64748B' }}>
                                {post.authorUsername && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>@{post.authorUsername} · </span>}
                                {timeAgo(post.createdAt)} · {readTime(post.content)} min read
                            </div>
                        </div>
                    </div>
                    <TopicTag t={post.topic} small />
                </div>

                {/* Title + preview */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15.5, fontWeight: 800, lineHeight: 1.45, marginBottom: 8, color: '#F1F5F9' }}>{post.title}</h3>
                    <p style={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {post.preview || post.content}
                    </p>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <button onClick={handleLike} disabled={liking} style={{ background: 'none', border: 'none', cursor: 'pointer', color: liked ? '#EF4444' : '#475569', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, padding: 0, transition: 'all .2s' }}>
                            {liked ? '❤️' : '🤍'} {likes}
                        </button>
                        <button onClick={handleSave} disabled={savingPost} title={saved ? 'Saved' : 'Save'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: saved ? 'var(--amber)' : '#475569', fontSize: 14, padding: 0, transition: 'color .2s' }}>
                            {saved ? '🔖' : '📑'}
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11.5, color: c1, fontWeight: 700 }}>Read →</span>
                        {isOwner && (
                            <button onClick={e => { e.stopPropagation(); onDelete(post.id) }} style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#EF4444', fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 7, cursor: 'pointer' }}>Delete</button>
                        )}
                    </div>
                </div>
            </div>
        </article>
    )
}

// ─── Full blog-style post view ────────────────────────────────────────────────
function PostView({ post, onBack, onLike, myEmail }) {
    const [liked, setLiked] = useState(post.likedByMe)
    const [likes, setLikes] = useState(post.likeCount)
    const [saved, setSaved] = useState(post.savedByMe)
    const [following, setFollowing] = useState(false)
    const [followBusy, setFollowBusy] = useState(false)
    const [c1, c2] = topicColor(post.topic)
    const isMe = myEmail && post.userId === myEmail

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        const onKey = e => { if (e.key === 'Escape') onBack() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onBack])

    // Resolve initial follow state on mount when we know the author's @handle
    useEffect(() => {
        if (!post.authorUsername || isMe) return
        api.fetchFollowStatus(post.authorUsername).then(r => {
            if (r.ok) setFollowing(!!r.data.following)
        })
    }, [post.authorUsername, isMe])

    async function handleLike() {
        const r = await onLike(post.id)
        if (r.ok) { setLiked(r.data.liked); setLikes(r.data.likeCount) }
    }

    async function handleSave() {
        const next = !saved
        setSaved(next) // optimistic
        const r = next ? await api.savePost(post.id) : await api.unsavePost(post.id)
        if (!r.ok) setSaved(!next)
    }

    async function handleFollow() {
        if (!post.authorUsername || followBusy) return
        setFollowBusy(true)
        const r = following
            ? await api.unfollowUser(post.authorUsername)
            : await api.followUser(post.authorUsername)
        if (r.ok) setFollowing(!!r.data.following)
        setFollowBusy(false)
    }

    const mins = readTime(post.content)

    return (
        <div style={{ maxWidth: 740, margin: '0 auto', paddingBottom: 80 }}>

            {/* Back button */}
            <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#94A3B8', padding: '8px 16px', borderRadius: 10, fontWeight: 600, fontSize: 12.5, cursor: 'pointer', marginBottom: 32, transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.09)'; e.currentTarget.style.color = '#F1F5F9' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = '#94A3B8' }}>
                ← Back to Community
            </button>

            {/* Topic tag */}
            <div style={{ marginBottom: 16 }}>
                <TopicTag t={post.topic} />
            </div>

            {/* Title */}
            <h1 style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.3, marginBottom: 20, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                {post.title}
            </h1>

            {/* Author bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, paddingBottom: 24, borderBottom: `1px solid rgba(255,255,255,.07)` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg,${c1},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 17, color: '#fff', flexShrink: 0 }}>
                        {(post.authorName || '?')[0].toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>{post.authorName || post.userId}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>
                            {post.authorUsername && <span style={{ color: 'var(--amber)', fontWeight: 600 }}>@{post.authorUsername} · </span>}
                            {timeAgo(post.createdAt)} · {mins} min read
                        </div>
                    </div>
                    {/* Follow button — only for posts by someone else who has a @handle */}
                    {post.authorUsername && !isMe && (
                        <button
                            onClick={handleFollow}
                            disabled={followBusy}
                            style={{
                                marginLeft: 8,
                                padding: '6px 14px',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: followBusy ? 'wait' : 'pointer',
                                border: following ? '1px solid var(--border)' : '1px solid var(--amber)',
                                background: following ? 'transparent' : 'var(--amber-light)',
                                color: following ? 'var(--text-secondary)' : 'var(--amber)',
                                transition: 'all .2s',
                            }}>
                            {following ? 'Following' : '+ Follow'}
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleSave} title={saved ? 'Saved' : 'Save for later'}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            background: saved ? 'var(--amber-light)' : 'rgba(255,255,255,.05)',
                            border: `1px solid ${saved ? 'var(--border-hover)' : 'rgba(255,255,255,.1)'}`,
                            color: saved ? 'var(--amber)' : '#94A3B8', transition: 'all .2s' }}>
                        {saved ? '🔖 Saved' : '📑 Save'}
                    </button>
                    <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .2s', background: liked ? 'rgba(239,68,68,.12)' : 'rgba(255,255,255,.05)', border: `1px solid ${liked ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.1)'}`, color: liked ? '#EF4444' : '#94A3B8' }}>
                        {liked ? '❤️' : '🤍'} {likes} {likes === 1 ? 'like' : 'likes'}
                    </button>
                </div>
            </div>

            {/* Content — proper blog typography, rendered from markdown */}
            <Markdown text={post.content} />
            <style>{MD_CSS}</style>

            {/* Bottom action bar */}
            <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 11, fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all .2s', background: liked ? 'rgba(239,68,68,.12)' : 'rgba(255,255,255,.05)', border: `1px solid ${liked ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.1)'}`, color: liked ? '#EF4444' : '#94A3B8' }}>
                    {liked ? '❤️' : '🤍'} {liked ? 'Liked' : 'Like this post'}
                </button>
                <button onClick={onBack} style={{ background: `linear-gradient(135deg,${c1},${c2})`, color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    ← Back to feed
                </button>
            </div>
        </div>
    )
}

// ─── Markdown → React renderer (tiny, no external deps) ──────────────────
//
// Supports the syntax that actually matters for blog posts:
//   Headings    # H1 · ## H2 · ### H3
//   Emphasis    **bold** · *italic* · _italic_
//   Code        `inline`  +  fenced ```blocks```
//   Lists       - bullet  |  1. numbered
//   Quote       > line
//   Link        [text](url)
//   Divider     --- (alone on a line)
//
// Deliberately limited — keeps the renderer readable and makes the
// toolbar + preview stay perfectly in sync with what the user sees.

// Inline-level tokens: handled inside a single text run (e.g. inside a <p>).
// SECURITY — Allowlist URL schemes for markdown links. Anything else
// (javascript:, data:, vbscript:, file:, about:, blob:, etc.) is rejected.
// Without this, a blog post like `[click](javascript:fetch('/steal'))` would
// produce an `<a href="javascript:…">` that runs attacker code on click.
// SECURITY — Allowlist URL schemes for markdown links. Anything else
// (javascript:, data:, vbscript:, file:, about:, blob:, etc.) is rejected.
// Without this, a blog post like `[click](javascript:fetch('/steal'))` would
// produce an `<a href="javascript:…">` that runs attacker code on click.
function safeLinkUrl(raw) {
    if (raw == null) return null
    const url = String(raw).trim()
    if (!url) return null
    // Relative paths and same-page anchors are always fine.
    if (url.startsWith('/') || url.startsWith('#')) return url
    // Lowercased prefix check — http(s) and mailto only. Anything else
    // (javascript:, data:, vbscript:, etc.) is rejected.
    const lower = url.toLowerCase()
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:')) {
        return url
    }
    return null
}

function mdInline(s, keyBase = 'i') {
    if (!s) return null
    const out = []
    let i = 0
    let k = 0
    // Order: code > bold > italic (*..*) > italic (_.._) > link
    const RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+]\([^)\s]+\))/g
    let m
    while ((m = RE.exec(s)) !== null) {
        if (m.index > i) out.push(s.slice(i, m.index))
        const key = keyBase + '-' + k++
        if (m[1]) {
            out.push(<code key={key} className="md-icode">{m[1].slice(1, -1)}</code>)
        } else if (m[2]) {
            out.push(<strong key={key}>{m[2].slice(2, -2)}</strong>)
        } else if (m[3]) {
            out.push(<em key={key}>{m[3].slice(1, -1)}</em>)
        } else if (m[4]) {
            out.push(<em key={key}>{m[4].slice(1, -1)}</em>)
        } else if (m[5]) {
            const inner = m[5]
            const sep = inner.indexOf(']')
            const text = inner.slice(1, sep)
            const safe = safeLinkUrl(inner.slice(sep + 2, -1))
            if (safe) {
                out.push(
                    <a key={key} href={safe} target="_blank" rel="noopener noreferrer nofollow"
                       className="md-link">
                        {text}
                    </a>
                )
            } else {
                // Unsafe scheme: render the link text as plain text so the
                // user still sees what was written, but no clickable link.
                out.push(<span key={key} className="md-link-blocked" title="Link blocked: unsupported URL">{text}</span>)
            }
        }
        i = RE.lastIndex
    }
    if (i < s.length) out.push(s.slice(i))
    return out
}

// Block-level walk over the lines. Each pattern consumes its own lines.
function Markdown({ text }) {
    if (!text) return null
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    const blocks = []
    let i = 0
    let k = 0

    while (i < lines.length) {
        const line = lines[i]

        // Fenced code block
        if (/^```/.test(line)) {
            const code = []
            i++
            while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++ }
            i++ // eat closing fence if present
            blocks.push(<pre key={k++} className="md-block"><code>{code.join('\n')}</code></pre>)
            continue
        }

        // Horizontal rule
        if (/^\s*---\s*$/.test(line)) {
            blocks.push(<hr key={k++} className="md-hr" />)
            i++
            continue
        }

        // Heading
        const h = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/)
        if (h) {
            const level = h[1].length
            const cls = `md-h${level}`
            if (level === 1) blocks.push(<h1 key={k++} className={cls}>{mdInline(h[2], 'h' + k)}</h1>)
            else if (level === 2) blocks.push(<h2 key={k++} className={cls}>{mdInline(h[2], 'h' + k)}</h2>)
            else blocks.push(<h3 key={k++} className={cls}>{mdInline(h[2], 'h' + k)}</h3>)
            i++
            continue
        }

        // Blockquote
        if (/^>\s?/.test(line)) {
            const items = []
            while (i < lines.length && /^>\s?/.test(lines[i])) {
                items.push(lines[i].replace(/^>\s?/, ''))
                i++
            }
            blocks.push(
                <blockquote key={k++} className="md-quote">
                    {items.map((ln, j) => <p key={j}>{mdInline(ln, 'q' + k + '-' + j)}</p>)}
                </blockquote>
            )
            continue
        }

        // Unordered list
        if (/^\s*[-*]\s+/.test(line)) {
            const items = []
            while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
                i++
            }
            blocks.push(
                <ul key={k++} className="md-ul">
                    {items.map((ln, j) => <li key={j}>{mdInline(ln, 'ul' + k + '-' + j)}</li>)}
                </ul>
            )
            continue
        }

        // Ordered list
        if (/^\s*\d+\.\s+/.test(line)) {
            const items = []
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
                i++
            }
            blocks.push(
                <ol key={k++} className="md-ol">
                    {items.map((ln, j) => <li key={j}>{mdInline(ln, 'ol' + k + '-' + j)}</li>)}
                </ol>
            )
            continue
        }

        // Blank line → end-of-paragraph separator, skip
        if (/^\s*$/.test(line)) { i++; continue }

        // Default: paragraph. Consume consecutive non-special lines.
        const para = [line]
        i++
        while (
            i < lines.length &&
            !/^\s*$/.test(lines[i]) &&
            !/^(#{1,3}\s|>\s?|```|\s*---\s*$|\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])
        ) {
            para.push(lines[i])
            i++
        }
        blocks.push(<p key={k++} className="md-p">{mdInline(para.join(' '), 'p' + k)}</p>)
    }

    return <div className="md-body">{blocks}</div>
}

// ─── Textarea formatting helpers ──────────────────────────────────────────
// These operate on a raw textarea (DOM node) and return the NEXT {value,
// selection} — the caller commits to React state, then restores selection.

function mdWrap(ta, before, after = before, placeholder = '') {
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const v     = ta.value
    const sel   = v.slice(start, end) || placeholder
    const next  = v.slice(0, start) + before + sel + after + v.slice(end)
    return {
        value: next,
        selStart: start + before.length,
        selEnd:   start + before.length + sel.length,
    }
}

function mdLinePrefix(ta, prefix) {
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const v     = ta.value
    // Expand to line boundaries
    const lineStart = v.lastIndexOf('\n', start - 1) + 1
    let lineEnd = v.indexOf('\n', end)
    if (lineEnd === -1) lineEnd = v.length
    const block    = v.slice(lineStart, lineEnd)
    const replaced = block.split('\n').map(ln => prefix + ln).join('\n')
    const next     = v.slice(0, lineStart) + replaced + v.slice(lineEnd)
    return {
        value: next,
        selStart: lineStart,
        selEnd:   lineStart + replaced.length,
    }
}

function mdInsertAt(ta, snippet) {
    const start = ta.selectionStart
    const v     = ta.value
    const next  = v.slice(0, start) + snippet + v.slice(start)
    return {
        value: next,
        selStart: start + snippet.length,
        selEnd:   start + snippet.length,
    }
}

// Code block — the opening ``` must sit at the START of its own line or the
// markdown parser won't recognise the fence. This helper guarantees that
// regardless of where the cursor is when the user clicks the toolbar button.
function mdCodeBlock(ta, lang = '', placeholder = 'code') {
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const v     = ta.value
    const sel   = v.slice(start, end) || placeholder

    // Prepend a newline if the cursor isn't already at a line start.
    const needLead = start > 0 && v[start - 1] !== '\n'
    // Append a newline if the next char isn't already a newline or EOF.
    const needTrail = end < v.length && v[end] !== '\n'

    const before = (needLead ? '\n' : '') + '```' + lang + '\n'
    const after  = '\n```' + (needTrail ? '\n' : '')

    const next = v.slice(0, start) + before + sel + after + v.slice(end)
    const selStart = start + before.length
    const selEnd   = selStart + sel.length
    return { value: next, selStart, selEnd }
}

// ─── Write editor (full page, not a modal) ────────────────────────────────────
function WriteEditor({ onCancel, onPublished }) {
    const [form, setForm] = useState({ title: '', topic: 'arrays', content: '' })
    const [formErr, setFormErr] = useState('')
    const [submitting, setSub] = useState(false)
    const [preview, setPreview] = useState(false)
    const textareaRef = useRef(null)
    const [c1] = topicColor(form.topic)

    useEffect(() => {
        const onKey = e => { if (e.key === 'Escape') onCancel() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onCancel])

    // Auto-grow textarea — grow-only while the user types.
    //
    // The old "set height:auto then read scrollHeight" trick was the real
    // source of the bouncing: that intermediate auto height briefly shrinks
    // the textarea on every keystroke, which races the browser's
    // cursor-into-view scroll and produces the jitter.
    //
    // Instead we only GROW when new content overflows the current height,
    // and defer the rare shrink (on deletion) to a requestAnimationFrame
    // with scroll-position restoration, so it can't jerk the page either.
    function autoResize(el) {
        if (!el) return
        // Typing: scrollHeight > clientHeight means text just wrapped past
        // the current box. Just bump the height — no reset, no bounce.
        if (el.scrollHeight > el.clientHeight) {
            el.style.height = el.scrollHeight + 'px'
            return
        }
        // Deletion / paste-shorter: schedule a quiet remeasure so any page
        // scroll the browser triggers during reflow is snapped back.
        requestAnimationFrame(() => {
            if (!el.isConnected) return
            const sy = window.scrollY
            el.style.height = 'auto'
            const h = el.scrollHeight
            el.style.height = h + 'px'
            if (window.scrollY !== sy) window.scrollTo(0, sy)
        })
    }

    // ── Apply a formatting fn to the body textarea ──
    // Commits the new value to state, then restores focus + selection on
    // the next paint so the user's cursor lands where they'd expect.
    function applyFormat(fn) {
        const ta = textareaRef.current
        if (!ta) return
        const r = fn(ta)
        if (!r) return
        setForm(f => ({ ...f, content: r.value }))
        requestAnimationFrame(() => {
            ta.focus()
            ta.setSelectionRange(r.selStart, r.selEnd)
            autoResize(ta)
        })
    }

    // Textarea keyboard shortcuts — the classic blog-editor triad.
    function onBodyKeyDown(e) {
        const mod = e.ctrlKey || e.metaKey
        if (!mod) return
        const key = e.key.toLowerCase()
        if (key === 'b') { e.preventDefault(); applyFormat(ta => mdWrap(ta, '**', '**', 'bold text')) }
        else if (key === 'i') { e.preventDefault(); applyFormat(ta => mdWrap(ta, '*', '*', 'italic')) }
        else if (key === 'k') { e.preventDefault(); applyFormat(ta => mdWrap(ta, '[', '](https://)', 'link text')) }
    }

    // Toolbar definition — the order is optimised for mouse-scanning:
    // structure first (headings), then weight (bold/italic/code), then
    // containers (link/list/quote), then block tools (codeblock/hr).
    const TOOLS = [
        { id: 'h1',    label: 'H1',  title: 'Heading 1',      apply: ta => mdLinePrefix(ta, '# ')  },
        { id: 'h2',    label: 'H2',  title: 'Heading 2',      apply: ta => mdLinePrefix(ta, '## ') },
        { id: 'h3',    label: 'H3',  title: 'Heading 3',      apply: ta => mdLinePrefix(ta, '### ') },
        { id: 'sep1',  separator: true },
        { id: 'b',     label: 'B',   title: 'Bold  (Ctrl+B)',   bold: true,   apply: ta => mdWrap(ta, '**', '**', 'bold text') },
        { id: 'i',     label: 'I',   title: 'Italic  (Ctrl+I)', italic: true, apply: ta => mdWrap(ta, '*', '*', 'italic') },
        { id: 'sep2',  separator: true },
        { id: 'link',  label: '🔗',  title: 'Link  (Ctrl+K)',   apply: ta => mdWrap(ta, '[', '](https://)', 'link text') },
        { id: 'ul',    label: '• List',   title: 'Bulleted list', apply: ta => mdLinePrefix(ta, '- ') },
        { id: 'ol',    label: '1. List',  title: 'Numbered list', apply: ta => mdLinePrefix(ta, '1. ') },
        { id: 'quote', label: '“ ”', title: 'Quote',          apply: ta => mdLinePrefix(ta, '> ') },
        { id: 'sep3',  separator: true },
        // Single unambiguous code button — always produces a ```fenced``` block.
        { id: 'code',  label: '</>', title: 'Code block  (```)', mono: true, apply: ta => mdCodeBlock(ta) },
        { id: 'hr',    label: '—',   title: 'Divider',        apply: ta => mdInsertAt(ta, '\n\n---\n\n') },
    ]

    async function handleSubmit(e) {
        e.preventDefault(); setFormErr('')
        if (!form.title.trim()) { setFormErr('A title is required'); return }
        if (!form.content.trim()) { setFormErr('Content cannot be empty'); return }
        setSub(true)
        const r = await api.createPost(form.title, form.topic, form.content)
        setSub(false)
        if (r.ok) { onPublished() }
        else { setFormErr(r.error || 'Failed to publish') }
    }

    const words = form.content.trim().split(/\s+/).filter(Boolean).length
    const mins = Math.max(1, Math.ceil(words / 200))

    return (
        <div style={{ maxWidth: 780, margin: '0 auto', paddingBottom: 80 }}>

            {/* Top bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <button onClick={onCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#94A3B8', padding: '8px 16px', borderRadius: 10, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                    ← Discard
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {form.content && (
                        <button type="button" onClick={() => setPreview(p => !p)} style={{ background: preview ? `${c1}20` : 'rgba(255,255,255,.05)', border: `1px solid ${preview ? c1 + '50' : 'rgba(255,255,255,.1)'}`, color: preview ? c1 : '#94A3B8', padding: '8px 16px', borderRadius: 10, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
                            {preview ? '✏️ Edit' : '👁 Preview'}
                        </button>
                    )}
                    <button onClick={handleSubmit} disabled={submitting || !form.title.trim() || !form.content.trim()} style={{ background: submitting ? 'rgba(229,166,83,.4)' : 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: '#fff', border: 'none', padding: '9px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (!form.title.trim() || !form.content.trim()) ? 0.4 : 1 }}>
                        {submitting ? 'Publishing…' : 'Publish Post'}
                    </button>
                </div>
            </div>

            {formErr && (
                <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#EF4444', padding: '10px 16px', borderRadius: 11, fontSize: 13, marginBottom: 20 }}>
                    {formErr}
                </div>
            )}

            {preview ? (
                /* ── Preview mode ── */
                <div>
                    <div style={{ marginBottom: 16 }}><TopicTag t={form.topic} /></div>
                    <h1 style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.3, marginBottom: 16, color: '#F8FAFC', letterSpacing: '-0.02em' }}>
                        {form.title || <span style={{ color: '#475569' }}>Untitled post</span>}
                    </h1>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 28 }}>{words} words · {mins} min read</div>
                    <Markdown text={form.content} />
                </div>
            ) : (
                /* ── Edit mode ── */
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {/* Topic + meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
                        <select
                            value={form.topic}
                            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                            style={{ background: `${c1}15`, border: `1px solid ${c1}40`, borderRadius: 20, padding: '5px 14px', color: c1, fontSize: 12, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                        >
                            {TOPICS.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {words > 0 && <span style={{ fontSize: 11, color: '#475569' }}>{words} words · {mins} min read</span>}
                    </div>

                    {/* Title — no length cap, write as long as you want. */}
                    <textarea
                        value={form.title}
                        onChange={e => { setForm(f => ({ ...f, title: e.target.value })); autoResize(e.target) }}
                        placeholder="Your post title…"
                        rows={1}
                        style={{
                            width: '100%', background: 'transparent', border: 'none', outline: 'none',
                            fontSize: 30, fontWeight: 900, color: '#F8FAFC', lineHeight: 1.3,
                            resize: 'none', fontFamily: 'inherit', overflow: 'hidden',
                            padding: 0, marginBottom: 20, letterSpacing: '-0.02em',
                            boxSizing: 'border-box',
                        }}
                    />

                    {/* Divider */}
                    <div style={{ height: 1, background: 'rgba(255,255,255,.07)', marginBottom: 20 }} />

                    {/* ── Formatting toolbar ── */}
                    <div className="md-toolbar" role="toolbar" aria-label="Formatting">
                        {TOOLS.map(t => t.separator
                            ? <span key={t.id} className="md-tb-sep" aria-hidden />
                            : (
                                <button
                                    key={t.id}
                                    type="button"
                                    title={t.title}
                                    aria-label={t.title}
                                    onClick={() => applyFormat(t.apply)}
                                    className={
                                        'md-tb-btn' +
                                        (t.bold   ? ' md-tb-bold'   : '') +
                                        (t.italic ? ' md-tb-italic' : '') +
                                        (t.mono   ? ' md-tb-mono'   : '')
                                    }
                                >
                                    {t.label}
                                </button>
                            )
                        )}
                    </div>

                    {/* Body */}
                    <textarea
                        ref={textareaRef}
                        value={form.content}
                        onChange={e => { setForm(f => ({ ...f, content: e.target.value })); autoResize(e.target) }}
                        onKeyDown={onBodyKeyDown}
                        placeholder="Start writing your post…

Try a heading:   # My approach
Emphasise:       **bold**, *italic*, `inline code`
List your steps: - first step
                 - second step
Quote:           > a lesson that stuck
Link:            [read more](https://…)"
                        style={{
                            width: '100%', background: 'transparent', border: 'none', outline: 'none',
                            fontSize: 16, color: '#CBD5E1', lineHeight: 1.85,
                            resize: 'none', fontFamily: 'inherit', minHeight: 360,
                            padding: 0, boxSizing: 'border-box',
                        }}
                    />

                    {/* ── Syntax hint row ── */}
                    <div className="md-hint">
                        <span><strong className="md-hint-k">**bold**</strong></span>
                        <span><em className="md-hint-k">*italic*</em></span>
                        <span><code className="md-hint-k">```code```</code></span>
                        <span><span className="md-hint-k"># Heading</span></span>
                        <span><span className="md-hint-k">- list</span></span>
                        <span><span className="md-hint-k">&gt; quote</span></span>
                        <span className="md-hint-muted">markdown supported</span>
                    </div>
                </form>
            )}

            {/* Scoped styles for toolbar + rendered markdown */}
            <style>{MD_CSS}</style>
        </div>
    )
}

// ─── Scoped styles for the Markdown toolbar + rendered output ─────────────
// Everything under .md-body / .md-toolbar / .md-hint is opt-in — nothing
// here leaks onto the rest of the page.
const MD_CSS = `
/* ── Toolbar ── */
.md-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    margin-bottom: 14px;
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    backdrop-filter: blur(6px);
    /* NB: deliberately NOT sticky — sticky + an auto-growing textarea below
       was forcing the viewport to jump as lines wrapped while typing. */
}
.md-tb-btn {
    min-width: 32px;
    height: 32px;
    padding: 0 10px;
    background: transparent;
    border: 1px solid transparent;
    color: #CBD5E1;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.md-tb-btn:hover {
    background: rgba(229, 166, 83, 0.12);
    color: #F8FAFC;
    border-color: rgba(229, 166, 83, 0.25);
}
.md-tb-btn:active { transform: translateY(1px); }
.md-tb-bold   { font-weight: 900; }
.md-tb-italic { font-style: italic; }
.md-tb-mono   { font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace; font-size: 12px; }
.md-tb-sep {
    width: 1px; height: 18px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 4px;
    display: inline-block;
}

/* ── Syntax hint row ── */
.md-hint {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px dashed rgba(255, 255, 255, 0.06);
    font-size: 12px;
    color: #64748B;
}
.md-hint-k {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 11.5px;
    color: #94A3B8;
    background: rgba(15, 23, 42, 0.6);
    padding: 2px 7px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}
.md-hint-muted {
    margin-left: auto;
    opacity: 0.6;
    font-style: italic;
}

/* ── Rendered body — real blog typography ── */
.md-body {
    font-size: 16px;
    line-height: 1.8;
    color: #CBD5E1;
    letter-spacing: 0.005em;
}
.md-body > * + * { margin-top: 18px; }

.md-h1, .md-h2, .md-h3 {
    color: #F1F5F9;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.25;
    margin-top: 36px;
}
.md-h1 { font-size: 28px; margin-top: 28px; }
.md-h2 {
    font-size: 22px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.md-h3 { font-size: 18px; color: #E2E8F0; }

.md-p { margin: 0; }

.md-body strong {
    color: #F1F5F9;
    font-weight: 800;
}
.md-body em { color: #E2E8F0; font-style: italic; }

.md-icode {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 0.88em;
    padding: 2px 7px;
    border-radius: 5px;
    background: rgba(229, 166, 83, 0.1);
    border: 1px solid rgba(229, 166, 83, 0.18);
    color: #F3C887;
}

.md-block {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
    font-size: 13.5px;
    line-height: 1.6;
    padding: 16px 18px;
    background: rgba(8, 12, 30, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-left: 3px solid rgba(229, 166, 83, 0.55);
    border-radius: 10px;
    color: #E2E8F0;
    overflow-x: auto;
}
.md-block code { background: none; border: none; padding: 0; color: inherit; font-size: inherit; }

.md-ul, .md-ol {
    margin: 0;
    padding-left: 26px;
    color: #CBD5E1;
}
.md-ul li, .md-ol li {
    margin: 8px 0;
    padding-left: 4px;
    line-height: 1.7;
}
.md-ul li::marker { color: #E5A653; }
.md-ol li::marker { color: #9F8FE3; font-weight: 700; }

.md-quote {
    margin: 0;
    padding: 4px 18px;
    border-left: 3px solid rgba(159, 143, 227, 0.7);
    background: rgba(159, 143, 227, 0.05);
    color: #E2E8F0;
    font-style: italic;
    border-radius: 0 10px 10px 0;
}
.md-quote p { margin: 8px 0; }

.md-hr {
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(229,166,83,0.3), transparent);
    margin: 28px 0;
}

.md-link {
    color: #F3C887;
    text-decoration: none;
    border-bottom: 1px solid rgba(243, 200, 135, 0.35);
    transition: color 0.15s, border-color 0.15s;
}
.md-link:hover {
    color: #FFE4BC;
    border-bottom-color: rgba(255, 228, 188, 0.7);
}
/* Link rejected by the URL-scheme allowlist — shown as muted strikethrough text. */
.md-link-blocked {
    color: #94A3B8;
    text-decoration: line-through;
    text-decoration-color: rgba(148, 163, 184, 0.5);
    cursor: not-allowed;
}
`

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CommunityPage() {
    const navigate = useNavigate()

    // view: 'feed' | 'write' | 'post'
    const [view, setView] = useState('feed')
    const [tab, setTab] = useState('feed')   // feed tab: 'feed' | 'mine'
    const [topic, setTopic] = useState('all')
    const [posts, setPosts] = useState([])
    const [myPosts, setMyPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(0)
    const [hasNext, setHasNext] = useState(false)
    const [openPost, setOpenPost] = useState(null)
    const myEmail = api.getUserEmail?.() || ''

    useEffect(() => {
        if (!api.isAuthenticated()) { navigate('/login'); return }
        loadFeed(0)
    }, [topic])

    async function loadFeed(pg = 0) {
        setLoading(true)
        const r = topic === 'all'
            ? await api.fetchFeed(pg, 10)
            : await api.fetchFeedByTopic(topic, pg, 10)
        if (r.ok) {
            setPosts(pg === 0 ? r.data.posts : prev => [...prev, ...r.data.posts])
            setHasNext(r.data.hasNext)
            setPage(pg)
        }
        setLoading(false)
    }

    async function loadMine() {
        const r = await api.fetchMyPosts()
        if (r.ok) setMyPosts(r.data)
    }

    useEffect(() => { if (tab === 'mine') loadMine() }, [tab])

    function openPostView(post) { setOpenPost(post); setView('post') }
    function closePost() { setOpenPost(null); setView('feed') }
    function openWrite() { setView('write') }
    function closeWrite() { setView('feed') }
    function afterPublish() { setView('feed'); loadFeed(0); setTab('feed') }

    async function handleLike(postId) { return api.toggleLike(postId) }

    async function handleDelete(postId) {
        if (!confirm('Delete this post?')) return
        const r = await api.deletePost(postId)
        if (r.ok) { loadFeed(0); if (tab === 'mine') loadMine() }
    }

    // ── Write view ──
    if (view === 'write') {
        return (
            <div className="app-shell" style={{ background: 'linear-gradient(140deg,#0B0F1A,#121727 50%,#0B0F1A)' }}>
                <Sidebar />
                <div className="main-content">
                    <Topbar title="Write a Post" subtitle="Share your insight with the community" />
                    <main className="page-content">
                        <WriteEditor onCancel={closeWrite} onPublished={afterPublish} />
                    </main>
                </div>
            </div>
        )
    }

    // ── Post view ──
    if (view === 'post' && openPost) {
        return (
            <div className="app-shell" style={{ background: 'linear-gradient(140deg,#0B0F1A,#121727 50%,#0B0F1A)' }}>
                <Sidebar />
                <div className="main-content">
                    <Topbar title="Community" subtitle="Reading a post" />
                    <main className="page-content">
                        <PostView post={openPost} onBack={closePost} onLike={handleLike} myEmail={myEmail} />
                    </main>
                </div>
            </div>
        )
    }

    // ── Feed view ──
    return (
        <div className="app-shell" style={{ background: 'linear-gradient(140deg,#0B0F1A,#121727 50%,#0B0F1A)' }}>
            <div style={{ position: 'fixed', top: -180, left: 60, width: 400, height: 400, background: 'radial-gradient(circle,rgba(229,166,83,.06),transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
            <Sidebar />
            <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
                <Topbar title="Community" subtitle="Insights and tips from fellow developers" />
                <main className="page-content">

                    {/* ── Header row ── */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,.03)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,.06)' }}>
                            {[['feed', '📰 Feed'], ['mine', '✍️ My Posts']].map(([k, l]) => (
                                <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 18px', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', border: 'none', transition: 'all .2s', background: tab === k ? 'linear-gradient(135deg,#E5A653,#9F8FE3)' : 'transparent', color: tab === k ? '#fff' : '#64748B', boxShadow: tab === k ? '0 3px 12px rgba(229,166,83,.35)' : 'none' }}>
                                    {l}
                                </button>
                            ))}
                        </div>
                        <button onClick={openWrite} style={{ background: 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(229,166,83,.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            ✏️ Write a Post
                        </button>
                    </div>

                    {/* ── Feed tab ── */}
                    {tab === 'feed' && (<>
                        {/* Topic filter */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
                            {TOPICS.map(t => {
                                const [bg] = topicColor(t)
                                const sel = topic === t
                                return (
                                    <button key={t} onClick={() => { setTopic(t); setPage(0) }} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid', transition: 'all .2s', background: sel ? `linear-gradient(135deg,${topicColor(t)[0]},${topicColor(t)[1]})` : 'rgba(255,255,255,.04)', color: sel ? '#fff' : '#64748B', borderColor: sel ? 'transparent' : 'rgba(255,255,255,.08)' }}>
                                        {t === 'all' ? '🌐 All' : t}
                                    </button>
                                )
                            })}
                        </div>

                        {loading && page === 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 14 }}>
                                <div style={{ width: 38, height: 38, border: '3px solid rgba(229,166,83,.2)', borderTop: '3px solid #E5A653', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                                <div style={{ color: '#64748B', fontSize: 13 }}>Loading community feed…</div>
                            </div>
                        )}

                        {!loading && posts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '70px 32px', color: '#64748B' }}>
                                <div style={{ fontSize: 52, marginBottom: 16 }}>📝</div>
                                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#94A3B8' }}>No posts yet {topic !== 'all' ? `in "${topic}"` : ''}</div>
                                <div style={{ fontSize: 13 }}>Be the first to share something!</div>
                                <button onClick={openWrite} style={{ marginTop: 20, background: 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 11, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Write a Post</button>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
                            {posts.map(p => (
                                <PostCard key={p.id} post={p} onLike={handleLike} onDelete={handleDelete} myEmail={myEmail} onOpen={openPostView} />
                            ))}
                        </div>

                        {hasNext && (
                            <div style={{ textAlign: 'center', marginTop: 28 }}>
                                <button onClick={() => loadFeed(page + 1)} disabled={loading} style={{ background: 'rgba(229,166,83,.12)', border: '1px solid rgba(229,166,83,.25)', color: '#9F8FE3', padding: '10px 32px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                    {loading ? 'Loading…' : 'Load more'}
                                </button>
                            </div>
                        )}
                    </>)}

                    {/* ── My Posts tab ── */}
                    {tab === 'mine' && (
                        myPosts.length === 0
                            ? (
                                <div style={{ textAlign: 'center', padding: '70px 32px', color: '#64748B' }}>
                                    <div style={{ fontSize: 52, marginBottom: 16 }}>✍️</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#94A3B8' }}>No posts yet</div>
                                    <div style={{ fontSize: 13 }}>Share a tip, a walkthrough, or something that helped you crack a problem.</div>
                                    <button onClick={openWrite} style={{ marginTop: 20, background: 'linear-gradient(135deg,#E5A653,#9F8FE3)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 11, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Write your first post</button>
                                </div>
                            )
                            : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
                                    {myPosts.map(p => (
                                        <PostCard key={p.id} post={p} onLike={handleLike} onDelete={handleDelete} myEmail={myEmail} onOpen={openPostView} />
                                    ))}
                                </div>
                            )
                    )}

                </main>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    )
}
