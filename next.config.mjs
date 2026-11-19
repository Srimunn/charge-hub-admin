// Clean up empty or invalid env variables set by Docker ARG/ENV instructions at build time
for (const key of ['NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'NEXT_PUBLIC_API_URL', 'BACKEND_API_URL', 'NEXT_PUBLIC_SOCKET_URL', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY']) {
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
  async rewrites() {
    const backendUrl = (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
    return [
      {
        source: '/api/stations/:path*',
        destination: `${backendUrl}/api/stations/:path*`,
      },
      {
        source: '/api/sessions/:path*',
        destination: `${backendUrl}/api/sessions/:path*`,
      },
      {
        source: '/api/faults/:path*',
        destination: `${backendUrl}/api/faults/:path*`,
      },
      {
        source: '/api/payments/:path*',
        destination: `${backendUrl}/api/payments/:path*`,
      },
      {
        source: '/api/dashboard/:path*',
        destination: `${backendUrl}/api/dashboard/:path*`,
      },
      {
        source: '/api/notifications/:path*',
        destination: `${backendUrl}/api/notifications/:path*`,
      },
      {
        source: '/api/users/:path*',
        destination: `${backendUrl}/api/users/:path*`,
      },
    ];
  },
};

export default nextConfig;
