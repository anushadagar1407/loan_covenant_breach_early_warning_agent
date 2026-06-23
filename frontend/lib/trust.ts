import type { AgentRun, TrustAnalysis, TrustResponsePayload } from './types'

export type StakeholderGroup = TrustResponsePayload['stakeholder_group']
export type TransparencyCondition = TrustResponsePayload['transparency_condition']

export const stakeholderGroups: Array<{ value: StakeholderGroup; label: string }> = [
  { value: 'technical', label: 'Technical' },
  { value: 'non_technical', label: 'Non-technical' },
  { value: 'risk_compliance', label: 'Risk/compliance' },
  { value: 'business', label: 'Business' },
]

export const conditions: Array<{ value: TransparencyCondition; label: string; desc: string }> = [
  {
    value: 'outcome_only',
    label: 'Outcome only',
    desc: 'Reviewer sees only the agent output. Ground truth, verdict correctness, and aggregate results are hidden.',
  },
  {
    value: 'transparent',
    label: 'Transparent',
    desc: 'Reviewer sees the agent output plus process context. Ground truth and aggregate results are still hidden.',
  },
]

export const trustInstrumentBasis = [
  {
    label: 'Overall trust',
    measure: 'Trust in decision',
    source: 'Jian, Bisantz & Drury trust-in-automation scale; Korber TiA questionnaire',
    body: 'Captures whether the reviewer is willing to rely on the automated covenant assessment.',
    href: 'https://www.tandfonline.com/doi/abs/10.1207/S15327566IJCE0401_04',
  },
  {
    label: 'Reliability and competence',
    measure: 'Perceived reliability',
    source: 'Madsen & Gregor human-computer trust constructs; Korber TiA reliability dimension',
    body: 'Separates trust from raw accuracy by asking whether the system appears dependable in this decision context.',
    href: 'https://www.semanticscholar.org/paper/Measuring-Human-Computer-Trust-Madsen-Gregor/b8eda9593fbcb63b7ced1866853d9622737533a2',
  },
  {
    label: 'Auditability',
    measure: 'Auditability',
    source: 'XAI evaluation literature on traceability, mental models, and appropriate reliance',
    body: 'Tests whether the reviewer can inspect how the answer was produced, not just whether the answer was correct.',
    href: 'https://arxiv.org/abs/1812.04608',
  },
  {
    label: 'Explanation quality',
    measure: 'Explanation sufficiency',
    source: 'Hoffman, Mueller, Klein & Litman XAI metrics',
    body: 'Checks whether the explanation is enough for a reviewer to understand and challenge the agent output.',
    href: 'https://arxiv.org/abs/1812.04608',
  },
]

export function avg(value?: number | null) {
  return value == null ? '-' : value.toFixed(2)
}

export function pct(value?: number | null) {
  return value == null ? '-' : `${Math.round(value * 100)}%`
}

export function autonomyLabel(level?: number | null) {
  if (level === 1) return 'Constrained (L1)'
  if (level === 2) return 'Guided (L2)'
  if (level === 3) return 'Autonomous (L3)'
  return 'Unknown'
}

export function conditionLabel(condition?: TransparencyCondition | string | null) {
  return conditions.find(item => item.value === condition)?.label ?? 'Unknown'
}

export function evidenceSourceLabel(source?: TrustAnalysis['evidence_source']) {
  if (source === 'human') return 'Human stakeholder evidence'
  if (source === 'mixed') return 'Mixed human + synthetic pilot evidence'
  if (source === 'synthetic_demo') return 'Synthetic pilot evidence'
  return 'Trust evidence not collected'
}

export function verdictLabel(value?: string | null) {
  return value ? value.replace(/_/g, ' ') : 'No verdict yet'
}

export function matchLabel(run?: Pick<AgentRun, 'outcome_correct'> | null) {
  if (!run || run.outcome_correct == null) return 'Not evaluated'
  return run.outcome_correct ? 'Matches gold standard' : 'Does not match gold standard'
}
