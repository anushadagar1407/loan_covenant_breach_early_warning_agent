"""
metrics/statistical_analysis.py
================================
Statistical validation for thesis hypotheses.
"""

import numpy as np
from scipy import stats
from typing import List, Dict, Tuple


def bootstrap_confidence_interval(data: List[float], statistic_fn=np.mean, n_bootstrap: int = 10000, confidence_level: float = 0.95) -> Tuple[float, float, float]:
    """Compute bootstrap confidence interval."""
    bootstrap_stats = []
    n = len(data)
    for _ in range(n_bootstrap):
        sample = np.random.choice(data, size=n, replace=True)
        bootstrap_stats.append(statistic_fn(sample))
    alpha = 1 - confidence_level
    lower = np.percentile(bootstrap_stats, 100 * alpha / 2)
    upper = np.percentile(bootstrap_stats, 100 * (1 - alpha / 2))
    point_estimate = statistic_fn(data)
    return point_estimate, lower, upper


def validate_h1_gap_score(runs: List) -> Dict:
    """H1: Outcome metrics mask process risk."""
    process_errors = np.array([1 if r.process_error_detected else 0 for r in runs])
    outcome_errors = np.array([0 if r.outcome_correct else 1 for r in runs])
    gap_scores = process_errors - outcome_errors

    t_stat, p_value = stats.ttest_1samp(gap_scores, 0, alternative='greater')
    mean_gap, ci_low, ci_high = bootstrap_confidence_interval(gap_scores)
    cohens_d = np.mean(gap_scores) / np.std(gap_scores) if np.std(gap_scores) > 0 else 0
    positive_gap_count = np.sum(gap_scores > 0)

    return {
        "hypothesis": "H1: Outcome metrics mask process risk",
        "gap_score_mean": float(mean_gap),
        "gap_score_std": float(np.std(gap_scores)),
        "confidence_interval_95": (float(ci_low), float(ci_high)),
        "t_statistic": float(t_stat),
        "p_value": float(p_value),
        "significant_at_0_05": p_value < 0.05,
        "significant_at_0_01": p_value < 0.01,
        "cohens_d": float(cohens_d),
        "effect_size_interpretation": interpret_effect_size(cohens_d),
        "runs_with_gap": int(positive_gap_count),
        "total_runs": len(runs),
        "percentage_with_gap": float(positive_gap_count / len(runs) * 100),
        "conclusion": "H1 SUPPORTED" if p_value < 0.05 and mean_gap > 0 else "H1 NOT SUPPORTED"
    }


def validate_h2_autonomy_errors(runs: List) -> Dict:
    """H2: Higher autonomy increases process errors."""
    levels = [1, 2, 3]
    error_rates = []
    coverage_scores = []

    for level in levels:
        level_runs = [r for r in runs if r.autonomy_level == level]
        if len(level_runs) == 0:
            continue
        errors = [1 if r.process_error_detected else 0 for r in level_runs]
        coverage = [r.clause_coverage_score for r in level_runs]
        error_rates.append(np.mean(errors))
        coverage_scores.append(np.mean(coverage))

    contingency = []
    for level in levels:
        level_runs = [r for r in runs if r.autonomy_level == level]
        if len(level_runs) == 0:
            continue
        errors = sum(1 if r.process_error_detected else 0 for r in level_runs)
        no_errors = len(level_runs) - errors
        contingency.append([errors, no_errors])

    if len(contingency) >= 2:
        chi2, p_value, dof, expected = stats.chi2_contingency(contingency)
    else:
        chi2, p_value = 0, 1.0

    autonomy_values = [r.autonomy_level for r in runs]
    error_values = [1 if r.process_error_detected else 0 for r in runs]

    if len(set(autonomy_values)) > 1:
        correlation, corr_p_value = stats.spearmanr(autonomy_values, error_values)
    else:
        correlation, corr_p_value = 0, 1.0

    groups = [[1 if r.process_error_detected else 0 for r in runs if r.autonomy_level == level] for level in levels]
    groups = [g for g in groups if len(g) > 0]

    if len(groups) >= 2:
        h_stat, kruskal_p = stats.kruskal(*groups)
    else:
        h_stat, kruskal_p = 0, 1.0

    return {
        "hypothesis": "H2: Autonomy increases process errors",
        "level_1_error_rate": float(error_rates[0]) if len(error_rates) > 0 else None,
        "level_2_error_rate": float(error_rates[1]) if len(error_rates) > 1 else None,
        "level_3_error_rate": float(error_rates[2]) if len(error_rates) > 2 else None,
        "level_1_coverage": float(coverage_scores[0]) if len(coverage_scores) > 0 else None,
        "level_2_coverage": float(coverage_scores[1]) if len(coverage_scores) > 1 else None,
        "level_3_coverage": float(coverage_scores[2]) if len(coverage_scores) > 2 else None,
        "chi_square_statistic": float(chi2),
        "chi_square_p_value": float(p_value),
        "spearman_correlation": float(correlation),
        "correlation_p_value": float(corr_p_value),
        "kruskal_wallis_h": float(h_stat),
        "kruskal_wallis_p": float(kruskal_p),
        "trend_direction": "increasing" if correlation > 0 else "decreasing",
        "significant_at_0_05": p_value < 0.05,
        "conclusion": "H2 SUPPORTED" if p_value < 0.05 and correlation > 0 else "H2 WEAK/NOT SUPPORTED"
    }


def compute_classification_metrics(runs: List) -> Dict:
    """Compute Precision, Recall, F1."""
    y_true = []
    y_pred = []

    for r in runs:
        true_positive = r.correct_verdict in ['breach', 'breach_curable', 'imminent']
        y_true.append(1 if true_positive else 0)
        pred_positive = r.final_verdict in ['breach', 'breach_curable', 'imminent']
        y_pred.append(1 if pred_positive else 0)

    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    accuracy = (tp + tn) / len(y_true) if len(y_true) > 0 else 0

    return {
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "accuracy": float(accuracy),
        "support_positive": tp + fn,
        "support_negative": tn + fp
    }


def compare_approaches(agent_runs: List, baseline_runs: List, baseline_name: str) -> Dict:
    """Statistical comparison between agent and baseline."""
    agent_accuracy = [1 if r.outcome_correct else 0 for r in agent_runs]
    baseline_accuracy = [1 if r.outcome_correct else 0 for r in baseline_runs]

    if len(agent_accuracy) == len(baseline_accuracy):
        t_stat, p_value = stats.ttest_rel(agent_accuracy, baseline_accuracy)
    else:
        t_stat, p_value = stats.ttest_ind(agent_accuracy, baseline_accuracy)

    agent_coverage = [r.clause_coverage_score for r in agent_runs]
    baseline_coverage = [r.clause_coverage_score for r in baseline_runs]
    coverage_diff = np.mean(agent_coverage) - np.mean(baseline_coverage)

    agent_gap = np.mean([1 if r.process_error_detected else 0 for r in agent_runs])
    baseline_gap = np.mean([1 if getattr(r, 'process_error_detected', False) else 0 for r in baseline_runs])

    return {
        "comparison": f"Agent vs {baseline_name}",
        "agent_accuracy_mean": float(np.mean(agent_accuracy)),
        "baseline_accuracy_mean": float(np.mean(baseline_accuracy)),
        "accuracy_difference": float(np.mean(agent_accuracy) - np.mean(baseline_accuracy)),
        "agent_coverage_mean": float(np.mean(agent_coverage)),
        "baseline_coverage_mean": float(np.mean(baseline_coverage)),
        "coverage_difference": float(coverage_diff),
        "agent_gap_score": float(agent_gap),
        "baseline_gap_score": float(baseline_gap),
        "t_statistic": float(t_stat),
        "p_value": float(p_value),
        "significant_difference": p_value < 0.05,
        "winner": "Agent" if np.mean(agent_accuracy) > np.mean(baseline_accuracy) else baseline_name
    }


def interpret_effect_size(cohens_d: float) -> str:
    """Interpret Cohen's d effect size."""
    abs_d = abs(cohens_d)
    if abs_d < 0.2:
        return "negligible"
    elif abs_d < 0.5:
        return "small"
    elif abs_d < 0.8:
        return "medium"
    else:
        return "large"


def power_analysis(effect_size: float, alpha: float = 0.05, power: float = 0.8) -> Dict:
    """Estimate required sample size."""
    from scipy.stats import norm
    z_alpha = norm.ppf(1 - alpha)
    z_beta = norm.ppf(power)
    n = ((z_alpha + z_beta) / effect_size) ** 2

    return {
        "effect_size": effect_size,
        "alpha": alpha,
        "desired_power": power,
        "required_sample_size": int(np.ceil(n)),
        "recommendation": f"Need at least {int(np.ceil(n))} runs"
    }
