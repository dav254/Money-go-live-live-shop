/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep native/node-only packages out of the server bundle — fixes
  // "Can't resolve 'stream'" for firebase-admin in instrumentation
  // and lets sharp/ffmpeg glue code load natively.
  serverExternalPackages: [
    'firebase-admin',
    '@google-cloud/firestore',
    'sharp',
    'cloudinary',
    // WhatsApp alert bridge — native/ws-heavy protocol library; load it
    // natively at runtime instead of bundling it into the server build.
    '@whiskeysockets/baileys',
    // Genkit + OpenTelemetry: huge dynamic-require trees that bloat the
    // server bundle and dev memory. Load them natively at runtime instead.
    'genkit',
    '@genkit-ai/core',
    '@genkit-ai/googleai',
    '@opentelemetry/exporter-jaeger',
    '@opentelemetry/sdk-node',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Reduce webpack memory footprint (small dev containers / 2GB VPS)
    webpackMemoryOptimizations: true,
  },
  async redirects() {
    return [];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self), clipboard-write=(self "https://vidnov.com")',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.videosdk.live https://apis.google.com; connect-src 'self' *; img-src 'self' * data: blob:; media-src 'self' * data: blob:; font-src 'self' data: fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; frame-src 'self' https://*.paypal.com https://*.paystack.com; frame-ancestors 'self' https://freebuff.com https://*.freebuff.com https://*.e2b.app http://localhost:* https://localhost:*;",
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
  images: {
    dangerouslyAllowSVG: true,
    /*
     * NOTE: Next 15 has no global `images.quality` (or `images.qualities`) —
     * quality is a per-`<Image>` `quality` prop whose DEFAULT is 75. That
     * default is what softened uploaded product photos (the "blurry in
     * Discovery" complaint): the upload pipeline already stores a clean q92
     * WebP, and the image optimizer was re-encoding it at 75 on the way to the
     * screen. Discovery surfaces therefore pass an explicit high `quality`
     * prop on the images buyers actually look at (see discovery-video-post).
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'goearnvid.shop' }, // VPS-served media (relative /api/media URLs also work)
      { protocol: 'https', hostname: 'api.qrserver.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      // Google sign-in avatars (photoURL) — the most common
      // profilePictureUrl on the platform, and a throw in next/image for any
      // host missing here crashes the page that renders the avatar.
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        async_hooks: false,
        tls: false,
        net: false,
        fs: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
