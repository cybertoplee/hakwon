import type { NextConfig } from "next";

console.log('🔍 DEBUG next.config: EGDESK_BASE_PATH env var =', process.env.EGDESK_BASE_PATH);

const nextConfig: NextConfig = {
  eslint: {
    // Always skip ESLint errors to prevent blocking on auto-generated files
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        '*.loca.lt',
        '*.ngrok.io',
        '*.ngrok-free.app',
        '*.trycloudflare.com',
        '*.gitpod.io',
        '*.tryhook.io',
        '*.localto.net'
      ]
    }
  },

  // Only use basePath in production mode, not in dev mode
  basePath: process.env.NODE_ENV === 'development' ? '' : (process.env.EGDESK_BASE_PATH || ''),
  assetPrefix: process.env.NODE_ENV === 'development' ? '' : (process.env.EGDESK_BASE_PATH || ''),

  // Allow external IP access for development resources (Fonts, HMR WebSocket, etc.)
  // This is required for mobile testing via IP address in Next.js 15/16 Turbopack
  allowedDevOrigins: ['192.168.0.7', 'localhost:3000'],

  typescript: {
    // Always skip TypeScript errors to prevent blocking on auto-generated files
    ignoreBuildErrors: true,
  },

  // Note: eslint configuration at the top level is deprecated in newer Next.js versions.
  // If needed, it should be configured via experimental or separate lint commands.
};

console.log('🔍 DEBUG next.config: Final config basePath =', nextConfig.basePath);
console.log('🔍 DEBUG next.config: Final config assetPrefix =', nextConfig.assetPrefix);

export default nextConfig;
