/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // token logos come from many CDNs
    ],
  },
  experimental: { serverComponentsExternalPackages: ['ioredis'] },
};
export default nextConfig;
