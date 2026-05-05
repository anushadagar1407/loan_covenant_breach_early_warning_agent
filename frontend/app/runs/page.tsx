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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
      <div style={{ flex: 1, height: 4, background: '#1F2937', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

export default function RunsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [filter, setFilter] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)

  const load = (level?: number) => {
    setLoading(true)
    api.getRuns(1, level).then(r => {
      setRuns(r.runs)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load(filter) }, [filter])

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>Agent Runs</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Complete history of all covenant breach agent runs
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[undefined, 1, 2, 3].map(lvl => (
            <button key={String(lvl)} onClick={() => setFilter(lvl)} style={{
              padding: '7px 14px',
              background: filter === lvl ? '#003882' : 'transparent',
              border: `1px solid ${filter === lvl ? '#0066CC' : '#1F2937'}`,
              color: filter === lvl ? 'white' : '#9CA3AF',
              borderRadius: 4, cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 11,
            }}>
              {lvl === undefined ? 'ALL' : `L${lvl}`}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#4B5563', fontFamily: 'var(--mono)', fontSize: 12 }}>
              LOADING...
            </div>
          ) : runs.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#4B5563', fontSize: 13 }}>
              No runs yet. Go to the Dashboard to launch an agent run.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Scenario</th>
                  <th>Borrower</th>
                  <th>Auto. Level</th>
                  <th>Verdict</th>
                  <th>Outcome ✓</th>
                  <th>Clause Coverage</th>
                  <th>Trajectory</th>
                  <th>Duration</th>
                  <th>Process Error</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.run_id} style={{ cursor: 'pointer' }}
                    onClick={() => window.location.href = `/runs/${run.run_id}`}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#6B7280' }}>
                      {run.run_id.slice(0, 8)}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{run.scenario_id}</td>
                    <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {run.borrower_name}
                    </td>
                    <td>
                      <span className={`badge ${run.autonomy_level === 1 ? 'badge-pass' : run.autonomy_level === 2 ? 'badge-warn' : 'badge-danger'}`}>
                        L{run.autonomy_level} {['CONSTRAINED', 'MODERATE', 'AUTONOMOUS'][run.autonomy_level - 1]}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${VERDICT_BADGE[run.final_verdict] ?? 'badge-grey'}`}>
                        {run.final_verdict?.toUpperCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 14, textAlign: 'center' }}>
                      {run.outcome_correct === null ? <span style={{ color: '#4B5563' }}>—</span>
                        : run.outcome_correct
                        ? <span style={{ color: '#10B981' }}>✓</span>
                        : <span style={{ color: '#EF4444' }}>✗</span>}
                    </td>
                    <td>
                      <ScoreBar value={run.clause_coverage_score ?? 0}
                        color={(run.clause_coverage_score ?? 0) >= 1 ? '#10B981' : '#EF4444'} />
                    </td>
                    <td>
                      <ScoreBar value={run.trajectory_score ?? 0} color="#3B82F6" />
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#9CA3AF' }}>
                      {run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : '—'}
                    </td>
                    <td>
                      {run.process_error_detected ? (
                        <span className="badge badge-danger">⚠ ERROR</span>
                      ) : (
                        <span className="badge badge-pass">CLEAN</span>
                      )}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <a href={`/runs/${run.run_id}`} style={{
                        fontSize: 11, color: '#3B82F6', textDecoration: 'none', fontFamily: 'var(--mono)'
                      }}>
                        VIEW →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
