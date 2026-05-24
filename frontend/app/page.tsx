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
                {summary.evidence_quality?.minimum_runs_met
                  ? h1.significant_at_0_05
                    ? "H1 evidence detected"
                    : "H1 not supported in current data"
                  : "Exploratory: collect more runs"}
              </p>
              {summary.evidence_quality && (
                <p className="text-xs text-gray-400 mt-2">
                  Fallback runs: {summary.evidence_quality.ground_truth_fallback_runs}
                </p>
              )}
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
        <RunAgentButton />
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

// ============================================================================
// RUN AGENT — Floating button + modal that POSTs to /api/runs and polls /api/runs/{id}
// ============================================================================

function RunAgentButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-8 right-8 z-40 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-full shadow-2xl transition-all hover:scale-105 flex items-center gap-2"
        title="Trigger a new live agent run"
      >
        <span className="text-xl">▶</span>
        <span>Run Agent</span>
      </button>
      {open && <RunAgentModal onClose={() => setOpen(false)} />}
    </>
  );
}

type RunPhase = "form" | "running" | "done" | "error";

function RunAgentModal({ onClose }: { onClose: () => void }) {
  const BASE: string = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  const [scenarios, setScenarios] = useState<Array<any>>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [autonomyLevel, setAutonomyLevel] = useState<number>(3);
  const [phase, setPhase] = useState<RunPhase>("form");
  const [runId, setRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load scenarios when modal opens
  useEffect(() => {
    fetch(`${BASE}/api/scenarios`, { cache: "no-store" })
      .then(async r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`)
        return r.json()
      })
      .then(data => {
        const list = data.scenarios || [];
        setScenarios(list);
        if (list.length > 0) setScenarioId(list[0].scenario_id);
      })
      .catch(e => {
        console.error("Could not load scenarios", e);
        setError(`Could not load scenarios: ${e.message}`);
      });
  }, []);

  // Poll /api/runs/{run_id} until the row appears in the DB (= agent completed)
  useEffect(() => {
    if (phase !== "running" || !runId) return;
    let cancelled = false;
    let pollCount = 0;
    const MAX_POLLS = 150; // 5 min at 2s interval

    const poll = async () => {
      if (cancelled) return;
      pollCount++;
      if (pollCount > MAX_POLLS) {
        setError("Run timed out after 5 minutes. Check the backend terminal for errors.");
        setPhase("error");
        return;
      }
      try {
        const r = await fetch(`${BASE}/api/runs/${runId}`, { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          setRunDetail(data);
          if (data.status === "failed") {
            setError(data.error_message || "Run failed.");
            setPhase("error");
            return;
          }
          if (data.status === "running" || data.status === "started") {
            setTimeout(poll, 2000);
            return;
          }
          setPhase("done");
          return;
        }
        const body = await r.text();
        console.error("Run poll error", r.status, body);
        if (r.status >= 500) {
          setError(`Backend run detail failed (${r.status}). ${body}`);
          setPhase("error");
          return;
        }
      } catch (err) {
        console.error("Run poll network error", err);
      }
      setTimeout(poll, 2000);
    };

    const t = setTimeout(poll, 1500); // small initial delay
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [phase, runId]);

  const handleSubmit = async () => {
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId, autonomy_level: autonomyLevel }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Server returned ${r.status}: ${text}`);
      }
      const data = await r.json();
      setRunId(data.run_id);
      setPhase("running");
    } catch (e: any) {
      setError(e.message || "Failed to start run");
      setPhase("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-lg w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Run Live Agent</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* ---------- Form phase ---------- */}
        {phase === "form" && (
          <>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Scenario</label>
              <select
                value={scenarioId}
                onChange={e => setScenarioId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              >
                {scenarios.length === 0 && <option>Loading scenarios…</option>}
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id}>
                    {s.scenario_id} — {s.borrower_name} ({s.pdf_filename}, expects: {s.expected_verdict})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select a PDF-derived scenario. Inputs are parsed from the report, not hardcoded.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Autonomy Level</label>
              <div className="space-y-2">
                {[
                  { v: 1, label: "L1 — Constrained", desc: "Follows fixed 6-tool workflow strictly" },
                  { v: 2, label: "L2 — Moderate", desc: "May skip some optional compliance steps" },
                  { v: 3, label: "L3 — Autonomous", desc: "Chooses its own tool sequence" },
                ].map(opt => (
                  <label
                    key={opt.v}
                    className="flex items-start gap-3 cursor-pointer p-2 hover:bg-gray-800 rounded"
                  >
                    <input
                      type="radio"
                      name="autonomy"
                      checked={autonomyLevel === opt.v}
                      onChange={() => setAutonomyLevel(opt.v)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!scenarioId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-semibold text-sm"
              >
                Run Agent
              </button>
            </div>
          </>
        )}

        {/* ---------- Running phase ---------- */}
        {phase === "running" && (
          <div className="py-8 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="font-bold mb-2">Agent is running…</p>
            <p className="text-xs text-gray-500 font-mono mb-3">run_id: {runId?.slice(0, 8)}…</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              The workflow is processing the PDF and executing the tool chain. Results will appear here when ready.
            </p>
            <button
              onClick={onClose}
              className="mt-4 text-xs text-gray-500 hover:text-gray-300 underline"
            >
              Close modal (run continues in background)
            </button>
          </div>
        )}

        {/* ---------- Done phase ---------- */}
        {phase === "done" && runDetail && (
          <div className="py-4">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2 text-green-400">✓</div>
              <p className="font-bold">Run complete</p>
            </div>
            <div className="bg-gray-800 rounded p-3 space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Final verdict:</span>
                <span className="font-mono">{runDetail.final_verdict ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Expected:</span>
                <span className="font-mono text-gray-500">{runDetail.correct_verdict ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Outcome correct:</span>
                <span className={runDetail.outcome_correct ? "text-green-400" : "text-red-400"}>
                  {runDetail.outcome_correct === null ? "—" : runDetail.outcome_correct ? "✓ YES" : "✗ NO"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Clause coverage:</span>
                <span className="font-mono">{((runDetail.clause_coverage_score ?? 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Process error:</span>
                <span className={runDetail.process_error_detected ? "text-red-400 font-bold" : "text-green-400"}>
                  {runDetail.process_error_detected ? "⚠ DETECTED" : "CLEAN"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duration:</span>
                <span className="font-mono text-gray-500">
                  {runDetail.duration_seconds ? `${runDetail.duration_seconds.toFixed(1)}s` : "—"}
                </span>
              </div>
            </div>
            {runDetail.scenario_inputs && (
              <div className="bg-gray-800 rounded p-3 mb-4">
                <div className="section-label mb-2">Inputs Used</div>
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                  {JSON.stringify(runDetail.scenario_inputs, null, 2)}
                </pre>
              </div>
            )}
            {runDetail.pdfScenario?.input_summary && (
              <div className="bg-gray-800 rounded p-3 mb-4">
                <div className="section-label mb-2">PDF Inputs</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(runDetail.pdfScenario.input_summary).map(([k, v]) => (
                    <div key={k} className="bg-gray-900 rounded p-2">
                      <div className="text-gray-500 uppercase">{k.replace(/_/g, " ")}</div>
                      <div className="font-mono mt-1">{typeof v === "object" ? JSON.stringify(v) : String(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {runDetail.tool_accuracy_details?.length ? (
              <div className="bg-gray-800 rounded p-3 mb-4">
                <div className="section-label mb-2">Tool Scores</div>
                <div className="space-y-2">
                  {runDetail.tool_accuracy_details.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="font-mono">{item.tool_name}</span>
                      <span>{(item.accuracy_score * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Close
              </button>
              <a
                href={`/runs/${runId}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold text-sm"
              >
                View full run →
              </a>
            </div>
          </div>
        )}

        {/* ---------- Error phase ---------- */}
        {phase === "error" && (
          <div className="py-6 text-center">
            <div className="text-5xl mb-2 text-red-400">⚠</div>
            <p className="font-bold mb-2">Something went wrong</p>
            <p className="text-sm text-red-400 mb-4 max-w-md mx-auto break-words">{error}</p>
            <div className="flex justify-center gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                Close
              </button>
              <button
                onClick={() => { setPhase("form"); setError(null); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
