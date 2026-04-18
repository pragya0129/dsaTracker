import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

const ALL_PROBLEMS = [
    { id: 1, platform: 'lc', name: 'Two Sum', difficulty: 'Easy', topic: 'Arrays', date: '2026-02-22' },
    { id: 2, platform: 'lc', name: 'Longest Substring Without Repeating', difficulty: 'Medium', topic: 'Strings', date: '2026-02-22' },
    { id: 3, platform: 'cf', name: 'Codeforces Round #850 Div.2 A', difficulty: 'Easy', topic: 'Greedy', date: '2026-02-21' },
    { id: 4, platform: 'lc', name: 'LRU Cache', difficulty: 'Medium', topic: 'Design', date: '2026-02-21' },
    { id: 5, platform: 'gfg', name: 'Detect Cycle in Directed Graph', difficulty: 'Medium', topic: 'Graphs', date: '2026-02-20' },
    { id: 6, platform: 'lc', name: 'Word Break II', difficulty: 'Hard', topic: 'Dynamic Programming', date: '2026-02-20' },
    { id: 7, platform: 'cf', name: 'Vasya and String', difficulty: 'Medium', topic: 'Strings', date: '2026-02-19' },
    { id: 8, platform: 'lc', name: 'Binary Tree Maximum Path Sum', difficulty: 'Hard', topic: 'Trees', date: '2026-02-19' },
    { id: 9, platform: 'gfg', name: 'N-Queen Problem', difficulty: 'Hard', topic: 'Backtracking', date: '2026-02-18' },
    { id: 10, platform: 'lc', name: 'Meeting Rooms II', difficulty: 'Medium', topic: 'Arrays', date: '2026-02-18' },
    { id: 11, platform: 'lc', name: 'Climbing Stairs', difficulty: 'Easy', topic: 'Dynamic Programming', date: '2026-02-17' },
    { id: 12, platform: 'cf', name: 'Boring Partition', difficulty: 'Hard', topic: 'Data Structures', date: '2026-02-17' },
    { id: 13, platform: 'gfg', name: 'Merge K Sorted Lists', difficulty: 'Hard', topic: 'LinkedList', date: '2026-02-16' },
    { id: 14, platform: 'lc', name: 'Course Schedule', difficulty: 'Medium', topic: 'Graphs', date: '2026-02-16' },
    { id: 15, platform: 'lc', name: 'Valid Parentheses', difficulty: 'Easy', topic: 'Strings', date: '2026-02-15' },
]

const PAGE_SIZE = 8

const PlatformChip = ({ p }) => {
    const map = { lc: ['platform-lc', 'LC'], cf: ['platform-cf', 'CF'], gfg: ['platform-gfg', 'GFG'] }
    const [cls, label] = map[p]
    return <span className={`platform-chip ${cls}`}>{label}</span>
}

const DiffBadge = ({ d }) => {
    const map = { Easy: 'badge-easy', Medium: 'badge-medium', Hard: 'badge-hard' }
    return <span className={`badge ${map[d]}`}>{d}</span>
}

export default function ProblemsPage() {
    const [search, setSearch] = useState('')
    const [platFilter, setPlat] = useState('all')
    const [diffFilter, setDiff] = useState('all')
    const [topicFilter, setTopic] = useState('all')
    const [page, setPage] = useState(1)

    const topics = [...new Set(ALL_PROBLEMS.map(p => p.topic))].sort()

    const filtered = ALL_PROBLEMS.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.topic.toLowerCase().includes(search.toLowerCase())
        const matchPlat = platFilter === 'all' || p.platform === platFilter
        const matchDiff = diffFilter === 'all' || p.difficulty === diffFilter
        const matchTopic = topicFilter === 'all' || p.topic === topicFilter
        return matchSearch && matchPlat && matchDiff && matchTopic
    })

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
    const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    const handleFilterChange = setter => e => { setter(e.target.value); setPage(1) }

    return (
        <div className="app-shell">
            <Sidebar />
            <div className="main-content">
                <Topbar title="Problems" subtitle={`${ALL_PROBLEMS.length} problems solved`} />
                <main className="page-content">

                    {/* Filter Bar */}
                    <div className="filter-bar">
                        {/* Search */}
                        <div className="input-with-icon" style={{ flex: 1, minWidth: 220 }}>
                            <span className="input-icon" style={{ fontSize: 15 }}>🔍</span>
                            <input
                                id="problem-search"
                                type="text"
                                className="input-field"
                                placeholder="Search problems or topics…"
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1) }}
                            />
                        </div>

                        <select id="filter-platform" className="filter-select" value={platFilter} onChange={handleFilterChange(setPlat)}>
                            <option value="all">All Platforms</option>
                            <option value="lc">LeetCode</option>
                            <option value="cf">Codeforces</option>
                            <option value="gfg">GeeksforGeeks</option>
                        </select>

                        <select id="filter-difficulty" className="filter-select" value={diffFilter} onChange={handleFilterChange(setDiff)}>
                            <option value="all">All Difficulties</option>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                        </select>

                        <select id="filter-topic" className="filter-select" value={topicFilter} onChange={handleFilterChange(setTopic)}>
                            <option value="all">All Topics</option>
                            {topics.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Table */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {paginated.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-icon">📭</div>
                                <div className="empty-title">No problems found</div>
                                <div className="empty-desc">
                                    Try adjusting your filters or search query.
                                </div>
                                <button className="btn btn-secondary" onClick={() => {
                                    setSearch(''); setPlat('all'); setDiff('all'); setTopic('all'); setPage(1)
                                }}>Clear Filters</button>
                            </div>
                        ) : (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Platform</th>
                                        <th>Problem Name</th>
                                        <th>Difficulty</th>
                                        <th>Topic</th>
                                        <th>Date Solved</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map(p => (
                                        <tr key={p.id}>
                                            <td><PlatformChip p={p.platform} /></td>
                                            <td>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {p.name}
                                                </span>
                                            </td>
                                            <td><DiffBadge d={p.difficulty} /></td>
                                            <td>
                                                <span className="badge badge-accent">{p.topic}</span>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{p.date}</td>
                                            <td>
                                                <button className="btn btn-ghost btn-sm">↗</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="page-btn"
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >‹</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    className={`page-btn ${page === p ? 'active' : ''}`}
                                    onClick={() => setPage(p)}
                                >{p}</button>
                            ))}
                            <button
                                className="page-btn"
                                disabled={page === totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >›</button>
                        </div>
                    )}

                    {/* Summary */}
                    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                        Showing {paginated.length} of {filtered.length} results
                    </p>

                </main>
            </div>
        </div>
    )
}
