'use client'

import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { RegistrySummary } from '../../lib/types'

function MetricDefinition({ id, name, formula, hypothesis, description }: {
  id: string
  name: string
  formula: string
  hypothesis: string
  description: string
}) {
  return (
    <div style={{
      borderLeft: '3px solid var(--accent)',
      paddingLeft: 16,
      marginBottom: 20,
      minWidth: 0,
    }}>
      <div className="pill-row" style={{ alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent-strong)', fontWeight: 600 }}>{id}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
        <span className="badge badge-blue">{hypothesis}</span>
      </div>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--text-muted)',
        marginBottom: 8,
        background: 'var(--surface-3)',
        padding: '7px 10px',
        borderRadius: 4,
        overflowWrap: 'anywhere',
      }}>
        {formula}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{description}</div>
    </div>
  )
}

function AutonomyRow({ level, data }: { level: number; data: any }) {
  if (!data?.count) return null
  const labels = { 1: 'Constrained - explicit workflow', 2: 'Moderate - guided judgment', 3: 'High - minimal instruction' }
  const colors = { 1: 'var(--pass)', 2: 'var(--warn)', 3: 'var(--danger)' }
  const c = colors[level as 1|2|3]

  return (
    <tr>
      <td>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: c, fontWeight: 600 }}>L{level}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 10 }}>{labels[level as 1|2|3]}</span>
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center' }}>{data.count}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(101,113,135,0.25)', borderRadius: 999 }}>
            <div style={{ width: `${Math.round((data.avg_clause_coverage ?? 0) * 100)}%`, height: '100%', background: c, borderRadius: 999 }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: c, minWidth: 36 }}>
            {Math.round((data.avg_clause_coverage ?? 0) * 100)}%
          </span>
        </div>
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>
        {Math.round((data.process_error_rate ?? 0) * 100)}%
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--pass)', textAlign: 'center' }}>
        {Math.round((data.outcome_error_rate ?? 0) * 100)}%
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--warn)', textAlign: 'center' }}>
        +{Math.round(((data.process_error_rate ?? 0) - (data.outcome_error_rate ?? 0)) * 100)}%
      </td>
    </tr>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="metric-card">
      <div className="section-label">{label}</div>
      <div className="metric-card-value" style={{ color }}>{value}</div>
      {sub && <div className="metric-card-subtitle">{sub}</div>}
    </div>
  )
}

export default function RegistryPage() {
  const [summary, setSummary] = useState<RegistrySummary | null>(null)
  const [h1Data, setH1Data] = useState<any>(null)
  const [h2Data, setH2Data] = useState<any>(null)

  useEffect(() => {
    api.getRegistrySummary().then(setSummary).catch(() => {})
    api.getH1Evidence().then(setH1Data).catch(() => {})
    api.getH2Evidence().then(setH2Data).catch(() => {})
  }, [])

  const gapScore = summary?.gap_score ?? 0
  const h1Count = summary?.h1_evidence?.count ?? 0
  const total = summary?.total_runs ?? 0

  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div className="pill-row" style={{ alignItems: 'center', marginBottom: 10 }}>
            <div className="badge badge-blue">Agent Registry</div>
            <div className="eyebrow">Centralized transparency</div>
          </div>
          <h1 className="page-title">Covenant Intelligence Registry</h1>
          <div className="page-subtitle">
            Process-level auditability for deployed AI agents, thesis metrics, and H4-ready instrumentation.
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="metric-grid" style={{ marginBottom: 24 }}>
          <SummaryCard label="Total Agent Runs" value={String(total)} color="var(--text-primary)" />
          <SummaryCard
            label="Gap Score (H1)"
            value={`+${Math.round(gapScore * 100)}%`}
            color={gapScore > 0 ? 'var(--warn)' : 'var(--pass)'}
            sub="Process error minus outcome error"
          />
          <SummaryCard
            label="H1 Evidence Runs"
            value={String(h1Count)}
            color={h1Count > 0 ? 'var(--danger)' : 'var(--pass)'}
            sub="Correct outcome with process error"
          />
          <SummaryCard
            label="Compliance Rate"
            value={`${Math.round((summary?.compliance_rate ?? 0) * 100)}%`}
            color={(summary?.compliance_rate ?? 0) >= 0.9 ? 'var(--pass)' : 'var(--warn)'}
            sub="Clause coverage equals 100%"
          />
        </div>

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          {summary?.evidence_quality && (
            <div
              className="status-callout"
              style={{ marginBottom: 18, borderLeftColor: summary.evidence_quality.minimum_runs_met ? 'var(--pass)' : 'var(--warn)' }}
            >
              <strong>Evidence quality: {summary.evidence_quality.minimum_runs_met ? 'evaluation threshold met' : 'exploratory cohort'}</strong>
              <span>
                Ground-truth fallback runs: {summary.evidence_quality.ground_truth_fallback_runs}.
                ADK-attempted runs: {summary.evidence_quality.adk_invocation_attempted_runs ?? 0}.
                H3/H4 require stakeholder trust responses.
              </span>
            </div>
          )}
          <div className="section-label" style={{ marginBottom: 20 }}>
            The five thesis metrics - process-level evaluation framework
          </div>
          <MetricDefinition
            id="M1"
            name="Trajectory Accuracy Score"
            formula="tools called in correct order / total expected tools"
            hypothesis="H1 + H2"
            description="Measures whether the agent followed the expected six-step workflow in sequence. A bank cannot defend an automated decision if the process was non-compliant."
          />
          <MetricDefinition
            id="M2"
            name="Tool Call Accuracy Score"
            formula="mean accuracy_score per tool call"
            hypothesis="H1"
            description="Checks whether tools were called with valid, non-fabricated arguments and returned meaningful results."
          />
          <MetricDefinition
            id="M3"
            name="Clause Coverage Score"
            formula="required clauses checked / total required clauses"
            hypothesis="H1 + H4"
            description="The key H1 metric. It exposes whether legally required covenant checks were skipped even when the final verdict appears correct."
          />
          <MetricDefinition
            id="M4"
            name="Step Latency Profile"
            formula="milliseconds per tool call"
            hypothesis="H2"
            description="Shows the efficiency versus compliance tradeoff. Faster autonomous runs are not necessarily safer runs."
          />
          <MetricDefinition
            id="M5"
            name="Process vs Outcome Error Gap"
            formula="Gap Score = Process Error Rate - Outcome Error Rate"
            hypothesis="H1 + H3"
            description="The thesis centerpiece: outcome-only metrics can underreport true failure risk."
          />
        </div>

        <div className="card table-card" style={{ marginBottom: 20 }}>
          <div className="card-pad" style={{ paddingBottom: 10 }}>
            <div className="section-label">H1 evidence - correct outcome, hidden process error</div>
            {h1Data?.h1_run_count > 0 && (
              <div className="status-callout" style={{ marginTop: 12, borderLeftColor: 'var(--danger)' }}>
                <strong>Hidden process error detected</strong>
                <span>{h1Data.interpretation}</span>
              </div>
            )}
          </div>
          {h1Data?.h1_run_count > 0 ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Run ID</th>
                    <th>Scenario</th>
                    <th>Borrower</th>
                    <th>Level</th>
                    <th>Clause Coverage</th>
                    <th>Outcome</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(h1Data?.runs ?? []).map((r: any) => (
                    <tr key={r.run_id}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>{r.run_id.slice(0, 8)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{r.scenario_id}</td>
                      <td className="truncate-cell" style={{ fontSize: 12 }}>{r.borrower_name}</td>
                      <td><span className={`badge ${r.autonomy_level === 1 ? 'badge-pass' : r.autonomy_level === 2 ? 'badge-warn' : 'badge-danger'}`}>L{r.autonomy_level}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)' }}>
                        {Math.round((r.clause_coverage_score ?? 0) * 100)}%
                      </td>
                      <td><span className="badge badge-pass">CORRECT</span></td>
                      <td><a href={`/runs/${r.run_id}`} style={{ fontSize: 11, color: 'var(--accent-strong)', textDecoration: 'none', fontFamily: 'var(--mono)' }}>VIEW</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--mono)', padding: '12px 20px 24px', textAlign: 'center' }}>
              No hidden-gap runs have been recorded yet. Run balanced L1, L2, and L3 scenarios before interpreting H1.
            </div>
          )}
        </div>

        <div className="card table-card">
          <div className="card-pad" style={{ paddingBottom: 10 }}>
            <div className="section-label">H2 evidence - process errors by autonomy level</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {h2Data?.interpretation}
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Autonomy Level</th>
                  <th>Runs</th>
                  <th>Avg Clause Coverage</th>
                  <th>Process Error Rate</th>
                  <th>Outcome Error Rate</th>
                  <th>Gap Score</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(level => (
                  <AutonomyRow
                    key={level}
                    level={level}
                    data={h2Data?.by_autonomy_level?.[String(level)] ?? summary?.runs_by_autonomy_level?.[String(level)]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
