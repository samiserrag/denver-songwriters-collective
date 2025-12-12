import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/performers",
        destination: "/members?role=performer",
        permanent: false,
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
