/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Désactiver React StrictMode en développement pour éviter les double-renders
  reactStrictMode: false,
}

export default nextConfig