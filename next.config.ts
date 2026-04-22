import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          ...(process.env.NODE_ENV === "production"
            ? ([
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ] as const)
            : []),
        ],
      },
    ];
  },
  experimental: {
    webpackBuildWorker: false,
    /** Keeps dev server bundles from emitting extra server source maps (can reduce noisy logs). */
    serverSourceMaps: false,
    // @ts-ignore - experimental feature in Next.js 16
    proxyClientMaxBodySize: "32mb",
  },
  serverExternalPackages: ['ffprobe-static'],

  images: {
    localPatterns: [
      {
        pathname: '/api/storage-image',
        search: '**',
      },
    ],
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