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

function ScoreBar({ value, color = '#3B82F6' }: { value: number; color?: string }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 5, background: 'rgba(101,113,135,0.25)', borderRadius: 999 }}>
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
        <div className="page-header-inner runs-header-row">
          <div>
            <h1 className="page-title">Agent Runs</h1>
            <div className="page-subtitle">
              Complete history of covenant breach agent runs, newest first.
            </div>
          </div>
          <div className="filter-row" aria-label="Autonomy filter">
            {[undefined, 1, 2, 3].map(lvl => (
              <button
                key={String(lvl)}
                onClick={() => setFilter(lvl)}
                className={`button ${filter === lvl ? 'button-primary' : 'button-secondary'}`}
                style={{ minHeight: 34, fontFamily: 'var(--mono)', fontSize: 11 }}
              >
                {lvl === undefined ? 'ALL' : `L${lvl}`}
              </button>
            ))}
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
              No runs yet. Go to the Dashboard to launch an agent run.
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Scenario</th>
                    <th>Borrower</th>
                    <th>Autonomy</th>
                    <th>Verdict</th>
                    <th>Outcome</th>
                    <th>Clause Coverage</th>
                    <th>Trajectory</th>
                    <th>Duration</th>
                    <th>Process</th>
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
                          L{run.autonomy_level}
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
                          <span style={{ color: 'var(--pass)' }}>YES</span>
                        ) : (
                          <span style={{ color: 'var(--danger)' }}>NO</span>
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
