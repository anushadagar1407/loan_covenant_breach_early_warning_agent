'use client'

import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { RegistrySummary } from '../../lib/types'

function MetricDefinition({ id, name, formula, hypothesis, description }: {
  id: string; name: string; formula: string; hypothesis: string; description: string
}) {
  return (
    <div style={{
      borderLeft: '3px solid #003882',
      paddingLeft: 16,
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#003882', fontWeight: 600 }}>{id}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#F9FAFB' }}>{name}</span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, background: 'rgba(0,56,130,0.2)',
          color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)',
          padding: '2px 8px', borderRadius: 3,
        }}>{hypothesis}</span>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#6B7280', marginBottom: 6, background: '#0A0E1A', padding: '4px 10px', borderRadius: 3 }}>
        {formula}
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.6 }}>{description}</div>
    </div>
  )
}

function AutonomyRow({ level, data }: { level: number; data: any }) {
  if (!data?.count) return null
  const labels = { 1: 'Constrained — explicit step-by-step', 2: 'Moderate — hints + judgment', 3: 'High — minimal instruction' }
  const colors = { 1: '#10B981', 2: '#F59E0B', 3: '#EF4444' }
  const c = colors[level as 1|2|3]

  return (
    <tr>
      <td>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: c, fontWeight: 600 }}>L{level}</span>
        <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 10 }}>{labels[level as 1|2|3]}</span>
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center' }}>{data.count}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, background: '#1F2937', borderRadius: 3 }}>
            <div style={{ width: `${Math.round((data.avg_clause_coverage ?? 0) * 100)}%`, height: '100%', background: c, borderRadius: 3 }} />
          </div>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: c, minWidth: 36 }}>
            {Math.round((data.avg_clause_coverage ?? 0) * 100)}%
          </span>
        </div>
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#EF4444', textAlign: 'center' }}>
        {Math.round((data.process_error_rate ?? 0) * 100)}%
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#10B981', textAlign: 'center' }}>
        {Math.round((data.outcome_error_rate ?? 0) * 100)}%
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#F59E0B', textAlign: 'center' }}>
        +{Math.round(((data.process_error_rate ?? 0) - (data.outcome_error_rate ?? 0)) * 100)}%
      </td>
    </tr>
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
          <div style={{
            background: '#003882', color: 'white', fontSize: 10,
            fontFamily: 'var(--mono)', padding: '3px 8px', borderRadius: 2,
            letterSpacing: '0.08em',
          }}>AGENT REGISTRY</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#4B5563' }}>v1.0 — CENTRALIZED TRANSPARENCY</div>
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 500 }}>
          Deutsche Bank — Covenant Intelligence Platform
        </h1>
        <div style={{ fontSize: 13, color: '#6B7280' }}>
          Centralized process-level transparency and auditability for deployed AI agents · Supports H4
        </div>
      </div>

      <div className="page-content">

        {/* Summary metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Total Agent Runs', value: String(total), color: '#F9FAFB' },
            { label: 'Gap Score (H1)', value: `+${Math.round(gapScore * 100)}%`, color: gapScore > 0 ? '#F59E0B' : '#10B981',
              sub: 'Process − Outcome error rate' },
            { label: 'H1 Evidence Runs', value: String(h1Count),
              color: h1Count > 0 ? '#EF4444' : '#10B981',
              sub: `Correct outcome + process error` },
            { label: 'Compliance Rate', value: `${Math.round((summary?.compliance_rate ?? 0) * 100)}%`,
              color: (summary?.compliance_rate ?? 0) >= 0.9 ? '#10B981' : '#F59E0B',
              sub: 'Clause coverage = 100%' },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="card">
              <div className="section-label">{label}</div>
              <div className="metric-number" style={{ fontSize: 32, color }}>{value}</div>
              {sub && <div style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* 5 Metrics Framework */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 20 }}>
            The 5 Thesis Metrics — Process-Level Evaluation Framework
          </div>
          <MetricDefinition
            id="M1"
            name="Trajectory Accuracy Score"
            formula="(tools called in correct order) / (total expected tools) × 100"
            hypothesis="H1 + H2"
            description="Measures whether the agent followed the expected 6-step workflow in sequence. An agent that skips steps or calls tools out of order is unreliable in a regulated environment — a bank cannot defend an automated decision in court if the process was non-compliant."
          />
          <MetricDefinition
            id="M2"
            name="Tool Call Accuracy Score"
            formula="mean(accuracy_score per tool call) — checks args validity, no hallucination, valid result"
            hypothesis="H1"
            description="Scores whether each tool was called with valid, non-fabricated arguments and returned a meaningful result. An agent may call the right tools but pass in hallucinated parameters — invisible to outcome-only evaluation."
          />
          <MetricDefinition
            id="M3"
            name="Clause Coverage Score"
            formula="(required clauses checked) / (total required clauses) × 100"
            hypothesis="H1 + H4"
            description="THE KEY H1 METRIC. Did the agent check all legally required clauses? If a borrower has accounting adjustments and the agent didn't check them, the outcome is wrong in ~30% of real cases. Even when it happens to be correct, the process was non-compliant."
          />
          <MetricDefinition
            id="M4"
            name="Step Latency Profile"
            formula="Milliseconds per tool call — recorded individually for each step"
            hypothesis="H2"
            description="Higher autonomy agents skip compliance steps and run faster. Latency is inversely correlated with clause coverage — surfacing a real enterprise tension: efficiency vs. compliance. In banking, compliance always wins."
          />
          <MetricDefinition
            id="M5"
            name="Process vs Outcome Error Rate Gap"
            formula="Gap Score = Process Error Rate − Outcome Error Rate (always ≥ 0 if H1 is true)"
            hypothesis="H1 + H3"
            description="THE THESIS CENTREPIECE. If Gap Score > 0, traditional metrics (outcome error rate) underreport the true failure rate. The gap is what's invisible to the bank — runs that appear correct but were produced through a non-compliant process."
          />
        </div>

        {/* H1 Evidence Table */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            H1 Evidence — Correct Outcome, Hidden Process Error
          </div>
          {h1Data?.h1_run_count > 0 ? (
            <>
              <div style={{
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 4, padding: '12px 16px', marginBottom: 16,
                fontSize: 13, color: '#FCA5A5',
              }}>
                {h1Data.interpretation}
              </div>
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
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#6B7280' }}>{r.run_id.slice(0, 8)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{r.scenario_id}</td>
                      <td style={{ fontSize: 12 }}>{r.borrower_name}</td>
                      <td><span className={`badge ${r.autonomy_level === 1 ? 'badge-pass' : r.autonomy_level === 2 ? 'badge-warn' : 'badge-danger'}`}>L{r.autonomy_level}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#EF4444' }}>
                        {Math.round((r.clause_coverage_score ?? 0) * 100)}%
                      </td>
                      <td><span className="badge badge-pass">✓ CORRECT</span></td>
                      <td><a href={`/runs/${r.run_id}`} style={{ fontSize: 11, color: '#3B82F6', textDecoration: 'none', fontFamily: 'var(--mono)' }}>VIEW →</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ color: '#4B5563', fontSize: 13, fontFamily: 'var(--mono)', padding: 20, textAlign: 'center' }}>
              No H1 evidence runs yet. Run SCEN-001 or SCEN-007 at Autonomy Level 3 to generate evidence.
            </div>
          )}
        </div>

        {/* H2 Evidence Table */}
        <div className="card">
          <div className="section-label" style={{ marginBottom: 12 }}>
            H2 Evidence — Process Errors Increase with Autonomy Level
          </div>
          <div style={{ marginBottom: 16, fontSize: 12, color: '#6B7280' }}>
            {h2Data?.interpretation}
          </div>
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
  )
}
