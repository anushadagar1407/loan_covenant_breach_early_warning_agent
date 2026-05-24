'use client'

import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { RegistrySummary } from '../../lib/types'

type TrustAnalysis = {
  response_count: number
  h3_status?: string
  h4_status?: string
  transparency_trust_delta?: number | null
  by_condition?: Record<string, { count: number; avg_trust_score: number | null }>
  by_stakeholder_group?: Record<string, { count: number; avg_trust_score: number | null }>
  message?: string
}

function pct(value?: number | null) {
  return `${Math.round((value ?? 0) * 100)}%`
}

function statusBadge(status: 'supported' | 'partial' | 'pilot' | 'missing') {
  const cls = {
    supported: 'badge-pass',
    partial: 'badge-warn',
    pilot: 'badge-blue',
    missing: 'badge-danger',
  }[status]
  const label = {
    supported: 'SUPPORTED',
    partial: 'PARTIAL',
    pilot: 'PILOT',
    missing: 'MISSING',
  }[status]
  return <span className={`badge ${cls}`}>{label}</span>
}

function EvidenceCard({
  id,
  title,
  claim,
  method,
  evidence,
  status,
}: {
  id: string
  title: string
  claim: string
  method: string
  evidence: string
  status: 'supported' | 'partial' | 'pilot' | 'missing'
}) {
  return (
    <div className="evidence-card">
      <div>
        <div className="evidence-id">{id}</div>
        <div style={{ marginTop: 8 }}>{statusBadge(status)}</div>
      </div>
      <div>
        <h3>{title}</h3>
        <p>{claim}</p>
      </div>
      <div>
        <div className="section-label">Method</div>
        <p>{method}</p>
      </div>
      <div>
        <div className="section-label">Current evidence</div>
        <p>{evidence}</p>
      </div>
    </div>
  )
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
  const h3Pilot = (trust?.response_count ?? 0) > 0
  const h4Delta = trust?.transparency_trust_delta
  const h4PilotPositive = typeof h4Delta === 'number' && h4Delta > 0

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div className="pill-row" style={{ alignItems: 'center', marginBottom: 10 }}>
            <span className="badge badge-blue">Thesis Defense Mode</span>
            <span className="eyebrow">Controlled simulation + pilot trust study</span>
          </div>
          <h1 className="page-title">Evaluating autonomy, process reliability, and trust in agentic AI.</h1>
          <div className="page-subtitle">
            A committee-facing walkthrough that maps the proposal hypotheses to live dashboard evidence.
          </div>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="card card-pad" style={{ color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
            Loading thesis evidence...
          </div>
        ) : null}

        <section className="story-grid" style={{ marginBottom: 20 }}>
          <div className="card card-pad">
            <div className="section-label">Recommended thesis framing</div>
            <h2 className="page-title">Controlled simulation first, live LLM second.</h2>
            <p className="page-subtitle">
              The strongest defense narrative is reproducible: vary autonomy, inject or observe process deviations,
              hold outcomes comparable, and show what outcome-only metrics miss. Live LLM mode can be presented as an extension,
              not the core validity claim.
            </p>
          </div>

          <div className="card card-pad">
            <div className="section-label">Research question</div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              How can a regulated financial institution measure the relationship between agent autonomy,
              process-level reliability, transparency, and stakeholder trust when correct outputs can still hide unsafe workflows?
            </p>
          </div>
        </section>

        <section className="metric-grid" style={{ marginBottom: 20 }}>
          <MetricTile label="Total runs" value={String(summary?.total_runs ?? 0)} sub="Current evidence base" />
          <MetricTile
            label="Process error rate"
            value={pct(summary?.process_error_rate)}
            sub={`${summary?.process_errors ?? 0} runs flagged`}
            tone={(summary?.process_error_rate ?? 0) > 0 ? 'danger' : 'pass'}
          />
          <MetricTile
            label="Outcome error rate"
            value={pct(summary?.outcome_error_rate)}
            sub="Traditional metric baseline"
          />
          <MetricTile
            label="Trust responses"
            value={String(trust?.response_count ?? 0)}
            sub="Pilot H3/H4 sample"
            tone={(trust?.response_count ?? 0) > 0 ? 'pass' : 'warn'}
          />
        </section>

        <section className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="section-label">Hypothesis evaluation matrix</div>
          <div className="evidence-matrix">
            <EvidenceCard
              id="H1"
              title="Outcome metrics mask process risk"
              claim="A final verdict can be correct even when required compliance steps were skipped."
              method="Compare outcome correctness against clause coverage, trajectory score, and tool audit trace."
              evidence={h1 ? `Gap mean ${pct(h1.gap_score_mean)}, p=${h1.p_value.toFixed(4)}, ${h1.runs_with_gap}/${h1.total_runs} runs with hidden gap.` : 'No registry summary loaded yet.'}
              status={h1?.significant_at_0_05 ? 'supported' : summary ? 'partial' : 'missing'}
            />
            <EvidenceCard
              id="H2"
              title="Autonomy increases hidden errors"
              claim="Higher autonomy should increase process-level deviations even when outcomes remain similar."
              method="Run the same PDF-derived scenarios at L1/L2/L3 and compare process error rate and clause coverage."
              evidence={h2 ? `L1 ${pct(h2.level_1_error_rate)}, L2 ${pct(h2.level_2_error_rate)}, L3 ${pct(h2.level_3_error_rate)}; Spearman ${h2.spearman_correlation.toFixed(3)}.` : 'No H2 evidence loaded yet.'}
              status={h2?.significant_at_0_05 ? 'supported' : summary ? 'partial' : 'missing'}
            />
            <EvidenceCard
              id="H3"
              title="Traditional metrics do not explain trust"
              claim="Accuracy alone should be weaker than transparency and auditability scores for explaining stakeholder trust."
              method="Pilot survey across stakeholder groups, recording trust, auditability, reliability, and explanation sufficiency."
              evidence={h3Pilot ? `${trust?.response_count} trust responses collected across ${Object.keys(trust?.by_stakeholder_group ?? {}).length} stakeholder groups.` : 'Pilot trust responses not collected yet.'}
              status={h3Pilot ? 'pilot' : 'missing'}
            />
            <EvidenceCard
              id="H4"
              title="Transparency drives trust"
              claim="Trust should improve when stakeholders see audit trails and registry evidence, holding outcome performance constant."
              method="Compare outcome-only versus transparent conditions for the same run and stakeholder task."
              evidence={h4Delta != null ? `Transparent condition trust delta: ${h4Delta.toFixed(2)} on a 1-7 scale.` : 'No paired transparency-condition evidence yet.'}
              status={h4PilotPositive ? 'pilot' : h3Pilot ? 'partial' : 'missing'}
            />
          </div>
        </section>

        <section className="story-grid" style={{ marginBottom: 20 }}>
          <div className="card card-pad">
            <div className="section-label">Agent workflow logic</div>
            <div className="timeline-list">
              <div className="timeline-step"><div><strong>Extract financial metrics</strong><span>Parse PDF-derived EBITDA, debt, interest, liquidity, and adjustment inputs.</span></div></div>
              <div className="timeline-step"><div><strong>Identify covenants</strong><span>Load borrower-specific covenant thresholds and policy terms.</span></div></div>
              <div className="timeline-step"><div><strong>Check adjustments</strong><span>Critical H1 step: missing it can create a legally invalid process.</span></div></div>
              <div className="timeline-step"><div><strong>Check grace period</strong><span>Determines whether a breach is immediate or curable.</span></div></div>
              <div className="timeline-step"><div><strong>Calculate risk</strong><span>Converts adjusted financials into breach/imminent/no-breach verdict.</span></div></div>
              <div className="timeline-step"><div><strong>Generate report</strong><span>Persists final verdict, trace, audit log, and thesis metrics.</span></div></div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-label">Defense demo sequence</div>
            <div className="timeline-list">
              <div className="timeline-step"><div><strong>Open Dashboard</strong><span>State the problem: accuracy can hide unsafe agent behavior.</span></div></div>
              <div className="timeline-step"><div><strong>Run L1</strong><span>Show compliant baseline: full coverage and traceable workflow.</span></div></div>
              <div className="timeline-step"><div><strong>Run L3</strong><span>Show higher autonomy causing skipped checks or lower coverage.</span></div></div>
              <div className="timeline-step"><div><strong>Open Run Detail</strong><span>Point to exact missing tool, audit event, and H1/H2 evidence.</span></div></div>
              <div className="timeline-step"><div><strong>Open Trust Study</strong><span>Submit pilot outcome-only and transparent responses for H3/H4.</span></div></div>
              <div className="timeline-step"><div><strong>Return here</strong><span>Use the matrix to summarize evidence strength and limitations.</span></div></div>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <div className="section-label">Defense caveat to say clearly</div>
          <div className="status-callout" style={{ borderLeftColor: 'var(--warn)' }}>
            <strong>Do not overclaim full live autonomy.</strong>
            <span>
              The academically strongest claim is that this prototype provides a controlled, reproducible evaluation artifact.
              It can optionally run LLM-backed agents, but the primary validation isolates process-risk mechanisms in a sandbox.
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}
