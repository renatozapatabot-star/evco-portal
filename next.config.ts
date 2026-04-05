import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/cruz-ai',
        destination: '/cruz',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
