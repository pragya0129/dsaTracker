/**
 * AlgoLedger Analytics Engine — v2
 *
 * DATA REALITY (what the backend actually provides):
 *
 *  /api/platforms/dashboard →
 *    totalSolved, easySolved, mediumSolved, hardSolved,
 *    currentStreak, longestStreak (⚠ backend sets this to totalActiveDays — unreliable),
 *    platforms[], topics[{ topic, count }], linkedPlatforms[]
 *
 *  /api/leetcode/submissions/:username →
 *    submissions[{ titleSlug, timestamp, statusDisplay }]
 *    ⚠ NO difficulty, NO solveTime, NO topic, NO language
 *
 *  /api/platforms/calendar →
 *    Map<unixTimestamp, submissionCount>
 *
 * Every function below only uses fields that actually exist.
 * Fake/fabricated metrics have been removed.
 */

/* ─── shared helpers ─── */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/*
 * Important interview topics — used to weight the "weak topic" detector.
 * Topics in this list that you have low counts for are flagged more urgently.
 */
const HIGH_PRIORITY_TOPICS = new Set([
  'array', 'string', 'dynamic programming', 'graph', 'binary search',
  'tree', 'hash table', 'stack', 'greedy', 'backtracking',
  'sliding window', 'two pointers', 'linked list', 'recursion',
  'heap (priority queue)', 'sorting', 'depth-first search', 'breadth-first search',
  'bit manipulation', 'math',
])

const isHighPriority = (topicName) =>
  HIGH_PRIORITY_TOPICS.has(topicName.toLowerCase()) ||
  [...HIGH_PRIORITY_TOPICS].some(p => topicName.toLowerCase().includes(p))

/* ════════════════════════════════════════
   1. TOPIC ANALYTICS
   Input: topics[] from dashboard API — { topic: string, count: number }
   count = number of ACCEPTED problems for that tag (from LeetCode tagProblemCounts)
   ⚠ We have NO per-topic failure/attempt data from the API.
════════════════════════════════════════ */

/**
 * Enriches raw topic data with derived fields.
 * Only uses fields that actually exist.
 */
export function computeTopicStats(rawTopics, totalSolved) {
  if (!rawTopics.length) return []
  const maxCount = Math.max(...rawTopics.map(t => t.count), 1)

  return rawTopics.map(t => ({
    topic: t.topic,
    count: t.count,
    // Relative depth: how deep you are in this topic vs your strongest topic (0-100)
    relativeDepth: Math.round((t.count / maxCount) * 100),
    // Share of total: what % of your overall solved problems belong to this tag
    shareOfTotal: totalSolved > 0 ? Math.round((t.count / totalSolved) * 100) : 0,
    // Whether this is a high-priority interview topic
    isHighPriority: isHighPriority(t.topic),
  })).sort((a, b) => b.count - a.count)
}

/**
 * Detects weak/underexplored topics.
 *
 * Logic is based ONLY on what we actually know — solved count per topic.
 * We cannot compute a "success rate" because the API doesn't expose per-topic
 * attempt data. We flag topics that are:
 *   1. Critically low count (< 3 accepted problems)
 *   2. Low count relative to your own average topic depth
 *   3. High-priority interview topics with insufficient coverage
 *   4. Haven't kept pace with your overall growth
 *
 * Returns topics sorted by urgency (weakScore desc), max 4.
 */
export function detectWeakTopics(topicStats, totalSolved) {
  if (!topicStats.length) return []

  const avgCount = topicStats.reduce((s, t) => s + t.count, 0) / topicStats.length
  const maxCount = Math.max(...topicStats.map(t => t.count), 1)

  return topicStats
    .map(t => {
      let weakScore = 0
      const reasons = []

      // Critical: almost no problems solved
      if (t.count < 3) {
        weakScore += 50
        reasons.push('Critically low — fewer than 3 problems solved')
      } else if (t.count < 6) {
        weakScore += 30
        reasons.push('Very shallow coverage')
      }

      // Below your own average topic depth
      if (t.count < avgCount * 0.45) {
        weakScore += 25
        reasons.push(`Well below your avg (${Math.round(avgCount)} per topic)`)
      } else if (t.count < avgCount * 0.65) {
        weakScore += 12
      }

      // High-priority interview topic with low count
      if (t.isHighPriority) {
        // 10+ problems is considered "decent coverage" for a core topic
        if (t.count < 5) {
          weakScore += 30
          reasons.push('Core interview topic — needs immediate attention')
        } else if (t.count < 10) {
          weakScore += 15
          reasons.push('Core interview topic — more depth needed')
        }
      }

      // Significantly behind your strongest topic (< 15% of max)
      if (t.count / maxCount < 0.15 && t.count < avgCount) {
        weakScore += 10
        reasons.push('Significantly behind your strongest area')
      }

      // Recommended practice target: how many more to reach "decent" coverage
      const target = Math.max(
        Math.ceil(avgCount),
        t.isHighPriority ? 10 : 6,
      )
      const needed = Math.max(0, target - t.count)

      return {
        ...t,
        weakScore,
        reasons,
        needed,
        target,
      }
    })
    .filter(t => t.weakScore > 20)
    .sort((a, b) => b.weakScore - a.weakScore)
    .slice(0, 4)
}

/* ════════════════════════════════════════
   2. SKILL RADAR
   Computes a 0-100 score per key topic using ONLY solved count.
   No fake "success rate" — just honest depth + relative breadth scoring.
════════════════════════════════════════ */
const RADAR_TOPICS = [
  'Array', 'Hash Table', 'Binary Search', 'Graph', 'Dynamic Programming',
  'Greedy', 'String', 'Tree', 'Stack', 'Sliding Window',
]

export function computeSkillRadar(topicStats, totalSolved) {
  const byTopic = {}
  topicStats.forEach(t => { byTopic[t.topic.toLowerCase()] = t })
  const maxCount = Math.max(...topicStats.map(t => t.count), 1)

  return RADAR_TOPICS.map(name => {
    const key = name.toLowerCase()
    // Exact match first, then fuzzy (first word of topic name)
    const stat =
      byTopic[key] ||
      topicStats.find(t => t.topic.toLowerCase().includes(key.split(' ')[0])) ||
      null

    if (!stat) return { topic: name, score: 0, count: 0 }

    // Depth score: how many problems solved in this topic (capped at 20 = full depth)
    // 20+ problems in a topic means you've gone deep enough to score max here.
    const depthScore = Math.min((stat.count / 20) * 60, 60)

    // Relative score: how strong this topic is compared to your best topic
    const relativeScore = (stat.count / maxCount) * 40

    return {
      topic: name,
      score: Math.round(depthScore + relativeScore),
      count: stat.count,
      isHighPriority: stat.isHighPriority,
    }
  })
}

/* ════════════════════════════════════════
   3. EFFICIENCY
   Uses real submission data: titleSlug + statusDisplay.
   Groups by problem to detect retries/first-try rate.
   ⚠ Submissions are limited to the last ~20 from LeetCode's public API.
      Treat as "recent efficiency" rather than "lifetime efficiency".
════════════════════════════════════════ */
export function computeEfficiency(submissions) {
  if (!submissions.length) {
    return { score: 0, firstAttemptRate: 0, avgRetries: 0, wrongRatio: 0, totalUnique: 0, sampleSize: 0 }
  }

  // Group by problem slug
  const problems = {}
  submissions.forEach(s => {
    const id = s.titleSlug || s.id
    if (!id) return
    if (!problems[id]) problems[id] = { attempts: 0, accepted: false }
    problems[id].attempts++
    if (s.statusDisplay === 'Accepted') problems[id].accepted = true
  })

  const pList = Object.values(problems)
  const acceptedProblems = pList.filter(p => p.accepted)
  const firstTry = acceptedProblems.filter(p => p.attempts === 1).length

  const firstAttemptRate = acceptedProblems.length
    ? Math.round((firstTry / acceptedProblems.length) * 100)
    : 0

  const avgRetries = acceptedProblems.length
    ? +(acceptedProblems.reduce((s, p) => s + p.attempts, 0) / acceptedProblems.length).toFixed(1)
    : 0

  const wrongs = submissions.filter(s => s.statusDisplay !== 'Accepted').length
  const wrongRatio = Math.round((wrongs / submissions.length) * 100)

  // Score: weighted composite of first-try rate and wrong submission ratio
  const score = clamp(
    Math.round(
      firstAttemptRate * 0.50 +
      (100 - wrongRatio) * 0.35 +
      Math.max(0, 100 - (avgRetries - 1) * 25) * 0.15,
    ),
    0, 100,
  )

  return {
    score,
    firstAttemptRate,
    avgRetries,
    wrongRatio,
    totalUnique: pList.length,
    sampleSize: submissions.length,
  }
}

/* ════════════════════════════════════════
   4. CONSISTENCY
   Uses the activity heatmap (unix-timestamp → count).
   Correctly computes current streak, longest streak, and inactivity gaps.
════════════════════════════════════════ */
export function computeConsistency(heatmapData) {
  if (!heatmapData.length) {
    return { score: 0, activeDays: 0, inactivityGap: 0, currentStreak: 0, longestStreak: 0 }
  }

  // Active days in the last 30
  const last30 = heatmapData.slice(-30)
  const activeDays = last30.filter(d => d.count > 0).length

  // Longest inactivity gap (consecutive zero days) across all heatmap
  let maxGap = 0, curGap = 0
  heatmapData.forEach(d => {
    if (d.count === 0) { curGap++; maxGap = Math.max(maxGap, curGap) }
    else curGap = 0
  })

  // Current streak: consecutive active days ending at today.
  // Iterate from today backward. Stop as soon as we hit a zero-day.
  let currentStreak = 0
  for (let i = heatmapData.length - 1; i >= 0; i--) {
    if (heatmapData[i].count > 0) currentStreak++
    else break
  }

  // Longest streak: scan forward, track max run of consecutive active days.
  let longestStreak = 0, run = 0
  heatmapData.forEach(d => {
    if (d.count > 0) { run++; longestStreak = Math.max(longestStreak, run) }
    else run = 0
  })

  // Score: weighted sum of activity rate, gap penalty, streak bonus
  const actScore = clamp((activeDays / 30) * 100, 0, 40)          // up to 40 pts
  const gapScore = clamp((1 - maxGap / 30) * 30, 0, 30)           // up to 30 pts
  const streakScore = clamp((currentStreak / 14) * 30, 0, 30)     // up to 30 pts (14-day = max)
  const score = Math.round(actScore + gapScore + streakScore)

  return { score, activeDays, inactivityGap: maxGap, currentStreak, longestStreak }
}

/* ════════════════════════════════════════
   5. WEEKLY / DAILY GROWTH
════════════════════════════════════════ */
export function computeWeeklyGrowth(heatmapData, weeks = 16) {
  const result = []
  const len = heatmapData.length
  for (let w = weeks - 1; w >= 0; w--) {
    const endIdx = len - w * 7                        // exclusive end
    const startIdx = Math.max(0, endIdx - 7)          // inclusive start
    const slice = heatmapData.slice(startIdx, endIdx)
    const solved = slice.reduce((a, d) => a + d.count, 0)
    const label = slice[0]
      ? slice[0].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `W${weeks - w}`
    result.push({ week: label, solved, active: slice.filter(d => d.count > 0).length })
  }
  return result
}

export function computeDailyTrend(heatmapData, days = 30) {
  return heatmapData.slice(-days).map(d => ({
    day: d.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count: d.count,
  }))
}

/* ════════════════════════════════════════
   6. DIFFICULTY PACE
   Replaces the broken "avg solve time" section.
   Since submissions don't carry difficulty or solve-time,
   we estimate pace from dashboard aggregate counts + heatmap active weeks.

   Returns problems per active week for each difficulty level,
   plus an overall "problems per day" rate.
════════════════════════════════════════ */
export function computeDifficultyPace(easySolved, mediumSolved, hardSolved, heatmapData) {
  const weekly = computeWeeklyGrowth(heatmapData, 12)
  const activeWeeks = Math.max(weekly.filter(w => w.solved > 0).length, 1)
  const totalSolved = easySolved + mediumSolved + hardSolved || 1

  // Problems per active week per difficulty
  const easyPerWeek = +(easySolved / activeWeeks).toFixed(1)
  const medPerWeek = +(mediumSolved / activeWeeks).toFixed(1)
  const hardPerWeek = +(hardSolved / activeWeeks).toFixed(1)

  // Overall daily rate (from recent 21 days of heatmap)
  const recent21 = heatmapData.slice(-21)
  const activeDaysRecent = recent21.filter(d => d.count > 0).length
  const totalRecent = recent21.reduce((a, d) => a + d.count, 0)
  const avgPerDay = activeDaysRecent > 0 ? +(totalRecent / 21).toFixed(2) : 0

  // Difficulty mix
  const hardPct = Math.round((hardSolved / totalSolved) * 100)
  const medPct = Math.round((mediumSolved / totalSolved) * 100)
  const easyPct = 100 - hardPct - medPct

  return {
    easyPerWeek,
    medPerWeek,
    hardPerWeek,
    avgPerDay,
    activeWeeks,
    hardPct,
    medPct,
    easyPct,
  }
}

/* ════════════════════════════════════════
   7. MOMENTUM (week-over-week delta)
   Computes how this week compares to last week and 4-week avg.
════════════════════════════════════════ */
export function computeMomentum(heatmapData) {
  const weekly = computeWeeklyGrowth(heatmapData, 8)
  const thisWeek = weekly[weekly.length - 1]?.solved || 0
  const lastWeek = weekly[weekly.length - 2]?.solved || 0
  const avg4w = weekly.length >= 4
    ? Math.round(weekly.slice(-4).reduce((a, w) => a + w.solved, 0) / 4)
    : 0

  const delta = thisWeek - lastWeek
  const vsAvg = thisWeek - avg4w
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

  return { thisWeek, lastWeek, delta, avg4w, vsAvg, trend }
}

/* ════════════════════════════════════════
   8. CONTEST READINESS
   Uses only real, available metrics.
   effiScore comes from recent submissions (valid but small sample).
   consistencyScore comes from heatmap (valid).
════════════════════════════════════════ */
export function computeContestReadiness({ totalSolved, mediumSolved, hardSolved, easySolved, effiScore, consistencyScore, topicStats }) {
  if (!totalSolved) return { score: 0, strengths: [], weaknesses: [], breakdown: {} }

  const mhRatio = (mediumSolved + hardSolved) / totalSolved        // 0-1
  const hardRatio = hardSolved / totalSolved                       // 0-1
  const topicBreadth = clamp(topicStats.length / 10, 0, 1)        // 10+ topics = max

  // Component scores (each contributes to the final 0-100)
  const mhScore = Math.round(mhRatio * 35)           // 35 pts: M+H ratio matters most for contests
  const hardScore = Math.round(hardRatio * 20)        // 20 pts: hard problem experience
  const effScore = Math.round(effiScore * 0.20)       // 20 pts: efficiency
  const conScore = Math.round(consistencyScore * 0.15) // 15 pts: consistency
  const topicScore = Math.round(topicBreadth * 10)    // 10 pts: topic coverage

  const score = clamp(mhScore + hardScore + effScore + conScore + topicScore, 0, 100)

  const strengths = []
  const weaknesses = []

  if (mhRatio > 0.55) strengths.push('Strong Medium + Hard problem ratio')
  else if (mhRatio < 0.30) weaknesses.push(`Easy-heavy mix (${Math.round(mhRatio * 100)}% M+H) — target ≥ 50%`)

  if (hardSolved >= 10) strengths.push(`${hardSolved} Hard problems solved`)
  else if (hardSolved < 5) weaknesses.push(`Limited Hard exposure (${hardSolved} solved) — try 1 per week`)

  if (effiScore >= 65) strengths.push('High first-attempt success rate')
  else if (effiScore < 45) weaknesses.push('High retry rate — review problem more before submitting')

  if (consistencyScore >= 65) strengths.push('Consistent daily practice')
  else if (consistencyScore < 35) weaknesses.push('Inconsistent practice — streaks matter in contests')

  if (topicStats.length >= 8) strengths.push(`Broad coverage — ${topicStats.length} topics practised`)
  else if (topicStats.length < 4) weaknesses.push(`Narrow topic range (${topicStats.length} topics) — diversify`)

  if (totalSolved >= 100) strengths.push('100+ total problems — solid base')

  const breakdown = { mhScore, hardScore, effScore, conScore, topicScore }

  return { score, strengths, weaknesses, breakdown }
}

/* ════════════════════════════════════════
   9. SMART RECOMMENDATIONS
   Uses detectWeakTopics results + difficulty mix.
   All recommendations are grounded in real data.
════════════════════════════════════════ */
export function computeRecommendations({ weakTopics, topicStats, totalSolved, mediumSolved, hardSolved, easySolved }) {
  const recs = []
  const total = totalSolved || 1
  const mhRatio = (mediumSolved + hardSolved) / total

  // ── High-priority: weak topics first ──
  weakTopics.slice(0, 2).forEach(t => {
    recs.push({
      priority: t.count < 3 ? 'high' : 'medium',
      topic: t.topic,
      reason: t.reasons[0] || `Only ${t.count} problems solved — needs more depth`,
      action: `Solve ${t.needed} more ${t.topic} problems to reach decent coverage`,
      icon: t.count < 3 ? '🔴' : '🟡',
    })
  })

  // ── Difficulty balance ──
  if (mhRatio < 0.30 && totalSolved >= 20) {
    recs.push({
      priority: 'high',
      topic: 'Medium Difficulty',
      reason: `Only ${Math.round(mhRatio * 100)}% of your problems are Medium or Hard`,
      action: 'Solve 3–5 Medium problems this week to shift the balance',
      icon: '🟡',
    })
  }
  if (hardSolved < 5 && totalSolved >= 40) {
    recs.push({
      priority: 'medium',
      topic: 'Hard Problems',
      reason: `Only ${hardSolved} Hard problems solved — contests require Hard exposure`,
      action: "Attempt 1 Hard problem per week, even if you don't solve it fully",
      icon: '🔴',
    })
  }

  // ── Important topics you haven't touched ──
  const practicedTopicNames = new Set(topicStats.map(t => t.topic.toLowerCase()))
  const missingImportant = [...HIGH_PRIORITY_TOPICS]
    .filter(t => !practicedTopicNames.has(t) && !practicedTopicNames.has(t.split(' ')[0]))
    .slice(0, 2)
  missingImportant.forEach(topic => {
    const display = topic.charAt(0).toUpperCase() + topic.slice(1)
    recs.push({
      priority: 'medium',
      topic: display,
      reason: 'No problems solved in this core interview category yet',
      action: `Start with 3–5 beginner ${display} problems`,
      icon: '🟡',
    })
  })

  // ── General fallback ──
  if (recs.length < 2) {
    recs.push({
      priority: 'low',
      topic: 'Contest Practice',
      reason: 'Your topic coverage looks solid — time to test it under pressure',
      action: 'Join a LeetCode Weekly Contest this weekend',
      icon: '🟢',
    })
  }

  return recs.slice(0, 5)
}

/* ════════════════════════════════════════
   10. PREDICTIVE PROGRESS
   Uses the heatmap to compute a daily solving rate and project forward.
════════════════════════════════════════ */
export function computePrediction({ heatmapData, totalSolved }) {
  // Use last 21 days for rate — more representative than lifetime average
  const recent = heatmapData.slice(-21)
  const recentTotal = recent.reduce((s, d) => s + d.count, 0)
  const avgPerDay = +(recentTotal / 21).toFixed(2)

  const in30 = Math.round(totalSolved + avgPerDay * 30)
  const in90 = Math.round(totalSolved + avgPerDay * 90)
  const in180 = Math.round(totalSolved + avgPerDay * 180)

  const milestones = [50, 100, 200, 300, 500, 1000].map(m => {
    if (totalSolved >= m) return { target: m, reached: true, daysLeft: 0, eta: null }
    const daysLeft = avgPerDay > 0 ? Math.ceil((m - totalSolved) / avgPerDay) : null
    const eta = daysLeft
      ? new Date(Date.now() + daysLeft * 86400000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : null
    return { target: m, reached: false, daysLeft, eta }
  })

  return { avgPerDay, in30, in90, in180, milestones }
}

/* ════════════════════════════════════════
   11. PERFORMANCE SCORE
   Composite score based on all available real signals.
════════════════════════════════════════ */
export function computePerformanceScore({ totalSolved, longestStreak, acceptanceRate, activeWeeks, hardSolved, effiScore }) {
  // Volume: 35 pts (100 problems = solid, 200+ = approaching max)
  const volumeScore = clamp(totalSolved / 6, 0, 35)
  // Streak: 20 pts (14+ day streak = max)
  const streakScore = clamp(longestStreak * 1.4, 0, 20)
  // Acceptance rate: 12 pts
  const arScore = clamp(acceptanceRate * 0.12, 0, 12)
  // Active weeks: 15 pts
  const awScore = clamp(activeWeeks * 1.0, 0, 15)
  // Hard problems: 10 pts (7+ = max)
  const hardScore = clamp(hardSolved * 1.4, 0, 10)
  // Efficiency: 8 pts
  const eScore = clamp(effiScore * 0.08, 0, 8)

  return Math.round(clamp(volumeScore + streakScore + arScore + awScore + hardScore + eScore, 0, 100))
}

export function scoreLabel(s) {
  if (s >= 85) return { label: 'Elite', color: '#A855F7' }
  if (s >= 70) return { label: 'Advanced', color: '#38BDF8' }
  if (s >= 50) return { label: 'Intermediate', color: '#22C55E' }
  if (s >= 30) return { label: 'Beginner', color: '#F59E0B' }
  return { label: 'Novice', color: '#64748B' }
}
