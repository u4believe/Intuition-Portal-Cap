/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for decentralized deployment
  output: 'export',
  // Disable image optimization for static sites
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Turbopack configuration for Next.js 16
  turbopack: {},
  // No API routes since we're fully decentralized
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    }
    return config
  },
}

export default nextConfig
