/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // Fixed: Enable TypeScript error checking
  },
  eslint: {
    // Disable ESLint during build to avoid circular structure error
    // ESLint can still be run manually with: npm run lint
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: false,
  },
  webpack: (config, { isServer, dev }) => {
    // Fix for webpack hash calculation issues
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            // Separate chunk for CRM dialogs to reduce main chunk size
            crmDialogs: {
              test: /[\\/]components[\\/]crm[\\/](add-.*-dialog)/,
              name: 'crm-dialogs',
              priority: 20,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // Separate chunk for CRM views
            crmViews: {
              test: /[\\/]components[\\/]crm[\\/](.*-view)/,
              name: 'crm-views',
              priority: 15,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // Separate chunk for chart libraries
            charts: {
              test: /[\\/]node_modules[\\/](recharts|d3-.*)/,
              name: 'charts',
              priority: 25,
              reuseExistingChunk: true,
              chunks: 'all',
            },
            // Separate chunk for UI components
            ui: {
              test: /[\\/]components[\\/]ui[\\/]/,
              name: 'ui-components',
              priority: 10,
              reuseExistingChunk: true,
              chunks: 'all',
            },
          },
        },
      };
    }
    
    // Improve HMR and chunk loading in development
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    
    return config;
  },
  // Increase build timeout for large projects
  staticPageGenerationTimeout: 120,
  // Improve dev server stability
  experimental: {
    // Enable faster refresh
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },
  // Add better error handling for chunk loading
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
}

export default nextConfig
