'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Filter } from 'lucide-react'
import { api } from '../../lib/api'
import type { AgentRun, TrustResponseRecord } from '../../lib/types'

const VERDICT_BADGE: Record<string, string> = {
  no_breach: 'badge-pass',
  imminent: 'badge-warn',
  breach: 'badge-danger',
  breach_curable: 'badge-warn',
  unknown: 'badge-grey',
}

const AUTONOMY_FILTERS = [
  { value: undefined, label: 'All runs' },
  { value: 1, label: 'Constrained (L1)' },
  { value: 2, label: 'Guided (L2)' },
  { value: 3, label: 'Autonomous (L3)' },
]

type SortDirection = 'asc' | 'desc'
type SortKey =
  | 'run_id'
  | 'scenario_id'
  | 'autonomy_level'
  | 'borrower_name'
  | 'verdict'
  | 'outcome_correct'
  | 'clause_coverage'
  | 'trajectory'
  | 'trust'
  | 'auditability'

type SortConfig = {
  key: SortKey
  direction: SortDirection
} | null

function autonomyLabel(level?: number | null) {
  if (level === 1) return 'Constrained (L1)'
  if (level === 2) return 'Guided (L2)'
  if (level === 3) return 'Autonomous (L3)'
  return 'Unknown'
}

function verdictLabel(value?: string | null) {
  return (value ?? 'unknown').toUpperCase().replace(/_/g, ' ')
}

function matchLabel(value?: boolean | null) {
  if (value === null || value === undefined) return '-'
  return value ? 'MATCH' : 'MISMATCH'
}

type RunReview = {
  trustScore: number | null
  auditabilityScore: number | null
  count: number
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildReviewMap(responses: TrustResponseRecord[]) {
  const buckets: Record<string, { trust: number[]; auditability: number[]; count: number }> = {}

  responses.forEach(response => {
    if (!buckets[response.run_id]) buckets[response.run_id] = { trust: [], auditability: [], count: 0 }
    buckets[response.run_id].count += 1
    if (typeof response.trust_score === 'number') buckets[response.run_id].trust.push(response.trust_score)
    if (typeof response.auditability_score === 'number') buckets[response.run_id].auditability.push(response.auditability_score)
  })

  return Object.fromEntries(
    Object.entries(buckets).map(([runId, bucket]) => [runId, {
      trustScore: average(bucket.trust),
      auditabilityScore: average(bucket.auditability),
      count: bucket.count,
    }])
  ) as Record<string, RunReview>
}

function ReviewScore({ value, count }: { value?: number | null; count?: number }) {
  if (value === null || value === undefined) {
    return <span className="review-score review-score-empty">No review</span>
  }

  return (
    <span className="review-score" title={count && count > 1 ? `Average of ${count} reviews` : 'Reviewer score'}>
      {value.toFixed(1)}/7
    </span>
  )
}

function getSortValue(run: AgentRun, review: RunReview | undefined, key: SortKey) {
  switch (key) {
    case 'run_id':
      return run.run_id
    case 'scenario_id':
      return run.scenario_id
    case 'autonomy_level':
      return run.autonomy_level ?? null
    case 'borrower_name':
      return run.borrower_name ?? ''
    case 'verdict':
      return run.final_verdict ?? 'unknown'
    case 'outcome_correct':
      return run.outcome_correct === true ? 1 : run.outcome_correct === false ? 0 : null
    case 'clause_coverage':
      return run.clause_coverage_score ?? null
    case 'trajectory':
      return run.trajectory_score ?? null
    case 'trust':
      return review?.trustScore ?? null
    case 'auditability':
      return review?.auditabilityScore ?? null
    default:
      return ''
  }
}

function compareSortValues(a: string | number | null, b: string | number | null) {
  const aEmpty = a === null || a === ''
  const bEmpty = b === null || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  sort: SortConfig
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = sort?.key === sortKey
  const direction = active ? sort?.direction : undefined
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <th className={className} aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}>
      <button
        type="button"
        className={`sortable-header ${active ? 'sortable-header-active' : ''}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </th>
  )
}

function ScoreBar({ value, color = 'var(--accent-strong)' }: { value: number; color?: string }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 5, background: 'var(--bar-track)', borderRadius: 999 }}>
        <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [reviewByRun, setReviewByRun] = useState<Record<string, RunReview>>({})
  const [filter, setFilter] = useState<number | undefined>()
  const [sort, setSort] = useState<SortConfig>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = (level?: number) => {
    setLoading(true)
    setError(null)
    Promise.allSettled([
      api.getRuns(1, level, 100),
      api.getTrustResponses(),
    ]).then(([runsResult, trustResult]) => {
      if (runsResult.status === 'rejected') throw runsResult.reason

      setRuns(runsResult.value.runs)
      setReviewByRun(
        trustResult.status === 'fulfilled'
          ? buildReviewMap(trustResult.value.responses ?? [])
          : {}
      )
      setLoading(false)
    }).catch(err => {
      console.error('Failed to load runs', err)
      setError((err as Error)?.message ?? 'Unable to load runs from backend')
      setRuns([])
      setReviewByRun({})
      setLoading(false)
    })
  }

  useEffect(() => { load(filter) }, [filter])

  const sortedRuns = useMemo(() => {
    if (!sort) return runs

    return runs
      .map((run, index) => ({ run, index }))
      .sort((a, b) => {
        const aValue = getSortValue(a.run, reviewByRun[a.run.run_id], sort.key)
        const bValue = getSortValue(b.run, reviewByRun[b.run.run_id], sort.key)
        const result = compareSortValues(aValue, bValue)
        if (result === 0) return a.index - b.index
        return sort.direction === 'asc' ? result : -result
      })
      .map(item => item.run)
  }, [runs, reviewByRun, sort])

  const toggleSort = (key: SortKey) => {
    setSort(current => {
      if (current?.key !== key) return { key, direction: 'asc' }
      if (current.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Agent run history: outputs and evaluations side by side</h1>
            <div className="page-subtitle">
              Inspect each covenant run in the order it was produced, with agent verdicts separated from post-run comparison to scenario ground truth.
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {error && (
          <div className="status-callout" style={{ marginBottom: 16, borderLeftColor: 'var(--danger)' }}>
            <strong style={{ color: 'var(--danger)' }}>Backend error</strong>
            <span>{error}</span>
          </div>
        )}

        <div className="card table-card">
          <div className="runs-table-toolbar">
            <div>
              <div className="runs-filter-label">
                <Filter size={14} strokeWidth={2.1} aria-hidden="true" />
                <span>Filter by autonomy level</span>
              </div>
              <div className="filter-row" aria-label="Autonomy filter">
                {AUTONOMY_FILTERS.map(option => (
                  <button
                    key={String(option.value)}
                    onClick={() => setFilter(option.value)}
                    className={`button ${filter === option.value ? 'button-primary' : 'button-secondary'}`}
                    style={{ minHeight: 34, fontSize: 12 }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="runs-table-meta">
              {sort ? `Sorted by ${sort.key.replace(/_/g, ' ')} (${sort.direction})` : 'Newest first'}
              {runs.length > 0 ? ` - ${sortedRuns.length} loaded` : ''}
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
              LOADING...
            </div>
          ) : runs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No runs yet. Go to the Overview page to launch a controlled agent run.
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr className="table-group-row">
                    <th colSpan={4}>Run details</th>
                    <th colSpan={4}>Run result</th>
                    <th colSpan={2}>User review</th>
                    <th aria-label="Actions"></th>
                  </tr>
                  <tr>
                    <SortableHeader label="ID" sortKey="run_id" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Scenario" sortKey="scenario_id" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Autonomy Level" sortKey="autonomy_level" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Borrower" sortKey="borrower_name" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Verdict" sortKey="verdict" sort={sort} onSort={toggleSort} className="table-section-start" />
                    <SortableHeader label="Ground Truth Match" sortKey="outcome_correct" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Clause Coverage" sortKey="clause_coverage" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Trajectory" sortKey="trajectory" sort={sort} onSort={toggleSort} />
                    <SortableHeader label="Trust" sortKey="trust" sort={sort} onSort={toggleSort} className="table-section-start" />
                    <SortableHeader label="Auditability" sortKey="auditability" sort={sort} onSort={toggleSort} />
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRuns.map(run => {
                    const review = reviewByRun[run.run_id]
                    return (
                      <tr
                        key={run.run_id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => window.location.href = `/runs/${run.run_id}`}
                      >
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                          {run.run_id.slice(0, 8)}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{run.scenario_id}</td>
                        <td>
                          <span className={`badge ${run.autonomy_level === 1 ? 'badge-pass' : run.autonomy_level === 2 ? 'badge-warn' : 'badge-danger'}`}>
                            {autonomyLabel(run.autonomy_level)}
                          </span>
                        </td>
                        <td className="truncate-cell" style={{ fontSize: 12 }}>
                          {run.borrower_name}
                        </td>
                        <td className="table-section-start">
                          <span className={`badge ${VERDICT_BADGE[run.final_verdict ?? 'unknown'] ?? 'badge-grey'}`}>
                            {verdictLabel(run.final_verdict)}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center' }}>
                          {run.outcome_correct === null || run.outcome_correct === undefined ? (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          ) : run.outcome_correct ? (
                            <span style={{ color: 'var(--pass)' }}>{matchLabel(run.outcome_correct)}</span>
                          ) : (
                            <span style={{ color: 'var(--danger)' }}>{matchLabel(run.outcome_correct)}</span>
                          )}
                        </td>
                        <td>
                          <ScoreBar
                            value={run.clause_coverage_score ?? 0}
                            color={(run.clause_coverage_score ?? 0) >= 1 ? 'var(--pass)' : 'var(--danger)'}
                          />
                        </td>
                        <td>
                          <ScoreBar value={run.trajectory_score ?? 0} color="var(--accent-strong)" />
                        </td>
                        <td className="table-section-start">
                          <ReviewScore value={review?.trustScore} count={review?.count} />
                        </td>
                        <td>
                          <ReviewScore value={review?.auditabilityScore} count={review?.count} />
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <a
                            href={`/runs/${run.run_id}`}
                            style={{ fontSize: 11, color: 'var(--accent-strong)', textDecoration: 'none', fontFamily: 'var(--mono)' }}
                          >
                            VIEW
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
