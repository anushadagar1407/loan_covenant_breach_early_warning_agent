'use client'

import { ArrowRight } from 'lucide-react'
import type { RegistrySummary } from '../../lib/types'

export const registryConcepts = [
  {
    title: 'Loan covenant',
    body: 'A contractual financial rule in a loan agreement, such as maximum debt-to-EBITDA or minimum liquidity.',
  },
  {
    title: 'Covenant breach',
    body: 'A case where the borrower violates one of those rules and the lender may need notice, cure, or escalation.',
  },
  {
    title: 'Agent run',
    body: 'One execution of the covenant workflow against a specific borrower report and autonomy condition.',
  },
  {
    title: 'Agent verdict',
    body: 'The result returned by the run: no breach, imminent risk, breach, or curable breach.',
  },
  {
    title: 'Scenario ground truth',
    body: 'The expected answer used after the run to evaluate whether the agent verdict matched the controlled scenario.',
  },
  {
    title: 'Process evidence',
    body: 'The tool sequence, audit trail, clause checks, and coverage metrics that explain how the result was produced.',
  },
  {
    title: 'Hidden process gap',
    body: 'The thesis signal: a correct verdict can still be risky if required compliance steps were skipped.',
  },
]

export const metricDefinitions = [
  {
    id: 'M1',
    name: 'Trajectory Accuracy Score',
    formula: 'tools called in correct order / total expected tools',
    hypothesis: 'H1 + H2',
    description: 'Measures whether the agent followed the expected six-step workflow in sequence. A bank cannot defend an automated decision if the process was non-compliant.',
  },
  {
    id: 'M2',
    name: 'Tool Call Accuracy Score',
    formula: 'mean accuracy_score per tool call',
    hypothesis: 'H1',
    description: 'Checks whether tools were called with valid, non-fabricated arguments and returned meaningful results.',
  },
  {
    id: 'M3',
    name: 'Clause Coverage Score',
    formula: 'required clauses checked / total required clauses',
    hypothesis: 'H1 + H4',
    description: 'The key H1 metric. It exposes whether legally required covenant checks were skipped even when the final verdict appears correct.',
  },
  {
    id: 'M4',
    name: 'Step Latency Profile',
    formula: 'milliseconds per tool call',
    hypothesis: 'H2',
    description: 'Shows the efficiency versus compliance tradeoff. Faster autonomous runs are not necessarily safer runs.',
  },
  {
    id: 'M5',
    name: 'Process vs Outcome Error Gap',
    formula: 'Gap Score = Process Error Rate - Outcome Error Rate',
    hypothesis: 'H1 + H3',
    description: 'The thesis centerpiece: outcome-only metrics can underreport true failure risk.',
  },
]

export type RegistryTabId = 'concepts' | 'metrics' | 'evidence'

const registryTabs: Array<{ id: RegistryTabId; label: string }> = [
  { id: 'concepts', label: 'Concepts' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'evidence', label: 'Evidence' },
]

export function RegistryHeader({ title, subtitle, badge = 'Evidence registry' }: {
  title: string
  subtitle: string
  badge?: string
}) {
  return (
    <div className="page-header">
      <div className="page-header-inner">
        <div className="pill-row" style={{ alignItems: 'center', marginBottom: 10 }}>
          <div className="badge badge-blue">{badge}</div>
          <div className="eyebrow">Concepts, metrics, and process evidence</div>
        </div>
        <h1 className="page-title">{title}</h1>
        <div className="page-subtitle">{subtitle}</div>
      </div>
    </div>
  )
}

export function RegistrySubnav({
  activeTab,
  onTabChange,
}: {
  activeTab: RegistryTabId
  onTabChange: (tab: RegistryTabId) => void
}) {
  return (
    <div className="subpage-tabs" role="tablist" aria-label="Registry sections">
      {registryTabs.map(tab => {
        const active = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`subpage-tab ${active ? 'subpage-tab-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function ConceptTile({ title, body, index }: { title: string; body: string; index: number }) {
  return (
    <div className="concept-tile">
      <span>{String(index).padStart(2, '0')}</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

export function RouteCard({
  eyebrow,
  title,
  body,
  href,
  onClick,
}: {
  eyebrow: string
  title: string
  body: string
  href?: string
  onClick?: () => void
}) {
  const content = (
    <>
      <span>{eyebrow}</span>
      <strong>
        {title}
        <ArrowRight size={14} strokeWidth={2.2} aria-hidden="true" />
      </strong>
      <p>{body}</p>
    </>
  )

  if (href) {
    return (
      <a className="route-card" href={href}>
        {content}
      </a>
    )
  }

  return (
    <button type="button" className="route-card route-card-button" onClick={onClick}>
      {content}
    </button>
  )
}

export function MetricDefinition({ id, name, formula, hypothesis, description }: {
  id: string
  name: string
  formula: string
  hypothesis: string
  description: string
}) {
  return (
    <div className="metric-definition">
      <div className="pill-row" style={{ alignItems: 'center', marginBottom: 8 }}>
        <span className="metric-definition-id">{id}</span>
        <span className="metric-definition-name">{name}</span>
        <span className="badge badge-blue">{hypothesis}</span>
      </div>
      <div className="metric-definition-formula">{formula}</div>
      <div className="metric-definition-body">{description}</div>
    </div>
  )
}

export function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="metric-card">
      <div className="section-label">{label}</div>
      <div className="metric-card-value" style={{ color }}>{value}</div>
      {sub && <div className="metric-card-subtitle">{sub}</div>}
    </div>
  )
}

export function RegistrySummaryCards({ summary }: { summary: RegistrySummary | null }) {
  const gapScore = summary?.gap_score ?? 0
  const h1Count = summary?.h1_evidence?.count ?? 0
  const total = summary?.total_runs ?? 0
  return (
    <div className="metric-grid" style={{ marginBottom: 20 }}>
      <SummaryCard label="Stored agent runs" value={String(total)} color="var(--text-primary)" />
      <SummaryCard
        label="Process-outcome gap"
        value={`+${Math.round(gapScore * 100)}%`}
        color={gapScore > 0 ? 'var(--warn)' : 'var(--pass)'}
        sub="Process error minus outcome error"
      />
      <SummaryCard
        label="Hidden-gap runs"
        value={String(h1Count)}
        color={h1Count > 0 ? 'var(--danger)' : 'var(--pass)'}
        sub="Correct verdict with process error"
      />
      <SummaryCard
        label="Compliance rate"
        value={`${Math.round((summary?.compliance_rate ?? 0) * 100)}%`}
        color={(summary?.compliance_rate ?? 0) >= 0.9 ? 'var(--pass)' : 'var(--warn)'}
        sub="Clause coverage equals 100%"
      />
    </div>
  )
}

export function RegistrySectionNav({
  summary,
  activeTab,
  onTabChange,
}: {
  summary: RegistrySummary | null
  activeTab: RegistryTabId
  onTabChange: (tab: RegistryTabId) => void
}) {
  return (
    <div className="registry-section-nav">
      <RegistrySummaryCards summary={summary} />
      <RegistrySubnav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  )
}

export function AutonomyRow({ level, data }: { level: number; data: any }) {
  if (!data?.count) return null
  const labels = { 1: 'Constrained - explicit workflow', 2: 'Guided - bounded judgment', 3: 'Autonomous - open sequence' }
  const colors = { 1: 'var(--pass)', 2: 'var(--warn)', 3: 'var(--danger)' }
  const c = colors[level as 1 | 2 | 3]

  return (
    <tr>
      <td>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: c, fontWeight: 600 }}>L{level}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 10 }}>{labels[level as 1 | 2 | 3]}</span>
      </td>
      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'center' }}>{data.count}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
          <div style={{ flex: 1, height: 6, background: 'var(--bar-track)', borderRadius: 999 }}>
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
