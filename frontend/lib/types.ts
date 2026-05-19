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
  fully_compliant_runs: number;
  level_stats: any;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  autonomy_levels: number[];          // adjust if your backend differs
}

export interface AgentRun {
  id: string;
  scenario_id: string;
  autonomy_level: number;
  status: string;
  created_at: string;                 // ISO timestamp
}

export interface RunDetail extends AgentRun {
  steps: any[];                       // or a more detailed type if you prefer
  metrics: any;
}
