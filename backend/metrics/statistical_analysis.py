"""
metrics/statistical_analysis.py
================================
Statistical validation for thesis hypotheses.
"""

from typing import List, Dict, Tuple

import numpy as np
from scipy import stats


def _finite(value: float, default: float = 0.0) -> float:
    return float(value) if np.isfinite(value) else default


def bootstrap_confidence_interval(data: List[float], statistic_fn=np.mean, n_bootstrap: int = 2000, confidence_level: float = 0.95) -> Tuple[float, float, float]:
    """Compute bootstrap confidence interval."""
    if len(data) == 0:
        return 0.0, 0.0, 0.0
    if len(data) == 1:
        point = float(statistic_fn(data))
        return point, point, point

    rng = np.random.default_rng(1407)
    bootstrap_stats = []
    n = len(data)
    for _ in range(n_bootstrap):
        sample = rng.choice(data, size=n, replace=True)
        bootstrap_stats.append(statistic_fn(sample))
    alpha = 1 - confidence_level
    lower = np.percentile(bootstrap_stats, 100 * alpha / 2)
    upper = np.percentile(bootstrap_stats, 100 * (1 - alpha / 2))
    point_estimate = statistic_fn(data)
    return point_estimate, lower, upper


def validate_h1_gap_score(runs: List) -> Dict:
    """H1: Outcome metrics mask process risk."""
    if not runs:
        return _empty_h1("H1 not evaluated - no completed runs are available.")

    process_errors = np.array([1 if r.process_error_detected else 0 for r in runs])
    outcome_errors = np.array([0 if r.outcome_correct else 1 for r in runs])
    gap_scores = process_errors - outcome_errors

    mean_gap = float(np.mean(gap_scores))
    if len(gap_scores) < 2:
        t_stat, p_value = 0.0, 1.0
    elif np.std(gap_scores) == 0:
        t_stat = 0.0
        p_value = 0.0 if mean_gap > 0 else 1.0
    else:
        t_stat, p_value = stats.ttest_1samp(gap_scores, 0, alternative='greater')

    mean_gap, ci_low, ci_high = bootstrap_confidence_interval(gap_scores)
    cohens_d = np.mean(gap_scores) / np.std(gap_scores) if np.std(gap_scores) > 0 else 0
    positive_gap_count = np.sum(gap_scores > 0)
    significant = p_value < 0.05 and mean_gap > 0

    return {
        "hypothesis": "H1: Outcome metrics mask process risk",
        "gap_score_mean": _finite(mean_gap),
        "gap_score_std": _finite(np.std(gap_scores)),
        "confidence_interval_95": (_finite(ci_low), _finite(ci_high)),
        "t_statistic": _finite(t_stat),
        "p_value": _finite(p_value, 1.0),
        "significant_at_0_05": significant,
        "significant_at_0_01": p_value < 0.01 and mean_gap > 0,
        "cohens_d": _finite(cohens_d),
        "effect_size_interpretation": interpret_effect_size(cohens_d),
        "runs_with_gap": int(positive_gap_count),
        "total_runs": len(runs),
        "percentage_with_gap": float(positive_gap_count / len(runs) * 100),
        "conclusion": (
            "H1 supported in the current completed-run cohort"
            if significant
            else "H1 inconclusive in the current completed-run cohort"
        ),
    }


def _empty_h1(conclusion: str) -> Dict:
    return {
        "hypothesis": "H1: Outcome metrics mask process risk",
        "gap_score_mean": 0.0,
        "gap_score_std": 0.0,
        "confidence_interval_95": (0.0, 0.0),
        "t_statistic": 0.0,
        "p_value": 1.0,
        "significant_at_0_05": False,
        "significant_at_0_01": False,
        "cohens_d": 0.0,
        "effect_size_interpretation": "not_evaluated",
        "runs_with_gap": 0,
        "total_runs": 0,
        "percentage_with_gap": 0.0,
        "conclusion": conclusion,
    }


def _empty_h2(conclusion: str) -> Dict:
    return {
        "hypothesis": "H2: Autonomy increases process errors",
        "level_1_error_rate": None,
        "level_2_error_rate": None,
        "level_3_error_rate": None,
        "level_1_coverage": None,
        "level_2_coverage": None,
        "level_3_coverage": None,
        "chi_square_statistic": 0.0,
        "chi_square_p_value": 1.0,
        "spearman_correlation": 0.0,
        "correlation_p_value": 1.0,
        "kruskal_wallis_h": 0.0,
        "kruskal_wallis_p": 1.0,
        "trend_direction": "not_evaluated",
        "significant_at_0_05": False,
        "conclusion": conclusion,
    }

def validate_h2_autonomy_errors(runs: List) -> Dict:
    """H2: Higher autonomy increases process errors."""
    if not runs:
        return _empty_h2("H2 not evaluated - no completed runs are available.")

    levels = [1, 2, 3]
    error_rates = []
    coverage_scores = []

    for level in levels:
        level_runs = [r for r in runs if r.autonomy_level == level]
        if len(level_runs) == 0:
            continue

        errors = [1 if r.process_error_detected else 0 for r in level_runs]
        # Normalize None -> 0.0 so numpy.mean does not break
        coverage = [(r.clause_coverage_score or 0.0) for r in level_runs]

        error_rates.append(float(np.mean(errors)))
        coverage_scores.append(float(np.mean(coverage)))

    contingency = []
    for level in levels:
        level_runs = [r for r in runs if r.autonomy_level == level]
        if len(level_runs) == 0:
            continue
        errors = sum(1 if r.process_error_detected else 0 for r in level_runs)
        no_errors = len(level_runs) - errors
        contingency.append([errors, no_errors])

    if len(contingency) >= 2 and len({tuple(row) for row in contingency}) > 1:
        chi2, p_value, dof, expected = stats.chi2_contingency(contingency)
    else:
        chi2, p_value = 0, 1.0

    autonomy_values = [r.autonomy_level for r in runs]
    error_values = [1 if r.process_error_detected else 0 for r in runs]

    if len(set(autonomy_values)) > 1 and len(set(error_values)) > 1:
        correlation, corr_p_value = stats.spearmanr(autonomy_values, error_values)
    else:
        correlation, corr_p_value = 0, 1.0

    groups = [[1 if r.process_error_detected else 0 for r in runs if r.autonomy_level == level] for level in levels]
    groups = [g for g in groups if len(g) > 0]

    if len(groups) >= 2 and any(len(set(g)) > 1 for g in groups):
        h_stat, kruskal_p = stats.kruskal(*groups)
    else:
        h_stat, kruskal_p = 0, 1.0
    correlation = _finite(correlation)
    corr_p_value = _finite(corr_p_value, 1.0)
    significant = p_value < 0.05 and correlation > 0

    return {
        "hypothesis": "H2: Autonomy increases process errors",
        "level_1_error_rate": float(error_rates[0]) if len(error_rates) > 0 else None,
        "level_2_error_rate": float(error_rates[1]) if len(error_rates) > 1 else None,
        "level_3_error_rate": float(error_rates[2]) if len(error_rates) > 2 else None,
        "level_1_coverage": float(coverage_scores[0]) if len(coverage_scores) > 0 else None,
        "level_2_coverage": float(coverage_scores[1]) if len(coverage_scores) > 1 else None,
        "level_3_coverage": float(coverage_scores[2]) if len(coverage_scores) > 2 else None,
        "chi_square_statistic": _finite(chi2),
        "chi_square_p_value": _finite(p_value, 1.0),
        "spearman_correlation": correlation,
        "correlation_p_value": corr_p_value,
        "kruskal_wallis_h": _finite(h_stat),
        "kruskal_wallis_p": _finite(kruskal_p, 1.0),
        "trend_direction": "increasing" if correlation > 0 else "flat_or_decreasing",
        "significant_at_0_05": significant,
        "conclusion": (
            "H2 supported in the current completed-run cohort"
            if significant
            else "H2 inconclusive in the current completed-run cohort"
        ),
    }
    
def compute_classification_metrics(runs: List) -> Dict:
    """Compute Precision, Recall, F1."""
    y_true = []
    y_pred = []

    for r in runs:
        if r.correct_verdict is None or r.final_verdict is None:
            continue
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
