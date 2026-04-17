import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    webpackBuildWorker: false,
    /** Keeps dev server bundles from emitting extra server source maps (can reduce noisy logs). */
    serverSourceMaps: false,
    // @ts-ignore - experimental feature in Next.js 16
    proxyClientMaxBodySize: '1gb',
  },
  serverExternalPackages: ['ffprobe-static'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pinimg.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

export default nextConfig;