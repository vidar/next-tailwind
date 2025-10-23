/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Don't fail build on linting errors
    ignoreDuringBuilds: false,
    // Ignore specific rules
    dirs: ['src'],
  },
  typescript: {
    // Don't fail build on TypeScript errors (optional - only if you want this too)
    // ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
