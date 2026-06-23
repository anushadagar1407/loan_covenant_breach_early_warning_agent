'use client'

import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { RegistrySummary } from '../../lib/types'
import {
  ConceptTile,
  RegistryHeader,
  RegistrySubnav,
  RegistrySummaryCards,
  RouteCard,
  registryConcepts,
} from './components'

export default function RegistryPage() {
  const [summary, setSummary] = useState<RegistrySummary | null>(null)

  useEffect(() => {
    api.getRegistrySummary().then(setSummary).catch(() => {})
  }, [])

  return (
    <div>
      <RegistryHeader
        title="Registry overview: the vocabulary before the evidence"
        subtitle="Use this page as the entry point for the evaluation story. It defines the covenant terms, the agent-run terms, and where each kind of evidence lives."
      />

      <div className="page-content">
        <RegistrySubnav />

        <section className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="section-label">Concepts before metrics</div>
          <h2 className="page-title">What the reader needs to know before inspecting runs</h2>
          <p className="page-subtitle">
            The registry is the evidence notebook for the agent. It separates the result the agent produced from
            the post-run checks used to decide whether that result is trustworthy enough for a loan covenant workflow.
          </p>
          <div className="concept-grid" style={{ marginTop: 18 }}>
            {registryConcepts.map((concept, index) => (
              <ConceptTile key={concept.title} title={concept.title} body={concept.body} index={index + 1} />
            ))}
          </div>
        </section>

        <RegistrySummaryCards summary={summary} />

        <section className="route-card-grid">
          <RouteCard
            eyebrow="Next section"
            title="Metric definitions"
            href="/registry/metrics"
            body="See how trajectory, tool accuracy, clause coverage, latency, and process-outcome gap are calculated."
          />
          <RouteCard
            eyebrow="Evidence section"
            title="H1/H2 support tables"
            href="/registry/evidence"
            body="Review hidden process gaps and process-error rates by autonomy level without mixing them into the concept page."
          />
          <RouteCard
            eyebrow="Underlying records"
            title="Agent run history"
            href="/runs"
            body="Open the run list when you need the raw output and post-run evaluation for an individual scenario."
          />
        </section>
      </div>
    </div>
  )
}
