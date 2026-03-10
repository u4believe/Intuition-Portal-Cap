/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    '*.replit.dev',
    '*.replit.app',
    '*.picard.replit.dev',
    '*.spock.replit.dev',
    '*.kirk.replit.dev',
  ],
}

export default nextConfig
