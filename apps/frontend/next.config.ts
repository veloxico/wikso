import type { NextConfig } from "next";

// Server-side rewrite target: in Docker use API_INTERNAL_URL (e.g. http://backend:3000)
// to reach the backend via Docker network; falls back to the public URL for local dev.
const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        // Proxy /api/* requests to the backend so that:
        // 1. Image <img src="/api/attachments/:id/file"> works same-origin
        // 2. No CORS issues for any API call
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
