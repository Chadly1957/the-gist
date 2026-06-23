/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },

  async redirects() {
    return [
      // Permanent redirect from old domain to new — passes SEO link equity
      {
        source: "/:path*",
        has: [{ type: "host", value: "the-gist.news" }],
        destination: "https://thegistdecatur.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.the-gist.news" }],
        destination: "https://thegistdecatur.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
