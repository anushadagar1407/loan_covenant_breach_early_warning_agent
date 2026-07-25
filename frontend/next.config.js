/** @type {import('next').NextConfig} */
// BACKEND_URL lets deployed environments (e.g. Render) point the proxy at the
// hosted backend instead of localhost. Falls back to local dev backend.
const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8010'

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${BACKEND_URL}/health`,
      },
    ]
  },
}

module.exports = nextConfig
