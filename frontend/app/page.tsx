'use client'

import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { RegistrySummary, AgentRun, Scenario } from '../lib/types'

const VERDICT_BADGE: Record<string, string> = {
  no_breach: 'badge-pass',
  imminent: 'badge-warn',
  breach: 'badge-danger',
  breach_curable: 'badge-warn',
  unknown: 'badge-grey',
}

const VERDICT_LABEL: Record<string, string> = {
  no_breach: 'NO BREACH',
  imminent: 'IMMINENT',
  breach: 'BREACH',
  breach_curable: 'BREACH (CURABLE)',
  unknown: 'UNKNOWN',
}

function ScoreBar({ value, color = '#3B82F6' }: { value: number; color?: string }) {
  const pct = Math.round((value ?? 0) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: '#1F2937', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <span className="metric-number" style={{ fontSize: 12, color, minWidth: 36, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

function MetricCard({ label, value, sub, color = '#F9FAFB', size = 'lg', hypothesis }: {
  label: string; value: string; sub?: string; color?: string; size?: 'lg' | 'sm'; hypothesis?: string
}) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="section-label">{label}</div>
      <div className="metric-number" style={{ fontSize: size === 'lg' ? 36 : 24, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6B7280' }}>{sub}</div>}
      {hypothesis && (
        <div style={{ marginTop: 4, fontFamily: 'var(--mono)', fontSize: 10, color: '#0066CC', letterSpacing: '0.06em' }}>
          {hypothesis}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState<RegistrySummary | null>(null)
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [showRunModal, setShowRunModal] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState('')
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [launching, setLaunching] = useState(false)
  const [launchMsg, setLaunchMsg] = useState('')
  const [health, setHealth] = useState<any>(null)

  useEffect(() => {
    api.getRegistrySummary().then(setSummary).catch(() => {})
    api.getRuns().then(r => setRuns(r.runs.slice(0, 5))).catch(() => {})
    api.getScenarios().then(r => setScenarios(r.scenarios)).catch(() => {})
    api.health().then(setHealth).catch(() => {})
  }, [])

  const handleLaunch = async () => {
    if (!selectedScenario) return
    setLaunching(true)
    setLaunchMsg('')
    try {
      const result = await api.startRun(selectedScenario, selectedLevel)
      setLaunchMsg(`Run started: ${result.run_id.slice(0, 8)}...`)
      setTimeout(() => {
        setShowRunModal(false)
        setLaunchMsg('')
        window.location.href = `/runs`
      }, 1500)
    } catch {
      setLaunchMsg('Failed to start run. Is the backend running?')
    } finally {
      setLaunching(false)
    }
  }

  const gapScore = summary?.gap_score ?? 0
  const outcomeRate = summary?.outcome_error_rate ?? 0
  const processRate = summary?.process_error_rate ?? 0

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>Dashboard</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Covenant Intelligence Platform · Agentic Evaluation Framework
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {health && (
            <div style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: 'var(--mono)' }}>
              <span style={{ color: health.ollama_connected ? '#10B981' : '#EF4444' }}>
                ● OLLAMA
              </span>
              <span style={{ color: health.db_connected ? '#10B981' : '#EF4444' }}>
                ● DB
              </span>
            </div>
          )}
          <button onClick={() => setShowRunModal(true)} style={{
            background: '#003882', color: 'white', border: 'none',
            padding: '9px 18px', borderRadius: 4, cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.06em',
            fontWeight: 500,
          }}>
            ▷ RUN AGENT
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* Top metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <MetricCard
            label="Total Runs"
            value={String(summary?.total_runs ?? 0)}
            sub="all time"
            color="#F9FAFB"
          />
          <MetricCard
            label="Process Error Rate"
            value={`${Math.round((processRate) * 100)}%`}
            sub={`${summary?.process_errors ?? 0} runs with skipped steps`}
            color={processRate > outcomeRate ? '#EF4444' : '#10B981'}
            hypothesis="→ H1 / H2"
          />
          <MetricCard
            label="Gap Score"
            value={`+${Math.round(gapScore * 100)}%`}
            sub="Process rate − Outcome rate"
            color={gapScore > 0 ? '#F59E0B' : '#10B981'}
            hypothesis="→ H1 KEY METRIC"
          />
          <MetricCard
            label="Avg Clause Coverage"
            value={`${Math.round((summary?.avg_clause_coverage_score ?? 0) * 100)}%`}
            sub={`${summary?.fully_compliant_runs ?? 0} fully compliant runs`}
            color="#3B82F6"
            hypothesis="→ H4"
          />
        </div>

        {/* H1 Visualization: Process vs Outcome error rates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
          <div className="card">
            <div className="section-label" style={{ marginBottom: 16 }}>H1 Evidence — Process vs Outcome Error Rate</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: '#9CA3AF' }}>Outcome Error Rate <span style={{ color: '#6B7280', fontSize: 10 }}>(what banks see)</span></span>
                  <span className="metric-number" style={{ color: '#10B981' }}>{Math.round(outcomeRate * 100)}%</span>
                </div>
                <ScoreBar value={outcomeRate} color="#10B981" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: '#9CA3AF' }}>Process Error Rate <span style={{ color: '#6B7280', fontSize: 10 }}>(what's actually happening)</span></span>
                  <span className="metric-number" style={{ color: '#EF4444' }}>{Math.round(processRate * 100)}%</span>
                </div>
                <ScoreBar value={processRate} color="#EF4444" />
              </div>
              <div style={{
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                borderRadius: 4,
                padding: '10px 14px',
                fontSize: 12,
                color: '#F59E0B',
                fontFamily: 'var(--mono)',
              }}>
                GAP: +{Math.round(gapScore * 100)}% — H1 supported when gap &gt; 0
              </div>
            </div>
          </div>

          {/* H2: Autonomy level breakdown */}
          <div className="card">
            <div className="section-label" style={{ marginBottom: 16 }}>H2 Evidence — Process Errors by Autonomy Level</div>
            {[1, 2, 3].map(level => {
              const d = summary?.runs_by_autonomy_level?.[String(level)]
              if (!d?.count) return (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, opacity: 0.4 }}>
                  <div className="metric-number" style={{ fontSize: 11, color: '#4B5563', minWidth: 60 }}>L{level}</div>
                  <div style={{ fontSize: 12, color: '#4B5563' }}>No runs yet</div>
                </div>
              )
              const labels = { 1: 'Constrained', 2: 'Moderate', 3: 'High Autonomy' }
              return (
                <div key={level} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: '#9CA3AF' }}>
                      <span className="metric-number" style={{ fontSize: 10, color: '#3B82F6' }}>L{level} </span>
                      {labels[level as 1|2|3]}
                      <span style={{ color: '#4B5563', marginLeft: 6 }}>({d.count} runs)</span>
                    </span>
                    <span className="metric-number" style={{ color: d.process_error_rate > 0.1 ? '#EF4444' : '#10B981', fontSize: 12 }}>
                      {Math.round((d.avg_clause_coverage ?? 0) * 100)}% cov.
                    </span>
                  </div>
                  <ScoreBar value={d.avg_clause_coverage ?? 0} color={level === 1 ? '#10B981' : level === 2 ? '#F59E0B' : '#EF4444'} />
                </div>
              )
            })}
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 8 }}>
              H2 supported when coverage decreases L1 → L2 → L3
            </div>
          </div>
        </div>

        {/* Recent runs */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="section-label" style={{ margin: 0 }}>Recent Runs</div>
            <a href="/runs" style={{ fontSize: 12, color: '#3B82F6', textDecoration: 'none' }}>View all →</a>
          </div>
          {runs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#4B5563', fontSize: 13 }}>
              No runs yet. Click "RUN AGENT" to start your first agent run.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Run ID</th>
                  <th>Scenario</th>
                  <th>Borrower</th>
                  <th>Level</th>
                  <th>Verdict</th>
                  <th>Outcome</th>
                  <th>Clause Cov.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.run_id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#6B7280' }}>
                      {run.run_id.slice(0, 8)}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{run.scenario_id}</td>
                    <td style={{ fontSize: 12 }}>{run.borrower_name}</td>
                    <td>
                      <span className={`badge ${run.autonomy_level === 1 ? 'badge-pass' : run.autonomy_level === 2 ? 'badge-warn' : 'badge-danger'}`}>
                        L{run.autonomy_level}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${VERDICT_BADGE[run.final_verdict] ?? 'badge-grey'}`}>
                        {VERDICT_LABEL[run.final_verdict] ?? run.final_verdict}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                      {run.outcome_correct === null ? '—' : run.outcome_correct ? (
                        <span style={{ color: '#10B981' }}>✓</span>
                      ) : (
                        <span style={{ color: '#EF4444' }}>✗</span>
                      )}
                    </td>
                    <td>
                      <ScoreBar
                        value={run.clause_coverage_score ?? 0}
                        color={(run.clause_coverage_score ?? 0) >= 1 ? '#10B981' : '#EF4444'}
                      />
                    </td>
                    <td>
                      <a href={`/runs/${run.run_id}`} style={{ fontSize: 11, color: '#3B82F6', textDecoration: 'none', fontFamily: 'var(--mono)' }}>
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

      {/* Run Agent Modal */}
      {showRunModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={e => e.target === e.currentTarget && setShowRunModal(false)}>
          <div style={{
            background: '#111827', border: '1px solid #1F2937',
            borderRadius: 8, padding: 28, width: 460,
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#3B82F6', marginBottom: 16, letterSpacing: '0.08em' }}>
              ▷ LAUNCH AGENT RUN
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Scenario</label>
              <select
                value={selectedScenario}
                onChange={e => setSelectedScenario(e.target.value)}
                style={{
                  width: '100%', background: '#0A0E1A', border: '1px solid #1F2937',
                  color: '#F9FAFB', padding: '9px 12px', borderRadius: 4,
                  fontFamily: 'var(--mono)', fontSize: 12,
                }}
              >
                <option value="">Select scenario...</option>
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id}>
                    {s.scenario_id} — {s.borrower_id} ({s.correct_verdict})
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Autonomy Level</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map(lvl => (
                  <button key={lvl} onClick={() => setSelectedLevel(lvl)} style={{
                    flex: 1, padding: '10px 0',
                    background: selectedLevel === lvl ? '#003882' : '#0A0E1A',
                    border: `1px solid ${selectedLevel === lvl ? '#0066CC' : '#1F2937'}`,
                    color: selectedLevel === lvl ? 'white' : '#9CA3AF',
                    borderRadius: 4, cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 11,
                  }}>
                    L{lvl}<br />
                    <span style={{ fontSize: 9, opacity: 0.7 }}>
                      {['CONSTRAINED', 'MODERATE', 'AUTONOMOUS'][lvl - 1]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {launchMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: 4, marginBottom: 12,
                background: launchMsg.includes('Failed') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                color: launchMsg.includes('Failed') ? '#EF4444' : '#10B981',
                fontSize: 12, fontFamily: 'var(--mono)',
              }}>
                {launchMsg}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowRunModal(false)} style={{
                flex: 1, padding: '10px', background: 'transparent',
                border: '1px solid #1F2937', color: '#9CA3AF', borderRadius: 4,
                cursor: 'pointer', fontSize: 13,
              }}>
                Cancel
              </button>
              <button onClick={handleLaunch} disabled={!selectedScenario || launching} style={{
                flex: 2, padding: '10px', background: '#003882',
                border: 'none', color: 'white', borderRadius: 4,
                cursor: selectedScenario && !launching ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.06em',
                opacity: !selectedScenario || launching ? 0.6 : 1,
              }}>
                {launching ? 'LAUNCHING...' : '▷ LAUNCH'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
