/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ['*.replit.dev', '*.replit.app', '*.picard.replit.dev'],
}

export default nextConfig
