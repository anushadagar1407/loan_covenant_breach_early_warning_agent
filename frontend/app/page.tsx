/**
 * frontend/app/page.tsx
 * ======================
 * UPDATED Dashboard with statistical validation
 */

"use client";

import { useEffect, useState } from "react";
import { RegistrySummary } from "@/lib/types";

export default function Dashboard() {
  const [summary, setSummary] = useState<RegistrySummary | null>(null);
  const [ruleBasedComparison, setRuleBasedComparison] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // Use the same base URL as lib/api.ts
      const BASE: string = process.env.NEXT_PUBLIC_API_BASE_URL || "";

      try {
        // 1) Summary
        const summaryRes = await fetch(`${BASE}/api/registry/summary`, {
          cache: "no-store",
        });
        if (!summaryRes.ok) {
          throw new Error(`Summary API error ${summaryRes.status}`);
        }
        const summaryData = await summaryRes.json();
        setSummary(summaryData);

        // 2) Baseline comparison (rule-based baseline)
        try {
          const baselineRes = await fetch(
            `${BASE}/api/registry/baselines/compare?baseline_type=rule_based`,
            { cache: "no-store" }
          );
          if (baselineRes.ok) {
            const baselineData = await baselineRes.json();
            setRuleBasedComparison(baselineData);
          } else {
            console.log("Baseline comparison not available yet");
          }
        } catch (e) {
          console.log("Baseline comparison not available yet");
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data", error);
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!summary) return <div className="p-8">No data available</div>;

  const h1 = summary.h1_validation;
  const h2 = summary.h2_validation;
  const cm = summary.classification_metrics;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      <div className="container mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">
            Deutsche Bank – Covenant Intelligence Platform
          </h1>
          <p className="text-gray-300">Agentic Evaluation Framework</p>
        </header>

        {/* Top Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="TOTAL RUNS"
            value={summary.total_runs}
            subtitle="all time"
            color="blue"
          />
          <MetricCard
            title="PROCESS ERROR"
            value={`${(summary.process_error_rate * 100).toFixed(0)}%`}
            subtitle={`${summary.process_errors} runs`}
            color="red"
          />
          <MetricCard
            title="GAP SCORE"
            value={
              h1.significant_at_0_05
                ? `+${(h1.gap_score_mean * 100).toFixed(1)}%`
                : "N/S"
            }
            subtitle={`p=${h1.p_value.toFixed(4)}`}
            color={h1.significant_at_0_05 ? "green" : "yellow"}
          />
          <MetricCard
            title="COVERAGE"
            value={`${(summary.avg_clause_coverage_score * 100).toFixed(0)}%`}
            subtitle={`${summary.fully_compliant_runs} compliant`}
            color="blue"
          />
        </div>

        {/* H1 Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">
            H1: GAP SCORE VALIDATION
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2 text-sm">
              <StatRow
                label="Gap Score"
                value={`${(h1.gap_score_mean * 100).toFixed(2)}%`}
              />
              <StatRow
                label="95% CI"
                value={`[${(h1.confidence_interval_95[0] * 100).toFixed(
                  1
                )}%, ${(h1.confidence_interval_95[1] * 100).toFixed(1)}%]`}
              />
              <StatRow
                label="P-Value"
                value={h1.p_value.toFixed(6)}
                highlight={h1.p_value < 0.05}
              />
              <StatRow
                label="Cohen's d"
                value={`${h1.cohens_d.toFixed(3)} (${
                  h1.effect_size_interpretation
                })`}
              />
            </div>
            <div className="bg-gray-900 p-4 rounded">
              <p className="font-bold text-lg mb-2">{h1.conclusion}</p>
              <p className="text-sm">
                {h1.significant_at_0_05 ? "✓ H1 SUPPORTED" : "✗ H1 NOT SUPPORTED"}
              </p>
            </div>
          </div>
        </div>

        {/* H2 Panel */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">H2: AUTONOMY VS ERRORS</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              {h2.level_1_error_rate && (
                <LevelBar level="L1" errorRate={h2.level_1_error_rate} />
              )}
              {h2.level_2_error_rate && (
                <LevelBar level="L2" errorRate={h2.level_2_error_rate} />
              )}
              {h2.level_3_error_rate && (
                <LevelBar level="L3" errorRate={h2.level_3_error_rate} />
              )}
            </div>
            <div>
              <div className="space-y-2 text-sm mb-4">
                <StatRow
                  label="Chi-Square p"
                  value={h2.chi_square_p_value.toFixed(6)}
                  highlight={h2.chi_square_p_value < 0.05}
                />
                <StatRow
                  label="Correlation"
                  value={`${h2.spearman_correlation.toFixed(3)} (${
                    h2.trend_direction
                  })`}
                />
              </div>
              <div className="bg-gray-900 p-4 rounded">
                <p className="font-bold">{h2.conclusion}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Classification Metrics */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">
            BREACH DETECTION METRICS
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-900 p-4 rounded text-center">
                <div className="text-3xl font-bold">{cm.true_positives}</div>
                <div className="text-xs">TP</div>
              </div>
              <div className="bg-red-900 p-4 rounded text-center">
                <div className="text-3xl font-bold">{cm.false_positives}</div>
                <div className="text-xs">FP</div>
              </div>
              <div className="bg-red-900 p-4 rounded text-center">
                <div className="text-3xl font-bold">{cm.false_negatives}</div>
                <div className="text-xs">FN</div>
              </div>
              <div className="bg-green-900 p-4 rounded text-center">
                <div className="text-3xl font-bold">{cm.true_negatives}</div>
                <div className="text-xs">TN</div>
              </div>
            </div>
            <div className="space-y-3">
              <MetricBar label="Precision" value={cm.precision} />
              <MetricBar label="Recall" value={cm.recall} />
              <MetricBar label="F1 Score" value={cm.f1_score} />
              <MetricBar label="Accuracy" value={cm.accuracy} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, color }: any) {
  const colors: any = {
    blue: "from-blue-600 to-blue-800",
    red: "from-red-600 to-red-800",
    green: "from-green-600 to-green-800",
    yellow: "from-yellow-600 to-yellow-800",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-lg p-6`}>
      <div className="text-xs uppercase mb-2">{title}</div>
      <div className="text-4xl font-bold mb-1">{value}</div>
      <div className="text-xs opacity-70">{subtitle}</div>
    </div>
  );
}

function StatRow({ label, value, highlight }: any) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}:</span>
      <span className={highlight ? "text-green-400 font-bold" : ""}>
        {value}
      </span>
    </div>
  );
}

function LevelBar({ level, errorRate }: any) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{level}</span>
        <span>{(errorRate * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-3">
        <div
          className="bg-red-500 h-3 rounded-full"
          style={{ width: `${errorRate * 100}%` }}
        />
      </div>
    </div>
  );
}

function MetricBar({ label, value }: any) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-bold">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}