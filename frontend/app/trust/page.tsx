'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { AgentRun, TrustAnalysis, TrustResponsePayload } from '../../lib/types'

type StakeholderGroup = TrustResponsePayload['stakeholder_group']
type TransparencyCondition = TrustResponsePayload['transparency_condition']

const stakeholderGroups = [
  { value: 'technical', label: 'Technical' },
  { value: 'non_technical', label: 'Non-technical' },
  { value: 'risk_compliance', label: 'Risk/compliance' },
  { value: 'business', label: 'Business' },
]

const conditions = [
  { value: 'outcome_only', label: 'Outcome only', desc: 'Reviewer sees verdict and top-line accuracy metrics.' },
  { value: 'transparent', label: 'Transparent', desc: 'Reviewer sees verdict, audit trail, tool sequence, and registry context.' },
]

function avg(value?: number | null) {
  return value == null ? '-' : value.toFixed(2)
}

function AnalysisCard({ label, value, sub, tone = 'neutral' }: {
  label: string
  value: string
  sub?: string
  tone?: 'neutral' | 'pass' | 'warn' | 'danger'
}) {
  const color = {
    neutral: 'var(--text-primary)',
    pass: 'var(--pass)',
    warn: 'var(--warn)',
    danger: 'var(--danger)',
  }[tone]
  return (
    <div className="metric-card">
      <div className="section-label">{label}</div>
      <div className="metric-card-value" style={{ color }}>{value}</div>
      {sub && <div className="metric-card-subtitle">{sub}</div>}
    </div>
  )
}

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="range-row">
      <span className="form-label" style={{ marginBottom: 0 }}>{label}</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 12, alignItems: 'center' }}>
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
        <span className="score-chip">{value}</span>
      </div>
    </label>
  )
}

export default function TrustStudyPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [analysis, setAnalysis] = useState<TrustAnalysis | null>(null)
  const [runId, setRunId] = useState('')
  const [stakeholderGroup, setStakeholderGroup] = useState<StakeholderGroup>('risk_compliance')
  const [transparencyCondition, setTransparencyCondition] = useState<TransparencyCondition>('transparent')
  const [trustScore, setTrustScore] = useState(5)
  const [auditabilityScore, setAuditabilityScore] = useState(5)
  const [reliabilityScore, setReliabilityScore] = useState(5)
  const [explanationScore, setExplanationScore] = useState(5)
  const [comments, setComments] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    api.getRuns(1).then(r => {
      setRuns(r.runs)
      if (!runId && r.runs.length > 0) setRunId(r.runs[0].run_id)
    }).catch(() => setRuns([]))
    api.getTrustAnalysis().then(setAnalysis).catch(() => setAnalysis(null))
  }

  useEffect(() => {
    load()
  }, [])

  const selectedRun = useMemo(
    () => runs.find(run => run.run_id === runId),
    [runs, runId]
  )

  const submit = async () => {
    setSubmitting(true)
    setMessage(null)
    try {
      await api.submitTrustResponse({
        run_id: runId,
        stakeholder_group: stakeholderGroup,
        transparency_condition: transparencyCondition,
        trust_score: trustScore,
        auditability_score: auditabilityScore,
        reliability_score: reliabilityScore,
        explanation_sufficiency_score: explanationScore,
        comments,
      })
      setMessage('Trust response recorded. Use paired outcome-only and transparent responses for stronger H4 evidence.')
      setComments('')
      load()
    } catch (err: any) {
      setMessage(err?.message || 'Could not record trust response.')
    } finally {
      setSubmitting(false)
    }
  }

  const outcomeOnly = analysis?.by_condition?.outcome_only
  const transparent = analysis?.by_condition?.transparent
  const delta = analysis?.transparency_trust_delta

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div className="pill-row" style={{ alignItems: 'center', marginBottom: 10 }}>
            <span className="badge badge-blue">Pilot Trust Study</span>
            <span className="eyebrow">H3 + H4 evidence collection</span>
          </div>
          <h1 className="page-title">Measure stakeholder trust with and without transparency.</h1>
          <div className="page-subtitle">
            A lightweight pilot workflow for collecting trust, auditability, reliability, and explanation sufficiency ratings.
          </div>
        </div>
      </div>

      <div className="page-content">
        <section className="metric-grid" style={{ marginBottom: 20 }}>
          <AnalysisCard
            label="Responses"
            value={String(analysis?.response_count ?? 0)}
            sub="Pilot sample size"
            tone={(analysis?.response_count ?? 0) > 0 ? 'pass' : 'warn'}
          />
          <AnalysisCard
            label="Outcome-only trust"
            value={avg(outcomeOnly?.avg_trust_score)}
            sub={`${outcomeOnly?.count ?? 0} responses`}
          />
          <AnalysisCard
            label="Transparent trust"
            value={avg(transparent?.avg_trust_score)}
            sub={`${transparent?.count ?? 0} responses`}
            tone={(transparent?.avg_trust_score ?? 0) > (outcomeOnly?.avg_trust_score ?? 0) ? 'pass' : 'neutral'}
          />
          <AnalysisCard
            label="Transparency delta"
            value={delta == null ? '-' : delta.toFixed(2)}
            sub="Transparent minus outcome-only"
            tone={delta == null ? 'warn' : delta > 0 ? 'pass' : 'danger'}
          />
        </section>

        <section className="story-grid" style={{ marginBottom: 20 }}>
          <div className="card card-pad">
            <div className="section-label">Survey response</div>
            <div className="form-grid">
              <label>
                <span className="form-label">Run</span>
                <select className="form-control" value={runId} onChange={e => setRunId(e.target.value)}>
                  {runs.length === 0 && <option>No runs available</option>}
                  {runs.map(run => (
                    <option key={run.run_id} value={run.run_id}>
                      {run.run_id.slice(0, 8)} - {run.borrower_name} - L{run.autonomy_level} - {run.final_verdict ?? run.status}
                    </option>
                  ))}
                </select>
              </label>

              {selectedRun && (
                <div className="status-callout" style={{ borderLeftColor: selectedRun.process_error_detected ? 'var(--danger)' : 'var(--pass)' }}>
                  <strong>{selectedRun.final_verdict ?? selectedRun.status}</strong>
                  <span>
                    Outcome: {selectedRun.outcome_correct === null ? 'unknown' : selectedRun.outcome_correct ? 'correct' : 'wrong'}.
                    Clause coverage: {Math.round((selectedRun.clause_coverage_score ?? 0) * 100)}%.
                  </span>
                </div>
              )}

              <div className="survey-grid">
                <label>
                  <span className="form-label">Stakeholder group</span>
                  <select className="form-control" value={stakeholderGroup} onChange={e => setStakeholderGroup(e.target.value as StakeholderGroup)}>
                    {stakeholderGroups.map(group => (
                      <option key={group.value} value={group.value}>{group.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="form-label">Transparency condition</span>
                  <select className="form-control" value={transparencyCondition} onChange={e => setTransparencyCondition(e.target.value as TransparencyCondition)}>
                    {conditions.map(condition => (
                      <option key={condition.value} value={condition.value}>{condition.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="status-callout" style={{ borderLeftColor: transparencyCondition === 'transparent' ? 'var(--accent)' : 'var(--warn)' }}>
                <strong>{conditions.find(c => c.value === transparencyCondition)?.label}</strong>
                <span>{conditions.find(c => c.value === transparencyCondition)?.desc}</span>
              </div>

              <RangeField label="Trust in decision" value={trustScore} onChange={setTrustScore} />
              <RangeField label="Auditability" value={auditabilityScore} onChange={setAuditabilityScore} />
              <RangeField label="Perceived reliability" value={reliabilityScore} onChange={setReliabilityScore} />
              <RangeField label="Explanation sufficiency" value={explanationScore} onChange={setExplanationScore} />

              <label>
                <span className="form-label">Reviewer comments</span>
                <textarea
                  className="form-control"
                  rows={4}
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="What made this output trustworthy or untrustworthy?"
                />
              </label>

              {message && (
                <div className="status-callout" style={{ borderLeftColor: message.includes('recorded') ? 'var(--pass)' : 'var(--danger)' }}>
                  <strong>{message.includes('recorded') ? 'Saved' : 'Action needed'}</strong>
                  <span>{message}</span>
                </div>
              )}

              <button
                type="button"
                className="button button-primary"
                disabled={!runId || submitting}
                onClick={submit}
              >
                {submitting ? 'Saving...' : 'Record trust response'}
              </button>
            </div>
          </div>

          <div className="panel-stack">
            <div className="card card-pad">
              <div className="section-label">H3 interpretation</div>
              <h2 className="page-title">Trust is measured separately from accuracy.</h2>
              <p className="page-subtitle">
                The proposal requires proving that traditional metrics are weak predictors of trust. This pilot collects the missing dependent variable:
                stakeholder trust ratings by role and evaluation condition.
              </p>
            </div>

            <div className="card card-pad">
              <div className="section-label">H4 interpretation</div>
              <h2 className="page-title">Transparency must be compared, not assumed.</h2>
              <p className="page-subtitle">
                For a convincing defense, collect paired ratings for the same run: first outcome-only, then transparent. A positive delta supports the direction of H4.
              </p>
            </div>

            <div className="card table-card">
              <div className="card-pad" style={{ paddingBottom: 10 }}>
                <div className="section-label">Stakeholder group averages</div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Responses</th>
                      <th>Avg trust</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analysis?.by_stakeholder_group ?? {}).map(([group, data]) => (
                      <tr key={group}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{group.replace('_', ' ')}</td>
                        <td>{data.count}</td>
                        <td style={{ fontFamily: 'var(--mono)' }}>{avg(data.avg_trust_score)}</td>
                      </tr>
                    ))}
                    {Object.keys(analysis?.by_stakeholder_group ?? {}).length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                          No trust responses recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
