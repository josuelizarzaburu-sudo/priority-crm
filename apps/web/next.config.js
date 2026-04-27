/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@priority-crm/shared', '@priority-crm/ui'],
  images: {
    remotePatterns: [
      { hostname: 'avatars.githubusercontent.com' },
      { hostname: 'lh3.googleusercontent.com' },
      { hostname: 's3.amazonaws.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
}

module.exports = nextConfig
