
      import type {NextConfig} from 'next';
      
      const nextConfig: NextConfig = {
        /* config options here */
        typescript: {
          ignoreBuildErrors: true,
        },
        eslint: {
         ignoreDuringBuilds: true,
       },
       devIndicators: {
         allowedDevOrigins: [
           '6000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev',
         ]
       },
       async headers() {
        return [
          {
            source: '/:path*',
            headers: [
              {
                key: 'Permissions-Policy',
                value: 'clipboard-write=*',
              },
              {
                key: 'Content-Security-Policy',
                value: "connect-src *;",
              }
            ],
          },
        ];
       },
       images: {
         dangerouslyAllowSVG: true,
         remotePatterns: [
           {
             protocol: 'https',
             hostname: 'placehold.co',
             port: '',
             pathname: '/**',
           },
           {
             protocol: 'https',
             hostname: 'images.unsplash.com',
             port: '',
             pathname: '/**',
           },
           {
             protocol: 'https',
             hostname: 'picsum.photos',
             port: '',
             pathname: '/**',
           },
           {
             protocol: 'https',
             hostname: 'res.cloudinary.com',
             port: '',
             pathname: '/**',
           },
           {
            protocol: 'https',
            hostname: 'api.qrserver.com',
            port: '',
            pathname: '/**',
          },
         ],
       },
       webpack: (config, { isServer }) => {
        if (!isServer) {
          config.resolve.fallback = {
            ...config.resolve.fallback,
            async_hooks: false,
          };
        }
        return config;
      },
     };
     
     export default nextConfig;






