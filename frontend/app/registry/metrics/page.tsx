'use client'

import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import type { RegistrySummary } from '../../../lib/types'
import {
  MetricDefinition,
  RegistryHeader,
  RegistrySubnav,
  RegistrySummaryCards,
  metricDefinitions,
} from '../components'

export default function RegistryMetricsPage() {
  const [summary, setSummary] = useState<RegistrySummary | null>(null)

  useEffect(() => {
    api.getRegistrySummary().then(setSummary).catch(() => {})
  }, [])

  return (
    <div>
      <RegistryHeader
        title="Registry metrics: how process evidence is scored"
        subtitle="This page defines the five thesis metrics so readers can understand the evidence tables before interpreting them."
      />

      <div className="page-content">
        <RegistrySubnav />

        <RegistrySummaryCards summary={summary} />

        <section className="card card-pad">
          <div className="section-label">Process-level evaluation framework</div>
          <h2 className="page-title">The five metrics used to evaluate agent runs</h2>
          <p className="page-subtitle">
            These metrics explain why a correct covenant verdict is not enough. They inspect whether the workflow was complete,
            traceable, and defensible.
          </p>
          <div className="metric-definition-grid" style={{ marginTop: 18 }}>
            {metricDefinitions.map(metric => (
              <MetricDefinition key={metric.id} {...metric} />
            ))}
          </div>
        </section>

        <section className="route-card-grid" style={{ marginTop: 20 }}>
          <a className="route-card" href="/registry/evidence">
            <span>Next section</span>
            <strong>Open evidence tables</strong>
            <p>Use the H1/H2 evidence page to see where these metric definitions appear in actual runs.</p>
          </a>
          <a className="route-card" href="/registry">
            <span>Back</span>
            <strong>Registry concepts</strong>
            <p>Return to the vocabulary page if a reader needs the covenant and agent-run terms first.</p>
          </a>
        </section>
      </div>
    </div>
  )
}
