'use client'

export default function DefensePage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-inner">
          <div className="pill-row" style={{ alignItems: 'center', marginBottom: 10 }}>
            <span className="badge badge-blue">Thesis evidence</span>
            <span className="eyebrow">Research question and evidence layers</span>
          </div>
          <h1 className="page-title">What this thesis is researching and how to read it.</h1>
          <div className="page-subtitle">
            Start here if you want the story before the numbers. The results page shows the evidence itself.
          </div>
        </div>
      </div>

      <div className="page-content">
        <section className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="section-label">Research focus</div>
          <h2 className="page-title">The project studies whether correct agent answers can still hide risky process gaps.</h2>
          <p className="page-subtitle">
            The thesis asks whether a loan-covenant agent can produce the right final verdict while still skipping required checks,
            and whether people trust that output differently when the process evidence is visible.
          </p>
        </section>

        <section className="story-grid" style={{ marginBottom: 20 }}>
          <div className="card card-pad">
            <div className="section-label">Evidence layers</div>
            <div className="timeline-list" style={{ marginTop: 16 }}>
              <div className="timeline-step"><div><strong>Outcome layer</strong><span>Final breach verdict and correctness against the controlled scenario.</span></div></div>
              <div className="timeline-step"><div><strong>Process layer</strong><span>Clause coverage, trajectory, and tool sequence that explain how the verdict was reached.</span></div></div>
              <div className="timeline-step"><div><strong>Trust layer</strong><span>Reviewer trust, auditability, reliability, and explanation sufficiency scores.</span></div></div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="section-label">How to read the study</div>
            <p className="page-subtitle">
              First inspect the registry for definitions, then the agent runs for run-level detail, and then the results page for hypothesis support.
              The trust collection page is separate because it captures human ratings on a neutral stimulus.
            </p>
            <div className="stat-list" style={{ marginTop: 16 }}>
              <div className="stat-row">
                <span>Registry</span>
                <strong>Definitions and shared vocabulary</strong>
              </div>
              <div className="stat-row">
                <span>Agent Runs</span>
                <strong>Run details, outputs, and review scores</strong>
              </div>
              <div className="stat-row">
                <span>Trust Study</span>
                <strong>Independent human rating collection</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="route-card-grid">
          <a className="route-card" href="/defense/results">
            <span>Next section</span>
            <strong>Thesis evidence results</strong>
            <p>Open the page with the current H1-H4 claims, metrics, and readiness status.</p>
          </a>
          <a className="route-card" href="/registry">
            <span>Start here</span>
            <strong>Registry</strong>
            <p>Read the vocabulary and metric definitions before interpreting the evidence.</p>
          </a>
          <a className="route-card" href="/trust">
            <span>Collection</span>
            <strong>Trust study</strong>
            <p>Review the neutral rating workflow that captures human judgments.</p>
          </a>
        </section>
      </div>
    </div>
  )
}
