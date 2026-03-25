import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduce file system conflicts on Windows
  experimental: {
    webpackBuildWorker: false, // Reduce parallel file operations
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
    ],
  },
};

export default nextConfig;