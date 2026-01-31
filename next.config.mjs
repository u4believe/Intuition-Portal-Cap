/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for dynamic deployment
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
