'use client'

import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Covenant Intelligence Platform</title>
        <meta name="description" content="Loan Covenant Breach Early Warning — Deutsche Bank Thesis Project" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: '#0A0E1A', color: '#F9FAFB', fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Sidebar */}
          <aside style={{
            width: '220px',
            background: '#0D1220',
            borderRight: '1px solid #1F2937',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            height: '100vh',
            zIndex: 10,
          }}>
            <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1F2937' }}>
              <div style={{
                background: '#003882',
                color: 'white',
                fontFamily: "'IBM Plex Mono', monospace",
                fontWeight: 600,
                fontSize: '11px',
                letterSpacing: '0.08em',
                padding: '6px 10px',
                marginBottom: '10px',
                borderRadius: '2px',
              }}>DEUTSCHE BANK</div>
              <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.4 }}>
                Covenant Intelligence<br />Platform
              </div>
            </div>
            <nav style={{ padding: '16px 12px', flex: 1 }}>
              {[
                { href: '/', label: 'Dashboard', icon: '◉' },
                { href: '/runs', label: 'Agent Runs', icon: '▷' },
                { href: '/registry', label: 'Agent Registry', icon: '⬡' },
              ].map(({ href, label, icon }) => (
                <a key={href} href={href} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '4px',
                  color: '#9CA3AF',
                  textDecoration: 'none',
                  fontSize: '13px',
                  marginBottom: '2px',
                  transition: 'all 0.15s',
                }}
                  onMouseOver={e => {
                    (e.currentTarget as HTMLElement).style.background = '#1F2937'
                    ;(e.currentTarget as HTMLElement).style.color = '#F9FAFB'
                  }}
                  onMouseOut={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = '#9CA3AF'
                  }}
                >
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>{icon}</span>
                  {label}
                </a>
              ))}
            </nav>
            <div style={{ padding: '16px 20px', borderTop: '1px solid #1F2937', fontSize: '10px', color: '#4B5563', fontFamily: "'IBM Plex Mono', monospace" }}>
              v1.0 · THESIS BUILD
            </div>
          </aside>

          {/* Main content */}
          <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}