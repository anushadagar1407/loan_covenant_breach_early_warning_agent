import type { AgentRun, RunDetail, RegistrySummary, Scenario, TrustAnalysis, TrustResponsePayload, TrustResponseRecord } from './types'

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`)
  return res.json()
}

export const api = {
  getRuns: (page = 1, autonomyLevel?: number): Promise<{ runs: AgentRun[]; page: number }> => {
    const qs = new URLSearchParams({ page: String(page) })
    if (autonomyLevel) qs.set('autonomy_level', String(autonomyLevel))
    return fetchJSON(`/api/runs?${qs}`)
  },

  getRun: (id: string): Promise<RunDetail> =>
    fetchJSON(`/api/runs/${id}`),

  getScenarios: (): Promise<{ scenarios: Scenario[] }> =>
    fetchJSON('/api/scenarios'),

  getRegistrySummary: (): Promise<RegistrySummary> =>
    fetchJSON('/api/registry/summary'),

  getMetricsOverTime: (): Promise<{ data: any[] }> =>
    fetchJSON('/api/registry/metrics-over-time'),

  getH1Evidence: (): Promise<any> =>
    fetchJSON('/api/registry/h1-evidence'),

  getH2Evidence: (): Promise<any> =>
    fetchJSON('/api/registry/h2-evidence'),

  getTrustAnalysis: (): Promise<TrustAnalysis> =>
    fetchJSON('/api/trust/analysis'),

  getTrustResponses: (): Promise<{ responses: TrustResponseRecord[] }> =>
    fetchJSON('/api/trust/responses'),

  submitTrustResponse: (payload: TrustResponsePayload): Promise<any> =>
    fetch(`${BASE}/api/trust/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async r => {
      if (!r.ok) throw new Error(`API error ${r.status}: /api/trust/responses`)
      return r.json()
    }),

  startRun: (scenarioId: string, autonomyLevel: number): Promise<{ run_id: string; status: string }> =>
    fetch(`${BASE}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId, autonomy_level: autonomyLevel }),
    }).then(async r => {
      if (!r.ok) throw new Error(`API error ${r.status}: /api/runs`)
      return r.json()
    }),

  health: (): Promise<{ status: string; ollama_connected: boolean; db_connected: boolean }> =>
    fetchJSON('/health'),
}
