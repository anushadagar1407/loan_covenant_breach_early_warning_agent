'use client'

import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { RunDetail } from '../../../lib/types'

const EXPECTED_TOOLS = [
  { name: 'extract_financial_metrics', short: 'Extract Financials' },
  { name: 'identify_applicable_covenants', short: 'Identify Covenants' },
  { name: 'check_accounting_adjustments', short: 'Check Adjustments', critical: true },
  { name: 'check_grace_period', short: 'Check Grace Period' },
  { name: 'calculate_breach_risk', short: 'Calculate Risk' },
  { name: 'generate_report', short: 'Generate Report' },
]

const EVENT_COLORS: Record<string, string> = {
  tool_called: '#3B82F6',
  tool_completed: '#10B981',
  agent_thinking: '#9CA3AF',
  final_output: '#F59E0B',
}

function ToolNode({ toolDef, event, index }: {
  toolDef: typeof EXPECTED_TOOLS[0]
  event: any
  index: number
}) {
  const called = !!event
  const hasError = event?.error
  const color = hasError ? '#EF4444' : called ? '#10B981' : '#4B5563'
  const bg = hasError ? 'rgba(239,68,68,0.1)' : called ? 'rgba(16,185,129,0.1)' : 'rgba(75,85,99,0.1)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', flex: 1 }}>
      {/* Connector line */}
      {index > 0 && (
        <div style={{
          position: 'absolute', top: 20, right: '50%', left: '-50%',
          height: 2, background: called ? '#1F2937' : '#1F2937',
          zIndex: 0,
        }} />
      )}

      {/* Node circle */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: bg, border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, zIndex: 1, position: 'relative',
        boxShadow: called ? `0 0 12px ${color}40` : 'none',
      }}>
        {hasError ? '✗' : called ? '✓' : '○'}
      </div>

      {/* Tool name */}
      <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'var(--mono)', color, textAlign: 'center', lineHeight: 1.3, maxWidth: 80 }}>
        {toolDef.short}
        {toolDef.critical && <div style={{ color: '#F59E0B', fontSize: 9 }}>CRITICAL</div>}
      </div>

      {/* Latency */}
      {event?.latency_ms && (
        <div style={{ fontSize: 9, color: '#4B5563', fontFamily: 'var(--mono)', marginTop: 3 }}>
          {Math.round(event.latency_ms)}ms
        </div>
      )}

      {/* Score */}
      {event?.accuracy_score != null && (
        <div style={{
          fontSize: 9, fontFamily: 'var(--mono)', marginTop: 2,
          color: event.accuracy_score >= 0.8 ? '#10B981' : '#F59E0B',
        }}>
          {Math.round(event.accuracy_score * 100)}%
        </div>
      )}
    </div>
  )
}

export default function RunDetailPage({ params }: { params: { id: string } }) {
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getRun(params.id).then(r => {
      setRun(r)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [params.id])

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: '#4B5563' }}>
      LOADING RUN...
    </div>
  )

  if (!run) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>
      Run not found.
    </div>
  )

  const showH1Alert = run.outcome_correct && run.process_error_detected

  // Build tool event map for trajectory
  const toolEventMap: Record<string, any> = {}
  for (const event of run.tool_call_events ?? []) {
    toolEventMap[event.tool_name] = event
  }

  const verdictColor = {
    no_breach: '#10B981', imminent: '#F59E0B', breach: '#EF4444',
    breach_curable: '#F59E0B', unknown: '#9CA3AF',
  }[run.final_verdict] ?? '#9CA3AF'

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <a href="/runs" style={{ color: '#6B7280', textDecoration: 'none', fontSize: 13 }}>← Runs</a>
          <span style={{ color: '#4B5563' }}>/</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#9CA3AF' }}>{run.run_id.slice(0, 8)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 500 }}>{run.borrower_name}</h1>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
              {run.scenario_id} · Autonomy L{run.autonomy_level} ·{' '}
              {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 600, color: verdictColor,
              letterSpacing: '0.04em',
            }}>
              {run.final_verdict?.toUpperCase().replace('_', ' ')}
            </div>
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>
              Expected: {run.correct_verdict?.toUpperCase().replace('_', ' ') ?? '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* H1 Alert Banner */}
        {showH1Alert && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderLeft: '4px solid #EF4444',
            borderRadius: 4,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#EF4444', fontWeight: 600, letterSpacing: '0.04em' }}>
                PROCESS ERROR DETECTED
              </div>
              <div style={{ fontSize: 13, color: '#FCA5A5', marginTop: 4 }}>
                This run returned a <strong>correct outcome</strong> but skipped required compliance steps.
                This error is <strong>invisible to outcome-only metrics</strong> — exactly what H1 predicts.
              </div>
            </div>
          </div>
        )}

        {/* Metric summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Outcome', value: run.outcome_correct === null ? '—' : run.outcome_correct ? '✓ CORRECT' : '✗ WRONG',
              color: run.outcome_correct ? '#10B981' : '#EF4444' },
            { label: 'Clause Coverage', value: `${Math.round((run.clause_coverage_score ?? 0) * 100)}%`,
              color: (run.clause_coverage_score ?? 0) >= 1 ? '#10B981' : '#EF4444' },
            { label: 'Trajectory Score', value: `${Math.round((run.trajectory_score ?? 0) * 100)}%`,
              color: '#3B82F6' },
            { label: 'Tool Accuracy', value: `${Math.round((run.tool_call_accuracy_score ?? 0) * 100)}%`,
              color: '#9CA3AF' },
            { label: 'Duration', value: run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : '—',
              color: '#9CA3AF' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
              <div className="section-label" style={{ fontSize: 9 }}>{label}</div>
              <div className="metric-number" style={{ fontSize: 20, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Trajectory Timeline */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-label">Tool Execution Trajectory</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 16, padding: '0 20px' }}>
            {EXPECTED_TOOLS.map((toolDef, i) => (
              <ToolNode
                key={toolDef.name}
                toolDef={toolDef}
                event={toolEventMap[toolDef.name]}
                index={i}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 20, fontSize: 11, color: '#4B5563' }}>
            <span><span style={{ color: '#10B981' }}>● </span>Called & succeeded</span>
            <span><span style={{ color: '#EF4444' }}>● </span>Called with error</span>
            <span><span style={{ color: '#4B5563' }}>○ </span>Skipped / not called</span>
            <span><span style={{ color: '#F59E0B' }}>★ </span>Critical step</span>
          </div>
        </div>

        {/* Audit Log */}
        <div className="card">
          <div className="section-label" style={{ marginBottom: 12 }}>
            Audit Trail ({run.audit_log_entries?.length ?? 0} events)
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {(run.audit_log_entries ?? []).length === 0 ? (
              <div style={{ color: '#4B5563', fontSize: 12, fontFamily: 'var(--mono)' }}>
                No audit entries recorded.
              </div>
            ) : (
              (run.audit_log_entries ?? []).map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '8px 0',
                  borderBottom: i < (run.audit_log_entries?.length ?? 0) - 1 ? '1px solid rgba(31,41,55,0.4)' : 'none',
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#4B5563', minWidth: 80, marginTop: 2 }}>
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '—'}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
                    color: EVENT_COLORS[entry.event_type] ?? '#9CA3AF',
                    minWidth: 120,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginTop: 2,
                  }}>
                    {entry.event_type.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', flex: 1, lineHeight: 1.5 }}>
                    {entry.message}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
