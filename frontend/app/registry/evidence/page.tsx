'use client'

import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { RegistrySummary } from '../../../lib/types'
import {
  AutonomyRow,
  RegistryHeader,
  RegistrySectionNav,
} from '../components'

export default function RegistryEvidencePage() {
  const [summary, setSummary] = useState<RegistrySummary | null>(null)
  const [h1Data, setH1Data] = useState<any>(null)
  const [h2Data, setH2Data] = useState<any>(null)

  useEffect(() => {
    api.getRegistrySummary().then(setSummary).catch(() => {})
    api.getH1Evidence().then(setH1Data).catch(() => {})
    api.getH2Evidence().then(setH2Data).catch(() => {})
  }, [])

  const h1Count = summary?.h1_evidence?.count ?? 0

  return (
    <div>
      <RegistryHeader
        title="Registry evidence: hidden gaps and autonomy risk"
        subtitle="This page keeps the evidence tables separate from the concept and metric-definition pages, so H1 and H2 can be inspected directly."
      />

      <div className="page-content">
        <RegistrySectionNav summary={summary} />

        <section className="card table-card" style={{ marginBottom: 20 }}>
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
                    <th>Run</th>
                    <th>Scenario</th>
                    <th>Borrower</th>
                    <th>Autonomy</th>
                    <th>Clause Coverage</th>
                    <th>Outcome</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(h1Data?.runs ?? []).map((run: any) => (
                    <tr key={run.run_id}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>{run.run_id.slice(0, 8)}</td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{run.scenario_id}</td>
                      <td className="truncate-cell" style={{ fontSize: 12 }}>{run.borrower_name}</td>
                      <td>
                        <span className={`badge ${run.autonomy_level === 1 ? 'badge-pass' : run.autonomy_level === 2 ? 'badge-warn' : 'badge-danger'}`}>
                          {run.autonomy_level === 1 ? 'Constrained (L1)' : run.autonomy_level === 2 ? 'Guided (L2)' : 'Autonomous (L3)'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--danger)' }}>
                        {Math.round((run.clause_coverage_score ?? 0) * 100)}%
                      </td>
                      <td><span className="badge badge-pass">Correct verdict</span></td>
                      <td><a href={`/runs/${run.run_id}`} style={{ fontSize: 11, color: 'var(--accent-strong)', textDecoration: 'none', fontFamily: 'var(--mono)' }}>Open</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 20px 24px', textAlign: 'center' }}>
              No hidden-gap runs have been recorded yet. Run balanced constrained (L1), guided (L2), and autonomous (L3) scenarios before interpreting H1.
            </div>
          )}
        </section>

        <section className="card table-card">
          <div className="card-pad" style={{ paddingBottom: 10 }}>
            <div className="section-label">H2 evidence - process errors by autonomy level</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {h2Data?.interpretation ?? 'Run data will appear here once the registry has enough autonomy-level evidence.'}
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
        </section>

        <section className="card card-pad" style={{ marginTop: 20 }}>
          <div className="section-label">Evidence readout</div>
          <h2 className="page-title">What this registry can support right now</h2>
          <p className="page-subtitle">
            {h1Count > 0
              ? `${h1Count} run${h1Count === 1 ? '' : 's'} currently show a hidden process gap where the verdict matched but required process evidence was incomplete.`
              : 'No hidden process-gap run has been recorded yet.'}
            {' '}The evidence remains {summary?.evidence_quality?.minimum_runs_met ? 'ready for evaluation threshold discussion' : 'exploratory until the run cohort is larger and balanced'}.
          </p>
        </section>
      </div>
    </div>
  )
}
