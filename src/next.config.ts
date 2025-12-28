
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
           '9000-firebase-studio-1763190344911.cluster-lu4mup47g5gm4rtyvhzpwbfadi.cloudworkstations.dev'
         ]
       },
       crossOrigin: 'anonymous',
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
         ],
       },
     };
     
     export default nextConfig;
