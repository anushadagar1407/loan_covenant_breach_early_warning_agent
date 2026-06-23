'use client'

import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { AgentRun } from '../../lib/types'

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

function autonomyLabel(level?: number | null) {
  if (level === 1) return 'Constrained (L1)'
  if (level === 2) return 'Guided (L2)'
  if (level === 3) return 'Autonomous (L3)'
  return 'Unknown'
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
  const [filter, setFilter] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = (level?: number) => {
    setLoading(true)
    setError(null)
    api.getRuns(1, level).then(r => {
      setRuns(r.runs)
      setLoading(false)
    }).catch(err => {
      console.error('Failed to load runs', err)
      setError((err as Error)?.message ?? 'Unable to load runs from backend')
      setRuns([])
      setLoading(false)
    })
  }

  useEffect(() => { load(filter) }, [filter])

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <h1 className="page-title">Agent run history: outputs and evaluations side by side</h1>
            <div className="page-subtitle">
              Inspect each covenant run in the order it was produced, with agent verdicts separated from post-run comparison to scenario ground truth.
            </div>
            <div className="autonomy-filter">
              <span className="autonomy-filter-label">Filter by autonomy level</span>
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
                    <th colSpan={4}>Run context</th>
                    <th colSpan={1}>Agent output</th>
                    <th colSpan={5}>Post-run evaluation</th>
                    <th aria-label="Actions"></th>
                  </tr>
                  <tr>
                    <th>Run</th>
                    <th>Scenario</th>
                    <th>Borrower</th>
                    <th>Autonomy Level</th>
                    <th>Agent Verdict</th>
                    <th>Ground Truth Match</th>
                    <th>Clause Coverage</th>
                    <th>Trajectory</th>
                    <th>Duration</th>
                    <th>Process Review</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => (
                    <tr
                      key={run.run_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.location.href = `/runs/${run.run_id}`}
                    >
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                        {run.run_id.slice(0, 8)}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{run.scenario_id}</td>
                      <td className="truncate-cell" style={{ fontSize: 12 }}>
                        {run.borrower_name}
                      </td>
                      <td>
                        <span className={`badge ${run.autonomy_level === 1 ? 'badge-pass' : run.autonomy_level === 2 ? 'badge-warn' : 'badge-danger'}`}>
                          {autonomyLabel(run.autonomy_level)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${VERDICT_BADGE[run.final_verdict ?? 'unknown'] ?? 'badge-grey'}`}>
                          {(run.final_verdict ?? 'unknown').toUpperCase().replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center' }}>
                        {run.outcome_correct === null || run.outcome_correct === undefined ? (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        ) : run.outcome_correct ? (
                          <span style={{ color: 'var(--pass)' }}>MATCH</span>
                        ) : (
                          <span style={{ color: 'var(--danger)' }}>MISMATCH</span>
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
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : '-'}
                      </td>
                      <td>
                        {run.process_error_detected ? (
                          <span className="badge badge-danger">ERROR</span>
                        ) : (
                          <span className="badge badge-pass">CLEAN</span>
                        )}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
