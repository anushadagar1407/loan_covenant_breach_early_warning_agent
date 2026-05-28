'use client'

import './globals.css'

const navItems = [
  { href: '/', label: 'Dashboard', code: 'DB' },
  { href: '/defense', label: 'Thesis Evidence', code: 'TH' },
  { href: '/runs', label: 'Agent Runs', code: 'AR' },
  { href: '/registry', label: 'Registry', code: 'RG' },
  { href: '/trust', label: 'Trust Study', code: 'TS' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Covenant Intelligence Platform</title>
        <meta
          name="description"
          content="Loan Covenant Breach Early Warning - Deutsche Bank Thesis Project"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="app-shell">
          <aside className="app-sidebar" aria-label="Primary navigation">
            <a className="app-brand" href="/">
              <span className="app-brand-mark">DB</span>
              <span>
                <span className="app-brand-name">Covenant Intelligence</span>
                <span className="app-brand-subtitle">Evaluation framework</span>
              </span>
            </a>

            <nav className="app-nav">
              {navItems.map(({ href, label, code }) => (
                <a key={href} href={href} className="app-nav-link">
                  <span className="app-nav-code">{code}</span>
                  <span>{label}</span>
                </a>
              ))}
            </nav>

            <div className="app-sidebar-footer">
              <span>v1.0</span>
              <span>Process transparency</span>
            </div>
          </aside>

          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  )
}
