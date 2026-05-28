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
  tool_called: 'var(--accent-strong)',
  tool_completed: 'var(--pass)',
  agent_thinking: 'var(--text-secondary)',
  final_output: 'var(--warn)',
}

function ToolNode({ toolDef, event }: {
  toolDef: typeof EXPECTED_TOOLS[0]
  event: any
}) {
  const called = Boolean(event)
  const hasError = Boolean(event?.error)
  const color = hasError ? 'var(--danger)' : called ? 'var(--pass)' : 'var(--text-muted)'

  return (
    <div className="tool-node" style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        border: `2px solid ${color}`,
        background: called ? 'rgba(33,185,129,0.1)' : 'rgba(101,113,135,0.1)',
        color,
        fontFamily: 'var(--mono)',
        fontWeight: 600,
      }}>
        {hasError ? '!' : called ? 'OK' : '-'}
      </div>
      <div style={{
        color,
        fontFamily: 'var(--mono)',
        fontSize: 10,
        lineHeight: 1.3,
        textAlign: 'center',
        overflowWrap: 'anywhere',
      }}>
        {toolDef.short}
        {toolDef.critical && <div style={{ color: 'var(--warn)', fontSize: 9 }}>CRITICAL</div>}
      </div>
      {event?.latency_ms && (
        <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 9 }}>
          {Math.round(event.latency_ms)}ms
        </div>
      )}
      {event?.accuracy_score != null && (
        <div style={{
          color: event.accuracy_score >= 0.8 ? 'var(--pass)' : 'var(--warn)',
          fontFamily: 'var(--mono)',
          fontSize: 9,
        }}>
          {Math.round(event.accuracy_score * 100)}%
        </div>
      )}
    </div>
  )
}

function MetricTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
      <div className="section-label" style={{ fontSize: 9 }}>{label}</div>
      <div className="metric-number" style={{ fontSize: 20, color, overflowWrap: 'anywhere' }}>{value}</div>
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
    <div className="page-content">
      <div className="card card-pad" style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
        LOADING RUN...
      </div>
    </div>
  )

  if (!run) return (
    <div className="page-content">
      <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--danger)' }}>
        Run not found.
      </div>
    </div>
  )

  const showH1Alert = run.outcome_correct && run.process_error_detected
  const toolEventMap: Record<string, any> = {}
  for (const event of run.tool_call_events ?? []) {
    toolEventMap[event.tool_name] = event
  }

  const verdictKey = run.final_verdict ?? 'unknown'
  const verdictColor = {
    no_breach: 'var(--pass)',
    imminent: 'var(--warn)',
    breach: 'var(--danger)',
    breach_curable: 'var(--warn)',
    unknown: 'var(--text-secondary)',
  }[verdictKey] ?? 'var(--text-secondary)'

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minWidth: 0 }}>
            <a href="/runs" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>Back to runs</a>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{run.run_id.slice(0, 8)}</span>
          </div>
          <div className="detail-header-row">
            <div style={{ minWidth: 0 }}>
              <h1 className="page-title">{run.borrower_name}</h1>
              <div className="page-subtitle">
                {run.scenario_id} - Autonomy L{run.autonomy_level} - {run.started_at ? new Date(run.started_at).toLocaleString() : '-'}
              </div>
              <div className="pill-row" style={{ marginTop: 10 }}>
                <span className={`badge ${run.ground_truth_fallback_used ? 'badge-warn' : 'badge-pass'}`}>
                  {run.data_source ?? 'unknown source'}
                </span>
                <span className={`badge ${run.transparency_artifacts_present ? 'badge-pass' : 'badge-warn'}`}>
                  {run.transparency_artifacts_present ? 'transparent trace' : 'trace incomplete'}
                </span>
                {run.execution_mode && (
                  <span className={`badge ${run.adk_invocation_attempted ? 'badge-blue' : 'badge-grey'}`}>
                    {run.execution_mode.replace(/_/g, ' ')}
                  </span>
                )}
                {run.deterministic_fallback_used && (
                  <span className="badge badge-warn">deterministic fallback</span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 180 }}>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 20,
                fontWeight: 600,
                color: verdictColor,
                letterSpacing: '0.04em',
                overflowWrap: 'anywhere',
              }}>
                {(run.final_verdict ?? 'unknown').toUpperCase().replace('_', ' ')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Expected: {(run.correct_verdict ?? '-').toUpperCase().replace('_', ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {showH1Alert && (
          <div className="status-callout" style={{ marginBottom: 20, borderLeftColor: 'var(--danger)' }}>
            <strong style={{ color: 'var(--danger)' }}>Process error detected</strong>
            <span>
              This run returned a correct outcome but skipped required compliance steps. That is the H1 thesis signal: outcome-only evaluation underreports process risk.
            </span>
          </div>
        )}

        <div className="summary-grid" style={{ marginBottom: 24 }}>
          <MetricTile
            label="Outcome"
            value={run.outcome_correct === null ? '-' : run.outcome_correct ? 'CORRECT' : 'WRONG'}
            color={run.outcome_correct ? 'var(--pass)' : 'var(--danger)'}
          />
          <MetricTile
            label="Clause Coverage"
            value={`${Math.round((run.clause_coverage_score ?? 0) * 100)}%`}
            color={(run.clause_coverage_score ?? 0) >= 1 ? 'var(--pass)' : 'var(--danger)'}
          />
          <MetricTile
            label="Trajectory Score"
            value={`${Math.round((run.trajectory_score ?? 0) * 100)}%`}
            color="var(--accent-strong)"
          />
          <MetricTile
            label="Tool Accuracy"
            value={`${Math.round((run.tool_call_accuracy_score ?? 0) * 100)}%`}
            color="var(--text-secondary)"
          />
          <MetricTile
            label="Duration"
            value={run.duration_seconds ? `${run.duration_seconds.toFixed(1)}s` : '-'}
            color="var(--text-secondary)"
          />
        </div>

        {run.pdfScenario?.input_summary && (
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <div className="section-label">PDF-derived inputs</div>
            <div className="responsive-data-grid">
              {Object.entries(run.pdfScenario.input_summary).map(([k, v]) => (
                <div key={k} className="input-tile">
                  <span>{k.replace(/_/g, ' ')}</span>
                  <strong>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="section-label">Tool execution trajectory</div>
          <div className="tool-timeline" style={{ marginTop: 16 }}>
            {EXPECTED_TOOLS.map(toolDef => (
              <ToolNode
                key={toolDef.name}
                toolDef={toolDef}
                event={toolEventMap[toolDef.name]}
              />
            ))}
          </div>
          <div className="pill-row" style={{ marginTop: 20, fontSize: 11, color: 'var(--text-muted)' }}>
            <span><span style={{ color: 'var(--pass)' }}>OK </span>Called and succeeded</span>
            <span><span style={{ color: 'var(--danger)' }}>ERR </span>Called with error</span>
            <span><span style={{ color: 'var(--text-muted)' }}>SKIP </span>Skipped or not called</span>
            <span><span style={{ color: 'var(--warn)' }}>CRITICAL </span>Required H1 step</span>
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="section-label">Metric breakdown</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {(run.tool_accuracy_details ?? []).map((item, idx) => (
              <div key={idx} className="input-tile">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, overflowWrap: 'anywhere' }}>{item.tool_name}</span>
                  <span style={{ color: item.accuracy_score >= 0.8 ? 'var(--pass)' : 'var(--warn)', fontFamily: 'var(--mono)' }}>
                    {(item.accuracy_score * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {item.notes?.[0] ?? 'All checks passed'}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="section-label">
            Audit trail ({run.audit_log_entries?.length ?? 0} events)
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
            {(run.audit_log_entries ?? []).length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                No audit entries recorded.
              </div>
            ) : (
              (run.audit_log_entries ?? []).map((entry, i) => (
                <div
                  key={i}
                  className="audit-row"
                  style={{
                    borderBottom: i < (run.audit_log_entries?.length ?? 0) - 1 ? '1px solid rgba(148,163,184,0.1)' : 'none',
                  }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '-'}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: EVENT_COLORS[entry.event_type] ?? 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {entry.event_type.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 0, overflowWrap: 'anywhere' }}>
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
