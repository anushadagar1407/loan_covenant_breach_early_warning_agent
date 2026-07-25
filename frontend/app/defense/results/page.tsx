'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../lib/api'
import { formatPValue } from '../../../lib/format'
import type { RegistrySummary, TrustAnalysis } from '../../../lib/types'

type HypothesisStatus = 'supported' | 'partial' | 'pilot' | 'instrumented' | 'collecting' | 'missing'

function pct(value?: number | null) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function avg(value?: number | null) {
  return value == null ? '-' : value.toFixed(2)
}

function statusBadge(status: HypothesisStatus) {
  const cls = {
    supported: 'badge-pass',
    partial: 'badge-warn',
    pilot: 'badge-blue',
    instrumented: 'badge-blue',
    collecting: 'badge-grey',
    missing: 'badge-danger',
  }[status]
  const label = {
    supported: 'SUPPORTED',
    partial: 'PARTIAL',
    pilot: 'PILOT',
    instrumented: 'INSTRUMENTED',
    collecting: 'COLLECTING',
    missing: 'MISSING',
  }[status]
  return <span className={`badge ${cls}`}>{label}</span>
}

function MetricTile({ label, value, sub, tone = 'neutral' }: {
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

function ThesisClaimCard({
  id,
  title,
  claim,
  measure,
  evidence,
  status,
}: {
  id: string
  title: string
  claim: string
  measure: string
  evidence: string
  status: HypothesisStatus
}) {
  return (
    <article className={`thesis-claim thesis-claim-${id.toLowerCase()}`}>
      <div className="claim-topline">
        <div className="evidence-id">{id}</div>
        {statusBadge(status)}
      </div>
      <h3>{title}</h3>
      <p>{claim}</p>
      <div className="claim-meta">
        <div>
          <div className="section-label">Primary measure</div>
          <span>{measure}</span>
        </div>
        <div>
          <div className="section-label">Current evidence</div>
          <span>{evidence}</span>
        </div>
      </div>
    </article>
  )
}

function EvidenceRow({ label, value, tone = 'neutral' }: {
  label: string
  value: string
  tone?: 'neutral' | 'pass' | 'warn' | 'danger'
}) {
  const color = {
    neutral: 'var(--text-primary)',
    pass: 'var(--pass)',
    warn: 'var(--warn)',
    danger: 'var(--danger)',
  }[tone]
  return (
    <div className="stat-row">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  )
}

function TransparencyMechanism({ title, body, active }: {
  title: string
  body: string
  active: boolean
}) {
  return (
    <div className="mechanism-row">
      <span className={`mechanism-dot ${active ? 'mechanism-dot-on' : ''}`} />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </div>
  )
}

function LevelMiniBar({ label, value }: { label: string; value?: number }) {
  const width = Math.min(100, Math.max(0, (value ?? 0) * 100))
  return (
    <div className="bar-row">
      <div className="bar-row-header">
        <span>{label}</span>
        <strong className="metric-number">{pct(value)}</strong>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${width}%`, background: 'var(--danger)' }} />
      </div>
    </div>
  )
}

function evidenceSourceLabel(source?: TrustAnalysis['evidence_source']) {
  if (source === 'human') return 'Human stakeholder evidence'
  if (source === 'mixed') return 'Mixed human + synthetic pilot evidence'
  if (source === 'synthetic_demo') return 'Synthetic pilot evidence'
  return 'Trust evidence not collected'
}

export default function DefensePage() {
  const [summary, setSummary] = useState<RegistrySummary | null>(null)
  const [trust, setTrust] = useState<TrustAnalysis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      api.getRegistrySummary(),
      api.getTrustAnalysis(),
    ]).then(([summaryResult, trustResult]) => {
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
      if (trustResult.status === 'fulfilled') setTrust(trustResult.value)
      setLoading(false)
    })
  }, [])

  const h1 = summary?.h1_validation
  const h2 = summary?.h2_validation
  const cm = summary?.classification_metrics
  const responseCount = trust?.response_count ?? 0
  const syntheticTrust = trust?.evidence_source === 'synthetic_demo'
  const mixedTrust = trust?.evidence_source === 'mixed'
  const trustSource = evidenceSourceLabel(trust?.evidence_source)
  const h3Status: HypothesisStatus = responseCount === 0
    ? 'instrumented'
    : trust?.h3_readiness?.regression_ready
      ? 'pilot'
      : 'collecting'
  const h4Delta = trust?.transparency_trust_delta
  const h4Status: HypothesisStatus = h4Delta == null
    ? responseCount > 0 ? 'collecting' : 'instrumented'
    : h4Delta > 0 ? 'pilot' : 'partial'

  const outcomeOnly = trust?.by_condition?.outcome_only
  const transparent = trust?.by_condition?.transparent
  const hasTransparentArtifacts = (summary?.evidence_quality?.transparency_artifact_rate ?? 0) > 0

  const trustInstrumentCoverage = useMemo(() => {
    const items = [
      outcomeOnly?.count ? 1 : 0,
      transparent?.count ? 1 : 0,
      trust?.stakeholder_group_count ? 1 : 0,
      trust?.paired_run_count ? 1 : 0,
    ]
    return items.reduce((sum, item) => sum + item, 0)
  }, [outcomeOnly?.count, transparent?.count, trust?.stakeholder_group_count, trust?.paired_run_count])

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div className="pill-row" style={{ alignItems: 'center', marginBottom: 10 }}>
            <span className="badge badge-blue">Thesis evidence</span>
            <span className="eyebrow">Current support for H1-H4</span>
          </div>
          <div className="detail-header-row">
            <div>
              <h1 className="page-title">Thesis evidence results: current support for H1-H4.</h1>
              <div className="page-subtitle">
                This results page summarizes the four claims after the reader has seen the explanation, registry, run evidence, and trust-study data.
              </div>
            </div>
            <a className="button button-secondary" href="/defense">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to explanation
            </a>
          </div>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="card card-pad" style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            Loading thesis evidence...
          </div>
        ) : null}

        <section className="metric-grid" style={{ marginBottom: 20 }}>
          <MetricTile label="Evaluation runs" value={String(summary?.total_runs ?? 0)} sub="Process and outcome evidence" />
          <MetricTile
            label="Outcome accuracy"
            value={cm ? pct(cm.accuracy) : '-'}
            sub="Traditional metric baseline"
            tone={(cm?.accuracy ?? 0) >= 0.8 ? 'pass' : 'neutral'}
          />
          <MetricTile
            label="Process error rate"
            value={pct(summary?.process_error_rate)}
            sub={`${summary?.process_errors ?? 0} runs flagged`}
            tone={(summary?.process_error_rate ?? 0) > 0 ? 'danger' : 'pass'}
          />
          <MetricTile
            label="Trust study responses"
            value={String(responseCount)}
            sub={responseCount > 0 ? trustSource : `${trustInstrumentCoverage}/4 trust-design signals active`}
            tone={responseCount > 0 ? syntheticTrust || mixedTrust ? 'warn' : 'pass' : 'warn'}
          />
        </section>

        {(syntheticTrust || mixedTrust) && (
          <div className="status-callout" style={{ marginBottom: 20, borderLeftColor: 'var(--warn)' }}>
            <strong>H3/H4 evidence source: {trustSource}</strong>
            <span>
              The trust-study numbers below are synthetic pilot evidence generated for the workflow.
              Replace or separate them from human survey responses before making final thesis claims.
            </span>
          </div>
        )}

        <section className="hypothesis-board" style={{ marginBottom: 20 }}>
          <ThesisClaimCard
            id="H1"
            title="Outcome metrics mask process risk"
            claim="Correct final verdicts can still contain skipped compliance steps, incomplete clause coverage, or weak trajectory evidence."
            measure="Outcome correctness versus clause coverage, trajectory score, and audit trace."
            evidence={h1 ? `Gap mean ${pct(h1.gap_score_mean)}, p=${formatPValue(h1.p_value)}, ${h1.runs_with_gap}/${h1.total_runs} hidden-gap runs.` : 'No registry summary loaded.'}
            status={h1?.significant_at_0_05 ? 'supported' : summary ? 'partial' : 'missing'}
          />
          <ThesisClaimCard
            id="H2"
            title="Autonomy increases hidden errors"
            claim="Higher autonomy is evaluated through constrained (L1), guided (L2), and autonomous (L3) process-error rates while final outcome quality remains visible."
            measure="Process-error incidence by autonomy level and clause-coverage degradation."
            evidence={h2 ? `Constrained (L1) ${pct(h2.level_1_error_rate)}, guided (L2) ${pct(h2.level_2_error_rate)}, autonomous (L3) ${pct(h2.level_3_error_rate)}; Spearman ${h2.spearman_correlation.toFixed(3)}.` : 'No H2 evidence loaded.'}
            status={h2?.significant_at_0_05 ? 'supported' : summary ? 'partial' : 'missing'}
          />
          <ThesisClaimCard
            id="H3"
            title="Traditional metrics do not explain trust"
            claim="Stakeholder trust is modeled separately from accuracy, with auditability, traceability, and explanation sufficiency captured as trust predictors."
            measure="Structured trust survey across technical, non-technical, risk/compliance, and business stakeholders."
            evidence={responseCount > 0 ? `${responseCount} ${syntheticTrust ? 'synthetic pilot ' : ''}responses, ${trust?.stakeholder_group_count ?? 0} stakeholder groups, regression ready: ${trust?.h3_readiness?.regression_ready ? 'yes' : 'no'}.` : 'Trust responses are not collected yet.'}
            status={h3Status}
          />
          <ThesisClaimCard
            id="H4"
            title="Transparency drives trust"
            claim="Trust is compared between outcome-only and transparent conditions while the underlying agent performance is held constant."
            measure="Outcome-only versus transparent views with audit trails, reasoning logs, and registry visibility."
            evidence={h4Delta != null ? `${syntheticTrust ? 'Synthetic pilot ' : ''}trust delta ${h4Delta.toFixed(2)} on a 1-7 scale; paired runs ${trust?.paired_run_count ?? 0}.` : 'Paired transparency-condition evidence is not available yet.'}
            status={h4Status}
          />
        </section>

        <section className="story-grid" style={{ marginBottom: 20 }}>
          <div className="card card-pad">
            <div className="section-label">Proposal alignment</div>
            <h2 className="page-title">Design Science Research artifact</h2>
            <p className="page-subtitle">
              The dashboard connects the proposal's validation phase to a controlled sandbox workflow:
              outcome layer, process layer, transparency layer, and stakeholder trust layer.
            </p>
            <div className="timeline-list" style={{ marginTop: 16 }}>
              <div className="timeline-step"><div><strong>Outcome layer</strong><span>Accuracy, precision, recall, F1, and final covenant verdict.</span></div></div>
              <div className="timeline-step"><div><strong>Process layer</strong><span>Clause coverage, trajectory score, skipped checks, and tool-call accuracy.</span></div></div>
              <div className="timeline-step"><div><strong>Autonomy layer</strong><span>Constrained (L1), guided (L2), and autonomous (L3) execution conditions.</span></div></div>
              <div className="timeline-step"><div><strong>Trust layer</strong><span>Stakeholder trust, auditability, reliability, and explanation sufficiency scores.</span></div></div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-label">H3/H4 trust instrument</div>
            <h2 className="page-title">Trust is measured as its own dependent variable.</h2>
            <div className="stat-list" style={{ marginTop: 16 }}>
              <EvidenceRow label="Outcome-only responses" value={String(outcomeOnly?.count ?? 0)} />
              <EvidenceRow label="Transparent responses" value={String(transparent?.count ?? 0)} />
              <EvidenceRow label="Stakeholder groups represented" value={String(trust?.stakeholder_group_count ?? 0)} />
              <EvidenceRow label="Runs with both conditions" value={String(trust?.paired_run_count ?? 0)} />
              <EvidenceRow label="Evidence source" value={trustSource} tone={syntheticTrust || mixedTrust ? 'warn' : 'pass'} />
              <EvidenceRow label="Transparent trust average" value={avg(transparent?.avg_trust_score)} tone={(transparent?.avg_trust_score ?? 0) > (outcomeOnly?.avg_trust_score ?? 0) ? 'pass' : 'neutral'} />
              <EvidenceRow label="Outcome-only trust average" value={avg(outcomeOnly?.avg_trust_score)} />
            </div>
          </div>
        </section>

        <section className="story-grid" style={{ marginBottom: 20 }}>
          <div className="card card-pad">
            <div className="section-label">Transparency mechanisms</div>
            <div className="mechanism-list">
              <TransparencyMechanism
                title="Audit trail"
                body="Every run stores auditable events for the covenant workflow."
                active={hasTransparentArtifacts}
              />
              <TransparencyMechanism
                title="Reasoning and tool trace"
                body="Tool calls expose sequence, latency, errors, and per-tool accuracy."
                active={(summary?.total_runs ?? 0) > 0}
              />
              <TransparencyMechanism
                title="Agent registry evidence"
                body="Runs are aggregated into reusable evidence for H1 and H2."
                active={(summary?.total_runs ?? 0) > 0}
              />
              <TransparencyMechanism
                title="Stakeholder trust ratings"
                body="H3 and H4 are linked to survey responses rather than inferred from accuracy."
                active={responseCount > 0}
              />
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-label">Autonomy evidence</div>
            <div className="bar-list">
              <LevelMiniBar label="Constrained (L1) process errors" value={h2?.level_1_error_rate} />
              <LevelMiniBar label="Guided (L2) process errors" value={h2?.level_2_error_rate} />
              <LevelMiniBar label="Autonomous (L3) process errors" value={h2?.level_3_error_rate} />
            </div>
            <div className="status-callout" style={{ marginTop: 16, borderLeftColor: h2?.significant_at_0_05 ? 'var(--pass)' : 'var(--warn)' }}>
              <strong>{h2?.conclusion ?? 'Autonomy evidence is not loaded.'}</strong>
              <span>Interpretation remains exploratory until the planned evaluation cohort is balanced across autonomy conditions.</span>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <div className="section-label">Validation readiness</div>
          <div className="readiness-grid">
            <div className="readiness-item">
              <strong>H1/H2 quantitative base</strong>
              <span>{summary?.evidence_quality?.minimum_runs_met ? 'Sample threshold met' : 'Exploratory run count'}</span>
            </div>
            <div className="readiness-item">
              <strong>H3 regression readiness</strong>
              <span>{trust?.h3_readiness?.message ?? 'Requires stakeholder trust responses.'}</span>
            </div>
            <div className="readiness-item">
              <strong>H4 transparency comparison</strong>
              <span>{trust?.h4_readiness?.message ?? 'Requires outcome-only and transparent condition responses.'}</span>
            </div>
          </div>
        </section>

        <section className="route-card-grid" style={{ marginTop: 20 }}>
          <a className="route-card" href="/defense">
            <span>Back</span>
            <strong>Research explanation</strong>
            <p>Return to the page that explains the question, evidence layers, and how to read the study.</p>
          </a>
          <a className="route-card" href="/trust/results">
            <span>Related results</span>
            <strong>Trust study results</strong>
            <p>Review the separated trust-response analysis and gold-standard comparison.</p>
          </a>
        </section>
      </div>
    </div>
  )
}
