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
}

export default nextConfig
