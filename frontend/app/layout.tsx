'use client'

import './globals.css'
import { BarChart3, ClipboardCheck, Database, FileCheck2, Gauge, Landmark } from 'lucide-react'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: Gauge },
  { href: '/defense', label: 'Thesis Evidence', icon: FileCheck2 },
  { href: '/runs', label: 'Agent Runs', icon: BarChart3 },
  { href: '/registry', label: 'Registry', icon: Database },
  { href: '/trust', label: 'Trust Study', icon: ClipboardCheck },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <html lang="en">
      <head>
        <title>Covenant Intelligence Platform</title>
        <meta
          name="description"
          content="Loan covenant breach evaluation workflow for process evidence, agent runs, and trust study analysis"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="app-shell">
          <aside className="app-sidebar" aria-label="Primary navigation">
            <a className="app-brand" href="/">
              <span className="app-brand-mark" aria-hidden="true">
                <Landmark size={20} strokeWidth={1.9} />
              </span>
              <span>
                <span className="app-brand-name">Covenant Intelligence</span>
                <span className="app-brand-subtitle">Research workflow</span>
              </span>
            </a>

            <nav className="app-nav">
              {navItems.map(({ href, label, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  className={`app-nav-link ${pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'app-nav-link-active' : ''}`}
                >
                  <span className="app-nav-icon" aria-hidden="true">
                    <Icon size={16} strokeWidth={1.9} />
                  </span>
                  <span>{label}</span>
                </a>
              ))}
            </nav>

            <div className="app-sidebar-footer">
              <span>v1.0</span>
              <span>Evidence trail</span>
            </div>
          </aside>

          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  )
}
