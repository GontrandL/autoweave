/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
    serverComponentsExternalPackages: ['@autoweave/ui'],
  },
  transpilePackages: ['@autoweave/ui'],
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;