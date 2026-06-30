'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { AgentRun } from '../../lib/types'
import {
  autonomyLabel,
  conditionLabel,
  conditions,
  stakeholderGroups,
  type StakeholderGroup,
  type TransparencyCondition,
  verdictLabel,
} from '../../lib/trust'

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
      <div className="range-control">
        <input
          type="range"
          min={1}
          max={7}
          step={1}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
        />
        <span className="score-chip">{value}</span>
      </div>
    </label>
  )
}

function NeutralStimulus({
  run,
  condition,
}: {
  run?: AgentRun
  condition: TransparencyCondition
}) {
  if (!run) {
    return (
      <div className="neutral-sheet">
        <div className="neutral-sheet-kicker">Agent output stimulus</div>
        <h2>Select an agent run to display its output.</h2>
        <p>No gold-standard comparison or aggregate trust result will be shown on this page.</p>
      </div>
    )
  }

  return (
    <div className="neutral-sheet">
      <div className="neutral-sheet-kicker">Agent output stimulus</div>
      <h2>{run.borrower_name ?? 'Borrower covenant review'}</h2>
      <div className="neutral-verdict">
        <span>Agent final verdict</span>
        <strong>{verdictLabel(run.final_verdict ?? run.status)}</strong>
      </div>
      <p>
        The reviewer should rate how much they trust this agent output based only on the information shown here.
        Gold-standard comparison, correctness status, and aggregate study results are hidden during collection.
      </p>
      <dl className="neutral-definition-list">
        <div>
          <dt>Scenario</dt>
          <dd>{run.scenario_id}</dd>
        </div>
        <div>
          <dt>Autonomy</dt>
          <dd>{autonomyLabel(run.autonomy_level)}</dd>
        </div>
        <div>
          <dt>Study condition</dt>
          <dd>{conditionLabel(condition)}</dd>
        </div>
      </dl>

      {condition === 'transparent' ? (
        <div className="neutral-process-box">
          <strong>Visible process context</strong>
          <span>Transparency artifacts: {run.transparency_artifacts_present ? 'available' : 'not available'}</span>
          <span>Execution mode: {run.execution_mode ?? 'not recorded'}</span>
          <span>Review cue: consider whether the shown process context is enough to audit the answer.</span>
        </div>
      ) : (
        <div className="neutral-process-box neutral-process-box-muted">
          <strong>Outcome-only condition</strong>
          <span>Process trace, gold standard, and evaluation metrics are intentionally hidden for this response.</span>
        </div>
      )}
    </div>
  )
}

export default function TrustStudyPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
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

  useEffect(() => {
    api.getRuns(1)
      .then(result => {
        setRuns(result.runs)
        if (result.runs.length > 0) setRunId(current => current || result.runs[0].run_id)
      })
      .catch(() => setRuns([]))
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
      setMessage('Trust response recorded. The comparison to the gold standard is available on the separate results page.')
      setComments('')
    } catch (err: any) {
      setMessage(err?.message || 'Could not record trust response.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="pill-row" style={{ alignItems: 'center', marginBottom: 10 }}>
              <span className="badge badge-blue">Trust collection</span>
              <span className="eyebrow">Neutral stimulus, then rating</span>
            </div>
            <h1 className="page-title">Trust collection: show the agent output, then record the rating.</h1>
            <div className="page-subtitle">
              This screen hides the gold standard and aggregate results so participants rate the output rather than the surrounding dashboard.
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="status-callout trust-study-note">
          <strong>Collection boundary</strong>
          <span>
            The gold standard, verdict correctness, clause coverage, and aggregate trust analytics are intentionally
            hidden here so the rating is about the agent output, not the dashboard presentation.
          </span>
        </div>

        <section className="card card-pad trust-collection-card">
          <div className="section-label">Step 1 - neutral agent-output stimulus</div>
          <div className="trust-setup-grid">
            <label>
              <span className="form-label">Agent run</span>
              <select className="form-control" value={runId} onChange={event => setRunId(event.target.value)}>
                {runs.length === 0 && <option>No runs available</option>}
                {runs.map(run => (
                  <option key={run.run_id} value={run.run_id}>
                    {run.run_id.slice(0, 8)} - {run.borrower_name} - {autonomyLabel(run.autonomy_level)} - {verdictLabel(run.final_verdict ?? run.status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="form-label">Study condition</span>
              <select
                className="form-control"
                value={transparencyCondition}
                onChange={event => setTransparencyCondition(event.target.value as TransparencyCondition)}
              >
                {conditions.map(condition => (
                  <option key={condition.value} value={condition.value}>{condition.label}</option>
                ))}
              </select>
              <span className="form-help">{conditions.find(item => item.value === transparencyCondition)?.desc}</span>
            </label>
          </div>

          <NeutralStimulus run={selectedRun} condition={transparencyCondition} />
        </section>

        <section className="card card-pad trust-collection-card">
          <div className="section-label">Step 2 - human trust response</div>
          <h2 className="page-title">Rate only the output shown in the stimulus sheet.</h2>
          <p className="page-subtitle">
            Use a 1 to 7 scale, where 1 means very low agreement and 7 means very high agreement.
          </p>

          <div className="form-grid" style={{ marginTop: 18 }}>
            <label>
              <span className="form-label">Stakeholder group</span>
              <select
                className="form-control"
                value={stakeholderGroup}
                onChange={event => setStakeholderGroup(event.target.value as StakeholderGroup)}
              >
                {stakeholderGroups.map(group => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
              </select>
            </label>

            <RangeField label="Overall trust in the agent decision" value={trustScore} onChange={setTrustScore} />
            <RangeField label="Auditability of the shown process information" value={auditabilityScore} onChange={setAuditabilityScore} />
            <RangeField label="Perceived reliability or competence" value={reliabilityScore} onChange={setReliabilityScore} />
            <RangeField label="Explanation sufficiency" value={explanationScore} onChange={setExplanationScore} />

            <label>
              <span className="form-label">Reviewer comments</span>
              <textarea
                className="form-control"
                rows={4}
                value={comments}
                onChange={event => setComments(event.target.value)}
                placeholder="What made this output trustworthy or untrustworthy?"
              />
            </label>

            {message && (
              <div className="status-callout" style={{ borderLeftColor: message.includes('recorded') ? 'var(--pass)' : 'var(--danger)' }}>
                <strong>{message.includes('recorded') ? 'Saved' : 'Action needed'}</strong>
                <span>{message}</span>
              </div>
            )}

            <div className="trust-action-row">
              <button
                type="button"
                className="button button-primary"
                disabled={!runId || submitting}
                onClick={submit}
              >
                {submitting ? 'Saving...' : 'Record trust response'}
              </button>
              <span className="form-help">
                Use Trust Results in the sidebar to review gold-standard comparison, aggregate trust metrics, and H3/H4 analysis.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
