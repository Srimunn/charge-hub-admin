/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  images: {
    domains: ['res.cloudinary.com', 'localhost'],
  },
  // To match the existing API calls that might use absolute paths
  async rewrites() {
    return [
      {
        source: '/api/:path((?!auth).*)',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
