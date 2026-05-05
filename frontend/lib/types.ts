export interface AgentRun {
  run_id: string
  scenario_id: string
  borrower_id: string
  borrower_name: string
  autonomy_level: 1 | 2 | 3
  pdf_path: string
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  final_verdict: 'no_breach' | 'imminent' | 'breach' | 'breach_curable' | 'unknown'
  correct_verdict: string | null
  outcome_correct: boolean | null
  trajectory_score: number | null
  tool_call_accuracy_score: number | null
  clause_coverage_score: number | null
  process_error_detected: boolean
  adjustment_clause_checked: boolean
  grace_period_clause_checked: boolean
  adjustment_changes_verdict: boolean
  status: 'running' | 'completed' | 'failed'
  error_message: string | null
}

export interface ToolCallEvent {
  tool_name: string
  call_order: number
  called_at: string | null
  completed_at: string | null
  latency_ms: number | null
  accuracy_score: number | null
  error: string | null
}

export interface AuditLogEntry {
  timestamp: string | null
  event_type: string
  message: string
}

export interface RunDetail extends AgentRun {
  tool_call_events: ToolCallEvent[]
  audit_log_entries: AuditLogEntry[]
}

export interface RegistrySummary {
  total_runs: number
  outcome_errors: number
  process_errors: number
  outcome_error_rate: number
  process_error_rate: number
  gap_score: number
  avg_trajectory_score: number
  avg_clause_coverage_score: number
  avg_tool_accuracy_score: number
  fully_compliant_runs: number
  compliance_rate: number
  runs_by_autonomy_level: {
    [key: string]: {
      count: number
      process_error_rate: number
      outcome_error_rate: number
      avg_clause_coverage: number
      avg_trajectory: number
    }
  }
  h1_evidence: {
    count: number
    percentage: number
    run_ids: string[]
    description: string
  }
}

export interface Scenario {
  scenario_id: string
  borrower_id: string
  pdf_filename: string
  correct_verdict: string
  adjustment_changes_verdict: boolean
  required_tool_sequence: string[]
  notes: string
}
