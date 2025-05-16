import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  server: {
    port: 5135, // Set fixed port
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    {
      name: 'api-routes',
      configureServer(server) {
        server.middlewares.use('/api/save-search', async (req, res) => {
          if (req.method === 'POST') {
            // Dynamically import the endpoint only when needed
            const { saveSearchEndpoint } = await import('./src/api/save-search')
            const response = await saveSearchEndpoint(req as any)
            res.statusCode = response.status
            res.setHeader('Content-Type', 'application/json')
            res.end(await response.text())
          } else {
            res.statusCode = 405
            res.end(JSON.stringify({ message: 'Method not allowed' }))
          }
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: true,
    assetsInlineLimit: 0, // Don't inline any assets as base64
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          let extType = name.split('.').at(1) || 'asset';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img';
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          if (name && name.includes('logo')) {
            return 'assets/logos/[name]-[hash].js';
          }
          return 'assets/js/[name]-[hash].js';
        },
      }
    }
  },
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.svg'],
})