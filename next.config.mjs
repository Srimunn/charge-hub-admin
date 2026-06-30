// Clean up empty or invalid env variables set by Docker ARG/ENV instructions at build time
for (const key of ['NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'NEXT_PUBLIC_API_URL', 'BACKEND_API_URL', 'NEXT_PUBLIC_SOCKET_URL']) {
  if (process.env[key] === '' || process.env[key] === 'undefined' || process.env[key] === 'null') {
    delete process.env[key];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  images: {
    domains: ['res.cloudinary.com', 'localhost'],
  },
  // Expose env variables to the browser bundle
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
};

export default nextConfig;
