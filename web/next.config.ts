import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "oipozdbfxyskoscsgbfq.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel.app",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://*.scdn.co https://*.spotifycdn.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://vercel.live",
              "frame-src 'self' https://open.spotify.com https://www.youtube.com https://youtube.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self' https://*.supabase.co https://*.supabase.in https://accounts.google.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/performers",
        destination: "/songwriters",
        permanent: true,
      },
      {
        source: "/performers/:id",
        destination: "/songwriters/:id",
        permanent: true,
      },
      {
        source: "/studios",
        destination: "/members?role=studio",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
