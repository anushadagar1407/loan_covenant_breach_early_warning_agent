'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../lib/api'
import type { AgentRun, TrustAnalysis, TrustResponseRecord } from '../../../lib/types'
import {
  autonomyLabel,
  avg,
  conditionLabel,
  evidenceSourceLabel,
  matchLabel,
  pct,
  trustInstrumentBasis,
  verdictLabel,
} from '../../../lib/trust'

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

function ReadinessPanel({ title, status, body, tone = 'neutral' }: {
  title: string
  status: string
  body: string
  tone?: 'neutral' | 'pass' | 'warn' | 'danger'
}) {
  const border = {
    neutral: 'var(--accent)',
    pass: 'var(--pass)',
    warn: 'var(--warn)',
    danger: 'var(--danger)',
  }[tone]
  return (
    <div className="status-callout" style={{ borderLeftColor: border }}>
      <strong>{title}: {status}</strong>
      <span>{body}</span>
    </div>
  )
}

function ResearchBasisCard({ item }: { item: typeof trustInstrumentBasis[number] }) {
  return (
    <a className="research-card" href={item.href} target="_blank" rel="noreferrer">
      <span>{item.label}</span>
      <strong>{item.measure}</strong>
      <p>{item.body}</p>
      <em>{item.source}</em>
    </a>
  )
}

function ResultItem({ label, value, tone }: { label: string; value: string; tone?: 'pass' | 'warn' | 'danger' }) {
  const color = tone === 'pass'
    ? 'var(--pass)'
    : tone === 'warn'
      ? 'var(--warn)'
      : tone === 'danger'
        ? 'var(--danger)'
        : 'var(--text-primary)'
  return (
    <div className="result-tile">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  )
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function runFromResponse(response?: TrustResponseRecord, runs: AgentRun[] = []) {
  if (response?.run) return response.run
  return runs.find(run => run.run_id === response?.run_id) ?? runs[0]
}

export default function TrustResultsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [analysis, setAnalysis] = useState<TrustAnalysis | null>(null)
  const [responses, setResponses] = useState<TrustResponseRecord[]>([])
  const [responseId, setResponseId] = useState('')

  useEffect(() => {
    api.getRuns(1).then(result => setRuns(result.runs)).catch(() => setRuns([]))
    api.getTrustAnalysis().then(setAnalysis).catch(() => setAnalysis(null))
    api.getTrustResponses()
      .then(result => {
        setResponses(result.responses)
        if (result.responses.length > 0) setResponseId(current => current || result.responses[0].response_id)
      })
      .catch(() => setResponses([]))
  }, [])

  const selectedResponse = useMemo(
    () => responses.find(response => response.response_id === responseId) ?? responses[0],
    [responses, responseId]
  )
  const selectedRun = runFromResponse(selectedResponse, runs)
  const outcomeOnly = analysis?.by_condition?.outcome_only
  const transparent = analysis?.by_condition?.transparent
  const delta = analysis?.transparency_trust_delta
  const predictors = analysis?.trust_predictor_averages
  const sourceLabel = evidenceSourceLabel(analysis?.evidence_source)
  const syntheticTrust = analysis?.evidence_source === 'synthetic_demo' || analysis?.evidence_source === 'mixed'

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div className="detail-header-row">
            <div>
              <div className="pill-row" style={{ alignItems: 'center', marginBottom: 10 }}>
                <span className="badge badge-blue">Trust results</span>
                <span className="eyebrow">Post-collection comparison</span>
              </div>
              <h1 className="page-title">Trust results: agent output vs. gold standard vs. reviewer rating.</h1>
              <div className="page-subtitle">
                Use this page after collection to inspect the three separate evidence inputs behind each trust-study result.
              </div>
            </div>
            <a className="button button-secondary" href="/trust">
              <ArrowLeft size={16} aria-hidden="true" />
              Collect response
            </a>
          </div>
        </div>
      </div>

      <div className="page-content">
        <section className="metric-grid" style={{ marginBottom: 20 }}>
          <AnalysisCard
            label="Responses"
            value={String(analysis?.response_count ?? 0)}
            sub={sourceLabel}
            tone={(analysis?.response_count ?? 0) > 0 ? syntheticTrust ? 'warn' : 'pass' : 'warn'}
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

        {syntheticTrust && (
          <div className="status-callout" style={{ marginBottom: 20, borderLeftColor: 'var(--warn)' }}>
            <strong>{sourceLabel}</strong>
            <span>
              These values include synthetic pilot data. Keep synthetic and real stakeholder responses separated in the final thesis analysis.
            </span>
          </div>
        )}

        <section className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="section-label">Three evidence inputs</div>
          <div className="trust-result-selector">
            <div>
              <h2 className="page-title">Selected response, decomposed by source</h2>
              <p className="page-subtitle">
                The verdict came from the agent run. The match and coverage came from comparison to the gold standard. The trust score came from the reviewer.
              </p>
            </div>
            <label>
              <span className="form-label">Response</span>
              <select className="form-control" value={selectedResponse?.response_id ?? ''} onChange={event => setResponseId(event.target.value)}>
                {responses.length === 0 && <option>No responses recorded</option>}
                {responses.map(response => (
                  <option key={response.response_id} value={response.response_id}>
                    {formatDate(response.created_at)} - {response.run?.borrower_name ?? response.run_id.slice(0, 8)} - {conditionLabel(response.transparency_condition)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="analysis-triptych">
            <div className="signal-panel signal-panel-agent">
              <div className="section-label">1. Agent output</div>
              <h3>Produced by the run</h3>
              <ResultItem label="Agent verdict" value={verdictLabel(selectedRun?.final_verdict ?? selectedRun?.status)} />
              <ResultItem label="Borrower" value={selectedRun?.borrower_name ?? 'Unknown'} />
              <ResultItem label="Autonomy" value={autonomyLabel(selectedRun?.autonomy_level)} />
            </div>

            <div className="signal-panel signal-panel-gold">
              <div className="section-label">2. Gold standard comparison</div>
              <h3>Applied after the run</h3>
              <ResultItem label="Expected verdict" value={verdictLabel(selectedRun?.correct_verdict)} />
              <ResultItem
                label="Verdict match"
                value={matchLabel(selectedRun)}
                tone={selectedRun?.outcome_correct == null ? 'warn' : selectedRun.outcome_correct ? 'pass' : 'danger'}
              />
              <ResultItem label="Clause coverage" value={pct(selectedRun?.clause_coverage_score)} />
              <ResultItem
                label="Process review"
                value={selectedRun?.process_error_detected ? 'Hidden process gap detected' : 'No hidden process gap flagged'}
                tone={selectedRun?.process_error_detected ? 'danger' : 'pass'}
              />
            </div>

            <div className="signal-panel signal-panel-user">
              <div className="section-label">3. User trust input</div>
              <h3>Collected from reviewer</h3>
              <ResultItem label="Trust score" value={selectedResponse ? String(selectedResponse.trust_score) : 'No response'} />
              <ResultItem label="Condition" value={conditionLabel(selectedResponse?.transparency_condition)} />
              <ResultItem label="Stakeholder" value={selectedResponse?.stakeholder_group?.replace('_', ' ') ?? 'No response'} />
              <ResultItem label="Auditability" value={avg(selectedResponse?.auditability_score)} />
            </div>
          </div>
        </section>

        <section className="story-grid" style={{ marginBottom: 20 }}>
          <div className="card card-pad">
            <div className="section-label">Measurement basis</div>
            <h2 className="page-title">Why these trust-study questions are included</h2>
            <p className="page-subtitle">
              The pilot fields are mapped to trust-in-automation, human-computer trust, and explainable-AI evaluation constructs.
            </p>
            <div className="research-grid" style={{ marginTop: 18 }}>
              {trustInstrumentBasis.map(item => (
                <ResearchBasisCard key={item.measure} item={item} />
              ))}
            </div>
          </div>

          <div className="panel-stack">
            <div className="card card-pad">
              <div className="section-label">H3 trust predictors</div>
              <h2 className="page-title">Trust is modeled separately from correctness.</h2>
              <div className="metric-grid" style={{ marginTop: 16 }}>
                <AnalysisCard label="Auditability" value={avg(predictors?.auditability_score)} sub="Mean survey score" />
                <AnalysisCard label="Reliability" value={avg(predictors?.reliability_score)} sub="Mean survey score" />
                <AnalysisCard label="Explanation" value={avg(predictors?.explanation_sufficiency_score)} sub="Mean survey score" />
              </div>
            </div>

            <div className="card card-pad">
              <div className="section-label">Readiness</div>
              <div className="form-grid">
                <ReadinessPanel
                  title="H3"
                  status={analysis?.h3_readiness?.regression_ready ? 'pilot ready' : 'collecting'}
                  body={analysis?.h3_readiness?.message ?? 'Collect stakeholder responses to evaluate H3.'}
                  tone={analysis?.h3_readiness?.regression_ready ? 'pass' : 'warn'}
                />
                <ReadinessPanel
                  title="H4"
                  status={analysis?.h4_readiness?.comparison_ready ? 'comparison ready' : 'collecting'}
                  body={analysis?.h4_readiness?.message ?? 'Collect outcome-only and transparent responses to evaluate H4.'}
                  tone={analysis?.h4_readiness?.comparison_ready ? 'pass' : 'warn'}
                />
                <div className="stat-list">
                  <div className="stat-row"><span>Stakeholder groups</span><strong>{analysis?.stakeholder_group_count ?? 0}</strong></div>
                  <div className="stat-row"><span>Runs with both conditions</span><strong>{analysis?.paired_run_count ?? 0}</strong></div>
                  <div className="stat-row"><span>Human responses</span><strong>{analysis?.human_response_count ?? 0}</strong></div>
                  <div className="stat-row"><span>Synthetic responses</span><strong>{analysis?.synthetic_response_count ?? 0}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="card table-card">
          <div className="card-pad" style={{ paddingBottom: 10 }}>
            <div className="section-label">Recorded responses</div>
          </div>
          <div className="table-scroll trust-response-table">
            <table>
              <thead>
                <tr>
                  <th>Response</th>
                  <th>Run</th>
                  <th>Condition</th>
                  <th>Agent output</th>
                  <th>Gold standard</th>
                  <th>Match</th>
                  <th>Trust</th>
                  <th>Audit</th>
                  <th>Reliability</th>
                  <th>Explanation</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {responses.map(response => {
                  const run = runFromResponse(response, runs)
                  return (
                    <tr key={response.response_id}>
                      <td className="truncate-cell">{formatDate(response.created_at)}</td>
                      <td className="truncate-cell">{run?.borrower_name ?? response.run_id}</td>
                      <td>{conditionLabel(response.transparency_condition)}</td>
                      <td>{verdictLabel(run?.final_verdict ?? run?.status)}</td>
                      <td>{verdictLabel(run?.correct_verdict)}</td>
                      <td>{matchLabel(run)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{response.trust_score}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{avg(response.auditability_score)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{avg(response.reliability_score)}</td>
                      <td style={{ fontFamily: 'var(--mono)' }}>{avg(response.explanation_sufficiency_score)}</td>
                      <td>{response.response_source ?? 'human'}</td>
                    </tr>
                  )
                })}
                {responses.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                      No trust responses recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
