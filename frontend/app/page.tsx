"use client";

import { useEffect, useState } from "react";
import type { RegistrySummary, RunDetail, Scenario } from "@/lib/types";

type RunPhase = "form" | "running" | "done" | "error";

const BASE: string = process.env.NEXT_PUBLIC_API_BASE_URL || "";

const autonomyOptions = [
  { v: 1, label: "L1 - Constrained", desc: "Fixed six-tool workflow with explicit compliance order." },
  { v: 2, label: "L2 - Moderate", desc: "Guided workflow with limited judgment over optional steps." },
  { v: 3, label: "L3 - Autonomous", desc: "Agent chooses its own sequence under the same audit guardrails." },
];

export default function Dashboard() {
  const [summary, setSummary] = useState<RegistrySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const summaryRes = await fetch(`${BASE}/api/registry/summary`, {
          cache: "no-store",
        });
        if (!summaryRes.ok) {
          throw new Error(`Summary API error ${summaryRes.status}`);
        }
        setSummary(await summaryRes.json());
      } catch (err: any) {
        console.error("Error fetching dashboard data", err);
        setError(err?.message || "Unable to load dashboard data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="page-content">
        <div className="card card-pad" style={{ color: "var(--text-muted)", fontFamily: "var(--mono)", fontSize: 12 }}>
          Loading dashboard metrics...
        </div>
      </div>
    );
  }

  const hasSummary = Boolean(summary);

  const h1 = summary?.h1_validation;
  const h2 = summary?.h2_validation;
  const cm = summary?.classification_metrics;
  const evidenceLabel = summary?.evidence_quality?.minimum_runs_met
    ? "Sample threshold met"
    : "Exploratory sample";

  return (
    <div className="dashboard-page">
      <div className="page-content">
        <section className="dashboard-hero" aria-labelledby="dashboard-title">
          <div>
            <div className="eyebrow">Covenant Intelligence Platform</div>
            <h1 id="dashboard-title">Process-aware breach detection for defensible agent evaluation.</h1>
            <p>
              A thesis demo dashboard for comparing outcome accuracy against process reliability,
              clause coverage, and autonomy-driven risk.
            </p>
          </div>
          <div className="dashboard-hero-actions">
            <a href="/runs" className="button button-secondary">View runs</a>
            <button
              type="button"
              onClick={() => setRunModalOpen(true)}
              className="button button-primary"
            >
              Run Agent
            </button>
          </div>
        </section>

        {!hasSummary && (
          <div className="status-callout" style={{ marginTop: 18, borderLeftColor: "var(--danger)" }}>
            <strong style={{ color: "var(--danger)" }}>Dashboard metrics unavailable</strong>
            <span>{error || "The backend registry summary did not return data. The launcher remains available for troubleshooting runs."}</span>
          </div>
        )}

        {summary && h1 && (
          <section className="metric-grid" style={{ marginTop: 18 }} aria-label="Top dashboard metrics">
            <MetricCard
              title="Total Runs"
              value={summary.total_runs}
              subtitle={evidenceLabel}
              tone="neutral"
            />
            <MetricCard
              title="Process Error Rate"
              value={`${(summary.process_error_rate * 100).toFixed(0)}%`}
              subtitle={`${summary.process_errors} process failures`}
              tone="danger"
            />
            <MetricCard
              title="Gap Score"
              value={h1.significant_at_0_05 ? `+${(h1.gap_score_mean * 100).toFixed(1)}%` : "N/S"}
              subtitle={`p=${h1.p_value.toFixed(4)}`}
              tone={h1.significant_at_0_05 ? "warn" : "neutral"}
            />
            <MetricCard
              title="Clause Coverage"
              value={`${(summary.avg_clause_coverage_score * 100).toFixed(0)}%`}
              subtitle={`${summary.fully_compliant_runs} fully compliant`}
              tone="pass"
            />
          </section>
        )}

        {summary?.evidence_quality && (
          <div
            className="status-callout"
            style={{ marginTop: 18, borderLeftColor: summary.evidence_quality.minimum_runs_met ? "var(--pass)" : "var(--warn)" }}
          >
            <strong>Evidence quality: {evidenceLabel}</strong>
            <span>
              Ground-truth fallback runs: {summary.evidence_quality.ground_truth_fallback_runs}. H3/H4 trust signals remain separate from process metrics.
            </span>
          </div>
        )}

        <div className="dashboard-main-grid">
          <div className="panel-stack">
            {summary && h1 && cm ? (
              <>
              <section className="card card-pad" aria-labelledby="h1-title">
              <div className="section-label">H1 validation</div>
              <div className="split-grid">
                <div>
                  <h2 id="h1-title" className="page-title">Outcome metrics can hide process failures</h2>
                  <p className="page-subtitle">
                    The gap score shows whether apparently correct decisions still came from an incomplete workflow.
                  </p>
                  <div className="stat-list" style={{ marginTop: 18 }}>
                    <StatRow label="Gap score" value={`${(h1.gap_score_mean * 100).toFixed(2)}%`} />
                    <StatRow
                      label="95% confidence interval"
                      value={`[${(h1.confidence_interval_95[0] * 100).toFixed(1)}%, ${(h1.confidence_interval_95[1] * 100).toFixed(1)}%]`}
                    />
                    <StatRow label="P-value" value={h1.p_value.toFixed(6)} highlight={h1.p_value < 0.05} />
                    <StatRow label="Cohen's d" value={`${h1.cohens_d.toFixed(3)} (${h1.effect_size_interpretation})`} />
                  </div>
                </div>
                <div className="status-callout" style={{ borderLeftColor: h1.significant_at_0_05 ? "var(--pass)" : "var(--warn)" }}>
                  <strong>{h1.conclusion}</strong>
                  <span>
                    {summary.evidence_quality?.minimum_runs_met
                      ? h1.significant_at_0_05
                        ? "H1 signal is present in the current registry."
                        : "H1 is not supported by the current sample."
                      : "Use this as exploratory evidence until more runs are collected."}
                  </span>
                </div>
              </div>
              </section>

              <section className="card card-pad" aria-labelledby="classification-title">
              <div className="section-label">Breach detection metrics</div>
              <div className="split-grid">
                <div>
                  <h2 id="classification-title" className="page-title">Classification quality</h2>
                  <p className="page-subtitle">
                    Outcome performance is useful, but the thesis depends on showing why it is incomplete.
                  </p>
                  <div className="confusion-grid" style={{ marginTop: 16 }}>
                    <ConfusionCell label="True positives" value={cm.true_positives} tone="pass" />
                    <ConfusionCell label="False positives" value={cm.false_positives} tone="danger" />
                    <ConfusionCell label="False negatives" value={cm.false_negatives} tone="danger" />
                    <ConfusionCell label="True negatives" value={cm.true_negatives} tone="pass" />
                  </div>
                </div>
                <div className="bar-list">
                  <MetricBar label="Precision" value={cm.precision} color="var(--pass)" />
                  <MetricBar label="Recall" value={cm.recall} color="var(--accent-strong)" />
                  <MetricBar label="F1 score" value={cm.f1_score} color="var(--accent-strong)" />
                  <MetricBar label="Accuracy" value={cm.accuracy} color="var(--pass)" />
                </div>
              </div>
              </section>
              </>
            ) : (
              <section className="card card-pad">
                <div className="section-label">Metrics panel</div>
                <h2 className="page-title">Waiting for registry data</h2>
                <p className="page-subtitle">
                  Start the backend API or inspect its logs, then refresh this page. The layout remains stable while the data layer recovers.
                </p>
              </section>
            )}
          </div>

          <aside className="panel-stack" aria-label="Autonomy and demo workflow">
            {h2 && (
              <section className="card card-pad" aria-labelledby="h2-title">
              <div className="section-label">H2 validation</div>
              <h2 id="h2-title" className="page-title">Autonomy vs. process errors</h2>
              <p className="page-subtitle">
                A defense-ready demo should make the autonomy tradeoff visible without overloading the screen.
              </p>
              <div className="level-bars" style={{ marginTop: 18 }}>
                {h2.level_1_error_rate !== undefined && <LevelBar level="L1" errorRate={h2.level_1_error_rate} />}
                {h2.level_2_error_rate !== undefined && <LevelBar level="L2" errorRate={h2.level_2_error_rate} />}
                {h2.level_3_error_rate !== undefined && <LevelBar level="L3" errorRate={h2.level_3_error_rate} />}
              </div>
              <div className="stat-list" style={{ marginTop: 18 }}>
                <StatRow label="Chi-square p" value={h2.chi_square_p_value.toFixed(6)} highlight={h2.chi_square_p_value < 0.05} />
                <StatRow label="Spearman correlation" value={`${h2.spearman_correlation.toFixed(3)} (${h2.trend_direction})`} />
              </div>
              <div className="status-callout" style={{ marginTop: 16, borderLeftColor: "var(--accent)" }}>
                <strong>{h2.conclusion}</strong>
                <span>Use L1/L2/L3 runs in sequence during the live demo to show the process-risk gradient.</span>
              </div>
              </section>
            )}

            <section className="card card-pad" aria-labelledby="demo-title">
              <div className="section-label">Live workflow</div>
              <h2 id="demo-title" className="page-title">Run a controlled scenario</h2>
              <p className="page-subtitle">
                The launcher now keeps setup, progress, and results inside a viewport-safe modal with fixed actions.
              </p>
              <button
                type="button"
                onClick={() => setRunModalOpen(true)}
                className="button button-primary"
                style={{ width: "100%", marginTop: 18 }}
              >
                Run Agent
              </button>
            </section>
          </aside>
        </div>
      </div>

      {runModalOpen && <RunAgentModal onClose={() => setRunModalOpen(false)} />}
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  tone: "neutral" | "pass" | "warn" | "danger";
}) {
  const color = {
    neutral: "var(--text-primary)",
    pass: "var(--pass)",
    warn: "var(--warn)",
    danger: "var(--danger)",
  }[tone];

  return (
    <div className="metric-card">
      <div className="section-label">{title}</div>
      <div className="metric-card-value" style={{ color }}>{value}</div>
      <div className="metric-card-subtitle">{subtitle}</div>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <strong style={{ color: highlight ? "var(--pass)" : undefined }}>{value}</strong>
    </div>
  );
}

function LevelBar({ level, errorRate }: { level: string; errorRate: number }) {
  return (
    <div className="bar-row">
      <div className="bar-row-header">
        <span>{level} process error rate</span>
        <strong className="metric-number">{(errorRate * 100).toFixed(1)}%</strong>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{
            width: `${Math.min(100, Math.max(0, errorRate * 100))}%`,
            background: "var(--danger)",
          }}
        />
      </div>
    </div>
  );
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bar-row">
      <div className="bar-row-header">
        <span>{label}</span>
        <strong className="metric-number">{(value * 100).toFixed(1)}%</strong>
      </div>
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{
            width: `${Math.min(100, Math.max(0, value * 100))}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function ConfusionCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pass" | "danger";
}) {
  return (
    <div className="confusion-cell">
      <strong style={{ color: tone === "pass" ? "var(--pass)" : "var(--danger)" }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function RunAgentModal({ onClose }: { onClose: () => void }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [autonomyLevel, setAutonomyLevel] = useState<number>(1);
  const [phase, setPhase] = useState<RunPhase>("form");
  const [runId, setRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/scenarios`, { cache: "no-store" })
      .then(async r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
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

  useEffect(() => {
    if (phase !== "running" || !runId) return;
    let cancelled = false;
    let pollCount = 0;
    const maxPolls = 150;

    const poll = async () => {
      if (cancelled) return;
      pollCount += 1;
      if (pollCount > maxPolls) {
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

    const timer = setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
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

  const footer = (
    <>
      {phase === "form" && (
        <>
          <button type="button" onClick={onClose} className="button button-ghost">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!scenarioId}
            className="button button-primary"
          >
            Run Agent
          </button>
        </>
      )}
      {phase === "running" && (
        <button type="button" onClick={onClose} className="button button-secondary">
          Close, keep running
        </button>
      )}
      {phase === "done" && runDetail && (
        <>
          <button type="button" onClick={onClose} className="button button-ghost">Close</button>
          <a href={`/runs/${runId}`} className="button button-primary">View full run</a>
        </>
      )}
      {phase === "error" && (
        <>
          <button type="button" onClick={onClose} className="button button-ghost">Close</button>
          <button
            type="button"
            onClick={() => {
              setPhase("form");
              setError(null);
            }}
            className="button button-primary"
          >
            Try again
          </button>
        </>
      )}
    </>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-agent-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="run-agent-title" className="modal-title">Run live agent</h2>
            <p className="modal-description">Select a PDF-derived scenario and autonomy level.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="button button-ghost"
            aria-label="Close"
            style={{ minHeight: 32, padding: "4px 10px" }}
          >
            X
          </button>
        </header>

        <div className="modal-body">
          {phase === "form" && (
            <div className="form-grid">
              <div>
                <label className="form-label" htmlFor="scenario-select">Scenario</label>
                <select
                  id="scenario-select"
                  value={scenarioId}
                  onChange={e => setScenarioId(e.target.value)}
                  className="form-control"
                >
                  {scenarios.length === 0 && <option>Loading scenarios...</option>}
                  {scenarios.map(s => (
                    <option key={s.scenario_id} value={s.scenario_id}>
                      {s.scenario_id} - {s.borrower_name} ({s.expected_verdict})
                    </option>
                  ))}
                </select>
                <p className="form-help">
                  Inputs are parsed from the report catalog, then recorded with provenance in the run trace.
                </p>
              </div>

              <div>
                <div className="form-label">Autonomy level</div>
                <div className="option-grid">
                  {autonomyOptions.map(opt => (
                    <label key={opt.v} className="option-card">
                      <input
                        type="radio"
                        name="autonomy"
                        checked={autonomyLevel === opt.v}
                        onChange={() => setAutonomyLevel(opt.v)}
                      />
                      <span>
                        <strong>{opt.label}</strong>
                        <span>{opt.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {error && <ErrorMessage>{error}</ErrorMessage>}
            </div>
          )}

          {phase === "running" && (
            <div style={{ textAlign: "center", padding: "34px 0" }}>
              <div className="metric-number" style={{ color: "var(--accent-strong)", fontSize: 14, marginBottom: 12 }}>
                RUNNING
              </div>
              <div
                aria-hidden="true"
                style={{
                  width: 44,
                  height: 44,
                  margin: "0 auto 16px",
                  borderRadius: "50%",
                  border: "3px solid rgba(94,160,255,0.22)",
                  borderTopColor: "var(--accent-strong)",
                  animation: "spin 1s linear infinite",
                }}
              />
              <p style={{ margin: 0, color: "var(--text-primary)", fontWeight: 600 }}>Agent workflow in progress</p>
              <p style={{ margin: "8px auto 0", maxWidth: 480, color: "var(--text-muted)", fontSize: 13 }}>
                Run ID: <span className="metric-number">{runId?.slice(0, 8)}</span>. The modal can close safely while the backend continues processing.
              </p>
            </div>
          )}

          {phase === "done" && runDetail && <RunResult runDetail={runDetail} />}

          {phase === "error" && (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <div className="metric-number" style={{ color: "var(--danger)", fontSize: 14, marginBottom: 8 }}>
                RUN FAILED
              </div>
              <p style={{ margin: "0 auto", maxWidth: 560, color: "var(--text-secondary)", overflowWrap: "anywhere" }}>
                {error}
              </p>
            </div>
          )}
        </div>

        <footer className="modal-footer">{footer}</footer>
      </section>
    </div>
  );
}

function RunResult({ runDetail }: { runDetail: RunDetail }) {
  return (
    <div className="panel-stack">
      <div className="status-callout" style={{ borderLeftColor: runDetail.process_error_detected ? "var(--danger)" : "var(--pass)" }}>
        <strong>Run complete</strong>
        <span>
          Final verdict: {runDetail.final_verdict ?? "unknown"}. Process status: {runDetail.process_error_detected ? "review required" : "clean"}.
        </span>
      </div>

      <div className="result-grid">
        <ResultTile label="Final verdict" value={runDetail.final_verdict ?? "-"} />
        <ResultTile label="Expected" value={runDetail.correct_verdict ?? "-"} />
        <ResultTile label="Outcome correct" value={runDetail.outcome_correct === null ? "-" : runDetail.outcome_correct ? "Yes" : "No"} />
        <ResultTile label="Clause coverage" value={`${((runDetail.clause_coverage_score ?? 0) * 100).toFixed(0)}%`} />
        <ResultTile label="Duration" value={runDetail.duration_seconds ? `${runDetail.duration_seconds.toFixed(1)}s` : "-"} />
      </div>

      {runDetail.pdfScenario?.input_summary && (
        <div>
          <div className="section-label">PDF inputs</div>
          <div className="responsive-data-grid">
            {Object.entries(runDetail.pdfScenario.input_summary).map(([k, v]) => (
              <div key={k} className="input-tile">
                <span>{k.replace(/_/g, " ")}</span>
                <strong>{typeof v === "object" ? JSON.stringify(v) : String(v)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {runDetail.tool_accuracy_details?.length ? (
        <div>
          <div className="section-label">Tool scores</div>
          <div className="bar-list">
            {runDetail.tool_accuracy_details.map((item: any, i: number) => (
              <MetricBar
                key={`${item.tool_name}-${i}`}
                label={item.tool_name}
                value={item.accuracy_score ?? 0}
                color={(item.accuracy_score ?? 0) >= 0.8 ? "var(--pass)" : "var(--warn)"}
              />
            ))}
          </div>
        </div>
      ) : null}

      {runDetail.scenario_inputs && (
        <div>
          <div className="section-label">Scenario inputs used</div>
          <pre className="code-block">{JSON.stringify(runDetail.scenario_inputs, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="result-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="status-callout" style={{ borderLeftColor: "var(--danger)" }}>
      <strong style={{ color: "var(--danger)" }}>Action needed</strong>
      <span>{children}</span>
    </div>
  );
}
