import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import * as api from '../services/api'

const TOPICS = ['all', 'arrays', 'graphs', 'dynamic-programming', 'trees', 'binary-search', 'system-design', 'interview-tips', 'strings', 'backtracking']

const TOPIC_COLORS = {
    'arrays':              ['#6366F1', '#818CF8'],
    'graphs':              ['#10B981', '#34D399'],
    'dynamic-programming': ['#F59E0B', '#FCD34D'],
    'trees':               ['#8B5CF6', '#A78BFA'],
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
    const [c1, c2] = topicColor(post.topic)
    const isOwner = myEmail && post.userId === myEmail

    async function handleLike(e) {
        e.stopPropagation()
        setLiking(true)
        const r = await onLike(post.id)
        if (r.ok) { setLiked(r.data.liked); setLikes(r.data.likeCount) }
        setLiking(false)
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
                            <div style={{ fontSize: 10, color: '#64748B' }}>{timeAgo(post.createdAt)} · {readTime(post.content)} min read</div>
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
                    <button onClick={handleLike} disabled={liking} style={{ background: 'none', border: 'none', cursor: 'pointer', color: liked ? '#EF4444' : '#475569', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, padding: 0, transition: 'all .2s' }}>
                        {liked ? '❤️' : '🤍'} {likes}
                    </button>
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
    const [c1, c2] = topicColor(post.topic)

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
        const onKey = e => { if (e.key === 'Escape') onBack() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onBack])

    async function handleLike() {
        const r = await onLike(post.id)
        if (r.ok) { setLiked(r.data.liked); setLikes(r.data.likeCount) }
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
                        <div style={{ fontSize: 12, color: '#64748B' }}>{timeAgo(post.createdAt)} · {mins} min read</div>
                    </div>
                </div>

                {/* Like button */}
                <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .2s', background: liked ? 'rgba(239,68,68,.12)' : 'rgba(255,255,255,.05)', border: `1px solid ${liked ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.1)'}`, color: liked ? '#EF4444' : '#94A3B8' }}>
                    {liked ? '❤️' : '🤍'} {likes} {likes === 1 ? 'like' : 'likes'}
                </button>
            </div>

            {/* Content — proper blog typography */}
            <div style={{ fontSize: 16, lineHeight: 1.85, color: '#CBD5E1', whiteSpace: 'pre-wrap', letterSpacing: '0.01em' }}>
                {post.content}
            </div>

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

    // Auto-grow textarea
    function autoResize(el) {
        if (!el) return
        el.style.height = 'auto'
        el.style.height = el.scrollHeight + 'px'
    }

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
                    <button onClick={handleSubmit} disabled={submitting || !form.title.trim() || !form.content.trim()} style={{ background: submitting ? 'rgba(99,102,241,.4)' : 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', padding: '9px 22px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (!form.title.trim() || !form.content.trim()) ? 0.4 : 1 }}>
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
                    <div style={{ fontSize: 16, lineHeight: 1.85, color: '#CBD5E1', whiteSpace: 'pre-wrap' }}>{form.content}</div>
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

                    {/* Title */}
                    <textarea
                        value={form.title}
                        onChange={e => { setForm(f => ({ ...f, title: e.target.value })); autoResize(e.target) }}
                        placeholder="Your post title…"
                        rows={1}
                        maxLength={200}
                        style={{
                            width: '100%', background: 'transparent', border: 'none', outline: 'none',
                            fontSize: 30, fontWeight: 900, color: '#F8FAFC', lineHeight: 1.3,
                            resize: 'none', fontFamily: 'inherit', overflow: 'hidden',
                            padding: 0, marginBottom: 20, letterSpacing: '-0.02em',
                            boxSizing: 'border-box',
                        }}
                    />

                    {/* Divider */}
                    <div style={{ height: 1, background: 'rgba(255,255,255,.07)', marginBottom: 28 }} />

                    {/* Body */}
                    <textarea
                        ref={textareaRef}
                        value={form.content}
                        onChange={e => { setForm(f => ({ ...f, content: e.target.value })); autoResize(e.target) }}
                        placeholder="Start writing your post… Share a technique, a problem approach, an interview tip, or anything that helped you grow."
                        style={{
                            width: '100%', background: 'transparent', border: 'none', outline: 'none',
                            fontSize: 16, color: '#CBD5E1', lineHeight: 1.85,
                            resize: 'none', fontFamily: 'inherit', minHeight: 360,
                            padding: 0, boxSizing: 'border-box',
                        }}
                    />
                </form>
            )}
        </div>
    )
}

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
            <div className="app-shell" style={{ background: 'linear-gradient(140deg,#07091a,#0d1327 50%,#080c1a)' }}>
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
            <div className="app-shell" style={{ background: 'linear-gradient(140deg,#07091a,#0d1327 50%,#080c1a)' }}>
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
        <div className="app-shell" style={{ background: 'linear-gradient(140deg,#07091a,#0d1327 50%,#080c1a)' }}>
            <div style={{ position: 'fixed', top: -180, left: 60, width: 400, height: 400, background: 'radial-gradient(circle,rgba(99,102,241,.06),transparent 65%)', borderRadius: '50%', pointerEvents: 'none', zIndex: 0 }} />
            <Sidebar />
            <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
                <Topbar title="Community" subtitle="Insights and tips from fellow developers" />
                <main className="page-content">

                    {/* ── Header row ── */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,.03)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,.06)' }}>
                            {[['feed', '📰 Feed'], ['mine', '✍️ My Posts']].map(([k, l]) => (
                                <button key={k} onClick={() => setTab(k)} style={{ padding: '7px 18px', borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', border: 'none', transition: 'all .2s', background: tab === k ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'transparent', color: tab === k ? '#fff' : '#64748B', boxShadow: tab === k ? '0 3px 12px rgba(99,102,241,.35)' : 'none' }}>
                                    {l}
                                </button>
                            ))}
                        </div>
                        <button onClick={openWrite} style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                                <div style={{ width: 38, height: 38, border: '3px solid rgba(99,102,241,.2)', borderTop: '3px solid #6366F1', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                                <div style={{ color: '#64748B', fontSize: 13 }}>Loading community feed…</div>
                            </div>
                        )}

                        {!loading && posts.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '70px 32px', color: '#64748B' }}>
                                <div style={{ fontSize: 52, marginBottom: 16 }}>📝</div>
                                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#94A3B8' }}>No posts yet {topic !== 'all' ? `in "${topic}"` : ''}</div>
                                <div style={{ fontSize: 13 }}>Be the first to share something!</div>
                                <button onClick={openWrite} style={{ marginTop: 20, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 11, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Write a Post</button>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
                            {posts.map(p => (
                                <PostCard key={p.id} post={p} onLike={handleLike} onDelete={handleDelete} myEmail={myEmail} onOpen={openPostView} />
                            ))}
                        </div>

                        {hasNext && (
                            <div style={{ textAlign: 'center', marginTop: 28 }}>
                                <button onClick={() => loadFeed(page + 1)} disabled={loading} style={{ background: 'rgba(99,102,241,.12)', border: '1px solid rgba(99,102,241,.25)', color: '#818CF8', padding: '10px 32px', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
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
                                    <button onClick={openWrite} style={{ marginTop: 20, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 11, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Write your first post</button>
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
