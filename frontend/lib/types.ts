/* UPDATED TypeScript types */

export interface H1Validation {
  hypothesis: string;
  gap_score_mean: number;
  gap_score_std: number;
  confidence_interval_95: [number, number];
  t_statistic: number;
  p_value: number;
  significant_at_0_05: boolean;
  significant_at_0_01: boolean;
  cohens_d: number;
  effect_size_interpretation: string;
  runs_with_gap: number;
  total_runs: number;
  percentage_with_gap: number;
  conclusion: string;
}

export interface H2Validation {
  hypothesis: string;
  level_1_error_rate?: number;
  level_2_error_rate?: number;
  level_3_error_rate?: number;
  chi_square_statistic: number;
  chi_square_p_value: number;
  spearman_correlation: number;
  correlation_p_value: number;
  trend_direction: string;
  significant_at_0_05: boolean;
  conclusion: string;
}

export interface ClassificationMetrics {
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1_score: number;
  accuracy: number;
}

export interface RegistrySummary {
  total_runs: number;
  gap_score: number;
  process_error_rate: number;
  outcome_error_rate: number;
  process_errors: number; 
  h1_validation: H1Validation;
  h2_validation: H2Validation;
  classification_metrics: ClassificationMetrics;
  avg_clause_coverage_score: number;
  avg_trajectory_score?: number;
  fully_compliant_runs: number;
  compliance_rate?: number;
  level_stats: any;
  runs_by_autonomy_level?: any;
  h1_evidence?: { count: number };
  evidence_quality?: {
    minimum_runs_met: boolean;
    ground_truth_fallback_runs: number;
    ground_truth_fallback_rate: number;
    transparency_artifact_rate: number;
    note: string;
  };
  h3_validation?: { status: string; message: string };
  h4_validation?: { status: string; message: string };
}

export interface Scenario {
  scenario_id: string;
  pdf_filename: string;
  pdf_path: string;
  borrower_id: string;
  borrower_name: string;
  quarter: string;
  year: number;
  expected_verdict: string;
  raw_financials: Record<string, any>;
  covenants: Record<string, any>;
  adjustments: Record<string, any>;
  grace_period_info: Record<string, any>;
  adjusted_financials: Record<string, any>;
  breach_result: Record<string, any>;
  report: Record<string, any>;
  input_summary: Record<string, any>;
  reasoning: string;
  data_source?: string;
  ground_truth_fallback_used?: boolean;
}

export interface AgentRun {
  id?: string;
  run_id: string;
  scenario_id: string;
  autonomy_level: number;
  status?: string;
  created_at?: string;                // ISO timestamp
  borrower_id?: string;
  borrower_name?: string;
  pdf_path?: string;
  started_at?: string;
  completed_at?: string | null;
  duration_seconds?: number | null;
  final_verdict?: string;
  correct_verdict?: string;
  outcome_correct?: boolean | null;
  trajectory_score?: number;
  tool_call_accuracy_score?: number;
  tool_accuracy_details?: any[];
  clause_coverage_score?: number;
  clause_coverage_details?: any;
  process_error_detected?: boolean;
  data_source?: string;
  ground_truth_fallback_used?: boolean;
  experiment_condition?: string;
  transparency_artifacts_present?: boolean;
  pdfScenario?: Scenario;
  scenario_inputs?: Record<string, any> | null;
}

export interface RunDetail extends AgentRun {
  steps: any[];                       // or a more detailed type if you prefer
  metrics: any;
  clauseCoverage?: number;
  trajectory?: any;
  verdict?: string;
  h1Evidence?: any[];
  h2Evidence?: any[];
  tool_call_events?: any[];
  audit_log_entries?: any[];
  status?: string;
  error_message?: string | null;
  final_verdict?: string;
  correct_verdict?: string;
  outcome_correct?: boolean | null;
  clause_coverage_score?: number;
  trajectory_score?: number;
  tool_call_accuracy_score?: number;
  process_error_detected?: boolean;
  duration_seconds?: number | null;
}

export interface TrustResponsePayload {
  run_id: string;
  stakeholder_group: 'technical' | 'non_technical' | 'risk_compliance' | 'business';
  transparency_condition: 'outcome_only' | 'transparent';
  trust_score: number;
  auditability_score?: number;
  reliability_score?: number;
  explanation_sufficiency_score?: number;
  comments?: string;
}

export interface TrustAnalysis {
  response_count: number;
  h3_status?: string;
  h4_status?: string;
  message?: string;
  transparency_trust_delta?: number | null;
  by_condition?: Record<string, { count: number; avg_trust_score: number | null }>;
  by_stakeholder_group?: Record<string, { count: number; avg_trust_score: number | null }>;
}
